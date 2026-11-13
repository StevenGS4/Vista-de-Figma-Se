import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Archive, Bell, Check, ChevronRight, Clock3, Download, FileCheck2, FilePlus2, FolderArchive, PackageCheck, RotateCcw } from "lucide-react";
import { homeApi, type HomeActivity } from "./api";
import { type UserRecord, type Role } from "./data";
import type { DocumentaryTransfer } from "./transfers";
import type { ArchivalLoan } from "./loans";
import type { ArchivalRecord } from "./records";

export type HomeModule = "inicio" | "tramite" | "concentracion" | "transferencias" | "prestamos" | "inventarios" | "administracion";
export type HomeNotice = { id: string; title: string; detail: string; module: HomeModule; date: string; color: "green" | "wine" | "gold" };
const dateToday = () => {
  const now = new Date();
  return [now.getFullYear(),String(now.getMonth()+1).padStart(2,"0"),String(now.getDate()).padStart(2,"0")].join("-");
};
const daysUntil = (iso: string) => Math.ceil((new Date(iso+"T12:00:00").getTime()-new Date(dateToday()+"T12:00:00").getTime())/86400000);
export const greetingForHour = (hour: number) => hour >= 5 && hour < 11.5 ? "Buenos días" : hour < 13 ? "Buen día" : hour < 18 ? "Buenas tardes" : "Buenas noches";

export function buildHomeNotices(user: UserRecord, role: Role, transfers: DocumentaryTransfer[], loans: ArchivalLoan[]): HomeNotice[] {
  const notices: HomeNotice[] = [];
  const canTransfer = role === "Administrador / Coordinador" || role === "Encargado de área" || role === "Personal de área";
  if (canTransfer) for (const t of transfers) {
    const isOwner = t.requestedBy === user.id;
    const isAreaLead = role === "Encargado de área" && t.areaId === user.areaId && !isOwner;
    const isAdmin = role === "Administrador / Coordinador" && !isOwner;
    if (isOwner) {
      for (const h of t.history.filter(h=>["Visto bueno de área","Observaciones","Aceptación","Recepción física"].includes(h.type) && h.actor !== user.id)) {
        notices.push({id:"transfer-history-"+t.id+"-"+h.id,title:h.type+" registrada",detail:t.folio, module:"transferencias",date:h.date,color:h.type==="Observaciones"?"wine":"green"});
      }
    }
    if (isAreaLead && t.status === "Pendiente de visto bueno del área")
      notices.push({id:"transfer-vb-"+t.id,title:"Transferencia por autorizar",detail:t.folio,module:"transferencias",date:t.submittedAt,color:"gold"});
    if (isAdmin && t.status === "Pendiente de revisión administrativa")
      notices.push({id:"transfer-admin-"+t.id,title:"Transferencia por revisar",detail:t.folio,module:"transferencias",date:t.areaApprovedAt || t.submittedAt,color:"gold"});
    if (isAdmin && t.status === "Aceptada" && t.receptionStatus !== "Recibida")
      notices.push({id:"transfer-reception-"+t.id,title:"Recepción física pendiente",detail:t.folio,module:"transferencias",date:t.acceptedAt,color:"gold"});
  }
  if (role==="Administrador / Coordinador" || role==="Encargado de préstamos / Control archivístico") {
    for(const loan of loans) if(loan.status==="Activo" && loan.expectedReturnDate) {
      const days=daysUntil(loan.expectedReturnDate);
      if(days <= 3) notices.push({id:"loan-due-"+loan.id+"-"+loan.expectedReturnDate,title:days<0?"Préstamo vencido":days===0?"Préstamo vence hoy":"Préstamo próximo a vencer",detail:loan.folio+" · "+(days<0?Math.abs(days)+" día(s) de retraso":days+" día(s) restantes"),module:"prestamos",date:loan.expectedReturnDate,color:days<0?"wine":"gold"});
    }
  }
  return notices.sort((a,b)=>(b.date||"").localeCompare(a.date||"")).slice(0,30);
}

const activityIcon = (action:string) => action==="DESCARGAR"?Download:action==="DEVOLUCION"?RotateCcw:action==="ENTREGA"?PackageCheck:action==="CREAR"?FilePlus2:action==="ACEPTAR"||action==="VISTO_BUENO"?FileCheck2:FolderArchive;
const activityColor = (action:string) => action==="DEVOLUCION"||action==="DESCARGAR"?"gold":action==="OBSERVAR"||action==="ELIMINAR"?"wine":"green";
function when(date:string|null) {
  if(!date)return "Registrado";
  const d=new Date(date);
  return Number.isNaN(d.getTime())?String(date).slice(0,16):d.toLocaleString("es-MX",{dateStyle:"short",timeStyle:"short"});
}

