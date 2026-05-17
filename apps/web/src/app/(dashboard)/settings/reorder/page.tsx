'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Package, Save, RefreshCw, Info } from 'lucide-react';

const Field = ({ label, desc, value, onChange, unit, min = 1, max = 365 }: any) => (
  <div style={{ background: 'white', borderRadius: 12, border: '0.5px solid #e5e7eb', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
    <div style={{ flex: 1 }}>
      <p style={{ fontSize: 14, fontWeight: 500, color: '#1a1a2e', marginBottom: 3 }}>{label}</p>
      <p style={{ fontSize: 12, color: '#6b7280' }}>{desc}</p>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
      <input
        type="number" min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: 72, padding: '8px 10px', border: '1.5px solid #00b8a0', borderRadius: 8, fontSize: 15, fontWeight: 600, color: '#1a1a2e', textAlign: 'center', outline: 'none' }}
      />
      <span style={{ fontSize: 12, color: '#6b7280', width: 40 }}>{unit}</span>
    </div>
  </div>
);

export default function ReorderSettingsPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    reorder_cover_days: 14,
    reorder_qty_days: 7,
    suggested_qty_days: 30,
    fallback_min_stock: 10,
    fallback_suggested_qty: 20,
  });

  useEffect(() => {
    api.get('/settings/reorder-settings').then(r => {
      setForm(r.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch('/settings/reorder-settings', form);
      toast.success('Reorder settings saved');
    } catch {
      toast.error('Failed to save');
    } finally { setSaving(false); }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', color: '#00b8a0' }} />
    </div>
  );

  return (
    <div style={{ padding: '24px', maxWidth: 640, fontFamily: 'var(--font-sans)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => router.push('/settings')}
          style={{ background: 'white', border: '0.5px solid #e5e7eb', borderRadius: 8, padding: '7px', cursor: 'pointer', display: 'flex' }}>
          <ArrowLeft size={16} color="#6b7280" />
        </button>
        <div style={{ width: 40, height: 40, background: '#dcfce7', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Package size={20} color="#16a34a" />
        </div>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: '#1a1a2e', margin: 0 }}>Reorder Settings</h1>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>Configure when and how much to reorder</p>
        </div>
      </div>

      {/* Info banner */}
      <div style={{ background: '#eff6ff', border: '0.5px solid #bfdbfe', borderRadius: 12, padding: '12px 16px', display: 'flex', gap: 10, marginBottom: 20 }}>
        <Info size={16} color="#2563eb" style={{ flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontSize: 12, color: '#1d4ed8', lineHeight: 1.5 }}>
          Reorder flags are calculated using your 30-day sales velocity. These settings control when a reorder is triggered and how much to suggest ordering.
        </p>
      </div>

      {/* Section: Trigger */}
      <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Reorder Trigger</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        <Field
          label="Reorder when stock covers less than"
          desc="Flag a medicine for reorder when current stock will run out within this many days at the current sales rate"
          value={form.reorder_cover_days}
          onChange={(v: number) => setForm(f => ({ ...f, reorder_cover_days: v }))}
          unit="days"
        />
        <Field
          label="Fallback minimum stock"
          desc="For medicines with no sales history, flag for reorder when stock drops to or below this quantity"
          value={form.fallback_min_stock}
          onChange={(v: number) => setForm(f => ({ ...f, fallback_min_stock: v }))}
          unit="units"
          min={1} max={100}
        />
      </div>

      {/* Section: Order Qty */}
      <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Order Quantity</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        <Field
          label="Reorder quantity covers"
          desc="Minimum quantity to order — calculated as sales rate × this many days"
          value={form.reorder_qty_days}
          onChange={(v: number) => setForm(f => ({ ...f, reorder_qty_days: v }))}
          unit="days"
        />
        <Field
          label="Suggested order quantity covers"
          desc="Recommended quantity to order — calculated as sales rate × this many days"
          value={form.suggested_qty_days}
          onChange={(v: number) => setForm(f => ({ ...f, suggested_qty_days: v }))}
          unit="days"
        />
        <Field
          label="Fallback suggested quantity"
          desc="For medicines with no sales history, suggest ordering this many units"
          value={form.fallback_suggested_qty}
          onChange={(v: number) => setForm(f => ({ ...f, fallback_suggested_qty: v }))}
          unit="units"
          min={1} max={500}
        />
      </div>

      {/* Summary preview */}
      <div style={{ background: '#f0fdf4', border: '0.5px solid #bbf7d0', borderRadius: 12, padding: '14px 18px', marginBottom: 24 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#166534', marginBottom: 6 }}>📋 Current configuration summary</p>
        <p style={{ fontSize: 12, color: '#15803d', lineHeight: 1.8 }}>
          • Trigger reorder when stock covers &lt; <strong>{form.reorder_cover_days} days</strong><br/>
          • Minimum order = <strong>{form.reorder_qty_days}-day</strong> demand<br/>
          • Suggested order = <strong>{form.suggested_qty_days}-day</strong> demand<br/>
          • Fallback: flag at ≤ <strong>{form.fallback_min_stock} units</strong>, suggest <strong>{form.fallback_suggested_qty} units</strong>
        </p>
      </div>

      {/* Save button */}
      <button onClick={save} disabled={saving}
        style={{ width: '100%', padding: '12px', background: '#00b8a0', color: 'white', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: saving ? 0.7 : 1 }}>
        {saving ? <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={16} />}
        {saving ? 'Saving...' : 'Save Reorder Settings'}
      </button>
    </div>
  );
}
