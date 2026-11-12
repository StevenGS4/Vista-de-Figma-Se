import test from 'node:test';
import assert from 'node:assert/strict';
import { inventoryScope,hasInventoryAccess,validSupport,hasCommonHeader } from '../src/inventory-policy.js';
import { roleNames } from '../src/auth-policy.js';
test('roles delimitan acceso a inventarios',()=>{
 const owner={id:'11',areaId:'AR-002',roles:[roleNames.PERSONAL],mustChangePassword:false};
 const head={id:'12',areaId:'AR-002',roles:[roleNames.JEFE_AREA],mustChangePassword:false};
 const loan={id:'13',areaId:'AR-002',roles:[roleNames.PRESTAMOS],mustChangePassword:false};
 const admin={id:'14',areaId:'AR-001',roles:[roleNames.ADMIN],mustChangePassword:false};
 const inventory={area_code:'AR-002',creado_por:11};
 assert.equal(inventoryScope(owner),'PROPIO');assert.equal(inventoryScope(head),'AREA');
 assert.equal(inventoryScope(loan),null);assert.equal(inventoryScope(admin),'GLOBAL');
 assert.equal(hasInventoryAccess(owner,'PROPIO',inventory),true);
 assert.equal(hasInventoryAccess({...owner,id:'15'},'PROPIO',inventory),false);
 assert.equal(hasInventoryAccess(head,'AREA',inventory),true);
 assert.equal(hasInventoryAccess({...head,areaId:'AR-005'},'AREA',inventory),false);
 assert.equal(hasInventoryAccess(admin,'GLOBAL',inventory),true);
 assert.equal(inventoryScope({...admin,mustChangePassword:true}),null);
});
test('filas comparten encabezado documental',()=>{
 const a={inventoryId:'INV-1',areaId:'AR-002',cadidoSectionId:'SEC-1',cadidoSeriesId:'SER-5'};
 assert.equal(hasCommonHeader([a,{...a}]),true);
 assert.equal(hasCommonHeader([a,{...a,cadidoSeriesId:'SER-6'}]),false);
 assert.equal(hasCommonHeader([]),false);
});
test('admite soporte mixto',()=>{
 assert.equal(validSupport('Físico'),true);assert.equal(validSupport('Electrónico'),true);
 assert.equal(validSupport('Mixto'),true);assert.equal(validSupport('Otro'),false);
});
