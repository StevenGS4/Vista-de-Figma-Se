import express from 'express';
import { randomUUID } from 'node:crypto';
import { pool } from './config/database.js';
import { requireAuth } from './auth.js';
import { canManageLoans, parseLoanSelection, parseReturnItems, validDate } from './loan-policy.js';

export const loansRouter=express.Router();
loansRouter.use(requireAuth);
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const name=(v,max=200)=>typeof v==='string'?v.trim().slice(0,max):'';
const mysqlToday=async()=>{
 const [[row]]=await pool.query("SELECT DATE_FORMAT(CURDATE(),'%Y-%m-%d') AS today");
 return row.today;
};
const shortDate=value=>value?String(value).slice(0,10):'';
const userNumber=value=>/^\d+$/.test(String(value??'')) && Number.isSafeInteger(Number(value)) && Number(value)>0
 ? Number(value) : null;
const personName=row=>[row.nombres,row.apellido_paterno,row.apellido_materno].filter(Boolean).join(' ');
const findActiveUser=async(id,areaCode)=>{
 const [rows]=await pool.execute(`SELECT u.id,u.nombres,u.apellido_paterno,u.apellido_materno,
   a.codigo AS areaCode FROM usuarios u JOIN areas a ON a.id=u.area_id
   WHERE u.id=? AND u.estado='ACTIVO' AND a.activo=1 LIMIT 1`,[id]);
 return rows[0] && (!areaCode || rows[0].areaCode===areaCode) ? rows[0] : null;
};
const isLoanStaff=async(id)=>{
 const [rows]=await pool.execute(`SELECT 1 AS valid FROM usuarios u JOIN areas a ON a.id=u.area_id
 WHERE u.id=? AND u.estado='ACTIVO' AND a.activo=1 AND
 (LOWER(a.nombre) LIKE '%concentraci%' OR EXISTS(
   SELECT 1 FROM usuario_roles ur JOIN roles r ON r.id=ur.rol_id
   WHERE ur.usuario_id=u.id AND r.codigo IN ('PRESTAMOS','ADMIN')))
 LIMIT 1`,[id]);
 return rows.length>0;
};

const returnConditions = new Set(['GOOD', 'ISSUE']);
const conditionLabel = { GOOD: 'Buen estado', ISSUE: 'Con incidencias' };
const conditionFromNotes = (notes, prefix='Estado al recibir') => (
 notes?.startsWith(prefix+': Buen estado.') ? 'GOOD' :
 notes?.startsWith(prefix+': Con incidencias.') ? 'ISSUE' : ''
);

