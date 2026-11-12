import { expect, type Locator, type Page } from '@playwright/test';

export const PASSWORD = 'Password-123456';
export const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';

export const uniqueEmail = (tag: string) => `e2e-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;

/** Time zone the test browser runs in (see playwright.config.ts). */
export const TIME_ZONE = 'America/Bogota';

/** "Now" as wall-clock fields of the browser's time zone, whatever zone the runner is in. */
function browserNow(): Date {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const [y, m, d] = parts.split('-').map(Number);
  return new Date(Date.UTC(y as number, (m as number) - 1, d as number));
}

/** YYYY-MM-DD in the browser's time zone, `offset` days from today. */
export function isoDay(offset = 0): string {
  const d = browserNow();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

/** Today's weekday in the browser's time zone: Monday = 0 … Sunday = 6. */
export const weekdayIndex = (): number => (browserNow().getUTCDay() + 6) % 7;

export async function register(page: Page, email: string, name = 'Ivan Tester') {
  await page.goto('/register');
  await page.getByLabel('Nombre').fill(name);
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirmar contraseña').fill(PASSWORD);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByText('Command Center').first()).toBeVisible();
  await expect(page).toHaveURL('/');
}

export async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

export async function logout(page: Page) {
  await page.getByRole('button', { name: 'Cerrar sesión' }).first().click();
  await expect(page).toHaveURL(/\/login$/);
}

export const dialog = (page: Page): Locator => page.getByRole('dialog');

/** Clicks the submit button of the open dialog and waits for it to close. */
export async function saveDialog(page: Page, button = 'Guardar') {
  await dialog(page).getByRole('button', { name: button, exact: true }).click();
  await expect(dialog(page)).toBeHidden();
}

export async function confirmDelete(page: Page) {
  await dialog(page).getByRole('button', { name: 'Eliminar', exact: true }).click();
  await expect(dialog(page)).toBeHidden();
}

export const toast = (page: Page, text: string | RegExp): Locator => page.getByRole('status').filter({ hasText: text });

/** The card showing a labelled indicator (label + value). */
export const stat = (page: Page, label: string): Locator => page.getByRole('group', { name: label, exact: true });

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'page must not scroll horizontally').toBeLessThanOrEqual(1);
}
