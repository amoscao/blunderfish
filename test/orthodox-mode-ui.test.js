import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('orthodox mode ui wiring', () => {
  test('index includes orthodox mode button and setup/settings blocks', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

    expect(html).toContain('id="mode-blindfish-orthodox-btn"');
    expect(html).toContain('Blindfish (Orthodox)');
    expect(html).toContain('id="setup-orthodox-settings"');
    expect(html).toContain('id="orthodox-settings-note"');
    expect(html).toContain('id="settings-controls"');
  });
});
