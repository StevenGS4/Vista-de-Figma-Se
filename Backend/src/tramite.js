import express from 'express';
import { randomUUID } from 'node:crypto';
import { pool } from './config/database.js';
import { requireAuth } from './auth.js';
import { inventoryScope,hasInventoryAccess,hasCommonHeader,validSupport } from './inventory-policy.js';
import { roleNames } from './auth-policy.js';
import { allocateNumbers } from './archive-numbering.js';

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
 WHERE i.folio=? AND i.deleted_at IS NULL${locked?' FOR UPDATE':''}`,[folio]);
 return rows[0]||null;
}
export async function readRecords(conn,where='',params=[],includeDeleted=false){
 const [rows]=await conn.execute(`SELECT
 i.folio AS inventoryId,DATE_FORMAT(i.fecha_elaboracion,'%Y-%m-%d') AS inventoryDate,
 i.responsable_cargo AS responsiblePosition,i.hoja_inicial AS initialSheetNumber,
 i.unidad_administrativa AS administrativeUnit,a.codigo AS areaId,a.nombre AS areaName,i.responsable_nombre AS responsible,
 i.fondo AS fund,CAST(e.consecutivo AS CHAR) AS consecutive,e.id AS dbId,
 e.numero_expediente AS recordNumber,e.codigo_clasificacion AS archiveClassificationCode,e.numero_caja AS boxNumber,e.titulo_asunto AS title,
 e.descripcion AS description,e.domicilio_resguardo AS archiveAddress,e.observaciones AS observations,
 sc.codigo AS cadidoSectionId,sc.nombre AS cadidoSectionName,sr.id AS dbSeriesId,sr.codigo AS cadidoCode,sr.nombre AS cadidoSeriesName,
 cv.anio AS cadidoYear,
 DATE_FORMAT(e.apertura,'%Y-%m-%d') AS openDate,DATE_FORMAT(e.cierre,'%Y-%m-%d') AS closeDate,
 CAST(e.legajos AS CHAR) AS filesCount,CAST(e.folios AS CHAR) AS foliosCount,
 e.soporte AS supportType,CAST(e.anios_tramite AS CHAR) AS currentValidity,
 CAST(e.anios_concentracion AS CHAR) AS concentrationValidity,
 CAST(e.anios_total AS CHAR) AS totalValidity,e.lugar_resguardo AS room,
 e.estante AS shelf,e.nivel AS level,e.seccion_fisica AS physicalSection,
 e.posicion AS position,e.caja_ubicacion AS locationBox,e.notas_ubicacion AS locationNotes,
 e.etapa AS stage,e.disponibilidad AS availability,CAST(e.creado_por AS CHAR) AS createdBy,
 t.folio AS transferReference,DATE_FORMAT(t.enviada_en,'%Y-%m-%d') AS transferDate,
 DATE_FORMAT(t.aceptada_en,'%Y-%m-%d') AS transferAcceptedDate,
 DATE_FORMAT(i.deleted_at,'%Y-%m-%d %H:%i:%s') AS inventoryDeletedAt,
 DATE_FORMAT(e.deleted_at,'%Y-%m-%d %H:%i:%s') AS recordDeletedAt,
 i.deleted_by AS inventoryDeletedBy,e.deleted_by AS recordDeletedBy
 FROM inventarios i
 JOIN areas a ON a.id=i.area_id
 JOIN expedientes e ON e.inventario_id=i.id
 JOIN secciones_cadido sc ON sc.id=i.seccion_id
 JOIN series_cadido sr ON sr.id=e.serie_id
 LEFT JOIN catalogos_cadido_versiones cv ON cv.id=sr.catalogo_version_id
 -- Elegir una sola transferencia por inventario. Un JOIN directo con
 -- transferencia_inventarios multiplica los expedientes si hay historial.
 LEFT JOIN transferencias t ON t.id=(
   SELECT ti_hist.transferencia_id
   FROM transferencia_inventarios ti_hist
   JOIN transferencias t_hist ON t_hist.id=ti_hist.transferencia_id
   WHERE ti_hist.inventario_id=i.id
   ORDER BY
     CASE WHEN e.etapa='CONCENTRACION' AND t_hist.estado='ACEPTADA' THEN 0 ELSE 1 END,
     ti_hist.transferencia_id DESC
   LIMIT 1
 )
 ${where ? where+' AND ' : 'WHERE '}${includeDeleted ? '1=1' : 'i.deleted_at IS NULL AND e.deleted_at IS NULL'} ORDER BY i.fecha_elaboracion DESC,i.id DESC,e.consecutivo ASC`,params);
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
 administrativeUnit:r.administrativeUnit,areaId:r.areaId,areaName:r.areaName,responsible:r.responsible,fund:r.fund,
 consecutive:r.consecutive,cadidoYear:r.cadidoYear?String(r.cadidoYear):'',recordNumber:r.recordNumber,
 archiveClassificationCode:r.archiveClassificationCode||'',boxNumber:r.boxNumber||'',title:r.title,
 description:r.description||'',archiveAddress:r.archiveAddress||'',observations:r.observations||'',
 cadidoSectionId:r.cadidoSectionId,cadidoSectionName:r.cadidoSectionName,cadidoSeriesId:seriesId(r.dbSeriesId),cadidoCode:r.cadidoCode,cadidoSeriesName:r.cadidoSeriesName,
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
 inventoryDeletedAt:r.inventoryDeletedAt||'',recordDeletedAt:r.recordDeletedAt||'',
 inventoryDeletedBy:r.inventoryDeletedBy?String(r.inventoryDeletedBy):'',recordDeletedBy:r.recordDeletedBy?String(r.recordDeletedBy):'',
 }));
}
async function audit(conn,userId,entity,id,action,detail){
 await conn.execute('INSERT INTO auditoria(actor_id,entidad,entidad_id,accion,detalle) VALUES (?,?,?,?,?)',
  [userId,entity,id,action,detail]);
}
async function ensureNoHistory(conn,ids){
 if(!ids.length)return;
 for(let n=0;n<ids.length;n+=400){
  const slice=ids.slice(n,n+400),marks=slice.map(()=>'?').join(',');
  const [loans]=await conn.query('SELECT 1 FROM prestamo_expedientes WHERE expediente_id IN ('+marks+') LIMIT 1',slice);
  if(loans.length)throw fail('No se puede eliminar: existen préstamos históricos vinculados',409);
 }
}
async function safeInventory(conn,folio,user,mode,includeDeleted=false){
 const [rows]=await conn.execute(`SELECT i.id,i.folio,i.area_id,i.creado_por,i.estado,i.deleted_at,
  a.codigo AS area_code FROM inventarios i JOIN areas a ON a.id=i.area_id
  WHERE i.folio=? ${includeDeleted?'':'AND i.deleted_at IS NULL'} FOR UPDATE`,[folio]);
 const inv=rows[0];if(!inv)throw fail('Inventario no encontrado',404);
 if(!hasInventoryAccess(user,mode,inv))throw fail('Inventario fuera de tu alcance',403);
 if(inv.estado!=='TRAMITE')throw fail('No se puede eliminar un inventario transferido a concentración',409);
 const [linked]=await conn.execute('SELECT 1 FROM transferencia_inventarios WHERE inventario_id=? LIMIT 1',[inv.id]);
 if(linked.length)throw fail('El inventario tiene historial de transferencia',409);
 return inv;
}
const allowTrash=(user)=>access(user);
async function latestCadidoYear(conn){
 const [[row]]=await conn.execute(`SELECT MAX(cv.anio) AS year FROM catalogos_cadido_versiones cv
 JOIN series_cadido sr ON sr.catalogo_version_id=cv.id
 WHERE cv.activo=1 AND sr.activo=1 AND sr.es_demostracion=0`);
 return Number(row.year)||null;
}
async function catalog(conn,user,mode){
 const latest=await latestCadidoYear(conn);
 const [sections]=await conn.execute('SELECT codigo AS id,nombre AS name FROM secciones_cadido ORDER BY codigo');
 const [series]=await conn.execute(`SELECT sr.id,sr.nombre,sr.codigo,cv.anio AS editionYear,sc.codigo AS sectionCode,
 GROUP_CONCAT(DISTINCT a.codigo ORDER BY a.codigo SEPARATOR ',') AS enabled
 FROM series_cadido sr JOIN secciones_cadido sc ON sc.id=sr.seccion_id
 JOIN catalogos_cadido_versiones cv ON cv.id=sr.catalogo_version_id
 JOIN series_areas sa ON sa.serie_id=sr.id JOIN areas a ON a.id=sa.area_id
 WHERE sr.activo=1 AND sr.es_demostracion=0 AND sr.catalogo_version_id IS NOT NULL AND sa.habilitado=1 GROUP BY sr.id,sr.nombre,sr.codigo,cv.anio,sc.codigo ORDER BY cv.anio DESC,sr.codigo`);
 return {sections:sections.map(s=>({...s,description:'Sección de catálogo'})),currentYear:latest,
  series:series.filter(s=>mode==='GLOBAL'||(Number(s.editionYear)===latest && s.enabled.split(',').includes(user.areaId)))
    .map(s=>({id:seriesId(s.id),sectionId:s.sectionCode,name:s.nombre,code:s.codigo,
      detail:'Clasificación de catálogo '+s.editionYear,year:String(s.editionYear),enabledAreaIds:s.enabled.split(',')}))};
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
   if(!number||!text(r.title))throw fail('Número de expediente y asunto son obligatorios');
   if(unique.has(consecutivo)||numbers.has(number))throw fail('Número de expediente o consecutivo duplicado');
   unique.add(consecutivo);numbers.add(number);
   const open=date(r.openDate,true),close=date(r.closeDate,true);
   if(close<open)throw fail('Cierre anterior a apertura');
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
async function resolveCatalog(conn,header,user,mode,allowDisabled=false){
 const [areas]=await conn.execute('SELECT id,codigo FROM areas WHERE codigo=? AND activo=1',[header.areaId]);
 if(!areas.length)throw fail('Área no registrada en MySQL; carga primero el catálogo');
 if(mode!=='GLOBAL'&&header.areaId!==user.areaId)throw fail('No puedes registrar inventarios de otra área',403);
 const id=Number(String(header.cadidoSeriesId).replace(/^SER-/,'')); 
 if(!Number.isSafeInteger(id))throw fail('Serie CADIDO inexistente');
 const [series]=await conn.execute(`SELECT sr.id,sr.seccion_id,sc.codigo AS seccion_code,cv.anio AS edition_year FROM series_cadido sr
 JOIN secciones_cadido sc ON sc.id=sr.seccion_id
 JOIN catalogos_cadido_versiones cv ON cv.id=sr.catalogo_version_id
 JOIN series_areas sa ON sa.serie_id=sr.id
 WHERE sr.id=? AND sc.codigo=? AND sa.area_id=? AND (sa.habilitado=1 OR ?=1)
 AND sr.es_demostracion=0 AND sr.activo=1`,
 [id,header.cadidoSectionId,areas[0].id,allowDisabled?1:0]);
 if(!series.length)throw fail('Serie CADIDO no autorizada para esta área');
 return {areaId:areas[0].id,serieId:series[0].id,seccionId:series[0].seccion_id,editionYear:series[0].edition_year};
}
function rowFields(r,inventoryId,serieId,userId){
 return {
  inventario_id:inventoryId,consecutivo:num(r.consecutive,'consecutivo',1,2147483647),
  numero_caja:text(r.boxNumber,60)||null,numero_expediente:text(r.recordNumber,110),
  codigo_clasificacion:text(r.archiveClassificationCode,110)||null,
  serie_id:serieId,titulo_asunto:text(r.title,350),descripcion:text(r.description,50000)||null,
  apertura:date(r.openDate,true),cierre:date(r.closeDate,true),legajos:num(r.filesCount,'legajos',0,2147483647),
  folios:num(r.foliosCount,'folios',0,2147483647),
  soporte:{'Físico':'FISICO','Electrónico':'ELECTRONICO','Mixto':'MIXTO'}[r.supportType],
  anios_tramite:num(r.currentValidity,'vigencia trámite'),
  anios_concentracion:num(r.concentrationValidity,'vigencia concentración'),
  domicilio_resguardo:text(r.archiveAddress,350)||null,
  observaciones:text(r.observations,50000)||null,
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
const archiveAddress='Avenida Allende No. 110 Oriente, Colonia Centro, C.P. 63000, Tepic, Nayarit';
async function nextNumbers(conn,serieId,serieCode,rows){
 // El bloqueo de la serie se mantiene hasta COMMIT para serializar altas concurrentes.
 await conn.execute('SELECT id FROM series_cadido WHERE id=? FOR UPDATE',[serieId]);
 const [existing]=await conn.execute('SELECT COALESCE(codigo_clasificacion,CASE WHEN numero_expediente LIKE \'SEMARNAT.%\' THEN numero_expediente ELSE NULL END) AS archival_code FROM expedientes WHERE serie_id=?',[serieId]);
 let assigned;
 try{assigned=allocateNumbers(existing.map(r=>r.archival_code).filter(Boolean),rows,serieCode);}
 catch(e){throw fail(e.message);}
 rows.forEach((r,i)=>{if(assigned[i])r.archiveClassificationCode=assigned[i];});
}
async function save(req,res,next,editing=false){
 let conn;
 try{
  const user=req.auth.user,mode=access(user);
  const isAdmin=user.roles.includes(roleNames.ADMIN);
  const rows=Array.isArray(req.body?.rows)?req.body.rows.map(r=>({...r})):[];
  if(!rows.length)throw fail('Agrega al menos un expediente');
  if(!isAdmin){
   const requestedArea=user.areaId;
   const [areaRows]=await pool.execute(`SELECT a.nombre,a.codigo,
     CONCAT_WS(' ',u.nombres,u.apellido_paterno,u.apellido_materno) AS encargado
     FROM areas a LEFT JOIN usuarios u ON u.id=a.encargado_usuario_id AND u.estado='ACTIVO'
     WHERE a.codigo=? AND a.activo=1`,[requestedArea]);
   if(!areaRows.length)throw fail('El área asignada no está habilitada',403);
   if(!areaRows[0].encargado)throw fail('El administrador debe asignar un encargado al área antes de crear inventarios',409);
   const today=new Date().toLocaleDateString('sv-SE',{timeZone:'America/Mazatlan'});
   for(const r of rows){
    r.areaId=requestedArea;
    r.administrativeUnit='Oficina de Representación de SEMARNAT en Nayarit';
    r.responsible=areaRows[0].encargado;
    r.responsiblePosition='Encargado del área de '+areaRows[0].nombre;
    r.fund='Secretaría de Medio Ambiente y Recursos Naturales';
    if(r.boxNumber && !/^\d{1,6}$/.test(String(r.boxNumber)))throw fail('El número de caja debe tener de 1 a 6 dígitos');
    r.room=String(r.room||'').trim()||'Sótano';
    r.initialSheetNumber='1';
    r.archiveAddress=archiveAddress;
    if(!editing)r.inventoryDate=today;
   }
  }
  const header=normalize(rows);
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
   const cat=await resolveCatalog(conn,header,user,mode,true);
   if(inv.serie_id!==cat.serieId||inv.seccion_id!==cat.seccionId||inv.area_id!==cat.areaId)
     throw fail('No se puede cambiar la clasificación común de un inventario existente; crea otro inventario',409);
   inventoryId=inv.id;folio=inv.folio;
   if(!isAdmin){
    const [[oldHeader]]=await conn.execute("SELECT DATE_FORMAT(fecha_elaboracion,'%Y-%m-%d') AS originalDate FROM inventarios WHERE id=?",[inv.id]);
    header.inventoryDate=oldHeader.originalDate;
    for(const row of rows)row.inventoryDate=oldHeader.originalDate;
   }
   await conn.execute(`UPDATE inventarios SET unidad_administrativa=?,responsable_nombre=?,responsable_cargo=?,
    fondo=?,fecha_elaboracion=?,hoja_inicial=? WHERE id=?`,
    [text(header.administrativeUnit,220),text(header.responsible,200),text(header.responsiblePosition,200),
     text(header.fund,160),date(header.inventoryDate,true),num(header.initialSheetNumber||1,'hoja',1,65535),inventoryId]);
   const [oldRows]=await conn.execute('SELECT id,consecutivo FROM expedientes WHERE inventario_id=? AND deleted_at IS NULL FOR UPDATE',[inventoryId]);
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
     await ensureNoHistory(conn,[id]);
     await conn.execute('UPDATE expedientes SET deleted_at=NOW(),deleted_by=? WHERE id=? AND inventario_id=? AND deleted_at IS NULL',[user.id,id,inventoryId]);
     await audit(conn,user.id,'expedientes',id,'MOVER_PAPELERA',JSON.stringify({folio,via:'EDICION'}));
   }
  }else{
   const cat=await resolveCatalog(conn,header,user,mode);
   if(!isAdmin && cat.editionYear!==await latestCadidoYear(conn))
    throw fail('Solo puedes registrar con la edición CADIDO vigente. Solicita al administrador habilitar códigos actuales.',409);
   if(!isAdmin)await conn.execute('SELECT id FROM series_cadido WHERE id=? FOR UPDATE',[cat.serieId]);
   const folioGenerated='INV-TR-'+new Date().toISOString().slice(0,10).replace(/-/g,'')+'-'+randomUUID().slice(0,10).toUpperCase();
   const entry={folio:folioGenerated,unidad_administrativa:text(header.administrativeUnit,220),
     area_id:cat.areaId,responsable_nombre:text(header.responsible,200),responsable_cargo:text(header.responsiblePosition,200),
     fondo:text(header.fund,160),seccion_id:cat.seccionId,serie_id:cat.serieId,
     fecha_elaboracion:date(header.inventoryDate,true),hoja_inicial:num(header.initialSheetNumber||1,'hoja',1,65535),
     creado_por:user.id};
   const insert=insertSql('inventarios',entry),[result]=await conn.execute(insert.sql,insert.vals);
   inventoryId=result.insertId;folio=folioGenerated;
  }
  const cat=await resolveCatalog(conn,header,user,mode,editing);
  if(!isAdmin && rows.some(r=>!/^REG-\d+$/.test(r.id)) &&
     cat.editionYear!==await latestCadidoYear(conn))
    throw fail('No puedes agregar expedientes nuevos con una edición CADIDO histórica. Crea un inventario con la edición vigente.',409);
  if(!isAdmin){
   const [assigned]=await conn.execute('SELECT consecutivo FROM expedientes WHERE inventario_id=?',[inventoryId]);
   const reserved=new Set(assigned.map(x=>Number(x.consecutivo)));
   let next=0;
   for(const r of rows){
    if(editing && /^REG-\d+$/.test(r.id)){
     const [[old]]=await conn.execute('SELECT consecutivo FROM expedientes WHERE id=? AND inventario_id=?',[Number(r.id.slice(4)),inventoryId]);
     if(!old)throw fail('Expediente existente no encontrado',404);
     r.consecutive=String(old.consecutivo);
    }else{
     while(reserved.has(++next)){}
     reserved.add(next);r.consecutive=String(next);
    }
   }
  }
  // El número de expediente lo captura el usuario. La clave CADIDO se
  // asigna aparte por serie/año y es independiente de ese número.
  const [[serie]]=await conn.execute('SELECT codigo FROM series_cadido WHERE id=?',[cat.serieId]);
  if(!serie)throw fail('La serie seleccionada no existe');
  await nextNumbers(conn,cat.serieId,serie.codigo,rows);
  if(editing){
   for(const r of rows){
    if(!/^REG-\d+$/.test(String(r.id)))continue;
    const [[old]]=await conn.execute(
      'SELECT codigo_clasificacion FROM expedientes WHERE id=? AND inventario_id=?',
      [Number(r.id.slice(4)),inventoryId]
    );
    if(!old)throw fail('Expediente existente no encontrado',404);
    // No admitir cambios de la clave histórica desde el navegador.
    r.archiveClassificationCode=old.codigo_clasificacion||'';
   }
  }
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
 try {
  const user=req.auth.user;
  const mode=user.roles.includes(roleNames.PRESTAMOS) && !user.mustChangePassword?'GLOBAL':access(user);
  res.json(await catalog(pool,user,mode));
 }catch(e){next(e);}
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

tramiteRouter.get('/papelera',async(req,res,next)=>{
 try{
  const user=req.auth.user,mode=allowTrash(user);
  const clause=mode==='GLOBAL'?'':mode==='AREA'?'AND a.codigo=?':'AND a.codigo=? AND i.creado_por=?';
  const params=mode==='GLOBAL'?[]:mode==='AREA'?[user.areaId]:[user.areaId,user.id];
  const where='WHERE (i.deleted_at IS NOT NULL OR e.deleted_at IS NOT NULL) '+clause;
  const records=await readRecords(pool,where,params,true);
  res.set('Cache-Control','private, no-store');
  res.json({records:records.filter(r=>Boolean(r.inventoryDeletedAt||r.recordDeletedAt))});
 }catch(e){next(e);}
});
tramiteRouter.delete('/inventarios/:folio',async(req,res,next)=>{
 let conn;
 try{
  const user=req.auth.user,mode=allowTrash(user);
  conn=await pool.getConnection();await conn.beginTransaction();
  const inv=await safeInventory(conn,req.params.folio,user,mode);
  const [ids]=await conn.execute('SELECT id FROM expedientes WHERE inventario_id=? FOR UPDATE',[inv.id]);
  await ensureNoHistory(conn,ids.map(x=>x.id));
  await conn.execute('UPDATE inventarios SET deleted_at=NOW(),deleted_by=? WHERE id=? AND deleted_at IS NULL',[user.id,inv.id]);
  await audit(conn,user.id,'inventarios',inv.id,'MOVER_PAPELERA',JSON.stringify({folio:inv.folio,expedientes:ids.length}));
  await conn.commit();res.json({ok:true});
 }catch(e){if(conn)await conn.rollback();next(e);}finally{conn?.release();}
});
async function recycleSelectedRecords(req,res,next,onlyOne=false){
 let conn;
 try{
  const user=req.auth.user,mode=allowTrash(user);
  const requested=onlyOne?[req.params.id]:req.body?.recordIds;
  if(!Array.isArray(requested)||!requested.length||requested.length>5000)
    throw fail('Selecciona al menos un expediente válido',400);
  if(requested.some(id=>typeof id!=='string'||!/^REG-[1-9]\d*$/.test(id)))
    throw fail('Identificador de expediente inválido',400);
  const ids=[...new Set(requested.map(id=>Number(id.slice(4))))];
  if(ids.length!==requested.length)throw fail('Hay expedientes repetidos en la selección',400);
  conn=await pool.getConnection();await conn.beginTransaction();
  const inv=await safeInventory(conn,req.params.folio,user,mode);
  const [existing]=await conn.execute('SELECT id FROM expedientes WHERE inventario_id=? AND deleted_at IS NULL FOR UPDATE',[inv.id]);
  const allIds=new Set(existing.map(r=>Number(r.id)));
  if(ids.some(id=>!allIds.has(id)))throw fail('Uno o varios expedientes no pertenecen al archivo activo',409);
  await ensureNoHistory(conn,ids);
  const movingWhole=ids.length===allIds.size;
  if(movingWhole) {
    // El inventario completo queda en papelera sin dejar una cabecera vacía.
    await conn.execute('UPDATE inventarios SET deleted_at=NOW(),deleted_by=? WHERE id=? AND deleted_at IS NULL',[user.id,inv.id]);
    await audit(conn,user.id,'inventarios',inv.id,'MOVER_PAPELERA',JSON.stringify({folio:inv.folio,razon:'ULTIMOS_EXPEDIENTES',expedientes:ids.length}));
  }else{
    for(const id of ids){
      await conn.execute('UPDATE expedientes SET deleted_at=NOW(),deleted_by=? WHERE id=? AND inventario_id=? AND deleted_at IS NULL',[user.id,id,inv.id]);
      await audit(conn,user.id,'expedientes',id,'MOVER_PAPELERA',JSON.stringify({folio:inv.folio}));
    }
  }
  await conn.commit();
  res.json({ok:true,inventoryDeleted:movingWhole,removed:ids.length});
 }catch(e){if(conn)await conn.rollback();next(e);}finally{conn?.release();}
}
tramiteRouter.delete('/inventarios/:folio/expedientes', (req,res,next)=>
 recycleSelectedRecords(req,res,next));
tramiteRouter.delete('/inventarios/:folio/expedientes/:id',(req,res,next)=>
 recycleSelectedRecords(req,res,next,true));
tramiteRouter.post('/papelera/inventarios/:folio/restaurar',async(req,res,next)=>{
 let conn;
 try{
  const user=req.auth.user,mode=allowTrash(user);
  conn=await pool.getConnection();await conn.beginTransaction();
  const inv=await safeInventory(conn,req.params.folio,user,mode,true);
  if(!inv.deleted_at)throw fail('El inventario no está en la papelera',409);
  const [[expiry]]=await conn.execute('SELECT deleted_at > DATE_SUB(NOW(), INTERVAL 60 DAY) AS restorable FROM inventarios WHERE id=?',[inv.id]);
  if(!Number(expiry.restorable))throw fail('Este inventario cumplió sus 60 días de recuperación y no puede restaurarse',409);
  await conn.execute('UPDATE inventarios SET deleted_at=NULL,deleted_by=NULL WHERE id=?',[inv.id]);
  await audit(conn,user.id,'inventarios',inv.id,'RESTAURAR',JSON.stringify({folio:inv.folio}));
  await conn.commit();res.json({ok:true});
 }catch(e){if(conn)await conn.rollback();next(e);}finally{conn?.release();}
});
tramiteRouter.post('/papelera/expedientes/:id/restaurar',async(req,res,next)=>{
 let conn;
 try{
  const user=req.auth.user,mode=allowTrash(user);
  if(!/^REG-[1-9]\d*$/.test(req.params.id))throw fail('Expediente inválido');
  const id=Number(req.params.id.slice(4));
  conn=await pool.getConnection();await conn.beginTransaction();
  const [rows]=await conn.execute(`SELECT e.id,e.deleted_at,i.folio,i.id AS invId,i.deleted_at AS inventory_deleted
    FROM expedientes e JOIN inventarios i ON i.id=e.inventario_id WHERE e.id=? FOR UPDATE`,[id]);
  if(!rows.length||!rows[0].deleted_at)throw fail('El expediente no está en la papelera',404);
  const [[expiry]]=await conn.execute('SELECT deleted_at > DATE_SUB(NOW(), INTERVAL 60 DAY) AS restorable FROM expedientes WHERE id=?',[id]);
  if(!Number(expiry.restorable))throw fail('Este expediente cumplió sus 60 días de recuperación y no puede restaurarse',409);
  const inv=await safeInventory(conn,rows[0].folio,user,mode,true);
  if(inv.deleted_at)throw fail('Restaura primero el inventario completo',409);
  await conn.execute('UPDATE expedientes SET deleted_at=NULL,deleted_by=NULL WHERE id=?',[id]);
  await audit(conn,user.id,'expedientes',id,'RESTAURAR',JSON.stringify({folio:inv.folio}));
  await conn.commit();res.json({ok:true});
 }catch(e){if(conn)await conn.rollback();next(e);}finally{conn?.release();}
});
tramiteRouter.delete('/papelera/inventarios/:folio',async(req,res,next)=>{
 let conn;
 try{
  const user=req.auth.user,mode=allowTrash(user);
  conn=await pool.getConnection();await conn.beginTransaction();
  const inv=await safeInventory(conn,req.params.folio,user,mode,true);
  if(!inv.deleted_at)throw fail('El inventario debe estar en papelera',409);
  const [rows]=await conn.execute('SELECT id FROM expedientes WHERE inventario_id=? FOR UPDATE',[inv.id]);
  await ensureNoHistory(conn,rows.map(x=>x.id));
  for(const row of rows)await conn.execute('DELETE FROM expediente_valores WHERE expediente_id=?',[row.id]);
  await conn.execute('DELETE FROM expedientes WHERE inventario_id=?',[inv.id]);
  await conn.execute('DELETE FROM inventarios WHERE id=?',[inv.id]);
  await audit(conn,user.id,'inventarios',inv.id,'ELIMINACION_DEFINITIVA',JSON.stringify({folio:inv.folio,expedientes:rows.length}));
  await conn.commit();res.json({ok:true});
 }catch(e){if(conn)await conn.rollback();next(e);}finally{conn?.release();}
});
tramiteRouter.delete('/papelera/expedientes/:id',async(req,res,next)=>{
 let conn;
 try{
  const user=req.auth.user,mode=allowTrash(user);
  if(!/^REG-[1-9]\d*$/.test(req.params.id))throw fail('Expediente inválido');
  const id=Number(req.params.id.slice(4));
  conn=await pool.getConnection();await conn.beginTransaction();
  const [rows]=await conn.execute(`SELECT e.deleted_at,i.folio FROM expedientes e
    JOIN inventarios i ON i.id=e.inventario_id WHERE e.id=? FOR UPDATE`,[id]);
  if(!rows.length||!rows[0].deleted_at)throw fail('El expediente no está en papelera',404);
  const inv=await safeInventory(conn,rows[0].folio,user,mode,true);
  if(inv.deleted_at)throw fail('Elimina el inventario completo desde la papelera',409);
  await ensureNoHistory(conn,[id]);
  await conn.execute('DELETE FROM expediente_valores WHERE expediente_id=?',[id]);
  await conn.execute('DELETE FROM expedientes WHERE id=?',[id]);
  await audit(conn,user.id,'expedientes',id,'ELIMINACION_DEFINITIVA',JSON.stringify({folio:inv.folio}));
  await conn.commit();res.json({ok:true});
 }catch(e){if(conn)await conn.rollback();next(e);}finally{conn?.release();}
});
tramiteRouter.delete('/papelera',async(req,res,next)=>{
 let conn;
 try{
  const user=req.auth.user,mode=allowTrash(user);
  conn=await pool.getConnection();await conn.beginTransaction();
  const area=mode==='GLOBAL'?'':mode==='AREA'?'AND a.codigo=?':'AND a.codigo=? AND i.creado_por=?';
  const args=mode==='GLOBAL'?[]:mode==='AREA'?[user.areaId]:[user.areaId,user.id];
  const [inventories]=await conn.execute(`SELECT i.folio FROM inventarios i JOIN areas a ON a.id=i.area_id WHERE i.deleted_at IS NOT NULL ${area} FOR UPDATE`,args);
  const [records]=await conn.execute(`SELECT e.id FROM expedientes e JOIN inventarios i ON i.id=e.inventario_id
    JOIN areas a ON a.id=i.area_id WHERE e.deleted_at IS NOT NULL AND i.deleted_at IS NULL ${area} FOR UPDATE`,args);
  // Se hace todo en una sola transacción: si hay historial, NO hay eliminación parcial.
  const [allInventoryRows]=inventories.length?await conn.query(`SELECT e.id FROM expedientes e JOIN inventarios i ON i.id=e.inventario_id
    WHERE i.folio IN (${inventories.map(()=>'?').join(',')})`,inventories.map(x=>x.folio)):[[]];
  const ids=[...allInventoryRows.map(x=>x.id),...records.map(x=>x.id)];
  await ensureNoHistory(conn,ids);
  for(const item of inventories){
    const [[linked]]=await conn.execute('SELECT COUNT(*) AS n FROM transferencia_inventarios ti JOIN inventarios i ON i.id=ti.inventario_id WHERE i.folio=?',[item.folio]);
    if(Number(linked.n))throw fail('La papelera contiene inventarios con transferencias: no se puede vaciar',409);
  }
  for(const id of ids){await conn.execute('DELETE FROM expediente_valores WHERE expediente_id=?',[id]);await conn.execute('DELETE FROM expedientes WHERE id=?',[id]);}
  for(const item of inventories)await conn.execute('DELETE FROM inventarios WHERE folio=?',[item.folio]);
  await audit(conn,user.id,'inventarios',0,'VACIAR_PAPELERA',JSON.stringify({inventarios:inventories.length,expedientes:ids.length}));
  await conn.commit();res.json({ok:true,inventarios:inventories.length,expedientes:ids.length});
 }catch(e){if(conn)await conn.rollback();next(e);}finally{conn?.release();}
});
