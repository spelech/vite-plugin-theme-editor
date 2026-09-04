import { OVERLAY_STYLES } from "./styles";
import { createControl } from "./controls";
import { createDiffModal } from "./diff-modal";
import { DomInspector, ExtractedStyles, INSPECTED_PROPERTIES } from "./inspector";
import type { FileThemeMap, ThemeVariable, VariableType, DiffResult, NewVariablePayload } from "../types";

const BaseElement: typeof HTMLElement = typeof HTMLElement !== "undefined" ? HTMLElement : (class {} as any);

function isRootSelector(selector?: string): boolean {
  if (!selector) return true;
  const s = selector.trim().toLowerCase();
  return s === ":root" || s === "html" || s === "body";
}

function inferVariableType(value: string, name: string = ""): VariableType {
  const trimmed = value.trim().toLowerCase();
  const lowerName = name.toLowerCase();

  if (
    trimmed.startsWith("#") ||
    trimmed.startsWith("rgb(") ||
    trimmed.startsWith("rgba(") ||
    trimmed.startsWith("hsl(") ||
    trimmed.startsWith("hsla(") ||
    trimmed.startsWith("oklch(") ||
    lowerName.includes("color") ||
    lowerName.includes("bg") ||
    lowerName.includes("border") ||
    lowerName.includes("text") ||
    lowerName.includes("accent") ||
    lowerName.includes("primary")
  ) {
    if (!trimmed.includes("px") && !trimmed.includes("rem") && !trimmed.includes("calc(")) {
      return "color";
    }
  }

  if (
    /^-?\d+(\.\d+)?(px|rem|em|%|vh|vw|pt)$/.test(trimmed) ||
    lowerName.includes("radius") ||
    lowerName.includes("spacing") ||
    lowerName.includes("gap") ||
    lowerName.includes("padding") ||
    lowerName.includes("margin") ||
    lowerName.includes("size")
  ) {
    return "dimension";
  }

  if (
    lowerName.includes("font") ||
    trimmed.includes("sans-serif") ||
    trimmed.includes("monospace") ||
    trimmed.includes("serif")
  ) {
    return "font";
  }

  return "raw";
}

export class ThemeEditorOverlay extends BaseElement {
  public shadow!: ShadowRoot;
  public files: FileThemeMap[] = [];
  public selectedFilePath: string = "";
  public originalValues: Record<string, Record<string, string>> = {};
  public stagedValues: Record<string, Record<string, string>> = {};
  public selectedSelector: string = "all";
  public stagedNewVariables: Record<string, NewVariablePayload[]> = {};
  public inspector: DomInspector;
  public isInspectorActive: boolean = false;
  public isOpen: boolean = false;
  public searchQuery: string = "";
  public activeFilter: string = "all";
  public isLoading: boolean = false;
  public isSaving: boolean = false;

  private scopedOverrides: Record<string, Record<string, string>> = {};
  private inspectedElement: Element | null = null;
  private inspectedStyles: ExtractedStyles | null = null;

  private drawerEl!: HTMLElement;
  private triggerEl!: HTMLButtonElement;
  private triggerBadgeEl!: HTMLElement;
  private pickerBtnEl!: HTMLButtonElement;
  private fileWrapEl!: HTMLElement;
  private fileSelectEl!: HTMLSelectElement;
  private toolbarEl!: HTMLElement;
  private selectorSelectEl!: HTMLSelectElement;
  private searchInputEl!: HTMLInputElement;
  private listContainerEl!: HTMLElement;
  private inspectorPanelEl!: HTMLElement;
  private filterTabsEl!: HTMLElement;
  private footerStatusEl!: HTMLElement;
  private resetAllBtnEl!: HTMLButtonElement;
  private reviewDiffBtnEl!: HTMLButtonElement;
  private saveBtnEl!: HTMLButtonElement;
  private modalContainerEl!: HTMLElement;
  private toastContainerEl!: HTMLElement;

  private handleKeydown = (e: KeyboardEvent) => {
    if (e.altKey && (e.code === "KeyT" || e.key === "t" || e.key === "T")) {
      e.preventDefault();
      this.toggleDrawer();
    }
    if (e.key === "Escape" && this.isInspectorActive) {
      this.disablePicker();
    }
  };

  constructor() {
    super();
    let shadowContainer: any = null;
    if (typeof (this as any).attachShadow === "function") {
      shadowContainer = (this as any).attachShadow({ mode: "open" });
      this.shadow = shadowContainer;
    } else if (typeof document !== "undefined" && typeof document.createElement === "function") {
      shadowContainer = document.createElement("div") as any;
      this.shadow = shadowContainer;
    }
    this.inspector = new DomInspector(shadowContainer);
  }

  public connectedCallback(): void {
    if (!this.shadow) {
      if (typeof (this as any).attachShadow === "function") {
        this.shadow = (this as any).attachShadow({ mode: "open" });
      } else if (typeof document !== "undefined" && typeof document.createElement === "function") {
        this.shadow = document.createElement("div") as any;
      }
    }

    if (this.inspector && this.shadow) {
      this.inspector.setContainer(this.shadow);
    }

    if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
      window.addEventListener("keydown", this.handleKeydown);
    }

    this.buildBaseDOM();
    this.loadScanData();

