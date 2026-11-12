# Registro de decisiones técnicas

| # | Decisión | Motivo | Costo aceptado |
| --- | --- | --- | --- |
| 1 | Sin backend propio: el navegador habla con Supabase. | Menos piezas que mantener; la seguridad queda en RLS, que no depende del cliente. | La lógica de negocio sensible debe escribirse en SQL. |
| 2 | Claves foráneas compuestas `(id, user_id)`. | Las FK no pasan por RLS: sin esto un usuario podría enlazar filas ajenas si conociera su id. | Columna `unique (id, user_id)` extra en cada tabla padre. |
| 3 | Turnos como fecha + horas locales, no `timestamptz`. | Un turno "22:00–06:00 del martes" es un hecho de calendario; evita errores de zona horaria. El cruce de medianoche se deriva de `fin <= inicio`. | No admite turnos de 24 h o más. |
| 4 | Un pago de deuda es un gasto con `debt_id`. | Una sola fuente de verdad para el balance mensual y el saldo de la deuda. | La categoría "Pago de deuda" es fija. |
| 5 | Aportes a ahorro en tabla aparte, fuera del balance. | Ahorrar no es gastar; mezclarlo distorsiona el balance mensual. | El balance no muestra "disponible después de ahorro". |
| 6 | Dinero en centavos enteros en el cliente; `numeric(14,2)` en la base; saldos en vistas SQL. | Exactitud verificable; sin errores de coma flotante. | Conversión explícita en cada borde. |
| 7 | Validación propia (`lib/validation.ts`) en lugar de una librería. | Unas 80 líneas cubren el caso; el prompt pide no sumar dependencias innecesarias. La base revalida todo con `check`. | Sin inferencia de tipos a partir de esquemas. |
| 8 | `useQuery`/`useAction` propios en lugar de una librería de caché. | Cada pantalla recarga tras mutar; no se necesita caché compartida. | Sin caché entre páginas: cada visita consulta de nuevo. |
| 9 | CRUD genérico (`createCrud<Fila>`). | 17 tablas con el mismo patrón; evita duplicar lógica. | El constructor de consultas queda poco tipado dentro del servicio. |
| 10 | Tipos de fila escritos a mano. | No había proyecto alojado para generarlos con la CLI. | Hay que actualizarlos al cambiar el esquema (`supabase gen types` es la mejora natural). |
| 11 | `<dialog>` nativo para modales. | Trampa de foco, Esc y fondo inerte sin dependencias. | Estilos del `::backdrop` limitados. |
| 12 | Tablas añadidas al mínimo pedido: `shift_templates`, `shift_rotations`, `technologies`, `skill_level_logs`, `savings_contributions`, `goals`. | Requeridas por funciones explícitas: horarios personalizados, rotaciones, tecnologías, evolución, aportes, progreso de objetivos. | Esquema más amplio. |
| 13 | Módulo extra "Goals & Habits". | El esquema exige `habits`/`habit_logs` y el dashboard muestra progreso de objetivos; sin pantalla no habría cómo cargarlos. | Séptima entrada de navegación. |
| 14 | Stack local propio con Docker Compose en vez de la CLI de Supabase. | La CLI no se pudo descargar en el entorno de construcción; este stack sí se pudo ejecutar y probar. | No incluye Storage, Realtime ni Studio (la app no los usa). |
| 15 | Interfaz en español con nombres de módulo en inglés. | Así está redactada la especificación. | Sin internacionalización. |
| 16 | Fuentes autoalojadas (`@fontsource`). | Sin llamadas a terceros al cargar; funciona sin conexión a Google Fonts. | Dos dependencias pequeñas. |
| 17 | Tras cerrar sesión, el siguiente login va al inicio, no a la última página. | Hallado en pruebas E2E: volver a la página anterior tras un cierre voluntario sorprende. | — |
| 18 | La marca de "sesión de recuperación" se guarda en `sessionStorage`. | Hallado en pruebas E2E: al recargar se perdía y se podía entrar sin definir contraseña nueva. | — |
