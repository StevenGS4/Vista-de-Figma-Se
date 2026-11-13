import 'dotenv/config';
// Pruebas de humo HTTP, no destructivas: no crean expedientes ni transferencias.
// Requiere servidor iniciado y variables SMOKE_EMAIL/SMOKE_PASSWORD opcionales.
const base=(process.env.SMOKE_API_URL||'http://localhost:3001').replace(/\/$/,'');
const origin=process.env.FRONTEND_ORIGIN||'http://localhost:8443';
const email=process.env.SMOKE_EMAIL;
const password=process.env.SMOKE_PASSWORD;
let ok=0,errors=0,sessionCookie='';
const assert=(condition,message)=>{
 if(condition){console.log('OK',message);ok++;}
 else{console.error('ERROR',message);errors++;}
};
async function call(path,options={}){
 const response=await fetch(base+path,{
  ...options,
  headers:{ ...(options.method&&options.method!=='GET'?{'Origin':origin}:{}),
   ...(options.body?{'Content-Type':'application/json'}:{}),
   ...(sessionCookie?{'Cookie':sessionCookie}:{}),
   ...(options.headers||{}) }
 });
 const ct=response.headers.get('content-type')||'';
 const value=ct.includes('json')?await response.json():await response.arrayBuffer();
 return {response,value};
}
try{
 let data=await call('/api/health');
 assert(data.response.status===200&&data.value.ok===true,'Servidor HTTP disponible');
 data=await call('/api/db/status');
 assert(data.response.status===200&&data.value.database==='conectada','MySQL conectado');
 data=await call('/api/auth/me');
 assert(data.response.status===401,'Sesión anónima rechazada');
 data=await call('/api/users');
 assert(data.response.status===401,'Administración protegida sin sesión');
 data=await call('/api/tramite/inventarios');
 assert(data.response.status===401,'Archivo de Trámite protegido sin sesión');
 data=await call('/api/inventarios/tramite.xlsx');
 assert(data.response.status===401,'Excel protegido sin sesión');
 if(email&&password){
   data=await call('/api/auth/login',{
     method:'POST',body:JSON.stringify({email,password})
   });
   assert(data.response.status===200&&Boolean(data.value.user),'Credenciales de prueba aceptadas');
   if(data.response.ok){
     const rawCookie=data.response.headers.get('set-cookie')||'';
     sessionCookie=rawCookie.split(';')[0];
     assert(sessionCookie.startsWith('semarnat_session='),'Cookie de sesión HttpOnly emitida');
     let me=await call('/api/auth/me');
     assert(me.response.status===200&&me.value.user.email.toLowerCase()===email.toLowerCase(),'Perfil de usuario recuperado');
     if(me.value.user.mustChangePassword){
       console.log('AVISO: contraseña temporal. Cambiarla manualmente; se omiten las lecturas de datos.');
     }else{
       const roles=me.value.user.roles||[];
       if(roles.includes('Administrador / Coordinador')){
         let resp=await call('/api/users');
         assert(resp.response.status===200&&Array.isArray(resp.value.users),'Administrador consulta usuarios');
       }else{
         let resp=await call('/api/users');
         assert(resp.response.status===403,'No administrador no consulta usuarios');
       }
       if(roles.some(r=>['Administrador / Coordinador','Personal de área','Encargado de área'].includes(r))){
         let resp=await call('/api/tramite/inventarios');
         assert(resp.response.status===200&&Array.isArray(resp.value.records),'Trámite consulta inventarios desde MySQL');
         resp=await call('/api/inventarios/tramite.xlsx');
         const signature=new Uint8Array(resp.value).slice(0,2);
         assert(resp.response.status===200&&signature[0]===0x50&&signature[1]===0x4b,'Excel de Trámite es ZIP/XLSX real');
       }
       if(roles.some(r=>['Administrador / Coordinador','Encargado de préstamos / Control archivístico'].includes(r))){
         const resp=await call('/api/prestamos');
         assert(resp.response.status===200&&Array.isArray(resp.value.loans),'Préstamos consultables por rol autorizado');
       }
       const concentration=await call('/api/concentracion/expedientes');
       assert(concentration.response.status===200&&Array.isArray(concentration.value.records),'Concentración responde desde MySQL');
     }
     const logout=await call('/api/auth/logout',{method:'POST',body:'{}'});
     assert(logout.response.status===200,'Sesión cerrada en servidor');
     const expired=await call('/api/auth/me');
     assert(expired.response.status===401,'Token revocado no reutilizable');
   }
 }else{
   console.log('AVISO: SMOKE_EMAIL y SMOKE_PASSWORD no definidas. Se ejecutaron solo pruebas públicas y de acceso anónimo.');
 }
} catch(e){
 console.error('ERROR: no se completó el smoke test:',e.message);
 errors++;
}
console.log(`RESULTADO: ${ok} comprobaciones correctas; ${errors} errores.`);
process.exitCode=errors?1:0;
