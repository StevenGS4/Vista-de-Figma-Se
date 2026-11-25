import type { TransferReceipt } from "./api";
import { transferTask } from "./transferTask";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Eye,
  FileClock,
  FilePenLine,
  Files,
  FolderArchive,
  History,
  Inbox,
  ListChecks,
  MessageSquareText,
  PackageCheck,
  Plus,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import { useConfirmAction } from "./useConfirmAction";
import RowActionsMenu from "./RowActionsMenu";
import LocationShelf from "./LocationShelf";
import { Role, UserRecord, areaName, fullName } from "./data";
import { transferApi, tramiteApi, concentrationApi, ReceptionLocation, type ReceptionSourceBox } from "./api";
import { ArchivalRecord } from "./records";
import {
  DocumentaryTransfer,
  ReceptionStatus,
  TransferStatus,
  todayIso,
} from "./transfers";

type TransferDetailView = "tracking" | "documents" | "inventory";

type PanelView = "list" | "wizard" | "detail" | "reception" | "history";

const transferSteps = [
  { label: "Archivos de origen", icon: FolderArchive },
  { label: "Seleccionar expedientes", icon: ListChecks },
  { label: "Vista previa", icon: Files },
  { label: "Acuse y envío", icon: Send },
];

const formatDate = (value: string) =>
  value ? new Date(`${value}T12:00:00`).toLocaleDateString("es-MX") : "Sin registro";

function Button({
  children,
  className = "",
  disabled,
  onClick,
  type = "button",
}: {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button className={`button ${className}`} disabled={disabled} onClick={onClick} type={type}>
      {children}
    </button>
  );
}

function TransferStatusBadge({ status }: { status: TransferStatus }) {
  const tone =
    status === "Aceptada"
      ? "accepted"
      : status === "Con observaciones"
        ? "observed"
        : status === "Pendiente de visto bueno del área" ||
            status === "Pendiente de revisión administrativa"
          ? "pending"
          : "draft";
  return (
    <span className={`transfer-status transfer-status--${tone}`}>
      <span />
      {status}
    </span>
  );
}

function ReceptionBadge({ status }: { status: ReceptionStatus }) {
  const tone =
    status === "Recibida" ? "accepted" : status === "Diferencias pendientes" ? "observed" : "draft";
  return (
    <span className={`transfer-status transfer-status--${tone}`}>
      <span />
      {status}
    </span>
  );
}

function userName(users: UserRecord[], id: string) {
  const user = users.find((item) => item.id === id);
  return user ? fullName(user) : id ? "Usuario no disponible" : "Pendiente";
}
function requesterName(transfer: DocumentaryTransfer, users: UserRecord[]) {
  return transfer.requesterName || userName(users, transfer.requestedBy);
}
const trackingSteps = [
  { title: "Solicitud y acuse", kinds: ["SOLICITUD", "ACUSE_SOLICITUD", "SOLICITUD_AMPLIACION"] },
  { title: "Visto bueno", kinds: ["AUTORIZACION", "OBSERVACION_AREA"] },
  { title: "Dictamen", kinds: ["DICTAMEN_FAVORABLE", "DICTAMEN_DESFAVORABLE", "CORRECCION_FORMATO"] },
  { title: "Traslado y entrega", kinds: ["NOTA_TRASLADO", "ACUSE_TRASLADO", "ENTREGA"] },
  { title: "Recepción", kinds: ["FORMATO_FIRMADO", "RECEPCION", "DIFERENCIAS"] },
];

