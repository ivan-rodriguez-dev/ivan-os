import { expect, test, type Page } from '@playwright/test';
import { PASSWORD, TIME_ZONE, confirmDelete, dialog, expectNoHorizontalScroll, isoDay, login, logout, register, saveDialog, stat, toast, uniqueEmail, weekdayIndex } from './helpers';

// One account travels through every module, then signs out and back in to prove
// the data lives in the database, and a second account proves it is private.
test.describe.configure({ mode: 'serial' });

const email = uniqueEmail('main');
let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  await register(page, email, 'Ivan Tester');
  (page as Page & { problems?: string[] }).problems = problems;
});

test.afterAll(async () => {
  expect((page as Page & { problems?: string[] }).problems, 'no uncaught errors in the browser').toEqual([]);
  await page.close();
});

const open = async (path: string, heading: string) => {
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
};
const tab = (name: string) => page.getByRole('tab', { name, exact: true }).click();
const button = (name: string | RegExp) => page.getByRole('button', { name, exact: typeof name === 'string' });
const field = (label: string | RegExp) => dialog(page).getByLabel(label, { exact: typeof label === 'string' });

test('Work & Schedule: turnos, horarios y rotaciones', async () => {
  await open('/work', 'Turnos y horarios');
  await expect(page.getByText('Sin turnos en este periodo')).toBeVisible();

  // Overnight shift.
  await button('Nuevo turno').click();
  await field('Tipo').selectOption('night');
  await expect(dialog(page).getByText('termina el día siguiente')).toBeVisible();
  await expect(dialog(page).getByText('8 h', { exact: true })).toBeVisible();
  // Equal start and end is rejected.
  await field('Hora de fin').fill('22:00');
  await dialog(page).getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog(page).getByText('El inicio y el fin no pueden ser iguales').first()).toBeVisible();
  await field('Hora de fin').fill('06:00');
  await saveDialog(page);
  await expect(toast(page, 'Turno registrado.')).toBeVisible();
  const nightChip = page.getByRole('button', { name: /Editar turno: Nocturno.*22:00–06:00/ });
  await expect(nightChip).toBeVisible();
  await expect(stat(page, 'Turnos')).toContainText('1');
  await expect(stat(page, 'Horas')).toContainText('8 h');

  // Edit it into a custom shift.
  await nightChip.click();
  await field('Tipo').selectOption('custom');
  await field('Hora de inicio').fill('08:00');
  await field('Hora de fin').fill('12:30');
  await field('Etiqueta (opcional)').fill('Inventario');
  await saveDialog(page);
  await expect(page.getByRole('button', { name: /Editar turno: Personalizado.*08:00–12:30/ })).toBeVisible();
  await expect(stat(page, 'Horas')).toContainText('4 h 30 min');

  // Rest day tomorrow, then delete it.
  await button('Nuevo turno').click();
  await field('Fecha').fill(isoDay(1));
  await field('Tipo').selectOption('rest');
  await expect(field('Hora de inicio')).toBeHidden();
  await saveDialog(page);
  await button('Semana').click();
  if (weekdayIndex() === 6) await button('Semana siguiente').click(); // tomorrow falls in next week on Sundays
  const restChip = page.getByRole('button', { name: /Editar turno: Descanso/ });
  await expect(restChip).toBeVisible();
  await restChip.click();
  await dialog(page).getByRole('button', { name: 'Eliminar' }).click();
  await confirmDelete(page);
  await expect(toast(page, 'Eliminado correctamente.')).toBeVisible();
  await expect(restChip).toBeHidden();
  await button('Mes').click();
  await button('Hoy').click();

  // Custom schedule.
  await tab('Horarios');
  await button('Nuevo horario').click();
  await field('Nombre').fill('Turno tarde');
  await field('Tipo').selectOption('custom');
  await field('Hora de inicio').fill('14:00');
  await field('Hora de fin').fill('22:00');
  await saveDialog(page);
  await expect(page.getByText('Turno tarde')).toBeVisible();
  await expect(page.getByText('14:00 – 22:00 · 8 h')).toBeVisible();
  await button('Editar Turno tarde').click();
  await field('Hora de fin').fill('23:00');
  await saveDialog(page);
  await expect(page.getByText('14:00 – 23:00 · 9 h')).toBeVisible();

  // Rotation: default 6-day cycle applied to 12 days, replacing today's shift.
  await tab('Rotaciones');
  await button('Nueva rotación').click();
  await field('Nombre').fill('Ciclo 2-2-2');
  await saveDialog(page);
  await expect(page.getByText('Ciclo 2-2-2')).toBeVisible();
  await button('Aplicar').click();
  await field('Desde').fill(isoDay(0));
  await field('Hasta').fill(isoDay(-1));
  await dialog(page).getByRole('button', { name: 'Aplicar al calendario' }).click();
  await expect(dialog(page).getByText('Debe ser igual o posterior a la fecha de inicio')).toBeVisible();
  await field('Hasta').fill(isoDay(11));
  await saveDialog(page, 'Aplicar al calendario');
  await expect(toast(page, 'Rotación aplicada: 12 días generados.')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Calendario' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: /Editar turno: Personalizado/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Editar turno: Diurno.*06:00–14:00/ }).first()).toBeVisible();
});

