import express from 'express';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { pool } from './config/database.js';
import { requireAuth,requireAdmin,readUser,passwordValid,roleNames } from './auth.js';

export const usersRouter=express.Router();
usersRouter.use(requireAuth,requireAdmin);
const allowedRoles=new Set(Object.values(roleNames));
const isValidEmail=e=>typeof e==='string'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)&&e.length<=254;
const validate=data=>{
 if(typeof data.firstName!=='string'||!data.firstName.trim()||typeof data.paternalName!=='string'||!data.paternalName.trim()) return 'Nombre y apellido paterno son obligatorios';
 if(!isValidEmail(data.email)) return 'Correo inválido';
 if(typeof data.areaId!=='string'||!data.areaId.trim()) return 'Área inválida';
 if(!Array.isArray(data.roles)||!data.roles.length||data.roles.some(r=>!allowedRoles.has(r))) return 'Roles inválidos';
 if(!['Activo','Inactivo'].includes(data.status)) return 'Estado inválido';
 return null;
};
usersRouter.get('/areas',async(_req,res,next)=>{
 try {const [rows]=await pool.query('SELECT id,codigo,nombre,superior_id,activo FROM areas ORDER BY nombre');res.json({areas:rows});}catch(e){next(e);}
});
usersRouter.get('/role-permissions',async(_req,res,next)=>{
 try {const [rows]=await pool.query('SELECT r.nombre AS role,p.permiso_codigo AS permission FROM rol_permisos p JOIN roles r ON r.id=p.rol_id ORDER BY r.id');res.json({permissions:rows});}catch(e){next(e);}
});
usersRouter.get('/',async(_req,res,next)=>{
 try {const [rows]=await pool.query('SELECT id FROM usuarios ORDER BY id');const users=await Promise.all(rows.map(r=>readUser(r.id)));res.json({users});}catch(e){next(e);}
});
usersRouter.post('/',async(req,res,next)=>{
 const data=req.body||{};const issue=validate(data);
 if(issue||!passwordValid(data.password)) return res.status(400).json({error:issue||'La contraseña debe tener entre 8 y 128 caracteres, al menos una mayúscula, una minúscula y un número.'});
 const conn=await pool.getConnection();
 try {
   await conn.beginTransaction();
   const [area]=await conn.execute('SELECT id FROM areas WHERE codigo=? AND activo=1',[data.areaId]);
   if(!area.length) throw Object.assign(new Error('Área inexistente o inactiva'),{status:400});
   const code='USR-'+randomUUID().slice(0,20);
   const hash=await bcrypt.hash(data.password,12);
   const [result]=await conn.execute(`INSERT INTO usuarios(codigo,nombres,apellido_paterno,apellido_materno,correo,password_hash,area_id,estado,cambiar_password)
      VALUES(?,?,?,?,?,?,?,?,1)`,[code,data.firstName.trim(),data.paternalName.trim(),String(data.maternalName||'').trim(),
      data.email.trim().toLowerCase(),hash,area[0].id,data.status==='Activo'?'ACTIVO':'INACTIVO']);
   const [known]=await conn.query('SELECT id,nombre FROM roles');
   for(const role of [...new Set(data.roles)]) {
     const item=known.find(r=>r.nombre===role);if(!item) throw Object.assign(new Error('Rol inválido'),{status:400});
     await conn.execute('INSERT INTO usuario_roles(usuario_id,rol_id) VALUES (?,?)',[result.insertId,item.id]);
   }
   await conn.commit();res.status(201).json({user:await readUser(result.insertId)});
 }catch(e){await conn.rollback();if(e.code==='ER_DUP_ENTRY')return res.status(409).json({error:'Ya existe un usuario con ese correo'});next(e);}
 finally{conn.release();}
});
usersRouter.put('/:id',async(req,res,next)=>{
 const id=Number(req.params.id),data=req.body||{},issue=validate(data);
 if(!Number.isSafeInteger(id)||id<1||issue) return res.status(400).json({error:issue||'Usuario inválido'});
 if(data.password && !passwordValid(data.password))return res.status(400).json({error:'Contraseña inválida'});
 const conn=await pool.getConnection();
 try {
   await conn.beginTransaction();
   const [existing]=await conn.execute('SELECT id FROM usuarios WHERE id=? FOR UPDATE',[id]);
   if(!existing.length)throw Object.assign(new Error('Usuario no encontrado'),{status:404});
   const [area]=await conn.execute('SELECT id FROM areas WHERE codigo=? AND activo=1',[data.areaId]);
   if(!area.length)throw Object.assign(new Error('Área inválida'),{status:400});
   const [known]=await conn.query('SELECT id,nombre FROM roles');
   for(const r of data.roles)if(!known.some(x=>x.nombre===r))throw Object.assign(new Error('Rol inválido'),{status:400});
   await conn.execute(`UPDATE usuarios SET nombres=?,apellido_paterno=?,apellido_materno=?,correo=?,area_id=?,estado=?
      WHERE id=?`,[data.firstName.trim(),data.paternalName.trim(),String(data.maternalName||'').trim(),
      data.email.trim().toLowerCase(),area[0].id,data.status==='Activo'?'ACTIVO':'INACTIVO',id]);
   if(data.password){
     await conn.execute('UPDATE usuarios SET password_hash=?,cambiar_password=1 WHERE id=?',[await bcrypt.hash(data.password,12),id]);
   }
   await conn.execute('DELETE FROM usuario_roles WHERE usuario_id=?',[id]);
   for(const r of [...new Set(data.roles)]){
     const role=known.find(x=>x.nombre===r);
     await conn.execute('INSERT INTO usuario_roles(usuario_id,rol_id) VALUES (?,?)',[id,role.id]);
   }
   await conn.execute('UPDATE sesiones SET revocado_en=NOW() WHERE usuario_id=? AND revocado_en IS NULL',[id]);
   await conn.commit();res.json({user:await readUser(id)});
 }catch(e){await conn.rollback();if(e.code==='ER_DUP_ENTRY')return res.status(409).json({error:'Correo duplicado'});next(e);}
 finally{conn.release();}
});
