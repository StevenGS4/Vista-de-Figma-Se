import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Download,
  Eye, FileSpreadsheet, FilterX, FolderArchive, Search, ShieldCheck, SlidersHorizontal
} from "lucide-react";
import { type UserRecord, type Role, areaName, areas } from "./data";
import { primaryTransferApi, type PrimaryCandidate, type PrimaryFilters, type PrimaryPreviewRow, type PrimaryPeriod, type PrimarySelectionMode } from "./api";

const periods: {value:PrimaryPeriod;label:string;blocks:number}[]=[
 {value:"all",label:"Todas las fechas",blocks:0},
 {value:"week",label:"Semana",blocks:53},
 {value:"twoweeks",label:"Cada 14 días",blocks:27},
 {value:"fortnight",label:"Quincena (1–15 / 16–fin)",blocks:24},
 {value:"month",label:"Mes",blocks:12},
 {value:"bimester",label:"Bimestre",blocks:6},
 {value:"trimester",label:"Trimestre",blocks:4},
 {value:"fourmonth",label:"Cuatrimestre",blocks:3},
 {value:"semester",label:"Semestre",blocks:2},
 {value:"year",label:"Año completo",blocks:1},
 {value:"custom",label:"Rango personalizado",blocks:0},
];
const today=new Date();
const initial:PrimaryFilters={
 period:"all",year:today.getFullYear(),block:1,from:"",to:"",
 dateField:"inventory",stage:"ambos",selection:"all",area:"",creator:"",
 section:"",series:"",cadido:"",inventoryIds:[],recordIds:[],
};
const readable=(value:string)=>value?new Date(value.slice(0,10)+"T12:00:00").toLocaleDateString("es-MX"):"Sin fecha";
const itemSummary=(item:PrimaryCandidate)=>item.recordNumber+" · "+item.title;
const inventoryRows=(list:PrimaryCandidate[])=>{
 const groups=new Map<string,PrimaryCandidate[]>();
 for(const item of list)groups.set(item.inventoryId,[...(groups.get(item.inventoryId)||[]),item]);
 return [...groups.entries()];
};
type Preview={total:number;inventories:number;areas:number;records:PrimaryPreviewRow[];truncated:boolean};

