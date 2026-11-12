# Base de datos

Fuente de verdad: `supabase/migrations/20261109000001_initial_schema.sql`.

## Tablas

| Tabla | Contenido | Relaciones |
| --- | --- | --- |
| `profiles` | Nombre y moneda del usuario. Se crea sola al registrarse (trigger en `auth.users`). | `id` → `auth.users` (cascade) |
| `shift_templates` | Horarios guardados (nombre, tipo, inicio, fin). | — |
| `shift_rotations` | Ciclo de rotación como arreglo JSON de días. | — |
| `work_shifts` | Turno o descanso de una fecha. | `rotation_id` → `shift_rotations` (set null) |
| `projects` | Proyectos académicos o personales. | — |
| `academic_tasks` | Actividades con fecha límite, prioridad y estado. | `project_id` → `projects` (set null) |
| `skills` | Habilidades con nivel actual (0–10) y objetivo (1–10). | — |
| `skill_level_logs` | Historial de niveles, escrito por trigger. | `skill_id` → `skills` (cascade) |
| `practice_sessions` | Sesiones de práctica en minutos. | `skill_id`, `project_id` (set null) |
| `technologies` | Tecnologías aprendidas. | — |
| `languages` | Idiomas con nivel MCER actual y objetivo. | — |
| `language_sessions` | Sesiones por habilidad lingüística. | `language_id` → `languages` (cascade) |
| `financial_transactions` | Ingresos y gastos. Con `debt_id` es un pago de deuda. | `debt_id` → `debts` (set null) |
| `debts` | Deudas con monto original. | — |
| `savings_goals` | Objetivos de ahorro. | — |
| `savings_contributions` | Aportes a un objetivo. | `goal_id` → `savings_goals` (cascade) |
| `goals` | Objetivos medibles (avance / meta). | — |
| `habits` | Hábitos con meta semanal. | — |
| `habit_logs` | Un registro por hábito y día cumplido. | `habit_id` → `habits` (cascade) |

Todas las tablas personales tienen `user_id uuid not null default auth.uid()` con clave foránea a
`auth.users` (`on delete cascade`), además de `created_at` y `updated_at` (trigger).

## Vistas (`security_invoker = true`, respetan RLS)

- `debt_balances`: cada deuda con `paid` y `remaining`.
- `savings_goal_progress`: cada objetivo con `saved`.
- `monthly_balances`: `income`, `expense` y `balance` por mes.

## Integridad

- **Claves foráneas compuestas** `(id, user_id)`: una fila hija solo puede apuntar a un padre del
  mismo usuario. Las FK normales no pasan por RLS; esta forma cierra ese hueco.
- **Turnos**: `shift_date` + `start_time` + `end_time` en hora local. Si `end_time <= start_time`,
  el turno termina al día siguiente. Un descanso no lleva horas; un turno laboral exige dos horas
  distintas. Máximo un descanso por día.
- **Dinero**: `numeric(14,2)` con `amount > 0`.
- **Pagos de deuda**: solo gastos pueden llevar `debt_id`; un trigger impide pagar más que el saldo
  y otro impide bajar el monto de la deuda por debajo de lo pagado.
- **Actividades**: `completed_at` existe exactamente cuando el estado es `completed`.
- Longitudes máximas, rangos (niveles, duración 1–1440 min, veces por semana 1–7) y enumeraciones por `check`.
- Unicidad: nombre de habilidad, tecnología e idioma por usuario (sin distinguir mayúsculas); un
  registro de hábito por día.
- Al borrar una deuda, sus pagos se conservan como gastos para no alterar balances pasados.

## Índices

Por `(user_id, fecha)` en turnos, actividades, sesiones y movimientos; por clave foránea en las
tablas hijas; índices únicos para las reglas de unicidad.

## Seguridad (Row Level Security)

- RLS activado en **todas** las tablas.
- Cuatro políticas por tabla personal (`select`, `insert`, `update`, `delete`) para el rol
  `authenticated`, todas con `(select auth.uid()) = user_id`. `update` lleva `using` y
  `with check`, así una fila no se puede "regalar" a otro usuario.
- `profiles`: solo lectura y edición del propio perfil; sin inserción ni borrado desde el cliente.
- `skill_level_logs`: solo lectura; escribe el trigger.
- Rol `anon`: sin ningún privilegio sobre tablas, vistas ni funciones.
- Funciones con `search_path` fijo; las `security definer` son únicamente triggers.

Comprobado por `npm run test:rls` (82 casos) con tokens reales de dos usuarios y sin token.

## Diagrama

```
auth.users ─┬─ profiles
            ├─ shift_templates
            ├─ shift_rotations ──< work_shifts
            ├─ projects ──┬──< academic_tasks
            │             └──< practice_sessions >── skills ──< skill_level_logs
            ├─ technologies
            ├─ languages ──< language_sessions
            ├─ debts ──< financial_transactions
            ├─ savings_goals ──< savings_contributions
            ├─ goals
            └─ habits ──< habit_logs
```

## Cambios de esquema

Agrega un archivo nuevo en `supabase/migrations/` con prefijo de fecha mayor; no edites migraciones
ya aplicadas. Local: `npm run db:migrate:local`. Alojado: `supabase db push`.
