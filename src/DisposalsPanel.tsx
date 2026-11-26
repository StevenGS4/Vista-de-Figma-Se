import { useEffect, useState } from "react";
import { ArrowLeft, Download, Plus, Search } from "lucide-react";
import { disposalApi, type DisposalDetail, type DisposalProposal, type DisposalRecord } from "./api";
import type { Role } from "./data";
import { homeToday } from "./homePending";

const statuses = {
  PROPUESTA: "Propuesta de baja",
  BAJA: "Baja definitiva",
  NO_PROCEDE: "No procede",
} as const;
const dateLabel = (value: string | null) => value ? value.split("-").reverse().join("/") : "—";
const message = (error: unknown) => error instanceof Error ? error.message : "No se pudo completar la operación.";

function RecordsTable({ records, selection, toggle }: {
  records: DisposalRecord[];
  selection?: Set<string>;
  toggle?: (id: string) => void;
}) {
  return <div className="table-scroll">
    <table className="data-table">
      <thead><tr>{toggle && <th>Elegir</th>}<th>Expediente</th><th>Clasificación</th><th>Cierre</th><th>Vigencia total</th></tr></thead>
      <tbody>{records.map(record => <tr key={record.id}>
        {toggle && <td><input type="checkbox" className="accent-[#205b4d]" checked={selection?.has(record.id) ?? false}
          aria-label={`Seleccionar ${record.number} ${record.title}`} onChange={() => toggle(record.id)} /></td>}
        <td><strong>{record.title}</strong><small className="block text-[#526760]">{record.number}</small></td>
        <td>{record.classification || record.code}</td><td>{dateLabel(record.closed)}</td><td>{record.retention || "—"}</td>
      </tr>)}</tbody>
    </table>
  </div>;
}

