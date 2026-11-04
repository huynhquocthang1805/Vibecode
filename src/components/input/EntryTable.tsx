'use client';

import dynamic from 'next/dynamic';

// Tab ẩn không tải mã chỉnh sửa/lọc bảng trong lần mở trang đầu tiên.
export const EntryTable = dynamic(() => import('./EntryTableContent').then((module) => module.EntryTable), {
  ssr: false,
  loading: () => (
    <p role="status" className="card-description">
      Đang tải bảng số liệu…
    </p>
  ),
});
