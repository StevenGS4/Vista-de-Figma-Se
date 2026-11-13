import { ReactNode, useMemo, useState } from "react";
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  FileSpreadsheet,
  Files,
  FolderArchive,
  Search,
  ShieldCheck,
} from "lucide-react";
import { Role, UserRecord, areaName, areas } from "./data";
import { ArchivalRecord, cadidoSections, cadidoSeries, locationSummary } from "./records";
import { DocumentaryTransfer } from "./transfers";
import { inventoriesApi } from "./api";

type InventoryType = "tramite" | "concentracion" | "transferencia";
type View = "select" | "list" | "preview";

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
    name: "Relación de inventarios para transferencia primaria",
    description: "Reporte automático con una fila por inventario de trámite, sin ejecutar transferencias.",
    icon: FolderArchive,
    accent: "gold",
  },
} as const;

const sectionName = (id: string) => cadidoSections.find((item) => item.id === id)?.name ?? "";
const seriesName = (id: string) => cadidoSeries.find((item) => item.id === id)?.name ?? "";
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

function TypeSelection({ onSelect }: { onSelect: (type: InventoryType) => void }) {
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
        {(Object.keys(types) as InventoryType[]).map((type) => {
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
      <div className="inventory-info">
        <ShieldCheck size={18} />
        <span>
          <strong>Exportación desde MySQL</strong>La descarga XLSX no cambia expedientes,
          transferencias ni etapas.
        </span>
      </div>
    </>
  );
}

type InventoryGroup = {
  id: string;
  header: ArchivalRecord;
  records: ArchivalRecord[];
  transfer?: DocumentaryTransfer;
};

function groupRecords(
  records: ArchivalRecord[],
  transfers: DocumentaryTransfer[],
  type: InventoryType,
): InventoryGroup[] {
  if (type === "transferencia") {
    const linkedRecordIds=new Set(transfers.flatMap(transfer=>transfer.recordIds));
    const map = new Map<string, ArchivalRecord[]>();
    records
      .filter((record) => record.stage === "Archivo de trámite" && !linkedRecordIds.has(record.id))
      .forEach((record) =>
        map.set(record.inventoryId, [...(map.get(record.inventoryId) ?? []), record]),
      );
    return [...map.entries()].map(([id, rows]) => ({ id, header: rows[0], records: rows }));
  }
  const stage = type === "tramite" ? "Archivo de trámite" : "Archivo de concentración";
  const map = new Map<string, ArchivalRecord[]>();
  records
    .filter((record) => record.stage === stage)
    .forEach((record) =>
      map.set(record.inventoryId, [...(map.get(record.inventoryId) ?? []), record]),
    );
  return [...map.entries()].map(([id, rows]) => ({ id, header: rows[0], records: rows }));
}

function InventoryList({
  canAllAreas,
  currentUser,
  groups,
  onBack,
  onOpen,
  type,
}: {
  canAllAreas: boolean;
  currentUser: UserRecord;
  groups: InventoryGroup[];
  onBack: () => void;
  onOpen: (id: string) => void;
  type: InventoryType;
}) {
  const [allExportError,setAllExportError]=useState("");
  const [allExportLoading,setAllExportLoading]=useState(false);
  const exportAll=async()=>{
    if(allExportLoading)return;
    setAllExportLoading(true);setAllExportError("");
    try{await inventoriesApi.download(type);}
    catch(error){setAllExportError(error instanceof Error?error.message:"No se pudo exportar.");}
    finally{setAllExportLoading(false);}
  };
  const [search, setSearch] = useState("");
  const [area, setArea] = useState(canAllAreas ? "" : currentUser.areaId);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [fund, setFund] = useState("");
  const visible = groups.filter(({ header, id, transfer }) => {
    const query = search.toLowerCase();
    return (
      (!area || header.areaId === area) &&
      (!dateFrom || header.inventoryDate >= dateFrom) &&
      (!dateTo || header.inventoryDate <= dateTo) &&
      (!fund || header.fund.toLowerCase().includes(fund.toLowerCase())) &&
      (!query ||
        id.toLowerCase().includes(query) ||
        transfer?.folio.toLowerCase().includes(query) ||
        areaName(header.areaId).toLowerCase().includes(query) ||
        header.responsible.toLowerCase().includes(query))
    );
  });
  return (
    <div className="inventory-config-page">
      <div className="record-form-top">
        <div>
          <button className="text-button" onClick={onBack}>
            <ArrowLeft size={17} />
            Cambiar tipo de inventario
          </button>
          <h2>Inventarios disponibles</h2>
          <p>{types[type].name} · primero selecciona un encabezado.</p>
        </div>
        <span className="record-mode">
          <FileSpreadsheet size={16} />
          Inventario Excel
        </span>
      </div>
      <section className="surface records-table-card">
        <div className="records-filters">
          <label className="search-box records-search">
            <Search size={17} />
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar inventario, responsable o área..."
              value={search}
            />
          </label>
          <label className="filter-select">
            <select
              disabled={!canAllAreas}
              onChange={(event) => setArea(event.target.value)}
              value={area}
            >
              {canAllAreas && <option value="">Todas las áreas</option>}
              {areas.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Fecha inicial</span>
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </label>
          <label className="form-field">
            <span>Fecha final</span>
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </label>
          <label className="form-field">
            <span>Fondo</span>
            <input
              placeholder="Filtrar fondo..."
              value={fund}
              onChange={(event) => setFund(event.target.value)}
            />
          </label>
        </div>
        {type === "transferencia" && (
          <div className="inventory-info">
            <FileSpreadsheet size={18} />
            <span>
              <strong>Relación general de transferencia primaria</strong>
              Una fila por inventario elegible de tus áreas autorizadas; la descarga general no aplica los filtros de la tabla.
            </span>
            <Button className="button--primary" disabled={allExportLoading} onClick={exportAll}>
              <Download size={15} /> Descargar relación XLSX
            </Button>
          </div>
        )}
        {allExportError && <div className="validation-summary" role="alert">{allExportError}</div>}
        {type === "transferencia" && (
          <div className="inventory-info">
            <FileSpreadsheet size={18} />
            <span>
              <strong>{visible.length} inventarios · {visible.reduce((sum, group) => sum + group.records.length, 0)} expedientes</strong>
              Relación automática basada en la fecha de elaboración; generar o consultar este reporte no cambia etapas.
            </span>
          </div>
        )}
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Identificador</th>
                <th>Unidad administrativa</th>
                <th>Área generadora</th>
                <th>Responsable</th>
                <th>Fondo</th>
                <th>Sección</th>
                <th>Serie</th>
                <th>Hoja</th>
                <th>Fecha</th>
                <th>Expedientes</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((group) => (
                <tr key={group.id}>
                  <td>
                    <strong>{group.transfer?.folio ?? group.id}</strong>
                  </td>
                  <td>{group.header.administrativeUnit}</td>
                  <td>{areaName(group.header.areaId)}</td>
                  <td>{group.header.responsible}</td>
                  <td>{group.header.fund}</td>
                  <td>{sectionName(group.header.cadidoSectionId)}</td>
                  <td>{seriesName(group.header.cadidoSeriesId)}</td>
                  <td>Hoja {group.header.initialSheetNumber} de N</td>
                  <td>{formatDate(group.header.inventoryDate)}</td>
                  <td>{group.records.length}</td>
                  <td>
                    <Button className="button--secondary" onClick={() => onOpen(group.id)}>
                      Vista previa <ArrowRight size={15} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visible.length && (
            <div className="empty-state">
              <Files size={28} />
              <strong>No hay inventarios disponibles</strong>
              <p>Ajusta la búsqueda o el área seleccionada.</p>
            </div>
          )}
        </div>
      </section>
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
    record.cadidoCode,
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
    locationSummary(record),
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
  type: InventoryType;
}) {
  const [downloaded, setDownloaded] = useState(false);
  const h = group.header;
  const [error,setError]=useState("");
  const [isDownloading,setIsDownloading]=useState(false);
  const download=async()=>{
    if(isDownloading)return;
    setIsDownloading(true);setError("");
    try{
      await inventoriesApi.download(type,group.id);
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
            Volver a inventarios disponibles
          </button>
          <h2>Vista previa completa</h2>
          <p>
            {types[type].name} · {group.transfer?.folio ?? group.id}
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
          El XLSX fue generado desde MySQL sin modificar los registros.
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
            <strong>{group.transfer?.folio ?? group.id}</strong>
          </div>
        </div>
        <div className="inventory-header-sheet">
          <div>
            <span>Unidad administrativa</span>
            <strong>{h.administrativeUnit}</strong>
          </div>
          <div>
            <span>Área generadora</span>
            <strong>{areaName(h.areaId)}</strong>
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
            <strong>{sectionName(h.cadidoSectionId)}</strong>
          </div>
          <div>
            <span>Serie</span>
            <strong>{seriesName(h.cadidoSeriesId)}</strong>
          </div>
          <div>
            <span>Número de hoja</span>
            <strong>
              Hoja {h.initialSheetNumber} de {Math.max(1, Math.ceil(group.records.length / 20))}
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
              <small>Tabla documental del inventario seleccionado</small>
            </span>
          </div>
        </div>
        <div className="inventory-wide-scroll">
          <table className="inventory-wide-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {group.records.map((record) => (
                <tr key={record.id}>
                  {cells(record).map((cell, index) => (
                    <td key={`${record.id}-${columns[index]}`}>{cell || <span>Sin dato</span>}</td>
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

export default function InventoriesPanel({
  currentUser,
  records,
  role,
  transfers,
}: {
  currentUser: UserRecord;
  records: ArchivalRecord[];
  role: Role;
  transfers: DocumentaryTransfer[];
}) {
  const [view, setView] = useState<View>("select");
  const [type, setType] = useState<InventoryType>("tramite");
  const [selectedId, setSelectedId] = useState("");
  const canAllAreas =
    role === "Administrador / Coordinador" ||
    role === "Encargado de préstamos / Control archivístico";
  const groups = useMemo(() => {
    const all = groupRecords(records, transfers, type);
    if (role === "Administrador / Coordinador") return all;
    if (role === "Encargado de préstamos / Control archivístico")
      return type === "tramite"
        ? []
        : all.filter((group) => !group.transfer || group.transfer.status === "Aceptada");
    if (role === "Encargado de área")
      return all.filter((group) => group.header.areaId === currentUser.areaId);
    return all.filter(
      (group) =>
        group.header.areaId === currentUser.areaId &&
        group.records.every((record) => record.createdBy === currentUser.id),
    );
  }, [currentUser.areaId, currentUser.id, records, role, transfers, type]);
  const selected = groups.find((group) => group.id === selectedId);
  if (view === "select")
    return (
      <TypeSelection
        onSelect={(value) => {
          setType(value);
          setView("list");
        }}
      />
    );
  if (view === "preview" && selected)
    return <Preview group={selected} onBack={() => setView("list")} type={type} />;
  return (
    <InventoryList
      canAllAreas={canAllAreas}
      currentUser={currentUser}
      groups={groups}
      onBack={() => setView("select")}
      onOpen={(id) => {
        setSelectedId(id);
        setView("preview");
      }}
      type={type}
    />
  );
}
