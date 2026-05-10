'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function DoctorProfilesPage() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ full_name: '', qualification: '', registration_no: '', designation: '' });

  const { data: doctors = [], isLoading } = useQuery({
    queryKey: ['doctor-profiles'],
    queryFn: () => api.get('/settings/doctor-profiles').then(r => r.data),
  });

  const { data: clinic = {} as any } = useQuery({
    queryKey: ['clinic-profile'],
    queryFn: () => api.get('/settings/clinic-profile').then(r => r.data),
  });

  const [clinicForm, setClinicForm] = useState({
    clinic_address: '', clinic_phone: '', clinic_email: '',
    gstin: '', license_no: '', website: '',
  });

  useEffect(() => {
    if (clinic && Object.keys(clinic).length > 0) {
      setClinicForm({
        clinic_address: clinic.clinic_address || clinic.address || '',
        clinic_phone: clinic.clinic_phone || clinic.phone || '',
        clinic_email: clinic.clinic_email || clinic.email || '',
        gstin: clinic.gstin || '',
        license_no: clinic.license_no || '',
        website: clinic.website || '',
      });
    }
  }, [clinic]);

  const updateDoctor = useMutation({
    mutationFn: ({ id, ...data }: any) => api.patch(`/settings/doctor-profiles/${id}`, data),
    onSuccess: () => {
      toast.success('Doctor profile updated');
      qc.invalidateQueries({ queryKey: ['doctor-profiles'] });
      setEditingId(null);
    },
    onError: () => toast.error('Failed to update'),
  });

  const updateClinic = useMutation({
    mutationFn: (data: any) => api.patch('/settings/clinic-profile', data),
    onSuccess: () => {
      toast.success('Clinic profile updated');
      qc.invalidateQueries({ queryKey: ['clinic-profile'] });
    },
    onError: () => toast.error('Failed to update'),
  });

  const startEdit = (doc: any) => {
    setEditingId(doc.id);
    setForm({
      full_name: doc.full_name || '',
      qualification: doc.qualification || '',
      registration_no: doc.registration_no || '',
      designation: doc.designation || '',
    });
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Doctor & Clinic Profiles</h1>
        <p className="text-sm text-gray-500 mt-1">Configure doctor credentials and clinic details for prescription reports</p>
      </div>

      {/* DOCTOR PROFILES */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="px-5 py-4 bg-[#00475a]">
          <h2 className="text-white font-semibold text-sm">Doctor Profiles</h2>
          <p className="text-white/60 text-xs mt-0.5">These details appear on prescription reports as the doctor&#39;s signature</p>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : doctors.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No doctors found</div>
        ) : (
          <div className="divide-y">
            {doctors.map((doc: any) => (
              <div key={doc.id} className="p-4">
                {editingId === doc.id ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-500 font-medium block mb-1">Doctor Name</label>
                        <input value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#00475a] focus:ring-1 focus:ring-[#00475a] outline-none"
                          placeholder="DR FAHEEM" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 font-medium block mb-1">Qualification</label>
                        <input value={form.qualification} onChange={e => setForm(p => ({ ...p, qualification: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#00475a] focus:ring-1 focus:ring-[#00475a] outline-none"
                          placeholder="MBBS, MD (General Medicine)" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 font-medium block mb-1">Registration No.</label>
                        <input value={form.registration_no} onChange={e => setForm(p => ({ ...p, registration_no: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#00475a] focus:ring-1 focus:ring-[#00475a] outline-none"
                          placeholder="KMC/R/12345" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 font-medium block mb-1">Designation</label>
                        <input value={form.designation} onChange={e => setForm(p => ({ ...p, designation: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#00475a] focus:ring-1 focus:ring-[#00475a] outline-none"
                          placeholder="Consultant Physician" />
                      </div>
                    </div>

                    {/* Live Preview */}
                    <div className="bg-gray-50 border rounded-lg p-4">
                      <p className="text-xs text-gray-400 mb-2">Preview (as it appears on prescription):</p>
                      <div className="text-right">
                        <div className="inline-block border-t border-gray-400 pt-1.5 min-w-[180px]">
                          <div className="text-sm font-bold text-[#00475a]">Dr. {form.full_name || '...'}</div>
                          {form.qualification && <div className="text-xs text-gray-600">{form.qualification}</div>}
                          {form.designation && <div className="text-xs text-gray-600">{form.designation}</div>}
                          {form.registration_no && <div className="text-xs text-gray-500">Reg. No: {form.registration_no}</div>}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button onClick={() => updateDoctor.mutate({ id: doc.id, ...form })}
                        disabled={updateDoctor.isPending}
                        className="px-4 py-2 bg-[#00475a] text-white text-sm rounded-lg hover:bg-[#003847] disabled:opacity-50">
                        {updateDoctor.isPending ? 'Saving...' : 'Save'}
                      </button>
                      <button onClick={() => setEditingId(null)}
                        className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-gray-900">{doc.full_name}</div>
                      <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                        {doc.qualification ? (
                          <span>{doc.qualification}</span>
                        ) : (
                          <span className="text-amber-600">⚠️ No qualification set</span>
                        )}
                        {doc.registration_no ? (
                          <span>Reg: {doc.registration_no}</span>
                        ) : (
                          <span className="text-amber-600">⚠️ No reg. no.</span>
                        )}
                        {doc.designation && <span>{doc.designation}</span>}
                      </div>
                    </div>
                    <button onClick={() => startEdit(doc)}
                      className="px-3 py-1.5 text-xs bg-gray-100 text-[#00475a] rounded-lg hover:bg-gray-200 font-medium">
                      Edit
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CLINIC PROFILE */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="px-5 py-4 bg-[#00475a]">
          <h2 className="text-white font-semibold text-sm">Clinic Profile</h2>
          <p className="text-white/60 text-xs mt-0.5">Appears as letterhead on prescriptions and reports</p>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500 font-medium block mb-1">Clinic Address</label>
              <textarea value={clinicForm.clinic_address}
                onChange={e => setClinicForm(p => ({ ...p, clinic_address: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#00475a] focus:ring-1 focus:ring-[#00475a] outline-none resize-none"
                placeholder="MediSyn Speciality Clinic, Taliparamba, Kannur, Kerala - 670141" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Phone</label>
              <input value={clinicForm.clinic_phone}
                onChange={e => setClinicForm(p => ({ ...p, clinic_phone: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#00475a] focus:ring-1 focus:ring-[#00475a] outline-none"
                placeholder="+91 9XXXXXXXXX" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Email</label>
              <input value={clinicForm.clinic_email}
                onChange={e => setClinicForm(p => ({ ...p, clinic_email: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#00475a] focus:ring-1 focus:ring-[#00475a] outline-none"
                placeholder="clinic@example.com" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">GSTIN</label>
              <input value={clinicForm.gstin}
                onChange={e => setClinicForm(p => ({ ...p, gstin: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#00475a] outline-none"
                placeholder="32XXXXX1234X1ZX" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Drug License No.</label>
              <input value={clinicForm.license_no}
                onChange={e => setClinicForm(p => ({ ...p, license_no: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#00475a] outline-none"
                placeholder="KL/R/XX/XXXX" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Website</label>
              <input value={clinicForm.website}
                onChange={e => setClinicForm(p => ({ ...p, website: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#00475a] outline-none"
                placeholder="www.medisynclinic.in" />
            </div>
          </div>

          {/* Letterhead Preview */}
          <div className="bg-gray-50 border rounded-lg p-4 mt-2">
            <p className="text-xs text-gray-400 mb-2">Preview (as it appears on prescriptions):</p>
            <div className="text-center py-2 border-b-2 border-[#00475a]">
              <div className="text-base font-extrabold text-[#00475a] tracking-wide">{clinic?.name || 'MediSyn Speciality Clinic'}</div>
              {clinicForm.clinic_address && <div className="text-xs text-gray-500 mt-0.5">{clinicForm.clinic_address}</div>}
              <div className="text-xs text-gray-500 mt-0.5">
                {[clinicForm.clinic_phone, clinicForm.clinic_email].filter(Boolean).join('  |  ')}
                {clinicForm.license_no && `  |  DL: ${clinicForm.license_no}`}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button onClick={() => updateClinic.mutate(clinicForm)}
              disabled={updateClinic.isPending}
              className="px-4 py-2 bg-[#00475a] text-white text-sm rounded-lg hover:bg-[#003847] disabled:opacity-50">
              {updateClinic.isPending ? 'Saving...' : 'Save Clinic Details'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
