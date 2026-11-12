import express from 'express';
import { pool } from './config/database.js';
import { requireAuth } from './auth.js';
import { readRecords } from './tramite.js';
import { exportTypes, exportScope, stageForType } from './export-policy.js';

export const exportsRouter=express.Router();
exportsRouter.use(requireAuth);
const fail=(m,status=400)=>Object.assign(new Error(m),{status});
const oneType=(value)=>{
 if(!Object.hasOwn(exportTypes,value))throw fail('Tipo de inventario inválido');
 return value;
};
import { makeInventoryWorkbook, makeTransferWorkbook } from './export-workbooks.js';
async function scopedRows(user,type,folio){
 const scope=exportScope(user,type);
 if(!scope)throw fail('No tienes permiso para exportar este inventario',403);
 const filters=['e.etapa=?'];
 const params=[stageForType(type)];
 if(scope!=='GLOBAL'){filters.push('a.codigo=?');params.push(user.areaId);}
 if(scope==='PROPIO'){filters.push('i.creado_por=?');params.push(user.id);}
 if(folio){filters.push('i.folio=?');params.push(folio);}
 if(folio){filters.push('i.folio=?');params.push(folio);}
 const [count]=await pool.execute(`SELECT COUNT(*) AS n
 FROM expedientes e JOIN inventarios i ON i.id=e.inventario_id
 JOIN areas a ON a.id=i.area_id WHERE ${filters.join(' AND ')}`,params);
 if(Number(count[0].n)>limitRows)throw fail('Exportación demasiado grande; reduce los filtros',413);
 return readRecords(pool,'WHERE '+filters.join(' AND '),params);
}
async function relationRows(user,folio=null){
 const scope=exportScope(user,'transferencia');
 if(!scope)throw fail('No tienes permiso para exportar la relación de transferencia',403);
 const filters=["i.estado='TRAMITE'"];
 const params=[];
 if(scope!=='GLOBAL'){filters.push('a.codigo=?');params.push(user.areaId);}
 if(scope==='PROPIO'){filters.push('i.creado_por=?');params.push(user.id);}
 const [rows]=await pool.execute(`SELECT i.folio,a.codigo AS area_code,i.unidad_administrativa,
 i.responsable_nombre,i.responsable_cargo,i.fondo,sec.codigo AS seccion_codigo,
 ser.codigo AS serie_codigo,DATE_FORMAT(i.fecha_elaboracion,'%Y-%m-%d') AS fecha_elaboracion,
 COUNT(e.id) AS total_expedientes,
 DATE_FORMAT(MIN(e.apertura),'%Y-%m-%d') AS apertura_inicial,
 DATE_FORMAT(MAX(e.apertura),'%Y-%m-%d') AS apertura_final,
 i.estado
 FROM inventarios i JOIN areas a ON a.id=i.area_id
 JOIN secciones_cadido sec ON sec.id=i.seccion_id
 JOIN series_cadido ser ON ser.id=i.serie_id
 JOIN expedientes e ON e.inventario_id=i.id
 WHERE ${filters.join(' AND ')}
 GROUP BY i.id,i.folio,a.codigo,i.unidad_administrativa,i.responsable_nombre,
 i.responsable_cargo,i.fondo,sec.codigo,ser.codigo,i.fecha_elaboracion,i.estado
 ORDER BY a.codigo,i.folio LIMIT 15001`,params);
 if(rows.length>limitRows)throw fail('Demasiados inventarios; aplica filtros',413);
 return rows;
}
async function sendXlsx(book,res,filename){
 const bytes=await book.xlsx.writeBuffer();
 res.set('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
 res.set('Content-Disposition',`attachment; filename="${filename}"`);
 res.set('Cache-Control','private, no-store');
 res.send(Buffer.from(bytes));
}
exportsRouter.get('/transferencia.xlsx',async(req,res,next)=>{
 try{
  const rows=await relationRows(req.auth.user);
  await sendXlsx(makeTransferWorkbook(rows),res,'relacion_transferencia_primaria.xlsx');
 }catch(e){next(e);}
});
exportsRouter.get('/:type/:folio.xlsx',async(req,res,next)=>{
 try{
  const type=oneType(req.params.type);
  if(type==='transferencia'){
   const folio=String(req.params.folio||'');
   if(!/^[a-zA-Z0-9_-]{1,65}$/.test(folio))throw fail('Folio inválido');
   const rows=await relationRows(req.auth.user,folio);
   if(!rows.length)throw fail('Inventario no encontrado o no elegible',404);
   return await sendXlsx(makeTransferWorkbook(rows),res,`relacion_transferencia_${folio}.xlsx`);
  }
  const folio=String(req.params.folio||'');
  if(!/^[a-zA-Z0-9_-]{1,65}$/.test(folio))throw fail('Folio inválido');
  const records=await scopedRows(req.auth.user,type,folio);
  if(!records.length)throw fail('Inventario no encontrado o fuera de tu alcance',404);
  await sendXlsx(makeInventoryWorkbook(records,type),res,
   `inventario_${type}_${folio}.xlsx`);
 }catch(e){next(e);}
});
exportsRouter.get('/:type.xlsx',async(req,res,next)=>{
 try{
  const type=oneType(req.params.type);
  if(type==='transferencia')throw fail('Utiliza /transferencia.xlsx');
  const records=await scopedRows(req.auth.user,type);
  await sendXlsx(makeInventoryWorkbook(records,type),res,`inventarios_${type}.xlsx`);
 }catch(e){next(e);}
});
