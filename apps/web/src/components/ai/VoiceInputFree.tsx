'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface VoiceInputFreeProps {
  onTranscript: (text: string, field: 'symptoms' | 'examination' | 'diagnosis' | 'advice') => void;
  activeField: 'symptoms' | 'examination' | 'diagnosis' | 'advice';
}

export default function VoiceInputFree({ onTranscript, activeField }: VoiceInputFreeProps) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-IN';

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t;
        else interim += t;
      }
      setTranscript(final || interim);
      if (final) {
        onTranscript(final.trim(), activeField);
        setTranscript('');
      }
    };

    recognition.onerror = (e: any) => {
      if (e.error !== 'no-speech') {
        toast.error('Voice recognition error: ' + e.error);
      }
      setListening(false);
    };

    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
  }, [activeField, onTranscript]);

  const toggle = () => {
    if (!supported) {
      toast.error('Voice not supported in this browser. Use Chrome or Edge.');
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
    } else {
      setTranscript('');
      recognitionRef.current?.start();
      setListening(true);
    }
  };

  if (!supported) return null;

  const fieldLabels = {
    symptoms: 'Symptoms',
    examination: 'Examination',
    diagnosis: 'Diagnosis',
    advice: 'Advice',
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={toggle}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
          listening
            ? 'bg-red-50 border border-red-200 text-red-600 hover:bg-red-100'
            : 'bg-teal-50 border border-teal-200 text-teal-700 hover:bg-teal-100'
        }`}
        title={listening ? 'Stop recording' : `Dictate ${fieldLabels[activeField]}`}
      >
        {listening ? (
          <>
            <MicOff className="w-3.5 h-3.5" />
            Stop
          </>
        ) : (
          <>
            <Mic className="w-3.5 h-3.5" />
            Dictate
          </>
        )}
      </button>
      {listening && (
        <div className="flex items-center gap-2 text-xs text-red-600">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          Recording {fieldLabels[activeField]}...
          {transcript && <span className="text-slate-500 italic truncate max-w-xs">{transcript}</span>}
        </div>
      )}
    </div>
  );
}
