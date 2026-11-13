import test from 'node:test';
import assert from 'node:assert/strict';
import {
 REQUIRED_COLUMNS, REQUIRED_PROCEDURES, REQUIRED_VIEWS, REQUIRED_ROLE_CODES, compareSchema
} from '../src/preflight-contract.js';
const good=()=>({
 columns:Object.fromEntries(Object.entries(REQUIRED_COLUMNS).map(([t,c])=>[t,[...c]])),
 procedures:[...REQUIRED_PROCEDURES],views:[...REQUIRED_VIEWS],roles:[...REQUIRED_ROLE_CODES]
});
test('esquema compatible supera preflight sin depender de MySQL local',()=>{
 assert.deepEqual(compareSchema(good()),[]);
});
test('detecta específicamente migración pendiente de ubicación, vistas y procedimientos',()=>{
 const broken=good();
 broken.columns.expedientes=broken.columns.expedientes.filter(x=>x!=='archivo_zona');
 broken.procedures=broken.procedures.filter(x=>x!=='sp_aceptar_transferencia');
 broken.views=[];
 const errors=compareSchema(broken);
 assert.ok(errors.includes('Falta expedientes.archivo_zona'));
 assert.ok(errors.includes('Falta procedimiento sp_aceptar_transferencia'));
 assert.ok(errors.includes('Falta vista vw_prestamos_vencimiento'));
});