test('Academic Center: proyectos y actividades', async () => {
  await open('/academic', 'Formación SENA');
  await expect(page.getByText('Sin actividades registradas')).toBeVisible();

  await tab('Proyectos');
  await button('Nuevo proyecto').click();
  await field('Nombre').fill('Proyecto formativo ADSO');
  await field(/^Repositorio/).fill('sin-protocolo');
  await dialog(page).getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog(page).getByText('Debe comenzar con http:// o https://')).toBeVisible();
  await field(/^Repositorio/).fill('');
  await saveDialog(page);
  await expect(page.getByText('Proyecto formativo ADSO')).toBeVisible();

  await tab('Actividades');
  await button('Nueva actividad').click();
  await dialog(page).getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog(page).getByText('Este campo es obligatorio')).toBeVisible();
  await field('Título').fill('Evidencia GA4');
  await field('Descripción (opcional)').fill('Diagrama de clases y casos de uso');
  await field('Proyecto (opcional)').selectOption({ label: 'Proyecto formativo ADSO' });
  await field('Fecha límite').fill(isoDay(3));
  await field('Prioridad').selectOption('urgent');
  await saveDialog(page);
  await expect(toast(page, 'Actividad creada.')).toBeVisible();

  await button('Nueva actividad').click();
  await field('Título').fill('Taller atrasado');
  await field('Fecha límite').fill(isoDay(-2));
  await saveDialog(page);

  await expect(stat(page, 'Pendientes')).toContainText('2');
  await expect(stat(page, 'Atrasadas')).toContainText('1');
  await expect(stat(page, 'Próximos 7 días')).toContainText('1');
  await expect(page.getByText('Hace 2 días')).toBeVisible();
  await expect(page.getByText('En 3 días')).toBeVisible();
  await expect(page.getByText('Urgente')).toBeVisible();

  // Overdue filter, complete, edit, delete.
  await button('Atrasadas (1)').click();
  await expect(page.getByText('Evidencia GA4')).toBeHidden();
  await page.getByRole('checkbox', { name: /Marcar "Taller atrasado"/ }).click();
  await expect(toast(page, 'Actividad completada.')).toBeVisible();
  await expect(stat(page, 'Atrasadas')).toContainText('0');
  await expect(stat(page, 'Completadas')).toContainText('1');
  await button('Completadas (1)').click();
  await button('Editar Taller atrasado').click();
  await field('Título').fill('Taller entregado');
  await saveDialog(page);
  await expect(page.getByText('Taller entregado')).toBeVisible();
  await button('Eliminar Taller entregado').click();
  await confirmDelete(page);
  await expect(page.getByText('Taller entregado')).toBeHidden();

  await tab('Proyectos');
  await expect(page.getByText('0/1')).toBeVisible();
});

