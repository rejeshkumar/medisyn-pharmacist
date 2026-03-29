'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Phone, MessageCircle, CheckCircle2, XCircle,
  AlertTriangle, Clock, Loader2, RefreshCw,
  Plus, ChevronDown, Filter, Send, User,
  Pill, Calendar, TrendingUp, X,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────
interface Followup {
  id: string; patient_name: string; patient_mobile: string;
  medicine_name: string; refill_due_date: string;
  priority_level: 'HIGH' | 'MEDIUM' | 'LOW';
  priority_score: number; priority_reasons: string[];
  status: string; reminder_count: number;
  last_response: string | null; call_notes: string | null;
  dosage: string; frequency: string;
}

interface Plan {
  id: string; patient_name: string; medicine_name: string;
  dosage: string; frequency: string; start_date: string;
  end_date: string; status: string; refill_reminder_date: string;
}

const PRIORITY_CONFIG = {
  HIGH:   { color: 'bg-red-50 text-red-700 border-red-200',    dot: 'bg-red-500',    label: 'High priority'   },
  MEDIUM: { color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500', label: 'Medium priority' },
  LOW:    { color: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500', label: 'Low priority'    },
};

const STATUS_CONFIG: Record<string, string> = {
  pending:     'bg-slate-100 text-slate-600',
  reminded:    'bg-blue-50 text-blue-700',
  ordered:     'bg-green-50 text-green-700',
  declined:    'bg-red-50 text-red-600',
  no_response: 'bg-gray-100 text-gray-500',
  escalated:   'bg-red-100 text-red-800',
};

// ── Create medication plan modal ───────────────────────────────────────────
function CreatePlanModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    patient_name: '', patient_mobile: '', medicine_name: '',
    dosage: '1 tablet', frequency: 'OD', duration_days: 30,
    notes: '', start_date: new Date().toISOString().split('T')[0],
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.patient_mobile || !form.medicine_name) {
      toast.error('Patient mobile and medicine are required'); return;
    }
    setSaving(true);
    try {
      await api.post('/ai-care/medication-plans', form);
      toast.success('Medication plan created');
      onCreated(); onClose();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed');
    } finally { setSaving(false); }
  };

  const FREQUENCIES = ['OD', 'BD', 'TID', 'QID', 'HS', 'SOS', '1-0-1', '1-1-1', 'Once in 2 days'];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900">New medication plan</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Patient name</label>
              <input type="text" value={form.patient_name}
                onChange={e => setForm(p=>({...p, patient_name:e.target.value}))}
                placeholder="Full name"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00475a]" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Mobile <span className="text-red-500">*</span></label>
              <input type="text" value={form.patient_mobile}
                onChange={e => setForm(p=>({...p, patient_mobile:e.target.value}))}
                placeholder="WhatsApp number"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00475a]" />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Medicine <span className="text-red-500">*</span></label>
            <input type="text" value={form.medicine_name}
              onChange={e => setForm(p=>({...p, medicine_name:e.target.value}))}
              placeholder="e.g. Ecosprin 75mg"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00475a]" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Dosage</label>
              <input type="text" value={form.dosage}
                onChange={e => setForm(p=>({...p, dosage:e.target.value}))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00475a]" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Frequency</label>
              <select value={form.frequency}
                onChange={e => setForm(p=>({...p, frequency:e.target.value}))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:border-[#00475a]">
                {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Duration (days)</label>
              <input type="number" value={form.duration_days} min={1}
                onChange={e => setForm(p=>({...p, duration_days:Number(e.target.value)}))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00475a]" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Start date</label>
              <input type="date" value={form.start_date}
                onChange={e => setForm(p=>({...p, start_date:e.target.value}))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00475a]" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Notes</label>
              <input type="text" value={form.notes}
                onChange={e => setForm(p=>({...p, notes:e.target.value}))}
                placeholder="e.g. after food"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00475a]" />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm">Cancel</button>
            <button onClick={submit} disabled={saving}
              className="flex-1 py-2.5 bg-[#00475a] text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create plan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Followup card ──────────────────────────────────────────────────────────
function FollowupCard({ f, onUpdate, onSendReminder }: {
  f: Followup; onUpdate: (id: string, status: string, notes?: string) => void;
  onSendReminder: (id: string) => void;
}) {
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState(f.call_notes || '');
  const pc = PRIORITY_CONFIG[f.priority_level];
  const daysLeft = Math.floor((new Date(f.refill_due_date).getTime() - Date.now()) / 86400000);
  const reasons = Array.isArray(f.priority_reasons) ? f.priority_reasons : [];

  return (
    <div className={`bg-white border rounded-2xl p-4 ${f.priority_level === 'HIGH' ? 'border-red-200' : 'border-slate-100'}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
            f.priority_level === 'HIGH' ? 'bg-red-100' : f.priority_level === 'MEDIUM' ? 'bg-amber-100' : 'bg-green-100'
          }`}>
            <User className={`w-4 h-4 ${
              f.priority_level === 'HIGH' ? 'text-red-600' : f.priority_level === 'MEDIUM' ? 'text-amber-600' : 'text-green-600'
            }`} />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">{f.patient_name}</p>
            <p className="text-xs text-slate-500">{f.patient_mobile}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${pc.color}`}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${pc.dot}`} />
            {pc.label}
          </span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_CONFIG[f.status] || 'bg-slate-100 text-slate-600'}`}>
            {f.status.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Medicine info */}
      <div className="bg-slate-50 rounded-xl px-3 py-2 mb-3 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <Pill className="w-3.5 h-3.5 text-[#00475a]" />
            <span className="text-sm font-semibold text-slate-800">{f.medicine_name}</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{f.dosage} · {f.frequency}</p>
        </div>
        <div className="text-right">
          <p className={`text-sm font-bold ${daysLeft < 0 ? 'text-red-600' : daysLeft <= 3 ? 'text-amber-600' : 'text-slate-700'}`}>
            {daysLeft < 0 ? 'Overdue' : `${daysLeft}d left`}
          </p>
          <p className="text-[10px] text-slate-400">
            Refill: {new Date(f.refill_due_date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}
          </p>
        </div>
      </div>

      {/* AI reasons */}
      {reasons.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {reasons.map((r: string, i: number) => (
            <span key={i} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
              {r}
            </span>
          ))}
        </div>
      )}

      {/* Reminder count */}
      {f.reminder_count > 0 && (
        <p className="text-xs text-slate-400 mb-3">
          {f.reminder_count} reminder{f.reminder_count > 1 ? 's' : ''} sent
          {f.last_response && ` · Last reply: ${f.last_response}`}
        </p>
      )}

      {/* Notes */}
      {showNotes && (
        <div className="mb-3">
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            rows={2} placeholder="Add call notes..."
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:border-[#00475a]" />
        </div>
      )}

      {/* Actions */}
      {!['ordered','declined'].includes(f.status) && (
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => onSendReminder(f.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700">
            <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
          </button>
          <a href={`tel:${f.patient_mobile}`}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-50">
            <Phone className="w-3.5 h-3.5" /> Call
          </a>
          <button onClick={() => { setShowNotes(v => !v); }}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-50">
            Notes
          </button>
          <button onClick={() => onUpdate(f.id, 'ordered', notes)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00475a] text-white text-xs font-semibold rounded-lg hover:bg-[#003d4d] ml-auto">
            <CheckCircle2 className="w-3.5 h-3.5" /> Ordered
          </button>
          <button onClick={() => onUpdate(f.id, 'declined', notes)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 text-xs font-medium rounded-lg hover:bg-red-50">
            <XCircle className="w-3.5 h-3.5" /> Declined
          </button>
        </div>
      )}
      {['ordered','declined'].includes(f.status) && (
        <p className="text-xs text-slate-400">
          {f.status === 'ordered' ? '✅ Order confirmed' : '❌ Patient declined'}
          {f.call_notes && ` · ${f.call_notes}`}
        </p>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function AiCarePage() {
  const [tab, setTab] = useState<'calllist' | 'plans' | 'interactions'>('calllist');
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [plans, setPlans]         = useState<Plan[]>([]);
  const [stats, setStats]         = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [statusFilter, setStatus] = useState('all');
  const [priorityFilter, setPriority] = useState('all');
  const [showCreatePlan, setShowCreate] = useState(false);
  const [runningJob, setRunningJob] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [fuRes, planRes, statsRes] = await Promise.all([
        api.get('/ai-care/followups'),
        api.get('/ai-care/medication-plans'),
        api.get('/ai-care/dashboard'),
      ]);
      setFollowups(fuRes.data || []);
      setPlans(planRes.data || []);
      setStats(statsRes.data);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleUpdate = async (id: string, status: string, notes?: string) => {
    try {
      await api.patch(`/ai-care/followups/${id}/status`, { status, notes });
      toast.success(`Marked as ${status}`);
      setFollowups(prev => prev.map(f => f.id === id ? { ...f, status, call_notes: notes || f.call_notes } : f));
    } catch { toast.error('Failed'); }
  };

  const handleSendReminder = async (id: string) => {
    try {
      await api.post(`/ai-care/followups/${id}/send-reminder`, {});
      toast.success('WhatsApp reminder sent');
      setFollowups(prev => prev.map(f => f.id === id ? { ...f, status:'reminded', reminder_count: f.reminder_count+1 } : f));
    } catch { toast.error('Failed to send'); }
  };

  const runJob = async (job: string) => {
    setRunningJob(job);
    try {
      const r = await api.post(`/ai-care/jobs/${job}`, {});
      toast.success(`Job complete: ${JSON.stringify(r.data)}`);
      await loadAll();
    } catch { toast.error('Job failed'); }
    finally { setRunningJob(''); }
  };

  const filtered = followups.filter(f => {
    if (statusFilter !== 'all' && f.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && f.priority_level !== priorityFilter) return false;
    return true;
  });

  const highCount = followups.filter(f => f.priority_level === 'HIGH' && !['ordered','declined'].includes(f.status)).length;
  const pendingCount = followups.filter(f => f.status === 'pending').length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 bg-white border-b border-slate-100">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">AI Care Engine</h1>
            <p className="text-sm text-slate-400">Medication adherence · Refill prediction · Patient engagement</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => runJob('refill-prediction')} disabled={!!runningJob}
              className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 text-xs font-medium rounded-xl hover:bg-slate-50 disabled:opacity-50">
              {runningJob === 'refill-prediction' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Run refill check
            </button>
            <button onClick={() => runJob('daily-reminders')} disabled={!!runningJob}
              className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 text-xs font-medium rounded-xl hover:bg-slate-50 disabled:opacity-50">
              {runningJob === 'daily-reminders' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Send reminders
            </button>
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#00475a] text-white text-xs font-semibold rounded-xl hover:bg-[#003d4d]">
              <Plus className="w-3.5 h-3.5" /> New plan
            </button>
          </div>
        </div>

        {/* Stats row */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            {[
              ['Active plans', stats.plans?.find((p:any) => p.status==='active')?.cnt || 0, 'text-[#00475a]'],
              ['Pending followups', pendingCount, 'text-amber-600'],
              ['High priority', highCount, 'text-red-600'],
              ['WhatsApp responses', stats.interactions?.yes_count || 0, 'text-green-600'],
            ].map(([label, val, cls]) => (
              <div key={label as string} className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-400">{label}</p>
                <p className={`text-2xl font-bold mt-1 ${cls}`}>{val}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-100 bg-white flex-shrink-0 px-6">
        {[
          { key: 'calllist',     label: `Call list (${filtered.length})` },
          { key: 'plans',        label: `Medication plans (${plans.length})` },
          { key: 'interactions', label: 'Interactions' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key ? 'border-[#00475a] text-[#00475a]' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-5 h-5 animate-spin text-[#00475a]" />
          </div>
        ) : tab === 'calllist' ? (
          <div>
            {/* Filters */}
            <div className="flex gap-2 flex-wrap mb-4">
              {['all','pending','reminded','escalated','ordered','declined'].map(s => (
                <button key={s} onClick={() => setStatus(s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    statusFilter === s ? 'bg-[#00475a] text-white border-[#00475a]' : 'border-slate-200 text-slate-500'
                  }`}>
                  {s === 'all' ? 'All' : s.replace('_',' ')}
                </button>
              ))}
              <div className="ml-auto flex gap-2">
                {['all','HIGH','MEDIUM','LOW'].map(p => (
                  <button key={p} onClick={() => setPriority(p)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                      priorityFilter === p
                        ? p === 'HIGH' ? 'bg-red-500 text-white border-red-500'
                          : p === 'MEDIUM' ? 'bg-amber-500 text-white border-amber-500'
                          : p === 'LOW' ? 'bg-green-500 text-white border-green-500'
                          : 'bg-[#00475a] text-white border-[#00475a]'
                        : 'border-slate-200 text-slate-500'
                    }`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-200" />
                <p className="text-sm font-semibold text-slate-500">All caught up!</p>
                <p className="text-xs text-slate-400 mt-1">Run refill check to generate new follow-ups</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filtered.map(f => (
                  <FollowupCard key={f.id} f={f}
                    onUpdate={handleUpdate}
                    onSendReminder={handleSendReminder} />
                ))}
              </div>
            )}
          </div>
        ) : tab === 'plans' ? (
          <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Patient','Medicine','Dosage','Frequency','Start','End','Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plans.map((p: any) => (
                  <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-slate-800">{p.patient_name}</p>
                      <p className="text-xs text-slate-400">{p.patient_mobile}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{p.medicine_name}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{p.dosage}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{p.frequency}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(p.start_date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(p.end_date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        p.status === 'active' ? 'bg-green-50 text-green-700'
                        : p.status === 'completed' ? 'bg-slate-100 text-slate-500'
                        : 'bg-red-50 text-red-600'
                      }`}>{p.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {plans.length === 0 && (
              <div className="text-center py-10 text-slate-400 text-sm">
                No medication plans yet — create one or dispense a prescription
              </div>
            )}
          </div>
        ) : (
          <InteractionLog />
        )}
      </div>

      {showCreatePlan && (
        <CreatePlanModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { loadAll(); }}
        />
      )}
    </div>
  );
}

