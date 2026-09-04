import { ThemeEditorOverlay, registerThemeEditorOverlay } from './overlay';

export * from './styles';
export * from './controls';
export * from './diff-modal';
export * from './inspector';
export * from './overlay';

export function initClient(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  registerThemeEditorOverlay();

  const mount = () => {
    if (!document.querySelector('theme-editor-overlay')) {
      const overlay = document.createElement('theme-editor-overlay');
      document.body.appendChild(overlay);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
}

// Auto-initialize when loaded as a script in the browser
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  initClient();
}
