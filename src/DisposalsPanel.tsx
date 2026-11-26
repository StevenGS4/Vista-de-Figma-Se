import { useEffect, useState } from "react";
import { ArrowLeft, Download, Plus, Search, X } from "lucide-react";
import { disposalApi, type DisposalDetail, type DisposalProposal, type DisposalRecord } from "./api";
import type { Role, UserRecord } from "./data";
import type { ArchivalRecord } from "./records";
import ConcentrationPanel from "./ConcentrationPanel";
import { homeToday } from "./homePending";

const statuses = {
  PROPUESTA: "Propuesta de baja",
  BAJA: "Baja definitiva",
  NO_PROCEDE: "No procede",
} as const;
const dateLabel = (value: string | null) => value ? value.split("-").reverse().join("/") : "—";
const message = (error: unknown) => error instanceof Error ? error.message : "No se pudo completar la operación.";

type DisposalTab = DisposalProposal["status"] | "available" | "mine";
const proposalTabs: {id: DisposalTab; label: string}[] = [
  { id: "available", label: "Expedientes disponibles" },
  { id: "PROPUESTA", label: "En propuesta" },
  { id: "BAJA", label: "Bajas definitivas" },
  { id: "NO_PROCEDE", label: "No procedieron" },
];

function AreaFilter({ records, area, onChange, placeholder }: {
  records: DisposalRecord[]; area: string; onChange: (area: string) => void; placeholder: string;
}) {
  const choices = [...new Map(records.map(record => [record.areaId, record.areaName])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1], "es"));
  return <label className="form-field max-w-xs"><span>Área</span>
    <select value={area} onChange={event => onChange(event.target.value)}>
      <option value="">{placeholder}</option>
      {choices.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
    </select>
  </label>;
}

function RecordsTable({ records, selection, toggle, showArea }: {
  records: DisposalRecord[];
  selection?: Set<string>;
  toggle?: (id: string) => void;
  showArea?: boolean;
}) {
  return <div className="table-scroll">
    <table className="data-table">
      <thead><tr>{toggle && <th>Elegir</th>}<th>Expediente</th>{showArea && <th>Área</th>}<th>Clasificación</th><th>Cierre</th><th>Vigencia total</th></tr></thead>
      <tbody>{records.map(record => <tr key={record.id}>
        {toggle && <td><input type="checkbox" className="accent-[#205b4d]" checked={selection?.has(record.id) ?? false}
          aria-label={`Seleccionar ${record.number} ${record.title}`} onChange={() => toggle(record.id)} /></td>}
        <td><strong>{record.title}</strong><small className="block text-[#526760]">{record.number}</small></td>
        {showArea && <td>{record.areaName}</td>}
        <td>{record.classification || record.code}</td><td>{dateLabel(record.closed)}</td><td>{record.retention || "—"}</td>
      </tr>)}</tbody>
    </table>
  </div>;
}

