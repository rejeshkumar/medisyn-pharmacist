'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { getScheduleClassColor } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Search, Plus, X, Loader2, Pencil, PackageX, Filter, Zap, Tag } from 'lucide-react';

const DOSAGE_FORMS = ['Tablet','Capsule','Injection','Vial','Suspension','Drops','Powder','Syrup','Gel','Liquid','Lotion','Cream','Eye Drops','Ointment','Soap','Inhaler','Pill','Patch','Other'];
const RX_UNITS = ['units','tsp','ml','drps','puff','mg','μg','g'];
const INTAKE_ROUTES = ['Oral','Topical','Parenteral','Ophthalmic','Otic','Nasal','Inhalation','Sublingual','Rectal','Transdermal'];
const SCHEDULE_CLASSES = ['OTC','H','H1','X'];

const CATEGORIES = [
  'Fever & Pain','Antibiotics','Diabetes','BP / Cardiac','Gastro',
  'Respiratory','Skin / Dermatology','Vitamins & Supplements','Hormones',
  'Emergency / Critical Care','Pediatrics','Ortho / Pain Management',
  'Eye / Ear / ENT','Neurology / Psychiatry','Urology',
  'Surgical / Wound Care','Medical Devices / Consumables','Other',
];

const CATEGORY_COLORS: Record<string, string> = {
  'Fever & Pain':                'bg-orange-100 text-orange-700',
  'Antibiotics':                 'bg-red-100 text-red-700',
  'Diabetes':                    'bg-blue-100 text-blue-700',
  'BP / Cardiac':                'bg-pink-100 text-pink-700',
  'Gastro':                      'bg-yellow-100 text-yellow-700',
  'Respiratory':                 'bg-sky-100 text-sky-700',
  'Skin / Dermatology':          'bg-green-100 text-green-700',
  'Vitamins & Supplements':      'bg-lime-100 text-lime-700',
  'Hormones':                    'bg-purple-100 text-purple-700',
  'Emergency / Critical Care':   'bg-red-200 text-red-800',
  'Pediatrics':                  'bg-teal-100 text-teal-700',
  'Ortho / Pain Management':     'bg-amber-100 text-amber-700',
  'Eye / Ear / ENT':             'bg-cyan-100 text-cyan-700',
  'Neurology / Psychiatry':      'bg-indigo-100 text-indigo-700',
  'Urology':                     'bg-violet-100 text-violet-700',
  'Surgical / Wound Care':       'bg-rose-100 text-rose-700',
  'Medical Devices / Consumables': 'bg-slate-100 text-slate-600',
  'Other':                       'bg-gray-100 text-gray-600',
};

const EMPTY_FORM = {
  brand_name:'', molecule:'', strength:'', dosage_form:'Tablet',
  schedule_class:'OTC', gst_percent:12, mrp:'', sale_rate:'',
  category:'', composition:'', manufacturer:'', rx_units:'units',
  stock_group:'', treatment_for:'', description:'', discount_percent:0,
  rack_location:'', intake_route:'Oral', reorder_qty:0,
  is_rx_required:false, is_fast_moving:false,
};

