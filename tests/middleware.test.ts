import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { createThemeEditorMiddleware } from '../src/server/middleware';
import { themeEditorPlugin } from '../src/index';
import { CLIENT_SCRIPT_INLINE } from '../src/client/bundle-inline';

function createMockReq(options: { url?: string; method?: string; body?: any; malformed?: boolean }) {
  const req = new EventEmitter() as any;
  req.url = options.url || '/';
  req.method = options.method || 'GET';
  req.headers = {};

  process.nextTick(() => {
    if (options.malformed) {
      req.emit('data', '{ invalid json');
    } else if (options.body !== undefined) {
      const data = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      req.emit('data', data);
    }
    req.emit('end');
  });

  return req;
}

function createMockRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    setHeader(name: string, value: string) {
      this.headers[name.toLowerCase()] = value;
    },
    getHeader(name: string) {
      return this.headers[name.toLowerCase()];
    },
  };

  let resolveResult: (val: any) => void;
  const promise = new Promise<any>((resolve) => {
    resolveResult = resolve;
  });

  res.end = (chunk?: string) => {
    const rawBody = chunk || '';
    let parsedBody: any;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      parsedBody = rawBody;
    }
    resolveResult({
      statusCode: res.statusCode,
      headers: res.headers,
      body: parsedBody,
      rawBody
    });
  };

  return {
    res,
    getResult: () => promise,
  };
}

describe('middleware', () => {
  let tempDir: string;
  let cssFile: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'theme-editor-middleware-'));
    const srcDir = path.join(tempDir, 'src');
    await fs.mkdir(srcDir, { recursive: true });

    cssFile = path.join(srcDir, 'theme.css');
    await fs.writeFile(
      cssFile,
      ':root {\n  --primary-color: #3b82f6;\n  --radius: 8px;\n}\n',
      'utf-8'
    );
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('passes through non-theme-editor requests', async () => {
    const middleware = createThemeEditorMiddleware(tempDir);
    const req = createMockReq({ url: '/api/other', method: 'GET' });
    const { res } = createMockRes();

    let nextCalled = false;
    await middleware(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
  });

  it('handles /scan endpoint and returns discovered CSS variables', async () => {
    const middleware = createThemeEditorMiddleware(tempDir);
    const req = createMockReq({ url: '/__theme_editor/api/scan', method: 'GET' });
    const { res, getResult } = createMockRes();

    let nextCalled = false;
    await middleware(req, res, () => {
      nextCalled = true;
    });

    const response = await getResult();
    expect(nextCalled).toBe(false);
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('application/json');
    expect(response.body.success).toBe(true);
    expect(response.body.files).toHaveLength(1);
    expect(response.body.files[0].relativePath).toBe(path.join('src', 'theme.css'));
    expect(response.body.files[0].variables).toHaveLength(2);
  });

  it('handles /diff endpoint and returns preview diff without saving', async () => {
    const middleware = createThemeEditorMiddleware(tempDir);
    const req = createMockReq({
      url: '/__theme_editor/api/diff',
      method: 'POST',
      body: {
        filePath: 'src/theme.css',
        updates: {
          '--primary-color': '#ef4444'
        }
      }
    });
    const { res, getResult } = createMockRes();

    await middleware(req, res, () => {});

    const response = await getResult();
    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.diff.unifiedDiff).toContain('-  --primary-color: #3b82f6;');
    expect(response.body.diff.unifiedDiff).toContain('+  --primary-color: #ef4444;');

    // Verify disk content was NOT altered
    const diskContent = await fs.readFile(cssFile, 'utf-8');
    expect(diskContent).toContain('--primary-color: #3b82f6;');
  });

  it('handles /diff endpoint with newVariables and returns preview diff', async () => {
    const middleware = createThemeEditorMiddleware(tempDir);
    const req = createMockReq({
      url: '/__theme_editor/api/diff',
      method: 'POST',
      body: {
        filePath: 'src/theme.css',
        updates: {},
        newVariables: [
          { selector: ':root', name: '--card-padding', value: '20px' },
          { selector: '[data-theme="dark"]', name: '--dark-bg', value: '#111827' }
        ]
      }
    });
    const { res, getResult } = createMockRes();

    await middleware(req, res, () => {});

    const response = await getResult();
    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.diff.unifiedDiff).toContain('+  --card-padding: 20px;');
    expect(response.body.diff.unifiedDiff).toContain('[data-theme="dark"]');
    expect(response.body.diff.unifiedDiff).toContain('+  --dark-bg: #111827;');
  });


  it('prevents path traversal on /diff endpoint', async () => {
    const middleware = createThemeEditorMiddleware(tempDir);
    const req = createMockReq({
      url: '/__theme_editor/api/diff',
      method: 'POST',
      body: {
        filePath: '../../etc/passwd',
        updates: { '--secret': 'evil' }
      }
    });
    const { res, getResult } = createMockRes();

    await middleware(req, res, () => {});

    const response = await getResult();
    expect(response.statusCode).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Path traversal forbidden');
  });

  it('handles /save endpoint and writes updates to disk', async () => {
    const middleware = createThemeEditorMiddleware(tempDir);
    const req = createMockReq({
      url: '/__theme_editor/api/save',
      method: 'POST',
      body: {
        filePath: 'src/theme.css',
        updates: {
          '--primary-color': '#10b981',
          '--radius': '16px'
        }
      }
    });
    const { res, getResult } = createMockRes();

    await middleware(req, res, () => {});

    const response = await getResult();
    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('Styles written to disk');

    // Verify disk content WAS updated
    const diskContent = await fs.readFile(cssFile, 'utf-8');
    expect(diskContent).toContain('--primary-color: #10b981;');
    expect(diskContent).toContain('--radius: 16px;');
  });

  it('handles /save endpoint with newVariables and writes new variable declarations to disk', async () => {
    const middleware = createThemeEditorMiddleware(tempDir);
    const req = createMockReq({
      url: '/__theme_editor/api/save',
      method: 'POST',
      body: {
        filePath: 'src/theme.css',
        updates: {},
        newVariables: [
          { selector: ':root', name: '--card-padding', value: '24px' },
          { selector: '[data-theme="dark"]', name: '--dark-bg', value: '#0f172a' }
        ]
      }
    });
    const { res, getResult } = createMockRes();

    await middleware(req, res, () => {});

    const response = await getResult();
    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('Styles written to disk');

    // Verify disk content contains new variables
    const diskContent = await fs.readFile(cssFile, 'utf-8');
    expect(diskContent).toContain('--card-padding: 24px;');
    expect(diskContent).toContain('[data-theme="dark"]');
    expect(diskContent).toContain('--dark-bg: #0f172a;');
  });

  it('prevents path traversal on /save endpoint', async () => {

    const middleware = createThemeEditorMiddleware(tempDir);
    const req = createMockReq({
      url: '/__theme_editor/api/save',
      method: 'POST',
      body: {
        filePath: '../../../outside.css',
        updates: { '--leak': 'value' }
      }
    });
    const { res, getResult } = createMockRes();

    await middleware(req, res, () => {});

    const response = await getResult();
    expect(response.statusCode).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Path traversal forbidden');
  });

  it('returns 500 error for invalid json payloads or errors', async () => {
    const middleware = createThemeEditorMiddleware(tempDir);
    const req = createMockReq({
      url: '/__theme_editor/api/diff',
      method: 'POST',
      malformed: true
    });
    const { res, getResult } = createMockRes();

    await middleware(req, res, () => {});

    const response = await getResult();
    expect(response.statusCode).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBeDefined();
  });
});

