import React, { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { defaultSiteContent, mergeSiteContent, type SiteContent } from './siteContent';
import './crm-v31-editor.css';
const sectionLabels: Record<string,string> = {"brand": "Identidad y navegación", "hero": "Portada principal", "isapres": "Franja de Isapres", "contact": "Formulario de contacto", "whatsapp": "WhatsApp", "footer": "Pie de página", "appearance": "Diseño y visibilidad"};
const pretty = (key:string) => key.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,x=>x.toUpperCase());
export default function SiteEditor({db,published,onPublished}:{db:SupabaseClient;published:SiteContent;onPublished:(value:SiteContent)=>void}){
 const [draft,setDraft]=useState<SiteContent>(()=>mergeSiteContent(published));
 const [section,setSection]=useState<keyof SiteContent>('hero');
 const [busy,setBusy]=useState(false);const [notice,setNotice]=useState('');const [dirty,setDirty]=useState(false);
 const [history,setHistory]=useState<{id:string;created_at:string;actor_name:string;content:unknown}[]>([]);
 useEffect(()=>{void load()},[]);
 async function load(){const [d,h]=await Promise.all([db.rpc('cms_get_draft'),db.rpc('cms_get_history')]);if(d.error)setNotice('No se pudo cargar el borrador: '+d.error.message);else{setDraft(mergeSiteContent(d.data||published));setDirty(false)}if(!h.error)setHistory(h.data||[])}
 function change(group:keyof SiteContent,key:string,value:string|boolean){setDraft(old=>({...old,[group]:{...old[group],[key]:value}}));setDirty(true)}
 async function run(action:'cms_save_draft'|'cms_publish'){
  if(busy)return;
  if(action==='cms_publish'&&!window.confirm('¿Publicar los cambios? Serán visibles para todos los visitantes.'))return;
  setBusy(true);setNotice('');
  const args={p_content:draft};
  const {error}=await db.rpc(action,args);
  setBusy(false);
  if(error){setNotice('Error: '+error.message);return;}
  if(action==='cms_publish'){onPublished(mergeSiteContent(draft));setNotice('Cambios publicados correctamente.');setDirty(false)}
  else if(action==='cms_save_draft'){setNotice('Borrador guardado. Aún no está publicado.');setDirty(false)}

  if(action==='cms_publish')void load();
 }
 async function restore(id:string){if(!window.confirm('¿Cargar esta versión anterior como borrador?'))return;setBusy(true);const {data,error}=await db.rpc('cms_restore_version',{p_revision_id:id});setBusy(false);if(error)setNotice(error.message);else{setDraft(mergeSiteContent(data));setDirty(true);setNotice('Versión anterior cargada como borrador. Publica cuando estés listo.')}}
 function exportJSON(){const blob=new Blob([JSON.stringify(draft,null,2)],{type:'application/json'});const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download='tu-salud-primero-contenido.json';a.click();URL.revokeObjectURL(u)}
 async function importJSON(e:React.ChangeEvent<HTMLInputElement>){const file=e.target.files?.[0];if(!file)return;try{const obj=JSON.parse(await file.text());setDraft(mergeSiteContent(obj));setDirty(true);setNotice('Archivo importado al editor. Revisa antes de guardar.')}catch{setNotice('Archivo JSON inválido.')}e.target.value=''}
 const entries=Object.entries(draft[section]) as [string,string|boolean][];
 return <section className="panel cms-editor"><div className="cms-head"><div><span className="eyebrow">ADMINISTRACIÓN WEB</span><h2>Editor de página pública</h2><p className="small">Personaliza textos, WhatsApp, colores y secciones. Guarda un borrador y publícalo cuando esté listo.</p></div><span className="cms-state">{dirty?'Cambios sin guardar':'Sin cambios pendientes'}</span></div>
 <div className="cms-actions"><button type="button" disabled={busy} onClick={()=>void run('cms_save_draft')}>Guardar borrador</button><button type="button" className="cms-publish" disabled={busy} onClick={()=>void run('cms_publish')}>Publicar sitio</button><button type="button" disabled={busy} onClick={()=>window.open('/','_blank','noopener,noreferrer')}>Ver página publicada</button><button type="button" onClick={exportJSON}>Exportar JSON</button><label className="cms-upload">Importar JSON<input type="file" accept="application/json,.json" onChange={e=>void importJSON(e)}/></label></div>
 {notice&&<p role="status" className="cms-notice">{notice}</p>}
 <div className="cms-layout"><nav className="cms-side" aria-label="Secciones del editor">{Object.keys(sectionLabels).map(k=><button type="button" key={k} className={section===k?'active':''} onClick={()=>setSection(k as keyof SiteContent)}>{sectionLabels[k]}</button>)}<button type="button" onClick={()=>void load()}>Recargar borrador</button></nav><div className="cms-fields"><h3>{sectionLabels[section]}</h3>{entries.map(([key,value])=><label key={key} className="cms-field"><span>{pretty(key)}</span>{typeof value==='boolean'?<input type="checkbox" checked={value} onChange={e=>change(section,key,e.target.checked)}/>:key.toLowerCase().includes('color')?<input type="color" value={/^#[0-9a-f]{6}$/i.test(value)?value:'#087fa4'} onChange={e=>change(section,key,e.target.value)}/>:value.length>90||['description','message','disclaimer','privacyNotice','medicalNotice','text'].includes(key)?<textarea rows={3} maxLength={2000} value={value} onChange={e=>change(section,key,e.target.value)}/>:<input maxLength={500} value={value} onChange={e=>change(section,key,e.target.value)}/>}</label>)}<p className="small">Los campos de privacidad y consentimiento deben mantener información correcta y suficiente. Los cambios no modifican la seguridad de Supabase ni Turnstile.</p></div></div>
 <div className="cms-preview"><h3>Vista previa de textos</h3><div className="cms-preview-card"><span>{draft.hero.eyebrow}</span><h2>{draft.hero.title}</h2><p>{draft.hero.description}</p><strong>{draft.hero.primaryButton}</strong></div><p className="small">Esta vista es orientativa. Para comprobar el diseño completo, publica y abre la página pública.</p></div>
 <details className="cms-history"><summary>Historial de publicaciones ({history.length})</summary>{history.map(h=><div key={h.id} className="cms-revision"><span>{new Date(h.created_at).toLocaleString('es-CL')} · {h.actor_name}</span><button type="button" disabled={busy} onClick={()=>void restore(h.id)}>Restaurar a borrador</button></div>)}{!history.length&&<p className="small">Sin publicaciones anteriores.</p>}</details>
 </section>
}