export default function PrimaryTransferBuilder({
  currentUser,role,onBack,
}:{
  currentUser:UserRecord;role:Role;onBack:()=>void;
}){
 const isAdmin=role==="Administrador / Coordinador";
 const [draft,setDraft]=useState<PrimaryFilters>(initial);
 const [applied,setApplied]=useState<PrimaryFilters>(initial);
 const [dirty,setDirty]=useState(false);
 const [candidates,setCandidates]=useState<PrimaryCandidate[]>([]);
 const [creators,setCreators]=useState<{id:string;name:string}[]>([]);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState("");
 const [preview,setPreview]=useState<Preview|null>(null);
 const [previewBusy,setPreviewBusy]=useState(false);
 const [downloading,setDownloading]=useState(false);
 const [success,setSuccess]=useState("");
 const [keyword,setKeyword]=useState("");
 const [page,setPage]=useState(1);
 const [expanded,setExpanded]=useState<string[]>([]);
 const [selection,setSelection]=useState<PrimarySelectionMode>("all");
 const [inventories,setInventories]=useState<string[]>([]);
 const [records,setRecords]=useState<string[]>([]);
 const [tab,setTab]=useState<"filters"|"selection"|"preview">("filters");

 const change=<K extends keyof PrimaryFilters>(key:K,value:PrimaryFilters[K])=>{
  setDraft(prev=>({...prev,[key]:value}));setDirty(true);setPreview(null);
 };
 const load=async(filters:PrimaryFilters)=>{
  setLoading(true);setError("");setSuccess("");
  try{
   const data=await primaryTransferApi.options({...filters,selection:"all",inventoryIds:[],recordIds:[]});
   setCandidates(data.records);setCreators(data.creators);setApplied({...filters});
   setSelection("all");setInventories([]);setRecords([]);
   setPreview(null);setPage(1);setExpanded([]);setDirty(false);
   setTab("selection");
  }catch(e){setError(e instanceof Error?e.message:"No se pudieron consultar los expedientes.");}
  finally{setLoading(false);}
 };
 useEffect(()=>{void load(initial);},[]);
 useEffect(()=>{
  if(!success)return;
  const timeout=window.setTimeout(()=>setSuccess(""),4000);
  return ()=>window.clearTimeout(timeout);
 },[success]);
 const groups=useMemo(()=>inventoryRows(candidates),[candidates]);
 const filtered=useMemo(()=>groups.filter(([folio,rows])=>{
  const q=keyword.toLowerCase().trim();
  return !q||folio.toLowerCase().includes(q)||rows.some(r=>
   [r.title,r.recordNumber,r.archiveClassificationCode,areaName(r.areaId)]
    .some(value=>(value||"").toLowerCase().includes(q)));
 }),[groups,keyword]);
 const limit=8, pages=Math.max(1,Math.ceil(filtered.length/limit));
 const pageGroups=filtered.slice((page-1)*limit,page*limit);
 const options=periods.find(p=>p.value===draft.period)||periods[0];
 const sections=useMemo(()=>[...new Set(candidates.map(r=>
  r.archiveClassificationCode.split(".")[1]||"").filter(Boolean))].sort(),[candidates]);
 const series=useMemo(()=>[...new Set(candidates.map(r=>r.cadidoCode).filter(Boolean))].sort(),[candidates]);
 const activeSelection:PrimaryFilters={...applied,selection,inventoryIds:inventories,recordIds:records};
 const selectedSet=new Set(records);
 const inventorySet=new Set(inventories);
 const selectionCount=selection==="all"?candidates.length:
  candidates.filter(r=>
    (selection!=="records"&&inventorySet.has(r.inventoryId)) ||
    (selection!=="inventories"&&selectedSet.has(r.id))).length;
 const setMode=(mode:PrimarySelectionMode)=>{setSelection(mode);setPreview(null);};
 const toggleInventory=(folio:string)=>{
  setInventories(current=>current.includes(folio)?current.filter(x=>x!==folio):[...current,folio]);
  setPreview(null);
 };
 const toggleRecord=(id:string)=>{
  setRecords(current=>current.includes(id)?current.filter(x=>x!==id):[...current,id]);
  setPreview(null);
 };
 const validate=()=>!dirty&&(selection==="all"||selectionCount>0);
 const showPreview=async()=>{
  if(!validate()){setError(dirty?"Aplica los filtros antes de generar la vista previa.":"Selecciona al menos un expediente.");return;}
  setPreviewBusy(true);setError("");
  try{setPreview(await primaryTransferApi.preview(activeSelection));setTab("preview");}
  catch(e){setError(e instanceof Error?e.message:"No se pudo preparar la vista previa.");}
  finally{setPreviewBusy(false);}
 };
 const download=async()=>{
  if(!preview||!validate()){setError("Genera primero una vista previa actualizada.");return;}
  setDownloading(true);setError("");
  try{await primaryTransferApi.download(activeSelection);setSuccess("Inventario Excel descargado correctamente.");}
  catch(e){setError(e instanceof Error?e.message:"No se pudo descargar el Excel.");}
  finally{setDownloading(false);}
 };
 return <div className="primary-builder">
  <div className="record-form-top">
   <div>
    <button className="text-button" type="button" onClick={onBack}><ArrowLeft size={16}/> Volver a tipos de inventario</button>
    <h2>Relación de transferencia primaria</h2>
    <p>Construye una relación personalizada por fechas, área, usuarios, códigos CADIDO, inventarios y expedientes.</p>
   </div>
   <span className="record-mode"><FileSpreadsheet size={16}/> Reporte documental</span>
  </div>
  <section className="surface primary-builder__note">
   <ShieldCheck size={19}/>
   <span>La descarga genera un reporte institucional; no envía, autoriza, acepta ni cambia la etapa archivística de los expedientes. Los inventarios ya concentrados pueden incluirse como relación histórica.</span>
  </section>
  <nav className="primary-builder__tabs" aria-label="Pasos de preparación">
   <button type="button" className={tab==="filters"?"is-active":""} onClick={()=>setTab("filters")}><SlidersHorizontal size={16}/> 1. Filtros</button>
   <button type="button" className={tab==="selection"?"is-active":""} onClick={()=>setTab("selection")}><FolderArchive size={16}/> 2. Selección</button>
   <button type="button" className={tab==="preview"?"is-active":""} onClick={()=>setTab("preview")}><Eye size={16}/> 3. Vista previa</button>
  </nav>
  {error&&<div className="validation-summary" role="alert">{error}</div>}
  {success&&<div className="toast record-toast" role="status">{success}</div>}
  {tab==="filters"&&<section className="surface primary-builder__panel">
   <div className="primary-builder__heading"><CalendarDays size={18}/><div><h3>Filtrar documentación</h3><p>Combina fechas, clasificación y usuarios. Al aplicar los filtros se actualizan los inventarios disponibles.</p></div></div>
   <div className="primary-builder__filters">
    <label className="form-field"><span>Etapa documental</span><select value={draft.stage} onChange={e=>change("stage",e.target.value as PrimaryFilters["stage"])}>
     <option value="ambos">Trámite y concentración</option><option value="tramite">Solo en trámite</option><option value="concentracion">Solo en concentración</option>
    </select></label>
    <label className="form-field"><span>Fecha que se utilizará</span><select value={draft.dateField} onChange={e=>change("dateField",e.target.value as PrimaryFilters["dateField"])}>
     <option value="inventory">Elaboración del inventario</option><option value="opening">Apertura del expediente</option><option value="transfer">Envío de transferencia</option>
    </select></label>
    <label className="form-field"><span>Periodo</span><select value={draft.period} onChange={e=>{change("period",e.target.value as PrimaryPeriod);change("block",1);}}>
      {periods.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}
    </select></label>
    {draft.period!=="all"&&draft.period!=="custom"&&<label className="form-field"><span>Año</span><input type="number" min={1900} max={2200} value={draft.year} onChange={e=>change("year",Number(e.target.value))}/></label>}
    {options.blocks>1&&<label className="form-field"><span>{draft.period==="month"?"Mes":"Periodo número"}</span>
      <select value={draft.block} onChange={e=>change("block",Number(e.target.value))}>
       {Array.from({length:options.blocks},(_,i)=>i+1).map(n=><option key={n} value={n}>
        {draft.period==="month"?new Date(2026,n-1,1).toLocaleDateString("es-MX",{month:"long"}):"Periodo "+n}
       </option>)}
      </select></label>}
    {draft.period==="custom"&&<>
      <label className="form-field"><span>Desde</span><input type="date" value={draft.from} onChange={e=>change("from",e.target.value)}/></label>
      <label className="form-field"><span>Hasta</span><input type="date" value={draft.to} onChange={e=>change("to",e.target.value)}/></label>
    </>}
    <label className="form-field"><span>Área administrativa</span><select disabled={!isAdmin} value={isAdmin?draft.area:currentUser.areaId} onChange={e=>change("area",e.target.value)}>
      {isAdmin&&<option value="">Todas las áreas</option>}
      {areas.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
    </select></label>
    <label className="form-field"><span>Usuario creador</span><select disabled={role==="Personal de área"} value={draft.creator} onChange={e=>change("creator",e.target.value)}>
      <option value="">{role==="Personal de área"?"Solo mis inventarios":"Todos los usuarios autorizados"}</option>
      {creators.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
    </select></label>
    <label className="form-field"><span>Sección CADIDO</span><select value={draft.section} onChange={e=>change("section",e.target.value)}>
      <option value="">Todas las secciones</option>{sections.map(x=><option key={x} value={x}>{x}</option>)}
    </select></label>
    <label className="form-field"><span>Serie CADIDO</span><select value={draft.series} onChange={e=>change("series",e.target.value)}>
      <option value="">Todas las series</option>{series.map(x=><option key={x} value={x}>{x}</option>)}
    </select></label>
    <label className="form-field primary-builder__wide"><span>Buscar nomenclatura CADIDO</span>
     <input placeholder="Ej. SEMARNAT.1C.11" value={draft.cadido} onChange={e=>change("cadido",e.target.value)}/>
    </label>
   </div>
   <div className="primary-builder__toolbar">
    <button className="button button--secondary" type="button" onClick={()=>{setDraft(initial);setDirty(true);setPreview(null);}}><FilterX size={16}/> Limpiar filtros</button>
    <button className="button button--primary" type="button" disabled={loading} onClick={()=>void load(draft)}><Search size={16}/>{loading?"Consultando...":"Aplicar filtros y seleccionar"}</button>
   </div>
  </section>}
  {tab==="selection"&&<section className="surface primary-builder__panel">
   <div className="primary-builder__heading"><FolderArchive size={18}/><div>
    <h3>Seleccionar inventarios y expedientes</h3>
    <p>{groups.length} inventarios · {candidates.length} expedientes elegibles según los filtros aplicados.</p></div>
   </div>
   {dirty&&<div className="primary-builder__warning">Cambiaste filtros. Regresa al paso 1 y presiona «Aplicar filtros» antes de continuar.</div>}
   <div className="primary-builder__modes">
    {([
      ["all","Todos los expedientes"],
      ["inventories","Inventarios completos"],
      ["records","Expedientes individuales"],
      ["mixed","Selección mixta"],
    ] as [PrimarySelectionMode,string][]).map(([value,label])=>
      <button type="button" className={selection===value?"is-active":""} aria-pressed={selection===value} key={value}
       onClick={()=>setMode(value)}>{label}</button>)}
   </div>
   <div className="primary-builder__controls">
    <label className="search-box"><Search size={16}/><input value={keyword} onChange={e=>{setKeyword(e.target.value);setPage(1);}}
      placeholder="Buscar inventario, expediente, asunto o CADIDO..." aria-label="Buscar documentos"/></label>
    <strong>{selectionCount} expedientes seleccionados</strong>
   </div>
   {loading?<div className="primary-builder__empty">Consultando expedientes...</div>:
     !filtered.length?<div className="primary-builder__empty">No hay documentos que coincidan con los filtros o la búsqueda.</div>:
     <div className="primary-builder__inventory-list">
      {pageGroups.map(([folio,rows])=><article key={folio} className="primary-builder__inventory">
       <div className="primary-builder__inventory-head">
        {(selection==="inventories"||selection==="mixed")&&<input type="checkbox" aria-label={"Seleccionar inventario "+folio}
         checked={inventorySet.has(folio)} onChange={()=>toggleInventory(folio)}/>}
        <div className="primary-builder__inventory-title"><strong>{folio}</strong>
         <span>{areaName(rows[0].areaId)} · {rows.length} expedientes · {readable(rows[0].inventoryDate)}</span>
        </div>
        <button type="button" className="button button--secondary" onClick={()=>setExpanded(v=>v.includes(folio)?v.filter(x=>x!==folio):[...v,folio])}>
         {expanded.includes(folio)?"Ocultar":"Ver"} expedientes <ChevronDown size={15}/>
        </button>
       </div>
       {expanded.includes(folio)&&<div className="table-scroll"><table className="data-table">
        <thead><tr>{(selection==="records"||selection==="mixed")&&<th>Elegir</th>}<th>Expediente</th><th>Asunto</th><th>CADIDO</th><th>Etapa</th><th>Apertura</th></tr></thead>
        <tbody>{rows.map(row=><tr key={row.id}>
          {(selection==="records"||selection==="mixed")&&<td><input type="checkbox" aria-label={"Seleccionar expediente "+row.recordNumber}
           checked={selectedSet.has(row.id)} onChange={()=>toggleRecord(row.id)}/></td>}
          <td><strong>{row.recordNumber}</strong></td><td>{row.title}</td><td>{row.archiveClassificationCode||row.cadidoCode}</td>
          <td>{row.stage==="Archivo de concentración"?"Concentración":"Trámite"}</td><td>{readable(row.openDate)}</td>
        </tr>)}</tbody>
       </table></div>}
      </article>)}
     </div>}
   {filtered.length>limit&&<div className="primary-builder__pagination">
    <button type="button" disabled={page<=1} onClick={()=>setPage(p=>p-1)}><ChevronLeft size={16}/></button>
    <span>Página {page} de {pages}</span>
    <button type="button" disabled={page>=pages} onClick={()=>setPage(p=>p+1)}><ChevronRight size={16}/></button>
   </div>}
   <div className="primary-builder__toolbar">
    <button type="button" className="button button--secondary" onClick={()=>{setTab("filters");setPreview(null);}}><ArrowLeft size={16}/> Modificar filtros</button>
    <button type="button" className="button button--primary" disabled={previewBusy||loading||!validate()} onClick={()=>void showPreview()}>
      <Eye size={16}/>{previewBusy?"Preparando vista...":"Vista previa de la selección"}
    </button>
   </div>
  </section>}
  {tab==="preview"&&<section className="surface primary-builder__panel">
   <div className="primary-builder__heading"><Eye size={18}/><div><h3>Vista previa del consolidado</h3><p>Revisa los documentos que compondrán el archivo antes de descargarlo.</p></div></div>
   {!preview?<div className="primary-builder__empty">Genera la vista previa desde el paso 2 para comprobar tu selección.</div>:<>
    <div className="primary-builder__stats"><div><span>Expedientes</span><strong>{preview.total}</strong></div>
     <div><span>Inventarios</span><strong>{preview.inventories}</strong></div>
     <div><span>Áreas</span><strong>{preview.areas}</strong></div></div>
    <div className="table-scroll"><table className="data-table">
     <thead><tr><th>Inventario</th><th>Expediente</th><th>Asunto</th><th>CADIDO</th><th>Etapa</th><th>Fecha de apertura</th></tr></thead>
     <tbody>{preview.records.map(r=><tr key={r.id}>
       <td><strong>{r.inventoryId}</strong></td><td>{r.recordNumber}</td><td>{r.title}</td>
       <td>{r.archiveClassificationCode}</td><td>{r.stage==="Archivo de concentración"?"Concentración":"Trámite"}</td>
       <td>{readable(r.openDate)}</td>
     </tr>)}</tbody>
    </table></div>
    {preview.truncated&&<p className="primary-builder__warning">Vista previa de los primeros 250 expedientes. El XLSX contendrá los {preview.total} expedientes seleccionados.</p>}
    <p className="primary-builder__hint">La plantilla institucional conservará la agrupación por inventario dentro de un solo archivo Excel, con una hoja por inventario.</p>
   </>}
   <div className="primary-builder__toolbar">
    <button className="button button--secondary" type="button" onClick={()=>setTab("selection")}><ArrowLeft size={16}/> Volver a la selección</button>
    <button className="button button--primary" type="button" disabled={!preview||!preview.total||downloading} onClick={()=>void download()}>
     <Download size={16}/>{downloading?"Generando Excel...":"Descargar Excel seleccionado"}
    </button>
   </div>
  </section>}
 </div>;
}
