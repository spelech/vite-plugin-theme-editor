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
import { DomInspector } from '../src/client/inspector';
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
    get id() {
      return attributes['id'] || '';
    },
    set id(val: string) {
      attributes['id'] = val || '';
    },
    disabled: false,
    attachShadow: (opts: { mode: string }) => {
      const shadowRoot = createMockElement('shadow-root');
      shadowRoot.mode = opts.mode;
      el.shadowRoot = shadowRoot;
      return shadowRoot;
    },
    getBoundingClientRect: () => ({
      top: 10,
      left: 20,
      width: 100,
      height: 50,
      bottom: 60,
      right: 120
    }),
    matches: (sel: string) => {
      if (sel === '*') return true;
      if (sel.startsWith('.')) return classListSet.has(sel.slice(1));
      if (sel.startsWith('#')) return (el.id === sel.slice(1) || attributes['id'] === sel.slice(1));
      if (sel.toUpperCase() === el.tagName) return true;
      if (sel.startsWith('[') && sel.endsWith(']')) {
        const attrRegex = /\[([a-zA-Z0-9_-]+)(?:=(?:"((?:\\"|[^"])*)"|'((?:\\'|[^'])*)'|([^\]]*)))?\]/g;
        let match;
        let matchedAny = false;
        let allMatch = true;
        while ((match = attrRegex.exec(sel)) !== null) {
          matchedAny = true;
          const attr = match[1];
          const rawVal = match[2] ?? match[3] ?? match[4];
          if (rawVal !== undefined) {
            const val = rawVal.replace(/\\(["'])/g, '$1');
            if (attributes[attr] !== val) {
              allMatch = false;
              break;
            }
          } else {
            if (!(attr in attributes)) {
              allMatch = false;
              break;
            }
          }
        }
        if (matchedAny) return allMatch;
      }
      return false;
    },
    closest: (sel: string) => {
      let cur: any = el;
      while (cur) {
        if (cur.matches && cur.matches(sel)) return cur;
        cur = cur.parentElement;
      }
      return null;
    },
    style: new Proxy(styleObj, {
      get: (target, prop: string) => {
        if (prop in target) {
          return target[prop];
        }
        if (prop === 'setProperty') {
          return (name: string, val: string) => {
            target[name] = val;
          };
        }
        if (prop === 'getPropertyValue') {
          return (name: string) => target[name] || '';
        }
        if (prop === 'removeProperty') {
          return (name: string) => {
            delete target[name];
          };
        }
        if (prop === 'cssText') {
          return Object.entries(target).map(([k, v]) => `${k}: ${v};`).join(' ');
        }
        return target[prop] || '';
      },
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
          if (c.matches && c.matches(selector)) {
            return c;
          }
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
          if (c.matches && c.matches(selector)) {
            results.push(c);
          } else if (selector.startsWith('.') && c.classList.contains(selector.slice(1))) {
            results.push(c);
          } else if (selector === '*' || (c.tagName && c.tagName === selector.toUpperCase())) {
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

  const headEl = createMockElement('head');
  const bodyEl = createMockElement('body');
  docEl.appendChild(headEl);
  docEl.appendChild(bodyEl);
  const docListeners: Record<string, Function[]> = {};
  const mockDocument: any = {
    createElement: (tag: string) => createMockElement(tag),
    documentElement: docEl,
    head: headEl,
    body: bodyEl,
    styleSheets: [],
    getElementById: vi.fn((id: string) => {
      return docEl.querySelector?.('#' + id) || bodyEl.querySelector?.('#' + id) || headEl.querySelector?.('#' + id) || null;
    }),
    addEventListener: vi.fn((event: string, fn: Function) => {
      if (!docListeners[event]) docListeners[event] = [];
      docListeners[event].push(fn);
    }),
    removeEventListener: vi.fn((event: string, fn: Function) => {
      if (docListeners[event]) {
        docListeners[event] = docListeners[event].filter(f => f !== fn);
      }
    }),
    dispatchEvent: (eventObj: any) => {
      const type = eventObj.type || eventObj;
      if (docListeners[type]) {
        docListeners[type].forEach(fn => fn(eventObj));
      }
    },
    querySelector: vi.fn((sel: string) => {
      if (sel === 'theme-editor-overlay') return null;
      return bodyEl.querySelector(sel) || docEl.querySelector(sel);
    }),
    querySelectorAll: vi.fn((sel: string) => {
      const fromDoc = docEl.querySelectorAll(sel);
      const fromBody = bodyEl.querySelectorAll(sel);
      const set = new Set([...fromDoc, ...fromBody]);
      return Array.from(set);
    }),
    elementFromPoint: vi.fn((_x: number, _y: number) => null),
    elementsFromPoint: vi.fn((_x: number, _y: number) => []),
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
  (global as any).window.getComputedStyle = vi.fn((element: any) => {
    return {
      getPropertyValue: (prop: string) => {
        if (element && element.style && typeof element.style.getPropertyValue === 'function') {
          return element.style.getPropertyValue(prop) || element.style[prop] || '';
        }
        return (element && element.style && element.style[prop]) || '';
      },
      ...element?.style
    };
  });
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
    expect(OVERLAY_STYLES).toContain('.theme-editor-highlight-box');
    expect(OVERLAY_STYLES).toContain('.theme-editor-inspector-panel');
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

  it('filters variables by root selector dropdown', async () => {
    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        files: [
          {
            filePath: '/root/src/theme.css',
            relativePath: 'src/theme.css',
            rootSelectors: [':root', '[data-theme="dark"]'],
            variables: [
              { name: '--color-primary', value: '#3b82f6', inferredType: 'color', selector: ':root' },
              { name: '--color-dark-bg', value: '#111827', inferredType: 'color', selector: '[data-theme="dark"]' }
            ]
          }
        ]
      })
    });

    const overlay = new ThemeEditorOverlay();
    overlay.connectedCallback();
    await (overlay as any).loadScanData();

    const selectorSelect = (overlay as any).selectorSelectEl as HTMLSelectElement;
    expect(selectorSelect).toBeDefined();
    expect(selectorSelect.children.length).toBe(3); // 'all', ':root', '[data-theme="dark"]'

    // Default 'all' shows both
    let cards = (overlay as any).listContainerEl.querySelectorAll('.theme-editor-item');
    expect(cards.length).toBe(2);

    // Switch to '[data-theme="dark"]'
    overlay.selectedSelector = '[data-theme="dark"]';
    selectorSelect.value = '[data-theme="dark"]';
    (overlay as any).renderList();

    cards = (overlay as any).listContainerEl.querySelectorAll('.theme-editor-item');
    expect(cards.length).toBe(1);
    expect(cards[0].getAttribute('data-variable-name')).toBe('--color-dark-bg');
  });

  it('handles live scoped updates using ephemeral <style id="__theme_editor_overrides"> for non-root selectors', async () => {
    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        files: [
          {
            filePath: '/root/src/theme.css',
            relativePath: 'src/theme.css',
            rootSelectors: [':root', '[data-theme="dark"]'],
            variables: [
              { name: '--color-primary', value: '#3b82f6', inferredType: 'color', selector: ':root' },
              { name: '--color-dark-bg', value: '#111827', inferredType: 'color', selector: '[data-theme="dark"]' }
            ]
          }
        ]
      })
    });

    const overlay = new ThemeEditorOverlay();
    overlay.connectedCallback();
    await (overlay as any).loadScanData();

    // Root update -> document.documentElement.style.setProperty
    overlay.updateVariable('--color-primary', '#ef4444');
    expect(dom.rootStyle['--color-primary']).toBe('#ef4444');

    // Scoped update -> ephemeral style tag injection
    overlay.updateVariable('--color-dark-bg', '#000000');
    expect(dom.rootStyle['--color-dark-bg']).toBeUndefined();

    const styleEl = (dom.mockDocument.getElementById ? dom.mockDocument.getElementById('__theme_editor_overrides') : dom.mockDocument.querySelector('#__theme_editor_overrides'));
    expect(styleEl).toBeDefined();
    expect(styleEl.textContent).toContain('[data-theme="dark"]');
    expect(styleEl.textContent).toContain('--color-dark-bg: #000000;');

    // Reset variable clears or updates overrides style
    overlay.resetVariable('--color-dark-bg');
    expect(styleEl.textContent).not.toContain('--color-dark-bg: #000000;');
  });

  it('highlights affected elements on card hover and displays affected count badge', async () => {
    const targetBtn = createMockElement('button');
    targetBtn.setAttribute('style', 'color: var(--color-primary);');
    dom.mockDocument.body.appendChild(targetBtn);

    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        files: [
          {
            filePath: '/root/src/theme.css',
            relativePath: 'src/theme.css',
            rootSelectors: [':root'],
            variables: [
              { name: '--color-primary', value: '#3b82f6', inferredType: 'color', selector: ':root' },
              { name: '--unused-var', value: '10px', inferredType: 'dimension', selector: ':root' }
            ]
          }
        ]
      })
    });

    const overlay = new ThemeEditorOverlay();
    overlay.connectedCallback();
    await (overlay as any).loadScanData();

    const cardPrimary = (overlay as any).listContainerEl.querySelector('[data-variable-name="--color-primary"]');
    const cardUnused = (overlay as any).listContainerEl.querySelector('[data-variable-name="--unused-var"]');

    // Badge check
    const badgePrimary = cardPrimary.querySelector('.theme-editor-affected-badge');
    expect(badgePrimary).toBeDefined();
    expect(badgePrimary.textContent).toContain('1');

    const badgeUnused = cardUnused.querySelector('.theme-editor-affected-badge');
    expect(badgeUnused).toBeNull();

    // Hover cardPrimary -> triggers highlight
    cardPrimary.dispatchEvent({ type: 'mouseenter' });
    const boxes = overlay.shadow.querySelectorAll('.theme-editor-highlight-box');
    expect(boxes.length).toBe(1);

    // Mouseleave -> clears highlights
    cardPrimary.dispatchEvent({ type: 'mouseleave' });
    expect(overlay.shadow.querySelectorAll('.theme-editor-highlight-box').length).toBe(0);
  });

  it('toggles picker mode and opens inspector drawer view when an element is picked', async () => {
    const target = createMockElement('button');
    target.style.color = '#3b82f6';
    target.style.borderRadius = '8px';
    dom.mockDocument.body.appendChild(target);

    const overlay = new ThemeEditorOverlay();
    overlay.connectedCallback();
    await (overlay as any).loadScanData();

    const pickerBtn = (overlay as any).pickerBtnEl;
    expect(pickerBtn).toBeDefined();

    // Toggle picker on
    pickerBtn.dispatchEvent({ type: 'click' });
    expect((overlay as any).isInspectorActive).toBe(true);
    expect(pickerBtn.classList.contains('is-active')).toBe(true);

    // Pick element
    (overlay as any).onElementPicked(target, (overlay as any).inspector.extractStyles(target));

    expect((overlay as any).isInspectorActive).toBe(false);
    expect(pickerBtn.classList.contains('is-active')).toBe(false);
    expect(overlay.isOpen).toBe(true);

    const panel = (overlay as any).inspectorPanelEl;
    expect(panel.style.display).not.toBe('none');
    expect(panel.querySelector('.theme-editor-inspector-element-tag').textContent).toBe('button');

    // Back button restores list view
    const backBtn = panel.querySelector('.theme-editor-inspector-back-btn');
    backBtn.dispatchEvent({ type: 'click' });
    expect(panel.style.display).toBe('none');
  });

  it('allows binding inspected property to an existing variable and extracting to a new staged variable', async () => {
    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        files: [
          {
            filePath: '/root/src/theme.css',
            relativePath: 'src/theme.css',
            rootSelectors: [':root'],
            variables: [
              { name: '--color-primary', value: '#3b82f6', inferredType: 'color', selector: ':root' }
            ]
          }
        ]
      })
    });

    const target = createMockElement('div');
    target.style.color = 'rgb(59, 130, 246)';
    target.style.borderRadius = '12px';
    dom.mockDocument.body.appendChild(target);

    const overlay = new ThemeEditorOverlay();
    overlay.connectedCallback();
    await (overlay as any).loadScanData();

    overlay.showInspectorView(target);
    const panel = (overlay as any).inspectorPanelEl;

    // 1. Bind color to --color-primary
    const colorItem = panel.querySelector('[data-property="color"]');
    const bindSelect = colorItem.querySelector('.theme-editor-inspector-bind-select');
    bindSelect.value = '--color-primary';
    bindSelect.dispatchEvent({ type: 'change' });

    expect(target.style.color).toBe('var(--color-primary)');

    // 2. Extract borderRadius to new variable
    const radiusItem = panel.querySelector('[data-property="borderRadius"]');
    const extractBtn = radiusItem.querySelector('.theme-editor-inspector-extract-btn');
    extractBtn.dispatchEvent({ type: 'click' });

    const form = radiusItem.querySelector('.theme-editor-inspector-extract-form');
    expect(form).toBeDefined();

    const nameInput = form.querySelector('.theme-editor-var-name-input');
    nameInput.value = '--card-radius';
    const stageBtn = form.querySelector('.theme-editor-stage-var-btn');
    stageBtn.dispatchEvent({ type: 'click' });

    expect(overlay.stagedNewVariables['/root/src/theme.css']).toHaveLength(1);
    expect(overlay.stagedNewVariables['/root/src/theme.css'][0]).toEqual({
      selector: ':root',
      name: '--card-radius',
      value: '12px'
    });
    expect(overlay.getStagedCount('/root/src/theme.css')).toBe(1);
    expect(dom.rootStyle['--card-radius']).toBe('12px');
  });

  it('includes staged newVariables in diff and save API requests', async () => {
    let diffRequestBody: any = null;
    let saveRequestBody: any = null;

    (global as any).fetch = vi.fn((url: string, opts?: any) => {
      if (url === '/__theme_editor/api/scan') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            files: [
              {
                filePath: '/root/src/theme.css',
                relativePath: 'src/theme.css',
                rootSelectors: [':root'],
                variables: [{ name: '--color-primary', value: '#3b82f6', inferredType: 'color', selector: ':root' }]
              }
            ]
          })
        });
      }
      if (url === '/__theme_editor/api/diff') {
        diffRequestBody = JSON.parse(opts.body);
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            diff: {
              filePath: '/root/src/theme.css',
              original: '',
              modified: '',
              unifiedDiff: '+  --new-var: 10px;',
              changesCount: 1
            }
          })
        });
      }
      if (url === '/__theme_editor/api/save') {
        saveRequestBody = JSON.parse(opts.body);
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, message: 'Saved' })
        });
      }
      return Promise.reject(new Error(`Unexpected url: ${url}`));
    });

    const overlay = new ThemeEditorOverlay();
    overlay.connectedCallback();
    await (overlay as any).loadScanData();

    overlay.stageNewVariable({
      selector: ':root',
      name: '--new-var',
      value: '10px'
    });

    // Diff request includes newVariables
    await overlay.openDiffModal();
    expect(diffRequestBody).toBeDefined();
    expect(diffRequestBody.newVariables).toEqual([
      { selector: ':root', name: '--new-var', value: '10px' }
    ]);

    // Save request includes newVariables
    await overlay.saveChanges();
    expect(saveRequestBody).toBeDefined();
    expect(saveRequestBody.newVariables).toEqual([
      { selector: ':root', name: '--new-var', value: '10px' }
    ]);
    expect(overlay.stagedNewVariables['/root/src/theme.css']).toEqual([]);
    expect(overlay.originalValues['/root/src/theme.css']['--new-var']).toBe('10px');
  });

  it('resets selectedSelector to all if new file does not contain active selector when switching files', async () => {
    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        files: [
          {
            filePath: '/root/src/theme1.css',
            relativePath: 'src/theme1.css',
            rootSelectors: [':root', '[data-theme="dark"]'],
            variables: [
              { name: '--color-primary', value: '#3b82f6', inferredType: 'color', selector: ':root' },
              { name: '--color-dark', value: '#111', inferredType: 'color', selector: '[data-theme="dark"]' }
            ]
          },
          {
            filePath: '/root/src/theme2.css',
            relativePath: 'src/theme2.css',
            rootSelectors: [':root'],
            variables: [
              { name: '--color-base', value: '#fff', inferredType: 'color', selector: ':root' }
            ]
          }
        ]
      })
    });

    const overlay = new ThemeEditorOverlay();
    overlay.connectedCallback();
    await (overlay as any).loadScanData();

    overlay.selectedSelector = '[data-theme="dark"]';
    expect(overlay.selectedSelector).toBe('[data-theme="dark"]');

    // Switch to theme2.css which lacks '[data-theme="dark"]'
    overlay.setSelectedFile('/root/src/theme2.css');
    expect(overlay.selectedSelector).toBe('all');
  });

  it('cleans up scopedOverrides and ephemeral style element when resetting scoped variables', async () => {
    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        files: [
          {
            filePath: '/root/src/theme.css',
            relativePath: 'src/theme.css',
            rootSelectors: [':root', '[data-theme="dark"]'],
            variables: [
              { name: '--color-dark-bg', value: '#111827', inferredType: 'color', selector: '[data-theme="dark"]' }
            ]
          }
        ]
      })
    });

    const overlay = new ThemeEditorOverlay();
    overlay.connectedCallback();
    await (overlay as any).loadScanData();

    overlay.updateVariable('--color-dark-bg', '#000000');
    expect((overlay as any).scopedOverrides['[data-theme="dark"]']).toBeDefined();

    overlay.resetVariable('--color-dark-bg');
    expect((overlay as any).scopedOverrides['[data-theme="dark"]']).toBeUndefined();

    const styleEl = dom.mockDocument.getElementById('__theme_editor_overrides');
    expect(!styleEl || styleEl.textContent === '').toBe(true);
  });

  it('only cleans up scopedOverrides for the target file in resetAll', async () => {
    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        files: [
          {
            filePath: '/root/src/theme1.css',
            relativePath: 'src/theme1.css',
            rootSelectors: ['[data-theme="dark"]'],
            variables: [
              { name: '--dark-1', value: '#111', inferredType: 'color', selector: '[data-theme="dark"]' }
            ]
          },
          {
            filePath: '/root/src/theme2.css',
            relativePath: 'src/theme2.css',
            rootSelectors: ['[data-theme="neon"]'],
            variables: [
              { name: '--neon-1', value: '#0f0', inferredType: 'color', selector: '[data-theme="neon"]' }
            ]
          }
        ]
      })
    });

    const overlay = new ThemeEditorOverlay();
    overlay.connectedCallback();
    await (overlay as any).loadScanData();

    // Stage changes in theme1.css
    overlay.setSelectedFile('/root/src/theme1.css');
    overlay.updateVariable('--dark-1', '#000');

    // Stage changes in theme2.css
    overlay.setSelectedFile('/root/src/theme2.css');
    overlay.updateVariable('--neon-1', '#0ff');

    expect((overlay as any).scopedOverrides['[data-theme="dark"]']).toBeDefined();
    expect((overlay as any).scopedOverrides['[data-theme="neon"]']).toBeDefined();

    // Reset only theme1.css
    overlay.resetAll('/root/src/theme1.css');
    expect((overlay as any).scopedOverrides['[data-theme="dark"]']).toBeUndefined();
    expect((overlay as any).scopedOverrides['[data-theme="neon"]']).toBeDefined();
    expect((overlay as any).scopedOverrides['[data-theme="neon"]']['--neon-1']).toBe('#0ff');
  });

  it('sets data-selector on variable cards and targets specific card in updateItemModifiedState', async () => {
    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        files: [
          {
            filePath: '/root/src/theme.css',
            relativePath: 'src/theme.css',
            rootSelectors: [':root', '[data-theme="dark"]'],
            variables: [
              { name: '--primary', value: '#3b82f6', inferredType: 'color', selector: ':root' },
              { name: '--primary', value: '#1d4ed8', inferredType: 'color', selector: '[data-theme="dark"]' }
            ]
          }
        ]
      })
    });

    const overlay = new ThemeEditorOverlay();
    overlay.connectedCallback();
    await (overlay as any).loadScanData();

    const rootCard = (overlay as any).listContainerEl.querySelector('[data-variable-name="--primary"][data-selector=":root"]');
    const darkCard = (overlay as any).listContainerEl.querySelector('[data-variable-name="--primary"][data-selector="[data-theme=\\"dark\\"]"]');

    expect(rootCard).toBeDefined();
    expect(darkCard).toBeDefined();

    // Update only the dark card variable
    overlay.updateVariable('--primary', '#9333ea', '[data-theme="dark"]');

    expect(darkCard.classList.contains('is-modified')).toBe(true);
    expect(rootCard.classList.contains('is-modified')).toBe(false);
  });

  it('removes __theme_editor_overrides style tag on disconnectedCallback', async () => {
    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        files: [
          {
            filePath: '/root/src/theme.css',
            relativePath: 'src/theme.css',
            rootSelectors: ['[data-theme="dark"]'],
            variables: [
              { name: '--color-dark-bg', value: '#111827', inferredType: 'color', selector: '[data-theme="dark"]' }
            ]
          }
        ]
      })
    });

    const overlay = new ThemeEditorOverlay();
    overlay.connectedCallback();
    await (overlay as any).loadScanData();

    overlay.updateVariable('--color-dark-bg', '#000000');
    expect(dom.mockDocument.getElementById('__theme_editor_overrides')).toBeDefined();

    overlay.disconnectedCallback();
    expect(dom.mockDocument.getElementById('__theme_editor_overrides')).toBeNull();
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

