// ConsentCheckbox.tsx
// Drop into: apps/web/src/components/patients/ConsentCheckbox.tsx
// Add to your patient registration form (Create Patient modal/page)
//
// Usage:
//   <ConsentCheckbox
//     checked={consentGiven}
//     onChange={setConsentGiven}
//     required
//   />

'use client';

import { useState } from 'react';
import { Shield, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  checked: boolean;
  onChange: (val: boolean) => void;
  required?: boolean;
}

export function ConsentCheckbox({ checked, onChange, required }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`rounded-xl border-2 p-4 transition-all ${
      checked
        ? 'border-[#00475a] bg-[#00475a]/5'
        : required && !checked
        ? 'border-amber-300 bg-amber-50'
        : 'border-gray-200 bg-gray-50'
    }`}>
      {/* Main consent toggle */}
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-[#00475a] cursor-pointer flex-shrink-0"
        />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#00475a] flex-shrink-0" />
            <span className="text-sm font-semibold text-gray-900">
              Data Privacy Consent
              {required && <span className="text-red-500 ml-1">*</span>}
            </span>
          </div>
          <p className="text-xs text-gray-600 mt-1 leading-relaxed">
            I consent to MediSyn Speciality Clinic collecting and processing my personal and
            health data for the purpose of providing pharmacy and medical services, as described
            in the{' '}
            <a
              href="/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#00475a] underline inline-flex items-center gap-0.5"
              onClick={(e) => e.stopPropagation()}
            >
              Privacy Policy
              <ExternalLink className="w-3 h-3" />
            </a>.
            I understand I can withdraw consent or request data deletion at any time.
          </p>
        </div>
      </label>

      {/* Expandable details */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mt-2 ml-7 transition-colors"
      >
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {expanded ? 'Hide details' : 'What data do we collect?'}
      </button>

      {expanded && (
        <div className="ml-7 mt-2 text-xs text-gray-600 space-y-1 bg-white rounded-lg p-3 border border-gray-100">
          <p className="font-medium text-gray-700">We collect and use:</p>
          <ul className="space-y-0.5 list-disc pl-4">
            <li>Name, mobile number, date of birth, address</li>
            <li>Prescription details and medicines dispensed</li>
            <li>Visit history and billing records</li>
            <li>WhatsApp messages for refill reminders (only if you consent separately)</li>
          </ul>
          <p className="font-medium text-gray-700 mt-2">Your rights (DPDPA 2023):</p>
          <ul className="space-y-0.5 list-disc pl-4">
            <li>Access your data at any time by asking our pharmacist</li>
            <li>Request correction of inaccurate information</li>
            <li>Request deletion of your data (subject to legal retention requirements)</li>
            <li>Reply STOP to any WhatsApp message to opt out</li>
          </ul>
        </div>
      )}

      {/* Warning if required but not checked */}
      {required && !checked && (
        <p className="text-xs text-amber-600 mt-2 ml-7 flex items-center gap-1">
          ⚠️ Consent is required to register as a patient
        </p>
      )}
    </div>
  );
}

export default ConsentCheckbox;
