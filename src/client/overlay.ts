import { OVERLAY_STYLES } from './styles';
import { createControl } from './controls';
import { createDiffModal } from './diff-modal';
import type { FileThemeMap, ThemeVariable, VariableType, DiffResult } from '../types';

const BaseElement: typeof HTMLElement = typeof HTMLElement !== 'undefined' ? HTMLElement : (class {} as any);

export class ThemeEditorOverlay extends BaseElement {
  public shadow: ShadowRoot;
  public files: FileThemeMap[] = [];
  public selectedFilePath: string = '';
  public originalValues: Record<string, Record<string, string>> = {};
  public stagedValues: Record<string, Record<string, string>> = {};
  public isOpen: boolean = false;
  public searchQuery: string = '';
  public activeFilter: string = 'all';
  public isLoading: boolean = false;
  public isSaving: boolean = false;

  private drawerEl!: HTMLElement;
  private triggerEl!: HTMLElement;
  private triggerBadgeEl!: HTMLElement;
  private fileSelectEl!: HTMLSelectElement;
  private searchInputEl!: HTMLInputElement;
  private listContainerEl!: HTMLElement;
  private filterTabsEl!: HTMLElement;
  private footerStatusEl!: HTMLElement;
  private resetAllBtnEl!: HTMLButtonElement;
  private reviewDiffBtnEl!: HTMLButtonElement;
  private saveBtnEl!: HTMLButtonElement;
  private modalContainerEl!: HTMLElement;
  private toastContainerEl!: HTMLElement;
  private handleKeydown = (e: KeyboardEvent) => {
    if (e.altKey && (e.code === 'KeyT' || e.key === 't' || e.key === 'T')) {
      e.preventDefault();
      this.toggleDrawer();
    }
  };

