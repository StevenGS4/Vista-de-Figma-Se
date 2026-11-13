import { ReactNode, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Eye,
  FilePenLine,
  FilePlus2,
  Files,
  FolderTree,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Role, UserRecord, areaName, areas, fullName } from "./data";
import { tramiteApi } from "./api";
import {
  ArchivalRecord,
  cadidoSections,
  cadidoSeries,
  emptyRecord,
  locationSummary,
} from "./records";

type View = "list" | "form" | "detail";
type Errors = Partial<Record<keyof ArchivalRecord, string>>;
const TRAMITE_ADDRESS = "Avenida Allende No. 110 Oriente, Colonia Centro, C.P. 63000, Tepic, Nayarit";
const localDate = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime()-offset).toISOString().slice(0,10);
};
const previewNumber=(code:string,consecutive:string,year:string) =>
  code && consecutive && year ? `SEMARNAT.${code}.${consecutive.padStart(3,"0")}.${year}` : "Se generará al guardar";

const steps = [
  { label: "Datos generales del inventario", icon: Files },
  { label: "Expedientes y clasificación archivística", icon: FolderTree },
  { label: "Control documental", icon: ClipboardCheck },
  { label: "Revisión y guardado", icon: CheckCircle2 },
];

const sectionName = (id: string) =>
  cadidoSections.find((item) => item.id === id)?.name ?? "Sin asignar";
const seriesName = (id: string) =>
  cadidoSeries.find((item) => item.id === id)?.name ?? "Sin asignar";
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

