import "./tramiteSheet.css";
import { ReactNode, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
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
import RowActionsMenu from "./RowActionsMenu";
import TramiteTrash from "./TramiteTrash";
import { useConfirmAction } from "./useConfirmAction";
import {
  ArchivalRecord,
  cadidoSections,
  cadidoSeries,
  emptyRecord,
  locationSummary,
} from "./records";

type View = "list" | "form" | "detail" | "trash";
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
  { label: "Expedientes y revisión", icon: FolderTree },
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
        <span style={{ width: `${(current / (steps.length - 1)) * 100}%` }} />
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
  onTrash,
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
  onTrash: () => void;
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
          <div className="tramite-list-tools">
            {canDelete && <RowActionsMenu label="Acciones de archivo de trámite" actions={[
              {label:"Papelera de reciclaje",icon:<Trash2 size={16}/>,onSelect:onTrash},
            ]}/>}
            <span className="demo-label">Archivos activos</span>
          </div>
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
                <th>Inventario de trámite</th>
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
                        {seriesName(header.cadidoSeriesId) === "Sin asignar" ? "Inventario de trámite" : seriesName(header.cadidoSeriesId)}
                      </button>
                      <span className="block break-words text-xs font-normal text-[#52605a]">{id}</span>
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
                      <RowActionsMenu
                        label={`Acciones del inventario ${id}`}
                        width={190}
                        actions={[
                          { label: "Abrir", icon: <Eye size={16}/>, onSelect: () => onOpen(id) },
                          ...(canEdit && rows.every(
                            (record) =>
                              record.stage === "Archivo de trámite" &&
                              !record.transferReference &&
                              !protectedRecordIds.has(record.id),
                          ) ? [{
                            label: "Editar / agregar",
                            icon: <Pencil size={16}/>,
                            onSelect: () => onEdit(id),
                          }] : []),
                          ...(canDelete && rows.every(
                            (record) =>
                              record.stage === "Archivo de trámite" &&
                              !record.transferReference &&
                              !protectedRecordIds.has(record.id),
                          ) ? [{
                            label: "Eliminar",
                            icon: <Trash2 size={16}/>,
                            onSelect: () => onDelete(id),
                            danger: true,
                          }] : []),
                        ]}
                      />
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

function orderByArchiveYear(records: ArchivalRecord[]) {
  const yearOf = (record: ArchivalRecord) => {
    const year = record.archiveClassificationCode?.match(/\.(\d{4})$/)?.[1] || record.recordYear;
    return year && /^\d{4}$/.test(year) ? Number(year) : Infinity;
  };
  return [...records].sort((a, b) => {
    const aYear = yearOf(a), bYear = yearOf(b);
    return aYear === bYear ? Number(a.consecutive) - Number(b.consecutive) : aYear - bYear;
  });
}

function SpreadsheetHeader({ isAdmin }: { isAdmin: boolean }) {
  const columns = [
    "Consecutivo", "Caja", "Año de la clave *", "Número de expediente *",
    "Clave archivística", "Título o asunto *", "Descripción", "Apertura *",
    "Cierre", "Legajos *", "Folios *", "Soporte documental *",
    "Valor documental *", "Vigencia en Trámite *", "Vigencia en Concentración *",
    "Vigencia total", ...(isAdmin ? ["Domicilio de resguardo"] : []),
    "Observaciones", "Condiciones de acceso", "Tradición documental", "Acción",
  ];
  return (
    <div className="tramite-sheet__header">
      {columns.map(column => <span key={column}>{column}</span>)}
    </div>
  );
}

function valuationFor(record: ArchivalRecord) {
  return cadidoSeries.find(item => item.id === record.cadidoSeriesId) ?? record.catalogValuation;
}

function withCatalogValidity(record: ArchivalRecord): ArchivalRecord {
  const series = valuationFor(record);
  const currentValidity = series?.tramiteYears == null ? record.currentValidity : String(series.tramiteYears);
  const concentrationValidity = series?.concentrationYears == null ? record.concentrationValidity : String(series.concentrationYears);
  return {
    ...record,
    documentaryValues: series?.documentaryValues ?? record.documentaryValues,
    currentValidity,
    concentrationValidity,
    totalValidity: currentValidity !== "" && concentrationValidity !== ""
      ? String(Number(currentValidity) + Number(concentrationValidity)) : "",
  };
}

const fullReference = (record: ArchivalRecord) => record.recordNumber.trim();

function SpreadsheetRow({ active, errors, isAdmin, automaticOrder, update, remove }: {
  active: ArchivalRecord;
  errors: Errors;
  isAdmin: boolean;
  update: <K extends keyof ArchivalRecord>(field: K, value: ArchivalRecord[K]) => void;
  automaticOrder: boolean;
  remove?: () => void;
}) {
  const concentrationData = active.concentrationData ?? { access: "", tradition: "", m: "", n: "", p: "" };
  const selectedSeries = valuationFor(active);
  const fixedValues = selectedSeries?.documentaryValues;
  const values = fixedValues
    ? [["Administrativo", "A"], ["Legal", "L"], ["Fiscal/Contable", "F/C"]].filter(([value]) => fixedValues.includes(value))
    : [["Administrativo", "A"], ["Legal", "L"], ["Fiscal", "F"], ["Contable", "C"]];
  const protectedRow = active.stage === "Archivo de concentración" || Boolean(active.transferReference);
  const locked = protectedRow;
  const catalogValidity = withCatalogValidity(active);
  const total = catalogValidity.currentValidity !== "" && catalogValidity.concentrationValidity !== ""
    ? String(Number(catalogValidity.currentValidity) + Number(catalogValidity.concentrationValidity)) : "";
  return (
    <div className="tramite-sheet__row" id={active.id} role="group" aria-label={`Expediente ${active.consecutive}`}>
      <fieldset disabled={protectedRow}>
        {isAdmin && !automaticOrder && <Field className="tramite-cell--short" error={errors.consecutive} label="Consecutivo del renglón" required>
          <input
            inputMode="numeric"
            onChange={(event) => update("consecutive", event.target.value)}
            value={active.consecutive}
          />
        </Field>}
        {(!isAdmin || automaticOrder) && <div className="form-field tramite-cell--short"><span>Consecutivo del renglón</span><strong>{active.consecutive}</strong></div>}
        <Field className="tramite-cell--short" label="Número de caja">
          <input inputMode="numeric" maxLength={isAdmin ? undefined : 6} pattern={isAdmin ? undefined : "[0-9]{1,6}"} placeholder="Ej. 12"
            onChange={(event) => {
              update("boxNumber", event.target.value);
              if (!active.locationBox) update("locationBox", event.target.value);
            }}
            value={active.boxNumber}
          />
        </Field>
        <Field className="tramite-cell--short" error={errors.recordYear} label="Año del código archivístico" required>
          <input type="number" min="1900" max="2100"
            value={active.recordYear ?? ""}
            disabled={/^REG-\d+$/.test(active.id)}
            onChange={event=>{
              const year=event.target.value;
              update("recordYear",year);
            }} />
        </Field>
        <Field error={errors.recordNumber} label="Número de expediente" required>
          <input maxLength={110} value={active.recordNumber}
            onChange={(event) => update("recordNumber", event.target.value)} />
        </Field>
        <Field className="record-field--wide" label="Código de clasificación archivística">
          <div className="read-only-code"><ShieldCheck size={12}/><strong title={active.archiveClassificationCode || previewNumber(active.cadidoCode,active.consecutive,active.recordYear || String(new Date().getFullYear()))}>
            {/^REG-\d+$/.test(active.id) ?
              (active.archiveClassificationCode || "Clasificación histórica pendiente de revisión") :
              previewNumber(active.cadidoCode,active.consecutive,active.recordYear || String(new Date().getFullYear()))}
          </strong></div>
        </Field>

        <Field className="record-field--wide" error={errors.title} label="Título o asunto" required>
          <textarea rows={1} onChange={(event) => update("title", event.target.value)} value={active.title} />
        </Field>
        <Field className="record-field--wide" error={errors.description} label="Descripción del asunto" required>
          <textarea rows={1} onChange={event=>update("description",event.target.value)} value={active.description}/>
        </Field>
      </fieldset>
      <fieldset disabled={locked}>
        
        <Field error={errors.openDate} label="Inicio / Apertura" required>
          <input
            onChange={(event) => update("openDate", event.target.value)}
            type="date"
            value={active.openDate}
          />
        </Field>
        <Field
          error={errors.closeDate}
          label="Fecha de cierre"
          
        >
          <input
            min={active.openDate}
            onChange={(event) => update("closeDate", event.target.value)}
            type="date"
            value={active.closeDate}
          />
        </Field>
        <Field className="tramite-cell--short" error={errors.filesCount} label="Número de legajos" required>
          <input
            min="1"
            onChange={(event) => update("filesCount", event.target.value)}
            type="number"
            value={active.filesCount}
          />
        </Field>
        <Field className="tramite-cell--short" error={errors.foliosCount} label="Número de folios" required>
          <input
            min="1"
            onChange={(event) => update("foliosCount", event.target.value)}
            type="number"
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
        <div className="form-field tramite-cell--values">
          <span>
            Valor documental<b>*</b>
          </span>
          <div className="document-values">
            {values.map(([value, code]) => (
              <button
                className={catalogValidity.documentaryValues.includes(value) ? "is-selected" : ""}
                key={value}
                disabled={Boolean(fixedValues)}
                title={value} aria-label={value} aria-pressed={catalogValidity.documentaryValues.includes(value)}
                onClick={() =>
                  update(
                    "documentaryValues",
                    catalogValidity.documentaryValues.includes(value)
                      ? active.documentaryValues.filter((item) => item !== value)
                      : [...active.documentaryValues, value],
                  )
                }
                type="button"
              >
                {catalogValidity.documentaryValues.includes(value) && <Check size={13} />}
                {code}
              </button>
            ))}
          </div>
          {errors.documentaryValues && (
            <small className="field-error">{errors.documentaryValues}</small>
          )}
        </div>
        <Field className="tramite-cell--short" error={errors.currentValidity} label="Años en archivo de trámite" required>
          {selectedSeries?.tramiteYears != null ? (
            <strong className="tramite-sheet__validity">{catalogValidity.currentValidity} {catalogValidity.currentValidity === "1" ? "año" : "años"}</strong>
          ) : (
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
              value={catalogValidity.currentValidity}
            />
          )}
        </Field>
        <Field
          className="tramite-cell--short"
          error={errors.concentrationValidity}
          label="Años en archivo de concentración"
          required
        >
          {selectedSeries?.concentrationYears != null ? (
            <strong className="tramite-sheet__validity">{catalogValidity.concentrationValidity} {catalogValidity.concentrationValidity === "1" ? "año" : "años"}</strong>
          ) : (
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
              value={catalogValidity.concentrationValidity}
            />
          )}
        </Field>
        {isAdmin ? <Field label="Vigencia documental total">
          <input disabled value={total || active.totalValidity} />
        </Field> : <div className="form-field"><span>Vigencia documental total (calculada)</span><strong className="tramite-sheet__validity">{total || active.totalValidity || "Pendiente"} años</strong></div>}
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
            rows={1}
            value={active.observations}
          />
        </Field>
        <Field label="Condiciones de acceso">
          <select value={concentrationData.access}
            onChange={(event) => update("concentrationData", { ...concentrationData, access: event.target.value })}>
            <option value="">Pendiente</option>
            <option value="P">P · Pública</option>
            <option value="C">C · Confidencial</option>
            <option value="R">R · Reservada</option>
          </select>
        </Field>
        <Field label="Tradición documental">
          <select value={concentrationData.tradition}
            onChange={(event) => update("concentrationData", { ...concentrationData, tradition: event.target.value })}>
            <option value="">Pendiente</option>
            <option value="ORIGINAL">Original</option>
            <option value="COPIA">Copia</option>
            <option value="AMBAS">Original y copia</option>
          </select>
        </Field>
      </fieldset>
      {remove && !locked && <Button className="button--secondary" onClick={remove}>Eliminar fila</Button>}
    </div>
  );
}

function InventoryForm({
  existing,
  onCancel,
  onDeleteInventory,
  onDeleteRecords,
  onSave,
  records,
  role,
  user,
}: {
  existing: ArchivalRecord[];
  onCancel: () => void;
  onDeleteInventory: (folio: string) => Promise<void>;
  onDeleteRecords: (folio: string, ids: string[]) => Promise<boolean>;
  onSave: (records: ArchivalRecord[]) => void;
  records: ArchivalRecord[];
  role: Role;
  user: UserRecord;
}) {
  const isAdmin = role === "Administrador / Coordinador";
  const canDeleteExisting = isAdmin || role === "Encargado de área" ||
    (existing.length > 0 && existing.every(record => record.createdBy === user.id));
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
        id: `DRAFT-${Date.now().toString(36) + Math.random().toString(36).slice(2)}`,
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
  const [previewOpen, setPreviewOpen] = useState(false);
  const [maxVisited, setMaxVisited] = useState(editing ? 1 : 0);
  const [errors, setErrors] = useState<Errors>({});
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const { confirm, dialog } = useConfirmAction();
  useEffect(() => {
    if (!actionMessage) return;
    const timer=window.setTimeout(()=>setActionMessage(""),4000);
    return ()=>window.clearTimeout(timer);
  }, [actionMessage]);
  const active = drafts.find((item) => item.id === activeId) ?? drafts[0];
  const header = drafts[0];
  const headerLocked = existing.some(
    (item) => item.stage === "Archivo de concentración" || Boolean(item.transferReference),
  );

  const updateAll = <K extends keyof ArchivalRecord>(field: K, value: ArchivalRecord[K], id = active.id) => {
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
          : record.id === id
            ? { ...record, [field]: value }
            : record,
      ),
    );
    if (id === active.id || currentStep === 0) setErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
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
  const rowErrors = (draft: ArchivalRecord, step: number) => {
    const record = withCatalogValidity(draft);
    const next: Errors = {};
    if (record.stage === "Archivo de concentración" || record.transferReference) return next;
    if (step === 1) {
      if (!isAdmin && record.boxNumber && !/^\d{1,6}$/.test(record.boxNumber))
        next.boxNumber = "Captura un número de caja de máximo seis dígitos.";
      if (isAdmin && !record.consecutive.trim()) next.consecutive = "Captura el consecutivo.";
      if (isAdmin && drafts.some((item) => item.id !== record.id && item.consecutive === record.consecutive))
        next.consecutive = "El consecutivo está duplicado.";
      if (!/^REG-\d+$/.test(record.id) && (!/^\d{4}$/.test(record.recordYear ?? "") || Number(record.recordYear)<1900 || Number(record.recordYear)>2100))
        next.recordYear="Selecciona un año válido (1900–2100).";
      if (!record.recordNumber.trim()) next.recordNumber = "Captura el número de expediente.";
      if (
        [...records, ...drafts].some(
          (item) =>
            item.id !== record.id &&
            fullReference(item).toUpperCase() === fullReference(record).toUpperCase(),
        )
      )
        next.recordNumber = "El número de expediente ya existe.";
      if (!record.title.trim()) next.title = "Captura el asunto.";
      else if (/^(?:generalidades|varios|diversos|documentaci[oó]n)[.!?]*$/i.test(record.title.trim()))
        next.title = "Captura un asunto específico.";
      if (!record.description.trim()) next.description = "Captura una descripción breve del asunto.";
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
    const issues = rowErrors(invalid, step);
    setErrors(issues);
    requestAnimationFrame(() => {
      const row = document.getElementById(invalid.id);
      row?.querySelector<HTMLElement>(".has-error input, .has-error select, .has-error textarea, .document-values button")?.focus();
    });
    return false;
  };
  const next = () => {
    if (!validateStep(currentStep)) return;
    const value = Math.min(1, currentStep + 1);
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
          "catalogValuation",
          "initialSheetNumber",
        ].map((key) => [key, header[key as keyof ArchivalRecord]]),
      ),
      id: `DRAFT-${Date.now()}-${Math.random().toString(36).slice(2)}`,
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
    setErrors({});
    requestAnimationFrame(() => document.getElementById(row.id)?.scrollIntoView({ block: "nearest", inline: "start", behavior: "smooth" }));
  };
  const removePreviewRows = async (ids: string[]) => {
    const selected = drafts.filter(item => ids.includes(item.id));
    if (!selected.length) return;
    const all = selected.length === drafts.length;
    const confirmed = await confirm({
      title: all ? "Eliminar archivo de trámite completo" : "Eliminar expediente",
      message: all
        ? "Has seleccionado el último expediente del archivo. Se moverá también el inventario completo a la papelera por 60 días. ¿Deseas continuar?"
        : "¿Eliminar " + selected.length + " expediente(s)? Los registros guardados pasarán a la papelera durante 60 días.",
      confirmText: all ? "Mover inventario a papelera" : "Eliminar expediente(s)",
      danger: true,
    });
    if (!confirmed) return;
    setActionError("");
    try {
      const persisted=selected.filter(item=>/^REG-\d+$/.test(item.id)).map(item=>item.id);
      if (!persisted.length && all) {
        onCancel();
        return;
      }
      if (persisted.length && editing) {
        const inventoryGone=await onDeleteRecords(header.inventoryId,persisted);
        if (inventoryGone) return;
      }
      const removeIds = new Set(ids);
      const next = drafts.filter(item => !removeIds.has(item.id));
      if (!next.length) { onCancel(); return; }
      setDrafts(editing ? next : next.map((item, index) => ({ ...item, consecutive: String(index + 1) })));
      if (removeIds.has(activeId))setActiveId(next[0].id);
      setActionMessage("Expediente(s) eliminado(s) correctamente.");
    } catch(error) {
      setActionError(error instanceof Error?error.message:"No fue posible eliminar el expediente.");
    }
  };
  const removeRow = (id: string) => { void removePreviewRows([id]); };
  const save = () => {
    if (currentStep !== 1) return;
    const invalidStep = [0, 1, 2].find((step) => !validateStep(step));
    if (invalidStep !== undefined) {
      setCurrentStep(invalidStep === 0 ? 0 : 1);
      return;
    }
    onSave(
      (editing ? drafts : orderByArchiveYear(drafts)).map((draft, index) => { const record = withCatalogValidity(draft); return ({
        ...record,
        consecutive: editing ? record.consecutive : String(index + 1),
        recordNumber: fullReference(record),
        archiveClassificationCode: /^REG-\d+$/.test(record.id) ? (record.archiveClassificationCode||"") : "",
        room: "", shelf: "",level: "",physicalSection: "",position: "",locationBox: "",locationNotes: "",
        archiveAddress: isAdmin ? record.archiveAddress : TRAMITE_ADDRESS,
        initialSheetNumber: isAdmin ? record.initialSheetNumber : "1",
        totalValidity: String(Number(record.currentValidity) + Number(record.concentrationValidity)),
      }); }),
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
            <>
              <StepHeading title="Expedientes y revisión" icon={<FolderTree size={21} />}
                description="Completa un expediente por fila. Desplázate hacia la derecha para ver los campos de control documental." />
              <div className="tramite-sheet-scroll" role="region" aria-label="Captura de expedientes" tabIndex={0}>
                <div className={isAdmin ? "tramite-sheet tramite-sheet--admin" : "tramite-sheet"}>
                  <SpreadsheetHeader isAdmin={isAdmin} />
                  {drafts.map(record => (
                    <SpreadsheetRow key={record.id} active={record} isAdmin={isAdmin} automaticOrder={!editing}
                      errors={record.id === activeId ? errors : {}}
                      update={(field, value) => updateAll(field, value, record.id)}
                      remove={!editing || canDeleteExisting ? () => removeRow(record.id) : undefined} />
                  ))}
                </div>
              </div>
              <div className="tramite-sheet__actions">
                <Button className="button--secondary" onClick={addRow}><Plus size={17} />Agregar otro expediente</Button>
                <Button className="button--secondary" onClick={() => setPreviewOpen(open => !open)}>
                  {previewOpen ? "Ocultar vista previa" : "Ver vista previa"}
                </Button>
              </div>
              {previewOpen && (
                <section aria-label="Vista previa del inventario">
              <InventoryDetail
                preview
                inventory={orderByArchiveYear(drafts).map(withCatalogValidity).map((record, index)=>({
                  ...record,
                  recordNumber: record.recordNumber.trim() ? fullReference(record) : "",
                  consecutive: String(index + 1),
                  archiveClassificationCode: /^REG-\d+$/.test(record.id)
                    ? record.archiveClassificationCode
                    : previewNumber(record.cadidoCode,record.consecutive,record.recordYear || String(new Date().getFullYear())),
                  totalValidity: String(Number(record.currentValidity) + Number(record.concentrationValidity)),
                }))}
                isAdmin={isAdmin}
                canEdit={false}
                onBack={()=>setPreviewOpen(false)}
                onEdit={()=>setPreviewOpen(false)}
                allowDelete={!editing || canDeleteExisting}
                onDeletePreviewRows={removePreviewRows}
                onDeleteWhole={() => {
                  void (async()=>{
                    const approved=await confirm({
                      title:"Eliminar archivo de trámite completo",
                      message:editing
                        ? "Se enviará este archivo completo a la papelera durante 60 días. ¿Confirmas?"
                        : "Se descartarán todos los expedientes del borrador sin guardar. ¿Confirmas?",
                      confirmText:"Eliminar archivo de trámite",danger:true,
                    });
                    if(!approved)return;
                    if(editing) {
                      try{await onDeleteInventory(header.inventoryId);}
                      catch(error){setActionError(error instanceof Error?error.message:"No se pudo eliminar el archivo.");}
                    }else onCancel();
                  })();
                }}
              />
                </section>
              )}
            </>
          )}

          {actionError && <div className="validation-summary" role="alert"><AlertCircle size={17}/>{actionError}</div>}
          {actionMessage && <div className="toast record-toast" role="status"><Check size={17}/>{actionMessage}</div>}
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
                Anterior
              </Button>
            )}
            {currentStep === 0 ? (
              <Button className="button--primary" onClick={next}>
                Continuar
                <ArrowRight size={17} />
              </Button>
            ) : (
              <Button className="button--primary" onClick={save}>
                <Check size={17} />
                Guardar inventario
              </Button>
            )}
          </div>
        </div>
      </div>
      {dialog}
    </div>
  );
}

