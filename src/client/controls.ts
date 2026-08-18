import type { ThemeVariable, VariableType } from '../types';

export function parseDimension(value: string): { num: number; unit: string } {
  const trimmed = value.trim();
  const match = trimmed.match(/^(-?\d*\.?\d+)\s*(px|rem|em|%|vh|vw|pt|vmin|vmax|ch|ex)?$/i);
  if (match) {
    const num = parseFloat(match[1]);
    const unit = match[2] || 'px';
    return { num, unit };
  }
  return { num: 0, unit: '' };
}

export function getDimensionConfig(unit: string, num: number = 0): { min: number; max: number; step: number } {
  const isNegative = num < 0;
  const absNum = Math.abs(num);

  if (unit === 'rem' || unit === 'em') {
    return {
      min: isNegative ? -Math.max(10, Math.ceil(absNum * 1.5)) : 0,
      max: Math.max(8, Math.ceil(absNum * 1.5)),
      step: 0.05
    };
  }

  if (unit === '%' || unit === 'vh' || unit === 'vw' || unit === 'vmin' || unit === 'vmax') {
    return {
      min: isNegative ? -100 : 0,
      max: 100,
      step: 1
    };
  }

  if (unit === 'pt') {
    return {
      min: isNegative ? -Math.max(72, Math.ceil(absNum * 1.5)) : 0,
      max: Math.max(72, Math.ceil(absNum * 1.5)),
      step: 1
    };
  }

  // Default px and others
  return {
    min: isNegative ? -Math.max(100, Math.ceil(absNum * 1.5)) : 0,
    max: Math.max(120, Math.ceil(absNum * 1.5)),
    step: 1
  };
}

