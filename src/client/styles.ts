export const OVERLAY_STYLES = `
:host {
  all: initial;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji';
  font-size: 13px;
  color: #f1f5f9;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  box-sizing: border-box;
}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* Floating Trigger Button */
.theme-editor-trigger {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 999990;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 9999px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(59, 130, 246, 0.4), 0 2px 6px rgba(0, 0, 0, 0.2);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
}

.theme-editor-trigger:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(59, 130, 246, 0.5), 0 3px 8px rgba(0, 0, 0, 0.3);
  filter: brightness(1.08);
}

.theme-editor-trigger:active {
  transform: translateY(0);
}

.theme-editor-trigger-icon {
  width: 16px;
  height: 16px;
  fill: currentColor;
}

.theme-editor-trigger-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  font-size: 11px;
  font-weight: 700;
  background: #f59e0b;
  color: #0f172a;
  border-radius: 9999px;
}

/* Drawer Container */
.theme-editor-drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 400px;
  max-width: calc(100vw - 20px);
  background: #0f172a;
  border-left: 1px solid #1e293b;
  z-index: 999992;
  display: flex;
  flex-direction: column;
  box-shadow: -8px 0 32px rgba(0, 0, 0, 0.5);
  transform: translateX(100%);
  transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
  pointer-events: none;
  visibility: hidden;
}

.theme-editor-drawer.is-open {
  transform: translateX(0);
  pointer-events: auto;
  visibility: visible;
}

/* Drawer Header */
.theme-editor-header {
  padding: 16px 20px;
  background: #090d16;
  border-bottom: 1px solid #1e293b;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.theme-editor-title-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.theme-editor-title {
  font-size: 15px;
  font-weight: 700;
  color: #f8fafc;
  letter-spacing: -0.01em;
}

.theme-editor-badge-pill {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.theme-editor-close-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  transition: all 0.15s ease;
}

.theme-editor-close-btn:hover {
  background: #1e293b;
  color: #f1f5f9;
}

/* File Selector Section */
.theme-editor-file-select-wrap {
  padding: 12px 20px 8px;
  background: #0f172a;
  border-bottom: 1px solid #1e293b;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.theme-editor-field-label {
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.theme-editor-select {
  width: 100%;
  padding: 7px 10px;
  background: #1e293b;
  color: #f1f5f9;
  border: 1px solid #334155;
  border-radius: 6px;
  font-size: 12px;
  font-family: inherit;
  outline: none;
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.theme-editor-select:focus {
  border-color: #3b82f6;
}

/* Toolbar: Search and Filter Tabs */
.theme-editor-toolbar {
  padding: 12px 20px;
  background: #0f172a;
  border-bottom: 1px solid #1e293b;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.theme-editor-search-box {
  position: relative;
  display: flex;
  align-items: center;
}

.theme-editor-search-input {
  width: 100%;
  padding: 7px 28px 7px 10px;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 6px;
  color: #f1f5f9;
  font-size: 12px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s ease;
}

.theme-editor-search-input:focus {
  border-color: #3b82f6;
}

.theme-editor-search-clear {
  position: absolute;
  right: 6px;
  background: transparent;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 2px 6px;
  font-size: 14px;
  line-height: 1;
}

.theme-editor-search-clear:hover {
  color: #f1f5f9;
}

.theme-editor-filter-tabs {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  scrollbar-width: none;
}

.theme-editor-filter-tabs::-webkit-scrollbar {
  display: none;
}

.theme-editor-tab-btn {
  background: #1e293b;
  border: 1px solid transparent;
  color: #94a3b8;
  padding: 4px 10px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  gap: 4px;
}

.theme-editor-tab-btn:hover {
  color: #f1f5f9;
  background: #273549;
}

.theme-editor-tab-btn.is-active {
  background: #3b82f6;
  color: #ffffff;
  font-weight: 600;
}

.theme-editor-tab-count {
  font-size: 10px;
  opacity: 0.8;
}

/* Variable List Container */
.theme-editor-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.theme-editor-list::-webkit-scrollbar {
  width: 6px;
}

.theme-editor-list::-webkit-scrollbar-track {
  background: #0f172a;
}

.theme-editor-list::-webkit-scrollbar-thumb {
  background: #1e293b;
  border-radius: 3px;
}

.theme-editor-list::-webkit-scrollbar-thumb:hover {
  background: #334155;
}

.theme-editor-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  color: #64748b;
  gap: 8px;
}

.theme-editor-empty-icon {
  font-size: 28px;
}

/* Variable Item Card */
.theme-editor-item {
  background: #141e33;
  border: 1px solid #1e293b;
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.theme-editor-item:hover {
  border-color: #334155;
}

.theme-editor-item.is-modified {
  border-color: rgba(245, 158, 11, 0.4);
  background: #182239;
}

.theme-editor-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.theme-editor-item-name-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
}

.theme-editor-item-name {
  font-family: 'JetBrains Mono', 'Fira Code', Menlo, monospace;
  font-size: 12px;
  font-weight: 600;
  color: #93c5fd;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  user-select: all;
}

.theme-editor-type-badge {
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  padding: 1px 5px;
  border-radius: 3px;
  letter-spacing: 0.04em;
}

.theme-editor-type-badge.color {
  background: rgba(236, 72, 153, 0.15);
  color: #f472b6;
  border: 1px solid rgba(236, 72, 153, 0.3);
}

.theme-editor-type-badge.dimension {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.theme-editor-type-badge.font {
  background: rgba(168, 85, 247, 0.15);
  color: #c084fc;
  border: 1px solid rgba(168, 85, 247, 0.3);
}

.theme-editor-type-badge.raw {
  background: rgba(148, 163, 184, 0.15);
  color: #94a3b8;
  border: 1px solid rgba(148, 163, 184, 0.3);
}

.theme-editor-item-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.theme-editor-reset-btn {
  background: transparent;
  border: none;
  color: #f59e0b;
  cursor: pointer;
  padding: 2px 6px;
  font-size: 12px;
  border-radius: 4px;
  opacity: 0.85;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  gap: 2px;
}

.theme-editor-reset-btn:hover {
  opacity: 1;
  background: rgba(245, 158, 11, 0.15);
}

/* Control Components */
.theme-editor-control-body {
  width: 100%;
}

/* Color Control */
.theme-editor-color-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.theme-editor-color-swatch-wrap {
  position: relative;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 6px;
  border: 1px solid #334155;
  overflow: hidden;
  background-image: linear-gradient(45deg, #1e293b 25%, transparent 25%),
                    linear-gradient(-45deg, #1e293b 25%, transparent 25%),
                    linear-gradient(45deg, transparent 75%, #1e293b 75%),
                    linear-gradient(-45deg, transparent 75%, #1e293b 75%);
  background-size: 8px 8px;
  background-position: 0 0, 0 4px, 4px -4px, -4px 0;
}

.theme-editor-color-swatch-preview {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.theme-editor-color-picker-input {
  position: absolute;
  inset: 0;
  width: 200%;
  height: 200%;
  transform: translate(-25%, -25%);
  opacity: 0;
  cursor: pointer;
}

.theme-editor-input-text {
  flex: 1;
  padding: 6px 10px;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 6px;
  color: #f1f5f9;
  font-family: 'JetBrains Mono', 'Fira Code', Menlo, monospace;
  font-size: 12px;
  outline: none;
  transition: border-color 0.15s ease;
}

.theme-editor-input-text:focus {
  border-color: #3b82f6;
}

/* Dimension Control */
.theme-editor-dimension-control {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.theme-editor-dimension-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.theme-editor-slider {
  flex: 1;
  -webkit-appearance: none;
  appearance: none;
  height: 4px;
  background: #334155;
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}

.theme-editor-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #3b82f6;
  border: 2px solid #ffffff;
  cursor: pointer;
  transition: transform 0.1s ease;
}

.theme-editor-slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.theme-editor-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #3b82f6;
  border: 2px solid #ffffff;
  cursor: pointer;
}

.theme-editor-dimension-input-wrap {
  display: flex;
  align-items: center;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 6px;
  overflow: hidden;
  width: 90px;
  flex-shrink: 0;
}

.theme-editor-dimension-num-input {
  width: 55px;
  padding: 5px 6px;
  background: transparent;
  border: none;
  color: #f1f5f9;
  font-family: 'JetBrains Mono', 'Fira Code', Menlo, monospace;
  font-size: 12px;
  outline: none;
  text-align: right;
}

.theme-editor-dimension-unit-badge {
  padding: 5px 6px;
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
  background: #273549;
  user-select: none;
  flex: 1;
  text-align: center;
}

/* Font Control */
.theme-editor-font-control {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.theme-editor-font-preview {
  padding: 6px 8px;
  background: #0f172a;
  border-radius: 4px;
  border: 1px solid #1e293b;
  font-size: 12px;
  color: #cbd5e1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Drawer Footer */
.theme-editor-footer {
  padding: 14px 20px;
  background: #090d16;
  border-top: 1px solid #1e293b;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.theme-editor-footer-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  color: #94a3b8;
}

.theme-editor-footer-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.theme-editor-btn {
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  border: none;
  outline: none;
  transition: all 0.15s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.theme-editor-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.theme-editor-btn-secondary {
  background: #1e293b;
  color: #f1f5f9;
  border: 1px solid #334155;
}

.theme-editor-btn-secondary:hover:not(:disabled) {
  background: #273549;
  border-color: #475569;
}

.theme-editor-btn-primary {
  flex: 1;
  background: #3b82f6;
  color: #ffffff;
}

.theme-editor-btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.theme-editor-btn-danger {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.theme-editor-btn-danger:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.25);
}

/* Diff Modal */
.theme-editor-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
  z-index: 999995;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  animation: fadeIn 0.15s ease-out;
}

.theme-editor-modal {
  width: 640px;
  max-width: 95vw;
  max-height: 85vh;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 12px;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.theme-editor-modal-header {
  padding: 16px 20px;
  background: #090d16;
  border-bottom: 1px solid #1e293b;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.theme-editor-modal-title {
  font-size: 15px;
  font-weight: 700;
  color: #f8fafc;
}

.theme-editor-modal-subtitle {
  font-size: 11px;
  color: #94a3b8;
  font-family: 'JetBrains Mono', 'Fira Code', Menlo, monospace;
}

.theme-editor-diff-content {
  flex: 1;
  overflow: auto;
  padding: 12px;
  background: #050811;
  font-family: 'JetBrains Mono', 'Fira Code', Menlo, monospace;
  font-size: 12px;
  line-height: 1.6;
}

.diff-line {
  display: flex;
  white-space: pre;
  padding: 1px 6px;
  border-radius: 2px;
}

.diff-marker {
  display: inline-block;
  width: 18px;
  user-select: none;
  font-weight: 700;
}

.diff-addition {
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
}

.diff-deletion {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}

.diff-hunk {
  background: rgba(59, 130, 246, 0.15);
  color: #93c5fd;
  font-weight: 600;
}

.diff-file-header {
  color: #a855f7;
  font-weight: 600;
}

.diff-context {
  color: #94a3b8;
}

.theme-editor-modal-footer {
  padding: 14px 20px;
  background: #090d16;
  border-top: 1px solid #1e293b;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

/* Toast Notifications */
.theme-editor-toast-container {
  position: absolute;
  bottom: 75px;
  left: 20px;
  right: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 999999;
  pointer-events: none;
}

.theme-editor-toast {
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  align-items: center;
  gap: 8px;
  pointer-events: auto;
}

.theme-editor-toast.success {
  background: #064e3b;
  color: #6ee7b7;
  border: 1px solid #059669;
}

.theme-editor-toast.error {
  background: #7f1d1d;
  color: #fca5a5;
  border: 1px solid #dc2626;
}

.theme-editor-toast.info {
  background: #1e293b;
  color: #93c5fd;
  border: 1px solid #3b82f6;
}

/* Animations */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
`;

export function getStyles(): string {
  return OVERLAY_STYLES;
}
