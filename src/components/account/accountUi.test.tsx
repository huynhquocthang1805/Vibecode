import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { mapAuthError } from './authErrors';
import { ConflictDialog } from './ConflictDialog';
import { useAccount } from './useAccount';

const mockSession = {
  data: { user: { id: 'test_user_id', email: 'test@example.com', name: 'Test User' } },
  isPending: false,
};

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    useSession: () => mockSession,
  },
}));

describe('ACC-05 · Account UI & Helpers', () => {
  it('R-03: mapAuthError ánh xạ chuẩn xác các mã lỗi của better-auth sang tiếng Việt', () => {
    expect(mapAuthError('INVALID_EMAIL_OR_PASSWORD')).toBe('Email hoặc mật khẩu không chính xác.');
    expect(mapAuthError('Invalid email or password')).toBe('Email hoặc mật khẩu không chính xác.');
    expect(mapAuthError('PASSWORD_TOO_SHORT')).toBe('Mật khẩu phải có ít nhất 8 ký tự.');
    expect(mapAuthError('USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL')).toBe(
      'Email này đã được sử dụng. Vui lòng chọn email khác.',
    );
    expect(mapAuthError('RATE_LIMITED')).toBe(
      'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau 1 phút.',
    );
    expect(mapAuthError('NOT_CONFIGURED')).toBe('Tài khoản chưa được bật trên máy chủ.');
    expect(mapAuthError(null)).toBe('Đã xảy ra lỗi. Vui lòng thử lại.');
  });

  it('A12: ConflictDialog hiển thị thông tin xung đột và các nút bấm có min-h-[44px]', () => {
    const mockMeta = {
      revision: 3,
      rows: 1500,
      bytes: 20480,
      updatedAt: 1730700000000,
    };

    render(
      <ConflictDialog
        isOpen={true}
        serverMeta={mockMeta}
        onResolve={async () => {}}
        onClose={() => {}}
      />,
    );

    expect(screen.getByText(/Xung đột đồng bộ dữ liệu/i)).toBeInTheDocument();
    expect(screen.getByText(/rev 3/i)).toBeInTheDocument();
    expect(screen.getByText(/1\.500 dòng/i)).toBeInTheDocument();

    const cloudBtn = screen.getByRole('button', { name: /Lấy bản trong tài khoản/i });
    expect(cloudBtn).toHaveClass('min-h-[44px]');

    const localBtn = screen.getByRole('button', { name: /Giữ bản trên máy này/i });
    expect(localBtn).toHaveClass('min-h-[44px]');
  });

  it('R-02: resolveConflict("local") đọc khoá mặc định (khách) khi chưa có khoá user và đặt syncState error khi PUT thất bại', async () => {
    localStorage.clear();
    localStorage.setItem('kpi-dash:v1', 'persisted_local_payload');

    let putPayload: string | null = null;
    let putBaseRev: number | null = null;

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation((input: unknown, opts?: { method?: string; body?: string }) => {
      const url = typeof input === 'string' ? input : (input as { url?: string })?.url || '';
      if (url.includes('/api/account/profile')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              id: 'test_user_id',
              email: 'test@example.com',
              displayName: 'Test',
              avatarUrl: null,
              createdAt: Date.now(),
            }),
        });
      }
      if (url.includes('/api/account/data') && opts?.method === 'PUT') {
        const body = JSON.parse(opts.body || '{}');
        putPayload = body.state;
        putBaseRev = body.baseRevision;
        if (body.baseRevision === 0) {
          return Promise.resolve({
            ok: false,
            status: 409,
            json: () =>
              Promise.resolve({
                code: 'CONFLICT',
                message: 'Conflict',
                server: { revision: 5, updatedAt: Date.now(), rows: 10, bytes: 500 },
              }),
          });
        }
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: 'Server Error' }),
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
    });

    try {
      const { result } = renderHook(() => useAccount());

      await act(async () => {
        await result.current.syncNow();
      });

      await waitFor(() => {
        expect(result.current.sync.state).toBe('conflict');
        expect(result.current.conflictServerMeta?.revision).toBe(5);
      });

      await act(async () => {
        await result.current.resolveConflict('local');
      });

      await waitFor(() => {
        expect(putPayload).toBe('persisted_local_payload');
        expect(putBaseRev).toBe(5);
        expect(result.current.sync.state).toBe('error');
      });
    } finally {
      global.fetch = originalFetch;
    }
  });
});
