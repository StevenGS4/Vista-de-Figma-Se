import { useEffect, useMemo, useRef, useState } from "react";
import { Archive, Bell, BriefcaseBusiness, Check, ChevronLeft, ChevronRight, Clock3, FileText, FolderArchive, Search, X } from "lucide-react";
import { homeApi, type LoanNotice, type LoanSummary, type PersonalLoan } from "./api";
import type { Role, UserRecord } from "./data";
import type { ArchivalRecord } from "./records";
import type { DocumentaryTransfer } from "./transfers";
import { buildHomeNotices, type HomeModule } from "./HomeDashboard";
import { assignedTransferTasks, homeToday, lastActiveInventory, personalLoanTiming } from "./homePending";
import { mergeProfileNotices, noticeHistoryKey, useNoticeHistory, useReadNotices, type ProfileNotice } from "./profileNotices";

export type ProfileActivityView = "notifications" | "pending" | "loans";
const views = {
  notifications: { title: "Mis notificaciones", description: "Consulta tus avisos pendientes y revisados.", icon: Bell },
  pending: { title: "Mis pendientes", description: "Revisa las tareas y devoluciones que requieren atención.", icon: Clock3 },
  loans: { title: "Mis préstamos", description: "Consulta los expedientes de cada préstamo y su devolución.", icon: BriefcaseBusiness },
};

const dateKey = (value?: string | null) => value?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? "";
const displayDate = (value?: string | null) => {
  const day = dateKey(value);
  return day ? day.split("-").reverse().join("/") : "Sin fecha";
};
const searchable = (value: string) => value.toLocaleLowerCase("es").normalize("NFD").replace(/\p{M}/gu, "");

function PageControls({ page, pages, total, onChange }: {
  page: number; pages: number; total: number; onChange: (page: number) => void;
}) {
  return <nav className="primary-builder__pagination profile-activity-pagination" aria-label="Paginación">
    <button type="button" aria-label="Página anterior" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft size={16} /></button>
    <span aria-live="polite">Página {page} de {pages} · {total} resultados</span>
    <button type="button" aria-label="Página siguiente" disabled={page >= pages} onClick={() => onChange(page + 1)}><ChevronRight size={16} /></button>
  </nav>;
}

function Notifications({ notices, seen, markRead, loading, error }: {
  notices: ProfileNotice[]; seen: Set<string>; markRead: (id: string) => void; loading: boolean; error: string;
}) {
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [openReport, setOpenReport] = useState<string>();
  const terms = searchable(search).trim().split(/\s+/).filter(Boolean);
  const filtered = notices.filter(notice => {
    const day = dateKey(notice.date);
    if ((from && (!day || day < from)) || (to && (!day || day > to))) return false;
    if (status !== "all" && seen.has(notice.id) !== (status === "read")) return false;
    const content = searchable([notice.title, notice.detail, notice.report?.number, notice.report?.loanFolio].filter(Boolean).join(" "));
    return terms.every(term => content.includes(term));
  });
  const pageSize = 6;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages);
  const groups = new Map<string, ProfileNotice[]>();
  for (const notice of filtered.slice((current - 1) * pageSize, current * pageSize)) {
    const day = dateKey(notice.date);
    const group = groups.get(day);
    if (group) group.push(notice);
    else groups.set(day, [notice]);
  }

  return <>
    <div className="profile-activity-filters">
      <label className="form-field"><span>Buscar notificación</span>
        <input type="search" placeholder="Asunto o folio" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
      </label>
      <label className="form-field"><span>Desde</span><input type="date" value={from} max={to || undefined}
        onChange={e => { setFrom(e.target.value); setPage(1); }} /></label>
      <label className="form-field"><span>Hasta</span><input type="date" value={to} min={from || undefined}
        onChange={e => { setTo(e.target.value); setPage(1); }} /></label>
      <label className="form-field"><span>Estado de lectura</span>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="all">Todas</option><option value="unread">Pendientes</option><option value="read">Revisadas</option>
        </select>
      </label>
    </div>
    {Array.from(groups, ([day, items]) => <section className="profile-activity-group" key={day}>
      <h3>{displayDate(day)}</h3>
      {items.map(notice => {
        const read = seen.has(notice.id);
        const report = notice.report;
        const expanded = openReport === notice.id;
        const Icon = read ? Check : Bell;
        return <article className="profile-activity-item" key={notice.id}>
          <span className={"activity-item__icon activity-item__icon--" + notice.color}><Icon size={16} aria-hidden="true"/></span>
          <div><strong>{notice.title}</strong><small>{notice.detail}</small></div>
          <span className={read ? "profile-status" : "profile-status profile-status--pending"}>{read ? "Revisada" : "Pendiente"}</span>
          {report ? <button type="button" className="text-button" aria-expanded={expanded}
            onClick={() => { markRead(notice.id); setOpenReport(expanded ? undefined : notice.id); }}>
            {expanded ? "Ocultar reporte" : "Ver reporte"}
          </button> : !read && <button type="button" className="text-button" onClick={() => markRead(notice.id)}>Marcar revisada</button>}
          {report && expanded && <div className="profile-notice-report">
            <strong>{report.number} · {report.loanFolio}</strong>
            <p>Devolución prevista: {displayDate(report.dueDate)}. {report.reason}</p>
            <p>{report.loanStatus === "ACTIVO" ? "El préstamo sigue pendiente de devolución." : "La devolución ya quedó registrada."}</p>
          </div>}
        </article>;
      })}
    </section>)}
    {!loading && !error && !filtered.length && <p className="profile-activity-empty">No hay notificaciones que coincidan con los filtros.</p>}
    {filtered.length > 0 && <PageControls page={current} pages={pages} total={filtered.length} onChange={setPage} />}
  </>;
}