async function oneLoan(id, db=pool) {
 const [rows]=await db.execute(`SELECT p.id,p.folio,p.modalidad,i.folio AS inventoryFolio,a.codigo AS areaCode,
  p.solicitante_nombre,p.solicitante_usuario_id,p.fecha_prestamo,p.fecha_prevista,p.cerrado_en,p.estado,p.observaciones,
  p.recibido_por_nombre,
  CONCAT_WS(' ',ua.nombres,ua.apellido_paterno,ua.apellido_materno) AS autorizado_nombre,
  CONCAT_WS(' ',ue.nombres,ue.apellido_paterno,ue.apellido_materno) AS entregado_nombre
  FROM prestamos p JOIN areas a ON a.id=p.area_solicitante_id
  LEFT JOIN inventarios i ON i.id=p.inventario_id
  JOIN usuarios ua ON ua.id=p.autorizado_por JOIN usuarios ue ON ue.id=p.entregado_por
  WHERE p.id=?`,[id]);
 if(!rows.length)return null;
 const p=rows[0];
 const [items]=await db.execute(`SELECT pe.expediente_id,e.numero_expediente,e.titulo_asunto,e.codigo_clasificacion,
  DATE_FORMAT(pe.devuelto_en,'%Y-%m-%d') AS returnedDate,
  pe.observaciones_devolucion,
  CONCAT_WS(' ',ud.nombres,ud.apellido_paterno,ud.apellido_materno) AS returnedBy
  FROM prestamo_expedientes pe
  JOIN expedientes e ON e.id=pe.expediente_id
  LEFT JOIN usuarios ud ON ud.id=pe.recibido_devolucion_por
  WHERE pe.prestamo_id=? ORDER BY pe.expediente_id`,[id]);
 const [movements]=await db.execute(`SELECT ph.id,ph.expediente_id,ph.accion,ph.detalle,
  DATE_FORMAT(ph.fecha,'%Y-%m-%d') AS moveDate,
  CONCAT_WS(' ',u.nombres,u.apellido_paterno,u.apellido_materno) AS actor
  FROM prestamo_historial ph JOIN usuarios u ON u.id=ph.actor_id
  WHERE ph.prestamo_id=? ORDER BY ph.id`,[id]);
 const deliveryConditions=new Map(movements.filter(m=>m.accion==='ENTREGA').map(m=>[
  String(m.expediente_id),conditionFromNotes(m.detalle,'Estado al entregar')
 ]));
 const remaining=items.filter(x=>!x.returnedDate);
 const latestReturn=[...items].filter(x=>x.returnedDate).sort((a,b)=>b.returnedDate.localeCompare(a.returnedDate))[0];
 return {
  id:'LOAN-'+p.id,folio:p.folio,recordId:'REG-'+items[0]?.expediente_id,
  recordIds:remaining.map(x=>'REG-'+x.expediente_id),
  inventoryFolio:p.inventoryFolio||'',
  items:items.map(x=>({
   id:'REG-'+x.expediente_id,number:x.numero_expediente,title:x.titulo_asunto,
   classification:x.codigo_clasificacion||'',returnedDate:x.returnedDate||'',
   deliveryCondition:deliveryConditions.get(String(x.expediente_id))||'',
   condition:x.returnedDate?conditionFromNotes(x.observaciones_devolucion):''
  })),
  deliveredRecordIds:items.map(x=>'REG-'+x.expediente_id),
  mode:p.modalidad==='INVENTARIO_COMPLETO'?'Inventario completo':'Expediente individual',
  requestingAreaId:p.areaCode,requesterName:p.solicitante_nombre,
  requesterUserId:p.solicitante_usuario_id?String(p.solicitante_usuario_id):'',
  loanDate:shortDate(p.fecha_prestamo),expectedReturnDate:shortDate(p.fecha_prevista),
  authorizedBy:p.autorizado_nombre,deliveredBy:p.entregado_nombre,
  receivedBy:p.recibido_por_nombre,observations:p.observaciones||'',
  status:p.estado==='DEVUELTO'?'Devuelto':'Activo',
  actualReturnDate:shortDate(p.cerrado_en),
  returnReceivedBy:latestReturn?.returnedBy||'',
  returnObservations:latestReturn?.observaciones_devolucion||'',
  history:movements.map(m=>({
   id:'MOV-'+m.id,type:m.accion==='DEVOLUCION'?'Devolución':'Entrega',
   date:m.moveDate,responsible:m.actor,
   detail:m.detalle||(m.accion==='DEVOLUCION'?'Expediente devuelto':'Préstamo entregado')
  })),
 };
}
const guard=user=>{if(!canManageLoans(user))throw fail(
 user.mustChangePassword?'Debes cambiar tu contraseña':'Permiso de préstamos requerido',403);};

