import { Construction } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

/** Khung tạm (TL-03) — owner thay bằng component thật. */
function Placeholder({
  title,
  taskId,
  children,
  className,
}: {
  title: string;
  taskId: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="placeholder"
      className={cn(
        'flex min-h-24 flex-col gap-1 rounded-xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground',
        className,
      )}
    >
      <div className="flex items-center gap-2 font-medium text-foreground">
        <Construction className="size-4" aria-hidden />
        {title}
        <span className="ml-auto shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-xs whitespace-nowrap">{taskId}</span>
      </div>
      {children}
    </div>
  );
}

export { Placeholder };
