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

async function oneLoan(id) {
 const [rows]=await pool.execute(`SELECT p.id,p.folio,p.modalidad,a.codigo AS areaCode,
  p.solicitante_nombre,p.solicitante_usuario_id,p.fecha_prestamo,p.fecha_prevista,p.cerrado_en,p.estado,p.observaciones,
  p.recibido_por_nombre,
  CONCAT_WS(' ',ua.nombres,ua.apellido_paterno,ua.apellido_materno) AS autorizado_nombre,
  CONCAT_WS(' ',ue.nombres,ue.apellido_paterno,ue.apellido_materno) AS entregado_nombre
  FROM prestamos p JOIN areas a ON a.id=p.area_solicitante_id
  JOIN usuarios ua ON ua.id=p.autorizado_por JOIN usuarios ue ON ue.id=p.entregado_por
  WHERE p.id=?`,[id]);
 if(!rows.length)return null;
 const p=rows[0];
 const [items]=await pool.execute(`SELECT pe.expediente_id,
  DATE_FORMAT(pe.devuelto_en,'%Y-%m-%d') AS returnedDate,
  pe.observaciones_devolucion,
  CONCAT_WS(' ',ud.nombres,ud.apellido_paterno,ud.apellido_materno) AS returnedBy
  FROM prestamo_expedientes pe
  LEFT JOIN usuarios ud ON ud.id=pe.recibido_devolucion_por
  WHERE pe.prestamo_id=? ORDER BY pe.expediente_id`,[id]);
 const [movements]=await pool.execute(`SELECT ph.id,ph.expediente_id,ph.accion,ph.detalle,
  DATE_FORMAT(ph.fecha,'%Y-%m-%d') AS moveDate,
  CONCAT_WS(' ',u.nombres,u.apellido_paterno,u.apellido_materno) AS actor
  FROM prestamo_historial ph JOIN usuarios u ON u.id=ph.actor_id
  WHERE ph.prestamo_id=? ORDER BY ph.id`,[id]);
 const remaining=items.filter(x=>!x.returnedDate);
 const latestReturn=[...items].filter(x=>x.returnedDate).sort((a,b)=>b.returnedDate.localeCompare(a.returnedDate))[0];
 return {
  id:'LOAN-'+p.id,folio:p.folio,recordId:'REG-'+items[0]?.expediente_id,
  recordIds:remaining.map(x=>'REG-'+x.expediente_id),
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
 try{
  const user=req.auth.user;guard(user);
  // El SP confirma el préstamo; verificar la migración ANTES de invocarlo.
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
  const [found]=await pool.query(`SELECT e.id,e.inventario_id,e.etapa,e.disponibilidad,
  i.estado AS inventoryState
  FROM expedientes e JOIN inventarios i ON i.id=e.inventario_id
  WHERE e.id IN (${placeholders}) ORDER BY e.id`,ids);
  if(found.length!==ids.length)throw fail('Uno o más expedientes no existen',404);
  const inventoryId=found[0].inventario_id;
  if(found.some(e=>e.inventario_id!==inventoryId||e.etapa!=='CONCENTRACION'||
    e.inventoryState!=='CONCENTRACION'||e.disponibilidad!=='EN_ARCHIVO'))
    throw fail('Los expedientes deben pertenecer al mismo inventario aceptado y estar disponibles',409);
  // Un expediente administrativamente aceptado NO es prestable hasta que
  // el administrador coteje y ubique físicamente todos los documentos.
  const [placed]=await pool.query(`SELECT e.id,e.archivo_zona,e.lugar_resguardo,e.estante,e.nivel,e.seccion_fisica,
   (SELECT r.estado FROM recepciones r
     JOIN transferencia_inventarios ti ON ti.transferencia_id=r.transferencia_id
     WHERE ti.inventario_id=e.inventario_id
     ORDER BY r.id DESC LIMIT 1) AS recepcion_estado
   FROM expedientes e WHERE e.id IN (${placeholders})`,ids);
  if(placed.length!==ids.length||placed.some(e=>e.recepcion_estado!=='RECIBIDA'||
     !e.archivo_zona||!e.lugar_resguardo||!e.estante||!e.nivel||!e.seccion_fisica))
   throw fail('El inventario requiere recepción física completa y ubicación asignada por el administrador antes de prestarse',409);
  if(mode==='INVENTARIO_COMPLETO'){
   const [all]=await pool.execute('SELECT id FROM expedientes WHERE inventario_id=?',[inventoryId]);
   const wanted=new Set(ids);
   if(all.length!==ids.length||all.some(x=>!wanted.has(Number(x.id))))
    throw fail('Debes seleccionar el inventario completo, sin excluir ningún expediente',409);
  }
  const folio='PRE-'+new Date().getFullYear()+'-'+randomUUID().slice(0,14).toUpperCase();
  // El procedimiento existente registra el préstamo y cambia disponibilidad
  // de forma atómica; también preserva el bloqueo contra préstamos simultáneos.
  const result=await pool.query('CALL sp_registrar_prestamo(?,?,?,?,?,?,?,?)',[
   folio,mode,inventoryId,mode==='INDIVIDUAL'?ids[0]:null,
   areas[0].id,personName(requester),user.id,data.expectedReturnDate
  ]);
  const [rows]=await pool.execute('SELECT id FROM prestamos WHERE folio=?',[folio]);
  if(!rows.length)throw fail('No se encontró el préstamo recién creado',500);
  const id=rows[0].id;
  // El SP conserva autorizador = usuario autenticado; asociamos solicitante y
  // entregador elegidos, ambos validados contra cuentas activas y roles de MySQL.
  await pool.execute(`UPDATE prestamos SET solicitante_usuario_id=?,entregado_por=?,
    recibido_por_nombre=?,observaciones=? WHERE id=?`,
    [requesterId,delivererId,recipient,notes||null,id]);
  await pool.execute('INSERT INTO auditoria(actor_id,entidad,entidad_id,accion,detalle) VALUES (?,?,?,?,?)',
    [user.id,'prestamos',id,'ENTREGA',JSON.stringify({folio,mode,count:ids.length,requesterUserId:String(requesterId),delivererUserId:String(delivererId)})]);
  res.status(201).json({loan:await oneLoan(id)});
 }catch(e){
  if(e.sqlState==='45000'||e.code==='ER_DUP_ENTRY'||e.code==='ER_SIGNAL_EXCEPTION')
   return res.status(409).json({error:'Préstamo no permitido: '+e.message});
  next(e);
 }
});
loansRouter.post('/:id/returns',async(req,res,next)=>{
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
  const [loanRows]=await pool.execute('SELECT estado,DATE_FORMAT(fecha_prestamo,\'%Y-%m-%d\') AS loanDate FROM prestamos WHERE id=?',[id]);
  if(!loanRows.length)throw fail('Préstamo no encontrado',404);
  if(loanRows[0].estado!=='ACTIVO')throw fail('El préstamo ya está cerrado',409);
  if(date<loanRows[0].loanDate)throw fail('La devolución no puede anteceder al préstamo');
  const receiver=name(req.body?.receivedBy),notes=name(req.body?.notes,2000);
  if(!receiver)throw fail('Indica quién recibe físicamente la devolución');
  const [pending]=await pool.execute('SELECT expediente_id FROM prestamo_expedientes WHERE prestamo_id=? AND devuelto_en IS NULL',[id]);
  const wanted=new Set(pending.map(x=>Number(x.expediente_id)));
  if(ids.some(x=>!wanted.has(x)))throw fail('Uno o más expedientes ya fueron devueltos o no pertenecen al préstamo',409);
  // El SP confirma y libera cada expediente sin tocar su etapa archivística.
  // Cada devolución individual es atómica; si alguna falla, se informa
  // y el usuario puede consultar el préstamo actualizado antes de reintentar.
  const completed=[];
  for(const expId of ids){
   try{
    await pool.query('CALL sp_devolver_expediente(?,?,?)',[id,expId,user.id]);
    completed.push(expId);
    if(notes) await pool.execute(
      'UPDATE prestamo_expedientes SET observaciones_devolucion=? WHERE prestamo_id=? AND expediente_id=?',
      [notes+' | Recibido físicamente por: '+receiver,id,expId]);
   }catch(error){
    return res.status(409).json({error:'Se devolvieron '+completed.length+
      ' expediente(s). La operación se detuvo: '+error.message+'. Recarga para verificar el estado.'});
   }
  }
  await pool.execute('INSERT INTO auditoria(actor_id,entidad,entidad_id,accion,detalle) VALUES (?,?,?,?,?)',
    [user.id,'prestamos',id,'DEVOLUCION',JSON.stringify({recordIds:completed.map(x=>'REG-'+x),receivedBy:receiver})]);
  res.json({loan:await oneLoan(id)});
 }catch(e){next(e);}
});
