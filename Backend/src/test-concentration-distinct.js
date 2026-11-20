import assert from 'node:assert/strict';
import { readRecords } from './tramite.js';

// Regressión: un inventario puede tener varias transferencias históricas,
// pero readRecords no debe multiplicar los expedientes por ese historial.
const record={
  inventoryId:'INV-TR-TEST',inventoryDate:'2026-11-10',responsiblePosition:'Encargado',
  initialSheetNumber:1,administrativeUnit:'SEMARNAT',areaId:'AREA',areaName:'Área',responsible:'Responsable',fund:'Fondo',
  consecutive:'1',dbId:101,recordNumber:'EXP-01',archiveClassificationCode:'SEMARNAT.1C.11.001.2026',
  boxNumber:'1',title:'EXPEDIENTE',description:'',archiveAddress:'',observations:'',
  cadidoSectionId:'1C',cadidoSectionName:'Sección',dbSeriesId:1,cadidoCode:'1C.11',cadidoSeriesName:'Serie',cadidoYear:2026,
  openDate:'2026-01-01',closeDate:'2026-11-01',filesCount:'1',foliosCount:'5',supportType:'FISICO',
  currentValidity:'2',concentrationValidity:'3',totalValidity:'5',room:'',shelf:1,level:1,physicalSection:1,position:'',
  locationBox:'',locationNotes:'',stage:'CONCENTRACION',availability:'EN_ARCHIVO',createdBy:'5',
  transferReference:'TR-002',transferDate:'2026-11-09',transferAcceptedDate:'2026-11-10',
  inventoryDeletedAt:null,recordDeletedAt:null,inventoryDeletedBy:null,recordDeletedBy:null,
};
let checked=false;
const fakeDb={
  execute:async(sql)=>{
    assert.match(sql,/LEFT JOIN transferencias t ON t\.id=\(\s*SELECT ti_hist\.transferencia_id/s);
    assert.doesNotMatch(sql,/LEFT JOIN transferencia_inventarios ti ON ti\.inventario_id=i\.id/);
    assert.match(sql,/ti_hist\.inventario_id=i\.id/);
    assert.match(sql,/LIMIT 1/);
    checked=true;
    return [[record,{...record,dbId:102,recordNumber:'EXP-02',consecutive:'2'}]];
  },
  query:async()=>[[{expediente_id:101,valor:'ADMINISTRATIVO'}]],
};
const rows=await readRecords(fakeDb,"WHERE e.etapa='CONCENTRACION'",[]);
assert.equal(checked,true);
assert.equal(rows.length,2);
assert.deepEqual(rows.map(r=>r.id),['REG-101','REG-102']);
assert.equal(rows[0].inventoryId,rows[1].inventoryId);
console.log('OK: consulta selecciona una sola transferencia por inventario y conserva expedientes distintos.');
