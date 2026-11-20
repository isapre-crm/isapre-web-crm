# Tu Salud Primero — CRM v2 (base inicial)

React + TypeScript + Vite + Supabase, deploy en Cloudflare Pages.

## 1. Preparar Supabase

1. En Supabase > SQL Editor ejecuta `supabase/schema.sql` una vez en un proyecto nuevo.
2. En Authentication > Providers > Email, habilita email/password y **desactiva el registro público (Allow new users to sign up)**. Crea las cuentas de ejecutivos manualmente en Authentication > Users (o usa invitaciones administrativas). Configura la verificación de email y SMTP antes de producción.
3. Crea tu propio usuario en Authentication > Users. Copia su UUID y ejecuta en SQL Editor (reemplaza UUID y nombre):

```sql
insert into public.profiles (id,full_name,role)
values ('REEMPLAZAR-UUID-DE-AUTH-USERS','Administrador principal','admin');
```

4. Para agregar ejecutivos, crea primero sus cuentas en Authentication > Users y luego ejecuta:

```sql
insert into public.profiles (id,full_name,role)
values ('REEMPLAZAR-UUID-DE-EJECUTIVO','Ejecutivo 1','executive');
```

**No** compartas contraseñas, `service_role` o claves secretas. Solo se utiliza la clave pública `publishable`/`anon` en el navegador.

## 2. Ejecutar en local

Requiere Node.js 20+.

```bash
npm install
cp .env.example .env.local
# Edita .env.local con Project URL y Publishable key (Supabase > Project Settings > API)
npm run dev
```

## 3. GitHub y Cloudflare

Sube los archivos del proyecto a tu repositorio privado. En Cloudflare Pages, conecta el repositorio, usa build command `npm run build`, output directory `dist` y agrega `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` como variables de entorno. Para rutas de SPA como `/crm`, Cloudflare Pages suele servir `index.html` como fallback cuando no existe `404.html`; verifica que al recargar `/crm` funcione.

## Estado y advertencias importantes

- El formulario público usa un RPC de Supabase para una **prueba funcional**. Antes de recibir leads reales, **mueve la captura a un Cloudflare Worker con Turnstile y limitación de solicitudes**, y revoca el acceso anónimo al RPC. Si no, puede recibir spam y agotar el plan Free.
- El formulario de privacidad es provisional: redacta y publica una política de privacidad real, especifica responsables, finalidades, retención y derechos, y verifica cumplimiento de la legislación chilena antes de lanzar.
- Los leads nuevos quedan **sin asignar**. Solo administradores/supervisores pueden verlos. Falta construir asignación automática, gestión de usuarios y acciones de asignación seguras.
- El CRM v2 inicial permite ver prospectos y cambiar estados, no contiene todavía exportación, bitácora visual, notificaciones ni gestión completa de usuarios.
- No hay respaldo automático incluido en esta entrega. Diseña y prueba respaldos antes de usarlo en producción.
- No se ha desplegado ni conectado a cuentas reales desde este entorno.
