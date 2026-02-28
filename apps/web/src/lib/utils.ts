import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string) {
  return `₹${Number(amount).toFixed(2)}`;
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(date: string | Date) {
  return new Date(date).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getExpiryStatus(expiryDate: string | Date) {
  const expiry = new Date(expiryDate);
  const now = new Date();
  const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) return { status: 'expired', color: 'text-red-600', bg: 'bg-red-50', label: 'Expired' };
  if (daysLeft <= 30) return { status: 'critical', color: 'text-red-500', bg: 'bg-red-50', label: `${daysLeft}d left` };
  if (daysLeft <= 90) return { status: 'warning', color: 'text-amber-600', bg: 'bg-amber-50', label: `${daysLeft}d left` };
  return { status: 'good', color: 'text-green-600', bg: 'bg-green-50', label: `${daysLeft}d left` };
}

export function getScheduleClassColor(scheduleClass: string) {
  switch (scheduleClass) {
    case 'X': return 'bg-red-100 text-red-700 border-red-200';
    case 'H1': return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'H': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    default: return 'bg-gray-100 text-gray-600 border-gray-200';
  }
}

export function getConfidenceColor(confidence: string) {
  switch (confidence) {
    case 'high': return 'text-green-600 bg-green-50';
    case 'medium': return 'text-yellow-600 bg-yellow-50';
    case 'low': return 'text-red-600 bg-red-50';
    default: return 'text-gray-600 bg-gray-50';
  }
}
