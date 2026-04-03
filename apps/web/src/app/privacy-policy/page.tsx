'use client';

import Link from 'next/link';
import { ArrowLeft, Shield } from 'lucide-react';

export default function PrivacyPolicyPage() {
  const CLINIC = 'MediSyn Speciality Clinic';
  const EMAIL  = 'pharmacy@medisynweb-production.up.railway.app';
  const DATE   = 'April 2026';

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm p-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-[#00475a]/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-[#00475a]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Privacy Policy</h1>
            <p className="text-sm text-gray-500">{CLINIC} · Last updated: {DATE}</p>
          </div>
        </div>

        <div className="prose prose-sm max-w-none text-gray-700 space-y-6">

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Who We Are</h2>
            <p>
              {CLINIC} ("we", "our", "us") operates a specialty clinic and pharmacy at
              TMC XVII-1260,1261,1264,1265, Chirvakku Junction, Taliparamba, Kannur, Kerala 670141.
              This Privacy Policy explains how we collect, use, store and protect your personal data
              in accordance with the <strong>Digital Personal Data Protection Act, 2023 (DPDPA)</strong> of India.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">2. Data We Collect</h2>
            <p>We collect and process the following personal data:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Identity data:</strong> Name, date of birth, gender, UHID</li>
              <li><strong>Contact data:</strong> Mobile number, email address, residential address</li>
              <li><strong>Health data:</strong> Prescriptions, medicines dispensed, visit history, doctor consultations</li>
              <li><strong>Financial data:</strong> Bill amounts, payment mode (no card numbers stored)</li>
              <li><strong>Device data:</strong> IP address at time of consent (for DPDPA compliance)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">3. Why We Collect Your Data</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To provide pharmacy and medical services to you</li>
              <li>To maintain accurate dispensing records as required by Kerala Drug & Cosmetics Rules</li>
              <li>To send medication refill reminders via WhatsApp (only with your consent)</li>
              <li>To comply with GST, Schedule H/H1/X drug register requirements</li>
              <li>To contact you regarding appointments or follow-up care</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">4. Legal Basis for Processing</h2>
            <p>
              We process your personal data under the following legal bases as per DPDPA 2023:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Consent:</strong> You give explicit consent when registering at our clinic</li>
              <li><strong>Legal obligation:</strong> Drug dispensing records are mandatory under Drug & Cosmetics Act 1940</li>
              <li><strong>Legitimate interest:</strong> Providing continuity of care and medication safety</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Data Retention</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Patient records: Retained for <strong>5 years</strong> from last visit (as per pharmacy regulations)</li>
              <li>Prescription records: Retained for <strong>2 years</strong> (as required by Kerala Drug Rules)</li>
              <li>Schedule H/X records: Retained for <strong>3 years</strong></li>
              <li>Billing and GST records: Retained for <strong>7 years</strong> (as per Income Tax Act)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Your Rights Under DPDPA 2023</h2>
            <p>You have the following rights regarding your personal data:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Right to access:</strong> Request a copy of your data held by us</li>
              <li><strong>Right to correction:</strong> Request correction of inaccurate data</li>
              <li><strong>Right to erasure:</strong> Request deletion of your data (subject to legal retention requirements)</li>
              <li><strong>Right to withdraw consent:</strong> Withdraw consent for WhatsApp messages at any time by replying STOP</li>
              <li><strong>Right to grievance redressal:</strong> Raise a complaint with our Data Protection Officer</li>
            </ul>
            <p className="mt-2">
              To exercise any of these rights, please contact us at <strong>{EMAIL}</strong> or
              speak to our pharmacist in person.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Data Sharing</h2>
            <p>We do <strong>not</strong> sell your personal data. We share data only with:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Consulting doctors at our clinic (for your treatment)</li>
              <li>WhatsApp Business API (Meta) — only for sending you messages you consented to</li>
              <li>Government authorities when legally required (drug inspectors, GST authorities)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">8. Data Security</h2>
            <p>
              Your data is stored on secure cloud infrastructure (Railway.app) with encrypted connections.
              Access is restricted to authorised clinic staff only through role-based access controls.
              All data access is logged in our audit system.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">9. Data Breach Notification</h2>
            <p>
              In the event of a data breach affecting your personal data, we will notify you within
              <strong> 72 hours</strong> of becoming aware of the breach, as required by DPDPA 2023.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">10. Contact — Data Protection Officer</h2>
            <p>
              For any privacy-related queries, requests or complaints:<br />
              <strong>{CLINIC}</strong><br />
              TMC XVII-1260, Chirvakku Junction, Taliparamba, Kannur, Kerala 670141<br />
              Phone: 6282208880<br />
              Email: {EMAIL}
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">11. Changes to This Policy</h2>
            <p>
              We may update this policy from time to time. The current version and date are shown
              at the top of this page. Continued use of our services after changes constitutes
              acceptance of the updated policy.
            </p>
          </section>

        </div>

        <div className="mt-10 pt-6 border-t border-gray-100">
          <Link href="/" className="flex items-center gap-2 text-sm text-[#00475a] hover:underline">
            <ArrowLeft className="w-4 h-4" />
            Back to MediSyn
          </Link>
        </div>

      </div>
    </div>
  );
}