test('Skill Development: habilidades, sesiones, proyectos y tecnologías', async () => {
  await open('/skills', 'Desarrollo profesional');
  await expect(page.getByText('Sin habilidades', { exact: true })).toBeVisible();

  await button('Nueva habilidad').click();
  await field('Nombre').fill('TypeScript');
  await field('Nivel actual (0–10)').fill('9');
  await field('Nivel objetivo (1–10)').fill('5');
  await dialog(page).getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog(page).getByText('El objetivo no puede ser menor que el nivel actual')).toBeVisible();
  await field('Nivel actual (0–10)').fill('3');
  await field('Nivel objetivo (1–10)').fill('8');
  await saveDialog(page);
  await expect(page.getByText('Nivel 3 / 8')).toBeVisible();

  await button('Editar TypeScript').click();
  await field('Nivel actual (0–10)').fill('5');
  await saveDialog(page);
  await expect(page.getByText('Nivel 5 / 8')).toBeVisible();
  await expect(page.getByRole('img', { name: /Evolución del nivel/ })).toBeVisible();

  await tab('Proyectos');
  await button('Nuevo proyecto').click();
  await field('Nombre').fill('IVAN OS');
  await field('Tecnologías (opcional)').fill('React, Supabase, React');
  await field(/^Repositorio/).fill('https://example.com/ivan-os');
  await saveDialog(page);
  await expect(page.getByText('Supabase', { exact: true })).toBeVisible();
  await expect(page.getByText('React', { exact: true })).toHaveCount(1);

  await button('Registrar sesión').click();
  await field('Horas').fill('0');
  await field('Minutos').fill('0');
  await dialog(page).getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog(page).getByText('La duración debe ser de al menos 1 minuto')).toBeVisible();
  await field('Horas').fill('1');
  await field('Minutos').fill('30');
  await field('Habilidad (opcional)').selectOption({ label: 'TypeScript' });
  await field('Proyecto (opcional)').selectOption({ label: 'IVAN OS' });
  await field('Notas (opcional)').fill('Tipos genéricos');
  await saveDialog(page);
  await expect(stat(page, 'Horas totales')).toContainText('1 h 30 min');
  await expect(stat(page, 'Programación este mes')).toContainText('1 h 30 min');
  await expect(page.getByText('Tiempo invertido: 1 h 30 min')).toBeVisible();

  await tab('Sesiones');
  await expect(page.getByText('TypeScript · IVAN OS')).toBeVisible();
  await page.getByRole('button', { name: /^Editar sesión del/ }).click();
  await field('Minutos').fill('45');
  await saveDialog(page);
  await expect(stat(page, 'Horas totales')).toContainText('1 h 45 min');

  await tab('Tecnologías');
  await button('Documentar').click();
  await field('Nombre').fill('PostgreSQL');
  await field('Categoría').selectOption('databases');
  await field('Dominio').selectOption('comfortable');
  await saveDialog(page);
  await expect(page.getByText('PostgreSQL')).toBeVisible();
  await expect(page.getByText('Con soltura')).toBeVisible();

  await tab('Habilidades');
  await expect(page.getByText(/Nivel 5 \/ 8 · 1 h 45 min/)).toBeVisible();
});

test('Language Lab: idiomas y sesiones', async () => {
  await open('/languages', 'Aprendizaje de idiomas');
  await expect(page.getByText('Sin idiomas registrados')).toBeVisible();
  await expect(button('Registrar sesión')).toBeDisabled();

  await button('Nuevo idioma').click();
  await field('Idioma').fill('Inglés');
  await field('Nivel actual').selectOption('B1');
  await field('Nivel objetivo').selectOption('A2');
  await dialog(page).getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog(page).getByText('El objetivo no puede ser menor que el nivel actual')).toBeVisible();
  await field('Nivel actual').selectOption('A2');
  await field('Nivel objetivo').selectOption('B2');
  await saveDialog(page);
  await expect(page.getByRole('heading', { name: 'Inglés' })).toBeVisible();

  for (const [skill, minutes, note] of [
    ['speaking', '45', 'Conversación con tutor'],
    ['listening', '30', 'Podcast'],
  ] as const) {
    await button('Registrar sesión').click();
    await field('Habilidad').selectOption(skill);
    await field('Horas').fill('0');
    await field('Minutos').fill(minutes);
    await field('Observaciones (opcional)').fill(note);
    await saveDialog(page);
  }
  await expect(stat(page, 'Horas acumuladas')).toContainText('1 h 15 min');
  await expect(stat(page, 'Esta semana')).toContainText('1 h 15 min');
  await expect(stat(page, 'Este mes')).toContainText('1 h 15 min');
  await expect(stat(page, 'Sesiones')).toContainText('2');
  await expect(page.getByRole('img', { name: /vista semanal/ })).toBeVisible();
  await button('Mensual').click();
  await expect(page.getByRole('img', { name: /vista mensual/ })).toBeVisible();

  await tab('Sesiones');
  await expect(page.getByText('Conversación con tutor')).toBeVisible();
  await page.getByRole('button', { name: /^Eliminar sesión del/ }).first().click();
  await confirmDelete(page);
  await expect(stat(page, 'Sesiones')).toContainText('1');
});

