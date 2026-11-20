import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient, type Session } from '@supabase/supabase-js';
import { HeartPulse, MessageCircle, ShieldCheck, Users, LogOut, ArrowRight, Phone, FileText, CalendarClock, CheckCircle2, X } from 'lucide-react';
import './style.css';
import './crm-v23.css';
import './crm-v24.css';
import './crm-v241.css';
import './crm-v30.css';
import './crm-v301-whatsapp.css';
import './crm-v302-isapres.css';
import './crm-v311-form-whatsapp.css';
import './crm-v312-notifications.css';
import './crm-v313-logo.css';
import './crm-v314-ajustes.css';
import SiteEditor from './SiteEditor';
import {CommercialHero,HowItWorks,FAQ,QuoteWizard,type QuoteAnswers} from './CommercialV4';
import './crm-v40-commercial.css';
import { defaultSiteContent, mergeSiteContent, type SiteContent } from './siteContent';
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = url && key ? createClient(url, key) : null;
const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
type TurnstileAPI = {
    render: (element: HTMLElement, options: Record<string, unknown>) => string;
    reset: (widgetId: string) => void;
    remove: (widgetId: string) => void;
};
declare global {
    interface Window {
        turnstile?: TurnstileAPI;
    }
}
type Lead = {
    id: string;
    full_name: string;
    phone: string;
    email: string | null;
    interest: string;
    status: string;
    assigned_to: string | null;
    created_at: string;
    lead_source?: string;
    quote_details?: Record<string,string>|null;
};
type Profile = {
    id: string;
    full_name: string;
    role: 'admin' | 'supervisor' | 'executive';
};
type Permission = {
    user_id: string;
    view_assigned_leads: boolean;
    view_all_leads: boolean;
    manage_assigned_leads: boolean;
    assign_leads: boolean;
    view_reports: boolean;
    manage_users: boolean;
};
const defaultPermission = (user_id: string): Permission => ({ user_id, view_assigned_leads: true, view_all_leads: false, manage_assigned_leads: true, assign_leads: false, view_reports: false, manage_users: false });

