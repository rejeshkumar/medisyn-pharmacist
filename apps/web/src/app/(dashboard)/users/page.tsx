'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Plus, UserCheck, UserX, Loader2, Users, KeyRound, X, Pencil } from 'lucide-react';

const ALL_ROLES = [
  { value: 'owner',        label: 'Owner' },
  { value: 'pharmacist',   label: 'Pharmacist' },
  { value: 'assistant',    label: 'Assistant' },
  { value: 'doctor',       label: 'Doctor' },
  { value: 'receptionist',   label: 'Receptionist' },
  { value: 'office_manager', label: 'Office Manager' },
  { value: 'nurse',        label: 'Nurse' },
];

const roleColors: Record<string, string> = {
  owner:        'bg-purple-100 text-purple-700 border-purple-200',
  pharmacist:   'bg-primary-100 text-primary-700 border-primary-200',
  assistant:    'bg-gray-100 text-gray-600 border-gray-200',
  doctor:       'bg-teal-100 text-teal-700 border-teal-200',
  receptionist:   'bg-blue-100 text-blue-700 border-blue-200',
  office_manager: 'bg-violet-100 text-violet-700 border-violet-200',
  nurse:        'bg-pink-100 text-pink-700 border-pink-200',
};

// Show all roles a user has (roles[] array, fallback to single role)
function RoleBadges({ user }: { user: any }) {
  const roles: string[] = user.roles?.length ? user.roles : [user.role];
  return (
    <div className="flex flex-wrap gap-1">
      {roles.map(r => (
        <span key={r} className={`badge capitalize text-xs ${roleColors[r] || 'bg-gray-100'}`}>{r}</span>
      ))}
    </div>
  );
}

// Multi-role checkbox picker
function RolePicker({ selected, onChange }: { selected: string[]; onChange: (roles: string[]) => void }) {
  const toggle = (role: string) => {
    onChange(selected.includes(role) ? selected.filter(r => r !== role) : [...selected, role]);
  };
  return (
    <div className="grid grid-cols-2 gap-2">
      {ALL_ROLES.map(r => (
        <label key={r.value} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors text-sm ${
          selected.includes(r.value)
            ? 'border-indigo-400 bg-indigo-50 text-indigo-700 font-medium'
            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
        }`}>
          <input type="checkbox" checked={selected.includes(r.value)} onChange={() => toggle(r.value)} className="hidden" />
          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
            selected.includes(r.value) ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300'
          }`}>
            {selected.includes(r.value) && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </div>
          {r.label}
        </label>
      ))}
    </div>
  );
}

