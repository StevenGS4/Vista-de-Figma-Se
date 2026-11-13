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
   COALESCE(p.nombre,'Oficina de Representación') AS parent,
   COALESCE(CONCAT_WS(' ',u.nombres,u.apellido_paterno,u.apellido_materno),'Sin asignar') AS manager
   FROM areas a LEFT JOIN areas p ON p.id=a.superior_id
   LEFT JOIN usuarios u ON u.id=a.encargado_usuario_id
   WHERE a.activo=1 ORDER BY a.nombre`);
  res.json({areas:rows});
 }catch(error){next(error);}
});
