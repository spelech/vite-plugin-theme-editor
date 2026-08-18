import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OVERLAY_STYLES, getStyles } from '../src/client/styles';
import {
  parseDimension,
  getDimensionConfig,
  colorToHex,
  createColorControl,
  createDimensionControl,
  createFontControl,
  createRawControl,
  createControl
} from '../src/client/controls';
import { createDiffModal } from '../src/client/diff-modal';
import { ThemeEditorOverlay, registerThemeEditorOverlay } from '../src/client/overlay';
import { initClient } from '../src/client/index';
import { CLIENT_SCRIPT_INLINE } from '../src/client/bundle-inline';
import type { ThemeVariable, DiffResult } from '../src/types';

// Helper mock DOM node factory for Node.js test environment
function createMockElement(tagName: string = 'div'): any {
  const children: any[] = [];
  const listeners: Record<string, Function[]> = {};
  const attributes: Record<string, string> = {};
  const classListSet = new Set<string>();
  const styleObj: Record<string, string> = {};

  let currentClassName = '';
  let currentInnerHTML = '';
  const el: any = {
    tagName: tagName.toUpperCase(),
    get className() {
      return currentClassName;
    },
    set className(val: string) {
      currentClassName = val || '';
      classListSet.clear();
      currentClassName.split(/\s+/).filter(Boolean).forEach(n => classListSet.add(n));
    },
    textContent: '',
    get innerHTML() {
      return currentInnerHTML;
    },
    set innerHTML(val: string) {
      currentInnerHTML = val || '';
      children.length = 0;
    },
    value: '',
    type: '',
    min: '',
    max: '',
    step: '',
    placeholder: '',
    title: '',
    disabled: false,
    attachShadow: (opts: { mode: string }) => {
      const shadowRoot = createMockElement('shadow-root');
      shadowRoot.mode = opts.mode;
      el.shadowRoot = shadowRoot;
      return shadowRoot;
    },
    style: new Proxy(styleObj, {
      get: (target, prop: string) => target[prop] || '',
      set: (target, prop: string, val: string) => {
        target[prop] = val;
        return true;
      }
    }),
    classList: {
      add: (...names: string[]) => {
        names.forEach(n => classListSet.add(n));
        currentClassName = Array.from(classListSet).join(' ');
      },
      remove: (...names: string[]) => {
        names.forEach(n => classListSet.delete(n));
        currentClassName = Array.from(classListSet).join(' ');
      },
      contains: (name: string) => classListSet.has(name),
      toggle: (name: string, force?: boolean) => {
        const shouldAdd = force !== undefined ? force : !classListSet.has(name);
        if (shouldAdd) {
          classListSet.add(name);
        } else {
          classListSet.delete(name);
        }
        currentClassName = Array.from(classListSet).join(' ');
        return shouldAdd;
      }
    },
    setAttribute: (name: string, val: string) => {
      attributes[name] = val;
    },
    getAttribute: (name: string) => attributes[name] || null,
    hasAttribute: (name: string) => name in attributes,
    removeAttribute: (name: string) => {
      delete attributes[name];
    },
    appendChild: (child: any) => {
      children.push(child);
      child.parentElement = el;
      return child;
    },
    removeChild: (child: any) => {
      const idx = children.indexOf(child);
      if (idx !== -1) children.splice(idx, 1);
      return child;
    },
    remove: () => {
      if (el.parentElement) {
        el.parentElement.removeChild(el);
      }
    },
    addEventListener: (event: string, fn: Function) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(fn);
    },
    removeEventListener: (event: string, fn: Function) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter(f => f !== fn);
      }
    },
    dispatchEvent: (eventObj: any) => {
      const type = eventObj.type || eventObj;
      if (listeners[type]) {
        listeners[type].forEach(fn => fn(eventObj));
      }
    },
    querySelector: (selector: string) => {
      const find = (node: any): any => {
        if (!node || !node.children) return null;
        for (const c of node.children) {
          if (selector.startsWith('.') && c.classList.contains(selector.slice(1))) {
            return c;
          }
          if (selector.startsWith('[data-variable-name="') && selector.endsWith('"]')) {
            const varName = selector.slice(22, -2);
            if (c.getAttribute && c.getAttribute('data-variable-name') === varName) {
              return c;
            }
          }
          const nested = find(c);
          if (nested) return nested;
        }
        return null;
      };
      return find(el);
    },
    querySelectorAll: (selector: string) => {
      const results: any[] = [];
      const find = (node: any) => {
        if (!node || !node.children) return;
        for (const c of node.children) {
          if (selector.startsWith('.') && c.classList.contains(selector.slice(1))) {
            results.push(c);
          }
          find(c);
        }
      };
      find(el);
      return results;
    },
    children
  };

  return el;
}

