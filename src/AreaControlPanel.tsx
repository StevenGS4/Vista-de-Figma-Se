import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Eye, FileClock, Files, FolderArchive, Search, ShieldCheck, Users } from "lucide-react";
import { areaControlApi, type AreaStaffDetail, type AreaStaffSummary } from "./api";
import { areaName, areas } from "./data";
import RowActionsMenu from "./RowActionsMenu";

const readableDate=(date?:string|null)=>date?new Date(date.slice(0,10)+"T12:00:00").toLocaleDateString("es-MX"):"Sin registro";
const statusWord=(value:string)=>value==="ACTIVO"?"Activo":value;
const displayTime=(date:string)=>date?date.replace("T"," ").slice(0,16):"Sin registro";

export default function AreaControlPanel({ mode }: {mode:"area"|"admin"}) {
  const [users,setUsers]=useState<AreaStaffSummary[]>([]);
  const [chosen,setChosen]=useState<AreaStaffDetail|null>(null);
  const [chosenId,setChosenId]=useState("");
  const [loading,setLoading]=useState(true);
  const [detailLoading,setDetailLoading]=useState(false);
  const [error,setError]=useState("");
  const [query,setQuery]=useState("");
  const [areaFilter,setAreaFilter]=useState("");
  const [page,setPage]=useState(1);
  const [detailTab,setDetailTab]=useState<"inventories"|"records"|"transfers"|"activity">("inventories");
  useEffect(()=>{
    let active=true;
    setLoading(true);
    areaControlApi.list(areaFilter)
      .then(rows=>{if(active){setUsers(rows);setError("");}})
      .catch(e=>{if(active){setUsers([]);setError(e instanceof Error?e.message:"No fue posible consultar el personal.");}})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[areaFilter]);
  const openDetail=async(id:string)=>{
    setChosenId(id);setChosen(null);setDetailLoading(true);setError("");
    try{
      const data=await areaControlApi.detail(id);
      setChosen(data);setDetailTab("inventories");
    }catch(e){setError(e instanceof Error?e.message:"No fue posible cargar la información del usuario.");}
    finally{setDetailLoading(false);}
  };
  const back=()=>{setChosenId("");setChosen(null);setError("");};
  const matches=useMemo(()=>users.filter(user=>
    [user.name,user.email,user.areaName].some(v=>v.toLowerCase().includes(query.toLowerCase().trim()))
  ),[users,query]);
  const pageCount=Math.max(1,Math.ceil(matches.length/8));
  const pageUsers=matches.slice((page-1)*8,page*8);
  useEffect(()=>setPage(1),[query,areaFilter]);

  if(chosenId){
    return <div className="area-control">
      <button type="button" className="text-button" onClick={back}><ArrowLeft size={16}/> Volver al personal</button>
      {error&&<div className="validation-summary" role="alert">{error}</div>}
      {detailLoading&&<div className="area-control__empty">Consultando historial del usuario...</div>}
      {chosen&&!detailLoading&&<>
        <div className="surface area-control__hero">
          <div className="area-control__avatar"><Users size={24}/></div>
          <div className="area-control__identity">
            <small>Expediente de actividad del personal</small>
            <h2>{chosen.user.name}</h2>
            <p>{chosen.user.email} · {chosen.user.areaName}</p>
            <span>{chosen.user.status}</span>
          </div>
        </div>
        <div className="area-control__stats">
          <div><span>Archivos de trámite activos</span><strong>{chosen.user.activeInventories}</strong></div>
          <div><span>Inventarios enviados a concentración</span><strong>{chosen.user.transferredInventories}</strong></div>
          <div><span>Expedientes relacionados</span><strong>{chosen.records.length}</strong></div>
          <div><span>Movimientos de bitácora consultados</span><strong>{chosen.activity.length}</strong></div>
        </div>
        <div className="admin-tabs area-control__tabs" role="tablist" aria-label="Seguimiento documental">
          {([
            ["inventories","Archivos de trámite",Files],
            ["records","Expedientes",ClipboardList],
            ["transfers","Transferencias",FolderArchive],
            ["activity","Bitácora",FileClock],
          ] as const).map(([id,label,Icon])=><button key={id} role="tab"
            aria-selected={detailTab===id} className={detailTab===id?"is-active":""}
            type="button" onClick={()=>setDetailTab(id)}><Icon size={16}/>{label}</button>)}
        </div>
        <section className="surface area-control__table">
          <div className="area-control__section-head">
            <h3>{detailTab==="inventories"?"Inventarios registrados":detailTab==="records"?"Expedientes relacionados":detailTab==="transfers"?"Transferencias enviadas":"Bitácora cronológica"}</h3>
            <span>Consulta de solo lectura</span>
          </div>
          <div className="table-scroll">
          {detailTab==="inventories"?<table className="data-table">
            <thead><tr><th>Inventario</th><th>Fecha de elaboración</th><th>Expedientes activos</th><th>Estado</th></tr></thead>
            <tbody>{chosen.inventories.map(x=><tr key={x.id}><td><strong>{x.folio}</strong></td><td>{readableDate(x.openedAt)}</td><td>{x.recordCount}</td><td>{x.status}</td></tr>)}</tbody>
          </table>:detailTab==="records"?<table className="data-table">
            <thead><tr><th>Expediente</th><th>Asunto</th><th>Inventario</th><th>Apertura</th><th>Cierre</th><th>Etapa</th></tr></thead>
            <tbody>{chosen.records.map(x=><tr key={x.id}><td><strong>{x.recordNumber}</strong></td><td>{x.title}</td><td>{x.inventoryFolio}</td><td>{readableDate(x.openedAt)}</td><td>{readableDate(x.closedAt)}</td><td>{x.status}</td></tr>)}</tbody>
          </table>:detailTab==="transfers"?<table className="data-table">
            <thead><tr><th>Transferencia</th><th>Inventario</th><th>Fecha de envío</th><th>Fecha de aceptación</th><th>Estado</th></tr></thead>
            <tbody>{chosen.transfers.map(x=><tr key={x.id+"-"+x.inventoryFolio}><td><strong>{x.folio}</strong></td><td>{x.inventoryFolio}</td><td>{readableDate(x.sentAt)}</td><td>{readableDate(x.acceptedAt)}</td><td>{statusWord(x.status)}</td></tr>)}</tbody>
          </table>:<table className="data-table">
            <thead><tr><th>Fecha y hora</th><th>Movimiento</th><th>Referencia</th><th>Origen</th></tr></thead>
            <tbody>{chosen.activity.map(x=><tr key={x.key}><td>{displayTime(x.date)}</td><td><strong>{x.action.replace(/_/g," ")}</strong></td><td>{x.detail}</td><td>{x.source}</td></tr>)}</tbody>
          </table>}
          </div>
          {((detailTab==="inventories"&&!chosen.inventories.length)||
            (detailTab==="records"&&!chosen.records.length)||
            (detailTab==="transfers"&&!chosen.transfers.length)||
            (detailTab==="activity"&&!chosen.activity.length))&&
            <p className="area-control__empty">No hay movimientos registrados para esta categoría.</p>}
          <p className="area-control__note">Las relaciones se muestran a partir de registros archivísticos y movimientos disponibles en el historial. No se alteran los expedientes.</p>
        </section>
      </>}
    </div>;
  }
  return <div className="area-control">
    <section className="surface area-control__table">
      <div className="area-control__section-head">
        <div><h3>{mode==="area"?"Personal de mi área":"Seguimiento del personal por área"}</h3>
          <p>{mode==="area"?"Consulta de usuarios y movimientos documentales del área a tu cargo.":"Consulta institucional de actividad por usuario y área administrativa."}</p></div>
        <span className="area-control__count"><ShieldCheck size={15}/> Solo lectura</span>
      </div>
      <div className="area-control__filters">
        <label className="search-box"><Search size={17}/>
          <input aria-label="Buscar usuario" placeholder="Buscar por nombre, correo o área..."
            value={query} onChange={e=>setQuery(e.target.value)}/>
        </label>
        {mode==="admin"&&<label className="area-control__area-filter">
          <span>Área administrativa</span>
          <select value={areaFilter} onChange={e=>setAreaFilter(e.target.value)}>
            <option value="">Todas las áreas</option>
            {areas.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>}
      </div>
      {error&&<div className="validation-summary" role="alert">{error}</div>}
      {loading?<div className="area-control__empty">Consultando personal autorizado...</div>:
        <div className="table-scroll"><table className="data-table">
          <thead><tr><th>Usuario</th><th>Correo</th><th>Área</th><th>Trámite activos</th><th>Enviados a concentración</th><th>Acciones</th></tr></thead>
          <tbody>{pageUsers.map(user=><tr key={user.id}>
            <td><strong>{user.name}</strong><small className="area-control__status">{user.status}</small></td>
            <td>{user.email}</td><td>{user.areaName}</td>
            <td><strong>{user.activeInventories}</strong></td>
            <td><strong>{user.transferredInventories}</strong></td>
            <td><RowActionsMenu label={"Acciones para "+user.name}
              actions={[{label:"Ver detalle y bitácora",icon:<Eye size={16}/>,onSelect:()=>void openDetail(user.id)}]}/></td>
          </tr>)}</tbody>
        </table></div>}
      {!loading&&!matches.length&&<p className="area-control__empty">No hay usuarios que coincidan con los filtros.</p>}
      {!loading&&matches.length>0&&<div className="area-control__pagination">
        <span>Mostrando {(page-1)*8+1}–{Math.min(page*8,matches.length)} de {matches.length}</span>
        <div><button type="button" aria-label="Página anterior" disabled={page<=1}
          onClick={()=>setPage(p=>p-1)}><ChevronLeft size={17}/></button>
          <span>Página {page} de {pageCount}</span>
          <button type="button" aria-label="Página siguiente" disabled={page>=pageCount}
            onClick={()=>setPage(p=>p+1)}><ChevronRight size={17}/></button></div>
      </div>}
    </section>
  </div>;
}
