import { FormEvent, Fragment, ReactNode, useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileCheck2,
  Files,
  FilterX,
  FolderTree,
  MapPin,
  Pencil,
  Search,
  ShieldCheck,
  Truck,
  Warehouse,
} from "lucide-react";
import RowActionsMenu from "./RowActionsMenu";
import { Role, UserRecord, areaName, areas } from "./data";
import { concentrationApi } from "./api";
import LocationShelf from "./LocationShelf";
import {
  ArchivalRecord,
  type ConcentrationInventoryData,
  RecordAvailability,
  cadidoSections,
  cadidoSeries,
  locationSummary,
} from "./records";

type PanelView = "list" | "detail" | "location" | "inventory-data";
type LocationErrors = Partial<
  Record<"archiveZone" | "room" | "shelf" | "level" | "physicalSection", string>
>;

const concentrationDate = (record: ArchivalRecord) => record.receptionDate || record.transferDate || record.inventoryDate || "";

const formatDate = (value: string) =>
  value ? new Date(`${value}T12:00:00`).toLocaleDateString("es-MX") : "Sin registro";
const sectionName = (id: string) =>
  cadidoSections.find((item) => item.id === id)?.name ?? "Sin asignar";
const seriesName = (id: string) =>
  cadidoSeries.find((item) => item.id === id)?.name ?? "Sin asignar";

function Button({
  children,
  className = "",
  onClick,
  type = "button",
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button className={`button ${className}`} onClick={onClick} type={type}>
      {children}
    </button>
  );
}

function AvailabilityBadge({ value }: { value: RecordAvailability }) {
  return (
    <span className={`record-badge record-badge--${value === "En archivo" ? "green" : "wine"}`}>
      <span />
      {value}
    </span>
  );
}

const accessLabels: Record<string, string> = { P: "Pública", C: "Confidencial", R: "Reservada" };
const traditionLabels: Record<string, string> = { ORIGINAL: "Original", COPIA: "Copia", AMBAS: "Original y copia" };
const topographicKeys = ["m", "n", "p"] as const;

