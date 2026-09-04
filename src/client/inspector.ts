import type { VariableType } from '../types';

export interface ExtractedStyle {
  property: string;
  value: string;
  category: VariableType;
}

export type ExtractedStyles = Record<string, ExtractedStyle>;

export const INSPECTED_PROPERTIES: Array<{
  property: string;
  cssProperty: string;
  category: VariableType;
}> = [
  { property: 'color', cssProperty: 'color', category: 'color' },
  { property: 'backgroundColor', cssProperty: 'background-color', category: 'color' },
  { property: 'borderColor', cssProperty: 'border-color', category: 'color' },
  { property: 'borderRadius', cssProperty: 'border-radius', category: 'dimension' },
  { property: 'fontSize', cssProperty: 'font-size', category: 'dimension' },
  { property: 'fontFamily', cssProperty: 'font-family', category: 'font' },
  { property: 'padding', cssProperty: 'padding', category: 'dimension' },
  { property: 'margin', cssProperty: 'margin', category: 'dimension' },
  { property: 'gap', cssProperty: 'gap', category: 'dimension' }
];

export function isOverlayElement(el: Element | null | undefined): boolean {
  if (!el) return true;
  if (el.tagName && el.tagName.toLowerCase() === 'theme-editor-overlay') return true;

  const classList = (el as any).classList;
  if (classList && typeof classList.contains === 'function') {
    if (
      classList.contains('theme-editor-highlight-box') ||
      classList.contains('theme-editor-highlight-container') ||
      classList.contains('theme-editor-drawer') ||
      classList.contains('theme-editor-trigger') ||
      classList.contains('theme-editor-modal-backdrop') ||
      classList.contains('theme-editor-toast-container')
    ) {
      return true;
    }
  }

  if (typeof el.closest === 'function') {
    try {
      if (el.closest('theme-editor-overlay')) return true;
      if (el.closest('.theme-editor-highlight-container')) return true;
      if (el.closest('.theme-editor-highlight-box')) return true;
    } catch {
      // Ignore selector errors
    }
  }

  if (typeof (el as any).getRootNode === 'function') {
    try {
      const root = (el as any).getRootNode();
      if (root && root.host && root.host.tagName && root.host.tagName.toLowerCase() === 'theme-editor-overlay') {
        return true;
      }
    } catch {
      // Ignore root traversal errors
    }
  }

  return false;
}

export function getAllDocumentElements(): Element[] {
  if (typeof document === 'undefined') return [];

  const results: Element[] = [];
  const seen = new Set<Element>();

  const add = (node: Element) => {
    if (node && !seen.has(node)) {
      seen.add(node);
      results.push(node);
    }
  };

  if (typeof document.querySelectorAll === 'function') {
    try {
      const queried = document.querySelectorAll('*');
      if (queried && queried.length > 0) {
        for (let i = 0; i < queried.length; i++) {
          add(queried[i]);
        }
      }
    } catch {
      // Ignore and fallback
    }
  }

  const root = document.documentElement || document.body;
  if (root) {
    const traverse = (node: any) => {
      if (!node) return;
      add(node);
      if (node.children) {
        for (let i = 0; i < node.children.length; i++) {
          traverse(node.children[i]);
        }
      }
    };
    traverse(root);
  }

  return results.filter(el => !isOverlayElement(el));
}

