import express from 'express';
import { pool } from './config/database.js';
import { requireAuth, requireAdmin } from './auth.js';
import { readRecords } from './tramite.js';
import { concentrationScope,canEditConcentrationLocation,parseLocation } from './concentration-policy.js';

export const concentrationRouter=express.Router();
concentrationRouter.use(requireAuth);
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
function condition(user,scope){
 if(scope==='GLOBAL')return {sql:"WHERE e.etapa='CONCENTRACION'",args:[]};
 if(scope==='AREA')return {sql:"WHERE e.etapa='CONCENTRACION' AND a.codigo=?",args:[user.areaId]};
 return {sql:"WHERE e.etapa='CONCENTRACION' AND a.codigo=? AND e.creado_por=?",args:[user.areaId,user.id]};
}
export async function enrichConcentrationRecords(records){
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
   JOIN transferencia_expedientes_v ti ON ti.expediente_id=e.id
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
    receptionConfirmed:row?.recepcion_estado==='RECIBIDA',
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
 return enrichConcentrationRecords(records);
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
  const [found]=await conn.execute(`SELECT e.id,e.etapa,e.disponibilidad,i.estado AS inventory_state,t.estado AS transfer_state
    FROM expedientes e
    JOIN inventarios i ON i.id=e.inventario_id
    JOIN transferencia_expedientes_v ti ON ti.expediente_id=e.id
    JOIN transferencias t ON t.id=ti.transferencia_id
    WHERE e.id=? FOR UPDATE`,[id]);
  if(!found.length)throw fail('Expediente transferido no encontrado',404);
  if(found[0].disponibilidad==='PRESTADO')throw fail('La ubicación se puede editar después de registrar la devolución',409);
  if(found[0].etapa!=='CONCENTRACION'||
    found[0].transfer_state!=='ACEPTADA')
    throw fail('No se puede asignar ubicación antes de aceptar la transferencia',409);
  const [[physical]]=await conn.execute(`SELECT r.estado FROM recepciones r
    JOIN transferencia_expedientes_v ti ON ti.transferencia_id=r.transferencia_id
    JOIN expedientes e ON e.id=ti.expediente_id
    WHERE e.id=? ORDER BY r.id DESC LIMIT 1`,[id]);
  if(physical?.estado!=='RECIBIDA')
    throw fail('Primero confirma la recepción física y asigna la ubicación desde Transferencias',409);
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

function parseInventoryData(body){
 if(!body || ['access','tradition','m','n','p'].some(key=>typeof body[key]!=='string'))
  throw fail('Completa los campos del inventario con valores válidos.');
 const {access,tradition}=body;
 const [m,n,p]=['m','n','p'].map(key=>body[key].trim());
 if(!['','P','C','R'].includes(access)||!['','ORIGINAL','COPIA','AMBAS'].includes(tradition)||
   [m,n,p].some(value=>value.length>100))
  throw fail('Los datos del inventario no son válidos.');
 return {access,tradition,m,n,p};
}

concentrationRouter.put('/expedientes/:id/datos-inventario',requireAdmin,async(req,res,next)=>{
 let conn;
 try{
  const user=req.auth.user;
  if(!canEditConcentrationLocation(user))throw fail('Solo el administrador puede actualizar los datos del inventario',403);
  const id=Number(/^REG-([1-9][0-9]*)$/.exec(req.params.id)?.[1]);
  if(!Number.isSafeInteger(id))throw fail('ID de expediente inválido');
  const data=parseInventoryData(req.body);
  conn=await pool.getConnection();
  await conn.beginTransaction();
  const [[record]]=await conn.execute(`SELECT e.id,e.disponibilidad FROM expedientes e
   JOIN inventarios i ON i.id=e.inventario_id
   WHERE e.id=? AND e.etapa='CONCENTRACION'
     AND e.deleted_at IS NULL AND i.deleted_at IS NULL FOR UPDATE`,[id]);
  if(!record)throw fail('Expediente activo de Concentración no encontrado',404);
  if(record.disponibilidad==='PRESTADO')throw fail('Los datos se pueden editar después de registrar la devolución',409);
  const [[receipt]]=await conn.execute(`SELECT r.estado FROM expedientes e
   JOIN transferencia_expedientes_v ti ON ti.expediente_id=e.id
   JOIN transferencias t ON t.id=ti.transferencia_id AND t.estado='ACEPTADA'
   JOIN recepciones r ON r.transferencia_id=t.id
   WHERE e.id=? ORDER BY r.id DESC LIMIT 1`,[id]);
  if(receipt?.estado!=='RECIBIDA')throw fail('Primero confirma la recepción física',409);
  const values=[data.access,data.tradition,data.m,data.n,data.p].map(value=>value||null);
  await conn.execute(`INSERT INTO expedientes_datos_concentracion
   (expediente_id,acceso,tradicion,topografia_m,topografia_n,topografia_p) VALUES (?,?,?,?,?,?)
   ON DUPLICATE KEY UPDATE acceso=?,tradicion=?,topografia_m=?,topografia_n=?,topografia_p=?`,
   [id,...values,...values]);
  await conn.execute('INSERT INTO auditoria(actor_id,entidad,entidad_id,accion,detalle) VALUES (?,?,?,?,?)',
   [user.id,'expedientes',id,'ACTUALIZAR_DATOS_CONCENTRACION',JSON.stringify(data)]);
  await conn.commit();
  res.json({data});
 }catch(error){if(conn)await conn.rollback();next(error);}
 finally{conn?.release();}
});
