'use client';
/**
 * MediSyn — Molecule Suggestions Approval UI
 * ============================================
 * Pharmacist reviews AI-matched medicine data from Kaggle dataset
 * and approves/rejects/edits each suggestion.
 *
 * Add as a tab/modal in the Medicine Master page.
 * Props: onClose — called when pharmacist closes the panel
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  FlaskConical, CheckCircle, XCircle, ChevronRight,
  Loader2, AlertTriangle, Zap, Star, Filter, Search
} from 'lucide-react';

const SCHEDULE_CLASSES = ['OTC', 'H', 'H1', 'X'];
const CATEGORIES = [
  'Fever & Pain', 'Antibiotics', 'Diabetes', 'BP / Cardiac', 'Gastro',
  'Respiratory', 'Skin / Dermatology', 'Vitamins & Supplements', 'Hormones',
  'Emergency / Critical Care', 'Pediatrics', 'Ortho / Pain Management',
  'Eye / Ear / ENT', 'Neurology / Psychiatry', 'Urology',
  'Surgical / Wound Care', 'Medical Devices / Consumables', 'Other',
];

interface Props {
  onClose: () => void;
}

export default function MoleculeSuggestionsPanel({ onClose }: Props) {
  const qc = useQueryClient();
  const [filter, setFilter]     = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [minScore, setMinScore] = useState(70);
  const [search, setSearch]     = useState('');
  const [editing, setEditing]   = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});

  const { data, isLoading } = useQuery({
    queryKey: ['suggestions', filter, minScore],
    queryFn: () => api.get(`/medicines/suggestions?status=${filter}&min_score=${minScore}&limit=100`).then(r => r.data),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, data }: any) => api.patch(`/medicines/suggestions/${id}/approve`, data),
    onSuccess: () => {
      toast.success('✅ Approved and applied to medicine!');
      qc.invalidateQueries({ queryKey: ['suggestions'] });
      qc.invalidateQueries({ queryKey: ['medicines'] });
      setEditing(null);
    },
    onError: () => toast.error('Failed to approve'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, notes }: any) => api.patch(`/medicines/suggestions/${id}/reject`, { notes }),
    onSuccess: () => {
      toast.success('Rejected');
      qc.invalidateQueries({ queryKey: ['suggestions'] });
    },
  });

  const bulkApproveMutation = useMutation({
    mutationFn: (minScore: number) => api.patch('/medicines/suggestions/bulk-approve', { min_score: minScore }),
    onSuccess: (res) => {
      toast.success(`✅ Bulk approved ${res.data.applied} medicines!`);
      qc.invalidateQueries({ queryKey: ['suggestions'] });
      qc.invalidateQueries({ queryKey: ['medicines'] });
    },
  });

  const stats  = data?.stats || {};
  const rows   = (data?.rows || []).filter((r: any) =>
    !search || r.brand_name.toLowerCase().includes(search.toLowerCase())
  );

  const scoreColor = (score: number) =>
    score >= 85 ? 'text-green-600 bg-green-50' :
    score >= 75 ? 'text-amber-600 bg-amber-50' :
    'text-red-600 bg-red-50';

  const scoreLabel = (score: number) =>
    score >= 85 ? '✅ High confidence' :
    score >= 75 ? '⚠️ Review needed' :
    '❌ Low confidence';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-end">
      <div className="bg-white h-full w-full max-w-3xl shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b bg-[#00475a] text-white">
          <div className="flex items-center gap-3">
            <FlaskConical className="w-6 h-6" />
            <div>
              <h2 className="font-semibold text-lg">Medicine Data Suggestions</h2>
              <p className="text-xs text-teal-200">Review AI-matched data from All India Drug Bank</p>
            </div>
          </div>
          <button onClick={onClose} className="text-teal-200 hover:text-white text-2xl leading-none">×</button>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-4 border-b">
          {[
            { label: 'Pending', value: stats.pending, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'High Confidence', value: stats.high_confidence, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Approved', value: stats.approved, color: 'text-teal-600', bg: 'bg-teal-50' },
            { label: 'Rejected', value: stats.rejected, color: 'text-red-600', bg: 'bg-red-50' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} p-3 text-center border-r last:border-r-0`}>
              <p className={`text-xl font-bold ${s.color}`}>{s.value ?? '—'}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="p-4 border-b flex items-center gap-3 flex-wrap">
          {/* Status filter */}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-medium">
            {(['pending', 'approved', 'rejected'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 capitalize transition-colors ${filter === f ? 'bg-[#00475a] text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
                {f}
              </button>
            ))}
          </div>

          {/* Min score filter */}
          <select value={minScore} onChange={e => setMinScore(Number(e.target.value))}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600">
            <option value={70}>Score ≥ 70%</option>
            <option value={75}>Score ≥ 75%</option>
            <option value={80}>Score ≥ 80%</option>
            <option value={85}>Score ≥ 85%</option>
          </select>

          {/* Search */}
          <div className="relative flex-1 min-w-32">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search medicine..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#00475a]" />
          </div>

          {/* Bulk approve button */}
          {filter === 'pending' && (stats.high_confidence || 0) > 0 && (
            <button
              onClick={() => {
                if (confirm(`Auto-approve ${stats.high_confidence} high-confidence suggestions (score ≥ 85%)?`))
                  bulkApproveMutation.mutate(85);
              }}
              disabled={bulkApproveMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50">
              {bulkApproveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
              Bulk Approve {stats.high_confidence} (≥85%)
            </button>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400">
              <CheckCircle className="w-10 h-10 mb-2" />
              <p className="font-medium">All done!</p>
              <p className="text-sm">No {filter} suggestions</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {rows.map((row: any) => (
                <div key={row.id} className={`p-4 hover:bg-slate-50 transition-colors ${editing?.id === row.id ? 'bg-blue-50 border-l-4 border-[#00475a]' : ''}`}>
                  <div className="flex items-start gap-3">
                    {/* Score badge */}
                    <span className={`text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0 ${scoreColor(row.match_score)}`}>
                      {row.match_score}%
                    </span>

                    <div className="flex-1 min-w-0">
                      {/* Medicine name */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-900 text-sm">{row.brand_name}</p>
                        <span className="text-[10px] text-slate-400">{row.dosage_form} · {row.manufacturer}</span>
                      </div>

                      {/* Match info */}
                      <p className="text-xs text-slate-500 mt-0.5">
                        Matched: <span className="text-slate-700 font-medium">{row.matched_name}</span>
                      </p>

                      {/* Suggested data */}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {row.suggested_category && (
                          <span className="text-[11px] bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full border border-teal-200">
                            📂 {row.suggested_category}
                          </span>
                        )}
                        {row.suggested_schedule && row.suggested_schedule !== row.schedule_class && (
                          <span className="text-[11px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                            Rx {row.suggested_schedule}
                          </span>
                        )}
                        {row.suggested_use && (
                          <span className="text-[11px] bg-slate-50 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                            💊 {row.suggested_use}
                          </span>
                        )}
                      </div>

                      {/* Substitutes */}
                      {row.suggested_subs?.length > 0 && (
                        <p className="text-[11px] text-slate-500 mt-1.5">
                          Substitutes: {row.suggested_subs.slice(0, 3).join(', ')}
                          {row.suggested_subs.length > 3 && ` +${row.suggested_subs.length - 3} more`}
                        </p>
                      )}

                      {/* Current vs suggested diff */}
                      {row.category !== row.suggested_category && row.suggested_category && (
                        <p className="text-[11px] text-amber-600 mt-1">
                          ⚡ Category change: "{row.category || 'none'}" → "{row.suggested_category}"
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    {filter === 'pending' && (
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => {
                            setEditing(row);
                            setEditForm({
                              category: row.suggested_category || row.category || '',
                              schedule: row.suggested_schedule || row.schedule_class || 'OTC',
                            });
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-[#00475a] text-white rounded-lg hover:bg-[#003d4d]">
                          <CheckCircle className="w-3 h-3" /> Review
                        </button>
                        <button
                          onClick={() => rejectMutation.mutate({ id: row.id, notes: 'Poor match' })}
                          disabled={rejectMutation.isPending}
                          className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium border border-red-200 text-red-600 rounded-lg hover:bg-red-50">
                          <XCircle className="w-3 h-3" /> Skip
                        </button>
                      </div>
                    )}

                    {filter !== 'pending' && (
                      <span className={`text-[11px] font-bold px-2 py-1 rounded-lg flex-shrink-0 ${
                        row.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {row.status}
                      </span>
                    )}
                  </div>

                  {/* Edit panel */}
                  {editing?.id === row.id && (
                    <div className="mt-3 p-3 bg-white rounded-xl border border-[#00475a]/20 shadow-sm">
                      <p className="text-xs font-semibold text-[#00475a] mb-2">Review & Confirm</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] text-slate-500 mb-1 block">Category</label>
                          <select value={editForm.category}
                            onChange={e => setEditForm((f: any) => ({ ...f, category: e.target.value }))}
                            className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#00475a]">
                            <option value="">— no change —</option>
                            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-500 mb-1 block">Schedule Class</label>
                          <select value={editForm.schedule}
                            onChange={e => setEditForm((f: any) => ({ ...f, schedule: e.target.value }))}
                            className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#00475a]">
                            <option value="">— no change —</option>
                            {SCHEDULE_CLASSES.map(s => <option key={s}>{s}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => approveMutation.mutate({ id: row.id, data: editForm })}
                          disabled={approveMutation.isPending}
                          className="flex-1 bg-[#00475a] text-white py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 hover:bg-[#003d4d] disabled:opacity-50">
                          {approveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                          Approve & Apply
                        </button>
                        <button onClick={() => setEditing(null)}
                          className="px-3 py-1.5 rounded-lg text-xs border border-slate-200 text-slate-600 hover:bg-slate-50">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t bg-slate-50 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            Source: All India Drug Bank (Kaggle) · {data?.total || 0} suggestions
          </p>
          <p className="text-xs text-slate-400">
            {scoreLabel(80)} = safe to bulk approve
          </p>
        </div>
      </div>
    </div>
  );
}
