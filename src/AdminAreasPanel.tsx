import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, FilePlus2, FolderTree, Pencil, Plus, Search, ShieldCheck } from "lucide-react";
import { adminCatalogApi, AdminArea, AdminManager, AdminSeries, AdminVersion, areasApi } from "./api";
import { setAreasCatalog } from "./data";

type View="list"|"edit"|"assign";
const blank:AdminArea={id:"",name:"",parent:"",parentId:"",manager:"",managerId:null};

export default function AdminAreasPanel(){
 const [items,setItems]=useState<AdminArea[]>([]);
 const [managers,setManagers]=useState<AdminManager[]>([]);
 const [versions,setVersions]=useState<AdminVersion[]>([]);
 const [view,setView]=useState<View>("list");
 const [editing,setEditing]=useState(false);
 const [form,setForm]=useState<AdminArea>(blank);
 const [selected,setSelected]=useState<AdminArea|null>(null);
 const [year,setYear]=useState(2023);
 const [series,setSeries]=useState<AdminSeries[]>([]);
 const [chosen,setChosen]=useState<number[]>([]);
 const [filter,setFilter]=useState("");
 const [onlyEnabled,setOnlyEnabled]=useState(false);
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState("");
 const [success,setSuccess]=useState("");
 const [showYear,setShowYear]=useState(false);
 const [newYear,setNewYear]=useState("");
 const [newYearName,setNewYearName]=useState("");
 const [newRef,setNewRef]=useState("");
 const [showSeries,setShowSeries]=useState(false);
 const [newCode,setNewCode]=useState("");
 const [newName,setNewName]=useState("");
 const [newSection,setNewSection]=useState("");
 const clear=()=>{setError("");setSuccess("");};
 const refresh=async()=>{
  const [a,m,v]=await Promise.all([adminCatalogApi.areas(),adminCatalogApi.managers(),adminCatalogApi.versions()]);
  setItems(a);setManagers(m);setVersions(v);
  setAreasCatalog(await areasApi.list());
 };
 useEffect(()=>{let cancelled=false;
  Promise.all([adminCatalogApi.areas(),adminCatalogApi.managers(),adminCatalogApi.versions()])
   .then(([a,m,v])=>{if(!cancelled){setItems(a);setManagers(m);setVersions(v);setYear(v.some(x=>x.year===2023)?2023:v[0]?.year??2023);}})
   .catch(e=>{if(!cancelled)setError(e.message||"No se pudieron cargar las áreas");})
   .finally(()=>{if(!cancelled)setLoading(false);});
  return()=>{cancelled=true;};
 },[]);
 const edit=(area?:AdminArea)=>{clear();setEditing(Boolean(area));setForm(area?{...area}: {...blank});setView("edit");};
 const assign=async(area:AdminArea)=>{
  clear();setSelected(area);setView("assign");setFilter("");setOnlyEnabled(false);setLoading(true);
  try{const rows=await adminCatalogApi.series(year,area.id);setSeries(rows);setChosen(rows.filter(x=>x.enabled).map(x=>x.id));}
  catch(e){setError(e instanceof Error?e.message:"No se pudo consultar CADIDO");}
  finally{setLoading(false);}
 };
 const changeYear=async(value:number)=>{
  setYear(value);setFilter("");setOnlyEnabled(false);clear();
  if(!selected)return;
  setLoading(true);
  try{const rows=await adminCatalogApi.series(value,selected.id);setSeries(rows);setChosen(rows.filter(x=>x.enabled).map(x=>x.id));}
  catch(e){setError(e instanceof Error?e.message:"Error consultando versión");}
  finally{setLoading(false);}
 };
 const submitArea=async(event:FormEvent)=>{
  event.preventDefault();clear();setSaving(true);
  try{await adminCatalogApi.saveArea(form,editing);await refresh();setView("list");setSuccess(editing?"Área actualizada en MySQL.":"Área creada en MySQL.");}
  catch(e){setError(e instanceof Error?e.message:"Error guardando área");}
  finally{setSaving(false);}
 };
 const saveAssignments=async()=>{
  if(!selected)return;
  clear();setSaving(true);
  try{
   await adminCatalogApi.saveSeries(selected.id,year,chosen);
   const rows=await adminCatalogApi.series(year,selected.id);setSeries(rows);
   setChosen(rows.filter(x=>x.enabled).map(x=>x.id));
   setSuccess("Asignación guardada en MySQL. Los expedientes históricos permanecen intactos.");
  }catch(e){setError(e instanceof Error?e.message:"Error asignando series");}
  finally{setSaving(false);}
 };
 const saveVersion=async(event:FormEvent)=>{
  event.preventDefault();clear();setSaving(true);
  try{await adminCatalogApi.createVersion(Number(newYear),newYearName,newRef);await refresh();
   setShowYear(false);setSuccess("Nueva edición creada; ya puedes registrar series para ese año.");setYear(Number(newYear));}
  catch(e){setError(e instanceof Error?e.message:"Error creando edición");}
  finally{setSaving(false);}
 };
 const saveNewSeries=async(event:FormEvent)=>{
  event.preventDefault();if(!selected)return;clear();setSaving(true);
  try{await adminCatalogApi.createSeries(year,newCode,newName,newSection);
   const rows=await adminCatalogApi.series(year,selected.id);setSeries(rows);
   setChosen(rows.filter(x=>x.enabled).map(x=>x.id));setShowSeries(false);setNewCode("");setNewName("");
   setSuccess("Código registrado en la versión "+year+". Márcalo y guarda la asignación para habilitarlo.");
  }catch(e){setError(e instanceof Error?e.message:"No se pudo registrar el código");}
  finally{setSaving(false);}
 };
 const visible=useMemo(()=>series.filter(x=>(!onlyEnabled||chosen.includes(x.id))&&
   (!filter||[x.code,x.name,x.section,x.sectionName].join(" ").toLowerCase().includes(filter.toLowerCase()))),
 [series,chosen,filter,onlyEnabled]);
 const back=()=>{clear();setView("list");setSelected(null);};
 const status=<>{error&&<div role="alert" className="inline-notice" style={{margin:"12px 0",color:"#9d253c"}}>{error}</div>}
  {success&&<div role="status" className="success-banner" style={{margin:"12px 0"}}><Check size={17}/>{success}</div>}</>;
 if(loading&&view==="list")return <div className="surface" style={{padding:24}}>Cargando áreas desde MySQL...</div>;
 if(view==="edit")return <div className="admin-form-page">
  <button className="text-button" onClick={back}><ArrowLeft size={17}/>Volver al catálogo</button>
  <div className="surface form-surface">
   <div className="surface-heading"><div className="heading-icon"><Pencil size={22}/></div><div>
    <h2>{editing?"Editar área administrativa":"Registrar área administrativa"}</h2>
    <p>La asignación del encargado y los códigos queda almacenada en MySQL.</p>
   </div></div>{status}
   <form onSubmit={submitArea}>
    <div className="form-grid">
     <label className="form-field"><span>Código de área *</span><input required maxLength={32} disabled={editing}
      value={form.id} onChange={e=>setForm({...form,id:e.target.value.toUpperCase()})} placeholder="Ej. AR-006"/></label>
     <label className="form-field"><span>Nombre del área *</span><input required maxLength={200}
      value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
     <label className="form-field"><span>Área superior</span><select value={form.parentId||""}
      onChange={e=>setForm({...form,parentId:e.target.value})}><option value="">Oficina de Representación</option>
      {items.filter(x=>x.id!==form.id).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
     </select></label>
     <label className="form-field"><span>Encargado de área</span><select value={form.managerId??""}
      onChange={e=>setForm({...form,managerId:e.target.value?Number(e.target.value):null})}>
      <option value="">Sin asignar</option>{managers.filter(x=>x.areaId===form.id)
       .map(u=><option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
     </select></label>
    </div>
    <p className="catalog-note">Solo se muestran usuarios activos de esta área con rol «Encargado de área».
     Si acabas de crear el área, guarda primero, registra un usuario en la pestaña Usuarios y luego vuelve para asignarlo.</p>
    <div className="form-actions"><button className="button button--secondary" type="button" onClick={back}>Cancelar</button>
     <button className="button button--primary" disabled={saving} type="submit">{saving?"Guardando...":"Guardar área"}</button></div>
   </form>
  </div></div>;
 if(view==="assign"&&selected)return <div className="admin-form-page">
  <button className="text-button" onClick={back}><ArrowLeft size={17}/>Volver al catálogo</button>
  <div className="surface form-surface">
   <div className="surface-heading"><div className="heading-icon"><FolderTree size={22}/></div><div>
    <h2>Asignar códigos CADIDO</h2><p><strong>{selected.name}</strong> · {selected.id}. Cada edición conserva sus propias series.</p>
   </div></div>{status}
   <div className="form-grid">
    <label className="form-field"><span>Edición del catálogo</span><select value={year} onChange={e=>void changeYear(Number(e.target.value))}>
     {versions.map(v=><option key={v.id} value={v.year}>{v.year} — {v.name}</option>)}</select></label>
    <label className="form-field"><span>Buscar sección, código o serie</span><input value={filter}
      onChange={e=>setFilter(e.target.value)} placeholder="Ej. 4C.3 / Recursos humanos"/></label>
   </div>
   <div style={{display:"flex",gap:10,flexWrap:"wrap",margin:"16px 0"}}>
    <button className="button button--secondary" type="button" onClick={()=>setOnlyEnabled(!onlyEnabled)}>
     {onlyEnabled?"Mostrar todos":"Solo seleccionados"} ({chosen.length})
    </button>
    <button className="button button--secondary" type="button" onClick={()=>setShowSeries(!showSeries)}><FilePlus2 size={16}/> Agregar código</button>
    <button className="button button--secondary" type="button" onClick={()=>setShowYear(!showYear)}><Plus size={16}/> Nueva edición</button>
   </div>
   {showYear&&<form onSubmit={saveVersion} className="surface" style={{padding:16,marginBottom:16}}>
    <h3>Nueva versión CADIDO</h3><div className="form-grid">
    <label className="form-field"><span>Año *</span><input required type="number" min={1900} max={2200}
      value={newYear} onChange={e=>setNewYear(e.target.value)}/></label>
    <label className="form-field"><span>Nombre *</span><input required value={newYearName} onChange={e=>setNewYearName(e.target.value)}/></label>
    <label className="form-field"><span>Referencia documental</span><input value={newRef} onChange={e=>setNewRef(e.target.value)}/></label>
    </div><button disabled={saving} className="button button--primary" type="submit">Crear edición</button>
   </form>}
   {showSeries&&<form onSubmit={saveNewSeries} className="surface" style={{padding:16,marginBottom:16}}>
    <h3>Nuevo código · edición {year}</h3>
    {year===2023&&<p className="catalog-note">La edición validada 2023 es inalterable. Crea otra edición para incorporar nuevos códigos.</p>}
    <div className="form-grid">
     <label className="form-field"><span>Código *</span><input required value={newCode} onChange={e=>setNewCode(e.target.value.toUpperCase())} placeholder="Ej. 4C.29"/></label>
     <label className="form-field"><span>Nombre de serie *</span><input required value={newName} onChange={e=>setNewName(e.target.value)}/></label>
     <label className="form-field"><span>Nombre de sección (solo si es nueva)</span><input value={newSection} onChange={e=>setNewSection(e.target.value)}/></label>
    </div><button className="button button--primary" disabled={saving||year===2023} type="submit">Registrar código</button>
   </form>}
   <p className="catalog-note">Marcar autoriza nuevos expedientes en esta área. Desmarcar impide nuevas altas,
    pero jamás elimina el código ni los expedientes históricos asociados.</p>
   {loading?<p>Cargando series...</p>:<div className="table-scroll" style={{maxHeight:420,overflowY:"auto"}}>
    <table className="data-table"><thead><tr><th>Habilitar</th><th>Código</th><th>Sección</th><th>Serie</th><th>Expedientes históricos</th></tr></thead>
    <tbody>{visible.map(s=><tr key={s.id}><td><input aria-label={"Autorizar "+s.code} type="checkbox"
     checked={chosen.includes(s.id)} disabled={!s.active} onChange={e=>setChosen(prev=>e.target.checked?[...prev,s.id]:prev.filter(x=>x!==s.id))}/></td>
     <td><span className="record-id">{s.code}</span></td><td>{s.sectionName}</td><td>{s.name}</td><td>{s.records}</td></tr>)}
    {!visible.length&&<tr><td colSpan={5}>No hay códigos con estos filtros.</td></tr>}</tbody></table></div>}
   <div className="form-actions"><button className="button button--secondary" type="button" onClick={back}>Volver</button>
    <button className="button button--primary" type="button" disabled={saving||loading} onClick={()=>void saveAssignments()}>
      <ShieldCheck size={17}/>{saving?"Guardando...":"Guardar asignación ("+chosen.length+")"}
    </button></div>
  </div></div>;
 return <div className="surface table-surface">
  <div className="table-titlebar"><div><h2>Catálogo de áreas</h2>
   <p>Administra áreas, responsables de archivo y series CADIDO autorizadas por edición.</p></div>
   <button className="button button--primary" onClick={()=>edit()}><Plus size={17}/> Registrar área</button>
  </div>{status}
  <div className="table-scroll"><table className="data-table"><thead><tr>
   <th>Código</th><th>Área administrativa</th><th>Área superior</th><th>Encargado</th><th>Operaciones</th>
  </tr></thead><tbody>{items.map(a=><tr key={a.id}>
   <td><span className="record-id">{a.id}</span></td><td><strong className="cell-primary">{a.name}</strong></td>
   <td>{a.parent}</td><td>{a.manager||"Sin asignar"}</td>
   <td><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
    <button className="button button--secondary" onClick={()=>edit(a)}><Pencil size={15}/> Editar / Encargado</button>
    <button className="button button--primary" onClick={()=>void assign(a)}><FolderTree size={15}/> Asignar CADIDO</button>
   </div></td></tr>)}{!items.length&&<tr><td colSpan={5}>Sin áreas activas registradas.</td></tr>}</tbody></table></div>
  <div className="catalog-note">Las áreas y códigos permanecen en MySQL. Los códigos históricos no se eliminan;
   una edición nueva no sustituye las referencias guardadas en expedientes anteriores.</div>
 </div>;
}
