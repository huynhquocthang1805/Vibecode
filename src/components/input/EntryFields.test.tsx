import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { emptyDraft, EntryFields } from './EntryFields';

function Form() {
  const [value, setValue] = useState(emptyDraft('2026-11-01'));
  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <EntryFields
        id="test"
        value={value}
        onChange={(field, text) => setValue((previous) => ({ ...previous, [field]: text }))}
      />
      <button>Lưu</button>
    </form>
  );
}
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('FI-06 R-01 — định dạng và bàn phím', () => {
  it('gõ liên tục 1234567 thành 1.234.567 và giữ con trỏ theo chữ số', () => {
    vi.useFakeTimers();
    render(<Form />);
    const input = screen.getByLabelText('Lượt tiếp cận') as HTMLInputElement;
    input.focus();
    for (const digit of '1234567') {
      fireEvent.input(input, { target: { value: input.value + digit }, inputType: 'insertText', data: digit });
      act(() => vi.runOnlyPendingTimers());
    }
    expect(input).toHaveValue('1.234.567');
    expect(input.selectionStart).toBe(9);
    input.setSelectionRange(2, 2);
    fireEvent.input(input, { target: { value: '1.9234.567', selectionStart: 3 }, inputType: 'insertText', data: '9' });
    act(() => vi.runOnlyPendingTimers());
    expect(input).toHaveValue('19.234.567');
    expect(input.selectionStart).toBe(2);
  });
  it.each(['12,5', '-3', 'abc', '9007199254740992', '1.2345'])('giữ nguyên %s để validator xử lý', (text) => {
    render(<Form />);
    fireEvent.change(screen.getByLabelText('Lượt tiếp cận'), { target: { value: text } });
    expect(screen.getByLabelText('Lượt tiếp cận')).toHaveValue(text);
  });
  it('Enter chuyển ô; Shift+Enter và Enter ở ô cuối không chặn submit', () => {
    render(<Form />);
    const reach = screen.getByLabelText('Lượt tiếp cận');
    const clicks = screen.getByLabelText('Lượt click');
    reach.focus();
    expect(fireEvent.keyDown(reach, { key: 'Enter' })).toBe(false);
    expect(clicks).toHaveFocus();
    expect(fireEvent.keyDown(clicks, { key: 'Enter', shiftKey: true })).toBe(true);
    expect(clicks).toHaveFocus();
    expect(fireEvent.keyDown(screen.getByLabelText('Đơn hàng'), { key: 'Enter' })).toBe(true);
  });
});
