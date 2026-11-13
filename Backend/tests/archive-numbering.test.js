import test from 'node:test';
import assert from 'node:assert/strict';
import {codeFor,parseArchiveNumber,allocateNumbers} from '../src/archive-numbering.js';

test('clave de clasificación SEMARNAT serie consecutivo anual',()=>{
 assert.equal(codeFor('4S.1',1,2022),'SEMARNAT.4S.1.001.2022');
 assert.equal(codeFor('11C.20',12,2024),'SEMARNAT.11C.20.012.2024');
 assert.equal(codeFor('4S.1',1000,2022),'SEMARNAT.4S.1.1000.2022');
 assert.deepEqual(parseArchiveNumber('SEMARNAT.4S.1.001.2022','4S.1'),{index:1,year:2022});
 assert.equal(parseArchiveNumber('SEMARNAT.4S.2.001.2022','4S.1'),null);
 assert.equal(parseArchiveNumber('SEMARNAT.4S.1.01.2022','4S.1'),null);
});
test('mismo código: 001 002 003 por año y reinicio anual',()=>{
 const allocated=allocateNumbers([],[
  {id:'DRAFT-1',recordYear:'2022'},
  {id:'DRAFT-2',recordYear:'2022'},
  {id:'DRAFT-3',recordYear:'2023'}
 ],'4S.1');
 assert.deepEqual(allocated,['SEMARNAT.4S.1.001.2022','SEMARNAT.4S.1.002.2022','SEMARNAT.4S.1.001.2023']);
});
test('siguiente disponible desde MySQL; expedientes existentes no se renumeran',()=>{
 const allocated=allocateNumbers([
  'SEMARNAT.4S.1.001.2022','SEMARNAT.4S.1.003.2022',
  'SEMARNAT.4S.1.001.2023','SEMARNAT.4S.2.999.2022'
 ],[
  {id:'REG-25',recordYear:'2022'},
  {id:'DRAFT-5',recordYear:'2022'},
  {id:'DRAFT-6',recordYear:'2023'}
 ],'4S.1');
 assert.deepEqual(allocated,[null,'SEMARNAT.4S.1.004.2022','SEMARNAT.4S.1.002.2023']);
});
test('no permite años o series inválidas',()=>{
 assert.throws(()=>codeFor('4S.1',0,2022));
 assert.throws(()=>allocateNumbers([],[{id:'DRAFT-1',recordYear:'1800'}],'4S.1'),/año válido/);
});

test('el número de expediente del usuario queda independiente de la clave CADIDO calculada',()=>{
 const rows=[{id:'DRAFT-1',recordNumber:'EXP-2026-ABC',recordYear:'2026'}];
 const codes=allocateNumbers([],rows,'1C.15');
 assert.deepEqual(codes,['SEMARNAT.1C.15.001.2026']);
 assert.equal(rows[0].recordNumber,'EXP-2026-ABC');
});
