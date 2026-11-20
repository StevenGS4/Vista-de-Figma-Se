import { FormEvent, useEffect, useRef, useState } from "react";
import { disposalApi } from "./api";
import type { DisposalInventory } from "./api";

const actFields = [["folio_dictamen_agn","Folio del dictamen del AGN"],["fecha_dictamen_agn","Fecha del dictamen","date"],["folio_acta_agn","Folio del acta del AGN"],["fecha_acta_agn","Fecha del acta del AGN","date"],["referencia_inventario_autorizado","Referencia del inventario autorizado"],["hora_inicio","Hora de inicio","time"],["fecha_acta_extendida","Fecha del acta","date"],["sede_y_domicilio","Sede y domicilio"],["total_cajas","Total de cajas"],["metros_lineales","Metros lineales"],["peso_documental","Peso y unidad de medida"],["fecha_ejecucion","Fecha de ejecución","date"],["lugar_ejecucion","Lugar de ejecución"],["metodo_disposicion","Método de disposición"],["responsable_ejecucion","Responsable de ejecución"],["referencia_evidencia","Referencia de evidencia"],["observaciones","Observaciones"],["hora_cierre","Hora de cierre","time"],["fecha_cierre_extendida","Fecha de cierre","date"],["nombre_responsable_concentracion","Responsable de Concentración"],["nombre_firmante","Nombre de la persona firmante"],["cargo_firmante","Cargo de la persona firmante"]] as const;

export default function AdminDisposalsPanel() {
  const [inventories, setInventories] = useState<DisposalInventory[]>([]);
  const [search, setSearch] = useState("");
  const [area, setArea] = useState("");
  const [user, setUser] = useState("");
  const [filter, setFilter] = useState({ search: "", area: "", user: "" });
  const [selected, setSelected] = useState<DisposalInventory | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let mounted = true;
    disposalApi.list().then(result => {
      if (mounted) setInventories(result.inventories);
    }).catch((failure: Error) => {
      if (mounted) setError(failure.message);
    }).finally(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (selected && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [selected]);

  const areas = [...new Set(inventories.map(item => item.area))].sort();
  const users = new Map(inventories.map(item => [item.userId, item.userName]));
  const visible = inventories.filter(item =>
    (!filter.area || filter.area === item.area) &&
    (!filter.user || filter.user === item.userId) &&
    (!filter.search || [item.folio, item.area, item.userName].some(
      value => value.toLocaleLowerCase("es-MX").includes(filter.search)
    ))
  );

  function cancel() {
    if (busy) return;
    setSelected(null);
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || busy) return;
    if (step === 1) {
      setStep(2);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const file = await disposalApi.confirm(selected.folio, { observaciones: "", ...fields });
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = "Acta-" + selected.folio.replace(/[^a-zA-Z0-9_-]/g, "_") + ".docx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      setInventories(items => items.filter(item => item.folio !== selected.folio));
      setSelected(null);
      setNotice("Se inició la descarga de tu acta de baja documental.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No se pudo registrar la baja.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="disposals-title">
      <h2 id="disposals-title">Bajas de Archivo de Concentración</h2>
      <form className="form-grid" onSubmit={event => {
        event.preventDefault();
        setFilter({ search: search.trim().toLocaleLowerCase("es-MX"), area, user });
      }}>
        <label>Área productora
          <select value={area} onChange={event => setArea(event.target.value)}>
            <option value="">Todas las áreas</option>
            {areas.map(value => <option key={value}>{value}</option>)}
          </select>
        </label>
        <label>Usuario que registró el inventario
          <select value={user} onChange={event => setUser(event.target.value)}>
            <option value="">Todos los usuarios</option>
            {[...users].sort((a,b) => a[1].localeCompare(b[1])).map(([id, name]) =>
              <option value={id} key={id}>{name}</option>
            )}
          </select>
        </label>
        <label>Buscar inventario
          <input value={search} onChange={event => setSearch(event.target.value)} />
        </label>
        <div>
          <button className="primary-button" type="submit">Buscar</button>
          <button className="secondary-button" type="button" onClick={() => {
            setSearch(""); setArea(""); setUser("");
            setFilter({ search: "", area: "", user: "" });
          }}>Limpiar</button>
        </div>
      </form>

      {notice && <div className="toast" role="status">{notice}</div>}
      {error && !selected && <p role="alert">{error}</p>}
      {loading ? <p role="status">Cargando inventarios…</p> : visible.length ? (
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Inventario</th><th>Área</th><th>Usuario</th><th>Fecha</th><th>Total de expedientes</th><th>Acción</th></tr></thead>
            <tbody>{visible.map(item => (
              <tr key={item.folio}>
                <td>{item.folio}</td><td>{item.area}</td><td>{item.userName}</td><td>{item.date}</td><td>{item.total}</td>
                <td><button className="secondary-button" type="button" onClick={() => {
                  setFields({}); setStep(1); setError(""); setNotice(""); setSelected(item);
                }}>Dar de baja</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : !error && <p>No se encontraron inventarios para los filtros seleccionados.</p>}

      {selected && (
        <dialog ref={dialog} aria-labelledby="disposal-dialog-title" onCancel={event => {
          event.preventDefault(); cancel();
        }} style={{ position: "fixed", inset: 0, margin: "auto", padding: "1.5rem", maxHeight: "85vh", width: step === 1 ? "min(760px, 92vw)" : "min(460px, 92vw)" }}>
          <form onSubmit={submit}>
            <h2 id="disposal-dialog-title">{step === 1 ? "Datos del acta de baja" : "¿Estás seguro de que quieres dar de baja?"}</h2>
            <p>Inventario {selected.folio} · {selected.total} expedientes</p>
            {step === 1 ? (
              <div className="form-grid">{actFields.map(([key, label, type]) => (
                <label key={key}>{label}
                  <input type={type ?? "text"} value={fields[key] ?? ""} maxLength={500}
                    required={key !== "observaciones"} onChange={event => setFields(values => ({
                      ...values, [key]: event.target.value,
                    }))} />
                </label>
              ))}</div>
            ) : <p>La baja se aplicará a todo el inventario y es definitiva.</p>}
            {error && <p role="alert">{error}</p>}
            <div className="modal__actions">
              <button className="secondary-button" type="button" disabled={busy} onClick={cancel}>Cancelar</button>
              <button className="primary-button" type="submit" disabled={busy}>
                {busy ? "Registrando…" : step === 1 ? "Dar de baja" : "Confirmar"}
              </button>
            </div>
          </form>
        </dialog>
      )}
    </section>
  );
}