function MyLoans({ loans, today, loading, error }: { loans: PersonalLoan[]; today: string; loading: boolean; error: string }) {
  const [view, setView] = useState<"pending" | "returned">("pending");
  const [page, setPage] = useState(1);
  const filtered = loans.filter(loan => (loan.status === "DEVUELTO") === (view === "returned"))
    .sort((a,b) => view === "returned"
      ? (b.returnedDate ?? "").localeCompare(a.returnedDate ?? "")
      : (a.dueDate || "9999").localeCompare(b.dueDate || "9999"));
  const pageSize = 4;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages);
  return <>
    <nav className="primary-builder__tabs" aria-label="Estado de mis préstamos">
      <button type="button" aria-pressed={view === "pending"} className={view === "pending" ? "is-active" : ""}
        onClick={() => { setView("pending"); setPage(1); }}>Por devolver</button>
      <button type="button" aria-pressed={view === "returned"} className={view === "returned" ? "is-active" : ""}
        onClick={() => { setView("returned"); setPage(1); }}>Devueltos</button>
    </nav>
    {filtered.slice((current - 1) * pageSize, current * pageSize).map(loan => {
      const timing = personalLoanTiming(loan,today);
      const returned = loan.status === "DEVUELTO";
      return <article className="profile-loan-card" key={loan.folio}>
        <header>
          <span className="activity-item__icon activity-item__icon--green"><BriefcaseBusiness size={17} aria-hidden="true" /></span>
          <div><h3>{loan.folio}</h3><p>{returned ? "Devuelto el" : "Devolución prevista"} {displayDate(returned ? loan.returnedDate : loan.dueDate)}</p></div>
          <span className={timing.reminder ? "profile-status profile-status--pending" : "profile-status"}>{timing.label}</span>
        </header>
        {loan.records?.length ? <div className="table-scroll">
          <table className="data-table profile-loan-table">
            <caption className="sr-only">Expedientes del préstamo {loan.folio}</caption>
            <thead><tr><th>Expediente</th><th>Número</th><th>Devolución</th></tr></thead>
            <tbody>{loan.records.map(record => {
              const returnedOn = record.returnedDate || (returned ? loan.returnedDate : null);
              return <tr key={record.id}>
                <td><span className="profile-record-title"><FileText size={16} aria-hidden="true" /> {record.title || "Expediente sin título"}</span></td>
                <td>{record.number || "—"}</td>
                <td>{returnedOn ? displayDate(returnedOn) : returned ? "Devuelto" : "Pendiente"}</td>
              </tr>;
            })}</tbody>
          </table>
        </div> : <p className="profile-activity-empty">{loan.record || "Expediente sin identificar"}</p>}
      </article>;
    })}
    {!loading && !error && !filtered.length && <p className="profile-activity-empty">{view === "pending" ? "No tienes préstamos por devolver." : "No tienes préstamos devueltos."}</p>}
    {filtered.length > 0 && <PageControls page={current} pages={pages} total={filtered.length} onChange={setPage} />}
  </>;
}

