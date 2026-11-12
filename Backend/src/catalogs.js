import express from 'express';
import { pool } from './config/database.js';
import { requireAuth } from './auth.js';

export const catalogsRouter=express.Router();
catalogsRouter.use(requireAuth);
catalogsRouter.get('/areas',async(req,res,next)=>{
 try{
  if(req.auth.user.mustChangePassword)
   return res.status(403).json({error:'Debes cambiar tu contraseña'});
  const [rows]=await pool.query(`SELECT a.codigo AS id,a.nombre AS name,
   COALESCE(p.nombre,'Oficina de Representación') AS parent
   FROM areas a LEFT JOIN areas p ON p.id=a.superior_id
   WHERE a.activo=1 ORDER BY a.nombre`);
  res.json({areas:rows.map(row=>({...row,manager:''}))});
 }catch(error){next(error);}
});
