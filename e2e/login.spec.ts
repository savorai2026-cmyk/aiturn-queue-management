import { expect, test } from '@playwright/test';

test('the sign-in screen stays usable', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');

  const heading = page.getByRole('heading', { name: 'כניסה למערכת' });
  const email = page.getByRole('textbox', { name: 'דואר אלקטרוני' });
  const continueButton = page.getByRole('button', { name: 'המשך' });

  await expect(heading).toBeVisible();
  await expect(email).toBeVisible();
  await expect(continueButton).toBeVisible();
  await expect(page.getByRole('button', { name: 'הירשם עכשיו' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'התחברות באמצעות Google' })).toBeVisible();

  const box = await continueButton.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(80);
  expect(box?.height ?? 0).toBeGreaterThan(24);

  await email.fill('owner@example.com');
  await continueButton.click();
  await expect(page.getByRole('textbox', { name: 'סיסמה' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'שינוי דוא״ל' })).toBeVisible();

  await page.getByRole('button', { name: 'שינוי דוא״ל' }).click();
  await expect(email).toBeVisible();
  expect(errors).toEqual([]);
});
