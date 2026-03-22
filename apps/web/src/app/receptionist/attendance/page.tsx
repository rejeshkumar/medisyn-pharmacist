'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  LogIn, LogOut, Loader2, CheckCircle2,
  AlertTriangle, MapPin, WifiOff, Clock,
  ChevronRight, X,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────
interface RemoteSubOption { key: string; label: string; }
interface RemoteReason    { key: string; label: string; sub_options: RemoteSubOption[]; }

const LEAVE_COLORS: Record<string, string> = {
  CL: 'bg-blue-50 text-blue-700 border-blue-200',
  SL: 'bg-red-50 text-red-700 border-red-200',
  EL: 'bg-green-50 text-green-700 border-green-200',
  LOP:'bg-gray-50 text-gray-600 border-gray-200',
  CO: 'bg-purple-50 text-purple-700 border-purple-200',
};

// ── Remote reason modal ───────────────────────────────────────
function RemoteReasonModal({
  reasons, distance, radius, onSubmit, onCancel,
}: {
  reasons: RemoteReason[];
  distance: number;
  radius: number;
  onSubmit: (reason: string, sub: string, note: string) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected]     = useState('');
  const [subSelected, setSubSelected] = useState('');
  const [note, setNote]             = useState('');

  const current = reasons.find(r => r.key === selected);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm">
        {/* Header */}
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
              <MapPin className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Outside office area</h3>
              <p className="text-xs text-slate-500">
                You are {distance}m away · Allowed {radius}m
              </p>
            </div>
            <button onClick={onCancel} className="ml-auto text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs text-amber-800 font-medium">
              Please select why you are checking in remotely
            </p>
          </div>
        </div>

        <div className="p-4 space-y-2">
          {/* Reason options */}
          {reasons.map(r => (
            <button key={r.key}
              onClick={() => { setSelected(r.key); setSubSelected(''); }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 text-left transition-all ${
                selected === r.key
                  ? 'border-[#00475a] bg-teal-50'
                  : 'border-slate-100 hover:border-slate-200'
              }`}
            >
              <span className={`text-sm font-semibold ${selected === r.key ? 'text-[#00475a]' : 'text-slate-700'}`}>
                {r.label}
              </span>
              {r.sub_options.length > 0 && (
                <ChevronRight className={`w-4 h-4 transition-transform ${selected === r.key ? 'rotate-90 text-[#00475a]' : 'text-slate-400'}`} />
              )}
            </button>
          ))}

          {/* Sub-options */}
          {current?.sub_options && current.sub_options.length > 0 && (
            <div className="ml-4 mt-1 space-y-1.5 border-l-2 border-teal-200 pl-3">
              {current.sub_options.map(sub => (
                <button key={sub.key}
                  onClick={() => setSubSelected(sub.key)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-all ${
                    subSelected === sub.key
                      ? 'border-[#00475a] bg-teal-50 text-[#00475a] font-semibold'
                      : 'border-slate-100 text-slate-600 hover:border-slate-200'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          )}

          {/* Note */}
          {selected && (
            <input type="text" value={note} onChange={e => setNote(e.target.value)}
              placeholder="Add a note (optional)"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00475a]" />
          )}

          {/* Submit */}
          <button
            onClick={() => {
              if (!selected) { toast.error('Please select a reason'); return; }
              if (current?.sub_options.length && !subSelected) {
                toast.error('Please select a sub-option'); return;
              }
              onSubmit(selected, subSelected, note);
            }}
            disabled={!selected}
            className="w-full py-3 bg-[#00475a] text-white rounded-xl text-sm font-bold disabled:opacity-40 hover:bg-[#003d4d] transition-colors"
          >
            Confirm check-in
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function AttendancePage() {
  const [status, setStatus]         = useState<any>(null);
  const [settings, setSettings]     = useState<any>(null);
  const [loading, setLoading]       = useState(true);
  const [checking, setChecking]     = useState(false);
  const [geoError, setGeoError]     = useState('');

  // Remote reason modal state
  const [showRemoteModal, setShowRemoteModal]   = useState(false);
  const [pendingGeo, setPendingGeo]             = useState<GeolocationCoordinates | null>(null);
  const [outsideFence, setOutsideFence]         = useState<{ distance: number; radius: number } | null>(null);

  // Leave form
  const [showLeaveForm, setShowLeaveForm]       = useState(false);
  const [leaveForm, setLeaveForm]               = useState({
    leave_type: 'CL', from_date: '', to_date: '', reason: '',
    is_half_day: false, half_day_part: 'morning',
  });
  const [applyingLeave, setApplyingLeave]       = useState(false);

  // Clock
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    try {
      const [statusRes, settingsRes] = await Promise.all([
        api.get('/hr/today'),
        api.get('/hr/settings').catch(() => ({ data: null })),
      ]);
      setStatus(statusRes.data);
      setSettings(settingsRes.data);
    } catch {
      toast.error('Failed to load attendance');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Get location ──────────────────────────────────────────────
  const getLocation = (): Promise<GeolocationCoordinates | null> => {
    return new Promise(resolve => {
      if (!navigator.geolocation) { resolve(null); return; }
      navigator.geolocation.getCurrentPosition(
        pos => resolve(pos.coords),
        err => {
          console.warn('Geolocation error:', err.message);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      );
    });
  };

  // ── Check-in flow ─────────────────────────────────────────────
  const handleCheckIn = async (
    remoteReason?: string, remoteSubReason?: string, remoteNote?: string,
    coords?: GeolocationCoordinates | null,
  ) => {
    setChecking(true);
    setGeoError('');
    setShowRemoteModal(false);

    try {
      // Get location if geo-fence enabled and not already fetched
      let location = coords ?? pendingGeo;
      if (!location && settings?.geo_fence_enabled) {
        location = await getLocation();
        if (!location) {
          setGeoError('Could not get your location. Please enable location access and try again.');
          setChecking(false);
          return;
        }
      }

      const payload: any = { notes: undefined };
      if (location) {
        payload.lat      = location.latitude;
        payload.lng      = location.longitude;
        payload.accuracy = Math.round(location.accuracy);
      }
      if (remoteReason)    payload.remote_reason     = remoteReason;
      if (remoteSubReason) payload.remote_sub_reason = remoteSubReason;
      if (remoteNote)      payload.remote_note       = remoteNote;

      const r = await api.post('/hr/attendance/check-in', payload);
      toast.success(r.data.message);
      setPendingGeo(null);
      await load();

    } catch (e: any) {
      const msg = e.response?.data?.message || e.message || 'Check-in failed';

      // Parse geo-fence outside error
      try {
        const parsed = JSON.parse(msg);
        if (parsed.code === 'OUTSIDE_FENCE') {
          // Show remote reason modal
          const location = await getLocation();
          setPendingGeo(location);
          setOutsideFence({ distance: parsed.distance, radius: parsed.radius });
          setShowRemoteModal(true);
          setChecking(false);
          return;
        }
      } catch {}

      toast.error(msg);
    } finally {
      setChecking(false);
    }
  };

  // ── Check-out ─────────────────────────────────────────────────
  const handleCheckOut = async () => {
    setChecking(true);
    try {
      const r = await api.post('/hr/attendance/check-out', {});
      toast.success(r.data.message);
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Check-out failed');
    } finally {
      setChecking(false);
    }
  };

  // ── Apply leave ───────────────────────────────────────────────
  const handleApplyLeave = async () => {
    if (!leaveForm.from_date) { toast.error('Select from date'); return; }
    setApplyingLeave(true);
    try {
      await api.post('/hr/leaves', {
        ...leaveForm, to_date: leaveForm.to_date || leaveForm.from_date,
      });
      toast.success('Leave request submitted for approval');
      setShowLeaveForm(false);
      setLeaveForm({ leave_type:'CL', from_date:'', to_date:'', reason:'', is_half_day:false, half_day_part:'morning' });
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to apply leave');
    } finally {
      setApplyingLeave(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <Loader2 className="w-5 h-5 animate-spin text-[#00475a]" />
    </div>
  );

  const att      = status?.attendance;
  const roster   = status?.roster;
  const balances = status?.leave_balances ?? [];
  const leaves   = status?.active_leaves ?? [];
  const hasIn    = !!att?.check_in_time;
  const hasOut   = !!att?.check_out_time;
  const fmt = (t: string) => new Date(t).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});

  const remoteReasons: RemoteReason[] = settings?.remote_reasons ?? [];

  return (
    <div className="p-4 max-w-sm mx-auto">
      {/* Clock */}
      <div className="text-center mb-5">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">
          {time.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}
        </p>
        <p className="text-4xl font-black font-mono text-[#00475a] tabular-nums">
          {time.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}
        </p>
      </div>

      {/* Today's shift */}
      {roster && !roster.is_week_off && (
        <div className="rounded-2xl p-4 mb-3 border-2 text-white"
          style={{ background: roster.color ?? '#00475a', borderColor: roster.color ?? '#00475a' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold opacity-70 uppercase tracking-wide">Your shift today</p>
              <p className="text-xl font-black mt-0.5">{roster.name}</p>
              <p className="text-sm opacity-80">{roster.start_time} – {roster.end_time}</p>
            </div>
            <Clock className="w-8 h-8 opacity-40" />
          </div>
        </div>
      )}
      {roster?.is_week_off && (
        <div className="rounded-2xl p-4 mb-3 bg-slate-100 border-2 border-slate-200 text-center">
          <p className="text-sm font-semibold text-slate-500">Today is your day off 🌴</p>
        </div>
      )}
      {!roster && (
        <div className="rounded-2xl p-4 mb-3 bg-amber-50 border-2 border-amber-200">
          <p className="text-xs text-amber-700 font-medium text-center">No shift assigned for today</p>
        </div>
      )}

      {/* Active leave */}
      {leaves.map((l: any) => (
        <div key={l.id} className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-amber-800">
              {l.leave_type} — {l.status === 'pending' ? 'Pending approval' : 'Approved'}
            </p>
            <p className="text-xs text-amber-600 truncate">
              {new Date(l.from_date).toLocaleDateString('en-IN')} → {new Date(l.to_date).toLocaleDateString('en-IN')}
            </p>
          </div>
        </div>
      ))}

      {/* Geo error */}
      {geoError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-3 flex items-center gap-3">
          <WifiOff className="w-4 h-4 text-red-600 flex-shrink-0" />
          <p className="text-xs text-red-700">{geoError}</p>
        </div>
      )}

      {/* Attendance card */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 mb-3 shadow-sm">
        {/* Check-in / out times */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className={`p-3 rounded-xl text-center ${hasIn ? 'bg-green-50 border border-green-200' : 'bg-slate-50 border border-dashed border-slate-200'}`}>
            <p className="text-xs text-slate-400 mb-1">Check-in</p>
            <p className={`text-xl font-black tabular-nums ${hasIn ? 'text-green-700' : 'text-slate-300'}`}>
              {hasIn ? fmt(att.check_in_time) : '--:--'}
            </p>
            {att?.is_late && (
              <p className="text-[10px] text-orange-600 font-semibold mt-0.5">
                {att.late_minutes}m late
              </p>
            )}
            {hasIn && att?.is_remote && (
              <p className="text-[10px] text-blue-600 font-medium mt-0.5">Remote</p>
            )}
          </div>
          <div className={`p-3 rounded-xl text-center ${hasOut ? 'bg-blue-50 border border-blue-200' : 'bg-slate-50 border border-dashed border-slate-200'}`}>
            <p className="text-xs text-slate-400 mb-1">Check-out</p>
            <p className={`text-xl font-black tabular-nums ${hasOut ? 'text-blue-700' : 'text-slate-300'}`}>
              {hasOut ? fmt(att.check_out_time) : '--:--'}
            </p>
            {hasOut && (
              <p className="text-[10px] text-slate-500 mt-0.5">
                {Number(att.working_hours).toFixed(1)}h worked
              </p>
            )}
          </div>
        </div>

        {/* Action button */}
        {!hasIn ? (
          <button onClick={() => handleCheckIn()} disabled={checking}
            className="w-full py-4 bg-[#00475a] text-white rounded-2xl font-black text-lg hover:bg-[#003d4d] disabled:opacity-50 flex items-center justify-center gap-3 transition-colors shadow-lg shadow-teal-900/20 active:scale-95">
            {checking ? <Loader2 className="w-6 h-6 animate-spin" /> : <LogIn className="w-6 h-6" />}
            Check In
          </button>
        ) : !hasOut ? (
          <button onClick={handleCheckOut} disabled={checking}
            className="w-full py-4 bg-slate-800 text-white rounded-2xl font-black text-lg hover:bg-slate-900 disabled:opacity-50 flex items-center justify-center gap-3 transition-colors active:scale-95">
            {checking ? <Loader2 className="w-6 h-6 animate-spin" /> : <LogOut className="w-6 h-6" />}
            Check Out
          </button>
        ) : (
          <div className="flex items-center justify-center gap-2 py-4 bg-green-50 rounded-2xl border-2 border-green-200">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <span className="text-sm font-bold text-green-700">
              Done for the day — {Number(att.working_hours).toFixed(1)} hours
            </span>
          </div>
        )}
      </div>

      {/* Leave balances */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-700">Leave balance</h2>
          <button onClick={() => setShowLeaveForm(true)}
            className="text-xs font-bold text-[#00475a] px-3 py-1.5 bg-teal-50 rounded-lg hover:bg-teal-100">
            Apply leave
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {balances.filter((b: any) => b.leave_type !== 'LOP').map((b: any) => (
            <div key={b.leave_type} className={`p-2.5 rounded-xl border text-center ${LEAVE_COLORS[b.leave_type] ?? 'bg-slate-50 border-slate-200 text-slate-700'}`}>
              <p className="text-[10px] font-bold uppercase tracking-wide">{b.leave_type}</p>
              <p className="text-2xl font-black mt-0.5">{Number(b.available_days).toFixed(0)}</p>
              <p className="text-[10px] opacity-60">/ {Number(b.total_days)} days</p>
            </div>
          ))}
        </div>
      </div>

      {/* Remote reason modal */}
      {showRemoteModal && outsideFence && (
        <RemoteReasonModal
          reasons={remoteReasons.length > 0 ? remoteReasons : [
            { key:'wfh',      label:'Work from Home',  sub_options:[] },
            { key:'on_duty',  label:'On Duty',         sub_options:[
              { key:'home_collection',   label:'Home Collection' },
              { key:'medicine_delivery', label:'Medicine Delivery' },
              { key:'hospital_visit',    label:'Hospital / Referral Visit' },
              { key:'bank_work',         label:'Bank / Govt. Work' },
            ]},
            { key:'other', label:'Other', sub_options:[] },
          ]}
          distance={outsideFence.distance}
          radius={outsideFence.radius}
          onSubmit={(reason, sub, note) => {
            setShowRemoteModal(false);
            handleCheckIn(reason, sub, note, pendingGeo);
          }}
          onCancel={() => { setShowRemoteModal(false); setPendingGeo(null); }}
        />
      )}

      {/* Apply leave modal */}
      {showLeaveForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5">
            <h3 className="font-bold text-slate-900 mb-4">Apply for leave</h3>
            <div className="space-y-3">
              <select value={leaveForm.leave_type}
                onChange={e => setLeaveForm(p=>({...p,leave_type:e.target.value}))}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:border-[#00475a]">
                {balances.map((b: any) => (
                  <option key={b.leave_type} value={b.leave_type}>
                    {b.leave_type} — {Number(b.available_days).toFixed(1)} days left
                  </option>
                ))}
                <option value="LOP">LOP — Loss of Pay</option>
              </select>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">From</label>
                  <input type="date" value={leaveForm.from_date}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={e => setLeaveForm(p=>({...p,from_date:e.target.value}))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00475a]" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">To</label>
                  <input type="date" value={leaveForm.to_date||leaveForm.from_date}
                    min={leaveForm.from_date||new Date().toISOString().split('T')[0]}
                    onChange={e => setLeaveForm(p=>({...p,to_date:e.target.value}))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00475a]" />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={leaveForm.is_half_day}
                  onChange={e => setLeaveForm(p=>({...p,is_half_day:e.target.checked}))}
                  className="w-4 h-4 accent-[#00475a]" />
                <span className="text-sm">Half day</span>
                {leaveForm.is_half_day && (
                  <select value={leaveForm.half_day_part}
                    onChange={e => setLeaveForm(p=>({...p,half_day_part:e.target.value}))}
                    className="ml-1 px-2 py-1 border border-slate-200 rounded-lg text-xs bg-white">
                    <option value="morning">Morning</option>
                    <option value="evening">Evening</option>
                  </select>
                )}
              </label>
              <textarea value={leaveForm.reason}
                onChange={e => setLeaveForm(p=>({...p,reason:e.target.value}))}
                rows={2} placeholder="Reason..."
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:border-[#00475a]" />
              <div className="flex gap-3">
                <button onClick={() => setShowLeaveForm(false)}
                  className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium">
                  Cancel
                </button>
                <button onClick={handleApplyLeave} disabled={applyingLeave}
                  className="flex-1 py-2.5 bg-[#00475a] text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                  {applyingLeave ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
