import type { DiffResult } from '../types';

export interface DiffModalOptions {
  filePath: string;
  diffResult: DiffResult;
  onSave: () => Promise<void>;
  onClose: () => void;
}

export function createDiffModal(options: {
  filePath: string;
  diffResult: DiffResult;
  onSave: () => Promise<void>;
  onClose: () => void;
}): HTMLElement {
  const { filePath, diffResult, onSave, onClose } = options;

  const backdrop = document.createElement('div');
  backdrop.className = 'theme-editor-modal-backdrop';

  const modal = document.createElement('div');
  modal.className = 'theme-editor-modal';

  // Header
  const header = document.createElement('div');
  header.className = 'theme-editor-modal-header';

  const titleGroup = document.createElement('div');
  const title = document.createElement('div');
  title.className = 'theme-editor-modal-title';
  title.textContent = 'Review Staged Changes';

  const subtitle = document.createElement('div');
  subtitle.className = 'theme-editor-modal-subtitle';
  subtitle.textContent = `${filePath} (${diffResult.changesCount} change${diffResult.changesCount === 1 ? '' : 's'})`;

  titleGroup.appendChild(title);
  titleGroup.appendChild(subtitle);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'theme-editor-close-btn';
  closeBtn.innerHTML = '&times;';
  closeBtn.title = 'Close modal';
  closeBtn.addEventListener('click', onClose);

  header.appendChild(titleGroup);
  header.appendChild(closeBtn);

  // Diff Body
  const content = document.createElement('div');
  content.className = 'theme-editor-diff-content';

  const diffText = diffResult.unifiedDiff || '';
  const lines = diffText.split('\n');

  if (lines.length === 0 || !diffText.trim()) {
    const emptyState = document.createElement('div');
    emptyState.className = 'theme-editor-empty-state';
    emptyState.textContent = 'No differences between disk and staged theme.';
    content.appendChild(emptyState);
  } else {
    for (const rawLine of lines) {
      if (!rawLine && lines.indexOf(rawLine) === lines.length - 1) continue;

      const lineEl = document.createElement('div');
      const markerEl = document.createElement('span');
      markerEl.className = 'diff-marker';
      const textEl = document.createElement('span');

      if (rawLine.startsWith('+++') || rawLine.startsWith('---')) {
        lineEl.className = 'diff-line diff-file-header';
        markerEl.textContent = ' ';
        textEl.textContent = rawLine;
      } else if (rawLine.startsWith('@@')) {
        lineEl.className = 'diff-line diff-hunk';
        markerEl.textContent = ' ';
        textEl.textContent = rawLine;
      } else if (rawLine.startsWith('+')) {
        lineEl.className = 'diff-line diff-addition';
        markerEl.textContent = '+';
        textEl.textContent = rawLine.slice(1);
      } else if (rawLine.startsWith('-')) {
        lineEl.className = 'diff-line diff-deletion';
        markerEl.textContent = '-';
        textEl.textContent = rawLine.slice(1);
      } else {
        lineEl.className = 'diff-line diff-context';
        markerEl.textContent = ' ';
        textEl.textContent = rawLine.startsWith(' ') ? rawLine.slice(1) : rawLine;
      }

      lineEl.appendChild(markerEl);
      lineEl.appendChild(textEl);
      content.appendChild(lineEl);
    }
  }

  // Footer
  const footer = document.createElement('div');
  footer.className = 'theme-editor-modal-footer';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'theme-editor-btn theme-editor-btn-secondary';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', onClose);

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'theme-editor-btn theme-editor-btn-primary';
  saveBtn.textContent = 'Save to Disk';

  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    cancelBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    try {
      await onSave();
    } finally {
      saveBtn.disabled = false;
      cancelBtn.disabled = false;
      saveBtn.textContent = 'Save to Disk';
    }
  });

  footer.appendChild(cancelBtn);
  footer.appendChild(saveBtn);

  modal.appendChild(header);
  modal.appendChild(content);
  modal.appendChild(footer);
  backdrop.appendChild(modal);

  // Close when clicking outside modal
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      onClose();
    }
  });

  // Escape key handler
  const keyHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
      document.removeEventListener('keydown', keyHandler);
    }
  };
  document.addEventListener('keydown', keyHandler);

  return backdrop;
}
