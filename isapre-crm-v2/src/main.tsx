import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient, type Session } from '@supabase/supabase-js';
import { HeartPulse, MessageCircle, ShieldCheck, Users, LayoutDashboard, LogOut, ArrowRight, Phone, ClipboardList } from 'lucide-react';
import './style.css';
const url=import.meta.env.VITE_SUPABASE_URL;
const key=import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase=url&&key?createClient(url,key):null;
type Lead={id:string;full_name:string;phone:string;email:string|null;interest:string;status:string;assigned_to:string|null;created_at:string};
type Profile={id:string;full_name:string;role:'admin'|'supervisor'|'executive'};
type Permission={user_id:string;view_all_leads:boolean;manage_assigned_leads:boolean;assign_leads:boolean;view_reports:boolean;manage_users:boolean};
const defaultPermission=(user_id:string):Permission=>({user_id,view_all_leads:false,manage_assigned_leads:true,assign_leads:false,view_reports:false,manage_users:false});
const statuses=['nuevo','contactado','cotizando','seguimiento','cerrado','descartado'];
function App(){
 const [session,setSession]=useState<Session|null>(null),[profile,setProfile]=useState<Profile|null>(null),[leads,setLeads]=useState<Lead[]>([]),[loading,setLoading]=useState(false),[notice,setNotice]=useState(''),[view,setView]=useState(location.pathname.startsWith('/crm')?'crm':'home');
 const [fullName,setFullName]=useState(''),[phone,setPhone]=useState(''),[email,setEmail]=useState(''),[interest,setInterest]=useState('Cotizar un plan'),[consent,setConsent]=useState(false);
 const [loginEmail,setLoginEmail]=useState(''),[password,setPassword]=useState(''),[search,setSearch]=useState('');
 const [users,setUsers]=useState<Profile[]>([]),[permissions,setPermissions]=useState<Permission[]>([]),[tab,setTab]=useState<'leads'|'users'>('leads');
 const [newUid,setNewUid]=useState(''),[newName,setNewName]=useState(''),[newRole,setNewRole]=useState('executive');
 useEffect(()=>{if(!supabase)return;supabase.auth.getSession().then(({data})=>setSession(data.session));const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,s)=>setSession(s));return()=>subscription.unsubscribe()},[]);
 useEffect(()=>{if(!supabase||!session){setProfile(null);setLeads([]);setUsers([]);setPermissions([]);return}void (async()=>{const {data,error}=await supabase.from('profiles').select('id,full_name,role').eq('id',session.user.id).single();if(error)setNotice('Tu usuario aún no tiene un perfil autorizado. Contacta al administrador.');setProfile(data as Profile|null)})()},[session]);
 async function refresh(){if(!supabase||!profile)return;setLoading(true);const {data,error}=await supabase.from('leads').select('id,full_name,phone,email,interest,status,assigned_to,created_at').order('created_at',{ascending:false}).limit(300);if(error)setNotice(error.message);else setLeads(data||[]);setLoading(false)}
 useEffect(()=>{if(profile){void refresh();void refreshUsers()}},[profile]);
 async function refreshUsers(){if(!supabase)return;const [u,p]=await Promise.all([supabase.from('profiles').select('id,full_name,role').order('full_name'),supabase.from('user_permissions').select('*')]);if(u.error)setNotice(u.error.message);else setUsers((u.data||[]) as Profile[]);if(p.error)setNotice(p.error.message);else setPermissions((p.data||[]) as Permission[])}
 async function provision(e:React.FormEvent){e.preventDefault();if(!supabase)return;setLoading(true);const {error}=await supabase.rpc('admin_provision_profile',{p_user_id:newUid.trim(),p_full_name:newName.trim(),p_role:newRole});setLoading(false);setNotice(error?error.message:'Perfil creado. Configura sus permisos.');if(!error){setNewUid('');setNewName('');await refreshUsers()}}
 async function savePermission(p:Permission){if(!supabase)return;const {error}=await supabase.rpc('admin_save_user_permissions',{p_user_id:p.user_id,p_view_all_leads:p.view_all_leads,p_manage_assigned_leads:p.manage_assigned_leads,p_assign_leads:p.assign_leads,p_view_reports:p.view_reports,p_manage_users:p.manage_users});setNotice(error?error.message:'Permisos guardados');if(!error)await refreshUsers()}
 async function assignLead(id:string,uid:string){if(!supabase)return;const {error}=await supabase.rpc('admin_assign_lead',{p_lead_id:id,p_user_id:uid||null});setNotice(error?error.message:'Prospecto asignado');if(!error)void refresh()}
 async function submitLead(e:React.FormEvent){e.preventDefault();setNotice('El formulario público está temporalmente deshabilitado hasta activar la protección antispam.');return;/*if(!supabase){setNotice('Configura Supabase para activar el formulario.');return}if(!consent){setNotice('Debes aceptar el tratamiento de tus datos.');return}setLoading(true);const {error}=await supabase.rpc('submit_public_lead',{p_full_name:fullName.trim(),p_phone:phone.trim(),p_email:email.trim()||null,p_interest:interest,p_consent:true});setLoading(false);if(error)setNotice('No pudimos enviar la solicitud. Intenta nuevamente.');else{setNotice('¡Solicitud enviada! Un ejecutivo podrá contactarte.');setFullName('');setPhone('');setEmail('');setConsent(false)}}*/}
 async function login(e:React.FormEvent){e.preventDefault();if(!supabase)return;setLoading(true);const {error}=await supabase.auth.signInWithPassword({email:loginEmail,password});setLoading(false);setNotice(error?'No fue posible ingresar. Revisa tus credenciales.':'')}
 async function updateStatus(id:string,status:string){if(!supabase)return;const {error}=await supabase.from('leads').update({status}).eq('id',id);if(error)setNotice('No tienes permiso para modificar este prospecto.');else void refresh()}
 function navigate(v:string){setView(v);history.pushState({},'',v==='crm'?'/crm':'/');window.scrollTo(0,0)}
 const filtered=leads.filter(l=>`${l.full_name} ${l.phone} ${l.interest}`.toLowerCase().includes(search.toLowerCase()));
 return <><header><div className="shell nav"><div className="brand"><HeartPulse size={26}/> Tu Salud Primero</div><nav><button className="link" onClick={()=>navigate('home')}>Inicio</button><button className="link" onClick={()=>navigate('crm')}>Portal CRM</button></nav></div></header>
  {filtered.length===0&&<p className="small">No hay prospectos para mostrar.</p>}</div>}</></main>}
  {notice&&<div className="toast" role="status">{notice}<button onClick={()=>setNotice('')}>×</button></div>}<footer><div className="shell">Tu Salud Primero · Sitio de asesoría independiente · Versión inicial para configuración y pruebas</div></footer></>}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
