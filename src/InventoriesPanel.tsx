import { ReactNode, useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Files,
  FolderArchive,
  ShieldCheck,
  Search,
  X,
} from "lucide-react";
import type { Role, UserRecord } from "./data";
import type { ArchivalRecord } from "./records";
import { inventoriesApi, type SeriesInventoryFilters, type SeriesInventoryHeader, type SeriesInventoryOptions, type SeriesInventoryType } from "./api";
import { homeToday } from "./homePending";
import PrimaryTransferBuilder from "./PrimaryTransferBuilder";

type InventoryType = "tramite" | "concentracion" | "transferencia";

const types = {
  tramite: {
    name: "Inventario de archivo de trámite",
    description: "Inventarios y expedientes activos bajo resguardo de las áreas generadoras.",
    icon: Files,
    accent: "green",
  },
  concentracion: {
    name: "Inventario de archivo de concentración",
    description: "Agrupaciones con expedientes transferidos administrativamente.",
    icon: Archive,
    accent: "wine",
  },
  transferencia: {
    name: "Concentrado documental",
    description: "Selecciona expedientes individuales por sección y serie documental.",
    icon: FolderArchive,
    accent: "gold",
  },
} as const;

const formatDate = (value: string) =>
  value ? new Date(`${value}T12:00:00`).toLocaleDateString("es-MX") : "Pendiente";

function Button({
  children,
  className = "",
  disabled,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button className={`button ${className}`} disabled={disabled} onClick={onClick} type="button">
      {children}
    </button>
  );
}

function TypeSelection({ onSelect, role }: { onSelect: (type: InventoryType) => void; role: Role }) {
  const choices = role === "Encargado de préstamos / Control archivístico" ? ["concentracion"] as const
    : Object.keys(types) as InventoryType[];
  return (
    <>
      <div className="records-page-heading inventory-page-heading">
        <div>
          <h2>Inventarios documentales</h2>
          <p>Consulta y exporta encabezados y expedientes sin modificar los registros.</p>
        </div>
        <span className="access-chip">
          <FileSpreadsheet size={15} />
          Exportación documental
        </span>
      </div>
      <div className="inventory-type-grid">
        {choices.map((type) => {
          const item = types[type];
          const Icon = item.icon;
          return (
            <article className="surface inventory-type-card" key={type}>
              <span
                className={`inventory-type-card__icon inventory-type-card__icon--${item.accent}`}
              >
                <Icon size={22} />
              </span>
              <div>
                <h3>{item.name}</h3>
                <p>{item.description}</p>
              </div>
              <Button className="button--secondary" onClick={() => onSelect(type)}>
                Consultar inventarios <ArrowRight size={16} />
              </Button>
            </article>
          );
        })}
      </div>

    </>
  );
}

type InventoryGroup = {
  header: SeriesInventoryHeader;
  records: ArchivalRecord[];
  filters: SeriesInventoryFilters;
};

const openingPeriods = [
  { value: "1d", label: "Último día", days: 1 },
  { value: "3d", label: "Últimos 3 días", days: 3 },
  { value: "7d", label: "Última semana", days: 7 },
  { value: "15d", label: "Últimos 15 días", days: 15 },
  { value: "1m", label: "Último mes", months: 1 },
  { value: "3m", label: "Últimos tres meses", months: 3 },
  { value: "6m", label: "Últimos seis meses", months: 6 },
  { value: "12m", label: "Último año", months: 12 },
] as const;

const emptyFilters: SeriesInventoryFilters = { section: "", series: "", from: "", to: "", areas: [], users: [], includePhysicalLocation: false };

const normalizeFilterText = (value: string) =>
  value.toLocaleLowerCase("es").normalize("NFD").replace(/\p{M}/gu, "");