function Field({
  children,
  className = "",
  error,
  hint,
  label,
  required,
}: {
  children: ReactNode;
  className?: string;
  error?: string;
  hint?: string;
  label: string;
  required?: boolean;
}) {
  return (
    <label className={`form-field ${error ? "has-error" : ""} ${className}`}>
      <span>
        {label}
        {required && <b>*</b>}
      </span>
      {children}
      {hint && !error && <small className="field-hint">{hint}</small>}
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}

function Badge({ children, wine = false }: { children: ReactNode; wine?: boolean }) {
  return (
    <span className={`record-badge record-badge--${wine ? "wine" : "green"}`}>
      <span />
      {children}
    </span>
  );
}

function StepHeading({
  description,
  icon,
  title,
}: {
  description: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <div className="step-heading">
      <span>{icon}</span>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

function Progress({
  current,
  maxVisited,
  onStep,
}: {
  current: number;
  maxVisited: number;
  onStep: (step: number) => void;
}) {
  return (
    <div className="wizard-progress">
      <div className="wizard-progress__bar">
        <span style={{ width: `${(current / 3) * 100}%` }} />
      </div>
      {steps.map((step, index) => {
        const Icon = step.icon;
        return (
          <button
            className={`${current === index ? "is-current" : ""} ${current > index ? "is-complete" : ""}`}
            disabled={index > maxVisited}
            key={step.label}
            onClick={() => onStep(index)}
          >
            <span>{current > index ? <Check size={15} /> : <Icon size={16} />}</span>
            <small>Paso {index + 1}</small>
            <strong>{step.label}</strong>
          </button>
        );
      })}
    </div>
  );
}

function groupInventories(records: ArchivalRecord[]) {
  const groups = new Map<string, ArchivalRecord[]>();
  records.forEach((record) => {
    const key = record.inventoryId || `LEGACY-${record.id}`;
    groups.set(key, [...(groups.get(key) ?? []), record]);
  });
  return [...groups.entries()].map(([id, items]) => ({
    id,
    records: items.sort((a, b) => Number(a.consecutive) - Number(b.consecutive)),
    header: items[0],
  }));
}

function InventoryList({
  initialSearch = "",
  canCreate,
  canDelete,
  canEdit,
  onCreate,
  onEdit,
  onDelete,
  onOpen,
  protectedRecordIds,
  records,
}: {
  initialSearch?: string;
  canCreate: boolean;
  canDelete: boolean;
  canEdit: boolean;
  onCreate: () => void;
  onEdit: (inventoryId: string) => void;
  onDelete: (inventoryId: string) => void;
  onOpen: (inventoryId: string) => void;
  protectedRecordIds: Set<string>;
  records: ArchivalRecord[];
}) {
  const [search, setSearch] = useState(initialSearch);
  const [searched, setSearched] = useState(Boolean(initialSearch));
  const [cadidoYear, setCadidoYear] = useState("");
  const [cadidoCodeFilter, setCadidoCodeFilter] = useState("");
  const [quickView, setQuickView] = useState<
    "Recientes activos" | "Todos los activos" | "Transferidos" | "Todos los autorizados"
  >(initialSearch ? "Todos los autorizados" : "Recientes activos");
  const inventories = useMemo(
    () =>
      groupInventories(records).filter(({ header, id, records: rows }, index) => {
        const query = search.trim().toLowerCase();
        const transferred = rows.every((record) => record.stage === "Archivo de concentración");
        const matchesView =
          quickView === "Todos los autorizados" ||
          (quickView === "Transferidos" && transferred) ||
          (quickView === "Todos los activos" && !transferred) ||
          (quickView === "Recientes activos" && !transferred && index < 5);
        return (
          matchesView &&
          (!cadidoYear || header.cadidoYear === cadidoYear) &&
          (!cadidoCodeFilter || header.cadidoCode === cadidoCodeFilter) &&
          (!query ||
            id.toLowerCase().includes(query) ||
            areaName(header.areaId).toLowerCase().includes(query) ||
            seriesName(header.cadidoSeriesId).toLowerCase().includes(query) ||
            header.cadidoCode.toLowerCase().includes(query) ||
            rows.some(
              (record) =>
                record.recordNumber.toLowerCase().includes(query) ||
                record.title.toLowerCase().includes(query) ||
                record.boxNumber.toLowerCase().includes(query),
            ))
        );
      }),
    [quickView, records, search, cadidoYear, cadidoCodeFilter],
  );
  return (
    <>
      <div className="records-page-heading">
        <div>
          <h2>Archivo de trámite</h2>
          <p>Inventarios documentales y expedientes relacionados por un encabezado común.</p>
        </div>
        {canCreate && (
          <Button className="button--primary" onClick={onCreate}>
            <Plus size={17} />
            Registrar inventario
          </Button>
        )}
      </div>
      <section className="surface records-table-card">
        <div className="records-filter-head">
          <div>
            <h3>Listado de inventarios</h3>
            <p>{inventories.length} inventarios autorizados en esta sesión</p>
          </div>
          <span className="demo-label">Datos de demostración</span>
        </div>
        <div className="records-filters inventory-list-filters">
          <label className="search-box records-search">
            <Search size={17} />
            <input
              onChange={(event) => {
                setSearch(event.target.value);
                setSearched(Boolean(event.target.value.trim()));
              }}
              placeholder="Buscar inventario, expediente, asunto, caja o CADIDO..."
              value={search}
            />
          </label>
          <label className="filter-select">
            <select
              aria-label="Vista rápida"
              value={quickView}
              onChange={(event) => {
                setQuickView(event.target.value as typeof quickView);
                setSearched(true);
              }}
            >
              <option>Recientes activos</option>
              <option>Todos los activos</option>
              <option>Transferidos</option>
              <option>Todos los autorizados</option>
            </select>
          </label>
          <label className="filter-select"><select aria-label="Filtrar edición CADIDO" value={cadidoYear} onChange={e=>{setCadidoYear(e.target.value);setSearched(true);}}>
            <option value="">Todas las ediciones CADIDO</option>
            {[...new Set(records.map(r=>r.cadidoYear||"Sin versión"))].sort().map(v=><option key={v} value={v==="Sin versión"?"":v}>{v}</option>)}
          </select></label>
          <label className="filter-select"><select aria-label="Filtrar código CADIDO histórico" value={cadidoCodeFilter} onChange={e=>{setCadidoCodeFilter(e.target.value);setSearched(true);}}>
            <option value="">Todos los códigos</option>
            {[...new Set(records.filter(r=>!cadidoYear||r.cadidoYear===cadidoYear).map(r=>r.cadidoCode))].sort().map(code=><option key={code} value={code}>{code}</option>)}
          </select></label>
          <Button className="button--primary" onClick={() => setSearched(true)}>
            <Search size={16} /> Buscar
          </Button>
        </div>
        {!searched ? (
          <div className="empty-state concentration-search-empty">
            <Search size={30} />
            <strong>Utiliza la búsqueda o una vista rápida</strong>
            <p>No se muestran inventarios automáticamente al entrar al módulo.</p>
          </div>
        ) : <div className="table-scroll">
          <table className="data-table records-table">
            <thead>
              <tr>
                <th>Identificador</th>
                <th>Unidad administrativa</th>
                <th>Área generadora</th>
                <th>Fondo</th>
                <th>Sección</th>
                <th>Serie</th>
                <th>Fecha</th>
                <th>Expedientes</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {inventories.map(({ header, id, records: rows }) => {
                const transferred = rows.filter(
                  (record) => record.stage === "Archivo de concentración",
                ).length;
                return (
                  <tr key={id}>
                    <td>
                      <button className="record-number-link" onClick={() => onOpen(id)}>
                        {id}
                      </button>
                    </td>
                    <td>{header.administrativeUnit}</td>
                    <td>{areaName(header.areaId)}</td>
                    <td>{header.fund}</td>
                    <td>{sectionName(header.cadidoSectionId)}</td>
                    <td>{seriesName(header.cadidoSeriesId)}</td>
                    <td>{formatDate(header.inventoryDate)}</td>
                    <td>{rows.length}</td>
                    <td>
                      <Badge wine={transferred > 0}>
                        {transferred === 0
                          ? "En trámite"
                          : transferred === rows.length
                            ? "Transferido"
                            : "Etapas mixtas"}
                      </Badge>
                    </td>
                    <td>
                      <div className="inventory-row-actions">
                        <button className="text-button" onClick={() => onOpen(id)}>
                          <Eye size={15} /> Abrir
                        </button>
                        {canEdit &&
                          rows.every(
                            (record) =>
                              record.stage === "Archivo de trámite" &&
                              !record.transferReference &&
                              !protectedRecordIds.has(record.id),
                          ) && (
                          <button className="text-button" onClick={() => onEdit(id)}>
                            <Pencil size={15} /> Editar / agregar
                          </button>
                        )}
                        {canDelete &&
                          rows.every(
                            (record) =>
                              record.stage === "Archivo de trámite" &&
                              !record.transferReference &&
                              !protectedRecordIds.has(record.id),
                          ) && (
                            <button className="text-button" onClick={() => onDelete(id)}>
                              <Trash2 size={15} /> Eliminar
                            </button>
                          )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!inventories.length && (
            <div className="empty-state">
              <Files size={30} />
              <strong>No encontramos inventarios</strong>
              <p>Prueba con otro término de búsqueda.</p>
            </div>
          )}
        </div>}
      </section>
    </>
  );
}

function HeaderStep({
  errors,
  form,
  isAdmin,
  locked,
  update,
}: {
  errors: Errors;
  form: ArchivalRecord;
  isAdmin: boolean;
  locked: boolean;
  update: <K extends keyof ArchivalRecord>(field: K, value: ArchivalRecord[K]) => void;
}) {
  const areaSeries = cadidoSeries.filter(series => series.enabledAreaIds.includes(form.areaId));
  const years = [...new Set(areaSeries.map(series=>series.year).filter((year):year is string=>Boolean(year)))].sort((a,b)=>Number(b)-Number(a));
  const selectedYear = isAdmin ? (form.cadidoYear || years[0] || "") : (years[0] || "");
  const compact = !isAdmin;
  const enabledSeries = areaSeries.filter(series=>!selectedYear||series.year===selectedYear);
  const sectionIds = new Set(enabledSeries.map((series) => series.sectionId));
  return (
    <>
      <StepHeading
        description="Este encabezado se registra una sola vez y se aplica a todas las filas."
        icon={<Files size={21} />}
        title="Datos generales del inventario"
      />
      {locked && (
        <div className="concept-warning">
          <ShieldCheck size={17} />
          <span>
            <strong>Encabezado protegido.</strong> Existen expedientes asociados a una
            transferencia; puedes consultar la información, pero no alterar sus datos históricos.
          </span>
        </div>
      )}
      {compact && (
        <div className="surface" style={{padding:16,marginBottom:18}}>
          <div className="section-heading"><div>
            <span className="section-kicker">Datos automáticos del área</span>
            <h3>{areaName(form.areaId)}</h3>
            <p>Los siguientes datos se obtienen del catálogo institucional y no requieren captura.</p>
          </div></div>
          <div className="transfer-summary-grid" style={{marginTop:12}}>
            <div><span>Fecha de elaboración</span><strong>{formatDate(form.inventoryDate)}</strong></div>
            <div><span>Unidad administrativa</span><strong>{form.administrativeUnit}</strong></div>
            <div><span>Responsable</span><strong>{form.responsible && form.responsible!=="Sin asignar" ? form.responsible : "Pendiente: asignar encargado en Administración"}</strong></div>
            <div><span>Cargo</span><strong>{form.responsiblePosition}</strong></div>
            <div><span>Fondo</span><strong>{form.fund}</strong></div>
            <div><span>Edición vigente</span><strong>{selectedYear || "Sin CADIDO autorizado"}</strong></div>
          </div>
          {!years.length && <p role="alert" className="field-error">El administrador debe asignar códigos de una edición CADIDO a esta área.</p>}
          {(!form.responsible || form.responsible==="Sin asignar") && <p role="alert" className="field-error">El administrador debe asignar un encargado de área antes de continuar.</p>}
        </div>
      )}
      <fieldset className="record-form-grid" disabled={locked}>
        {isAdmin && <Field
          error={errors.administrativeUnit}
          label="Nombre de la unidad administrativa"
          required
        >
          <input
            onChange={(event) => update("administrativeUnit", event.target.value)}
            value={form.administrativeUnit}
          />
        </Field>}
        {isAdmin && <Field error={errors.areaId} label="Nombre del área generadora" required>
          <select
            disabled={!isAdmin || locked}
            onChange={(event) => {
              const area = areas.find((item) => item.id === event.target.value);
              update("areaId", event.target.value);
              if (area) update("responsible", area.manager);
            }}
            value={form.areaId}
          >
            <option value="">Selecciona el área autorizada</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
        </Field>}
        {isAdmin && <Field error={errors.inventoryDate} label="Fecha de elaboración" required>
          <input
            onChange={(event) => update("inventoryDate", event.target.value)}
            type="date"
            value={form.inventoryDate}
          />
        </Field>}
        {isAdmin && <Field error={errors.responsible} label="Responsable del área generadora" required>
          <input
            onChange={(event) => update("responsible", event.target.value)}
            value={form.responsible}
          />
        </Field>}
        {isAdmin && <Field
          error={errors.responsiblePosition}
          label="Cargo del responsable del área generadora"
          required
        >
          <input
            onChange={(event) => update("responsiblePosition", event.target.value)}
            value={form.responsiblePosition}
          />
        </Field>}
        {isAdmin && <Field error={errors.fund} label="Fondo documental" required>
          <input onChange={(event) => update("fund", event.target.value)} value={form.fund} />
        </Field>}
        {isAdmin && <Field label="Edición CADIDO" required>
          <select value={selectedYear} disabled={locked} onChange={event=>{
            update("cadidoYear",event.target.value);
            update("cadidoSectionId","");update("cadidoSeriesId","");update("cadidoCode","");
          }}>
            <option value="">Selecciona una edición</option>
            {years.map(y=><option key={y} value={y}>CADIDO {y}</option>)}
          </select>
        </Field>}
        <Field error={errors.cadidoSectionId} label="Sección documental" required>
          <select
            onChange={(event) => {
              update("cadidoSectionId", event.target.value);
              update("cadidoSeriesId", "");
              update("cadidoCode", "");
            }}
            value={form.cadidoSectionId}
          >
            <option value="">Selecciona una sección</option>
            {cadidoSections
              .filter((section) => sectionIds.has(section.id))
              .map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name}
                </option>
              ))}
          </select>
        </Field>
        <Field error={errors.cadidoSeriesId} label="Serie documental" required>
          <select
            disabled={!form.cadidoSectionId || locked}
            onChange={(event) => {
              const series = cadidoSeries.find((item) => item.id === event.target.value);
              update("cadidoSeriesId", event.target.value);
              update("cadidoCode", series?.code ?? "");
              update("cadidoYear",series?.year ?? selectedYear);
            }}
            value={form.cadidoSeriesId}
          >
            <option value="">Selecciona una serie compatible</option>
            {enabledSeries
              .filter((series) => series.sectionId === form.cadidoSectionId)
              .map((series) => (
                <option key={series.id} value={series.id}>
                  {series.name}
                </option>
              ))}
          </select>
        </Field>
        {isAdmin && <Field
          hint="El total se calculará en la exportación según la cantidad de filas."
          label="Número inicial de hoja"
          required
        >
          <div className="sheet-number-control">
            <span>Hoja</span>
            <input
              min="1"
              onChange={(event) => update("initialSheetNumber", event.target.value)}
              type="number"
              value={form.initialSheetNumber}
            />
            <strong>de N</strong>
          </div>
        </Field>}
      </fieldset>
    </>
  );
}

function RowPicker({
  activeId,
  drafts,
  onAdd,
  onRemove,
  onSelect,
}: {
  activeId: string;
  drafts: ArchivalRecord[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const pages = Math.max(1, Math.ceil(drafts.length / pageSize));
  const visible = drafts.slice((page - 1) * pageSize, page * pageSize);
  return (
    <div className="inventory-expedients">
      <div className="inventory-expedients__toolbar">
        <div>
          <strong>{drafts.length} expedientes</strong>
          <small>Selecciona una fila para completar sus datos.</small>
        </div>
        <Button
          className="button--primary"
          onClick={() => {
            onAdd();
            setPage(Math.ceil((drafts.length + 1) / pageSize));
          }}
        >
          <Plus size={16} /> Agregar expediente
        </Button>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Consecutivo</th>
              <th>Caja</th>
              <th>Número de expediente</th>
              <th>Código CADIDO</th>
              <th>Título o asunto</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((record) => {
              const protectedRow =
                record.stage === "Archivo de concentración" || Boolean(record.transferReference);
              const complete = Boolean(
                record.recordNumber &&
                record.title &&
                record.openDate &&
                record.foliosCount &&
                record.shelf,
              );
              return (
                <tr className={record.id === activeId ? "is-active-row" : ""} key={record.id}>
                  <td>{record.consecutive || "Pendiente"}</td>
                  <td>{record.boxNumber || "—"}</td>
                  <td>{record.recordNumber || "Nueva fila"}</td>
                  <td>
                    <span className="cadido-code">{record.archiveClassificationCode || record.cadidoCode || "Pendiente"}</span>
                  </td>
                  <td>{record.title || "Sin capturar"}</td>
                  <td>
                    <Badge wine={!complete || protectedRow}>
                      {protectedRow ? "Protegido" : complete ? "Completo" : "Incompleto"}
                    </Badge>
                  </td>
                  <td>
                    <div className="inventory-row-actions">
                      <button className="text-button" onClick={() => onSelect(record.id)}>
                        {protectedRow ? <Eye size={15} /> : <Pencil size={15} />}
                        {protectedRow ? "Ver" : "Editar"}
                      </button>
                      {!protectedRow && drafts.length > 1 && (
                        <button
                          className="text-button danger-text"
                          onClick={() => onRemove(record.id)}
                        >
                          <Trash2 size={15} /> Quitar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="pagination">
          <span>
            Página {page} de {pages}
          </span>
          <div>
            <button disabled={page === 1} onClick={() => setPage((value) => value - 1)}>
              <ChevronLeft size={16} />
            </button>
            <button disabled={page === pages} onClick={() => setPage((value) => value + 1)}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ExpedientsStep({
  active,
  drafts,
  errors,
  isAdmin,
  onAdd,
  onRemove,
  onSelect,
  update,
}: {
  active: ArchivalRecord;
  drafts: ArchivalRecord[];
  errors: Errors;
  isAdmin: boolean;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onSelect: (id: string) => void;
  update: <K extends keyof ArchivalRecord>(field: K, value: ArchivalRecord[K]) => void;
}) {
  const protectedRow =
    active.stage === "Archivo de concentración" || Boolean(active.transferReference);
  return (
    <>
      <StepHeading
        description="Agrega tantas filas como requiera el inventario sin repetir el encabezado."
        icon={<FolderTree size={21} />}
        title="Expedientes y clasificación archivística"
      />
      <RowPicker
        activeId={active.id}
        drafts={drafts}
        onAdd={onAdd}
        onRemove={onRemove}
        onSelect={onSelect}
      />
      <fieldset className="record-form-grid row-detail-editor" disabled={protectedRow}>
        {isAdmin && <Field error={errors.consecutive} label="Número consecutivo" required>
          <input
            inputMode="numeric"
            onChange={(event) => update("consecutive", event.target.value)}
            value={active.consecutive}
          />
        </Field>}
        {!isAdmin && <div className="form-field"><span>Consecutivo del inventario</span><strong>{active.consecutive}</strong></div>}
        <Field label="Número de caja">
          <input inputMode="numeric" maxLength={isAdmin ? undefined : 6} pattern={isAdmin ? undefined : "[0-9]{1,6}"} style={{maxWidth:145}} placeholder="Hasta 6 dígitos"
            onChange={(event) => {
              update("boxNumber", event.target.value);
              if (!active.locationBox) update("locationBox", event.target.value);
            }}
            value={active.boxNumber}
          />
        </Field>
        <Field error={errors.recordYear} label="Año del código archivístico" required>
          <input type="number" min="1900" max="2100" style={{maxWidth:145}}
            value={active.recordYear || active.archiveClassificationCode?.match(/\.(\d{4})$/)?.[1] || String(new Date().getFullYear())}
            disabled={/^REG-\d+$/.test(active.id)}
            onChange={event=>{
              const year=event.target.value;
              update("recordYear",year);
            }} />
        </Field>
        <Field error={errors.recordNumber} label="Número de expediente" required>
          <input
            maxLength={110}
            placeholder="Captura el número propio del expediente"
            onChange={(event) => update("recordNumber", event.target.value)}
            value={active.recordNumber}
          />
        </Field>
        <Field className="record-field--wide" label="Código de clasificación archivística">
          <div className="read-only-code"><ShieldCheck size={16}/><strong>
            {/^REG-\d+$/.test(active.id) ?
              (active.archiveClassificationCode || "Clasificación histórica pendiente de revisión") :
              previewNumber(active.cadidoCode,active.consecutive,active.recordYear || String(new Date().getFullYear()))}
          </strong></div>
          <small className="field-hint">Clave CADIDO preliminar. MySQL asigna el consecutivo definitivo al guardar. Es independiente del número de expediente.</small>
        </Field>

        <Field className="record-field--wide" error={errors.title} label="Título o asunto" required>
          <input onChange={(event) => update("title", event.target.value)} value={active.title} />
        </Field>
        {!isAdmin && <Field className="record-field--wide" label="Descripción del asunto">
          <textarea rows={2} onChange={event=>update("description",event.target.value)} value={active.description}/>
        </Field>}
      </fieldset>
    </>
  );
}

function ControlStep({
  active,
  drafts,
  errors,
  isAdmin,
  onSelect,
  update,
}: {
  active: ArchivalRecord;
  drafts: ArchivalRecord[];
  errors: Errors;
  isAdmin: boolean;
  onSelect: (id: string) => void;
  update: <K extends keyof ArchivalRecord>(field: K, value: ArchivalRecord[K]) => void;
}) {
  const values = [
    ["Administrativo", "A"],
    ["Legal", "L"],
    ["Fiscal", "F"],
    ["Contable", "C"],
    ["Técnico", "T"],
  ];
  const locked = active.stage === "Archivo de concentración" || Boolean(active.transferReference);
  const total =
    active.currentValidity !== "" && active.concentrationValidity !== ""
      ? String(Number(active.currentValidity) + Number(active.concentrationValidity))
      : "";
  return (
    <>
      <StepHeading
        description="Completa el control de cada expediente y avanza entre filas sin volver al encabezado."
        icon={<ClipboardCheck size={21} />}
        title="Control documental"
      />
      <div className="record-selector-strip">
        {drafts.map((record) => (
          <button
            className={record.id === active.id ? "is-selected" : ""}
            key={record.id}
            onClick={() => onSelect(record.id)}
            type="button"
          >
            <span>{record.consecutive || "—"}</span>
            <strong>{record.recordNumber || "Nueva fila"}</strong>
            {record.openDate && record.foliosCount ? (
              <Check size={14} />
            ) : (
              <AlertCircle size={14} />
            )}
          </button>
        ))}
      </div>
      {!isAdmin && <div className="catalog-note" style={{marginBottom:16}}>
        <strong>{active.title || "Expediente sin título"}</strong>
        <div>{active.description || "Sin descripción complementaria"}</div>
      </div>}
      <fieldset className="record-form-grid" disabled={locked}>
        {isAdmin && <Field className="record-field--wide" label="Título o descripción del asunto" required>
          <textarea
            onChange={(event) => {
              update("title", event.target.value);
              update("description", event.target.value);
            }}
            rows={3}
            value={active.title}
          />
        </Field>}
        <Field error={errors.openDate} label="Inicio / Apertura" required>
          <input
            onChange={(event) => update("openDate", event.target.value)}
            type="date"
            style={isAdmin ? undefined : {maxWidth:205}}
            value={active.openDate}
          />
        </Field>
        <Field
          error={errors.closeDate}
          hint="Puede quedar pendiente si el expediente continúa abierto."
          label="Cierre"
        >
          <input
            min={active.openDate}
            onChange={(event) => update("closeDate", event.target.value)}
            type="date"
            style={isAdmin ? undefined : {maxWidth:205}}
            value={active.closeDate}
          />
        </Field>
        <Field error={errors.filesCount} label="Número de legajos" required>
          <input
            min="1"
            onChange={(event) => update("filesCount", event.target.value)}
            type="number"
            style={isAdmin ? undefined : {maxWidth:155}}
            value={active.filesCount}
          />
        </Field>
        <Field error={errors.foliosCount} label="Número de folios" required>
          <input
            min="1"
            onChange={(event) => update("foliosCount", event.target.value)}
            type="number"
            style={isAdmin ? undefined : {maxWidth:155}}
            value={active.foliosCount}
          />
        </Field>
        <Field label="Soporte documental" required>
          <select
            onChange={(event) => update("supportType", event.target.value)}
            value={active.supportType}
          >
            <option>Físico</option>
            <option>Electrónico</option>
            <option>Mixto</option>
          </select>
        </Field>
        <div className="form-field">
          <span>
            Valor documental<b>*</b>
          </span>
          <div className="document-values">
            {values.map(([value, code]) => (
              <button
                className={active.documentaryValues.includes(value) ? "is-selected" : ""}
                key={value}
                onClick={() =>
                  update(
                    "documentaryValues",
                    active.documentaryValues.includes(value)
                      ? active.documentaryValues.filter((item) => item !== value)
                      : [...active.documentaryValues, value],
                  )
                }
                type="button"
              >
                {active.documentaryValues.includes(value) && <Check size={13} />}
                {value} ({code})
              </button>
            ))}
          </div>
          {errors.documentaryValues && (
            <small className="field-error">{errors.documentaryValues}</small>
          )}
        </div>
        <Field error={errors.currentValidity} label="Años en archivo de trámite" required>
          <input
            min="0"
            onChange={(event) => {
              update("currentValidity", event.target.value);
              const concentration = Number(active.concentrationValidity || 0);
              update(
                "totalValidity",
                event.target.value === "" ? "" : String(Number(event.target.value) + concentration),
              );
            }}
            type="number"
            style={isAdmin ? undefined : {maxWidth:120}}
            value={active.currentValidity}
          />
        </Field>
        <Field
          error={errors.concentrationValidity}
          label="Años en archivo de concentración"
          required
        >
          <input
            min="0"
            onChange={(event) => {
              update("concentrationValidity", event.target.value);
              const current = Number(active.currentValidity || 0);
              update(
                "totalValidity",
                event.target.value === "" ? "" : String(current + Number(event.target.value)),
              );
            }}
            type="number"
            style={isAdmin ? undefined : {maxWidth:120}}
            value={active.concentrationValidity}
          />
        </Field>
        {isAdmin ? <Field hint="Suma coherente de ambos periodos." label="Vigencia documental total">
          <input disabled value={total || active.totalValidity} />
        </Field> : <div className="form-field"><span>Vigencia documental total (calculada)</span><strong>{total || active.totalValidity || "Pendiente"} años</strong></div>}
        {isAdmin && <Field
          className="record-field--wide"
          label="Domicilio y referencia general de resguardo"
        >
          <input
            onChange={(event) => update("archiveAddress", event.target.value)}
            placeholder="Avenida Allende No. 110 Oriente, Colonia Centro, C.P. 63000, Tepic, Nayarit"
            value={active.archiveAddress ?? ""}
          />
        </Field>}
        <Field className="record-field--wide" label="Observaciones del expediente">
          <textarea
            onChange={(event) => update("observations", event.target.value)}
            rows={4}
            value={active.observations}
          />
        </Field>
      </fieldset>
    </>
  );
}

function InventoryForm({
  existing,
  onCancel,
  onSave,
  records,
  role,
  user,
}: {
  existing: ArchivalRecord[];
  onCancel: () => void;
  onSave: (records: ArchivalRecord[]) => void;
  records: ArchivalRecord[];
  role: Role;
  user: UserRecord;
}) {
  const isAdmin = role === "Administrador / Coordinador";
  const editing = existing.length > 0;
  const makeInitial = () => {
    if (editing) return existing.map(item => ({
      ...item,
      recordYear:item.archiveClassificationCode?.match(/\.(\d{4})$/)?.[1] || item.openDate?.slice(0,4) || String(new Date().getFullYear())
    }));
    const base = emptyRecord();
    const inventoryId = `INV-TR-${String(groupInventories(records).length + 1).padStart(3, "0")}`;
    const area = areas.find((item) => item.id === user.areaId);
    const assignedYear=[...new Set(cadidoSeries.filter(x=>x.enabledAreaIds.includes(user.areaId)).map(x=>x.year).filter(Boolean))]
      .sort((a,b)=>Number(b)-Number(a))[0] || String(new Date().getFullYear());
    return [
      {
        ...base,
        id: `DRAFT-${Date.now()}`,
        inventoryId,
        areaId: isAdmin ? "" : user.areaId,
        responsible: isAdmin ? "" : ((area?.manager && area.manager!=="Sin asignar") ? area.manager : ""),
        responsiblePosition: isAdmin ? "" : `Encargado del área de ${area?.name || areaName(user.areaId)}`,
        inventoryDate: localDate(),
        initialSheetNumber:"1",
        fund:"Secretaría de Medio Ambiente y Recursos Naturales",
        administrativeUnit:"Oficina de Representación de SEMARNAT en Nayarit",
        cadidoYear:assignedYear,
        recordYear:String(new Date().getFullYear()),
        recordNumber: "",
        archiveAddress:TRAMITE_ADDRESS,
        room:"",
        archiveZone: isAdmin ? "" : `Archivo de trámite — ${areaName(user.areaId)}`,
        supportType: "Físico",
        createdBy: user.id,
        consecutive: "1",
      },
    ];
  };
  const [drafts, setDrafts] = useState<ArchivalRecord[]>(makeInitial);
  const [activeId, setActiveId] = useState(drafts[0].id);
  const [currentStep, setCurrentStep] = useState(editing ? 1 : 0);
  const [maxVisited, setMaxVisited] = useState(editing ? 1 : 0);
  const [errors, setErrors] = useState<Errors>({});
  const active = drafts.find((item) => item.id === activeId) ?? drafts[0];
  const header = drafts[0];
  const headerLocked = existing.some(
    (item) => item.stage === "Archivo de concentración" || Boolean(item.transferReference),
  );

  const updateAll = <K extends keyof ArchivalRecord>(field: K, value: ArchivalRecord[K]) => {
    const commonFields: (keyof ArchivalRecord)[] = [
      "administrativeUnit",
      "areaId",
      "inventoryDate",
      "responsible",
      "responsiblePosition",
      "fund",
      "cadidoSectionId",
      "cadidoSeriesId",
      "cadidoCode",
      "cadidoYear",
      "initialSheetNumber",
    ];
    setDrafts((current) =>
      current.map((record) =>
        commonFields.includes(field)
          ? {
              ...record,
              [field]: value,
              ...(field === "areaId"
                ? { archiveZone: `Archivo de trámite — ${areaName(String(value))}` }
                : {}),
            }
          : record.id === active.id
            ? { ...record, [field]: value }
            : record,
      ),
    );
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validateHeader = () => {
    const next: Errors = {};
    if (!header.administrativeUnit.trim())
      next.administrativeUnit = "Ingresa la unidad administrativa.";
    if (!header.areaId) next.areaId = "Selecciona el área autorizada.";
    if (!header.inventoryDate) next.inventoryDate = "Captura la fecha de elaboración.";
    if (!header.responsible.trim()) next.responsible = "Captura el responsable.";
    if (!header.responsiblePosition.trim()) next.responsiblePosition = "Captura el cargo.";
    if (!header.fund.trim()) next.fund = "Captura el fondo.";
    if (!header.cadidoSectionId) next.cadidoSectionId = "Selecciona una sección.";
    if (!header.cadidoSeriesId) next.cadidoSeriesId = "Selecciona una serie.";
    setErrors(next);
    return !Object.keys(next).length;
  };
  const rowErrors = (record: ArchivalRecord, step: number) => {
    const next: Errors = {};
    if (record.stage === "Archivo de concentración" || record.transferReference) return next;
    if (step === 1) {
      if (!isAdmin && record.boxNumber && !/^\d{1,6}$/.test(record.boxNumber))
        next.boxNumber = "Captura un número de caja de máximo seis dígitos.";
      if (isAdmin && !record.consecutive.trim()) next.consecutive = "Captura el consecutivo.";
      if (isAdmin && drafts.some((item) => item.id !== record.id && item.consecutive === record.consecutive))
        next.consecutive = "El consecutivo está duplicado.";
      if (!/^REG-\d+$/.test(record.id) && (!record.recordYear || Number(record.recordYear)<1900 || Number(record.recordYear)>2100))
        next.recordYear="Selecciona un año válido (1900–2100).";
      if (!record.recordNumber.trim()) next.recordNumber = "Captura el número de expediente.";
      if (
        records.some(
          (item) =>
            item.id !== record.id &&
            item.recordNumber.toLowerCase() === record.recordNumber.toLowerCase(),
        )
      )
        next.recordNumber = "El número de expediente ya existe.";
      if (!record.title.trim()) next.title = "Captura el asunto.";
    }
    if (step === 2) {
      if (!record.openDate) next.openDate = "Captura la apertura.";
      if (record.closeDate && record.closeDate < record.openDate)
        next.closeDate = "El cierre es anterior a la apertura.";
      if (!record.filesCount || Number(record.filesCount) < 1)
        next.filesCount = "Captura los legajos.";
      if (!record.foliosCount || Number(record.foliosCount) < 1)
        next.foliosCount = "Captura los folios.";
      if (!record.documentaryValues.length)
        next.documentaryValues = "Selecciona al menos un valor.";
      if (record.currentValidity === "") next.currentValidity = "Captura la vigencia.";
      if (record.concentrationValidity === "") next.concentrationValidity = "Captura la vigencia.";
    }
    return next;
  };
  const validateStep = (step: number) => {
    if (step === 0) return validateHeader();
    const invalid = drafts.find((record) => Object.keys(rowErrors(record, step)).length);
    if (!invalid) {
      setErrors({});
      return true;
    }
    setActiveId(invalid.id);
    setErrors(rowErrors(invalid, step));
    return false;
  };
  const next = () => {
    if (!validateStep(currentStep)) return;
    const value = Math.min(3, currentStep + 1);
    setCurrentStep(value);
    setMaxVisited((current) => Math.max(current, value));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const addRow = () => {
    const nextConsecutive = Math.max(0, ...drafts.map((item) => Number(item.consecutive) || 0)) + 1;
    const row: ArchivalRecord = {
      ...emptyRecord(),
      ...Object.fromEntries(
        [
          "inventoryId",
          "administrativeUnit",
          "areaId",
          "inventoryDate",
          "responsible",
          "responsiblePosition",
          "fund",
          "cadidoSectionId",
          "cadidoSeriesId",
          "cadidoCode",
          "cadidoYear",
          "initialSheetNumber",
        ].map((key) => [key, header[key as keyof ArchivalRecord]]),
      ),
      id: `DRAFT-${Date.now()}`,
      consecutive: String(nextConsecutive),
      recordYear:String(new Date().getFullYear()),
      recordNumber: "",
      room:"Sótano",
      archiveAddress:TRAMITE_ADDRESS,
      createdBy: user.id,
      supportType: "Físico",
      archiveZone: `Archivo de trámite — ${areaName(header.areaId)}`,
    } as ArchivalRecord;
    setDrafts((current) => [...current, row]);
    setActiveId(row.id);
  };
  const addRowFromPreview = () => {
    // El encabezado y los expedientes capturados permanecen en memoria.
    // Una fila adicional se crea en el mismo inventario sin guardar ni salir.
    addRow();
    setErrors({});
    setCurrentStep(1);
    setMaxVisited((current) => Math.max(current, 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const removeRow = (id: string) => {
    if (!window.confirm("¿Quitar esta fila no transferida del inventario?")) return;
    setDrafts((current) => current.filter((item) => item.id !== id));
    if (activeId === id) setActiveId(drafts.find((item) => item.id !== id)?.id ?? drafts[0].id);
  };
  const save = () => {
    // Solo el botón explícito de confirmación en la vista previa guarda en MySQL.
    if (currentStep !== 3) return;
    const invalidStep = [0, 1, 2].find((step) => !validateStep(step));
    if (invalidStep !== undefined) {
      setCurrentStep(invalidStep);
      setMaxVisited((current) => Math.max(current, invalidStep));
      return;
    }
    onSave(
      drafts.map((record) => ({
        ...record,
        recordNumber: record.recordNumber.trim(),
        archiveClassificationCode: /^REG-\d+$/.test(record.id) ? (record.archiveClassificationCode||"") : "",
        room: "", shelf: "",level: "",physicalSection: "",position: "",locationBox: "",locationNotes: "",
        archiveAddress: isAdmin ? record.archiveAddress : TRAMITE_ADDRESS,
        initialSheetNumber: isAdmin ? record.initialSheetNumber : "1",
        totalValidity: String(Number(record.currentValidity) + Number(record.concentrationValidity)),
      })),
    );
  };

  return (
    <div className="record-form-page">
      <div className="record-form-top">
        <div>
          <button className="text-button" onClick={onCancel}>
            <ArrowLeft size={17} />
            Volver al listado
          </button>
          <h2>
            {editing
              ? `Editar inventario ${header.inventoryId}`
              : "Registrar inventario documental"}
          </h2>
          <p>Un encabezado común con múltiples expedientes individuales relacionados.</p>
        </div>
        <span className="record-mode">
          {editing ? <FilePenLine size={16} /> : <FilePlus2 size={16} />}
          {editing ? "Edición · inicia en paso 2" : "Nuevo inventario"}
        </span>
      </div>
      <Progress current={currentStep} maxVisited={maxVisited} onStep={setCurrentStep} />
      <div className="surface record-wizard">
        <div className="record-wizard__content">
          {currentStep === 0 && (
            <HeaderStep
              errors={errors}
              form={header}
              isAdmin={isAdmin}
              locked={headerLocked}
              update={updateAll}
            />
          )}
          {currentStep === 1 && (
            <ExpedientsStep
              active={active}
              drafts={drafts}
              errors={errors}
              isAdmin={isAdmin}
              onAdd={addRow}
              onRemove={removeRow}
              onSelect={setActiveId}
              update={updateAll}
            />
          )}
          {currentStep === 2 && (
            <ControlStep
              active={active}
              drafts={drafts}
              errors={errors}
              isAdmin={isAdmin}
              onSelect={setActiveId}
              update={updateAll}
            />
          )}
          {currentStep === 3 && (
            <>
              <StepHeading
                description="Este es el inventario completo tal como aparecerá al pulsar Ver después de registrarlo. Aún no se ha guardado."
                icon={<CheckCircle2 size={21}/>}
                title="Paso 4 · Vista previa del inventario"
              />
              <InventoryDetail
                preview
                inventory={drafts.map(record=>({
                  ...record,
                  archiveClassificationCode: /^REG-\d+$/.test(record.id)
                    ? record.archiveClassificationCode
                    : previewNumber(record.cadidoCode,record.consecutive,record.recordYear || String(new Date().getFullYear())),
                  totalValidity: String(Number(record.currentValidity) + Number(record.concentrationValidity)),
                }))}
                isAdmin={isAdmin}
                canEdit={false}
                onBack={()=>setCurrentStep(2)}
                onEdit={()=>setCurrentStep(2)}
              />
              <div className="inventory-preview-add-row">
                <div>
                  <strong>¿Necesitas registrar otro expediente?</strong>
                  <p>Conservarás todos los datos del inventario y regresarás al paso 2 con una nueva fila lista para capturar.</p>
                </div>
                <Button className="button--secondary" onClick={addRowFromPreview}>
                  <Plus size={17} />
                  Agregar otro expediente
                </Button>
              </div>
              <p className="catalog-note" role="status">Vista previa sin guardar. El número archivístico definitivo lo asigna MySQL al confirmar.</p>
            </>
          )}

          {Object.keys(errors).length > 0 && (
            <div className="validation-summary" role="alert">
              <AlertCircle size={17} />
              Revisa los campos señalados antes de continuar.
            </div>
          )}
        </div>
        <div className="record-wizard__footer">
          <Button className="button--ghost" onClick={onCancel}>
            Salir sin guardar
          </Button>
          <div>
            {currentStep > 0 && (
              <Button
                className="button--secondary"
                onClick={() => setCurrentStep((value) => value - 1)}
              >
                <ChevronLeft size={17} />
                {currentStep === 3 ? "Volver a editar" : "Anterior"}
              </Button>
            )}
            {currentStep < 3 ? (
              <Button className="button--primary" onClick={next}>
                Continuar
                <ArrowRight size={17} />
              </Button>
            ) : (
              <Button className="button--primary" onClick={save}>
                <Check size={17} />
                Confirmar y guardar en MySQL
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InventoryDetail({
  canEdit,
  isAdmin,
  inventory,
  onBack,
  onEdit,
  preview = false,
}: {
  canEdit: boolean;
  isAdmin: boolean;
  inventory: ArchivalRecord[];
  onBack: () => void;
  onEdit: () => void;
  preview?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const header = inventory[0];
  const filteredRows = inventory.filter((record) => {
    const query = search.toLowerCase();
    return (
      !query ||
      String(record.recordNumber || "").toLowerCase().includes(query) ||
      String(record.title || "").toLowerCase().includes(query)
    );
  });
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const rows = filteredRows.slice((page - 1) * pageSize, page * pageSize);
  return (
    <div className="record-detail-page">
      {!preview && <button className="text-button" onClick={onBack}>
        <ArrowLeft size={17} />
        Volver al listado
      </button>}
      <div className="surface inventory-detail-header">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Encabezado del inventario</span>
            <h2>{preview ? "Vista previa · " : ""}{header.inventoryId}</h2>
            <p>
              {areaName(header.areaId)} · {formatDate(header.inventoryDate)}
            </p>
          </div>
          {canEdit && (
            <Button className="button--primary" onClick={onEdit}>
              <Pencil size={16} />
              Editar / agregar expedientes
            </Button>
          )}
        </div>
        <div className="transfer-summary-grid">
          <div>
            <span>Unidad administrativa</span>
            <strong>{header.administrativeUnit}</strong>
          </div>
          <div>
            <span>Área generadora</span>
            <strong>{areaName(header.areaId)}</strong>
          </div>
          <div>
            <span>Responsable</span>
            <strong>{header.responsible}</strong>
          </div>
          <div>
            <span>Cargo</span>
            <strong>{header.responsiblePosition}</strong>
          </div>
          <div>
            <span>Fondo</span>
            <strong>{header.fund}</strong>
          </div>
          <div>
            <span>Sección documental</span>
            <strong>{sectionName(header.cadidoSectionId)}</strong>
          </div>
          <div>
            <span>Serie documental</span>
            <strong>{seriesName(header.cadidoSeriesId)}</strong>
          </div>
          <div>
            <span>Hoja</span>
            <strong>{isAdmin ? `Hoja ${header.initialSheetNumber} de N` : "Hojas numeradas automáticamente al exportar"}</strong>
          </div>
        </div>
      </div>
      <section className="surface records-table-card">
        <div className="records-filter-head">
          <div>
            <h3>Expedientes del inventario</h3>
            <p>{inventory.length} filas relacionadas sin repetir el encabezado</p>
          </div>
          <label className="search-box">
            <Search size={16} />
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar dentro del inventario..."
              value={search}
            />
          </label>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Consecutivo</th>
                <th>Caja</th>
                <th>Número de expediente</th>
                <th>CADIDO</th>
                <th>Asunto</th>
                <th>Apertura / cierre</th>
                <th>Legajos / folios</th>
                <th>Soporte</th>
                <th>Valor documental</th>
                <th>Vigencias T / C / total</th>
                <th>Ubicación</th>
                <th>Observaciones</th>
                <th>Etapa</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((record) => (
                <tr key={record.id}>
                  <td>{record.consecutive}</td>
                  <td>{record.boxNumber}</td>
                  <td>{record.recordNumber}</td>
                  <td>
                    <span className="cadido-code">{record.archiveClassificationCode || record.cadidoCode}</span>
                  </td>
                  <td><strong>{record.title}</strong>{record.description && <div>{record.description}</div>}</td>
                  <td>{formatDate(record.openDate)} / {record.closeDate ? formatDate(record.closeDate) : "Abierto"}</td>
                  <td>{record.filesCount} / {record.foliosCount}</td>
                  <td>{record.supportType}</td>
                  <td>{Array.isArray(record.documentaryValues) ? record.documentaryValues.join(", ") : "—"}</td>
                  <td>{record.currentValidity} / {record.concentrationValidity} / {record.totalValidity} años</td>
                  <td>{(preview || !isAdmin) && record.stage === "Archivo de trámite" ? (record.archiveAddress || TRAMITE_ADDRESS) : locationSummary(record)}</td>
                  <td>{record.observations || "Sin observaciones"}</td>
                  <td>
                    <Badge wine={record.stage === "Archivo de concentración"}>{record.stage}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <span>
            Mostrando {rows.length ? (page - 1) * pageSize + 1 : 0}–
            {Math.min(page * pageSize, filteredRows.length)} de {filteredRows.length}
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
      </section>
    </div>
  );
}

export default function RecordsPanel({
  initialSearch = "",
  loadError,
  onRecordsChange,
  permissions,
  protectedRecordIds,
  records,
  role,
  user,
}: {
  initialSearch?: string;
  loadError?: string;
  onRecordsChange: (records: ArchivalRecord[]) => void;
  permissions: string[];
  protectedRecordIds: Set<string>;
  records: ArchivalRecord[];
  role: Role;
  user: UserRecord;
}) {
  const [view, setView] = useState<View>("list");
  const [selectedId, setSelectedId] = useState("");
  const [message, setMessage] = useState("");
  const isAdmin = role === "Administrador / Coordinador";
  const isAreaManager = role === "Encargado de área";
  const authorized = isAdmin
    ? records
    : records.filter(
        (record) =>
          record.areaId === user.areaId && (isAreaManager || record.createdBy === user.id),
      );
  const selected = authorized.filter((record) => record.inventoryId === selectedId);
  const save = async (rows: ArchivalRecord[]) => {
    try {
      const editing = selected.length > 0;
      const saved = await tramiteApi.save(rows,editing);
      const oldInventory = rows[0].inventoryId;
      onRecordsChange([...saved,...records.filter((record)=>record.inventoryId!==oldInventory)]);
      setSelectedId("");
      setView("list");
      setMessage("El inventario y sus expedientes se guardaron en MySQL.");
      window.setTimeout(()=>setMessage(""),3000);
    } catch(error) {
      window.alert(error instanceof Error ? error.message : "No fue posible guardar el inventario.");
    }
  };
  if (view === "form")
    return (
      <InventoryForm
        existing={selected}
        onCancel={() => {
          setSelectedId("");
          setView("list");
        }}
        onSave={save}
        records={records}
        role={role}
        user={user}
      />
    );
  if (view === "detail" && selected.length)
    return (
      <InventoryDetail
        isAdmin={isAdmin}
        canEdit={
          permissions.includes("edit-records") &&
          selected.every(
            (record) =>
              record.stage === "Archivo de trámite" &&
              !Boolean(record.transferReference) &&
              !protectedRecordIds.has(record.id),
          )
        }
        inventory={selected}
        onBack={() => {
          setSelectedId("");
          setView("list");
        }}
        onEdit={() => setView("form")}
      />
    );
  return (
    <>
      {loadError && <div className="validation-summary" role="alert">
        No fue posible cargar inventarios desde MySQL: {loadError}
      </div>}
      {message && (
        <div className="toast record-toast" role="status">
          <Check size={18} />
          {message}
        </div>
      )}
      <InventoryList
        initialSearch={initialSearch}
        canCreate={!loadError && permissions.includes("register-records")}
        canDelete={role === "Encargado de área" || isAdmin}
        canEdit={permissions.includes("edit-records")}
        onCreate={() => {
          setSelectedId("");
          setView("form");
        }}
        onEdit={(id) => {
          setSelectedId(id);
          setView("form");
        }}
        onDelete={async (id) => {
          if (!window.confirm(`¿Eliminar el inventario ${id} sin movimientos históricos?`)) return;
          try {
            await tramiteApi.remove(id);
            onRecordsChange(records.filter((record) => record.inventoryId !== id));
            setMessage("Inventario eliminado de MySQL.");
          } catch(error) {
            window.alert(error instanceof Error ? error.message : "No fue posible eliminar el inventario.");
          }
        }}
        onOpen={(id) => {
          setSelectedId(id);
          setView("detail");
        }}
        protectedRecordIds={protectedRecordIds}
        records={authorized}
      />
    </>
  );
}
