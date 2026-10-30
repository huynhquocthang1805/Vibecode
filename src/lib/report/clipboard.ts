import { notImplemented } from '@/lib/notImplemented';

/** Clipboard API + fallback textarea. Trả false nếu không sao chép được. */
export async function copyText(_text: string): Promise<boolean> {
  return notImplemented('AI-08');
}