const isapreBrands = [
  { name: 'Banmédica', slug: 'banmedica', domain: 'banmedica.cl' },
  { name: 'Colmena', slug: 'colmena', domain: 'colmena.cl' },
  { name: 'Consalud', slug: 'consalud', domain: 'consalud.cl' },
  { name: 'Cruz Blanca', slug: 'cruzblanca', domain: 'cruzblanca.cl' },
  { name: 'Nueva Masvida', slug: 'nuevamasvida', domain: 'nuevamasvida.cl' },
  { name: 'Vida Tres', slug: 'vidatres', domain: 'vidatres.cl' },
  { name: 'Esencial', slug: 'esencial', domain: 'somosesencial.cl' },
];
function IsapresMarquee({content}:{content:SiteContent}) {
  return <section className="isapres-section" aria-label="Isapres del sistema privado chileno">
    <div className="shell isapres-heading">
      <span className="eyebrow">{content.isapres.eyebrow}</span>
      <h2>{content.isapres.title}</h2>
      <p>{content.isapres.description}</p>
    </div>
    <div className="isapres-marquee" aria-label="Banmédica, Colmena, Consalud, Cruz Blanca, Nueva Masvida, Vida Tres y Esencial">
      <div className="isapres-track">
        {[0, 1].map(copy => <div className="isapres-group" key={copy} aria-hidden={copy === 1}>
          {isapreBrands.map(brand => <div className={'isapres-brand isapres-brand--' + brand.slug} key={brand.slug}>
            {brand.slug === 'banmedica' || brand.slug === 'nuevamasvida' ? (
              <img className="isapres-brand-logo" src={'/logos/' + brand.slug + '.png'} alt={brand.name} loading="lazy" />
            ) : <>
              <img className="isapres-brand-icon" src={'https://www.google.com/s2/favicons?domain=' + brand.domain + '&sz=128'} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} />
              <span>{brand.name}</span>
            </>}
          </div>)}
        </div>)}
      </div>
    </div>
    <p className="isapres-disclaimer shell">{content.isapres.disclaimer}</p>
  </section>;
}
const statuses = ['nuevo', 'contactado', 'en_gestion', 'convertido', 'descartado'];
type AgendaItem = {id:string;lead_id:string;lead_name:string;lead_phone:string;assigned_to:string|null;author_id:string;body:string;followup_at:string;completed_at:string|null;author_name:string};
type AuditItem = {id:string;activity_id:string;lead_id:string;changed_by:string;action:string;changed_at:string;actor_name:string};
type Activity = { id: string; lead_id: string; author_id: string; kind: 'nota'|'contacto'|'seguimiento'; body: string; followup_at: string|null; completed_at: string|null; created_at: string; author_name: string };
const activityTypes = [{value:'nota',label:'Nota interna'},{value:'contacto',label:'Contacto realizado'},{value:'seguimiento',label:'Próximo seguimiento'}] as const;
function dateCL(date: string) { return new Date(date).toLocaleString('es-CL', {dateStyle:'medium',timeStyle:'short'}); }
function LeadDetail({lead,users,canManage,isAdmin,currentUserId,onClose,onSaved}:{lead:Lead;users:Profile[];canManage:boolean;isAdmin:boolean;currentUserId:string;onClose:()=>void;onSaved:()=>void}) {
  const [activities,setActivities]=useState<Activity[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [kind,setKind]=useState<'nota'|'contacto'|'seguimiento'>('nota');
  const [body,setBody]=useState('');
  const [when,setWhen]=useState('');
  const [editingId,setEditingId]=useState<string|null>(null);
  const [editKind,setEditKind]=useState<'nota'|'contacto'|'seguimiento'>('nota');
  const [editBody,setEditBody]=useState('');
  const [editWhen,setEditWhen]=useState('');
  async function load(){
    if(!supabase)return;
    const {data,error}=await supabase.rpc('crm_get_lead_activities',{p_lead_id:lead.id});
    if(error)setError('No fue posible cargar el historial: '+error.message);
    else {setActivities((data||[]) as Activity[]);setError('');}
  }
  useEffect(()=>{void load()},[lead.id]);
  async function save(e:React.FormEvent){
    e.preventDefault();if(!supabase||busy||!canManage)return;
    if(body.trim().length<2){setError('Escribe al menos 2 caracteres.');return;}
    if(kind==='seguimiento'&&!when){setError('Selecciona la fecha del seguimiento.');return;}
    setBusy(true);
    const {error}=await supabase.rpc('crm_add_lead_activity',{p_lead_id:lead.id,p_kind:kind,p_body:body.trim(),p_followup_at:kind==='seguimiento'?new Date(when).toISOString():null});
    setBusy(false);
    if(error)setError('No se pudo guardar: '+error.message);
    else {setBody('');setWhen('');setError('');await load();onSaved();}
  }
  function startEdit(a:Activity){
    setEditingId(a.id);setEditKind(a.kind);setEditBody(a.body);
    const d=a.followup_at?new Date(a.followup_at):null;
    const local=d?new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16):'';
    setEditWhen(local);setError('');
  }
  async function changeActivity(a:Activity,action:'edit'|'complete'|'reopen'|'delete'){
    if(!supabase||busy||!(isAdmin||(canManage&&a.author_id===currentUserId)))return;
    if(action==='delete'&&!window.confirm('¿Eliminar esta gestión del historial? Se conservará en la auditoría.'))return;
    if(action==='edit'&&(editBody.trim().length<2||(editKind==='seguimiento'&&!editWhen))){setError('Completa el detalle y la fecha del seguimiento.');return;}
    setBusy(true);
    const {error}=await supabase.rpc('crm_change_lead_activity',{
      p_activity_id:a.id,p_action:action,
      p_kind:action==='edit'?editKind:null,
      p_body:action==='edit'?editBody.trim():null,
      p_followup_at:action==='edit'&&editKind==='seguimiento'?new Date(editWhen).toISOString():null
    });
    setBusy(false);
    if(error)setError('No se pudo realizar el cambio: '+error.message);
    else {setEditingId(null);setError('');await load();onSaved();}
  }
  return <div className="crm-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <section className="crm-detail" role="dialog" aria-modal="true" aria-label={'Ficha de '+lead.full_name}>
      <div className="crm-detail-head"><div><span className="eyebrow">FICHA DEL PROSPECTO</span><h2>{lead.full_name}</h2><span className="crm-pill">{lead.status.replace(/_/g,' ')}</span></div><button className="crm-icon-btn" onClick={onClose} aria-label="Cerrar ficha"><X size={22}/></button></div>
      <div className="v4-source-meta"><strong>Origen comercial:</strong> {lead.lead_source||'formulario'} {lead.quote_details&&<span> · Preferencias: {Object.values(lead.quote_details).join(' · ')}</span>}</div><div className="crm-detail-meta"><div><strong>Teléfono</strong><a href={'tel:'+lead.phone}>{lead.phone}</a></div><div><strong>Correo</strong>{lead.email?<a href={'mailto:'+lead.email}>{lead.email}</a>:<span>No registrado</span>}</div><div><strong>Interés</strong><span>{lead.interest}</span></div><div><strong>Asignado a</strong><span>{users.find(u=>u.id===lead.assigned_to)?.full_name||'Sin asignar'}</span></div><div><strong>Ingresó</strong><span>{dateCL(lead.created_at)}</span></div></div>
      <h3><FileText size={19}/> Historial de gestiones</h3>
      {error&&<p className="crm-detail-error" role="alert">{error}</p>}
      <div className="crm-activity-list">{activities.map(a=>{
        const mayEdit=isAdmin||(canManage&&a.author_id===currentUserId);
        return <article key={a.id} className="crm-activity">
          <div className="crm-activity-top"><strong>{a.kind==='nota'?'Nota interna':a.kind==='contacto'?'Contacto realizado':'Seguimiento'}</strong><span>{dateCL(a.created_at)}</span></div>
          {editingId===a.id?<div className="crm-edit-fields">
            <label>Tipo<select value={editKind} onChange={e=>setEditKind(e.target.value as typeof editKind)}>{activityTypes.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
            <label>Detalle<textarea rows={3} minLength={2} maxLength={2000} value={editBody} onChange={e=>setEditBody(e.target.value)}/></label>
            {editKind==='seguimiento'&&<label>Próximo contacto<input type="datetime-local" required value={editWhen} onChange={e=>setEditWhen(e.target.value)}/></label>}
            <div className="crm-action-row"><button type="button" disabled={busy} onClick={()=>void changeActivity(a,'edit')}>Guardar cambios</button><button type="button" disabled={busy} onClick={()=>setEditingId(null)}>Cancelar</button></div>
          </div>:<><p>{a.body}</p><small>Registrado por {a.author_name||'Usuario autorizado'}</small>
            {a.kind==='seguimiento'&&<div className="crm-followup"><CalendarClock size={16}/><span>{a.followup_at?dateCL(a.followup_at):'Sin fecha'}</span>{a.completed_at?<span className="crm-done"><CheckCircle2 size={15}/> Completado</span>:<span>Pendiente</span>}</div>}
            {mayEdit&&<div className="crm-action-row"><button type="button" disabled={busy} onClick={()=>startEdit(a)}>Editar</button>{a.kind==='seguimiento'&&<button type="button" disabled={busy} onClick={()=>void changeActivity(a,a.completed_at?'reopen':'complete')}>{a.completed_at?'Reabrir':'Marcar realizado'}</button>}<button type="button" className="crm-danger" disabled={busy} onClick={()=>void changeActivity(a,'delete')}>Eliminar</button></div>}
          </>}
        </article>;
      })}{activities.length===0&&<p className="small">Aún no hay gestiones registradas.</p>}</div>
      {canManage?<form className="crm-activity-form" onSubmit={save}><h3>Registrar gestión</h3><label>Tipo de gestión<select value={kind} onChange={e=>setKind(e.target.value as typeof kind)}>{activityTypes.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></label><label>Detalle<textarea required minLength={2} maxLength={2000} rows={3} value={body} onChange={e=>setBody(e.target.value)} placeholder="Describe la gestión comercial, sin incluir datos médicos sensibles."/></label>{kind==='seguimiento'&&<label>Fecha y hora del próximo contacto<input type="datetime-local" required value={when} onChange={e=>setWhen(e.target.value)}/></label>}<button className="btn primary" disabled={busy}>{busy?'Guardando...':'Guardar gestión'}</button></form>:<p className="small">Tu cuenta tiene acceso de lectura a esta ficha.</p>}
    </section>
  </div>;
}

function App() {
    const [siteContent,setSiteContent]=useState<SiteContent>(mergeSiteContent(defaultSiteContent));
    const [mobileMenu,setMobileMenu]=useState(false);
    const [quoteAnswers,setQuoteAnswers]=useState<QuoteAnswers|null>(null);
    const [leadOrigin,setLeadOrigin]=useState('formulario');
    function goToSection(id:string){setMobileMenu(false);if(view!=='home'){setView('home');history.pushState({},'','/');window.setTimeout(()=>document.getElementById(id)?.scrollIntoView({behavior:'smooth'}),60)}else document.getElementById(id)?.scrollIntoView({behavior:'smooth'});}
    function startQuote(){setLeadOrigin('cotizador');goToSection('cotizador')}
    function finishQuote(answers:QuoteAnswers){setQuoteAnswers(answers);setLeadOrigin('cotizador');goToSection('contacto')}

    useEffect(()=>{if(!supabase)return;void supabase.from('cms_public_site').select('content').eq('id',1).maybeSingle().then(({data})=>{if(data?.content)setSiteContent(mergeSiteContent(data.content))})},[]);
    const whatsappUrl='https://wa.me/'+(siteContent.whatsapp.phone.replace(/\D/g,'')||'56989494951')+'?text='+encodeURIComponent(siteContent.whatsapp.message);
    const [session, setSession] = useState<Session | null>(null), [profile, setProfile] = useState<Profile | null>(null), [leads, setLeads] = useState<Lead[]>([]), [loading, setLoading] = useState(false), [notice, setNotice] = useState(''), [view, setView] = useState(location.pathname.startsWith('/crm') ? 'crm' : 'home');
    // Solo los mensajes de éxito del formulario se cierran automáticamente.
    useEffect(() => {
        if (!notice.includes('Solicitud enviada correctamente')) return;
        const timer = window.setTimeout(() => setNotice(''), 5000);
        return () => window.clearTimeout(timer);
    }, [notice]);
    const [fullName, setFullName] = useState(''), [phone, setPhone] = useState('+569'), [email, setEmail] = useState(''), [interest, setInterest] = useState('Cotizar un plan'), [consent, setConsent] = useState(false);
    const [turnstileToken, setTurnstileToken] = useState(''), [turnstileReady, setTurnstileReady] = useState(false), [sendingLead, setSendingLead] = useState(false);
    const turnstileContainer = useRef<HTMLDivElement | null>(null), turnstileWidget = useRef<string | null>(null);
    const [loginEmail, setLoginEmail] = useState(''), [password, setPassword] = useState(''), [search, setSearch] = useState('');
    const [users, setUsers] = useState<Profile[]>([]), [permissions, setPermissions] = useState<Permission[]>([]), [tab, setTab] = useState<'dashboard' | 'leads' | 'users' | 'agenda' | 'kanban' | 'reports' | 'audit' | 'site'>('dashboard');
    const [statusFilter, setStatusFilter] = useState('todos'), [assignmentFilter, setAssignmentFilter] = useState('todos'), [ownerFilter, setOwnerFilter] = useState('todos'), [sortOrder, setSortOrder] = useState('recent');
    const [selectedLeadId,setSelectedLeadId]=useState<string|null>(null);
    const [agenda,setAgenda]=useState<AgendaItem[]>([]),[audit,setAudit]=useState<AuditItem[]>([]);
    const [agendaFilter,setAgendaFilter]=useState('pendientes'),[agendaQuery,setAgendaQuery]=useState('');
    const [reportDays,setReportDays]=useState('30'),[selectedIds,setSelectedIds]=useState<string[]>([]),[bulkOwner,setBulkOwner]=useState('');
    const [busyBulk,setBusyBulk]=useState(false),[auditLoading,setAuditLoading]=useState(false);
    const [savingStatusIds,setSavingStatusIds]=useState<string[]>([]);
    const [agendaLoading,setAgendaLoading]=useState(false);
    const [newUid, setNewUid] = useState(''), [newName, setNewName] = useState(''), [newRole, setNewRole] = useState('executive');
    useEffect(() => { if (!supabase)
        return; supabase.auth.getSession().then(({ data }) => setSession(data.session)); const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => setSession(s)); return () => subscription.unsubscribe(); }, []);
    useEffect(() => { if (!supabase || !session) {
        setProfile(null);
        setLeads([]);
        setUsers([]);
        setPermissions([]);
        return;
    } void (async () => { const { data, error } = await supabase.from('profiles').select('id,full_name,role').eq('id', session.user.id).single(); if (error)
        setNotice('Tu usuario aún no tiene un perfil autorizado. Contacta al administrador.'); setProfile(data as Profile | null); })(); }, [session]);
    async function refresh() { if (!supabase || !profile)
        return; setLoading(true); const { data, error } = await supabase.from('leads').select('id,full_name,phone,email,interest,status,assigned_to,created_at,lead_source,quote_details').order('created_at', { ascending: false }).limit(300); if (error)
        setNotice(error.message);
    else
        setLeads(data || []); setLoading(false); }
    useEffect(() => { if (profile) {
        void refresh();
        void refreshUsers();
        void refreshAgenda();
    } }, [profile]);
    async function refreshUsers() { if (!supabase)
        return; const [u, p] = await Promise.all([supabase.from('profiles').select('id,full_name,role').order('full_name'), supabase.from('user_permissions').select('*')]); if (u.error)
        setNotice(u.error.message);
    else
        setUsers((u.data || []) as Profile[]); if (p.error)
        setNotice(p.error.message);
    else
        setPermissions((p.data || []) as Permission[]); }
    async function refreshAgenda(){
      if(!supabase)return;setAgendaLoading(true);
      const {data,error}=await supabase.rpc('crm_v3_agenda');
      setAgendaLoading(false);
      if(error)setNotice('Agenda: '+error.message);else setAgenda((data||[]) as AgendaItem[]);
    }
    async function refreshAudit(){
      if(!supabase||profile?.role!=='admin')return;setAuditLoading(true);
      const {data,error}=await supabase.rpc('crm_v3_audit',{p_limit:150});
      setAuditLoading(false);
      if(error)setNotice('Auditoría: '+error.message);else setAudit((data||[]) as AuditItem[]);
    }
    async function bulkAssign(){
      if(!supabase||!canAssign||!bulkOwner||!selectedIds.length||busyBulk)return;
      if(!window.confirm(`¿Asignar ${selectedIds.length} prospectos al ejecutivo seleccionado?`))return;
      setBusyBulk(true);let completed=0;let failed=0;
      for(const id of selectedIds){const {error}=await supabase.rpc('admin_assign_lead',{p_lead_id:id,p_user_id:bulkOwner});if(error)failed++;else completed++;}
      setBusyBulk(false);setSelectedIds([]);setNotice(`${completed} asignados; ${failed} errores.`);await refresh();
    }
    function exportLeads(){
      const cols=['Nombre','Teléfono','Correo','Interés','Estado','Ejecutivo','Fecha'];
      const safe=(value:string)=>{const normalized=/^[=+@\-\t\r]/.test(value)?"'"+value:value;return '"'+normalized.replace(/"/g,'""')+'"';};
      const lines=[cols.map(safe).join(';'),...filtered.map(l=>[l.full_name,l.phone,l.email||'',l.interest,l.status,users.find(u=>u.id===l.assigned_to)?.full_name||'Sin asignar',l.created_at].map(safe).join(';'))];
      const blob=new Blob(['\uFEFF'+lines.join('\r\n')],{type:'text/csv;charset=utf-8;'});
      const objectUrl=URL.createObjectURL(blob);const a=document.createElement('a');a.href=objectUrl;a.download='tu-salud-primero-prospectos.csv';a.click();URL.revokeObjectURL(objectUrl);
    }
    async function agendaComplete(item:AgendaItem){
      if(!supabase)return;const {error}=await supabase.rpc('crm_change_lead_activity',{p_activity_id:item.id,p_action:item.completed_at?'reopen':'complete',p_kind:null,p_body:null,p_followup_at:null});
      if(error)setNotice(error.message);else await refreshAgenda();
    }
    async function provision(e: React.FormEvent) { e.preventDefault(); if (!supabase)
        return; setLoading(true); const { error } = await supabase.rpc('admin_provision_profile', { p_user_id: newUid.trim(), p_full_name: newName.trim(), p_role: newRole }); setLoading(false); setNotice(error ? error.message : 'Perfil creado. Configura sus permisos.'); if (!error) {
        setNewUid('');
        setNewName('');
        await refreshUsers();
    } }
    async function savePermission(p: Permission) { if (!supabase)
        return; const { error } = await supabase.rpc('admin_save_user_permissions_v2', { p_user_id: p.user_id, p_view_assigned_leads: p.view_assigned_leads, p_view_all_leads: p.view_all_leads, p_manage_assigned_leads: p.manage_assigned_leads, p_assign_leads: p.assign_leads, p_view_reports: p.view_reports, p_manage_users: p.manage_users }); setNotice(error ? error.message : 'Permisos guardados'); if (!error)
        await refreshUsers(); }
    async function assignLead(id: string, uid: string) { if (!supabase)
        return; const { error } = await supabase.rpc('admin_assign_lead', { p_lead_id: id, p_user_id: uid || null }); setNotice(error ? error.message : 'Prospecto asignado'); if (!error)
        void refresh(); }
    useEffect(() => {
        if (view !== 'home' || !turnstileSiteKey || !turnstileContainer.current)
            return;
        let cancelled = false;
        const scriptId = 'crm-turnstile-script';
        function mount() {
            if (cancelled || !window.turnstile || !turnstileContainer.current || turnstileWidget.current)
                return;
            turnstileWidget.current = window.turnstile.render(turnstileContainer.current, {
                sitekey: turnstileSiteKey,
                callback: (token: string) => setTurnstileToken(token),
                'expired-callback': () => setTurnstileToken(''),
                'error-callback': () => setTurnstileToken(''),
            });
            setTurnstileReady(true);
        }
        if (window.turnstile)
            mount();
        else {
            let script = document.getElementById(scriptId) as HTMLScriptElement | null;
            if (!script) {
                script = document.createElement('script');
                script.id = scriptId;
                script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
                script.async = true;
                script.defer = true;
                document.head.appendChild(script);
            }
            script.addEventListener('load', mount);
            const currentScript = script;
            return () => { cancelled = true; currentScript.removeEventListener('load', mount); if (turnstileWidget.current && window.turnstile) {
                window.turnstile.remove(turnstileWidget.current);
                turnstileWidget.current = null;
            } setTurnstileReady(false); };
        }
        return () => { cancelled = true; if (turnstileWidget.current && window.turnstile) {
            window.turnstile.remove(turnstileWidget.current);
            turnstileWidget.current = null;
        } setTurnstileReady(false); };
    }, [view]);
    async function submitLead(e: React.FormEvent) {
        e.preventDefault();
        if (sendingLead)
            return;
        if (!url || !turnstileSiteKey) {
            setNotice('Formulario no configurado. Contacta al administrador.');
            return;
        }
        if (!/^\+569[0-9]{8}$/.test(phone)) {
            setNotice('Ingresa un celular chileno válido: +569 seguido de 8 dígitos.');
            return;
        }
        if (!email.trim()) {
            setNotice('El correo electrónico es obligatorio.');
            return;
        }
        if (!consent) {
            setNotice('Debes autorizar el uso de tus datos para responder a tu solicitud.');
            return;
        }
        if (!turnstileToken) {
            setNotice('Completa la verificación de seguridad antes de enviar.');
            return;
        }
        setSendingLead(true);
        try {
            const endpoint = `${url.replace(/\/$/, '')}/functions/v1/submit-public-lead`;
            const result = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ full_name: fullName.trim(), phone: phone.trim(), email: email.trim(), interest, consent: true, turnstile_token: turnstileToken, lead_source: leadOrigin, quote_details: leadOrigin==='cotizador' ? quoteAnswers : null }) });
            const payload = await result.json().catch(() => ({}));
            if (!result.ok)
                throw new Error(typeof payload.error === 'string' ? payload.error : 'No se pudo enviar la solicitud.');
            setNotice('¡Solicitud enviada correctamente! Pronto nos pondremos en contacto.');
            setFullName('');
            setPhone('+569');
            setEmail('');
            setInterest('Cotizar un plan');
            setConsent(false);
            setQuoteAnswers(null);setLeadOrigin('formulario');
        }
        catch (error) {
            setNotice(error instanceof Error ? error.message : 'Error de conexión. Intenta nuevamente.');
        }
        finally {
            setSendingLead(false);
            setTurnstileToken('');
            if (turnstileWidget.current && window.turnstile)
                window.turnstile.reset(turnstileWidget.current);
        }
    }
    async function login(e: React.FormEvent) { e.preventDefault(); if (!supabase)
        return; setLoading(true); const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password }); setLoading(false); setNotice(error ? 'No fue posible ingresar. Revisa tus credenciales.' : ''); }
    async function updateStatus(id: string, status: string) {
        if (!supabase || savingStatusIds.includes(id)) return;
        const lead = leads.find(l => l.id === id);
        if (!lead || lead.status === status || !canManageLead(lead)) return;
        setSavingStatusIds(prev => [...prev, id]);
        try {
            const { error } = await supabase.rpc('update_lead_status', { p_lead_id: id, p_status: status });
            if (error) throw error;
            // El selector cambia solo después de la confirmación del servidor.
            // No recargamos 300 prospectos por cada modificación.
            setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l));
        } catch (error) {
            setNotice('No se pudo cambiar el estado: ' + (error instanceof Error ? error.message : String(error)));
        } finally {
            setSavingStatusIds(prev => prev.filter(x => x !== id));
        }
    }
    function navigate(v: string) { setView(v); history.pushState({}, '', v === 'crm' ? '/crm' : '/'); window.scrollTo(0, 0); }
    const canViewReports = profile?.role === 'admin' || permissions.some(p => p.user_id === profile?.id && p.view_reports);
    const canManageLead=(lead:Lead)=>profile?.role==='admin'||permissions.some(p=>p.user_id===profile?.id&&p.manage_assigned_leads&&lead.assigned_to===profile?.id);
    const canAssign = profile?.role === 'admin' || permissions.some(p => p.user_id === profile?.id && p.assign_leads);
    const filtered = leads.filter(l => {
        const term = search.trim().toLocaleLowerCase('es-CL');
        const matchesText = `${l.full_name} ${l.phone} ${l.email || ''} ${l.interest} ${l.lead_source||''}`.toLocaleLowerCase('es-CL').includes(term);
        return matchesText && (statusFilter === 'todos' || l.status === statusFilter) && (assignmentFilter === 'todos' || (assignmentFilter === 'unassigned' ? !l.assigned_to : !!l.assigned_to)) && (ownerFilter === 'todos' || l.assigned_to === ownerFilter);
    }).sort((a, b) => sortOrder === 'oldest' ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime() : new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const unassignedCount = leads.filter(l => !l.assigned_to).length;
    const activeCount = leads.filter(l => ['contactado', 'en_gestion'].includes(l.status)).length;
    const convertedCount = leads.filter(l => l.status === 'convertido').length;
    const conversionRate = leads.length ? Math.round(convertedCount / leads.length * 100) : 0;
    const dailyCounts = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (6 - i)); return { date: d, label: d.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric' }), count: leads.filter(l => { const x = new Date(l.created_at); return x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth() && x.getDate() === d.getDate(); }).length }; });
    const now=new Date();
    const pendingAgenda=agenda.filter(a=>!a.completed_at);
    const overdueAgenda=pendingAgenda.filter(a=>new Date(a.followup_at).getTime()<now.getTime());
    const todayAgenda=pendingAgenda.filter(a=>new Date(a.followup_at).toLocaleDateString('es-CL')===now.toLocaleDateString('es-CL'));
    const nextWeekAgenda=pendingAgenda.filter(a=>new Date(a.followup_at).getTime()>=now.getTime()&&new Date(a.followup_at).getTime()<=now.getTime()+7*86400000);
    const visibleAgenda=agenda.filter(a=>{
      const t=new Date(a.followup_at).getTime();
      const ok=agendaFilter==='todos'||(agendaFilter==='pendientes'&&!a.completed_at)||(agendaFilter==='vencidos'&&!a.completed_at&&t<now.getTime())||(agendaFilter==='hoy'&&!a.completed_at&&new Date(a.followup_at).toLocaleDateString('es-CL')===now.toLocaleDateString('es-CL'))||(agendaFilter==='proximos'&&!a.completed_at&&t>=now.getTime()&&t<=now.getTime()+7*86400000)||(agendaFilter==='completados'&&!!a.completed_at);
      return ok&&`${a.lead_name} ${a.body} ${a.lead_phone}`.toLowerCase().includes(agendaQuery.toLowerCase());
    }).sort((a,b)=>new Date(a.followup_at).getTime()-new Date(b.followup_at).getTime());
    const reportLeads=leads.filter(l=>new Date(l.created_at).getTime()>=Date.now()-Number(reportDays)*86400000);
    const statusNames:Record<string,string>={nuevo:'Nuevo',contactado:'Contactado',en_gestion:'En gestión',convertido:'Convertido',descartado:'Descartado'};
    const maxDaily = Math.max(1, ...dailyCounts.map(d => d.count));
    function openUnassigned() { setTab('leads'); setAssignmentFilter('unassigned'); setStatusFilter('todos'); setOwnerFilter('todos'); setSearch(''); }
    return <><header><div className="shell nav"><div className="brand"><img className="tsp-brand-logo" src="/logos/tu-salud-primero.png" alt={siteContent.brand.name} /></div><button type="button" className="v4-menu-toggle" aria-expanded={mobileMenu} aria-controls="v4-nav" onClick={()=>setMobileMenu(v=>!v)}>{mobileMenu?'Cerrar':'Menú'} ☰</button><nav id="v4-nav" className={'v4-nav '+(mobileMenu?'is-open':'')} aria-label="Navegación principal"><button className="link" onClick={() => {setMobileMenu(false);navigate('home')}}>{siteContent.brand.navHome}</button><button className="link" onClick={()=>goToSection('planes')}>{siteContent.navigation.plans}</button><button className="link" onClick={()=>goToSection('como-funciona')}>{siteContent.navigation.how}</button><button className="link" onClick={()=>goToSection('preguntas')}>{siteContent.navigation.faq}</button><button className="link" onClick={startQuote}>{siteContent.navigation.quote}</button><button className="link" onClick={()=>{setLeadOrigin('menu');goToSection('contacto')}}>{siteContent.navigation.contact}</button><button className="link" onClick={() => {setMobileMenu(false);navigate('crm')}}>{siteContent.brand.navCrm}</button></nav></div></header>
 {view === 'home' ? <main className="cms-public" style={{'--cms-primary':siteContent.appearance.primaryColor,'--cms-accent':siteContent.appearance.accentColor} as React.CSSProperties}>{siteContent.appearance.showHero&&<section className="hero"><div className="shell heroGrid"><div><span className="eyebrow">{siteContent.hero.eyebrow}</span><h1>{siteContent.hero.title}</h1><p>{siteContent.hero.description}</p><a className="btn green" href="#contacto" onClick={()=>setLeadOrigin('portada')}><MessageCircle size={19}/> {siteContent.hero.primaryButton}</a></div><div className="heroCard"><HeartPulse size={46}/><h2>{siteContent.hero.cardTitle}</h2><p>{siteContent.hero.cardDescription}</p><div className="feature"><ShieldCheck /> {siteContent.hero.feature1}</div><div className="feature"><Users /> {siteContent.hero.feature2}</div><div className="feature"><Phone /> {siteContent.hero.feature3}</div></div></div></section>}{siteContent.commercial.showCommercial&&<CommercialHero content={siteContent} onQuote={startQuote}/>}{siteContent.appearance.showIsapres&&<IsapresMarquee content={siteContent}/>}{siteContent.steps.showSteps&&<HowItWorks content={siteContent}/>} {siteContent.quote.showQuote&&<QuoteWizard content={siteContent} onFinish={finishQuote}/>} {siteContent.faq.showFaq&&<FAQ content={siteContent}/>}{siteContent.appearance.showContact&&<section className="shell section" id="contacto"><div className="sectionHeading"><span className="eyebrow">{siteContent.contact.eyebrow}</span><h2>{siteContent.contact.title}</h2><p>{siteContent.contact.description}</p></div><div className="contact-options"><form className="form" onSubmit={submitLead}>{quoteAnswers&&<div className="v4-quote-summary"><strong>Preferencias del cotizador</strong><p>{quoteAnswers.current_isapre} · {quoteAnswers.budget_range} · {quoteAnswers.priority}</p><button type="button" onClick={()=>{setQuoteAnswers(null);setLeadOrigin('formulario')}}>Quitar preferencias</button></div>}<label>{siteContent.contact.nameLabel}<input required maxLength={120} value={fullName} onChange={e => setFullName(e.target.value)} placeholder={siteContent.contact.namePlaceholder}/></label><label>{siteContent.contact.phoneLabel}<input required value={phone} onChange={e => { const digits=e.target.value.replace(/\D/g,''); const rest=(digits.startsWith('569')?digits.slice(3):digits.startsWith('9')?digits.slice(1):digits).slice(0,8);setPhone('+569'+rest); }} inputMode="numeric" type="tel" pattern="\+569[0-9]{8}" minLength={12} maxLength={12} title="Ingresa +569 y los 8 dígitos de tu celular" placeholder="+569XXXXXXXX"/></label><label>{siteContent.contact.emailLabel}<input required type="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} placeholder={siteContent.contact.emailPlaceholder}/></label><label>{siteContent.contact.interestLabel}<select required value={interest} onChange={e => setInterest(e.target.value)}><option>{siteContent.contact.option1}</option><option>{siteContent.contact.option2}</option><option>{siteContent.contact.option3}</option></select></label><label className="check"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}/> {siteContent.contact.privacyNotice}</label><div ref={turnstileContainer} aria-label="Verificación de seguridad"/><button className="btn primary" disabled={sendingLead || !consent || !turnstileToken || !turnstileReady || !turnstileSiteKey}>{sendingLead ? 'Enviando solicitud...' : siteContent.contact.submitButton} <ArrowRight size={17}/></button><p className="small">{siteContent.contact.medicalNotice}</p></form>{siteContent.appearance.showWhatsapp&&<aside className="whatsapp-contact-card" aria-label="Atención por WhatsApp"><div className="whatsapp-contact-icon"><MessageCircle size={32}/></div><span className="eyebrow">{siteContent.whatsapp.eyebrow}</span><h3>{siteContent.whatsapp.title}</h3><p>{siteContent.whatsapp.description}</p><a className="whatsapp-contact-button" href={whatsappUrl} target="_blank" rel="noopener noreferrer"><MessageCircle size={20}/> {siteContent.whatsapp.button} <ArrowRight size={18}/></a><small>{siteContent.whatsapp.small}</small></aside>}</div></section>}{siteContent.appearance.showFloatingWhatsapp&&<a className="whatsapp-floating" href={whatsappUrl} target="_blank" rel="noopener noreferrer" aria-label="Contactar a Tu Salud Primero por WhatsApp" title="Habla con un asesor por WhatsApp"><MessageCircle size={29}/><span>{siteContent.whatsapp.floatingLabel}</span></a>}</main> : <main className="shell section"><div className="sectionHeading"><span className="eyebrow">ÁREA PRIVADA</span><h1>Portal de prospectos</h1><p>Acceso exclusivo para ejecutivos y administradores autorizados.</p></div>{!supabase ? <div className="panel">Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en Cloudflare y en tu entorno local.</div> : !session ? <form className="form login" onSubmit={login}><h2>Iniciar sesión</h2><label>Correo electrónico<input type="email" required value={loginEmail} onChange={e => setLoginEmail(e.target.value)}/></label><label>Contraseña<input type="password" required value={password} onChange={e => setPassword(e.target.value)}/></label><button disabled={loading} className="btn primary">{loading ? 'Ingresando...' : 'Ingresar'} <ArrowRight size={17}/></button><p className="small">Las cuentas se habilitan por invitación del administrador. No hay registro público.</p></form> : !profile ? <div className="panel">Sesión iniciada. Falta autorizar el perfil de este usuario.</div> : <><div className="toolbar"><div><h2>Hola, {profile.full_name?.trim()||session.user.email?.split('@')[0]||'equipo'}</h2><p className="small">Rol: {profile.role}</p></div><button className="btn outline" onClick={() => supabase.auth.signOut()}><LogOut size={16}/> Cerrar sesión</button></div><div className="crm-tabs" role="tablist" aria-label="Secciones del CRM"><button role="tab" aria-selected={tab === 'dashboard'} className={tab === 'dashboard' ? 'crm-tab active' : 'crm-tab'} onClick={() => setTab('dashboard')}>Dashboard</button><button role="tab" aria-selected={tab === 'leads'} className={tab === 'leads' ? 'crm-tab active' : 'crm-tab'} onClick={() => setTab('leads')}>Prospectos</button><button role="tab" aria-selected={tab==='agenda'} className={tab==='agenda'?'crm-tab active':'crm-tab'} onClick={()=>{setTab('agenda');void refreshAgenda()}}>Agenda {overdueAgenda.length>0&&<span className="v3-count">{overdueAgenda.length}</span>}</button><button role="tab" aria-selected={tab==='kanban'} className={tab==='kanban'?'crm-tab active':'crm-tab'} onClick={()=>setTab('kanban')}>Embudo</button>{canViewReports&&<button role="tab" aria-selected={tab==='reports'} className={tab==='reports'?'crm-tab active':'crm-tab'} onClick={()=>setTab('reports')}>Informes</button>}{profile.role==='admin'&&<button role="tab" aria-selected={tab==='audit'} className={tab==='audit'?'crm-tab active':'crm-tab'} onClick={()=>{setTab('audit');void refreshAudit()}}>Auditoría</button>}{profile.role==='admin'&&<button role="tab" aria-selected={tab==='site'} className={tab==='site'?'crm-tab active':'crm-tab'} onClick={()=>setTab('site')}>Editar sitio web</button>}{profile.role === 'admin' && <button role="tab" aria-selected={tab === 'users'} className={tab === 'users' ? 'crm-tab active' : 'crm-tab'} onClick={() => setTab('users')}>Usuarios y permisos</button>}</div>
            {tab==='site'&&profile.role==='admin'&&supabase&&<SiteEditor db={supabase} published={siteContent} onPublished={setSiteContent}/>}
            {tab === 'dashboard' && <div className="crm-dashboard"><div className="crm-section-head"><div><h2>Resumen comercial</h2><p className="small">Información de los prospectos a los que tienes acceso.</p></div><button className="btn outline" onClick={refresh} disabled={loading}>{loading ? 'Actualizando...' : 'Actualizar datos'}</button></div><div className="crm-kpis"><div className="crm-kpi"><span>Prospectos visibles</span><strong>{leads.length}</strong><small>Registros cargados</small></div><button className="crm-kpi crm-kpi-action" onClick={openUnassigned}><span>Sin asignar</span><strong>{unassignedCount}</strong><small>Ver pendientes →</small></button><div className="crm-kpi"><span>En gestión</span><strong>{activeCount}</strong><small>Contactados y en gestión</small></div><div className="crm-kpi"><span>Convertidos</span><strong>{convertedCount}</strong><small>{conversionRate}% de los visibles</small></div></div><section className="crm-report-card v4-source-report"><h3>Origen de los prospectos</h3><p className="small">Origen registrado en el formulario público (solo registros cargados).</p><div className="v4-source-stats">{['formulario','portada','menu','cotizador'].map(origin=><div key={origin}><strong>{leads.filter(l=>(l.lead_source||'formulario')===origin).length}</strong><span>{origin}</span></div>)}</div></section><div className="v3-dashboard-shortcuts"><button onClick={()=>{setTab('agenda');setAgendaFilter('vencidos');void refreshAgenda()}}>🔴 {overdueAgenda.length} vencidos</button><button onClick={()=>{setTab('agenda');setAgendaFilter('hoy');void refreshAgenda()}}>📅 {todayAgenda.length} para hoy</button><button onClick={()=>{setTab('agenda');setAgendaFilter('proximos');void refreshAgenda()}}>⏰ {nextWeekAgenda.length} próximos 7 días</button><button onClick={()=>{setTab('kanban')}}>📊 Abrir embudo</button></div>{canViewReports ? <div className="crm-report-grid"><section className="crm-report-card"><h3>Solicitudes recibidas · últimos 7 días</h3><p className="small">Según la fecha de registro de los prospectos visibles.</p><div className="crm-bars" aria-label="Solicitudes recibidas en los últimos siete días">{dailyCounts.map(d => <div className="crm-bar-col" key={d.date.toISOString()}><span className="crm-bar-value">{d.count}</span><div className="crm-bar-track"><div className="crm-bar-fill" style={{ height: `${Math.max(4, d.count / maxDaily * 100)}%` }}/></div><span className="crm-bar-label">{d.label}</span></div>)}</div></section><section className="crm-report-card"><h3>Distribución por estado</h3><p className="small">Cantidad de prospectos por etapa comercial.</p><div className="crm-status-list">{statuses.map(st => { const n = leads.filter(l => l.status === st).length; return <div className="crm-status-row" key={st}><span>{st.replace(/_/g, ' ')}</span><div className="crm-progress"><div style={{ width: `${leads.length ? n / leads.length * 100 : 0}%` }}/></div><strong>{n}</strong></div>; })}</div></section></div> : <p className="small">Los gráficos detallados están disponibles para usuarios con permiso «Ver reportes».</p>}<section className="crm-report-card"><div className="crm-section-head"><h3>Últimos prospectos</h3><button className="btn outline" onClick={() => setTab('leads')}>Ver bandeja completa</button></div><div className="crm-recent">{leads.slice(0, 5).map(l => <div className="crm-recent-item" key={l.id}><div><strong>{l.full_name}</strong><span>{l.interest} · {new Date(l.created_at).toLocaleDateString('es-CL')}</span></div><span className="crm-pill">{l.status.replace(/_/g, ' ')}</span></div>)}{leads.length === 0 && <p className="small">Todavía no hay prospectos visibles.</p>}</div></section><p className="small">Los indicadores corresponden a los registros cargados (máximo 300), no necesariamente a toda la base de datos.</p></div>}

            {tab==='agenda'&&<section className="panel v3-panel"><div className="toolbar"><div><h2>Agenda comercial</h2><p className="small">Seguimientos visibles según tus permisos</p></div><button className="btn outline" disabled={agendaLoading} onClick={()=>void refreshAgenda()}>{agendaLoading?'Cargando...':'Actualizar agenda'}</button></div><div className="v3-summary"><span>{overdueAgenda.length} vencidos</span><span>{todayAgenda.length} hoy</span><span>{nextWeekAgenda.length} próximos 7 días</span><span>{pendingAgenda.length} pendientes</span></div><div className="v3-actions"><select aria-label="Filtrar agenda" value={agendaFilter} onChange={e=>setAgendaFilter(e.target.value)}>{[['pendientes','Pendientes'],['vencidos','Vencidos'],['hoy','Hoy'],['proximos','Próximos 7 días'],['completados','Completados'],['todos','Todos']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><input placeholder="Buscar prospecto o detalle" value={agendaQuery} onChange={e=>setAgendaQuery(e.target.value)}/></div><div className="v3-list">{visibleAgenda.map(a=><article className="v3-list-item" key={a.id}><div><strong>{a.lead_name}</strong><p>{a.body}</p><small>{dateCL(a.followup_at)} · {a.author_name}</small></div><div className="v3-item-actions"><a href={'tel:'+a.lead_phone}>Llamar</a><button onClick={()=>{setSelectedLeadId(a.lead_id);setTab('leads')}}>Ver ficha</button>{(profile.role==='admin'||(a.assigned_to===profile.id&&a.author_id===profile.id&&permissions.some(p=>p.user_id===profile.id&&p.manage_assigned_leads)))&&<button onClick={()=>void agendaComplete(a)}>{a.completed_at?'Reabrir':'Completar'}</button>}</div></article>)}{!visibleAgenda.length&&<p className="small">No hay seguimientos en esta categoría.</p>}</div></section>}
            {tab==='kanban'&&<section className="panel v3-panel"><div className="toolbar"><div><h2>Embudo comercial</h2><p className="small">Abre fichas o cambia el estado según tus permisos</p></div><button className="btn outline" onClick={()=>void refresh()}>Actualizar</button></div><div className="v3-kanban">{statuses.map(st=><div className="v3-lane" key={st}><h3>{statusNames[st]} <span>{leads.filter(l=>l.status===st).length}</span></h3>{leads.filter(l=>l.status===st).map(l=><article className="v3-lead-card" key={l.id}><button className="v3-link" onClick={()=>setSelectedLeadId(l.id)}>{l.full_name}</button><small>{l.interest}</small><small>{users.find(u=>u.id===l.assigned_to)?.full_name||'Sin asignar'}</small>{canManageLead(l)&&<select aria-label={'Estado de '+l.full_name} value={l.status} disabled={savingStatusIds.includes(l.id)} onChange={e=>void updateStatus(l.id,e.target.value)}>{statuses.map(next=><option key={next} value={next}>{statusNames[next]}</option>)}</select>}</article>)}</div>)}</div></section>}
            {tab==='reports'&&canViewReports&&<section className="panel v3-panel"><div className="toolbar"><div><h2>Informes comerciales</h2><p className="small">Indicadores sobre los prospectos visibles, hasta 300 registros</p></div><label>Período <select value={reportDays} onChange={e=>setReportDays(e.target.value)}><option value="7">7 días</option><option value="30">30 días</option><option value="90">90 días</option><option value="365">365 días</option></select></label></div><div className="v3-summary"><span>{reportLeads.length} recibidos</span><span>{reportLeads.filter(l=>l.status==='convertido').length} convertidos</span><span>{reportLeads.length?Math.round(reportLeads.filter(l=>l.status==='convertido').length/reportLeads.length*100):0}% conversión</span><span>{reportLeads.filter(l=>!l.assigned_to).length} sin asignar</span></div><h3>Resultados por ejecutivo</h3><div className="tableScroll"><table><thead><tr><th>Ejecutivo</th><th>Asignados</th><th>En gestión</th><th>Convertidos</th></tr></thead><tbody>{users.map(u=>{const rows=reportLeads.filter(l=>l.assigned_to===u.id);return <tr key={u.id}><td>{u.full_name||u.id}</td><td>{rows.length}</td><td>{rows.filter(l=>['contactado','en_gestion'].includes(l.status)).length}</td><td>{rows.filter(l=>l.status==='convertido').length}</td></tr>})}</tbody></table></div><p className="small">Los resultados muestran el estado actual de los prospectos recibidos en el período; no son estadísticas históricas de cambios de estado.</p></section>}
            {tab==='audit'&&profile.role==='admin'&&<section className="panel v3-panel"><div className="toolbar"><div><h2>Auditoría de gestiones</h2><p className="small">Últimos 150 cambios registrados</p></div><button className="btn outline" disabled={auditLoading} onClick={()=>void refreshAudit()}>{auditLoading?'Cargando...':'Actualizar'}</button></div><div className="tableScroll"><table><thead><tr><th>Fecha</th><th>Acción</th><th>Responsable</th><th>Prospecto</th></tr></thead><tbody>{audit.map(a=><tr key={a.id}><td>{dateCL(a.changed_at)}</td><td>{a.action}</td><td>{a.actor_name}</td><td>{leads.find(l=>l.id===a.lead_id)?.full_name||a.lead_id}</td></tr>)}</tbody></table></div>{!audit.length&&<p className="small">No hay cambios registrados.</p>}</section>}
            {tab === 'users' && profile.role === 'admin' ? <div className="panel"><h2>Usuarios y permisos individuales</h2><p className="small">Primero crea el usuario en Supabase Authentication → Users. Después introduce su UID aquí. No compartas contraseñas.</p><form onSubmit={provision} className="form"><label>UID del usuario<input required value={newUid} onChange={e => setNewUid(e.target.value)} placeholder="UUID de Authentication"/></label><label>Nombre<input required value={newName} onChange={e => setNewName(e.target.value)}/></label><label>Rol<select value={newRole} onChange={e => setNewRole(e.target.value)}><option value="executive">Ejecutivo</option><option value="supervisor">Supervisor</option></select></label><button className="btn primary" disabled={loading}>Crear perfil</button></form>{users.filter(u => u.role !== 'admin').map(u => { const p = permissions.find(x => x.user_id === u.id) || defaultPermission(u.id); return <div className="panel" key={u.id}><h3>{u.full_name} · {u.role}</h3>{([['view_assigned_leads', 'Ver prospectos asignados'], ['view_all_leads', 'Ver todos los prospectos'], ['manage_assigned_leads', 'Gestionar asignados'], ['assign_leads', 'Asignar prospectos'], ['view_reports', 'Ver reportes'], ['manage_users', 'Gestionar usuarios (reservado para una versión futura)']] as const).map(([field, label]) => <label className="check" key={field}><input type="checkbox" checked={p[field]} disabled={field === 'manage_users'} onChange={e => setPermissions(prev => [...prev.filter(x => x.user_id !== u.id), { ...p, [field]: e.target.checked }])}/>{label}</label>)}<button className="btn primary" onClick={() => savePermission(p)}>Guardar permisos</button></div>; })}</div> : tab === 'leads' ? <div className="panel"><div className="toolbar"><h2>Bandeja de prospectos</h2><button className="btn outline" onClick={refresh}>Actualizar</button></div><input placeholder="Buscar por nombre, teléfono, correo o motivo" value={search} onChange={e => setSearch(e.target.value)}/><div className="crm-filters"><label>Estado<select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="todos">Todos los estados</option>{statuses.map(s => <option value={s} key={s}>{s.replace(/_/g, ' ')}</option>)}</select></label><label>Asignación<select value={assignmentFilter} onChange={e => setAssignmentFilter(e.target.value)}><option value="todos">Todos</option><option value="unassigned">Sin asignar</option><option value="assigned">Asignados</option></select></label><label>Ejecutivo<select value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)}><option value="todos">Todos los ejecutivos</option>{users.map(u => <option key={u.id} value={u.id}>{u.full_name || u.id}</option>)}</select></label><label>Orden<select value={sortOrder} onChange={e => setSortOrder(e.target.value)}><option value="recent">Más recientes</option><option value="oldest">Más antiguos</option></select></label></div><div className="crm-filter-summary"><span>{filtered.length} prospecto(s) encontrados</span><button className="crm-text-button" onClick={() => { setSearch(''); setStatusFilter('todos'); setAssignmentFilter('todos'); setOwnerFilter('todos'); setSortOrder('recent'); }}>Limpiar filtros</button></div><div className="v3-actions">{canAssign&&<><label>Asignar seleccionados <select value={bulkOwner} onChange={e=>setBulkOwner(e.target.value)}><option value="">Elegir ejecutivo</option>{users.map(u=><option key={u.id} value={u.id}>{u.full_name||u.id}</option>)}</select></label><button type="button" disabled={!bulkOwner||!selectedIds.length||busyBulk} onClick={()=>void bulkAssign()}>{busyBulk?'Asignando...':`Asignar ${selectedIds.length}`}</button></>}<button type="button" onClick={exportLeads}>Exportar CSV</button></div><div className="tableScroll"><table><thead><tr>{canAssign&&<th><input type="checkbox" aria-label="Seleccionar visibles" checked={filtered.length>0&&filtered.every(l=>selectedIds.includes(l.id))} onChange={e=>setSelectedIds(e.target.checked?filtered.map(l=>l.id):[])}/></th>}<th>Nombre</th><th>Contacto</th><th>Interés</th><th>Estado</th><th>Asignado a</th><th>Fecha</th></tr></thead><tbody>{filtered.map(l => <tr key={l.id}>{canAssign&&<td><input type="checkbox" aria-label={`Seleccionar ${l.full_name}`} checked={selectedIds.includes(l.id)} onChange={e=>setSelectedIds(old=>e.target.checked?[...old,l.id]:old.filter(id=>id!==l.id))}/></td>}<td><button type="button" className="crm-lead-link" onClick={()=>setSelectedLeadId(l.id)}>{l.full_name}</button><button type="button" className="crm-lead-open" onClick={()=>setSelectedLeadId(l.id)}>Ver ficha</button></td><td>{l.phone}<br />{l.email || ''}</td><td>{l.interest}</td><td><select aria-label={`Estado de ${l.full_name}`} value={l.status} disabled={!canManageLead(l) || savingStatusIds.includes(l.id)} onChange={e => void updateStatus(l.id, e.target.value)}>{!statuses.includes(l.status) && <option value={l.status}>{l.status} (estado anterior)</option>}{statuses.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}</select>{savingStatusIds.includes(l.id)&&<small className="crm-status-saving" role="status">Guardando...</small>}</td><td>{canAssign ? <select value={l.assigned_to || ''} onChange={e => assignLead(l.id, e.target.value)}><option value="">Sin asignar</option>{users.map(u => <option key={u.id} value={u.id}>{u.full_name || u.id}</option>)}</select> : users.find(u => u.id === l.assigned_to)?.full_name || '—'}</td><td>{new Date(l.created_at).toLocaleDateString('es-CL')}</td></tr>)}</tbody></table></div>{filtered.length === 0 && <p className="small">No hay prospectos para mostrar.</p>}</div> : null}</>}</main>}
 {selectedLeadId&&profile&&leads.some(l=>l.id===selectedLeadId)&&<LeadDetail key={selectedLeadId} lead={leads.find(l=>l.id===selectedLeadId)!} users={users} canManage={canManageLead(leads.find(l=>l.id===selectedLeadId)!)} isAdmin={profile.role==='admin'} currentUserId={session?.user.id||''} onClose={()=>setSelectedLeadId(null)} onSaved={()=>void refresh()}/>}
 {notice && <div className={`toast ${notice.includes('Solicitud enviada correctamente') ? 'toast-success' : ''}`} role="status">{notice.includes('Solicitud enviada correctamente') && <CheckCircle2 size={21} className="toast-success-icon" aria-hidden="true"/>}<span className="toast-message">{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Cerrar notificación">×</button></div>}<footer><div className="shell">{siteContent.footer.text}</div></footer></>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);