function NewProposal({ records, busy, onSubmit, onBack }: {
  records: DisposalRecord[]; busy: boolean; onSubmit: (ids: string[]) => void; onBack: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [search, setSearch] = useState("");
  const [review, setReview] = useState(false);
  const query = search.trim().toLocaleLowerCase("es");
  const groups = new Map<string, DisposalRecord[]>();
  const chosen = records.filter(record => selected.has(record.id));
  for (const record of records) {
    if (query && ![record.number, record.title, record.classification, record.series, record.section]
      .some(value => value?.toLocaleLowerCase("es").includes(query))) continue;
    const key = JSON.stringify([record.sectionCode, record.code]);
    const group = groups.get(key);
    if (group) group.push(record);
    else groups.set(key, [record]);
  }
  const toggle = (id: string) => setSelected(previous => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  return <section className="surface primary-builder__panel">
    <div className="primary-builder__heading"><div>
      <h3>{review ? "Revisar propuesta" : "Nueva propuesta de baja"}</h3>
      <p>{review ? "Verifica los expedientes del listado para Oficina Central." : "Selecciona los expedientes de tu área que propondrás para baja."}</p>
    </div></div>
    <fieldset disabled={busy} className="grid gap-3 p-4">
      {review ? <RecordsTable records={chosen} /> : <>
        <label className="search-box">
          <Search size={16} />
          <input type="search" aria-label="Buscar expedientes" placeholder="Buscar por nombre, número, sección o serie"
            value={search} onChange={event => setSearch(event.target.value)} />
        </label>
        {!groups.size && <p>No hay expedientes disponibles que coincidan con la búsqueda.</p>}
        {[...groups].map(([key, group]) => <details key={key} className="primary-builder__inventory" open={query ? true : undefined}>
          <summary className="cursor-pointer px-4 py-3 text-sm">
            <strong>{group[0].code} · {group[0].series}</strong> <span>· {group[0].section} · {group.length} expedientes</span>
          </summary>
          <RecordsTable records={group} selection={selected} toggle={toggle} />
        </details>)}
      </>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" className="text-button" onClick={review ? () => setReview(false) : onBack}><ArrowLeft size={16} /> {review ? "Cambiar selección" : "Volver a Bajas"}</button>
        <span aria-live="polite">{selected.size} seleccionados</span>
        <button type="button" className="button button--primary" disabled={!selected.size}
          onClick={() => review ? onSubmit([...selected]) : setReview(true)}>
          {review ? "Registrar propuesta" : "Revisar selección"}
        </button>
      </div>
    </fieldset>
  </section>;
}

function ResolutionForm({ proposal, busy, onResolve }: {
  proposal: DisposalDetail; busy: boolean;
  onResolve: (decision: {status:"BAJA"|"NO_PROCEDE";date:string;reference:string;notes:string}) => void;
}) {
  const [status, setStatus] = useState<"" | "BAJA" | "NO_PROCEDE">("");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  return <form className="surface grid gap-3 p-4" onSubmit={event => {
    event.preventDefault();
    if (status && confirmed && !busy) onResolve({status, reference, date, notes});
  }}>
    <h3 className="font-semibold">Registrar dictamen recibido</h3>
    <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-3">
      <label className="form-field"><span>Resultado</span>
        <select value={status} required onChange={event => { setStatus(event.target.value as typeof status); setConfirmed(false); }}>
          <option value="">Selecciona el resultado</option><option value="BAJA">Baja autorizada</option><option value="NO_PROCEDE">No procede</option>
        </select>
      </label>
      <label className="form-field"><span>Folio del dictamen</span>
        <input required maxLength={160} value={reference} onChange={event => setReference(event.target.value)} />
      </label>
      <label className="form-field"><span>Fecha del dictamen</span>
        <input type="date" required min={proposal.createdDate} max={homeToday()} value={date} onChange={event => setDate(event.target.value)} />
      </label>
      <label className="form-field sm:col-span-3"><span>Observaciones</span>
        <textarea rows={2} maxLength={2000} value={notes} onChange={event => setNotes(event.target.value)} />
      </label>
      {status && <label className="flex items-start gap-2 text-sm sm:col-span-3">
        <input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />
        {status === "BAJA" ? "Confirmo que el dictamen autoriza la baja de todos los expedientes de esta propuesta." : "Confirmo que el dictamen indica que la baja no procede."}
      </label>}
    </fieldset>
    <div className="flex justify-end"><button type="submit" className="button button--primary" disabled={busy || !confirmed}>Registrar resolución</button></div>
  </form>;
}

export default function DisposalsPanel({ role, onDischarged }: {
  role: Role; onDischarged: (ids: string[]) => void;
}) {
  const [proposals, setProposals] = useState<DisposalProposal[]>([]);
  const [detail, setDetail] = useState<DisposalDetail>();
  const [candidates, setCandidates] = useState<DisposalRecord[]>();
  const [status, setStatus] = useState<"" | DisposalProposal["status"]>("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const canPropose = role === "Encargado de área";
  const canResolve = role === "Administrador / Coordinador";

  const refresh = async () => setProposals((await disposalApi.list()).proposals);
  useEffect(() => {
    let active = true;
    disposalApi.list().then(result => { if (active) setProposals(result.proposals); })
      .catch(cause => { if (active) setError(message(cause)); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try { await action(); }
    catch (cause) { setError(message(cause)); }
    finally { setBusy(false); }
  };
  const open = async (id: string) => {
    setDetail((await disposalApi.detail(id)).proposal);
    setCandidates(undefined);
  };

  return <div className="primary-builder grid gap-4">
    {error && <p className="validation-summary" role="alert">{error}</p>}
    {notice && <p className="success-banner" role="status">{notice}</p>}
    {busy && <p role="status">Procesando…</p>}
    {candidates ? <NewProposal records={candidates} busy={busy} onBack={() => setCandidates(undefined)}
      onSubmit={ids => void run(async () => {
        const created = await disposalApi.create(ids);
        setNotice(`Propuesta ${created.folio} registrada.`);
        setCandidates(undefined);
        await open(created.id);
        await refresh();
      })} /> : detail ? <>
      <section className="surface primary-builder__panel">
        <div className="primary-builder__heading">
          <div className="grow">
            <button type="button" className="text-button" disabled={busy} onClick={() => { setDetail(undefined); void run(refresh); }}><ArrowLeft size={16} /> Volver a Bajas</button>
            <h3>{detail.folio} · {statuses[detail.status]}</h3>
            <p>{detail.area} · {detail.requester} · {dateLabel(detail.createdDate)}</p>
          </div>
          <button type="button" className="button button--secondary" disabled={busy} onClick={() => void run(() => disposalApi.download(detail))}><Download size={16} /> Descargar listado Excel</button>
        </div>
        <RecordsTable records={detail.records} />
        {detail.status !== "PROPUESTA" && <div className="grid gap-1 p-4 text-sm">
          <strong>Dictamen {detail.decisionReference} · {dateLabel(detail.decisionDate)}</strong>
          <p>Registró {detail.resolvedBy} · {dateLabel(detail.resolvedDate)}</p>
          {detail.notes && <p className="whitespace-pre-wrap">{detail.notes}</p>}
        </div>}
      </section>
      {canResolve && detail.status === "PROPUESTA" && <ResolutionForm key={detail.id} proposal={detail} busy={busy}
        onResolve={decision => void run(async () => {
          await disposalApi.resolve(detail.id, decision);
          if (decision.status === "BAJA") onDischarged(detail.records.map(record => record.id));
          setDetail(current => current && {...current,status:decision.status});
          setNotice(`Resolución de ${detail.folio} registrada.`);
          await open(detail.id);
          await refresh();
        })} />}
    </> : <section className="surface primary-builder__panel">
      <div className="primary-builder__heading flex-wrap">
        <div className="grow"><h3>Propuestas y resoluciones</h3><p>Consulta el estado y descarga la relación de expedientes de cada propuesta.</p></div>
        {canPropose && <button type="button" className="button button--primary" disabled={busy}
          onClick={() => void run(async () => { setNotice(""); setCandidates((await disposalApi.candidates()).records); })}><Plus size={16} /> Nueva propuesta</button>}
      </div>
      <div className="p-4">
        <label className="form-field max-w-xs"><span>Estado</span>
          <select value={status} onChange={event => setStatus(event.target.value as typeof status)}>
            <option value="">Todos los estados</option>
            {Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
      </div>
      <div className="table-scroll"><table className="data-table">
        <thead><tr><th>Folio</th><th>Área</th><th>Propuesta por</th><th>Fecha</th><th>Estado</th><th>Acción</th></tr></thead>
        <tbody>{proposals.filter(item => !status || item.status === status).map(item => <tr key={item.id}>
          <td><strong>{item.folio}</strong></td><td>{item.area}</td><td>{item.requester}</td><td>{dateLabel(item.createdDate)}</td>
          <td>{statuses[item.status]}</td><td><button type="button" className="button button--secondary" disabled={busy}
            onClick={() => void run(async () => { setNotice(""); await open(item.id); })}>Ver detalle</button></td>
        </tr>)}</tbody>
      </table></div>
      {!busy && !proposals.some(item => !status || item.status === status) && <p className="p-4">No hay propuestas en este estado.</p>}
    </section>}
  </div>;
}