export function colorToHex(color: string): string {
  const trimmed = color.trim().toLowerCase();

  // Named color fallbacks
  const namedColors: Record<string, string> = {
    black: '#000000',
    white: '#ffffff',
    red: '#ff0000',
    green: '#008000',
    blue: '#0000ff',
    yellow: '#ffff00',
    cyan: '#00ffff',
    magenta: '#ff00ff',
    gray: '#808080',
    grey: '#808080',
    transparent: '#000000'
  };

  if (namedColors[trimmed]) {
    return namedColors[trimmed];
  }

  // #RGB or #RGBA
  if (/^#[0-9a-f]{3,4}$/i.test(trimmed)) {
    const r = trimmed[1];
    const g = trimmed[2];
    const b = trimmed[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }

  // #RRGGBB or #RRGGBBAA
  if (/^#[0-9a-f]{6,8}$/i.test(trimmed)) {
    return trimmed.slice(0, 7);
  }

  // rgb(r, g, b) or rgba(r, g, b, a)
  const rgbMatch = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    const r = Math.min(255, Math.max(0, parseInt(rgbMatch[1], 10)));
    const g = Math.min(255, Math.max(0, parseInt(rgbMatch[2], 10)));
    const b = Math.min(255, Math.max(0, parseInt(rgbMatch[3], 10)));
    const toHex = (n: number) => n.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  // hsl(h, s%, l%) or hsla(h, s%, l%, a)
  const hslMatch = trimmed.match(/^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/i);
  if (hslMatch) {
    const h = parseFloat(hslMatch[1]) / 360;
    const s = parseFloat(hslMatch[2]) / 100;
    const l = parseFloat(hslMatch[3]) / 100;

    let r: number, g: number, b: number;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  return '#3b82f6';
}

export function createColorControl(
  variable: ThemeVariable,
  currentValue: string,
  onChange: (value: string) => void
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'theme-editor-color-control';

  const swatchWrap = document.createElement('div');
  swatchWrap.className = 'theme-editor-color-swatch-wrap';

  const swatchPreview = document.createElement('div');
  swatchPreview.className = 'theme-editor-color-swatch-preview';
  swatchPreview.style.backgroundColor = currentValue;

  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.className = 'theme-editor-color-picker-input';
  colorInput.value = colorToHex(currentValue);

  swatchWrap.appendChild(swatchPreview);
  swatchWrap.appendChild(colorInput);

  const textInput = document.createElement('input');
  textInput.type = 'text';
  textInput.className = 'theme-editor-input-text';
  textInput.value = currentValue;
  textInput.placeholder = variable.value;

  colorInput.addEventListener('input', (e) => {
    const val = (e.target as HTMLInputElement).value;
    textInput.value = val;
    swatchPreview.style.backgroundColor = val;
    onChange(val);
  });

  textInput.addEventListener('input', (e) => {
    const val = (e.target as HTMLInputElement).value;
    swatchPreview.style.backgroundColor = val;
    try {
      const hex = colorToHex(val);
      if (hex) {
        colorInput.value = hex;
      }
    } catch {
      // Ignore conversion error during typing
    }
    onChange(val);
  });

  container.appendChild(swatchWrap);
  container.appendChild(textInput);

  return container;
}

export function createDimensionControl(
  variable: ThemeVariable,
  currentValue: string,
  onChange: (value: string) => void
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'theme-editor-dimension-control';

  const parsed = parseDimension(currentValue);
  const isValidDimension = parsed.unit !== '' || !isNaN(parsed.num);

  if (!isValidDimension) {
    return createRawControl(variable, currentValue, onChange);
  }

  const { num, unit } = parsed;
  const config = getDimensionConfig(unit, num);

  const row = document.createElement('div');
  row.className = 'theme-editor-dimension-row';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'theme-editor-slider';
  slider.min = String(config.min);
  slider.max = String(config.max);
  slider.step = String(config.step);
  slider.value = String(num);

  const inputWrap = document.createElement('div');
  inputWrap.className = 'theme-editor-dimension-input-wrap';

  const numInput = document.createElement('input');
  numInput.type = 'number';
  numInput.className = 'theme-editor-dimension-num-input';
  numInput.step = String(config.step);
  numInput.value = String(num);

  const unitBadge = document.createElement('span');
  unitBadge.className = 'theme-editor-dimension-unit-badge';
  unitBadge.textContent = unit || 'px';

  inputWrap.appendChild(numInput);
  inputWrap.appendChild(unitBadge);

  const update = (newNum: number) => {
    const formatted = `${newNum}${unit}`;
    slider.value = String(newNum);
    numInput.value = String(newNum);
    onChange(formatted);
  };

  slider.addEventListener('input', (e) => {
    const val = parseFloat((e.target as HTMLInputElement).value);
    update(val);
  });

  numInput.addEventListener('input', (e) => {
    const val = parseFloat((e.target as HTMLInputElement).value);
    if (!isNaN(val)) {
      if (val > parseFloat(slider.max)) {
        slider.max = String(Math.ceil(val * 1.5));
      }
      if (val < parseFloat(slider.min)) {
        slider.min = String(Math.floor(val * 1.5));
      }
      slider.value = String(val);
      onChange(`${val}${unit}`);
    }
  });

  row.appendChild(slider);
  row.appendChild(inputWrap);
  container.appendChild(row);

  return container;
}

export function createFontControl(
  variable: ThemeVariable,
  currentValue: string,
  onChange: (value: string) => void
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'theme-editor-font-control';

  const textInput = document.createElement('input');
  textInput.type = 'text';
  textInput.className = 'theme-editor-input-text';
  textInput.value = currentValue;
  textInput.placeholder = variable.value || 'e.g. sans-serif';

  const preview = document.createElement('div');
  preview.className = 'theme-editor-font-preview';
  preview.textContent = 'Aa Bb Gg 123 (Font Preview)';
  preview.style.fontFamily = currentValue;

  textInput.addEventListener('input', (e) => {
    const val = (e.target as HTMLInputElement).value;
    preview.style.fontFamily = val;
    onChange(val);
  });

  container.appendChild(textInput);
  container.appendChild(preview);

  return container;
}

export function createRawControl(
  variable: ThemeVariable,
  currentValue: string,
  onChange: (value: string) => void
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'theme-editor-control-body';

  const textInput = document.createElement('input');
  textInput.type = 'text';
  textInput.className = 'theme-editor-input-text';
  textInput.value = currentValue;
  textInput.placeholder = variable.value;

  textInput.addEventListener('input', (e) => {
    const val = (e.target as HTMLInputElement).value;
    onChange(val);
  });

  container.appendChild(textInput);

  return container;
}

export function createControl(
  variable: ThemeVariable,
  currentValue: string,
  onChange: (value: string) => void
): HTMLElement {
  switch (variable.inferredType) {
    case 'color':
      return createColorControl(variable, currentValue, onChange);
    case 'dimension':
      return createDimensionControl(variable, currentValue, onChange);
    case 'font':
      return createFontControl(variable, currentValue, onChange);
    case 'raw':
    default:
      return createRawControl(variable, currentValue, onChange);
  }
}
