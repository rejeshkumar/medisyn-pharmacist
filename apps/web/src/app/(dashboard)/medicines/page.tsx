'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { getScheduleClassColor } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Search, Plus, X, Loader2, Pencil, PackageX } from 'lucide-react';

// ── Drug type options (matching old pharmacy app) ─────────────────────────────
const DOSAGE_FORMS = [
  'Tablet', 'Capsule', 'Injection', 'Vial', 'Suspension', 'Drops',
  'Powder', 'Syrup', 'Gel', 'Liquid', 'Lotion', 'Cream',
  'Eye Drops', 'Ointment', 'Soap', 'Inhaler', 'Pill', 'Patch', 'Other',
];

const RX_UNITS = ['units', 'tsp', 'ml', 'drps', 'puff', 'mg', 'μg', 'g'];

const INTAKE_ROUTES = [
  'Oral', 'Topical', 'Parenteral', 'Ophthalmic',
  'Otic', 'Nasal', 'Inhalation', 'Sublingual', 'Rectal', 'Transdermal',
];

const SCHEDULE_CLASSES = ['OTC', 'H', 'H1', 'X'];

const EMPTY_FORM = {
  brand_name: '',
  molecule: '',
  strength: '',
  dosage_form: 'Tablet',
  schedule_class: 'OTC',
  gst_percent: 12,
  mrp: '',
  sale_rate: '',
  category: '',
  manufacturer: '',
  // new fields
  rx_units: 'units',
  stock_group: '',
  treatment_for: '',
  description: '',
  discount_percent: 0,
  rack_location: '',
  intake_route: 'Oral',
  reorder_qty: 0,
  is_rx_required: false,
};

