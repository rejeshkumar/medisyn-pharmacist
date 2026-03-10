'use client';

import { useState } from 'react';
import axios from 'axios';
import { getToken } from '@/lib/auth';
import { Brain, Loader2, ChevronDown, ChevronUp, AlertTriangle, FlaskConical, Zap, X } from 'lucide-react';
import toast from 'react-hot-toast';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface DiagnosisInput {
  symptoms: string;
  age?: number;
  gender?: string;
  vitals?: any;
  duration?: string;
  existing_conditions?: string;
  current_medicines?: string;
}

interface ProbableDiagnosis {
  diagnosis: string;
  likelihood: 'high' | 'medium' | 'low';
  reasoning: string;
}

interface DiagnosisResult {
  probable_diagnoses: ProbableDiagnosis[];
  red_flags: string[];
  suggested_investigations: string[];
  immediate_actions?: string;
  disclaimer: string;
}

const LIKELIHOOD_CONFIG = {
  high:   { badge: 'bg-red-100 text-red-700', bar: 'bg-red-500', width: 'w-4/5' },
  medium: { badge: 'bg-amber-100 text-amber-700', bar: 'bg-amber-500', width: 'w-3/5' },
  low:    { badge: 'bg-slate-100 text-slate-600', bar: 'bg-slate-400', width: 'w-2/5' },
};

interface Props {
  patientContext?: { age?: number; gender?: string; vitals?: any; chief_complaint?: string; existing_conditions?: string; current_medicines?: string; };
}

export default function DiagnosisSuggestions({ patientContext }: Props) {
  const [open, setOpen] = useState(false);
  const [symptoms, setSymptoms] = useState(patientContext?.chief_complaint || '');
  const [duration, setDuration] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [showDetails, setShowDetails] = useState<number | null>(null);

  const getAISuggestions = async () => {
    if (!symptoms.trim()) { toast.error('Enter symptoms first'); return; }
    setLoading(true);
    try {
      const r = await axios.post(`${API}/ai/diagnose`, {
        symptoms,
        duration,
        age: patientContext?.age,
        gender: patientContext?.gender,
        vitals: patientContext?.vitals,
        existing_conditions: patientContext?.existing_conditions,
        current_medicines: patientContext?.current_medicines,
      }, { headers: { Authorization: `Bearer ${getToken()}` } });
      setResult(r.data);
    } catch {
      toast.error('AI diagnosis unavailable');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-purple-100 overflow-hidden">
      {/* Header toggle */}
      <button onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 bg-purple-50 flex items-center gap-3 hover:bg-purple-100 transition-colors">
        <div className="w-7 h-7 rounded-lg bg-purple-600 flex items-center justify-center flex-shrink-0">
          <Brain className="w-4 h-4 text-white" />
        </div>
        <span className="text-sm font-semibold text-purple-800 flex-1 text-left">AI Diagnosis Assistant</span>
        <span className="text-xs text-purple-500 mr-2">Powered by Claude</span>
        {open ? <ChevronUp className="w-4 h-4 text-purple-400" /> : <ChevronDown className="w-4 h-4 text-purple-400" />}
      </button>

      {open && (
        <div className="p-4 bg-white space-y-4">
          {/* Input */}
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Symptoms</label>
              <textarea value={symptoms} onChange={e => setSymptoms(e.target.value)} rows={2}
                placeholder="Describe symptoms e.g. fever, cough, chest pain for 3 days..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 resize-none" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Duration</label>
              <input value={duration} onChange={e => setDuration(e.target.value)}
                placeholder="e.g. 3 days, 1 week"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400" />
            </div>
            <button onClick={getAISuggestions} disabled={loading || !symptoms.trim()}
              className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
              {loading ? 'Analysing...' : 'Get AI Suggestions'}
            </button>
          </div>

          {/* Results */}
          {result && (
            <div className="space-y-4 pt-2 border-t border-slate-100">
              {/* Immediate actions */}
              {result.immediate_actions && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-2">
                  <Zap className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-700 font-medium">{result.immediate_actions}</p>
                </div>
              )}

              {/* Probable diagnoses */}
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Probable Diagnoses</h4>
                <div className="space-y-2">
                  {result.probable_diagnoses.map((d, i) => {
                    const cfg = LIKELIHOOD_CONFIG[d.likelihood];
                    return (
                      <div key={i} className="bg-slate-50 rounded-lg overflow-hidden">
                        <button onClick={() => setShowDetails(showDetails === i ? null : i)}
                          className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-100 transition-colors text-left">
                          <span className="text-sm font-medium text-slate-800 flex-1">{d.diagnosis}</span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${cfg.badge}`}>{d.likelihood}</span>
                          {showDetails === i ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
                        </button>
                        {showDetails === i && (
                          <div className="px-4 pb-3 text-sm text-slate-600 border-t border-slate-100 pt-2">{d.reasoning}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Red flags */}
              {result.red_flags.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-red-500" />Red Flags to Rule Out
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {result.red_flags.map((flag, i) => (
                      <span key={i} className="text-xs bg-red-50 text-red-700 border border-red-100 px-2 py-1 rounded-lg">{flag}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Investigations */}
              {result.suggested_investigations.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <FlaskConical className="w-3 h-3 text-blue-500" />Suggested Investigations
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {result.suggested_investigations.map((inv, i) => (
                      <span key={i} className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-1 rounded-lg">{inv}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Disclaimer */}
              <p className="text-xs text-slate-400 italic border-t border-slate-100 pt-3">{result.disclaimer}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