describe('DomInspector', () => {
  let dom: ReturnType<typeof setupGlobalDomMocks>;
  let inspector: DomInspector;

  beforeEach(() => {
    dom = setupGlobalDomMocks();
    inspector = new DomInspector();
  });

  describe('extractStyles', () => {
    it('extracts all 9 standard style properties with correct categories', () => {
      const el = createMockElement('div');
      el.style.color = 'rgb(255, 0, 0)';
      el.style.backgroundColor = 'rgb(240, 240, 240)';
      el.style.borderColor = 'rgb(59, 130, 246)';
      el.style.borderRadius = '8px';
      el.style.fontSize = '16px';
      el.style.fontFamily = 'Inter, sans-serif';
      el.style.padding = '12px 16px';
      el.style.margin = '0px';
      el.style.gap = '8px';

      const styles = inspector.extractStyles(el);

      expect(styles.color).toEqual({
        property: 'color',
        value: 'rgb(255, 0, 0)',
        category: 'color'
      });
      expect(styles.backgroundColor).toEqual({
        property: 'backgroundColor',
        value: 'rgb(240, 240, 240)',
        category: 'color'
      });
      expect(styles.borderColor).toEqual({
        property: 'borderColor',
        value: 'rgb(59, 130, 246)',
        category: 'color'
      });
      expect(styles.borderRadius).toEqual({
        property: 'borderRadius',
        value: '8px',
        category: 'dimension'
      });
      expect(styles.fontSize).toEqual({
        property: 'fontSize',
        value: '16px',
        category: 'dimension'
      });
      expect(styles.fontFamily).toEqual({
        property: 'fontFamily',
        value: 'Inter, sans-serif',
        category: 'font'
      });
      expect(styles.padding).toEqual({
        property: 'padding',
        value: '12px 16px',
        category: 'dimension'
      });
      expect(styles.margin).toEqual({
        property: 'margin',
        value: '0px',
        category: 'dimension'
      });
      expect(styles.gap).toEqual({
        property: 'gap',
        value: '8px',
        category: 'dimension'
      });
    });

    it('handles empty or missing computed style properties gracefully', () => {
      const el = createMockElement('span');
      const styles = inspector.extractStyles(el);
      expect(styles.color).toBeDefined();
      expect(styles.color.value).toBe('');
      expect(styles.color.category).toBe('color');
      expect(styles.borderRadius.category).toBe('dimension');
      expect(styles.fontFamily.category).toBe('font');
    });
  });

  describe('findAffectedElements', () => {
    it('finds elements referencing variable in inline style attribute or property', () => {
      const container = createMockElement('div');
      const child1 = createMockElement('button');
      child1.setAttribute('style', 'color: var(--primary);');
      const child2 = createMockElement('p');
      child2.style.setProperty('background-color', 'var(--primary)');
      const child3 = createMockElement('span');
      child3.style.color = '#000';

      container.appendChild(child1);
      container.appendChild(child2);
      container.appendChild(child3);
      dom.mockDocument.body.appendChild(container);

      const affected = inspector.findAffectedElements('--primary');
      expect(affected).toContain(child1);
      expect(affected).toContain(child2);
      expect(affected).not.toContain(child3);
    });

    it('normalizes variable name without -- prefix', () => {
      const el = createMockElement('div');
      el.setAttribute('style', 'border-color: var(--card-border);');
      dom.mockDocument.body.appendChild(el);

      const affected = inspector.findAffectedElements('card-border');
      expect(affected).toContain(el);
    });

    it('finds elements defining inline custom property declaration', () => {
      const el = createMockElement('div');
      el.style.setProperty('--accent', '#3b82f6');
      dom.mockDocument.body.appendChild(el);

      const affected = inspector.findAffectedElements('--accent');
      expect(affected).toContain(el);
    });

    it('finds elements matching stylesheet rules referencing the variable', () => {
      const header = createMockElement('header');
      header.classList.add('site-header');
      dom.mockDocument.body.appendChild(header);

      // Mock stylesheet rule
      dom.mockDocument.styleSheets.push({
        cssRules: [
          {
            type: 1,
            selectorText: '.site-header',
            cssText: '.site-header { background: var(--header-bg); }'
          }
        ]
      });

      const affected = inspector.findAffectedElements('--header-bg');
      expect(affected).toContain(header);
    });

    it('excludes elements inside or part of <theme-editor-overlay>', () => {
      const overlay = createMockElement('theme-editor-overlay');
      const inner = createMockElement('div');
      inner.setAttribute('style', 'color: var(--primary);');
      overlay.appendChild(inner);
      dom.mockDocument.body.appendChild(overlay);

      const affected = inspector.findAffectedElements('--primary');
      expect(affected).not.toContain(overlay);
      expect(affected).not.toContain(inner);
    });

    it('does not produce false-positive matches for bare property names or substring variables', () => {
      const el1 = createMockElement('div');
      el1.setAttribute('style', 'color: red; background-color: blue;');
      const el2 = createMockElement('div');
      el2.setAttribute('style', 'color: var(--primary-dark);');
      const el3 = createMockElement('div');
      el3.setAttribute('style', 'color: var(--primary);');

      dom.mockDocument.body.appendChild(el1);
      dom.mockDocument.body.appendChild(el2);
      dom.mockDocument.body.appendChild(el3);

      // Searching for 'color' should not match el1 just because it has standard 'color: red'
      const affectedColor = inspector.findAffectedElements('color');
      expect(affectedColor).not.toContain(el1);

      // Searching for '--primary' should match el3, but NOT el2 (--primary-dark)
      const affectedPrimary = inspector.findAffectedElements('--primary');
      expect(affectedPrimary).toContain(el3);
      expect(affectedPrimary).not.toContain(el2);
    });
  });

  describe('highlightElements and clearHighlights', () => {
    it('creates floating highlight box elements for matched elements with label badges', () => {
      const target = createMockElement('button');
      dom.mockDocument.body.appendChild(target);

      inspector.highlightElements([target], '--primary');

      const boxes = dom.mockDocument.body.querySelectorAll('.theme-editor-highlight-box');
      expect(boxes.length).toBe(1);
      expect(boxes[0].className).toContain('theme-editor-highlight-box');
      expect(boxes[0].style.position).toBe('fixed');
      expect(boxes[0].style.top).toBe('10px');
      expect(boxes[0].style.left).toBe('20px');
      expect(boxes[0].style.width).toBe('100px');
      expect(boxes[0].style.height).toBe('50px');

      const badge = boxes[0].querySelector('.theme-editor-highlight-badge');
      expect(badge).toBeDefined();
      expect(badge.textContent).toBe('--primary');
    });

    it('clears all active highlight boxes on clearHighlights', () => {
      const target1 = createMockElement('div');
      const target2 = createMockElement('div');
      dom.mockDocument.body.appendChild(target1);
      dom.mockDocument.body.appendChild(target2);

      inspector.highlightElements([target1, target2], 'test');
      expect(dom.mockDocument.body.querySelectorAll('.theme-editor-highlight-box').length).toBe(2);

      inspector.clearHighlights();
      expect(dom.mockDocument.body.querySelectorAll('.theme-editor-highlight-box').length).toBe(0);
    });

    it('skips elements that are theme editor overlays', () => {
      const overlay = createMockElement('theme-editor-overlay');
      inspector.highlightElements([overlay]);
      expect(dom.mockDocument.body.querySelectorAll('.theme-editor-highlight-box').length).toBe(0);
    });

    it('cleans up highlights even when attached to a ShadowRoot with parentNode', () => {
      const shadowMock = createMockElement('shadow-root');
      const target = createMockElement('button');
      dom.mockDocument.body.appendChild(target);

      const shadowInspector = new DomInspector(shadowMock);
      shadowInspector.highlightElements([target]);

      const boxes = shadowMock.querySelectorAll('.theme-editor-highlight-box');
      expect(boxes.length).toBe(1);

      shadowInspector.clearHighlights();
      expect(shadowMock.querySelectorAll('.theme-editor-highlight-box').length).toBe(0);
    });
  });

  describe('enablePicker and disablePicker', () => {
    it('attaches mouse and keyboard listeners, and sets cursor', () => {
      inspector.enablePicker(() => {});
      expect(inspector.isPickerActive).toBe(true);
      expect(dom.mockDocument.body.style.cursor).toBe('crosshair');

      inspector.disablePicker();
      expect(inspector.isPickerActive).toBe(false);
      expect(dom.mockDocument.body.style.cursor).toBe('');
    });

    it('disables picker and clears highlights on Escape key', () => {
      inspector.enablePicker(() => {});
      expect(inspector.isPickerActive).toBe(true);

      dom.mockDocument.dispatchEvent({ type: 'keydown', key: 'Escape' });
      expect(inspector.isPickerActive).toBe(false);
    });

    it('invokes onSelect on click with element and extracted styles, then disables picker', () => {
      const onSelect = vi.fn();
      const target = createMockElement('button');
      target.style.color = '#3b82f6';
      dom.mockDocument.body.appendChild(target);

      dom.mockDocument.elementsFromPoint = vi.fn().mockReturnValue([target]);
      dom.mockDocument.elementFromPoint = vi.fn().mockReturnValue(target);

      inspector.enablePicker(onSelect);

      // Simulate mousemove to trigger highlight
      dom.mockDocument.dispatchEvent({
        type: 'mousemove',
        clientX: 50,
        clientY: 50,
        target
      });
      expect(dom.mockDocument.body.querySelectorAll('.theme-editor-highlight-box').length).toBe(1);

      // Simulate click to select element
      const clickEvent = {
        type: 'click',
        clientX: 50,
        clientY: 50,
        target,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn()
      };
      dom.mockDocument.dispatchEvent(clickEvent);

      expect(clickEvent.preventDefault).toHaveBeenCalled();
      expect(clickEvent.stopPropagation).toHaveBeenCalled();
      expect(onSelect).toHaveBeenCalledWith(
        target,
        expect.objectContaining({
          color: expect.objectContaining({ value: '#3b82f6', category: 'color' })
        })
      );
      expect(inspector.isPickerActive).toBe(false);
    });

    it('does not intercept clicks or trigger selection on overlay elements', () => {
      const onSelect = vi.fn();
      inspector.enablePicker(onSelect);

      const overlay = createMockElement('theme-editor-overlay');
      const button = createMockElement('button');
      overlay.appendChild(button);
      dom.mockDocument.body.appendChild(overlay);

      const clickEvent = {
        type: 'click',
        clientX: 100,
        clientY: 100,
        target: button,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        composedPath: vi.fn().mockReturnValue([button, overlay, dom.mockDocument.body])
      };

      dom.mockDocument.dispatchEvent(clickEvent);

      expect(clickEvent.preventDefault).not.toHaveBeenCalled();
      expect(clickEvent.stopPropagation).not.toHaveBeenCalled();
      expect(onSelect).not.toHaveBeenCalled();
      expect(inspector.isPickerActive).toBe(true);
    });

    it('does not penetrate through overlay elements in getElementAtPoint', () => {
      const overlay = createMockElement('theme-editor-overlay');
      const underlyingElement = createMockElement('div');
      dom.mockDocument.body.appendChild(underlyingElement);
      dom.mockDocument.body.appendChild(overlay);

      dom.mockDocument.elementsFromPoint = vi.fn().mockReturnValue([overlay, underlyingElement]);

      inspector.enablePicker(() => {});

      // Mouse movement over overlay should not highlight underlying element
      dom.mockDocument.dispatchEvent({
        type: 'mousemove',
        clientX: 100,
        clientY: 100,
        target: overlay
      });

      expect(dom.mockDocument.body.querySelectorAll('.theme-editor-highlight-box').length).toBe(0);
    });
  });
});