function extractPropertyValue(
  computed: any,
  el: any,
  item: typeof INSPECTED_PROPERTIES[0]
): string {
  let val = '';

  if (computed) {
    if (typeof computed.getPropertyValue === 'function') {
      try {
        val = computed.getPropertyValue(item.cssProperty) || '';
      } catch {}
    }
    if (!val && computed[item.property] !== undefined && typeof computed[item.property] !== 'function') {
      val = String(computed[item.property]);
    }
    if (!val && computed[item.cssProperty] !== undefined && typeof computed[item.cssProperty] !== 'function') {
      val = String(computed[item.cssProperty]);
    }

    // Shorthand fallbacks if composite property returns empty
    if (!val) {
      if (item.property === 'borderColor') {
        val = computed.borderTopColor || (computed.getPropertyValue && computed.getPropertyValue('border-top-color')) || '';
      } else if (item.property === 'borderRadius') {
        val = computed.borderTopLeftRadius || (computed.getPropertyValue && computed.getPropertyValue('border-top-left-radius')) || '';
      } else if (item.property === 'padding') {
        const top = computed.paddingTop || (computed.getPropertyValue && computed.getPropertyValue('padding-top'));
        const right = computed.paddingRight || (computed.getPropertyValue && computed.getPropertyValue('padding-right'));
        const bottom = computed.paddingBottom || (computed.getPropertyValue && computed.getPropertyValue('padding-bottom'));
        const left = computed.paddingLeft || (computed.getPropertyValue && computed.getPropertyValue('padding-left'));
        if (top || right || bottom || left) {
          val = [top || '0px', right || '0px', bottom || '0px', left || '0px'].join(' ');
        }
      } else if (item.property === 'margin') {
        const top = computed.marginTop || (computed.getPropertyValue && computed.getPropertyValue('margin-top'));
        const right = computed.marginRight || (computed.getPropertyValue && computed.getPropertyValue('margin-right'));
        const bottom = computed.marginBottom || (computed.getPropertyValue && computed.getPropertyValue('margin-bottom'));
        const left = computed.marginLeft || (computed.getPropertyValue && computed.getPropertyValue('margin-left'));
        if (top || right || bottom || left) {
          val = [top || '0px', right || '0px', bottom || '0px', left || '0px'].join(' ');
        }
      } else if (item.property === 'gap') {
        val = computed.rowGap || computed.columnGap || (computed.getPropertyValue && (computed.getPropertyValue('row-gap') || computed.getPropertyValue('gap'))) || '';
      }
    }
  }

  // Fallback to inline style if computed style did not provide value
  if (!val && el && el.style) {
    if (typeof el.style.getPropertyValue === 'function') {
      try {
        val = el.style.getPropertyValue(item.cssProperty) || el.style.getPropertyValue(item.property) || '';
      } catch {}
    }
    if (!val && el.style[item.property] !== undefined && typeof el.style[item.property] !== 'function') {
      val = String(el.style[item.property]);
    }
    if (!val && el.style[item.cssProperty] !== undefined && typeof el.style[item.cssProperty] !== 'function') {
      val = String(el.style[item.cssProperty]);
    }
  }

  return val ? val.trim() : '';
}

export class DomInspector {
  public isPickerActive: boolean = false;
  private container: HTMLElement | ShadowRoot | null = null;
  private highlightBoxes: HTMLElement[] = [];
  private onSelectCallback: ((el: Element, styles: ExtractedStyles) => void) | null = null;

  constructor(container?: HTMLElement | ShadowRoot) {
    if (container) {
      this.container = container;
    }
  }

  public setContainer(container: HTMLElement | ShadowRoot | null): void {
    this.container = container;
  }

  private getContainer(): HTMLElement | ShadowRoot | null {
    if (this.container) {
      return this.container;
    }

    if (typeof document !== 'undefined') {
      const overlay = document.querySelector('theme-editor-overlay');
      if (overlay && (overlay as any).shadowRoot) {
        return (overlay as any).shadowRoot;
      }
      return document.body || document.documentElement || null;
    }

    return null;
  }

  public extractStyles(el: Element): ExtractedStyles {
    const computed =
      typeof window !== 'undefined' && typeof window.getComputedStyle === 'function'
        ? window.getComputedStyle(el)
        : ((el as any)?.style || {});

    const result: ExtractedStyles = {};

    for (const item of INSPECTED_PROPERTIES) {
      const val = extractPropertyValue(computed, el, item);
      result[item.property] = {
        property: item.property,
        value: val,
        category: item.category
      };
    }

    return result;
  }

  public findAffectedElements(varName: string): Element[] {
    if (!varName || typeof document === 'undefined') return [];

    const cleanName = varName.trim();
    const formattedVar = cleanName.startsWith('--') ? cleanName : `--${cleanName}`;
    const allElements = getAllDocumentElements();
    const matched = new Set<Element>();

    // 1. Check inline styles and attributes for each element
    for (const el of allElements) {
      const styleAttr = el.getAttribute?.('style') || '';
      if (styleAttr.includes(formattedVar) || styleAttr.includes(cleanName)) {
        matched.add(el);
        continue;
      }

      const inlineStyle = (el as any).style;
      if (inlineStyle) {
        if (typeof inlineStyle.getPropertyValue === 'function') {
          const directVal = inlineStyle.getPropertyValue(formattedVar);
          if (directVal) {
            matched.add(el);
            continue;
          }
        }

        const cssText = inlineStyle.cssText || '';
        if (cssText.includes(formattedVar) || cssText.includes(cleanName)) {
          matched.add(el);
          continue;
        }

        // Check if inline custom properties or object keys/values reference var
        for (const key of Object.keys(inlineStyle)) {
          if (key === formattedVar || key === cleanName) {
            matched.add(el);
            break;
          }
          const val = String(inlineStyle[key] || '');
          if (val.includes(formattedVar) || val.includes(cleanName)) {
            matched.add(el);
            break;
          }
        }
      }
    }

    // 2. Check stylesheet rules across document
    if (document.styleSheets) {
      const sheets = Array.from(document.styleSheets as any);
      for (const sheet of sheets) {
        try {
          const rules = (sheet as any).cssRules || (sheet as any).rules || [];
          for (let i = 0; i < rules.length; i++) {
            const rule = rules[i];
            const cssText = rule.cssText || '';
            if (cssText.includes(formattedVar) || cssText.includes(cleanName)) {
              const selector = rule.selectorText;
              if (selector) {
                for (const el of allElements) {
                  if (typeof (el as any).matches === 'function') {
                    try {
                      if ((el as any).matches(selector)) {
                        matched.add(el);
                      }
                    } catch {}
                  }
                }
              }
            }
          }
        } catch {
          // Ignore stylesheet access restrictions (e.g. CORS)
        }
      }
    }

    return Array.from(matched).filter(el => !isOverlayElement(el));
  }

