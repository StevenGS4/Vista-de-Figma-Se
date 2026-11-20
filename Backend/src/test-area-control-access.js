import assert from 'node:assert/strict';
import { pool } from './config/database.js';
import { areaControlRouter, scope } from './area-control.js';

const manager={id:'12',areaId:'AREA-ONE',roles:['Encargado de área'],mustChangePassword:false};
const admin={id:'1',areaId:'ADMIN',roles:['Administrador / Coordinador'],mustChangePassword:false};
const employee={id:'3',areaId:'AREA-ONE',roles:['Personal de área'],mustChangePassword:false};

assert.deepEqual(scope(manager),{admin:false,area:'AREA-ONE'});
assert.deepEqual(scope(admin),{admin:true});
assert.throws(()=>scope(employee),{status:403});
assert.throws(()=>scope({...manager,mustChangePassword:true}),{status:403});

const detailRoute=areaControlRouter.stack
  .find(layer=>layer.route?.path==='/usuarios/:id')?.route.stack[0]?.handle;
assert.equal(typeof detailRoute,'function');
const original=pool.execute;
let requested=0;
pool.execute=async(_query,params)=>{
  requested++;
  assert.equal(params[0],29);
  return [[{id:29,areaCode:'AREA-TWO'}]];
};
try{
  let raised;
  await detailRoute({auth:{user:manager},params:{id:'29'}},
    {set(){},json(){throw new Error('El detalle de otra área no debe mostrarse');}},
    error=>{raised=error;});
  assert.equal(raised?.status,403);
  assert.match(raised?.message||'',/fuera de tu área/i);
  assert.equal(requested,1);
}finally{pool.execute=original;}
console.log('OK: el encargado no puede consultar personal de otra área, y el empleado no accede al módulo.');
