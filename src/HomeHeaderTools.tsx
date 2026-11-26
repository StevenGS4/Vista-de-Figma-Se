import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { homeApi, type LoanNotice, type LoanSummary, type OverdueLoanReport } from "./api";
import { Bell, BookOpen, Check, FileText, Search } from "lucide-react";
import type { UserRecord, Role } from "./data";
import type { ArchivalRecord } from "./records";
import type { DocumentaryTransfer } from "./transfers";
import { buildHomeNotices, type HomeModule, type HomeNotice } from "./HomeDashboard";

export default function HomeHeaderTools({user,role,records,transfers,loans,allowed,onNavigate,onSearchRecord,onSearchFolio,onRefresh,manualOpen,onManual}:{
 user:UserRecord;role:Role;records:ArchivalRecord[];transfers:DocumentaryTransfer[];loans:LoanSummary[];
 allowed:HomeModule[];onNavigate:(id:HomeModule)=>void;onSearchRecord:(record:ArchivalRecord)=>void;
 onSearchFolio:(module:"transferencias"|"prestamos",folio:string)=>void;
 onRefresh:()=>Promise<void>;
 manualOpen:boolean;onManual:()=>void;
}) {
 const [searchOpen,setSearchOpen]=useState(false);
 const [notificationsOpen,setNotificationsOpen]=useState(false);
 const [openReport,setOpenReport]=useState<OverdueLoanReport|null>(null);
 const [query,setQuery]=useState("");
 const key="semarnat-notices-read-"+user.id;
 const [seen,setSeen]=useState<string[]>([]);
 const [personalLoanNotices,setPersonalLoanNotices]=useState<LoanNotice[]>([]);
 useEffect(()=>{
  try{const stored=JSON.parse(window.localStorage.getItem(key)||"[]");setSeen(Array.isArray(stored)?stored.filter(x=>typeof x==="string"):[]);}
  catch{setSeen([]);}
 },[key]);
 useEffect(()=>{
  let active=true;
  const load=()=>homeApi.loanNotices().then(items=>{if(active)setPersonalLoanNotices(items);})
    .catch(error=>console.error("No se pudieron consultar avisos de préstamos:",error));
  void load();
  const timer=window.setInterval(load,30_000);
  return ()=>{active=false;window.clearInterval(timer);};
 },[user.id]);
 const notices=useMemo<(HomeNotice & { report?: OverdueLoanReport })[]>(()=>{
   const staff=buildHomeNotices(user,role,transfers,loans).filter(n=>allowed.includes(n.module));
   const merged=[...personalLoanNotices,...staff];
   return merged.filter((n,i)=>merged.findIndex(x=>x.id===n.id)===i).slice(0,40);
 },[user,role,transfers,loans,allowed,personalLoanNotices]);
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
  <button type="button" aria-label="Manual de usuario" title="Manual de usuario" aria-pressed={manualOpen} className="header-icon"
    onClick={()=>{setSearchOpen(false);setNotificationsOpen(false);onManual();}}><BookOpen size={19}/></button>
  <button aria-label={"Notificaciones"+(unread?" ("+unread+" sin leer)":"")} aria-expanded={notificationsOpen} className="header-icon" onClick={()=>{if(!notificationsOpen){void onRefresh();void homeApi.loanNotices().then(setPersonalLoanNotices).catch(error=>console.error("Avisos no disponibles:",error));}setNotificationsOpen(!notificationsOpen);setSearchOpen(false);}}>
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
      {transferMatches.map(t=><button type="button" key={t.id} onClick={()=>{onSearchFolio("transferencias",t.folio);setSearchOpen(false);setQuery("");}}><FileText size={17}/><span><b>{t.folio}</b><small>Transferencia · {t.status}</small></span></button>)}
      {loanMatches.map(l=><button type="button" key={l.id} onClick={()=>{onSearchFolio("prestamos",l.folio);setSearchOpen(false);setQuery("");}}><FileText size={17}/><span><b>{l.folio}</b><small>Préstamo · {l.status}</small></span></button>)}
    </div>
  </div>}
  {notificationsOpen && <div className="header-popover header-popover--notifications home-header-popover">
    <div className="home-notice-heading"><strong>Notificaciones</strong><small>{unread} sin leer</small></div>
    <div className="home-notice-items">
      {notices.length===0 && <p className="home-no-notices">No hay avisos registrados para tus funciones.</p>}
      {notices.slice(0,12).map(n=><button type="button" key={n.id} className={seen.includes(n.id)?"is-seen":""} onClick={()=>{markRead(n.id);setNotificationsOpen(false);if(n.report)setOpenReport(n.report);else if(n.module==="transferencias"||n.module==="prestamos")onSearchFolio(n.module,n.detail.split(" · ")[0]);else onNavigate(n.module);}}>
        <span className={"activity-item__icon activity-item__icon--"+n.color}>{seen.includes(n.id)?<Check size={15}/>:<Bell size={15}/>}</span>
        <span><b>{n.title}</b><small>{n.detail}</small></span>
      </button>)}
    </div>
    <small>Notificaciones de movimientos y asuntos pendientes.</small>
  </div>}
  {openReport && createPortal(
    <div className="modal-backdrop">
      <section className="modal decision-modal" role="dialog" aria-modal="true" aria-labelledby="loan-report-notice-title"
        onKeyDown={event=>{if(event.key==="Escape")setOpenReport(null);}}>
        <div className="modal__header">
          <div><span>{openReport.number}</span><h2 id="loan-report-notice-title">Reporte por tardanza de devolución</h2></div>
        </div>
        <div className="modal__body grid gap-3 text-sm">
          <p>Se emitió el reporte <strong>{openReport.number}</strong> para el préstamo <strong>{openReport.loanFolio}</strong>.</p>
          <p>La fecha prevista de devolución era {openReport.dueDate.split("-").reverse().join("/")}. {openReport.reason}</p>
          <p>{openReport.loanStatus==="ACTIVO" ? "Devuelve los expedientes pendientes a la brevedad." : "La devolución ya quedó registrada."}</p>
        </div>
        <div className="modal__footer"><button type="button" className="button button--primary" autoFocus onClick={()=>setOpenReport(null)}>Entendido</button></div>
      </section>
    </div>, document.body)}
 </>;
}