export default function MedicinesPage() {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editMed, setEditMed] = useState<any>(null);
  const [form, setForm] = useState<any>({ ...EMPTY_FORM });
  const qc = useQueryClient();

  const set = (field: string, value: any) => setForm((f: any) => ({ ...f, [field]: value }));

  const { data: medicines, isLoading } = useQuery({
    queryKey: ['medicines', search],
    queryFn: () => api.get(`/medicines${search ? `?search=${search}` : ''}`).then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/medicines', data).then((r) => r.data),
    onSuccess: () => {
      toast.success('Medicine added');
      closeForm();
      qc.invalidateQueries({ queryKey: ['medicines'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to add medicine'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.patch(`/medicines/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      toast.success('Medicine updated');
      closeForm();
      qc.invalidateQueries({ queryKey: ['medicines'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to update medicine'),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/medicines/${id}/deactivate`),
    onSuccess: () => { toast.success('Medicine deactivated'); qc.invalidateQueries({ queryKey: ['medicines'] }); },
  });

  const openAdd = () => {
    setEditMed(null);
    setForm({ ...EMPTY_FORM });
    setShowForm(true);
  };

  const openEdit = (med: any) => {
    setEditMed(med);
    setForm({
      brand_name: med.brand_name || '',
      molecule: med.molecule || '',
      strength: med.strength || '',
      dosage_form: med.dosage_form || 'Tablet',
      schedule_class: med.schedule_class || 'OTC',
      gst_percent: med.gst_percent ?? 12,
      mrp: med.mrp ?? '',
      sale_rate: med.sale_rate ?? '',
      category: med.category || '',
      manufacturer: med.manufacturer || '',
      rx_units: med.rx_units || 'units',
      stock_group: med.stock_group || '',
      treatment_for: med.treatment_for || '',
      description: med.description || '',
      discount_percent: med.discount_percent ?? 0,
      rack_location: med.rack_location || '',
      intake_route: med.intake_route || 'Oral',
      reorder_qty: med.reorder_qty ?? 0,
      is_rx_required: med.is_rx_required ?? false,
    });
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditMed(null); setForm({ ...EMPTY_FORM }); };

  const handleSubmit = () => {
    if (!form.brand_name || !form.molecule || !form.strength) {
      toast.error('Brand name, molecule and strength are required');
      return;
    }
    const payload = {
      ...form,
      gst_percent: Number(form.gst_percent),
      mrp: form.mrp !== '' ? Number(form.mrp) : undefined,
      sale_rate: form.sale_rate !== '' ? Number(form.sale_rate) : undefined,
      discount_percent: Number(form.discount_percent),
      reorder_qty: Number(form.reorder_qty),
    };
    if (editMed) {
      updateMutation.mutate({ id: editMed.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isBusy = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Medicine Master</h1>
          <p className="text-sm text-gray-500">{medicines?.length || 0} medicines</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Medicine
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          className="input pl-9"
          placeholder="Search by brand or molecule..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Drug Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Generic / Molecule</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Type / Strength</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Schedule</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Rx</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">MRP</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Rack</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Reorder</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={10} className="text-center py-12 text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
            ) : medicines?.length === 0 ? (
              <tr><td colSpan={10} className="text-center py-12 text-gray-400">No medicines found</td></tr>
            ) : (
              medicines?.map((med: any) => (
                <tr key={med.id} className="table-row">
                  <td className="px-4 py-3 font-medium text-gray-900">{med.brand_name}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    <p>{med.molecule}</p>
                    {med.category && <p className="text-gray-400">{med.category}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    <p>{med.dosage_form}</p>
                    <p className="text-gray-400">{med.strength}{med.rx_units ? ` · ${med.rx_units}` : ''}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${getScheduleClassColor(med.schedule_class)}`}>{med.schedule_class}</span>
                  </td>
                  <td className="px-4 py-3">
                    {med.is_rx_required
                      ? <span className="badge bg-blue-100 text-blue-700 border-blue-200 text-xs">Rx</span>
                      : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-700">₹{Number(med.mrp || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs font-mono">{med.rack_location || '—'}</td>
                  <td className="px-4 py-3 text-xs">
                    <span className={`font-medium ${med.reorder_qty > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                      {med.reorder_qty || 0}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge text-xs ${med.is_active ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-500 border-red-200'}`}>
                      {med.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(med)} className="text-gray-400 hover:text-primary-600" title="Edit">
                        <Pencil className="w-4 h-4" />
                      </button>
                      {med.is_active && (
                        <button onClick={() => deactivateMutation.mutate(med.id)} className="text-gray-400 hover:text-red-500" title="Deactivate">
                          <PackageX className="w-4 h-4" />
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

      {/* ── Add / Edit Modal ─────────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4">
            <div className="p-5 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">{editMed ? 'Edit Drug' : 'Add New Drug'}</h3>
              <button onClick={closeForm}><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">

              {/* Section — Basic Info */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Basic Information</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="label">Drug Name (Brand) *</label>
                    <input className="input" value={form.brand_name} onChange={(e) => set('brand_name', e.target.value)} placeholder="e.g. DOLONEX DT" />
                  </div>
                  <div>
                    <label className="label">Generic Name (Molecule) *</label>
                    <input className="input" value={form.molecule} onChange={(e) => set('molecule', e.target.value)} placeholder="e.g. Piroxicam" />
                  </div>
                  <div>
                    <label className="label">Strength *</label>
                    <input className="input" value={form.strength} onChange={(e) => set('strength', e.target.value)} placeholder="e.g. 20mg" />
                  </div>
                  <div>
                    <label className="label">Drug Type</label>
                    <select className="input" value={form.dosage_form} onChange={(e) => set('dosage_form', e.target.value)}>
                      {DOSAGE_FORMS.map((f) => <option key={f}>{f}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Rx Units</label>
                    <select className="input" value={form.rx_units} onChange={(e) => set('rx_units', e.target.value)}>
                      {RX_UNITS.map((u) => <option key={u}>{u}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Intake Route</label>
                    <select className="input" value={form.intake_route} onChange={(e) => set('intake_route', e.target.value)}>
                      <option value="">— Select —</option>
                      {INTAKE_ROUTES.map((r) => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Manufacturer</label>
                    <input className="input" value={form.manufacturer} onChange={(e) => set('manufacturer', e.target.value)} placeholder="e.g. Pfizer" />
                  </div>
                </div>
              </div>

              {/* Section — Classification */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Classification</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Schedule Class</label>
                    <select className="input" value={form.schedule_class} onChange={(e) => set('schedule_class', e.target.value)}>
                      {SCHEDULE_CLASSES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Category</label>
                    <input className="input" value={form.category} onChange={(e) => set('category', e.target.value)} placeholder="e.g. Antibiotic" />
                  </div>
                  <div>
                    <label className="label">Stock Group</label>
                    <input className="input" value={form.stock_group} onChange={(e) => set('stock_group', e.target.value)} placeholder="e.g. Analgesics" />
                  </div>
                  <div>
                    <label className="label">Treatment For</label>
                    <input className="input" value={form.treatment_for} onChange={(e) => set('treatment_for', e.target.value)} placeholder="e.g. Pain, Fever" />
                  </div>
                </div>
              </div>

              {/* Section — Pricing */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Pricing</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">MRP (₹)</label>
                    <input type="number" className="input" value={form.mrp} onChange={(e) => set('mrp', e.target.value)} placeholder="0.00" min={0} />
                  </div>
                  <div>
                    <label className="label">Sale Rate (₹)</label>
                    <input type="number" className="input" value={form.sale_rate} onChange={(e) => set('sale_rate', e.target.value)} placeholder="0.00" min={0} />
                  </div>
                  <div>
                    <label className="label">GST %</label>
                    <input type="number" className="input" value={form.gst_percent} onChange={(e) => set('gst_percent', e.target.value)} min={0} max={28} />
                  </div>
                  <div>
                    <label className="label">Discount %</label>
                    <input type="number" className="input" value={form.discount_percent} onChange={(e) => set('discount_percent', e.target.value)} min={0} max={100} />
                  </div>
                </div>
              </div>

              {/* Section — Storage & Stock */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Storage & Stock</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Rack Location</label>
                    <input className="input" value={form.rack_location} onChange={(e) => set('rack_location', e.target.value)} placeholder="e.g. A-12, Shelf 3" />
                  </div>
                  <div>
                    <label className="label">Reorder Qty</label>
                    <input type="number" className="input" value={form.reorder_qty} onChange={(e) => set('reorder_qty', e.target.value)} min={0} placeholder="Minimum qty before alert" />
                  </div>
                </div>
              </div>

              {/* Section — Notes & Flags */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Notes & Flags</p>
                <div className="space-y-3">
                  <div>
                    <label className="label">Description / Notes</label>
                    <textarea
                      className="input resize-none"
                      rows={2}
                      value={form.description}
                      onChange={(e) => set('description', e.target.value)}
                      placeholder="Any additional notes about this drug..."
                    />
                  </div>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded accent-primary-600"
                        checked={form.is_rx_required}
                        onChange={(e) => set('is_rx_required', e.target.checked)}
                      />
                      <span className="text-sm font-medium text-gray-700">Rx Required (Prescription mandatory)</span>
                    </label>
                  </div>
                </div>
              </div>

            </div>

            <div className="p-5 border-t flex gap-3">
              <button onClick={closeForm} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={handleSubmit}
                disabled={isBusy || !form.brand_name || !form.molecule || !form.strength}
                className="btn-primary flex-1"
              >
                {isBusy ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : null}
                {editMed ? 'Save Changes' : 'Add Drug'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
