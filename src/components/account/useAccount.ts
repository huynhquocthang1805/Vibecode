'use client';

// Owner: data-engineer (Huy) — ACC-05: Hook useAccount quản lý phiên, hồ sơ và đồng bộ cloud
import { useCallback, useEffect, useRef, useState } from 'react';

import { authClient } from '@/lib/auth-client';
import { DEFAULT_STORAGE_KEY } from '@/lib/data/storage/localStorageAdapter';
import { getUserStorageKey } from '@/lib/data/storage/userStorage';
import type { CloudSnapshotMeta, UserProfile } from '@/types/domain';

export type AccountStatus = 'guest' | 'loading' | 'signed-in' | 'disabled';
export type SyncState = 'idle' | 'syncing' | 'conflict' | 'offline' | 'error';

export interface UseAccountReturn {
  status: AccountStatus;
  profile: UserProfile | null;
  sync: {
    state: SyncState;
    lastSyncedAt: number | null;
  };
  conflictServerMeta: CloudSnapshotMeta | null;
  syncNow(): Promise<void>;
  resolveConflict(resolution: 'cloud' | 'local'): Promise<void>;
  refreshProfile(): Promise<void>;
}

export function useAccount(): UseAccountReturn {
  const { data: sessionData, isPending } = authClient.useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isDisabled, setIsDisabled] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [conflictServerMeta, setConflictServerMeta] = useState<CloudSnapshotMeta | null>(null);

  const baseRevisionRef = useRef<number>(0);
  const user = sessionData?.user;

  // Tải hồ sơ người dùng
  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }
    try {
      const res = await fetch('/api/account/profile');
      if (res.status === 503) {
        setIsDisabled(true);
        return;
      }
      if (res.ok) {
        const data = (await res.json()) as UserProfile;
        setProfile(data);
      }
    } catch {
      // Offline hoặc lỗi mạng
    }
  }, [user]);

  useEffect(() => {
    let active = true;
    if (user) {
      void fetch('/api/account/profile')
        .then(async (res) => {
          if (!active) return;
          if (res.status === 503) {
            setIsDisabled(true);
            return;
          }
          if (res.ok) {
            const data = (await res.json()) as UserProfile;
            if (active) setProfile(data);
          }
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [user]);

  // Đồng bộ dữ liệu lên cloud
  const syncNow = useCallback(async () => {
    if (!user || syncState === 'syncing') return;

    if (typeof window === 'undefined' || !window.localStorage) return;

    const userKey = getUserStorageKey(user.id);
    const localStateRaw =
      window.localStorage.getItem(userKey) || window.localStorage.getItem(DEFAULT_STORAGE_KEY);

    if (!localStateRaw) return;

    setSyncState('syncing');

    try {
      const res = await fetch('/api/account/data', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          state: localStateRaw,
          baseRevision: baseRevisionRef.current,
        }),
      });

      if (res.status === 409) {
        const body = await res.json();
        setConflictServerMeta(body.server as CloudSnapshotMeta);
        setSyncState('conflict');
        return;
      }

      if (res.ok) {
        const meta = (await res.json()) as CloudSnapshotMeta;
        baseRevisionRef.current = meta.revision;
        setLastSyncedAt(Date.now());
        setSyncState('idle');
        setConflictServerMeta(null);
      } else {
        setSyncState('error');
      }
    } catch {
      setSyncState('offline');
    }
  }, [user, syncState]);

  // Giải quyết xung đột
  const resolveConflict = useCallback(
    async (resolution: 'cloud' | 'local') => {
      if (!user) return;

      if (resolution === 'cloud') {
        // Lấy bản trên server
        try {
          const res = await fetch('/api/account/data');
          if (res.ok && res.status !== 204) {
            const data = await res.json();
            const userKey = getUserStorageKey(user.id);
            window.localStorage.setItem(userKey, data.state);
            baseRevisionRef.current = data.meta.revision;
            setLastSyncedAt(Date.now());
            setSyncState('idle');
            setConflictServerMeta(null);
            // Reload trang để nạp lại dữ liệu vào store
            window.location.reload();
          }
        } catch {
          setSyncState('offline');
        }
      } else {
        // Giữ bản local, ghi đè với revision của server
        const userKey = getUserStorageKey(user.id);
        const localStateRaw = window.localStorage.getItem(userKey);
        if (!localStateRaw || !conflictServerMeta) return;

        try {
          const res = await fetch('/api/account/data', {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              state: localStateRaw,
              baseRevision: conflictServerMeta.revision,
            }),
          });
          if (res.ok) {
            const meta = (await res.json()) as CloudSnapshotMeta;
            baseRevisionRef.current = meta.revision;
            setLastSyncedAt(Date.now());
            setSyncState('idle');
            setConflictServerMeta(null);
          }
        } catch {
          setSyncState('offline');
        }
      }
    },
    [user, conflictServerMeta],
  );

  let status: AccountStatus = 'loading';
  if (isDisabled) status = 'disabled';
  else if (isPending) status = 'loading';
  else if (user) status = 'signed-in';
  else status = 'guest';

  return {
    status,
    profile: user ? profile : null,
    sync: {
      state: syncState,
      lastSyncedAt,
    },
    conflictServerMeta,
    syncNow,
    resolveConflict,
    refreshProfile,
  };
}
