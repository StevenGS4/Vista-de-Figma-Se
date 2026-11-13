import { FormEvent, ReactNode, useMemo, useState } from "react";
import {
  Archive,
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileCheck2,
  Files,
  FilterX,
  FolderTree,
  MapPin,
  MoreHorizontal,
  Pencil,
  Search,
  ShieldCheck,
  Truck,
  Warehouse,
} from "lucide-react";
import { Role, UserRecord, areaName, areas } from "./data";
import { concentrationApi } from "./api";
import LocationShelf from "./LocationShelf";
import {
  ArchivalRecord,
  RecordAvailability,
  cadidoSections,
  cadidoSeries,
  locationSummary,
} from "./records";

type PanelView = "list" | "detail" | "location";
type LocationErrors = Partial<
  Record<"archiveZone" | "room" | "shelf" | "level" | "physicalSection", string>
>;

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

function ConcentrationList({
  canEditLocation,
  canViewDetail,
  onEditLocation,
  onView,
  records,
}: {
  canEditLocation: boolean;
  canViewDetail: boolean;
  onEditLocation: (record: ArchivalRecord) => void;
  onView: (record: ArchivalRecord) => void;
  records: ArchivalRecord[];
}) {
  const [search, setSearch] = useState("");
  const [area, setArea] = useState("");
  const [cadido, setCadido] = useState("");
  const [cadidoYear, setCadidoYear] = useState("");
  const [availability, setAvailability] = useState("");
  const [searched, setSearched] = useState(false);
  const [recentOnly, setRecentOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [activeActions, setActiveActions] = useState<string | null>(null);
  const pageSize = 5;
  const filtered = useMemo(
    () =>
      records.filter((record, index) => {
        const query = search.trim().toLowerCase();
        return (
          (!query ||
            record.recordNumber.toLowerCase().includes(query) ||
            record.title.toLowerCase().includes(query)) &&
          (!area || record.areaId === area) &&
          (!cadido || record.cadidoCode === cadido) &&
          (!cadidoYear || record.cadidoYear === cadidoYear) &&
          (!availability || record.availability === availability) &&
          (!recentOnly || index < 5)
        );
      }),
    [area, availability, cadido, cadidoYear, recentOnly, records, search],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const hasFilters = Boolean(search || area || cadido || cadidoYear || availability || recentOnly);

  const clear = () => {
    setSearch("");
    setArea("");
    setCadido("");
    setCadidoYear("");
    setAvailability("");
    setRecentOnly(false);
    setSearched(false);
    setPage(1);
  };

  return (
    <>
      <div className="records-page-heading">
        <div>
          <h2>Archivo de concentración</h2>
          <p>Consulta y localiza los expedientes transferidos administrativamente.</p>
        </div>
        <span className="access-chip">
          <Archive size={15} />
          Expedientes transferidos
        </span>
      </div>
      <section className="surface records-table-card concentration-table-card">
        <div className="records-filter-head">
          <div>
            <h3>Búsqueda de expedientes</h3>
            <p>Define criterios antes de consultar los registros autorizados.</p>
          </div>
          <div className="availability-key">
            <span>Disponibilidad:</span>
            <AvailabilityBadge value="En archivo" />
            <AvailabilityBadge value="Prestado" />
          </div>
        </div>
        <div className="concentration-filters">
          <label className="search-box">
            <Search size={17} />
            <input
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Buscar expediente o asunto..."
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
          <label className="filter-select">
            <select
              aria-label="Filtrar por código CADIDO"
              onChange={(event) => {
                setCadido(event.target.value);
                setPage(1);
              }}
              value={cadido}
            >
              <option value="">Todos los códigos CADIDO</option>
              {[...new Set(records.filter(r=>!cadidoYear||r.cadidoYear===cadidoYear).map(r=>r.cadidoCode))].sort().map(c => (
                <option key={c} value={c}>{c}</option>
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
          <button className="clear-filters" disabled={!hasFilters} onClick={clear}>
            <FilterX size={16} />
            Limpiar
          </button>
          <button className="button button--primary" onClick={() => setSearched(true)}>
            <Search size={16} />
            Buscar
          </button>
        </div>
        <div className="concentration-quick-access">
          <button
            className={`button button--secondary ${recentOnly ? "is-active" : ""}`}
            onClick={() => {
              setRecentOnly(true);
              setSearched(true);
            }}
          >
            <Clock3 size={16} />
            Expedientes recientes autorizados
          </button>
        </div>
        {!searched ? (
          <div className="empty-state concentration-search-empty">
            <Search size={30} />
            <strong>Utiliza la búsqueda para consultar expedientes</strong>
            <p>No se muestran registros automáticamente para reducir la saturación informativa.</p>
          </div>
        ) : (
          <>
            <div className="table-scroll">
              <table className="data-table concentration-table">
                <thead>
                  <tr>
                    <th>Número de expediente</th>
                    <th>Título o asunto</th>
                    <th>Área generadora</th>
                    <th>Código CADIDO</th>
                    <th>Fecha de transferencia</th>
                    <th>Estante</th>
                    <th>Nivel</th>
                    <th>Sección física</th>
                    <th>Disponibilidad</th>
                    <th className="align-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((record) => (
                    <tr key={record.id}>
                      <td>
                        {canViewDetail ? (
                          <button className="record-number-link" onClick={() => onView(record)}>
                            {record.recordNumber}
                          </button>
                        ) : (
                          <strong>{record.inventoryId}</strong>
                        )}
                      </td>
                      <td>
                        <span className="record-subject" title={record.title}>
                          {record.title}
                        </span>
                      </td>
                      <td>{areaName(record.areaId)}</td>
                      <td>
                        <span className="cadido-code">{record.cadidoCode}</span>
                      </td>
                      <td>{formatDate(record.transferDate)}</td>
                      <td>Estante {record.shelf}</td>
                      <td>Nivel {record.level}</td>
                      <td>Sección {record.physicalSection}</td>
                      <td>
                        <AvailabilityBadge value={record.availability} />
                      </td>
                      <td>
                        <div className="record-actions">
                          <button
                            aria-expanded={activeActions === record.id}
                            aria-label={`Acciones para ${record.recordNumber}`}
                            onClick={() =>
                              setActiveActions((current) =>
                                current === record.id ? null : record.id,
                              )
                            }
                          >
                            <MoreHorizontal size={18} />
                          </button>
                          {activeActions === record.id && (
                            <div className="record-actions__menu concentration-actions-menu">
                              {canViewDetail && (
                                <button
                                  onClick={() => {
                                    setActiveActions(null);
                                    onView(record);
                                  }}
                                >
                                  <Files size={16} />
                                  Ver detalle
                                </button>
                              )}
                              {canEditLocation && (
                                <button
                                  onClick={() => {
                                    setActiveActions(null);
                                    onEditLocation(record);
                                  }}
                                >
                                  <MapPin size={15} />
                                  Editar ubicación
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!visible.length && (
                <div className="empty-state">
                  <Archive size={30} />
                  <strong>No encontramos expedientes</strong>
                  <p>Ajusta la búsqueda o limpia los filtros seleccionados.</p>
                  {hasFilters && (
                    <button className="text-button" onClick={clear}>
                      Limpiar filtros
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="pagination">
              <span>
                Mostrando {visible.length ? (page - 1) * pageSize + 1 : 0}–
                {Math.min(page * pageSize, filtered.length)} de {filtered.length}
              </span>
              <div>
                <button
                  aria-label="Página anterior"
                  disabled={page === 1}
                  onClick={() => setPage((current) => current - 1)}
                >
                  <ChevronLeft size={16} />
                </button>
                <span>
                  Página {page} de {pageCount}
                </span>
                <button
                  aria-label="Página siguiente"
                  disabled={page === pageCount}
                  onClick={() => setPage((current) => current + 1)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
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
  onBack,
  onEditLocation,
  record,
}: {
  canEditLocation: boolean;
  onBack: () => void;
  onEditLocation: () => void;
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
          <span>{record.recordNumber}</span>
          <h2>{record.title}</h2>
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
          <DetailField label="Código CADIDO ficticio" value={record.cadidoCode} />
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
  currentUser,
  onRecordsChange,
  permissions,
  records,
  role,
}: {
  currentUser: UserRecord;
  onRecordsChange: (records: ArchivalRecord[]) => void;
  permissions: string[];
  records: ArchivalRecord[];
  role: Role;
}) {
  const [view, setView] = useState<PanelView>("list");
  const [selected, setSelected] = useState<ArchivalRecord | null>(null);
  const [message, setMessage] = useState("");
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
    (role === "Encargado de préstamos / Control archivístico" ||
      role === "Administrador / Coordinador") &&
    permissions.includes("update-location");
  const canViewDetail = role !== "Encargado de área";

  const saveLocation = async (record: ArchivalRecord) => {
    try {
      const saved=await concentrationApi.saveLocation(record);
      onRecordsChange(records.map(item=>item.id===saved.id?saved:item));
      setSelected(saved);
      setView("detail");
      setMessage("La ubicación física se actualizó correctamente en MySQL.");
      window.setTimeout(()=>setMessage(""),3000);
    } catch(error) {
      const message=error instanceof Error?error.message:"Error al guardar la ubicación en MySQL.";
      setMessage(message);
      window.alert(message);
    }
  };

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
          canEditLocation={canEditLocation}
          onBack={() => {
            setSelected(null);
            setView("list");
          }}
          onEditLocation={() => setView("location")}
          record={selected}
        />
      </>
    );

  return (
    <ConcentrationList
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
