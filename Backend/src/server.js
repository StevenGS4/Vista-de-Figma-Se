import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { pool } from './config/database.js';
import { parseCookies,rejectCrossOriginWrites } from './http.js';
import { authRouter } from './auth.js';
import { usersRouter } from './users.js';
import { tramiteRouter } from './tramite.js';
import { transfersRouter } from './transfers.js';
import { concentrationRouter } from './concentration.js';

const app=express();
const port=Number(process.env.PORT||3001);
const origin=process.env.FRONTEND_ORIGIN||'http://localhost:8443';

app.disable('x-powered-by');
app.use(cors({origin,credentials:true}));
app.use(express.json({limit:'50mb'}));
app.use(parseCookies);
app.use('/api',rejectCrossOriginWrites);
app.get('/api/health',(_req,res)=>res.json({ok:true,service:'semarnat-backend',database:'no verificada en esta ruta'}));
app.get('/api/db/status',async(_req,res)=>{
 try{const [rows]=await pool.query('SELECT 1 AS conexion');res.json({ok:rows[0].conexion===1,database:'conectada'});}
 catch(error){console.error('Error de MySQL:',error.code||error.message);res.status(503).json({ok:false,database:'sin conexión'});}
});
app.use('/api/auth',authRouter);
app.use('/api/users',usersRouter);
app.use('/api/tramite',tramiteRouter);
app.use('/api/transferencias',transfersRouter);
app.use('/api/concentracion',concentrationRouter);
app.use((err,_req,res,_next)=>{
 console.error('Error de API:',err.code||err.message);
 res.status(err.status||500).json({error:err.status?err.message:'Error interno del servidor'});
});
const server=app.listen(port,'127.0.0.1',()=>console.log(`Backend SEMARNAT escuchando en http://localhost:${port}`));
const close=()=>server.close(async()=>{await pool.end();process.exit(0);});
process.on('SIGINT',close);
process.on('SIGTERM',close);
