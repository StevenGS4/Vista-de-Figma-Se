import express from 'express';
import ExcelJS from 'exceljs';
import { pool } from './config/database.js';
import { requireAuth } from './auth.js';
import { readRecords } from './tramite.js';
import { exportTypes, exportScope, safeCell, stageForType } from './export-policy.js';

export const exportsRouter=express.Router();
exportsRouter.use(requireAuth);
const fail=(m,status=400)=>Object.assign(new Error(m),{status});
const oneType=(value)=>{
 if(!Object.hasOwn(exportTypes,value))throw fail('Tipo de inventario inválido');
 return value;
};
const border={bottom:{style:'thin',color:{argb:'FFD2D9D5'}}};
const GREEN='FF164B44',WINE='FF682541',LIGHT='FFEAF2EF';
const limitRows=15000;

function newSheet(book,name,columns){
 const sh=book.addWorksheet(name,{views:[{state:'frozen',ySplit:6}]});
 sh.addRow(['SEMARNAT — OFICINA DE REPRESENTACIÓN EN NAYARIT']);
 sh.addRow(['SISTEMA DE CONTROL ARCHIVÍSTICO · FORMATO ACADÉMICO NO OFICIAL']);
 sh.addRow(['GENERADO A PARTIR DE DATOS EN MYSQL']);
 sh.addRow([]);
 const header=sh.addRow(columns);
 header.eachCell(cell=>{
   cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:WINE}};
   cell.font={bold:true,color:{argb:'FFFFFFFF'}};
   cell.alignment={vertical:'middle',wrapText:true};
 });
 sh.getRow(1).font={bold:true,size:14,color:{argb:GREEN}};
 sh.getRow(2).font={bold:true,size:11,color:{argb:WINE}};
 sh.getRow(3).font={size:10,color:{argb:'FF485A55'}};
 sh.getRow(5).height=32;
 sh.autoFilter={from:{row:5,column:1},to:{row:5,column:columns.length}};
 return sh;
}
function finishSheet(sh,columnCount){
 for(let c=1;c<=columnCount;c++)sh.getColumn(c).width=c===1?20:(c===5?46:24);
 for(let r=6;r<=sh.rowCount;r++){
  const row=sh.getRow(r);
  row.height=24;
  row.eachCell(cell=>{
   cell.border=border;
   cell.alignment={vertical:'middle',wrapText:true};
   if(r%2===0)cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:LIGHT}};
  });
 }
 sh.pageSetup={orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,paperSize:9};
}
function put(sh,values){
 sh.addRow(values.map(value=>safeCell(value)));
}
function inventoryRows(records){
 const byInventory=new Map();
 for(const row of records){
  const group=byInventory.get(row.inventoryId)||[];
  group.push(row);byInventory.set(row.inventoryId,group);
 }
 return [...byInventory.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
}
export function makeInventoryWorkbook(records,type){
 const book=new ExcelJS.Workbook();
 book.creator='Sistema archivístico SEMARNAT — proyecto académico';
 book.created=new Date();
 book.properties={date1904:false};
 const columns=['Folio de inventario','Número de expediente','Consecutivo','Código CADIDO','Título o asunto',
 'Área generadora','Unidad administrativa','Responsable','Cargo responsable','Fondo documental',
 'Fecha de inventario','Fecha apertura','Fecha cierre','Caja','Legajos','Folios','Soporte',
 'Valores documentales','Vigencia trámite (años)','Vigencia concentración (años)','Vigencia total (años)',
 'Zona','Sala','Estante','Nivel','Sección física','Posición','Caja de ubicación',
 'Notas de ubicación','Observaciones','Disponibilidad','Transferencia','Fecha aceptación'];
 const sh=newSheet(book,type==='tramite'?'Archivo de trámite':'Archivo de concentración',columns);
 for(const rec of records){
  put(sh,[rec.inventoryId,rec.recordNumber,rec.consecutive,rec.cadidoCode,rec.title,
   rec.areaId,rec.administrativeUnit,rec.responsible,rec.responsiblePosition,rec.fund,
   rec.inventoryDate,rec.openDate,rec.closeDate,rec.boxNumber,rec.filesCount,
   rec.foliosCount,rec.supportType,rec.documentaryValues,rec.currentValidity,
   rec.concentrationValidity,rec.totalValidity,rec.archiveZone,rec.room,rec.shelf,
   rec.level,rec.physicalSection,rec.position,rec.locationBox,rec.locationNotes,
   rec.observations,rec.availability,rec.transferReference,rec.transferAcceptedDate]);
 }
 finishSheet(sh,columns.length);
 const summary=book.addWorksheet('Resumen');
 summary.addRow(['RESUMEN DE INVENTARIOS · FORMATO ACADÉMICO NO OFICIAL']);
 summary.getRow(1).font={bold:true,size:14,color:{argb:GREEN}};
 summary.addRow(['Folio de inventario','Área','Sección CADIDO','Serie CADIDO','Expedientes','Fecha de elaboración']);
 for(const [folio,rows] of inventoryRows(records)){
  const head=rows[0];
  put(summary,[folio,head.areaId,head.cadidoSectionId,head.cadidoCode,rows.length,head.inventoryDate]);
 }
 for(let i=1;i<=6;i++)summary.getColumn(i).width=i===1?30:23;
 summary.autoFilter={from:{row:2,column:1},to:{row:2,column:6}};
 return book;
}
export function makeTransferWorkbook(rows){
 const book=new ExcelJS.Workbook();
 book.creator='Sistema archivístico SEMARNAT — proyecto académico';
 const columns=['Folio inventario','Área generadora','Unidad administrativa','Responsable','Cargo',
 'Fondo','Sección CADIDO','Serie CADIDO','Fecha elaboración',
 'Total expedientes','Fecha inicial de apertura','Fecha final de apertura','Estado inventario'];
 const sh=newSheet(book,'Relación transferencia primaria',columns);
 for(const row of rows)put(sh,[
  row.folio,row.area_code,row.unidad_administrativa,row.responsable_nombre,
  row.responsable_cargo,row.fondo,row.seccion_codigo,row.serie_codigo,
  row.fecha_elaboracion,row.total_expedientes,row.apertura_inicial,row.apertura_final,row.estado,
 ]);
 finishSheet(sh,columns.length);
 sh.addRow([]);
 sh.addRow(['NOTA: este reporte no genera, autoriza ni ejecuta transferencias.']);
 return book;
}
async function scopedRows(user,type,folio){
 const scope=exportScope(user,type);
 if(!scope)throw fail('No tienes permiso para exportar este inventario',403);
 const filters=['e.etapa=?'];
 const params=[stageForType(type)];
 if(scope!=='GLOBAL'){filters.push('a.codigo=?');params.push(user.areaId);}
 if(scope==='PROPIO'){filters.push('i.creado_por=?');params.push(user.id);}
 if(folio){filters.push('i.folio=?');params.push(folio);}
 const [count]=await pool.execute(`SELECT COUNT(*) AS n
 FROM expedientes e JOIN inventarios i ON i.id=e.inventario_id
 JOIN areas a ON a.id=i.area_id WHERE ${filters.join(' AND ')}`,params);
 if(Number(count[0].n)>limitRows)throw fail('Exportación demasiado grande; reduce los filtros',413);
 return readRecords(pool,'WHERE '+filters.join(' AND '),params);
}
async function relationRows(user){
 const scope=exportScope(user,'transferencia');
 if(!scope)throw fail('No tienes permiso para exportar la relación de transferencia',403);
 const filters=["i.estado='TRAMITE'"];
 const params=[];
 if(scope!=='GLOBAL'){filters.push('a.codigo=?');params.push(user.areaId);}
 if(scope==='PROPIO'){filters.push('i.creado_por=?');params.push(user.id);}
 const [rows]=await pool.execute(`SELECT i.folio,a.codigo AS area_code,i.unidad_administrativa,
 i.responsable_nombre,i.responsable_cargo,i.fondo,sec.codigo AS seccion_codigo,
 ser.codigo AS serie_codigo,DATE_FORMAT(i.fecha_elaboracion,'%Y-%m-%d') AS fecha_elaboracion,
 COUNT(e.id) AS total_expedientes,
 DATE_FORMAT(MIN(e.apertura),'%Y-%m-%d') AS apertura_inicial,
 DATE_FORMAT(MAX(e.apertura),'%Y-%m-%d') AS apertura_final,
 i.estado
 FROM inventarios i JOIN areas a ON a.id=i.area_id
 JOIN secciones_cadido sec ON sec.id=i.seccion_id
 JOIN series_cadido ser ON ser.id=i.serie_id
 JOIN expedientes e ON e.inventario_id=i.id
 WHERE ${filters.join(' AND ')}
 GROUP BY i.id,i.folio,a.codigo,i.unidad_administrativa,i.responsable_nombre,
 i.responsable_cargo,i.fondo,sec.codigo,ser.codigo,i.fecha_elaboracion,i.estado
 ORDER BY a.codigo,i.folio LIMIT 15001`,params);
 if(rows.length>limitRows)throw fail('Demasiados inventarios; aplica filtros',413);
 return rows;
}
async function sendXlsx(book,res,filename){
 const bytes=await book.xlsx.writeBuffer();
 res.set('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
 res.set('Content-Disposition',`attachment; filename="${filename}"`);
 res.set('Cache-Control','private, no-store');
 res.send(Buffer.from(bytes));
}
exportsRouter.get('/transferencia.xlsx',async(req,res,next)=>{
 try{
  const rows=await relationRows(req.auth.user);
  await sendXlsx(makeTransferWorkbook(rows),res,'relacion_transferencia_primaria.xlsx');
 }catch(e){next(e);}
});
exportsRouter.get('/:type/:folio.xlsx',async(req,res,next)=>{
 try{
  const type=oneType(req.params.type);
  if(type==='transferencia')throw fail('Utiliza la relación consolidada /transferencia.xlsx');
  const folio=String(req.params.folio||'');
  if(!/^[a-zA-Z0-9_-]{1,65}$/.test(folio))throw fail('Folio inválido');
  const records=await scopedRows(req.auth.user,type,folio);
  if(!records.length)throw fail('Inventario no encontrado o fuera de tu alcance',404);
  await sendXlsx(makeInventoryWorkbook(records,type),res,
   `inventario_${type}_${folio}.xlsx`);
 }catch(e){next(e);}
});
exportsRouter.get('/:type.xlsx',async(req,res,next)=>{
 try{
  const type=oneType(req.params.type);
  if(type==='transferencia')throw fail('Utiliza /transferencia.xlsx');
  const records=await scopedRows(req.auth.user,type);
  await sendXlsx(makeInventoryWorkbook(records,type),res,`inventarios_${type}.xlsx`);
 }catch(e){next(e);}
});
