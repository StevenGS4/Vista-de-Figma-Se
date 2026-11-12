import ExcelJS from 'exceljs';
import { safeCell } from './export-policy.js';

// Transcripción estructural del formato aportado por SEMARNAT:
// hoja INVENTARIO A.T.; columnas B:W; encabezado en filas 2–22;
// detalle a partir de la fila 23; cierre y cuatro espacios de firmas.
// Los textos y el instructivo original son la referencia de esta versión.
const LABELS={
  B21:'N°. CONSECUTIVO',C21:'N° DE CAJA',D21:'N° DE EXPEDIENTE',
  E21:'CÓDIGO DE CLASIFICACIÓN ARCHIVÍSTICA',
  G21:'TÍTULO Y DESCRIPCIÓN DEL ASUNTO QUE TRATA EL EXPEDIENTE',
  H21:'FECHAS EXTREMAS (PERÍODO DE TRÁMITE)',J21:'N°. DE LEGAJOS',
  K21:'N° DE FOLIOS',L21:'SOPORTE DOCUMENTAL',N21:'VALOR DOCUMENTAL',
  R21:'VIGENCIA DOCUMENTAL',U21:'UBICACIÓN TOPOGRÁFICA (DOMICILIO COMPLETO)',
  V21:'OBSERVACIONES',
  H22:'INICIO',I22:'CIERRE',L22:'FÍSICO',M22:'ELECTRÓNICO',
  N22:'A',O22:'L',P22:'F',Q22:'C',R22:'A.T.',S22:'A.C.',T22:'TOTAL DE AÑOS'
};
const BASE_MERGES=[
 'G2:S2','G3:S3','B5:T5','E6:T7','B8:T8','E9:T10','V9:W10','B11:W11','E12:W12',
 'B13:D13','E14:W14','B15:D15','E16:W16','B17:D17','E18:W18',
 'E21:F22','G21:G22','H21:I21','L21:M21','N21:Q21','R21:T21',
 'U21:U22','V21:W22','B21:B22','C21:C22','D21:D22',
 'J21:J22','K21:K22'
];
const DATA_MERGES=[['E','F'],['V','W']];
const columnWidths={A:2.5,B:8,C:8,D:17,E:9,F:6,G:46,H:13,I:13,J:10,K:10,
 L:8,M:10,N:6,O:6,P:6,Q:6,R:9,S:9,T:10,U:33,V:25,W:9};
