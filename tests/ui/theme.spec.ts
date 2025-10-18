import { test, expect } from '@playwright/test';

function parseColor(value: string) {
  const match = value.match(/rgba?\(([^)]+)\)/);
  if (!match) return { r: 0, g: 0, b: 0 };
  const [r, g, b] = match[1].split(',').map((part) => parseFloat(part.trim()));
  return { r, g, b };
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }) {
  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
  };
  const R = channel(r);
  const G = channel(g);
  const B = channel(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrastRatio(foreground: string, background: string) {
  const fg = relativeLuminance(parseColor(foreground));
  const bg = relativeLuminance(parseColor(background));
  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);
  return (lighter + 0.05) / (darker + 0.05);
}

async function getContrast(page, selector) {
  return page.evaluate((target) => {
    const el = document.querySelector(target);
    if (!el) {
      return null;
    }

    const resolveBackground = (element) => {
      if (!element) {
        return 'rgb(255, 255, 255)';
      }
      const bg = getComputedStyle(element).backgroundColor;
      if (bg && !bg.startsWith('rgba(0, 0, 0, 0') && bg !== 'transparent') {
        return bg;
      }
      return resolveBackground(element.parentElement);
    };

    const styles = getComputedStyle(el);
    const color = styles.color;
    const background = resolveBackground(el);
    return { color, background };
  }, selector);
}

test.describe('theme toggle', () => {
  test('switches between light and dark while keeping adequate contrast', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.removeItem('proxmox-openapi.theme');
    });

    await page.goto('/');

    const getBodyColors = () =>
      page.evaluate(() => {
        const styles = getComputedStyle(document.body);
        return {
          color: styles.color,
          background: styles.backgroundColor,
        };
      });

    const initialTheme = await page.evaluate(() => document.documentElement.dataset.theme ?? 'dark');
    const initialColors = await getBodyColors();
    expect(contrastRatio(initialColors.color, initialColors.background)).toBeGreaterThan(4.5);

    await page.locator('.theme-toggle').click();
    await page.waitForFunction(
      (expected) => document.documentElement.dataset.theme === expected,
      initialTheme === 'dark' ? 'light' : 'dark'
    );

    const nextColors = await getBodyColors();
    expect(contrastRatio(nextColors.color, nextColors.background)).toBeGreaterThan(4.5);
  });

  test('swagger explorer contrast meets expectations', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('proxmox-openapi.theme', 'light');
    });

    await page.goto('/explorer');
    await page.getByRole('button', { name: /load api explorer/i }).click();
    await page.locator('.swagger-ui').first().waitFor();

    const contrastTargets: Array<{ selector: string; minimum: number }> = [
      { selector: '.swagger-container', minimum: 4.5 },
      { selector: '.swagger-ui .servers-title', minimum: 4.5 },
      { selector: '.swagger-ui .servers', minimum: 4.5 },
      { selector: '.swagger-ui .servers input[data-variable="host"]', minimum: 4.5 },
      { selector: '.swagger-ui .servers input[data-variable="port"]', minimum: 4.5 },
      { selector: '.swagger-ui .computed-url', minimum: 4.5 },
      { selector: '.swagger-ui .btn.authorize', minimum: 2.0 },
    ];

    for (const { selector, minimum } of contrastTargets) {
      const colors = await getContrast(page, selector);
      expect(colors, `Missing contrast target for ${selector}`).not.toBeNull();
      if (!colors) continue;
      const ratio = contrastRatio(colors.color, colors.background);
      expect(ratio, `Contrast for ${selector} (${ratio.toFixed(2)})`).toBeGreaterThan(minimum);
    }

    await page.locator('.theme-toggle').click();
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');

    const swaggerFilter = await page.evaluate(() => {
      const target = document.querySelector('#swagger');
      return target ? getComputedStyle(target).filter : null;
    });
    expect(swaggerFilter, 'Expected swagger container to apply dark-mode filter').toMatch(/invert\((?:88%|0\.88)\)/);

    const microlightFilter = await page.evaluate(() => {
      const target = document.querySelector('#swagger .microlight');
      if (!target) return null;
      return getComputedStyle(target).filter;
    });
    if (microlightFilter) {
      expect(microlightFilter).toMatch(/invert\(100%\)/);
    }

    await expect(page.locator('#swagger .swagger-ui')).toBeVisible();
  });
});
