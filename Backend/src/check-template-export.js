import ExcelJS from 'exceljs';
import { makeOfficialTemplateWorkbook } from './template-workbooks.js';

const sample=(i)=>({
  id:'REG-'+i,inventoryId:'INV-PRUEBA-001',areaId:'AR-001',areaName:'Área de pruebas',
  administrativeUnit:'SEMARNAT Nayarit',responsible:'Persona responsable',responsiblePosition:'Encargado',
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
    if(typeof cell.value==='string' && cell.value.includes(term))found=true;
  }));
  return found;
}
async function verify(size,kind){
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
 if(imagesBefore && !first.getImages().length)fail('se perdieron los logotipos');
 console.log('OK',kind,size,'expedientes; hojas',reread.worksheets.length,
  '; imágenes conservadas',first.getImages().length,'; bytes',output.length);
}
try {
 await verify(1,'tramite');
 await verify(12,'tramite');
 await verify(100,'tramite');
 await verify(12,'transferencia');
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
