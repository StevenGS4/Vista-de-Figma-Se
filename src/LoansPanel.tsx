import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  BriefcaseBusiness,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Eye,
  FileCheck2,
  Files,
  History,
  Inbox,
  MapPin,
  PackageCheck,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  UserCheck,
  UserRound,
  X,
} from "lucide-react";
import RowActionsMenu from "./RowActionsMenu";
import { Role, UserRecord, areaName, areas, fullName } from "./data";
import { loanApi, concentrationApi, type LoanEligibleUser } from "./api";
import { ArchivalLoan, effectiveLoanStatus, todayIso, type LoanReturnCondition } from "./loans";
import { ArchivalRecord, cadidoSections, locationSummary } from "./records";

type PanelView = "list" | "select" | "form" | "detail" | "return" | "history";
type LoanFilter = "Activos" | "Próximos a vencer" | "Vencidos" | "Devueltos";

const formatDate = (value: string) =>
  value ? new Date(`${value}T12:00:00`).toLocaleDateString("es-MX") : "Sin registro";

const offsetDate = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const physicalCondition = (value?: LoanReturnCondition | "") =>
  value === "GOOD" ? "Buen estado" : value === "ISSUE" ? "Con incidencias" : "Sin registro";

async function downloadLoanReceipt(loan: ArchivalLoan, record?: ArchivalRecord) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF();
  const margin = 18;
  const width = pdf.internal.pageSize.getWidth() - 2 * margin;
  let y = 22;
  const write = (value: string, bold = false) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    const lines: string[] = pdf.splitTextToSize(value, width);
    for (const line of lines) {
      if (y > 277) { pdf.addPage(); y = 22; }
      pdf.text(line, margin, y);
      y += 6;
    }
  };
  pdf.setProperties({ title: `Recibo de préstamo ${loan.folio}` });
  pdf.setTextColor(23, 60, 52).setFontSize(17);
  write("SEMARNAT Nayarit · Recibo de préstamo", true);
  pdf.setTextColor(30, 40, 36).setFontSize(11);
  write(loan.folio, true);
  y += 3;
  write(`Préstamo: ${formatDate(loan.loanDate)} · Devolución prevista: ${formatDate(loan.expectedReturnDate)}`);
  write(`Área solicitante: ${areaName(loan.requestingAreaId)}`);
  write(`Solicitó: ${loan.requesterName}`);
  write(`Autorizó: ${loan.authorizedBy} · Entregó: ${loan.deliveredBy}`);
  write(`Recibió: ${loan.receivedBy}`);
  if (loan.observations) write(`Observaciones: ${loan.observations}`);
  y += 3;
  write("Expedientes entregados", true);
  if (loan.items?.length) {
    for (const item of loan.items) {
      write(item.title, true);
      write(`${item.number || item.id} · Estado al entregar: ${physicalCondition(item.deliveryCondition)}`);
    }
  } else {
    write(record?.title || "Expediente");
    write(record?.recordNumber || loan.recordId);
  }
  pdf.save(`Recibo-${loan.folio}.pdf`);
}

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

function LoanStatusBadge({ loan }: { loan: ArchivalLoan }) {
  const status = effectiveLoanStatus(loan);
  const icon =
    status === "Devuelto" ? (
      <CheckCircle2 size={12} />
    ) : status === "Vencido" ? (
      <AlertCircle size={12} />
    ) : (
      <Clock3 size={12} />
    );
  return (
    <span className={`loan-status loan-status--${status.toLowerCase()}`}>
      {icon}
      {status}
    </span>
  );
}

function recordFor(records: ArchivalRecord[], id: string) {
  return records.find((record) => record.id === id);
}

const loanRecordIds = (loan: ArchivalLoan) => loan.recordIds ?? [loan.recordId];