export default function HomeDashboard({user,role,allowedModules,onNavigate,transfers,loans,records}:{
  user:UserRecord;role:Role;allowedModules:HomeModule[];onNavigate:(module:HomeModule)=>void;
  transfers:DocumentaryTransfer[];loans:ArchivalLoan[];records:ArchivalRecord[];
}) {
  const [activity,setActivity]=useState<HomeActivity[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [hour,setHour]=useState(new Date().getHours()+new Date().getMinutes()/60);
  useEffect(()=>{
    let alive=true;
    const refresh=async()=>{
      try{const rows=await homeApi.activity();if(alive){setActivity(rows);setError("");}}
      catch(e){if(alive)setError(e instanceof Error?e.message:"No se pudo consultar la actividad");}
      finally{if(alive)setLoading(false);}
    };
    void refresh();
    const interval=window.setInterval(()=>{void refresh();setHour(new Date().getHours()+new Date().getMinutes()/60);},60000);
    return ()=>{alive=false;window.clearInterval(interval);};
  },[user.id]);

  const notices=useMemo(()=>buildHomeNotices(user,role,transfers,loans),[user,role,transfers,loans]);
  const pending=notices.filter(n=>n.id.startsWith("loan-due-")||n.id.startsWith("transfer-vb-")||n.id.startsWith("transfer-admin-")||n.id.startsWith("transfer-reception-"));
  const lastInventory=records.find(r=>r.stage==="Archivo de trámite" && (role==="Administrador / Coordinador" || (r.areaId===user.areaId && (role==="Encargado de área"||r.createdBy===user.id))));
  return <div className="dashboard">
    <div className="home-greeting" role="status">
      <h3>{greetingForHour(hour)}, {user.firstName}.</h3>
      <p>Estos son tus movimientos y asuntos que requieren atención.</p>
    </div>
    <div className="dashboard-grid dashboard-grid--focused">
      <section className="surface activity-panel">
        <div className="section-heading"><div><h2>Actividad reciente</h2><p>Tus últimos cinco movimientos registrados en la bitácora.</p></div></div>
        <div className="activity-list">
          {loading && <p className="home-empty-line">Consultando movimientos…</p>}
          {error && <p className="home-empty-line" role="alert">{error}</p>}
          {!loading && !error && activity.length===0 && <p className="home-empty-line">Aún no has realizado movimientos registrados.</p>}
          {activity.map(item=>{const Icon=activityIcon(item.action);const target=allowedModules.includes(item.module as HomeModule)?item.module as HomeModule:null;return (
            <button type="button" className="activity-item home-activity-button" key={item.id} disabled={!target} onClick={()=>target&&onNavigate(target)}>
              <span className={"activity-item__icon activity-item__icon--"+activityColor(item.action)}><Icon size={17}/></span>
              <span><strong>{item.title}</strong><small>{item.detail}</small></span>
              <time><Clock3 size={14}/>{when(item.date)}</time>
            </button>
          );})}
        </div>
      </section>
      <aside className="surface pending-panel">
        <div className="section-heading"><div><h2>Pendientes operativos</h2><p>Acciones reales según tu rol y los registros disponibles.</p></div></div>
        <div className="pending-list">
          {pending.length===0 && !lastInventory && <div className="empty-state compact-empty"><Check size={25}/><strong>Sin pendientes detectados</strong><p>No hay acciones vencidas o esperando revisión en los datos consultados.</p></div>}
          {pending.slice(0,4).map(n=><button key={n.id} onClick={()=>allowedModules.includes(n.module)&&onNavigate(n.module)}><span><AlertTriangle size={16}/></span><div><strong>{n.title}</strong><small>{n.detail}</small></div><ChevronRight size={15}/></button>)}
          {lastInventory && allowedModules.includes("tramite") && <button onClick={()=>onNavigate("tramite")}><span><Archive size={16}/></span><div><strong>Consultar último inventario en trámite</strong><small>{lastInventory.inventoryId}</small></div><ChevronRight size={15}/></button>}
        </div>
      </aside>
    </div>
  </div>;
}
