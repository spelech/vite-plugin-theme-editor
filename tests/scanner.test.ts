import { describe, it, expect } from 'vitest';
import { parseCssVariables, inferVariableType, scanProjectStylesheets } from '../src/server/scanner';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('scanner', () => {
  it('infers variable types accurately', () => {
    expect(inferVariableType('#3b82f6', '--primary')).toBe('color');
    expect(inferVariableType('rgba(18, 26, 47, 0.65)', '--bg-card')).toBe('color');
    expect(inferVariableType('12px', '--radius')).toBe('dimension');
    expect(inferVariableType('1.5rem', '--spacing-lg')).toBe('dimension');
    expect(inferVariableType("'Outfit', sans-serif", '--font-body')).toBe('font');
    expect(inferVariableType('0 10px 25px rgba(0,0,0,0.5)', '--shadow')).toBe('raw');
  });

  it('extracts :root variables and values from CSS content', () => {
    const css = `
      :root {
        --bg-base: #0a0f1d;
        --radius: 12px;
        --font-main: 'Outfit', sans-serif;
      }
      .card { color: red; }
    `;
    const vars = parseCssVariables(css);
    expect(vars).toHaveLength(3);
    expect(vars[0]).toMatchObject({ name: '--bg-base', value: '#0a0f1d', inferredType: 'color' });
    expect(vars[1]).toMatchObject({ name: '--radius', value: '12px', inferredType: 'dimension' });
    expect(vars[2]).toMatchObject({ name: '--font-main', value: "'Outfit', sans-serif", inferredType: 'font' });
  });

  it('scans project stylesheets from directory', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scanner-test-'));
    const srcDir = path.join(tempDir, 'src');
    await fs.mkdir(srcDir, { recursive: true });

    const cssPath = path.join(srcDir, 'style.css');
    await fs.writeFile(cssPath, ':root { --test-color: #ff0000; }');

    const results = await scanProjectStylesheets(tempDir);
    expect(results).toHaveLength(1);
    expect(results[0].relativePath).toBe(path.join('src', 'style.css'));
    expect(results[0].rootSelectors).toEqual([':root']);
    expect(results[0].variables).toHaveLength(1);
    expect(results[0].variables[0].name).toBe('--test-color');
    expect(results[0].variables[0].selector).toBe(':root');

    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('scans variables across multiple selectors like :root, [data-theme="dark"], and :host', () => {
    const css = `
      :root {
        --primary: #3b82f6;
      }
      [data-theme="dark"] {
        --primary: #60a5fa;
        --bg: #1e293b;
      }
      .custom-scope {
        --radius: 8px;
      }
    `;
    const vars = parseCssVariables(css);
    expect(vars).toHaveLength(4);
    expect(vars[0].selector).toBe(':root');
    expect(vars[0].name).toBe('--primary');
    expect(vars[1].selector).toBe('[data-theme="dark"]');
    expect(vars[1].name).toBe('--primary');
    expect(vars[2].selector).toBe('[data-theme="dark"]');
    expect(vars[3].selector).toBe('.custom-scope');
  });

  it('collects unique rootSelectors in scanned stylesheets', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scanner-test-'));
    const srcDir = path.join(tempDir, 'src');
    await fs.mkdir(srcDir, { recursive: true });

    const cssPath = path.join(srcDir, 'style.css');
    await fs.writeFile(
      cssPath,
      `:root { --primary: #000; --secondary: #111; }\n[data-theme="dark"] { --primary: #fff; }`
    );

    const results = await scanProjectStylesheets(tempDir);
    expect(results).toHaveLength(1);
    expect(results[0].rootSelectors).toEqual([':root', '[data-theme="dark"]']);

    await fs.rm(tempDir, { recursive: true, force: true });
  });
});
