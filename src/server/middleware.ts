import type { Connect } from 'vite';
import fs from 'fs/promises';
import path from 'path';
import { scanProjectStylesheets } from './scanner';
import { generateDiff } from './diff';
import { updateCssVariables, saveCssChanges } from './rewriter';
import type { ThemeEditorOptions, SavePayload } from '../types';

export function createThemeEditorMiddleware(rootDir: string, options: ThemeEditorOptions = {}): Connect.NextHandleFunction {
  return async (req, res, next) => {
    const url = req.url || '';

    if (!url.startsWith('/__theme_editor/api/')) {
      return next();
    }

    const endpoint = url.replace('/__theme_editor/api/', '').split('?')[0];

    const sendJson = (data: any, status = 200) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
    };

    const parseBody = async <T>(): Promise<T> => {
      return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            resolve(JSON.parse(body || '{}'));
          } catch (e) {
            reject(e);
          }
        });
        req.on('error', (err) => {
          reject(err);
        });
      });
    };

    try {
      if (req.method === 'GET' && endpoint === 'scan') {
        const files = await scanProjectStylesheets(rootDir, options);
        return sendJson({ success: true, files });
      }

      if (req.method === 'POST' && endpoint === 'diff') {
        const payload = await parseBody<SavePayload>();
        const fullPath = path.resolve(rootDir, payload.filePath);
        const resolvedRoot = path.resolve(rootDir);
        const relative = path.relative(resolvedRoot, fullPath);
        if (relative.startsWith('..') || path.isAbsolute(relative) || !fullPath.startsWith(resolvedRoot)) {
          return sendJson({ success: false, error: 'Path traversal forbidden' }, 403);
        }
        const originalContent = await fs.readFile(fullPath, 'utf-8');
        const modifiedContent = updateCssVariables(originalContent, payload.updates || {}, payload.newVariables || []);
        const diff = generateDiff(payload.filePath, originalContent, modifiedContent);
        return sendJson({ success: true, diff });
      }

      if (req.method === 'POST' && endpoint === 'save') {
        const payload = await parseBody<SavePayload>();
        const fullPath = path.resolve(rootDir, payload.filePath);
        const resolvedRoot = path.resolve(rootDir);
        const relative = path.relative(resolvedRoot, fullPath);
        if (relative.startsWith('..') || path.isAbsolute(relative) || !fullPath.startsWith(resolvedRoot)) {
          return sendJson({ success: false, error: 'Path traversal forbidden' }, 403);
        }
        await saveCssChanges({ ...payload, filePath: fullPath });
        return sendJson({ success: true, message: 'Styles written to disk' });
      }

      return next();
    } catch (err: any) {
      sendJson({ success: false, error: err.message || 'Internal Server Error' }, 500);
    }
  };
}
