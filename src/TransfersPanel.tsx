import { FormEvent, ReactNode, useMemo, useState } from "react";
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Eye,
  FileCheck2,
  FileClock,
  FilePenLine,
  Files,
  FolderArchive,
  History,
  Inbox,
  ListChecks,
  MessageSquareText,
  MoreHorizontal,
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
import { Role, UserRecord, areaName, fullName } from "./data";
import { transferApi, tramiteApi, concentrationApi, ReceptionLocation } from "./api";
import { ArchivalRecord } from "./records";
import {
  DocumentaryTransfer,
  ReceptionStatus,
  TransferStatus,
  todayIso,
} from "./transfers";

type PanelView = "list" | "wizard" | "detail" | "reception" | "history";

const transferSteps = [
  { label: "Seleccionar inventarios de trámite", icon: ListChecks },
  { label: "Revisar información", icon: ClipboardCheck },
  { label: "Vista previa", icon: Files },
  { label: "Confirmar envío", icon: Send },
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
  return user ? fullName(user) : "Sin asignar";
}

function TransferTray({
  initialSearch = "",
  canCreate,
  currentUser,
  onCreate,
  onOpen,
  role,
  transfers,
  users,
}: {
  initialSearch?: string;
  canCreate: boolean;
  currentUser: UserRecord;
  onCreate: () => void;
  onOpen: (transfer: DocumentaryTransfer, action?: "continue" | "history" | "reception") => void;
  role: Role;
  transfers: DocumentaryTransfer[];
  users: UserRecord[];
}) {
  const [status, setStatus] = useState<TransferStatus | "Todas">("Todas");
  const [search, setSearch] = useState(initialSearch);
  const [searched, setSearched] = useState(Boolean(initialSearch));
  const [page, setPage] = useState(1);
  const [activeActions, setActiveActions] = useState<string | null>(null);
  const pageSize = 5;
  const visibleByRole = useMemo(() => {
    if (role === "Administrador / Coordinador") return transfers;
    if (role === "Encargado de área")
      return transfers.filter((item) => item.areaId === currentUser.areaId);
    return transfers.filter(
      (item) => item.areaId === currentUser.areaId && item.requestedBy === currentUser.id,
    );
  }, [currentUser.areaId, role, transfers]);
  const filtered = visibleByRole.filter((transfer) => {
    const query = search.toLowerCase();
    return (
      (status === "Todas" || transfer.status === status) &&
      (!query ||
        transfer.folio.toLowerCase().includes(query) ||
        areaName(transfer.areaId).toLowerCase().includes(query) ||
        userName(users, transfer.requestedBy).toLowerCase().includes(query))
    );
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
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
            <p>{visibleByRole.length} solicitudes disponibles de acuerdo con tus permisos</p>
          </div>
          <span className="demo-label">Seguimiento documental</span>
        </div>
        <div className="transfer-tabs" role="tablist">
          {(
            [
              "Todas",
              "En preparación",
              "Pendiente de visto bueno del área",
              "Pendiente de revisión administrativa",
              "Con observaciones",
              "Aceptada",
            ] as const
          ).map((item) => (
            <button
              aria-selected={status === item}
              className={status === item ? "is-active" : ""}
              key={item}
              onClick={() => {
                setStatus(item);
                setPage(1);
                setSearched(true);
              }}
              role="tab"
            >
              {item}
              <span>
                {
                  visibleByRole.filter((transfer) => item === "Todas" || transfer.status === item)
                    .length
                }
              </span>
            </button>
          ))}
        </div>
        <div className="transfer-searchbar">
          <label className="search-box">
            <Search size={17} />
            <input
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
                setSearched(Boolean(event.target.value.trim()));
              }}
              placeholder="Buscar por folio, área o solicitante..."
              value={search}
            />
          </label>
        </div>
        {!searched ? (
          <div className="empty-state concentration-search-empty">
            <Search size={30} />
            <strong>Busca o selecciona un estado para consultar solicitudes</strong>
            <p>La bandeja no carga automáticamente todas las transferencias.</p>
          </div>
        ) : <div className="table-scroll">
          <table className="data-table transfer-table">
            <thead>
              <tr>
                <th>Folio</th>
                <th>Área solicitante</th>
                <th>Usuario solicitante</th>
                <th>Fecha</th>
                <th>Inventarios / expedientes</th>
                <th>Estado</th>
                <th>Responsable de revisión</th>
                <th className="align-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((transfer) => {
                const canContinue =
                  role === "Personal de área" &&
                  transfer.requestedBy === currentUser.id &&
                  ["En preparación", "Con observaciones"].includes(transfer.status);
                return (
                  <tr key={transfer.id}>
                    <td>
                      <button className="record-number-link" onClick={() => onOpen(transfer)}>
                        {transfer.folio}
                      </button>
                    </td>
                    <td>{areaName(transfer.areaId)}</td>
                    <td>
                      <div className="requester-cell">
                        <span>
                          <UserRound size={14} />
                        </span>
                        <strong>{userName(users, transfer.requestedBy)}</strong>
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
                    <td>{userName(users, transfer.reviewerId)}</td>
                    <td>
                      <div className="record-actions">
                        <button
                          aria-label={`Acciones para ${transfer.folio}`}
                          onClick={() =>
                            setActiveActions((current) =>
                              current === transfer.id ? null : transfer.id,
                            )
                          }
                        >
                          <MoreHorizontal size={18} />
                        </button>
                        {activeActions === transfer.id && (
                          <div className="record-actions__menu transfer-actions-menu">
                            <button onClick={() => onOpen(transfer)}>
                              <Eye size={16} />
                              Ver solicitud
                            </button>
                            {canContinue && (
                              <button onClick={() => onOpen(transfer, "continue")}>
                                <FilePenLine size={15} />
                                {transfer.status === "Con observaciones"
                                  ? "Corregir y reenviar"
                                  : "Continuar"}
                              </button>
                            )}
                            {transfer.status === "Aceptada" &&
                              role !== "Personal de área" &&
                              transfer.receptionStatus !== "Recibida" && (
                                <button onClick={() => onOpen(transfer, "reception")}>
                                  <PackageCheck size={15} />
                                  Registrar recepción
                                </button>
                              )}
                            <button onClick={() => onOpen(transfer, "history")}>
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
              <strong>No hay solicitudes en esta vista</strong>
              <p>Cambia el filtro de estado o realiza una nueva búsqueda.</p>
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

function TransferProgress({ current }: { current: number }) {
  return (
    <div className="transfer-progress">
      <div className="transfer-progress__line">
        <span style={{ width: `${(current / 3) * 100}%` }} />
      </div>
      {transferSteps.map((step, index) => {
        const Icon = step.icon;
        return (
          <div
            className={current === index ? "is-current" : current > index ? "is-complete" : ""}
            key={step.label}
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
            <th>Número de expediente</th>
            <th>Área</th>
            <th>Código CADIDO</th>
            <th>Título o asunto</th>
            <th>Fechas</th>
            <th>Vigencias</th>
            <th>Datos documentales</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((record) => (
            <tr key={record.id}>
              <td>
                <span className="record-id">{record.recordNumber}</span>
              </td>
              <td>{areaName(record.areaId)}</td>
              <td>
                <span className="cadido-code">{record.archiveClassificationCode || record.cadidoCode}</span>
              </td>
              <td>
                <span className="inventory-title">{record.title}</span>
              </td>
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
  onConfirm: () => void;
  resend: boolean;
}) {
  return (
    <div className="modal-backdrop">
      <div className="modal transfer-confirm-modal" role="dialog" aria-modal="true">
        <div className="transfer-confirm-modal__icon">
          <Send size={23} />
        </div>
        <h2>{resend ? "¿Reenviar solicitud?" : "¿Enviar transferencia a revisión?"}</h2>
        <p>
          Se incluirán todos los expedientes de {count} inventario{count === 1 ? "" : "s"}. El envío
          cambiará la solicitud a <strong> Pendiente de visto bueno del área</strong>, pero los
          expedientes permanecerán en Archivo de trámite.
        </p>
        <div className="transfer-rule">
          <ShieldCheck size={17} />
          Enviar no cambia la etapa archivística.
        </div>
        <div className="modal__footer">
          <Button className="button--secondary" onClick={onCancel}>
            Cancelar
          </Button>
          <Button className="button--primary" onClick={onConfirm}>
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
  onSubmit: (recordIds: string[], existing: DocumentaryTransfer | null) => void;
  transfers: DocumentaryTransfer[];
}) {
  const [step, setStep] = useState(0);
  const [search, setSearch] = useState("");
  const [selectedInventoryIds, setSelectedInventoryIds] = useState<string[]>(() => [
    ...new Set(
      allRecords
        .filter((record) => activeTransfer?.recordIds.includes(record.id))
        .map((record) => record.inventoryId),
    ),
  ]);
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const blockedIds = new Set(
    transfers
      .filter(
        (transfer) =>
          transfer.id !== activeTransfer?.id &&
          [
            "En preparación",
            "Pendiente de visto bueno del área",
            "Pendiente de revisión administrativa",
            "Con observaciones",
          ].includes(
            transfer.status,
          ),
      )
      .flatMap((transfer) => transfer.recordIds),
  );
  const areaRecords = allRecords.filter(
    (record) =>
      record.stage === "Archivo de trámite" &&
      record.areaId === currentUser.areaId &&
      (currentUser.roles.includes("Encargado de área") || record.createdBy === currentUser.id),
  );
  const blockedInventoryIds = new Set(
    areaRecords.filter((record) => blockedIds.has(record.id)).map((record) => record.inventoryId),
  );
  const eligible = areaRecords.filter(
    (record) => !blockedInventoryIds.has(record.inventoryId),
  );
  const shown = eligible.filter((record) => {
    const query = search.toLowerCase();
    return (
      !query ||
      record.recordNumber.toLowerCase().includes(query) ||
      record.title.toLowerCase().includes(query) ||
      record.cadidoCode.toLowerCase().includes(query)
    );
  });
  const selectedRecords = allRecords.filter((record) =>
    selectedInventoryIds.includes(record.inventoryId),
  );
  const eligibleInventories = Array.from(
    eligible.reduce((groups, record) => {
      const key = record.inventoryId || record.id;
      groups.set(key, [...(groups.get(key) ?? []), record]);
      return groups;
    }, new Map<string, ArchivalRecord[]>()),
  );

  const next = () => {
    if (!selectedInventoryIds.length) {
      setError("Selecciona al menos un inventario completo elegible para continuar.");
      return;
    }
    setError("");
    setStep((current) => Math.min(3, current + 1));
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
      <TransferProgress current={step} />
      <section className="surface transfer-wizard">
        {step === 0 && (
          <div className="transfer-step">
            <div className="step-heading">
              <span>
                <ListChecks size={21} />
              </span>
              <div>
                <h3>Seleccionar inventarios de trámite</h3>
                <p>
                  Solo se muestran expedientes de trámite elegibles del área{" "}
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
              <span>{selectedInventoryIds.length} inventarios seleccionados</span>
            </div>
            <div className="eligible-list inventory-eligible-list">
              {eligibleInventories.map(([inventoryId, inventoryRecords]) => {
                const visibleRows = inventoryRecords.filter((record) => shown.includes(record));
                if (!visibleRows.length) return null;
                const selected = selectedInventoryIds.includes(inventoryId);
                return (
                  <section
                    className={`eligible-inventory-group ${selected ? "is-selected" : ""}`}
                    key={inventoryId}
                  >
                    <div className="eligible-inventory-group__header">
                      <span>
                        <strong>{inventoryId}</strong>
                        <small>
                          {areaName(inventoryRecords[0].areaId)} · {inventoryRecords.length} expedientes
                        </small>
                      </span>
                      <button
                        className="text-button"
                        onClick={() => {
                          setSelectedInventoryIds((current) =>
                            current.includes(inventoryId)
                              ? current.filter((id) => id !== inventoryId)
                              : [...current, inventoryId],
                          );
                        }}
                        type="button"
                      >
                        <Check size={15} /> {selected ? "Quitar inventario" : "Seleccionar inventario completo"}
                      </button>
                    </div>
                    <div>
                      {visibleRows.map((record) => (
                          <div className="eligible-row-readonly" key={record.id}>
                            <span>
                              <strong>{record.recordNumber}</strong>
                              <small>{record.title}</small>
                            </span>
                            <span className="cadido-code">{record.archiveClassificationCode || record.cadidoCode}</span>
                            <span className="eligible-meta">
                              {record.filesCount} legajos · {record.foliosCount} folios
                            </span>
                          </div>
                      ))}
                    </div>
                  </section>
                );
              })}
              {!shown.length && (
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
        {step === 1 && (
          <div className="transfer-step">
            <div className="step-heading">
              <span>
                <ClipboardCheck size={21} />
              </span>
              <div>
                <h3>Revisar información</h3>
                <p>Confirma solicitante, área y expedientes antes de generar la vista previa.</p>
              </div>
            </div>
            <div className="transfer-summary-grid">
              <div>
                <span>Área solicitante</span>
                <strong>{areaName(currentUser.areaId)}</strong>
              </div>
              <div>
                <span>Usuario solicitante</span>
                <strong>{fullName(currentUser)}</strong>
              </div>
              <div>
                <span>Expedientes incluidos</span>
                <strong>{selectedRecords.length}</strong>
              </div>
              <div>
                <span>Tipo de inventario</span>
                <strong>Transferencia primaria</strong>
              </div>
              <div>
                <span>Inventarios de origen</span>
                <strong>{new Set(selectedRecords.map((record) => record.inventoryId)).size}</strong>
              </div>
            </div>
            <div className="origin-inventory-summary">
              {[...new Set(selectedRecords.map((record) => record.inventoryId))].map((id) => (
                <div key={id}>
                  <FolderArchive size={16} />
                  <span>
                    <strong>{id}</strong>
                    <small>
                      {selectedRecords.filter((record) => record.inventoryId === id).length}{" "}
                      expedientes incluidos integralmente
                    </small>
                  </span>
                </div>
              ))}
            </div>
            <div className="selected-records-review">
              {selectedRecords.map((record) => (
                <div key={record.id}>
                  <FileCheck2 size={17} />
                  <span>
                    <strong>{record.recordNumber}</strong>
                    <small>{record.title}</small>
                  </span>
                  <span className="cadido-code">{record.archiveClassificationCode || record.cadidoCode}</span>
                </div>
              ))}
            </div>
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
            <div className="origin-inventory-summary transfer-preview-origins">
              {[...new Set(selectedRecords.map((record) => record.inventoryId))].map((id) => {
                const origin = selectedRecords.filter((record) => record.inventoryId === id);
                return (
                  <div key={id}>
                    <FolderArchive size={16} />
                    <span>
                      <strong>{id}</strong>
                      <small>
                        {areaName(origin[0].areaId)} · {origin.length} expedientes incluidos
                      </small>
                    </span>
                  </div>
                );
              })}
            </div>
            <InventoryTable records={selectedRecords} />
            <div className="inventory-note">
              <ShieldCheck size={17} />
              Esta vista previa no modifica los expedientes ni su etapa archivística.
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="transfer-step confirm-transfer-step">
            <div className="confirm-transfer-step__icon">
              <Send size={25} />
            </div>
            <h3>{activeTransfer ? "Reenviar solicitud corregida" : "Confirmar envío"}</h3>
            <p>
              La solicitud contiene{" "}
              <strong>
                {selectedRecords.length} expediente{selectedRecords.length === 1 ? "" : "s"}
              </strong>{" "}
              de
              {` ${areaName(currentUser.areaId)}`}.
            </p>
            <div className="confirm-rules">
              <div>
                <CheckCircle2 size={17} />
                <span>Se conservarán los identificadores originales.</span>
              </div>
              <div>
                <Clock3 size={17} />
                <span>El estado cambiará a Pendiente de visto bueno del área.</span>
              </div>
              <div>
                <ShieldCheck size={17} />
                <span>Los expedientes continuarán en Archivo de trámite.</span>
              </div>
            </div>
            <Button className="button--primary" onClick={() => setConfirmOpen(true)}>
              <Send size={17} />
              {activeTransfer ? "Reenviar solicitud" : "Enviar a revisión"}
            </Button>
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
                onClick={() => setStep((current) => current - 1)}
              >
                <ChevronLeft size={17} />
                Anterior
              </Button>
            )}
            {step < 3 && (
            <Button className="button--primary" disabled={!selectedInventoryIds.length} onClick={next}>
                Continuar
                <ArrowRight size={17} />
              </Button>
            )}
          </div>
        </div>
      </section>
      {confirmOpen && (
        <ConfirmationModal
          count={selectedInventoryIds.length}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => onSubmit(selectedRecords.map((record) => record.id), activeTransfer)}
          resend={Boolean(activeTransfer)}
        />
      )}
    </div>
  );
}

function RequestDetail({
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
  const included = records.filter((record) => transfer.recordIds.includes(record.id));
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
    role === "Encargado de área" &&
    transfer.areaId === currentUser.areaId &&
    transfer.status === "Pendiente de visto bueno del área" &&
    transfer.requestedBy !== currentUser.id &&
    permissions.includes("approve-area-transfers");
  return (
    <div className="transfer-detail-page">
      <button className="text-button" onClick={onBack}>
        <ArrowLeft size={17} />
        Volver a la bandeja
      </button>
      <div className="surface transfer-detail-hero">
        <div className="transfer-detail-hero__icon">
          <Files size={23} />
        </div>
        <div>
          <span>Solicitud de transferencia primaria</span>
          <h2>{transfer.folio}</h2>
          <p>
            {areaName(transfer.areaId)} · {included.length} expedientes
          </p>
        </div>
        <TransferStatusBadge status={transfer.status} />
        <Button className="button--secondary" onClick={onHistory}>
          <History size={16} />
          Historial
        </Button>
      </div>
      {transfer.status === "Con observaciones" && (
        <div className="transfer-observation-banner">
          <MessageSquareText size={18} />
          <span>
            <strong>Observaciones de la revisión</strong>
            {transfer.observation}
          </span>
        </div>
      )}
      <section className="surface request-info">
        <div className="section-heading">
          <div>
            <h2>Datos de la solicitud</h2>
            <p>Información administrativa registrada.</p>
          </div>
        </div>
        <div className="transfer-summary-grid">
          <div>
            <span>Usuario solicitante</span>
            <strong>{userName(users, transfer.requestedBy)}</strong>
          </div>
          <div>
            <span>Área solicitante</span>
            <strong>{areaName(transfer.areaId)}</strong>
          </div>
          <div>
            <span>Fecha de envío</span>
            <strong>{formatDate(transfer.submittedAt)}</strong>
          </div>
          <div>
            <span>Responsable de revisión</span>
            <strong>{userName(users, transfer.reviewerId)}</strong>
          </div>
          <div>
            <span>Fecha de aceptación</span>
            <strong>{formatDate(transfer.acceptedAt)}</strong>
          </div>
          <div>
            <span>Recepción física</span>
            <strong>{transfer.receptionStatus}</strong>
          </div>
        </div>
      </section>
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
      {transfer.status === "Aceptada" && (
        <section className="surface reception-summary">
          <div>
            <Truck size={20} />
            <span>
              <strong>Seguimiento de recepción física</strong>
              <small>La etapa archivística ya es concentración.</small>
            </span>
          </div>
          <ReceptionBadge status={transfer.receptionStatus} />
          <div className="reception-summary__data">
            <span>
              Fecha: <b>{formatDate(transfer.receptionDate)}</b>
            </span>
            <span>
              Responsable: <b>{userName(users, transfer.receptionResponsible)}</b>
            </span>
          </div>
          {canReceive && transfer.receptionStatus !== "Recibida" && (
            <Button className="button--secondary" onClick={onReceive}>
              <PackageCheck size={16} />
              Registrar recepción
            </Button>
          )}
        </section>
      )}
      {(canReview || canAccept) && (
        <div className="review-actions">
          <div>
            <ShieldCheck size={19} />
            <span>
              <strong>Revisión administrativa</strong>
              Aceptar es la única acción que cambia la etapa de los expedientes a concentración.
            </span>
          </div>
          {canReview && (
            <Button className="button--danger-outline" onClick={onReturn}>
              <RotateCcw size={16} />
              Devolver con observaciones
            </Button>
          )}
          {canAccept && (
            <Button className="button--primary" onClick={onAccept}>
              <Check size={17} />
              Aceptar transferencia
            </Button>
          )}
        </div>
      )}
      {canAreaReview && (
        <div className="review-actions">
          <div>
            <ShieldCheck size={19} />
            <span>
              <strong>Revisión del área</strong>
              El visto bueno envía la solicitud a revisión administrativa y no cambia etapas.
            </span>
          </div>
          <Button className="button--danger-outline" onClick={onReturn}>
            <RotateCcw size={16} />
            Devolver con observaciones
          </Button>
          <Button className="button--primary" onClick={onAreaApprove}>
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

function AcceptModal({
  count,
  onCancel,
  onConfirm,
}: {
  count: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="modal-backdrop">
      <div className="modal decision-modal decision-modal--accept">
        <div className="transfer-confirm-modal__icon">
          <CheckCircle2 size={24} />
        </div>
        <h2>Aceptar transferencia</h2>
        <p>
          Esta decisión cambiará {count} expediente{count === 1 ? "" : "s"} de Archivo de trámite a
          <strong> Archivo de concentración</strong>. Los identificadores se conservarán.
        </p>
        <div className="accept-warning">
          <AlertCircle size={17} />
          La recepción física se registrará posteriormente.
        </div>
        <div className="modal__footer">
          <Button className="button--secondary" onClick={onCancel}>
            Cancelar
          </Button>
          <Button className="button--primary" onClick={onConfirm}>
            <Check size={17} />
            Confirmar aceptación
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
  onSave: (status: ReceptionStatus, date: string, notes: string, location: ReceptionLocation | null) => void;
  transfer: DocumentaryTransfer;
}) {
  const [status, setStatus] = useState<ReceptionStatus>(
    transfer.receptionStatus === "Pendiente" ? "Recibida" : transfer.receptionStatus,
  );
  const [date, setDate] = useState(transfer.receptionDate || todayIso());
  const [notes, setNotes] = useState(transfer.receptionNotes);
  const [error, setError] = useState("");
  const [location,setLocation]=useState<ReceptionLocation>(()=>({
    archiveZone:"Archivo de concentración",
    room:"Sótano",shelf:"",level:"",physicalSection:"",
    position:"",locationBox:"",locationNotes:"",
  }));
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
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          if (status === "Diferencias pendientes" && !notes.trim()) {
            setError("Describe las diferencias encontradas.");
            return;
          }
          if(status==="Recibida" && (
            !location.archiveZone.trim() || !location.room.trim() ||
            !location.shelf || !location.level || !location.physicalSection
          )){
            setError("Completa zona, sala, estante, nivel y sección física. Esta ubicación se asignará a todos los expedientes de la transferencia.");
            return;
          }
          onSave(status,date,notes.trim(),status==="Recibida"?location:null);
        }}
      >
        <div className="step-heading">
          <span>
            <PackageCheck size={21} />
          </span>
          <div>
            <h3>Registrar resultado de recepción</h3>
            <p>Este seguimiento no vuelve a modificar la etapa archivística.</p>
          </div>
        </div>
        <div className="reception-options">
          {(["Recibida", "Diferencias pendientes"] as ReceptionStatus[]).map((item) => (
            <label className={status === item ? "is-selected" : ""} key={item}>
              <input checked={status === item} onChange={() => setStatus(item)} type="radio" />
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
          <label className={`form-field record-field--wide ${error ? "has-error" : ""}`}>
            <span>
              Observaciones o diferencias{status === "Diferencias pendientes" && <b>*</b>}
            </span>
            <textarea
              onChange={(event) => {
                setNotes(event.target.value);
                setError("");
              }}
              placeholder="Registra el resultado del cotejo físico..."
              rows={4}
              value={notes}
            />
            {error && <small className="field-error">{error}</small>}
          </label>
        </div>
        {status==="Recibida" && <section className="surface" style={{padding:16,margin:"16px 0"}}>
          <div className="step-heading"><span><FolderArchive size={21}/></span><div>
            <h3>Ubicación física del inventario recibido</h3>
            <p>Captura la ubicación una sola vez. Se aplicará automáticamente a los {transfer.recordIds.length} expedientes de esta transferencia, sin repetir el formulario.</p>
          </div></div>
          <div className="record-form-grid" style={{marginTop:16}}>
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
            <label className="form-field"><span>Caja o referencia</span>
              <input maxLength={60} value={location.locationBox} onChange={e=>updateLocation("locationBox",e.target.value)}/>
            </label>
            <label className="form-field"><span>Posición</span>
              <input maxLength={45} value={location.position} onChange={e=>updateLocation("position",e.target.value.toUpperCase())}/>
            </label>
            <label className="form-field record-field--wide"><span>Observaciones de ubicación</span>
              <textarea rows={2} value={location.locationNotes} onChange={e=>updateLocation("locationNotes",e.target.value)}/>
            </label>
          </div>
          <p className="catalog-note">La recepción y la ubicación compartida se guardarán juntas en MySQL. Ningún expediente requiere captura individual.</p>
        </section>}
        {error && <div role="alert" className="validation-summary">{error}</div>}
        <div className="reception-rule">
          <ShieldCheck size={17} />
          La ubicación se guarda en MySQL junto con la recepción física. La aceptación administrativa ya se realizó.
        </div>
        <div className="concentration-location-form__footer">
          <Button className="button--secondary" onClick={onBack}>
            Cancelar
          </Button>
          <Button className="button--primary" type="submit">
            <Check size={17} />
            Guardar recepción
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
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [message, setMessage] = useState("");
  const canReceive =
    role === "Administrador / Coordinador" &&
    permissions.includes("update-location");
  const canCreate =
    (role === "Personal de área" || role === "Encargado de área") &&
    permissions.includes("prepare-transfers");

  const saveTransferState=(updated:DocumentaryTransfer)=>{
    onTransfersChange(transfers.some(t=>t.id===updated.id)
      ? transfers.map(t=>t.id===updated.id?updated:t)
      : [updated,...transfers]);
    setSelected(updated);
  };
  const failure=(error:unknown)=>{
    setMessage(error instanceof Error ? error.message : "No se pudo completar la operación en MySQL.");
  };
  const submitTransfer=async(recordIds:string[],existing:DocumentaryTransfer|null)=>{
    try{
      const updated=await transferApi.submit(recordIds,existing);
      saveTransferState(updated);
      setWizardTransfer(null);
      setView("list");
      setMessage(updated.folio+" fue enviada para visto bueno del área en MySQL.");
    }catch(error){ failure(error);window.alert(error instanceof Error?error.message:"No se pudo enviar la transferencia"); }
  };
  const returnTransfer=async(observation:string)=>{
    if(!selected)return;
    try{
      const updated=await transferApi.observe(selected.id,observation);
      saveTransferState(updated);
      setReturnOpen(false);
      setMessage("La solicitud fue devuelta con observaciones.");
    }catch(error){failure(error);window.alert(error instanceof Error?error.message:"No se pudo devolver");}
  };
  const approveAreaTransfer=async()=>{
    if(!selected)return;
    try{
      const updated=await transferApi.areaApprove(selected.id);
      saveTransferState(updated);
      setMessage("El visto bueno quedó registrado en MySQL.");
    }catch(error){failure(error);window.alert(error instanceof Error?error.message:"No se pudo aprobar");}
  };
  const acceptTransfer=async()=>{
    if(!selected)return;
    try{
      const updated=await transferApi.accept(selected.id);
      // La aceptación ya fue confirmada por MySQL. Fallos posteriores al
      // refrescar la pantalla no deben confundirse con un fallo de aceptación.
      saveTransferState(updated);
      setAcceptOpen(false);
      try{
        const [tramite,concentracion]=await Promise.all([tramiteApi.list(),concentrationApi.list()]);
        onRecordsChange([
          ...tramite.filter(record=>record.stage!=="Archivo de concentración"),
          ...concentracion,
        ]);
        setMessage("La transferencia fue aceptada; todos sus expedientes pasaron a concentración.");
      }catch(refreshError){
        console.error("Transferencia aceptada; error al actualizar la vista:",refreshError);
        setMessage("Transferencia aceptada en MySQL. Recarga la página para actualizar los expedientes.");
      }
    }catch(error){failure(error);window.alert(error instanceof Error?error.message:"No se pudo aceptar");}
  };
  const saveReception=async(status:ReceptionStatus,date:string,notes:string,location:ReceptionLocation|null)=>{
    if(!selected)return;
    try{
      const updated=await transferApi.receive(selected.id,status,date,notes,location);
      saveTransferState(updated);
      try{
        if(status==="Recibida"){
          const [tramite,concentracion]=await Promise.all([tramiteApi.list(),concentrationApi.list()]);
          onRecordsChange([...tramite.filter(r=>r.stage!=="Archivo de concentración"),...concentracion]);
        }
      }catch(e){console.error("Recepción confirmada, pero falló actualizar pantalla:",e);}
      setMessage("La recepción y, cuando corresponde, la ubicación física quedaron registradas en MySQL.");
      setView("detail");
    }catch(error){failure(error);window.alert(error instanceof Error?error.message:"No se pudo registrar recepción");}
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

  if (view === "reception" && selected)
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
          canReceive={canReceive}
          currentUser={currentUser}
          onAccept={() => setAcceptOpen(true)}
          onAreaApprove={approveAreaTransfer}
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
