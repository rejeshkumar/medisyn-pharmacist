'use client';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('medisyn_token');
}

export function getUser(): any | null {
  if (typeof window === 'undefined') return null;
  const u = localStorage.getItem('medisyn_user');
  return u ? JSON.parse(u) : null;
}

export function setAuth(token: string, user: any) {
  localStorage.setItem('medisyn_token', token);
  localStorage.setItem('medisyn_user', JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem('medisyn_token');
  localStorage.removeItem('medisyn_user');
}

export function isOwner(): boolean {
  const user = getUser();
  return user?.role === 'owner';
}

export function isPharmacist(): boolean {
  const user = getUser();
  return user?.role === 'pharmacist' || user?.role === 'owner';
}
