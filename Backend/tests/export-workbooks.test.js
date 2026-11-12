import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { makeInventoryWorkbook,makeTransferWorkbook } from '../src/export-workbooks.js';

const sample={
 inventoryId:'INV-TEST',recordNumber:'EXP-0001',consecutive:'1',cadidoCode:'DEMO-1C.1',
 title:'=SUM(1,2)',description:'Asunto de prueba',areaId:'AR-002',
 administrativeUnit:'Unidad de demostración',responsible:'Responsable de prueba',
 responsiblePosition:'Jefatura',fund:'SEMARNAT',
 inventoryDate:'2026-11-12',openDate:'2026-11-10',closeDate:'',boxNumber:'CAJA-1',
 filesCount:'1',foliosCount:'32',supportType:'Mixto',
 documentaryValues:['Administrativo','Legal'],currentValidity:'2',
 concentrationValidity:'3',totalValidity:'5',archiveZone:'Bodega A',
 room:'Sala 1',shelf:'2',level:'1',physicalSection:'3',position:'C-01',
 locationBox:'CAJA-1',archiveAddress:'Dirección de prueba',
 locationNotes:'',observations:'',availability:'En archivo',
 transferReference:'',transferAcceptedDate:'',cadidoSectionId:'SEC-DEMO-01'
};
async function reload(book){
 const out=await book.xlsx.writeBuffer();
 const next=new ExcelJS.Workbook();await next.xlsx.load(out);return next;
}
test('copia los encabezados y las dos pestañas del formato aportado',async()=>{
 const wb=await reload(makeInventoryWorkbook([sample],'tramite'));
 assert.deepEqual(wb.worksheets.map(s=>s.name),['INVENTARIO A.T.','INSTRUCTIVO LLENADO A.T.']);
 const sh=wb.worksheets[0];
 assert.equal(sh.getCell('G2').value,'SECRETARÍA DE MEDIO AMBIENTE Y RECURSOS NATURALES');
 assert.equal(sh.getCell('G3').value,'INVENTARIO DOCUMENTAL ARCHIVO DE TRÁMITE');
 assert.equal(sh.getCell('B21').value,'N°. CONSECUTIVO');
 assert.equal(sh.getCell('L22').value,'FÍSICO');
 assert.equal(sh.getCell('M22').value,'ELECTRÓNICO');
 assert.equal(sh.getCell('N22').value,'A');
 assert.equal(sh.getCell('Q22').value,'C');
 assert.equal(sh.getCell('R22').value,'A.T.');
 assert.equal(sh.getCell('S22').value,'A.C.');
 assert.equal(sh.getCell('T22').value,'TOTAL DE AÑOS');
});
test('filas en misma posición que el formato, X de valores y fórmulas neutralizadas',async()=>{
 const wb=await reload(makeInventoryWorkbook([sample],'tramite'));
 const sh=wb.worksheets[0];
 assert.equal(sh.getCell('D23').value,'EXP-0001');
 assert.equal(sh.getCell('G23').value,"'=SUM(1,2) — Asunto de prueba");
 assert.equal(sh.getCell('G23').type,ExcelJS.ValueType.String);
 assert.equal(sh.getCell('L23').value,'X');
 assert.equal(sh.getCell('M23').value,'X');
 assert.equal(sh.getCell('N23').value,'X');
 assert.equal(sh.getCell('O23').value,'X');
 assert.equal(sh.getCell('P23').value,'');
 assert.equal(sh.getCell('R23').value,'2');
 assert.equal(sh.getCell('S23').value,'3');
 assert.equal(sh.getCell('T23').value,'5');
 assert.match(String(sh.getCell('B35').value),/1 EXPEDIENTES/);
 const rows=wb.worksheets[1];
 assert.match(String(rows.getCell('A1').value),/INSTRUCTIVO DE LLENADO/);
});
test('transferencia primaria tiene la misma tabla documental, no una fila-resumen',async()=>{
 const wb=await reload(makeTransferWorkbook([sample,{...sample,id:'REG-2',recordNumber:'EXP-0002',consecutive:'2'}]));
 const sh=wb.worksheets[0];
 assert.equal(sh.getCell('G3').value,'INVENTARIO DOCUMENTAL TRANSFERENCIA PRIMARIA');
 assert.equal(sh.getCell('D23').value,'EXP-0001');
 assert.equal(sh.getCell('D24').value,'EXP-0002');
 assert.match(String(sh.getCell('B35').value),/2 EXPEDIENTES/);
});
