import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArchiveRestore, CalendarDays, Files, FolderTree, Search, Trash2 } from "lucide-react";
import { tramiteApi } from "./api";
import type { ArchivalRecord } from "./records";
import RowActionsMenu from "./RowActionsMenu";
import { useConfirmAction } from "./useConfirmAction";

type TrashItem = { kind: "inventory" | "record"; key: string; folio: string; date: string; records: ArchivalRecord[] };
const day = (value: string) => value ? value.slice(0, 10) : "Sin fecha";
const expiryLabel = (value: string) => {
  const parsed = new Date(String(value || "").replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return "Fecha de eliminación no disponible";
  parsed.setDate(parsed.getDate() + 60);
  return parsed.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
};
const dateLabel = (value: string) => {
  if (value === "Sin fecha") return value;
  const parsed = new Date(value + "T12:00:00");
  return Number.isNaN(parsed.getTime()) ? value :
    parsed.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
};
export default function TramiteTrash({
  onBack,
  onChange,
}: {
  onBack: () => void;
  onChange: () => Promise<void>;
}) {
  const [records, setRecords] = useState<ArchivalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const { confirm, dialog } = useConfirmAction();

  const load = async () => {
    setLoading(true);
    try {
      setRecords(await tramiteApi.trash());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo consultar la papelera.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 4000);
    return () => window.clearTimeout(timer);
  }, [message]);

  const items = useMemo(() => {
    const groups = new Map<string, TrashItem>();
    for (const record of records) {
      const inventoryGone = Boolean(record.inventoryDeletedAt);
      const key = inventoryGone ? "inventory:"+record.inventoryId : "record:"+record.id;
      const current = groups.get(key);
      if (current) current.records.push(record);
      else groups.set(key, {
        kind: inventoryGone ? "inventory" : "record",
        key, folio: record.inventoryId,
        date: inventoryGone ? record.inventoryDeletedAt! : record.recordDeletedAt!,
        records: [record],
      });
    }
    return [...groups.values()].sort((a,b) => b.date.localeCompare(a.date));
  }, [records]);
  const visible = items.filter(item =>
    !search.trim() || [item.folio,...item.records.flatMap(r=>[r.recordNumber,r.title,r.archiveClassificationCode])]
      .some(value=>String(value||"").toLowerCase().includes(search.toLowerCase().trim()))
  );
  const grouped = new Map<string, TrashItem[]>();
  visible.forEach(item => {
    const label = day(item.date);
    grouped.set(label, [...(grouped.get(label) || []), item]);
  });

  const perform = async (prompt: string, fn: () => Promise<unknown>, success: string) => {
    if (busy) return;
    const agreed = await confirm({
      title: prompt.includes("DEFINITIVAMENTE") ? "Eliminación definitiva" :
        prompt.startsWith("¿Restaurar") ? "Restaurar elemento" : "Confirmar operación",
      message: prompt,
      danger: prompt.includes("DEFINITIVAMENTE"),
      confirmText: prompt.startsWith("¿Restaurar") ? "Restaurar" : "Confirmar",
    });
    if (!agreed) return;
    setBusy(true); setError("");
    try {
      await fn();
      await onChange();
      await load();
      setMessage(success);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar la operación.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tramite-trash">
      <div className="records-page-heading">
        <div>
          <button type="button" className="text-button" onClick={onBack}>
            <ArrowLeft size={17}/> Volver a archivos activos
          </button>
          <h2>Papelera de reciclaje</h2>
          <p>Inventarios y expedientes retirados, agrupados por fecha. Permanecen 60 días desde su última eliminación; después se depuran automáticamente si no tienen restricciones documentales.</p>
        </div>
        <button
          type="button"
          className="button button--secondary"
          disabled={busy || !items.length}
          onClick={() => void perform(
            "¿Eliminar DEFINITIVAMENTE todo el contenido visible para tu área en la papelera? Esta acción no se puede deshacer.",
            tramiteApi.emptyTrash,
            "Papelera vaciada correctamente.",
          )}
        ><Trash2 size={16}/> Vaciar papelera</button>
      </div>
      {message && <div className="toast" role="status"><ArchiveRestore size={16}/>{message}</div>}
      {error && <div className="validation-summary" role="alert">{error}</div>}
      <section className="surface records-table-card">
        <div className="records-filter-head">
          <div><h3>Elementos eliminados</h3><p>{items.length} elementos recuperables</p></div>
          <label className="search-box"><Search size={16}/>
            <input aria-label="Buscar en papelera" value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Buscar expediente o inventario..." />
          </label>
        </div>
        {loading ? <div className="empty-state">Cargando papelera...</div> :
          !visible.length ? <div className="empty-state"><Trash2 size={28}/>
            <strong>{items.length ? "Sin coincidencias" : "La papelera está vacía"}</strong>
            <p>{items.length ? "Prueba con otro término." : "Los inventarios eliminados aparecerán aquí."}</p>
          </div> : [...grouped.entries()].map(([date,rows])=>(
            <div className="tramite-trash__day" key={date}>
              <div className="tramite-trash__day-title"><CalendarDays size={17}/>{dateLabel(date)}</div>
              {rows.map(item=>{
                const first=item.records[0], inventory=item.kind==="inventory";
                const title=inventory ? "Archivo de trámite completo" : "Expediente individual";
                return <div className="tramite-trash__item" key={item.key}>
                  <span className="tramite-trash__icon">{inventory?<FolderTree size={19}/>:<Files size={19}/>}</span>
                  <div className="tramite-trash__info">
                    <strong>{title}</strong>
                    <span>{inventory ? item.folio : first.recordNumber+" · "+item.folio}</span>
                    <small>{inventory
                      ? item.records.length+" expediente(s): "+item.records.map(r=>r.recordNumber).join(", ")
                      : first.title}</small>
                    <small>Eliminación automática a partir del {expiryLabel(item.date)}, salvo restricciones documentales.</small>
                  </div>
                  <RowActionsMenu label={"Acciones para "+(inventory?item.folio:first.recordNumber)}
                    actions={[
                      {label:"Restaurar",icon:<ArchiveRestore size={16}/>,onSelect:()=>void perform(
                        "¿Restaurar "+(inventory?"el archivo de trámite completo":"el expediente")+"?",
                        ()=>inventory?tramiteApi.restoreInventory(item.folio):tramiteApi.restoreRecord(first.id),
                        "Elemento restaurado correctamente.",
                      )},
                      {label:"Eliminar definitivamente",icon:<Trash2 size={16}/>,danger:true,
                        onSelect:()=>void perform(
                          "¿Eliminar DEFINITIVAMENTE "+(inventory?"el inventario y todos sus expedientes":"este expediente")+"? No podrás recuperarlo.",
                          ()=>inventory?tramiteApi.purgeInventory(item.folio):tramiteApi.purgeRecord(first.id),
                          "Elemento eliminado definitivamente.",
                        )},
                    ]}
                  />
                </div>;
              })}
            </div>
          ))}
      </section>
      {dialog}
    </div>
  );
}
