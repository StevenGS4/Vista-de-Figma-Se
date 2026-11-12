import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from './config/database.js';
import { passwordValid, roleNames, hasRole } from './auth-policy.js';

export const authRouter = express.Router();
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) throw new Error('JWT_SECRET debe tener al menos 32 caracteres; configúralo en Backend/.env');
const cookieName = 'semarnat_session';
const cookieOptions = { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' };
const credentialsError = 'Credenciales incorrectas o cuenta inactiva';
export const authCookieName = cookieName;

export async function readUser(id) {
  const [rows] = await pool.execute(
    'SELECT u.id,u.codigo,u.nombres,u.apellido_paterno,u.apellido_materno,u.correo,u.area_id,a.codigo AS area_code,u.estado,u.cambiar_password FROM usuarios u JOIN areas a ON a.id=u.area_id WHERE u.id=? LIMIT 1', [id]);
  if (!rows.length) return null;
  const [roles] = await pool.execute(
    'SELECT r.codigo,r.nombre FROM usuario_roles ur JOIN roles r ON r.id=ur.rol_id WHERE ur.usuario_id=? ORDER BY r.id', [id]);
  return { id: rows[0].id, code: rows[0].codigo, firstName: rows[0].nombres, paternalName: rows[0].apellido_paterno,
    maternalName: rows[0].apellido_materno || '', email: rows[0].correo, areaId: rows[0].area_code,
    roles: roles.map(r => roleNames[r.codigo] || r.nombre), status: rows[0].estado === 'ACTIVO' ? 'Activo' : 'Inactivo',
    mustChangePassword: Boolean(rows[0].cambiar_password) };
}

export async function requireAuth(req,res,next) {
  try {
    const raw = req.cookies?.[cookieName];
    if (!raw) return res.status(401).json({ error: 'Inicia sesión para continuar' });
    const decoded = jwt.verify(raw,jwtSecret,{ algorithms:['HS256'], issuer:'semarnat-backend', audience:'semarnat-web' });
    const [session] = await pool.execute(
      'SELECT id,usuario_id FROM sesiones WHERE token_hash=SHA2(?,256) AND revocado_en IS NULL AND expira_en>NOW() LIMIT 1',
      [raw]);
    if (!session.length || Number(session[0].usuario_id) !== Number(decoded.sub))
      return res.status(401).json({ error:'La sesión ha expirado' });
    const user = await readUser(decoded.sub);
    if (!user || user.status !== 'Activo') return res.status(401).json({ error:'Cuenta inactiva' });
    req.auth = { user, sessionId: session[0].id };
    next();
  } catch (e) {
    if (e.name === 'TokenExpiredError' || e.name === 'JsonWebTokenError') return res.status(401).json({error:'Sesión inválida o expirada'});
    next(e);
  }
}
export function requireAdmin(req,res,next) {
  if (req.auth.user.mustChangePassword) return res.status(403).json({error:'Debes cambiar tu contraseña'});
  if (!hasRole(req.auth.user,roleNames.ADMIN)) return res.status(403).json({error:'Permiso de administrador requerido'});
  next();
}
const sessionSeconds = 2*60*60;
const createToken = (id) => jwt.sign({}, jwtSecret, { algorithm:'HS256', subject:String(id), issuer:'semarnat-backend', audience:'semarnat-web', expiresIn:sessionSeconds });

authRouter.post('/login',async(req,res,next)=>{
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = req.body?.password;
    if (!email || typeof password !== 'string') return res.status(400).json({error:'Correo y contraseña requeridos'});
    const [rows] = await pool.execute('SELECT id,password_hash,estado FROM usuarios WHERE correo=? LIMIT 1',[email]);
    // Evitar respuesta distinta para cuentas inexistentes.
    const dummy = '$2b$12$9gQhQGmOwTuGd5Y9QTXxMu08oMRoBXLPotK1to59nHqOrF5CqC4Hu';
    const ok = await bcrypt.compare(password,rows[0]?.password_hash || dummy);
    if (!rows.length || rows[0].estado !== 'ACTIVO' || !ok) return res.status(401).json({error:credentialsError});
    const token = createToken(rows[0].id);
    await pool.execute('INSERT INTO sesiones(usuario_id,token_hash,expira_en) VALUES (?,SHA2(?,256),DATE_ADD(NOW(), INTERVAL 2 HOUR))',[rows[0].id,token]);
    res.cookie(cookieName,token,{...cookieOptions,maxAge:sessionSeconds*1000});
    res.json({user:await readUser(rows[0].id)});
  } catch(e){next(e);}
});
authRouter.get('/me',requireAuth,(req,res)=>res.json({user:req.auth.user}));
authRouter.post('/logout',requireAuth,async(req,res,next)=>{
  try { await pool.execute('UPDATE sesiones SET revocado_en=NOW() WHERE id=?',[req.auth.sessionId]);
    res.clearCookie(cookieName,cookieOptions);res.json({ok:true}); }catch(e){next(e);}
});
authRouter.post('/change-password',requireAuth,async(req,res,next)=>{
  try {
    const {currentPassword,newPassword} = req.body || {};
    if(typeof currentPassword !== 'string' || !passwordValid(newPassword))
      return res.status(400).json({error:'Usa 8-128 caracteres, mayúscula, minúscula y número'});
    if(currentPassword===newPassword) return res.status(400).json({error:'La nueva contraseña debe ser diferente'});
    const [rows]=await pool.execute('SELECT password_hash FROM usuarios WHERE id=?',[req.auth.user.id]);
    if(!rows.length || !await bcrypt.compare(currentPassword,rows[0].password_hash))
      return res.status(400).json({error:'La contraseña actual es incorrecta'});
    const hash=await bcrypt.hash(newPassword,12);
    await pool.execute('UPDATE usuarios SET password_hash=?,cambiar_password=0 WHERE id=?',[hash,req.auth.user.id]);
    // Invalida otras sesiones al cambiar la clave.
    await pool.execute('UPDATE sesiones SET revocado_en=NOW() WHERE usuario_id=? AND id<>? AND revocado_en IS NULL',
      [req.auth.user.id,req.auth.sessionId]);
    res.json({user:await readUser(req.auth.user.id)});
  } catch(e){next(e);}
});
export { passwordValid, roleNames };