const reportAction='REPORTE_TARDANZA';
const reportReason='El préstamo no se devolvió en tiempo y forma.';
export async function readOverdueLoanReports(requesterId=null,db=pool){
 const [rows]=await db.execute(`SELECT CAST(r.id AS CHAR) AS id,p.folio AS loanFolio,
  CAST(p.solicitante_usuario_id AS CHAR) AS requesterId,p.solicitante_nombre AS requesterName,
  a.codigo AS areaId,p.estado AS loanStatus,DATE_FORMAT(p.fecha_prevista,'%Y-%m-%d') AS dueDate,
  r.detalle AS reportData
  FROM auditoria r JOIN prestamos p ON p.id=r.entidad_id
  JOIN areas a ON a.id=p.area_solicitante_id
  WHERE r.entidad='prestamos' AND r.accion=?${requesterId===null?'':' AND p.solicitante_usuario_id=?'}
  ORDER BY r.id DESC`,requesterId===null?[reportAction]:[reportAction,requesterId]);
 return rows.map(({reportData,...row})=>{
  const data=typeof reportData==='string'?JSON.parse(reportData):reportData;
  return {...row,number:'RPT-'+row.id,date:data.date,reason:data.reason||reportReason};
 });
}
loansRouter.get('/reportes',async(req,res,next)=>{
 try{
  guard(req.auth.user);
  res.set('Cache-Control','private, no-store');
  res.json({reports:await readOverdueLoanReports()});
 }catch(e){next(e);}
});
loansRouter.post('/:id/reportes',async(req,res,next)=>{
 let conn;
 try{
  const user=req.auth.user;guard(user);
  if(!/^LOAN-[1-9]\d*$/.test(req.params.id))throw fail('Préstamo inválido');
  const id=req.params.id.slice(5);
  conn=await pool.getConnection();
  await conn.beginTransaction();
  const [[loan]]=await conn.execute(`SELECT folio,estado,solicitante_usuario_id,
   fecha_prevista < CURDATE() AS overdue, DATE_FORMAT(CURDATE(),'%Y-%m-%d') AS today
   FROM prestamos WHERE id=? FOR UPDATE`,[id]);
  if(!loan)throw fail('Préstamo no encontrado',404);
  if(loan.estado!=='ACTIVO'||!loan.overdue)throw fail('Solo se pueden reportar préstamos vencidos que siguen activos',409);
  if(!loan.solicitante_usuario_id)throw fail('Este préstamo no tiene una cuenta solicitante vinculada para recibir la notificación',409);
  const [[existing]]=await conn.execute(`SELECT id FROM auditoria WHERE entidad='prestamos'
   AND entidad_id=? AND accion=? LIMIT 1`,[id,reportAction]);
  if(existing)throw fail('Ya se emitió el reporte RPT-'+existing.id+' para este préstamo.',409);
  const [{insertId}]=await conn.execute('INSERT INTO auditoria(actor_id,entidad,entidad_id,accion,detalle) VALUES (?,?,?,?,?)',
   [user.id,'prestamos',id,reportAction,JSON.stringify({folio:loan.folio,date:loan.today,reason:reportReason})]);
  await conn.commit();
  res.status(201).json({number:'RPT-'+insertId});
 }catch(e){
  if(conn)await conn.rollback();
  next(e);
 }finally{conn?.release();}
});