function MultiFilter({ label, options, selected, onChange }: {
  label: "Áreas" | "Usuarios"; options: { id: string; name: string }[]; selected: string[]; onChange: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const noun = label === "Áreas" ? "áreas" : "usuarios";
  const allLabel = label === "Áreas" ? "Todas las áreas" : "Todos los usuarios";
  const byId = useMemo(() => new Map(options.map(option => [option.id, option])), [options]);
  const matches = useMemo(() => {
    const terms = normalizeFilterText(search).trim().split(/\s+/).filter(Boolean);
    return terms.length ? options.filter(option => {
      const text = normalizeFilterText(option.name + " " + option.id);
      return terms.every(term => text.includes(term));
    }) : options;
  }, [options, search]);
  const checked = new Set(selected);
  const pageSize = 25;
  const pages = Math.max(1, Math.ceil(matches.length / pageSize));
  const currentPage = Math.min(page, pages - 1);
  const remove = (id: string) => onChange(selected.filter(value => value !== id));

  return (
    <fieldset className="min-w-0 rounded-lg border border-[#b4c4bb] bg-[#f8f8f3] p-3">
      <legend className="px-1 text-sm font-semibold">{label}</legend>
      <details className="rounded-md border border-[#b4c4bb] bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
          Elegir {noun}<ChevronDown size={16} aria-hidden="true" />
        </summary>
        <div className="grid gap-2 border-t border-[#dbe5df] p-2">
          <label className="search-box min-w-0">
            <Search size={16} aria-hidden="true" />
            <input type="search" aria-label={`Buscar ${noun}`} placeholder={`Buscar ${noun} por nombre…`}
              value={search} onChange={event => { setSearch(event.target.value); setPage(0); }}
              onKeyDown={event => { if (event.key === "Enter") event.preventDefault(); }} />
          </label>
          <div className="grid max-h-40 gap-1 overflow-auto">
            {matches.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map(option => (
              <label key={option.id} className="flex cursor-pointer items-start gap-2 rounded px-2 py-1 text-sm hover:bg-[#edf3ee]">
                <input type="checkbox" className="mt-0.5 shrink-0 accent-[#205b4d]" checked={checked.has(option.id)}
                  onChange={event => event.target.checked ? onChange([...selected, option.id]) : remove(option.id)} />
                <span className="break-words">{option.name}</span>
              </label>
            ))}
            {!matches.length && <p className="px-2 text-sm text-[#526760]">No se encontraron {noun}.</p>}
          </div>
          {pages > 1 && <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
            <button type="button" className="text-button" disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}>Anterior</button>
            <span>Página {currentPage + 1} de {pages}</span>
            <button type="button" className="text-button" disabled={currentPage + 1 === pages}
              onClick={() => setPage(currentPage + 1)}>Siguiente</button>
          </div>}
        </div>
      </details>
      {selected.length ? (
        <ul className="mt-2 flex flex-wrap gap-2" aria-label={`Selección de ${noun}`}>
          {selected.map(id => {
            const name = byId.get(id)?.name ?? id;
            return <li key={id} className="flex max-w-full items-center gap-1 rounded-md bg-[#e5efe8] px-2 py-1 text-xs text-[#21433a]">
              <span className="min-w-0 break-words">{name}</span>
              <button type="button" className="shrink-0 rounded p-1 hover:bg-[#ccdfd5]" aria-label={`Quitar ${name}`} onClick={() => remove(id)}>
                <X size={14} aria-hidden="true" />
              </button>
            </li>;
          })}
        </ul>
      ) : <p className="mt-2 text-xs text-[#526760]">{allLabel}</p>}
    </fieldset>
  );
}

