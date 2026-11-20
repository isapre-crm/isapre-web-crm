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

## v2.1: Permisos individuales

1. Antes de modificar el despliegue, realiza un respaldo de Supabase y verifica la política de acceso de los prospectos.
2. Ejecuta `supabase/migration_v2_1.sql` una sola vez en SQL Editor. Esta migración revoca el RPC público de captación mientras se incorpora un endpoint protegido con Turnstile y límites de solicitudes.
3. Sube `src/main.tsx`, `src/vite-env.d.ts` y `supabase/migration_v2_1.sql` al repositorio GitHub, respetando la ruta `isapre-crm-v2/`.
4. Despliega el commit nuevo en Cloudflare. Las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY se mantienen.
5. En Authentication > Users, crea usuarios con credenciales temporales por un canal seguro. Copia su UID. En CRM > Usuarios y permisos, registra su UID, nombre y rol y configura los permisos.
6. Verifica con dos usuarios distintos que cada uno ve solo los prospectos permitidos. Las políticas RLS son la fuente de verdad.

Limitaciones deliberadas: esta versión NO envía invitaciones por correo desde el CRM, NO permite a otros usuarios administrar cuentas aunque el campo esté reservado y NO activa el formulario público hasta disponer de endpoint antispam. Los permisos `view_reports` quedan almacenados para una futura pantalla de reportes. La vista de prospectos muestra como máximo 300 registros y debe incorporar paginación antes de producción a escala. La gestión de usuarios no permite asignar el rol admin por RPC. No subir claves secretas ni contraseñas a GitHub.
