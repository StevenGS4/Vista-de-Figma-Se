import test from 'node:test';
import assert from 'node:assert/strict';
import { roleNames } from '../src/auth-policy.js';

process.env.DB_HOST ||= 'localhost';
process.env.DB_USER ||= 'test';
process.env.DB_NAME ||= 'test';
const { pool } = await import('../src/config/database.js');
const { noticeScope, recordSessionActivity, saveNotices } = await import('../src/profile-activity.js');

test('el historial se limita al rol asignado y a su área',()=>{
 const user={areaId:'AREA-1',roles:[roleNames.JEFE_AREA]};
 assert.equal(noticeScope(user,roleNames.JEFE_AREA),roleNames.JEFE_AREA+'|AREA-1');
 assert.throws(()=>noticeScope(user,roleNames.ADMIN),{status:403});
 assert.throws(()=>noticeScope({...user,mustChangePassword:true},roleNames.JEFE_AREA),{status:403});
});

test('actualizar el contenido del aviso conserva la marca de lectura',async t=>{
 const calls=[];
 t.mock.method(pool,'execute',async(sql,args)=>{calls.push({sql,args});return [];});
 await saveNotices(7,[['',[{id:'requester-loan-1',title:'Préstamo'}]]]);
 assert.equal(calls.length,1);
 assert.match(calls[0].sql,/ON DUPLICATE KEY UPDATE contenido=VALUES\(contenido\)/);
 assert.doesNotMatch(calls[0].sql,/revisada_en/);
 assert.deepEqual(calls[0].args.slice(0,3),[7,'','requester-loan-1']);
});

test('una actividad reanuda o inicia otro periodo en la misma sesión según la pausa',async t=>{
 let comparison;
 let calls=[];
 let closed=false;
 t.mock.method(pool,'getConnection',async()=>({
  async beginTransaction(){},async rollback(){},async commit(){},release(){},
  async execute(sql,args){
   calls.push({sql,args});
   if(sql.includes('FROM sesiones'))return [closed?[]:[{id:5}]];
   if(sql.includes('TIMESTAMPDIFF'))return [comparison==null?[]:[{id:20,gap:comparison}]];
   return [{affectedRows:1}];
  },
 }));
 const auth={user:{id:8},sessionId:5};
 assert.equal(await recordSessionActivity(auth),true);
 assert.match(calls.at(-1).sql,/INSERT INTO usuario_actividad_sesion/);
 assert.deepEqual(calls.at(-1).args,[8,5]);
 comparison=60;
 assert.equal(await recordSessionActivity(auth),true);
 assert.match(calls.at(-1).sql,/UPDATE usuario_actividad_sesion/);
 comparison=301;
 assert.equal(await recordSessionActivity(auth),true);
 assert.match(calls.at(-1).sql,/INSERT INTO usuario_actividad_sesion/);
 calls=[];
 closed=true;
 assert.equal(await recordSessionActivity(auth),false);
 assert.equal(calls.length,1);
});
