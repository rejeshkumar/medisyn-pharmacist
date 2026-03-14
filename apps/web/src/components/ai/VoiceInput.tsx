'use client';

import { useState, useRef } from 'react';
import { Mic, MicOff, Loader2, CheckCircle, Languages } from 'lucide-react';
import toast from 'react-hot-toast';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ml', label: 'Malayalam' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ta', label: 'Tamil' },
];

const LANG_NAMES: Record<string, string> = {
  en: 'English', ml: 'Malayalam', hi: 'Hindi', ta: 'Tamil',
};

interface VoiceInputProps {
  patientContext?: {
    age?: number;
    gender?: string;
    chief_complaint?: string;
    existing_conditions?: string;
  };
  onNotesReady: (notes: {
    chief_complaint?: string;
    history_of_present_illness?: string;
    examination_findings?: string;
    diagnosis?: string;
    advice?: string;
    raw_transcript?: string;
  }) => void;
}

export default function VoiceInput({ patientContext, onNotesReady }: VoiceInputProps) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [lang, setLang] = useState('en');
  const [showLang, setShowLang] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Prefer webm/opus for best Claude compatibility, fall back to any available
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => processRecording(mimeType);
      recorder.start(250); // collect chunks every 250ms

      setRecording(true);
      setTranscript('');
      setSecondsElapsed(0);
      timerRef.current = setInterval(() => setSecondsElapsed(s => s + 1), 1000);
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        toast.error('Microphone access denied. Please allow mic access in browser settings.');
      } else {
        toast.error('Could not access microphone.');
      }
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    setRecording(false);
    setProcessing(true);
  };

  const processRecording = async (mimeType: string) => {
    const blob = new Blob(chunksRef.current, { type: mimeType });

    if (blob.size < 1000) {
      toast.error('Recording too short — please speak for at least 2 seconds.');
      setProcessing(false);
      return;
    }

    // Convert audio blob → base64
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]); // strip data:...;base64, prefix
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const mediaType = mimeType.split(';')[0] as 'audio/webm' | 'audio/mp4';

    const contextNote = patientContext
      ? `Patient context: Age ${patientContext.age || 'unknown'}, Gender ${patientContext.gender || 'unknown'}, Chief complaint: ${patientContext.chief_complaint || 'not specified'}${patientContext.existing_conditions ? `, Known conditions: ${patientContext.existing_conditions}` : ''}.`
      : '';

    const systemPrompt = `You are a medical transcription assistant for a clinic in India. 
The doctor is speaking in ${LANG_NAMES[lang]}${lang !== 'en' ? ' (transcribe and translate to English)' : ''}.
${contextNote}
Listen to the doctor's voice recording and extract structured clinical notes.
Respond ONLY with a JSON object — no markdown, no explanation, no preamble.
JSON fields (all optional, only include what is mentioned):
{
  "chief_complaint": "...",
  "history_of_present_illness": "...",
  "examination_findings": "...",
  "diagnosis": "...",
  "advice": "...",
  "raw_transcript": "exact words spoken"
}`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: systemPrompt,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Please transcribe and structure these clinical voice notes spoken in ${LANG_NAMES[lang]}.`,
              },
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64,
                },
              },
            ],
          }],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const msg = data?.error?.message || 'Claude API error';
        // Audio input not supported fallback — use text-only transcription prompt
        if (msg.includes('audio') || msg.includes('document') || response.status === 400) {
          toast.error('Audio transcription requires Claude to support audio input. Using text fallback — please type your notes instead.');
        } else {
          toast.error(`Transcription failed: ${msg}`);
        }
        setProcessing(false);
        return;
      }

      const text = data.content?.[0]?.text || '';
      const clean = text.replace(/```json|```/g, '').trim();

      let notes: any = {};
      try {
        notes = JSON.parse(clean);
      } catch {
        // Claude returned plain text — treat as raw transcript
        notes = { raw_transcript: text };
      }

      setTranscript(notes.raw_transcript || text);
      onNotesReady(notes);
      toast.success('Voice notes applied to form');
    } catch (err) {
      toast.error('Network error — could not reach Claude API.');
    } finally {
      setProcessing(false);
    }
  };

  const fmtTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="bg-teal-50 border border-teal-100 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#00475a] flex items-center justify-center flex-shrink-0">
            <Mic className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#00475a]">Voice Dictation</p>
            <p className="text-xs text-teal-600">Speak symptoms, findings & diagnosis — auto-fills form</p>
          </div>
        </div>

        {/* Language picker */}
        <div className="relative">
          <button
            onClick={() => setShowLang(!showLang)}
            disabled={recording || processing}
            className="flex items-center gap-1.5 text-xs border border-teal-200 bg-white text-teal-700 px-2.5 py-1.5 rounded-lg hover:bg-teal-50 transition-colors disabled:opacity-50"
          >
            <Languages className="w-3.5 h-3.5" />
            {LANG_NAMES[lang]}
          </button>
          {showLang && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowLang(false)} />
              <div className="absolute right-0 top-full mt-1 bg-white border border-slate-100 rounded-xl shadow-lg z-20 overflow-hidden min-w-[130px]">
                {LANGUAGES.map(l => (
                  <button key={l.code} onClick={() => { setLang(l.code); setShowLang(false); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${lang === l.code ? 'text-[#00475a] font-semibold bg-teal-50' : 'text-slate-700'}`}>
                    {l.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Record button + status */}
      <div className="flex items-center gap-3">
        {!recording && !processing && (
          <button onClick={startRecording}
            className="flex items-center gap-2 bg-[#00475a] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#003d4d] transition-colors">
            <Mic className="w-4 h-4" />
            Start Recording
          </button>
        )}

        {recording && (
          <button onClick={stopRecording}
            className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-600 transition-colors animate-pulse">
            <MicOff className="w-4 h-4" />
            Stop — {fmtTime(secondsElapsed)}
          </button>
        )}

        {processing && (
          <div className="flex items-center gap-2 text-sm text-teal-700">
            <Loader2 className="w-4 h-4 animate-spin" />
            Transcribing with Claude...
          </div>
        )}

        {recording && (
          <div className="flex items-center gap-1.5 text-xs text-red-600">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Recording in {LANG_NAMES[lang]}...
          </div>
        )}
      </div>

      {/* Transcript preview */}
      {transcript && !recording && !processing && (
        <div className="mt-3 bg-white border border-teal-100 rounded-lg px-3 py-2.5 flex items-start gap-2">
          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-slate-600 mb-0.5">Transcript applied:</p>
            <p className="text-xs text-slate-500 italic line-clamp-2">{transcript}</p>
          </div>
        </div>
      )}

      <p className="text-xs text-teal-500 mt-2">
        Speak naturally — includes medicine names, dosages, instructions. Translated to English automatically.
      </p>
    </div>
  );
}
