'use client';

// Owner: frontend-input (Trường) — FI-01. Thay khung tạm bằng component thật, giữ tên + props.
import { Placeholder } from '@/components/ui/placeholder';

export function EntryForm(_props: { onSubmitted?: (n: number) => void }) {
  return <Placeholder title="Form nhập nhiều dòng" taskId="FI-01" />;
}
