import { expect, test as base } from '@playwright/test';

// Every browser test fails on an uncaught page error (the shipped-only audio bug showed this was missing).
export const test = base.extend<{ pageErrors: void }>({
  pageErrors: [async ({ page }, use) => {
    const errs: string[] = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await use();
    expect(errs, 'uncaught page errors').toEqual([]);
  }, { auto: true }],
});
export { expect };