describe('themeEditorPlugin', () => {
  it('creates a Vite plugin with expected config and hooks', () => {
    const plugin = themeEditorPlugin({ defaultOpen: true });

    expect(plugin.name).toBe('vite-plugin-theme-editor');
    expect(plugin.apply).toBe('serve');
    expect(typeof plugin.configureServer).toBe('function');
    expect(typeof plugin.transformIndexHtml).toBe('function');
  });

  it('injects script tag in transformIndexHtml', () => {
    const plugin = themeEditorPlugin();
    const result = (plugin.transformIndexHtml as any)('<!DOCTYPE html><html><head></head><body></body></html>');

    expect(result.tags).toHaveLength(1);
    expect(result.tags[0]).toEqual({
      tag: 'script',
      attrs: {
        type: 'module',
        src: '/@theme-editor-client.js'
      },
      injectTo: 'body'
    });
  });

  it('serves virtual client module in configureServer', async () => {
    const plugin = themeEditorPlugin();
    const registeredMiddlewares: any[] = [];
    const mockServer: any = {
      config: { root: '/test/root' },
      middlewares: {
        use: (fn: any) => registeredMiddlewares.push(fn)
      }
    };

    (plugin.configureServer as any)(mockServer);
    expect(registeredMiddlewares).toHaveLength(2);

    // Test virtual client module middleware (2nd middleware)
    const clientMiddleware = registeredMiddlewares[1];
    const req = { url: '/@theme-editor-client.js' };
    const { res, getResult } = createMockRes();

    let nextCalled = false;
    clientMiddleware(req, res, () => {
      nextCalled = true;
    });

    const response = await getResult();
    expect(nextCalled).toBe(false);
    expect(response.headers['content-type']).toBe('application/javascript');
    expect(response.rawBody).toBe(CLIENT_SCRIPT_INLINE);
    expect(response.rawBody).toContain('DomInspector');
    expect(response.rawBody).toContain('theme-editor-overlay');
    expect(response.rawBody).toContain('__theme_editor_overrides');
  });
});

