import test from 'node:test';
import assert from 'node:assert/strict';
import {roleNames} from '../src/auth-policy.js';
import {canSubmitTransfer,canApproveArea,canReviewAdmin,canReceiveTransfer,canViewTransfer,canManageAreaTransfer,canViewTransferDocument,uniqueInventoryFolios} from '../src/transfer-policy.js';
const own={id:'10',areaId:'AR-002',roles:[roleNames.PERSONAL],mustChangePassword:false};
const boss={id:'12',areaId:'AR-002',roles:[roleNames.JEFE_AREA],mustChangePassword:false};
const admin={id:'13',areaId:'AR-001',roles:[roleNames.ADMIN],mustChangePassword:false};
const transfer={solicitante_id:10,areaCode:'AR-002',estado:'PENDIENTE_VB',visto_bueno_por:null};
test('el personal, el encargado y el administrador pueden preparar',()=>{
 assert.equal(canSubmitTransfer(own),true);assert.equal(canSubmitTransfer(boss),true);
 assert.equal(canSubmitTransfer(admin),true);
 assert.equal(canSubmitTransfer({...own,mustChangePassword:true}),false);
});
test('visto bueno por encargado del área o administrador, incluso en su propia solicitud',()=>{
 assert.equal(canApproveArea(boss,transfer),true);
 assert.equal(canApproveArea(admin,transfer),true);
 assert.equal(canApproveArea({...admin,id:10},transfer),true);
 assert.equal(canApproveArea({...boss,id:10},transfer),true);
 assert.equal(canApproveArea({...boss,areaId:'AR-005'},transfer),false);
 assert.equal(canApproveArea(boss,{...transfer,estado:'ACEPTADA'}),false);
});
test('administrador emite dictamen tras el visto bueno, también en solicitudes propias',()=>{
 assert.equal(canReviewAdmin(admin,{...transfer,estado:'PENDIENTE_ADMIN',visto_bueno_por:12}),true);
 assert.equal(canReviewAdmin({...admin,id:10},{...transfer,estado:'PENDIENTE_ADMIN',visto_bueno_por:12}),true);
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

test('el solicitante empleado conserva sus documentos iniciales y la gestión corresponde al responsable',()=>{
 assert.equal(canManageAreaTransfer(own,transfer),false);
 assert.equal(canManageAreaTransfer(boss,transfer),true);
 assert.equal(canManageAreaTransfer({...boss,areaId:'AR-004'},transfer),false);
 assert.equal(canManageAreaTransfer(admin,transfer),false);
 assert.equal(canManageAreaTransfer(admin,{...transfer,solicitante_id:13}),true);
 assert.equal(canViewTransferDocument(own,'SOLICITUD'),true);
 assert.equal(canViewTransferDocument(own,'ACUSE_SOLICITUD'),true);
 for(const kind of ['AUTORIZACION','DICTAMEN_FAVORABLE','NOTA_TRASLADO','ACUSE_TRASLADO','ENTREGA','FORMATO_FIRMADO']){
  assert.equal(canViewTransferDocument(own,kind),false);
  assert.equal(canViewTransferDocument(boss,kind),true);
  assert.equal(canViewTransferDocument(admin,kind),true);
 }
});
