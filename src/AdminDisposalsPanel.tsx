import { FormEvent, useEffect, useRef, useState } from "react";
import { Archive, Check, FilterX, Search, Trash2, X } from "lucide-react";
import { disposalApi } from "./api";
import type { DisposalInventory } from "./api";

const actFields = [
  ["folio_dictamen_agn","Folio del dictamen del AGN"],
  ["fecha_dictamen_agn","Fecha del dictamen","date"],
  ["folio_acta_agn","Folio del acta del AGN"],
  ["fecha_acta_agn","Fecha del acta del AGN","date"],
  ["referencia_inventario_autorizado","Referencia del inventario autorizado"],
  ["hora_inicio","Hora de inicio","time"],
  ["fecha_acta_extendida","Fecha del acta","date"],
  ["sede_y_domicilio","Sede y domicilio"],
  ["total_cajas","Total de cajas"],
  ["metros_lineales","Metros lineales"],
  ["peso_documental","Peso y unidad de medida"],
  ["fecha_ejecucion","Fecha de ejecución","date"],
  ["lugar_ejecucion","Lugar de ejecución"],
  ["metodo_disposicion","Método de disposición"],
  ["responsable_ejecucion","Responsable de ejecución"],
  ["referencia_evidencia","Referencia de evidencia"],
  ["observaciones","Observaciones"],
  ["hora_cierre","Hora de cierre","time"],
  ["fecha_cierre_extendida","Fecha de cierre","date"],
  ["nombre_responsable_concentracion","Responsable de Concentración"],
  ["nombre_firmante","Nombre de la persona firmante"],
  ["cargo_firmante","Cargo de la persona firmante"],
] as const;

const fieldGroups = [
  { title: "Autorización documental", fields: actFields.slice(0, 5) },
  { title: "Datos del acta", fields: actFields.slice(5, 11) },
  { title: "Ejecución de la baja", fields: actFields.slice(11, 17) },
  { title: "Cierre y firmas", fields: actFields.slice(17) },
];

