import { describe, it, expect } from 'vitest';
import { updateCssVariables, saveCssChanges } from '../src/server/rewriter';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('rewriter', () => {
  it('updates CSS variables while preserving indentation and comments', () => {
    const original = `/* Global Theme */
:root {
    --bg-base: #0a0f1d; /* Main background */
    --radius: 12px;
}
`;
    const updated = updateCssVariables(original, {
      '--bg-base': '#1e293b',
      '--radius': '16px'
    });

    expect(updated).toContain('--bg-base: #1e293b; /* Main background */');
    expect(updated).toContain('--radius: 16px;');
    expect(updated).toContain('/* Global Theme */');
  });

  it('updates CSS variables in html and body selectors', () => {
    const original = `html { --theme-accent: #ff0000; } body { --text-color: #333; }`;
    const updated = updateCssVariables(original, {
      '--theme-accent': '#00ff00',
      '--text-color': '#444'
    });

    expect(updated).toContain('--theme-accent: #00ff00');
    expect(updated).toContain('--text-color: #444');
  });

  it('saves CSS changes to disk with saveCssChanges', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rewriter-test-'));
    const testFile = path.join(tmpDir, 'theme.css');
    const original = `:root {\n  --primary: #123456;\n}\n`;
    await fs.writeFile(testFile, original, 'utf-8');

    await saveCssChanges({
      filePath: testFile,
      updates: { '--primary': '#654321' }
    });

    const result = await fs.readFile(testFile, 'utf-8');
    expect(result).toContain('--primary: #654321');

    await fs.rm(tmpDir, { recursive: true, force: true });
  });
});
