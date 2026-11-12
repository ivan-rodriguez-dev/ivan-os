# IVAN OS — Personal Command Center

> Your life. Your system. Your control.

Aplicación web para gestionar en un solo lugar turnos laborales, formación SENA, desarrollo
profesional, idiomas, finanzas personales, objetivos y hábitos. Datos reales en PostgreSQL
(Supabase), autenticación real y aislamiento por usuario con Row Level Security.

**Stack:** React 19 · TypeScript (strict) · Vite · Tailwind CSS 4 · Supabase (Postgres + Auth) · Recharts · Lucide.

## Módulos

| Módulo | Ruta | Qué hace |
| --- | --- | --- |
| Command Center | `/` | Saludo y fecha, resumen del día, próximo turno, tareas pendientes, próximas entregas, progreso de objetivos, resumen financiero y actividad semanal. Todo sale de la base de datos. |
| Work & Schedule | `/work` | Turnos diurnos, nocturnos y personalizados; días de descanso; turnos que cruzan la medianoche; horarios guardados; rotaciones aplicables a un rango de fechas; calendario mensual y semanal. |
| Academic Center | `/academic` | Actividades con fecha límite, prioridad, estado y descripción; filtros (pendientes, atrasadas, completadas); proyectos formativos con avance. |
| Skill Development | `/skills` | Habilidades con nivel actual y objetivo, historial de niveles, sesiones de práctica y horas de programación, proyectos personales, tecnologías aprendidas, gráficas de evolución. |
| Language Lab | `/languages` | Idiomas con nivel MCER actual y objetivo; sesiones de listening, speaking, reading y writing con duración y observaciones; horas acumuladas; progreso semanal y mensual. |
| Financial Control | `/finance` | Ingresos y gastos por categoría, balance mensual, tendencia de 6 meses, deudas con pagos, objetivos de ahorro con aportes. Solo registro: no se conecta a bancos. |
| Goals & Habits | `/goals` | Objetivos medibles y seguimiento semanal de hábitos. |
| Ajustes | `/settings` | Nombre, moneda, cambio de contraseña, cierre de sesión. |

Autenticación: registro, inicio y cierre de sesión, recuperación de contraseña por correo, rutas
protegidas y sesión persistente.

## Requisitos

