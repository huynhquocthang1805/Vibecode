import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { mapAuthError } from './authErrors';
import { ConflictDialog } from './ConflictDialog';

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
});