const BORDER={style:'thin',color:{argb:'FF333333'}};
const formatDate=d=>{
 if(!d || !/^\d{4}-\d{2}-\d{2}/.test(String(d)))return '';
 const s=String(d).slice(0,10);return s.slice(8,10)+'/'+s.slice(5,7)+'/'+s.slice(0,4);
};
const value=(s)=>safeCell(s);
const put=(sheet,cell,v)=>{
 sheet.getCell(cell).value=value(v);
 sheet.getCell(cell).alignment={vertical:'middle',wrapText:true};
};
const merge=(sheet,address)=>sheet.mergeCells(address);
const borders=(row)=>{
 row.eachCell({includeEmpty:true},cell=>{
  cell.border={top:BORDER,bottom:BORDER,left:BORDER,right:BORDER};
  cell.alignment={vertical:'middle',horizontal:'center',wrapText:true};
 });
};
const sampleSignatures=[
 ['ELABORÓ','NOMBRE, CARGO Y FIRMA DE LA PERSONA SERVIDORA PÚBLICA DEL ÁREA GENERADORA QUE ELABORÓ EL INVENTARIO'],
 ['REVISÓ','NOMBRE, CARGO Y FIRMA DE LA PERSONA SERVIDORA PÚBLICA RESPONSABLE DEL ARCHIVO DE TRÁMITE'],
 ['VALIDÓ','NOMBRE, CARGO Y FIRMA DE LA PERSONA SERVIDORA PÚBLICA RESPONSABLE DEL ÁREA GENERADORA'],
 ['AUTORIZÓ','NOMBRE, CARGO Y FIRMA DE LA PERSONA SERVIDORA PÚBLICA TITULAR DE LA UNIDAD ADMINISTRATIVA O DIRECCIÓN DE ÁREA'],
];
function layout(book,records,kind,index,total){
 const sheet=book.addWorksheet(total===1?(kind==='tramite'?'INVENTARIO A.T.':kind==='concentracion'?'INVENTARIO A.C.':'TRANSFERENCIA PRIMARIA'):
  ('INV '+String(index+1).padStart(3,'0')).slice(0,31));
 sheet.views=[{state:'frozen',ySplit:22}];
 sheet.pageSetup={paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,
  margins:{left:0.2,right:0.2,top:0.4,bottom:0.4,header:0.15,footer:0.15}};
 for(const [col,w] of Object.entries(columnWidths))sheet.getColumn(col).width=w;
 for(const a of BASE_MERGES)merge(sheet,a);
 for(const [addr,v] of Object.entries(LABELS))put(sheet,addr,v);
 const first=records[0];
 const title=kind==='tramite'?'INVENTARIO DOCUMENTAL ARCHIVO DE TRÁMITE':
 kind==='concentracion'?'INVENTARIO DOCUMENTAL ARCHIVO DE CONCENTRACIÓN':
 'RELACIÓN DOCUMENTAL PARA TRANSFERENCIA PRIMARIA';
 put(sheet,'G2','SECRETARÍA DE MEDIO AMBIENTE Y RECURSOS NATURALES');
 put(sheet,'G3',title);
 put(sheet,'B5','NOMBRE DE LA UNIDAD ADMINISTRATIVA:');
 put(sheet,'E6',first?.administrativeUnit||'');
 put(sheet,'U5','HOJA 1 DE '+Math.max(1,Math.ceil(records.length/11)));
 put(sheet,'B8','NOMBRE DEL ÁREA GENERADORA:');
 put(sheet,'E9',[first?.areaId,first?.areaName].filter(Boolean).join(' — '));
 put(sheet,'U8','FECHA DE ELABORACIÓN:');
 put(sheet,'V9',formatDate(first?.inventoryDate));
 put(sheet,'B11','NOMBRE Y CARGO DEL RESPONSABLE DEL ÁREA GENERADORA:');
 put(sheet,'E12',[first?.responsible,first?.responsiblePosition].filter(Boolean).join(' · '));
 put(sheet,'B13','FONDO:');put(sheet,'E14',first?.fund||'');
 put(sheet,'B15','SECCIÓN:');put(sheet,'E16',[first?.cadidoSectionId,first?.cadidoSectionName].filter(Boolean).join(' — '));
 put(sheet,'B17','SERIE:');put(sheet,'E18',[first?.cadidoCode,first?.cadidoSeriesName].filter(Boolean).join(' — '));
 for(const row of [2,3])sheet.getRow(row).height=24;
 for(const row of [5,8,11,13,15,17])sheet.getRow(row).height=20;
 for(const row of [20,21,22])sheet.getRow(row).height=row===21?43:25;
 for(const addr of ['G2','G3']){
  const cell=sheet.getCell(addr);cell.font={name:'Arial',size:12,bold:true};
  cell.alignment={horizontal:'center',vertical:'middle',wrapText:true};
 }
 for(const addr of Object.keys(LABELS)){
  const c=sheet.getCell(addr);c.font={name:'Arial',size:8,bold:true};
  c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFE8E8E8'}};
  c.alignment={horizontal:'center',vertical:'middle',wrapText:true};
 }
 for(const row of [21,22])borders(sheet.getRow(row));
 let r=23;
 for(const rec of records){
  for(const [from,to] of DATA_MERGES)merge(sheet,`${from}${r}:${to}${r}`);
  const support=String(rec.supportType||'').toLowerCase();
  const isPhysical=support==='físico'||support==='mixto';
  const isElectronic=support==='electrónico'||support==='mixto';
  const vals=new Set((rec.documentaryValues||[]).map(x=>String(x).toLowerCase()));
  const data={
   B:rec.consecutive,C:rec.boxNumber,D:rec.recordNumber,E:rec.cadidoCode,
   G:[rec.title,rec.description].filter(Boolean).join(' — '),
   H:formatDate(rec.openDate),I:formatDate(rec.closeDate),
   J:rec.filesCount,K:rec.foliosCount,L:isPhysical?'X':'',M:isElectronic?'X':'',
   N:vals.has('administrativo')?'X':'',O:vals.has('legal')?'X':'',
   P:vals.has('fiscal')?'X':'',Q:vals.has('contable')?'X':'',
   R:rec.currentValidity,S:rec.concentrationValidity,T:rec.totalValidity,
   U:kind==='concentracion'?
     [rec.archiveZone,rec.room,rec.shelf&&'Estante '+rec.shelf,rec.level&&'Nivel '+rec.level,rec.archiveAddress].filter(Boolean).join(' · '):
     [rec.archiveAddress,rec.archiveZone,rec.room].filter(Boolean).join(' · '),
   V:rec.observations
  };
  for(const [c,v] of Object.entries(data))put(sheet,c+r,v||'');
  sheet.getRow(r).height=45;
  borders(sheet.getRow(r));
  r++;
 }
 const closingRow=Math.max(35,r+1);
 merge(sheet,`B${closingRow}:W${closingRow+1}`);
 const years=records.flatMap(x=>[x.openDate,x.closeDate])
  .filter(x=>x&&/^\d{4}/.test(String(x))).map(x=>Number(String(x).slice(0,4)));
 const boxes=new Set(records.map(x=>String(x.boxNumber||'').trim()).filter(Boolean));
 const electronic=records.filter(x=>['electrónico','mixto'].includes(String(x.supportType||'').toLowerCase())).length;
 const countPages=Math.max(1,Math.ceil(records.length/11));
 const countBoxes=boxes.size;
 put(sheet,'B'+closingRow,`EL PRESENTE INVENTARIO CONSTA DE ${countPages} FOJAS Y AMPARA LA CANTIDAD DE ${records.length} EXPEDIENTES, DE LOS AÑOS DE ${years.length?Math.min(...years):'—'} A ${years.length?Math.max(...years):'—'}, CONTENIDOS EN ${countBoxes} CAJAS, CON UN PESO APROXIMADO DE ${countBoxes*20} KILOGRAMOS, CORRESPONDIENTES A ${(countBoxes*20*0.02).toFixed(2)} METROS LINEALES. EXPEDIENTES CON DOCUMENTOS ELECTRÓNICOS: ${electronic}. ALMACENAMIENTO ELECTRÓNICO: NO REGISTRADO EN BASE DE DATOS.`);
 sheet.getRow(closingRow).height=30;
 sheet.getRow(closingRow+1).height=30;
 sheet.getCell('B'+closingRow).alignment={wrapText:true,vertical:'middle'};
 sheet.getCell('B'+closingRow).font={bold:true,name:'Arial',size:8};
 const signStart=closingRow+5;
 const signatureCols=[['B','E'],['G','G'],['J','R'],['U','W']];
 for(let i=0;i<4;i++){
  const [a,b]=signatureCols[i];
  merge(sheet,`${a}${signStart}:${b}${signStart}`);
  merge(sheet,`${a}${signStart+2}:${b}${signStart+5}`);
  put(sheet,a+signStart,sampleSignatures[i][0]);
  put(sheet,a+(signStart+2),sampleSignatures[i][1]);
  sheet.getCell(a+signStart).font={bold:true,size:9};
  sheet.getCell(a+signStart).alignment={horizontal:'center'};
  sheet.getCell(a+(signStart+2)).alignment={wrapText:true,horizontal:'center',vertical:'bottom'};
 }
 sheet.getRow(signStart+5).height=40;
 sheet.printArea=`B2:W${signStart+6}`;
 return sheet;
}
function instructivo(book){
 const sh=book.addWorksheet('INSTRUCTIVO LLENADO A.T.');
 sh.getColumn('A').width=120;sh.getColumn('B').width=4;
 sh.getCell('A1').value='INSTRUCTIVO DE LLENADO DEL FORMATO DE INVENTARIO DOCUMENTAL ARCHIVO DE TRÁMITE';
 sh.getCell('A1').font={bold:true,size:14};
 const instructions=[
 '(1) NOMBRE DE LA UNIDAD ADMINISTRATIVA: Anotar el nombre de la unidad administrativa a la que pertenece el área generadora.',
 '(2) NOMBRE DEL ÁREA GENERADORA: Indicar el área que genera los expedientes.',
 '(3) NOMBRE Y CARGO DEL RESPONSABLE DEL ÁREA GENERADORA: Registrar nombre completo y cargo.',
 '(4) FONDO: Nombre completo de la Secretaría de Medio Ambiente y Recursos Naturales.',
 '(5) SECCIÓN: Clave y nombre conforme al Cuadro General de Clasificación Archivística.',
 '(6) SERIE: Clave y nombre conforme al Cuadro General de Clasificación Archivística.',
 '(7) HOJA DE: Indicar el número consecutivo y el total de hojas del inventario.',
 '(8) FECHA DE ELABORACIÓN: DD/MM/AAAA.',
 '(9) NÚMERO CONSECUTIVO: Consecutivo por expediente.',
 '(10) NÚMERO DE CAJA: Contenedor cuando el expediente se resguarde en caja.',
 '(11) NÚMERO DE EXPEDIENTE: Clave de expediente.',
 '(12) CÓDIGO DE CLASIFICACIÓN ARCHIVÍSTICA: Código conforme al cuadro de clasificación.',
 '(13) TÍTULO Y DESCRIPCIÓN: Nombre o título y breve descripción del asunto.',
 '(14) FECHAS EXTREMAS: Fecha de apertura y cierre del expediente en formato DD/MM/AAAA.',
 '(15) NÚMERO DE LEGAJOS: Piezas o divisiones del expediente, cuando aplique.',
 '(16) NÚMERO DE FOLIOS: Número total de hojas del expediente.',
 '(17) SOPORTE DOCUMENTAL: Marcar X para FÍSICO, ELECTRÓNICO o ambos.',
 '(18) VALOR DOCUMENTAL: Marcar con X el valor administrativo, legal, fiscal o contable aplicable.',
 '(19) VIGENCIA DOCUMENTAL: Anotar años de archivo de trámite, concentración y total.',
 '(20) UBICACIÓN TOPOGRÁFICA: Domicilio completo del inmueble donde se localizan los expedientes.',
 '(21) OBSERVACIONES: Información adicional relevante sobre el expediente.',
 '(22) FOJAS: Total de hojas del inventario.',
 '(23) EXPEDIENTES: Cantidad de expedientes amparados.',
 '(24–25) AÑOS: Rango de fechas extremas del inventario.',
 '(26) CAJAS: Total de cajas.',
 '(27) PESO APROXIMADO: El instructivo de referencia propone 20 kg por caja.',
 '(28) METROS LINEALES: El instructivo de referencia propone peso (kg) × 0.02.',
 '(29) EXPEDIENTES ELECTRÓNICOS: Cantidad de expedientes que incluyen documentos electrónicos.',
 '(30) ALMACENAMIENTO ELECTRÓNICO: Cantidad de unidades de almacenamiento; se omite si la BD no contiene ese dato.',
 '(31–34) ELABORÓ, REVISÓ, VALIDÓ Y AUTORIZÓ: Nombre, cargo y firma de las personas servidoras públicas responsables.'
 ];
 for(let i=0;i<instructions.length;i++){
  sh.getCell('A'+(i+4)).value=instructions[i];
  sh.getCell('A'+(i+4)).alignment={wrapText:true,vertical:'middle'};
  sh.getRow(i+4).height=31;
 }
 sh.pageSetup={paperSize:9,orientation:'portrait',fitToPage:true,fitToWidth:1};
}
export function makeInventoryWorkbook(records,type){
 const book=new ExcelJS.Workbook();
 book.creator='Proyecto de control archivístico SEMARNAT Nayarit';
 const groups=new Map();
 for(const rec of records){
  const a=groups.get(rec.inventoryId)||[];a.push(rec);groups.set(rec.inventoryId,a);
 }
 [...groups.values()].forEach((rows,i)=>layout(book,rows,type,i,groups.size));
 if(groups.size===0)layout(book,[],type,0,1);
 instructivo(book);
 return book;
}
export function makeTransferWorkbook(rows){
 // Relación de transferencia primaria con exactamente los mismos campos,
 // columnas, casillas y firma del inventario documental proporcionado.
 return makeInventoryWorkbook(rows,'transferencia');
}