export default function AdminDisposalsPanel() {
  const [inventories, setInventories] = useState<DisposalInventory[]>([]);
  const [search, setSearch] = useState("");
  const [area, setArea] = useState("");
  const [user, setUser] = useState("");
  const [filter, setFilter] = useState({ search: "", area: "", user: "" });
  const [selected, setSelected] = useState<DisposalInventory | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<{ administrator: string; folioSuffix: string } | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
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
    if (!selected || !dialog.current) return;
    if (!dialog.current.open) dialog.current.showModal();
    if (step === 2) {
      dialog.current.scrollTop = 0;
      dialog.current.querySelector<HTMLButtonElement>("[data-disposal-cancel]")?.focus();
    }
  }, [selected, step]);

  const areas = [...new Set(inventories.map(item => item.area))].sort();
  const users = new Map(inventories.map(item => [item.userId, item.userName]));
  const visible = inventories.filter(item =>
    (!filter.area || filter.area === item.area) &&
    (!filter.user || filter.user === item.userId) &&
    (!filter.search || [item.folio, item.area, item.userName].some(
      value => value.toLocaleLowerCase("es-MX").includes(filter.search)
    ))
  );

  async function openDraft(item: DisposalInventory) {
    setError("");
    setNotice("");
    setDraftLoading(true);
    try {
      const result = await disposalApi.draft(item.folio);
      setDraft(result);
      setFields(result.fields);
      setStep(1);
      setSelected(item);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No se pudo preparar el acta.");
    } finally {
      setDraftLoading(false);
    }
  }

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

  const hasFilters = Boolean(search || area || user || filter.search || filter.area || filter.user);

  return (
    <section aria-labelledby="disposals-title">
      <div className="records-page-heading">
        <div>
          <h2 id="disposals-title">Bajas de Archivo de Concentración</h2>
          <p>Selecciona un inventario para registrar su baja documental.</p>
        </div>
        <span className="access-chip"><Archive size={15} /> Inventarios de concentración</span>
      </div>

      {notice && <div className="toast" role="status"><Check size={18} />{notice}</div>}
      {error && !selected && <div className="inline-notice" role="alert">{error}</div>}

      <div className="surface records-table-card concentration-table-card">
        <div className="records-filter-head">
          <h3>Búsqueda de inventarios</h3>
        </div>
        <form className="records-filters" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 170px), 1fr))" }}
          onSubmit={event => {
            event.preventDefault();
            setFilter({ search: search.trim().toLocaleLowerCase("es-MX"), area, user });
          }}>
          <label className="search-box">
            <Search size={17} />
            <input aria-label="Buscar inventario" placeholder="Buscar inventario…" value={search}
              onChange={event => setSearch(event.target.value)} />
          </label>
          <label className="filter-select">
            <select aria-label="Área productora" value={area} onChange={event => setArea(event.target.value)}>
              <option value="">Todas las áreas</option>
              {areas.map(value => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label className="filter-select">
            <select aria-label="Usuario que registró el inventario" value={user} onChange={event => setUser(event.target.value)}>
              <option value="">Todos los usuarios</option>
              {[...users].sort((a, b) => a[1].localeCompare(b[1])).map(([id, name]) =>
                <option value={id} key={id}>{name}</option>
              )}
            </select>
          </label>
          <div className="modal__actions" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button className="button button--primary" type="submit"><Search size={16} />Buscar</button>
            <button className="clear-filters" type="button" disabled={!hasFilters} onClick={() => {
              setSearch(""); setArea(""); setUser("");
              setFilter({ search: "", area: "", user: "" });
            }}><FilterX size={16} />Limpiar</button>
          </div>
        </form>

        {loading ? (
          <div className="empty-state" role="status">Cargando inventarios…</div>
        ) : visible.length ? (
          <div className="table-scroll">
            <table className="data-table concentration-table">
              <thead>
                <tr><th>Inventario</th><th>Área</th><th>Usuario</th><th>Fecha</th><th>Expedientes</th><th>Acción</th></tr>
              </thead>
              <tbody>{visible.map(item => (
                <tr key={item.folio}>
                  <td><strong>{item.folio}</strong></td>
                  <td>{item.area}</td><td>{item.userName}</td><td>{item.date}</td><td>{item.total}</td>
                  <td>
                    <button className="button button--danger-outline" type="button" disabled={draftLoading} onClick={() => void openDraft(item)}><Trash2 size={16} />Dar de baja</button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : !error && (
          <div className="empty-state concentration-search-empty">
            <Search size={28} />
            <strong>No se encontraron inventarios para los filtros seleccionados.</strong>
          </div>
        )}
      </div>

      {selected && (
        <>
          <div aria-hidden="true" className="modal-backdrop" />
          <dialog ref={dialog} className={step === 1 ? "modal" : "archive-confirm-dialog"} aria-labelledby="disposal-dialog-title"
            aria-describedby={step === 2 ? "disposal-confirm-description" : undefined} onCancel={event => {
            event.preventDefault();
            cancel();
          }} style={{ position: "fixed", inset: 0, margin: "auto", maxHeight: "85vh", overflowY: "auto",
            ...(step === 1 ? { padding: 0, border: 0, width: "min(760px, 92vw)" } : { width: "min(440px, 92vw)" }) }}>
            <form onSubmit={submit}>
              {step === 1 ? <>
              <div className="modal__header" style={{ position: "sticky", top: 0, zIndex: 1, background: "var(--white)", borderTop: "3px solid var(--green-800)" }}>
                <div>
                  <span>Baja documental</span>
                  <h2 id="disposal-dialog-title">Datos del acta</h2>
                </div>
                <button aria-label="Cerrar" className="icon-action" type="button" disabled={busy} onClick={cancel}>
                  <X size={19} />
                </button>
              </div>
              <div className="modal__body">
                <p className="modal__intro">Inventario <strong>{selected.folio}</strong> · {selected.total} expedientes</p>
                <div className="form-grid">
                  <label className="form-field"><span>Área productora</span><input readOnly value={selected.area} /></label>
                  <label className="form-field"><span>Registró el inventario</span><input readOnly value={selected.userName} /></label>
                  <label className="form-field"><span>Administrador que registra la baja</span><input readOnly value={draft?.administrator ?? ""} /></label>
                  <label className="form-field"><span>Folio interno del acta</span>
                    <input readOnly value={draft && fields.fecha_acta_extendida
                      ? "BAJA-" + fields.fecha_acta_extendida.slice(0, 4) + "-" + draft.folioSuffix : ""} />
                  </label>
                </div>
                {fieldGroups.map(group => (
                  <section key={group.title} className="surface form-section">
                    <div className="form-section__title"><h3>{group.title}</h3></div>
                    <div className="form-grid">
                      {group.title === "Ejecución de la baja" && (
                        <label className="form-field"><span>Folio interno de registro</span>
                          <input readOnly value={draft && fields.fecha_acta_extendida
                            ? "EV-" + fields.fecha_acta_extendida.slice(0, 4) + "-" + draft.folioSuffix : ""} />
                        </label>
                      )}
                      {group.fields.map(([key, label, type]) => (
                        <label className="form-field" key={key}>
                          <span>{label}</span>
                          <input type={type ?? "text"} value={fields[key] ?? ""} maxLength={500}
                            required={key !== "observaciones"} onChange={event => setFields(values => ({
                              ...values, [key]: event.target.value,
                            }))} />
                        </label>
                      ))}
                    </div>
                  </section>
                ))}
                {error && <p className="inline-notice" role="alert">{error}</p>}
              </div>
              <div className="modal__footer" style={{ position: "sticky", bottom: 0 }}>
                <button className="button button--secondary" type="button" disabled={busy} onClick={cancel}>Cancelar</button>
                <button className="button button--danger" type="submit" disabled={busy}>
                  <Trash2 size={16} />
                  Dar de baja
                </button>
              </div>
              </> : <>
                <div className="archive-confirm-dialog__top">
                  <span className="archive-confirm-dialog__icon"><Trash2 size={22} aria-hidden="true" /></span>
                  <button aria-label="Cerrar" className="archive-confirm-dialog__close" type="button"
                    disabled={busy} onClick={cancel}><X size={19} /></button>
                </div>
                <h3 id="disposal-dialog-title">Confirmar baja documental</h3>
                <p id="disposal-confirm-description">
                  Se dará de baja el inventario <strong>{selected.folio}</strong> con {selected.total} expedientes.
                  La baja es definitiva.
                </p>
                {error && <p role="alert" style={{ color: "var(--wine-800)", marginTop: 12 }}>{error}</p>}
                <div className="archive-confirm-dialog__buttons">
                  <button className="button button--secondary" type="button" data-disposal-cancel
                    disabled={busy} onClick={cancel}>Cancelar</button>
                  <button className="button archive-confirm-dialog__danger" type="submit" disabled={busy}>
                    {busy ? "Registrando…" : "Confirmar baja"}
                  </button>
                </div>
              </>}
            </form>
          </dialog>
        </>
      )}
    </section>
  );
}