function setupGlobalDomMocks() {
  const rootStyle: Record<string, string> = {};
  const docEl = createMockElement('html');
  docEl.style.setProperty = (name: string, value: string) => {
    rootStyle[name] = value;
  };
  docEl.style.removeProperty = (name: string) => {
    delete rootStyle[name];
  };
  docEl.style.getPropertyValue = (name: string) => rootStyle[name] || '';

  const bodyEl = createMockElement('body');
  const mockDocument: any = {
    createElement: (tag: string) => createMockElement(tag),
    documentElement: docEl,
    body: bodyEl,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    querySelector: vi.fn((sel: string) => {
      if (sel === 'theme-editor-overlay') return null;
      return null;
    }),
    readyState: 'complete'
  };

  const definedElements: Record<string, any> = {};
  const mockCustomElements: any = {
    define: vi.fn((name: string, constructor: any) => {
      definedElements[name] = constructor;
    }),
    get: vi.fn((name: string) => definedElements[name])
  };

  (global as any).document = mockDocument;
  (global as any).window = global;
  (global as any).customElements = mockCustomElements;
  (global as any).HTMLElement = class MockHTMLElement {
    public attachShadow(opts: { mode: string }) {
      const shadowRoot = createMockElement('shadow-root');
      shadowRoot.mode = opts.mode;
      (this as any).shadowRoot = shadowRoot;
      return shadowRoot;
    }
    public setAttribute(name: string, val: string) {
      (this as any)[name] = val;
    }
    public hasAttribute(name: string) {
      return (this as any)[name] !== undefined;
    }
  };

  return { rootStyle, mockDocument, mockCustomElements };
}

describe('styles', () => {
  it('exports valid and isolated Shadow DOM styles', () => {
    expect(OVERLAY_STYLES).toBeDefined();
    expect(typeof OVERLAY_STYLES).toBe('string');
    expect(getStyles()).toBe(OVERLAY_STYLES);

    // Verify key component styles exist
    expect(OVERLAY_STYLES).toContain(':host');
    expect(OVERLAY_STYLES).toContain('.theme-editor-trigger');
    expect(OVERLAY_STYLES).toContain('.theme-editor-drawer');
    expect(OVERLAY_STYLES).toContain('.theme-editor-item');
    expect(OVERLAY_STYLES).toContain('.theme-editor-color-control');
    expect(OVERLAY_STYLES).toContain('.theme-editor-dimension-control');
    expect(OVERLAY_STYLES).toContain('.theme-editor-modal');
    expect(OVERLAY_STYLES).toContain('.diff-addition');
    expect(OVERLAY_STYLES).toContain('.diff-deletion');
    expect(OVERLAY_STYLES).toContain('.theme-editor-toast');
  });
});