function TransferTray({
  initialSearch = "",
  canCreate,
  currentUser,
  onCreate,
  onOpen,
  permissions,
  role,
  transfers,
  users,
}: {
  initialSearch?: string;
  canCreate: boolean;
  currentUser: UserRecord;
  onCreate: () => void;
  onOpen: (transfer: DocumentaryTransfer, action?: "continue" | "history" | "reception") => void;
  permissions: string[];
  role: Role;
  transfers: DocumentaryTransfer[];
  users: UserRecord[];
}) {
  const views = ["Seguimiento", "Todas", "Pendiente", "Con observaciones", "Aceptadas"] as const;
  const [view, setView] = useState<(typeof views)[number]>("Seguimiento");
  const [mineOnly, setMineOnly] = useState(false);
  const [area, setArea] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState(initialSearch);
  const [page, setPage] = useState(1);
  const pageSize = 5;
  const visibleByRole = useMemo(() => {
    if (role === "Administrador / Coordinador") return transfers;
    if (role === "Encargado de área")
      return transfers.filter((item) => item.areaId === currentUser.areaId);
    return transfers.filter(
      (item) => item.areaId === currentUser.areaId && item.requestedBy === currentUser.id,
    );
  }, [currentUser.areaId, currentUser.id, role, transfers]);
  const matchesView = (transfer: DocumentaryTransfer, currentView: typeof view) => {
    switch (currentView) {
      case "Seguimiento": return transfer.status !== "Cancelada" && transfer.receptionStatus !== "Recibida";
      case "Pendiente": return ["En preparación", "Pendiente de visto bueno del área", "Pendiente de revisión administrativa"].includes(transfer.status);
      case "Con observaciones": return transfer.status === "Con observaciones";
      case "Aceptadas": return transfer.status === "Aceptada";
      case "Todas": return true;
    }
  };
  const isMyTask = (transfer: DocumentaryTransfer) => transferTask(transfer, currentUser, role, permissions).mine;
  const pending = visibleByRole.filter(isMyTask).length;
  const areas = [...new Set(visibleByRole.map(transfer => transfer.areaId))]
    .sort((left, right) => areaName(left).localeCompare(areaName(right), "es"));
  const query = search.trim().toLowerCase();
  const invalidDates = Boolean(from && to && from > to);
  const filtered = visibleByRole.filter(transfer => {
    const date = (transfer.submittedAt || transfer.createdAt || "").slice(0, 10);
    return matchesView(transfer, view) &&
      (!mineOnly || isMyTask(transfer)) &&
      (!area || transfer.areaId === area) &&
      (!from || date >= from) &&
      (!to || Boolean(date && date <= to)) &&
      (!query || [transfer.folio, areaName(transfer.areaId), requesterName(transfer, users)]
        .some(value => value.toLowerCase().includes(query)));
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  return (
    <>
      <div className="records-page-heading">
        <div>
          <h2>Transferencias documentales</h2>
          <p>Prepara, revisa y da seguimiento a las transferencias primarias.</p>
        </div>
        {canCreate && (
          <Button className="button--primary" onClick={onCreate}>
            <Plus size={17} />
            Nueva transferencia
          </Button>
        )}
      </div>
      <section className="surface transfer-tray">
        <div className="records-filter-head">
          <div>
            <h3>Bandeja de transferencias</h3>
            <p>{visibleByRole.filter(item => matchesView(item, "Seguimiento")).length} solicitudes en curso</p>
          </div>
          {pending > 0 && <button type="button" className="button button--secondary" onClick={() => { setView("Seguimiento"); setMineOnly(true); setPage(1); }}>
            <Clock3 size={16} /> {pending} {pending === 1 ? "acción pendiente" : "acciones pendientes"}
          </button>}
        </div>
        <nav className="transfer-tabs" aria-label="Estado de las transferencias">
          {views.map(item => (
            <button type="button" key={item} className={view === item ? "is-active" : ""}
              aria-current={view === item ? "true" : undefined}
              onClick={() => { setView(item); setPage(1); }}>
              {item}<span>{visibleByRole.filter(transfer => matchesView(transfer, item)).length}</span>
            </button>
          ))}
        </nav>
        <div className="transfer-searchbar flex flex-wrap items-center justify-between gap-3">
          <label className="search-box">
            <Search size={17} />
            <input
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Buscar por folio, área o solicitante..."
              value={search}
            />
          </label>
          {areas.length > 1 && <label className="grid gap-1 text-xs font-semibold">
            Área
            <select className="filter-select rounded-lg border px-2 py-2" value={area} onChange={event => { setArea(event.target.value); setPage(1); }}>
              <option value="">Todas las áreas</option>
              {areas.map(id => <option key={id} value={id}>{areaName(id)}</option>)}
            </select>
          </label>}
          <label className="grid gap-1 text-xs font-semibold">Envío o creación desde
            <input type="date" className="filter-date rounded-lg border px-2 py-2" value={from} onChange={event => { setFrom(event.target.value); setPage(1); }} />
          </label>
          <label className="grid gap-1 text-xs font-semibold">Hasta
            <input type="date" className="filter-date rounded-lg border px-2 py-2" value={to} onChange={event => { setTo(event.target.value); setPage(1); }} />
          </label>
          <button type="button" aria-pressed={mineOnly} className="button button--secondary !border-amber-400 !bg-amber-50"
            onClick={() => { setMineOnly(value => !value); setPage(1); }}>Me toca a mí</button>
          <Button className="button--secondary" onClick={() => {
            setSearch(""); setArea(""); setFrom(""); setTo(""); setMineOnly(false); setPage(1);
          }}>Limpiar filtros</Button>
          {invalidDates && <p role="alert" className="w-full text-sm text-[#75163c]">La fecha inicial debe ser anterior o igual a la fecha final.</p>}
        </div>
        <div className="table-scroll">
          <table className="data-table transfer-table">
            <thead>
              <tr>
                <th>Transferencia</th>
                <th>Usuario solicitante</th>
                <th>Fecha</th>
                <th>Inventarios / expedientes</th>
                <th>Estado</th>
                <th>Siguiente acción</th>
                <th className="align-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((transfer) => {
                const task = transferTask(transfer, currentUser, role, permissions);
                const canContinue =
                  (role === "Administrador / Coordinador" || permissions.includes("prepare-transfers")) &&
                  transfer.requestedBy === currentUser.id &&
                  ["En preparación", "Con observaciones"].includes(transfer.status);
                return (
                  <tr key={transfer.id}>
                    <td>
                      <button className="record-number-link" onClick={() => onOpen(transfer)}>
                        Transferencia primaria · {areaName(transfer.areaId)}
                      </button>
                      <span className="block break-words text-xs font-normal text-[#52605a]">{transfer.folio}</span>
                    </td>
                    <td>
                      <div className="requester-cell">
                        <span>
                          <UserRound size={14} />
                        </span>
                        <strong>{requesterName(transfer, users)}</strong>
                      </div>
                    </td>
                    <td>{formatDate(transfer.submittedAt || transfer.createdAt)}</td>
                    <td>
                      <span className="record-count">
                        {new Set(transfer.recordIds).size ? transfer.recordIds.length : 0}
                      </span>
                    </td>
                    <td>
                      <TransferStatusBadge status={transfer.status} />
                    </td>
                    <td>
                      {task.mine && <span className="mb-1 block font-semibold text-[#1e5b4f]">Te toca a ti</span>}
                      <strong className="block">{task.label}</strong>
                      {task.owner && !task.mine && <small>{task.owner}</small>}
                    </td>
                    <td>
                      <RowActionsMenu
                        label={`Acciones para ${transfer.folio}`}
                        width={210}
                        actions={[
                          { label: "Ver solicitud", icon: <Eye size={16}/>,
                            onSelect: () => onOpen(transfer) },
                          ...(canContinue ? [{
                            label: transfer.status === "Con observaciones" ? "Corregir y reenviar" : "Continuar",
                            icon: <FilePenLine size={15}/>,
                            onSelect: () => onOpen(transfer, "continue"),
                          }] : []),
                          ...(transfer.status === "Aceptada" && task.mine && task.step === 4 && !("kind" in task) ? [{
                              label: "Registrar recepción",
                              icon: <PackageCheck size={15}/>,
                              onSelect: () => onOpen(transfer, "reception"),
                            }] : []),
                          { label: "Ver historial", icon: <History size={15}/>,
                            onSelect: () => onOpen(transfer, "history") },
                        ]}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!visible.length && (
            <div className="empty-state">
              <Inbox size={31} />
              <strong>No hay solicitudes en esta vista</strong>
              <p>Cambia el filtro o realiza una nueva búsqueda.</p>
            </div>
          )}
        </div>
        <div className="pagination">
          <span>
            Mostrando {visible.length ? (currentPage - 1) * pageSize + 1 : 0}–
            {Math.min(currentPage * pageSize, filtered.length)} de {filtered.length}
          </span>
          <div>
            <button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
              <ChevronLeft size={16} />
            </button>
            <span>
              Página {currentPage} de {pageCount}
            </span>
            <button disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

function TransferProgress({ current, resend }: { current: number; resend: boolean }) {
  const steps = resend ? transferSteps.slice(0, 3) : transferSteps;
  return (
    <div className="transfer-progress" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
      <div className="transfer-progress__line">
        <span style={{ width: `${(current / (steps.length - 1)) * 100}%` }} />
      </div>
      {steps.map((step, index) => {
        const Icon = step.icon;
        return (
          <div
            className={current === index ? "is-current" : current > index ? "is-complete" : ""}
            key={step.label}
            aria-current={current === index ? "step" : undefined}
          >
            <span>{current > index ? <Check size={15} /> : <Icon size={16} />}</span>
            <small>Paso {index + 1}</small>
            <strong>{step.label}</strong>
          </div>
        );
      })}
    </div>
  );
}

function InventoryTable({ records }: { records: ArchivalRecord[] }) {
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(records.length / pageSize));
  const visible = records.slice((page - 1) * pageSize, page * pageSize);
  return (
    <>
    <div className="table-scroll transfer-inventory-wrap">
      <table className="data-table transfer-inventory">
        <thead>
          <tr>
            <th>Asunto e identificación</th>
            <th>Área</th>
            <th>Fechas</th>
            <th>Vigencias</th>
            <th>Datos documentales</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((record) => (
            <tr key={record.id}>
              <td>
                <span className="inventory-title">{record.title}</span>
                <span className="block break-words text-xs font-normal text-[#52605a]">{[record.archiveClassificationCode, record.recordNumber].filter((value, index, values) => value && values.indexOf(value) === index).join(" · ")}</span>
              </td>
              <td>{areaName(record.areaId)}</td>
              <td>
                <span className="inventory-stack">
                  <b>Apertura: {formatDate(record.openDate)}</b>
                  <small>
                    Cierre: {record.closeDate ? formatDate(record.closeDate) : "Abierto"}
                  </small>
                </span>
              </td>
              <td>
                <span className="inventory-stack">
                  <b>{record.totalValidity} años totales</b>
                  <small>
                    {record.currentValidity} trámite · {record.concentrationValidity} concentración
                  </small>
                </span>
              </td>
              <td>
                <span className="inventory-stack">
                  <b>
                    {record.filesCount} legajos · {record.foliosCount} folios
                  </b>
                  <small>
                    {record.supportType} · {record.documentaryValues.join(", ")}
                  </small>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <div className="pagination">
      <span>
        Mostrando {visible.length ? (page - 1) * pageSize + 1 : 0}–
        {Math.min(page * pageSize, records.length)} de {records.length}
      </span>
      <div>
        <button disabled={page === 1} onClick={() => setPage((value) => value - 1)}>
          <ChevronLeft size={16} />
        </button>
        <span>Página {page} de {pageCount}</span>
        <button disabled={page === pageCount} onClick={() => setPage((value) => value + 1)}>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
    </>
  );
}

function ConfirmationModal({
  count,
  onCancel,
  onConfirm,
  resend,
}: {
  count: number;
  onCancel: () => void;
  onConfirm: (correction?: string) => Promise<void>;
  resend: boolean;
}) {
  const [correction, setCorrection] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="modal-backdrop">
      <div className="modal transfer-confirm-modal" role="dialog" aria-modal="true">
        <div className="transfer-confirm-modal__icon">
          <Send size={23} />
        </div>
        <h2>{resend ? "¿Reenviar solicitud?" : "¿Enviar transferencia a revisión?"}</h2>
        <p>
          Se incluirán {count} expediente{count === 1 ? "" : "s"} de la selección. El envío
          remitirá la solicitud al responsable de revisión. Los expedientes permanecerán en Archivo de trámite.
        </p>
        <div className="transfer-rule">
          <ShieldCheck size={17} />
          Enviar no cambia la etapa archivística.
        </div>
        {resend && <label className="form-field transfer-dictamen-field">
          <span>Corrección realizada <b>*</b></span>
          <textarea autoFocus rows={4} maxLength={1900} value={correction} onChange={e=>{setCorrection(e.target.value);setError("");}} />
        </label>}
        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="modal__footer">
          <Button className="button--secondary" onClick={onCancel} disabled={saving}>
            Cancelar
          </Button>
          <Button className="button--primary" disabled={saving} onClick={async()=>{
            if(resend && correction.trim().length<5){setError("Describe la corrección con al menos 5 caracteres.");return;}
            setSaving(true);setError("");
            try{await onConfirm(resend?correction.trim():undefined);}
            catch(error){setError(error instanceof Error?error.message:"No se pudo enviar la solicitud.");}
            finally{setSaving(false);}
          }}>
            <Send size={16} />
            {resend ? "Confirmar reenvío" : "Confirmar envío"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function TransferWizard({
  activeTransfer,
  allRecords,
  currentUser,
  onCancel,
  onSubmit,
  transfers,
}: {
  activeTransfer: DocumentaryTransfer | null;
  allRecords: ArchivalRecord[];
  currentUser: UserRecord;
  onCancel: () => void;
  onSubmit: (recordIds: string[], existing: DocumentaryTransfer | null, correction?: string, receipt?: TransferReceipt) => Promise<void>;
  transfers: DocumentaryTransfer[];
}) {
  const [testMode, setTestMode] = useState<boolean | null>(null);
  const [settingsError, setSettingsError] = useState("");
  useEffect(() => {
    let active = true;
    transferApi.settings().then(({testMode}) => { if(active)setTestMode(testMode); })
      .catch((error: Error) => { if(active)setSettingsError(error.message); });
    return () => { active = false; };
  }, []);
  const [step, setStep] = useState(0);
  const [search, setSearch] = useState("");
  const [sourceIds, setSourceIds] = useState<string[]>(() => [...new Set(
    allRecords.filter(record => activeTransfer?.recordIds.includes(record.id)).map(record => record.inventoryId || record.id),
  )]);
  const [selectedIds, setSelectedIds] = useState<string[]>(() => activeTransfer?.recordIds ?? []);
  const [error, setError] = useState("");
  const [receiptDetail, setReceiptDetail] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const finalStep = activeTransfer ? 2 : 3;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const blockedIds = new Set(
    transfers
      .filter(
        (transfer) =>
          transfer.id !== activeTransfer?.id &&
          (transfer.status === "Aceptada" ||
          [
            "En preparación",
            "Pendiente de visto bueno del área",
            "Pendiente de revisión administrativa",
            "Con observaciones",
          ].includes(
            transfer.status,
          )),
      )
      .flatMap((transfer) => transfer.recordIds),
  );
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Mazatlan" });
  const eligible = allRecords.filter(record => activeTransfer
    ? activeTransfer.recordIds.includes(record.id)
    : record.stage === "Archivo de trámite" && record.areaId === currentUser.areaId
      && (record.inventoryCreatedBy ?? record.createdBy) === currentUser.id
      && !blockedIds.has(record.id) && !record.transferReference && record.availability !== "Prestado"
      && (testMode === true || Boolean(record.closeDate && record.tramiteDueDate && record.tramiteDueDate <= today)));
  const shown = eligible.filter((record) => {
    const query = search.toLowerCase();
    return (
      !query ||
      record.recordNumber.toLowerCase().includes(query) ||
      record.title.toLowerCase().includes(query) ||
      record.cadidoCode.toLowerCase().includes(query)
    );
  });
  const selectedRecords = eligible.filter((record) =>
    sourceIds.includes(record.inventoryId || record.id) && selectedIds.includes(record.id),
  );
  const eligibleInventories = Array.from(
    eligible.reduce((groups, record) => {
      const key = record.inventoryId || record.id;
      groups.set(key, [...(groups.get(key) ?? []), record]);
      return groups;
    }, new Map<string, ArchivalRecord[]>()),
  );

  const visibleExpedientes = shown.filter(record => sourceIds.includes(record.inventoryId || record.id));
  const selectedSources = eligibleInventories.filter(([id]) => sourceIds.includes(id));
  const goToStep = (target: number) => {
    setError("");
    setSearch("");
    setStep(target);
  };

  return (
    <div className="transfer-wizard-page">
      <div className="record-form-top">
        <div>
          <button className="text-button" onClick={onCancel}>
            <ArrowLeft size={17} />
            Volver a la bandeja
          </button>
          <h2>{activeTransfer ? `Corregir ${activeTransfer.folio}` : "Nueva transferencia"}</h2>
          <p>
            Prepara el inventario de transferencia primaria sin modificar la etapa de los
            expedientes.
          </p>
        </div>
        <span className="record-mode">
          <Files size={16} />
          Transferencia primaria
        </span>
      </div>
      {activeTransfer?.status === "Con observaciones" && (
        <div className="transfer-observation-banner">
          <MessageSquareText size={18} />
          <span>
            <strong>Observación de la revisión</strong>
            {activeTransfer.observation}
          </span>
        </div>
      )}
      <TransferProgress current={step} resend={Boolean(activeTransfer)} />
      <section className="surface transfer-wizard">
        {step === 0 && (
          <div className="transfer-step">
            <div className="step-heading">
              <span><FolderArchive size={21} /></span>
              <div><h3>Selecciona los archivos de Trámite</h3><p>Marca uno o varios de tus archivos. Después elegirás los expedientes de cada uno.</p></div>
            </div>
            {settingsError && <p role="alert" className="field-error">{settingsError}</p>}
            {testMode === null && !settingsError && !activeTransfer && <p role="status">Consultando archivos elegibles…</p>}
            {!eligibleInventories.length && (testMode !== null || activeTransfer) && <p>No hay archivos con expedientes elegibles.</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              {eligibleInventories.map(([id, records]) => (
                <label key={id} className={`flex min-w-0 cursor-pointer items-start gap-3 rounded-lg border p-4 ${sourceIds.includes(id) ? "border-emerald-700 bg-emerald-50" : "border-[#c8d4cc] bg-[#fbfaf6]"}`}>

                    <input type="checkbox" className="mt-1 size-4 shrink-0 accent-emerald-800" checked={sourceIds.includes(id)} disabled={Boolean(activeTransfer)}
                      onChange={event => {
                        if (event.target.checked) {
                          setSourceIds(current => [...current, id]);
                        } else {
                          setSourceIds(current => current.filter(source => source !== id));
                          setSelectedIds(current => current.filter(recordId => !records.some(record => record.id === recordId)));
                        }
                      }} />
                    <span className="min-w-0 break-words"><strong className="block text-sm">{records[0].cadidoSeriesName || records[0].cadidoCode}</strong>
                      <small className="block text-[#435951]">{id} · {records.length} expedientes elegibles</small></span>
                </label>
              ))}
            </div>
          </div>
        )}
        {step === 1 && (
          <div className="transfer-step">
            <div className="step-heading">
              <span>
                <ListChecks size={21} />
              </span>
              <div>
                <h3>Seleccionar expedientes de Trámite</h3>
                <p>
                  Selecciona los expedientes que vas a transferir de tus archivos en el área{" "}
                  {areaName(currentUser.areaId)}.
                </p>
              </div>
            </div>
            <div className="eligible-toolbar">
              <label className="search-box">
                <Search size={17} />
                <input
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por número, asunto o código CADIDO..."
                  value={search}
                />
              </label>
              <span>{selectedIds.length} expedientes seleccionados</span>
            </div>
            {settingsError && <p role="alert" className="field-error">{settingsError}</p>}
            <div className="eligible-list inventory-eligible-list">
              {visibleExpedientes.length > 0 ? (
                <div className="table-scroll">
                  <table className="data-table">
                    <thead><tr>
                      <th>Seleccionar</th><th>Número de expediente</th><th>Título o asunto</th>
                      <th>Clave archivística</th><th>Archivo de origen</th>
                    </tr></thead>
                    <tbody>{visibleExpedientes.map(record => {
                      const checked = selectedIds.includes(record.id);
                      return <tr key={record.id}>
                        <td><input type="checkbox" aria-label={`Transferir expediente ${record.recordNumber}`}
                          style={{ appearance: "auto", width: 18, height: 18, accentColor: "#245348" }}
                          checked={checked} disabled={Boolean(activeTransfer) || (!checked && selectedIds.length >= 1000)}
                          onChange={event => {
                            const mark = event.target.checked;
                            setSelectedIds(current => mark ? [...current, record.id] : current.filter(id => id !== record.id));
                          }} /></td>
                        <td><strong>{record.recordNumber}</strong></td>
                        <td>{record.title}</td>
                        <td><span className="cadido-code">{record.archiveClassificationCode || record.cadidoCode}</span></td>
                        <td>{record.cadidoSeriesName || record.cadidoCode}</td>
                      </tr>;
                    })}</tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state compact-empty">
                  <Files size={27} />
                  <strong>No hay expedientes elegibles</strong>
                  <p>
                    Los expedientes incluidos en solicitudes activas no pueden seleccionarse
                    nuevamente.
                  </p>
                </div>
              )}
            </div>
            {error && (
              <div className="validation-summary">
                <AlertCircle size={17} />
                {error}
              </div>
            )}
          </div>
        )}
        {step === 2 && (
          <div className="transfer-step transfer-step--wide">
            <div className="step-heading">
              <span>
                <Files size={21} />
              </span>
              <div>
                <h3>Vista previa del inventario</h3>
                <p>
                  Inventario de transferencia primaria generado con los datos archivísticos
                  registrados.
                </p>
              </div>
            </div>
            <dl className="mb-4 grid gap-3 rounded-lg border border-[#b4c4ba] bg-[#e5eae2] px-4 py-3 text-sm sm:grid-cols-3">
              <div><dt className="text-xs text-[#435951]">Solicitante</dt><dd className="font-semibold">{fullName(currentUser)}</dd></div>
              <div><dt className="text-xs text-[#435951]">Área solicitante</dt><dd className="font-semibold">{areaName(currentUser.areaId)}</dd></div>
              <div><dt className="text-xs text-[#435951]">Selección</dt><dd className="font-semibold">{new Set(selectedRecords.map(record => record.inventoryId)).size} archivos · {selectedRecords.length} expedientes</dd></div>
            </dl>
            <InventoryTable records={selectedRecords} />
            <div className="inventory-note">
              <ShieldCheck size={17} />
              Esta vista previa no modifica los expedientes ni su etapa archivística.
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="transfer-step">
            <div className="step-heading">
              <span><Files size={21} /></span>
              <div><h3>Acuse de solicitud</h3><p>Adjunta el acuse de la solicitud de transferencia antes de enviarla al encargado.</p></div>
            </div>
            <div className="grid gap-4 rounded-lg border border-[#c8d4cc] bg-[#fbfaf6] p-4 md:grid-cols-2">
              <label className="form-field"><span>Folio o referencia del acuse</span>
                <input value={receiptDetail} maxLength={2000} onChange={event => setReceiptDetail(event.target.value)} />
              </label>
              <label className="form-field"><span>Acuse en PDF (máximo 4 MB)</span>
                <input type="file" accept=".pdf,application/pdf" onChange={event => {
                  const file = event.target.files?.[0] ?? null;
                  const valid = file && /\.pdf$/i.test(file.name) && file.size <= 4194304 && file.size > 0;
                  setReceiptFile(valid ? file : null);
                  setError(file && !valid ? "Adjunta un PDF válido de hasta 4 MB." : "");
                }} />
                {receiptFile && <small>Adjunto: {receiptFile.name}</small>}
              </label>
            </div>
            {error && <p className="field-error" role="alert">{error}</p>}
          </div>
        )}
        <div className="record-wizard__footer">
          <Button className="button--ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <div>
            {step > 0 && (
              <Button
                className="button--secondary"
                onClick={() => goToStep(step - 1)}
              >
                <ChevronLeft size={17} />
                Anterior
              </Button>
            )}
            {step < finalStep ? (
              <Button className="button--primary" disabled={step === 0 ? !selectedSources.length : !selectedRecords.length}
                onClick={() => {
                  if (step === 1 && activeTransfer && selectedRecords.length !== activeTransfer.recordIds.length) {
                    setError("No se pudieron cargar todos los expedientes de la solicitud original.");
                    return;
                  }
                  goToStep(step + 1);
                }}>
                {step === 0 ? "Continuar" : step === 1 ? "Ver vista previa" : "Adjuntar acuse"} <ArrowRight size={17} />
              </Button>
            ) : (
              <Button className="button--primary" disabled={!selectedRecords.length || (!activeTransfer && (!receiptFile || receiptDetail.trim().length < 5)) || (Boolean(activeTransfer) && selectedRecords.length !== activeTransfer?.recordIds.length)} onClick={() => setConfirmOpen(true)}>
                <Send size={17} /> {activeTransfer ? "Reenviar solicitud" : "Confirmar envío"}
              </Button>
            )}
          </div>
        </div>
      </section>
      {confirmOpen && (
        <ConfirmationModal
          count={selectedRecords.length}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={async correction => {
            let receipt: TransferReceipt | undefined;
            if (!activeTransfer) {
              if (!receiptFile || receiptDetail.trim().length < 5) throw new Error("Completa el acuse de solicitud.");
              const pdf = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result).split(",")[1]);
                reader.onerror = () => reject(new Error("No se pudo leer el PDF del acuse."));
                reader.readAsDataURL(receiptFile);
              });
              receipt = { detail: receiptDetail.trim(), pdf };
            }
            await onSubmit(selectedRecords.map(record => record.id), activeTransfer, correction, receipt);
          }}
          resend={Boolean(activeTransfer)}
        />
      )}
    </div>
  );
}

const hasStorageLocation = (record: ArchivalRecord) =>
  record.stage === "Archivo de concentración" && Boolean(record.shelf && record.level && record.physicalSection);

function TransferStorage({ records }: { records: ArchivalRecord[] }) {
  const groups = new Map<string, ArchivalRecord[]>();
  const located = records.filter(hasStorageLocation);
  for (const record of located) {
    const key = JSON.stringify([record.archiveZone, record.room, record.shelf, record.level, record.physicalSection, record.position]);
    const group = groups.get(key);
    if (group) group.push(record);
    else groups.set(key, [record]);
  }
  return (
    <section className="surface min-w-0 overflow-hidden rounded-xl">
      <div className="records-filter-head"><h3>Ubicación actual en Concentración</h3></div>
      <div className="grid gap-4 bg-[#e5eae2] p-4 sm:p-5">
      {!groups.size && <p className="mt-2 text-sm">No hay una ubicación disponible para los expedientes visibles.</p>}
      {[...groups.entries()].map(([key, group]) => {
        const record = group[0];
        const boxes = [...new Set(group.map(item => item.locationBox || item.boxNumber).filter(Boolean))];
        return (
          <div key={key} className="grid min-w-0 gap-3 [overflow-wrap:anywhere]">
            <div className="rounded-lg border border-[#b4c4ba] bg-[#f8f7f2] p-3 text-sm">
              <p>{[record.archiveZone, record.room].filter(Boolean).join(" · ")}</p>
              <p className="font-semibold">Estante {record.shelf} · Nivel {record.level} · Sección {record.physicalSection}</p>
              {record.position && <p>Posición {record.position}</p>}
              {boxes.length > 0 && <p>{boxes.length === 1 ? "Caja" : "Cajas"} {boxes.join(", ")}</p>}
              <p>{group.length} {group.length === 1 ? "expediente" : "expedientes"} en esta ubicación</p>
            </div>
            <LocationShelf level={record.level} section={record.physicalSection} />
            <details className="text-sm">
              <summary className="cursor-pointer text-[#1e5b4f]">Ver ubicación por expediente</summary>
              <ul className="mt-2 grid max-h-48 gap-1 overflow-auto">
                {group.map(item => <li key={item.id}>
                  {item.recordNumber || item.id} · {item.locationBox || item.boxNumber ? `Caja ${item.locationBox || item.boxNumber}` : "Sin caja registrada"}
                  {item.locationNotes && <small className="block">{item.locationNotes}</small>}
                </li>)}
              </ul>
            </details>
          </div>
        );
      })}
      {located.length > 0 && located.length < records.length && <p className="text-sm">Hay expedientes visibles sin ubicación completa.</p>}
      </div>
    </section>
  );
}

function RequestDetail({
  onDocumentsChange,
  onCancelRequest,
  onContinue,
  onAreaApprove,
  canReceive,
  currentUser,
  onAccept,
  onBack,
  onHistory,
  onReceive,
  onReturn,
  permissions,
  records,
  role,
  transfer,
  users,
}: {
  canReceive: boolean;
  currentUser: UserRecord;
  onAccept: () => void;
  onAreaApprove: () => void;
  onCancelRequest?: () => void;
  onContinue: () => void;
  onDocumentsChange: (transfer: DocumentaryTransfer) => void;
  onBack: () => void;
  onHistory: () => void;
  onReceive: () => void;
  onReturn: () => void;
  permissions: string[];
  records: ArchivalRecord[];
  role: Role;
  transfer: DocumentaryTransfer;
  users: UserRecord[];
}) {
  const [detailView, setDetailView] = useState<TransferDetailView>("tracking");
  const [documentKind, setDocumentKind] = useState("");
  const task = transferTask(transfer, currentUser, role, permissions);
  const received = transfer.receptionStatus === "Recibida";
  const canSeeStorage = role === "Administrador / Coordinador" ||
    (role === "Encargado de área" && transfer.areaId === currentUser.areaId);
  const [expandedStep, setExpandedStep] = useState<number | null>(() => received ? trackingSteps.length - 1 : null);
  const included = records.filter((record) => transfer.recordIds.includes(record.id));
  const showStorage = received && canSeeStorage && included.some(hasStorageLocation);
  const documents = transfer.documents ?? [];
  const lastNote = documents.map(doc => doc.kind).lastIndexOf("SOLICITUD");
  const needsReceipt = lastNote >= 0 && !documents.slice(lastNote + 1).some(doc => doc.kind === "ACUSE_SOLICITUD" && doc.hasFile);
  const canReview =
    role === "Administrador / Coordinador" &&
    transfer.status === "Pendiente de revisión administrativa" &&
    transfer.requestedBy !== currentUser.id &&
    permissions.includes("review-transfers");
  const canAccept =
    role === "Administrador / Coordinador" &&
    transfer.status === "Pendiente de revisión administrativa" &&
    transfer.requestedBy !== currentUser.id &&
    permissions.includes("accept-transfers");
  const canAreaReview =
    (role === "Administrador / Coordinador" || (role === "Encargado de área" &&
      transfer.areaId === currentUser.areaId && permissions.includes("approve-area-transfers"))) &&
    transfer.status === "Pendiente de visto bueno del área" && transfer.requestedBy !== currentUser.id;
  return (
    <div className="transfer-detail-page">
      <button className="text-button" onClick={onBack}>
        <ArrowLeft size={17} />
        Volver a la bandeja
      </button>
      <header className="surface mt-3 mb-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-xl px-5 py-4">
        <div className="grid min-w-0 gap-1">
          <h2 className="break-words text-xl font-semibold text-[#002f2a]">Transferencia primaria · {areaName(transfer.areaId)}</h2>
          <span className="block break-words text-xs font-normal text-[#52605a]">Folio {transfer.folio}</span>
          <p className="text-sm text-[#435951]">{included.length} expedientes</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TransferStatusBadge status={transfer.status} />
          {transfer.status === "Aceptada" && <ReceptionBadge status={transfer.receptionStatus} />}
          <button type="button" className="button button--secondary" onClick={onHistory}>
            <History size={15} /> Historial
          </button>
        </div>
      </header>
      {transfer.status === "Con observaciones" && (
        <div className="transfer-observation-banner">
          <MessageSquareText size={18} />
          <span>
            <strong>Observaciones de la revisión</strong>
            {transfer.observation}
          </span>
        </div>
      )}
        <section className="surface mb-5 overflow-hidden rounded-xl text-sm">
          <div className="records-filter-head"><h3>Datos de la solicitud</h3></div>
          <dl className="grid bg-[#edf0e9] px-5 py-4 grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-2 [&_dd]:min-w-0 [&_dd]:break-words [&_dd]:font-medium [&_dt]:text-[#435951] lg:grid-cols-[max-content_minmax(0,1fr)_max-content_minmax(0,1fr)]">
            <dt>Solicitante</dt><dd>{requesterName(transfer, users)}</dd>
            <dt>Envío</dt><dd>{formatDate(transfer.submittedAt)}</dd>
            <dt>Encargado</dt><dd>{transfer.assignedAreaManagerName || "Sin encargado registrado"}</dd>
            {transfer.areaApproverId && <><dt>Visto bueno</dt><dd>{transfer.areaApproverName || userName(users, transfer.areaApproverId)}</dd></>}
            {transfer.status === "Aceptada" && <>
              <dt>Dictamen</dt><dd>{formatDate(transfer.acceptedAt)} · {transfer.reviewerName || userName(users, transfer.reviewerId)}</dd>
              <dt>Recepción</dt><dd><ReceptionBadge status={transfer.receptionStatus} />{transfer.receptionDate && <> · {formatDate(transfer.receptionDate)}</>}{transfer.receptionResponsible && <> · {transfer.receptionResponsibleName || userName(users, transfer.receptionResponsible)}</>}</dd>
            </>}
          </dl>
        </section>
      <nav className="mb-4 flex flex-wrap gap-2 rounded-xl border border-[#c8d4cc] bg-[#e9eee8] p-2" aria-label="Detalle de la transferencia">
        {([["tracking", "Seguimiento"], ["documents", "Documentos de la transferencia"], ["inventory", "Inventario"]] as const).map(([value, label]) => (
          <button type="button" key={value} aria-current={detailView === value ? "true" : undefined}
            className={`inline-flex items-center gap-2 rounded-md border px-3 py-2.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1e5b4f] ${detailView === value ? "border-[#789b8a] bg-[#fbfaf6] text-[#002f2a] shadow-sm" : "border-transparent text-[#35584b] hover:bg-[#dce7df]"}`} onClick={() => { setDocumentKind(""); setDetailView(value); }}>
            {label}{value === "documents" && <span className="rounded-full bg-[#dce7df] px-1.5 text-xs text-[#244f41]">{documents.length}</span>}
          </button>
        ))}
      </nav>
      {detailView === "inventory" && (
      <section className="surface request-inventory">
        <div className="section-heading">
          <div>
            <h2>Inventario de transferencia</h2>
            <p>Expedientes incluidos sin duplicar sus registros originales.</p>
          </div>
          <span className="demo-label">{included.length} expedientes</span>
        </div>
        <InventoryTable records={included} />
      </section>
      )}
      {detailView === "documents" && <TransferDocuments key={transfer.id} transfer={transfer} user={currentUser} initialKind={documentKind} onChange={onDocumentsChange} />}
      {detailView === "tracking" && <>
      <div className={showStorage ? "grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]" : "grid gap-4"}>
        <section className="surface min-w-0 overflow-hidden rounded-xl">
          <div className="records-filter-head"><h3>Progreso de la transferencia</h3></div>
          <div className="grid min-w-0 gap-4 bg-[#e5eae2] p-4 sm:p-5">
            {task.step >= 0 && <ol className="m-0 list-none p-0">
              {trackingSteps.map(({ title, kinds }, index) => {
                const current = index === task.step;
                const done = index < task.step;
                const expanded = expandedStep === index;
                const evidence = documents.filter(doc => kinds.includes(doc.kind));
                return <li key={title} aria-current={current ? "step" : undefined}
                  className="relative min-h-10 pb-3 last:pb-0">
                  {index < trackingSteps.length - 1 && <span aria-hidden="true" className="absolute top-6 bottom-0 left-[11px] w-px bg-[#a9beb5]" />}
                  <button type="button" aria-expanded={expanded} onClick={() => setExpandedStep(expanded ? null : index)}
                    className="relative flex w-full cursor-pointer items-start gap-3 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2">
                    <span aria-hidden="true" className={`grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold ${current ? "border-[#1e5b4f] bg-[#1e5b4f] text-white" : done ? "border-[#a9beb5] bg-[#dfe9e4] text-[#002f2a]" : "border-[#a9beb5] bg-white text-[#435951]"}`}>
                      {done ? <Check size={14} /> : index + 1}
                    </span>
                    <span className="flex-1">
                      <strong>{title}</strong>
                      <small className="block text-[#435951]">{current ? "En curso" : done ? "Completado" : "Pendiente"}</small>
                    </span>
                    <ChevronDown size={16} aria-hidden="true" className={expanded ? "rotate-180" : ""} />
                  </button>
                  {expanded && <div className="ml-8 mt-2 rounded-lg border border-[#b4c4ba] bg-[#f8f7f2] p-3">
                    {evidence.length > 0 ? <ul className="grid gap-2">
                      {evidence.map(doc => <li key={doc.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
                        <span>{documentNames[doc.kind] ?? doc.kind}{doc.date && <small className="block text-[#435951]">{formatDate(doc.date)}</small>}</span>
                        <a className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-semibold text-[#1e5b4f] hover:bg-[#dfebe3] focus-visible:outline-2" aria-label={`Descargar ${documentNames[doc.kind] ?? doc.kind}`} href={transferApi.documentUrl(transfer.id, doc.id)}><Download size={14} /> Descargar</a>
                        {doc.detail && <details className="basis-full text-xs"><summary className="cursor-pointer text-[#1e5b4f]">Ver datos</summary><p className="mt-1 whitespace-pre-wrap [overflow-wrap:anywhere]">{doc.detail}</p></details>}
                      </li>)}
                    </ul> : <p className="text-sm">Sin documentos registrados para esta etapa.</p>}
                    {index === 2 && transfer.areaApprovedAt && transfer.status !== "Cancelada" &&
                      <a className="text-button mt-2" href={transferApi.documentUrl(transfer.id)}><Download size={14} /> Formato de transferencia primaria (Excel)</a>}
                  </div>}
                </li>;
              })}
            </ol>}
          {!received && <div className="rounded-lg border border-[#b4c4ba] bg-[#f8f7f2] p-4">
            <p className="text-sm font-semibold text-[#1e5b4f]">{task.mine ? "Te toca a ti" : task.owner ? "Siguiente acción" : "Solicitud cerrada"}</p>
            <h3 className="mt-1 text-lg font-semibold">{task.label}</h3>
            {task.owner && <p className="mt-1 text-sm">{task.owner}</p>}
            {task.mine && "kind" in task && task.kind && <div className="mt-3">
              <Button className="button--primary" onClick={() => { setDocumentKind(task.kind ?? ""); setDetailView("documents"); }}>Abrir documento</Button>
            </div>}
            {task.mine && task.step === 0 && !("kind" in task) && <div className="mt-3">
              <Button className="button--primary" onClick={onContinue}>{task.label}</Button>
            </div>}
            {task.mine && task.step === 4 && !("kind" in task) && <div className="mt-3">
              <Button className="button--primary" onClick={onReceive}><PackageCheck size={16} /> Registrar recepción</Button>
            </div>}
            {(canReview || canAccept) && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <p className="w-full text-sm">El dictamen favorable autoriza el traslado. La etapa cambia al confirmar la recepción física.</p>
                {canReview && (
                  <Button className="button--danger-outline" onClick={onReturn}>
                    <RotateCcw size={16} />
                    Devolver con observaciones
                  </Button>
                )}
                {canAccept && (
                  <Button className="button--primary" onClick={onAccept}>
                    <Check size={17} />
                    Emitir dictamen favorable
                  </Button>
                )}
              </div>
            )}
            {canAreaReview && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {needsReceipt && <p className="w-full text-sm">El área debe adjuntar el acuse antes de otorgar el visto bueno.</p>}
                <Button className="button--danger-outline" onClick={onReturn}>
                  <RotateCcw size={16} />
                  Devolver con observaciones
                </Button>
                <Button className="button--primary" onClick={onAreaApprove} disabled={needsReceipt}>
                  <Check size={17} />
                  Dar visto bueno
                </Button>
              </div>
            )}
            {role === "Administrador / Coordinador" &&
              transfer.status === "Pendiente de revisión administrativa" &&
              transfer.requestedBy === currentUser.id && (
                <div className="blocked-review">
                  <ShieldCheck size={17} />
                  No puedes aprobar una transferencia solicitada por tu propia cuenta.
                </div>
              )}
          </div>}
          </div>
        </section>
        {showStorage && <TransferStorage records={included} />}
      </div>
      {onCancelRequest && <div className="flex justify-end"><Button className="button--danger-outline" onClick={onCancelRequest}>Cancelar solicitud</Button></div>}
      </>}
    </div>
  );
}

function ReturnModal({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: (observation: string) => void;
}) {
  const [observation, setObservation] = useState("");
  const [error, setError] = useState("");
  return (
    <div className="modal-backdrop">
      <div className="modal decision-modal">
        <div className="modal__header">
          <div>
            <span>Decisión administrativa</span>
            <h2>Devolver con observaciones</h2>
          </div>
          <button className="icon-action" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>
        <div className="modal__body">
          <p className="modal__intro">
            La observación será visible para el área solicitante y deberá atenderse antes del
            reenvío.
          </p>
          <label className={`form-field ${error ? "has-error" : ""}`}>
            <span>
              Observaciones de la revisión<b>*</b>
            </span>
            <textarea
              onChange={(event) => {
                setObservation(event.target.value);
                setError("");
              }}
              placeholder="Describe con claridad los ajustes requeridos..."
              rows={5}
              value={observation}
            />
            {error && <small className="field-error">{error}</small>}
          </label>
        </div>
        <div className="modal__footer">
          <Button className="button--secondary" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            className="button--danger"
            onClick={() => {
              if (!observation.trim()) {
                setError("Registra una observación antes de devolver la solicitud.");
                return;
              }
              onConfirm(observation.trim());
            }}
          >
            <RotateCcw size={16} />
            Confirmar devolución
          </Button>
        </div>
      </div>
    </div>
  );
}

const documentNames: Record<string,string> = {
  SOLICITUD:"Atenta Nota de solicitud", ACUSE_SOLICITUD:"Acuse de solicitud",
  AUTORIZACION:"Autorización del área", SOLICITUD_AMPLIACION:"Ampliación de plazo (si el área no responde)",
  DICTAMEN_FAVORABLE:"Dictamen favorable", DICTAMEN_DESFAVORABLE:"Dictamen desfavorable",
  RECEPCION:"Constancia interna de recepción", DIFERENCIAS:"Registro de diferencias en recepción",
  CANCELACION:"Constancia de cancelación",
  CORRECCION_FORMATO:"Registro de corrección y reenvío a Concentración",
  OBSERVACION_AREA:"Observación del área", NOTA_TRASLADO:"Atenta Nota al Enlace Administrativo",
  ACUSE_TRASLADO:"Acuse de traslado", ENTREGA:"Registro interno de entrega con representante del área",
  FORMATO_FIRMADO:"Formato de transferencia con firmas autógrafas",
};

function TransferDocuments({transfer,user,initialKind,onChange}: {
  transfer:DocumentaryTransfer; user:UserRecord; initialKind:string; onChange:(updated:DocumentaryTransfer)=>void;
}) {
  const [detail,setDetail]=useState("");
  const [kind,setKind]=useState(initialKind);
  const [file,setFile]=useState<File|null>(null);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const {confirm,dialog}=useConfirmAction();
  const sender=transfer.requestedBy===user.id ||
    (transfer.areaId===user.areaId && user.roles.includes("Encargado de área"));
  const documents=transfer.documents ?? [];
  const hasDocument=(kind:string)=>documents.some(doc=>doc.kind===kind);
  const options:string[]=[];
  const canRequestExtension = sender && transfer.status === "Pendiente de visto bueno del área";
  if (canRequestExtension) {
    options.push("ACUSE_SOLICITUD");
    if (kind === "SOLICITUD_AMPLIACION") options.push("SOLICITUD_AMPLIACION");
  }
  if(transfer.status==="Aceptada" && transfer.receptionStatus!=="Recibida"){
    if(sender){
      options.push("NOTA_TRASLADO");
      if(hasDocument("NOTA_TRASLADO"))options.push("ACUSE_TRASLADO");
      if(hasDocument("ACUSE_TRASLADO"))options.push("ENTREGA");
    }
    if(user.roles.includes("Administrador / Coordinador") &&
      (hasDocument("ENTREGA") || !hasDocument("DICTAMEN_FAVORABLE")))options.push("FORMATO_FIRMADO");
  }
  const selected=options.includes(kind) ? kind : options.find(option => !hasDocument(option)) ?? options[0] ?? "";
  const lastRequest=documents.map(doc=>doc.kind).lastIndexOf("SOLICITUD");
  const current=[...documents].reverse().find(doc=>doc.kind===selected &&
    (selected!=="ACUSE_SOLICITUD" || documents.indexOf(doc)>lastRequest));
  const [editingId,setEditingId]=useState("");
  const [fileVersion,setFileVersion]=useState(0);
  const editing=Boolean(current && current.id===editingId);
  const changeDocument = (nextKind: string) => {
    setKind(nextKind);
    setFile(null);
    setEditingId("");
    setDetail("");
    setError("");
  };
  const saveError=(error:unknown)=>setError(error instanceof Error?error.message:"No se pudo guardar el documento.");
  return <section className="surface grid gap-4 rounded-xl p-4 sm:p-5">
    <header className="flex items-center gap-2 text-[#002f2a]"><Files size={19} /><h3 className="text-base font-semibold">Documentos de la transferencia</h3></header>
    {transfer.status!=="Cancelada" && <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#c8d4cc] bg-[#e9eee8] p-3">
    <a className="button button--secondary" href={transferApi.documentUrl(transfer.id)}><Download size={15} />{transfer.areaApprovedAt ? "Formato de transferencia primaria (Excel)" : "Relación de expedientes (Excel)"}</a>
    <a className="button button--secondary" href={transferApi.documentUrl(transfer.id,undefined,true)}>Descargar copia</a>
    </div>}
    {canRequestExtension && <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-[#c8d4cc] bg-[#fbfaf6] px-3 py-2 text-sm">
      <button type="button" className="text-button" disabled={busy}
        onClick={() => changeDocument(selected === "SOLICITUD_AMPLIACION" ? "ACUSE_SOLICITUD" : "SOLICITUD_AMPLIACION")}>
        {selected === "SOLICITUD_AMPLIACION" ? "Volver al acuse de solicitud" :
          hasDocument("SOLICITUD_AMPLIACION") ? "Consultar ampliación de plazo" : "Registrar ampliación de plazo (opcional)"}
      </button>
      <p>Solo corresponde si el área generadora no responde.</p>
    </div>}
    {options.length>0 && <form className="transfer-documents__form min-w-0 rounded-lg border border-[#c8d4cc] bg-[#fbfaf6] p-4 sm:p-5" style={{ gridTemplateColumns: "minmax(0, 1fr)" }} onSubmit={async event=>{
      event.preventDefault();
      if(busy)return;
      setBusy(true);
      setError("");
      try{
        if(file && file.size>4194304)throw new Error("El PDF debe pesar hasta 4 MB.");
        const pdf=file ? await new Promise<string>((resolve,reject)=>{
          const reader=new FileReader();
          reader.onload=()=>resolve(String(reader.result).split(",")[1]);
          reader.onerror=()=>reject(new Error("No se pudo leer el PDF."));
          reader.readAsDataURL(file);
        }):undefined;
        onChange(await transferApi.document(transfer.id,selected,detail,pdf,editing ? current?.id : undefined));
        setEditingId("");
        setFileVersion(n=>n+1);
        setDetail("");
        setFile(null);
      }catch(error){setError(error instanceof Error?error.message:"No se pudo guardar el documento.");}
      finally{setBusy(false);}
    }}>
      <label className="w-full max-w-xl">Documento<select className="min-h-10" value={selected} onChange={e=>changeDocument(e.target.value)}>
        {options.map(option=><option key={option} value={option}>{documentNames[option]}</option>)}
      </select></label>
      {selected === "ACUSE_SOLICITUD" && <p className="rounded-md border-l-4 border-[#789b8a] bg-[#e9eee8] px-3 py-2 text-sm text-[#35584b]">Adjunta el acuse de la última Atenta Nota antes del visto bueno.</p>}
      {selected === "NOTA_TRASLADO" && <p className="rounded-md border-l-4 border-[#789b8a] bg-[#e9eee8] px-3 py-2 text-sm text-[#35584b]">Se usa después del dictamen favorable para solicitar el vehículo al Enlace Administrativo.</p>}
      {selected === "ACUSE_TRASLADO" && <p className="rounded-md border-l-4 border-[#789b8a] bg-[#e9eee8] px-3 py-2 text-sm text-[#35584b]">Es la copia de recibido de la Atenta Nota de traslado.</p>}
      {selected === "FORMATO_FIRMADO" && <p className="rounded-md border-l-4 border-[#789b8a] bg-[#e9eee8] px-3 py-2 text-sm text-[#35584b]">Adjunta la copia con firmas autógrafas que acredita la entrega.</p>}
      {selected === "ENTREGA" && <p className="rounded-md border-l-4 border-[#789b8a] bg-[#e9eee8] px-3 py-2 text-sm text-[#35584b]">Registro interno de la entrega física. El formato con firmas autógrafas acredita la entrega.</p>}
      {current && !editing ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#c8d4cc] bg-[#edf0e9] px-4 py-3">
        <p className="text-sm font-medium text-[#002f2a]" role="status">Evidencia guardada</p>
        <div className="flex flex-wrap items-center gap-2">
        <Button className="button--secondary" disabled={busy} onClick={()=>{setEditingId(current.id);setDetail(current.detail);setError("");}}>Editar</Button>
        <Button className="button--danger-outline" disabled={busy} onClick={async()=>{
          if(!await confirm({title:"Eliminar evidencia",message:"La evidencia se retirará del folio.",confirmText:"Eliminar evidencia",danger:true}))return;
          setBusy(true);setError("");
          try{onChange(await transferApi.document(transfer.id,selected,"",undefined,current.id,true));}
          catch(error){saveError(error);}
          finally{setBusy(false);}
        }}>Eliminar</Button>
        </div>
      </div> : <>
      <div className="grid min-w-0 items-start gap-4 md:grid-cols-2">
      <label>Folio y datos de la evidencia<textarea rows={3} required minLength={5} maxLength={2000} value={detail} onChange={e=>setDetail(e.target.value)} /></label>
      <label>PDF de evidencia<input className="min-h-10 file:mr-2 file:rounded file:border-0 file:bg-[#e5eae2] file:px-2 file:py-1 file:text-[#244f41]" key={selected+":"+fileVersion} type="file" accept="application/pdf"
        required={["ACUSE_SOLICITUD","ACUSE_TRASLADO","FORMATO_FIRMADO"].includes(selected) && !(editing && current?.hasFile)}
        onChange={e=>setFile(e.target.files?.[0] ?? null)} />{editing && current?.hasFile && <span className="text-xs font-normal text-[#435951]">Si dejas este campo vacío, se conserva el PDF guardado.</span>}</label>
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-[#c8d4cc] pt-3">
      <button type="submit" className="button button--primary" disabled={busy}>{busy ? "Guardando…" : editing ? "Guardar cambios" : "Guardar documento"}</button>
      </div>
      </>}
      {error && <p role="alert" className="field-error">{error}</p>}
    </form>}
    <section aria-label="Historial de documentos" className="min-w-0 rounded-lg border border-[#c8d4cc] bg-[#e9eee8] p-4">
      <h4 className="mb-3 text-sm font-semibold text-[#002f2a]">Documentos registrados ({documents.length})</h4>
      {documents.length > 0 ? (
        <ol className="m-0 list-none p-0">
          {documents.map((doc, index) => (
            <li key={doc.id} className="relative flex items-start gap-3 pb-4 last:pb-0">
              {index < documents.length - 1 && (
                <span aria-hidden="true" className="absolute top-5 bottom-0 left-[9px] w-px bg-[#a9beb5]" />
              )}
              <span aria-hidden="true" className="relative grid size-5 shrink-0 place-items-center rounded-full bg-[#dfe9e4] text-[#1e5b4f]">
                <Check size={12} />
              </span>
              <div className="min-w-0 flex-1 rounded-md border border-[#c8d4cc] bg-[#fbfaf6] px-3 py-2.5">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                  <div className="min-w-0">
                    <strong className="text-sm text-[#002f2a]">{documentNames[doc.kind] ?? doc.kind}</strong>
                    {doc.date && <time dateTime={doc.date} className="block text-xs text-[#435951]">{formatDate(doc.date)}</time>}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <a className="text-button" aria-label={`Descargar ${documentNames[doc.kind] ?? doc.kind}`} href={transferApi.documentUrl(transfer.id, doc.id)}>
                      <Download size={14} /> Descargar {doc.hasFile ? "PDF" : "Word"}
                    </a>
                    {!doc.hasFile && <a className="text-button" aria-label={`Descargar copia de ${documentNames[doc.kind] ?? doc.kind}`} href={transferApi.documentUrl(transfer.id, doc.id, true)}>Copia</a>}
                  </div>
                </div>
                {doc.detail && (
                  <details className="mt-1.5 text-xs">
                    <summary className="cursor-pointer text-[#1e5b4f]">Ver detalle</summary>
                    <p className="mt-1 whitespace-pre-wrap [overflow-wrap:anywhere]">{doc.detail}</p>
                  </details>
                )}
              </div>
            </li>
          ))}
        </ol>
      ) : <p>Aún no hay documentos guardados.</p>}
    </section>
    {dialog}
  </section>;
}

function CancelTransferModal({onClose,onSave}: {onClose:()=>void;onSave:(reason:string)=>Promise<void>}) {
  const [reason,setReason]=useState("");
  const [error,setError]=useState("");
  const [saving,setSaving]=useState(false);
  return <div className="modal-backdrop">
    <form className="modal decision-modal" role="dialog" aria-modal="true" aria-labelledby="cancel-transfer-title"
      onSubmit={async event=>{
        event.preventDefault();
        if(saving)return;
        if(reason.trim().length<5){setError("Indica el motivo de cancelación.");return;}
        setSaving(true);setError("");
        try{await onSave(reason.trim());}
        catch(error){setError(error instanceof Error?error.message:"No se pudo cancelar la solicitud.");}
        finally{setSaving(false);}
      }}>
      <div className="modal__header"><h2 id="cancel-transfer-title">Cancelar solicitud</h2></div>
      <div className="modal__body">
        <p>Se liberarán los inventarios y el folio quedará registrado como cancelado.</p>
        <label className="form-field">
          <span>Motivo de cancelación <b>*</b></span>
          <textarea autoFocus rows={4} maxLength={2000} value={reason} onChange={e=>{setReason(e.target.value);setError("");}} />
        </label>
        {error && <p className="field-error" role="alert">{error}</p>}
      </div>
      <div className="modal__footer">
        <Button className="button--secondary" disabled={saving} onClick={onClose}>Volver</Button>
        <Button className="button--danger" type="submit" disabled={saving}>{saving?"Cancelando…":"Confirmar cancelación"}</Button>
      </div>
    </form>
  </div>;
}

function AcceptModal({
  count,
  onCancel,
  onConfirm,
}: {
  count: number;
  onCancel: () => void;
  onConfirm: (detail: string) => void;
}) {
  const [detail, setDetail] = useState("");
  const [error, setError] = useState("");
  return (
    <div className="modal-backdrop">
      <div className="modal decision-modal decision-modal--accept">
        <div className="transfer-confirm-modal__icon">
          <CheckCircle2 size={24} />
        </div>
        <h2>Emitir dictamen favorable</h2>
        <p>
          Se autorizará preparar el traslado de {count} expediente{count === 1 ? "" : "s"}.
        </p>
        <div className="accept-warning">
          <AlertCircle size={17} />
          La recepción física se registrará posteriormente.
        </div>
        <label className="form-field transfer-dictamen-field">
          <span>Fundamento del dictamen <b>*</b></span>
          <textarea rows={4} value={detail} onChange={e => {setDetail(e.target.value); setError("");}} maxLength={2000}
            placeholder="Explica por qué procede la transferencia." aria-invalid={Boolean(error)} />
          {error && <small className="field-error" role="alert">{error}</small>}
        </label>
        <div className="modal__footer">
          <Button className="button--secondary" onClick={onCancel}>
            Cancelar
          </Button>
          <Button className="button--primary" onClick={() => { if (detail.trim().length >= 5) onConfirm(detail.trim()); else setError("Captura un fundamento de al menos 5 caracteres."); }}>
            <Check size={17} />
            Confirmar dictamen
          </Button>
        </div>
      </div>
    </div>
  );
}

function ReceptionForm({
  currentUser,
  onBack,
  onSave,
  transfer,
}: {
  currentUser: UserRecord;
  onBack: () => void;
  onSave: (status: ReceptionStatus, date: string, notes: string, location: ReceptionLocation | null) => Promise<void>;
  transfer: DocumentaryTransfer;
}) {
  const [status, setStatus] = useState<ReceptionStatus>(
    transfer.receptionStatus === "Pendiente" ? "Recibida" : transfer.receptionStatus,
  );
  const [date, setDate] = useState(transfer.receptionDate || todayIso());
  const documents=transfer.documents ?? [];
  const requiresEvidence = documents.some(doc => doc.kind === "DICTAMEN_FAVORABLE");
  const missingDelivery = requiresEvidence && !documents.some(doc => doc.kind === "ENTREGA");
  const missingSignedFormat = requiresEvidence && !documents.some(doc => doc.kind === "FORMATO_FIRMADO");
  const missingEvidence = missingDelivery || missingSignedFormat;
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState(transfer.receptionNotes);
  const [error, setError] = useState("");
  const [sourceBoxes,setSourceBoxes]=useState<ReceptionSourceBox[]>([]);
  const [boxesLoading,setBoxesLoading]=useState(true);
  const [boxesError,setBoxesError]=useState("");
  const [location,setLocation]=useState<ReceptionLocation>(()=>({
    archiveZone:"Archivo de concentración",
    room:"Sótano",shelf:"",level:"",physicalSection:"",
    position:"",locationBox:"",locationNotes:"",
  }));
  useEffect(()=>{
    let active=true;
    setBoxesLoading(true);
    transferApi.receptionBoxes(transfer.id)
      .then(boxes=>{
        if(!active)return;
        setSourceBoxes(boxes);
        setBoxesError("");
        const values=[...new Set(boxes.map(item=>item.boxNumber.trim()).filter(Boolean))];
        const allHaveSame=values.length===1&&boxes.every(item=>item.boxNumber.trim()===values[0]);
        setLocation(current=>({...current,locationBox:allHaveSame?values[0]:""}));
      })
      .catch(err=>{
        if(active){
          setBoxesError(err instanceof Error?err.message:"No se pudieron consultar las cajas originales.");
          setSourceBoxes([]);
        }
      })
      .finally(()=>{if(active)setBoxesLoading(false);});
    return ()=>{active=false;};
  },[transfer.id]);
  const existingBoxes=[...new Set(sourceBoxes.map(item=>item.boxNumber.trim()).filter(Boolean))];
  const missingBoxCount=sourceBoxes.filter(item=>!item.boxNumber.trim()).length;
  const allBoxesLocked=existingBoxes.length>0&&missingBoxCount===0;
  const uniformBox=allBoxesLocked&&existingBoxes.length===1;
  const boxNeedsManual=missingBoxCount>0;
  const updateLocation=(key:keyof ReceptionLocation,value:string)=>{
    setLocation(current=>({...current,[key]:value}));
    setError("");
  };
  return (
    <div className="reception-page">
      <div className="record-form-top">
        <div>
          <button className="text-button" onClick={onBack}>
            <ArrowLeft size={17} />
            Volver a la solicitud
          </button>
          <h2>Recepción física</h2>
          <p>{transfer.folio} · Seguimiento posterior a la aceptación administrativa.</p>
        </div>
        <span className="record-mode">
          <Truck size={16} />
          Seguimiento físico
        </span>
      </div>
      <form
        className="surface reception-form"
        onSubmit={async (event: FormEvent) => {
          event.preventDefault();
          if (saving) return;
          setError("");
          if (status === "Diferencias pendientes" && notes.trim().length < 5) {
            setError("Describe las diferencias encontradas con al menos 5 caracteres.");
            return;
          }
          if(status==="Recibida" && missingEvidence){
            setError("Completa la evidencia pendiente indicada al inicio del formulario.");
            return;
          }
          if(status==="Recibida" && (boxesLoading || boxesError)){
            setError(boxesError||"Consulta las cajas antes de registrar la recepción.");
            return;
          }
          if(status==="Recibida" && (
            !location.archiveZone.trim() || !location.room.trim() ||
            !location.shelf || !location.level || !location.physicalSection
          )){
            setError("Completa zona, sala, estante, nivel y sección física. Esta ubicación se asignará a todos los expedientes de la transferencia.");
            return;
          }
          setSaving(true);
          try { await onSave(status,date,notes.trim(),status==="Recibida"?location:null); }
          catch(error) { setError(error instanceof Error ? error.message : "No se pudo registrar la recepción."); }
          finally { setSaving(false); }
        }}
      >
        <div className="step-heading">
          <span>
            <PackageCheck size={21} />
          </span>
          <div>
            <h3>Registrar resultado de recepción</h3>
            <p>La recepción cotejada y acreditada incorpora los expedientes a Concentración.</p>

          </div>
        </div>
        {status === "Recibida" && missingEvidence && (
          <div className="transfer-evidence" role="status">
            <strong>Evidencia pendiente</strong>
            <ul>
              {missingDelivery && <li>Registro de entrega con representante del área. Lo registra el solicitante o el encargado del área.</li>}
              {missingSignedFormat && <li>PDF del formato con firmas autógrafas. Lo adjunta el administrador después del registro de entrega.</li>}
            </ul>
            <Button className="button--secondary" onClick={onBack}>Volver a Documentos de la transferencia</Button>
          </div>
        )}
        <div className="reception-options">
          {(["Recibida", "Diferencias pendientes"] as ReceptionStatus[]).map((item) => (
            <label className={status === item ? "is-selected" : ""} key={item}>
              <input checked={status === item} onChange={() => {setStatus(item); setError("");}} name="reception-status" type="radio" />
              <span>
                {item === "Recibida" ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
              </span>
              <div>
                <strong>
                  {item === "Recibida" ? "Recepción correcta" : "Diferencias pendientes"}
                </strong>
                <small>
                  {item === "Recibida"
                    ? "Los expedientes físicos coinciden con el inventario."
                    : "Existen diferencias que requieren seguimiento."}
                </small>
              </div>
            </label>
          ))}
        </div>
        <div className="record-form-grid reception-fields">
          <label className="form-field">
            <span>
              Fecha de recepción<b>*</b>
            </span>
            <input
              onChange={(event) => setDate(event.target.value)}
              required
              type="date"
              value={date}
            />
          </label>
          <label className="form-field">
            <span>Responsable</span>
            <input disabled value={fullName(currentUser)} />
          </label>
          <label className="form-field record-field--wide">
            <span>
              {status === "Diferencias pendientes" ? <>Describe las diferencias <b>*</b></> : "Observaciones generales (opcional)"}
            </span>
            <textarea
              onChange={(event) => {
                setNotes(event.target.value);
                setError("");
              }}
              placeholder={status === "Diferencias pendientes" ? "Indica qué faltó o no coincidió." : "Agrega una nota si hace falta."}
              maxLength={2000}
              rows={4}
              value={notes}
            />
          </label>
        </div>
        {status==="Recibida" && <section className="surface transfer-reception-location">
          <div className="step-heading"><span><FolderArchive size={21}/></span><div>
            <h3>Ubicación física del inventario recibido</h3>
            <p>Captura la ubicación una sola vez. Se aplicará automáticamente a los {transfer.recordIds.length} expedientes de esta transferencia, sin repetir el formulario.</p>
          </div></div>
          <div className="reception-location-layout">
            <div className="record-form-grid reception-location-fields">
            <label className="form-field"><span>Archivo o zona *</span>
              <input required maxLength={160} value={location.archiveZone} onChange={e=>updateLocation("archiveZone",e.target.value)}/>
            </label>
            <label className="form-field"><span>Lugar / sala *</span>
              <input required maxLength={150} value={location.room} onChange={e=>updateLocation("room",e.target.value)}/>
            </label>
            <label className="form-field"><span>Estante *</span>
              <select required value={location.shelf} onChange={e=>updateLocation("shelf",e.target.value)}>
                <option value="">Seleccionar</option>{Array.from({length:25},(_,i)=>i+1).map(n=><option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label className="form-field"><span>Nivel *</span>
              <select required value={location.level} onChange={e=>updateLocation("level",e.target.value)}>
                <option value="">Seleccionar</option>{[1,2,3,4].map(n=><option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label className="form-field"><span>Sección física *</span>
              <select required value={location.physicalSection} onChange={e=>updateLocation("physicalSection",e.target.value)}>
                <option value="">Seleccionar</option>{[1,2,3,4].map(n=><option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label className="form-field"><span>{allBoxesLocked?"Caja(s) original(es)":"Caja o referencia"}</span>
              <input
                maxLength={60}
                value={uniformBox?existingBoxes[0]:allBoxesLocked?"Cajas individuales conservadas":location.locationBox}
                disabled={boxesLoading||allBoxesLocked}
                placeholder={boxesLoading?"Consultando cajas...":boxNeedsManual?"Solo para expedientes sin caja":"Sin caja en Trámite"}
                onChange={e=>updateLocation("locationBox",e.target.value)}
                className={allBoxesLocked?"reception-box-locked":""}
              />
              {uniformBox&&<small className="reception-box-note">Caja heredada de Archivo de trámite. No se puede modificar.</small>}
              {existingBoxes.length>1&&<small className="reception-box-note">Se conservarán las cajas originales: {existingBoxes.join(", ")}.</small>}
              {existingBoxes.length===1&&!uniformBox&&<small className="reception-box-note">Caja existente: {existingBoxes[0]}. No se reemplazará.</small>}
              {boxNeedsManual&&existingBoxes.length>0&&<small className="reception-box-note">Este campo solo completará {missingBoxCount} expediente(s) sin caja.</small>}
              {boxesError&&<small className="field-error" role="alert">{boxesError}</small>}
            </label>
            <label className="form-field"><span>Posición</span>
              <input maxLength={45} value={location.position} onChange={e=>updateLocation("position",e.target.value.toUpperCase())}/>
            </label>
            <label className="form-field record-field--wide"><span>Observaciones de ubicación</span>
              <textarea rows={2} value={location.locationNotes} onChange={e=>updateLocation("locationNotes",e.target.value)}/>
            </label>
            </div>
            <LocationShelf level={location.level} section={location.physicalSection}/>
          </div>
          <p className="catalog-note">El estante, nivel y sección se aplicarán a toda la recepción. Las cajas registradas en Trámite se conservarán por expediente.</p>
        </section>}
        {error && <div role="alert" className="validation-summary">{error}</div>}
        <div className="reception-rule">
          <ShieldCheck size={17} />
          La recepción física incluirá la ubicación registrada.
        </div>
        <div className="concentration-location-form__footer">
          <Button className="button--secondary" onClick={onBack}>
            Cancelar
          </Button>
          <Button className="button--primary" type="submit" disabled={saving || (status==="Recibida" && (missingEvidence || boxesLoading || Boolean(boxesError)))}>
            <Check size={17} />
            {saving ? "Guardando…" : "Guardar recepción"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function TransferHistory({
  onBack,
  transfer,
  users,
}: {
  onBack: () => void;
  transfer: DocumentaryTransfer;
  users: UserRecord[];
}) {
  return (
    <div className="history-page">
      <div className="record-form-top">
        <div>
          <button className="text-button" onClick={onBack}>
            <ArrowLeft size={17} />
            Volver a la solicitud
          </button>
          <h2>Historial administrativo</h2>
          <p>{transfer.folio} · Trazabilidad de decisiones y seguimiento.</p>
        </div>
        <TransferStatusBadge status={transfer.status} />
      </div>
      <section className="surface timeline-card">
        <div className="timeline-card__heading">
          <History size={20} />
          <div>
            <h3>Línea de tiempo</h3>
            <p>Los eventos se conservan en orden cronológico.</p>
          </div>
        </div>
        <div className="transfer-timeline">
          {transfer.history.map((event, index) => (
            <div className="timeline-event" key={event.id}>
              <span
                className={`timeline-event__marker timeline-event__marker--${event.type.toLowerCase().replace(" ", "-")}`}
              >
                {index + 1}
              </span>
              <div>
                <span>{event.type}</span>
                <h4>{event.detail}</h4>
                <p>
                  {userName(users, event.actor)} · {formatDate(event.date)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function TransfersPanel({
  initialSearch = "",
  currentUser,
  onRecordsChange,
  onTransfersChange,
  permissions,
  records,
  role,
  transfers,
  users,
}: {
  initialSearch?: string;
  currentUser: UserRecord;
  onRecordsChange: (records: ArchivalRecord[]) => void;
  onTransfersChange: (transfers: DocumentaryTransfer[]) => void;
  permissions: string[];
  records: ArchivalRecord[];
  role: Role;
  transfers: DocumentaryTransfer[];
  users: UserRecord[];
}) {
  const [view, setView] = useState<PanelView>("list");
  const [selected, setSelected] = useState<DocumentaryTransfer | null>(null);
  const [wizardTransfer, setWizardTransfer] = useState<DocumentaryTransfer | null>(null);
  const [returnOpen, setReturnOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!/enviada para visto bueno|devuelta con observaciones|visto bueno registrado|transferencia aceptada|recepción registrada/i.test(message)) return;
    const timer=window.setTimeout(()=>setMessage(""),4000);
    return ()=>window.clearTimeout(timer);
  },[message]);
  const canReceive =
    role === "Administrador / Coordinador" &&
    permissions.includes("update-location");
  const canCreate =
    role === "Administrador / Coordinador" || permissions.includes("prepare-transfers");

  const saveTransferState=(updated:DocumentaryTransfer)=>{
    onTransfersChange(transfers.some(t=>t.id===updated.id)
      ? transfers.map(t=>t.id===updated.id?updated:t)
      : [updated,...transfers]);
    setSelected(updated);
  };
  const failure=(error:unknown)=>{
    setMessage(error instanceof Error ? error.message : "No se pudo completar la operación.");
  };
  const submitTransfer=async(recordIds:string[],existing:DocumentaryTransfer|null,correction?:string,receipt?:TransferReceipt)=>{
      const updated=await transferApi.submit(recordIds,existing,correction,receipt);
      saveTransferState(updated);
      setWizardTransfer(null);
      setView("list");
      setMessage(updated.folio+(updated.status==="Pendiente de revisión administrativa"
        ? " reenviada a Concentración para dictamen." : " enviada para visto bueno del área."));
  };
  const returnTransfer=async(observation:string)=>{
    if(!selected)return;
    try{
      const updated=await transferApi.observe(selected.id,observation);
      saveTransferState(updated);
      setReturnOpen(false);
      setMessage("La solicitud fue devuelta con observaciones.");
    }catch(error){failure(error);}
  };
  const approveAreaTransfer=async()=>{
    if(!selected)return;
    try{
      const updated=await transferApi.areaApprove(selected.id);
      saveTransferState(updated);
      setMessage("Visto bueno registrado correctamente.");
    }catch(error){failure(error);}
  };
  const acceptTransfer=async(detail:string)=>{
    if(!selected)return;
    try{
      const updated=await transferApi.accept(selected.id,detail);
      saveTransferState(updated);
      setAcceptOpen(false);
      setMessage("Dictamen favorable registrado. Pendiente de traslado y recepción física.");
    }catch(error){failure(error);}
  };
  const saveReception=async(status:ReceptionStatus,date:string,notes:string,location:ReceptionLocation|null)=>{
    if(!selected)return;
    const updated=await transferApi.receive(selected.id,status,date,notes,location);
    saveTransferState(updated);
    try{
      if(status==="Recibida"){
        const [tramite,concentracion]=await Promise.all([tramiteApi.list(),concentrationApi.list()]);
        onRecordsChange([...tramite.filter(r=>r.stage!=="Archivo de concentración"),...concentracion]);
      }
    }catch(e){console.error("Recepción confirmada, pero falló actualizar pantalla:",e);}
    setMessage("Recepción registrada correctamente.");
    setView("detail");
  };

  if (view === "wizard")
    return (
      <TransferWizard
        activeTransfer={wizardTransfer}
        allRecords={records}
        currentUser={currentUser}
        onCancel={() => {
          setWizardTransfer(null);
          setView("list");
        }}
        onSubmit={submitTransfer}
        transfers={transfers}
      />
    );

  if (view === "reception" && selected && canReceive && selected.status === "Aceptada" && selected.receptionStatus !== "Recibida")
    return (
      <ReceptionForm
        currentUser={currentUser}
        onBack={() => setView("detail")}
        onSave={saveReception}
        transfer={selected}
      />
    );

  if (view === "history" && selected)
    return <TransferHistory onBack={() => setView("detail")} transfer={selected} users={users} />;

  if (view === "detail" && selected)
    return (
      <>
        {message && (
          <div className="toast record-toast">
            <Check size={18} />
            {message}
          </div>
        )}
        <RequestDetail
          key={`${selected.id}:${selected.receptionStatus}`}
          canReceive={canReceive}
          currentUser={currentUser}
          onAccept={() => setAcceptOpen(true)}
          onAreaApprove={approveAreaTransfer}
          onContinue={() => { setWizardTransfer(selected); setView("wizard"); }}
          onCancelRequest={role === "Administrador / Coordinador" && selected.status !== "Cancelada" && selected.receptionStatus !== "Recibida" ? () => setCancelOpen(true) : undefined}
          onDocumentsChange={saveTransferState}
          onBack={() => {
            setSelected(null);
            setView("list");
          }}
          onHistory={() => setView("history")}
          onReceive={() => setView("reception")}
          onReturn={() => setReturnOpen(true)}
          permissions={permissions}
          records={records}
          role={role}
          transfer={selected}
          users={users}
        />
        {cancelOpen && <CancelTransferModal onClose={()=>setCancelOpen(false)} onSave={async reason=>{
          saveTransferState(await transferApi.cancel(selected.id,reason));
          setCancelOpen(false);
          setMessage("Solicitud cancelada.");
        }} />}
        {returnOpen && (
          <ReturnModal onCancel={() => setReturnOpen(false)} onConfirm={returnTransfer} />
        )}
        {acceptOpen && (
          <AcceptModal
            count={selected.recordIds.length}
            onCancel={() => setAcceptOpen(false)}
            onConfirm={acceptTransfer}
          />
        )}
      </>
    );

  return (
    <>
      {message && (
        <div className="toast record-toast">
          <Check size={18} />
          {message}
        </div>
      )}
      <TransferTray
        initialSearch={initialSearch}
        permissions={permissions}
        canCreate={canCreate}
        currentUser={currentUser}
        onCreate={() => {
          setWizardTransfer(null);
          setView("wizard");
        }}
        onOpen={(transfer, action) => {
          setSelected(transfer);
          if (action === "continue") {
            setWizardTransfer(transfer);
            setView("wizard");
          } else if (action === "history") setView("history");
          else if (action === "reception") setView("reception");
          else setView("detail");
        }}
        role={role}
        transfers={transfers}
        users={users}
      />
    </>
  );
}