  constructor() {
    super();
    if (typeof (this as any).attachShadow === 'function') {
      this.shadow = (this as any).attachShadow({ mode: 'open' });
    } else if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      this.shadow = document.createElement('div') as any;
    }
  }

  public connectedCallback(): void {
    if (!this.shadow) {
      if (typeof (this as any).attachShadow === 'function') {
        this.shadow = (this as any).attachShadow({ mode: 'open' });
      } else if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
        this.shadow = document.createElement('div') as any;
      }
    }

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('keydown', this.handleKeydown);
    }

    this.buildBaseDOM();
    this.loadScanData();

    if (typeof this.hasAttribute === 'function' && this.hasAttribute('default-open')) {
      this.openDrawer();
    }
  }

  public disconnectedCallback(): void {
    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      window.removeEventListener('keydown', this.handleKeydown);
    }
  }

  private buildBaseDOM(): void {
    const styleEl = document.createElement('style');
    styleEl.textContent = OVERLAY_STYLES;
    this.shadow.appendChild(styleEl);

    // Floating Trigger Button
    this.triggerEl = document.createElement('button');
    this.triggerEl.type = 'button';
    this.triggerEl.className = 'theme-editor-trigger';
    this.triggerEl.setAttribute('aria-label', 'Open Live Theme Editor');

    const triggerIcon = document.createElement('span');
    triggerIcon.className = 'theme-editor-trigger-icon';
    triggerIcon.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c3.31 0 6-2.69 6-6 0-4.96-4.49-9-10-9z"/>
        <circle cx="6.5" cy="11.5" r="1.5" fill="currentColor"/>
        <circle cx="9.5" cy="7.5" r="1.5" fill="currentColor"/>
        <circle cx="14.5" cy="7.5" r="1.5" fill="currentColor"/>
        <circle cx="17.5" cy="11.5" r="1.5" fill="currentColor"/>
      </svg>
    `;

    const triggerText = document.createElement('span');
    triggerText.textContent = 'Theme';

    this.triggerBadgeEl = document.createElement('span');
    this.triggerBadgeEl.className = 'theme-editor-trigger-badge';
    this.triggerBadgeEl.style.display = 'none';

    this.triggerEl.appendChild(triggerIcon);
    this.triggerEl.appendChild(triggerText);
    this.triggerEl.appendChild(this.triggerBadgeEl);
    this.triggerEl.addEventListener('click', () => this.toggleDrawer());
    this.shadow.appendChild(this.triggerEl);

    // Drawer Container
    this.drawerEl = document.createElement('div');
    this.drawerEl.className = 'theme-editor-drawer';

    // Header
    const header = document.createElement('div');
    header.className = 'theme-editor-header';

    const titleGroup = document.createElement('div');
    titleGroup.className = 'theme-editor-title-group';

    const title = document.createElement('span');
    title.className = 'theme-editor-title';
    title.textContent = 'Live Theme Editor';

    const badge = document.createElement('span');
    badge.className = 'theme-editor-badge-pill';
    badge.textContent = 'DEV';

    titleGroup.appendChild(title);
    titleGroup.appendChild(badge);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'theme-editor-close-btn';
    closeBtn.innerHTML = '&times;';
    closeBtn.title = 'Close drawer';
    closeBtn.addEventListener('click', () => this.closeDrawer());

    header.appendChild(titleGroup);
    header.appendChild(closeBtn);
    this.drawerEl.appendChild(header);

    // File Selector Wrap
    const fileWrap = document.createElement('div');
    fileWrap.className = 'theme-editor-file-select-wrap';

    const fileLabel = document.createElement('label');
    fileLabel.className = 'theme-editor-field-label';
    fileLabel.textContent = 'Active Stylesheet';

    this.fileSelectEl = document.createElement('select');
    this.fileSelectEl.className = 'theme-editor-select';
    this.fileSelectEl.addEventListener('change', (e) => {
      this.setSelectedFile((e.target as HTMLSelectElement).value);
    });

    fileWrap.appendChild(fileLabel);
    fileWrap.appendChild(this.fileSelectEl);
    this.drawerEl.appendChild(fileWrap);

    // Toolbar (Search & Filter)
    const toolbar = document.createElement('div');
    toolbar.className = 'theme-editor-toolbar';

    const searchBox = document.createElement('div');
    searchBox.className = 'theme-editor-search-box';

    this.searchInputEl = document.createElement('input');
    this.searchInputEl.type = 'text';
    this.searchInputEl.className = 'theme-editor-search-input';
    this.searchInputEl.placeholder = 'Search variables (e.g. --primary)...';
    this.searchInputEl.addEventListener('input', (e) => {
      this.searchQuery = (e.target as HTMLInputElement).value.trim().toLowerCase();
      this.renderList();
    });

    const searchClear = document.createElement('button');
    searchClear.type = 'button';
    searchClear.className = 'theme-editor-search-clear';
    searchClear.innerHTML = '&times;';
    searchClear.title = 'Clear search';
    searchClear.addEventListener('click', () => {
      this.searchInputEl.value = '';
      this.searchQuery = '';
      this.renderList();
    });

    searchBox.appendChild(this.searchInputEl);
    searchBox.appendChild(searchClear);
    toolbar.appendChild(searchBox);

    this.filterTabsEl = document.createElement('div');
    this.filterTabsEl.className = 'theme-editor-filter-tabs';
    toolbar.appendChild(this.filterTabsEl);
    this.drawerEl.appendChild(toolbar);

    // Variable List Container
    this.listContainerEl = document.createElement('div');
    this.listContainerEl.className = 'theme-editor-list';
    this.drawerEl.appendChild(this.listContainerEl);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'theme-editor-footer';

    this.footerStatusEl = document.createElement('div');
    this.footerStatusEl.className = 'theme-editor-footer-status';
    footer.appendChild(this.footerStatusEl);

    const footerActions = document.createElement('div');
    footerActions.className = 'theme-editor-footer-actions';

    this.resetAllBtnEl = document.createElement('button');
    this.resetAllBtnEl.type = 'button';
    this.resetAllBtnEl.className = 'theme-editor-btn theme-editor-btn-secondary';
    this.resetAllBtnEl.textContent = 'Reset';
    this.resetAllBtnEl.title = 'Revert all staged changes in this file';
    this.resetAllBtnEl.addEventListener('click', () => this.resetAll());

    this.reviewDiffBtnEl = document.createElement('button');
    this.reviewDiffBtnEl.type = 'button';
    this.reviewDiffBtnEl.className = 'theme-editor-btn theme-editor-btn-secondary';
    this.reviewDiffBtnEl.textContent = 'Diff';
    this.reviewDiffBtnEl.title = 'Review staged diff';
    this.reviewDiffBtnEl.addEventListener('click', () => this.openDiffModal());

    this.saveBtnEl = document.createElement('button');
    this.saveBtnEl.type = 'button';
    this.saveBtnEl.className = 'theme-editor-btn theme-editor-btn-primary';
    this.saveBtnEl.textContent = 'Save to Disk';
    this.saveBtnEl.title = 'Write staged theme changes to stylesheet';
    this.saveBtnEl.addEventListener('click', () => this.saveChanges());

    footerActions.appendChild(this.resetAllBtnEl);
    footerActions.appendChild(this.reviewDiffBtnEl);
    footerActions.appendChild(this.saveBtnEl);
    footer.appendChild(footerActions);
    this.drawerEl.appendChild(footer);

    this.shadow.appendChild(this.drawerEl);

    // Modal Container
    this.modalContainerEl = document.createElement('div');
    this.shadow.appendChild(this.modalContainerEl);

    // Toast Container
    this.toastContainerEl = document.createElement('div');
    this.toastContainerEl.className = 'theme-editor-toast-container';
    this.drawerEl.appendChild(this.toastContainerEl);
  }

  public async loadScanData(): Promise<void> {
    this.isLoading = true;
    try {
      const res = await fetch('/__theme_editor/api/scan');
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.files)) {
        this.files = data.files;

        // Populate original and staged values
        for (const file of this.files) {
          if (!this.originalValues[file.filePath]) {
            this.originalValues[file.filePath] = {};
          }
          if (!this.stagedValues[file.filePath]) {
            this.stagedValues[file.filePath] = {};
          }
          for (const v of file.variables) {
            this.originalValues[file.filePath][v.name] = v.value;
          }
        }

        if (this.files.length > 0 && !this.selectedFilePath) {
          this.selectedFilePath = this.files[0].filePath;
        }

        this.renderFileSelect();
        this.renderFilterTabs();
        this.renderList();
        this.updateFooter();
      }
    } catch (err: any) {
      this.showToast(`Failed to scan stylesheets: ${err.message}`, 'error');
    } finally {
      this.isLoading = false;
    }
  }

  public openDrawer(): void {
    this.isOpen = true;
    this.drawerEl.classList.add('is-open');
  }

  public closeDrawer(): void {
    this.isOpen = false;
    this.drawerEl.classList.remove('is-open');
  }

  public toggleDrawer(): void {
    if (this.isOpen) {
      this.closeDrawer();
    } else {
      this.openDrawer();
    }
  }

  public setSelectedFile(filePath: string): void {
    this.selectedFilePath = filePath;
    this.fileSelectEl.value = filePath;
    this.renderFilterTabs();
    this.renderList();
    this.updateFooter();
  }

  public updateVariable(varName: string, newValue: string): void {
    if (!this.selectedFilePath) return;

    // Apply live to DOM
    document.documentElement.style.setProperty(varName, newValue);

    const orig = this.originalValues[this.selectedFilePath]?.[varName];
    if (!this.stagedValues[this.selectedFilePath]) {
      this.stagedValues[this.selectedFilePath] = {};
    }

    if (newValue !== orig) {
      this.stagedValues[this.selectedFilePath][varName] = newValue;
    } else {
      delete this.stagedValues[this.selectedFilePath][varName];
    }

    this.updateFooter();
    this.updateItemModifiedState(varName);
  }

  public resetVariable(varName: string): void {
    if (!this.selectedFilePath) return;

    const orig = this.originalValues[this.selectedFilePath]?.[varName];
    if (orig !== undefined) {
      document.documentElement.style.setProperty(varName, orig);
    } else {
      document.documentElement.style.removeProperty(varName);
    }

    if (this.stagedValues[this.selectedFilePath]) {
      delete this.stagedValues[this.selectedFilePath][varName];
    }

    this.updateFooter();
    this.renderList();
  }

  public resetAll(filePath?: string): void {
    const targetFile = filePath || this.selectedFilePath;
    if (!targetFile || !this.stagedValues[targetFile]) return;

    const staged = this.stagedValues[targetFile];
    const keys = Object.keys(staged);
    if (keys.length === 0) return;

    for (const key of keys) {
      const orig = this.originalValues[targetFile]?.[key];
      if (orig !== undefined) {
        document.documentElement.style.setProperty(key, orig);
      } else {
        document.documentElement.style.removeProperty(key);
      }
    }

    this.stagedValues[targetFile] = {};
    this.updateFooter();
    this.renderList();
    this.showToast('Reverted all staged changes for this file.', 'info');
  }

  public async openDiffModal(): Promise<void> {
    if (!this.selectedFilePath) return;

    const staged = this.stagedValues[this.selectedFilePath] || {};
    const count = Object.keys(staged).length;
    if (count === 0) {
      this.showToast('No staged changes to review.', 'info');
      return;
    }

    try {
      const res = await fetch('/__theme_editor/api/diff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: this.selectedFilePath,
          updates: staged
        })
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to compute diff');
      }

      const diffResult: DiffResult = data.diff;
      const modalEl = createDiffModal({
        filePath: this.selectedFilePath,
        diffResult,
        onSave: async () => {
          await this.saveChanges();
        },
        onClose: () => {
          this.modalContainerEl.innerHTML = '';
        }
      });

      this.modalContainerEl.innerHTML = '';
      this.modalContainerEl.appendChild(modalEl);
    } catch (err: any) {
      this.showToast(`Diff preview failed: ${err.message}`, 'error');
    }
  }

  public async saveChanges(filePath?: string): Promise<void> {
    const targetFile = filePath || this.selectedFilePath;
    if (!targetFile) return;

    const staged = this.stagedValues[targetFile] || {};
    const count = Object.keys(staged).length;
    if (count === 0) {
      this.showToast('No changes to save.', 'info');
      return;
    }

    this.isSaving = true;
    this.updateFooter();

    try {
      const res = await fetch('/__theme_editor/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: targetFile,
          updates: staged
        })
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to write to disk');
      }

      // Merge staged into original
      for (const [k, v] of Object.entries(staged)) {
        if (!this.originalValues[targetFile]) {
          this.originalValues[targetFile] = {};
        }
        this.originalValues[targetFile][k] = v;
      }
      this.stagedValues[targetFile] = {};

      // Close modal if open
      this.modalContainerEl.innerHTML = '';

      this.updateFooter();
      this.renderList();
      this.showToast(`Saved ${count} changes to disk!`, 'success');
    } catch (err: any) {
      this.showToast(`Save failed: ${err.message}`, 'error');
    } finally {
      this.isSaving = false;
      this.updateFooter();
    }
  }

  public getStagedCount(filePath?: string): number {
    if (filePath) {
      return Object.keys(this.stagedValues[filePath] || {}).length;
    }
    let total = 0;
    for (const fileStaged of Object.values(this.stagedValues)) {
      total += Object.keys(fileStaged).length;
    }
    return total;
  }

  public showToast(message: string, type: 'success' | 'error' | 'info' = 'info', duration = 3000): void {
    const toast = document.createElement('div');
    toast.className = `theme-editor-toast ${type}`;
    toast.textContent = message;
    this.toastContainerEl.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      toast.style.transition = 'all 0.2s ease';
      setTimeout(() => {
        toast.remove();
      }, 200);
    }, duration);
  }

  private renderFileSelect(): void {
    this.fileSelectEl.innerHTML = '';
    for (const file of this.files) {
      const option = document.createElement('option');
      option.value = file.filePath;
      option.textContent = file.relativePath;
      this.fileSelectEl.appendChild(option);
    }
    if (this.selectedFilePath) {
      this.fileSelectEl.value = this.selectedFilePath;
    }
  }

  private renderFilterTabs(): void {
    this.filterTabsEl.innerHTML = '';
    const activeFile = this.files.find(f => f.filePath === this.selectedFilePath);
    const variables = activeFile ? activeFile.variables : [];

    const counts: Record<string, number> = {
      all: variables.length,
      color: variables.filter(v => v.inferredType === 'color').length,
      dimension: variables.filter(v => v.inferredType === 'dimension').length,
      font: variables.filter(v => v.inferredType === 'font').length,
      raw: variables.filter(v => v.inferredType === 'raw').length,
    };

    const tabs: Array<{ id: string; label: string }> = [
      { id: 'all', label: 'All' },
      { id: 'color', label: 'Colors' },
      { id: 'dimension', label: 'Dims' },
      { id: 'font', label: 'Fonts' },
      { id: 'raw', label: 'Raw' }
    ];

    for (const tab of tabs) {
      const count = counts[tab.id] || 0;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `theme-editor-tab-btn ${this.activeFilter === tab.id ? 'is-active' : ''}`;

      const labelSpan = document.createElement('span');
      labelSpan.textContent = tab.label;

      const countSpan = document.createElement('span');
      countSpan.className = 'theme-editor-tab-count';
      countSpan.textContent = `(${count})`;

      btn.appendChild(labelSpan);
      btn.appendChild(countSpan);

      btn.addEventListener('click', () => {
        this.activeFilter = tab.id;
        this.renderFilterTabs();
        this.renderList();
      });

      this.filterTabsEl.appendChild(btn);
    }
  }

  private renderList(): void {
    this.listContainerEl.innerHTML = '';
    const activeFile = this.files.find(f => f.filePath === this.selectedFilePath);

    if (!activeFile || activeFile.variables.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'theme-editor-empty-state';
      empty.innerHTML = `
        <div class="theme-editor-empty-icon">🎨</div>
        <div>No CSS variables found in this stylesheet.</div>
      `;
      this.listContainerEl.appendChild(empty);
      return;
    }

    const filtered = activeFile.variables.filter(v => {
      const matchesFilter = this.activeFilter === 'all' || v.inferredType === this.activeFilter;
      const matchesSearch = !this.searchQuery ||
        v.name.toLowerCase().includes(this.searchQuery) ||
        v.value.toLowerCase().includes(this.searchQuery);
      return matchesFilter && matchesSearch;
    });

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'theme-editor-empty-state';
      empty.innerHTML = `
        <div>No variables match "${this.searchQuery}".</div>
      `;
      this.listContainerEl.appendChild(empty);
      return;
    }

    const currentStaged = this.stagedValues[this.selectedFilePath] || {};

    for (const v of filtered) {
      const isModified = currentStaged[v.name] !== undefined;
      const currentValue = isModified ? currentStaged[v.name] : (this.originalValues[this.selectedFilePath]?.[v.name] || v.value);

      const card = document.createElement('div');
      card.className = `theme-editor-item ${isModified ? 'is-modified' : ''}`;
      card.setAttribute('data-variable-name', v.name);

      // Header
      const itemHeader = document.createElement('div');
      itemHeader.className = 'theme-editor-item-header';

      const nameWrap = document.createElement('div');
      nameWrap.className = 'theme-editor-item-name-wrap';

      const nameEl = document.createElement('span');
      nameEl.className = 'theme-editor-item-name';
      nameEl.textContent = v.name;
      nameEl.title = `Click to copy ${v.name}`;
      nameEl.addEventListener('click', () => {
        navigator.clipboard?.writeText(v.name);
        this.showToast(`Copied ${v.name}`, 'info', 1500);
      });

      const typeBadge = document.createElement('span');
      typeBadge.className = `theme-editor-type-badge ${v.inferredType}`;
      typeBadge.textContent = v.inferredType;

      nameWrap.appendChild(nameEl);
      nameWrap.appendChild(typeBadge);

      const actions = document.createElement('div');
      actions.className = 'theme-editor-item-actions';

      if (isModified) {
        const resetBtn = document.createElement('button');
        resetBtn.type = 'button';
        resetBtn.className = 'theme-editor-reset-btn';
        resetBtn.innerHTML = '&#8634; Reset';
        resetBtn.title = `Revert to ${this.originalValues[this.selectedFilePath]?.[v.name]}`;
        resetBtn.addEventListener('click', () => this.resetVariable(v.name));
        actions.appendChild(resetBtn);
      }

      itemHeader.appendChild(nameWrap);
      itemHeader.appendChild(actions);

      // Control
      const controlEl = createControl(v, currentValue, (newValue: string) => {
        this.updateVariable(v.name, newValue);
      });

      card.appendChild(itemHeader);
      card.appendChild(controlEl);
      this.listContainerEl.appendChild(card);
    }
  }

  private updateItemModifiedState(varName: string): void {
    const card = this.listContainerEl.querySelector(`[data-variable-name="${varName}"]`);
    if (!card) return;

    const isModified = this.stagedValues[this.selectedFilePath]?.[varName] !== undefined;
    card.classList.toggle('is-modified', isModified);

    const actionsEl = card.querySelector('.theme-editor-item-actions');
    if (actionsEl) {
      actionsEl.innerHTML = '';
      if (isModified) {
        const resetBtn = document.createElement('button');
        resetBtn.type = 'button';
        resetBtn.className = 'theme-editor-reset-btn';
        resetBtn.innerHTML = '&#8634; Reset';
        resetBtn.title = `Revert to ${this.originalValues[this.selectedFilePath]?.[varName]}`;
        resetBtn.addEventListener('click', () => this.resetVariable(varName));
        actionsEl.appendChild(resetBtn);
      }
    }
  }

  private updateFooter(): void {
    const fileStagedCount = Object.keys(this.stagedValues[this.selectedFilePath] || {}).length;
    const totalStagedCount = this.getStagedCount();

    // Update trigger badge
    if (totalStagedCount > 0) {
      this.triggerBadgeEl.textContent = String(totalStagedCount);
      this.triggerBadgeEl.style.display = 'inline-flex';
    } else {
      this.triggerBadgeEl.style.display = 'none';
    }

    // Update status text
    if (fileStagedCount === 0) {
      this.footerStatusEl.textContent = 'No modified variables in active file';
    } else {
      this.footerStatusEl.textContent = `${fileStagedCount} variable${fileStagedCount === 1 ? '' : 's'} modified`;
    }

    // Update buttons
    const hasChanges = fileStagedCount > 0;
    this.resetAllBtnEl.disabled = !hasChanges || this.isSaving;
    this.reviewDiffBtnEl.disabled = !hasChanges || this.isSaving;
    this.saveBtnEl.disabled = !hasChanges || this.isSaving;

    if (this.isSaving) {
      this.saveBtnEl.textContent = 'Saving...';
    } else {
      this.saveBtnEl.textContent = 'Save to Disk';
    }
  }
}

export function registerThemeEditorOverlay(): void {
  if (typeof customElements !== 'undefined' && !customElements.get('theme-editor-overlay')) {
    customElements.define('theme-editor-overlay', ThemeEditorOverlay);
  }
}
