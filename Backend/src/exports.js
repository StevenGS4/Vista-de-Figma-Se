import express from 'express';
import { pool } from './config/database.js';
import { requireAuth } from './auth.js';
import { readRecords } from './tramite.js';
import { exportTypes, exportScope, stageForType } from './export-policy.js';
import { makeInventoryWorkbook, makeTransferWorkbook } from './export-workbooks.js';
const limitRows=15000;

export const exportsRouter=express.Router();
exportsRouter.use(requireAuth);
const fail=(m,status=400)=>Object.assign(new Error(m),{status});
const oneType=(value)=>{
 if(!Object.hasOwn(exportTypes,value))throw fail('Tipo de inventario inválido');
 return value;
};
async function scopedRows(user,type,folio){
 const scope=exportScope(user,type);
 if(!scope)throw fail('No tienes permiso para exportar este inventario',403);
 const filters=['e.etapa=?'];
 const params=[stageForType(type)];
 if(scope!=='GLOBAL'){filters.push('a.codigo=?');params.push(user.areaId);}
 if(scope==='PROPIO'){filters.push('i.creado_por=?');params.push(user.id);}
 if(folio){filters.push('i.folio=?');params.push(folio);}
 if(type==='transferencia')filters.push("i.estado='TRAMITE'");
 const [count]=await pool.execute(`SELECT COUNT(*) AS n
 FROM expedientes e JOIN inventarios i ON i.id=e.inventario_id
 JOIN areas a ON a.id=i.area_id WHERE ${filters.join(' AND ')}`,params);
 if(Number(count[0].n)>limitRows)throw fail('Exportación demasiado grande; reduce los filtros',413);
 return readRecords(pool,'WHERE '+filters.join(' AND '),params);
}
async function sendXlsx(book,res,filename,actorId,detail){
 const bytes=await book.xlsx.writeBuffer();
 // La descarga no debe fallar si la bitácora experimenta un error aislado.
 try {
  await pool.execute('INSERT INTO auditoria(actor_id,entidad,entidad_id,accion,detalle) VALUES (?,?,?,?,?)',
   [actorId,'exportaciones',0,'DESCARGAR',JSON.stringify(detail)]);
 } catch(error) {
  console.error('No se pudo auditar la descarga Excel:',error.code||error.message);
 }
 res.set('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
 res.set('Content-Disposition',`attachment; filename="${filename}"`);
 res.set('Cache-Control','private, no-store');
 res.send(Buffer.from(bytes));
}
exportsRouter.get('/transferencia.xlsx',async(req,res,next)=>{
 try{
  const records=await scopedRows(req.auth.user,'transferencia');
  await sendXlsx(makeTransferWorkbook(records),res,'relacion_transferencia_primaria.xlsx',req.auth.user.id,{type:'transferencia'});
 }catch(e){next(e);}
});
exportsRouter.get('/:type/:folio.xlsx',async(req,res,next)=>{
 try{
  const type=oneType(req.params.type);
  if(type==='transferencia'){
   const folio=String(req.params.folio||'');
   if(!/^[a-zA-Z0-9_-]{1,65}$/.test(folio))throw fail('Folio inválido');
   const records=await scopedRows(req.auth.user,'transferencia',folio);
   if(!records.length)throw fail('Inventario no encontrado o no elegible',404);
   return await sendXlsx(makeTransferWorkbook(records),res,`relacion_transferencia_${folio}.xlsx`,req.auth.user.id,{type:'transferencia',folio});
  }
  const folio=String(req.params.folio||'');
  if(!/^[a-zA-Z0-9_-]{1,65}$/.test(folio))throw fail('Folio inválido');
  const records=await scopedRows(req.auth.user,type,folio);
  if(!records.length)throw fail('Inventario no encontrado o fuera de tu alcance',404);
  await sendXlsx(makeInventoryWorkbook(records,type),res,
   `inventario_${type}_${folio}.xlsx`,req.auth.user.id,{type,folio});
 }catch(e){next(e);}
});
exportsRouter.get('/:type.xlsx',async(req,res,next)=>{
 try{
  const type=oneType(req.params.type);
  if(type==='transferencia')throw fail('Utiliza /transferencia.xlsx');
  const records=await scopedRows(req.auth.user,type);
  await sendXlsx(makeInventoryWorkbook(records,type),res,`inventarios_${type}.xlsx`,req.auth.user.id,{type});
 }catch(e){next(e);}
});
