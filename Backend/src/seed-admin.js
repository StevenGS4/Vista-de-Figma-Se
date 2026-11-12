import 'dotenv/config';
import bcrypt from 'bcrypt';
import { pool } from './config/database.js';
// Semilla local explícita. La contraseña SOLO se lee de variables de entorno.
// No crea una cuenta administrativa con contraseña fija.
const { BOOTSTRAP_ADMIN_EMAIL:email, BOOTSTRAP_ADMIN_PASSWORD:password }=process.env;
if(!email||!password||password.length<12||!/[A-Z]/.test(password)||!/[a-z]/.test(password)||!/\d/.test(password)){
 console.error('Configura BOOTSTRAP_ADMIN_EMAIL y BOOTSTRAP_ADMIN_PASSWORD (mínimo 12 caracteres, mayúscula, minúscula, número).');
 process.exit(1);
}
let conn;
try{
 conn=await pool.getConnection();await conn.beginTransaction();
 const [area]=await conn.execute('SELECT id FROM areas WHERE codigo=?',['SEMARNAT-ADMIN']);
 let areaId=area[0]?.id;
 if(!areaId){const [r]=await conn.execute('INSERT INTO areas(codigo,nombre) VALUES (?,?)',['SEMARNAT-ADMIN','Área de administración (demostración)']);areaId=r.insertId;}
 const [old]=await conn.execute('SELECT id FROM usuarios WHERE correo=?',[email.toLowerCase()]);
 if(old.length){console.log('Ya existe la cuenta; no se modificó la contraseña.');await conn.rollback();}
 else{
  const hash=await bcrypt.hash(password,12);
  const [r]=await conn.execute(`INSERT INTO usuarios(codigo,nombres,apellido_paterno,correo,password_hash,area_id,estado,cambiar_password)
     VALUES(?,?,?,?,?,?,'ACTIVO',1)`,['ADMIN-BOOTSTRAP','Administrador','Local',email.toLowerCase(),hash,areaId]);
  await conn.execute('INSERT INTO usuario_roles(usuario_id,rol_id) VALUES (?,4)',[r.insertId]);
  await conn.commit();
  console.log('Cuenta administradora creada. En el primer acceso deberá cambiar la contraseña temporal.');
 }
}catch(e){if(conn)await conn.rollback();console.error('Error de creación:',e.code||e.message);process.exitCode=1;}
finally{conn?.release();await pool.end();}