  public highlightElements(elements: Element[], label?: string): void {
    this.clearHighlights();

    if (!elements || elements.length === 0) {
      return;
    }

    const container = this.getContainer();
    if (!container || typeof document === 'undefined') return;

    for (const el of elements) {
      if (isOverlayElement(el)) continue;

      const rect =
        typeof el.getBoundingClientRect === 'function'
          ? el.getBoundingClientRect()
          : { top: 0, left: 0, width: 0, height: 0 };

      const box = document.createElement('div') as HTMLElement;
      box.className = 'theme-editor-highlight-box';
      box.style.position = 'fixed';
      box.style.top = `${rect.top}px`;
      box.style.left = `${rect.left}px`;
      box.style.width = `${rect.width}px`;
      box.style.height = `${rect.height}px`;
      box.style.pointerEvents = 'none';
      box.style.zIndex = '999998';
      box.style.boxSizing = 'border-box';

      const badgeText = label !== undefined ? label : (el.tagName ? el.tagName.toLowerCase() : '');
      if (badgeText) {
        const badge = document.createElement('span') as HTMLElement;
        badge.className = 'theme-editor-highlight-badge';
        badge.textContent = badgeText;
        box.appendChild(badge);
      }

      container.appendChild(box);
      this.highlightBoxes.push(box);
    }
  }

  public clearHighlights(): void {
    for (const box of this.highlightBoxes) {
      if (box.parentElement) {
        box.parentElement.removeChild(box);
      } else if (typeof (box as any).remove === 'function') {
        (box as any).remove();
      }
    }
    this.highlightBoxes = [];
  }

  public enablePicker(onSelect: (el: Element, styles: ExtractedStyles) => void): void {
    this.disablePicker();
    this.isPickerActive = true;
    this.onSelectCallback = onSelect;

    if (typeof document === 'undefined') return;

    if (document.body && document.body.style) {
      document.body.style.cursor = 'crosshair';
    }

    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('click', this.handleClick, true);
    document.addEventListener('keydown', this.handleKeyDown);
  }

  public disablePicker(): void {
    if (!this.isPickerActive) return;

    this.isPickerActive = false;
    this.onSelectCallback = null;

    if (typeof document !== 'undefined') {
      if (document.body && document.body.style) {
        document.body.style.cursor = '';
      }
      document.removeEventListener('mousemove', this.handleMouseMove);
      document.removeEventListener('click', this.handleClick, true);
      document.removeEventListener('keydown', this.handleKeyDown);
    }

    this.clearHighlights();
  }

  private getElementAtPoint(x?: number, y?: number, fallbackTarget?: Element): Element | null {
    if (typeof document === 'undefined') return fallbackTarget || null;

    if (x !== undefined && y !== undefined) {
      if (typeof document.elementsFromPoint === 'function') {
        try {
          const elements = document.elementsFromPoint(x, y);
          for (const el of elements) {
            if (!isOverlayElement(el)) {
              return el;
            }
          }
        } catch {}
      }

      if (typeof document.elementFromPoint === 'function') {
        try {
          const el = document.elementFromPoint(x, y);
          if (el && !isOverlayElement(el)) {
            return el;
          }
        } catch {}
      }
    }

    if (fallbackTarget && !isOverlayElement(fallbackTarget)) {
      return fallbackTarget;
    }

    return null;
  }

  private handleMouseMove = (e: MouseEvent) => {
    if (!this.isPickerActive) return;

    const target = this.getElementAtPoint(e.clientX, e.clientY, e.target as Element);
    if (target && !isOverlayElement(target)) {
      const label = target.tagName ? target.tagName.toLowerCase() : '';
      this.highlightElements([target], label);
    } else {
      this.clearHighlights();
    }
  };

  private handleClick = (e: MouseEvent) => {
    if (!this.isPickerActive) return;

    if (typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    if (typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }

    const target = this.getElementAtPoint(e.clientX, e.clientY, e.target as Element);
    if (target && !isOverlayElement(target)) {
      const styles = this.extractStyles(target);
      const cb = this.onSelectCallback;
      this.disablePicker();
      if (cb) {
        cb(target, styles);
      }
    }
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      this.disablePicker();
    }
  };
}
