import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient, type Session } from '@supabase/supabase-js';
import { HeartPulse, MessageCircle, ShieldCheck, Users, LogOut, ArrowRight, Phone } from 'lucide-react';
import './style.css';
import './crm-v23.css';
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
const statuses = ['nuevo', 'contactado', 'en_gestion', 'convertido', 'descartado'];
function App() {
    const [session, setSession] = useState<Session | null>(null), [profile, setProfile] = useState<Profile | null>(null), [leads, setLeads] = useState<Lead[]>([]), [loading, setLoading] = useState(false), [notice, setNotice] = useState(''), [view, setView] = useState(location.pathname.startsWith('/crm') ? 'crm' : 'home');
    const [fullName, setFullName] = useState(''), [phone, setPhone] = useState(''), [email, setEmail] = useState(''), [interest, setInterest] = useState('Cotizar un plan'), [consent, setConsent] = useState(false);
    const [turnstileToken, setTurnstileToken] = useState(''), [turnstileReady, setTurnstileReady] = useState(false), [sendingLead, setSendingLead] = useState(false);
    const turnstileContainer = useRef<HTMLDivElement | null>(null), turnstileWidget = useRef<string | null>(null);
    const [loginEmail, setLoginEmail] = useState(''), [password, setPassword] = useState(''), [search, setSearch] = useState('');
    const [users, setUsers] = useState<Profile[]>([]), [permissions, setPermissions] = useState<Permission[]>([]), [tab, setTab] = useState<'dashboard' | 'leads' | 'users'>('dashboard');
    const [statusFilter, setStatusFilter] = useState('todos'), [assignmentFilter, setAssignmentFilter] = useState('todos'), [ownerFilter, setOwnerFilter] = useState('todos'), [sortOrder, setSortOrder] = useState('recent');
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
        return; setLoading(true); const { data, error } = await supabase.from('leads').select('id,full_name,phone,email,interest,status,assigned_to,created_at').order('created_at', { ascending: false }).limit(300); if (error)
        setNotice(error.message);
    else
        setLeads(data || []); setLoading(false); }
    useEffect(() => { if (profile) {
        void refresh();
        void refreshUsers();
    } }, [profile]);
    async function refreshUsers() { if (!supabase)
        return; const [u, p] = await Promise.all([supabase.from('profiles').select('id,full_name,role').order('full_name'), supabase.from('user_permissions').select('*')]); if (u.error)
        setNotice(u.error.message);
    else
        setUsers((u.data || []) as Profile[]); if (p.error)
        setNotice(p.error.message);
    else
        setPermissions((p.data || []) as Permission[]); }
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
            const result = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ full_name: fullName.trim(), phone: phone.trim(), email: email.trim() || null, interest, consent: true, turnstile_token: turnstileToken }) });
            const payload = await result.json().catch(() => ({}));
            if (!result.ok)
                throw new Error(typeof payload.error === 'string' ? payload.error : 'No se pudo enviar la solicitud.');
            setNotice('¡Solicitud enviada correctamente! Pronto nos pondremos en contacto.');
            setFullName('');
            setPhone('');
            setEmail('');
            setInterest('Cotizar un plan');
            setConsent(false);
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
    async function updateStatus(id: string, status: string) { if (!supabase)
        return; const { error } = await supabase.rpc('update_lead_status', { p_lead_id: id, p_status: status }); if (error)
        setNotice('No se pudo cambiar el estado: ' + error.message);
    else
        void refresh(); }
    function navigate(v: string) { setView(v); history.pushState({}, '', v === 'crm' ? '/crm' : '/'); window.scrollTo(0, 0); }
    const canViewReports = profile?.role === 'admin' || permissions.some(p => p.user_id === profile?.id && p.view_reports);
    const canAssign = profile?.role === 'admin' || permissions.some(p => p.user_id === profile?.id && p.assign_leads);
    const filtered = leads.filter(l => {
        const term = search.trim().toLocaleLowerCase('es-CL');
        const matchesText = `${l.full_name} ${l.phone} ${l.email || ''} ${l.interest}`.toLocaleLowerCase('es-CL').includes(term);
        return matchesText && (statusFilter === 'todos' || l.status === statusFilter) && (assignmentFilter === 'todos' || (assignmentFilter === 'unassigned' ? !l.assigned_to : !!l.assigned_to)) && (ownerFilter === 'todos' || l.assigned_to === ownerFilter);
    }).sort((a, b) => sortOrder === 'oldest' ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime() : new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const unassignedCount = leads.filter(l => !l.assigned_to).length;
    const activeCount = leads.filter(l => ['contactado', 'en_gestion'].includes(l.status)).length;
    const convertedCount = leads.filter(l => l.status === 'convertido').length;
    const conversionRate = leads.length ? Math.round(convertedCount / leads.length * 100) : 0;
    const dailyCounts = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (6 - i)); return { date: d, label: d.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric' }), count: leads.filter(l => { const x = new Date(l.created_at); return x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth() && x.getDate() === d.getDate(); }).length }; });
    const maxDaily = Math.max(1, ...dailyCounts.map(d => d.count));
    function openUnassigned() { setTab('leads'); setAssignmentFilter('unassigned'); setStatusFilter('todos'); setOwnerFilter('todos'); setSearch(''); }
    return <><header><div className="shell nav"><div className="brand"><HeartPulse size={26}/> Tu Salud Primero</div><nav><button className="link" onClick={() => navigate('home')}>Inicio</button><button className="link" onClick={() => navigate('crm')}>Portal CRM</button></nav></div></header>
 {view === 'home' ? <main><section className="hero"><div className="shell heroGrid"><div><span className="eyebrow">ASESORÍA PERSONALIZADA EN CHILE</span><h1>Tu salud merece un plan a tu medida.</h1><p>Te ayudamos a conocer alternativas de Isapre y encontrar opciones que se ajusten a tus necesidades.</p><a className="btn green" href="#contacto"><MessageCircle size={19}/> Solicitar asesoría</a><a className="btn outline" href="#contacto">Cotizar mi plan <ArrowRight size={17}/></a></div><div className="heroCard"><HeartPulse size={46}/><h2>Asesoría cercana y transparente</h2><p>Conversa con un ejecutivo y recibe orientación personalizada.</p><div className="feature"><ShieldCheck /> Información clara</div><div className="feature"><Users /> Atención humana</div><div className="feature"><Phone /> Contacto directo</div></div></div></section><section className="shell section" id="contacto"><div className="sectionHeading"><span className="eyebrow">CONTACTO</span><h2>Solicita una asesoría</h2><p>Déjanos tus datos y un ejecutivo podrá contactarte.</p></div><form className="form" onSubmit={submitLead}><label>Nombre completo<input required maxLength={120} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Tu nombre"/></label><label>Teléfono de contacto<input required maxLength={30} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+56 9 ..."/></label><label>Correo (opcional)<input type="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.cl"/></label><label>Motivo de consulta<select value={interest} onChange={e => setInterest(e.target.value)}><option>Cotizar un plan</option><option>Cambiar de Isapre</option><option>Recibir asesoría</option></select></label><label className="check"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}/> Autorizo el uso de estos datos para responder a mi solicitud. Debe publicarse una política de privacidad definitiva antes del lanzamiento.</label><div ref={turnstileContainer} aria-label="Verificación de seguridad"/><button className="btn primary" disabled={sendingLead || !consent || !turnstileToken || !turnstileReady || !turnstileSiteKey}>{sendingLead ? 'Enviando solicitud...' : 'Enviar solicitud'} <ArrowRight size={17}/></button><p className="small">No solicitamos antecedentes médicos en este formulario.</p></form></section></main> : <main className="shell section"><div className="sectionHeading"><span className="eyebrow">ÁREA PRIVADA</span><h1>Portal de prospectos</h1><p>Acceso exclusivo para ejecutivos y administradores autorizados.</p></div>{!supabase ? <div className="panel">Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en Cloudflare y en tu entorno local.</div> : !session ? <form className="form login" onSubmit={login}><h2>Iniciar sesión</h2><label>Correo electrónico<input type="email" required value={loginEmail} onChange={e => setLoginEmail(e.target.value)}/></label><label>Contraseña<input type="password" required value={password} onChange={e => setPassword(e.target.value)}/></label><button disabled={loading} className="btn primary">{loading ? 'Ingresando...' : 'Ingresar'} <ArrowRight size={17}/></button><p className="small">Las cuentas se habilitan por invitación del administrador. No hay registro público.</p></form> : !profile ? <div className="panel">Sesión iniciada. Falta autorizar el perfil de este usuario.</div> : <><div className="toolbar"><div><h2>Hola, {profile.full_name}</h2><p className="small">Rol: {profile.role}</p></div><button className="btn outline" onClick={() => supabase.auth.signOut()}><LogOut size={16}/> Cerrar sesión</button></div><div className="crm-tabs" role="tablist" aria-label="Secciones del CRM"><button role="tab" aria-selected={tab === 'dashboard'} className={tab === 'dashboard' ? 'crm-tab active' : 'crm-tab'} onClick={() => setTab('dashboard')}>Dashboard</button><button role="tab" aria-selected={tab === 'leads'} className={tab === 'leads' ? 'crm-tab active' : 'crm-tab'} onClick={() => setTab('leads')}>Prospectos</button>{profile.role === 'admin' && <button role="tab" aria-selected={tab === 'users'} className={tab === 'users' ? 'crm-tab active' : 'crm-tab'} onClick={() => setTab('users')}>Usuarios y permisos</button>}</div>
            {tab === 'dashboard' && <div className="crm-dashboard"><div className="crm-section-head"><div><h2>Resumen comercial</h2><p className="small">Información de los prospectos a los que tienes acceso.</p></div><button className="btn outline" onClick={refresh} disabled={loading}>{loading ? 'Actualizando...' : 'Actualizar datos'}</button></div><div className="crm-kpis"><div className="crm-kpi"><span>Prospectos visibles</span><strong>{leads.length}</strong><small>Registros cargados</small></div><button className="crm-kpi crm-kpi-action" onClick={openUnassigned}><span>Sin asignar</span><strong>{unassignedCount}</strong><small>Ver pendientes →</small></button><div className="crm-kpi"><span>En gestión</span><strong>{activeCount}</strong><small>Contactados y en gestión</small></div><div className="crm-kpi"><span>Convertidos</span><strong>{convertedCount}</strong><small>{conversionRate}% de los visibles</small></div></div>{canViewReports ? <div className="crm-report-grid"><section className="crm-report-card"><h3>Solicitudes recibidas · últimos 7 días</h3><p className="small">Según la fecha de registro de los prospectos visibles.</p><div className="crm-bars" aria-label="Solicitudes recibidas en los últimos siete días">{dailyCounts.map(d => <div className="crm-bar-col" key={d.date}><span className="crm-bar-value">{d.count}</span><div className="crm-bar-track"><div className="crm-bar-fill" style={{ height: `${Math.max(4, d.count / maxDaily * 100)}%` }}/></div><span className="crm-bar-label">{d.label}</span></div>)}</div></section><section className="crm-report-card"><h3>Distribución por estado</h3><p className="small">Cantidad de prospectos por etapa comercial.</p><div className="crm-status-list">{statuses.map(st => { const n = leads.filter(l => l.status === st).length; return <div className="crm-status-row" key={st}><span>{st.replace(/_/g, ' ')}</span><div className="crm-progress"><div style={{ width: `${leads.length ? n / leads.length * 100 : 0}%` }}/></div><strong>{n}</strong></div>; })}</div></section></div> : <p className="small">Los gráficos detallados están disponibles para usuarios con permiso «Ver reportes».</p>}<section className="crm-report-card"><div className="crm-section-head"><h3>Últimos prospectos</h3><button className="btn outline" onClick={() => setTab('leads')}>Ver bandeja completa</button></div><div className="crm-recent">{leads.slice(0, 5).map(l => <div className="crm-recent-item" key={l.id}><div><strong>{l.full_name}</strong><span>{l.interest} · {new Date(l.created_at).toLocaleDateString('es-CL')}</span></div><span className="crm-pill">{l.status.replace(/_/g, ' ')}</span></div>)}{leads.length === 0 && <p className="small">Todavía no hay prospectos visibles.</p>}</div></section><p className="small">Los indicadores corresponden a los registros cargados (máximo 300), no necesariamente a toda la base de datos.</p></div>}
            {tab === 'users' && profile.role === 'admin' ? <div className="panel"><h2>Usuarios y permisos individuales</h2><p className="small">Primero crea el usuario en Supabase Authentication → Users. Después introduce su UID aquí. No compartas contraseñas.</p><form onSubmit={provision} className="form"><label>UID del usuario<input required value={newUid} onChange={e => setNewUid(e.target.value)} placeholder="UUID de Authentication"/></label><label>Nombre<input required value={newName} onChange={e => setNewName(e.target.value)}/></label><label>Rol<select value={newRole} onChange={e => setNewRole(e.target.value)}><option value="executive">Ejecutivo</option><option value="supervisor">Supervisor</option></select></label><button className="btn primary" disabled={loading}>Crear perfil</button></form>{users.filter(u => u.role !== 'admin').map(u => { const p = permissions.find(x => x.user_id === u.id) || defaultPermission(u.id); return <div className="panel" key={u.id}><h3>{u.full_name} · {u.role}</h3>{([['view_assigned_leads', 'Ver prospectos asignados'], ['view_all_leads', 'Ver todos los prospectos'], ['manage_assigned_leads', 'Gestionar asignados'], ['assign_leads', 'Asignar prospectos'], ['view_reports', 'Ver reportes'], ['manage_users', 'Gestionar usuarios (reservado para una versión futura)']] as const).map(([field, label]) => <label className="check" key={field}><input type="checkbox" checked={p[field]} disabled={field === 'manage_users'} onChange={e => setPermissions(prev => [...prev.filter(x => x.user_id !== u.id), { ...p, [field]: e.target.checked }])}/>{label}</label>)}<button className="btn primary" onClick={() => savePermission(p)}>Guardar permisos</button></div>; })}</div> : tab === 'leads' ? <div className="panel"><div className="toolbar"><h2>Bandeja de prospectos</h2><button className="btn outline" onClick={refresh}>Actualizar</button></div><input placeholder="Buscar por nombre, teléfono, correo o motivo" value={search} onChange={e => setSearch(e.target.value)}/><div className="crm-filters"><label>Estado<select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="todos">Todos los estados</option>{statuses.map(s => <option value={s} key={s}>{s.replace(/_/g, ' ')}</option>)}</select></label><label>Asignación<select value={assignmentFilter} onChange={e => setAssignmentFilter(e.target.value)}><option value="todos">Todos</option><option value="unassigned">Sin asignar</option><option value="assigned">Asignados</option></select></label><label>Ejecutivo<select value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)}><option value="todos">Todos los ejecutivos</option>{users.map(u => <option key={u.id} value={u.id}>{u.full_name || u.id}</option>)}</select></label><label>Orden<select value={sortOrder} onChange={e => setSortOrder(e.target.value)}><option value="recent">Más recientes</option><option value="oldest">Más antiguos</option></select></label></div><div className="crm-filter-summary"><span>{filtered.length} prospecto(s) encontrados</span><button className="crm-text-button" onClick={() => { setSearch(''); setStatusFilter('todos'); setAssignmentFilter('todos'); setOwnerFilter('todos'); setSortOrder('recent'); }}>Limpiar filtros</button></div><div className="tableScroll"><table><thead><tr><th>Nombre</th><th>Contacto</th><th>Interés</th><th>Estado</th><th>Asignado a</th><th>Fecha</th></tr></thead><tbody>{filtered.map(l => <tr key={l.id}><td>{l.full_name}</td><td>{l.phone}<br />{l.email || ''}</td><td>{l.interest}</td><td><select value={l.status} onChange={e => updateStatus(l.id, e.target.value)}>{!statuses.includes(l.status) && <option value={l.status}>{l.status} (estado anterior)</option>}{statuses.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}</select></td><td>{canAssign ? <select value={l.assigned_to || ''} onChange={e => assignLead(l.id, e.target.value)}><option value="">Sin asignar</option>{users.map(u => <option key={u.id} value={u.id}>{u.full_name || u.id}</option>)}</select> : users.find(u => u.id === l.assigned_to)?.full_name || '—'}</td><td>{new Date(l.created_at).toLocaleDateString('es-CL')}</td></tr>)}</tbody></table></div>{filtered.length === 0 && <p className="small">No hay prospectos para mostrar.</p>}</div> : null}</>}</main>}
 {notice && <div className="toast" role="status">{notice}<button onClick={() => setNotice('')}>×</button></div>}<footer><div className="shell">Tu Salud Primero · Sitio de asesoría independiente · CRM v2.3 · Entorno de pruebas</div></footer></>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
