'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { getToken } from '@/lib/auth';
import { AlertTriangle, ShieldCheck, Loader2, ChevronDown, ChevronUp, Info } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Interaction {
  drugs: string[];
  severity: 'mild' | 'moderate' | 'severe';
  description: string;
  recommendation: string;
}

interface InteractionResult {
  interactions: Interaction[];
  safe: boolean;
  summary: string;
}

interface Props {
  medicines: string[]; // list of medicine names currently in the prescription
}

const SEVERITY_CONFIG = {
  severe:   { color: 'bg-red-50 border-red-200 text-red-800', badge: 'bg-red-100 text-red-700', icon: '🚨' },
  moderate: { color: 'bg-amber-50 border-amber-200 text-amber-800', badge: 'bg-amber-100 text-amber-700', icon: '⚠️' },
  mild:     { color: 'bg-yellow-50 border-yellow-200 text-yellow-800', badge: 'bg-yellow-100 text-yellow-700', icon: 'ℹ️' },
};

export default function DrugInteractionChecker({ medicines }: Props) {
  const [result, setResult] = useState<InteractionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [lastChecked, setLastChecked] = useState<string[]>([]);

  const check = async () => {
    if (medicines.length < 2) return;
    setLoading(true);
    try {
      const r = await axios.post(`${API}/ai/drug-interactions`, { medicines },
        { headers: { Authorization: `Bearer ${getToken()}` } });
      setResult(r.data);
      setLastChecked([...medicines]);
    } catch {
      // silent fail — don't disrupt prescription flow
    } finally {
      setLoading(false);
    }
  };

  // Auto-check whenever medicines list changes (debounced)
  useEffect(() => {
    if (medicines.length < 2) { setResult(null); return; }
    const changed = medicines.join(',') !== lastChecked.join(',');
    if (!changed) return;
    const t = setTimeout(check, 1500); // 1.5s debounce
    return () => clearTimeout(t);
  }, [medicines]);

  if (medicines.length < 2) return null;

  return (
    <div className="rounded-xl border overflow-hidden">
      {/* Header */}
      <div className={`px-4 py-3 flex items-center gap-3 ${
        loading ? 'bg-slate-50 border-slate-200' :
        !result ? 'bg-slate-50 border-slate-200' :
        result.safe ? 'bg-green-50 border-green-200' :
        result.interactions.some(i => i.severity === 'severe') ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
      }`}>
        {loading ? (
          <><Loader2 className="w-4 h-4 animate-spin text-slate-500 flex-shrink-0" /><span className="text-sm text-slate-600">Checking drug interactions...</span></>
        ) : result ? (
          result.safe ? (
            <><ShieldCheck className="w-4 h-4 text-green-600 flex-shrink-0" /><span className="text-sm text-green-700 font-medium">{result.summary}</span></>
          ) : (
            <><AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" /><span className="text-sm text-amber-800 font-medium">{result.summary}</span></>
          )
        ) : (
          <><Info className="w-4 h-4 text-slate-400 flex-shrink-0" /><span className="text-sm text-slate-500">Drug interaction check will run automatically</span></>
        )}
        {result && !result.safe && (
          <span className="ml-auto text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
            {result.interactions.length} interaction{result.interactions.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Interaction details */}
      {result && result.interactions.length > 0 && (
        <div className="divide-y divide-slate-100 bg-white">
          {result.interactions.map((interaction, i) => {
            const cfg = SEVERITY_CONFIG[interaction.severity];
            return (
              <div key={i} className={`border-l-4 ${interaction.severity === 'severe' ? 'border-red-500' : interaction.severity === 'moderate' ? 'border-amber-500' : 'border-yellow-400'}`}>
                <button onClick={() => setExpanded(expanded === i ? null : i)}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left">
                  <span className="text-base">{cfg.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">{interaction.drugs.join(' + ')}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${cfg.badge}`}>{interaction.severity}</span>
                  {expanded === i ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                </button>

                {expanded === i && (
                  <div className={`mx-4 mb-3 p-3 rounded-lg ${cfg.color} border`}>
                    <p className="text-sm mb-2">{interaction.description}</p>
                    <p className="text-sm font-semibold">Recommendation: {interaction.recommendation}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
