import type { UserRecord } from './data';
const API_BASE=(import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/,'');
type JsonObject=Record<string,unknown>;
async function request<T>(path:string,options:RequestInit={}):Promise<T>{
 let response:Response;
 try{
  response=await fetch(API_BASE+path,{...options,credentials:'include',headers:{'Content-Type':'application/json',...(options.headers||{})}});
 }catch{throw new Error('No se pudo conectar con Node.js. Verifica que el backend esté encendido.');}
 const data=await response.json().catch(()=>({})) as JsonObject;
 if(!response.ok) throw new Error(typeof data.error==='string'?data.error:'Error del servidor');
 return data as T;
}
export const toUiUser=(u:UserRecord):UserRecord=>({...u,id:String(u.id),areaId:String(u.areaId),password:''});
export const authApi={
 login:async(email:string,password:string)=>toUiUser((await request<{user:UserRecord}>('/api/auth/login',{method:'POST',body:JSON.stringify({email,password})})).user),
 me:async()=>toUiUser((await request<{user:UserRecord}>('/api/auth/me')).user),
 logout:()=>request<{ok:boolean}>('/api/auth/logout',{method:'POST',body:'{}'}),
 changePassword:async(currentPassword:string,newPassword:string)=>toUiUser((await request<{user:UserRecord}>('/api/auth/change-password',{method:'POST',body:JSON.stringify({currentPassword,newPassword})})).user),
};
export const usersApi={
 list:async()=>((await request<{users:UserRecord[]}>('/api/users')).users.map(toUiUser)),
 save:async(user:UserRecord)=>toUiUser((await request<{user:UserRecord}>(user.id?.startsWith('USR-')?'/api/users':'/api/users/'+user.id,{
 method:user.id?.startsWith('USR-')?'POST':'PUT',
 body:JSON.stringify({...user,password:user.password||undefined}),
 })).user),
};