test('Financial Control: movimientos, deudas y ahorro con cálculos exactos', async () => {
  await open('/finance', 'Finanzas personales');
  await expect(page.getByText('Sin movimientos')).toBeVisible();

  const addMovement = async (type: 'income' | 'expense', category: string, amount: string, description: string) => {
    await button('Nuevo movimiento').click();
    await field('Tipo').selectOption(type);
    await field('Categoría').selectOption(category);
    await field('Monto').fill(amount);
    await field('Descripción (opcional)').fill(description);
    await saveDialog(page);
  };

  // Validation first.
  await button('Nuevo movimiento').click();
  for (const bad of ['', '0', '-50', '12.345', 'abc']) {
    await field('Monto').fill(bad);
    await dialog(page).getByRole('button', { name: 'Guardar' }).click();
    await expect(dialog(page).getByText('Ingresa un monto mayor que 0 (máximo 2 decimales)')).toBeVisible();
  }
  await dialog(page).getByRole('button', { name: 'Cancelar' }).click();

  await addMovement('income', 'Salario', '2000000', 'Nómina');
  await addMovement('expense', 'Alimentación', '350000.50', 'Mercado');
  await addMovement('expense', 'Transporte', '149999,50', 'Pasajes');

  await expect(stat(page, 'Ingresos')).toContainText('2.000.000');
  await expect(stat(page, 'Gastos')).toContainText('500.000');
  await expect(stat(page, 'Balance del mes')).toContainText('1.500.000');
  await expect(page.getByRole('progressbar', { name: 'Alimentación: 70% de los gastos' })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Transporte: 30% de los gastos' })).toBeVisible();

  await button('Gastos').click();
  await expect(page.getByText('Nómina')).toBeHidden();
  await expect(page.getByText('Mercado')).toBeVisible();
  await button('Todos').click();

  // Debt with payments.
  await tab('Deudas');
  await button('Nueva deuda').click();
  await field('Nombre').fill('Crédito computador');
  await field('Monto total').fill('600000');
  await saveDialog(page);
  await button('Registrar pago').click();
  await field('Monto del pago').fill('600000.01');
  await dialog(page).getByRole('button', { name: 'Registrar pago' }).click();
  await expect(dialog(page).getByText(/El pago supera el saldo pendiente/)).toBeVisible();
  await field('Monto del pago').fill('250000');
  await saveDialog(page, 'Registrar pago');
  await expect(stat(page, 'Deuda pendiente')).toContainText('350.000');
  await expect(stat(page, 'Total pagado')).toContainText('250.000');
  // The principal cannot drop below what was paid.
  await button('Editar Crédito computador').click();
  await field('Monto total').fill('200000');
  await dialog(page).getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog(page).getByText(/No puede ser menor que lo ya pagado/)).toBeVisible();
  await dialog(page).getByRole('button', { name: 'Cancelar' }).click();

  // The payment counts as an expense of the month.
  await tab('Movimientos');
  await expect(page.getByText('Pago: Crédito computador')).toBeVisible();
  await expect(stat(page, 'Gastos')).toContainText('750.000');
  await expect(stat(page, 'Balance del mes')).toContainText('1.250.000');

  // Edit and delete a movement.
  await button('Editar Mercado').click();
  await field('Monto').fill('300000.50');
  await saveDialog(page);
  await expect(stat(page, 'Balance del mes')).toContainText('1.300.000');
  await button('Eliminar Mercado').click();
  await confirmDelete(page);
  await expect(stat(page, 'Gastos')).toContainText('399.999,50');
  await expect(stat(page, 'Balance del mes')).toContainText('1.600.000,50');

  // Previous month is empty and independent.
  await button('Mes anterior').click();
  await expect(stat(page, 'Balance del mes')).toContainText('$ 0');
  await expect(page.getByText('Sin movimientos')).toBeVisible();
  await button('Mes siguiente').click();
  await expect(button('Mes siguiente')).toBeDisabled();

  // Savings.
  await tab('Ahorro');
  await button('Nuevo objetivo').click();
  await field('Nombre').fill('Fondo de emergencia');
  await field('Monto objetivo').fill('1000000');
  await saveDialog(page);
  await button('Aportar').click();
  await field('Monto del aporte').fill('250000');
  await saveDialog(page, 'Registrar aporte');
  await expect(stat(page, 'Total ahorrado')).toContainText('250.000');
  await expect(stat(page, 'Avance global')).toContainText('25%');
  // Savings do not change the monthly balance.
  await tab('Movimientos');
  await expect(stat(page, 'Balance del mes')).toContainText('1.600.000,50');
});