describe('end-to-end middleware lifecycle', () => {
  let tempDir: string;
  let cssFile: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'theme-editor-e2e-'));
    const srcDir = path.join(tempDir, 'src');
    await fs.mkdir(srcDir, { recursive: true });

    cssFile = path.join(srcDir, 'theme.css');
    await fs.writeFile(
      cssFile,
      `:root {
  --primary: #3b82f6;
}
[data-theme="dark"] {
  --primary: #60a5fa;
}
`,
      'utf-8'
    );
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('completes full scan -> diff -> save -> re-scan roundtrip for multi-selector variables and insertions', async () => {
    const middleware = createThemeEditorMiddleware(tempDir);

    // 1. Initial Scan
    const scanReq1 = createMockReq({ url: '/__theme_editor/api/scan', method: 'GET' });
    const { res: scanRes1, getResult: getScan1 } = createMockRes();
    await middleware(scanReq1, scanRes1, () => {});
    const scanResult1 = await getScan1();

    expect(scanResult1.statusCode).toBe(200);
    expect(scanResult1.body.success).toBe(true);
    expect(scanResult1.body.files).toHaveLength(1);
    const fileMap1 = scanResult1.body.files[0];
    expect(fileMap1.rootSelectors).toEqual([':root', '[data-theme="dark"]']);
    expect(fileMap1.variables).toHaveLength(2);

    // 2. Diff with updates and new variable insertions
    const diffReq = createMockReq({
      url: '/__theme_editor/api/diff',
      method: 'POST',
      body: {
        filePath: 'src/theme.css',
        updates: { '--primary': '#2563eb' },
        newVariables: [
          { selector: ':root', name: '--card-radius', value: '12px' },
          { selector: '.high-contrast', name: '--contrast-border', value: '2px solid #000' }
        ]
      }
    });
    const { res: diffRes, getResult: getDiff } = createMockRes();
    await middleware(diffReq, diffRes, () => {});
    const diffResult = await getDiff();

    expect(diffResult.statusCode).toBe(200);
    expect(diffResult.body.success).toBe(true);
    expect(diffResult.body.diff.unifiedDiff).toContain('+  --primary: #2563eb;');
    expect(diffResult.body.diff.unifiedDiff).toContain('+  --card-radius: 12px;');
    expect(diffResult.body.diff.unifiedDiff).toContain('.high-contrast');
    expect(diffResult.body.diff.unifiedDiff).toContain('+  --contrast-border: 2px solid #000;');

    // Verify disk was NOT modified during diff
    let diskContent = await fs.readFile(cssFile, 'utf-8');
    expect(diskContent).not.toContain('--card-radius');
    expect(diskContent).not.toContain('.high-contrast');

    // 3. Save updates and new variables to disk
    const saveReq = createMockReq({
      url: '/__theme_editor/api/save',
      method: 'POST',
      body: {
        filePath: 'src/theme.css',
        updates: { '--primary': '#2563eb' },
        newVariables: [
          { selector: ':root', name: '--card-radius', value: '12px' },
          { selector: '.high-contrast', name: '--contrast-border', value: '2px solid #000' }
        ]
      }
    });
    const { res: saveRes, getResult: getSave } = createMockRes();
    await middleware(saveReq, saveRes, () => {});
    const saveResult = await getSave();

    expect(saveResult.statusCode).toBe(200);
    expect(saveResult.body.success).toBe(true);

    // 4. Subsequent Scan to verify persisted state
    const scanReq2 = createMockReq({ url: '/__theme_editor/api/scan', method: 'GET' });
    const { res: scanRes2, getResult: getScan2 } = createMockRes();
    await middleware(scanReq2, scanRes2, () => {});
    const scanResult2 = await getScan2();

    expect(scanResult2.statusCode).toBe(200);
    const fileMap2 = scanResult2.body.files[0];
    expect(fileMap2.rootSelectors).toContain(':root');
    expect(fileMap2.rootSelectors).toContain('[data-theme="dark"]');
    expect(fileMap2.rootSelectors).toContain('.high-contrast');

    const cardRadiusVar = fileMap2.variables.find((v: any) => v.name === '--card-radius');
    expect(cardRadiusVar).toBeDefined();
    expect(cardRadiusVar.value).toBe('12px');
    expect(cardRadiusVar.selector).toBe(':root');

    const contrastVar = fileMap2.variables.find((v: any) => v.name === '--contrast-border');
    expect(contrastVar).toBeDefined();
    expect(contrastVar.value).toBe('2px solid #000');
    expect(contrastVar.selector).toBe('.high-contrast');
  });
});

