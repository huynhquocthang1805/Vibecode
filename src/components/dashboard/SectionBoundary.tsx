'use client';

// Owner: frontend-dashboard (Trường) — FD-01 hoàn thiện (nút sao chép chi tiết lỗi, chống spam toast — docs/13 §7).
import * as React from 'react';

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
        <p className="text-muted-foreground">{this.state.error.message}</p>
        <Button size="sm" variant="outline" className="w-fit" onClick={() => this.setState({ error: null })}>
          Thử lại
        </Button>
      </div>
    );
  }
}