test('Goals & Habits: objetivos y hábitos', async () => {
  await open('/goals', 'Objetivos y hábitos');
  await button('Nuevo objetivo').click();
  await field('Objetivo').fill('100 horas de código');
  await field('Unidad (opcional)').fill('horas');
  await field('Avance actual').fill('25');
  await field('Meta').fill('0');
  await dialog(page).getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog(page).getByText('Ingresa un número mayor que 0')).toBeVisible();
  await field('Meta').fill('100');
  await saveDialog(page);
  await expect(page.getByText('25 / 100 horas')).toBeVisible();

  await button('Nuevo hábito').click();
  await field('Hábito').fill('Leer 20 minutos');
  await saveDialog(page);
  const todayBox = page.getByRole('checkbox', { name: /^Leer 20 minutos,/ }).nth(weekdayIndex());
  await todayBox.click();
  await expect(todayBox).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText('1/7 esta semana')).toBeVisible();
  await todayBox.click();
  await expect(page.getByText('0/7 esta semana')).toBeVisible();
  await todayBox.click();
  await expect(page.getByText('1/7 esta semana')).toBeVisible();
});

test('Command Center: todos los indicadores salen de la base de datos', async () => {
  await open('/', /Ivan/ as unknown as string);
  await expect(stat(page, 'Hábitos hoy')).toContainText('1/1');
  await expect(stat(page, 'Entregas hoy')).toContainText('0');
  await expect(page.getByRole('group', { name: /^Balance ·/ })).toContainText('1.600.000,50');

  const panel = (title: RegExp) => page.locator('section').filter({ has: page.getByRole('heading', { name: title }) });
  await expect(panel(/^Próximo turno/)).toContainText(/\d{2}:\d{2} – \d{2}:\d{2}/);
  await expect(panel(/^Finanzas/)).toContainText('2.000.000');
  await expect(panel(/^Finanzas/)).toContainText('399.999,50');
  await expect(panel(/^Progreso de objetivos/)).toContainText('100 horas de código');
  await expect(panel(/^Progreso de objetivos/)).toContainText('25%');
  await expect(panel(/^Tareas pendientes \(1\)/)).toContainText('Evidencia GA4');
  await expect(panel(/^Próximas entregas/)).toContainText('En 3 días');
  await expect(page.getByRole('img', { name: /Horas de trabajo, práctica e idiomas/ })).toBeVisible();
});

test('Ajustes: perfil y moneda', async () => {
  await open('/settings', 'Ajustes');
  await page.getByLabel('Nombre').fill('Ivan Rojas');
  await page.getByLabel('Moneda').selectOption('USD');
  await button('Guardar perfil').click();
  await expect(toast(page, 'Perfil actualizado.')).toBeVisible();
  await expect(page.getByRole('complementary').getByText('Ivan Rojas')).toBeVisible();

  await page.goto('/finance');
  await expect(stat(page, 'Balance del mes')).toContainText('US$');
  await expect(stat(page, 'Balance del mes')).toContainText('1.600.000,50');
});

test('manejo de errores: sin conexión se informa y se puede reintentar', async () => {
  await page.route('**/rest/v1/**', (route) => route.abort('internetdisconnected'));
  await page.goto('/academic');
  await expect(page.getByRole('alert').first()).toContainText('No hay conexión con el servidor');
  await expect(page.getByText('Evidencia GA4')).toHaveCount(0);

  // A failed save keeps the form open and explains why.
  await button('Nueva actividad').click();
  await field('Título').fill('No se guardará');
  await dialog(page).getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'No hay conexión con el servidor' }).last()).toBeVisible();
  await expect(dialog(page)).toBeVisible();
  await dialog(page).getByRole('button', { name: 'Cancelar' }).click();

  await page.unroute('**/rest/v1/**');
  await button('Reintentar').first().click();
  await expect(page.getByText('Evidencia GA4')).toBeVisible();
  await expect(page.getByText('No se guardará')).toHaveCount(0);
});

