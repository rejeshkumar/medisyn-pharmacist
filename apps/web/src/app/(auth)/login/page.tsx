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
      router.push('/dashboard');
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
              src="/images/logo.jpg"
              alt="MediSyn Specialty Clinic"
              width={140}
              height={140}
              className="object-contain"
              priority
            />
          </div>
          <h1 className="text-2xl font-bold text-[#00475a]">MediSyn</h1>
          <p className="text-sm text-gray-500 mt-1">Pharmacist Management System</p>
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
            className="btn-primary w-full py-3 text-base"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 p-4 bg-primary-50 rounded-lg text-sm text-gray-600">
          <p className="font-medium text-primary-700 mb-1">Default Admin Login:</p>
          <p>Mobile: <span className="font-mono">9999999999</span></p>
          <p>Password: <span className="font-mono">admin123</span></p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          MediSyn Specialty Clinic, Taliparamba
        </p>
      </div>
    </div>
  );
}
