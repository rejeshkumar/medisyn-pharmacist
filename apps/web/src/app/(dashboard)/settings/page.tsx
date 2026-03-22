'use client';
import { useRouter } from 'next/navigation';
import { Star, Stethoscope, FlaskConical, ChevronRight, AlertTriangle, Settings, Shield } from 'lucide-react';

const SETTINGS = [
  {
    href: '/settings/vip-config',
    icon: Star,
    label: 'VIP pass configuration',
    desc: 'Individual, Family and Extended Family tier discounts',
    color: 'text-amber-600 bg-amber-50',
  },
  {
    href: '/settings/doctor-rates',
    icon: Stethoscope,
    label: 'Doctor consultation rates',
    desc: 'Per-doctor rates for new visit, follow-up and emergency',
    color: 'text-blue-600 bg-blue-50',
  },
  {
    href: '/settings/service-rates',
    icon: FlaskConical,
    label: 'Lab & procedure rates',
    desc: 'Lab tests, procedures and other service catalog',
    color: 'text-purple-600 bg-purple-50',
  },
  {
    href: '/settings/hr',
    icon: Shield,
    label: 'HR settings',
    desc: 'Geo-fence, check-in rules, remote work reasons',
    color: 'text-teal-600 bg-teal-50',
  },
  {
    href: '/settings/expiry-threshold',
    icon: AlertTriangle,
    label: 'Expiry warning threshold',
    desc: 'Days before expiry to show stock warnings',
    color: 'text-red-600 bg-red-50',
  },
];

export default function SettingsPage() {
  const router = useRouter();
  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
          <Settings className="w-5 h-5 text-slate-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Settings</h1>
          <p className="text-sm text-slate-500">Configure rates, VIP tiers and clinic preferences</p>
        </div>
      </div>
      <div className="space-y-3">
        {SETTINGS.map(s => {
          const Icon = s.icon;
          return (
            <button key={s.href} onClick={() => router.push(s.href)}
              className="w-full flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-xl hover:border-slate-200 hover:shadow-sm transition-all text-left">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${s.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-800 text-sm">{s.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.desc}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
