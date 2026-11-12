import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { makeInventoryWorkbook,makeTransferWorkbook } from '../src/export-workbooks.js';

const sample={
 inventoryId:'INV-TEST',recordNumber:'EXP-0001',consecutive:'1',cadidoCode:'DEMO-1C.1',
 title:'=SUM(1,2)',areaId:'AR-002',administrativeUnit:'Unidad ficticia',
 responsible:'Persona responsable',responsiblePosition:'Jefatura',fund:'Fondo de prueba',
 inventoryDate:'2026-11-12',openDate:'2026-11-10',closeDate:'',boxNumber:'CAJA-1',
 filesCount:'1',foliosCount:'32',supportType:'Físico',
 documentaryValues:['Administrativo'],currentValidity:'2',
 concentrationValidity:'3',totalValidity:'5',archiveZone:'Bodega A',
 room:'Sala 1',shelf:'2',level:'1',physicalSection:'3',position:'C-01',
 locationBox:'CAJA-1',locationNotes:'',observations:'',
 availability:'En archivo',transferReference:'',transferAcceptedDate:'',
 cadidoSectionId:'SEC-DEMO-01'
};
test('inventario genera un archivo XLSX válido con hoja de detalle y resumen',async()=>{
 const workbook=makeInventoryWorkbook([sample],'tramite');
 const buffer=await workbook.xlsx.writeBuffer();
 const reloaded=new ExcelJS.Workbook();
 await reloaded.xlsx.load(buffer);
 assert.equal(reloaded.worksheets.length,2);
 const detail=reloaded.getWorksheet('Archivo de trámite');
 assert.ok(detail);
 assert.equal(detail.getCell('B6').value,'EXP-0001');
 assert.equal(detail.getCell('E6').value,"'=SUM(1,2)");
 assert.equal(detail.getCell('E6').type,ExcelJS.ValueType.String);
 assert.equal(reloaded.getWorksheet('Resumen')?.getCell('E3').value,1);
});
test('relación primaria genera una fila por inventario sin ejecutar movimientos',async()=>{
 const workbook=makeTransferWorkbook([{
 folio:'INV-TEST',area_code:'AR-002',unidad_administrativa:'Unidad ficticia',
 responsable_nombre:'Persona responsable',responsable_cargo:'Jefatura',
 fondo:'Fondo de prueba',seccion_codigo:'1C',serie_codigo:'1C.1',
 fecha_elaboracion:'2026-11-12',total_expedientes:3,
 apertura_inicial:'2026-01-01',apertura_final:'2026-11-10',estado:'TRAMITE'
 }]);
 const bytes=await workbook.xlsx.writeBuffer();
 const parsed=new ExcelJS.Workbook();
 await parsed.xlsx.load(bytes);
 assert.equal(parsed.worksheets.length,1);
 const sheet=parsed.getWorksheet('Relación transferencia primaria');
 assert.equal(sheet?.getCell('A6').value,'INV-TEST');
 assert.equal(sheet?.getCell('J6').value,'3');
});
