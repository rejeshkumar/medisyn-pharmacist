'use client';

import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { getToken } from '@/lib/auth';
import { Mic, MicOff, Loader2, CheckCircle, X, Volume2, ChevronDown, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const LANGUAGES = [
  { code: 'en-IN', label: 'English' },
  { code: 'ml-IN', label: 'Malayalam' },
  { code: 'hi-IN', label: 'Hindi' },
  { code: 'ta-IN', label: 'Tamil' },
  { code: 'te-IN', label: 'Telugu' },
  { code: 'kn-IN', label: 'Kannada' },
  { code: 'mr-IN', label: 'Marathi' },
  { code: 'gu-IN', label: 'Gujarati' },
  { code: 'bn-IN', label: 'Bengali' },
];

interface StructuredNotes {
  chief_complaint?: string;
  history_of_present_illness?: string;
  examination_findings?: string;
  diagnosis?: string;
  advice?: string;
  follow_up?: string;
  raw_transcription: string;
}

interface Props {
  patientContext?: { age?: number; gender?: string; chief_complaint?: string; vitals?: any; };
  onNotesReady: (notes: StructuredNotes) => void;
}

type RecordingState = 'idle' | 'recording' | 'processing' | 'done';

export default function VoiceInput({ patientContext, onNotesReady }: Props) {
  const [state, setState] = useState<RecordingState>('idle');
  const [transcript, setTranscript] = useState('');
  const [duration, setDuration] = useState(0);
  const [selectedLang, setSelectedLang] = useState('en-IN');
  const [aiStatus, setAiStatus] = useState<'unknown' | 'ok' | 'error'>('unknown');
  const [aiStatusReason, setAiStatusReason] = useState('');
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<NodeJS.Timeout | null>(null);
  const recognition = useRef<any>(null);

  // Check AI health on mount so the doctor knows if voice AI will work before trying
  useEffect(() => {
    axios.get(`${API}/ai/health`)
      .then(() => setAiStatus('ok'))
      .catch(e => {
        const reason = e?.response?.data?.reason || 'AI service unavailable';
        setAiStatus('error');
        setAiStatusReason(reason);
      });
  }, []);

  const startRecording = async () => {
    setTranscript('');
    setDuration(0);

    // Use Web Speech API for live transcription if available
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      // Use browser's built-in speech recognition for transcription
      recognition.current = new SpeechRecognition();
      recognition.current.continuous = true;
      recognition.current.interimResults = true;
      recognition.current.lang = selectedLang;

      let finalTranscript = '';
      recognition.current.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results[i][0].transcript;
          if (event.results[i].isFinal) finalTranscript += t + ' ';
          else interim = t;
        }
        setTranscript(finalTranscript + interim);
      };

      recognition.current.onerror = (e: any) => {
        if (e.error !== 'aborted') toast.error('Speech recognition error');
      };

      recognition.current.start();
    }

    setState('recording');
    timer.current = setInterval(() => setDuration(d => d + 1), 1000);
  };

  const stopRecording = async () => {
    if (timer.current) clearInterval(timer.current);

    if (recognition.current) {
      recognition.current.stop();
    }

    setState('processing');

    // Get final transcript
    const finalText = transcript.trim();
    if (!finalText) {
      toast.error('No speech detected — please try again');
      setState('idle');
      return;
    }

    try {
      const r = await axios.post(`${API}/ai/transcribe`,
        { transcribedText: finalText, patientContext, inputLanguage: selectedLang },
        { headers: { Authorization: `Bearer ${getToken()}` } });
      onNotesReady(r.data);
      setState('done');
      toast.success('Notes structured successfully');
    } catch (e: any) {
      const reason = e?.response?.data?.message || 'Failed to process notes';
      toast.error(reason, { duration: 6000 });
      setState('idle');
    }
  };

  const reset = () => {
    setState('idle');
    setTranscript('');
    setDuration(0);
  };

  const formatDuration = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const currentLangLabel = LANGUAGES.find(l => l.code === selectedLang)?.label ?? 'English';

  return (
    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
      {/* AI health banner — shows only when key is misconfigured */}
      {aiStatus === 'error' && (
        <div className="flex items-start gap-2 mb-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <div>
            <span className="font-semibold">AI not available: </span>
            <span>{aiStatusReason}</span>
            <a
              href="https://railway.app"
              target="_blank"
              rel="noreferrer"
              className="ml-1 underline font-medium hover:text-amber-900"
            >
              Fix in Railway →
            </a>
          </div>
        </div>
      )}
      <div className="flex items-center gap-3 mb-3">
        <Volume2 className="w-4 h-4 text-[#00475a]" />
        <span className="text-sm font-semibold text-slate-700">Voice Notes</span>
        <span className="text-xs text-slate-400">Speak your consultation findings</span>
        {/* Language selector — only shown when idle */}
        {state === 'idle' && (
          <div className="ml-auto relative">
            <select
              value={selectedLang}
              onChange={e => setSelectedLang(e.target.value)}
              className="appearance-none text-xs bg-white border border-slate-200 rounded-lg pl-3 pr-7 py-1.5 text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a] cursor-pointer"
            >
              {LANGUAGES.map(l => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        )}
      </div>

      {state === 'idle' && (
        <button onClick={startRecording}
          className="flex items-center gap-2 bg-[#00475a] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#00475a]/90 transition-colors">
          <Mic className="w-4 h-4" />Start Dictating in {currentLangLabel}
        </button>
      )}

      {state === 'recording' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-red-600">Recording {formatDuration(duration)}</span>
            </div>
            <button onClick={stopRecording}
              className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-600 transition-colors ml-auto">
              <MicOff className="w-4 h-4" />Stop & Process
            </button>
          </div>
          {transcript && (
            <div className="bg-white rounded-lg p-3 border border-slate-100 max-h-24 overflow-y-auto">
              <p className="text-xs text-slate-600 italic">{transcript}</p>
            </div>
          )}
        </div>
      )}

      {state === 'processing' && (
        <div className="flex items-center gap-3 py-2">
          <Loader2 className="w-5 h-5 animate-spin text-[#00475a]" />
          <span className="text-sm text-slate-600">AI is structuring your notes...</span>
        </div>
      )}

      {state === 'done' && (
        <div className="flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <span className="text-sm text-green-700 font-medium">Notes imported successfully</span>
          <button onClick={reset} className="ml-auto text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
            <X className="w-3 h-3" />Clear
          </button>
        </div>
      )}
    </div>
  );
}