function NewProposal({ records, chooseArea, busy, onSubmit, onBack }: {
  records: DisposalRecord[]; chooseArea: boolean; busy: boolean; onSubmit: (ids: string[]) => void; onBack: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [area, setArea] = useState("");
  const [search, setSearch] = useState("");
  const [review, setReview] = useState(false);
  const query = search.trim().toLocaleLowerCase("es");
  const groups = new Map<string, DisposalRecord[]>();
  const chosen = records.filter(record => selected.has(record.id));
  for (const record of records) {
    if (chooseArea && record.areaId !== area) continue;
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

  return <>
    <button type="button" className="text-button justify-self-start" disabled={busy}
      onClick={review ? () => setReview(false) : onBack}>
      <ArrowLeft size={16} /> {review ? "Cambiar selección" : "Volver a Bajas"}
    </button>
    <section className="surface primary-builder__panel">
      <div className="primary-builder__heading"><div>
        <h3>{review ? "Revisar propuesta" : "Nueva propuesta de baja"}</h3>
        <p>{review ? "Verifica los expedientes del listado para Oficina Central." : chooseArea ? "Elige el área y los expedientes que propondrás para baja." : "Selecciona los expedientes de tu área que propondrás para baja."}</p>
      </div></div>
      <fieldset disabled={busy} className="grid gap-3 p-4">
        {review ? <RecordsTable records={chosen} showArea={chooseArea} /> : <>
          {chooseArea && <AreaFilter records={records} area={area} placeholder="Selecciona un área" onChange={value => {
            setArea(value);
            setSelected(new Set());
          }} />}
          <label className="search-box">
            <Search size={16} />
            <input type="search" aria-label="Buscar expedientes" placeholder="Buscar por nombre, número, sección o serie"
              value={search} onChange={event => setSearch(event.target.value)} />
          </label>
          {!groups.size && <p>{chooseArea && !area ? "Selecciona un área para ver sus expedientes." : "No hay expedientes disponibles que coincidan con la búsqueda."}</p>}
          {[...groups].map(([key, group]) => <details key={key} className="primary-builder__inventory" open={query ? true : undefined}>
            <summary className="cursor-pointer px-4 py-3 text-sm">
              <strong>{group[0].code} · {group[0].series}</strong> <span>· {group[0].section} · {group.length} expedientes</span>
            </summary>
            <RecordsTable records={group} selection={selected} toggle={toggle} />
          </details>)}
          {chosen.length > 0 && (
            <section className="overflow-hidden rounded-lg border border-[#b4c4bb]" aria-labelledby="disposal-selection-heading">
              <h4 id="disposal-selection-heading" className="bg-[#edf0ec] px-4 py-3 text-sm font-semibold text-[#243931]">
                Expedientes seleccionados
              </h4>
              <ul className="divide-y divide-[#d6dfd9]">
                {chosen.map(record => (
                  <li key={record.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <div className="min-w-0 break-words">
                      <strong className="block text-sm">{record.title || record.number}</strong>
                      <small className="text-[#526760]">{[record.number, record.code, record.series].filter(Boolean).join(" · ")}</small>
                    </div>
                    <button type="button" className="text-button" aria-label={`Quitar ${record.number} de la selección`}
                      onClick={() => toggle(record.id)}>
                      <X size={14} aria-hidden="true" /> Quitar
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span aria-live="polite">{selected.size} seleccionados</span>
          <button type="button" className="button button--primary" disabled={!selected.size}
            onClick={() => review ? onSubmit([...selected]) : setReview(true)}>
            {review ? "Registrar propuesta" : "Revisar selección"}
          </button>
        </div>
      </fieldset>
    </section>
  </>;
}

function ResolutionForm({ busy, onResolve }: {
  busy: boolean;
  onResolve: (decision: {status:"BAJA"|"NO_PROCEDE";date:string;reference:string;notes:string}) => void;
}) {
  const [status, setStatus] = useState<"" | "BAJA" | "NO_PROCEDE">("");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const today = homeToday();
  const earliest = new Date(today + "T00:00:00Z");
  earliest.setUTCDate(earliest.getUTCDate() - 90);
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
        <input type="date" required min={earliest.toISOString().slice(0, 10)} max={today} value={date} onChange={event => setDate(event.target.value)} />
        <small>Hasta 90 días anteriores a hoy.</small>
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

export default function DisposalsPanel({ currentUser, role, onDischarged }: {
  currentUser: UserRecord; role: Role; onDischarged: (ids: string[]) => void;
}) {
  const [proposals, setProposals] = useState<DisposalProposal[]>([]);
  const [detail, setDetail] = useState<DisposalDetail>();
  const [archive, setArchive] = useState<ArchivalRecord[]>();
  const [candidates, setCandidates] = useState<DisposalRecord[]>();
  const [tab, setTab] = useState<DisposalTab>("PROPUESTA");
  const [available, setAvailable] = useState<DisposalRecord[]>();
  const [availableArea, setAvailableArea] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const canResolve = role === "Administrador / Coordinador";
  const tabs = canResolve ? [...proposalTabs, { id: "mine" as const, label: "Mis bajas" }] : proposalTabs;
  const visibleProposals = proposals.filter(item => tab === "mine" ? item.requesterId === String(currentUser.id) : item.status === tab);
  const visibleAvailable = available?.filter(record => !availableArea || record.areaId === availableArea);

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

  if (canResolve && archive) return <>
    <button type="button" className="text-button mb-3" onClick={() => setArchive(undefined)}>
      <ArrowLeft size={16} /> Volver a propuestas
    </button>
    <ConcentrationPanel disposed currentUser={currentUser} role={role} records={archive}
      permissions={[]} onRecordsChange={setArchive} />
  </>;

  return <>
    <div className="records-page-heading">
      <div>
        <h2>Bajas</h2>
        <p>Propón expedientes de Concentración y consulta la resolución de cada solicitud.</p>
      </div>
      {!candidates && !detail && <div className="flex flex-wrap gap-2">
        {canResolve && <button type="button" className="button button--secondary" disabled={busy}
          onClick={() => void run(async () => setArchive((await disposalApi.archive()).records))}>
          Expedientes dados de baja
        </button>}
        <button type="button" className="button button--primary" disabled={busy}
          onClick={() => void run(async () => { setNotice(""); setCandidates((await disposalApi.candidates()).records); })}>
          <Plus size={17} /> Nueva propuesta
        </button>
      </div>}
    </div>
    <div className="primary-builder grid gap-4">
      {error && <p className="validation-summary" role="alert">{error}</p>}
      {notice && <p className="success-banner" role="status">{notice}</p>}
      {busy && <p role="status">Procesando…</p>}
      {candidates ? <NewProposal records={candidates} chooseArea={canResolve} busy={busy} onBack={() => setCandidates(undefined)}
        onSubmit={ids => void run(async () => {
          const created = await disposalApi.create(ids);
          setNotice(`Propuesta ${created.folio} registrada.`);
          setCandidates(undefined);
          setAvailable(undefined);
          setTab("PROPUESTA");
          await open(created.id);
          await refresh();
        })} /> : detail ? <>
        <button type="button" className="text-button justify-self-start" disabled={busy}
          onClick={() => { setDetail(undefined); void run(refresh); }}>
          <ArrowLeft size={16} /> Volver a Bajas
        </button>
        <section className="surface primary-builder__panel">
          <div className="primary-builder__heading">
            <div className="grow">
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
        {canResolve && detail.status === "PROPUESTA" && <ResolutionForm key={detail.id} busy={busy}
          onResolve={decision => void run(async () => {
            await disposalApi.resolve(detail.id, decision);
            setAvailable(undefined);
            if (decision.status === "BAJA") onDischarged(detail.records.map(record => record.id));
            setDetail(current => current && {...current,status:decision.status});
            setNotice(`Resolución de ${detail.folio} registrada.`);
            await open(detail.id);
            await refresh();
          })} />}
      </> : <section className="surface primary-builder__panel">
        <div className="primary-builder__heading flex-wrap">
          <div className="grow"><h3>Propuestas y resoluciones</h3><p>Consulta el estado y descarga la relación de expedientes de cada propuesta.</p></div>
        </div>
        <nav className="primary-builder__tabs m-4" aria-label="Vistas de Bajas">
          {tabs.map(item => <button key={item.id} type="button" className={tab === item.id ? "is-active" : ""}
            aria-pressed={tab === item.id} disabled={busy} onClick={() => {
              setTab(item.id);
              setError("");
              if (item.id === "available") void run(async () => {
                const { records } = await disposalApi.candidates();
                setAvailable(records);
                if (!records.some(record => record.areaId === availableArea)) setAvailableArea("");
              });
            }}>{item.label}</button>)}
        </nav>
        {tab === "available" ? <>
          {canResolve && available && <div className="px-4 pb-4">
            <AreaFilter records={available} area={availableArea} placeholder="Todas las áreas" onChange={setAvailableArea} />
          </div>}
          {visibleAvailable?.length ? <RecordsTable records={visibleAvailable} showArea={canResolve} />
            : !busy && !error && <p className="p-4">No hay expedientes disponibles para proponer.</p>}
        </> : <>
          <div className="table-scroll"><table className="data-table">
            <thead><tr><th>Folio</th><th>Área</th><th>Propuesta por</th><th>Fecha</th><th>Estado</th><th>Acción</th></tr></thead>
            <tbody>{visibleProposals.map(item => <tr key={item.id}>
              <td><strong>{item.folio}</strong></td><td>{item.area}</td><td>{item.requester}</td><td>{dateLabel(item.createdDate)}</td>
              <td>{statuses[item.status]}</td><td>{(canResolve || item.status !== "BAJA") && <button type="button" className="button button--secondary" disabled={busy}
                onClick={() => void run(async () => { setNotice(""); await open(item.id); })}>Ver detalle</button>}</td>
            </tr>)}</tbody>
          </table></div>
          {!busy && !visibleProposals.length && <p className="p-4">No hay propuestas en este estado.</p>}
        </>}
      </section>}
    </div>
  </>;
}
