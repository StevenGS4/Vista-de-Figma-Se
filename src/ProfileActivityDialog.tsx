import { useEffect, useRef, useState } from "react";
import { Bell, X } from "lucide-react";
import { homeApi, type LoanNotice, type PersonalLoan } from "./api";
import type { Role, UserRecord } from "./data";
import type { ArchivalRecord } from "./records";
import type { ArchivalLoan } from "./loans";
import type { DocumentaryTransfer } from "./transfers";
import { buildHomeNotices, type HomeModule } from "./HomeDashboard";
import { assignedTransferTasks, homeToday, lastActiveInventory, personalLoanTiming } from "./homePending";

export type ProfileActivityView = "notifications" | "pending" | "loans";
const titles = { notifications: "Mis notificaciones", pending: "Mis pendientes", loans: "Mis préstamos" };

export default function ProfileActivityDialog({view,user,role,permissions,allowed,records,transfers,loans,onClose,onOpenTransfer,onOpenRecord}: {
  view: ProfileActivityView; user: UserRecord; role: Role; permissions: string[]; allowed: HomeModule[];
  records: ArchivalRecord[]; transfers: DocumentaryTransfer[]; loans: ArchivalLoan[];
  onClose: () => void; onOpenTransfer: (folio:string) => void; onOpenRecord: (record:ArchivalRecord) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [personalLoans,setLoans] = useState<PersonalLoan[]>([]);
  const [personalNotices,setNotices] = useState<LoanNotice[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [today,setToday] = useState(homeToday);
  useEffect(() => { dialog.current?.showModal(); },[]);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      setToday(homeToday());
      try {
        if (view === "notifications") {
          const notices = await homeApi.loanNotices();
          if (active) setNotices(notices);
        } else {
          const data = await homeApi.personalLoans();
          if (active) setLoans(data);
        }
        if (active) setError("");
      } catch {
        if (active) setError("No se pudieron consultar tus avisos personales.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void refresh();
    const timer = window.setInterval(refresh,60000);
    return () => { active=false; window.clearInterval(timer); };
  },[user.id,view]);
  const canTransfer = allowed.includes("transferencias");
  const tasks = canTransfer ? assignedTransferTasks(user,role,transfers,permissions) : [];
  const last = allowed.includes("tramite") ? lastActiveInventory(user,role,records) : undefined;
  const activeLoans = personalLoans.filter(loan => loan.status !== "DEVUELTO");
  const notices = [...personalNotices,...buildHomeNotices(user,role,transfers,loans)
    .filter(notice => allowed.includes(notice.module))]
    .sort((a,b) => b.date.localeCompare(a.date));
  const close = () => dialog.current?.close();
  return <dialog ref={dialog} className="profile-activity-dialog" aria-labelledby="profile-activity-title" onClose={onClose}>
    <header><h2 id="profile-activity-title">{titles[view]}</h2>
      <button type="button" className="header-icon" aria-label="Cerrar" onClick={close}><X size={20}/></button>
    </header>
    <div className="profile-activity-body">
      {loading && <p role="status">Cargando…</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
      {view === "notifications" && <>
        {!loading && !error && !notices.length && <p>No tienes notificaciones.</p>}
        {notices.map(notice => <article className="profile-activity-item" key={notice.id}>
          <Bell size={16}/><div><strong>{notice.title}</strong><small>{notice.detail} · {notice.date}</small></div>
        </article>)}
      </>}
      {view === "pending" && <>
        {!loading && !error && !tasks.length && !last && !activeLoans.length && <p>No tienes pendientes.</p>}
        {tasks.map(({transfer,task}) => <article className="profile-activity-item home-pending--blue" key={transfer.id}>
          <div><strong>{task.label}</strong><small>Transferencia {transfer.folio}</small></div>
          <button type="button" className="text-button" onClick={()=>onOpenTransfer(transfer.folio)}>Ver transferencia</button>
        </article>)}
        {last && <article className="profile-activity-item"><div><strong>Último archivo activo en Trámite</strong>
          <small>{last.cadidoSeriesName || last.cadidoCode} · {last.inventoryId}</small></div>
          <button type="button" className="text-button" onClick={()=>onOpenRecord(last)}>Ver archivo</button>
        </article>}
        {activeLoans.map(loan => <article key={loan.folio} className="profile-activity-item home-pending--amber">
          <div><strong>Recuerda devolver tu préstamo</strong><small>{loan.folio} · {loan.inventory || loan.record || "Préstamo"} · {personalLoanTiming(loan,today).label}</small></div>
        </article>)}
      </>}
      {view === "loans" && <>
        {!loading && !error && !personalLoans.length && <p>No tienes préstamos registrados.</p>}
        {personalLoans.map(loan => {
          const timing = personalLoanTiming(loan,today);
          return <article className={"profile-activity-item"+(timing.reminder?" home-pending--amber":"")} key={loan.folio}>
            <div><strong>{loan.folio} · {loan.inventory || loan.record || "Préstamo"}</strong>
              <small>{loan.status === "DEVUELTO" ? "Devuelto: "+(loan.returnedDate || "Sin fecha") : "Devolución prevista: "+(loan.dueDate || "Sin fecha")}</small></div>
            <strong>{timing.label}</strong>
          </article>;
        })}
      </>}
    </div>
  </dialog>;
}