loansRouter.get('/',async(req,res,next)=>{
 try{
  guard(req.auth.user);
  const [ids]=await pool.query('SELECT id FROM prestamos ORDER BY id DESC LIMIT 2000');
  const loans=[];
  for(const item of ids){const loan=await oneLoan(item.id);if(loan)loans.push(loan);}
  res.json({loans});
 }catch(e){next(e);}
});
loansRouter.get('/usuarios-elegibles',async(req,res,next)=>{
 try{
  guard(req.auth.user);
  const [rows]=await pool.query(`SELECT u.id, CONCAT_WS(' ',u.nombres,u.apellido_paterno,u.apellido_materno) AS name,
  a.codigo AS areaId,
  (LOWER(a.nombre) LIKE '%concentraci%' OR EXISTS(
   SELECT 1 FROM usuario_roles ur JOIN roles r ON r.id=ur.rol_id
   WHERE ur.usuario_id=u.id AND r.codigo IN ('PRESTAMOS','ADMIN'))) AS canDeliver
  FROM usuarios u JOIN areas a ON a.id=u.area_id
  WHERE u.estado='ACTIVO' AND a.activo=1 ORDER BY a.nombre,u.nombres,u.apellido_paterno`);
  res.set('Cache-Control','private, no-store');
  res.json({users:rows.map(row=>({
   id:String(row.id),name:row.name,areaId:row.areaId,canDeliver:Boolean(row.canDeliver)
  }))});
 }catch(e){next(e);}
});
loansRouter.post('/',async(req,res,next)=>{
 let conn;
 let committedFolio;
 try{
  const user=req.auth.user;guard(user);
  // Verificar que la base pueda guardar la cuenta solicitante.
  const [migration]=await pool.execute(`SELECT 1 AS ready FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='prestamos'
      AND COLUMN_NAME='solicitante_usuario_id'`);
  if(!migration.length)throw fail('Ejecuta Backend/sql/010_prestamos_usuarios.sql antes de registrar préstamos',409);
  let selected;
  try{selected=parseLoanSelection(req.body);}catch(e){throw fail(e.message);}
  const {mode,ids}=selected;
  const data=req.body||{};
  const currentDate=await mysqlToday();
  if(!validDate(data.loanDate)||data.loanDate!==currentDate)
   throw fail('La fecha del préstamo debe ser la fecha actual de registro');
  if(!validDate(data.expectedReturnDate)||data.expectedReturnDate<currentDate)
   throw fail('Fecha prevista de devolución inválida');
  const recipient=name(data.receivedBy),notes=name(data.observations,2000);
  if(!recipient)throw fail('Nombre de la persona que recibe obligatorio');
  if(typeof data.requestingAreaId!=='string'||!data.requestingAreaId.trim())throw fail('Área solicitante obligatoria');
  const [areas]=await pool.execute('SELECT id FROM areas WHERE codigo=? AND activo=1',[data.requestingAreaId]);
  if(!areas.length)throw fail('Área solicitante no encontrada');
  const requesterId=userNumber(data.requesterUserId);
  const delivererId=userNumber(data.delivererUserId);
  if(!requesterId||!delivererId)throw fail('Selecciona usuarios válidos para solicitante y entrega');
  const requester=await findActiveUser(requesterId,data.requestingAreaId);
  if(!requester)throw fail('El solicitante no está activo o no pertenece al área seleccionada',400);
  const deliverer=await findActiveUser(delivererId);
  if(!deliverer || !await isLoanStaff(delivererId))
   throw fail('La persona que entrega debe ser personal autorizado del archivo de concentración',400);
  const placeholders=ids.map(()=>'?').join(',');
  conn=await pool.getConnection();
  const multiple=ids.length>1;
  if(multiple)await conn.beginTransaction();
  const [found]=await conn.query(`SELECT e.id,e.inventario_id,e.etapa,e.disponibilidad,
   e.archivo_zona,e.lugar_resguardo,e.estante,e.nivel,e.seccion_fisica
   FROM expedientes e JOIN inventarios i ON i.id=e.inventario_id
   WHERE e.id IN (${placeholders}) AND e.deleted_at IS NULL AND i.deleted_at IS NULL
   ORDER BY e.id${multiple?' FOR UPDATE':''}`,ids);
  if(found.length!==ids.length)throw fail('Uno o más expedientes no existen',404);
  if(found.some(e=>e.etapa!=='CONCENTRACION'||e.disponibilidad!=='EN_ARCHIVO'))
   throw fail('Todos los expedientes deben estar disponibles en Concentración',409);
  const [placed]=await conn.query(`SELECT e.id,
   (SELECT r.estado FROM recepciones r
     JOIN transferencia_expedientes_v ti ON ti.transferencia_id=r.transferencia_id
     WHERE ti.expediente_id=e.id ORDER BY r.id DESC LIMIT 1) AS recepcion_estado
   FROM expedientes e WHERE e.id IN (${placeholders})`,ids);
  if(placed.some(e=>e.recepcion_estado!=='RECIBIDA')||
    found.some(e=>!e.archivo_zona||!e.lugar_resguardo||!e.estante||!e.nivel||!e.seccion_fisica))
   throw fail('Los expedientes requieren recepción física completa y ubicación asignada',409);
  const folio='PRE-'+new Date().getFullYear()+'-'+randomUUID().slice(0,14).toUpperCase();
  let id;
  if(multiple){
   const [{insertId}]=await conn.execute(`INSERT INTO prestamos
     (folio,modalidad,inventario_id,area_solicitante_id,solicitante_nombre,solicitante_usuario_id,
      fecha_prestamo,fecha_prevista,autorizado_por,entregado_por,recibido_por_nombre,observaciones,estado)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'ACTIVO')`,
     [folio,mode,found[0].inventario_id,areas[0].id,personName(requester),requesterId,
      currentDate,data.expectedReturnDate,user.id,delivererId,recipient,notes||null]);
   id=insertId;
   await conn.query('INSERT INTO prestamo_expedientes (prestamo_id,expediente_id) VALUES ?',
    [ids.map(expId=>[id,expId])]);
   await conn.query(`UPDATE expedientes SET disponibilidad='PRESTADO' WHERE id IN (${placeholders})`,ids);
   await conn.query('INSERT INTO prestamo_historial (prestamo_id,expediente_id,actor_id,accion,detalle) VALUES ?',
    [ids.map(expId=>[id,expId,user.id,'ENTREGA','Estado al entregar: '+conditionLabel.GOOD+'.'])]);
  }else{
   // El procedimiento instalado aplica el cambio de disponibilidad protegido por MySQL.
   await conn.query('CALL sp_registrar_prestamo(?,?,?,?,?,?,?,?)',[
    folio,mode,found[0].inventario_id,ids[0],areas[0].id,personName(requester),user.id,data.expectedReturnDate
   ]);
   committedFolio=folio;
   const [[created]]=await conn.execute('SELECT id FROM prestamos WHERE folio=?',[folio]);
   if(!created)throw fail('No se encontró el préstamo recién creado',500);
   id=created.id;
   await conn.beginTransaction();
   await conn.execute(`UPDATE prestamos SET solicitante_usuario_id=?,entregado_por=?,
     recibido_por_nombre=?,observaciones=? WHERE id=?`,[requesterId,delivererId,recipient,notes||null,id]);
   await conn.execute(`UPDATE prestamo_historial SET detalle=? WHERE prestamo_id=? AND accion='ENTREGA'`,
    ['Estado al entregar: '+conditionLabel.GOOD+'.',id]);
  }
  await conn.execute('INSERT INTO auditoria(actor_id,entidad,entidad_id,accion,detalle) VALUES (?,?,?,?,?)',
    [user.id,'prestamos',id,'ENTREGA',JSON.stringify({folio,mode,count:ids.length,requesterUserId:String(requesterId),
     delivererUserId:String(delivererId),conditions:Object.fromEntries(ids.map(expId=>['REG-'+expId,'GOOD']))})]);
  await conn.commit();
  committedFolio=folio;
  res.status(201).json({loan:await oneLoan(id,conn)});
 }catch(e){
  if(conn)await conn.rollback();
  if(committedFolio){
   console.error('Préstamo guardado con error posterior:',e.code||e.message);
   return res.status(500).json({error:'El préstamo '+committedFolio+' se guardó. Recarga la bandeja para verificarlo antes de volver a intentar.'});
  }
  if(e.sqlState==='45000'||e.code==='ER_DUP_ENTRY'||e.code==='ER_SIGNAL_EXCEPTION')
   return res.status(409).json({error:'MySQL rechazó el registro del préstamo. Motivo: '+e.message});
  next(e);
 }finally{conn?.release();}
});

