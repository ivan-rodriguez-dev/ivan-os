import { expect, test } from '@playwright/test';
import { MAILPIT, PASSWORD, login, logout, register, uniqueEmail } from './helpers';

test.describe('autenticación', () => {
  test('las rutas privadas redirigen a /login sin sesión', async ({ page }) => {
    for (const path of ['/', '/finance', '/work', '/settings']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
    }
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  });

  test('el registro valida los campos antes de enviar', async ({ page }) => {
    await page.goto('/register');
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(page.getByText('Este campo es obligatorio')).toHaveCount(4);

    await page.getByLabel('Nombre').fill('Ivan');
    await page.getByLabel('Correo electrónico').fill('no-es-un-correo');
    await page.getByLabel('Contraseña', { exact: true }).fill('corta');
    await page.getByLabel('Confirmar contraseña').fill('otra-cosa');
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(page.getByText('Correo electrónico no válido')).toBeVisible();
    await expect(page.getByText('La contraseña debe tener al menos 8 caracteres')).toBeVisible();
    await expect(page.getByText('Las contraseñas no coinciden')).toBeVisible();
    await expect(page).toHaveURL(/\/register$/);
  });

  test('registro, sesión persistente, cierre e inicio de sesión', async ({ page }) => {
    const email = uniqueEmail('auth');
    await register(page, email, 'Ivan Tester');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Ivan');

    await page.reload();
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Ivan');

    await logout(page);
    await page.goto('/finance');
    await expect(page).toHaveURL(/\/login$/);

    await login(page, email, 'contraseña-incorrecta');
    await expect(page.getByRole('alert')).toHaveText('Correo o contraseña incorrectos.');
    await expect(page).toHaveURL(/\/login$/);

    // After signing in, the user returns to the page that was requested.
    await page.getByLabel('Contraseña').fill(PASSWORD);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/finance$/);
    await expect(page.getByRole('heading', { name: 'Finanzas personales' })).toBeVisible();
  });

  test('no permite registrar dos veces el mismo correo', async ({ page }) => {
    const email = uniqueEmail('dup');
    await register(page, email);
    await logout(page);
    await page.goto('/register');
    await page.getByLabel('Nombre').fill('Otro');
    await page.getByLabel('Correo electrónico').fill(email);
    await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
    await page.getByLabel('Confirmar contraseña').fill(PASSWORD);
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(page.getByRole('alert')).toHaveText('Ya existe una cuenta con ese correo.');
  });

  test('recuperación de contraseña por correo', async ({ page, request }) => {
    const email = uniqueEmail('recover');
    const newPassword = 'Nueva-Clave-98765';
    await register(page, email);
    await logout(page);

    await page.getByRole('link', { name: 'Olvidé mi contraseña' }).click();
    await expect(page.getByRole('heading', { name: 'Recuperar contraseña' })).toBeVisible();
    await page.getByLabel('Correo electrónico').fill(email);
    await page.getByRole('button', { name: 'Enviar enlace' }).click();
    await expect(page.getByRole('status')).toContainText('recibirás un enlace de recuperación');

    // Read the e-mail captured by Mailpit and follow its link.
    let link = '';
    await expect
      .poll(async () => {
        const list = await (await request.get(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)).json();
        const id = list.messages?.[0]?.ID;
        if (!id) return false;
        const message = await (await request.get(`${MAILPIT}/api/v1/message/${id}`)).json();
        link = /https?:\/\/[^\s"<>)]+\/verify\?[^\s"<>)]+/.exec(message.Text)?.[0] ?? '';
        return link !== '';
      })
      .toBe(true);

    await page.goto(link);
    await expect(page).toHaveURL(/\/reset-password/);
    await expect(page.getByRole('heading', { name: 'Nueva contraseña' })).toBeVisible();

    // A recovery session cannot reach the app before choosing a password.
    await page.goto('/finance');
    await expect(page).toHaveURL(/\/reset-password/);

    await page.getByLabel('Nueva contraseña').fill(newPassword);
    await page.getByLabel('Confirmar contraseña').fill(newPassword);
    await page.getByRole('button', { name: 'Guardar contraseña' }).click();
    await expect(page).toHaveURL('/');

    await logout(page);
    await login(page, email, PASSWORD);
    await expect(page.getByRole('alert')).toHaveText('Correo o contraseña incorrectos.');
    await login(page, email, newPassword);
    await expect(page).toHaveURL('/');
  });

  test('un enlace de recuperación inválido muestra cómo pedir otro', async ({ page }) => {
    await page.goto('/reset-password');
    await expect(page.getByRole('heading', { name: 'Enlace no válido' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Solicitar un nuevo enlace' })).toBeVisible();
  });
});
