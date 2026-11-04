'use client';

// Owner: data-engineer (Huy) — ACC-05: Dialog xử lý xung đột đồng bộ 409 CONFLICT (A12)
import React from 'react';
import { AlertTriangle, CloudDownload, HardDriveUpload } from 'lucide-react';

import type { CloudSnapshotMeta } from '@/types/domain';

interface ConflictDialogProps {
  isOpen: boolean;
  serverMeta: CloudSnapshotMeta | null;
  onResolve: (resolution: 'cloud' | 'local') => Promise<void>;
  onClose: () => void;
}

export function ConflictDialog({
  isOpen,
  serverMeta,
  onResolve,
  onClose,
}: ConflictDialogProps) {
  if (!isOpen || !serverMeta) return null;

  const formattedDate = new Date(serverMeta.updatedAt).toLocaleString('vi-VN');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-[375px] sm:max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900 border border-amber-200 dark:border-amber-900/50">
        <div className="flex items-start space-x-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h2 id="conflict-dialog-title" className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Xung đột đồng bộ dữ liệu
            </h2>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              Dữ liệu trên máy chủ đã được thay đổi từ một thiết bị hoặc phiên làm việc khác:
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-lg bg-zinc-50 p-3 text-xs dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 space-y-1">
          <div>
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">Phiên bản máy chủ:</span>{' '}
            rev {serverMeta.revision}
          </div>
          <div>
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">Số dòng dữ liệu:</span>{' '}
            {serverMeta.rows.toLocaleString('vi-VN')} dòng
          </div>
          <div>
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">Cập nhật lúc:</span>{' '}
            {formattedDate}
          </div>
        </div>

        <div className="mt-6 flex flex-col space-y-3">
          <button
            type="button"
            onClick={() => void onResolve('cloud')}
            className="flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 min-h-[44px] touch-manipulation cursor-pointer"
          >
            <CloudDownload className="mr-2 h-4 w-4" /> Lấy bản trong tài khoản (khuyên dùng)
          </button>

          <button
            type="button"
            onClick={() => void onResolve('local')}
            className="flex w-full items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-xs font-semibold text-zinc-700 shadow-xs hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 min-h-[44px] touch-manipulation cursor-pointer"
          >
            <HardDriveUpload className="mr-2 h-4 w-4" /> Giữ bản trên máy này (ghi đè lên tài khoản)
          </button>

          <button
            type="button"
            onClick={onClose}
            className="text-center text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 min-h-[44px] flex items-center justify-center"
          >
            Để sau (chưa đồng bộ)
          </button>
        </div>
      </div>
    </div>
  );
}
