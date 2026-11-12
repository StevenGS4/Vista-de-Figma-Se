import test from 'node:test';
import assert from 'node:assert/strict';
import {roleNames} from '../src/auth-policy.js';
import {canSubmitTransfer,canApproveArea,canReviewAdmin,canReceiveTransfer,canViewTransfer,uniqueInventoryFolios} from '../src/transfer-policy.js';
const own={id:'10',areaId:'AR-002',roles:[roleNames.PERSONAL],mustChangePassword:false};
const boss={id:'12',areaId:'AR-002',roles:[roleNames.JEFE_AREA],mustChangePassword:false};
const admin={id:'13',areaId:'AR-001',roles:[roleNames.ADMIN],mustChangePassword:false};
const transfer={solicitante_id:10,areaCode:'AR-002',estado:'PENDIENTE_VB',visto_bueno_por:null};
test('el emisor y el jefe pueden preparar, pero no el administrador',()=>{
 assert.equal(canSubmitTransfer(own),true);assert.equal(canSubmitTransfer(boss),true);
 assert.equal(canSubmitTransfer(admin),false);
 assert.equal(canSubmitTransfer({...own,mustChangePassword:true}),false);
});
test('visto bueno requiere encargado distinto del emisor y misma área',()=>{
 assert.equal(canApproveArea(boss,transfer),true);
 assert.equal(canApproveArea({...boss,id:10},transfer),false);
 assert.equal(canApproveArea({...boss,areaId:'AR-005'},transfer),false);
 assert.equal(canApproveArea(boss,{...transfer,estado:'ACEPTADA'}),false);
});
test('administrador acepta únicamente tras visto bueno; no se autoaprueba',()=>{
 assert.equal(canReviewAdmin(admin,{...transfer,estado:'PENDIENTE_ADMIN',visto_bueno_por:12}),true);
 assert.equal(canReviewAdmin({...admin,id:10},{...transfer,estado:'PENDIENTE_ADMIN',visto_bueno_por:12}),false);
 assert.equal(canReviewAdmin(admin,{...transfer,estado:'PENDIENTE_ADMIN'}),false);
 assert.equal(canReceiveTransfer(admin,{...transfer,estado:'ACEPTADA'}),true);
 assert.equal(canReceiveTransfer(admin,transfer),false);
});
test('acceso por área, autor y admin',()=>{
 assert.equal(canViewTransfer(own,transfer),true);
 assert.equal(canViewTransfer({...own,id:20},transfer),false);
 assert.equal(canViewTransfer(boss,transfer),true);
 assert.equal(canViewTransfer({...boss,areaId:'AR-004'},transfer),false);
 assert.equal(canViewTransfer(admin,transfer),true);
});
test('solo folios únicos de inventarios completos',()=>{
 assert.deepEqual(uniqueInventoryFolios(['INV-A','INV-B']),['INV-A','INV-B']);
 assert.equal(uniqueInventoryFolios(['INV-A','INV-A']),null);
 assert.equal(uniqueInventoryFolios([]),null);
});
