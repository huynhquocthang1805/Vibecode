/// <reference lib="webworker" />
import * as Comlink from 'comlink';

import { notImplemented } from '@/lib/notImplemented';

import type { AnalyticsWorkerApi } from './types';

// Worker giữ RollupIndex; gọi hàm của lib/analytics (docs/13 §4). Thay ở DATA-06.
const api: AnalyticsWorkerApi = {
  init: () => notImplemented('DATA-06'),
  applyDelta: () => notImplemented('DATA-06'),
  snapshot: () => notImplemented('DATA-06'),
};

Comlink.expose(api);
