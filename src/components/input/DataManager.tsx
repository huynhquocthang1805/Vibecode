'use client';

import dynamic from 'next/dynamic';

export const DataManager = dynamic(() => import('./DataManagerContent').then((module) => module.DataManager), {
  ssr: false,
  loading: () => (
    <p role="status" className="card-description">
      Đang tải quản lý dữ liệu…
    </p>
  ),
});
