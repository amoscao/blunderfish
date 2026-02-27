import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('settings visibility CSS regression', () => {
  test('enforces hidden setting checkboxes to not render', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

    expect(css).toMatch(/\.setting-checkbox\[hidden\]\s*\{[^}]*display\s*:\s*none\s*;/);
    expect(css).toMatch(/\.setting-label\[hidden\]\s*\{[^}]*display\s*:\s*none\s*;/);
    expect(css).toMatch(/\.setting-row\[hidden\]\s*\{[^}]*display\s*:\s*none\s*;/);
  });
});
