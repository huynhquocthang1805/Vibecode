/** Clipboard API + fallback textarea. Trả false nếu không sao chép được. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Quyền Clipboard có thể bị từ chối; thử cơ chế copy của trình duyệt cũ.
  }
  if (typeof document === 'undefined') return false;

  let textarea: HTMLTextAreaElement | undefined;
  let active: HTMLElement | null = null;
  let selection: Selection | null = null;
  const ranges: Range[] = [];
  let inputSelection: { start: number; end: number; direction: 'forward' | 'backward' | 'none' | null } | undefined;
  try {
    if (!document.body || typeof document.execCommand !== 'function') return false;
    active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    selection = document.getSelection();
    if (selection)
      for (let index = 0; index < selection.rangeCount; index++) ranges.push(selection.getRangeAt(index).cloneRange());
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
      if (active.selectionStart !== null && active.selectionEnd !== null) {
        inputSelection = {
          start: active.selectionStart,
          end: active.selectionEnd,
          direction: active.selectionDirection,
        };
      }
    }
    textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.readOnly = true;
    textarea.tabIndex = -1;
    textarea.setAttribute('aria-hidden', 'true');
    textarea.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px;pointer-events:none;';
    // Giữ bên trong dialog để focus trap không giành lại focus lúc chọn văn bản.
    (active?.closest('[role="dialog"], dialog') ?? document.body).appendChild(textarea);
    textarea.focus({ preventScroll: true });
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    textarea?.remove();
    try {
      active?.focus({ preventScroll: true });
      if (inputSelection && (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement)) {
        active.setSelectionRange(inputSelection.start, inputSelection.end, inputSelection.direction ?? undefined);
      }
      if (selection) {
        selection.removeAllRanges();
        for (const range of ranges) selection.addRange(range);
      }
    } catch {
      // Phần tử đã bị unmount không làm thay đổi kết quả copy.
    }
  }
}