function LoanTray({
  initialSearch = "",
  canCreate,
  canReturn,
  loans,
  onCreate,
  onOpen,
  records,
}: {
  initialSearch?: string;
  canCreate: boolean;
  canReturn: boolean;
  loans: ArchivalLoan[];
  onCreate: () => void;
  onOpen: (loan: ArchivalLoan, action?: "return" | "history") => void;
  records: ArchivalRecord[];
}) {
  const [filter, setFilter] = useState<LoanFilter>(() => {
    const selected=loans.find(item=>item.folio===initialSearch);
    if(!selected)return "Activos";
    const state=effectiveLoanStatus(selected);
    return state==="Devuelto"?"Devueltos":state==="Vencido"?"Vencidos":"Activos";
  });
  const [search, setSearch] = useState(initialSearch);
  const [searched, setSearched] = useState(Boolean(initialSearch));
  const [page, setPage] = useState(1);
  const pageSize = 5;
  const filtered = useMemo(
    () =>
      loans.filter((loan) => {
        const status = effectiveLoanStatus(loan);
        const days = Math.ceil(
          (new Date(`${loan.expectedReturnDate}T12:00:00`).getTime() - Date.now()) / 86400000,
        );
        const expected =
          filter === "Activos"
            ? "Activo"
            : filter === "Próximos a vencer"
              ? "Próximo"
              : filter === "Vencidos"
                ? "Vencido"
                : "Devuelto";
        const record = recordFor(records, loan.recordId);
        const query = search.toLowerCase();
        return (
          (expected === "Próximo"
            ? loan.status === "Activo" && days >= 0 && days <= 10
            : status === expected) &&
          (!query ||
            loan.folio.toLowerCase().includes(query) ||
            loan.requesterName.toLowerCase().includes(query) ||
            record?.recordNumber.toLowerCase().includes(query) ||
            record?.title.toLowerCase().includes(query) ||
            loan.items?.some(item => [item.number, item.title, item.classification]
              .some(value => value.toLowerCase().includes(query))))
        );
      }),
    [filter, loans, records, search],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <>
      <div className="records-page-heading">
        <div>
          <h2>Préstamos y devoluciones</h2>
          <p>Controla la entrega física y devolución de expedientes en concentración.</p>
        </div>
        {canCreate && (
          <Button className="button--primary" onClick={onCreate}>
            <Plus size={17} />
            Registrar préstamo
          </Button>
        )}
      </div>
      <section className="surface loan-tray">
        <div className="records-filter-head">
          <div>
            <h3>Bandeja de préstamos</h3>
            <p>{loans.length} préstamos registrados</p>
          </div>
          <span className="demo-label">Préstamos registrados</span>
        </div>
        <div className="loan-filterbar">
          <div className="transfer-tabs">
            {(["Activos", "Próximos a vencer", "Vencidos", "Devueltos"] as LoanFilter[]).map((item) => (
              <button
                className={filter === item ? "is-active" : ""}
                key={item}
                onClick={() => {
                  setFilter(item);
                  setPage(1);
                  setSearched(true);
                }}
              >
                {item}
                <span>
                  {
                    loans.filter((loan) => {
                      const status = effectiveLoanStatus(loan);
                      const days = Math.ceil(
                        (new Date(`${loan.expectedReturnDate}T12:00:00`).getTime() - Date.now()) /
                          86400000,
                      );
                      return item === "Activos"
                        ? status === "Activo"
                        : item === "Próximos a vencer"
                          ? loan.status === "Activo" && days >= 0 && days <= 10
                        : item === "Vencidos"
                          ? status === "Vencido"
                          : status === "Devuelto";
                    }).length
                  }
                </span>
              </button>
            ))}
          </div>
          <label className="search-box">
            <Search size={17} />
            <input
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
                setSearched(Boolean(event.target.value.trim()));
              }}
              placeholder="Buscar folio, expediente o solicitante..."
              value={search}
            />
          </label>
        </div>
        {!searched ? (
          <div className="empty-state concentration-search-empty">
            <Search size={30} />
            <strong>Busca o selecciona una vista rápida</strong>
            <p>Los préstamos no se muestran automáticamente al entrar al módulo.</p>
          </div>
        ) : <div className="table-scroll">
          <table className="data-table loan-table">
            <thead>
              <tr>
                <th>Folio de préstamo</th>
                <th>Inventario de origen</th>
                <th>Número de expediente</th>
                <th>Título</th>
                <th>Área solicitante</th>
                <th>Solicitante</th>
                <th>Fecha de préstamo</th>
                <th>Devolución prevista</th>
                <th>Estado</th>
                <th className="align-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((loan) => {
                const record = recordFor(records, loan.recordId);
                const count = loan.items?.length ?? loan.deliveredRecordIds?.length ?? 1;
                const active = loan.status === "Activo";
                return (
                  <tr key={loan.id}>
                    <td>
                      <button className="record-number-link" onClick={() => onOpen(loan)}>
                        {loan.folio}
                      </button>
                    </td>
                    <td>
                      {count > 1 && loan.mode !== "Inventario completo" ? "Selección de expedientes" : loan.inventoryFolio || record?.inventoryId || "Sin referencia"}
                      {count > 1 && <small className="record-count"> · {count} expedientes</small>}
                    </td>
                    <td>
                      <span className="record-id">{count > 1 ? `${count} expedientes` : loan.items?.[0]?.number || record?.recordNumber}</span>
                    </td>
                    <td>
                      <span className="record-subject" title={record?.title}>
                        {record?.title}
                      </span>
                    </td>
                    <td>{areaName(loan.requestingAreaId)}</td>
                    <td>{loan.requesterName}</td>
                    <td>{formatDate(loan.loanDate)}</td>
                    <td>{formatDate(loan.expectedReturnDate)}</td>
                    <td>
                      <LoanStatusBadge loan={loan} />
                    </td>
                    <td>
                      <RowActionsMenu
                        label={`Acciones para ${loan.folio}`}
                        width={200}
                        actions={[
                          { label: "Ver seguimiento", icon: <Eye size={16}/>,
                            onSelect: () => onOpen(loan) },
                          ...(active && canReturn ? [{
                            label: "Registrar devolución",
                            icon: <RotateCcw size={15}/>,
                            onSelect: () => onOpen(loan, "return"),
                          }] : []),
                          { label: "Ver historial", icon: <History size={15}/>,
                            onSelect: () => onOpen(loan, "history") },
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
              <strong>No hay préstamos en esta vista</strong>
              <p>Selecciona otro estado o realiza una búsqueda diferente.</p>
            </div>
          )}
        </div>}
        {searched && <div className="pagination">
          <span>
            Mostrando {visible.length ? (page - 1) * pageSize + 1 : 0}–
            {Math.min(page * pageSize, filtered.length)} de {filtered.length}
          </span>
          <div>
            <button disabled={page === 1} onClick={() => setPage((current) => current - 1)}>
              <ChevronLeft size={16} />
            </button>
            <span>
              Página {page} de {pageCount}
            </span>
            <button disabled={page === pageCount} onClick={() => setPage((current) => current + 1)}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>}
      </section>
    </>
  );
}

