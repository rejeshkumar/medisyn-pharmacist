'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatCurrency, formatDate, getScheduleClassColor, getConfidenceColor } from '@/lib/utils';
import toast from 'react-hot-toast';
import {
  Search, Plus, Minus, Trash2, ShoppingCart,
  Check, AlertTriangle, X, FileText,
  Loader2, Camera,
} from 'lucide-react';
import BillDocument, { type BillData } from '@/components/billing/BillDocument';

interface CartItem {
  medicine_id: string;
  batch_id: string;
  medicine_name: string;
  batch_number: string;
  expiry_date: string;
  qty: number;
  rate: number;
  gst_percent: number;
  is_substituted: boolean;
  original_medicine_id?: string;
  substitution_reason?: string;
  schedule_class: string;
}

export default function DispensingPage() {
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showSubstitutes, setShowSubstitutes] = useState<string | null>(null);
  const [complianceData, setComplianceData] = useState({ patient_name: '', doctor_name: '', doctor_reg_no: '' });
  const [showCompliance, setShowCompliance] = useState(false);
  const [paymentMode, setPaymentMode] = useState('cash');
  const [discount, setDiscount] = useState(0);
  const [rxImage, setRxImage] = useState<File | null>(null);
  const [aiPrescriptionId, setAiPrescriptionId] = useState<string | null>(null);
  const [aiExtracting, setAiExtracting] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [showAiReview, setShowAiReview] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [completedSale, setCompletedSale] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const { data: medicines, isLoading: searching } = useQuery({
    queryKey: ['medicines-search', search],
    queryFn: () =>
      search.length >= 2
        ? api.get(`/medicines?search=${search}`).then((r) => r.data)
        : Promise.resolve([]),
    enabled: search.length >= 2,
  });

  const { data: substitutes } = useQuery({
    queryKey: ['substitutes', showSubstitutes],
    queryFn: () =>
      api.get(`/substitutes?medicine_id=${showSubstitutes}`).then((r) => r.data),
    enabled: !!showSubstitutes,
  });

  const createSaleMutation = useMutation({
    mutationFn: (payload: any) => api.post('/sales', payload).then((r) => r.data),
    onSuccess: (data) => {
      setShowPreview(false);
      setCompletedSale(data);
      setCart([]);
      setComplianceData({ patient_name: '', doctor_name: '', doctor_reg_no: '' });
      setDiscount(0);
      setAiResult(null);
      setAiPrescriptionId(null);
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(`Bill ${data.bill_number} created!`);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Bill creation failed'),
  });

  const handleAddMedicine = async (medicine: any) => {
    try {
      const { data: bestBatch } = await api.get(`/stock/${medicine.id}/best-batch`);
      if (!bestBatch) {
        if (medicine.id) {
          setShowSubstitutes(medicine.id);
          toast('No stock available. Showing substitutes.', { icon: '⚠️' });
        }
        return;
      }

      const existing = cart.findIndex(
        (i) => i.medicine_id === medicine.id && i.batch_id === bestBatch.id,
      );
      if (existing !== -1) {
        const updated = [...cart];
        updated[existing].qty += 1;
        setCart(updated);
      } else {
        setCart([
          ...cart,
          {
            medicine_id: medicine.id,
            batch_id: bestBatch.id,
            medicine_name: medicine.brand_name,
            batch_number: bestBatch.batch_number,
            expiry_date: bestBatch.expiry_date,
            qty: 1,
            rate: Number(bestBatch.sale_rate),
            gst_percent: Number(medicine.gst_percent || 0),
            is_substituted: false,
            schedule_class: medicine.schedule_class,
          },
        ]);
      }
      setSearch('');

      if (medicine.schedule_class === 'H' || medicine.schedule_class === 'H1' || medicine.schedule_class === 'X') {
        setShowCompliance(true);
        toast('Compliance details required for scheduled drug', { icon: '🔐' });
      }
    } catch (err) {
      toast.error('Failed to fetch stock');
    }
  };

  const handleSubstitute = async (original: CartItem, substitute: any, reason: string) => {
    const { data: bestBatch } = await api.get(`/stock/${substitute.id}/best-batch`);
    if (!bestBatch) { toast.error('No stock for this substitute'); return; }

    const updated = cart.map((item) =>
      item.medicine_id === original.medicine_id
        ? {
            ...item,
            medicine_id: substitute.id,
            batch_id: bestBatch.id,
            medicine_name: substitute.brand_name,
            batch_number: bestBatch.batch_number,
            expiry_date: bestBatch.expiry_date,
            rate: Number(bestBatch.sale_rate),
            is_substituted: true,
            original_medicine_id: original.medicine_id,
            substitution_reason: reason,
            schedule_class: substitute.schedule_class,
          }
        : item,
    );
    setCart(updated);
    setShowSubstitutes(null);
    toast.success('Substitute selected');
  };

  const subtotal = cart.reduce((sum, i) => sum + i.qty * i.rate, 0);
  const taxTotal = cart.reduce((sum, i) => sum + (i.qty * i.rate * i.gst_percent) / 100, 0);
  const discountAmt = discount;
  const total = subtotal + taxTotal - discountAmt;

  const hasScheduledDrugs = cart.some((i) =>
    ['H', 'H1', 'X'].includes(i.schedule_class),
  );

  const buildPayload = () => ({
    customer_name: complianceData.patient_name,
    doctor_name: complianceData.doctor_name,
    doctor_reg_no: complianceData.doctor_reg_no,
    items: cart.map((i) => ({
      medicine_id: i.medicine_id,
      batch_id: i.batch_id,
      qty: i.qty,
      rate: i.rate,
      gst_percent: i.gst_percent,
      is_substituted: i.is_substituted,
      original_medicine_id: i.original_medicine_id,
      substitution_reason: i.substitution_reason,
    })),
    discount_amount: discountAmt,
    payment_mode: paymentMode,
    ai_prescription_id: aiPrescriptionId,
    compliance_data: hasScheduledDrugs ? complianceData : undefined,
  });

  const handleBill = () => {
    if (cart.length === 0) { toast.error('Cart is empty'); return; }
    if (hasScheduledDrugs && (!complianceData.patient_name || !complianceData.doctor_name)) {
      setShowCompliance(true);
      toast.error('Compliance details required for scheduled drugs');
      return;
    }
    setShowPreview(true);
  };

  const handleConfirmDispense = () => {
    createSaleMutation.mutate(buildPayload());
  };

  const previewBillData: BillData = {
    patientName: complianceData.patient_name || undefined,
    doctorName: complianceData.doctor_name || undefined,
    doctorRegNo: complianceData.doctor_reg_no || undefined,
    paymentMode,
    items: cart.map((i) => ({
      medicineName: i.medicine_name,
      batchNumber: i.batch_number,
      expiryDate: i.expiry_date,
      qty: i.qty,
      rate: i.rate,
      gstPercent: i.gst_percent,
      itemTotal: i.qty * i.rate + (i.qty * i.rate * i.gst_percent) / 100,
      isSubstituted: i.is_substituted,
    })),
    subtotal,
    taxAmount: taxTotal,
    discountAmount: discountAmt,
    totalAmount: total,
    hasScheduledDrugs,
  };

  const handleFileUpload = async (file: File) => {
    setRxImage(file);
    setAiExtracting(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const { data } = await api.post('/ai/prescription/parse', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setAiPrescriptionId(data.id);

      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        const { data: result } = await api.get(`/ai/prescription/${data.id}`);
        if (result.status === 'completed' || attempts > 20) {
          clearInterval(poll);
          setAiExtracting(false);
          if (result.extraction_json) {
            setAiResult(result);
            setShowAiReview(true);
            if (result.patient_name) setComplianceData((p) => ({ ...p, patient_name: result.patient_name }));
            if (result.doctor_name) setComplianceData((p) => ({ ...p, doctor_name: result.doctor_name }));
          }
        }
        if (result.status === 'failed') {
          clearInterval(poll);
          setAiExtracting(false);
          toast.error('AI extraction failed. Please add medicines manually.');
        }
      }, 2000);
    } catch {
      setAiExtracting(false);
      toast.error('Upload failed');
    }
  };

  const handleApproveAi = async () => {
    const medicines = aiResult?.extraction_json?.medicines || [];
    for (const med of medicines) {
      if (med.matched_medicine_id) {
        await handleAddMedicine({ id: med.matched_medicine_id, brand_name: med.matched_medicine_name || med.name, gst_percent: 0, schedule_class: 'OTC' });
      }
    }
    setShowAiReview(false);
    toast.success('Medicines added from prescription');
  };

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                className="input pl-9"
                placeholder="Search medicine by brand or molecule..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
              {search.length >= 2 && medicines?.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg border border-gray-200 shadow-lg z-50 max-h-72 overflow-y-auto scrollbar-thin">
                  {medicines.map((med: any) => (
                    <button
                      key={med.id}
                      onClick={() => handleAddMedicine(med)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left border-b border-gray-50 last:border-0"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">{med.brand_name}</p>
                        <p className="text-xs text-gray-400">{med.molecule} · {med.strength} · {med.dosage_form}</p>
                      </div>
                      <span className={`badge text-xs ${getScheduleClassColor(med.schedule_class)}`}>
                        {med.schedule_class}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => fileRef.current?.click()}
              className="btn-secondary flex items-center gap-2 flex-shrink-0"
            >
              {aiExtracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              {aiExtracting ? 'Extracting...' : 'Upload Rx'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            />
          </div>
        </div>

        {showAiReview && aiResult && (
          <div className="m-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-blue-900">AI Extracted Medicines</h3>
              <button onClick={() => setShowAiReview(false)} className="text-blue-400 hover:text-blue-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-blue-600 mb-3">
              {aiResult.confidence_summary} · Patient: {aiResult.patient_name || '-'} · Dr: {aiResult.doctor_name || '-'}
            </p>
            <div className="space-y-2">
              {aiResult.extraction_json?.medicines?.map((med: any, i: number) => (
                <div key={i} className="flex items-center gap-3 bg-white p-3 rounded-lg border border-blue-100">
                  <span className={`badge text-xs ${getConfidenceColor(med.confidence)}`}>
                    {med.confidence}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{med.name}</p>
                    <p className="text-xs text-gray-500">
                      {med.strength} · {med.frequency} · {med.duration}
                      {med.matched_medicine_name && <span className="text-green-600"> → {med.matched_medicine_name}</span>}
                    </p>
                  </div>
                  {!med.matched_medicine_id && (
                    <span className="text-xs text-red-500">No match</span>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={handleApproveAi} className="btn-primary flex-1">
                <Check className="w-4 h-4 inline mr-1" />
                Approve & Add to Cart
              </button>
              <button onClick={() => setShowAiReview(false)} className="btn-secondary">Dismiss</button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <ShoppingCart className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">Cart is empty</p>
              <p className="text-xs mt-1">Search for medicines or upload a prescription</p>
            </div>
          ) : (
            cart.map((item, idx) => (
              <div key={`${item.medicine_id}-${item.batch_id}`} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">{item.medicine_name}</p>
                      {item.is_substituted && (
                        <span className="badge bg-blue-50 text-blue-600 border-blue-200 text-xs">Substituted</span>
                      )}
                      <span className={`badge text-xs ${getScheduleClassColor(item.schedule_class)}`}>
                        {item.schedule_class}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Batch: {item.batch_number} · Exp: {formatDate(item.expiry_date)}
                    </p>
                    {item.is_substituted && item.substitution_reason && (
                      <p className="text-xs text-blue-600 mt-0.5">Reason: {item.substitution_reason}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => {
                        const updated = [...cart];
                        if (updated[idx].qty > 1) updated[idx].qty -= 1;
                        else updated.splice(idx, 1);
                        setCart(updated);
                      }}
                      className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-8 text-center text-sm font-semibold">{item.qty}</span>
                    <button
                      onClick={() => {
                        const updated = [...cart];
                        updated[idx].qty += 1;
                        setCart(updated);
                      }}
                      className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <span className="text-sm font-semibold text-gray-900 w-20 text-right">
                      {formatCurrency(item.qty * item.rate)}
                    </span>
                    <button
                      onClick={() => setShowSubstitutes(item.medicine_id)}
                      className="text-xs text-primary-600 hover:underline px-1"
                    >
                      Sub
                    </button>
                    <button
                      onClick={() => setCart(cart.filter((_, i) => i !== idx))}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="w-80 border-l border-gray-100 bg-white flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Bill Summary</h2>
        </div>

        {hasScheduledDrugs && (
          <div className="mx-4 mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-xs font-medium text-orange-700 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              Scheduled drug — compliance required
            </p>
          </div>
        )}

        {(hasScheduledDrugs || showCompliance) && (
          <div className="mx-4 mt-3 p-3 bg-gray-50 rounded-lg space-y-2">
            <p className="text-xs font-semibold text-gray-700">Compliance Details</p>
            <input
              type="text"
              className="input text-xs"
              placeholder="Patient name *"
              value={complianceData.patient_name}
              onChange={(e) => setComplianceData((p) => ({ ...p, patient_name: e.target.value }))}
            />
            <input
              type="text"
              className="input text-xs"
              placeholder="Doctor name *"
              value={complianceData.doctor_name}
              onChange={(e) => setComplianceData((p) => ({ ...p, doctor_name: e.target.value }))}
            />
            {cart.some((i) => i.schedule_class === 'X') && (
              <input
                type="text"
                className="input text-xs"
                placeholder="Doctor registration no. *"
                value={complianceData.doctor_reg_no}
                onChange={(e) => setComplianceData((p) => ({ ...p, doctor_reg_no: e.target.value }))}
              />
            )}
          </div>
        )}

        <div className="flex-1 p-4 space-y-3 overflow-y-auto">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>GST</span>
              <span>{formatCurrency(taxTotal)}</span>
            </div>
            <div className="flex justify-between items-center text-gray-600">
              <span>Discount</span>
              <div className="flex items-center gap-1">
                <span>₹</span>
                <input
                  type="number"
                  className="w-20 border border-gray-200 rounded px-2 py-1 text-xs text-right"
                  value={discount}
                  min={0}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="border-t border-gray-100 pt-2 flex justify-between font-bold text-gray-900 text-base">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-600 mb-1.5">Payment Mode</p>
            <div className="grid grid-cols-3 gap-1.5">
              {['cash', 'card', 'upi'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setPaymentMode(mode)}
                  className={`py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    paymentMode === mode
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'border-gray-200 text-gray-600 hover:border-primary-400'
                  }`}
                >
                  {mode.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-100">
          <button
            onClick={handleBill}
            disabled={cart.length === 0 || createSaleMutation.isPending}
            className="btn-primary w-full py-3 text-base flex items-center justify-center gap-2"
          >
            {createSaleMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            Generate Bill
          </button>
        </div>
      </div>

      {showPreview && (
        <BillDocument
          data={previewBillData}
          mode="preview"
          onClose={() => setShowPreview(false)}
          onConfirm={handleConfirmDispense}
          isLoading={createSaleMutation.isPending}
        />
      )}

      {completedSale && (
        <BillDocument
          data={{
            billNumber: completedSale.bill_number,
            date: completedSale.created_at,
            pharmacist: completedSale.pharmacist?.name,
            patientName: completedSale.customer_name,
            doctorName: completedSale.doctor_name,
            doctorRegNo: completedSale.doctor_reg_no,
            paymentMode: completedSale.payment_mode,
            items: completedSale.items?.map((item: any) => ({
              medicineName: item.medicine?.brand_name || item.medicine_name,
              batchNumber: item.batch?.batch_number || item.batch_number,
              expiryDate: item.batch?.expiry_date,
              qty: item.qty,
              rate: Number(item.rate),
              gstPercent: Number(item.gst_percent),
              itemTotal: Number(item.item_total),
              isSubstituted: item.is_substituted,
            })) || [],
            subtotal: Number(completedSale.subtotal),
            taxAmount: Number(completedSale.tax_amount),
            discountAmount: Number(completedSale.discount_amount),
            totalAmount: Number(completedSale.total_amount),
            hasScheduledDrugs: completedSale.has_scheduled_drugs,
          }}
          mode="print"
          onClose={() => setCompletedSale(null)}
        />
      )}

      {showSubstitutes && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Available Alternatives</h3>
              <button onClick={() => setShowSubstitutes(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {substitutes?.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <p className="text-sm">No substitutes found</p>
                  <p className="text-xs mt-1">No medicines with same molecule + strength + form in stock</p>
                </div>
              )}
              {substitutes?.map((sub: any) => (
                <div key={sub.id} className="border border-gray-100 rounded-xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-gray-900">{sub.brand_name}</p>
                      <p className="text-xs text-gray-500">{sub.molecule} · {sub.strength} · {sub.dosage_form}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">{formatCurrency(sub.sale_rate || sub.mrp)}</p>
                      <p className={`text-xs font-medium ${sub.available_stock > 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {sub.available_stock} in stock
                      </p>
                    </div>
                  </div>
                  {sub.available_stock > 0 && (
                    <div className="flex gap-2 mt-2">
                      {['Brand not in stock', 'Patient preference', 'Better price', 'Doctor approved'].map((reason) => (
                        <button
                          key={reason}
                          onClick={() => {
                            const original = cart.find((i) => i.medicine_id === showSubstitutes);
                            if (original) handleSubstitute(original, sub, reason);
                          }}
                          className="text-xs text-primary-600 border border-primary-200 px-2 py-1 rounded-lg hover:bg-primary-50"
                        >
                          {reason}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
