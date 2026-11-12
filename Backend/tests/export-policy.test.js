import test from 'node:test';
import assert from 'node:assert/strict';
import {exportTypes,exportScope,safeCell,stageForType,filterExportRecords} from '../src/export-policy.js';
import {roleNames} from '../src/auth-policy.js';

const user=(role,extra={})=>({id:11,areaId:'AR-002',roles:[role],mustChangePassword:false,...extra});
test('tres tipos diferentes de documento Excel',()=>{
 assert.deepEqual(Object.keys(exportTypes),['tramite','concentracion','transferencia']);
 assert.equal(stageForType('tramite'),'TRAMITE');
 assert.equal(stageForType('concentracion'),'CONCENTRACION');
 assert.equal(stageForType('invalid'),null);
});
test('ámbito de exportación dependiente de rol y etapa',()=>{
 assert.equal(exportScope(user(roleNames.ADMIN),'tramite'),'GLOBAL');
 assert.equal(exportScope(user(roleNames.ADMIN),'transferencia'),'GLOBAL');
 assert.equal(exportScope(user(roleNames.PRESTAMOS),'tramite'),null);
 assert.equal(exportScope(user(roleNames.PRESTAMOS),'transferencia'),null);
 assert.equal(exportScope(user(roleNames.PRESTAMOS),'concentracion'),'GLOBAL');
 assert.equal(exportScope(user(roleNames.JEFE_AREA),'tramite'),'AREA');
 assert.equal(exportScope(user(roleNames.PERSONAL),'concentracion'),'PROPIO');
 assert.equal(exportScope(user(roleNames.ADMIN,{mustChangePassword:true}),'tramite'),null);
 assert.equal(exportScope(user(roleNames.ADMIN),'otro'),null);
});
test('no convierte datos externos en fórmulas de Excel',()=>{
 assert.equal(safeCell('=SUM(1,2)'),"'=SUM(1,2)");
 assert.equal(safeCell('  +CMD'),"'  +CMD");
 assert.equal(safeCell('@FUNC'),"'@FUNC");
 assert.equal(safeCell('-HYPERLINK(...)'),"'-HYPERLINK(...)");
 assert.equal(safeCell('Nombre institucional'),'Nombre institucional');
 assert.equal(safeCell(null),'');
 assert.equal(safeCell(12),12);
});
test('clasificación básica por etapa archivística',()=>{
 const list=[{stage:'Archivo de trámite'},{stage:'Archivo de concentración'}];
 assert.equal(filterExportRecords(list,'tramite').length,1);
 assert.equal(filterExportRecords(list,'concentracion').length,1);
});