function SeriesInventory({ type, role, onBack }: { type: SeriesInventoryType; role: Role; onBack: () => void }) {
  const [options, setOptions] = useState<SeriesInventoryOptions>();
  const [filters, setFilters] = useState(emptyFilters);
  const [filterReset, setFilterReset] = useState(0);
  const [period, setPeriod] = useState("");
  const [group, setGroup] = useState<InventoryGroup>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    inventoriesApi.seriesOptions(type).then(data => { if (active) setOptions(data); })
      .catch(cause => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, [type]);

  const sections = new Map(options?.series.map(item => [item.section, item.sectionName]));
  const series = options?.series.filter(item => item.section === filters.section) ?? [];
  const userOptions = (areaIds: string[]) => [...new Map(options?.users
    .filter(user => !areaIds.length || areaIds.includes(user.areaId))
    .map(user => [user.id, user])).values()];
  const updateAreas = (areaIds: string[]) => {
    const allowed = new Set(userOptions(areaIds).map(user => user.id));
    setFilters(current => ({ ...current, areas: areaIds, users: current.users.filter(id => allowed.has(id)) }));
  };

  const changePeriod = (value: string) => {
    setPeriod(value);
    if (value === "custom") return;
    const preset = openingPeriods.find(item => item.value === value);
    if (!preset) {
      setFilters(current => ({ ...current, from: "", to: "" }));
      return;
    }
    const to = homeToday();
    const start = new Date(`${to}T00:00:00Z`);
    if ("days" in preset) start.setUTCDate(start.getUTCDate() - (preset.days - 1));
    else {
      const day = start.getUTCDate();
      start.setUTCDate(1);
      start.setUTCMonth(start.getUTCMonth() - preset.months);
      const last = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
      start.setUTCDate(Math.min(day, last));
    }
    setFilters(current => ({ ...current, from: start.toISOString().slice(0, 10), to }));
  };

  if (group) return <Preview group={group} onBack={() => setGroup(undefined)} type={type} />;

  return (
    <div className="inventory-config-page">
      <div className="record-form-top">
        <div>
          <button type="button" className="text-button" onClick={onBack}><ArrowLeft size={17} /> Cambiar tipo de inventario</button>
          <h2>{types[type].name}</h2>
          <p>Selecciona la serie documental que quieres exportar.</p>
        </div>
      </div>
      <form className="surface grid gap-4 p-4 sm:p-6" onSubmit={async event => {
        event.preventDefault();
        if (busy || !filters.series) return;
        setBusy(true);
        setError("");
        try {
          const result = await inventoriesApi.seriesPreview(type, filters);
          if (result.header) setGroup({ ...result, header: result.header, filters });
          else setError("No hay expedientes que coincidan con los filtros.");
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "No se pudo cargar la vista previa.");
        } finally { setBusy(false); }
      }}>
        <fieldset disabled={busy || !options} className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <label className="form-field"><span>Sección</span>
              <select required value={filters.section} onChange={event => setFilters({ ...filters, section: event.target.value, series: "" })}>
                <option value="">Selecciona una sección</option>
                {[...sections].map(([code, name]) => <option key={code} value={code}>{code} · {name}</option>)}
              </select>
            </label>
            <label className="form-field"><span>Serie documental</span>
              <select required disabled={!filters.section} value={filters.series} onChange={event => setFilters({ ...filters, series: event.target.value })}>
                <option value="">Selecciona una serie</option>
                {series.map(item => <option key={item.code} value={item.code}>{item.code} · {item.name}</option>)}
              </select>
            </label>
            <label className="form-field"><span>Periodo de apertura</span>
              <select value={period} onChange={event => changePeriod(event.target.value)}>
                <option value="">Todas las fechas</option>
                {openingPeriods.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                <option value="custom">Personalizado</option>
              </select>
            </label>
            {period === "custom" && <>
              <label className="form-field"><span>Desde</span>
                <input type="date" max={filters.to || undefined} value={filters.from} onChange={event => setFilters({ ...filters, from: event.target.value })} />
              </label>
              <label className="form-field"><span>Hasta</span>
                <input type="date" min={filters.from || undefined} value={filters.to} onChange={event => setFilters({ ...filters, to: event.target.value })} />
              </label>
            </>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {options && (role === "Administrador / Coordinador" || role === "Encargado de préstamos / Control archivístico") &&
              <MultiFilter key={`areas-${filterReset}`} label="Áreas" options={options.areas} selected={filters.areas} onChange={updateAreas} />}
            {options && role !== "Personal de área" && <MultiFilter key={`usuarios-${filterReset}`} label="Usuarios" options={userOptions(filters.areas)}
              selected={filters.users} onChange={users => setFilters({ ...filters, users })} />}
          </div>
          {type === "concentracion" && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-[#205b4d]" checked={filters.includePhysicalLocation}
                onChange={event => setFilters({ ...filters, includePhysicalLocation: event.target.checked })} />
              Incluir ubicación física
            </label>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button className="button--secondary" onClick={() => { setFilters(emptyFilters); setFilterReset(count => count + 1); setPeriod(""); setError(""); }}>Limpiar filtros</Button>
            <button type="submit" className="button button--primary" disabled={!filters.series}>Ver vista previa</button>
          </div>
        </fieldset>
        {(!options && !error || busy) && <p role="status">Cargando…</p>}
        {options && !options.series.length && <p>No hay series con expedientes disponibles para este inventario.</p>}
        {error && <p className="validation-summary" role="alert">{error}</p>}
      </form>
    </div>
  );
}

const columns = [
  "Consecutivo",
  "Caja",
  "Número de expediente",
  "Código CADIDO",
  "Título o descripción",
  "Fecha de apertura",
  "Fecha de cierre",
  "Legajos",
  "Folios",
  "Soporte documental",
  "Valor documental",
  "Vigencia en trámite",
  "Vigencia en concentración",
  "Vigencia total",
  "Ubicación topográfica",
  "Observaciones",
] as const;

function cells(record: ArchivalRecord) {
  return [
    record.consecutive,
    record.boxNumber,
    record.recordNumber,
    record.archiveClassificationCode || record.cadidoCode,
    record.title,
    formatDate(record.openDate),
    record.closeDate ? formatDate(record.closeDate) : "Expediente abierto",
    record.filesCount,
    record.foliosCount,
    record.supportType,
    record.documentaryValues.join(", "),
    `${record.currentValidity} años`,
    `${record.concentrationValidity} años`,
    `${record.totalValidity} años`,
    record.archiveAddress?.trim() || "",
    record.observations,
  ];
}

function Preview({
  group,
  onBack,
  type,
}: {
  group: InventoryGroup;
  onBack: () => void;
  type: SeriesInventoryType;
}) {
  const [downloaded, setDownloaded] = useState(false);
  useEffect(() => {
    if (!downloaded) return;
    const timer=window.setTimeout(()=>setDownloaded(false),4000);
    return ()=>window.clearTimeout(timer);
  },[downloaded]);
  const h = group.header;
  const concentration = type === "concentracion";
  const includePhysicalLocation = concentration && group.filters.includePhysicalLocation;
  const previewColumns: string[] = [...columns];
  if (concentration) previewColumns.push("Condiciones de acceso", "Tradición documental", "Ubicación M", "Ubicación N", "Ubicación P");
  if (includePhysicalLocation) previewColumns.push("Archivo o zona", "Sala", "Estante", "Nivel", "Sección física", "Posición alfanumérica", "Observaciones de ubicación");
  const displayCells = (record: ArchivalRecord, index: number) => {
    const row = cells(record);
    row[0] = String(index + 1);
    if (concentration) {
      const data = record.concentrationData;
      row[1] = record.locationBox || record.boxNumber;
      row.push(data?.access || "", data?.tradition || "", data?.m || "", data?.n || "", data?.p || "");
    }
    if (includePhysicalLocation) row.push(record.archiveZone, record.room, record.shelf, record.level,
      record.physicalSection, record.position, record.locationNotes);
    return row;
  };
  const [error,setError]=useState("");
  const [isDownloading,setIsDownloading]=useState(false);
  const download=async()=>{
    if(isDownloading)return;
    setIsDownloading(true);setError("");
    try{
      await inventoriesApi.downloadSeries(type,group.filters);
      setDownloaded(true);
    }catch(error){
      setDownloaded(false);
      setError(error instanceof Error?error.message:"Error al exportar el XLSX.");
    }finally{setIsDownloading(false);}
  };
  return (
    <div className="inventory-preview-page">
      <div className="record-form-top inventory-preview-heading">
        <div>
          <button className="text-button" onClick={onBack}>
            <ArrowLeft size={17} />
            Volver a filtros
          </button>
          <h2>Vista previa completa</h2>
          <p>
            {types[type].name} · {[h.cadidoCode, h.cadidoSeriesName].filter(Boolean).join(" · ")}
          </p>
        </div>
        <Button className="button--primary" disabled={isDownloading} onClick={download}>
          <Download size={16} />
          Descargar Excel
        </Button>
      </div>
      {error && <div className="validation-summary" role="alert">{error}</div>}
      {downloaded && (
        <div className="success-banner" role="status">
          <Check size={17} />
          Descarga completada correctamente.
        </div>
      )}
      <section className="surface institutional-inventory-preview">
        <div className="institutional-preview-title">
          <div>
            <strong>SEMARNAT</strong>
            <span>Oficina de Representación en Nayarit</span>
          </div>
          <div>
            <span>{types[type].name}</span>
            <strong>{[h.cadidoCode, h.cadidoSeriesName].filter(Boolean).join(" · ")}</strong>
          </div>
        </div>
        <div className="inventory-header-sheet">
          <div>
            <span>Unidad administrativa</span>
            <strong>{h.administrativeUnit}</strong>
          </div>
          <div>
            <span>Área generadora</span>
            <strong>{h.areaName}</strong>
          </div>
          <div>
            <span>Responsable</span>
            <strong>{h.responsible}</strong>
          </div>
          <div>
            <span>Cargo</span>
            <strong>{h.responsiblePosition}</strong>
          </div>
          <div>
            <span>Fondo</span>
            <strong>{h.fund}</strong>
          </div>
          <div>
            <span>Sección</span>
            <strong>{h.cadidoSectionName || h.cadidoSectionId}</strong>
          </div>
          <div>
            <span>Serie</span>
            <strong>{h.cadidoSeriesName}</strong>
          </div>
          <div>
            <span>Número de hoja</span>
            <strong>
              Hoja 1 de 1
            </strong>
          </div>
          <div>
            <span>Fecha de elaboración</span>
            <strong>{formatDate(h.inventoryDate)}</strong>
          </div>
        </div>
        <div className="inventory-preview-toolbar">
          <div>
            <FileSpreadsheet size={20} />
            <span>
              <strong>{group.records.length} expedientes</strong>
              <small>Expedientes de la serie seleccionada</small>
            </span>
          </div>
        </div>
        <div className="inventory-wide-scroll">
          <table className="inventory-wide-table">
            <thead>
              <tr>
                {previewColumns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {group.records.map((record, rowIndex) => (
                <tr key={record.id}>
                  {displayCells(record, rowIndex).map((cell, index) => (
                    <td key={`${record.id}-${previewColumns[index]}`}>{cell || <span>Sin dato</span>}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default function InventoriesPanel({ currentUser, role }: { currentUser: UserRecord; role: Role }) {
  const [type, setType] = useState<InventoryType>();
  const back = () => setType(undefined);
  if (!type) return <TypeSelection onSelect={setType} role={role} />;
  if (type === "transferencia")
    return <PrimaryTransferBuilder currentUser={currentUser} role={role} onBack={back} />;
  return <SeriesInventory key={`${type}-${currentUser.id}-${role}`} type={type} role={role} onBack={back} />;
}
