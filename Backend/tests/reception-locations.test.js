import test from 'node:test';
import assert from 'node:assert/strict';
import {validateReceptionLocations} from '../src/reception-locations.js';

const record=(id,overrides={})=>({
 id:'REG-'+id,archiveZone:'Archivo de concentración',room:'Sótano',shelf:'2',
 level:'1',physicalSection:'3',position:'B2',locationBox:'004',locationNotes:'',
 ...overrides
});
test('recepción válida exige posición para todos y conserva sus IDs',()=>{
 const located=validateReceptionLocations([record(10),record(11,{room:'Depósito 2'})],[10,11]);
 assert.equal(located.length,2);
 assert.deepEqual(located.map(x=>x.id),[10,11]);
 assert.equal(located[0].room,'Sótano');
 assert.equal(located[0].shelf,2);
});
test('no acepta ubicación parcial, repetida ni de otro expediente',()=>{
 assert.throws(()=>validateReceptionLocations([record(10)],[10,11]),/todos/);
 assert.throws(()=>validateReceptionLocations([record(10),record(10)],[10,11]),/corresponden/);
 assert.throws(()=>validateReceptionLocations([record(10),record(12)],[10,11]),/corresponden/);
 assert.throws(()=>validateReceptionLocations([record(10,{shelf:''}),record(11)],[10,11]),/Ubicación de expediente 10/);
});
test('no permite estado de ubicación sin identificación correcta',()=>{
 assert.throws(()=>validateReceptionLocations([record(10,{id:'10'})],[10]),/Identificador/);
 assert.throws(()=>validateReceptionLocations([],[]),/Captura/);
});