- Node.js 20 o superior y npm.
- Un proyecto de Supabase (gratuito en <https://supabase.com>) **o** Docker para el stack local incluido.

## Instalación

```bash
npm install
```

### Opción A — Proyecto Supabase alojado (recomendada para uso real)

1. Crea un proyecto en Supabase.
2. Aplica el esquema. Cualquiera de estas dos formas:
   - **SQL Editor:** pega y ejecuta el contenido de `supabase/migrations/20261109000001_initial_schema.sql`.
   - **Supabase CLI:**
     ```bash
     supabase link --project-ref TU-PROJECT-REF
     ```
     ```bash
     supabase db push
     ```
3. En **Authentication → URL Configuration**:
   - *Site URL*: la URL de la app (`http://localhost:5173` en desarrollo, tu dominio en producción).
   - *Redirect URLs*: agrega `http://localhost:5173/**` y `https://TU-DOMINIO/**`. La recuperación de
     contraseña redirige a `/reset-password`.
4. Copia `.env.example` a `.env.local` y completa las variables (ver abajo).
5. Inicia la app:
   ```bash
   npm run dev
   ```

Con la configuración por defecto de Supabase, el registro exige confirmar el correo: la app muestra
"Revisa tu correo" y el usuario inicia sesión después de abrir el enlace.

### Opción B — Stack local con Docker (desarrollo y pruebas)

Levanta Postgres (imagen de Supabase), GoTrue (Supabase Auth), PostgREST y Mailpit, aplica las
migraciones e imprime los valores para `.env.local`:

```bash
npm run stack:up
```

```bash
npm run dev
```

- API: `http://127.0.0.1:54321` · Correos capturados (Mailpit): `http://127.0.0.1:54324`
- El registro local confirma el correo automáticamente.
- Detener y borrar datos: `npm run stack:down`
- Las claves de `dev-stack/stack.env` son valores públicos de desarrollo. No las uses en producción.

## Variables de entorno

Archivo `.env.local` en la raíz (no se sube al repositorio):

| Variable | Valor |
| --- | --- |
| `VITE_SUPABASE_URL` | URL del proyecto: Supabase → Project Settings → API → *Project URL*. |
| `VITE_SUPABASE_ANON_KEY` | Clave pública `anon` del mismo panel. |

Ambas son públicas por diseño: quedan en el JavaScript del navegador y la protección real es RLS.
**Nunca** pongas la clave `service_role` ni la contraseña de la base de datos en el frontend.
Si faltan, la app muestra una pantalla de configuración en lugar de fallar.

## Scripts

| Comando | Acción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo en `http://localhost:5173`. |
| `npm run build` | Verificación de tipos y build de producción en `dist/`. |
| `npm run preview` | Sirve el build de producción. |
| `npm test` | Pruebas unitarias (Vitest): dinero, finanzas, turnos, fechas, validación, errores. |
| `npm run test:rls` | Pruebas de seguridad e integridad contra la API (requiere el stack arriba). |
| `npm run test:e2e` | Pruebas de extremo a extremo con Playwright (requiere el stack arriba). |
| `npm run stack:up` / `stack:down` | Stack local. |
| `npm run db:migrate:local` | Aplica migraciones nuevas al stack local. |

## Despliegue

La app es un sitio estático (SPA).

### GitHub Pages (incluido, gratis)

`.github/workflows/deploy.yml` compila y publica en cada push a `main`, en
`https://USUARIO.github.io/NOMBRE-REPO/`. Una sola vez: en el repositorio, **Settings → Pages →
Source: GitHub Actions**. Las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` se pueden
definir en **Settings → Secrets and variables → Actions → Variables**; si no existen, el workflow
usa los valores públicos escritos en él. Luego agrega esa URL en Supabase (*Site URL* y
`https://USUARIO.github.io/NOMBRE-REPO/**` en *Redirect URLs*).

### Otros proveedores

1. Define `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en el proveedor (se leen al compilar).
2. Comando de build: `npm run build`. Directorio de salida: `dist`.
3. Todas las rutas deben servir `index.html`. Ya incluido: `vercel.json` (Vercel) y
   `public/_redirects` (Netlify, Cloudflare Pages).
4. Agrega el dominio final a *Site URL* y *Redirect URLs* en Supabase.
5. Para producción configura un proveedor SMTP propio en Supabase (Authentication → Emails): el
   servicio de correo integrado tiene límites bajos de envío.

## Pruebas ejecutadas

Resultados reales de la última ejecución, contra el stack local (Postgres de Supabase 15.8,
PostgREST 12.2, Supabase Auth compilado desde su código fuente):

| Suite | Resultado | Cubre |
| --- | --- | --- |
| `npm test` | 33/33 | Aritmética en centavos, balances, categorías, turnos nocturnos, rotaciones, calendario, validación, mapeo de errores. |
| `npm run test:rls` | 82/82 | Acceso anónimo denegado en todas las tablas y vistas; aislamiento entre dos usuarios (lectura, edición, borrado); `user_id` no falsificable; claves foráneas no cruzan usuarios; restricciones; cálculos financieros en SQL; cascadas. |
| `npm run test:e2e` | 19/19 (una es la toma opcional de capturas) | Navegación, registro, login, logout, recuperación de contraseña por correo, CRUD de cada módulo, validaciones, cálculos financieros en pantalla, persistencia tras cerrar sesión, privacidad entre cuentas, error de red con reintento, responsive en 390 px y 820 px. |

## Limitaciones conocidas

- **No verificado contra un proyecto Supabase alojado**: no había credenciales. El stack local usa
  los mismos componentes (Auth, PostgREST, imagen de Postgres de Supabase), pero conviene correr
  `npm run test:rls` y `npm run test:e2e` contra tu proyecto de pruebas antes de usarlo en serio.
- **Flujo de confirmación de correo** (activo por defecto en Supabase alojado): implementado, sin
  prueba automática, porque el stack local confirma automáticamente.
- **Servicio `auth` de `docker-compose.yml`**: no se pudo descargar esa imagen en el entorno de
  construcción (límite de Docker Hub). Las pruebas usaron el mismo servidor compilado desde fuente
  mediante `GOTRUE_BIN` (ver `dev-stack/up.sh`). La definición del servicio con imagen queda sin probar.
- **Cambio de contraseña desde Ajustes**: usa la misma función que la recuperación (probada), pero
  el formulario de Ajustes no tiene prueba E2E propia.
- Sesiones de práctica e idiomas se cargan completas para calcular acumulados. Supabase devuelve
  máximo 1000 filas por consulta: al superar esa cantidad los totales quedarían incompletos.
- Aplicar una rotación con "reemplazar" hace borrado + inserción en dos peticiones (no atómico).
- Las fechas son locales, sin zona horaria: un turno no cambia de día al viajar.
- Una sola moneda por usuario; cambiarla no convierte montos.
- Sin modo offline, sin notificaciones, sin importación/exportación de datos, interfaz solo en español.
- Las categorías de ingresos y gastos son una lista fija.

## Documentación

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — estructura del código y flujo de datos.
- [`docs/DATABASE.md`](docs/DATABASE.md) — esquema, restricciones y seguridad.
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — registro de decisiones técnicas.
