'use client';

import { HardDrive } from 'lucide-react';

export function LiveModeToggle() {
  return (
    <span className="status-label" title="Bản MVP dùng chế độ nhập thủ công">
      <HardDrive size={13} />
      Thủ công
    </span>
  );
}