const SHOTS = process.env.SHOTS_DIR;
const PAGES = ['/', '/work', '/academic', '/skills', '/languages', '/finance', '/goals', '/settings'];
const shotName = (path: string) => (path === '/' ? 'dashboard' : path.slice(1));

test('capturas de escritorio (solo con SHOTS_DIR)', async () => {
  test.skip(!SHOTS, 'set SHOTS_DIR to save screenshots');
  for (const path of PAGES) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${SHOTS}/desktop-${shotName(path)}.png`, fullPage: true });
  }
});

test('persistencia: los datos siguen ahí tras cerrar sesión y volver a entrar', async () => {
  await logout(page);
  await login(page, email, PASSWORD);
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Ivan');

  await page.goto('/finance');
  await expect(stat(page, 'Balance del mes')).toContainText('1.600.000,50');
  await tab('Deudas');
  await expect(stat(page, 'Deuda pendiente')).toContainText('350.000');
  await page.goto('/academic');
  await expect(page.getByText('Evidencia GA4')).toBeVisible();
  await page.goto('/skills');
  await expect(page.getByText(/Nivel 5 \/ 8 · 1 h 45 min/)).toBeVisible();
  await page.goto('/languages');
  await expect(page.getByRole('heading', { name: 'Inglés' })).toBeVisible();
  await page.goto('/goals');
  await expect(page.getByText('1/7 esta semana')).toBeVisible();
  await page.goto('/work');
  await expect(page.getByRole('button', { name: /Editar turno:/ }).first()).toBeVisible();
});

test('privacidad: otra cuenta no ve ningún dato', async ({ browser }) => {
  const other = await browser.newPage();
  await register(other, uniqueEmail('other'), 'Otra Persona');
  const empty: [string, string][] = [
    ['/academic', 'Sin actividades registradas'],
    ['/finance', 'Sin movimientos'],
    ['/skills', 'Sin habilidades'],
    ['/languages', 'Sin idiomas registrados'],
    ['/goals', 'Sin objetivos'],
    ['/work', 'Sin turnos en este periodo'],
  ];
  for (const [path, text] of empty) {
    await other.goto(path);
    await expect(other.getByText(text, { exact: true })).toBeVisible();
  }
  await other.goto('/');
  await expect(other.getByText('Evidencia GA4')).toHaveCount(0);
  await expect(other.getByText('Sin turnos próximos')).toBeVisible();
  await other.close();
});

test('responsive: teléfono y tableta sin desbordes, con navegación adaptada', async ({ browser }) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 820, height: 1180 },
  ]) {
    const context = await browser.newContext({ viewport, locale: 'es-CO', timezoneId: TIME_ZONE });
    const mobile = await context.newPage();
    await login(mobile, email, PASSWORD);
    await expect(mobile).toHaveURL('/');
    await expect(mobile.getByRole('complementary')).toBeHidden(); // desktop sidebar

    for (const path of ['/', '/work', '/academic', '/skills', '/languages', '/finance', '/goals', '/settings']) {
      await mobile.goto(path);
      await expect(mobile.getByRole('heading', { level: 1 })).toBeVisible();
      await mobile.waitForLoadState('networkidle');
      await expectNoHorizontalScroll(mobile);
      if (SHOTS) {
        await mobile.waitForTimeout(700);
        await mobile.screenshot({ path: `${SHOTS}/w${viewport.width}-${shotName(path)}.png`, fullPage: true });
      }
    }

    // Bottom bar and drawer reach every module.
    await mobile.getByRole('navigation', { name: 'Accesos rápidos' }).getByRole('link', { name: 'Finanzas' }).click();
    await expect(mobile).toHaveURL(/\/finance$/);
    await mobile.getByRole('button', { name: 'Abrir menú' }).click();
    await mobile.getByRole('link', { name: 'Language Lab' }).click();
    await expect(mobile).toHaveURL(/\/languages$/);
    await expect(mobile.getByRole('link', { name: 'Language Lab' })).toBeHidden();

    // A form dialog fits the screen.
    await mobile.goto('/work');
    await mobile.getByRole('button', { name: 'Nuevo turno' }).click();
    const box = await mobile.getByRole('dialog').boundingBox();
    expect(box && box.x >= 0 && box.x + box.width <= viewport.width && box.height <= viewport.height).toBe(true);
    await expectNoHorizontalScroll(mobile);
    await context.close();
  }
});
