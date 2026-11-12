# Arquitectura

## Visión general

```
Navegador (React SPA)
  │  supabase-js con la clave pública anon + JWT del usuario
  ▼
Supabase
  ├─ Auth (GoTrue)       registro, login, recuperación, emisión de JWT
  ├─ PostgREST           API REST generada sobre el esquema public
  └─ PostgreSQL          tablas, restricciones, triggers, vistas, RLS
```

No hay servidor propio. Toda regla de acceso vive en la base de datos (RLS, restricciones y
triggers), de modo que un cliente manipulado no puede saltársela.

## Estructura de carpetas

```
src/
  main.tsx, App.tsx        arranque, proveedores, rutas y guardas
  index.css                tokens de diseño (colores, tipografías, animaciones)
  lib/                     lógica pura, sin React ni red (con pruebas unitarias)
    dates.ts               fechas locales YYYY-MM-DD, semanas, meses, formatos
    shifts.ts              duración, turnos nocturnos, próximo turno, rotaciones
    money.ts               dinero en centavos enteros
    finance.ts             balances, gastos por categoría, totales mensuales
    sessions.ts            agrupación de minutos por semana y mes
    validation.ts          reglas de validación de formularios
    errors.ts              traducción centralizada de errores a mensajes
    labels.ts              textos de enumeraciones
    supabase.ts            cliente y verificación de variables de entorno
  types/database.ts        tipos de las filas del esquema
  services/
    crud.ts                acceso CRUD genérico y tipado a una tabla o vista
    index.ts               un servicio por tabla + operaciones compuestas
  hooks/
    useQuery.ts            carga de datos con estados de carga y error
    useAction.ts           mutaciones con estado pendiente y avisos
    useForm.ts             estado de formulario + validación
  context/
    AuthContext.tsx        sesión, perfil y operaciones de autenticación
    ToastContext.tsx       avisos de confirmación y de error
  components/
    ui/                    Button, Field, Modal, Panel, Stat, Tabs, estados, CRUD
    layout/                AppLayout (barra lateral, navegación móvil), ErrorBoundary
  modules/
    auth/ dashboard/ work/ academic/ skills/ languages/ finance/ goals/ settings/
    shared/                piezas usadas por varios módulos (proyectos, duración, gráfica de horas)
supabase/migrations/       esquema SQL versionado
dev-stack/                 stack local (Docker Compose, gateway, scripts)
tests/security/            pruebas de RLS e integridad contra la API
tests/e2e/                 pruebas Playwright
```

## Flujo de datos

1. Una página llama a `useQuery(() => servicio.list(...))`.
2. El servicio usa `createCrud<Fila>('tabla')`, que ejecuta la consulta con supabase-js y pasa la
   respuesta por `run()`.
3. `run()` convierte cualquier fallo en `AppError` mediante `toAppError()`.
4. `QueryView` muestra carga, error con "Reintentar" o los datos; cada lista define su estado vacío.
5. Las mutaciones pasan por `useAction().run(fn, mensaje)`: estado pendiente, aviso de éxito o
   aviso de error. Al terminar, la página recarga sus consultas.

El cliente nunca envía `user_id`: la columna toma `auth.uid()` por defecto y RLS rechaza cualquier otro valor.

## Autenticación y rutas

- `AuthProvider` se suscribe a `onAuthStateChange`. La sesión persiste en `localStorage`
  (comportamiento de supabase-js) y se renueva sola.
- `ProtectedRoute` exige sesión; sin ella redirige a `/login` recordando la ruta pedida.
- `PublicOnlyRoute` saca de `/login` y `/register` a quien ya tiene sesión.
- Una sesión creada por enlace de recuperación queda confinada a `/reset-password` hasta definir
  contraseña nueva (la marca sobrevive a recargas en `sessionStorage`).
- Sin variables de entorno, `App` muestra `SetupRequired`.

## Manejo de errores

Un solo punto, `lib/errors.ts`, traduce códigos de Postgres, PostgREST y Auth a mensajes en
español. Los triggers de negocio (por ejemplo, pago mayor que la deuda) emiten su propio mensaje,
que se muestra tal cual. Lo desconocido se registra en consola y se muestra un mensaje genérico.
`ErrorBoundary` evita la pantalla en blanco ante un error de render.

## Cálculos financieros

- El cliente opera en **centavos enteros** (`lib/money.ts`); no hay sumas en coma flotante.
- Los montos se envían como cadena decimal exacta (`"1234.56"`) y Postgres los guarda en `numeric(14,2)`.
- Saldos de deuda y avance de ahorro se calculan **en SQL** (`debt_balances`, `savings_goal_progress`).
- Balance del mes = ingresos − gastos. Un pago de deuda es un gasto. Los aportes a ahorro no son gasto.
- La vista `monthly_balances` permite verificar los balances directamente en SQL.

## Diseño

Tokens en `src/index.css`: fondo negro azulado, paneles un paso más claros, acento cian, Inter para
texto y JetBrains Mono para cifras y etiquetas. Escritorio: barra lateral fija. Móvil: barra
inferior con los cuatro módulos más usados y un menú lateral con todos. Tamaño de texto base 15 px;
objetivos táctiles de 36–44 px; se respeta `prefers-reduced-motion`.
