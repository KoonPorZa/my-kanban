import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';

import { installMockKanbanApi } from './mock-kanban';

type TargetSize = { label: string; width: number; height: number };

async function undersizedInteractiveTargets(
  page: import('@playwright/test').Page,
  selector: string
): Promise<TargetSize[]> {
  return page.locator(selector).evaluateAll((elements) =>
    elements.flatMap((element) => {
      const htmlElement = element as HTMLElement;
      const button = element as HTMLButtonElement;
      const style = window.getComputedStyle(htmlElement);
      const rect = htmlElement.getBoundingClientRect();
      const visible =
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        rect.width > 0 &&
        rect.height > 0;
      const enabled = !button.disabled && element.getAttribute('aria-disabled') !== 'true';

      if (!visible || !enabled || (rect.width >= 44 && rect.height >= 44)) return [];

      const label =
        element.getAttribute('aria-label') ||
        element.getAttribute('title') ||
        htmlElement.innerText.trim().replace(/\s+/g, ' ') ||
        `${element.tagName.toLowerCase()}[role=${element.getAttribute('role') ?? 'native'}]`;

      return [
        {
          label,
          width: Number(rect.width.toFixed(1)),
          height: Number(rect.height.toFixed(1)),
        },
      ];
    })
  );
}

test.beforeEach(async ({ page }) => {
  await installMockKanbanApi(page);
  await page.goto('/dashboard/kanban/');
  await expect(page.getByRole('heading', { name: 'Quality Board' })).toBeVisible();
});

test('Board has no automatically detectable serious or critical accessibility violations', async ({
  page,
}) => {
  const results = await new AxeBuilder({ page })
    .include('main')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const blockingViolations = results.violations.filter(({ impact }) =>
    impact ? ['critical', 'serious'].includes(impact) : false
  );

  expect(blockingViolations).toEqual([]);
});

test('open task drawer has no serious or critical accessibility violations', async ({ page }) => {
  await page.getByRole('button', { name: 'Open task Keyboard card' }).click();
  const drawer = page.locator('.MuiDrawer-paper');
  await expect(drawer).toBeVisible();

  const results = await new AxeBuilder({ page })
    .include('.MuiDrawer-paper')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const blockingViolations = results.violations.filter(({ impact }) =>
    impact ? ['critical', 'serious'].includes(impact) : false
  );

  expect(blockingViolations).toEqual([]);
});

test('keyboard opens a task and moves it with the explicit next-column action', async ({
  page,
}) => {
  const card = page.locator('[data-cypress="draggable-item"]', { hasText: 'Keyboard card' });

  await card.focus();
  await card.press('Enter');
  await expect(page.getByRole('textbox', { name: 'Task name' })).toHaveValue('Keyboard card');

  const moveRequest = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().endsWith('/move')
  );
  const moveNext = page
    .locator('.MuiDrawer-paper')
    .getByRole('button', { name: 'Move task to next column' });
  await moveNext.focus();
  await moveNext.press('Enter');

  expect(await (await moveRequest).postDataJSON()).toMatchObject({
    targetColumnId: '20000000-0000-4000-8000-000000000002',
  });
});

test('warm Board navigation becomes usable in under 2.5 seconds', async ({ page }) => {
  await page.goto('about:blank');
  const startedAt = Date.now();

  await page.goto('/dashboard/kanban/');
  await expect(page.getByRole('heading', { name: 'Quality Board' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open task Keyboard card' })).toBeVisible();

  expect(Date.now() - startedAt).toBeLessThan(2_500);
});

test('explicit move updates the visible column in under 100ms while the response is delayed', async ({
  page,
}) => {
  const movedInBrowser = page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const findDoingColumn = () =>
          [...document.querySelectorAll<HTMLElement>('.minimal__kanban__column')].find((column) =>
            [...column.querySelectorAll<HTMLInputElement>('input')].some(
              (input) => input.value === 'Doing'
            )
          );
        const startedAt = performance.now();
        const timeout = window.setTimeout(() => {
          observer.disconnect();
          reject(new Error('Task did not appear in Doing'));
        }, 1_000);
        const observer = new MutationObserver(() => {
          if (findDoingColumn()?.textContent?.includes('Keyboard card')) {
            window.clearTimeout(timeout);
            observer.disconnect();
            resolve(performance.now() - startedAt);
          }
        });

        observer.observe(document.body, { childList: true, subtree: true });
      })
  );

  await page.getByRole('button', { name: 'Move task to next column' }).last().press('Enter');

  expect(await movedInBrowser).toBeLessThan(100);
});

test.describe('mobile Board', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('renders one selected column with a 44px touch target', async ({ page }) => {
    const selector = page.getByRole('combobox', { name: 'Choose the visible Board column' });
    await expect(selector).toBeVisible();

    const box = await selector.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);

    await selector.click();
    await page.getByRole('option', { name: 'Doing' }).click();
    await expect(selector).toHaveText('Doing');
    await expect(page.getByText('Keyboard card', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Drag and drop is paused', { exact: false })).toBeVisible();
  });

  test('core workflow touch targets are at least 44 by 44 pixels', async ({ page }) => {
    const undersizedTargets = await undersizedInteractiveTargets(
      page,
      'main button, main [role="button"], main [role="combobox"]'
    );

    expect(undersizedTargets).toEqual([]);
  });

  test('open task drawer touch targets are at least 44 by 44 pixels', async ({ page }) => {
    await page.getByRole('button', { name: 'Open task Keyboard card' }).click();
    const drawer = page.locator('.MuiDrawer-paper');
    await expect(drawer).toBeVisible();
    await drawer.getByRole('tab', { name: /Checklist/ }).click();

    const undersizedTargets = await undersizedInteractiveTargets(
      page,
      '.MuiDrawer-paper button, .MuiDrawer-paper [role="button"], .MuiDrawer-paper [role="combobox"]'
    );

    expect(undersizedTargets).toEqual([]);
  });
});