function InventoryDetail({
  canEdit,
  isAdmin,
  inventory,
  onBack,
  onEdit,
  onDeleteWhole,
  onDeletePreviewRows,
  allowDelete = false,
  preview = false,
}: {
  canEdit: boolean;
  isAdmin: boolean;
  inventory: ArchivalRecord[];
  onBack: () => void;
  onEdit: () => void;
  onDeleteWhole?: () => void;
  onDeletePreviewRows?: (ids: string[]) => void;
  allowDelete?: boolean;
  preview?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  useEffect(() => {
    if (!selectedRows.length) return;
    const liveIds=new Set(inventory.map(item=>item.id));
    if (selectedRows.every(id=>!liveIds.has(id))) {
      setSelectedRows([]);
      setSelectionMode(false);
    }
  }, [inventory, selectedRows]);
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
            <h2>{preview ? "Vista previa · " : ""}Inventario de trámite{seriesName(header.cadidoSeriesId) !== "Sin asignar" && ` · ${seriesName(header.cadidoSeriesId)}`}</h2>
            {header.inventoryId && <span className="block break-words text-xs font-normal text-[#52605a]">Folio {header.inventoryId}</span>}
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
          <div className="tramite-preview-tools">
            {preview && allowDelete && <RowActionsMenu label="Acciones de la vista previa" width={250} actions={[
              {label:"Eliminar expediente",icon:<Trash2 size={16}/>,onSelect:()=>{
                setSelectionMode(true);
                setSelectedRows([]);
              }},
              {label:"Eliminar archivo de trámite completo",icon:<Trash2 size={16}/>,danger:true,
                onSelect:()=>onDeleteWhole?.()},
            ]}/>}
          <label className="search-box">
            <Search size={16} />
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar dentro del inventario..."
              value={search}
            />
          </label>
          </div>
        </div>
        {preview && selectionMode && <div className="tramite-preview-selection">
          <span>{selectedRows.length} expediente(s) seleccionados. Las bajas guardadas se harán efectivas al confirmar y guardar.</span>
          <div>
            <button type="button" className="button button--secondary"
              onClick={()=>{setSelectionMode(false);setSelectedRows([]);}}>Cancelar</button>
            <button type="button" className="button button--secondary danger-text" disabled={!selectedRows.length}
              onClick={()=>{
                void onDeletePreviewRows?.(selectedRows);
              }}><Trash2 size={15}/> Eliminar seleccionados</button>
          </div>
        </div>}
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                {preview && selectionMode && <th>
                  <input type="checkbox" aria-label="Seleccionar todos los expedientes de esta página"
                    checked={rows.length > 0 && rows.every(r=>selectedRows.includes(r.id))}
                    onChange={e=>setSelectedRows(e.target.checked
                      ? [...new Set([...selectedRows,...rows.map(r=>r.id)])]
                      : selectedRows.filter(id=>!rows.some(r=>r.id===id)))} />
                </th>}
                <th>Consecutivo del renglón</th>
                <th>Caja</th>
                <th>Asunto e identificación</th>
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
                  {preview && selectionMode && <td>
                    <input type="checkbox" aria-label={`Seleccionar expediente ${record.recordNumber}`}
                      checked={selectedRows.includes(record.id)}
                      onChange={e=>setSelectedRows(current=>e.target.checked
                        ? [...current,record.id]:current.filter(id=>id!==record.id))} />
                  </td>}
                  <td>{record.consecutive}</td>
                  <td>{record.boxNumber}</td>
                  <td><strong>{record.title}</strong>
                    {record.archiveClassificationCode && <span className="block break-words text-xs font-normal text-[#52605a]">{record.archiveClassificationCode}</span>}
                    {record.recordNumber && record.recordNumber !== record.archiveClassificationCode && <span className="block break-words text-xs font-normal text-[#52605a]">Núm. de expediente {record.recordNumber}</span>}
                    {record.description && <div>{record.description}</div>}
                  </td>
                  <td>{formatDate(record.openDate)} / {record.closeDate ? formatDate(record.closeDate) : "Abierto"}</td>
                  <td>{record.filesCount} / {record.foliosCount}</td>
                  <td>{record.supportType}</td>
                  <td>{Array.isArray(record.documentaryValues) ? record.documentaryValues.join(", ") : "—"}</td>
                  <td>{record.currentValidity} / {record.concentrationValidity} / {record.totalValidity} años{!preview && record.tramiteDueDate && <div>Cumple AT: {formatDate(record.tramiteDueDate)}</div>}</td>
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
  const [actionError, setActionError] = useState("");
  const { confirm, dialog } = useConfirmAction();
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 4000);
    return () => window.clearTimeout(timer);
  }, [message]);
  const isAdmin = role === "Administrador / Coordinador";
  const isAreaManager = role === "Encargado de área";
  const authorized = isAdmin
    ? records
    : records.filter(
        (record) =>
          record.areaId === user.areaId && (isAreaManager || record.createdBy === user.id),
      );
  const selected = authorized.filter((record) => record.inventoryId === selectedId);
  const deleteInventory = async (id: string) => {
    await tramiteApi.remove(id);
    onRecordsChange(records.filter(record => record.inventoryId !== id));
    setSelectedId("");
    setView("list");
    setMessage("Archivo de trámite movido a la papelera por 60 días.");
  };
  const deleteRecords = async (folio: string, ids: string[]) => {
    const response = await tramiteApi.removeRecords(folio,ids);
    const removed = new Set(ids);
    onRecordsChange(records.filter(record =>
      response.inventoryDeleted ? record.inventoryId !== folio : !removed.has(record.id)));
    if(response.inventoryDeleted){
      setSelectedId("");
      setView("list");
      setMessage("Último expediente eliminado. Archivo de trámite enviado a la papelera por 60 días.");
    }
    return response.inventoryDeleted;
  };
  const refreshTrash = async () => {
    const fresh=await tramiteApi.list();
    onRecordsChange([
      ...records.filter(record => record.stage === "Archivo de concentración"),
      ...fresh,
    ]);
  };
  const save = async (rows: ArchivalRecord[]) => {
    try {
      const editing = selected.length > 0;
      const saved = await tramiteApi.save(rows,editing);
      const oldInventory = rows[0].inventoryId;
      onRecordsChange([...saved,...records.filter((record)=>record.inventoryId!==oldInventory)]);
      setSelectedId("");
      setView("list");
      setMessage("Inventario guardado correctamente.");
    } catch(error) {
      setActionError(error instanceof Error ? error.message : "No fue posible guardar el inventario.");
    }
  };
  if (view === "trash") {
    return <TramiteTrash onBack={() => setView("list")} onChange={refreshTrash}/>;
  }
  if (view === "form")
    return (
      <InventoryForm
        existing={selected}
        onCancel={() => {
          setSelectedId("");
          setView("list");
        }}
        onDeleteInventory={deleteInventory}
        onDeleteRecords={deleteRecords}
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
      {actionError && <div className="validation-summary" role="alert">{actionError}</div>}
      {loadError && <div className="validation-summary" role="alert">
        No fue posible cargar los inventarios: {loadError}
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
        canDelete={!loadError && (role === "Personal de área" || role === "Encargado de área" || isAdmin)}
        canEdit={permissions.includes("edit-records")}
        onCreate={() => {
          setSelectedId("");
          setView("form");
        }}
        onEdit={(id) => {
          setSelectedId(id);
          setView("form");
        }}
        onDelete={(id) => {
          void (async()=>{
            const ok=await confirm({
              title:"Mover archivo de trámite a papelera",
              message:`¿Eliminar el inventario ${id} y todos sus expedientes? Podrás restaurarlo durante 60 días.`,
              danger:true,confirmText:"Mover a papelera",
            });
            if(!ok)return;
            try{await deleteInventory(id);setActionError("");}
            catch(error){setActionError(error instanceof Error?error.message:"No se pudo eliminar el inventario.");}
          })();
        }}
        onTrash={() => setView("trash")}
        onOpen={(id) => {
          setSelectedId(id);
          setView("detail");
        }}
        protectedRecordIds={protectedRecordIds}
        records={authorized}
      />
      {dialog}
    </>
  );
}
