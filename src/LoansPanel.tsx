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
  Eye,
  FileCheck2,
  Files,
  History,
  Inbox,
  MapPin,
  MoreHorizontal,
  PackageCheck,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  UserCheck,
  UserRound,
  X,
} from "lucide-react";
import { Role, UserRecord, areaName, areas, fullName } from "./data";
import { loanApi, concentrationApi, type LoanEligibleUser } from "./api";
import { ArchivalLoan, effectiveLoanStatus, todayIso } from "./loans";
import { ArchivalRecord, locationSummary } from "./records";

type PanelView = "list" | "select" | "form" | "detail" | "return" | "history";
type LoanFilter = "Activos" | "Próximos a vencer" | "Vencidos" | "Devueltos";

const formatDate = (value: string) =>
  value ? new Date(`${value}T12:00:00`).toLocaleDateString("es-MX") : "Sin registro";

const offsetDate = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

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
  const [activeActions, setActiveActions] = useState<string | null>(null);
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
            record?.title.toLowerCase().includes(query))
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
            <p>{loans.length} movimientos registrados en el prototipo</p>
          </div>
          <span className="demo-label">Datos de demostración</span>
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
                const count = loanRecordIds(loan).length;
                const active = loan.status === "Activo";
                return (
                  <tr key={loan.id}>
                    <td>
                      <button className="record-number-link" onClick={() => onOpen(loan)}>
                        {loan.folio}
                      </button>
                    </td>
                    <td>
                      {record?.inventoryId ?? "Sin referencia"}
                      {count > 1 && <small className="record-count"> · {count} expedientes</small>}
                    </td>
                    <td>
                      <span className="record-id">{record?.recordNumber}</span>
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
                      <div className="record-actions">
                        <button
                          aria-label={`Acciones para ${loan.folio}`}
                          onClick={() =>
                            setActiveActions((current) => (current === loan.id ? null : loan.id))
                          }
                        >
                          <MoreHorizontal size={18} />
                        </button>
                        {activeActions === loan.id && (
                          <div className="record-actions__menu loan-actions-menu">
                            <button onClick={() => onOpen(loan)}>
                              <Eye size={16} />
                              Ver seguimiento
                            </button>
                            {active && canReturn && (
                              <button onClick={() => onOpen(loan, "return")}>
                                <RotateCcw size={15} />
                                Registrar devolución
                              </button>
                            )}
                            <button onClick={() => onOpen(loan, "history")}>
                              <History size={15} />
                              Ver historial
                            </button>
                          </div>
                        )}
                      </div>
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
  loans,
  onBack,
  onSelect,
  records,
}: {
  loans: ArchivalLoan[];
  onBack: () => void;
  onSelect: (records: ArchivalRecord[], mode: "INDIVIDUAL" | "INVENTARIO_COMPLETO") => void;
  records: ArchivalRecord[];
}) {
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"individual" | "inventory">("individual");
  const activeRecordIds = new Set(
    loans.filter((loan) => loan.status === "Activo").flatMap(loanRecordIds),
  );
  const concentration = records.filter((record) => record.stage === "Archivo de concentración");
  const shown = concentration.filter((record) => {
    const query = search.toLowerCase();
    return (
      !query ||
      record.recordNumber.toLowerCase().includes(query) ||
      record.title.toLowerCase().includes(query) ||
      record.cadidoCode.toLowerCase().includes(query)
    );
  });
  return (
    <div className="loan-select-page">
      <div className="record-form-top">
        <div>
          <button className="text-button" onClick={onBack}>
            <ArrowLeft size={17} />
            Volver a la bandeja
          </button>
          <h2>Seleccionar expediente</h2>
          <p>Selecciona un expediente individual o un inventario completo disponible.</p>
        </div>
        <span className="record-mode">
          <Archive size={16} />
          Concentración
        </span>
      </div>
      <section className="surface select-record-card">
        <div className="transfer-tabs" role="tablist">
          <button className={mode === "individual" ? "is-active" : ""} onClick={() => setMode("individual")}>
            A. Expediente individual
          </button>
          <button className={mode === "inventory" ? "is-active" : ""} onClick={() => setMode("inventory")}>
            B. Inventario completo
          </button>
        </div>
        <div className="records-filter-head">
          <div>
            <h3>Expedientes en concentración</h3>
            <p>Consulta ubicación y disponibilidad antes de seleccionar.</p>
          </div>
        </div>
        <div className="transfer-searchbar">
          <label className="search-box">
            <Search size={17} />
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar expediente, asunto o CADIDO..."
              value={search}
            />
          </label>
        </div>
        <div className="table-scroll">
          <table className="data-table select-record-table">
            <thead>
              <tr>
                <th>Inventario de origen</th>
                <th>Número de expediente</th>
                <th>Título</th>
                <th>Área generadora</th>
                <th>Código CADIDO</th>
                <th>Ubicación física</th>
                <th>Disponibilidad</th>
                <th className="align-right">Selección</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((record) => {
                const available =
                  record.availability === "En archivo" && !activeRecordIds.has(record.id);
                return (
                  <tr key={record.id}>
                    <td>{record.inventoryId}</td>
                    <td>
                      <span className="record-id">{record.recordNumber}</span>
                    </td>
                    <td>
                      <span className="record-subject">{record.title}</span>
                    </td>
                    <td>{areaName(record.areaId)}</td>
                    <td>
                      <span className="cadido-code">{record.cadidoCode}</span>
                    </td>
                    <td>
                      <span className="location-cell">{locationSummary(record)}</span>
                    </td>
                    <td>
                      <span
                        className={`record-badge record-badge--${available ? "green" : "wine"}`}
                      >
                        <span />
                        {available ? "En archivo" : "Prestado"}
                      </span>
                    </td>
                    <td className="align-right">
                      <Button
                        className={available ? "button--secondary" : "button--disabled"}
                        disabled={!available}
                        onClick={() => {
                          if (mode === "individual") return onSelect([record], "INDIVIDUAL");
                          const inventory = concentration.filter(
                            (item) => item.inventoryId === record.inventoryId,
                          );
                          if (
                            inventory.some(
                              (item) =>
                                item.availability !== "En archivo" || activeRecordIds.has(item.id),
                            )
                          )
                            return;
                          onSelect(inventory, "INVENTARIO_COMPLETO");
                        }}
                      >
                        <Check size={15} />
                        {mode === "individual" ? "Seleccionar" : "Prestar inventario"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="selection-rule">
          <ShieldCheck size={17} />
          Los expedientes de trámite y aquellos con préstamo activo no están disponibles para
          selección.
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
  onConfirm: () => void;
  records: ArchivalRecord[];
}) {
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
          <Button className="button--secondary" onClick={onCancel}>
            Cancelar
          </Button>
          <Button className="button--primary" onClick={onConfirm}>
            <Check size={17} />
            Confirmar entrega
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
  onConfirm: (data: LoanFormData) => void;
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
            Cambiar expediente
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
              <h3>Datos del expediente</h3>
              <p>Información de lectura y ubicación física actual.</p>
            </div>
          </div>
          <div className="loan-record-readonly">
            <div>
              <span>Inventario de origen</span>
              <strong>{record.inventoryId}</strong>
            </div>
            <div>
              <span>Modalidad</span>
              <strong>
                {records.length === 1 ? "Expediente individual" : `Inventario completo · ${records.length} expedientes`}
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
          </div>
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
          {staffLoading && <p className="field-hint">Cargando empleados activos desde MySQL…</p>}
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
  record: ArchivalRecord;
}) {
  const status = effectiveLoanStatus(loan);
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
            {record.recordNumber} · {record.title}
          </p>
        </div>
        <LoanStatusBadge loan={loan} />
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
        <section className="record-detail-group">
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
        </section>
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
  onCancel,
  onConfirm,
}: {
  complete: boolean;
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
          <Button className="button--secondary" onClick={onCancel}>
            Cancelar
          </Button>
          <Button className="button--primary" onClick={onConfirm}>
            <Check size={17} />
            Confirmar devolución
          </Button>
        </div>
      </div>
    </div>
  );
}

function ReturnForm({
  allRecords,
  currentUser,
  loan,
  onBack,
  onSave,
  record,
}: {
  currentUser: UserRecord;
  loan: ArchivalLoan;
  onBack: () => void;
  onSave: (date: string, receivedBy: string, notes: string, returnedIds: string[]) => void;
  allRecords: ArchivalRecord[];
  record: ArchivalRecord;
}) {
  const [date, setDate] = useState(todayIso());
  const [receivedBy, setReceivedBy] = useState(fullName(currentUser));
  const [notes, setNotes] = useState("");
  const [returnedIds, setReturnedIds] = useState<string[]>(loanRecordIds(loan));
  const [errors, setErrors] = useState<{ date?: string; receivedBy?: string }>({});
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
            {loan.folio} · {record.recordNumber}
          </p>
        </div>
        <LoanStatusBadge loan={loan} />
      </div>
      <form
        className="surface return-form"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          const next: { date?: string; receivedBy?: string } = {};
          if (!date) next.date = "Captura la fecha real de devolución.";
          else if (date < loan.loanDate)
            next.date = "La devolución no puede ser anterior a la fecha del préstamo.";
          if (!receivedBy.trim()) next.receivedBy = "Ingresa la persona que recibe.";
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
          <span className="record-id">{record.recordNumber}</span>
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
        {allRecords.length > 1 && (
          <div className="eligible-list">
            <strong>Expedientes recibidos físicamente</strong>
            {allRecords.map((item) => (
              <label className={returnedIds.includes(item.id) ? "is-selected" : ""} key={item.id}>
                <input
                  checked={returnedIds.includes(item.id)}
                  onChange={() =>
                    setReturnedIds((current) =>
                      current.includes(item.id)
                        ? current.filter((id) => id !== item.id)
                        : [...current, item.id],
                    )
                  }
                  type="checkbox"
                />
                <span className="check-control">
                  {returnedIds.includes(item.id) && <Check size={14} />}
                </span>
                <span><strong>{item.recordNumber}</strong><small>{item.title}</small></span>
              </label>
            ))}
            <small>
              Si falta algún expediente, el préstamo conjunto permanecerá activo únicamente para
              los pendientes.
            </small>
          </div>
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
          complete={returnedIds.length === loanRecordIds(loan).length}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => onSave(date, receivedBy.trim(), notes.trim(), returnedIds)}
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
  const [selectedMode, setSelectedMode] = useState<"INDIVIDUAL" | "INVENTARIO_COMPLETO">("INDIVIDUAL");
  const [selectedLoan, setSelectedLoan] = useState<ArchivalLoan | null>(null);
  const [message, setMessage] = useState("");
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
        mode:selectedMode,recordIds:selectedRecords.map(r=>r.id),
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
      setMessage(created.folio+" quedó registrado en MySQL.");
      setView("list");
    }catch(error){
      const message=error instanceof Error?error.message:"No se pudo registrar el préstamo.";
      setMessage(message);
      window.alert(message);
    }
  };
  const returnLoan=async(date:string,receivedBy:string,notes:string,returnedIds:string[])=>{
    if(!selectedLoan)return;
    try{
      const updated=await loanApi.returnItems(selectedLoan.id,returnedIds,date,receivedBy,notes);
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
        ?"Todos los expedientes fueron devueltos a MySQL."
        :"Devolución parcial registrada. El préstamo permanece activo.");
      setView("detail");
    }catch(error){
      const message=error instanceof Error?error.message:"No se pudo registrar la devolución.";
      setMessage(message);
      // Una devolución por lote puede quedar parcialmente aplicada; sincronizar.
      try{
        const [freshLoans,freshRecords]=await Promise.all([loanApi.list(),concentrationApi.list()]);
        onLoansChange(freshLoans);
        const current=freshLoans.find(l=>l.id===selectedLoan.id);
        if(current)setSelectedLoan(current);
        const ids=new Set(freshRecords.map(r=>r.id));
        onRecordsChange([...records.filter(r=>!ids.has(r.id)),...freshRecords]);
      }catch(syncError){console.error("Error sincronizando devolución:",syncError);}
      window.alert(message);
    }
  };

  if (view === "select")
    return (
      <RecordSelector
        loans={loans}
        onBack={() => setView("list")}
        onSelect={(selected,mode) => {
          setSelectedRecords(selected);
          setSelectedMode(mode);
          setView("form");
        }}
        records={records}
      />
    );

  if (view === "form" && selectedRecords.length)
    return (
      <LoanForm
        currentUser={currentUser}
        onBack={() => setView("select")}
        onConfirm={createLoan}
        records={selectedRecords}
      />
    );

  if (view === "return" && selectedLoan) {
    const record = recordFor(records, selectedLoan.recordId);
    if (record)
      return (
        <ReturnForm
          allRecords={records.filter((item) => loanRecordIds(selectedLoan).includes(item.id))}
          currentUser={currentUser}
          loan={selectedLoan}
          onBack={() => setView("detail")}
          onSave={returnLoan}
          record={record}
        />
      );
  }

  if (view === "history" && selectedLoan) {
    const record = recordFor(records, selectedLoan.recordId);
    if (record)
      return <LoanHistory loan={selectedLoan} onBack={() => setView("detail")} record={record} />;
  }

  if (view === "detail" && selectedLoan) {
    const record = recordFor(records, selectedLoan.recordId);
    if (record)
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
