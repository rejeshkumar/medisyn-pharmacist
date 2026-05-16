'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { setAuth } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobile || !password) return toast.error('Please fill all fields');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { mobile, password });
      setAuth(data.access_token, data.user);
      toast.success(`Welcome, ${data.user.full_name}!`);
      router.push(
        data.user.role === 'doctor' ? '/doctor' :
        data.user.role === 'receptionist' ? '/receptionist' :
        data.user.role === 'nurse' ? '/nurse' :
        '/dashboard'
      );
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Image
              src="/images/simplirx-logo.jpg"
              alt="SimpliRx"
              width={160}
              height={80}
              className="object-contain"
              priority
            />
          </div>
          <p className="text-sm text-gray-500 mt-2">Pharmacist & Clinic Management System</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="label">Mobile Number</label>
            <input
              type="text"
              className="input"
              placeholder="Enter mobile number"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              className="input"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{ backgroundColor: '#00b8a0' }}
            className="w-full py-3 text-base text-white font-semibold rounded-xl hover:opacity-90 transition disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          Powered by NavamWorks
        </p>
      </div>
    </div>
  );
}