export default function UsersPage() {
  const [showForm, setShowForm]           = useState(false);
  const [showEditForm, setShowEditForm]   = useState(false);
  const [showResetForm, setShowResetForm] = useState(false);
  const [selectedUser, setSelectedUser]   = useState<any>(null);
  const [newPassword, setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [form, setForm] = useState({
    full_name: '', mobile: '', password: '',
    role: 'pharmacist', roles: ['pharmacist'],
  });
  const [editForm, setEditForm] = useState({
    full_name: '', mobile: '', role: '', roles: [] as string[],
  });

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
      setForm({ full_name: '', mobile: '', password: '', role: 'pharmacist', roles: ['pharmacist'] });
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to create user'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/users/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      toast.success('User updated');
      setShowEditForm(false);
      setSelectedUser(null);
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to update user'),
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

  const openEdit = (user: any) => {
    setSelectedUser(user);
    const existingRoles: string[] = user.roles?.length ? user.roles : [user.role];
    setEditForm({ full_name: user.full_name, mobile: user.mobile, role: user.role, roles: existingRoles });
    setShowEditForm(true);
  };

  const handleResetPassword = () => {
    if (!newPassword) { toast.error('Enter a new password'); return; }
    if (newPassword.length < 6) { toast.error('Minimum 6 characters'); return; }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }
    resetPasswordMutation.mutate({ id: selectedUser.id, password: newPassword });
  };

  // Keep primary role in sync with roles array
  const handleCreateRoles = (roles: string[]) => {
    setForm(f => ({ ...f, roles, role: roles[0] || 'pharmacist' }));
  };
  const handleEditRoles = (roles: string[]) => {
    setEditForm(f => ({ ...f, roles, role: roles[0] || f.role }));
  };

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500">{users?.length || 0} users</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
      ) : !users?.length ? (
        <div className="card text-center py-12 text-gray-400">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-30" /><p>No users found</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {users.map((user: any) => (
              <div key={user.id} className="card p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold flex-shrink-0">
                    {user.full_name?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{user.full_name}</p>
                    <p className="text-xs font-mono text-gray-500">{user.mobile}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <RoleBadges user={user} />
                    <span className={`badge text-xs ${user.status === 'active' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>{user.status}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs border-t border-gray-100 pt-3 flex-wrap">
                  <button onClick={() => openEdit(user)} className="text-indigo-600 flex items-center gap-1"><Pencil className="w-3.5 h-3.5" /> Edit</button>
                  <span className="text-gray-200">|</span>
                  <button onClick={() => { setSelectedUser(user); setShowResetForm(true); }} className="text-blue-600 flex items-center gap-1"><KeyRound className="w-3.5 h-3.5" /> Reset Password</button>
                  <span className="text-gray-200">|</span>
                  {user.status === 'active'
                    ? <button onClick={() => deactivateMutation.mutate(user.id)} className="text-red-500 flex items-center gap-1"><UserX className="w-3.5 h-3.5" /> Deactivate</button>
                    : <button onClick={() => activateMutation.mutate(user.id)} className="text-green-600 flex items-center gap-1"><UserCheck className="w-3.5 h-3.5" /> Activate</button>
                  }
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="card p-0 overflow-hidden hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Mobile</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Roles</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Joined</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user: any) => (
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
                    <td className="px-4 py-3"><RoleBadges user={user} /></td>
                    <td className="px-4 py-3"><span className={`badge ${user.status === 'active' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>{user.status}</span></td>
                    <td className="px-4 py-3 text-xs text-gray-500">{formatDate(user.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button onClick={() => openEdit(user)} className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                        <span className="text-gray-200">|</span>
                        <button onClick={() => { setSelectedUser(user); setShowResetForm(true); }} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                          <KeyRound className="w-3.5 h-3.5" /> Reset Password
                        </button>
                        <span className="text-gray-200">|</span>
                        {user.status === 'active'
                          ? <button onClick={() => deactivateMutation.mutate(user.id)} className="text-xs text-red-500 hover:underline flex items-center gap-1"><UserX className="w-3.5 h-3.5" /> Deactivate</button>
                          : <button onClick={() => activateMutation.mutate(user.id)} className="text-xs text-green-600 hover:underline flex items-center gap-1"><UserCheck className="w-3.5 h-3.5" /> Activate</button>
                        }
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Edit User Modal ── */}
      {showEditForm && selectedUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-5 border-b flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Edit User</h3>
                <p className="text-sm text-gray-500 mt-0.5">{selectedUser.full_name}</p>
              </div>
              <button onClick={() => { setShowEditForm(false); setSelectedUser(null); }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="label">Full Name *</label>
                <input className="input" value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} placeholder="Full name" autoFocus />
              </div>
              <div>
                <label className="label">Mobile Number *</label>
                <input className="input" value={editForm.mobile} onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })} placeholder="10-digit mobile" maxLength={10} />
              </div>
              <div>
                <label className="label mb-2 block">Roles * <span className="text-xs text-gray-400 font-normal">(select all that apply)</span></label>
                <RolePicker selected={editForm.roles} onChange={handleEditRoles} />
                {editForm.roles.length === 0 && <p className="text-xs text-red-500 mt-1">Select at least one role</p>}
                {editForm.roles.length > 1 && (
                  <p className="text-xs text-blue-600 mt-2">Primary role (for login redirect): <span className="font-semibold capitalize">{editForm.roles[0]}</span></p>
                )}
              </div>
            </div>
            <div className="p-5 border-t flex gap-3">
              <button onClick={() => { setShowEditForm(false); setSelectedUser(null); }} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={() => updateMutation.mutate({ id: selectedUser.id, data: { ...editForm, roles: editForm.roles, role: editForm.roles[0] || editForm.role } })}
                disabled={updateMutation.isPending || !editForm.full_name || !editForm.mobile || editForm.roles.length === 0}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reset Password Modal ── */}
      {showResetForm && selectedUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-5 border-b flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Reset Password</h3>
                <p className="text-sm text-gray-500 mt-0.5">For: <span className="font-medium">{selectedUser.full_name}</span></p>
              </div>
              <button onClick={() => { setShowResetForm(false); setNewPassword(''); setConfirmPassword(''); }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-700">Inform the user of their new password after resetting.</p>
              </div>
              <div>
                <label className="label">New Password *</label>
                <input type="password" className="input" placeholder="Minimum 6 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoFocus />
              </div>
              <div>
                <label className="label">Confirm Password *</label>
                <input type="password" className="input" placeholder="Re-enter new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                {confirmPassword && newPassword !== confirmPassword && <p className="text-xs text-red-500 mt-1">Passwords do not match</p>}
                {confirmPassword && newPassword === confirmPassword && <p className="text-xs text-green-600 mt-1">✓ Passwords match</p>}
              </div>
            </div>
            <div className="p-5 border-t flex gap-3">
              <button onClick={() => { setShowResetForm(false); setNewPassword(''); setConfirmPassword(''); }} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={handleResetPassword}
                disabled={resetPasswordMutation.isPending || !newPassword || newPassword !== confirmPassword}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {resetPasswordMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                Reset Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add User Modal ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-5 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Add New User</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
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
                <label className="label mb-2 block">Roles * <span className="text-xs text-gray-400 font-normal">(select all that apply)</span></label>
                <RolePicker selected={form.roles} onChange={handleCreateRoles} />
                {form.roles.length === 0 && <p className="text-xs text-red-500 mt-1">Select at least one role</p>}
              </div>
            </div>
            <div className="p-5 border-t flex gap-3">
              <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={() => createMutation.mutate({ ...form, roles: form.roles, role: form.roles[0] || form.role })}
                disabled={createMutation.isPending || !form.full_name || !form.mobile || !form.password || form.roles.length === 0}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
