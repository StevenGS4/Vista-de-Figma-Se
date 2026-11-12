import express from 'express';
import { pool } from './config/database.js';
import { requireAuth } from './auth.js';
import { readRecords } from './tramite.js';
import { concentrationScope,canEditConcentrationLocation,parseLocation } from './concentration-policy.js';

export const concentrationRouter=express.Router();
concentrationRouter.use(requireAuth);
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
function condition(user,scope){
 if(scope==='GLOBAL')return {sql:"WHERE e.etapa='CONCENTRACION'",args:[]};
 if(scope==='AREA')return {sql:"WHERE e.etapa='CONCENTRACION' AND a.codigo=?",args:[user.areaId]};
 return {sql:"WHERE e.etapa='CONCENTRACION' AND a.codigo=? AND i.creado_por=?",args:[user.areaId,user.id]};
}
async function enrichRecords(records){
 if(!records.length)return [];
 const extra=new Map();
 // Fragmentar las consultas para evitar listas SQL gigantes y límites de parámetros.
 for(let start=0;start<records.length;start+=400){
  const chunk=records.slice(start,start+400);
  const ids=chunk.map(r=>Number(r.id.replace(/^REG-/,'')));
  const [rows]=await pool.query(`SELECT e.id,e.archivo_zona,
   DATE_FORMAT(r.fecha,'%Y-%m-%d') AS recepcion_fecha,
   CONCAT_WS(' ',u.nombres,u.apellido_paterno,u.apellido_materno) AS recepcion_responsable,
   r.observaciones AS recepcion_observaciones,
   r.estado AS recepcion_estado
   FROM expedientes e
   JOIN transferencia_inventarios ti ON ti.inventario_id=e.inventario_id
   JOIN transferencias t ON t.id=ti.transferencia_id AND t.estado='ACEPTADA'
   LEFT JOIN recepciones r ON r.id=(SELECT MAX(r2.id) FROM recepciones r2 WHERE r2.transferencia_id=t.id)
   LEFT JOIN usuarios u ON u.id=r.responsable_id
   WHERE e.id IN (${ids.map(()=>'?').join(',')})`,ids);
  for(const row of rows)extra.set(Number(row.id),row);
 }
 return records.map(record=>{
  const row=extra.get(Number(record.id.replace(/^REG-/,'')));
  return {...record,
    archiveZone:row?.archivo_zona||'Ubicación pendiente de asignación',
    receptionDate:row?.recepcion_fecha||'',
    receptionResponsible:row?.recepcion_responsable||'',
    receptionNotes:row?.recepcion_observaciones||'',
  };
 });
}
async function listFor(user,oneId=null){
 const scope=concentrationScope(user);
 if(!scope)throw fail(user.mustChangePassword?'Debes cambiar tu contraseña':'Sin permiso para consultar concentración',403);
 const {sql,args}=condition(user,scope);
 const suffix=oneId?" AND e.id=?":'';
 const records=await readRecords(pool,sql+suffix,oneId?[...args,oneId]:args);
 return enrichRecords(records);
}
concentrationRouter.get('/expedientes',async(req,res,next)=>{
 try {res.json({records:await listFor(req.auth.user)});}
 catch(error){next(error);}
});
concentrationRouter.put('/expedientes/:id/ubicacion',async(req,res,next)=>{
 let conn;
 try{
  const user=req.auth.user;
  if(!canEditConcentrationLocation(user))
   throw fail('Solo el responsable de control archivístico o administrador puede cambiar ubicaciones',403);
  const idText=String(req.params.id);
  if(!/^REG-[1-9]\d*$/.test(idText))throw fail('ID de expediente inválido');
  let location;
  try{location=parseLocation(req.body);}catch(error){throw fail(error.message);}
  const id=Number(idText.slice(4));
  if(!Number.isSafeInteger(id))throw fail('ID inválido');
  conn=await pool.getConnection();
  await conn.beginTransaction();
  const [found]=await conn.execute(`SELECT e.id,e.etapa,i.estado AS inventory_state,t.estado AS transfer_state
    FROM expedientes e
    JOIN inventarios i ON i.id=e.inventario_id
    JOIN transferencia_inventarios ti ON ti.inventario_id=i.id
    JOIN transferencias t ON t.id=ti.transferencia_id
    WHERE e.id=? FOR UPDATE`,[id]);
  if(!found.length)throw fail('Expediente transferido no encontrado',404);
  if(found[0].etapa!=='CONCENTRACION'||found[0].inventory_state!=='CONCENTRACION'||
    found[0].transfer_state!=='ACEPTADA')
    throw fail('No se puede asignar ubicación antes de aceptar la transferencia',409);
  // La etapa y la disponibilidad jamás se actualizan desde esta ruta.
  await conn.execute(`UPDATE expedientes SET archivo_zona=?,lugar_resguardo=?,estante=?,nivel=?,
    seccion_fisica=?,posicion=?,caja_ubicacion=?,notas_ubicacion=? WHERE id=?`,
    [location.archiveZone,location.room,location.shelf,location.level,
     location.physicalSection,location.position,location.locationBox,location.locationNotes,id]);
  await conn.execute('INSERT INTO auditoria(actor_id,entidad,entidad_id,accion,detalle) VALUES (?,?,?,?,?)',
    [user.id,'expedientes',id,'ACTUALIZAR_UBICACION',JSON.stringify({
      archiveZone:location.archiveZone,room:location.room,shelf:location.shelf,
      level:location.level,physicalSection:location.physicalSection,
      position:location.position,locationBox:location.locationBox
    })]);
  await conn.commit();
  const [record]=await listFor(user,id);
  res.json({record});
 }catch(error){if(conn)await conn.rollback();next(error);}
 finally{conn?.release();}
});
