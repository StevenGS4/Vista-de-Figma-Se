import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_HOST ||= 'localhost';
process.env.DB_USER ||= 'test';
process.env.DB_NAME ||= 'test';
process.env.JWT_SECRET ||= 'test-placeholder-with-at-least-32-characters';

const {readLoans}=await import('../src/loans.js');

test('carga 1,000 préstamos en tres consultas y conserva expedientes, devoluciones e historial',async()=>{
 const headers=Array.from({length:1000},(_,index)=>({
  id:1000-index,folio:'PRE-'+(1000-index),estado:'ACTIVO'
 }));
 const ids=headers.map(row=>row.id);
 let calls=0;
 const db={execute:async(sql,args)=>{
  calls++;
  if(calls===1){
   assert.match(sql,/ORDER BY p.id DESC LIMIT 2000/);
   return [headers];
  }
  assert.deepEqual(args,ids);
  if(calls===2)return [[
   ...ids.map(id=>({prestamo_id:String(id),expediente_id:id,numero_expediente:'EXP-'+id})),
   {prestamo_id:1000,expediente_id:1001,returnedDate:'2026-11-26',returnedBy:'Encargado'},
  ]];
  if(calls===3)return [[{prestamo_id:1000,id:42,expediente_id:1001,accion:'DEVOLUCION',moveDate:'2026-11-26'}]];
  assert.fail('Consulta inesperada');
 }};
 const loans=await readLoans(db);
 assert.equal(calls,3);
 assert.deepEqual(loans.map(loan=>loan.id),ids.map(id=>'LOAN-'+id));
 assert.deepEqual(loans[0].recordIds,['REG-1000']);
 assert.deepEqual(loans[0].deliveredRecordIds,['REG-1000','REG-1001']);
 assert.equal(loans[0].returnReceivedBy,'Encargado');
 assert.equal(loans[0].history[0].type,'Devolución');
 assert.deepEqual(loans[1].history,[]);
 assert.equal(loans[999].items[0].number,'EXP-1');
});

test('una bandeja vacía no consulta expedientes ni movimientos',async()=>{
 let calls=0;
 assert.deepEqual(await readLoans({execute:async()=>{calls++;return [[]];}}),[]);
 assert.equal(calls,1);
});
