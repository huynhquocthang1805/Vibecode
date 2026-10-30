import { notImplemented } from '@/lib/notImplemented';
import type { StorageAdapter } from '@/types/domain';

export const DEFAULT_STORAGE_KEY = 'kpi-dash:v1';

export function createLocalStorageAdapter(_key: string = DEFAULT_STORAGE_KEY): StorageAdapter {
  return notImplemented('DATA-03');
}
