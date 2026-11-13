import express from 'express';
import { randomUUID } from 'node:crypto';
import { pool } from './config/database.js';
import { requireAuth } from './auth.js';
import { validateSharedReceptionLocation } from './reception-locations.js';
import {
 transferStates,canSubmitTransfer,canApproveArea,canReviewAdmin,
 canReceiveTransfer,canViewTransfer,uniqueInventoryFolios
} from './transfer-policy.js';

export const transfersRouter = express.Router();
transfersRouter.use(requireAuth);
const problem=(message,status=400)=>Object.assign(new Error(message),{status});
const isoDate=value=>value?String(value).slice(0,10):'';
const text=(value,max=1500)=>String(value??'').trim().slice(0,max);
const onlyIds=recordIds=>{
 if(!Array.isArray(recordIds)||!recordIds.length||recordIds.length>50000)
  throw problem('Selecciona los expedientes de los inventarios completos');
 const ids=recordIds.map(v=>/^REG-[1-9]\d*$/.test(v)?Number(v.slice(4)):NaN);
 if(ids.some(n=>!Number.isSafeInteger(n))||new Set(ids).size!==ids.length)
  throw problem('Identificadores de expedientes inválidos o duplicados');
 return ids;
};
async function rawTransfer(conn,id,lock=false){
 const [rows]=await conn.execute(`SELECT t.*,a.codigo AS areaCode FROM transferencias t
 JOIN areas a ON a.id=t.area_id WHERE t.id=?${lock?' FOR UPDATE':''}`,[id]);
 return rows[0]||null;
}
async function history(conn,id){
 const [rows]=await conn.execute(`SELECT id,usuario_id,accion,detalle,DATE_FORMAT(fecha,'%Y-%m-%d') AS date
 FROM transferencia_historial WHERE transferencia_id=? ORDER BY id`,[id]);
 const types={PREPARAR:'Preparación',ENVIAR:'Envío',VISTO_BUENO:'Visto bueno de área',
 OBSERVAR:'Observaciones',REENVIAR:'Reenvío',ACEPTAR:'Aceptación',
 RECEPCION:'Recepción física',DIFERENCIA:'Recepción física'};
 return rows.map(r=>({id:'H-'+r.id,type:types[r.accion]||'Revisión',
 date:r.date,actor:String(r.usuario_id),detail:r.detalle||''}));
}
async function readTransfer(conn,t){
 const [records]=await conn.execute(`SELECT e.id FROM transferencia_inventarios ti
 JOIN expedientes e ON e.inventario_id=ti.inventario_id
 WHERE ti.transferencia_id=? ORDER BY ti.inventario_id,e.consecutivo`,[t.id]);
 const [receptions]=await conn.execute(`SELECT estado,DATE_FORMAT(fecha,'%Y-%m-%d') AS date,
 responsable_id,observaciones FROM recepciones WHERE transferencia_id=? ORDER BY id DESC LIMIT 1`,[t.id]);
 const rec=receptions[0];
 return {
 id:'TR-'+t.id,folio:t.folio,areaId:t.areaCode,requestedBy:String(t.solicitante_id),
 createdAt:isoDate(t.creada_en),submittedAt:isoDate(t.enviada_en),
 status:transferStates[t.estado],recordIds:records.map(r=>'REG-'+r.id),
 reviewerId:t.aceptada_por?String(t.aceptada_por):'',
 areaApproverId:t.visto_bueno_por?String(t.visto_bueno_por):'',
 areaApprovedAt:isoDate(t.visto_bueno_en),reviewedAt:isoDate(t.aceptada_en),
 acceptedAt:isoDate(t.aceptada_en),observation:t.observaciones||'',
 receptionStatus:!rec?'Pendiente':rec.estado==='RECIBIDA'?'Recibida':
  rec.estado==='DIFERENCIAS'?'Diferencias pendientes':'Pendiente',
 receptionDate:rec?.date||'',receptionResponsible:rec?String(rec.responsable_id):'',
 receptionNotes:rec?.observaciones||'',history:await history(conn,t.id),
 };
}
async function visibleTransfers(user){
 let rows;
 if(user.roles.includes('Administrador / Coordinador')){
  [rows]=await pool.execute(`SELECT t.*,a.codigo AS areaCode FROM transferencias t
   JOIN areas a ON a.id=t.area_id ORDER BY t.id DESC LIMIT 2000`);
 }else if(user.roles.includes('Encargado de área')){
  [rows]=await pool.execute(`SELECT t.*,a.codigo AS areaCode FROM transferencias t
   JOIN areas a ON a.id=t.area_id WHERE a.codigo=? ORDER BY t.id DESC LIMIT 2000`,[user.areaId]);
 }else if(canSubmitTransfer(user)){
  [rows]=await pool.execute(`SELECT t.*,a.codigo AS areaCode FROM transferencias t
   JOIN areas a ON a.id=t.area_id WHERE a.codigo=? AND t.solicitante_id=?
   ORDER BY t.id DESC LIMIT 2000`,[user.areaId,user.id]);
 }else throw problem('No tienes permiso para ver transferencias',403);
 const out=[];
 for(const t of rows)out.push(await readTransfer(pool,t));
 return out;
}
async function getVisible(user,id){
 if(!/^TR-[1-9]\d*$/.test(id))throw problem('Identificador inválido');
 const t=await rawTransfer(pool,Number(id.slice(3)));
 if(!t)throw problem('Transferencia no encontrada',404);
 if(!canViewTransfer(user,t))throw problem('Transferencia fuera de tu alcance',403);
 return t;
}
async function addHistory(conn,transferId,user,action,detail){
 await conn.execute('INSERT INTO transferencia_historial(transferencia_id,usuario_id,accion,detalle) VALUES (?,?,?,?)',
 [transferId,user.id,action,detail]);
}
async function audit(conn,user,id,action,detail){
 await conn.execute('INSERT INTO auditoria(actor_id,entidad,entidad_id,accion,detalle) VALUES (?,?,?,?,?)',
 [user.id,'transferencias',id,action,JSON.stringify(detail)]);
}
function ensureAuth(user){
 if(user.mustChangePassword)throw problem('Debes cambiar tu contraseña',403);
}
async function chooseInventories(conn,ids,user){
 const placeholders=ids.map(()=>'?').join(',');
 const [items]=await conn.query(`SELECT i.id,i.folio,i.estado,i.area_id,i.creado_por,a.codigo AS areaCode,
 COUNT(e.id) AS total,
 SUM(CASE WHEN e.etapa='TRAMITE' THEN 1 ELSE 0 END) AS inTramite,
 SUM(CASE WHEN e.disponibilidad='PRESTADO' THEN 1 ELSE 0 END) AS borrowed
 FROM inventarios i JOIN areas a ON a.id=i.area_id
 JOIN expedientes e ON e.inventario_id=i.id
 WHERE e.id IN (${placeholders})
 GROUP BY i.id,i.folio,i.estado,i.area_id,i.creado_por,a.codigo`,ids);
 if(!items.length)throw problem('No se encontraron inventarios seleccionados');
 // Bloquea cada inventario en orden estable para serializar solicitudes concurrentes.
 const selected=items.sort((a,b)=>a.id-b.id);
 for(const i of selected){
  const [locked]=await conn.execute('SELECT id,estado FROM inventarios WHERE id=? FOR UPDATE',[i.id]);
  if(locked[0]?.estado!=='TRAMITE')throw problem('Inventario ya transferido o reservado',409);
  if(i.areaCode!==user.areaId)throw problem('No puedes transferir inventarios de otra área',403);
  if(!user.roles.includes('Encargado de área')&&Number(i.creado_por)!==Number(user.id))
   throw problem('Solo puedes solicitar la transferencia de tus inventarios',403);
  const [all]=await conn.execute(`SELECT COUNT(*) AS countRows,
  SUM(etapa='TRAMITE') AS available, SUM(disponibilidad='PRESTADO') AS borrowed
  FROM expedientes WHERE inventario_id=?`,[i.id]);
  if(Number(all[0].countRows)!==Number(i.total) ||
   Number(all[0].available)!==Number(all[0].countRows) ||Number(all[0].borrowed))
    throw problem('Inventario con expediente en concentración o préstamo activo',409);
  const [links]=await conn.execute('SELECT 1 FROM transferencia_inventarios WHERE inventario_id=? LIMIT 1',[i.id]);
  if(links.length)throw problem('Inventario vinculado a otra transferencia',409);
 }
 // Todas las filas seleccionadas deben coincidir con la totalidad de cada inventario.
 const [allRows]=await conn.query(`SELECT e.id FROM expedientes e
 WHERE e.inventario_id IN (${selected.map(()=>'?').join(',')})`,selected.map(i=>i.id));
 const desired=new Set(ids);
 if(allRows.length!==desired.size||allRows.some(r=>!desired.has(Number(r.id))))
  throw problem('La solicitud debe incluir todos los expedientes de cada inventario',400);
 return selected;
}
transfersRouter.get('/',async(req,res,next)=>{
 try{ensureAuth(req.auth.user);res.json({transfers:await visibleTransfers(req.auth.user)});}
 catch(e){next(e);}
});
transfersRouter.post('/',async(req,res,next)=>{
 let conn;
 try{
  const user=req.auth.user;ensureAuth(user);
  if(!canSubmitTransfer(user))throw problem('El rol actual no puede solicitar transferencias',403);
  const ids=onlyIds(req.body?.recordIds);
  conn=await pool.getConnection();await conn.beginTransaction();
  const inventoryList=await chooseInventories(conn,ids,user);
  const [area]=await conn.execute('SELECT id FROM areas WHERE codigo=?',[user.areaId]);
  if(!area.length)throw problem('Área no encontrada');
  const folio='TP-'+new Date().getFullYear()+'-'+randomUUID().slice(0,14).toUpperCase();
  const [created]=await conn.execute(`INSERT INTO transferencias
  (folio,area_id,solicitante_id,estado,enviada_en) VALUES (?,?,?,'PENDIENTE_VB',NOW())`,
  [folio,area[0].id,user.id]);
  for(const i of inventoryList){
   await conn.execute('INSERT INTO transferencia_inventarios(transferencia_id,inventario_id) VALUES (?,?)',
   [created.insertId,i.id]);
   await conn.execute("UPDATE inventarios SET estado='EN_TRANSFERENCIA' WHERE id=?",[i.id]);
  }
  await addHistory(conn,created.insertId,user,'PREPARAR','Inventarios completos seleccionados: '+inventoryList.length);
  await addHistory(conn,created.insertId,user,'ENVIAR','Solicitud enviada a visto bueno del encargado de área');
  await audit(conn,user,created.insertId,'SOLICITAR',{inventarios:inventoryList.map(i=>i.folio)});
  await conn.commit();
  const t=await rawTransfer(pool,created.insertId);
  res.status(201).json({transfer:await readTransfer(pool,t)});
 }catch(e){if(conn)await conn.rollback();
  if(e.code==='ER_DUP_ENTRY')return res.status(409).json({error:'Inventario ya vinculado a una transferencia'});
  next(e);
 }finally{conn?.release();}
});
transfersRouter.post('/:id/resend',async(req,res,next)=>{
 let conn;
 try{
  const user=req.auth.user;ensureAuth(user);
  if(!canSubmitTransfer(user))throw problem('No puedes reenviar transferencias',403);
  conn=await pool.getConnection();await conn.beginTransaction();
  const id=Number(String(req.params.id).replace(/^TR-/,''));
  if(!Number.isSafeInteger(id))throw problem('ID incorrecto');
  const t=await rawTransfer(conn,id,true);
  if(!t)throw problem('Transferencia no encontrada',404);
  if(t.estado!=='OBSERVACIONES'||t.areaCode!==user.areaId||Number(t.solicitante_id)!==Number(user.id))
   throw problem('Solo el solicitante puede reenviar una transferencia observada',403);
  const requested=new Set(onlyIds(req.body?.recordIds));
  const [joined]=await conn.execute(`SELECT e.id FROM transferencia_inventarios ti
   JOIN expedientes e ON e.inventario_id=ti.inventario_id WHERE ti.transferencia_id=?`,[id]);
  if(joined.length!==requested.size||joined.some(row=>!requested.has(Number(row.id))))
   throw problem('No puedes cambiar los inventarios vinculados; conserva la selección completa',409);
  await conn.execute(`UPDATE transferencias SET estado='PENDIENTE_VB',observaciones=NULL,
   visto_bueno_por=NULL,visto_bueno_en=NULL,enviada_en=NOW() WHERE id=?`,[id]);
  await addHistory(conn,id,user,'REENVIAR','Solicitud reenviada para visto bueno');
  await audit(conn,user,id,'REENVIAR',{});
  await conn.commit();res.json({transfer:await readTransfer(pool,await rawTransfer(pool,id))});
 }catch(e){if(conn)await conn.rollback();next(e);}finally{conn?.release();}
});
transfersRouter.post('/:id/approve-area',async(req,res,next)=>{
 let conn;
 try{
  const user=req.auth.user;ensureAuth(user);
  const id=Number(String(req.params.id).replace(/^TR-/,''));
  if(!Number.isSafeInteger(id))throw problem('Identificador inválido');
  conn=await pool.getConnection();await conn.beginTransaction();
  const t=await rawTransfer(conn,id,true);
  if(!t)throw problem('Transferencia no encontrada',404);
  if(!canApproveArea(user,t))throw problem('Visto bueno no autorizado o estado incorrecto',403);
  await conn.execute(`UPDATE transferencias SET estado='PENDIENTE_ADMIN',visto_bueno_por=?,
  visto_bueno_en=NOW(),observaciones=NULL WHERE id=?`,[user.id,id]);
  await addHistory(conn,id,user,'VISTO_BUENO','Encargado del área otorga visto bueno sin modificar etapa');
  await audit(conn,user,id,'VISTO_BUENO',{});
  await conn.commit();res.json({transfer:await readTransfer(pool,await rawTransfer(pool,id))});
 }catch(e){if(conn)await conn.rollback();next(e);}finally{conn?.release();}
});
transfersRouter.post('/:id/observe',async(req,res,next)=>{
 let conn;
 try{
  const user=req.auth.user;ensureAuth(user);
  const note=text(req.body?.observation,2000);
  if(note.length<5)throw problem('La observación requiere al menos 5 caracteres');
  const id=Number(String(req.params.id).replace(/^TR-/,''));
  if(!Number.isSafeInteger(id))throw problem('Identificador inválido');
  conn=await pool.getConnection();await conn.beginTransaction();
  const t=await rawTransfer(conn,id,true);
  if(!t)throw problem('Transferencia no encontrada',404);
  if(!canApproveArea(user,t)&&!canReviewAdmin(user,t))
   throw problem('No tienes autorización para devolver esta solicitud',403);
  await conn.execute("UPDATE transferencias SET estado='OBSERVACIONES',observaciones=? WHERE id=?",[note,id]);
  await addHistory(conn,id,user,'OBSERVAR',note);
  await audit(conn,user,id,'OBSERVAR',{});
  await conn.commit();res.json({transfer:await readTransfer(pool,await rawTransfer(pool,id))});
 }catch(e){if(conn)await conn.rollback();next(e);}finally{conn?.release();}
});
transfersRouter.post('/:id/accept',async(req,res,next)=>{
 try{
  const user=req.auth.user;ensureAuth(user);
  const id=Number(String(req.params.id).replace(/^TR-/,''));
  if(!Number.isSafeInteger(id))throw problem('Identificador inválido');
  const t=await rawTransfer(pool,id);
  if(!t)throw problem('Transferencia no encontrada',404);
  if(!canReviewAdmin(user,t))throw problem('La solicitud requiere visto bueno previo y administrador distinto del emisor',403);
  // Procedimiento institucional existente hace BEGIN/COMMIT y garantiza
  // que todos los expedientes del inventario cambien juntos o ninguno.
  await pool.query('CALL sp_aceptar_transferencia(?,?)',[id,user.id]);
  await pool.execute('INSERT INTO auditoria(actor_id,entidad,entidad_id,accion,detalle) VALUES (?,?,?,?,?)',
   [user.id,'transferencias',id,'ACEPTAR',JSON.stringify({procedimiento:'sp_aceptar_transferencia'})]);
  res.json({transfer:await readTransfer(pool,await rawTransfer(pool,id))});
 }catch(e){
  if(e.sqlState==='45000'||e.code==='ER_SIGNAL_EXCEPTION')return res.status(409).json({error:'No se pudo aceptar: '+e.message});
  next(e);
 }
});
transfersRouter.post('/:id/reception',async(req,res,next)=>{
 let conn;
 try{
  const user=req.auth.user;ensureAuth(user);
  const id=Number(String(req.params.id).replace(/^TR-/,''));
  if(!Number.isSafeInteger(id))throw problem('Identificador inválido');
  const state=req.body?.status;
  if(state!=='Recibida'&&state!=='Diferencias pendientes')throw problem('Estado de recepción inválido');
  const note=text(req.body?.notes,2000);
  if(state==='Diferencias pendientes'&&note.length<5)throw problem('Describe las diferencias encontradas');
  const date=req.body?.date;
  if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z')))
   throw problem('Fecha de recepción inválida');
  conn=await pool.getConnection();await conn.beginTransaction();
  const t=await rawTransfer(conn,id,true);
  if(!t)throw problem('Transferencia no encontrada',404);
  if(!canReceiveTransfer(user,t))throw problem('Solo el administrador puede recibir una transferencia aceptada',403);
  if(date<isoDate(t.aceptada_en))throw problem('La recepción no puede ser anterior a la aceptación');
  const [latest]=await conn.execute('SELECT estado FROM recepciones WHERE transferencia_id=? ORDER BY id DESC LIMIT 1',[id]);
  if(latest[0]?.estado==='RECIBIDA')throw problem('La recepción física ya está registrada',409);
  let receivedCount=0;
  if(state==='Recibida'){
   const [linked]=await conn.execute(`SELECT e.id FROM expedientes e
     JOIN transferencia_inventarios ti ON ti.inventario_id=e.inventario_id
     WHERE ti.transferencia_id=? ORDER BY e.id FOR UPDATE`,[id]);
   let location;
   try{location=validateSharedReceptionLocation(req.body?.location,linked.map(row=>row.id));}
   catch(error){throw problem(error.message);}
   // Una ubicación capturada por el ADMIN; se aplica a todos los expedientes.
   // Cualquier error revierte la ubicación y la recepción completas.
   const [updated]=await conn.execute(`UPDATE expedientes e
     JOIN transferencia_inventarios ti ON ti.inventario_id=e.inventario_id
     SET e.archivo_zona=?,e.lugar_resguardo=?,e.estante=?,e.nivel=?,
       e.seccion_fisica=?,e.posicion=?,e.caja_ubicacion=?,e.notas_ubicacion=?
     WHERE ti.transferencia_id=? AND e.etapa='CONCENTRACION'`,
     [location.archiveZone,location.room,location.shelf,location.level,
      location.physicalSection,location.position,location.locationBox,location.locationNotes,id]);
   receivedCount=linked.length;
   // affectedRows puede ser menor que el conteo cuando una ubicación idéntica ya estaba guardada.
   const [verified]=await conn.execute(`SELECT e.id FROM expedientes e
     JOIN transferencia_inventarios ti ON ti.inventario_id=e.inventario_id
     WHERE ti.transferencia_id=? AND e.etapa='CONCENTRACION'
       AND e.archivo_zona=? AND e.lugar_resguardo=? AND e.estante=? AND e.nivel=? AND e.seccion_fisica=?
       AND (e.posicion <=> ?) AND (e.caja_ubicacion <=> ?) AND (e.notas_ubicacion <=> ?)`,
     [id,location.archiveZone,location.room,location.shelf,location.level,location.physicalSection,
      location.position,location.locationBox,location.locationNotes]);
   if(verified.length!==receivedCount)throw problem('No se pudo asignar la ubicación a todos los expedientes',409);
  }
  await conn.execute('INSERT INTO recepciones(transferencia_id,fecha,responsable_id,estado,observaciones) VALUES (?,?,?,?,?)',
   [id,date+' 12:00:00',user.id,state==='Recibida'?'RECIBIDA':'DIFERENCIAS',note||null]);
  await addHistory(conn,id,user,state==='Recibida'?'RECEPCION':'DIFERENCIA',note||(state==='Recibida'?'Recepción física cotejada y ubicaciones asignadas por el administrador':'Diferencias pendientes'));
  await audit(conn,user,id,'RECEPCION',{estado:state,expedientesUbicados:receivedCount,ubicacionesCapturadas:state==='Recibida'?1:0});
  await conn.commit();res.json({transfer:await readTransfer(pool,await rawTransfer(pool,id))});
 }catch(e){if(conn)await conn.rollback();next(e);}finally{conn?.release();}
});
