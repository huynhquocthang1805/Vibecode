import { proxy, releaseProxy, wrap } from 'comlink';

import type { CsvImportWorkerApi } from './csvImport.worker';
import type { ImportMapping } from './importPreparation';

export function createCsvImportSession(signal: AbortSignal) {
  const worker = new Worker(new URL('./csvImport.worker.ts', import.meta.url), { type: 'module' });
  const api = wrap<CsvImportWorkerApi>(worker);
  let disposed = false;

  function dispose() {
    if (disposed) return;
    disposed = true;
    signal.removeEventListener('abort', dispose);
    api[releaseProxy]();
    worker.terminate();
  }
  signal.addEventListener('abort', dispose, { once: true });

  function run<T>(invoke: () => Promise<T>): Promise<T> {
    if (signal.aborted) return Promise.reject(new Error('ABORTED'));
    if (disposed) return Promise.reject(new Error('Phiên đọc CSV đã kết thúc. Hãy chọn lại file.'));
    return new Promise((resolve, reject) => {
      function cleanup() {
        signal.removeEventListener('abort', abort);
        worker.removeEventListener('error', fail);
        worker.removeEventListener('messageerror', fail);
      }
      function abort() {
        cleanup();
        reject(new Error('ABORTED'));
      }
      function fail() {
        cleanup();
        dispose();
        reject(new Error('Không đọc được CSV trong tiến trình nền. Hãy chọn lại file.'));
      }
      signal.addEventListener('abort', abort, { once: true });
      worker.addEventListener('error', fail);
      worker.addEventListener('messageerror', fail);
      void Promise.resolve()
        .then(invoke)
        .then(
          (result) => {
            cleanup();
            resolve(result);
          },
          (error: unknown) => {
            cleanup();
            reject(error);
          },
        );
    });
  }

  return {
    dispose,
    read: (file: File, progress: (percent: number) => void) => run(() => api.read(file, proxy(progress))),
    prepare: (mapping: ImportMapping, campaignId: string, today: string) =>
      run(() => api.prepare(mapping, campaignId, today)),
  };
}
