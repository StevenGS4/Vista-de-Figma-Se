import test from 'node:test';
import assert from 'node:assert/strict';
import {roleNames} from '../src/auth-policy.js';
import {canManageLoans,parseLoanSelection,parseReturnItems,validDate} from '../src/loan-policy.js';
test('solo control archivístico y administrador gestionan préstamos',()=>{
 for(const role of [roleNames.PRESTAMOS,roleNames.ADMIN])
  assert.equal(canManageLoans({roles:[role],mustChangePassword:false}),true);
 for(const role of [roleNames.PERSONAL,roleNames.JEFE_AREA])
  assert.equal(canManageLoans({roles:[role],mustChangePassword:false}),false);
 assert.equal(canManageLoans({roles:[roleNames.ADMIN],mustChangePassword:true}),false);
});
test('préstamo individual o inventario completo requieren selección coherente',()=>{
 assert.deepEqual(parseLoanSelection({mode:'INDIVIDUAL',recordIds:['REG-8']}),{mode:'INDIVIDUAL',ids:[8]});
 assert.deepEqual(parseLoanSelection({mode:'INVENTARIO_COMPLETO',recordIds:['REG-8','REG-9']}),{mode:'INVENTARIO_COMPLETO',ids:[8,9]});
 assert.throws(()=>parseLoanSelection({mode:'INDIVIDUAL',recordIds:['REG-8','REG-9']}),/individual/);
 assert.throws(()=>parseLoanSelection({mode:'INVENTARIO_COMPLETO',recordIds:['REG-8','REG-8']}),/duplicados/);
});
test('devoluciones no pueden repetir expedientes y las fechas son reales',()=>{
 assert.deepEqual(parseReturnItems(['REG-1','REG-3']),[1,3]);
 assert.throws(()=>parseReturnItems(['REG-2','REG-2']),/duplicados/);
 assert.equal(validDate('2026-11-12'),true);
 assert.equal(validDate('2026-02-31'),false);
});