export default function MedicinesPage() {
  const [search, setSearch]           = useState('');
  const [filterCat, setFilterCat]     = useState('');
  const [filterSched, setFilterSched] = useState('');
  const [filterFast, setFilterFast]   = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showForm, setShowForm]       = useState(false);
  const [editMed, setEditMed]         = useState<any>(null);
  const [form, setForm]               = useState<any>({ ...EMPTY_FORM });
  const qc = useQueryClient();
  const set = (field: string, value: any) => setForm((f: any) => ({ ...f, [field]: value }));

  // Build query params
  const params = new URLSearchParams();
  if (search)      params.set('search', search);
  if (filterCat)   params.set('category', filterCat);
  if (filterSched) params.set('schedule_class', filterSched);

  const { data: medicines, isLoading } = useQuery({
    queryKey: ['medicines', search, filterCat, filterSched, filterFast],
    queryFn: () => api.get(`/medicines?${params.toString()}`).then(r => r.data),
  });

  const filtered = filterFast
    ? (medicines || []).filter((m: any) => m.is_fast_moving)
    : (medicines || []);

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/medicines', data).then(r => r.data),
    onSuccess: () => { toast.success('Medicine added'); closeForm(); qc.invalidateQueries({ queryKey: ['medicines'] }); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed'),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/medicines/${id}`, data).then(r => r.data),
    onSuccess: () => { toast.success('Medicine updated'); closeForm(); qc.invalidateQueries({ queryKey: ['medicines'] }); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed'),
  });
  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/medicines/${id}/deactivate`),
    onSuccess: () => { toast.success('Medicine deactivated'); qc.invalidateQueries({ queryKey: ['medicines'] }); },
  });

  const openAdd  = () => { setEditMed(null); setForm({ ...EMPTY_FORM }); setShowForm(true); };
  const openEdit = (med: any) => {
    setEditMed(med);
    setForm({
      brand_name: med.brand_name||'', molecule: med.molecule||'',
      strength: med.strength||'', dosage_form: med.dosage_form||'Tablet',
      schedule_class: med.schedule_class||'OTC', gst_percent: med.gst_percent??12,
      mrp: med.mrp??'', sale_rate: med.sale_rate??'', category: med.category||'',
      composition: med.composition||'', manufacturer: med.manufacturer||'',
      rx_units: med.rx_units||'units', stock_group: med.stock_group||'',
      treatment_for: med.treatment_for||'', description: med.description||'',
      discount_percent: med.discount_percent??0, rack_location: med.rack_location||'',
      intake_route: med.intake_route||'Oral', reorder_qty: med.reorder_qty??0,
      is_rx_required: med.is_rx_required??false, is_fast_moving: med.is_fast_moving??false,
    });
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditMed(null); setForm({ ...EMPTY_FORM }); };

  const handleSubmit = () => {
    if (!form.brand_name || !form.molecule || !form.strength) {
      toast.error('Brand name, molecule and strength are required'); return;
    }
    const payload = {
      ...form,
      gst_percent:      Number(form.gst_percent),
      mrp:              form.mrp !== '' ? Number(form.mrp) : undefined,
      sale_rate:        form.sale_rate !== '' ? Number(form.sale_rate) : undefined,
      discount_percent: Number(form.discount_percent),
      reorder_qty:      Number(form.reorder_qty),
    };
    editMed ? updateMutation.mutate({ id: editMed.id, data: payload }) : createMutation.mutate(payload);
  };

  const activeFilters = [filterCat, filterSched, filterFast].filter(Boolean).length;
  const isBusy = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Medicine Master</h1>
          <p className="text-sm text-gray-500">{filtered?.length || 0} medicines</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Medicine
        </button>
      </div>

      {/* Search + Filter bar */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-9 w-full" placeholder="Search brand or molecule..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={() => setShowFilters(v => !v)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
            showFilters || activeFilters > 0
              ? 'bg-[#00475a] text-white border-[#00475a]'
              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
          }`}>
          <Filter className="w-4 h-4" />
          Filters
          {activeFilters > 0 && (
            <span className="bg-white/20 text-white text-xs px-1.5 py-0.5 rounded-full">
              {activeFilters}
            </span>
          )}
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide w-20">Category</span>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setFilterCat('')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                  !filterCat ? 'bg-[#00475a] text-white border-[#00475a]' : 'bg-white text-gray-600 border-gray-200'
                }`}>All</button>
              {CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setFilterCat(cat === filterCat ? '' : cat)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                    filterCat === cat
                      ? 'bg-[#00475a] text-white border-[#00475a]'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}>
                  {cat}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide w-20">Schedule</span>
            <div className="flex gap-1.5">
              {['', 'OTC', 'H', 'H1', 'X'].map(s => (
                <button key={s} onClick={() => setFilterSched(s)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                    filterSched === s
                      ? 'bg-[#00475a] text-white border-[#00475a]'
                      : 'bg-white text-gray-600 border-gray-200'
                  }`}>
                  {s || 'All'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide w-20">Fast Moving</span>
            <button onClick={() => setFilterFast(v => !v)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                filterFast ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 border-gray-200'
              }`}>
              <Zap className="w-3 h-3" /> Fast moving only
            </button>
            {activeFilters > 0 && (
              <button onClick={() => { setFilterCat(''); setFilterSched(''); setFilterFast(false); }}
                className="text-xs text-red-500 hover:text-red-700 ml-2">
                Clear all filters
              </button>
            )}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
      ) : !filtered?.length ? (
        <div className="card text-center py-12 text-gray-400">No medicines found</div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {filtered.map((med: any) => (
              <div key={med.id} className="card p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 text-sm">{med.brand_name}</p>
                      {med.is_fast_moving && (
                        <span className="flex items-center gap-0.5 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">
                          <Zap className="w-2.5 h-2.5" /> Fast
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{med.molecule} · {med.dosage_form}</p>
                    {med.composition && <p className="text-xs text-gray-400 mt-0.5">{med.composition}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => openEdit(med)} className="text-gray-400 hover:text-[#00475a]"><Pencil className="w-4 h-4" /></button>
                    {med.is_active && <button onClick={() => deactivateMutation.mutate(med.id)} className="text-gray-400 hover:text-red-500"><PackageX className="w-4 h-4" /></button>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className={`badge ${getScheduleClassColor(med.schedule_class)}`}>{med.schedule_class}</span>
                  {med.category && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[med.category] || 'bg-gray-100 text-gray-600'}`}>
                      {med.category}
                    </span>
                  )}
                  {med.treatment_for && <span className="text-xs text-gray-400">{med.treatment_for}</span>}
                  <span className="text-xs text-gray-500 ml-auto">₹{Number(med.mrp||0).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="card p-0 overflow-hidden hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Brand Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Generic / Composition</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Form</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Schedule</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">MRP</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Rack</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((med: any) => (
                  <tr key={med.id} className="table-row border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium text-gray-900">{med.brand_name}</p>
                        {med.is_fast_moving && (
                          <span title="Fast moving" className="flex-shrink-0">
                            <Zap className="w-3 h-3 text-amber-500" />
                          </span>
                        )}
                      </div>
                      {med.manufacturer && <p className="text-xs text-gray-400">{med.manufacturer}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-700 text-xs font-medium">{med.molecule}</p>
                      {med.composition && med.composition !== med.molecule && (
                        <p className="text-gray-400 text-xs">{med.composition}</p>
                      )}
                      {med.treatment_for && (
                        <p className="text-gray-400 text-xs italic">{med.treatment_for}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {med.category ? (
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${CATEGORY_COLORS[med.category] || 'bg-gray-100 text-gray-600'}`}>
                          {med.category}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      <p>{med.dosage_form}</p>
                      <p className="text-gray-400">{med.strength}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${getScheduleClassColor(med.schedule_class)}`}>{med.schedule_class}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">₹{Number(med.mrp||0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs font-mono">{med.rack_location || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`badge text-xs ${med.is_active ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-500 border-red-200'}`}>
                        {med.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(med)} className="text-gray-400 hover:text-[#00475a]"><Pencil className="w-4 h-4" /></button>
                        {med.is_active && <button onClick={() => deactivateMutation.mutate(med.id)} className="text-gray-400 hover:text-red-500"><PackageX className="w-4 h-4" /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col">
            <div className="p-5 border-b flex items-center justify-between flex-shrink-0">
              <h3 className="font-semibold text-gray-900">{editMed ? 'Edit Medicine' : 'Add New Medicine'}</h3>
              <button onClick={closeForm}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-5 overflow-y-auto flex-1">

              {/* Basic Info */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Basic Information</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="label">Brand Name *</label>
                    <input className="input" value={form.brand_name} onChange={e => set('brand_name', e.target.value)} placeholder="e.g. DOLO 650" />
                  </div>
                  <div>
                    <label className="label">Generic Name *</label>
                    <input className="input" value={form.molecule} onChange={e => set('molecule', e.target.value)} placeholder="e.g. Paracetamol" />
                  </div>
                  <div>
                    <label className="label">Composition</label>
                    <input className="input" value={form.composition} onChange={e => set('composition', e.target.value)} placeholder="e.g. Paracetamol 650mg" />
                  </div>
                  <div>
                    <label className="label">Strength *</label>
                    <input className="input" value={form.strength} onChange={e => set('strength', e.target.value)} placeholder="e.g. 650mg" />
                  </div>
                  <div>
                    <label className="label">Dosage Form</label>
                    <select className="input" value={form.dosage_form} onChange={e => set('dosage_form', e.target.value)}>
                      {DOSAGE_FORMS.map(f => <option key={f}>{f}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Manufacturer</label>
                    <input className="input" value={form.manufacturer} onChange={e => set('manufacturer', e.target.value)} placeholder="e.g. Micro Labs" />
                  </div>
                  <div>
                    <label className="label">Intake Route</label>
                    <select className="input" value={form.intake_route} onChange={e => set('intake_route', e.target.value)}>
                      {INTAKE_ROUTES.map(r => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Classification */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Classification</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Schedule Class</label>
                    <select className="input" value={form.schedule_class} onChange={e => set('schedule_class', e.target.value)}>
                      {SCHEDULE_CLASSES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Category</label>
                    <select className="input" value={form.category} onChange={e => set('category', e.target.value)}>
                      <option value="">— Select category —</option>
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Treatment For</label>
                    <input className="input" value={form.treatment_for} onChange={e => set('treatment_for', e.target.value)} placeholder="e.g. Fever, headache, pain relief" />
                  </div>
                </div>
              </div>

              {/* Pricing */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Pricing</p>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">MRP (₹)</label><input type="number" className="input" value={form.mrp} onChange={e => set('mrp', e.target.value)} placeholder="0.00" min={0} /></div>
                  <div><label className="label">Sale Rate (₹)</label><input type="number" className="input" value={form.sale_rate} onChange={e => set('sale_rate', e.target.value)} placeholder="0.00" min={0} /></div>
                  <div><label className="label">GST %</label><input type="number" className="input" value={form.gst_percent} onChange={e => set('gst_percent', e.target.value)} min={0} max={28} /></div>
                  <div><label className="label">Discount %</label><input type="number" className="input" value={form.discount_percent} onChange={e => set('discount_percent', e.target.value)} min={0} max={100} /></div>
                </div>
              </div>

              {/* Storage */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Storage & Stock</p>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">Rack Location</label><input className="input" value={form.rack_location} onChange={e => set('rack_location', e.target.value)} placeholder="e.g. A-12" /></div>
                  <div><label className="label">Reorder Qty</label><input type="number" className="input" value={form.reorder_qty} onChange={e => set('reorder_qty', e.target.value)} min={0} /></div>
                </div>
              </div>

              {/* Flags */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Flags</p>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" className="w-4 h-4 rounded accent-[#00475a]" checked={form.is_rx_required} onChange={e => set('is_rx_required', e.target.checked)} />
                    <span className="text-sm font-medium text-gray-700">Rx Required</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" className="w-4 h-4 rounded accent-amber-500" checked={form.is_fast_moving} onChange={e => set('is_fast_moving', e.target.checked)} />
                    <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-amber-500" /> Fast Moving
                    </span>
                  </label>
                  <div><label className="label">Notes</label><textarea className="input resize-none" rows={2} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Any additional notes..." /></div>
                </div>
              </div>
            </div>
            <div className="p-5 border-t flex gap-3 flex-shrink-0">
              <button onClick={closeForm} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleSubmit} disabled={isBusy || !form.brand_name || !form.molecule || !form.strength} className="btn-primary flex-1">
                {isBusy ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : null}
                {editMed ? 'Save Changes' : 'Add Medicine'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
