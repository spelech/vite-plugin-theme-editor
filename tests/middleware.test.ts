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
  });
});
