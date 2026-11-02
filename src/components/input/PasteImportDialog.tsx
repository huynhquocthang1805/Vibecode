'use client';

import { ImportDialog } from './ImportDialog';

export function PasteImportDialog(props: { initialText?: string; initiallyOpen?: boolean; onClose?: () => void } = {}) {
  return <ImportDialog mode="paste" {...props} />;
}