function InteractionLog() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/ai-care/interactions?limit=50')
      .then(r => setLogs(r.data || []))
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const TYPE_CONFIG: Record<string, string> = {
    medication_reminder: 'bg-blue-50 text-blue-700',
    refill_reminder:     'bg-amber-50 text-amber-700',
    confirmation:        'bg-green-50 text-green-700',
    inbound:             'bg-slate-50 text-slate-600',
    opt_out_confirmation:'bg-red-50 text-red-600',
    escalation:          'bg-red-100 text-red-800',
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-[#00475a]" /></div>;

  return (
    <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              {['Time','Patient','Type','Direction','Response','Message'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.map((l: any) => (
              <tr key={l.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                <td className="px-4 py-2.5 text-xs text-slate-400 whitespace-nowrap">
                  {new Date(l.created_at).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
                </td>
                <td className="px-4 py-2.5">
                  <p className="text-xs font-semibold text-slate-800">{l.patient_name_db || 'Unknown'}</p>
                  <p className="text-[10px] text-slate-400">{l.patient_mobile}</p>
                </td>
                <td className="px-4 py-2.5">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TYPE_CONFIG[l.message_type] || 'bg-slate-100 text-slate-500'}`}>
                    {l.message_type?.replace(/_/g,' ')}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${l.direction==='inbound' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                    {l.direction}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-xs font-bold text-slate-700">{l.response || '—'}</td>
                <td className="px-4 py-2.5 text-xs text-slate-500 max-w-xs truncate">{l.message_text}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && (
          <div className="text-center py-10 text-slate-400 text-sm">No interactions yet</div>
        )}
      </div>
    </div>
  );
}
