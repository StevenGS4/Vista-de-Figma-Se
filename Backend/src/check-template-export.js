import ExcelJS from 'exceljs';
import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { makeOfficialTemplateWorkbook } from './template-workbooks.js';

const sample=(i)=>({
  id:'REG-'+i,inventoryId:'INV-PRUEBA-001',areaId:'AR-001',areaName:'Área de pruebas',
  administrativeUnit:'UNIDAD DE CONTROL TEST XYZ',responsible:'Persona responsable',responsiblePosition:'Encargado',
  inventoryDate:'2026-11-13',fund:'Secretaría de Medio Ambiente y Recursos Naturales',
  cadidoSectionName:'Legislación',cadidoSeriesName:'Leyes',cadidoCode:'1C.11',
  consecutive:String(i),boxNumber:'1',recordNumber:'EXP-'+String(i).padStart(4,'0'),
  archiveClassificationCode:'SEMARNAT.1C.11.'+String(i).padStart(3,'0')+'.2026',
  title:'EXPEDIENTE DE VERIFICACIÓN '+i,description:'Verificación de formato',
  openDate:'2026-11-01',closeDate:'2026-11-13',filesCount:'1',foliosCount:'2',
  supportType:'Físico',documentaryValues:['Administrativo'],
  currentValidity:'2',concentrationValidity:'3',totalValidity:'5',
  archiveAddress:'Avenida Allende No. 110 Oriente, Tepic, Nayarit',
  observations:'Prueba de estructura',
});
const fail=(message)=>{throw new Error('Verificación de plantilla: '+message);};
function contains(sheet,term){
  let found=false;
  sheet.eachRow(row=>row.eachCell(cell=>{
    const v=cell.value;
    const text=typeof v==='string'?v:
      v && typeof v==='object' && Array.isArray(v.richText)?
        v.richText.map(x=>x.text||'').join(''):String(v?.text||v?.result||'');
    if(text.includes(term))found=true;
  }));
  return found;
}
async function verify(size,kind){
 const originals={tramite:'inventario_tramite.xlsx',concentracion:'inventario_concentracion.xlsx',transferencia:'inventario_transferencia_primaria.xlsx'};
 const path=resolve(fileURLToPath(new URL('../plantillas/',import.meta.url)),originals[kind]);
 try { await access(path); }
 catch { fail('falta la plantilla '+originals[kind]); }
 const records=Array.from({length:size},(_,i)=>sample(i+1));
 const book=await makeOfficialTemplateWorkbook(records,kind);
 const imagesBefore=book.worksheets[0].getImages().length;
 const output=await book.xlsx.writeBuffer();
 const reread=new ExcelJS.Workbook();
 await reread.xlsx.load(output);
 const first=reread.worksheets[0];
 if(!first)fail('no se generó la hoja');
 if(!contains(first,'EXPEDIENTE DE VERIFICACIÓN 1'))fail('no se escribió el primer expediente');
 if(!contains(first,'EXPEDIENTE DE VERIFICACIÓN '+size))fail('no se escribió el último expediente');
 if(!contains(first,'EL PRESENTE INVENTARIO CONSTA'))fail('se perdió el resumen del formato');
 if(!contains(first,'UNIDAD DE CONTROL TEST XYZ'))fail('no se completó el encabezado de unidad administrativa');
 const normalizeText=text=>String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
 const required={tramite:'TRAMITE',concentracion:'CONCENTRACION',transferencia:'TRANSFERENCIA'};
 let matched=false;
 first.eachRow(row=>row.eachCell(cell=>{
   const v=cell.value;
   const text=typeof v==='string'?v:v?.richText?.map(p=>p.text||'').join('')||String(v?.text||'');
   if(normalizeText(text).includes(required[kind]))matched=true;
 }));
 if(!matched)fail('el título no corresponde a la plantilla específica '+kind);
 const instructions=book.worksheets.find(sh=>/INSTRUCTIVO/i.test(sh.name));
 if(kind==='transferencia'){
   if(reread.worksheets.length!==1)fail('transferencia primaria debe tener una sola hoja');
   if(instructions)fail('transferencia primaria no debe contener hojas extra de instructivo');
 }else if(!instructions)fail('se perdió la hoja de instructivo '+kind);
 if(imagesBefore && !first.getImages().length)fail('se perdieron los logotipos');
 console.log('OK',kind,size,'expedientes; hojas',reread.worksheets.length,
  '; imágenes conservadas',first.getImages().length,'; bytes',output.length);
}
try {
 await verify(1,'tramite');
 await verify(12,'tramite');
 await verify(100,'tramite');
 await verify(1000,'tramite');
 await verify(12,'transferencia');
 // Selección mixta: nueve expedientes de tres inventarios y varios años CADIDO.
 const selected=Array.from({length:9},(_,i)=>({
   ...sample(i+1),
   inventoryId:'INV-PRUEBA-'+String(Math.floor(i/3)+1).padStart(3,'0'),
   cadidoYear:[2026,2024,2025][i%3],
   archiveClassificationCode:'SEMARNAT.1C.11.'+String(i+1).padStart(3,'0')+'.'+[2026,2024,2025][i%3],
 }));
 const consolidated=await makeOfficialTemplateWorkbook(selected,'transferencia');
 const bytes=await consolidated.xlsx.writeBuffer();
 const loaded=new ExcelJS.Workbook();
 await loaded.xlsx.load(bytes);
 if(loaded.worksheets.length!==1)fail('la relación personalizada creó pestañas extra');
 const sheet=loaded.worksheets[0],present=[];
 sheet.eachRow((row,r)=>row.eachCell(cell=>{
   const txt=typeof cell.value==='string'?cell.value:String(cell.value?.text||'');
   const m=txt.match(/EXPEDIENTE DE VERIFICACIÓN (\d+)/);
   if(m)present.push({row:r,number:Number(m[1])});
 }));
 if(present.length!==9)fail('el consolidado no contiene exactamente los nueve expedientes: '+JSON.stringify(present));
 const expected=[2,5,8,3,6,9,1,4,7];
 if(present.some((item,i)=>item.number!==expected[i]))
   fail('el consolidado no está ordenado por el año de la clave CADIDO');
 const rNum=present.map(item=>String(sheet.getRow(item.row).getCell(2).value));
 if(rNum.some((n,i)=>n!==String(i+1)))fail('el consecutivo consolidado debe ser del 1 al 9');
 console.log('OK transferencia primaria mixta: una hoja, nueve expedientes, orden CADIDO y consecutivos 1–9.');
 await verify(1,'concentracion');
 await verify(12,'concentracion');
 await verify(100,'concentracion');
 const twoInventories=[sample(1),{...sample(2),inventoryId:'INV-PRUEBA-002'}];
 const multi=await makeOfficialTemplateWorkbook(twoInventories,'tramite');
 const multiBytes=await multi.xlsx.writeBuffer();
 const loadedMulti=new ExcelJS.Workbook();
 await loadedMulti.xlsx.load(multiBytes);
 if(loadedMulti.worksheets.length<2)fail('la exportación de varios inventarios no creó hojas independientes');
 if(!loadedMulti.worksheets.some(sh=>contains(sh,'EXPEDIENTE DE VERIFICACIÓN 2')))
   fail('el segundo inventario no aparece en el archivo');
 console.log('OK varios inventarios; hojas',loadedMulti.worksheets.length);
} catch(error) {
 console.error(error.stack||error.message);
 process.exitCode=1;
}
