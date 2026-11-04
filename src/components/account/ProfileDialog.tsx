'use client';

// Owner: data-engineer (Huy) — ACC-05: Modal chỉnh sửa hồ sơ, tải/nén avatar & xoá tài khoản (A12)
import React, { useRef, useState } from 'react';
import { Camera, Loader2, Trash2 } from 'lucide-react';

import { authClient } from '@/lib/auth-client';
import { LIMITS_ACCOUNT, type UserProfile } from '@/types/domain';

import { compressAvatar } from './compressAvatar';

interface ProfileDialogProps {
  isOpen: boolean;
  profile: UserProfile | null;
  onClose: () => void;
  onUpdated: () => void;
}

export function ProfileDialog({ isOpen, profile, onClose, onUpdated }: ProfileDialogProps) {
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [company, setCompany] = useState(profile?.company ?? '');
  const [jobTitle, setJobTitle] = useState(profile?.jobTitle ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || !profile) return null;

  // Cập nhật thông tin text profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/account/profile', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          displayName: displayName.trim(),
          company: company.trim() || null,
          jobTitle: jobTitle.trim() || null,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Lỗi cập nhật hồ sơ.' }));
        setErrorMessage(body.message || 'Lỗi cập nhật hồ sơ.');
        setIsSaving(false);
        return;
      }

      setIsSaving(false);
      onUpdated();
      onClose();
    } catch {
      setErrorMessage('Không thể kết nối đến máy chủ.');
      setIsSaving(false);
    }
  };

  // Upload avatar (tự động nén qua canvas trước khi gửi)
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    setErrorMessage(null);

    try {
      // Nén ảnh về tối đa 256×256 px và xuất WebP
      const compressedBlob = await compressAvatar(file, LIMITS_ACCOUNT.AVATAR_SIZE_PX);

      const formData = new FormData();
      formData.append('file', compressedBlob, 'avatar.webp');

      const res = await fetch('/api/account/avatar', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Lỗi tải ảnh lên.' }));
        setErrorMessage(body.message || 'Lỗi tải ảnh lên.');
        setIsUploadingAvatar(false);
        return;
      }

      setIsUploadingAvatar(false);
      onUpdated();
    } catch (err) {
      setErrorMessage(String(err));
      setIsUploadingAvatar(false);
    }
  };

  // Xoá avatar
  const handleDeleteAvatar = async () => {
    setIsUploadingAvatar(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/account/avatar', { method: 'DELETE' });
      if (res.ok) {
        setIsUploadingAvatar(false);
        onUpdated();
      } else {
        setErrorMessage('Không thể xoá ảnh đại diện.');
        setIsUploadingAvatar(false);
      }
    } catch {
      setErrorMessage('Lỗi mạng khi xoá ảnh.');
      setIsUploadingAvatar(false);
    }
  };

  // Xoá tài khoản (yêu cầu gõ đúng "XOÁ")
  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'XOÁ') return;

    setIsDeletingAccount(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/account', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ confirm: 'XOÁ' }),
      });

      if (res.status === 204) {
        await authClient.signOut();
        setIsDeletingAccount(false);
        onClose();
        window.location.reload();
      } else {
        const body = await res.json().catch(() => ({ message: 'Không thể xoá tài khoản.' }));
        setErrorMessage(body.message || 'Lỗi xoá tài khoản.');
        setIsDeletingAccount(false);
      }
    } catch {
      setErrorMessage('Lỗi kết nối khi xoá tài khoản.');
      setIsDeletingAccount(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-[375px] sm:max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
          <h2 id="profile-dialog-title" className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            Hồ sơ người dùng
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 touch-manipulation"
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        {/* Khu vực ảnh đại diện */}
        <div className="mt-5 flex flex-col items-center sm:flex-row sm:space-x-5">
          <div className="relative">
            {profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatarUrl}
                alt={profile.displayName}
                className="h-20 w-20 rounded-full object-cover border-2 border-zinc-200 dark:border-zinc-700"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 text-2xl font-bold text-blue-600 dark:bg-blue-950 dark:text-blue-300">
                {(profile.displayName || profile.email)[0]?.toUpperCase()}
              </div>
            )}
            {isUploadingAvatar && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                <Loader2 className="h-6 w-6 animate-spin text-white" />
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-col space-y-2 sm:mt-0">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleAvatarChange}
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
            />
            <button
              type="button"
              disabled={isUploadingAvatar}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 shadow-xs hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 min-h-[44px] touch-manipulation"
            >
              <Camera className="mr-1.5 h-4 w-4" /> Đổi ảnh đại diện
            </button>
            {profile.avatarUrl && (
              <button
                type="button"
                disabled={isUploadingAvatar}
                onClick={handleDeleteAvatar}
                className="inline-flex items-center justify-center rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40 min-h-[44px] touch-manipulation"
              >
                <Trash2 className="mr-1.5 h-4 w-4" /> Xoá ảnh
              </button>
            )}
          </div>
        </div>

        {/* Form thông tin cá nhân */}
        <form onSubmit={handleSaveProfile} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="profile-display-name"
              className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300"
            >
              Tên hiển thị (tối đa {LIMITS_ACCOUNT.MAX_DISPLAY_NAME} ký tự)
            </label>
            <input
              id="profile-display-name"
              type="text"
              required
              maxLength={LIMITS_ACCOUNT.MAX_DISPLAY_NAME}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm shadow-xs focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 min-h-[44px]"
            />
          </div>

          <div>
            <label
              htmlFor="profile-company"
              className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300"
            >
              Công ty / Tổ chức (tối đa {LIMITS_ACCOUNT.MAX_COMPANY} ký tự)
            </label>
            <input
              id="profile-company"
              type="text"
              maxLength={LIMITS_ACCOUNT.MAX_COMPANY}
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="VD: Tech Group"
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm shadow-xs focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 min-h-[44px]"
            />
          </div>

          <div>
            <label
              htmlFor="profile-job-title"
              className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300"
            >
              Chức danh (tối đa {LIMITS_ACCOUNT.MAX_JOB_TITLE} ký tự)
            </label>
            <input
              id="profile-job-title"
              type="text"
              maxLength={LIMITS_ACCOUNT.MAX_JOB_TITLE}
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="VD: Senior Data Engineer"
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm shadow-xs focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 min-h-[44px]"
            />
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="rounded-lg bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950/50 dark:text-red-400"
            >
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:opacity-50 min-h-[44px] touch-manipulation cursor-pointer"
          >
            {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Lưu thay đổi'}
          </button>
        </form>

        {/* Vùng nguy hiểm: Xoá tài khoản */}
        <div className="mt-8 border-t border-red-200 pt-5 dark:border-red-950/60">
          <h3 className="text-sm font-bold text-red-600 dark:text-red-400">Vùng nguy hiểm</h3>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Hành động này sẽ xoá vĩnh viễn tài khoản và toàn bộ dữ liệu KPI của bạn trên máy chủ (không thể khôi phục).
          </p>
          <div className="mt-3 space-y-2">
            <label
              htmlFor="confirm-delete-input"
              className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
            >
              Nhập chính xác chữ <strong className="text-red-600 font-bold">XOÁ</strong> để xác nhận:
            </label>
            <input
              id="confirm-delete-input"
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder='Gõ "XOÁ"'
              className="block w-full rounded-lg border border-red-300 px-3 py-2 text-sm shadow-xs focus:border-red-500 focus:outline-hidden dark:border-red-800 dark:bg-zinc-800 dark:text-zinc-100 min-h-[44px]"
            />
            <button
              type="button"
              disabled={deleteConfirmText !== 'XOÁ' || isDeletingAccount}
              onClick={handleDeleteAccount}
              className="flex w-full items-center justify-center rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40 min-h-[44px] touch-manipulation"
            >
              {isDeletingAccount ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Xoá vĩnh viễn tài khoản'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