loansRouter.post('/:id/returns',async(req,res,next)=>{
 let conn;
 const completed=[];
 try{
  const user=req.auth.user;guard(user);
  const idText=String(req.params.id);
  if(!/^LOAN-[1-9]\d*$/.test(idText))throw fail('Préstamo inválido');
  const id=Number(idText.slice(5));
  if(!Number.isSafeInteger(id))throw fail('ID de préstamo inválido');
  let ids;
  try{ids=parseReturnItems(req.body?.recordIds);}catch(e){throw fail(e.message);}
  const date=req.body?.date;
  if(!validDate(date)||date!==await mysqlToday())throw fail('La devolución se registra con la fecha real actual');
  const receiver=name(req.body?.receivedBy),notes=name(req.body?.notes,2000);
  if(!receiver)throw fail('Indica quién recibe físicamente la devolución');
  const conditions=req.body?.conditions;
  if(ids.some(expId=>!returnConditions.has(conditions?.['REG-'+expId])))
   throw fail('Indica el estado de cada expediente recibido');

  conn=await pool.getConnection();
  const [[loan]]=await conn.execute(`SELECT estado,DATE_FORMAT(fecha_prestamo,'%Y-%m-%d') AS loanDate
   FROM prestamos WHERE id=?`,[id]);
  if(!loan)throw fail('Préstamo no encontrado',404);
  if(loan.estado!=='ACTIVO')throw fail('El préstamo ya está cerrado',409);
  if(date<loan.loanDate)throw fail('La devolución no puede anteceder al préstamo');
  const [pending]=await conn.execute('SELECT expediente_id FROM prestamo_expedientes WHERE prestamo_id=? AND devuelto_en IS NULL',[id]);
  const wanted=new Set(pending.map(row=>Number(row.expediente_id)));
  if(ids.some(expId=>!wanted.has(expId)))throw fail('Uno o más expedientes ya fueron devueltos o no pertenecen al préstamo',409);

  for(const expId of ids){
   const recordId='REG-'+expId;
   const condition=conditions[recordId];
   const prefix='Estado al recibir: '+conditionLabel[condition]+'. Recibido físicamente por: '+receiver;
   const observation=(prefix+(notes?' | '+notes:'')).slice(0,2000);
   // El procedimiento valida el pendiente y cambia la disponibilidad con el permiso del trigger.
   await conn.query('CALL sp_devolver_expediente(?,?,?)',[id,expId,user.id]);
   completed.push(recordId);
   await conn.beginTransaction();
   await conn.execute('UPDATE prestamo_expedientes SET observaciones_devolucion=? WHERE prestamo_id=? AND expediente_id=?',
    [observation,id,expId]);
   await conn.execute('INSERT INTO auditoria(actor_id,entidad,entidad_id,accion,detalle) VALUES (?,?,?,?,?)',
    [user.id,'prestamos',id,'DEVOLUCION',JSON.stringify({recordIds:[recordId],receivedBy:receiver,conditions:{[recordId]:condition}})]);
   await conn.commit();
  }
  res.json({loan:await oneLoan(id,conn)});
 }catch(e){
  if(conn)await conn.rollback();
  if(completed.length){
   console.error('Devolución aplicada con error posterior:',e.code||e.message);
   const reason=e.sqlState==='45000'||e.code==='ER_SIGNAL_EXCEPTION'?' Motivo: '+e.message:'';
   return res.status(409).json({error:'Se registró la devolución de '+completed.length+
    ' de '+(req.body?.recordIds?.length??completed.length)+' expedientes. Revisa el préstamo actualizado antes de continuar.'+reason});
  }
  if(e.sqlState==='45000'||e.code==='ER_SIGNAL_EXCEPTION')
   return res.status(409).json({error:'MySQL no pudo registrar la devolución. Motivo: '+e.message});
  next(e);
 }finally{conn?.release();}
});
