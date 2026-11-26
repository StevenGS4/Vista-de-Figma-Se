import assert from 'node:assert/strict';
import { normalizePrimarySelection, periodBounds, selectPrimaryRecords } from './primary-inventory-selection.js';

const base={period:'all',stage:'ambos',dateField:'inventory',selection:'all',inventoryIds:[],recordIds:[]};
const period=(period,year,block)=>periodBounds(normalizePrimarySelection({...base,period,year,block}));
assert.deepEqual(period('month',2026,2),['2026-02-01','2026-02-28']);
assert.deepEqual(period('bimester',2026,2),['2026-03-01','2026-04-30']);
assert.deepEqual(period('trimester',2026,3),['2026-07-01','2026-09-30']);
assert.deepEqual(period('fourmonth',2026,2),['2026-05-01','2026-08-31']);
assert.deepEqual(period('semester',2026,2),['2026-07-01','2026-12-31']);
assert.deepEqual(period('fortnight',2026,4),['2026-02-16','2026-02-28']);
assert.deepEqual(period('twoweeks',2026,2),['2026-01-15','2026-01-28']);
assert.deepEqual(period('year',2026,1),['2026-01-01','2026-12-31']);
assert.deepEqual(periodBounds(normalizePrimarySelection({...base,period:'custom',from:'2026-11-01',to:'2026-11-15'})),
 ['2026-11-01','2026-11-15']);
assert.throws(()=>normalizePrimarySelection({...base,period:'custom',from:'2026-11-20',to:'2026-11-01'}),{status:400});
assert.throws(()=>normalizePrimarySelection({...base,selection:'records',recordIds:[]}),{status:400});
assert.throws(()=>normalizePrimarySelection({...base,selection:'mixed',inventoryIds:['INV-A']}),{status:400});
assert.throws(()=>normalizePrimarySelection(base,true),{status:400});
assert.deepEqual(normalizePrimarySelection({...base,recordIds:['REG-12','REG-25']},true).recordIds,['REG-12','REG-25']);

const employee={id:7,areaId:'AREA-A',roles:['Personal de área'],mustChangePassword:false};
const manager={id:8,areaId:'AREA-A',roles:['Encargado de área'],mustChangePassword:false};
const admin={id:1,areaId:'ADMIN',roles:['Administrador / Coordinador'],mustChangePassword:false};
const queries=[];
const fakeDb={
 execute:async(sql,args)=>{
  queries.push({sql,args});
  if(sql.includes('COUNT(*) AS n'))return [[{n:0}]];
  return [[]];
 },
};
await assert.rejects(()=>selectPrimaryRecords(fakeDb,employee,{...base,area:'AREA-B'}),{status:403});
await assert.rejects(()=>selectPrimaryRecords(fakeDb,employee,{...base,creator:'8'}),{status:403});
await assert.rejects(()=>selectPrimaryRecords(fakeDb,manager,{...base,area:'AREA-B'}),{status:403});
await selectPrimaryRecords(fakeDb,employee,base);
assert.ok(queries[0].sql.includes('a.codigo=?')&&queries[0].sql.includes('e.creado_por=?'));
assert.deepEqual(queries[0].args,['AREA-A',7]);
queries.length=0;
await selectPrimaryRecords(fakeDb,manager,base);
assert.ok(queries[0].sql.includes('a.codigo=?'));
assert.ok(!queries[0].sql.includes('e.creado_por=?'));
queries.length=0;
await selectPrimaryRecords(fakeDb,admin,base);
assert.ok(!queries[0].sql.includes('a.codigo=?'));
console.log('OK: periodos, selección y límites de empleado/encargado/administrador.');
