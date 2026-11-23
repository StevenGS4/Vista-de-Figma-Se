import express from 'express';
import { randomUUID } from 'node:crypto';
import { makeTransferDocument } from './transfer-documents.js';
import { readRecords } from './tramite.js';
import { makeOfficialTemplateWorkbook } from './template-workbooks.js';
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
const isoDate=value=>value instanceof Date
 ? new Date(value.getTime()-value.getTimezoneOffset()*60000).toISOString().slice(0,10)
 : value?String(value).slice(0,10):'';
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
 const [rows]=await conn.execute(`SELECT t.*,DATE_FORMAT(t.aceptada_en,'%Y-%m-%d') AS approvalDate,a.codigo AS areaCode FROM transferencias t
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
async function saveDocument(conn,id,user,kind,detail,pdf=null){
 await conn.execute(`INSERT INTO transferencia_documentos
  (transferencia_id,tipo,actor_id,detalle,pdf) VALUES (?,?,?,?,?)`,[id,kind,user.id,detail,pdf]);
}
async function hasDocument(conn,id,kind){
 const [[row]]=await conn.execute('SELECT id FROM transferencia_documentos WHERE transferencia_id=? AND tipo=? LIMIT 1',[id,kind]);
 return Boolean(row);
}
async function readTransfer(conn,t){
 const [documents]=await conn.execute(`SELECT CAST(id AS CHAR) AS id,tipo AS kind,detalle AS detail,
  DATE_FORMAT(creado_en,'%Y-%m-%d') AS date,pdf IS NOT NULL AS hasFile
  FROM transferencia_documentos WHERE transferencia_id=? ORDER BY id`,[t.id]);
 // Nombres verificables desde MySQL. El usuario no administrador no necesita
 // permiso de Administración para conocer al solicitante de una solicitud visible.
 const [actors]=await conn.execute(`SELECT
  CONCAT_WS(' ',us.nombres,us.apellido_paterno,NULLIF(us.apellido_materno,'')) AS requesterName,
  CONCAT_WS(' ',ua.nombres,ua.apellido_paterno,NULLIF(ua.apellido_materno,'')) AS areaApproverName,
  CONCAT_WS(' ',ur.nombres,ur.apellido_paterno,NULLIF(ur.apellido_materno,'')) AS reviewerName,
  CONCAT_WS(' ',um.nombres,um.apellido_paterno,NULLIF(um.apellido_materno,'')) AS assignedAreaManagerName
  FROM transferencias tr
  LEFT JOIN usuarios us ON us.id=tr.solicitante_id
  LEFT JOIN usuarios ua ON ua.id=tr.visto_bueno_por
  LEFT JOIN usuarios ur ON ur.id=tr.aceptada_por
  LEFT JOIN areas ar ON ar.id=tr.area_id
  LEFT JOIN usuarios um ON um.id=ar.encargado_usuario_id
  WHERE tr.id=?`,[t.id]);
 const actorNames=actors[0]||{};
 const [records]=await conn.execute(`SELECT e.id FROM transferencia_inventarios ti
 JOIN expedientes e ON e.inventario_id=ti.inventario_id
 WHERE ti.transferencia_id=? AND e.deleted_at IS NULL ORDER BY ti.inventario_id,e.consecutivo`,[t.id]);
 const [receptions]=await conn.execute(`SELECT r.estado,DATE_FORMAT(r.fecha,'%Y-%m-%d') AS date,
 r.responsable_id,r.observaciones,
 CONCAT_WS(' ',u.nombres,u.apellido_paterno,NULLIF(u.apellido_materno,'')) AS responsibleName
 FROM recepciones r
 LEFT JOIN usuarios u ON u.id=r.responsable_id
 WHERE r.transferencia_id=? ORDER BY r.id DESC LIMIT 1`,[t.id]);
 const rec=receptions[0];
 return {
 id:'TR-'+t.id,folio:t.folio,areaId:t.areaCode,requestedBy:String(t.solicitante_id),
 requesterName:actorNames.requesterName||'',
 areaApproverName:actorNames.areaApproverName||'',
 reviewerName:actorNames.reviewerName||'',
 assignedAreaManagerName:actorNames.assignedAreaManagerName||'',
 createdAt:isoDate(t.creada_en),submittedAt:isoDate(t.enviada_en),
 status:transferStates[t.estado],recordIds:records.map(r=>'REG-'+r.id),
 reviewerId:t.aceptada_por?String(t.aceptada_por):'',
 areaApproverId:t.visto_bueno_por?String(t.visto_bueno_por):'',
 areaApprovedAt:isoDate(t.visto_bueno_en),reviewedAt:isoDate(t.aceptada_en),
 acceptedAt:isoDate(t.aceptada_en),observation:t.observaciones||'',
 receptionStatus:!rec?'Pendiente':rec.estado==='RECIBIDA'?'Recibida':
  rec.estado==='DIFERENCIAS'?'Diferencias pendientes':'Pendiente',
 receptionDate:rec?.date||'',receptionResponsible:rec?String(rec.responsable_id):'',
 receptionResponsibleName:rec?.responsibleName||'',
 documents,receptionNotes:rec?.observaciones||'',history:await history(conn,t.id),
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
async function chooseInventories(conn,ids,user,testMode){
 const placeholders=ids.map(()=>'?').join(',');
 const [items]=await conn.query(`SELECT i.id,i.folio,i.estado,i.area_id,i.creado_por,a.codigo AS areaCode,
 COUNT(e.id) AS total,
 SUM(CASE WHEN e.etapa='TRAMITE' THEN 1 ELSE 0 END) AS inTramite,
 SUM(CASE WHEN e.disponibilidad='PRESTADO' THEN 1 ELSE 0 END) AS borrowed
 FROM inventarios i JOIN areas a ON a.id=i.area_id
 JOIN expedientes e ON e.inventario_id=i.id
 WHERE e.id IN (${placeholders}) AND i.deleted_at IS NULL AND e.deleted_at IS NULL
 GROUP BY i.id,i.folio,i.estado,i.area_id,i.creado_por,a.codigo`,ids);
 if(!items.length)throw problem('No se encontraron inventarios seleccionados');
 // Bloquea cada inventario en orden estable para serializar solicitudes concurrentes.
 const selected=items.sort((a,b)=>a.id-b.id);
 const today=new Date().toLocaleDateString('sv-SE',{timeZone:'America/Mazatlan'});
 for(const i of selected){
  const [locked]=await conn.execute('SELECT id,estado FROM inventarios WHERE id=? AND deleted_at IS NULL FOR UPDATE',[i.id]);
  if(locked[0]?.estado!=='TRAMITE')throw problem('Inventario ya transferido o reservado',409);
  if(i.areaCode!==user.areaId)throw problem('No puedes transferir inventarios de otra área',403);
  if(!user.roles.includes('Encargado de área')&&Number(i.creado_por)!==Number(user.id))
   throw problem('Solo puedes solicitar la transferencia de tus inventarios',403);
  const [all]=await conn.execute(`SELECT COUNT(*) AS countRows,
  SUM(etapa='TRAMITE') AS available, SUM(disponibilidad='PRESTADO') AS borrowed,
  SUM(cierre IS NULL) AS openRecords,
  SUM(DATE_ADD(cierre, INTERVAL anios_tramite YEAR) IS NULL OR DATE_ADD(cierre, INTERVAL anios_tramite YEAR) > ?) AS pendingRetention
  FROM expedientes WHERE inventario_id=? AND deleted_at IS NULL`,[today,i.id]);
  if(Number(all[0].countRows)!==Number(i.total) ||
   Number(all[0].available)!==Number(all[0].countRows) ||Number(all[0].borrowed))
    throw problem('Inventario con expediente en concentración o préstamo activo',409);
  if(!testMode&&Number(all[0].openRecords))
   throw problem('Cierra los expedientes del inventario antes de solicitar su transferencia',409);
  if(!testMode&&Number(all[0].pendingRetention))
   throw problem('Todos los expedientes del inventario deben cumplir su plazo de conservación en Archivo de trámite antes de transferirse',409);
  const [links]=await conn.execute('SELECT 1 FROM transferencia_inventarios WHERE inventario_id=? LIMIT 1',[i.id]);
  if(links.length)throw problem('Inventario vinculado a otra transferencia',409);
 }
 // Todas las filas seleccionadas deben coincidir con la totalidad de cada inventario.
 const [allRows]=await conn.query(`SELECT e.id FROM expedientes e
 WHERE e.inventario_id IN (${selected.map(()=>'?').join(',')}) AND e.deleted_at IS NULL`,selected.map(i=>i.id));
 const desired=new Set(ids);
 if(allRows.length!==desired.size||allRows.some(r=>!desired.has(Number(r.id))))
  throw problem('La solicitud debe incluir todos los expedientes de cada inventario',400);
 return selected;
}
async function transferTestMode(conn,lock=false){
 const [[setting]]=await conn.execute('SELECT modo_pruebas FROM configuracion_transferencias WHERE id=1'+(lock?' FOR SHARE':''));
 return Number(setting?.modo_pruebas)===1;
}
transfersRouter.get('/configuracion',async(req,res,next)=>{
 try{
  ensureAuth(req.auth.user);
  res.set('Cache-Control','private, no-store');
  res.json({testMode:await transferTestMode(pool)});
 }catch(e){next(e);}
});
transfersRouter.put('/configuracion',async(req,res,next)=>{
 let conn;
 try{
  const user=req.auth.user;ensureAuth(user);
  if(!user.roles.includes('Administrador / Coordinador'))throw problem('Solo Administración puede cambiar el modo de pruebas',403);
  const {testMode}=req.body??{};
  if(typeof testMode!=='boolean')throw problem('Modo de pruebas inválido');
  conn=await pool.getConnection();await conn.beginTransaction();
  await conn.execute('UPDATE configuracion_transferencias SET modo_pruebas=? WHERE id=1',[Number(testMode)]);
  await audit(conn,user,1,'CONFIGURAR_MODO_PRUEBAS',{testMode});
  await conn.commit();
  res.json({testMode});
 }catch(e){if(conn)await conn.rollback();next(e);}finally{conn?.release();}
});
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
  const testMode=await transferTestMode(conn,true);
  const inventoryList=await chooseInventories(conn,ids,user,testMode);
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
  await saveDocument(conn,created.insertId,user,'SOLICITUD','Al titular del área generadora: se solicita autorización para trasladar los expedientes de la relación anexa.');
  await addHistory(conn,created.insertId,user,'PREPARAR','Inventarios completos seleccionados: '+inventoryList.length);
  await addHistory(conn,created.insertId,user,'ENVIAR','Solicitud enviada a visto bueno del encargado de área');
  if(testMode)await addHistory(conn,created.insertId,user,'PREPARAR','Solicitud creada en modo de pruebas: se omitió la validación de cierre y plazo AT.');
  await audit(conn,user,created.insertId,'SOLICITAR',{inventarios:inventoryList.map(i=>i.folio),testMode});
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
  const correction=text(req.body?.correction,1900);
  if(correction.length<5)throw problem('Describe la corrección antes de reenviar');
  const approved=Boolean(t.visto_bueno_por);
  await conn.execute('UPDATE transferencias SET estado=?,observaciones=NULL,enviada_en=NOW() WHERE id=?',
   [approved?'PENDIENTE_ADMIN':'PENDIENTE_VB',id]);
  await saveDocument(conn,id,user,approved?'CORRECCION_FORMATO':'SOLICITUD','Versión corregida: '+correction);
  await addHistory(conn,id,user,'REENVIAR',approved?'Formato corregido y reenviado a Concentración':'Solicitud reenviada para visto bueno');
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
  const [[requestDocs]]=await conn.execute(`SELECT MAX(CASE WHEN tipo='SOLICITUD' THEN id END) AS requestId,
   MAX(CASE WHEN tipo='ACUSE_SOLICITUD' THEN id END) AS receiptId FROM transferencia_documentos WHERE transferencia_id=?`,[id]);
  if(requestDocs.requestId && BigInt(requestDocs.receiptId??0)<BigInt(requestDocs.requestId))
   throw problem('Adjunta el acuse correspondiente a la última Atenta Nota de solicitud',409);
  await conn.execute(`UPDATE transferencias SET estado='PENDIENTE_ADMIN',visto_bueno_por=?,
  visto_bueno_en=NOW(),observaciones=NULL WHERE id=?`,[user.id,id]);
  await saveDocument(conn,id,user,'AUTORIZACION','El encargado del área autoriza el traslado de los expedientes de la relación anexa.');
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
  await saveDocument(conn,id,user,canReviewAdmin(user,t)?'DICTAMEN_DESFAVORABLE':'OBSERVACION_AREA',note);
  await addHistory(conn,id,user,'OBSERVAR',note);
  await audit(conn,user,id,'OBSERVAR',{});
  await conn.commit();res.json({transfer:await readTransfer(pool,await rawTransfer(pool,id))});
 }catch(e){if(conn)await conn.rollback();next(e);}finally{conn?.release();}
});
transfersRouter.post('/:id/accept',async(req,res,next)=>{
 let conn;
 try{
  const user=req.auth.user;ensureAuth(user);
  const id=Number(String(req.params.id).replace(/^TR-/,''));
  const detail=text(req.body?.detail,2000);
  if(!Number.isSafeInteger(id)||id<1||detail.length<5)throw problem('Captura el fundamento del dictamen favorable');
  conn=await pool.getConnection();await conn.beginTransaction();
  const t=await rawTransfer(conn,id,true);
  if(!t)throw problem('Transferencia no encontrada',404);
  if(!canReviewAdmin(user,t))throw problem('La solicitud requiere autorización del área y revisión de Concentración',403);
  await conn.execute("UPDATE transferencias SET estado='ACEPTADA',aceptada_por=?,aceptada_en=NOW() WHERE id=?",[user.id,id]);
  await saveDocument(conn,id,user,'DICTAMEN_FAVORABLE',detail);
  await addHistory(conn,id,user,'ACEPTAR','Dictamen favorable. Pendiente de traslado y recepción física.');
  await audit(conn,user,id,'DICTAMEN_FAVORABLE',{});
  await conn.commit();
  res.json({transfer:await readTransfer(pool,await rawTransfer(pool,id))});
 }catch(e){if(conn)await conn.rollback();next(e);}finally{conn?.release();}
});

transfersRouter.get('/:id/relacion.xlsx',async(req,res,next)=>{
 try{
  const t=await getVisible(req.auth.user,req.params.id);
  const records=await readRecords(pool,`WHERE EXISTS (SELECT 1 FROM transferencia_inventarios ti
    WHERE ti.inventario_id=i.id AND ti.transferencia_id=?)`,[t.id]);
  const book=await makeOfficialTemplateWorkbook(records,'transferencia');
  res.attachment(t.folio+'-transferencia-primaria'+(req.query.copia==='1'?'-copia':'')+'.xlsx');
  res.set('Cache-Control','private, no-store');
  await book.xlsx.write(res);res.end();
 }catch(e){next(e);}
});

transfersRouter.get('/:id/documentos/:documentId',async(req,res,next)=>{
 try{
  const t=await getVisible(req.auth.user,req.params.id);
  if(!/^[1-9][0-9]*$/.test(req.params.documentId))throw problem('Documento inválido');
  const [[doc]]=await pool.execute(`SELECT d.tipo,d.detalle,d.pdf,DATE_FORMAT(d.creado_en,'%Y-%m-%d') AS date,
   CONCAT_WS(' ',u.nombres,u.apellido_paterno,u.apellido_materno) AS actor,
   (SELECT COUNT(*) FROM transferencia_inventarios ti JOIN expedientes e ON e.inventario_id=ti.inventario_id
    WHERE ti.transferencia_id=d.transferencia_id AND e.deleted_at IS NULL) AS recordCount
   FROM transferencia_documentos d LEFT JOIN usuarios u ON u.id=d.actor_id
   WHERE d.transferencia_id=? AND d.id=?`,[t.id,req.params.documentId]);
  if(!doc)throw problem('Documento no encontrado',404);
  res.set('Cache-Control','private, no-store');
  if(doc.pdf)return res.attachment(t.folio+'-'+doc.tipo+'.pdf').type('pdf').send(doc.pdf);
  const copy=req.query.copia==='1';
  const word=await makeTransferDocument({folio:t.folio,area:t.areaCode,kind:doc.tipo,
   detail:doc.detalle,date:doc.date,actor:doc.actor,copy,recordCount:doc.recordCount});
  res.attachment(t.folio+'-'+doc.tipo+(copy?'-copia':'')+'.docx').send(word);
 }catch(e){next(e);}
});

transfersRouter.post('/:id/documentos',async(req,res,next)=>{
 let conn;
 try{
  const user=req.auth.user;
  const visible=await getVisible(user,req.params.id);
  const kind=req.body?.kind,detail=text(req.body?.detail,2000);
  if(detail.length<5)throw problem('Captura el folio o los datos del documento');
  const encoded=req.body?.pdf;
  let pdf=null;
  if(encoded){
   if(typeof encoded!=='string'||encoded.length>5600000||!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))throw problem('El PDF debe pesar hasta 4 MB');
   pdf=Buffer.from(encoded,'base64');
   if(pdf.length>4194304||pdf.subarray(0,5).toString()!=='%PDF-')throw problem('Adjunta un PDF válido de hasta 4 MB');
  }
  conn=await pool.getConnection();await conn.beginTransaction();
  const t=await rawTransfer(conn,visible.id,true);
  if(!t||!canViewTransfer(user,t))throw problem('Transferencia fuera de tu alcance',403);
  const sender=Number(t.solicitante_id)===Number(user.id)||user.roles.includes('Encargado de área')&&user.areaId===t.areaCode;
  const allowed=(sender&&t.estado==='PENDIENTE_VB'&&['ACUSE_SOLICITUD','SOLICITUD_AMPLIACION'].includes(kind))
   ||(t.estado==='ACEPTADA'&&((sender&&['NOTA_TRASLADO','ACUSE_TRASLADO','ENTREGA'].includes(kind))
   ||(canReceiveTransfer(user,t)&&kind==='FORMATO_FIRMADO')));
  if(!allowed)throw problem('El documento no corresponde a tu etapa o función',403);
  if(t.estado==='ACEPTADA'){
   const [[received]]=await conn.execute("SELECT id FROM recepciones WHERE transferencia_id=? AND estado='RECIBIDA' LIMIT 1",[t.id]);
   if(received)throw problem('La entrega ya fue recibida y su documentación quedó cerrada',409);
  }
  if(['ACUSE_SOLICITUD','ACUSE_TRASLADO','FORMATO_FIRMADO'].includes(kind)&&!pdf)throw problem('Adjunta la evidencia en PDF');
  if(kind==='ACUSE_TRASLADO'&&!await hasDocument(conn,t.id,'NOTA_TRASLADO'))throw problem('Registra primero la Atenta Nota de traslado');
  if(kind==='ENTREGA'&&!await hasDocument(conn,t.id,'ACUSE_TRASLADO'))throw problem('Registra primero el acuse de traslado');
  if(kind==='FORMATO_FIRMADO'&&await hasDocument(conn,t.id,'DICTAMEN_FAVORABLE')&&!await hasDocument(conn,t.id,'ENTREGA'))
   throw problem('Registra primero la entrega con el representante del área',409);
  await saveDocument(conn,t.id,user,kind,detail,pdf);
  await conn.commit();
  res.json({transfer:await readTransfer(pool,await rawTransfer(pool,t.id))});
 }catch(e){if(conn)await conn.rollback();next(e);}finally{conn?.release();}
});
// Cajas originales: el número capturado en Trámite prevalece en Recepción.
transfersRouter.get('/:id/reception-boxes',async(req,res,next)=>{
 try{
  const user=req.auth.user;ensureAuth(user);
  const id=Number(String(req.params.id).replace(/^TR-/,''));
  if(!Number.isSafeInteger(id)||id<1)throw problem('Identificador inválido');
  const t=await rawTransfer(pool,id);
  if(!t)throw problem('Transferencia no encontrada',404);
  if(!canReceiveTransfer(user,t))throw problem('Solo el administrador puede consultar la recepción',403);
  const [rows]=await pool.execute(`SELECT DISTINCT e.id,
    CAST(e.numero_caja AS CHAR) AS boxNumber
    FROM expedientes e
    JOIN transferencia_inventarios ti ON ti.inventario_id=e.inventario_id
    WHERE ti.transferencia_id=? AND e.etapa IN ('TRAMITE','CONCENTRACION') AND e.deleted_at IS NULL
    ORDER BY e.id`,[id]);
  if(!rows.length)throw problem('La transferencia no contiene expedientes disponibles',409);
  res.set('Cache-Control','private, no-store');
  res.json({boxes:rows.map(r=>({recordId:'REG-'+r.id,boxNumber:String(r.boxNumber||'').trim()}))});
 }catch(e){next(e);}
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
  if(date<(t.approvalDate || isoDate(t.aceptada_en)))throw problem('La recepción no puede ser anterior a la aceptación');
  const [latest]=await conn.execute('SELECT estado FROM recepciones WHERE transferencia_id=? ORDER BY id DESC LIMIT 1',[id]);
  if(latest[0]?.estado==='RECIBIDA')throw problem('La recepción física ya está registrada',409);
  let receivedCount=0;
  if(state==='Recibida'){
   const managed=await hasDocument(conn,id,'DICTAMEN_FAVORABLE');
   if(managed&&!await hasDocument(conn,id,'ENTREGA'))
    throw problem('Falta el registro de entrega con representante del área. Lo registra el solicitante o el encargado del área.',409);
   if(managed&&!await hasDocument(conn,id,'FORMATO_FIRMADO'))
    throw problem('Falta adjuntar el PDF del formato con firmas autógrafas en Documentos de la transferencia.',409);
   const [linked]=await conn.execute(`SELECT e.id FROM expedientes e
     JOIN transferencia_inventarios ti ON ti.inventario_id=e.inventario_id
     WHERE ti.transferencia_id=? AND e.etapa IN ('TRAMITE','CONCENTRACION') AND e.deleted_at IS NULL
     ORDER BY e.id FOR UPDATE`,[id]);
   if(!linked.length)throw problem('No hay expedientes para recibir',409);
   if(managed){
    const [moved]=await conn.execute(`UPDATE expedientes e JOIN transferencia_inventarios ti ON ti.inventario_id=e.inventario_id
     SET e.etapa='CONCENTRACION'
     WHERE ti.transferencia_id=? AND e.etapa='TRAMITE' AND e.deleted_at IS NULL AND e.disponibilidad<>'PRESTADO'`,[id]);
    if(moved.affectedRows!==linked.length)throw problem('Los expedientes ya no están disponibles para la entrega',409);
    await conn.execute(`UPDATE inventarios i JOIN transferencia_inventarios ti ON ti.inventario_id=i.id
     SET i.estado='CONCENTRACION' WHERE ti.transferencia_id=? AND i.estado='EN_TRANSFERENCIA'`,[id]);
   }
   let location;
   try{location=validateSharedReceptionLocation(req.body?.location,linked.map(row=>row.id));}
   catch(error){throw problem(error.message);}
   // Una ubicación capturada por el ADMIN; se aplica a todos los expedientes.
   // Cualquier error revierte la ubicación y la recepción completas.
   const [updated]=await conn.execute(`UPDATE expedientes e
     JOIN transferencia_inventarios ti ON ti.inventario_id=e.inventario_id
     SET e.archivo_zona=?,e.lugar_resguardo=?,e.estante=?,e.nivel=?,
       e.seccion_fisica=?,e.posicion=?,
       e.caja_ubicacion=COALESCE(NULLIF(TRIM(e.numero_caja),''),?),
       e.notas_ubicacion=?
     WHERE ti.transferencia_id=? AND e.etapa='CONCENTRACION'`,
     [location.archiveZone,location.room,location.shelf,location.level,
      location.physicalSection,location.position,location.locationBox,location.locationNotes,id]);
   receivedCount=linked.length;
   // affectedRows puede ser menor que el conteo cuando una ubicación idéntica ya estaba guardada.
   const [verified]=await conn.execute(`SELECT e.id FROM expedientes e
     JOIN transferencia_inventarios ti ON ti.inventario_id=e.inventario_id
     WHERE ti.transferencia_id=? AND e.etapa='CONCENTRACION'
       AND e.archivo_zona=? AND e.lugar_resguardo=? AND e.estante=? AND e.nivel=? AND e.seccion_fisica=?
       AND (e.posicion <=> ?)
       AND (e.caja_ubicacion <=> COALESCE(NULLIF(TRIM(e.numero_caja),''),?))
       AND (e.notas_ubicacion <=> ?)`,
     [id,location.archiveZone,location.room,location.shelf,location.level,location.physicalSection,
      location.position,location.locationBox,location.locationNotes]);
   if(verified.length!==receivedCount)throw problem('No se pudo asignar la ubicación a todos los expedientes',409);
  }
  await conn.execute('INSERT INTO recepciones(transferencia_id,fecha,responsable_id,estado,observaciones) VALUES (?,?,?,?,?)',
   [id,date+' 12:00:00',user.id,state==='Recibida'?'RECIBIDA':'DIFERENCIAS',note||null]);
  await saveDocument(conn,id,user,state==='Recibida'?'RECEPCION':'DIFERENCIAS',
   state==='Recibida'
    ? ['Fecha de recepción: '+date,'Expedientes cotejados: '+receivedCount,
       'Ubicación: '+[req.body.location.archiveZone,req.body.location.room,
        'Estante '+req.body.location.shelf,'Nivel '+req.body.location.level,'Sección '+req.body.location.physicalSection].join(' · '),
       'Evidencia: consultar formato firmado adjunto al folio cuando corresponda.',note].filter(Boolean).join('\n').slice(0,2000)
    : 'Fecha de cotejo: '+date+'\n'+note.slice(0,1900));
  await addHistory(conn,id,user,state==='Recibida'?'RECEPCION':'DIFERENCIA',note||(state==='Recibida'?'Recepción física cotejada y ubicaciones asignadas por el administrador':'Diferencias pendientes'));
  await audit(conn,user,id,'RECEPCION',{estado:state,expedientesUbicados:receivedCount,ubicacionesCapturadas:state==='Recibida'?1:0});
  await conn.commit();res.json({transfer:await readTransfer(pool,await rawTransfer(pool,id))});
 }catch(e){if(conn)await conn.rollback();next(e);}finally{conn?.release();}
});