function EditInventoryData({record, onCancel, onSave}: {
  record: ArchivalRecord;
  onCancel: () => void;
  onSave: (data: ConcentrationInventoryData) => Promise<void>;
}) {
  const [data, setData] = useState<ConcentrationInventoryData>(record.concentrationData ?? {
    access: "", tradition: "", m: "", n: "", p: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const update = (key: keyof ConcentrationInventoryData, value: string) =>
    setData(current => ({ ...current, [key]: value }));
  const field = "grid gap-1 text-sm font-medium text-[#244f41]";
  const control = "w-full rounded-md border border-[#a9beb5] bg-[#fbfaf6] px-3 py-2";
  return (
    <section className="surface overflow-hidden rounded-xl">
      <div className="records-filter-head"><h3>Datos del inventario · {record.title}</h3></div>
      <form className="grid gap-4 p-5" onSubmit={async event => {
        event.preventDefault();
        if (saving) return;
        setSaving(true);
        setError("");
        try { await onSave(data); }
        catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudieron guardar los datos."); }
        finally { setSaving(false); }
      }}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={field}>Condiciones de acceso
            <select className={control} value={data.access} onChange={event => update("access", event.target.value)}>
              <option value="">Pendiente</option>
              {Object.entries(accessLabels).map(([key, label]) => <option key={key} value={key}>{key} · {label}</option>)}
            </select>
          </label>
          <label className={field}>Tradición documental
            <select className={control} value={data.tradition} onChange={event => update("tradition", event.target.value)}>
              <option value="">Pendiente</option>
              {Object.entries(traditionLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
        </div>
        <fieldset className="grid gap-3 rounded-lg border border-[#c8d4cc] p-3">
          <legend className="px-1 font-semibold">Ubicación topográfica del formato</legend>
          <p className="text-sm"><strong>Ubicación física registrada:</strong> {[record.archiveZone, record.room, locationSummary(record), record.position && `Posición ${record.position}`].filter(Boolean).join(" · ")}</p>
          <p className="text-sm">Captura solo las casillas que correspondan según la nomenclatura de tu oficina.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {topographicKeys.map(key => <label className={field} key={key}>{key.toUpperCase()}
              <input className={control} value={data[key]} maxLength={100} onChange={event => update(key, event.target.value)} />
            </label>)}
          </div>
        </fieldset>
        {error && <p role="alert" className="field-error">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="button button--secondary" onClick={onCancel} disabled={saving}>Cancelar</button>
          <button type="submit" className="button button--primary" disabled={saving}>{saving ? "Guardando…" : "Guardar datos"}</button>
        </div>
      </form>
    </section>
  );
}

function ConcentrationList({
  initialSearch = "",
  canEditLocation,
  canViewDetail,
  onEditInventoryData,
  onEditLocation,
  onView,
  records,
}: {
  initialSearch?: string;
  canEditLocation: boolean;
  canViewDetail: boolean;
  onEditInventoryData: (record: ArchivalRecord) => void;
  onEditLocation: (record: ArchivalRecord) => void;
  onView: (record: ArchivalRecord) => void;
  records: ArchivalRecord[];
}) {
  const [search, setSearch] = useState(initialSearch);
  const [area, setArea] = useState("");
  const [section, setSection] = useState("");
  const [cadido, setCadido] = useState("");
  const [cadidoYear, setCadidoYear] = useState("");
  const [availability, setAvailability] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [recentOnly, setRecentOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [expandedInventory, setExpandedInventory] = useState<string | null>(null);
  const pageSize = 5;

  const filtered = useMemo(() => {
    const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const groups = new Map<string, ArchivalRecord[]>();
    const seen = new Set<string>();
    for (const record of [...records].sort((a, b) => concentrationDate(b).localeCompare(concentrationDate(a)))) {
      const date = concentrationDate(record);
      if (seen.has(record.id) || (area && record.areaId !== area) ||
        (section && record.cadidoSectionId !== section) || (cadido && record.cadidoCode !== cadido) ||
        (cadidoYear && record.cadidoYear !== cadidoYear) ||
        (availability && record.availability !== availability) ||
        (from && (!date || date < from)) || (to && (!date || date > to)) ||
        !terms.every(term => [record.inventoryId, record.recordNumber, record.archiveClassificationCode,
          record.cadidoCode, record.cadidoSeriesName, record.title, record.description, areaName(record.areaId)]
          .some(value => value?.toLowerCase().includes(term)))) continue;
      seen.add(record.id);
      const id = record.cadidoSectionId + ":" + record.cadidoCode;
      const items = groups.get(id) ?? [];
      items.push(record);
      groups.set(id, items);
    }
    const matching = [...groups].map(([id, items]) => {
      const inventories = new Map<string, ArchivalRecord[]>();
      for (const record of items) {
        const key = record.inventoryId || record.id;
        const inventory = inventories.get(key) ?? [];
        inventory.push(record);
        inventories.set(key, inventory);
      }
      return { id, header: items[0], records: items, inventories: [...inventories] };
    });
    return recentOnly ? matching.slice(0,5) : matching;
  }, [records, search, area, section, cadido, cadidoYear, availability, recentOnly, from, to]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const hasFilters = Boolean(search || area || section || cadido || cadidoYear || availability || recentOnly || from || to);

  const clear = () => {
    setSearch("");
    setArea("");
    setSection("");
    setCadido("");
    setCadidoYear("");
    setAvailability("");
    setRecentOnly(false);
    setFrom("");
    setTo("");
    setExpandedInventory(null);
    setPage(1);
  };

  return (
    <>
      <div className="records-page-heading">
        <div>
          <h2>Archivo de concentración</h2>
          <p>Consulta los expedientes transferidos agrupados por sección y serie documental.</p>
        </div>
        <span className="access-chip">
          <Archive size={15} />
          Series documentales
        </span>
      </div>
      <section className="surface records-table-card concentration-table-card">
        <div className="records-filter-head">
          <div>
            <h3>Búsqueda por sección y serie</h3>
            <p>Series ordenadas por la recepción más reciente.</p>
          </div>
          <div className="availability-key">
            <span>Disponibilidad:</span>
            <AvailabilityBadge value="En archivo" />
            <AvailabilityBadge value="Prestado" />
          </div>
        </div>
        <div className="concentration-filters">
          <label className="filter-select"><select aria-label="Filtrar por sección" value={section}
            onChange={event => { setSection(event.target.value); setCadido(""); setPage(1); }}>
            <option value="">Todas las secciones</option>
            {[...new Set(records.map(record => record.cadidoSectionId))].sort().map(id =>
              <option key={id} value={id}>{id} · {sectionName(id)}</option>)}
          </select></label>
          <label className="filter-select">
            <select
              aria-label="Filtrar por serie"
              onChange={(event) => {
                setCadido(event.target.value);
                setPage(1);
              }}
              value={cadido}
            >
              <option value="">Todas las series</option>
              {[...new Set(records.filter(r=>(!cadidoYear||r.cadidoYear===cadidoYear)&&(!section||r.cadidoSectionId===section)).map(r=>r.cadidoCode))].sort().map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="search-box">
            <Search size={17} />
            <input
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Buscar por número de expediente, asunto o código CADIDO..."
              value={search}
            />
          </label>
          <label className="filter-select">
            <select
              aria-label="Filtrar por área"
              onChange={(event) => {
                setArea(event.target.value);
                setPage(1);
              }}
              value={area}
            >
              <option value="">Todas las áreas</option>
              {areas.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-select"><select aria-label="Filtrar por edición CADIDO" value={cadidoYear} onChange={e=>{setCadidoYear(e.target.value);setCadido("");setPage(1);}}>
            <option value="">Todas las ediciones CADIDO</option>
            {[...new Set(records.map(r=>r.cadidoYear).filter(Boolean))].sort().map(v=><option key={v} value={v}>{v}</option>)}
          </select></label>
          <label className="filter-select">
            <select
              aria-label="Filtrar por disponibilidad"
              onChange={(event) => {
                setAvailability(event.target.value);
                setPage(1);
              }}
              value={availability}
            >
              <option value="">Toda disponibilidad</option>
              <option>En archivo</option>
              <option>Prestado</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs">Desde
            <input className="filter-date" type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }} />
          </label>
          <label className="grid gap-1 text-xs">Hasta
            <input className="filter-date" type="date" value={to} onChange={e => { setTo(e.target.value); setPage(1); }} />
          </label>
          <button className="clear-filters" disabled={!hasFilters} onClick={clear}>
            <FilterX size={16} />
            Limpiar
          </button>
          <button className="button button--primary" onClick={() => { setPage(1); setExpandedInventory(filtered[0]?.id ?? null); }}>
            <Search size={16} />
            Buscar
          </button>
        </div>
        <div className="concentration-quick-access">
          <button
            className={`button button--secondary ${recentOnly ? "is-active" : ""}`}
            aria-pressed={recentOnly}
            onClick={() => {
              setRecentOnly(value => !value);
              setPage(1);
            }}
          >
            <Clock3 size={16} />
            Solo las cinco series más recientes
          </button>
        </div>
        {from && to && from > to && <p role="alert" className="field-error">La fecha inicial debe ser anterior o igual a la final.</p>}
        <div className="table-scroll">
          <table className="data-table concentration-table concentration-inventory-table">
            <thead>
              <tr>
                <th>Serie documental</th>
                <th>Sección</th>
                <th>Código CADIDO</th>
                <th>Fecha más reciente</th>
                <th>Expedientes</th>
                <th>Disponibilidad</th>
                <th className="align-right">Ver archivos</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(({ id, header, records: items, inventories }) => {
                const expanded = expandedInventory === id;
                const onLoan = items.filter((record) => record.availability === "Prestado").length;
                const availabilityLabel = onLoan === 0
                  ? "Todos en archivo"
                  : onLoan === items.length ? "Todos prestados" : `${onLoan} prestados de ${items.length}`;
                return (
                  <Fragment key={id}>
                    <tr className={expanded ? "concentration-inventory-row is-expanded" : "concentration-inventory-row"}>
                      <td>
                        <button
                          type="button"
                          className="record-number-link concentration-inventory-toggle"
                          aria-expanded={expanded}
                          aria-controls={`concentration-inventory-${id}`}
                          onClick={() => {
                            setExpandedInventory(expanded ? null : id);
                            }}
                        >
                          <FolderTree size={17} />
                          <span><strong>{header.cadidoSeriesName || header.cadidoCode}</strong><span className="block break-words text-xs font-normal text-[#52605a]">{header.cadidoCode}</span></span>
                          <ChevronDown size={16} className={expanded ? "is-expanded" : ""} />
                        </button>
                      </td>
                      <td>{sectionName(header.cadidoSectionId)}</td>
                      <td><span className="cadido-code">{header.cadidoCode}</span></td>
                      <td>{formatDate(concentrationDate(header))}</td>
                      <td>{items.length}</td>
                      <td>{availabilityLabel}</td>
                      <td className="align-right">
                        <button type="button" className="button button--secondary concentration-expand-button"
                          aria-expanded={expanded}
                          onClick={() => {
                            setExpandedInventory(expanded ? null : id);
                            }}>
                          {expanded ? "Ocultar archivos" : "Mostrar archivos"}
                          <ChevronDown size={16} className={expanded ? "is-expanded" : ""}/>
                        </button>
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="concentration-inventory-detail-row">
                        <td colSpan={7} id={`concentration-inventory-${id}`}>
                          <div className="concentration-inventory-contents">
                            {inventories.map(([inventoryId, inventoryRecords]) => (
                              <details key={inventoryId} className="mb-3 rounded-lg border border-[#c8d4cc] p-3" open={inventories.length === 1 || Boolean(search.trim())}>
                                <summary className="cursor-pointer font-semibold">
                                  {inventoryRecords[0].inventoryId || "Archivo sin identificador"} · {inventoryRecords.length} expedientes
                                </summary>
                                  <div className="table-scroll">
                                    <table className="data-table concentration-table concentration-expedient-table">
                                      <thead><tr>
                                        <th>Asunto e identificación</th>
                                        <th>Disponibilidad</th>
                                        <th className="align-right">Acciones</th>
                                      </tr></thead>
                                      <tbody>{inventoryRecords.map((record) => (
                                        <tr key={record.id}>
                                          <td>
                                            {canViewDetail ? (
                                              <button type="button" className="record-number-link" onClick={() => onView(record)}>
                                                {record.title}
                                              </button>
                                            ) : <strong>{record.title}</strong>}
                                            <span className="block break-words text-xs font-normal text-[#52605a]">{[record.archiveClassificationCode, record.recordNumber].filter((value, index, values) => value && values.indexOf(value) === index).join(" · ")}</span>
                                          </td>
                                          <td><AvailabilityBadge value={record.availability}/></td>
                                          <td>
                                            <RowActionsMenu
                                              label={`Acciones para ${record.recordNumber}`}
                                              width={178}
                                              actions={[
                                                ...(canViewDetail ? [{
                                                  label: "Ver detalle",
                                                  icon: <Files size={16}/>,
                                                  onSelect: () => onView(record),
                                                }] : []),
                                                ...(canEditLocation && record.receptionConfirmed ? [{
                                                  label: "Completar datos del inventario",
                                                  icon: <Pencil size={15}/>,
                                                  onSelect: () => onEditInventoryData(record),
                                                }] : []),
                                                ...(canEditLocation ? [{
                                                  label: "Editar ubicación",
                                                  icon: <MapPin size={15}/>,
                                                  onSelect: () => onEditLocation(record),
                                                }] : []),
                                              ]}
                                            />
                                          </td>
                                        </tr>
                                      ))}</tbody>
                                    </table>
                                  </div>
                              </details>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {!visible.length && (
            <div className="empty-state">
              <Archive size={30}/>
              <strong>No encontramos series de concentración</strong>
              <p>Ajusta la búsqueda o limpia los filtros seleccionados.</p>
              {hasFilters && <button className="text-button" onClick={clear}>Limpiar filtros</button>}
            </div>
          )}
        </div>
        <div className="pagination">
          <span>
            Mostrando series {visible.length ? (currentPage - 1) * pageSize + 1 : 0}–
            {Math.min(currentPage * pageSize, filtered.length)} de {filtered.length}
          </span>
          <div>
            <button
              aria-label="Página anterior"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeft size={16} />
            </button>
            <span>
              Página {currentPage} de {pageCount}
            </span>
            <button
              aria-label="Página siguiente"
              disabled={currentPage === pageCount}
              onClick={() => setPage(currentPage + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>
    </>
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

function DetailSection({
  children,
  icon,
  title,
}: {
  children: ReactNode;
  icon: ReactNode;
  title: string;
}) {
  return (
    <section className="record-detail-group">
      <h3>
        {icon}
        {title}
      </h3>
      <div>{children}</div>
    </section>
  );
}

function ConcentrationDetail({
  canEditLocation,
  canViewSketch,
  onBack,
  onEditLocation,
  onEditInventoryData,
  record,
}: {
  canEditLocation: boolean;
  canViewSketch: boolean;
  onBack: () => void;
  onEditLocation: () => void;
  onEditInventoryData: () => void;
  record: ArchivalRecord;
}) {
  return (
    <div className="record-detail-page">
      <button className="text-button" onClick={onBack}>
        <ArrowLeft size={17} />
        Volver al listado
      </button>
      <div className="surface record-detail-hero concentration-detail-hero">
        <div className="record-detail-hero__icon">
          <Archive size={24} />
        </div>
        <div>
          <h2>{record.title}</h2>
          <span className="block break-words text-xs font-normal text-[#52605a]">{[record.archiveClassificationCode, record.recordNumber].filter((value, index, values) => value && values.indexOf(value) === index).join(" · ")}</span>
          <p>
            {areaName(record.areaId)} · Transferencia {record.transferReference}
          </p>
        </div>
        <div className="record-detail-hero__status">
          <span className="record-badge record-badge--green">
            <span />
            Archivo de concentración
          </span>
          <AvailabilityBadge value={record.availability} />
        </div>
        {canEditLocation && (
          <Button className="button--primary" onClick={onEditLocation}>
            <MapPin size={16} />
            Editar ubicación
          </Button>
        )}
      </div>

      <div className="record-detail-grid concentration-detail-grid">
        <DetailSection icon={<Files size={17} />} title="Identificación documental">
          <DetailField label="Unidad administrativa" value={record.administrativeUnit} />
          <DetailField label="Área generadora" value={areaName(record.areaId)} />
          <DetailField label="Responsable del área" value={record.responsible} />
          <DetailField label="Fondo documental" value={record.fund} />
          <DetailField label="Número de expediente" value={record.recordNumber} />
          <DetailField label="Título o asunto" value={record.title} />
          <DetailField label="Descripción" value={record.description} />
          <DetailField label="Observaciones" value={record.observations} />
        </DetailSection>
        <DetailSection icon={<FolderTree size={17} />} title="Clasificación CADIDO">
          <DetailField label="Sección documental" value={sectionName(record.cadidoSectionId)} />
          <DetailField label="Serie documental" value={seriesName(record.cadidoSeriesId)} />
          <DetailField label="Código de clasificación archivística" value={record.archiveClassificationCode || record.cadidoCode} />
          <DetailField label="Soporte documental" value={record.supportType} />
          <DetailField label="Valor documental" value={record.documentaryValues.join(", ")} />
        </DetailSection>
        <DetailSection icon={<CalendarDays size={17} />} title="Fechas y vigencias">
          <DetailField label="Fecha de apertura" value={formatDate(record.openDate)} />
          <DetailField label="Fecha de cierre" value={formatDate(record.closeDate)} />
          <DetailField label="Vigencia en trámite" value={`${record.currentValidity} años`} />
          <DetailField
            label="Vigencia en concentración"
            value={`${record.concentrationValidity} años`}
          />
          <DetailField label="Vigencia total" value={`${record.totalValidity} años`} />
          <DetailField label="Etapa archivística" value={record.stage} />
        </DetailSection>
        <DetailSection icon={<MapPin size={17} />} title="Ubicación física completa">
          <DetailField label="Archivo o zona" value={record.archiveZone} />
          <DetailField label="Sala" value={record.room} />
          <DetailField label="Ubicación exacta" value={locationSummary(record)} />
          <DetailField label="Posición u orden" value={record.position} />
          <DetailField label="Caja" value={record.locationBox} />
          <DetailField label="Observaciones" value={record.locationNotes} />
        </DetailSection>
        <DetailSection icon={<FileCheck2 size={17} />} title="Transferencia aceptada">
          <DetailField label="Referencia" value={record.transferReference} />
          <DetailField label="Fecha de transferencia" value={formatDate(record.transferDate)} />
          <DetailField
            label="Fecha de aceptación"
            value={formatDate(record.transferAcceptedDate)}
          />
          <DetailField label="Resultado" value="Aceptada administrativamente" />
        </DetailSection>
        <DetailSection icon={<FileCheck2 size={17} />} title="Datos del inventario de Concentración">
          <DetailField label="Condiciones de acceso" value={accessLabels[record.concentrationData?.access ?? ""] || "Pendiente"} />
          <DetailField label="Tradición documental" value={traditionLabels[record.concentrationData?.tradition ?? ""] || "Pendiente"} />
          {topographicKeys.map(key => <DetailField key={key} label={`Ubicación · ${key.toUpperCase()}`} value={record.concentrationData?.[key] || "—"} />)}
          {canEditLocation && record.receptionConfirmed && (
            <Button className="button--secondary" onClick={onEditInventoryData}><Pencil size={15} /> Editar datos</Button>
          )}
        </DetailSection>
        <DetailSection icon={<Truck size={17} />} title="Seguimiento de recepción física">
          <DetailField label="Fecha de recepción" value={formatDate(record.receptionDate)} />
          <DetailField label="Recibió" value={record.receptionResponsible} />
          <DetailField label="Seguimiento" value={record.receptionNotes} />
          <DetailField
            label="Estado de recepción"
            value={
              record.receptionDate ? "Recepción física registrada" : "Pendiente de registro físico"
            }
          />
        </DetailSection>
      </div>

      {canViewSketch && (
        <section className="surface my-4 grid gap-3 rounded-xl p-4" aria-label="Croquis de ubicación">
          <h3 className="font-semibold">Croquis de ubicación</h3>
          {record.shelf && record.level && record.physicalSection ? (
            <>
              <p className="text-sm">{[record.archiveZone, record.room, locationSummary(record)].filter(Boolean).join(" · ")}</p>
              <LocationShelf level={record.level} section={record.physicalSection} />
            </>
          ) : <p className="text-sm">El expediente aún no tiene estante, nivel y sección registrados.</p>}
        </section>
      )}

      <div
        className={`availability-panel availability-panel--${record.availability === "En archivo" ? "available" : "loaned"}`}
      >
        {record.availability === "En archivo" ? <ShieldCheck size={20} /> : <Clock3 size={20} />}
        <div>
          <span>Disponibilidad física</span>
          <strong>{record.availability}</strong>
          <p>
            {record.availability === "En archivo"
              ? "El expediente se encuentra disponible en la ubicación registrada."
              : "El expediente tiene un préstamo activo. La etapa archivística permanece en concentración."}
          </p>
        </div>
      </div>
    </div>
  );
}

function LocationField({
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

function EditLocation({
  onCancel,
  onSave,
  record,
}: {
  onCancel: () => void;
  onSave: (record: ArchivalRecord) => void;
  record: ArchivalRecord;
}) {
  const [form, setForm] = useState({ ...record });
  const [errors, setErrors] = useState<LocationErrors>({});

  const update = (field: keyof ArchivalRecord, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next: LocationErrors = {};
    if (!form.archiveZone.trim()) next.archiveZone = "Ingresa el archivo o zona.";
    if (!form.room.trim()) next.room = "Ingresa la sala.";
    if (!form.shelf || Number(form.shelf) < 1 || Number(form.shelf) > 25)
      next.shelf = "Selecciona un estante entre 1 y 25.";
    if (!["1", "2", "3", "4"].includes(form.level)) next.level = "Selecciona un nivel válido.";
    if (!["1", "2", "3", "4"].includes(form.physicalSection))
      next.physicalSection = "Selecciona una sección física válida.";
    setErrors(next);
    if (Object.keys(next).length) return;
    onSave({ ...form, stage: "Archivo de concentración" });
  };

  return (
    <div className="record-form-page">
      <div className="record-form-top">
        <div>
          <button className="text-button" onClick={onCancel}>
            <ArrowLeft size={17} />
            Volver al detalle
          </button>
          <h2>Editar ubicación</h2>
          <p>{record.recordNumber} · La etapa archivística no será modificada.</p>
        </div>
        <span className="record-mode">
          <MapPin size={16} />
          Ubicación física
        </span>
      </div>
      <form className="surface concentration-location-form" onSubmit={submit}>
        <div className="step-heading">
          <span>
            <Warehouse size={21} />
          </span>
          <div>
            <h3>Ubicación en archivo de concentración</h3>
            <p>
              Actualiza únicamente los datos necesarios para localizar físicamente el expediente.
            </p>
          </div>
        </div>
        <div className="concept-warning">
          <ShieldCheck size={17} />
          <span>
            <strong>Etapa protegida:</strong> editar la ubicación no cambia la etapa ni la
            disponibilidad del expediente.
          </span>
        </div>
        <div className="location-layout">
          <div className="record-form-grid">
            <LocationField error={errors.archiveZone} label="Archivo o zona" required>
              <input
                value={form.archiveZone}
                onChange={(event) => update("archiveZone", event.target.value)}
              />
            </LocationField>
            <LocationField error={errors.room} label="Sala" required>
              <input value={form.room} onChange={(event) => update("room", event.target.value)} />
            </LocationField>
            <LocationField error={errors.shelf} label="Estante" required>
              <select value={form.shelf} onChange={(event) => update("shelf", event.target.value)}>
                <option value="">Selecciona</option>
                {Array.from({ length: 25 }, (_, index) => String(index + 1)).map((item) => (
                  <option key={item} value={item}>
                    Estante {item}
                  </option>
                ))}
              </select>
            </LocationField>
            <LocationField error={errors.level} label="Nivel" required>
              <select value={form.level} onChange={(event) => update("level", event.target.value)}>
                <option value="">Selecciona</option>
                {[1, 2, 3, 4].map((item) => (
                  <option key={item} value={item}>
                    Nivel {item}
                  </option>
                ))}
              </select>
            </LocationField>
            <LocationField error={errors.physicalSection} label="Sección física" required>
              <select
                value={form.physicalSection}
                onChange={(event) => update("physicalSection", event.target.value)}
              >
                <option value="">Selecciona</option>
                {[1, 2, 3, 4].map((item) => (
                  <option key={item} value={item}>
                    Sección {item}
                  </option>
                ))}
              </select>
            </LocationField>
            <LocationField label="Posición u orden">
              <input
                value={form.position}
                onChange={(event) => update("position", event.target.value.toUpperCase())}
                placeholder="Ej. C-04"
              />
            </LocationField>
            <LocationField label="Caja">
              <input
                value={form.locationBox}
                onChange={(event) => update("locationBox", event.target.value)}
              />
            </LocationField>
            <LocationField label="Observaciones">
              <textarea
                rows={3}
                value={form.locationNotes}
                onChange={(event) => update("locationNotes", event.target.value)}
              />
            </LocationField>
          </div>
          <LocationShelf level={form.level} section={form.physicalSection} />
        </div>
        <div className="location-summary">
          <MapPin size={18} />
          <span>
            <small>Posición seleccionada</small>
            <strong>{locationSummary(form)}</strong>
          </span>
        </div>
        <div className="concentration-location-form__footer">
          <Button className="button--secondary" onClick={onCancel}>
            Cancelar
          </Button>
          <Button className="button--primary" type="submit">
            <Check size={17} />
            Guardar ubicación
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function ConcentrationPanel({
  initialSearch = "",
  currentUser,
  onRecordsChange,
  permissions,
  records,
  role,
}: {
  initialSearch?: string;
  currentUser: UserRecord;
  onRecordsChange: (records: ArchivalRecord[]) => void;
  permissions: string[];
  records: ArchivalRecord[];
  role: Role;
}) {
  const [view, setView] = useState<PanelView>("list");
  const [selected, setSelected] = useState<ArchivalRecord | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!message) return;
    const timer=window.setTimeout(()=>setMessage(""),4000);
    return ()=>window.clearTimeout(timer);
  },[message]);
  const concentrationRecords = records.filter((record) => {
    if (record.stage !== "Archivo de concentración") return false;
    if (
      role === "Administrador / Coordinador" ||
      role === "Encargado de préstamos / Control archivístico"
    )
      return true;
    if (role === "Encargado de área") return record.areaId === currentUser.areaId;
    return record.areaId === currentUser.areaId && record.createdBy === currentUser.id;
  });
  const canEditLocation =
    role === "Administrador / Coordinador" &&
    permissions.includes("update-location");
  const canViewDetail = permissions.includes("view-records");

  const saveLocation = async (record: ArchivalRecord) => {
    try {
      const saved=await concentrationApi.saveLocation(record);
      onRecordsChange(records.map(item=>item.id===saved.id?saved:item));
      setSelected(saved);
      setView("detail");
      setMessage("Ubicación física actualizada correctamente.");
    } catch(error) {
      const message=error instanceof Error?error.message:"No fue posible guardar la ubicación.";
      setMessage(message);
      window.alert(message);
    }
  };

  const openInventoryData = (record: ArchivalRecord) => {
    setSelected(record);
    setView("inventory-data");
  };

  if (view === "inventory-data" && selected && canEditLocation)
    return (
      <EditInventoryData key={selected.id} record={selected} onCancel={() => setView("detail")}
        onSave={async data => {
          const concentrationData = await concentrationApi.saveInventoryData(selected.id, data);
          const updated = { ...selected, concentrationData };
          onRecordsChange(records.map(record => record.id === updated.id ? { ...record, concentrationData } : record));
          setSelected(updated);
          setMessage("Datos del inventario actualizados.");
          setView("detail");
        }} />
    );

  if (view === "location" && selected)
    return (
      <EditLocation onCancel={() => setView("detail")} onSave={saveLocation} record={selected} />
    );

  if (view === "detail" && selected)
    return (
      <>
        {message && (
          <div className="toast record-toast">
            <Check size={18} />
            {message}
          </div>
        )}
        <ConcentrationDetail
          canViewSketch={role === "Administrador / Coordinador" || role === "Encargado de préstamos / Control archivístico"}
          canEditLocation={canEditLocation}
          onBack={() => {
            setSelected(null);
            setView("list");
          }}
          onEditLocation={() => setView("location")}
          onEditInventoryData={() => openInventoryData(selected)}
          record={selected}
        />
      </>
    );

  return (
    <ConcentrationList
      initialSearch={initialSearch}
      onEditInventoryData={openInventoryData}
      canEditLocation={canEditLocation}
      canViewDetail={canViewDetail}
      onEditLocation={(record) => {
        setSelected(record);
        setView("location");
      }}
      onView={(record) => {
        if (!canViewDetail) return;
        setSelected(record);
        setView("detail");
      }}
      records={concentrationRecords}
    />
  );
}
