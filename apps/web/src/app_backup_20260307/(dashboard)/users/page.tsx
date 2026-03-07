'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Plus, UserCheck, UserX, Loader2, Users, KeyRound } from 'lucide-react';

export default function UsersPage() {
  const [showForm, setShowForm] = useState(false);
  const [showResetForm, setShowResetForm] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [form, setForm] = useState({ full_name: '', mobile: '', password: '', role: 'pharmacist' });
  const qc = useQueryClient();

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/users', data).then((r) => r.data),
    onSuccess: () => {
      toast.success('User created');
      setShowForm(false);
      setForm({ full_name: '', mobile: '', password: '', role: 'pharmacist' });
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to create user'),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      api.patch(`/users/${id}`, { password }).then((r) => r.data),
    onSuccess: () => {
      toast.success('Password reset successfully');
      setShowResetForm(false);
      setSelectedUser(null);
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to reset password'),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/users/${id}/deactivate`),
    onSuccess: () => { toast.success('User deactivated'); qc.invalidateQueries({ queryKey: ['users'] }); },
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/users/${id}/activate`),
    onSuccess: () => { toast.success('User activated'); qc.invalidateQueries({ queryKey: ['users'] }); },
  });

  const handleResetPassword = () => {
    if (!newPassword) { toast.error('Enter a new password'); return; }
    if (newPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }
    resetPasswordMutation.mutate({ id: selectedUser.id, password: newPassword });
  };

  const roleColors: any = {
    owner: 'bg-purple-100 text-purple-700 border-purple-200',
    pharmacist: 'bg-primary-100 text-primary-700 border-primary-200',
    assistant: 'bg-gray-100 text-gray-600 border-gray-200',
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500">{users?.length || 0} users</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Mobile</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Joined</th>
              <th className="px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="text-center py-12"><Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" /></td></tr>
            ) : users?.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No users found
              </td></tr>
            ) : (
              users?.map((user: any) => (
                <tr key={user.id} className="table-row">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold text-sm flex-shrink-0">
                        {user.full_name?.[0]?.toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900">{user.full_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{user.mobile}</td>
                  <td className="px-4 py-3">
                    <span className={`badge capitalize ${roleColors[user.role] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${user.status === 'active' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{formatDate(user.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => { setSelectedUser(user); setShowResetForm(true); }}
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <KeyRound className="w-3.5 h-3.5" /> Reset Password
                      </button>
                      <span className="text-gray-200">|</span>
                      {user.status === 'active' ? (
                        <button
                          onClick={() => deactivateMutation.mutate(user.id)}
                          className="text-xs text-red-500 hover:underline flex items-center gap-1"
                        >
                          <UserX className="w-3.5 h-3.5" /> Deactivate
                        </button>
                      ) : (
                        <button
                          onClick={() => activateMutation.mutate(user.id)}
                          className="text-xs text-green-600 hover:underline flex items-center gap-1"
                        >
                          <UserCheck className="w-3.5 h-3.5" /> Activate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Reset Password Modal */}
      {showResetForm && selectedUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-5 border-b flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Reset Password</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  For: <span className="font-medium text-gray-700">{selectedUser.full_name}</span>
                  <span className="ml-2 font-mono text-xs text-gray-400">{selectedUser.mobile}</span>
                </p>
              </div>
              <button
                onClick={() => { setShowResetForm(false); setNewPassword(''); setConfirmPassword(''); }}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                &times;
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-700">
                  The user will need to use this new password on their next login. Make sure to inform them.
                </p>
              </div>
              <div>
                <label className="label">New Password *</label>
                <input
                  type="password"
                  className="input"
                  placeholder="Minimum 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="label">Confirm New Password *</label>
                <input
                  type="password"
                  className="input"
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                )}
                {confirmPassword && newPassword === confirmPassword && (
                  <p className="text-xs text-green-600 mt-1">✓ Passwords match</p>
                )}
              </div>
            </div>
            <div className="p-5 border-t flex gap-3">
              <button
                onClick={() => { setShowResetForm(false); setNewPassword(''); setConfirmPassword(''); }}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleResetPassword}
                disabled={resetPasswordMutation.isPending || !newPassword || newPassword !== confirmPassword}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {resetPasswordMutation.isPending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <KeyRound className="w-4 h-4" />
                }
                Reset Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-5 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Add New User</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="label">Full Name *</label>
                <input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="e.g. Dr. Rajan Kumar" />
              </div>
              <div>
                <label className="label">Mobile Number *</label>
                <input className="input" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} placeholder="10-digit mobile number" maxLength={10} />
              </div>
              <div>
                <label className="label">Password *</label>
                <input type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 6 characters" />
              </div>
              <div>
                <label className="label">Role *</label>
                <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="pharmacist">Pharmacist</option>
                  <option value="assistant">Assistant</option>
                  <option value="owner">Owner</option>
                </select>
              </div>
            </div>
            <div className="p-5 border-t flex gap-3">
              <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={() => createMutation.mutate(form)}
                disabled={createMutation.isPending || !form.full_name || !form.mobile || !form.password}
                className="btn-primary flex-1"
              >
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : null}
                Create User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