describe('controls', () => {
  beforeEach(() => {
    setupGlobalDomMocks();
  });

  it('parses dimension units correctly', () => {
    expect(parseDimension('16px')).toEqual({ num: 16, unit: 'px' });
    expect(parseDimension('1.5rem')).toEqual({ num: 1.5, unit: 'rem' });
    expect(parseDimension('0.875em')).toEqual({ num: 0.875, unit: 'em' });
    expect(parseDimension('100%')).toEqual({ num: 100, unit: '%' });
    expect(parseDimension('50vh')).toEqual({ num: 50, unit: 'vh' });
    expect(parseDimension('24vw')).toEqual({ num: 24, unit: 'vw' });
    expect(parseDimension('12pt')).toEqual({ num: 12, unit: 'pt' });
    expect(parseDimension('-8px')).toEqual({ num: -8, unit: 'px' });
    expect(parseDimension('24')).toEqual({ num: 24, unit: 'px' });
    expect(parseDimension('calc(100% - 20px)')).toEqual({ num: 0, unit: '' });
  });

  it('computes slider range config for different units', () => {
    const pxConfig = getDimensionConfig('px', 16);
    expect(pxConfig.step).toBe(1);
    expect(pxConfig.max).toBeGreaterThanOrEqual(16);

    const remConfig = getDimensionConfig('rem', 1.5);
    expect(remConfig.step).toBe(0.05);
    expect(remConfig.max).toBeGreaterThanOrEqual(6);

    const percentConfig = getDimensionConfig('%', 50);
    expect(percentConfig.min).toBe(0);
    expect(percentConfig.max).toBe(100);
    expect(percentConfig.step).toBe(1);

    const negativeConfig = getDimensionConfig('px', -30);
    expect(negativeConfig.min).toBeLessThan(0);
  });

  it('converts various color formats to 6-digit hex values', () => {
    expect(colorToHex('#fff')).toBe('#ffffff');
    expect(colorToHex('#3b8')).toBe('#33bb88');
    expect(colorToHex('#3b82f6')).toBe('#3b82f6');
    expect(colorToHex('#3b82f6aa')).toBe('#3b82f6');
    expect(colorToHex('rgb(255, 0, 0)')).toBe('#ff0000');
    expect(colorToHex('rgba(0, 255, 0, 0.5)')).toBe('#00ff00');
    expect(colorToHex('rgb(59, 130, 246)')).toBe('#3b82f6');
    expect(colorToHex('hsl(0, 100%, 50%)')).toBe('#ff0000');
    expect(colorToHex('hsl(120, 100%, 50%)')).toBe('#00ff00');
    expect(colorToHex('hsl(240, 100%, 50%)')).toBe('#0000ff');
    expect(colorToHex('black')).toBe('#000000');
    expect(colorToHex('white')).toBe('#ffffff');
    expect(colorToHex('unknown-color')).toBe('#3b82f6');
  });

  it('creates color control and binds input change events', () => {
    const variable: ThemeVariable = { name: '--primary', value: '#3b82f6', inferredType: 'color' };
    const onChange = vi.fn();
    const control = createColorControl(variable, '#3b82f6', onChange);

    expect(control.className).toBe('theme-editor-color-control');
    const colorInput = control.children[0].children[1];
    const textInput = control.children[1];

    expect(textInput.value).toBe('#3b82f6');

    // Simulate typing in text input
    textInput.value = '#ef4444';
    textInput.dispatchEvent({ type: 'input', target: textInput });
    expect(onChange).toHaveBeenCalledWith('#ef4444');

    // Simulate picking in color picker
    colorInput.value = '#10b981';
    colorInput.dispatchEvent({ type: 'input', target: colorInput });
    expect(onChange).toHaveBeenCalledWith('#10b981');
    expect(textInput.value).toBe('#10b981');
  });

  it('creates dimension control with slider and number input', () => {
    const variable: ThemeVariable = { name: '--radius', value: '12px', inferredType: 'dimension' };
    const onChange = vi.fn();
    const control = createDimensionControl(variable, '12px', onChange);

    expect(control.className).toBe('theme-editor-dimension-control');
    const row = control.children[0];
    const slider = row.children[0];
    const numInput = row.children[1].children[0];
    const unitBadge = row.children[1].children[1];

    expect(slider.value).toBe('12');
    expect(numInput.value).toBe('12');
    expect(unitBadge.textContent).toBe('px');

    // Simulate slider change
    slider.value = '16';
    slider.dispatchEvent({ type: 'input', target: slider });
    expect(onChange).toHaveBeenCalledWith('16px');
    expect(numInput.value).toBe('16');

    // Simulate number input change
    numInput.value = '20';
    numInput.dispatchEvent({ type: 'input', target: numInput });
    expect(onChange).toHaveBeenCalledWith('20px');
    expect(slider.value).toBe('20');
  });

  it('creates font and raw controls correctly', () => {
    const fontVar: ThemeVariable = { name: '--font-body', value: 'Inter, sans-serif', inferredType: 'font' };
    const onFontChange = vi.fn();
    const fontControl = createFontControl(fontVar, 'Inter, sans-serif', onFontChange);

    expect(fontControl.className).toBe('theme-editor-font-control');
    const fontInput = fontControl.children[0];
    fontInput.value = 'Roboto, sans-serif';
    fontInput.dispatchEvent({ type: 'input', target: fontInput });
    expect(onFontChange).toHaveBeenCalledWith('Roboto, sans-serif');

    const rawVar: ThemeVariable = { name: '--shadow', value: '0 4px 6px rgba(0,0,0,0.1)', inferredType: 'raw' };
    const onRawChange = vi.fn();
    const rawControl = createRawControl(rawVar, '0 4px 6px rgba(0,0,0,0.1)', onRawChange);

    expect(rawControl.className).toBe('theme-editor-control-body');
    const rawInput = rawControl.children[0];
    rawInput.value = 'none';
    rawInput.dispatchEvent({ type: 'input', target: rawInput });
    expect(onRawChange).toHaveBeenCalledWith('none');
  });

  it('dispatches control creation via createControl', () => {
    const colorVar: ThemeVariable = { name: '--c', value: '#fff', inferredType: 'color' };
    const dimVar: ThemeVariable = { name: '--d', value: '8px', inferredType: 'dimension' };
    const fontVar: ThemeVariable = { name: '--f', value: 'sans-serif', inferredType: 'font' };
    const rawVar: ThemeVariable = { name: '--r', value: 'none', inferredType: 'raw' };

    expect(createControl(colorVar, '#fff', () => {}).className).toBe('theme-editor-color-control');
    expect(createControl(dimVar, '8px', () => {}).className).toBe('theme-editor-dimension-control');
    expect(createControl(fontVar, 'sans-serif', () => {}).className).toBe('theme-editor-font-control');
    expect(createControl(rawVar, 'none', () => {}).className).toBe('theme-editor-control-body');
  });
});

