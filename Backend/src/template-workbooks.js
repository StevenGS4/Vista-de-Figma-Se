import ExcelJS from 'exceljs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { access } from 'node:fs/promises';
import { safeCell } from './export-policy.js';

const TEMPLATE = resolve(dirname(fileURLToPath(import.meta.url)), '../plantillas/inventario_tramite.xlsx');
const MAX_ROWS = 15000;
const normalize = v => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g,' ').trim().toUpperCase();
const visible = value => {
  if(value == null) return '';
  if(typeof value === 'object') {
    if(value.richText) return value.richText.map(x=>x.text||'').join('');
    if(value.text) return String(value.text);
    if(value.result != null) return String(value.result);
    return '';
  }
  return String(value);
};
const date = value => {
  const s=String(value||'').slice(0,10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.slice(8)+'/'+s.slice(5,7)+'/'+s.slice(0,4) : '';
};
const fillCell=(sheet,address,value)=>{
  const cell=sheet.getCell(address);
  // Nunca sustituir los textos fijos de la plantilla o sus fórmulas.
  if(cell.type === ExcelJS.ValueType.Formula) throw new Error('La plantilla contiene una fórmula en '+address);
  cell.value=safeCell(value == null ? '' : value);
};
const eachCell=(sheet,maxRow,visitor)=>{
  for(let r=1;r<=maxRow;r++) {
    const row=sheet.getRow(r);
    row.eachCell({includeEmpty:false},(cell,col)=>{
      if(cell.isMerged && cell.master !== cell) return;
      const text=normalize(visible(cell.value));
      if(text)visitor(cell,r,col,text);
    });
  }
};
const findCell=(sheet,maxRow,matcher)=>{
  let result;
  eachCell(sheet,maxRow,(cell,row,col,text)=>{
    if(!result && matcher(text,cell,row,col))result={cell,row,col,text};
  });
  return result;
};
const col=(sheet,from,to,matcher,fallback)=>{
  for(let row=from;row<=to;row++) {
    const found=findCellInRow(sheet,row,matcher);
    if(found)return found.col;
  }
  return fallback;
};
function findCellInRow(sheet,row,matcher){
  let out;
  sheet.getRow(row).eachCell({includeEmpty:false},(cell,c)=>{
    if(out || cell.isMerged && cell.master !== cell)return;
    if(matcher(normalize(visible(cell.value))))out={cell,col:c};
  });
  return out;
}
function locate(sheet){
  const limit=Math.min(sheet.rowCount,120);
  const marker=findCell(sheet,limit,text=>text.includes('CONSECUTIVO') && !text.includes('PRESENTE'));
  const summary=findCell(sheet,Math.min(sheet.rowCount,650),text=>text.includes('EL PRESENTE INVENTARIO CONSTA'));
  if(!marker || !summary)throw new Error('La plantilla no contiene encabezados de consecutivo y cierre reconocibles');
  const headerStart=marker.row;
  // El encabezado contiene una fila de agrupadores y otra de subencabezados.
  let headerEnd=headerStart;
  for(let r=headerStart;r<=Math.min(headerStart+3,summary.row-1);r++){
    const values=[];
    sheet.getRow(r).eachCell({includeEmpty:false},cell=>values.push(normalize(visible(cell.value))));
    if(values.some(v=>['INICIO','CIERRE','FISICO','ELECTRONICO','A.T.','A.C.'].includes(v)))headerEnd=Math.max(headerEnd,r);
  }
  const start=headerEnd+1;
  if(start>=summary.row)throw new Error('La plantilla no tiene espacio para expedientes');
  const fallback={seq:2,box:3,number:4,classification:5,title:7,opened:8,closed:9,files:10,folios:11,
    physical:12,electronic:13,admin:14,legal:15,fiscal:16,accounting:17,at:18,ac:19,total:20,address:21,notes:22};
  const top=(test,key)=>col(sheet,headerStart,headerEnd,test,fallback[key]);
  const fields={
    seq:top(x=>x.includes('CONSECUTIVO'),'seq'),
    box:top(x=>x.includes('CAJA')&&!x.includes('EXPEDIENTE'),'box'),
    number:top(x=>x.includes('NO. DE EXPEDIENTE')||x.includes('N° DE EXPEDIENTE')||x.includes('NÚMERO DE EXPEDIENTE'),'number'),
    classification:top(x=>x.includes('CLASIFICACION ARCHIVISTICA'),'classification'),
    title:top(x=>x.includes('TITULO Y DESCRIPCION')||x.includes('ASUNTO QUE TRATA'),'title'),
    files:top(x=>x.includes('LEGAJOS'),'files'),
    folios:top(x=>x.includes('FOLIOS'),'folios'),
    address:top(x=>x.includes('UBICACION TOPOGRAFICA'),'address'),
    notes:top(x=>x.includes('OBSERVACIONES'),'notes'),
  };
  // Estos campos ocupan subcolumnas dentro de los grupos originales.
  const extremes=top(x=>x.includes('FECHAS EXTREMAS'),'opened');
  const support=top(x=>x.includes('SOPORTE DOCUMENTAL'),'physical');
  const values=top(x=>x.includes('VALOR DOCUMENTAL'),'admin');
  const validity=top(x=>x.includes('VIGENCIA DOCUMENTAL'),'at');
  Object.assign(fields,{
    opened:extremes,closed:extremes+1,
    physical:support,electronic:support+1,
    admin:values,legal:values+1,fiscal:values+2,accounting:values+3,
    at:validity,ac:validity+1,total:validity+2,
  });
  if(new Set(Object.values(fields)).size!==Object.keys(fields).length)
    throw new Error('La plantilla tiene columnas solapadas: revisar su distribución antes de exportar');
  return {start,summaryRow:summary.row,fields};
}
function copyStyle(source,target){
  target.style=structuredClone(source.style);
  if(source.numFmt)target.numFmt=source.numFmt;
}
function expandDetail(sheet,{start,summaryRow,fields},recordCount){
  const available=summaryRow-start;
  if(available<1)throw new Error('La plantilla no tiene renglones de detalle');
  const extra=Math.max(0,recordCount-available);
  if(!extra)return;
  // Las fusiones del cierre y las firmas deben acompañar a las filas desplazadas.
  const merges=Object.values(sheet._merges||{}).map(range=>({
    top:range.top,bottom:range.bottom,left:range.left,right:range.right,
  })).filter(x=>Number.isInteger(x.top));
  const moving=merges.filter(m=>m.top>=summaryRow);
  if(merges.some(m=>m.top<summaryRow && m.bottom>=summaryRow))
    throw new Error('El rango combinado de la plantilla cruza el inicio del cierre');
  moving.forEach(m=>sheet.unMergeCells(m.top,m.left,m.bottom,m.right));
  const base=sheet.getRow(start);
  const styles=new Map();
  for(const c of Object.values(fields)) styles.set(c,structuredClone(base.getCell(c).style));
  sheet.insertRows(summaryRow,Array.from({length:extra},()=>[]),'i+');
  // Réplica de bordes/alineaciones del primer renglón original.
  for(let r=summaryRow;r<summaryRow+extra;r++){
    const row=sheet.getRow(r);
    row.height=base.height||26;
    for(const [c,style] of styles)row.getCell(c).style=structuredClone(style);
  }
  moving.forEach(m=>sheet.mergeCells(m.top+extra,m.left,m.bottom+extra,m.right));
  const lineMerges=merges.filter(m=>m.top===start && m.bottom===start);
  for(let r=summaryRow;r<summaryRow+extra;r++)
    for(const m of lineMerges)sheet.mergeCells(r,m.left,r,m.right);
}
const findLabel=(sheet,limit,pattern)=>findCell(sheet,limit,t=>pattern.test(t));
function fillHeader(sheet,first,location,kind){
  if(!first)return;
  const {start}=location;
  // Coordinadas establecidas por el instructivo del modelo institucional.
  // Solo rellenar espacios: conservar rotulación, fórmulas y logos.
  const items=[
    [/NOMBRE DE LA UNIDAD ADMINISTRATIVA/,first.administrativeUnit,'E6'],
    [/NOMBRE DEL AREA GENERADORA/,first.areaName||first.areaId,'E9'],
    [/NOMBRE Y CARGO DEL RESPONSABLE/, [first.responsible,first.responsiblePosition].filter(Boolean).join(' · '),'E12'],
    [/^FONDO/,first.fund,'E14'],
    [/^SECCION/,first.cadidoSectionName||first.cadidoSectionId,'E16'],
    [/^SERIE/,first.cadidoSeriesName||first.cadidoCode,'E18'],
    [/FECHA DE ELABORACION/,date(first.inventoryDate),'V9'],
  ];
  if(kind==='transferencia'){
    const title=findCell(sheet,start-1,t=>t.includes('INVENTARIO DOCUMENTAL ARCHIVO DE TRAMITE'));
    if(title && title.cell.type!==ExcelJS.ValueType.Formula)
      title.cell.value='INVENTARIO DOCUMENTAL TRANSFERENCIA PRIMARIA';
  }
  for(const [pattern,val,fallback] of items){
    const anchor=findLabel(sheet,start-1,pattern);
    if(!anchor)continue;
    // El original coloca los valores debajo de la etiqueta, sobre líneas impresas.
    // Si el destino conocido contiene texto fijo, no sustituirlo.
    const target=sheet.getCell(fallback);
    if(target.row>=start)continue;
    const existing=normalize(visible(target.value));
    if(target.type===ExcelJS.ValueType.Formula || (existing && !/^\(\d+\)$/.test(existing)))continue;
    fillCell(sheet,fallback,val);
  }
}
function fillRecords(sheet,records,location){
  const {start,fields}=location;
  expandDetail(sheet,location,records.length);
  for(let i=0;i<records.length;i++){
    const rec=records[i],r=start+i;
    const support=normalize(rec.supportType);
    const values=new Set((rec.documentaryValues||[]).map(normalize));
    const data={
      seq:rec.consecutive,box:rec.boxNumber,number:rec.recordNumber,
      classification:rec.archiveClassificationCode||rec.cadidoCode,
      title:[rec.title,rec.description].filter(Boolean).join(' — '),
      opened:date(rec.openDate),closed:date(rec.closeDate),files:rec.filesCount,folios:rec.foliosCount,
      physical:['FISICO','MIXTO'].includes(support)?'X':'',
      electronic:['ELECTRONICO','MIXTO'].includes(support)?'X':'',
      admin:values.has('ADMINISTRATIVO')?'X':'',legal:values.has('LEGAL')?'X':'',
      fiscal:values.has('FISCAL')?'X':'',accounting:values.has('CONTABLE')?'X':'',
      at:rec.currentValidity,ac:rec.concentrationValidity,total:rec.totalValidity,
      address:rec.archiveAddress||'',notes:rec.observations,
    };
    for(const [key,val] of Object.entries(data)){
      const cell=sheet.getRow(r).getCell(fields[key]);
      if(cell.type===ExcelJS.ValueType.Formula)
        throw new Error('No se puede sobreescribir fórmula de la plantilla en '+cell.address);
      cell.value=safeCell(val==null?'':val);
      cell.alignment={...cell.alignment,wrapText:true,vertical:'middle'};
    }
  }
}
function fillSummary(sheet,records,location){
  const extra=Math.max(0,records.length-(location.summaryRow-location.start));
  const summary=sheet.getRow(location.summaryRow+extra);
  const root=summary.getCell(2);
  // Respeta la leyenda y su estilo en la plantilla: cambia únicamente los
  // números que el instructivo marca como campos de cálculo.
  const original=visible(root.value);
  if(!normalize(original).includes('EL PRESENTE INVENTARIO CONSTA'))return;
  const years=records.flatMap(r=>[r.openDate,r.closeDate])
    .map(d=>Number(String(d||'').slice(0,4))).filter(y=>y>=1900&&y<=2200);
  const boxes=new Set(records.map(r=>String(r.boxNumber||'').trim()).filter(Boolean));
  const electronic=records.filter(r=>['ELECTRONICO','MIXTO'].includes(normalize(r.supportType))).length;
  const replacements=new Map([
    ['22',String(Math.max(1,Math.ceil(records.length/11)))],['23',String(records.length)],
    ['24',years.length?String(Math.min(...years)):'SIN DATO'],
    ['25',years.length?String(Math.max(...years)):'SIN DATO'],
    ['26',String(boxes.size)],['29',String(electronic)],
  ]);
  // Peso, metros lineales y medios de almacenamiento no se inventan.
  const substitute=text=>String(text||'').replace(/\\?\((22|23|24|25|26|29)\)/g,
    (full,n)=>replacements.get(n)||full);
  if(root.value && typeof root.value==='object' && Array.isArray(root.value.richText)){
    // Mantener los tramos rojos, sus fuentes y colores del pie institucional.
    root.value={richText:root.value.richText.map(part=>({...part,text:substitute(part.text)}))};
  } else root.value=substitute(original);
}
function cloneSheet(book,source,name) {
  const copy=book.addWorksheet(name.slice(0,31));
  const model=structuredClone(source.model);
  model.name=copy.name;
  model.id=copy.id;
  copy.model=model;
  for(const pic of source.getImages()){
    // Las imágenes de logotipos están registradas en la colección media del libro.
    if(!copy.getImages().some(i=>i.imageId===pic.imageId))
      copy.addImage(pic.imageId,structuredClone(pic.range));
  }
  return copy;
}
function sheetName(kind,index,total){
  return total===1?(kind==='transferencia'?'TRANSFERENCIA PRIMARIA':'INVENTARIO A.T.'):
    ('INV '+String(index+1).padStart(3,'0'));
}
export async function makeOfficialTemplateWorkbook(records,kind){
  if(!['tramite','transferencia'].includes(kind))throw new Error('Tipo de plantilla no soportado');
  if(records.length>MAX_ROWS)throw new Error('El inventario supera el límite de exportación');
  await access(TEMPLATE);
  const book=new ExcelJS.Workbook();
  await book.xlsx.readFile(TEMPLATE);
  const source=book.worksheets.find(s=>/INVENTARIO|TRAMITE|A\.T\./i.test(s.name))||book.worksheets[0];
  if(!source)throw new Error('La plantilla no tiene hojas');
  const locations=locate(source);
  const groups=new Map();
  for(const record of records){
    const k=record.inventoryId||'SIN INVENTARIO';
    if(!groups.has(k))groups.set(k,[]);
    groups.get(k).push(record);
  }
  if(groups.size===0)groups.set('VACIO',[]);
  const entries=[...groups.values()];
  // Clonar el modelo original ANTES de insertar las filas de detalle.
  const copies=entries.slice(1).map((_,i)=>cloneSheet(book,source,'INV '+String(i+2).padStart(3,'0')));
  source.name=sheetName(kind,0,entries.length);
  const sheets=[source,...copies];
  for(let i=0;i<sheets.length;i++){
    const sheet=sheets[i];
    const layout=locate(sheet);
    const rows=entries[i];
    fillHeader(sheet,rows[0],layout,kind);
    fillRecords(sheet,rows,layout);
    fillSummary(sheet,rows,layout);
    const extra=Math.max(0,rows.length-(layout.summaryRow-layout.start));
    const oldPrint=String(sheet.pageSetup?.printArea||'');
    const print=oldPrint.replace(/(:[A-Z]+)(\d+)$/,(_,a,b)=>a+(Number(b)+extra));
    sheet.pageSetup={...sheet.pageSetup,printArea:print||undefined,
      printTitlesRow:'1:'+String(layout.start-1),
      fitToPage:true,fitToWidth:1,fitToHeight:0};
  }
  return book;
}
