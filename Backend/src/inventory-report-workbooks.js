import ExcelJS from 'exceljs';
import { safeCell } from './export-policy.js';

const text = value => safeCell(value ?? '');
const date = value => /^\d{4}-\d{2}-\d{2}/.test(String(value))
 ? String(value).slice(0,10).split('-').reverse().join('/') : '';
const key = record => record.archiveClassificationCode || record.cadidoCode || '';
const subject = record => [record.title,record.description].filter(Boolean).join(' — ');
const cellRow = (sheet,values) => sheet.addRow(values.map(text));
const title = (sheet,label,lastColumn) => {
 sheet.mergeCells(1,1,1,lastColumn);
 sheet.mergeCells(2,1,2,lastColumn);
 sheet.getCell('A1').value='SECRETARÍA DE MEDIO AMBIENTE Y RECURSOS NATURALES';
 sheet.getCell('A2').value=label;
 for(const index of [1,2]){
  const row=sheet.getRow(index);
  row.height=24;
  row.getCell(1).font={bold:true,size:12};
  row.getCell(1).alignment={horizontal:'center',vertical:'middle'};
 }
};
const styleHeaders = (sheet,first,last) => {
 for(let index=first;index<=last;index++){
  const row=sheet.getRow(index);
  row.height=index===first?34:22;
  row.eachCell({includeEmpty:true},cell=>{
   cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF244F41'}};
   cell.font={bold:true,color:{argb:'FFFFFFFF'},size:10};
   cell.alignment={horizontal:'center',vertical:'middle',wrapText:true};
  });
 }
};
function setup(book,name,widths,headerRow){
 const sheet=book.addWorksheet(name);
 widths.forEach((width,index)=>{sheet.getColumn(index+1).width=width;});
 sheet.views=[{state:'frozen',ySplit:headerRow}];
 sheet.pageSetup={paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,
  fitToHeight:0,printTitlesRow:'1:'+headerRow};
 return sheet;
}
function details(row){
 row.eachCell({includeEmpty:true},cell=>{
  cell.alignment={vertical:'middle',wrapText:true};
  cell.border={bottom:{style:'thin',color:{argb:'FFD9E3DB'}}};
 });
}

export function makeConcentrationInventoryWorkbook(records){
 const book=new ExcelJS.Workbook();
 const groups=new Map();
 for(const record of records){
  const id=record.inventoryId;
  if(!groups.has(id))groups.set(id,[]);
  groups.get(id).push(record);
 }
 if(!groups.size)groups.set('',[]);
 let sheetIndex=0;
 for(const [folio,rows] of groups){
  const sheet=setup(book,groups.size===1?'INVENTARIO A.C.':'A.C. '+String(++sheetIndex).padStart(3,'0'),
   [12,9,20,22,44,13,13,9,6,6,6,6,8,8,10,7,7,7,11,11,10,10,10,33],9);
  title(sheet,'INVENTARIO DOCUMENTAL ARCHIVO DE CONCENTRACIÓN',24);
  const first=rows[0]||{};
  cellRow(sheet,['Unidad administrativa',first.administrativeUnit]);
  cellRow(sheet,['Área generadora',first.areaName||first.areaId]);
  cellRow(sheet,['Fondo',first.fund,'','Sección',first.cadidoSectionName||first.cadidoSectionId]);
  cellRow(sheet,['Serie',[first.cadidoCode,first.cadidoSeriesName].filter(Boolean).join(' · ')]);
  cellRow(sheet,['Folio de inventario',folio,'','Fecha de elaboración',date(first.inventoryDate)]);
  for(const [row,last] of [[3,12],[4,12],[5,3],[6,12],[7,3]])sheet.mergeCells(row,2,row,last);
  cellRow(sheet,['Consecutivo','Caja','Número de expediente','Clasificación archivística','Descripción o asunto',
   'Periodo de trámite','','Folios','Valor documental','','','','Vigencia documental','','',
   'Condiciones de acceso','','','Tradición documental','','Ubicación topográfica','','','Observaciones']);
  cellRow(sheet,['','','','','','Apertura','Cierre','','A','L','F','C','AT','AC','Total','P','C','R','Original','Copia','M','N','P','']);
  for(const [start,end] of [[6,7],[9,12],[13,15],[16,18],[19,20],[21,23]])sheet.mergeCells(8,start,8,end);
  for(const column of [1,2,3,4,5,8,24])sheet.mergeCells(8,column,9,column);
  styleHeaders(sheet,8,9);
  rows.forEach((record,i)=>{
   const values=new Set((record.documentaryValues||[]).map(value=>String(value).toUpperCase()));
   const data=record.concentrationData||{};
   const combined=values.has('FISCAL_CONTABLE')||values.has('FISCAL/CONTABLE');
   const mark=condition=>condition?'X':'';
   const row=cellRow(sheet,[i+1,record.locationBox||record.boxNumber,record.recordNumber,key(record),subject(record),
    date(record.openDate),date(record.closeDate),record.foliosCount,mark(values.has('ADMINISTRATIVO')),
    mark(values.has('LEGAL')),mark(combined||values.has('FISCAL')),mark(combined||values.has('CONTABLE')),
    record.currentValidity,record.concentrationValidity,record.totalValidity,
    ...['P','C','R'].map(access=>mark(data.access===access)),
    mark(['ORIGINAL','AMBAS'].includes(data.tradition)),mark(['COPIA','AMBAS'].includes(data.tradition)),
    data.m,data.n,data.p,record.observations]);
   details(row);
  });
 }
 return book;
}

export function makeDocumentaryReportWorkbook(records){
 const book=new ExcelJS.Workbook();
 const sheet=setup(book,'Concentrado documental',[11,27,26,22,24,42,24,17,16,17,20,24],4);
 title(sheet,'CONCENTRADO DOCUMENTAL · REPORTE DE CONSULTA',12);
 cellRow(sheet,['Expedientes',records.length,'Inventarios',new Set(records.map(record=>record.inventoryId)).size]);
 cellRow(sheet,['Consecutivo','Folio de inventario','Área generadora','Número de expediente','Clasificación archivística',
  'Descripción o asunto','Etapa','Fecha del inventario','Apertura','Fecha de transferencia','Caja','Folio de transferencia']);
 styleHeaders(sheet,4,4);
 const year=record=>Number(key(record).match(/(?:^|[.\/_-])((?:19|20|21)\d{2})$/)?.[1]||record.cadidoYear)||9999;
 const sort=(a,b)=>String(a||'').localeCompare(String(b||''),'es',{numeric:true});
 [...records].sort((a,b)=>year(a)-year(b)||sort(key(a),key(b))||sort(a.inventoryId,b.inventoryId)||sort(a.recordNumber,b.recordNumber))
  .forEach((record,i)=>details(cellRow(sheet,[i+1,record.inventoryId,record.areaName||record.areaId,
   record.recordNumber,key(record),subject(record),record.stage,date(record.inventoryDate),date(record.openDate),
   date(record.transferDate),record.locationBox||record.boxNumber,record.transferReference])));
 sheet.autoFilter='A4:L'+Math.max(4,sheet.rowCount);
 return book;
}
