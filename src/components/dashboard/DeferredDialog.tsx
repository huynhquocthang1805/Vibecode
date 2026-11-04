'use client';

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';

const DialogFrame = dynamic(() => import('./DialogFrame'), {
  ssr: false,
  loading: () => (
    <span role="status" className="sr-only">
      Đang mở hộp thoại…
    </span>
  ),
});

export interface DeferredDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  className?: string;
  children: ReactNode;
}

/** Chỉ tải phần quản lý focus/portal khi người dùng mở hộp thoại. */
export function DeferredDialog(props: DeferredDialogProps) {
  return props.open ? <DialogFrame {...props} /> : null;
}
