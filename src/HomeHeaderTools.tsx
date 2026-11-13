import { useEffect, useMemo, useState } from "react";
import { Bell, Check, FileText, Search } from "lucide-react";
import type { UserRecord, Role } from "./data";
import type { ArchivalRecord } from "./records";
import type { DocumentaryTransfer } from "./transfers";
import type { ArchivalLoan } from "./loans";
import { buildHomeNotices, type HomeModule } from "./HomeDashboard";

export default function HomeHeaderTools({user,role,records,transfers,loans,allowed,onNavigate,onSearchRecord,onRefresh}:{
 user:UserRecord;role:Role;records:ArchivalRecord[];transfers:DocumentaryTransfer[];loans:ArchivalLoan[];
 allowed:HomeModule[];onNavigate:(id:HomeModule)=>void;onSearchRecord:(record:ArchivalRecord)=>void;
 onRefresh:()=>Promise<void>;
}) {
 const [searchOpen,setSearchOpen]=useState(false);
 const [notificationsOpen,setNotificationsOpen]=useState(false);
 const [query,setQuery]=useState("");
 const key="semarnat-notices-read-"+user.id;
 const [seen,setSeen]=useState<string[]>([]);
 useEffect(()=>{
  try{const stored=JSON.parse(window.localStorage.getItem(key)||"[]");setSeen(Array.isArray(stored)?stored.filter(x=>typeof x==="string"):[]);}
  catch{setSeen([]);}
 },[key]);
 const notices=useMemo(()=>buildHomeNotices(user,role,transfers,loans).filter(n=>allowed.includes(n.module)),[user,role,transfers,loans,allowed]);
 const unread=notices.filter(n=>!seen.includes(n.id)).length;
 const markRead=(id:string)=>{
  setSeen(old=>{
   const next=[...new Set([...old,id])].slice(-250);
   try{window.localStorage.setItem(key,JSON.stringify(next));}catch{/* almacenamiento local no disponible */}
   return next;
  });
 };
 const results=useMemo(()=>{
  const q=query.trim().toLowerCase();
  if(q.length<2)return [];
  return records.filter(record=>{
   const module=record.stage==="Archivo de concentración"?"concentracion":"tramite";
   if(!allowed.includes(module))return false;
   if(role!=="Administrador / Coordinador" && role!=="Encargado de préstamos / Control archivístico"){
    if(record.areaId!==user.areaId)return false;
    if(role==="Personal de área" && record.createdBy!==user.id)return false;
   }
   return [record.recordNumber,record.archiveClassificationCode,record.inventoryId,record.title].some(value=>(value||"").toLowerCase().includes(q));
  }).slice(0,7);
 },[query,records,role,allowed,user.id,user.areaId]);
 const transferMatches = query.trim().length>=2 && allowed.includes("transferencias")
   ? transfers.filter(t=>{
       if(role==="Personal de área" && t.requestedBy!==user.id)return false;
       if(role==="Encargado de área" && t.areaId!==user.areaId)return false;
       return t.folio.toLowerCase().includes(query.trim().toLowerCase());
     }).slice(0,4) : [];
 const loanMatches = query.trim().length>=2 && allowed.includes("prestamos")
   ? loans.filter(l=>l.folio.toLowerCase().includes(query.trim().toLowerCase())).slice(0,4) : [];
 return <>
  <button aria-label="Búsqueda global" aria-expanded={searchOpen} className="header-icon" onClick={()=>{setSearchOpen(!searchOpen);setNotificationsOpen(false);}}><Search size={19}/></button>
  <button aria-label={"Notificaciones"+(unread?" ("+unread+" sin leer)":"")} aria-expanded={notificationsOpen} className="header-icon" onClick={()=>{if(!notificationsOpen)void onRefresh();setNotificationsOpen(!notificationsOpen);setSearchOpen(false);}}>
   <Bell size={19}/>{unread>0 && <i/>}
  </button>
  {searchOpen && <div className="header-popover header-popover--search home-header-popover">
    <strong>Búsqueda de expedientes autorizados</strong>
    <label><Search size={16}/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Folio, código CADIDO o asunto…"/></label>
    <div className="home-search-results">
      {query.trim().length<2 && <small>Escribe al menos dos caracteres.</small>}
      {query.trim().length>=2 && results.length===0 && transferMatches.length===0 && loanMatches.length===0 && <small>Sin coincidencias entre tus expedientes autorizados.</small>}
      {results.map(record=><button type="button" key={record.id} onClick={()=>{onSearchRecord(record);setSearchOpen(false);setQuery("");}}>
        <FileText size={17}/><span><b>{record.recordNumber}</b><small>{record.title} · {record.stage}</small></span>
      </button>)}
      {transferMatches.map(t=><button type="button" key={t.id} onClick={()=>{onNavigate("transferencias");setSearchOpen(false);setQuery("");}}><FileText size={17}/><span><b>{t.folio}</b><small>Transferencia · {t.status}</small></span></button>)}
      {loanMatches.map(l=><button type="button" key={l.id} onClick={()=>{onNavigate("prestamos");setSearchOpen(false);setQuery("");}}><FileText size={17}/><span><b>{l.folio}</b><small>Préstamo · {l.status}</small></span></button>)}
    </div>
  </div>}
  {notificationsOpen && <div className="header-popover header-popover--notifications home-header-popover">
    <div className="home-notice-heading"><strong>Notificaciones</strong><small>{unread} sin leer</small></div>
    <div className="home-notice-items">
      {notices.length===0 && <p className="home-no-notices">No hay avisos registrados para tus funciones.</p>}
      {notices.slice(0,12).map(n=><button type="button" key={n.id} className={seen.includes(n.id)?"is-seen":""} onClick={()=>{markRead(n.id);setNotificationsOpen(false);onNavigate(n.module);}}>
        <span className={"activity-item__icon activity-item__icon--"+n.color}>{seen.includes(n.id)?<Check size={15}/>:<Bell size={15}/>}</span>
        <span><b>{n.title}</b><small>{n.detail}</small></span>
      </button>)}
    </div>
    <small>Los avisos se generan a partir de transferencias y préstamos registrados. El estado de lectura se guarda en este navegador.</small>
  </div>}
 </>;
}
