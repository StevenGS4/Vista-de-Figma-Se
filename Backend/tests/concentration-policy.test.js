import test from 'node:test';
import assert from 'node:assert/strict';
import { roleNames } from '../src/auth-policy.js';
import { concentrationScope,canEditConcentrationLocation,canReadConcentrationRecord,parseLocation } from '../src/concentration-policy.js';

const area='AR-002';
const person={id:'11',areaId:area,roles:[roleNames.PERSONAL],mustChangePassword:false};
const manager={id:'12',areaId:area,roles:[roleNames.JEFE_AREA],mustChangePassword:false};
const clerk={id:'13',areaId:'AR-003',roles:[roleNames.PRESTAMOS],mustChangePassword:false};
const admin={id:'14',areaId:'AR-001',roles:[roleNames.ADMIN],mustChangePassword:false};
test('consulta limitada por etapa, área y creador',()=>{
 const record={areaCode:area,creado_por:11,etapa:'CONCENTRACION'};
 assert.equal(concentrationScope(person),'PROPIO');
 assert.equal(concentrationScope(manager),'AREA');
 assert.equal(concentrationScope(clerk),'GLOBAL');
 assert.equal(canReadConcentrationRecord(person,record),true);
 assert.equal(canReadConcentrationRecord({...person,id:'99'},record),false);
 assert.equal(canReadConcentrationRecord(manager,record),true);
 assert.equal(canReadConcentrationRecord({...manager,areaId:'AR-005'},record),false);
 assert.equal(canReadConcentrationRecord(admin,{...record,etapa:'TRAMITE'}),false);
 assert.equal(canReadConcentrationRecord(clerk,record),true);
 assert.equal(concentrationScope({...admin,mustChangePassword:true}),null);
});
test('solo el administrador actualiza ubicación después de la recepción',()=>{
 assert.equal(canEditConcentrationLocation(clerk),false);
 assert.equal(canEditConcentrationLocation(admin),true);
 assert.equal(canEditConcentrationLocation(manager),false);
 assert.equal(canEditConcentrationLocation(person),false);
 assert.equal(canEditConcentrationLocation({...clerk,mustChangePassword:true}),false);
});
test('ubicación requiere zona sala y posiciones válidas; no cambia etapa',()=>{
 const location={archiveZone:'Zona general',room:'Sala 1',shelf:'25',level:'4',physicalSection:'1',
 position:'C-04',locationBox:'8',locationNotes:'Sin novedades',stage:'Archivo de trámite',availability:'Prestado'};
 assert.deepEqual(parseLocation(location),{archiveZone:'Zona general',room:'Sala 1',shelf:25,level:4,
 physicalSection:1,position:'C-04',locationBox:'8',locationNotes:'Sin novedades'});
 assert.throws(()=>parseLocation({...location,shelf:26}),/rango/);
 assert.throws(()=>parseLocation({...location,room:''}),/room/);
 assert.throws(()=>parseLocation({...location,physicalSection:0}),/rango/);
});
