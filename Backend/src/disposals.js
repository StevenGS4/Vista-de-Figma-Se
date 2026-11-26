import express from 'express';
import ExcelJS from 'exceljs';
import { pool } from './config/database.js';
import { requireAuth } from './auth.js';
import { hasRole, roleNames } from './auth-policy.js';
import { readRecords } from './tramite.js';
import { enrichConcentrationRecords } from './concentration.js';
import { validDate } from './loan-policy.js';
import { safeCell } from './export-policy.js';

export const disposalsRouter = express.Router();
disposalsRouter.use(requireAuth);

const fail = (message, status=400) => Object.assign(new Error(message), {status});
const name = user => [user.firstName,user.paternalName,user.maternalName].filter(Boolean).join(' ');
const marks = values => values.map(()=>'?').join(',');
const localDate = () => new Date().toLocaleDateString('sv-SE',{timeZone:'America/Mazatlan'});
const folio = id => 'PB-'+String(id).padStart(6,'0');
const text = value => typeof value==='string'?value.trim():'';
const pending = `EXISTS (SELECT 1 FROM propuesta_baja_expedientes be
 JOIN propuestas_baja b ON b.id=be.propuesta_id WHERE be.expediente_id=e.id AND b.estado='PROPUESTA')`;
const proposalSelect = `SELECT CAST(b.id AS CHAR) AS id,b.area_nombre AS area,b.estado AS status,
 b.solicitante_nombre AS requester,DATE_FORMAT(b.creada_en,'%Y-%m-%d') AS createdDate,
 b.dictamen_folio AS decisionReference,DATE_FORMAT(b.dictamen_fecha,'%Y-%m-%d') AS decisionDate,
 b.observaciones AS notes,b.responsable_resolucion AS resolvedBy,
 DATE_FORMAT(b.resuelta_en,'%Y-%m-%d') AS resolvedDate
 FROM propuestas_baja b`;

disposalsRouter.use((req,res,next)=>{
 const user=req.auth.user;
 if(user.mustChangePassword||!(hasRole(user,roleNames.ADMIN)||hasRole(user,roleNames.JEFE_AREA)))
  return next(fail('No tienes acceso a Bajas',403));
 res.set('Cache-Control','private, no-store');
 next();
});

const admin = user => hasRole(user,roleNames.ADMIN);
const scope = user => admin(user)?{sql:'',args:[]}:{sql:' AND b.area_codigo=?',args:[user.areaId]};
const mayPropose = user => hasRole(user,roleNames.JEFE_AREA);
const parseId = value => {
 if(!/^[1-9]\d{0,19}$/.test(value))throw fail('Propuesta inválida');
 return value;
};
const physicalLocation = record => [
 record.archiveZone,record.room,record.shelf&&'Estante '+record.shelf,
 record.level&&'Nivel '+record.level,record.physicalSection&&'Sección '+record.physicalSection,
 record.position&&'Posición '+record.position,record.locationBox&&'Caja '+record.locationBox,
 record.locationNotes&&'Observaciones: '+record.locationNotes,
].filter(Boolean).join(' · ');
const snapshot = record => ({
 id:record.id, number:record.recordNumber, title:record.title, inventory:record.inventoryId,
 section:record.cadidoSectionName||record.cadidoSectionId, sectionCode:record.cadidoSectionId,
 series:record.cadidoSeriesName, code:record.cadidoCode, classification:record.archiveClassificationCode,
 opened:record.openDate, closed:record.closeDate, retention:record.totalValidity,
 physicalLocation:physicalLocation(record),
});
const withFolio = row => ({...row,folio:folio(row.id)});

async function proposalFor(user,id){
 const {sql,args}=scope(user);
 const [[row]]=await pool.execute(proposalSelect+' WHERE b.id=?'+sql,[id,...args]);
 if(!row)throw fail('Propuesta no encontrada',404);
 if(row.status==='BAJA'&&!admin(user))throw fail('Solo Administración puede consultar los expedientes dados de baja',403);
 const [items]=await pool.execute(`SELECT be.ficha,e.archivo_zona AS archiveZone,e.lugar_resguardo AS room,
  e.estante AS shelf,e.nivel AS level,e.seccion_fisica AS physicalSection,e.posicion AS position,
  e.caja_ubicacion AS locationBox,e.notas_ubicacion AS locationNotes
  FROM propuesta_baja_expedientes be JOIN expedientes e ON e.id=be.expediente_id
  WHERE be.propuesta_id=? ORDER BY be.expediente_id`,[id]);
 return {...withFolio(row),records:items.map(({ficha,...location})=>{
  const record=typeof ficha==='string'?JSON.parse(ficha):ficha;
  return {...record,physicalLocation:record.physicalLocation??physicalLocation(location)};
 })};
}

