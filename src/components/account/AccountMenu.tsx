'use client';

// Owner: data-engineer (Huy) — ACC-05: Menu tài khoản, avatar, trạng thái đồng bộ & đăng xuất (A12)
import React, { useRef, useState, useEffect } from 'react';
import {
  AlertCircle,
  CheckCircle,
  Cloud,
  Loader2,
  LogIn,
  LogOut,
  RefreshCw,
  User,
  WifiOff,
} from 'lucide-react';

import { authClient } from '@/lib/auth-client';
import { clearUserStorageData } from '@/lib/data/storage/userStorage';

import { AuthDialog } from './AuthDialog';
import { ConflictDialog } from './ConflictDialog';
import { ProfileDialog } from './ProfileDialog';
import { useAccount } from './useAccount';

export function AccountMenu() {
  const {
    status,
    profile,
    sync,
    conflictServerMeta,
    syncNow,
    resolveConflict,
    refreshProfile,
  } = useAccount();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isConflictDismissed, setIsConflictDismissed] = useState(false);
  const [clearLocalOnSignout, setClearLocalOnSignout] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  // Đóng dropdown khi click bên ngoài
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isConflictOpen = sync.state === 'conflict' && !isConflictDismissed;

  // A1: Khi server chưa cấu hình tài khoản (disabled) → ẩn nút đăng nhập, không làm phiền P0
  if (status === 'disabled') {
    return null;
  }

  // Đang tải phiên
  if (status === 'loading') {
    return (
      <div className="flex h-11 w-11 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
      </div>
    );
  }

  // Khách chưa đăng nhập: hiện nút "Đăng nhập" (≥ 44 px)
  if (status === 'guest') {
    return (
      <>
        <button
          type="button"
          onClick={() => setIsAuthOpen(true)}
          className="inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 shadow-xs hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 min-h-[44px] touch-manipulation cursor-pointer"
        >
          <LogIn className="mr-1.5 h-4 w-4" /> Đăng nhập
        </button>

        <AuthDialog
          isOpen={isAuthOpen}
          onClose={() => setIsAuthOpen(false)}
          onSuccess={() => void refreshProfile()}
        />
      </>
    );
  }

  // Đã đăng nhập
  const handleSignOut = async () => {
    if (profile?.id && clearLocalOnSignout) {
      clearUserStorageData(profile.id);
    }
    await authClient.signOut();
    setIsMenuOpen(false);
    window.location.reload();
  };

  const displayName = profile?.displayName || 'Người dùng';
  const initial = displayName[0]?.toUpperCase() || 'U';

  return (
    <div className="relative" ref={menuRef}>
      {/* Nút avatar tròn kích hoạt menu (touch target ≥ 44 px) */}
      <button
        type="button"
        onClick={() => setIsMenuOpen((prev) => !prev)}
        aria-expanded={isMenuOpen}
        aria-haspopup="true"
        className="flex items-center space-x-2 rounded-full p-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 min-h-[44px] min-w-[44px] touch-manipulation cursor-pointer"
      >
        {profile?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatarUrl}
            alt={displayName}
            className="h-8 w-8 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white shadow-xs">
            {initial}
          </div>
        )}
        <span className="hidden text-xs font-medium text-zinc-700 dark:text-zinc-300 md:inline-block max-w-[120px] truncate">
          {displayName}
        </span>
      </button>

      {/* Dropdown Menu */}
      {isMenuOpen && (
        <div className="absolute right-0 mt-2 w-72 origin-top-right rounded-2xl bg-white p-3 shadow-2xl border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900 z-50">
          <div className="border-b border-zinc-100 pb-3 dark:border-zinc-800">
            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">{displayName}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{profile?.email}</p>
            {profile?.company && (
              <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500 truncate">
                {profile.company} {profile.jobTitle ? `• ${profile.jobTitle}` : ''}
              </p>
            )}
          </div>

          {/* Trạng thái đồng bộ */}
          <div className="my-2.5 flex items-center justify-between rounded-lg bg-zinc-50 p-2 text-xs dark:bg-zinc-800/60">
            <div className="flex items-center space-x-2">
              {sync.state === 'syncing' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  <span className="text-zinc-600 dark:text-zinc-300">Đang đồng bộ...</span>
                </>
              ) : sync.state === 'conflict' ? (
                <>
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <span className="text-amber-600 font-medium">Xung đột dữ liệu</span>
                </>
              ) : sync.state === 'offline' ? (
                <>
                  <WifiOff className="h-4 w-4 text-zinc-400" />
                  <span className="text-zinc-500">Chưa đồng bộ (ngoại tuyến)</span>
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <span className="text-zinc-600 dark:text-zinc-300">Đã đồng bộ</span>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => void syncNow()}
              disabled={sync.state === 'syncing'}
              className="flex h-11 w-11 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-700"
              title="Đồng bộ ngay"
              aria-label="Đồng bộ ngay"
            >
              <RefreshCw className={`h-4 w-4 ${sync.state === 'syncing' ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Các mục menu */}
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
                setIsProfileOpen(true);
              }}
              className="flex w-full items-center rounded-lg px-3 py-2.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800 min-h-[44px] touch-manipulation text-left cursor-pointer"
            >
              <User className="mr-2.5 h-4 w-4 text-zinc-500" /> Hồ sơ cá nhân
            </button>

            {sync.state === 'conflict' && (
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  setIsConflictDismissed(false);
                }}
                className="flex w-full items-center rounded-lg px-3 py-2.5 text-xs font-medium text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 min-h-[44px] touch-manipulation text-left cursor-pointer"
              >
                <Cloud className="mr-2.5 h-4 w-4 text-amber-600" /> Xử lý xung đột
              </button>
            )}

            <div className="border-t border-zinc-100 pt-2 dark:border-zinc-800">
              <label className="flex items-center space-x-2 px-3 py-1.5 text-xs text-zinc-500 dark:text-zinc-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={clearLocalOnSignout}
                  onChange={(e) => setClearLocalOnSignout(e.target.checked)}
                  className="rounded-sm border-zinc-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Xoá dữ liệu trên máy này khi đăng xuất</span>
              </label>

              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full items-center rounded-lg px-3 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40 min-h-[44px] touch-manipulation text-left cursor-pointer"
              >
                <LogOut className="mr-2.5 h-4 w-4 text-red-500" /> Đăng xuất
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Các dialog */}
      <ProfileDialog
        isOpen={isProfileOpen}
        profile={profile}
        onClose={() => setIsProfileOpen(false)}
        onUpdated={() => void refreshProfile()}
      />

      <ConflictDialog
        isOpen={isConflictOpen}
        serverMeta={conflictServerMeta}
        onResolve={async (res) => {
          await resolveConflict(res);
          setIsConflictDismissed(true);
        }}
        onClose={() => setIsConflictDismissed(true)}
      />
    </div>
  );
}
