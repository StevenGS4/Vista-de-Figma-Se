import { useEffect, useState } from "react";
import { Archive, Check, ChevronRight, Clock3, Download, FileCheck2, FilePlus2, FolderArchive, PackageCheck, RotateCcw } from "lucide-react";
import { homeApi, type HomeActivity, type PersonalLoan } from "./api";
import { type UserRecord, type Role } from "./data";
import type { DocumentaryTransfer } from "./transfers";
import { assignedTransferTasks, homeToday, lastActiveInventory, personalLoanTiming } from "./homePending";
import type { ArchivalRecord } from "./records";

export type HomeModule = "inicio" | "tramite" | "concentracion" | "transferencias" | "prestamos" | "inventarios" | "bajas" | "control-area" | "administracion";
const greetingForHour = (hour: number) =>
  hour >= 5 && hour < 11.5 ? "Buenos días" :
  hour >= 11.5 && hour < 13 ? "Buen día" :
  hour >= 13 && hour < 18 ? "Buenas tardes" :
  "Buenas noches";

const activityIcon = (action:string) => action==="DESCARGAR"?Download:action==="DEVOLUCION"?RotateCcw:action==="ENTREGA"?PackageCheck:action==="CREAR"?FilePlus2:action==="ACEPTAR"||action==="VISTO_BUENO"?FileCheck2:FolderArchive;
const activityColor = (action:string) => action==="DEVOLUCION"||action==="DESCARGAR"?"gold":action==="OBSERVAR"||action==="ELIMINAR"?"wine":"green";
function when(date:string|null) {
  if(!date)return "Registrado";
  const d=new Date(date);
  return Number.isNaN(d.getTime())?String(date).slice(0,16):d.toLocaleString("es-MX",{dateStyle:"short",timeStyle:"short"});
}

export default function HomeDashboard({user,role,allowedModules,onNavigate,onOpenFolio,onOpenRecord,transfers,personalLoans,permissions,onOpenLoans,records}:{
  user:UserRecord;role:Role;allowedModules:HomeModule[];onNavigate:(module:HomeModule)=>void;
  onOpenFolio:(module:"transferencias"|"prestamos",folio:string)=>void;
  onOpenRecord:(record:ArchivalRecord)=>void;
  transfers:DocumentaryTransfer[];personalLoans:PersonalLoan[];permissions:string[];onOpenLoans:()=>void;records:ArchivalRecord[];
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

  const pending = allowedModules.includes("transferencias") ? assignedTransferTasks(user,role,transfers,permissions) : [];
  const today = homeToday();
  const reminders = personalLoans.filter(loan => personalLoanTiming(loan,today).reminder);
  const lastInventory = lastActiveInventory(user,records);
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
          {pending.length===0 && reminders.length===0 && !lastInventory && <div className="empty-state compact-empty"><Check size={25}/><strong>Sin pendientes detectados</strong><p>No hay acciones vencidas o esperando revisión en los datos consultados.</p></div>}
          {reminders.map(loan => <button key={loan.folio} className="home-pending--amber" onClick={onOpenLoans}><span><Clock3 size={16}/></span><div><strong>Recuerda devolver tu préstamo</strong><small>{loan.folio} · {personalLoanTiming(loan,today).label}</small></div><ChevronRight size={15}/></button>)}
          {pending.slice(0,4).map(({transfer,task}) => <button key={transfer.id} className="home-pending--blue" onClick={()=>onOpenFolio("transferencias",transfer.folio)}><span><FolderArchive size={16}/></span><div><strong>{task.label}</strong><small>{transfer.folio}</small></div><ChevronRight size={15}/></button>)}
          {lastInventory && allowedModules.includes("tramite") && <button onClick={()=>onOpenRecord(lastInventory)}><span><Archive size={16}/></span><div><strong>Consultar último inventario en trámite</strong><small>{lastInventory.inventoryId}</small></div><ChevronRight size={15}/></button>}
        </div>
      </aside>
    </div>
  </div>;
}
