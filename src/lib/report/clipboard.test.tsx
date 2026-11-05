import { afterEach, describe, expect, it, vi } from 'vitest';

import { copyText } from './clipboard';

const originalExecCommand = Object.getOwnPropertyDescriptor(document, 'execCommand');

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (originalExecCommand) Object.defineProperty(document, 'execCommand', originalExecCommand);
  else Reflect.deleteProperty(document, 'execCommand');
  document.body.replaceChildren();
  document.getSelection()?.removeAllRanges();
});

function fallback(result = true) {
  const copy = vi.fn(() => result);
  Object.defineProperty(document, 'execCommand', { configurable: true, value: copy });
  vi.stubGlobal('navigator', {});
  return copy;
}

describe('AI-08 · copyText', () => {
  it('ưu tiên Clipboard API, giữ nguyên văn bản và không tạo textarea', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const text = 'BÁO CÁO\nĐơn: 30 👩‍💻';
    await expect(copyText(text)).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith(text);
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('Clipboard từ chối thì thử fallback và dọn textarea', async () => {
    const copy = fallback();
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('Denied')) } });
    copy.mockImplementation(() => {
      const textarea = document.querySelector('textarea');
      expect(textarea?.value).toBe('Báo cáo\nDòng 2');
      expect(textarea?.selectionStart).toBe(0);
      expect(textarea?.selectionEnd).toBe('Báo cáo\nDòng 2'.length);
      return true;
    });
    await expect(copyText('Báo cáo\nDòng 2')).resolves.toBe(true);
    expect(copy).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('thiếu API vẫn sao chép chuỗi rỗng bằng fallback', async () => {
    fallback();
    await expect(copyText('')).resolves.toBe(true);
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('getter Clipboard ném lỗi vẫn dùng fallback', async () => {
    fallback();
    vi.stubGlobal('navigator', {
      get clipboard() {
        throw new Error('Blocked');
      },
    });
    await expect(copyText('Báo cáo')).resolves.toBe(true);
  });

  it('fallback trả false không báo thành công', async () => {
    fallback(false);
    await expect(copyText('Báo cáo')).resolves.toBe(false);
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('cả hai cơ chế lỗi vẫn trả false và dọn textarea', async () => {
    const copy = fallback();
    copy.mockImplementation(() => {
      throw new Error('Copy blocked');
    });
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('Denied')) } });
    await expect(copyText('Báo cáo')).resolves.toBe(false);
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('không có DOM (SSR) hoặc không có execCommand thì trả false', async () => {
    vi.stubGlobal('navigator', undefined);
    Reflect.deleteProperty(document, 'execCommand');
    await expect(copyText('Báo cáo')).resolves.toBe(false);
    vi.stubGlobal('document', undefined);
    await expect(copyText('Báo cáo')).resolves.toBe(false);
  });

  it('DOM không cho tạo phần tử thì trả false', async () => {
    fallback();
    vi.spyOn(document, 'createElement').mockImplementation(() => {
      throw new Error('DOM blocked');
    });
    await expect(copyText('Báo cáo')).resolves.toBe(false);
  });

  it('khôi phục focus và vùng chọn input cả khi copy thất bại', async () => {
    fallback(false);
    const field = document.createElement('input');
    field.value = 'Nội dung đang nhập';
    document.body.appendChild(field);
    field.focus();
    field.setSelectionRange(2, 6, 'backward');
    await expect(copyText('Báo cáo')).resolves.toBe(false);
    expect(document.activeElement).toBe(field);
    expect([field.selectionStart, field.selectionEnd, field.selectionDirection]).toEqual([2, 6, 'backward']);
  });

  it('khôi phục vùng chọn văn bản trong trang', async () => {
    fallback();
    const paragraph = document.createElement('p');
    paragraph.textContent = 'Đã chọn trước';
    document.body.appendChild(paragraph);
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    document.getSelection()?.addRange(range);
    await expect(copyText('Báo cáo')).resolves.toBe(true);
    expect(document.getSelection()?.toString()).toBe('Đã chọn trước');
  });

  it('textarea nằm trong dialog hiện tại để không bị focus trap chặn', async () => {
    const copy = fallback();
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    const button = document.createElement('button');
    dialog.appendChild(button);
    document.body.appendChild(dialog);
    button.focus();
    copy.mockImplementation(() => {
      expect(dialog.querySelector('textarea')).toBe(document.activeElement);
      return true;
    });
    await expect(copyText('Báo cáo')).resolves.toBe(true);
    expect(document.activeElement).toBe(button);
  });
});