describe('diff-modal', () => {
  beforeEach(() => {
    setupGlobalDomMocks();
  });

  it('renders unified diff lines with additions, deletions, and hunks', async () => {
    const diffResult: DiffResult = {
      filePath: 'src/theme.css',
      original: ':root {\n  --primary: #3b82f6;\n  --radius: 8px;\n}\n',
      modified: ':root {\n  --primary: #ef4444;\n  --radius: 12px;\n}\n',
      unifiedDiff: '--- src/theme.css\n+++ src/theme.css\n@@ -1,4 +1,4 @@\n :root {\n-  --primary: #3b82f6;\n+  --primary: #ef4444;\n-  --radius: 8px;\n+  --radius: 12px;\n }\n',
      changesCount: 4
    };

    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    const modalBackdrop = createDiffModal({
      filePath: 'src/theme.css',
      diffResult,
      onSave,
      onClose
    });

    expect(modalBackdrop.className).toBe('theme-editor-modal-backdrop');
    const modal = modalBackdrop.children[0];
    const header = modal.children[0];
    const content = modal.children[1];
    const footer = modal.children[2];

    expect(header.children[0].children[0].textContent).toBe('Review Staged Changes');
    expect(header.children[0].children[1].textContent).toContain('src/theme.css (4 changes)');

    const diffLines = content.querySelectorAll('.diff-line');
    expect(diffLines.length).toBeGreaterThan(0);

    const additions = content.querySelectorAll('.diff-addition');
    const deletions = content.querySelectorAll('.diff-deletion');
    const hunks = content.querySelectorAll('.diff-hunk');
    const headers = content.querySelectorAll('.diff-file-header');

    expect(additions.length).toBe(2);
    expect(deletions.length).toBe(2);
    expect(hunks.length).toBe(1);
    expect(headers.length).toBe(2);

    // Test Save button click
    const saveBtn = footer.children[1];
    expect(saveBtn.textContent).toBe('Save to Disk');
    await saveBtn.dispatchEvent({ type: 'click' });
    expect(onSave).toHaveBeenCalled();

    // Test Cancel button click
    const cancelBtn = footer.children[0];
    cancelBtn.dispatchEvent({ type: 'click' });
    expect(onClose).toHaveBeenCalled();
  });
});