disposalsRouter.get('/',async(req,res,next)=>{
 try{
  const {sql,args}=scope(req.auth.user);
  const [proposals]=await pool.execute(proposalSelect+' WHERE 1=1'+sql+' ORDER BY b.id DESC',args);
  res.json({proposals:proposals.map(withFolio)});
 }catch(error){next(error);}
});

disposalsRouter.get('/archivo',async(req,res,next)=>{
 try{
  if(!admin(req.auth.user))throw fail('Solo Administración puede consultar los expedientes dados de baja',403);
  const records=await readRecords(pool,`WHERE e.etapa='CONCENTRACION' AND e.deleted_at IS NOT NULL
   AND EXISTS (SELECT 1 FROM propuesta_baja_expedientes be JOIN propuestas_baja b ON b.id=be.propuesta_id
    WHERE be.expediente_id=e.id AND b.estado='BAJA')`,[],true);
  res.json({records:await enrichConcentrationRecords(records)});
 }catch(error){next(error);}
});

disposalsRouter.get('/expedientes',async(req,res,next)=>{
 try{
  const user=req.auth.user;
  if(!mayPropose(user))throw fail('Solo el encargado de área prepara propuestas',403);
  const records=await readRecords(pool,`WHERE a.codigo=? AND e.etapa='CONCENTRACION'
   AND e.disponibilidad='EN_ARCHIVO' AND NOT ${pending}`,[user.areaId]);
  res.json({records:records.map(snapshot)});
 }catch(error){next(error);}
});

disposalsRouter.post('/',async(req,res,next)=>{
 let conn;
 try{
  const user=req.auth.user;
  if(!mayPropose(user))throw fail('Solo el encargado de área prepara propuestas',403);
  const selected=req.body?.recordIds;
  if(!Array.isArray(selected)||!selected.length||selected.length>15000||
     selected.some(id=>typeof id!=='string'||!/^REG-[1-9]\d{0,19}$/.test(id)))
   throw fail('Selecciona expedientes individuales de tu área');
  const ids=[...new Set(selected.map(id=>id.slice(4)))];
  conn=await pool.getConnection();
  await conn.beginTransaction();
  const [locked]=await conn.execute(`SELECT e.id,a.nombre AS area FROM expedientes e
   JOIN inventarios i ON i.id=e.inventario_id JOIN areas a ON a.id=i.area_id
   WHERE e.id IN (${marks(ids)}) AND a.codigo=? AND e.etapa='CONCENTRACION'
    AND e.disponibilidad='EN_ARCHIVO' AND e.deleted_at IS NULL AND i.deleted_at IS NULL
   ORDER BY e.id FOR UPDATE`,[...ids,user.areaId]);
  if(locked.length!==ids.length)throw fail('Hay expedientes fuera de tu área o que ya no están disponibles',409);
  const [[duplicate]]=await conn.execute(`SELECT e.id FROM expedientes e
   WHERE e.id IN (${marks(ids)}) AND ${pending} LIMIT 1`,ids);
  if(duplicate)throw fail('Uno o más expedientes ya están en una propuesta de baja',409);
  const records=await readRecords(conn,`WHERE e.id IN (${marks(ids)})`,ids);
  if(records.length!==ids.length)throw fail('La selección cambió. Vuelve a consultar los expedientes.',409);
  const [{insertId}]=await conn.execute(`INSERT INTO propuestas_baja
   (area_codigo,area_nombre,solicitado_por,solicitante_nombre,creada_en) VALUES (?,?,?,?,UTC_TIMESTAMP() - INTERVAL 7 HOUR)`,
   [user.areaId,locked[0].area,user.id,name(user)]);
  const rows=records.map(record=>[insertId,record.id.slice(4),JSON.stringify(snapshot(record))]);
  for(let i=0;i<rows.length;i+=400)
   await conn.query('INSERT INTO propuesta_baja_expedientes (propuesta_id,expediente_id,ficha) VALUES ?',[rows.slice(i,i+400)]);
  await conn.execute('INSERT INTO auditoria(actor_id,entidad,entidad_id,accion,detalle) VALUES (?,?,?,?,?)',
   [user.id,'propuestas_baja',insertId,'PROPUESTA_BAJA',JSON.stringify({expedientes:ids.length,folio:folio(insertId)})]);
  await conn.commit();
  res.status(201).json({id:String(insertId),folio:folio(insertId)});
 }catch(error){if(conn)await conn.rollback();next(error);}
 finally{conn?.release();}
});

disposalsRouter.get('/:id',async(req,res,next)=>{
 try{res.json({proposal:await proposalFor(req.auth.user,parseId(req.params.id))});}
 catch(error){next(error);}
});

