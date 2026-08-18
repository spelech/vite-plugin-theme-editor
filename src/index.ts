import type { Plugin, ViteDevServer } from 'vite';
import { createThemeEditorMiddleware } from './server/middleware';
import type { ThemeEditorOptions } from './types';
import { CLIENT_SCRIPT_INLINE } from './client/bundle-inline';

export * from './types';
export { createThemeEditorMiddleware } from './server/middleware';

export function themeEditorPlugin(options: ThemeEditorOptions = {}): Plugin {
  return {
    name: 'vite-plugin-theme-editor',
    apply: 'serve', // Dev mode only

    configureServer(server: ViteDevServer) {
      const rootDir = server.config.root;
      server.middlewares.use(createThemeEditorMiddleware(rootDir, options));

      // Serve the client script via virtual module
      server.middlewares.use((req, res, next) => {
        if (req.url === '/@theme-editor-client.js') {
          res.setHeader('Content-Type', 'application/javascript');
          res.end(CLIENT_SCRIPT_INLINE);
          return;
        }
        next();
      });
    },

    transformIndexHtml(html) {
      return {
        html,
        tags: [
          {
            tag: 'script',
            attrs: {
              type: 'module',
              src: '/@theme-editor-client.js'
            },
            injectTo: 'body'
          }
        ]
      };
    }
  };
}

export default themeEditorPlugin;
