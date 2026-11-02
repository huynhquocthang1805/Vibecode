'use client';

// Owner: frontend-dashboard (Trường) — FD-01 hoàn thiện (nút sao chép chi tiết lỗi, chống spam toast — docs/13 §7).
import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

interface Props {
  name: string;
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/** Lỗi trong 1 khu chỉ làm hỏng khu đó, không làm trắng cả trang. */
export class SectionBoundary extends React.Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error) {
    console.error(`[SectionBoundary:${this.props.name}]`, error);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        role="alert"
        className="flex flex-col gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm"
      >
        <p className="font-medium">Phần “{this.props.name}” gặp lỗi.</p>
        <p className="text-muted-foreground">Các phần còn lại vẫn hoạt động. Bạn có thể thử tải lại khu này.</p>
        <Button size="sm" variant="outline" className="w-fit" onClick={() => this.setState({ error: null })}>
          Thử lại
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="w-fit"
          onClick={() => {
            if (!navigator.clipboard) {
              toast.error('Không sao chép được. Hãy mở chi tiết và chọn văn bản.');
              return;
            }
            void navigator.clipboard.writeText(`${this.props.name}: ${this.state.error?.message ?? ''}`).then(
              () => toast.success('Đã sao chép chi tiết lỗi'),
              () => toast.error('Không sao chép được. Hãy mở chi tiết và chọn văn bản.'),
            );
          }}
        >
          Sao chép chi tiết lỗi
        </Button>
        <details>
          <summary className="cursor-pointer">Chi tiết lỗi</summary>
          <pre className="overflow-auto whitespace-pre-wrap text-xs">{this.state.error.message}</pre>
        </details>
      </div>
    );
  }
}
