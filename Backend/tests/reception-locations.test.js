import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSharedReceptionLocation} from '../src/reception-locations.js';

const shared={
 archiveZone:'Archivo de concentración',room:'Sótano',
 shelf:'2',level:'1',physicalSection:'3',
 position:'B2',locationBox:'004',locationNotes:'Inventario recibido completo'
};

test('una ubicación se valida una sola vez para 1, 4 o 1000 expedientes',()=>{
 for(const size of [1,4,1000]){
  const ids=Array.from({length:size},(_,i)=>i+1);
  const result=validateSharedReceptionLocation(shared,ids);
  assert.equal(result.room,'Sótano');
  assert.equal(result.shelf,2);
  assert.equal(result.level,1);
  assert.equal(result.physicalSection,3);
 }
});
test('no permite ubicación inválida, transferencia vacía ni identificadores duplicados',()=>{
 assert.throws(()=>validateSharedReceptionLocation({...shared,shelf:''},[1]),/Ubicación física/);
 assert.throws(()=>validateSharedReceptionLocation(null,[1]),/Ubicación física/);
 assert.throws(()=>validateSharedReceptionLocation(shared,[]),/no contiene expedientes/);
 assert.throws(()=>validateSharedReceptionLocation(shared,[1,1]),/no son válidos/);
});