function RecordSelector({
  loans, onBack, onSelect, records, selection,
}: {
  loans: ArchivalLoan[];
  onBack: () => void;
  onSelect: (records: ArchivalRecord[]) => void;
  records: ArchivalRecord[];
  selection: ArchivalRecord[];
}) {
  const [search, setSearch] = useState("");
  const [area, setArea] = useState("");
  const [section, setSection] = useState("");
  const [series, setSeries] = useState("");
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(() => new Set(selection.map(record => record.id)));
  const todayInNayarit = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Mazatlan" });
  const [today, setToday] = useState(todayInNayarit);
  useEffect(() => {
    const timer = window.setInterval(() => setToday(todayInNayarit()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const loansByRecord = useMemo(() => {
    const active = new Map<string, ArchivalLoan>();
    for (const loan of loans) {
      if (loan.status === "Activo") {
        for (const id of loanRecordIds(loan)) active.set(id, loan);
      }
    }
    return active;
  }, [loans]);
  const concentration = records.filter(record => record.stage === "Archivo de concentración");
  const isAvailable = (record: ArchivalRecord) => record.availability === "En archivo" &&
    record.receptionConfirmed && Boolean(record.archiveZone && record.room && record.shelf && record.level && record.physicalSection) && !loansByRecord.has(record.id);
  const removeSelection = (id: string) => setSelected(current => new Set([...current].filter(item => item !== id)));
  const remainingTime = (date?: string) => {
    const days = (Date.parse(date ?? "") - Date.parse(today)) / 86_400_000;
    if (!Number.isFinite(days)) return "Sin fecha prevista";
    if (days < 0) return `Vencido hace ${-days} ${days === -1 ? "día" : "días"}`;
    if (days === 0) return "Devuelve hoy";
    return days === 1 ? "Falta 1 día" : `Faltan ${days} días`;
  };
  const terms = search.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const sectionName = (id: string) => cadidoSections.find(item => item.id === id)?.name || id || "Sin sección";
  const seriesOptions = new Map(concentration.filter(record => !section || record.cadidoSectionId === section)
    .map(record => [record.cadidoCode, record.cadidoSeriesName || record.cadidoCode]));
  const groups = new Map<string, ArchivalRecord[]>();
  for (const record of concentration) {
    const date = record.receptionDate || record.transferDate || record.inventoryDate || "";
    if ((area && record.areaId !== area) || (section && record.cadidoSectionId !== section) ||
      (series && record.cadidoCode !== series) || (from && date < from) || (until && (!date || date > until)) ||
      !terms.every(term => [record.title, record.recordNumber, record.archiveClassificationCode, record.cadidoCode,
        record.cadidoSeriesName, record.description].some(value => value?.toLowerCase().includes(term)))) continue;
    const key = record.cadidoSectionId + ":" + record.cadidoCode;
    const group = groups.get(key) ?? [];
    group.push(record);
    groups.set(key, group);
  }
  const grouped = [...groups].sort(([a], [b]) => a.localeCompare(b, "es", { numeric: true }));
  const pageSize = 5;
  const pageCount = Math.max(1, Math.ceil(grouped.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const selectedRecords = concentration.filter(record => selected.has(record.id) && isAvailable(record));
  return (
    <div className="loan-select-page">
      <div className="record-form-top">
        <div>
          <button className="text-button" onClick={onBack}><ArrowLeft size={17} /> Volver a la bandeja</button>
          <h2>Seleccionar expedientes para préstamo</h2>
          <p>Despliega una serie y marca uno o varios expedientes disponibles.</p>
        </div>
        <span className="record-mode"><Archive size={16} /> Concentración</span>
      </div>
      <section className="surface select-record-card">
        <div className="loan-selection-filters" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))" }}>
          <label className="search-box"><Search size={16} />
            <input aria-label="Buscar expediente" placeholder="Nombre, número o código CADIDO" value={search}
              onChange={event => { setSearch(event.target.value); setPage(1); }} />
          </label>
          <select aria-label="Área" value={area} onChange={event => { setArea(event.target.value); setPage(1); }}>
            <option value="">Todas las áreas</option>
            {[...new Set(concentration.map(record => record.areaId))].sort().map(id => <option value={id} key={id}>{areaName(id)}</option>)}
          </select>
          <select aria-label="Sección documental" value={section} onChange={event => { setSection(event.target.value); setSeries(""); setPage(1); }}>
            <option value="">Todas las secciones</option>
            {[...new Set(concentration.map(record => record.cadidoSectionId).filter(Boolean))].sort().map(id => <option value={id} key={id}>{sectionName(id)}</option>)}
          </select>
          <select aria-label="Serie documental" value={series} onChange={event => { setSeries(event.target.value); setPage(1); }}>
            <option value="">Todas las series</option>
            {[...seriesOptions].sort(([a], [b]) => a.localeCompare(b, "es", { numeric: true })).map(([code, title]) => <option value={code} key={code}>{code} · {title}</option>)}
          </select>
          <label className="loan-date-filter"><span>Ingreso desde</span><input type="date" value={from} onChange={event => { setFrom(event.target.value); setPage(1); }} /></label>
          <label className="loan-date-filter"><span>Hasta</span><input type="date" value={until} onChange={event => { setUntil(event.target.value); setPage(1); }} /></label>
          <Button className="button--secondary" onClick={() => { setArea(""); setSection(""); setSeries(""); setFrom(""); setUntil(""); setSearch(""); setPage(1); }}>Limpiar filtros</Button>
        </div>
        {from && until && from > until && <p role="alert" className="px-5 py-2">La fecha inicial debe ser anterior o igual a la final.</p>}
        <div className="grid gap-3 px-5 py-4">
          {grouped.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(([key, items]) => (
            <details key={key} className="overflow-hidden rounded-lg border border-[#d0d7d2] bg-[#faf9f5]" open={terms.length > 0 || Boolean(series) || undefined}>
              <summary className="cursor-pointer bg-[#edf0ec] px-4 py-3 text-sm font-semibold text-[#243931]">
                {sectionName(items[0].cadidoSectionId)} · {items[0].cadidoCode} · {items[0].cadidoSeriesName || "Serie documental"} <small>({items.length})</small>
              </summary>
              <ul className="grid gap-2 p-3">
                {items.map(record => {
                  const activeLoan = loansByRecord.get(record.id);
                  const borrowed = Boolean(activeLoan) || record.availability === "Prestado";
                  const available = isAvailable(record);
                  return (
                    <li key={record.id}>
                      <label className={`flex flex-wrap items-center gap-3 rounded-md border p-3 ${available
                        ? "cursor-pointer border-[#c8d4cc] bg-white hover:bg-[#eef4ef]"
                        : "cursor-not-allowed border-[#d1d5d3] bg-[#e8eae8] text-[#555e5a]"}`}>
                        <input type="checkbox" className="size-4 shrink-0 accent-[#205b4d]" checked={available && selected.has(record.id)}
                          disabled={!available} onChange={event => {
                            if (event.target.checked) setSelected(current => new Set([...current, record.id]));
                            else removeSelection(record.id);
                          }} />
                        <span className="min-w-0 grow break-words">
                          <strong className="block">{record.title}</strong>
                          <small className="text-[#687570]">{record.recordNumber} · {record.archiveClassificationCode || record.cadidoCode}</small>
                        </span>
                        {borrowed ? (
                          <span className="grid gap-0.5 text-xs">
                            <strong>Prestado</strong>
                            <span>{remainingTime(activeLoan?.expectedReturnDate)}</span>
                            {activeLoan?.expectedReturnDate && <span>Fecha prevista: {formatDate(activeLoan.expectedReturnDate)}</span>}
                          </span>
                        ) : !available && <small>No disponible</small>}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </details>
          ))}
          {!grouped.length && <p className="py-4 text-center">No hay expedientes que coincidan con los filtros.</p>}
        </div>
        <div className="pagination">
          <span>Página {currentPage} de {pageCount}</span>
          <div>
            <button type="button" aria-label="Página anterior" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={16} /></button>
            <button type="button" aria-label="Página siguiente" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}><ChevronRight size={16} /></button>
          </div>
        </div>
        <section className="mx-5 mt-3 overflow-hidden rounded-lg border border-[#b4c4bb]" aria-labelledby="loan-selection-summary">
          <h3 id="loan-selection-summary" className="bg-[#edf0ec] px-4 py-3 text-sm font-semibold text-[#243931]">Expedientes seleccionados</h3>
          {selectedRecords.length ? (
            <ul className="divide-y divide-[#d9e3dc] bg-[#f8f7f2] px-4">
              {selectedRecords.map(record => (
                <li key={record.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="min-w-0 break-words">
                    <strong className="block text-[#173c34]">{record.title}</strong>
                    <small className="text-[#687570]">{record.recordNumber}</small>
                  </span>
                  <button type="button" className="text-button" aria-label={`Quitar selección de ${record.recordNumber}`} onClick={() => removeSelection(record.id)}>
                    <X size={14} /> Quitar selección
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="px-4 py-3 text-sm text-[#687570]">Todavía no has seleccionado expedientes.</p>}
        </section>
        <div className="flex flex-wrap items-center justify-end gap-3 p-4">
          <span aria-live="polite">{selectedRecords.length} seleccionados</span>
          <Button className="button--primary" disabled={!selectedRecords.length} onClick={() => onSelect(selectedRecords)}>Continuar</Button>
        </div>
      </section>
    </div>
  );
}

type LoanFormData = {
  requestingAreaId: string;
  requesterUserId: string;
  loanDate: string;
  expectedReturnDate: string;
  delivererUserId: string;
  receivedBy: string;
  observations: string;
};

function LoanField({
  children,
  error,
  label,
  required,
}: {
  children: ReactNode;
  error?: string;
  label: string;
  required?: boolean;
}) {
  return (
    <label className={`form-field ${error ? "has-error" : ""}`}>
      <span>
        {label}
        {required && <b>*</b>}
      </span>
      {children}
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}

function LoanConfirmModal({
  onCancel,
  onConfirm,
  records,
}: {
  onCancel: () => void;
  onConfirm: () => Promise<void>;
  records: ArchivalRecord[];
}) {
  const [saving, setSaving] = useState(false);
  return (
    <div className="modal-backdrop">
      <div className="modal loan-confirm-modal">
        <div className="transfer-confirm-modal__icon">
          <BriefcaseBusiness size={23} />
        </div>
        <h2>Confirmar entrega física</h2>
        <p>
          Se registrará el préstamo de{" "}
          <strong>
            {records.length === 1 ? records[0].recordNumber : `${records.length} expedientes`}
          </strong>{" "}
          y su disponibilidad cambiará a <strong>Prestado</strong>.
        </p>
        <div className="transfer-rule">
          <ShieldCheck size={17} />
          La etapa permanecerá en Archivo de concentración.
        </div>
        <div className="modal__footer">
          <Button className="button--secondary" disabled={saving} onClick={onCancel}>
            Cancelar
          </Button>
          <Button className="button--primary" disabled={saving} onClick={async () => {
            setSaving(true);
            try { await onConfirm(); } finally { setSaving(false); }
          }}>
            <Check size={17} />
            {saving ? "Registrando…" : "Confirmar entrega"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function LoanForm({
  currentUser,
  onBack,
  onConfirm,
  records,
}: {
  currentUser: UserRecord;
  onBack: () => void;
  onConfirm: (data: LoanFormData) => Promise<void>;
  records: ArchivalRecord[];
}) {
  const record = records[0];
  const [form, setForm] = useState<LoanFormData>({
    requestingAreaId: "",
    requesterUserId: "",
    loanDate: todayIso(),
    expectedReturnDate: offsetDate(14),
    delivererUserId: "",
    receivedBy: "",
    observations: "",
  });
  const [staff, setStaff] = useState<LoanEligibleUser[]>([]);
  const [staffError, setStaffError] = useState("");
  const [staffLoading, setStaffLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    loanApi.eligibleUsers().then(users => {
      if (!alive) return;
      setStaff(users);
      setForm(current => ({
        ...current,
        delivererUserId: users.some(u => u.id === currentUser.id && u.canDeliver) ? currentUser.id : ""
      }));
    }).catch(error => {
      if (alive) setStaffError(error instanceof Error ? error.message : "No fue posible consultar el personal");
    }).finally(() => { if (alive) setStaffLoading(false); });
    return () => { alive = false; };
  }, [currentUser.id]);
  const requesterOptions = staff.filter(user => user.areaId === form.requestingAreaId);
  const delivererOptions = staff.filter(user => user.canDeliver);
  const [errors, setErrors] = useState<Partial<Record<keyof LoanFormData, string>>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  const update = (field: keyof LoanFormData, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };
  const validate = () => {
    const next: Partial<Record<keyof LoanFormData, string>> = {};
    if (!form.requestingAreaId) next.requestingAreaId = "Selecciona el área solicitante.";
    if (!staff.length || staffError || staffLoading) next.requesterUserId = "No se pudo cargar el catálogo del personal.";
    else if (!requesterOptions.some(user => user.id === form.requesterUserId))
      next.requesterUserId = "Selecciona un empleado activo del área solicitante.";
    if (!form.loanDate) next.loanDate = "Captura la fecha del préstamo.";
    if (!form.expectedReturnDate) next.expectedReturnDate = "Captura la fecha prevista.";
    else if (form.loanDate && form.expectedReturnDate < form.loanDate)
      next.expectedReturnDate = "La devolución prevista no puede ser anterior al préstamo.";
    if (!delivererOptions.some(user => user.id === form.delivererUserId))
      next.delivererUserId = "Selecciona quién entrega, del personal autorizado.";
    if (!form.receivedBy.trim()) next.receivedBy = "Ingresa la persona que recibe.";
    setErrors(next);
    return !Object.keys(next).length;
  };
  return (
    <div className="loan-form-page">
      <div className="record-form-top">
        <div>
          <button className="text-button" onClick={onBack}>
            <ArrowLeft size={17} />
            Cambiar selección
          </button>
          <h2>Registrar préstamo</h2>
          <p>
            Registra el préstamo y la entrega física. La autorización queda vinculada a tu cuenta.
          </p>
        </div>
        <span className="record-mode">
          <BriefcaseBusiness size={16} />
          Nuevo préstamo
        </span>
      </div>
      <form
        className="surface loan-form"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          if (validate()) setConfirmOpen(true);
        }}
      >
        <section className="loan-form-section">
          <div className="step-heading">
            <span>
              <Files size={21} />
            </span>
            <div>
              <h3>Expedientes seleccionados</h3>
            </div>
          </div>
          {records.length === 1 && <div className="loan-record-readonly">
            <div>
              <span>Inventario de origen</span>
              <strong>{record.inventoryId}</strong>
            </div>
            <div>
              <span>Modalidad</span>
              <strong>
                Expediente individual
              </strong>
            </div>
            <div>
              <span>Número de expediente</span>
              <strong>{record.recordNumber}</strong>
            </div>
            <div>
              <span>Título o asunto</span>
              <strong>{record.title}</strong>
            </div>
            <div>
              <span>Área generadora</span>
              <strong>{areaName(record.areaId)}</strong>
            </div>
            <div>
              <span>Código CADIDO</span>
              <strong>{record.cadidoCode}</strong>
            </div>
            <div className="loan-location-readonly">
              <MapPin size={16} />
              <span>
                <small>Ubicación física</small>
                <strong>{locationSummary(record)}</strong>
              </span>
            </div>
            <span className="record-badge record-badge--green">
              <span />
              En archivo
            </span>
          </div>}
          <ul className="grid gap-2">
            {records.map(item => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#c8d4cc] p-3">
                <span><strong className="block">{item.title}</strong><small className="text-[#687570]">{item.recordNumber}</small></span>
              </li>
            ))}
          </ul>
        </section>
        <section className="loan-form-section">
          <div className="step-heading">
            <span>
              <UserCheck size={21} />
            </span>
            <div>
              <h3>Datos del préstamo</h3>
              <p>Personas responsables y periodo previsto de consulta.</p>
            </div>
          </div>
          {staffError && <div className="validation-summary" role="alert">No se pudo consultar el personal: {staffError}</div>}
          {staffLoading && <p className="field-hint">Cargando personal autorizado…</p>}
          <div className="record-form-grid">
            <LoanField error={errors.requestingAreaId} label="Área solicitante" required>
              <select
                value={form.requestingAreaId}
                onChange={(event) => {
                  setForm(current => ({ ...current, requestingAreaId: event.target.value, requesterUserId: "" }));
                  setErrors(current => ({ ...current, requestingAreaId: undefined, requesterUserId: undefined }));
                }}
              >
                <option value="">Selecciona un área</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </select>
            </LoanField>
            <LoanField error={errors.requesterUserId} label="Persona solicitante" required>
              <select
                value={form.requesterUserId}
                onChange={(event) => update("requesterUserId", event.target.value)}
                disabled={!form.requestingAreaId || staffLoading || Boolean(staffError)}
              >
                <option value="">{!form.requestingAreaId ? "Selecciona primero el área" : "Selecciona un empleado del área"}</option>
                {requesterOptions.map(employee => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
              </select>
            </LoanField>
            <LoanField error={errors.loanDate} label="Fecha del préstamo" required>
              <input
                type="date"
                value={form.loanDate}
                onChange={(event) => update("loanDate", event.target.value)}
              />
            </LoanField>
            <LoanField
              error={errors.expectedReturnDate}
              label="Fecha prevista de devolución"
              required
            >
              <input
                min={form.loanDate}
                type="date"
                value={form.expectedReturnDate}
                onChange={(event) => update("expectedReturnDate", event.target.value)}
              />
            </LoanField>
            <LoanField label="Persona que autoriza (sesión actual)">
              <input value={fullName(currentUser)} readOnly disabled />
            </LoanField>
            <LoanField error={errors.delivererUserId} label="Persona que entrega" required>
              <select
                value={form.delivererUserId}
                onChange={(event) => update("delivererUserId", event.target.value)}
                disabled={staffLoading || Boolean(staffError)}
              >
                <option value="">Selecciona quién entrega el expediente</option>
                {delivererOptions.map(employee => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
              </select>
            </LoanField>
            <LoanField error={errors.receivedBy} label="Persona que recibe" required>
              <input
                value={form.receivedBy}
                onChange={(event) => update("receivedBy", event.target.value)}
              />
            </LoanField>
            <LoanField label="Observaciones">
              <textarea
                rows={3}
                value={form.observations}
                onChange={(event) => update("observations", event.target.value)}
              />
            </LoanField>
          </div>
        </section>
        <div className="concentration-location-form__footer">
          <Button className="button--secondary" onClick={onBack}>
            Cancelar
          </Button>
          <Button className="button--primary" type="submit">
            <Check size={17} />
            Revisar entrega
          </Button>
        </div>
      </form>
      {confirmOpen && (
        <LoanConfirmModal
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => onConfirm(form)}
          records={records}
        />
      )}
    </div>
  );
}

function DetailField({ label, value }: { label: string; value?: string }) {
  return (
    <div className="detail-field">
      <span>{label}</span>
      <strong>{value || "Sin registro"}</strong>
    </div>
  );
}

function LoanDetail({
  canReturn,
  loan,
  onBack,
  onHistory,
  onReturn,
  record,
}: {
  canReturn: boolean;
  loan: ArchivalLoan;
  onBack: () => void;
  onHistory: () => void;
  onReturn: () => void;
  record?: ArchivalRecord;
}) {
  const status = effectiveLoanStatus(loan);
  const inventoryLoan = loan.mode === "Inventario completo";
  const multiple = (loan.items?.length ?? 0) > 1;
  const [receiptError, setReceiptError] = useState("");
  return (
    <div className="loan-detail-page">
      <button className="text-button" onClick={onBack}>
        <ArrowLeft size={17} />
        Volver a la bandeja
      </button>
      <div className="surface loan-detail-hero">
        <div className="transfer-detail-hero__icon">
          <BriefcaseBusiness size={23} />
        </div>
        <div>
          <span>Préstamo físico</span>
          <h2>{loan.folio}</h2>
          <p>
            {inventoryLoan ? loan.inventoryFolio || "Inventario completo" : multiple ? `${loan.items?.length} expedientes` : loan.items?.[0]?.title || record?.title || "Expediente"}
          </p>
        </div>
        <LoanStatusBadge loan={loan} />
        <Button className="button--secondary" onClick={() => {
          setReceiptError("");
          void downloadLoanReceipt(loan, record).catch(() => setReceiptError("No fue posible generar el recibo. Inténtalo nuevamente."));
        }}>
          <Download size={16} /> Descargar recibo PDF
        </Button>
        <Button className="button--secondary" onClick={onHistory}>
          <History size={16} />
          Historial
        </Button>
        {loan.status === "Activo" && canReturn && (
          <Button className="button--primary" onClick={onReturn}>
            <RotateCcw size={16} />
            Registrar devolución
          </Button>
        )}
      </div>
      {receiptError && <p role="alert" className="field-error">{receiptError}</p>}
      {status === "Vencido" && (
        <div className="overdue-banner">
          <AlertCircle size={18} />
          <span>
            <strong>Préstamo vencido y activo</strong>
            La fecha prevista ya fue superada. El expediente permanece como Prestado hasta registrar
            su devolución física.
          </span>
        </div>
      )}
      <div className="loan-detail-grid">
        {record && !inventoryLoan && !multiple && <section className="record-detail-group">
          <h3>
            <Files size={17} />
            Expediente
          </h3>
          <div>
            <DetailField label="Inventario de origen" value={record.inventoryId} />
            <DetailField label="Número de expediente" value={record.recordNumber} />
            <DetailField label="Título o asunto" value={record.title} />
            <DetailField label="Área generadora" value={areaName(record.areaId)} />
            <DetailField label="Código CADIDO" value={record.cadidoCode} />
            <DetailField label="Ubicación de origen" value={locationSummary(record)} />
            <DetailField label="Etapa archivística" value={record.stage} />
          </div>
        </section>}
        <section className="record-detail-group">
          <h3>
            <CalendarClock size={17} />
            Datos del préstamo
          </h3>
          <div>
            <DetailField label="Área solicitante" value={areaName(loan.requestingAreaId)} />
            <DetailField label="Solicitante" value={loan.requesterName} />
            <DetailField label="Fecha del préstamo" value={formatDate(loan.loanDate)} />
            <DetailField label="Devolución prevista" value={formatDate(loan.expectedReturnDate)} />
            <DetailField label="Devolución real" value={formatDate(loan.actualReturnDate)} />
            <DetailField label="Estado" value={status} />
          </div>
        </section>
        <section className="record-detail-group">
          <h3>
            <UserCheck size={17} />
            Responsables
          </h3>
          <div>
            <DetailField label="Persona que autoriza" value={loan.authorizedBy} />
            <DetailField label="Persona que entrega" value={loan.deliveredBy} />
            <DetailField label="Persona que recibe" value={loan.receivedBy} />
            <DetailField label="Recibió devolución" value={loan.returnReceivedBy} />
          </div>
        </section>
        <section className="record-detail-group">
          <h3>
            <FileCheck2 size={17} />
            Observaciones
          </h3>
          <div>
            <DetailField label="Observaciones del préstamo" value={loan.observations} />
            <DetailField label="Observaciones de devolución" value={loan.returnObservations} />
          </div>
        </section>
      </div>
      {Boolean(loan.items?.length) && (
        <section className="record-detail-group mt-4">
          <h3><Files size={17} /> Expedientes prestados ({loan.items?.length})</h3>
          <ul className="divide-y divide-[#d9e3dc] px-4">
            {loan.items?.map(item => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span className="min-w-0 break-words">
                  <strong className="block text-[#173c34]">{item.title}</strong>
                  <small className="text-[#687570]">{item.number || item.id}</small>
                </span>
              </li>
            ))}
          </ul>
          <details className="border-t border-[#d9e3dc] px-4 py-3">
            <summary className="cursor-pointer font-semibold">Estado físico de los expedientes</summary>
            <ul className="mt-2 grid gap-2 text-sm">
              {loan.items?.map(item => (
                <li key={item.id}>
                  <strong>{item.number || item.id}</strong> · Entrega: {physicalCondition(item.deliveryCondition)} · Devolución: {item.returnedDate ? physicalCondition(item.condition) : "Pendiente"}
                </li>
              ))}
            </ul>
          </details>
        </section>
      )}
      <div className="record-rule-note">
        <ShieldCheck size={18} />
        <span>
          <strong>Etapa archivística protegida</strong>El préstamo y la devolución no cambian la
          etapa Archivo de concentración.
        </span>
      </div>
    </div>
  );
}

function ReturnConfirmModal({
  complete,
  busy,
  onCancel,
  onConfirm,
}: {
  complete: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="modal-backdrop">
      <div className="modal loan-confirm-modal return-confirm-modal">
        <div className="transfer-confirm-modal__icon">
          <PackageCheck size={23} />
        </div>
        <h2>Confirmar devolución física</h2>
        <p>
          {complete
            ? "El préstamo cambiará a Devuelto y todos los expedientes recibidos volverán a estar En archivo."
            : "Se registrará una devolución parcial; los expedientes faltantes continuarán Prestados y el préstamo seguirá activo."}
        </p>
        <div className="transfer-rule">
          <ShieldCheck size={17} />
          La etapa permanecerá en Archivo de concentración.
        </div>
        <div className="modal__footer">
          <Button className="button--secondary" disabled={busy} onClick={onCancel}>
            Cancelar
          </Button>
          <Button className="button--primary" disabled={busy} onClick={onConfirm}>
            <Check size={17} />
            Confirmar devolución
          </Button>
        </div>
      </div>
    </div>
  );
}

function ReturnForm({
  currentUser,
  loan,
  onBack,
  onSave,
  record,
}: {
  currentUser: UserRecord;
  loan: ArchivalLoan;
  onBack: () => void;
  onSave: (date: string, receivedBy: string, notes: string, returnedIds: string[], conditions: Record<string, LoanReturnCondition>) => Promise<void>;
  record?: ArchivalRecord;
}) {
  const [date, setDate] = useState(todayIso());
  const [receivedBy, setReceivedBy] = useState(fullName(currentUser));
  const [notes, setNotes] = useState("");
  const inventoryLoan = loan.mode === "Inventario completo";
  const pendingIds = loanRecordIds(loan);
  const pendingItems = pendingIds.map(id => loan.items?.find(item => item.id === id) ??
    { id, number: record?.recordNumber || id, title: record?.title || "Expediente" });
  const allowsPartialReturn = inventoryLoan || (loan.items?.length ?? pendingIds.length) > 1;
  const [returnedIds, setReturnedIds] = useState<string[]>([]);
  const [conditions, setConditions] = useState<Record<string, LoanReturnCondition>>({});
  const [saving, setSaving] = useState(false);
  const selectedIds = allowsPartialReturn ? returnedIds.filter(id => pendingIds.includes(id)) : pendingIds;
  const [errors, setErrors] = useState<{ date?: string; receivedBy?: string; items?: string }>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <div className="return-page">
      <div className="record-form-top">
        <div>
          <button className="text-button" onClick={onBack}>
            <ArrowLeft size={17} />
            Volver al préstamo
          </button>
          <h2>Registrar devolución</h2>
          <p>
            {loan.folio} · {inventoryLoan ? loan.inventoryFolio || "Inventario completo" : record?.recordNumber}
          </p>
        </div>
        <LoanStatusBadge loan={loan} />
      </div>
      <form
        className="surface return-form"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          const next: { date?: string; receivedBy?: string; items?: string } = {};
          if (!date) next.date = "Captura la fecha real de devolución.";
          else if (date < loan.loanDate)
            next.date = "La devolución no puede ser anterior a la fecha del préstamo.";
          if (!receivedBy.trim()) next.receivedBy = "Ingresa la persona que recibe.";
          if (!selectedIds.length) next.items = "Marca al menos un expediente recibido.";
          else if (selectedIds.some(id => !conditions[id]))
            next.items = "Indica el estado de cada expediente marcado.";
          setErrors(next);
          if (!Object.keys(next).length) setConfirmOpen(true);
        }}
      >
        <div className="return-loan-summary">
          <BriefcaseBusiness size={20} />
          <div>
            <span>Préstamo activo</span>
            <strong>{loan.folio}</strong>
            <small>
              {loan.requesterName} · previsto {formatDate(loan.expectedReturnDate)}
            </small>
          </div>
          <span className="record-id">{inventoryLoan ? loan.inventoryFolio || "Inventario completo" : record?.recordNumber}</span>
        </div>
        <div className="record-form-grid return-fields">
          <LoanField error={errors.date} label="Fecha real de devolución" required>
            <input
              min={loan.loanDate}
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </LoanField>
          <LoanField error={errors.receivedBy} label="Persona que recibe la devolución" required>
            <input value={receivedBy} onChange={(event) => setReceivedBy(event.target.value)} />
          </LoanField>
          <LoanField label="Observaciones">
            <textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </LoanField>
        </div>
        {pendingItems.length > 0 && (
          <section className="form-section">
            <div className="form-section__title"><h3>Recepción por expediente</h3></div>
            <p>{selectedIds.length} de {pendingItems.length} expedientes pendientes marcados como recibidos.</p>
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr>{allowsPartialReturn && <th>Recibido</th>}<th>Expediente</th><th>Asunto</th><th>Estado al recibir</th></tr></thead>
                <tbody>{pendingItems.map(item => {
                  const checked = selectedIds.includes(item.id);
                  return (
                    <tr key={item.id}>
                      {allowsPartialReturn && <td><input type="checkbox" aria-label={`Recibido ${item.number}`} checked={checked}
                        onChange={() => setReturnedIds(current => checked
                          ? current.filter(id => id !== item.id) : [...current, item.id])} /></td>}
                      <td>{item.number}</td><td>{item.title}</td>
                      <td><label className="filter-select">
                        <select aria-label={`Estado de ${item.number}`} disabled={!checked}
                          value={checked ? conditions[item.id] ?? "" : ""} onChange={event => {
                            const value = event.target.value as LoanReturnCondition;
                            setConditions(current => ({ ...current, [item.id]: value }));
                          }}>
                          <option value="">Selecciona el estado</option>
                          <option value="GOOD">Buen estado</option>
                          <option value="ISSUE">Con incidencias</option>
                        </select>
                      </label></td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
            {errors.items && <p className="inline-notice" role="alert">{errors.items}</p>}
          </section>
        )}
        <div className="concentration-location-form__footer">
          <Button className="button--secondary" onClick={onBack}>
            Cancelar
          </Button>
          <Button className="button--primary" type="submit">
            <Check size={17} />
            Revisar devolución
          </Button>
        </div>
      </form>
      {confirmOpen && (
        <ReturnConfirmModal
          complete={selectedIds.length === pendingIds.length}
          busy={saving}
          onCancel={() => { if (!saving) setConfirmOpen(false); }}
          onConfirm={async () => {
            if (saving) return;
            setSaving(true);
            try {
              await onSave(date, receivedBy.trim(), notes.trim(), selectedIds, conditions);
            } finally {
              setSaving(false);
              setConfirmOpen(false);
            }
          }}
        />
      )}
    </div>
  );
}

function LoanHistory({
  loan,
  onBack,
  record,
}: {
  loan: ArchivalLoan;
  onBack: () => void;
  record: ArchivalRecord;
}) {
  return (
    <div className="history-page">
      <div className="record-form-top">
        <div>
          <button className="text-button" onClick={onBack}>
            <ArrowLeft size={17} />
            Volver al préstamo
          </button>
          <h2>Historial de movimientos</h2>
          <p>
            {loan.folio} · {record.recordNumber}
          </p>
        </div>
        <LoanStatusBadge loan={loan} />
      </div>
      <section className="surface loan-history-card">
        <div className="timeline-card__heading">
          <History size={20} />
          <div>
            <h3>Entrega y devolución</h3>
            <p>Movimientos físicos registrados para el expediente.</p>
          </div>
        </div>
        <div className="table-scroll">
          <table className="data-table loan-history-table">
            <thead>
              <tr>
                <th>Movimiento</th>
                <th>Fecha</th>
                <th>Responsable</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {loan.history.map((movement) => (
                <tr key={movement.id}>
                  <td>
                    <span className={`movement-type movement-type--${movement.type.toLowerCase()}`}>
                      {movement.type === "Entrega" ? (
                        <BriefcaseBusiness size={14} />
                      ) : (
                        <PackageCheck size={14} />
                      )}
                      {movement.type}
                    </span>
                  </td>
                  <td>{formatDate(movement.date)}</td>
                  <td>{movement.responsible}</td>
                  <td>{movement.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default function LoansPanel({
  initialSearch = "",
  currentUser,
  loans,
  onLoansChange,
  onRecordsChange,
  permissions,
  records,
}: {
  initialSearch?: string;
  currentUser: UserRecord;
  loans: ArchivalLoan[];
  onLoansChange: (loans: ArchivalLoan[]) => void;
  onRecordsChange: (records: ArchivalRecord[]) => void;
  permissions: string[];
  records: ArchivalRecord[];
  role: Role;
}) {
  const [view, setView] = useState<PanelView>("list");
  const [selectedRecords, setSelectedRecords] = useState<ArchivalRecord[]>([]);
  const [selectedLoan, setSelectedLoan] = useState<ArchivalLoan | null>(null);
  const [message, setMessage] = useState("");
  const [loanError, setLoanError] = useState<{ title: string; detail: string } | null>(null);
  useEffect(() => {
    if (!/registrado correctamente|devolución completada|devolución parcial registrada/i.test(message)) return;
    const timer=window.setTimeout(()=>setMessage(""),4000);
    return ()=>window.clearTimeout(timer);
  },[message]);
  const canCreate = permissions.includes("register-loans");
  const canReturn = permissions.includes("register-returns");

  const refreshRecords=async()=>{
    const fresh=await concentrationApi.list();
    const freshIds=new Set(fresh.map(x=>x.id));
    onRecordsChange([...records.filter(x=>!freshIds.has(x.id)),...fresh]);
  };
  const createLoan=async(data:LoanFormData)=>{
    if(!selectedRecords.length)return;
    try{
      const created=await loanApi.create({
        mode:"INDIVIDUAL",recordIds:selectedRecords.map(r=>r.id),
        requestingAreaId:data.requestingAreaId,requesterUserId:data.requesterUserId,
        delivererUserId:data.delivererUserId,
        loanDate:data.loanDate,expectedReturnDate:data.expectedReturnDate,
        receivedBy:data.receivedBy,observations:data.observations,
      });
      onLoansChange([created,...loans]);
      const updatedList=await concentrationApi.list().catch(error=>{
        console.error("Préstamo confirmado; no se pudo actualizar la lista de expedientes:",error);
        return null;
      });
      if(updatedList){
        const ids=new Set(updatedList.map(row=>row.id));
        onRecordsChange([...records.filter(row=>!ids.has(row.id)),...updatedList]);
      } else {
        const selectedIds=new Set(selectedRecords.map(row=>row.id));
        onRecordsChange(records.map(row=>selectedIds.has(row.id)?{...row,availability:"Prestado"}:row));
      }
      setSelectedRecords([]);
      setMessage(created.folio+" registrado correctamente.");
      setSelectedLoan(created);
      setView("detail");
      void downloadLoanReceipt(created, selectedRecords[0]).catch(() => {
        setMessage("Préstamo registrado. Usa Descargar recibo PDF para volver a intentarlo.");
      });
    }catch(error){
      const message=error instanceof Error?error.message:"No se pudo registrar el préstamo.";
      setLoanError({ title: "No se pudo registrar el préstamo", detail: message });
    }
  };
  const returnLoan=async(date:string,receivedBy:string,notes:string,returnedIds:string[],conditions:Record<string,LoanReturnCondition>)=>{
    if(!selectedLoan)return;
    try{
      const updated=await loanApi.returnItems(selectedLoan.id,returnedIds,date,receivedBy,notes,conditions);
      onLoansChange(loans.map(l=>l.id===updated.id?updated:l));
      const updatedRecords=await concentrationApi.list().catch(error=>{
        console.error("Devolución confirmada; no se pudo actualizar la consulta:",error);
        return null;
      });
      if(updatedRecords){
        const ids=new Set(updatedRecords.map(row=>row.id));
        onRecordsChange([...records.filter(row=>!ids.has(row.id)),...updatedRecords]);
      } else {
        const returned=new Set(returnedIds);
        onRecordsChange(records.map(row=>returned.has(row.id)?{...row,availability:"En archivo"}:row));
      }
      setSelectedLoan(updated);
      setMessage(updated.status==="Devuelto"
        ?"Devolución completada correctamente."
        :"Devolución parcial registrada. El préstamo permanece activo.");
      setView("detail");
    }catch(error){
      const message=error instanceof Error?error.message:"No se pudo registrar la devolución.";
      setLoanError({ title: "No se pudo registrar la devolución", detail: message });
      // Actualizar tras un conflicto con otra sesión.
      try{
        const [freshLoans,freshRecords]=await Promise.all([loanApi.list(),concentrationApi.list()]);
        onLoansChange(freshLoans);
        const current=freshLoans.find(l=>l.id===selectedLoan.id);
        if(current)setSelectedLoan(current);
        const ids=new Set(freshRecords.map(r=>r.id));
        onRecordsChange([...records.filter(r=>!ids.has(r.id)),...freshRecords]);
      }catch(syncError){console.error("Error sincronizando devolución:",syncError);}
    }
  };

  if (view === "select")
    return (
      <RecordSelector
        loans={loans}
        onBack={() => setView("list")}
        selection={selectedRecords}
        onSelect={(selected) => {
          setSelectedRecords(selected);
          setView("form");
        }}
        records={records}
      />
    );

  const errorDialog = loanError && (
    <div className="modal-backdrop" style={{ zIndex: 110 }}>
      <section className="modal decision-modal" role="alertdialog" aria-modal="true"
        aria-labelledby="loan-error-title" aria-describedby="loan-error-detail"
        onKeyDown={event => { if (event.key === "Escape") setLoanError(null); }}>
        <div className="modal__header">
          <h2 id="loan-error-title">{loanError.title}</h2>
          <AlertCircle size={20} className="text-[#75163c]" aria-hidden="true" />
        </div>
        <div className="modal__body">
          <p id="loan-error-detail" className="break-words text-sm">{loanError.detail}</p>
        </div>
        <div className="modal__footer">
          <button type="button" className="button button--primary" autoFocus onClick={() => setLoanError(null)}>Entendido</button>
        </div>
      </section>
    </div>
  );

  if (view === "form" && selectedRecords.length)
    return (
      <>
        <LoanForm
          currentUser={currentUser}
          onBack={() => setView("select")}
          onConfirm={createLoan}
          records={selectedRecords}
        />
        {errorDialog}
      </>
    );

  if (view === "return" && selectedLoan) {
    const record = recordFor(records, selectedLoan.recordId);
    if (record || selectedLoan.items?.length || selectedLoan.mode === "Inventario completo")
      return (
        <>
          <ReturnForm
            key={selectedLoan.id}
            currentUser={currentUser}
            loan={selectedLoan}
            onBack={() => setView("detail")}
            onSave={returnLoan}
            record={record}
          />
          {errorDialog}
        </>
      );
  }

  if (view === "history" && selectedLoan) {
    const record = recordFor(records, selectedLoan.recordId);
    if (record)
      return <LoanHistory loan={selectedLoan} onBack={() => setView("detail")} record={record} />;
  }

  if (view === "detail" && selectedLoan) {
    const record = recordFor(records, selectedLoan.recordId);
    if (record || selectedLoan.items?.length || selectedLoan.mode === "Inventario completo")
      return (
        <>
          {message && (
            <div className="toast record-toast">
              <Check size={18} />
              {message}
            </div>
          )}
          <LoanDetail
            canReturn={canReturn}
            loan={selectedLoan}
            onBack={() => {
              setSelectedLoan(null);
              setView("list");
            }}
            onHistory={() => setView("history")}
            onReturn={() => setView("return")}
            record={record}
          />
        </>
      );
  }

  return (
    <>
      {message && (
        <div className="toast record-toast">
          <Check size={18} />
          {message}
        </div>
      )}
      <LoanTray
        initialSearch={initialSearch}
        canCreate={canCreate}
        canReturn={canReturn}
        loans={loans}
        onCreate={() => {
          setSelectedRecords([]);
          setView("select");
        }}
        onOpen={(loan, action) => {
          setSelectedLoan(loan);
          setView(action === "return" ? "return" : action === "history" ? "history" : "detail");
        }}
        records={records}
      />
    </>
  );
}
