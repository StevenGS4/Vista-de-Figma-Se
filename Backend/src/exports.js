import express from 'express';
import { pool } from './config/database.js';
import { requireAuth } from './auth.js';
import { readRecords } from './tramite.js';
import { exportTypes, exportScope, stageForType } from './export-policy.js';
import { enrichConcentrationRecords } from './concentration.js';
import { makeConcentrationInventoryWorkbook, makeDocumentaryReportWorkbook, sortDocumentaryReportRecords } from './inventory-report-workbooks.js';
import { makeOfficialTemplateWorkbook } from './template-workbooks.js';
import { seriesInventoryHeader } from './series-inventory-header.js';
import { validDate } from './loan-policy.js';
import { selectPrimaryRecords } from './primary-inventory-selection.js';
async function workbookFor(records,type){
 if(type==='concentracion')return makeConcentrationInventoryWorkbook(await enrichConcentrationRecords(records));
 if(type==='transferencia')return makeDocumentaryReportWorkbook(records);
 return makeOfficialTemplateWorkbook(records,type);
}

const limitRows=15000;

export const exportsRouter=express.Router();
exportsRouter.use(requireAuth);
const fail=(m,status=400)=>Object.assign(new Error(m),{status});
const oneType=(value)=>{
 if(!Object.hasOwn(exportTypes,value))throw fail('Tipo de inventario inválido');
 return value;
};
function inventoryScope(user,type,{bySeries=false}={}){
 const scope=exportScope(user,type);
 if(!scope)throw fail('No tienes permiso para exportar este inventario',403);
 const filters=['e.etapa=?','e.deleted_at IS NULL','i.deleted_at IS NULL'];
 const params=[stageForType(type)];
 if(scope!=='GLOBAL'){filters.push('a.codigo=?');params.push(user.areaId);}
 if(scope==='PROPIO'){filters.push(bySeries?'e.creado_por=?':'i.creado_por=?');params.push(user.id);}
 return {filters,params};
}
async function scopedRows(user,type,folio){
 const {filters,params}=inventoryScope(user,type);
 if(folio){filters.push('i.folio=?');params.push(folio);}
 if(type==='transferencia')filters.push("i.estado='TRAMITE'");
 const [count]=await pool.execute(`SELECT COUNT(*) AS n
 FROM expedientes e JOIN inventarios i ON i.id=e.inventario_id
 JOIN areas a ON a.id=i.area_id WHERE ${filters.join(' AND ')}`,params);
 if(Number(count[0].n)>limitRows)throw fail('Exportación demasiado grande; reduce los filtros',413);
 return readRecords(pool,'WHERE '+filters.join(' AND '),params);
}
async function sendXlsx(book,res,filename,actorId,detail){
 const bytes=await book.xlsx.writeBuffer();
 // La descarga no debe fallar si la bitácora experimenta un error aislado.
 try {
  await pool.execute('INSERT INTO auditoria(actor_id,entidad,entidad_id,accion,detalle) VALUES (?,?,?,?,?)',
   [actorId,'exportaciones',0,'DESCARGAR',JSON.stringify(detail)]);
 } catch(error) {
  console.error('No se pudo auditar la descarga Excel:',error.code||error.message);
 }
 res.set('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
 res.set('Content-Disposition',`attachment; filename="${filename}"`);
 res.set('Cache-Control','private, no-store');
 res.send(Buffer.from(bytes));
}
const seriesJoins=`FROM expedientes e JOIN inventarios i ON i.id=e.inventario_id
 JOIN areas a ON a.id=i.area_id JOIN secciones_cadido sc ON sc.id=i.seccion_id
 JOIN series_cadido sr ON sr.id=e.serie_id`;
function seriesType(value){
 if(value!=='tramite'&&value!=='concentracion')throw fail('Tipo de inventario inválido');
 return value;
}
function filterValues(values,valid){
 if(!Array.isArray(values)||values.length>5000||values.some(value=>typeof value!=='string'||!valid(value)))
  throw fail('Selección de filtros inválida');
 return [...new Set(values)];
}
async function seriesRows(user,type,body){
 const {filters,params}=inventoryScope(user,type,{bySeries:true});
 const {section,series,from,to}=body??{};
 if(typeof section!=='string'||!section.trim()||section.length>100||
    typeof series!=='string'||!series.trim()||series.length>100)throw fail('Selecciona una sección y una serie documental');
 if((from!==''&&!validDate(from))||(to!==''&&!validDate(to))||(from&&to&&from>to))
  throw fail('El intervalo de fechas no es válido');
 filters.push('sc.codigo=?','sr.codigo=?');
 params.push(section,series);
 if(from){filters.push('e.apertura>=?');params.push(from);}
 if(to){filters.push('e.apertura<=?');params.push(to);}
 const areas=filterValues(body.areas,value=>value.length>0&&value.length<=100);
 const users=filterValues(body.users,value=>/^[1-9]\d{0,19}$/.test(value));
 for(const [column,values] of [['a.codigo',areas],['e.creado_por',users]]){
  if(values.length){
   filters.push(column+' IN ('+values.map(()=>'?').join(',')+')');
   params.push(...values);
  }
 }
 const where='WHERE '+filters.join(' AND ');
 const [[count]]=await pool.execute('SELECT COUNT(*) AS n '+seriesJoins+' '+where,params);
 if(Number(count.n)>limitRows)throw fail('Exportación demasiado grande; reduce los filtros',413);
 const records=await readRecords(pool,where,params);
 return records.sort((a,b)=>(a.openDate||'').localeCompare(b.openDate||'')||a.id.localeCompare(b.id,'es',{numeric:true}));
}

exportsRouter.get('/:type/series/opciones',async(req,res,next)=>{
 try{
  const {filters,params}=inventoryScope(req.auth.user,seriesType(req.params.type),{bySeries:true});
  const [rows]=await pool.execute(`SELECT DISTINCT sc.codigo AS section,sc.nombre AS sectionName,
   sr.codigo AS series,sr.nombre AS seriesName,a.codigo AS areaId,a.nombre AS areaName,
   CAST(e.creado_por AS CHAR) AS userId,CONCAT_WS(' ',u.nombres,u.apellido_paterno,u.apellido_materno) AS userName
   ${seriesJoins} LEFT JOIN usuarios u ON u.id=e.creado_por
   WHERE ${filters.join(' AND ')} ORDER BY sc.codigo,sr.codigo,a.nombre,userName`,params);
  const series=new Map(),areas=new Map(),users=new Map();
  for(const row of rows){
   series.set(JSON.stringify([row.section,row.series]),{
    section:row.section,sectionName:row.sectionName,code:row.series,name:row.seriesName
   });
   areas.set(row.areaId,{id:row.areaId,name:row.areaName});
   if(row.userId)users.set(JSON.stringify([row.userId,row.areaId]),{
    id:row.userId,name:row.userName||'Usuario '+row.userId,areaId:row.areaId
   });
  }
  res.set('Cache-Control','private, no-store');
  res.json({series:[...series.values()],areas:[...areas.values()],users:[...users.values()]});
 }catch(error){next(error);}
});
exportsRouter.post('/:type/series/vista-previa',async(req,res,next)=>{
 try{
  const records=await seriesRows(req.auth.user,seriesType(req.params.type),req.body);
  res.set('Cache-Control','private, no-store');
  res.json({header:seriesInventoryHeader(records),records});
 }catch(error){next(error);}
});
exportsRouter.post('/:type/series.xlsx',async(req,res,next)=>{
 try{
  const type=seriesType(req.params.type);
  const records=await seriesRows(req.auth.user,type,req.body);
  if(!records.length)throw fail('No hay expedientes que coincidan con los filtros',404);
  const header=seriesInventoryHeader(records);
  const includePhysicalLocation=type==='concentracion'&&req.body.includePhysicalLocation===true;
  const book=type==='tramite'
   ? await makeOfficialTemplateWorkbook(records,type,undefined,header)
   : makeConcentrationInventoryWorkbook(records,header,{includePhysicalLocation});
  const code=req.body.series.replace(/[^a-zA-Z0-9._-]/g,'_');
  await sendXlsx(book,res,`inventario_${type}_${code}.xlsx`,req.auth.user.id,{
   type,section:req.body.section,series:req.body.series,recordCount:records.length,includePhysicalLocation
  });
 }catch(error){next(error);}
});

const documentaryRow=r=>({
 id:r.id,recordNumber:r.recordNumber,title:r.title,openDate:r.openDate,
 areaId:r.areaId,cadidoCode:r.cadidoCode,archiveClassificationCode:r.archiveClassificationCode,
 sectionCode:r.cadidoSectionId,section:r.cadidoSectionName,series:r.cadidoSeriesName,stage:r.stage,
});

// Consultas y selecciones personalizadas: sin cambios de etapa ni operaciones de transferencia.
// En cada ruta se valida el alcance del usuario antes de filtrar identificadores.
exportsRouter.post('/transferencia/opciones',async(req,res,next)=>{
 try{
  const records=await selectPrimaryRecords(pool,req.auth.user,{
   ...req.body,recordIds:[],
  });
  const creatorIds=[...new Set(records.map(r=>Number(r.createdBy)).filter(Number.isSafeInteger))];
  const [creatorRows]=creatorIds.length?await pool.query(
   `SELECT id,CONCAT_WS(' ',nombres,apellido_paterno,NULLIF(apellido_materno,'')) AS name
    FROM usuarios WHERE id IN (${creatorIds.map(()=>'?').join(',')})`,creatorIds):[[]];
  res.set('Cache-Control','private, no-store');
  res.json({total:records.length,creators:creatorRows.map(x=>({id:String(x.id),name:x.name})),records:records.map(documentaryRow)});
 }catch(e){next(e);}
});
exportsRouter.post('/transferencia/vista-previa',async(req,res,next)=>{
 try{
  const records=await selectPrimaryRecords(pool,req.auth.user,req.body,true);
  const seriesCount=new Set(records.map(r=>JSON.stringify([r.cadidoSectionId,r.cadidoCode]))).size;
  const areas=[...new Set(records.map(r=>r.areaId))];
  res.set('Cache-Control','private, no-store');
  res.json({
   total:records.length,
   seriesCount,
   areas:areas.length,
   records:sortDocumentaryReportRecords(records).slice(0,250).map(documentaryRow),
   truncated:records.length>250,
  });
 }catch(e){next(e);}
});
exportsRouter.post('/transferencia/seleccion.xlsx',async(req,res,next)=>{
 try{
  const records=await selectPrimaryRecords(pool,req.auth.user,req.body,true);
  if(!records.length)throw fail('No hay expedientes que coincidan con la selección',404);
  await sendXlsx(await workbookFor(records,'transferencia'),res,
   'concentrado_documental_seleccionado.xlsx',req.auth.user.id,
   {type:'transferencia',mode:'seleccion-personalizada',
    recordCount:records.length,period:req.body?.period||'all'});
 }catch(e){next(e);}
});
exportsRouter.get('/transferencia.xlsx',async(req,res,next)=>{
 try{
  const records=await scopedRows(req.auth.user,'transferencia');
  await sendXlsx(await workbookFor(records,'transferencia'),res,'concentrado_documental.xlsx',req.auth.user.id,{type:'transferencia'});
 }catch(e){next(e);}
});
exportsRouter.get('/:type/:folio.xlsx',async(req,res,next)=>{
 try{
  const type=oneType(req.params.type);
  if(type==='transferencia'){
   const folio=String(req.params.folio||'');
   if(!/^[a-zA-Z0-9_-]{1,65}$/.test(folio))throw fail('Folio inválido');
   const records=await scopedRows(req.auth.user,'transferencia',folio);
   if(!records.length)throw fail('Inventario no encontrado o no elegible',404);
   return await sendXlsx(await workbookFor(records,'transferencia'),res,`concentrado_documental_${folio}.xlsx`,req.auth.user.id,{type:'transferencia',folio});
  }
  const folio=String(req.params.folio||'');
  if(!/^[a-zA-Z0-9_-]{1,65}$/.test(folio))throw fail('Folio inválido');
  const records=await scopedRows(req.auth.user,type,folio);
  if(!records.length)throw fail('Inventario no encontrado o fuera de tu alcance',404);
  await sendXlsx(await workbookFor(records,type),res,
   `inventario_${type}_${folio}.xlsx`,req.auth.user.id,{type,folio});
 }catch(e){next(e);}
});
exportsRouter.get('/:type.xlsx',async(req,res,next)=>{
 try{
  const type=oneType(req.params.type);
  if(type==='transferencia')throw fail('Utiliza /transferencia.xlsx');
  const records=await scopedRows(req.auth.user,type);
  await sendXlsx(await workbookFor(records,type),res,`inventarios_${type}.xlsx`,req.auth.user.id,{type});
 }catch(e){next(e);}
});
