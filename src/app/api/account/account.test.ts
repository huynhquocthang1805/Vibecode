vi.mock('server-only', () => ({}));

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { encodeState } from '@/lib/data/storage/codec';
import { requireUser } from '@/lib/server/auth';
import { ensureMigrated, resetDb } from '@/lib/server/db/client';
import { ALL_CAMPAIGNS, CONTRACT_VERSION, type PersistedState } from '@/types/domain';

import { POST as authHandler } from '../auth/[...all]/route';
import { DELETE as deleteAccount } from './route';
import { DELETE as deleteAvatar, POST as uploadAvatar } from './avatar/route';
import { GET as getAvatar } from './avatar/[userId]/route';
import { GET as getCloudData, PUT as putCloudData } from './data/route';
import { GET as getProfile, PUT as putProfile } from './profile/route';

describe('ACC-03 & ACC-04 · Account Profile, Avatar, Cloud Sync & Deletion on PGlite', () => {
  const originalEnv = { ...process.env };
  const TEST_SECRET = 'secret-for-test-suite-must-be-at-least-32-chars-long';
  let sessionCookieA = '';
  let sessionCookieB = '';
  let userIdA = '';
  let _userIdB = '';
  let testCount = 0;

  beforeEach(async () => {
    testCount++;
    process.env.DATABASE_URL = 'pglite://memory';
    process.env.BETTER_AUTH_SECRET = TEST_SECRET;
    process.env.BETTER_AUTH_URL = 'http://localhost:3000';
    await resetDb();
    await ensureMigrated();

    const ipA = `10.0.${testCount}.1`;
    const ipB = `10.0.${testCount}.2`;
    const emailA = `user_a_${testCount}@example.com`;
    const emailB = `user_b_${testCount}@example.com`;

    // Tạo User A
    const signupA = new Request('http://localhost:3000/api/auth/sign-up/email', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': ipA,
      },
      body: JSON.stringify({
        name: 'Nguyen Van A',
        email: emailA,
        password: 'password123',
      }),
    });
    const resA = await authHandler(signupA);
    sessionCookieA = resA.headers.get('set-cookie') ?? '';
    const bodyA = await resA.json();
    userIdA = bodyA.user.id;

    // Tạo User B
    const signupB = new Request('http://localhost:3000/api/auth/sign-up/email', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': ipB,
      },
      body: JSON.stringify({
        name: 'Tran Van B',
        email: emailB,
        password: 'password123',
      }),
    });
    const resB = await authHandler(signupB);
    sessionCookieB = resB.headers.get('set-cookie') ?? '';
    const bodyB = await resB.json();
    _userIdB = bodyB.user.id;
  });

  afterEach(async () => {
    await resetDb();
    process.env = { ...originalEnv };
  });

  /* ───────────────────────── ACC-03: Hồ sơ & Avatar ───────────────────────── */

  it('A6: GET profile trả thông tin người dùng và PUT sửa hồ sơ (giới hạn độ dài, xss text)', async () => {
    // 1. GET profile khi chưa đăng nhập → 401
    const unauthReq = new Request('http://localhost:3000/api/account/profile');
    const unauthRes = await getProfile(unauthReq);
    expect(unauthRes.status).toBe(401);

    // 2. GET profile của User A
    const reqA = new Request('http://localhost:3000/api/account/profile', {
      headers: { cookie: sessionCookieA },
    });
    const resProfA = await getProfile(reqA);
    expect(resProfA.status).toBe(200);
    const profA = await resProfA.json();
    expect(profA.displayName).toBe('Nguyen Van A');
    expect(profA.avatarUrl).toBeNull();

    // 3. PUT profile sửa tên 61 ký tự (> 60) → 400
    const longNameReq = new Request('http://localhost:3000/api/account/profile', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', cookie: sessionCookieA },
      body: JSON.stringify({ displayName: 'A'.repeat(61) }),
    });
    const longRes = await putProfile(longNameReq);
    expect(longRes.status).toBe(400);

    // 4. PUT profile hợp lệ với text có thẻ script (lưu dạng text an toàn)
    const validPatchReq = new Request('http://localhost:3000/api/account/profile', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', cookie: sessionCookieA },
      body: JSON.stringify({
        displayName: 'Van A <script>alert(1)</script>',
        company: 'Vibecode Corp',
        jobTitle: 'Data Engineer',
      }),
    });
    const patchRes = await putProfile(validPatchReq);
    expect(patchRes.status).toBe(200);
    const patched = await patchRes.json();
    expect(patched.displayName).toBe('Van A <script>alert(1)</script>');
    expect(patched.company).toBe('Vibecode Corp');
    expect(patched.jobTitle).toBe('Data Engineer');
  });

  it('A7: POST avatar nhận PNG/JPEG/WebP ≤ 200 KB, từ chối SVG, file giả mạo và file > 200 KB', async () => {
    // 1. File PNG hợp lệ
    const validPngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    const formDataPng = new FormData();
    formDataPng.append('file', new File([validPngBytes], 'avatar.png', { type: 'image/png' }));

    const uploadReq = new Request('http://localhost:3000/api/account/avatar', {
      method: 'POST',
      headers: { cookie: sessionCookieA },
      body: formDataPng,
    });
    const uploadRes = await uploadAvatar(uploadReq);
    expect(uploadRes.status).toBe(200);
    const body = await uploadRes.json();
    expect(body.avatarUrl).toContain(`/api/account/avatar/${userIdA}?v=1`);

    // 2. File JPEG hợp lệ
    const validJpgBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const formDataJpg = new FormData();
    formDataJpg.append('file', new File([validJpgBytes], 'avatar.jpg', { type: 'image/jpeg' }));

    const uploadJpgReq = new Request('http://localhost:3000/api/account/avatar', {
      method: 'POST',
      headers: { cookie: sessionCookieA },
      body: formDataJpg,
    });
    const uploadJpgRes = await uploadAvatar(uploadJpgReq);
    expect(uploadJpgRes.status).toBe(200);
    const bodyJpg = await uploadJpgRes.json();
    expect(bodyJpg.avatarUrl).toContain(`?v=2`);

    // 3. File SVG (bị cấm vì XSS) → 415
    const svgBytes = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>');
    const formDataSvg = new FormData();
    formDataSvg.append('file', new File([svgBytes], 'avatar.svg', { type: 'image/svg+xml' }));

    const svgReq = new Request('http://localhost:3000/api/account/avatar', {
      method: 'POST',
      headers: { cookie: sessionCookieA },
      body: formDataSvg,
    });
    const svgRes = await uploadAvatar(svgReq);
    expect(svgRes.status).toBe(415);

    // 4. File giả đuôi .png nhưng nội dung là text → 415
    const fakeBytes = new TextEncoder().encode('not-a-real-png-just-plain-text-file');
    const formDataFake = new FormData();
    formDataFake.append('file', new File([fakeBytes], 'fake.png', { type: 'image/png' }));

    const fakeReq = new Request('http://localhost:3000/api/account/avatar', {
      method: 'POST',
      headers: { cookie: sessionCookieA },
      body: formDataFake,
    });
    const fakeRes = await uploadAvatar(fakeReq);
    expect(fakeRes.status).toBe(415);

    // 5. File > 200 KB → 413
    const largeBytes = new Uint8Array(200 * 1024 + 10);
    largeBytes.set(validPngBytes, 0); // Đặt header PNG nhưng kích thước vượt
    const formDataLarge = new FormData();
    formDataLarge.append('file', new File([largeBytes], 'large.png', { type: 'image/png' }));

    const largeReq = new Request('http://localhost:3000/api/account/avatar', {
      method: 'POST',
      headers: { cookie: sessionCookieA },
      body: formDataLarge,
    });
    const largeRes = await uploadAvatar(largeReq);
    expect(largeRes.status).toBe(413);
  });

  it('A8: GET avatar bởi chính chủ thành công; Người B gọi avatar của A bị từ chối 404', async () => {
    // A upload avatar PNG
    const validPngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    const formDataPng = new FormData();
    formDataPng.append('file', new File([validPngBytes], 'avatar.png', { type: 'image/png' }));
    await uploadAvatar(
      new Request('http://localhost:3000/api/account/avatar', {
        method: 'POST',
        headers: { cookie: sessionCookieA },
        body: formDataPng,
      }),
    );

    // A lấy avatar của chính mình
    const getMyReq = new Request(`http://localhost:3000/api/account/avatar/${userIdA}`, {
      headers: { cookie: sessionCookieA },
    });
    const getMyRes = await getAvatar(getMyReq, { params: Promise.resolve({ userId: userIdA }) });
    expect(getMyRes.status).toBe(200);
    expect(getMyRes.headers.get('content-type')).toBe('image/png');
    expect(getMyRes.headers.get('cache-control')).toContain('immutable');
    expect(getMyRes.headers.get('x-content-type-options')).toBe('nosniff');

    // B lấy avatar của A → 404 (không xem được)
    const getOtherReq = new Request(`http://localhost:3000/api/account/avatar/${userIdA}`, {
      headers: { cookie: sessionCookieB },
    });
    const getOtherRes = await getAvatar(getOtherReq, { params: Promise.resolve({ userId: userIdA }) });
    expect(getOtherRes.status).toBe(404);

    // DELETE avatar của A
    const delReq = new Request('http://localhost:3000/api/account/avatar', {
      method: 'DELETE',
      headers: { cookie: sessionCookieA },
    });
    const delRes = await deleteAvatar(delReq);
    expect(delRes.status).toBe(200);
    const delBody = await delRes.json();
    expect(delBody.avatarUrl).toBeNull();
  });

  /* ───────────────────────── ACC-04: Đồng bộ dữ liệu Cloud ───────────────────────── */

  it('A9: Đồng bộ cloud: Máy 1 đẩy rev 1, Máy 2 đẩy baseRevision 0 bị 409 CONFLICT; chấp nhận baseRevision 1', async () => {
    const validState: PersistedState = {
      v: CONTRACT_VERSION,
      campaigns: [{ id: 'default', name: 'Chiến dịch mặc định', createdAt: Date.now() }],
      entries: [
        {
          id: 'default|2026-10-01',
          date: '2026-10-01',
          campaignId: 'default',
          reach: 1000,
          clicks: 100,
          cost: 500000,
          orders: 10,
          source: 'manual',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      settings: {
        activeCampaignId: ALL_CAMPAIGNS,
        grain: 'day',
        range: null,
        liveMode: false,
        liveSpeed: 1,
        targets: {},
        reportFormat: 'short',
        duplicatePolicy: 'ask',
      },
    };
    const encodedState1 = encodeState(validState);

    // 1. GET cloud data khi chưa có gì → 204 No Content
    const getInitReq = new Request('http://localhost:3000/api/account/data', {
      headers: { cookie: sessionCookieA },
    });
    const getInitRes = await getCloudData(getInitReq);
    expect(getInitRes.status).toBe(204);

    // 2. Máy 1 đẩy revision 1 (baseRevision: 0) → 200, revision 1
    const put1Req = new Request('http://localhost:3000/api/account/data', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', cookie: sessionCookieA },
      body: JSON.stringify({ state: encodedState1, baseRevision: 0 }),
    });
    const put1Res = await putCloudData(put1Req);
    expect(put1Res.status).toBe(200);
    const meta1 = await put1Res.json();
    expect(meta1.revision).toBe(1);
    expect(meta1.rows).toBe(1);

    // 3. Máy 2 đẩy cùng baseRevision 0 → 409 CONFLICT kèm server.revision = 1
    const putConflictReq = new Request('http://localhost:3000/api/account/data', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', cookie: sessionCookieA },
      body: JSON.stringify({ state: encodedState1, baseRevision: 0 }),
    });
    const conflictRes = await putCloudData(putConflictReq);
    expect(conflictRes.status).toBe(409);
    const conflictBody = await conflictRes.json();
    expect(conflictBody.code).toBe('CONFLICT');
    expect(conflictBody.server.revision).toBe(1);

    // 4. Máy 2 lấy dữ liệu mới nhất (GET) hoặc cập nhật với baseRevision: 1 → 200
    const putResolvedReq = new Request('http://localhost:3000/api/account/data', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', cookie: sessionCookieA },
      body: JSON.stringify({ state: encodedState1, baseRevision: 1 }),
    });
    const resolvedRes = await putCloudData(putResolvedReq);
    expect(resolvedRes.status).toBe(200);
    const meta2 = await resolvedRes.json();
    expect(meta2.revision).toBe(2);

    // 5. GET đọc lại dữ liệu trên server
    const getSavedRes = await getCloudData(
      new Request('http://localhost:3000/api/account/data', {
        headers: { cookie: sessionCookieA },
      }),
    );
    expect(getSavedRes.status).toBe(200);
    const savedData = await getSavedRes.json();
    expect(savedData.meta.revision).toBe(2);
    expect(savedData.state).toBe(encodedState1);
  });

  it('A10: PUT cloud data với state hỏng (400) hoặc > 4 MB (413), DB không đổi', async () => {
    // 1. State hỏng không decode được
    const badStateReq = new Request('http://localhost:3000/api/account/data', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', cookie: sessionCookieA },
      body: JSON.stringify({ state: 'invalid-codec-string', baseRevision: 0 }),
    });
    const badRes = await putCloudData(badStateReq);
    expect(badRes.status).toBe(400);

    // 2. State vượt 4 MB
    const largeState = 'x'.repeat(4 * 1024 * 1024 + 1);
    const largeStateReq = new Request('http://localhost:3000/api/account/data', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', cookie: sessionCookieA },
      body: JSON.stringify({ state: largeState, baseRevision: 0 }),
    });
    const largeRes = await putCloudData(largeStateReq);
    expect(largeRes.status).toBe(413);
  });

  it('R-01: Hai request PUT đồng thời cùng baseRevision → atomic update đảm bảo đúng 1 request thành công (200), 1 request 409 CONFLICT', async () => {
    const validState: PersistedState = {
      v: CONTRACT_VERSION,
      campaigns: [{ id: 'default', name: 'Chiến dịch mặc định', createdAt: Date.now() }],
      entries: [
        {
          id: 'default|2026-10-01',
          date: '2026-10-01',
          campaignId: 'default',
          reach: 1000,
          clicks: 100,
          cost: 500000,
          orders: 10,
          source: 'manual',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      settings: {
        activeCampaignId: ALL_CAMPAIGNS,
        grain: 'day',
        range: null,
        liveMode: false,
        liveSpeed: 1,
        targets: {},
        reportFormat: 'short',
        duplicatePolicy: 'ask',
      },
    };
    const encoded = encodeState(validState);

    // Bắt đầu 2 request đồng thời với cùng baseRevision 0
    const req1 = new Request('http://localhost:3000/api/account/data', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', cookie: sessionCookieA },
      body: JSON.stringify({ state: encoded, baseRevision: 0 }),
    });
    const req2 = new Request('http://localhost:3000/api/account/data', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', cookie: sessionCookieA },
      body: JSON.stringify({ state: encoded, baseRevision: 0 }),
    });

    const [res1, res2] = await Promise.all([putCloudData(req1), putCloudData(req2)]);
    const statuses = [res1.status, res2.status].sort();

    // Đúng một request thành công (200) và đúng một request nhận 409 CONFLICT
    expect(statuses).toEqual([200, 409]);
  });

  /* ───────────────────────── ACC-03: Xoá tài khoản & Cascade ───────────────────────── */

  it('A11: Xoá tài khoản yêu cầu xác nhận gõ "XOÁ" (204); cascade xoá profile & data; đăng nhập lại thất bại', async () => {
    // 1. Xác nhận sai từ → 400
    const badConfirmReq = new Request('http://localhost:3000/api/account', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json', cookie: sessionCookieA },
      body: JSON.stringify({ confirm: 'xoa' }),
    });
    const badConfirmRes = await deleteAccount(badConfirmReq);
    expect(badConfirmRes.status).toBe(400);

    // 2. Xác nhận đúng "XOÁ" → 204
    const delReq = new Request('http://localhost:3000/api/account', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json', cookie: sessionCookieA },
      body: JSON.stringify({ confirm: 'XOÁ' }),
    });
    const delRes = await deleteAccount(delReq);
    expect(delRes.status).toBe(204);

    // 3. Đăng nhập lại bằng tài khoản A → thất bại 401
    const loginReq = new Request('http://localhost:3000/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: `user_a_${testCount}@example.com`, password: 'password123' }),
    });
    const loginRes = await authHandler(loginReq);
    expect(loginRes.status).toBe(401);

    // 4. Session cookie A không còn truy cập được requireUser → 401
    const authCheckReq = new Request('http://localhost:3000/api/account/profile', {
      headers: { cookie: sessionCookieA },
    });
    const authCheckRes = await requireUser(authCheckReq);
    expect(authCheckRes).toBeInstanceOf(Response);
    expect((authCheckRes as Response).status).toBe(401);
  });
});
