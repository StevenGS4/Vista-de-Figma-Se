import express from 'express';
import { randomUUID } from 'node:crypto';
import { pool } from './config/database.js';
import { requireAuth } from './auth.js';
import { inventoryScope,hasInventoryAccess,hasCommonHeader,validSupport } from './inventory-policy.js';

export const tramiteRouter = express.Router();
tramiteRouter.use(requireAuth);
const fail = (message,status=400) => Object.assign(new Error(message),{status});
const num = (value,name,min=0,max=65535) => {
  const n=Number(value);
  if(value===null||value===undefined||value===''||!Number.isSafeInteger(n)||n<min||n>max)
    throw fail('Valor inválido: '+name);
  return n;
};
const nullableNum=(v,name,min=0,max=65535)=>v==null||v===''?null:num(v,name,min,max);
const text=(v,max=350)=>String(v??'').trim().slice(0,max);
const date=(v,required=false)=>{
 const s=text(v,10);
 if(!s && !required)return null;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||Number.isNaN(Date.parse(s+'T00:00:00Z')))
   throw fail('Fecha inválida');
 return s;
};
const access=(user)=>{
 const scope=inventoryScope(user);
 if(!scope)throw fail(user.mustChangePassword?'Debes cambiar tu contraseña':'No tienes permiso para consultar Archivo de Trámite',403);
 return scope;
};
const rowId=id=>'REG-'+id;
const seriesId=id=>'SER-'+id;
function checkOwner(user,mode,inventory,editable=false){
 if(!hasInventoryAccess(user,mode,inventory))throw fail('Inventario fuera de tu alcance',403);
 if(editable && inventory.estado!=='TRAMITE')throw fail('El inventario está protegido por transferencia',409);
}
async function getInventory(conn,folio,locked=false){
 const [rows]=await conn.execute(`SELECT i.id,i.folio,i.area_id,i.creado_por,i.estado,a.codigo AS area_code,
 i.serie_id,i.seccion_id FROM inventarios i JOIN areas a ON a.id=i.area_id
 WHERE i.folio=?${locked?' FOR UPDATE':''}`,[folio]);
 return rows[0]||null;
}
async function readRecords(conn,where='',params=[]){
 const [rows]=await conn.execute(`SELECT
 i.folio AS inventoryId,DATE_FORMAT(i.fecha_elaboracion,'%Y-%m-%d') AS inventoryDate,
 i.responsable_cargo AS responsiblePosition,i.hoja_inicial AS initialSheetNumber,
 i.unidad_administrativa AS administrativeUnit,a.codigo AS areaId,i.responsable_nombre AS responsible,
 i.fondo AS fund,CAST(e.consecutivo AS CHAR) AS consecutive,e.id AS dbId,
 e.numero_expediente AS recordNumber,e.numero_caja AS boxNumber,e.titulo_asunto AS title,
 e.descripcion AS description,e.domicilio_resguardo AS archiveAddress,e.observaciones AS observations,
 sc.codigo AS cadidoSectionId,sr.id AS dbSeriesId,sr.codigo AS cadidoCode,
 DATE_FORMAT(e.apertura,'%Y-%m-%d') AS openDate,DATE_FORMAT(e.cierre,'%Y-%m-%d') AS closeDate,
 CAST(e.legajos AS CHAR) AS filesCount,CAST(e.folios AS CHAR) AS foliosCount,
 e.soporte AS supportType,CAST(e.anios_tramite AS CHAR) AS currentValidity,
 CAST(e.anios_concentracion AS CHAR) AS concentrationValidity,
 CAST(e.anios_total AS CHAR) AS totalValidity,e.lugar_resguardo AS room,
 e.estante AS shelf,e.nivel AS level,e.seccion_fisica AS physicalSection,
 e.posicion AS position,e.caja_ubicacion AS locationBox,e.notas_ubicacion AS locationNotes,
 e.etapa AS stage,e.disponibilidad AS availability,CAST(e.creado_por AS CHAR) AS createdBy,
 t.folio AS transferReference,DATE_FORMAT(t.enviada_en,'%Y-%m-%d') AS transferDate,
 DATE_FORMAT(t.aceptada_en,'%Y-%m-%d') AS transferAcceptedDate
 FROM inventarios i
 JOIN areas a ON a.id=i.area_id
 JOIN expedientes e ON e.inventario_id=i.id
 JOIN secciones_cadido sc ON sc.id=i.seccion_id
 JOIN series_cadido sr ON sr.id=e.serie_id
 LEFT JOIN transferencia_inventarios ti ON ti.inventario_id=i.id
 LEFT JOIN transferencias t ON t.id=ti.transferencia_id
 ${where} ORDER BY i.fecha_elaboracion DESC,i.id DESC,e.consecutivo ASC`,params);
 const ids=rows.map(r=>r.dbId);
 let values=[];
 if(ids.length){
   const placeholders=ids.map(()=>'?').join(',');
   const [v]=await conn.query('SELECT expediente_id,valor FROM expediente_valores WHERE expediente_id IN ('+placeholders+')',ids);
   values=v;
 }
 const valMap=new Map();
 for(const v of values)valMap.set(v.expediente_id,[...(valMap.get(v.expediente_id)||[]),v.valor]);
 const vNames={ADMINISTRATIVO:'Administrativo',LEGAL:'Legal',FISCAL:'Fiscal',CONTABLE:'Contable',TECNICO:'Técnico'};
 return rows.map(r=>({
 id:rowId(r.dbId),inventoryId:r.inventoryId,inventoryDate:r.inventoryDate,
 responsiblePosition:r.responsiblePosition,initialSheetNumber:String(r.initialSheetNumber),
 administrativeUnit:r.administrativeUnit,areaId:r.areaId,responsible:r.responsible,fund:r.fund,
 consecutive:r.consecutive,recordNumber:r.recordNumber,boxNumber:r.boxNumber||'',title:r.title,
 description:r.description||'',archiveAddress:r.archiveAddress||'',observations:r.observations||'',
 cadidoSectionId:r.cadidoSectionId,cadidoSeriesId:seriesId(r.dbSeriesId),cadidoCode:r.cadidoCode,
 openDate:r.openDate,closeDate:r.closeDate||'',filesCount:r.filesCount,foliosCount:r.foliosCount,
 supportType:{FISICO:'Físico',ELECTRONICO:'Electrónico',MIXTO:'Mixto'}[r.supportType],
 documentaryValues:(valMap.get(r.dbId)||[]).map(v=>vNames[v]),currentValidity:r.currentValidity,
 concentrationValidity:r.concentrationValidity,totalValidity:r.totalValidity,
 archiveZone:'Archivo de trámite — '+r.areaId,room:r.room||'',shelf:r.shelf==null?'':String(r.shelf),
 level:r.level==null?'':String(r.level),physicalSection:r.physicalSection==null?'':String(r.physicalSection),
 position:r.position||'',locationBox:r.locationBox||'',locationNotes:r.locationNotes||'',
 stage:r.stage==='CONCENTRACION'?'Archivo de concentración':'Archivo de trámite',
 availability:r.availability==='PRESTADO'?'Prestado':'En archivo',createdBy:r.createdBy,
 transferReference:r.transferReference||'',transferDate:r.transferDate||'',
 transferAcceptedDate:r.transferAcceptedDate||'',receptionDate:'',receptionResponsible:'',receptionNotes:'',
 }));
}
async function catalog(conn,user,mode){
 const [sections]=await conn.execute('SELECT codigo AS id,nombre AS name FROM secciones_cadido ORDER BY codigo');
 const [series]=await conn.execute(`SELECT sr.id,sr.nombre,sr.codigo,sc.codigo AS sectionCode,
 GROUP_CONCAT(DISTINCT a.codigo ORDER BY a.codigo SEPARATOR ',') AS enabled
 FROM series_cadido sr JOIN secciones_cadido sc ON sc.id=sr.seccion_id
 JOIN series_areas sa ON sa.serie_id=sr.id JOIN areas a ON a.id=sa.area_id
 WHERE sr.activo=1 GROUP BY sr.id,sr.nombre,sr.codigo,sc.codigo ORDER BY sr.codigo`);
 return {sections:sections.map(s=>({...s,description:'Sección de catálogo'})),
  series:series.filter(s=>mode==='GLOBAL'||s.enabled.split(',').includes(user.areaId))
    .map(s=>({id:seriesId(s.id),sectionId:s.sectionCode,name:s.nombre,code:s.codigo,
      detail:'Clasificación de catálogo',enabledAreaIds:s.enabled.split(',')}))};
}
function normalize(rows){
 if(!Array.isArray(rows)||!rows.length)throw fail('Agrega al menos un expediente');
 if(!hasCommonHeader(rows))throw fail('Todas las filas deben compartir el encabezado y clasificación CADIDO');
 if(rows.length>50000)throw fail('Inventario demasiado grande para una sola operación; usa importación por lotes',413);
 const header=rows[0],unique=new Set(),numbers=new Set();
 for(const r of rows){
   if(r.areaId!==header.areaId||r.cadidoSectionId!==header.cadidoSectionId||
      r.cadidoSeriesId!==header.cadidoSeriesId||r.inventoryId!==header.inventoryId)
     throw fail('Todas las filas deben compartir el encabezado y clasificación CADIDO');
   const consecutivo=num(r.consecutive,'consecutivo',1,2147483647);
   const number=text(r.recordNumber,110).toUpperCase();
   if(!number||!text(r.title))throw fail('Número y asunto de cada expediente son obligatorios');
   if(unique.has(consecutivo)||numbers.has(number))throw fail('Expediente o consecutivo duplicado');
   unique.add(consecutivo);numbers.add(number);
   const open=date(r.openDate,true),close=date(r.closeDate);
   if(close&&close<open)throw fail('Cierre anterior a apertura');
   if(!validSupport(r.supportType))throw fail('Soporte documental inválido');
   if(!Array.isArray(r.documentaryValues)||!r.documentaryValues.length)throw fail('Selecciona valores documentales');
   num(r.filesCount,'legajos',0,2147483647);num(r.foliosCount,'folios',0,2147483647);
   num(r.currentValidity,'vigencia trámite');num(r.concentrationValidity,'vigencia concentración');
   nullableNum(r.shelf,'estante',1,25);nullableNum(r.level,'nivel',1,4);
   nullableNum(r.physicalSection,'sección física',1,4);
 }
 if(!text(header.administrativeUnit)||!text(header.responsible)||!text(header.responsiblePosition)||
    !text(header.fund)||!text(header.areaId)||!text(header.cadidoSectionId)||!text(header.cadidoSeriesId))
   throw fail('Encabezado documental incompleto');
 date(header.inventoryDate,true);
 return header;
}
async function resolveCatalog(conn,header,user,mode){
 const [areas]=await conn.execute('SELECT id,codigo FROM areas WHERE codigo=? AND activo=1',[header.areaId]);
 if(!areas.length)throw fail('Área no registrada en MySQL; carga primero el catálogo');
 if(mode!=='GLOBAL'&&header.areaId!==user.areaId)throw fail('No puedes registrar inventarios de otra área',403);
 const id=Number(String(header.cadidoSeriesId).replace(/^SER-/,'')); 
 if(!Number.isSafeInteger(id))throw fail('Serie CADIDO inexistente');
 const [series]=await conn.execute(`SELECT sr.id,sr.seccion_id,sc.codigo AS seccion_code FROM series_cadido sr
 JOIN secciones_cadido sc ON sc.id=sr.seccion_id JOIN series_areas sa ON sa.serie_id=sr.id
 WHERE sr.id=? AND sc.codigo=? AND sa.area_id=? AND sr.activo=1`,
 [id,header.cadidoSectionId,areas[0].id]);
 if(!series.length)throw fail('Serie CADIDO no autorizada para esta área');
 return {areaId:areas[0].id,serieId:series[0].id,seccionId:series[0].seccion_id};
}
function rowFields(r,inventoryId,serieId,userId){
 return {
  inventario_id:inventoryId,consecutivo:num(r.consecutive,'consecutivo',1,2147483647),
  numero_caja:text(r.boxNumber,60)||null,numero_expediente:text(r.recordNumber,110).toUpperCase(),
  serie_id:serieId,titulo_asunto:text(r.title,350),descripcion:text(r.description,50000)||null,
  apertura:date(r.openDate,true),cierre:date(r.closeDate),legajos:num(r.filesCount,'legajos',0,2147483647),
  folios:num(r.foliosCount,'folios',0,2147483647),
  soporte:{'Físico':'FISICO','Electrónico':'ELECTRONICO','Mixto':'MIXTO'}[r.supportType],
  anios_tramite:num(r.currentValidity,'vigencia trámite'),
  anios_concentracion:num(r.concentrationValidity,'vigencia concentración'),
  domicilio_resguardo:text(r.archiveAddress,350)||null,
  lugar_resguardo:text(r.room,150)||null,estante:nullableNum(r.shelf,'estante',1,25),
  nivel:nullableNum(r.level,'nivel',1,4),seccion_fisica:nullableNum(r.physicalSection,'sección física',1,4),
  posicion:text(r.position,45)||null,caja_ubicacion:text(r.locationBox,60)||null,
  notas_ubicacion:text(r.locationNotes,50000)||null,observaciones:text(r.observations,50000)||null,
  creado_por:userId,
 };
}
const valueCodes={Administrativo:'ADMINISTRATIVO',Legal:'LEGAL',Fiscal:'FISCAL',Contable:'CONTABLE','Técnico':'TECNICO'};
async function replaceValues(conn,expId,values){
 await conn.execute('DELETE FROM expediente_valores WHERE expediente_id=?',[expId]);
 for(const label of [...new Set(values)]){
   const value=valueCodes[label];if(!value)throw fail('Valor documental inválido');
   await conn.execute('INSERT INTO expediente_valores(expediente_id,valor) VALUES (?,?)',[expId,value]);
 }
}
function insertSql(table,record){const keys=Object.keys(record);return {
 sql:`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`,
 vals:Object.values(record)
};}
async function save(req,res,next,editing=false){
 let conn;
 try{
  const user=req.auth.user,mode=access(user),rows=req.body?.rows,header=normalize(rows);
  if(!['GLOBAL','AREA','PROPIO'].includes(mode))throw fail('No autorizado',403);
  conn=await pool.getConnection();
  await conn.beginTransaction();
  let inventoryId,folio;
  if(editing){
   const inv=await getInventory(conn,req.params.folio,true);
   if(!inv)throw fail('Inventario no encontrado',404);
   checkOwner(user,mode,inv,true);
   const [linked]=await conn.execute('SELECT 1 FROM transferencia_inventarios WHERE inventario_id=? LIMIT 1',[inv.id]);
   if(linked.length)throw fail('Inventario vinculado a transferencia: edición bloqueada',409);
   if(header.inventoryId!==inv.folio)throw fail('No puedes cambiar el identificador de inventario');
   const cat=await resolveCatalog(conn,header,user,mode);
   if(inv.serie_id!==cat.serieId||inv.seccion_id!==cat.seccionId||inv.area_id!==cat.areaId)
     throw fail('No se puede cambiar la clasificación común de un inventario existente; crea otro inventario',409);
   inventoryId=inv.id;folio=inv.folio;
   await conn.execute(`UPDATE inventarios SET unidad_administrativa=?,responsable_nombre=?,responsable_cargo=?,
    fondo=?,fecha_elaboracion=?,hoja_inicial=? WHERE id=?`,
    [text(header.administrativeUnit,220),text(header.responsible,200),text(header.responsiblePosition,200),
     text(header.fund,160),date(header.inventoryDate,true),num(header.initialSheetNumber||1,'hoja',1,65535),inventoryId]);
   const [oldRows]=await conn.execute('SELECT id FROM expedientes WHERE inventario_id=? FOR UPDATE',[inventoryId]);
   const oldIds=new Set(oldRows.map(r=>r.id));
   const supplied=new Set();
   for(const r of rows){
     if(/^REG-\d+$/.test(r.id)){
       const id=Number(r.id.slice(4));
       if(!oldIds.has(id)||supplied.has(id))throw fail('Expediente inválido o duplicado',400);
       supplied.add(id);
     }
   }
   for(const id of oldIds){
     if(supplied.has(id))continue;
     await conn.execute('DELETE FROM expediente_valores WHERE expediente_id=?',[id]);
     await conn.execute('DELETE FROM expedientes WHERE id=? AND inventario_id=?',[id,inventoryId]);
   }
  }else{
   const cat=await resolveCatalog(conn,header,user,mode);
   const folioGenerated='INV-TR-'+new Date().toISOString().slice(0,10).replace(/-/g,'')+'-'+randomUUID().slice(0,10).toUpperCase();
   const entry={folio:folioGenerated,unidad_administrativa:text(header.administrativeUnit,220),
     area_id:cat.areaId,responsable_nombre:text(header.responsible,200),responsable_cargo:text(header.responsiblePosition,200),
     fondo:text(header.fund,160),seccion_id:cat.seccionId,serie_id:cat.serieId,
     fecha_elaboracion:date(header.inventoryDate,true),hoja_inicial:num(header.initialSheetNumber||1,'hoja',1,65535),
     creado_por:user.id};
   const insert=insertSql('inventarios',entry),[result]=await conn.execute(insert.sql,insert.vals);
   inventoryId=result.insertId;folio=folioGenerated;
  }
  const cat=await resolveCatalog(conn,header,user,mode);
  for(const r of rows){
   const fields=rowFields(r,inventoryId,cat.serieId,editing && /^REG-\d+$/.test(r.id)
     ? (await conn.execute('SELECT creado_por FROM expedientes WHERE id=?',[Number(r.id.slice(4))]))[0][0]?.creado_por || user.id
     : user.id);
   let expId;
   if(editing&&/^REG-\d+$/.test(r.id)){
     expId=Number(r.id.slice(4));
     delete fields.inventario_id;delete fields.creado_por;
     const keys=Object.keys(fields),vals=Object.values(fields);
     await conn.execute('UPDATE expedientes SET '+keys.map(k=>k+'=?').join(',')+' WHERE id=? AND inventario_id=?',
       [...vals,expId,inventoryId]);
   }else{
     const insertion=insertSql('expedientes',fields);
     const [result]=await conn.execute(insertion.sql,insertion.vals);
     expId=result.insertId;
   }
   await replaceValues(conn,expId,r.documentaryValues);
  }
  await conn.execute('INSERT INTO auditoria(actor_id,entidad,entidad_id,accion,detalle) VALUES (?,?,?,?,?)',
    [user.id,'inventarios',inventoryId,editing?'ACTUALIZAR':'CREAR',JSON.stringify({folio,expedientes:rows.length})]);
  await conn.commit();
  const saved=await readRecords(pool,'WHERE i.id=?',[inventoryId]);
  res.status(editing?200:201).json({folio,records:saved});
 }catch(error){
  if(conn)await conn.rollback();
  if(error.code==='ER_DUP_ENTRY')return res.status(409).json({error:'Consecutivo o número de expediente duplicado'});
  next(error);
 }finally{conn?.release();}
}
tramiteRouter.get('/catalogo',async(req,res,next)=>{
 try{const mode=access(req.auth.user);res.json(await catalog(pool,req.auth.user,mode));}catch(e){next(e);}
});
tramiteRouter.get('/inventarios',async(req,res,next)=>{
 try{
  const user=req.auth.user,mode=access(user);
  const where=mode==='GLOBAL'?'':mode==='AREA'?'WHERE a.codigo=?':'WHERE a.codigo=? AND i.creado_por=?';
  const params=mode==='GLOBAL'?[]:mode==='AREA'?[user.areaId]:[user.areaId,user.id];
  res.json({records:await readRecords(pool,where,params)});
 }catch(e){next(e);}
});
tramiteRouter.post('/inventarios',(req,res,next)=>save(req,res,next));
tramiteRouter.put('/inventarios/:folio',(req,res,next)=>save(req,res,next,true));
tramiteRouter.delete('/inventarios/:folio',async(req,res,next)=>{
 let conn;
 try{
  const user=req.auth.user,mode=access(user);
  if(mode==='PROPIO')throw fail('Solo el encargado del área o administrador puede eliminar',403);
  conn=await pool.getConnection();await conn.beginTransaction();
  const inv=await getInventory(conn,req.params.folio,true);
  if(!inv)throw fail('Inventario no encontrado',404);
  checkOwner(user,mode,inv,true);
  const [linked]=await conn.execute('SELECT 1 FROM transferencia_inventarios WHERE inventario_id=? LIMIT 1',[inv.id]);
  if(linked.length)throw fail('El inventario tiene historial de transferencia',409);
  const [ids]=await conn.execute('SELECT id FROM expedientes WHERE inventario_id=? FOR UPDATE',[inv.id]);
  for(const row of ids){
   await conn.execute('DELETE FROM expediente_valores WHERE expediente_id=?',[row.id]);
   await conn.execute('DELETE FROM expedientes WHERE id=?',[row.id]);
  }
  await conn.execute('DELETE FROM inventarios WHERE id=?',[inv.id]);
  await conn.execute('INSERT INTO auditoria(actor_id,entidad,entidad_id,accion,detalle) VALUES (?,?,?,?,?)',
    [user.id,'inventarios',inv.id,'ELIMINAR',JSON.stringify({folio:inv.folio,expedientes:ids.length})]);
  await conn.commit();res.json({ok:true});
 }catch(e){if(conn)await conn.rollback();next(e);}finally{conn?.release();}
});
