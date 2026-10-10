'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { UserPlus, ShieldCheck, ShieldOff } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageHeader, EmptyState } from '@/components/common/Cards';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { createStaffAccount, listStaff, updateStaffMembership, StaffListItem } from '@/lib/services';
import { UserRole } from '@/types';

function StaffPageContent() {
  const { membership: currentUser, membershipLoading } = useAuth();
  const isAdmin = currentUser?.role === 'admin' && currentUser?.status === 'active';

  const [staff, setStaff] = useState<StaffListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('staff');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actingUid, setActingUid] = useState<string | null>(null);

  const loadStaff = useCallback(() => {
    setIsLoading(true);
    setLoadError(null);
    listStaff()
      .then(setStaff)
      .catch((error) => setLoadError(error instanceof Error ? error.message : 'Không thể tải danh sách nhân viên.'))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (membershipLoading || !isAdmin) return;
    // External Firestore read — legitimate effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadStaff();
  }, [membershipLoading, isAdmin, loadStaff]);

  if (!membershipLoading && !isAdmin) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm font-semibold text-stone-900">Khu vực dành cho quản trị viên.</p>
        <p className="mt-1 text-xs text-stone-500">Tài khoản của bạn không có quyền quản lý nhân viên.</p>
        <Link href="/dashboard" className="mt-4 inline-block px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg">
          Về trang tổng quan
        </Link>
      </div>
    );
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreating) return;
    setCreateError(null);
    setActionMessage(null);
    setIsCreating(true);
    try {
      const created = await createStaffAccount({
        name: newName,
        email: newEmail,
        password: newPassword,
        role: newRole,
      });
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('staff');
      setShowCreateForm(false);
      setStaff((prev) => [created, ...prev]);
      setActionMessage(`Đã tạo tài khoản ${created.email} (${created.role}).`);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Không thể tạo tài khoản.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleMembershipChange = async (
    item: StaffListItem,
    changes: { role?: UserRole; status?: 'active' | 'inactive' }
  ) => {
    if (actingUid) return;
    if (item.id === currentUser?.id) {
      setActionMessage('Không thể tự đổi vai trò hoặc tự khóa tài khoản của chính mình.');
      return;
    }
    setActingUid(item.id);
    setActionMessage(null);
    try {
      await updateStaffMembership(item.id, changes);
      setStaff((prev) => prev.map((s) => (s.id === item.id ? { ...s, ...changes } : s)));
      setActionMessage(`Đã cập nhật ${item.email}.`);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Không thể cập nhật nhân viên.');
    } finally {
      setActingUid(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Nhân viên"
        subtitle="Tạo tài khoản đăng nhập và phân quyền nội bộ (chỉ admin)"
        backHref="/dashboard"
        action={
          <button
            type="button"
            onClick={() => { setCreateError(null); setShowCreateForm((shown) => !shown); }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Thêm nhân viên</span>
          </button>
        }
      />

      {actionMessage && (
        <div role="status" className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
          <span>{actionMessage}</span>
          <button type="button" onClick={() => setActionMessage(null)} className="font-bold cursor-pointer">×</button>
        </div>
      )}

      {showCreateForm && (
        <form onSubmit={handleCreate} className="mb-6 rounded-xl border border-stone-200 bg-white p-4 sm:p-6 shadow-2xs space-y-4">
          <h2 className="font-bold text-stone-900">Tạo tài khoản đăng nhập cho nhân viên</h2>
          <p className="text-xs text-stone-500">Tài khoản có thể đăng nhập ngay bằng Email & mật khẩu bên dưới. Không cần thao tác trên Firebase Console.</p>
          {createError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{createError}</p>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Tên nhân viên"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nguyễn Văn A"
              disabled={isCreating}
            />
            <Input
              label="Email đăng nhập"
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="nhanvien@tiemhoa.vn"
              disabled={isCreating}
            />
            <Input
              label="Mật khẩu (tối thiểu 6 ký tự)"
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nhập mật khẩu"
              disabled={isCreating}
            />
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">Vai trò</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
                disabled={isCreating}
                className="block w-full rounded-lg border border-stone-300 text-sm text-stone-900 bg-white min-h-[42px] px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="staff">Nhân viên (staff)</option>
                <option value="admin">Quản trị viên (admin)</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowCreateForm(false)} className="rounded-lg border border-stone-200 px-4 py-2 text-xs font-semibold cursor-pointer">Hủy</button>
            <Button type="submit" variant="primary" size="sm" isLoading={isCreating}>Tạo tài khoản</Button>
          </div>
        </form>
      )}

      {loadError ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          <p>Không thể tải danh sách nhân viên: {loadError}</p>
          <button type="button" onClick={loadStaff} className="mt-3 underline font-semibold cursor-pointer">Thử tải lại</button>
        </div>
      ) : isLoading ? (
        <p role="status" className="py-8 text-center text-sm text-stone-500">Đang tải danh sách nhân viên...</p>
      ) : staff.length === 0 ? (
        <EmptyState
          title="Chưa có nhân viên"
          description="Hãy thêm tài khoản đầu tiên cho tiệm."
          icon={UserPlus}
        />
      ) : (
        <div className="bg-white rounded-xl border border-stone-200/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50/70 border-b border-stone-200 text-xs font-semibold text-stone-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Nhân viên</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Vai trò</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-sm">
                {staff.map((item) => {
                  const isSelf = item.id === currentUser?.id;
                  const busy = actingUid === item.id;
                  return (
                    <tr key={item.id} className="hover:bg-stone-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-stone-900">
                        {item.name || item.email.split('@')[0]}
                        {isSelf && <span className="ml-2 text-[10px] font-semibold text-stone-400">(bạn)</span>}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-stone-600">{item.email}</td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${item.role === 'admin' ? 'bg-rose-100 text-rose-700' : 'bg-stone-100 text-stone-700'}`}>
                          {item.role === 'admin' ? <ShieldCheck className="w-3 h-3" /> : <ShieldOff className="w-3 h-3" />}
                          {item.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${item.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-200 text-stone-500'}`}>
                          {item.status === 'active' ? 'Đang hoạt động' : 'Đã khóa'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            disabled={busy || isSelf}
                            title={isSelf ? 'Không thể đổi vai trò của chính mình' : 'Đổi vai trò'}
                            onClick={() => handleMembershipChange(item, { role: item.role === 'admin' ? 'staff' : 'admin' })}
                            className="px-2.5 py-1 text-xs font-semibold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-md transition-colors disabled:opacity-40 cursor-pointer"
                          >
                            {item.role === 'admin' ? 'Hạ staff' : 'Lên admin'}
                          </button>
                          {item.status === 'active' ? (
                            <button
                              type="button"
                              disabled={busy || isSelf}
                              title={isSelf ? 'Không thể tự khóa tài khoản của mình' : 'Khóa tài khoản'}
                              onClick={() => handleMembershipChange(item, { status: 'inactive' })}
                              className="px-2.5 py-1 text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-md transition-colors disabled:opacity-40 cursor-pointer"
                            >
                              Khóa
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleMembershipChange(item, { status: 'active' })}
                              className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors disabled:opacity-40 cursor-pointer"
                            >
                              Mở khóa
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

export default function StaffPage() {
  return (
    <AppShell>
      <StaffPageContent />
    </AppShell>
  );
}