    if (typeof this.hasAttribute === "function" && this.hasAttribute("default-open")) {
      this.openDrawer();
    }
  }

  public disconnectedCallback(): void {
    if (typeof window !== "undefined" && typeof window.removeEventListener === "function") {
      window.removeEventListener("keydown", this.handleKeydown);
    }
    this.disablePicker();

    if (typeof document !== "undefined") {
      const styleEl = (typeof document.getElementById === "function"
        ? document.getElementById("__theme_editor_overrides")
        : document.querySelector?.("#__theme_editor_overrides")) as HTMLElement | null;
      if (styleEl) {
        if (typeof styleEl.remove === "function") {
          styleEl.remove();
        } else if (styleEl.parentElement) {
          styleEl.parentElement.removeChild(styleEl);
        }
      }
    }
  }

  private buildBaseDOM(): void {
    const styleEl = document.createElement("style");
    styleEl.textContent = OVERLAY_STYLES;
    this.shadow.appendChild(styleEl);

    // Floating Trigger Button
    this.triggerEl = document.createElement("button");
    this.triggerEl.type = "button";
    this.triggerEl.className = "theme-editor-trigger";
    this.triggerEl.setAttribute("aria-label", "Open Live Theme Editor");

    const triggerIcon = document.createElement("span");
    triggerIcon.className = "theme-editor-trigger-icon";
    triggerIcon.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c3.31 0 6-2.69 6-6 0-4.96-4.49-9-10-9z"/>
        <circle cx="6.5" cy="11.5" r="1.5" fill="currentColor"/>
        <circle cx="9.5" cy="7.5" r="1.5" fill="currentColor"/>
        <circle cx="14.5" cy="7.5" r="1.5" fill="currentColor"/>
        <circle cx="17.5" cy="11.5" r="1.5" fill="currentColor"/>
      </svg>
    `;

    const triggerText = document.createElement("span");
    triggerText.textContent = "Theme";

    this.triggerBadgeEl = document.createElement("span");
    this.triggerBadgeEl.className = "theme-editor-trigger-badge";
    this.triggerBadgeEl.style.display = "none";

    this.triggerEl.appendChild(triggerIcon);
    this.triggerEl.appendChild(triggerText);
    this.triggerEl.appendChild(this.triggerBadgeEl);
    this.triggerEl.addEventListener("click", () => this.toggleDrawer());
    this.shadow.appendChild(this.triggerEl);

    // Drawer Container
    this.drawerEl = document.createElement("div");
    this.drawerEl.className = "theme-editor-drawer";

    // Header
    const header = document.createElement("div");
    header.className = "theme-editor-header";

    const titleGroup = document.createElement("div");
    titleGroup.className = "theme-editor-title-group";

    const title = document.createElement("span");
    title.className = "theme-editor-title";
    title.textContent = "Live Theme Editor";

    const badge = document.createElement("span");
    badge.className = "theme-editor-badge-pill";
    badge.textContent = "DEV";

    titleGroup.appendChild(title);
    titleGroup.appendChild(badge);

    const headerActions = document.createElement("div");
    headerActions.className = "theme-editor-header-actions";

    this.pickerBtnEl = document.createElement("button");
    this.pickerBtnEl.type = "button";
    this.pickerBtnEl.className = "theme-editor-picker-btn";
    this.pickerBtnEl.title = "Pick element to inspect";
    this.pickerBtnEl.innerHTML = `
      <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="22" y1="12" x2="18" y2="12"/>
        <line x1="6" y1="12" x2="2" y2="12"/>
        <line x1="12" y1="6" x2="12" y2="2"/>
        <line x1="12" y1="22" x2="12" y2="18"/>
      </svg>
      <span>Pick</span>
    `;
    this.pickerBtnEl.addEventListener("click", () => this.togglePicker());

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "theme-editor-close-btn";
    closeBtn.innerHTML = "&times;";
    closeBtn.title = "Close drawer";
    closeBtn.addEventListener("click", () => this.closeDrawer());

    headerActions.appendChild(this.pickerBtnEl);
    headerActions.appendChild(closeBtn);

    header.appendChild(titleGroup);
    header.appendChild(headerActions);
    this.drawerEl.appendChild(header);

    // File Selector Wrap
    this.fileWrapEl = document.createElement("div");
    this.fileWrapEl.className = "theme-editor-file-select-wrap";

    const fileLabel = document.createElement("label");
    fileLabel.className = "theme-editor-field-label";
    fileLabel.textContent = "Active Stylesheet";

    this.fileSelectEl = document.createElement("select");
    this.fileSelectEl.className = "theme-editor-select";
    this.fileSelectEl.addEventListener("change", (e) => {
      this.setSelectedFile((e.target as HTMLSelectElement).value);
    });

    this.fileWrapEl.appendChild(fileLabel);
    this.fileWrapEl.appendChild(this.fileSelectEl);
    this.drawerEl.appendChild(this.fileWrapEl);

    // Toolbar (Root Selector, Search & Filter)
    this.toolbarEl = document.createElement("div");
    this.toolbarEl.className = "theme-editor-toolbar";

    const selectorWrap = document.createElement("div");
    selectorWrap.className = "theme-editor-selector-wrap";

    const selectorLabel = document.createElement("label");
    selectorLabel.className = "theme-editor-field-label";
    selectorLabel.textContent = "Root Selector";

    this.selectorSelectEl = document.createElement("select");
    this.selectorSelectEl.className = "theme-editor-select theme-editor-selector-select";
    this.selectorSelectEl.addEventListener("change", (e) => {
      this.selectedSelector = (e.target as HTMLSelectElement).value;
      this.renderFilterTabs();
      this.renderList();
    });

    selectorWrap.appendChild(selectorLabel);
    selectorWrap.appendChild(this.selectorSelectEl);
    this.toolbarEl.appendChild(selectorWrap);

    const searchBox = document.createElement("div");
    searchBox.className = "theme-editor-search-box";

    this.searchInputEl = document.createElement("input");
    this.searchInputEl.type = "text";
    this.searchInputEl.className = "theme-editor-search-input";
    this.searchInputEl.placeholder = "Search variables (e.g. --primary)...";
    this.searchInputEl.addEventListener("input", (e) => {
      this.searchQuery = (e.target as HTMLInputElement).value.trim().toLowerCase();
      this.renderList();
    });

    const searchClear = document.createElement("button");
    searchClear.type = "button";
    searchClear.className = "theme-editor-search-clear";
    searchClear.innerHTML = "&times;";
    searchClear.title = "Clear search";
    searchClear.addEventListener("click", () => {
      this.searchInputEl.value = "";
      this.searchQuery = "";
      this.renderList();
    });

    searchBox.appendChild(this.searchInputEl);
    searchBox.appendChild(searchClear);
    this.toolbarEl.appendChild(searchBox);

    this.filterTabsEl = document.createElement("div");
    this.filterTabsEl.className = "theme-editor-filter-tabs";
    this.toolbarEl.appendChild(this.filterTabsEl);
    this.drawerEl.appendChild(this.toolbarEl);

    // Variable List Container
    this.listContainerEl = document.createElement("div");
    this.listContainerEl.className = "theme-editor-list";
    this.drawerEl.appendChild(this.listContainerEl);

    // Inspector Panel Container (initially hidden)
    this.inspectorPanelEl = document.createElement("div");
    this.inspectorPanelEl.className = "theme-editor-inspector-panel";
    this.inspectorPanelEl.style.display = "none";
    this.drawerEl.appendChild(this.inspectorPanelEl);

    // Footer
    const footer = document.createElement("div");
    footer.className = "theme-editor-footer";

    this.footerStatusEl = document.createElement("div");
    this.footerStatusEl.className = "theme-editor-footer-status";
    footer.appendChild(this.footerStatusEl);

    const footerActions = document.createElement("div");
    footerActions.className = "theme-editor-footer-actions";

    this.resetAllBtnEl = document.createElement("button");
    this.resetAllBtnEl.type = "button";
    this.resetAllBtnEl.className = "theme-editor-btn theme-editor-btn-secondary";
    this.resetAllBtnEl.textContent = "Reset";
    this.resetAllBtnEl.title = "Revert all staged changes in this file";
    this.resetAllBtnEl.addEventListener("click", () => this.resetAll());

    this.reviewDiffBtnEl = document.createElement("button");
    this.reviewDiffBtnEl.type = "button";
    this.reviewDiffBtnEl.className = "theme-editor-btn theme-editor-btn-secondary";
    this.reviewDiffBtnEl.textContent = "Diff";
    this.reviewDiffBtnEl.title = "Review staged diff";
    this.reviewDiffBtnEl.addEventListener("click", () => this.openDiffModal());

    this.saveBtnEl = document.createElement("button");
    this.saveBtnEl.type = "button";
    this.saveBtnEl.className = "theme-editor-btn theme-editor-btn-primary";
    this.saveBtnEl.textContent = "Save to Disk";
    this.saveBtnEl.title = "Write staged theme changes to stylesheet";
    this.saveBtnEl.addEventListener("click", () => this.saveChanges());

    footerActions.appendChild(this.resetAllBtnEl);
    footerActions.appendChild(this.reviewDiffBtnEl);
    footerActions.appendChild(this.saveBtnEl);
    footer.appendChild(footerActions);
    this.drawerEl.appendChild(footer);

    this.shadow.appendChild(this.drawerEl);

    // Modal Container
    this.modalContainerEl = document.createElement("div");
    this.shadow.appendChild(this.modalContainerEl);

    // Toast Container
    this.toastContainerEl = document.createElement("div");
    this.toastContainerEl.className = "theme-editor-toast-container";
    this.drawerEl.appendChild(this.toastContainerEl);
  }

  public togglePicker(): void {
    if (this.isInspectorActive) {
      this.disablePicker();
    } else {
      this.enablePicker();
    }
  }

  public enablePicker(): void {
    this.isInspectorActive = true;
    if (this.pickerBtnEl) {
      this.pickerBtnEl.classList.add("is-active");
    }
    this.inspector.enablePicker((el, styles) => {
      this.onElementPicked(el, styles);
    });
  }

  public disablePicker(): void {
    this.isInspectorActive = false;
    if (this.pickerBtnEl) {
      this.pickerBtnEl.classList.remove("is-active");
    }
    if (this.inspector) {
      this.inspector.disablePicker();
    }
  }

  public onElementPicked(el: Element, styles: ExtractedStyles): void {
    this.disablePicker();
    this.openDrawer();
    this.showInspectorView(el, styles);
  }

  public showInspectorView(el: Element, styles?: ExtractedStyles): void {
    this.inspectedElement = el;
    this.inspectedStyles = styles || this.inspector.extractStyles(el);

    if (this.fileWrapEl) this.fileWrapEl.style.display = "none";
    if (this.toolbarEl) this.toolbarEl.style.display = "none";
    if (this.listContainerEl) this.listContainerEl.style.display = "none";
    if (this.inspectorPanelEl) {
      this.inspectorPanelEl.style.display = "flex";
      this.renderInspectorPanel();
    }
  }

  public hideInspectorView(): void {
    this.inspectedElement = null;
    this.inspectedStyles = null;

    if (this.inspectorPanelEl) this.inspectorPanelEl.style.display = "none";
    if (this.fileWrapEl) this.fileWrapEl.style.display = "";
    if (this.toolbarEl) this.toolbarEl.style.display = "";
    if (this.listContainerEl) this.listContainerEl.style.display = "";

    this.renderList();
  }

  private renderInspectorPanel(): void {
    if (!this.inspectorPanelEl) return;
    this.inspectorPanelEl.innerHTML = "";
    if (!this.inspectedElement || !this.inspectedStyles) return;

    const el = this.inspectedElement;
    const styles = this.inspectedStyles;

    // Header
    const header = document.createElement("div");
    header.className = "theme-editor-inspector-header";

    const backBtn = document.createElement("button");
    backBtn.type = "button";
    backBtn.className = "theme-editor-inspector-back-btn";
    backBtn.innerHTML = "&larr; Back";
    backBtn.title = "Back to variables list";
    backBtn.addEventListener("click", () => this.hideInspectorView());

    const titleGroup = document.createElement("div");
    titleGroup.className = "theme-editor-inspector-title-group";

    const tagSpan = document.createElement("span");
    tagSpan.className = "theme-editor-inspector-element-tag";
    const tagName = el.tagName ? el.tagName.toLowerCase() : "element";
    tagSpan.textContent = tagName;

    titleGroup.appendChild(tagSpan);
    header.appendChild(backBtn);
    header.appendChild(titleGroup);
    this.inspectorPanelEl.appendChild(header);

    // Property list
    const propList = document.createElement("div");
    propList.className = "theme-editor-inspector-prop-list";

    const activeFile = this.files.find(f => f.filePath === this.selectedFilePath);
    const fileVariables = activeFile ? activeFile.variables : [];

    for (const item of INSPECTED_PROPERTIES) {
      const extracted = styles[item.property];
      const val = extracted?.value || "";

      const propItem = document.createElement("div");
      propItem.className = "theme-editor-inspector-prop-item";
      propItem.setAttribute("data-property", item.property);

      // Property header
      const propHeader = document.createElement("div");
      propHeader.className = "theme-editor-inspector-prop-header";

      const nameEl = document.createElement("span");
      nameEl.className = "theme-editor-inspector-prop-name";
      nameEl.textContent = item.property;

      const valEl = document.createElement("span");
      valEl.className = "theme-editor-inspector-prop-value";
      valEl.textContent = val || "(not set)";

      propHeader.appendChild(nameEl);
      propHeader.appendChild(valEl);
      propItem.appendChild(propHeader);

      // Actions
      const actions = document.createElement("div");
      actions.className = "theme-editor-inspector-actions";

      // Bind select
      const bindSelect = document.createElement("select");
      bindSelect.className = "theme-editor-inspector-bind-select";

      const defaultOpt = document.createElement("option");
      defaultOpt.value = "";
      defaultOpt.textContent = "Bind to existing variable...";
      bindSelect.appendChild(defaultOpt);

      const matchingVars = fileVariables.filter(v => v.inferredType === item.category || item.category === "raw");
      const varsToShow = matchingVars.length > 0 ? matchingVars : fileVariables;

      for (const mv of varsToShow) {
        const opt = document.createElement("option");
        opt.value = mv.name;
        opt.textContent = `${mv.name} (${mv.value})`;
        bindSelect.appendChild(opt);
      }

      bindSelect.addEventListener("change", () => {
        const selectedVar = bindSelect.value;
        if (!selectedVar) return;

        if (el && (el as any).style) {
          if (typeof (el as any).style.setProperty === "function") {
            (el as any).style.setProperty(item.cssProperty, `var(${selectedVar})`);
            (el as any).style.setProperty(item.property, `var(${selectedVar})`);
          }
          (el as any).style[item.property] = `var(${selectedVar})`;
          (el as any).style[item.cssProperty] = `var(${selectedVar})`;
        }
        this.showToast(`Bound ${item.property} to var(${selectedVar})`, "info");
      });

      // Extract button
      const extractBtn = document.createElement("button");
      extractBtn.type = "button";
      extractBtn.className = "theme-editor-inspector-extract-btn";
      extractBtn.textContent = "Extract";

      actions.appendChild(bindSelect);
      actions.appendChild(extractBtn);
      propItem.appendChild(actions);

      // Extract form
      const form = document.createElement("div");
      form.className = "theme-editor-inspector-extract-form";
      form.style.display = "none";

      // Variable Name Row
      const nameRow = document.createElement("div");
      nameRow.className = "theme-editor-inspector-form-row";
      const nameLabel = document.createElement("span");
      nameLabel.className = "theme-editor-inspector-form-label";
      nameLabel.textContent = "Variable Name";
      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.className = "theme-editor-inspector-form-input theme-editor-var-name-input";
      const defaultVarName = `--${item.property.replace(/([A-Z])/g, "-$1").toLowerCase()}`;
      nameInput.value = defaultVarName;
      nameRow.appendChild(nameLabel);
      nameRow.appendChild(nameInput);
      form.appendChild(nameRow);

      // Selector Row
      const selRow = document.createElement("div");
      selRow.className = "theme-editor-inspector-form-row";
      const selLabel = document.createElement("span");
      selLabel.className = "theme-editor-inspector-form-label";
      selLabel.textContent = "Selector";
      const selInput = document.createElement("input");
      selInput.type = "text";
      selInput.className = "theme-editor-inspector-form-input theme-editor-var-selector-input";
      selInput.value = this.selectedSelector !== "all" ? this.selectedSelector : ":root";
      selRow.appendChild(selLabel);
      selRow.appendChild(selInput);
      form.appendChild(selRow);

      // Value Row
      const valRow = document.createElement("div");
      valRow.className = "theme-editor-inspector-form-row";
      const valLabel = document.createElement("span");
      valLabel.className = "theme-editor-inspector-form-label";
      valLabel.textContent = "Value";
      const valInput = document.createElement("input");
      valInput.type = "text";
      valInput.className = "theme-editor-inspector-form-input theme-editor-var-value-input";
      valInput.value = val || "";
      valRow.appendChild(valLabel);
      valRow.appendChild(valInput);
      form.appendChild(valRow);

      // Buttons
      const btnRow = document.createElement("div");
      btnRow.className = "theme-editor-inspector-form-buttons";

      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "theme-editor-btn theme-editor-btn-secondary";
      cancelBtn.textContent = "Cancel";
      cancelBtn.addEventListener("click", () => {
        form.style.display = "none";
      });

      const stageBtn = document.createElement("button");
      stageBtn.type = "button";
      stageBtn.className = "theme-editor-btn theme-editor-btn-primary theme-editor-stage-var-btn";
      stageBtn.textContent = "Stage Variable";
      stageBtn.addEventListener("click", () => {
        let varName = nameInput.value.trim();
        if (!varName) return;
        if (!varName.startsWith("--")) {
          varName = `--${varName}`;
        }
        const sel = selInput.value.trim() || ":root";
        const newVarVal = valInput.value.trim();

        this.stageNewVariable({
          selector: sel,
          name: varName,
          value: newVarVal
        });

        if (el && (el as any).style) {
          if (typeof (el as any).style.setProperty === "function") {
            (el as any).style.setProperty(item.cssProperty, `var(${varName})`);
            (el as any).style.setProperty(item.property, `var(${varName})`);
          }
          (el as any).style[item.property] = `var(${varName})`;
          (el as any).style[item.cssProperty] = `var(${varName})`;
        }

        form.style.display = "none";
      });

      btnRow.appendChild(cancelBtn);
      btnRow.appendChild(stageBtn);
      form.appendChild(btnRow);

      extractBtn.addEventListener("click", () => {
        form.style.display = form.style.display === "none" ? "flex" : "none";
      });

      propItem.appendChild(form);
      propList.appendChild(propItem);
    }

    this.inspectorPanelEl.appendChild(propList);
  }

  public stageNewVariable(newVar: NewVariablePayload): void {
    if (!this.selectedFilePath) return;

    if (!this.stagedNewVariables[this.selectedFilePath]) {
      this.stagedNewVariables[this.selectedFilePath] = [];
    }

    const existingIdx = this.stagedNewVariables[this.selectedFilePath].findIndex(
      v => v.name === newVar.name && v.selector === newVar.selector
    );
    if (existingIdx >= 0) {
      this.stagedNewVariables[this.selectedFilePath][existingIdx] = newVar;
    } else {
      this.stagedNewVariables[this.selectedFilePath].push(newVar);
    }

    // Live preview
    if (isRootSelector(newVar.selector)) {
      if (typeof document !== "undefined" && document.documentElement?.style) {
        document.documentElement.style.setProperty(newVar.name, newVar.value);
      }
    } else {
      if (!this.scopedOverrides[newVar.selector]) {
        this.scopedOverrides[newVar.selector] = {};
      }
      this.scopedOverrides[newVar.selector][newVar.name] = newVar.value;
      this.applyScopedOverrides();
    }

    this.renderSelectorSelect();
    this.updateFooter();
    this.showToast(`Staged new variable ${newVar.name}`, "success");
  }

  public async loadScanData(): Promise<void> {
    this.isLoading = true;
    try {
      const res = await fetch("/__theme_editor/api/scan");
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
        this.renderSelectorSelect();
        this.renderFilterTabs();
        this.renderList();
        this.updateFooter();
      }
    } catch (err: any) {
      this.showToast(`Failed to scan stylesheets: ${err.message}`, "error");
    } finally {
      this.isLoading = false;
    }
  }

  public openDrawer(): void {
    this.isOpen = true;
    this.drawerEl.classList.add("is-open");
  }

  public closeDrawer(): void {
    this.isOpen = false;
    this.drawerEl.classList.remove("is-open");
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

    const activeFile = this.files.find(f => f.filePath === filePath);
    const validSelectors = new Set<string>(["all"]);
    if (activeFile?.rootSelectors) {
      activeFile.rootSelectors.forEach(s => validSelectors.add(s));
    }
    if (activeFile?.variables) {
      activeFile.variables.forEach(v => {
        if (v.selector) validSelectors.add(v.selector);
      });
    }
    const newVars = this.stagedNewVariables[filePath] || [];
    newVars.forEach(nv => {
      if (nv.selector) validSelectors.add(nv.selector);
    });

    if (!validSelectors.has(this.selectedSelector)) {
      this.selectedSelector = "all";
    }

    this.renderSelectorSelect();
    this.renderFilterTabs();
    this.renderList();
    this.updateFooter();
  }

  public updateVariable(varName: string, newValue: string, selector?: string): void {
    if (!this.selectedFilePath) return;

    let targetSelector = selector;
    if (!targetSelector) {
      const activeFile = this.files.find(f => f.filePath === this.selectedFilePath);
      const matchingVar = activeFile?.variables.find(v =>
        v.name === varName && (this.selectedSelector === "all" || v.selector === this.selectedSelector)
      ) || activeFile?.variables.find(v => v.name === varName);
      targetSelector = matchingVar?.selector;
    }
    if (!targetSelector) {
      const newVar = (this.stagedNewVariables[this.selectedFilePath] || []).find(v => v.name === varName);
      targetSelector = newVar?.selector || ":root";
    }

    // Apply live to DOM
    if (isRootSelector(targetSelector)) {
      if (typeof document !== "undefined" && document.documentElement?.style) {
        document.documentElement.style.setProperty(varName, newValue);
      }
    } else {
      if (!this.scopedOverrides[targetSelector]) {
        this.scopedOverrides[targetSelector] = {};
      }
      this.scopedOverrides[targetSelector][varName] = newValue;
      this.applyScopedOverrides();
    }

    const orig = this.originalValues[this.selectedFilePath]?.[varName];
    if (!this.stagedValues[this.selectedFilePath]) {
      this.stagedValues[this.selectedFilePath] = {};
    }

    if (newValue !== orig) {
      this.stagedValues[this.selectedFilePath][varName] = newValue;
    } else {
      delete this.stagedValues[this.selectedFilePath][varName];
      if (!isRootSelector(targetSelector)) {
        if (this.scopedOverrides[targetSelector]) {
          delete this.scopedOverrides[targetSelector][varName];
          if (Object.keys(this.scopedOverrides[targetSelector]).length === 0) {
            delete this.scopedOverrides[targetSelector];
          }
          this.applyScopedOverrides();
        }
      }
    }

    this.updateFooter();
    this.updateItemModifiedState(varName, targetSelector);
  }

  private applyScopedOverrides(): void {
    if (typeof document === "undefined") return;

    let styleEl = (typeof document.getElementById === "function"
      ? document.getElementById("__theme_editor_overrides")
      : document.querySelector?.("#__theme_editor_overrides")) as HTMLStyleElement | null;

    const rules: string[] = [];
    for (const [sel, vars] of Object.entries(this.scopedOverrides)) {
      const entries = Object.entries(vars);
      if (entries.length > 0) {
        const decls = entries.map(([name, val]) => `  ${name}: ${val};`).join("\n");
        rules.push(`${sel} {\n${decls}\n}`);
      }
    }

    if (rules.length === 0) {
      if (styleEl) {
        styleEl.textContent = "";
        if (typeof styleEl.remove === "function") {
          styleEl.remove();
        } else if (styleEl.parentElement) {
          styleEl.parentElement.removeChild(styleEl);
        }
      }
    } else {
      if (!styleEl) {
        styleEl = document.createElement("style") as HTMLStyleElement;
        styleEl.id = "__theme_editor_overrides";
        const mountTarget = document.head || document.documentElement || document.body;
        mountTarget?.appendChild(styleEl);
      }
      styleEl.textContent = rules.join("\n\n");
    }
  }

  public resetVariable(varName: string, selector?: string): void {
    if (!this.selectedFilePath) return;

    const activeFile = this.files.find(f => f.filePath === this.selectedFilePath);
    let targetSelector = selector;
    if (!targetSelector) {
      const matchingVar = activeFile?.variables.find(v =>
        v.name === varName && (this.selectedSelector === "all" || v.selector === this.selectedSelector)
      ) || activeFile?.variables.find(v => v.name === varName);
      targetSelector = matchingVar?.selector;
    }
    if (!targetSelector) {
      const stagedNew = (this.stagedNewVariables[this.selectedFilePath] || []).find(v => v.name === varName);
      targetSelector = stagedNew?.selector || ":root";
    }

    const orig = this.originalValues[this.selectedFilePath]?.[varName];
    if (isRootSelector(targetSelector)) {
      if (orig !== undefined) {
        document.documentElement.style.setProperty(varName, orig);
      } else {
        document.documentElement.style.removeProperty(varName);
      }
    } else {
      if (this.scopedOverrides[targetSelector]) {
        delete this.scopedOverrides[targetSelector][varName];
        if (Object.keys(this.scopedOverrides[targetSelector]).length === 0) {
          delete this.scopedOverrides[targetSelector];
        }
        this.applyScopedOverrides();
      }
    }

    if (this.stagedValues[this.selectedFilePath]) {
      delete this.stagedValues[this.selectedFilePath][varName];
    }

    if (this.stagedNewVariables[this.selectedFilePath]) {
      const idx = this.stagedNewVariables[this.selectedFilePath].findIndex(v => v.name === varName);
      if (idx >= 0) {
        this.stagedNewVariables[this.selectedFilePath].splice(idx, 1);
      }
    }

    this.updateFooter();
    this.renderList();
  }

  public resetAll(filePath?: string): void {
    const targetFile = filePath || this.selectedFilePath;
    if (!targetFile) return;

    const staged = this.stagedValues[targetFile] || {};
    const keys = Object.keys(staged);
    const activeFile = this.files.find(f => f.filePath === targetFile);

    for (const key of keys) {
      const orig = this.originalValues[targetFile]?.[key];
      const targetSelector = activeFile?.variables.find(v => v.name === key)?.selector || ":root";

      if (isRootSelector(targetSelector)) {
        if (orig !== undefined) {
          document.documentElement.style.setProperty(key, orig);
        } else {
          document.documentElement.style.removeProperty(key);
        }
      } else {
        if (this.scopedOverrides[targetSelector]) {
          delete this.scopedOverrides[targetSelector][key];
          if (Object.keys(this.scopedOverrides[targetSelector]).length === 0) {
            delete this.scopedOverrides[targetSelector];
          }
        }
      }
    }

    if (this.stagedNewVariables[targetFile]) {
      for (const newVar of this.stagedNewVariables[targetFile]) {
        if (isRootSelector(newVar.selector)) {
          document.documentElement.style.removeProperty(newVar.name);
        } else {
          if (this.scopedOverrides[newVar.selector]) {
            delete this.scopedOverrides[newVar.selector][newVar.name];
            if (Object.keys(this.scopedOverrides[newVar.selector]).length === 0) {
              delete this.scopedOverrides[newVar.selector];
            }
          }
        }
      }
      this.stagedNewVariables[targetFile] = [];
    }

    this.applyScopedOverrides();

    this.stagedValues[targetFile] = {};
    this.updateFooter();
    this.renderList();
    this.showToast("Reverted all staged changes for this file.", "info");
  }

  public async openDiffModal(): Promise<void> {
    if (!this.selectedFilePath) return;

    const staged = this.stagedValues[this.selectedFilePath] || {};
    const newVars = this.stagedNewVariables[this.selectedFilePath] || [];
    const count = Object.keys(staged).length + newVars.length;
    if (count === 0) {
      this.showToast("No staged changes to review.", "info");
      return;
    }

    try {
      const res = await fetch("/__theme_editor/api/diff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filePath: this.selectedFilePath,
          updates: staged,
          newVariables: newVars
        })
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to compute diff");
      }

      const diffResult: DiffResult = data.diff;
      const modalEl = createDiffModal({
        filePath: this.selectedFilePath,
        diffResult,
        onSave: async () => {
          await this.saveChanges();
        },
        onClose: () => {
          this.modalContainerEl.innerHTML = "";
        }
      });

      this.modalContainerEl.innerHTML = "";
      this.modalContainerEl.appendChild(modalEl);
    } catch (err: any) {
      this.showToast(`Diff preview failed: ${err.message}`, "error");
    }
  }

  public async saveChanges(filePath?: string): Promise<void> {
    const targetFile = filePath || this.selectedFilePath;
    if (!targetFile) return;

    const staged = this.stagedValues[targetFile] || {};
    const newVars = this.stagedNewVariables[targetFile] || [];
    const count = Object.keys(staged).length + newVars.length;
    if (count === 0) {
      this.showToast("No changes to save.", "info");
      return;
    }

    this.isSaving = true;
    this.updateFooter();

    try {
      const res = await fetch("/__theme_editor/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filePath: targetFile,
          updates: staged,
          newVariables: newVars
        })
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to write to disk");
      }

      // Merge staged into original
      for (const [k, v] of Object.entries(staged)) {
        if (!this.originalValues[targetFile]) {
          this.originalValues[targetFile] = {};
        }
        this.originalValues[targetFile][k] = v;
      }
      this.stagedValues[targetFile] = {};

      // Merge newVariables into original and file
      const fileObj = this.files.find(f => f.filePath === targetFile);
      for (const nv of newVars) {
        if (!this.originalValues[targetFile]) {
          this.originalValues[targetFile] = {};
        }
        this.originalValues[targetFile][nv.name] = nv.value;

        if (fileObj) {
          if (!fileObj.variables.some(v => v.name === nv.name && v.selector === nv.selector)) {
            fileObj.variables.push({
              name: nv.name,
              value: nv.value,
              inferredType: inferVariableType(nv.value, nv.name),
              selector: nv.selector
            });
          }
          if (fileObj.rootSelectors && !fileObj.rootSelectors.includes(nv.selector)) {
            fileObj.rootSelectors.push(nv.selector);
          }
        }
      }
      this.stagedNewVariables[targetFile] = [];

      // Close modal if open
      this.modalContainerEl.innerHTML = "";

      this.renderSelectorSelect();
      this.renderFilterTabs();
      this.renderList();
      this.updateFooter();
      this.showToast(`Saved ${count} changes to disk!`, "success");
    } catch (err: any) {
      this.showToast(`Save failed: ${err.message}`, "error");
    } finally {
      this.isSaving = false;
      this.updateFooter();
    }
  }

  public getStagedCount(filePath?: string): number {
    if (filePath) {
      const valCount = Object.keys(this.stagedValues[filePath] || {}).length;
      const newCount = (this.stagedNewVariables[filePath] || []).length;
      return valCount + newCount;
    }
    let total = 0;
    for (const fileStaged of Object.values(this.stagedValues)) {
      total += Object.keys(fileStaged).length;
    }
    for (const fileNew of Object.values(this.stagedNewVariables)) {
      total += fileNew.length;
    }
    return total;
  }

  public showToast(message: string, type: "success" | "error" | "info" = "info", duration = 3000): void {
    const toast = document.createElement("div");
    toast.className = `theme-editor-toast ${type}`;
    toast.textContent = message;
    this.toastContainerEl.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(8px)";
      toast.style.transition = "all 0.2s ease";
      setTimeout(() => {
        toast.remove();
      }, 200);
    }, duration);
  }

  private renderFileSelect(): void {
    this.fileSelectEl.innerHTML = "";
    for (const file of this.files) {
      const option = document.createElement("option");
      option.value = file.filePath;
      option.textContent = file.relativePath;
      this.fileSelectEl.appendChild(option);
    }
    if (this.selectedFilePath) {
      this.fileSelectEl.value = this.selectedFilePath;
    }
  }

  private renderSelectorSelect(): void {
    if (!this.selectorSelectEl) return;
    this.selectorSelectEl.innerHTML = "";

    const activeFile = this.files.find(f => f.filePath === this.selectedFilePath);
    const selectorSet = new Set<string>();

    if (activeFile?.rootSelectors && activeFile.rootSelectors.length > 0) {
      activeFile.rootSelectors.forEach(s => selectorSet.add(s));
    }
    if (activeFile?.variables) {
      activeFile.variables.forEach(v => {
        if (v.selector) selectorSet.add(v.selector);
      });
    }
    const newVars = this.stagedNewVariables[this.selectedFilePath] || [];
    newVars.forEach(nv => {
      if (nv.selector) selectorSet.add(nv.selector);
    });

    const allOpt = document.createElement("option");
    allOpt.value = "all";
    allOpt.textContent = "All Selectors";
    this.selectorSelectEl.appendChild(allOpt);

    if (!selectorSet.has(":root") && selectorSet.size === 0) {
      selectorSet.add(":root");
    }

    for (const sel of selectorSet) {
      const opt = document.createElement("option");
      opt.value = sel;
      opt.textContent = sel;
      this.selectorSelectEl.appendChild(opt);
    }

    this.selectorSelectEl.value = this.selectedSelector;
  }

  private renderFilterTabs(): void {
    this.filterTabsEl.innerHTML = "";
    const activeFile = this.files.find(f => f.filePath === this.selectedFilePath);
    let variables = activeFile ? activeFile.variables : [];
    if (this.selectedSelector !== "all") {
      variables = variables.filter(v => (v.selector || ":root") === this.selectedSelector);
    }

    const counts: Record<string, number> = {
      all: variables.length,
      color: variables.filter(v => v.inferredType === "color").length,
      dimension: variables.filter(v => v.inferredType === "dimension").length,
      font: variables.filter(v => v.inferredType === "font").length,
      raw: variables.filter(v => v.inferredType === "raw").length,
    };

    const tabs: Array<{ id: string; label: string }> = [
      { id: "all", label: "All" },
      { id: "color", label: "Colors" },
      { id: "dimension", label: "Dims" },
      { id: "font", label: "Fonts" },
      { id: "raw", label: "Raw" }
    ];

    for (const tab of tabs) {
      const count = counts[tab.id] || 0;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `theme-editor-tab-btn ${this.activeFilter === tab.id ? "is-active" : ""}`;

      const labelSpan = document.createElement("span");
      labelSpan.textContent = tab.label;

      const countSpan = document.createElement("span");
      countSpan.className = "theme-editor-tab-count";
      countSpan.textContent = `(${count})`;

      btn.appendChild(labelSpan);
      btn.appendChild(countSpan);

      btn.addEventListener("click", () => {
        this.activeFilter = tab.id;
        this.renderFilterTabs();
        this.renderList();
      });

      this.filterTabsEl.appendChild(btn);
    }
  }

  private renderList(): void {
    this.listContainerEl.innerHTML = "";
    const activeFile = this.files.find(f => f.filePath === this.selectedFilePath);

    if (!activeFile || activeFile.variables.length === 0) {
      const empty = document.createElement("div");
      empty.className = "theme-editor-empty-state";
      empty.innerHTML = `
        <div class="theme-editor-empty-icon">🎨</div>
        <div>No CSS variables found in this stylesheet.</div>
      `;
      this.listContainerEl.appendChild(empty);
      return;
    }

    const filtered = activeFile.variables.filter(v => {
      const matchesSelector = this.selectedSelector === "all" || (v.selector || ":root") === this.selectedSelector;
      const matchesFilter = this.activeFilter === "all" || v.inferredType === this.activeFilter;
      const matchesSearch = !this.searchQuery ||
        v.name.toLowerCase().includes(this.searchQuery) ||
        v.value.toLowerCase().includes(this.searchQuery);
      return matchesSelector && matchesFilter && matchesSearch;
    });

    if (filtered.length === 0) {
      const empty = document.createElement("div");
      empty.className = "theme-editor-empty-state";
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

      const card = document.createElement("div");
      card.className = `theme-editor-item ${isModified ? "is-modified" : ""}`;
      card.setAttribute("data-variable-name", v.name);
      card.setAttribute("data-selector", v.selector || ":root");

      // Header
      const itemHeader = document.createElement("div");
      itemHeader.className = "theme-editor-item-header";

      const nameWrap = document.createElement("div");
      nameWrap.className = "theme-editor-item-name-wrap";

      const nameEl = document.createElement("span");
      nameEl.className = "theme-editor-item-name";
      nameEl.textContent = v.name;
      nameEl.title = `Click to copy ${v.name}`;
      nameEl.addEventListener("click", () => {
        navigator.clipboard?.writeText(v.name);
        this.showToast(`Copied ${v.name}`, "info", 1500);
      });

      const typeBadge = document.createElement("span");
      typeBadge.className = `theme-editor-type-badge ${v.inferredType}`;
      typeBadge.textContent = v.inferredType;

      nameWrap.appendChild(nameEl);
      nameWrap.appendChild(typeBadge);

      // Affected element count badge
      const affected = this.inspector.findAffectedElements(v.name);
      if (affected && affected.length > 0) {
        const affectedBadge = document.createElement("span");
        affectedBadge.className = "theme-editor-affected-badge";
        affectedBadge.textContent = `${affected.length} match${affected.length === 1 ? "" : "es"}`;
        affectedBadge.title = `Used by ${affected.length} element${affected.length === 1 ? "" : "es"}`;
        nameWrap.appendChild(affectedBadge);
      }

      // Add hover listeners to variable card
      card.addEventListener("mouseenter", () => {
        const elements = this.inspector.findAffectedElements(v.name);
        if (elements && elements.length > 0) {
          this.inspector.highlightElements(elements, v.name);
        }
      });
      card.addEventListener("mouseleave", () => {
        this.inspector.clearHighlights();
      });

      const actions = document.createElement("div");
      actions.className = "theme-editor-item-actions";

      if (isModified) {
        const resetBtn = document.createElement("button");
        resetBtn.type = "button";
        resetBtn.className = "theme-editor-reset-btn";
        resetBtn.innerHTML = "&#8634; Reset";
        resetBtn.title = `Revert to ${this.originalValues[this.selectedFilePath]?.[v.name]}`;
        resetBtn.addEventListener("click", () => this.resetVariable(v.name, v.selector));
        actions.appendChild(resetBtn);
      }

      itemHeader.appendChild(nameWrap);
      itemHeader.appendChild(actions);

      // Control
      const controlEl = createControl(v, currentValue, (newValue: string) => {
        this.updateVariable(v.name, newValue, v.selector);
      });

      card.appendChild(itemHeader);
      card.appendChild(controlEl);
      this.listContainerEl.appendChild(card);
    }
  }

  private updateItemModifiedState(varName: string, selector?: string): void {
    let selectorQuery = `[data-variable-name="${varName}"]`;
    if (selector) {
      const escapedSelector = selector.replace(/"/g, '\\"');
      selectorQuery += `[data-selector="${escapedSelector}"]`;
    }
    const card = this.listContainerEl.querySelector(selectorQuery);
    if (!card) return;
    const cardSelector = card.getAttribute("data-selector") || selector;

    const isModified = this.stagedValues[this.selectedFilePath]?.[varName] !== undefined;
    card.classList.toggle("is-modified", isModified);

    const actionsEl = card.querySelector(".theme-editor-item-actions");
    if (actionsEl) {
      actionsEl.innerHTML = "";
      if (isModified) {
        const resetBtn = document.createElement("button");
        resetBtn.type = "button";
        resetBtn.className = "theme-editor-reset-btn";
        resetBtn.innerHTML = "&#8634; Reset";
        resetBtn.title = `Revert to ${this.originalValues[this.selectedFilePath]?.[varName]}`;
        resetBtn.addEventListener("click", () => this.resetVariable(varName, cardSelector || undefined));
        actionsEl.appendChild(resetBtn);
      }
    }
  }

  private updateFooter(): void {
    const fileStagedCount = this.getStagedCount(this.selectedFilePath);
    const totalStagedCount = this.getStagedCount();

    // Update trigger badge
    if (totalStagedCount > 0) {
      this.triggerBadgeEl.textContent = String(totalStagedCount);
      this.triggerBadgeEl.style.display = "inline-flex";
    } else {
      this.triggerBadgeEl.style.display = "none";
    }

    // Update status text
    if (fileStagedCount === 0) {
      this.footerStatusEl.textContent = "No modified variables in active file";
    } else {
      this.footerStatusEl.textContent = `${fileStagedCount} variable${fileStagedCount === 1 ? "" : "s"} modified`;
    }

    // Update buttons
    const hasChanges = fileStagedCount > 0;
    this.resetAllBtnEl.disabled = !hasChanges || this.isSaving;
    this.reviewDiffBtnEl.disabled = !hasChanges || this.isSaving;
    this.saveBtnEl.disabled = !hasChanges || this.isSaving;

    if (this.isSaving) {
      this.saveBtnEl.textContent = "Saving...";
    } else {
      this.saveBtnEl.textContent = "Save to Disk";
    }
  }
}

export function registerThemeEditorOverlay(): void {
  if (typeof customElements !== "undefined" && !customElements.get("theme-editor-overlay")) {
    customElements.define("theme-editor-overlay", ThemeEditorOverlay);
  }
}