export default function ProfileActivityDialog({view,user,role,permissions,allowed,records,transfers,loans,onClose,onOpenTransfer,onOpenRecord}: {
  view: ProfileActivityView; user: UserRecord; role: Role; permissions: string[]; allowed: HomeModule[];
  records: ArchivalRecord[]; transfers: DocumentaryTransfer[]; loans: LoanSummary[];
  onClose: () => void; onOpenTransfer: (folio:string) => void; onOpenRecord: (record:ArchivalRecord) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [personalLoans,setLoans] = useState<PersonalLoan[]>([]);
  const [personalNotices,setNotices] = useState<LoanNotice[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [today,setToday] = useState(homeToday);
  const { seen, markRead } = useReadNotices(user.id);
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
        if (active) setError(view === "notifications" ? "No se pudieron actualizar tus notificaciones." : "No se pudieron consultar tus préstamos.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void refresh();
    const timer = window.setInterval(refresh,60000);
    return () => { active=false; window.clearInterval(timer); };
  },[user.id,view]);

  const current = useMemo(() => mergeProfileNotices(personalNotices, buildHomeNotices(user,role,transfers,loans)
    .filter(notice => allowed.includes(notice.module))), [personalNotices, user, role, transfers, loans, allowed]);
  const history = useNoticeHistory(noticeHistoryKey(user.id,user.areaId,role), current);
  const tasks = allowed.includes("transferencias") ? assignedTransferTasks(user,role,transfers,permissions) : [];
  const last = allowed.includes("tramite") ? lastActiveInventory(user,records) : undefined;
  const activeLoans = personalLoans.filter(loan => loan.status !== "DEVUELTO");
  const { title, description, icon: Icon } = views[view];

  return <dialog ref={dialog} className="modal profile-activity-dialog" aria-labelledby="profile-activity-title" onClose={onClose}>
    <header className="modal__header profile-activity-header">
      <div className="profile-activity-heading">
        <span className="activity-item__icon activity-item__icon--green"><Icon size={20} aria-hidden="true"/></span>
        <div><h2 id="profile-activity-title">{title}</h2><p>{description}</p></div>
      </div>
      <button type="button" className="header-icon" aria-label="Cerrar" onClick={() => dialog.current?.close()}><X size={20}/></button>
    </header>
    <div className="modal__body profile-activity-body">
      {loading && <p role="status">Cargando…</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
      {view === "notifications" && <Notifications notices={history.filter(notice => allowed.includes(notice.module))}
        seen={seen} markRead={markRead} loading={loading} error={error} />}
      {view === "pending" && <>
        {!loading && !error && !tasks.length && !last && !activeLoans.length && <p className="profile-activity-empty">No tienes pendientes.</p>}
        {tasks.map(({transfer,task}) => <article className="profile-activity-item home-pending--blue" key={transfer.id}>
          <span className="activity-item__icon activity-item__icon--green"><FolderArchive size={16} aria-hidden="true"/></span>
          <div><strong>{task.label}</strong><small>Transferencia {transfer.folio}</small></div>
          <button type="button" className="button button--secondary" onClick={()=>onOpenTransfer(transfer.folio)}>Ver transferencia</button>
        </article>)}
        {last && <article className="profile-activity-item">
          <span className="activity-item__icon activity-item__icon--green"><Archive size={16} aria-hidden="true"/></span>
          <div><strong>Último archivo activo en Trámite</strong><small>{last.cadidoSeriesName || last.cadidoCode} · {last.inventoryId}</small></div>
          <button type="button" className="button button--secondary" onClick={()=>onOpenRecord(last)}>Ver archivo</button>
        </article>}
        {activeLoans.map(loan => <article key={loan.folio} className="profile-activity-item home-pending--amber">
          <span className="activity-item__icon activity-item__icon--gold"><Clock3 size={16} aria-hidden="true"/></span>
          <div><strong>Devolver préstamo</strong><small>{loan.folio} · {loan.record || loan.inventory || "Préstamo"}</small></div>
          <span className="profile-status profile-status--pending">{personalLoanTiming(loan,today).label}</span>
        </article>)}
      </>}
      {view === "loans" && <MyLoans loans={personalLoans} today={today} loading={loading} error={error} />}
    </div>
  </dialog>;
}