disposalsRouter.get('/:id/listado.xlsx',async(req,res,next)=>{
 try{
  const proposal=await proposalFor(req.auth.user,parseId(req.params.id));
  const book=new ExcelJS.Workbook();
  const sheet=book.addWorksheet('Propuesta de baja',{views:[{state:'frozen',ySplit:6}]});
  [14,22,26,24,27,52,16,16,17,26,64].forEach((width,index)=>{sheet.getColumn(index+1).width=width;});
  sheet.mergeCells('A1:K1');
  sheet.getCell('A1').value='SEMARNAT · Listado de expedientes propuestos para baja documental';
  const add=values=>sheet.addRow(values.map(safeCell));
  add(['Folio',proposal.folio,'Área',proposal.area]);
  add(['Fecha',proposal.createdDate,'Elaboró',proposal.requester]);
  sheet.mergeCells('A4:K4');
  sheet.getCell('A4').value='Relación para remitir a Oficina Central';
  add([]);
  const heading=add(['Consecutivo','Núm. expediente','Clasificación','Sección','Serie documental','Título o asunto','Apertura','Cierre','Vigencia total','Inventario de origen','Ubicación física']);
  heading.font={bold:true,color:{argb:'FFFFFFFF'}};
  heading.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF205B4D'}};
  proposal.records.forEach((record,index)=>add([index+1,record.number,record.classification,record.section,
   [record.code,record.series].filter(Boolean).join(' · '),record.title,record.opened,record.closed,record.retention,record.inventory,record.physicalLocation]));
  sheet.getColumn(11).alignment={vertical:'top',wrapText:true};
  sheet.autoFilter='A6:K'+sheet.rowCount;
  const bytes=await book.xlsx.writeBuffer();
  res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
   .attachment(proposal.folio+'.xlsx').send(Buffer.from(bytes));
 }catch(error){next(error);}
});

disposalsRouter.post('/:id/resolucion',async(req,res,next)=>{
 let conn;
 try{
  const user=req.auth.user;
  if(!admin(user))throw fail('Solo Administración puede registrar la resolución',403);
  const id=parseId(req.params.id);
  const {status,date}=req.body??{};
  const reference=text(req.body?.reference),notes=text(req.body?.notes);
  if(!['BAJA','NO_PROCEDE'].includes(status)||!validDate(date)||date>localDate()||
     !reference||reference.length>160||notes.length>2000)
   throw fail('Captura el resultado, el folio y la fecha válida del dictamen');
  conn=await pool.getConnection();
  await conn.beginTransaction();
  const [[proposal]]=await conn.execute(`SELECT estado,DATE_FORMAT(creada_en,'%Y-%m-%d') AS created
   FROM propuestas_baja WHERE id=? FOR UPDATE`,[id]);
  if(!proposal)throw fail('Propuesta no encontrada',404);
  if(proposal.estado!=='PROPUESTA')throw fail('La propuesta ya fue resuelta',409);
  if(date<proposal.created)throw fail('La fecha del dictamen debe ser igual o posterior a la propuesta');
  if(status==='BAJA'){
   const [records]=await conn.execute(`SELECT e.etapa,e.disponibilidad,e.deleted_at,i.deleted_at AS inventory_deleted
    FROM propuesta_baja_expedientes be JOIN expedientes e ON e.id=be.expediente_id
    JOIN inventarios i ON i.id=e.inventario_id WHERE be.propuesta_id=? ORDER BY e.id FOR UPDATE`,[id]);
   if(!records.length||records.some(row=>row.etapa!=='CONCENTRACION'||row.disponibilidad!=='EN_ARCHIVO'||row.deleted_at||row.inventory_deleted))
    throw fail('Todos los expedientes deben seguir en Concentración y estar disponibles. Registra primero cualquier devolución pendiente.',409);
   await conn.execute(`UPDATE expedientes e JOIN propuesta_baja_expedientes be ON be.expediente_id=e.id
    SET e.deleted_at=NOW(),e.deleted_by=? WHERE be.propuesta_id=?`,[user.id,id]);
  }
  await conn.execute(`UPDATE propuestas_baja SET estado=?,dictamen_folio=?,dictamen_fecha=?,observaciones=?,
   resuelto_por=?,responsable_resolucion=?,resuelta_en=UTC_TIMESTAMP() - INTERVAL 7 HOUR WHERE id=?`,
   [status,reference,date,notes||null,user.id,name(user),id]);
  await conn.execute('INSERT INTO auditoria(actor_id,entidad,entidad_id,accion,detalle) VALUES (?,?,?,?,?)',
   [user.id,'propuestas_baja',id,status==='BAJA'?'BAJA_DOCUMENTAL':'BAJA_NO_PROCEDE',JSON.stringify({folio:folio(id),reference,date})]);
  await conn.commit();
  res.json({ok:true});
 }catch(error){if(conn)await conn.rollback();next(error);}
 finally{conn?.release();}
});