describe('ThemeEditorOverlay Web Component', () => {
  let dom: ReturnType<typeof setupGlobalDomMocks>;

  beforeEach(() => {
    dom = setupGlobalDomMocks();
    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        files: [
          {
            filePath: '/root/src/theme.css',
            relativePath: 'src/theme.css',
            variables: [
              { name: '--color-primary', value: '#3b82f6', inferredType: 'color' },
              { name: '--border-radius', value: '8px', inferredType: 'dimension' }
            ]
          }
        ]
      })
    });
  });

  it('initializes overlay component, loads scan data, and attaches shadow DOM', async () => {
    const overlay = new ThemeEditorOverlay();
    overlay.connectedCallback();

    expect(overlay.shadow).toBeDefined();
    await (overlay as any).loadScanData();

    expect(overlay.files).toHaveLength(1);
    expect(overlay.selectedFilePath).toBe('/root/src/theme.css');
    expect(overlay.originalValues['/root/src/theme.css']).toEqual({
      '--color-primary': '#3b82f6',
      '--border-radius': '8px'
    });
  });

  it('handles live variable updates and stages changes', async () => {
    const overlay = new ThemeEditorOverlay();
    overlay.connectedCallback();
    await (overlay as any).loadScanData();

    // Update primary color
    overlay.updateVariable('--color-primary', '#ef4444');

    expect(dom.rootStyle['--color-primary']).toBe('#ef4444');
    expect(overlay.stagedValues['/root/src/theme.css']['--color-primary']).toBe('#ef4444');
    expect(overlay.getStagedCount('/root/src/theme.css')).toBe(1);

    // Reverting to original value clears it from staged
    overlay.updateVariable('--color-primary', '#3b82f6');
    expect(overlay.stagedValues['/root/src/theme.css']['--color-primary']).toBeUndefined();
    expect(overlay.getStagedCount('/root/src/theme.css')).toBe(0);
  });

  it('resets single variable and resets all staged variables', async () => {
    const overlay = new ThemeEditorOverlay();
    overlay.connectedCallback();
    await (overlay as any).loadScanData();

    overlay.updateVariable('--color-primary', '#ef4444');
    overlay.updateVariable('--border-radius', '16px');
    expect(overlay.getStagedCount('/root/src/theme.css')).toBe(2);

    // Reset single variable
    overlay.resetVariable('--color-primary');
    expect(dom.rootStyle['--color-primary']).toBe('#3b82f6');
    expect(overlay.getStagedCount('/root/src/theme.css')).toBe(1);

    // Reset all
    overlay.resetAll();
    expect(dom.rootStyle['--border-radius']).toBe('8px');
    expect(overlay.getStagedCount('/root/src/theme.css')).toBe(0);
  });

  it('controls drawer open, close, and toggle state', () => {
    const overlay = new ThemeEditorOverlay();
    overlay.connectedCallback();

    expect(overlay.isOpen).toBe(false);
    overlay.openDrawer();
    expect(overlay.isOpen).toBe(true);

    overlay.closeDrawer();
    expect(overlay.isOpen).toBe(false);

    overlay.toggleDrawer();
    expect(overlay.isOpen).toBe(true);
  });

  it('handles saveChanges persistence and updates original state', async () => {
    const overlay = new ThemeEditorOverlay();
    overlay.connectedCallback();
    await (overlay as any).loadScanData();

    overlay.updateVariable('--color-primary', '#10b981');

    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, message: 'Saved' })
    });

    await overlay.saveChanges();

    expect(overlay.originalValues['/root/src/theme.css']['--color-primary']).toBe('#10b981');
    expect(overlay.getStagedCount('/root/src/theme.css')).toBe(0);
  });

  it('filters variables by type and search query', async () => {
    const overlay = new ThemeEditorOverlay();
    overlay.connectedCallback();
    await (overlay as any).loadScanData();

    // Test filter tabs
    overlay.activeFilter = 'color';
    (overlay as any).renderList();
    const list = (overlay as any).listContainerEl;
    let cards = list.querySelectorAll('.theme-editor-item');
    expect(cards.length).toBe(1);
    expect(cards[0].getAttribute('data-variable-name')).toBe('--color-primary');

    // Test search filter
    overlay.activeFilter = 'all';
    overlay.searchQuery = 'border';
    (overlay as any).renderList();
    cards = list.querySelectorAll('.theme-editor-item');
    expect(cards.length).toBe(1);
    expect(cards[0].getAttribute('data-variable-name')).toBe('--border-radius');

    // Test non-matching search
    overlay.searchQuery = 'non-existent-variable';
    (overlay as any).renderList();
    cards = list.querySelectorAll('.theme-editor-item');
    expect(cards.length).toBe(0);
  });

  it('switches stylesheets in multi-file setups', async () => {
    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        files: [
          {
            filePath: '/root/src/theme1.css',
            relativePath: 'src/theme1.css',
            variables: [{ name: '--var-1', value: '10px', inferredType: 'dimension' }]
          },
          {
            filePath: '/root/src/theme2.css',
            relativePath: 'src/theme2.css',
            variables: [{ name: '--var-2', value: '#fff', inferredType: 'color' }]
          }
        ]
      })
    });

    const overlay = new ThemeEditorOverlay();
    overlay.connectedCallback();
    await (overlay as any).loadScanData();

    expect(overlay.files).toHaveLength(2);
    expect(overlay.selectedFilePath).toBe('/root/src/theme1.css');

    overlay.setSelectedFile('/root/src/theme2.css');
    expect(overlay.selectedFilePath).toBe('/root/src/theme2.css');
  });

  it('renders and displays toasts', () => {
    const overlay = new ThemeEditorOverlay();
    overlay.connectedCallback();

    overlay.showToast('Test notification', 'success', 100);
    const toastContainer = (overlay as any).toastContainerEl;
    expect(toastContainer.children.length).toBe(1);
    expect(toastContainer.children[0].textContent).toBe('Test notification');
    expect(toastContainer.children[0].classList.contains('success')).toBe(true);
  });

  it('handles diff modal rendering with empty diff or backdrop click', () => {
    const emptyDiff: DiffResult = {
      filePath: 'src/theme.css',
      original: '',
      modified: '',
      unifiedDiff: '',
      changesCount: 0
    };
    const onClose = vi.fn();
    const modal = createDiffModal({
      filePath: 'src/theme.css',
      diffResult: emptyDiff,
      onSave: async () => {},
      onClose
    });

    expect(modal.querySelector('.theme-editor-empty-state')).toBeDefined();

    // Backdrop click
    modal.dispatchEvent({ type: 'click', target: modal });
    expect(onClose).toHaveBeenCalled();
  });

  it('registers custom element and auto-initializes client', () => {
    registerThemeEditorOverlay();
    expect(dom.mockCustomElements.define).toHaveBeenCalledWith('theme-editor-overlay', ThemeEditorOverlay);

    initClient();
    expect(dom.mockCustomElements.define).toHaveBeenCalled();
  });
});

describe('bundle-inline', () => {
  it('exports bundled client inline script', () => {
    expect(CLIENT_SCRIPT_INLINE).toBeDefined();
    expect(typeof CLIENT_SCRIPT_INLINE).toBe('string');
    expect(CLIENT_SCRIPT_INLINE.length).toBeGreaterThan(100);
    expect(CLIENT_SCRIPT_INLINE).toContain('theme-editor-overlay');
  });
});
