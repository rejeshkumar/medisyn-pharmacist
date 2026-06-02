import re

FILE = "apps/web/src/app/(dashboard)/patients/page.tsx"

with open(FILE, 'r') as f:
    content = f.read()

# ── 1. Add vip_tier to EMPTY_FORM ──
old_empty = "is_vip:false,vip_start_date:'',vip_end_date:'',consent_given:false"
new_empty = "is_vip:false,vip_tier:'',vip_start_date:'',vip_end_date:'',consent_given:false"
assert old_empty in content, "❌ EMPTY_FORM target not found"
content = content.replace(old_empty, new_empty)
print("✅ 1. Added vip_tier to EMPTY_FORM")

# ── 2. Add vip_tier validation in handleSubmit ──
old_submit = "if (!form.first_name || !form.mobile) { toast.error('Name and mobile are required'); return; }"
new_submit = """if (!form.first_name || !form.mobile) { toast.error('Name and mobile are required'); return; }
    if (form.is_vip && !form.vip_tier) { toast.error('Please select a VIP category'); return; }"""
assert old_submit in content, "❌ handleSubmit target not found"
content = content.replace(old_submit, new_submit)
print("✅ 2. Added vip_tier validation in handleSubmit")

# ── 3. Add vip_tier to mutation payload ──
old_mutate = "createMutation.mutate({ ...form, age:form.age?Number(form.age):undefined, dob:form.dob||undefined, vip_start_date:form.is_vip?(form.vip_start_date||today()):undefined, vip_end_date:form.is_vip?(form.vip_end_date||oneYearFromDate(today())):undefined });"
new_mutate = "createMutation.mutate({ ...form, age:form.age?Number(form.age):undefined, dob:form.dob||undefined, vip_start_date:form.is_vip?(form.vip_start_date||today()):undefined, vip_end_date:form.is_vip?(form.vip_end_date||oneYearFromDate(today())):undefined, vip_tier:form.is_vip?form.vip_tier:undefined });"
assert old_mutate in content, "❌ mutate payload target not found"
content = content.replace(old_mutate, new_mutate)
print("✅ 3. Added vip_tier to mutation payload")

# ── 4. Replace the VIP checkbox onChange to also clear vip_tier when unchecked ──
old_checkbox = "onChange={(e) => { const c=e.target.checked; const s=c?today():''; const en=c?oneYearFromDate(today()):''; setForm((p: any) => ({...p,is_vip:c,vip_start_date:s,vip_end_date:en})); }}"
new_checkbox = "onChange={(e) => { const c=e.target.checked; const s=c?today():''; const en=c?oneYearFromDate(today()):''; setForm((p: any) => ({...p,is_vip:c,vip_tier:c?p.vip_tier:'',vip_start_date:s,vip_end_date:en})); }}"
assert old_checkbox in content, "❌ VIP checkbox onChange target not found"
content = content.replace(old_checkbox, new_checkbox)
print("✅ 4. Updated VIP checkbox to clear vip_tier on uncheck")

# ── 5. Add VIP tier selector tiles inside the is_vip block, after the date inputs ──
old_vip_block = """{form.is_vip && <div className="grid grid-cols-2 gap-3"><div><label className="label text-amber-700 text-xs">VIP Start</label><input type="date" className="input border-amber-200" value={form.vip_start_date} onChange={(e) => { const s=e.target.value; setForm((p: any) => ({...p,vip_start_date:s,vip_end_date:s?oneYearFromDate(s):''})); }} /></div><div><label className="label text-amber-700 text-xs">VIP End (1 year)</label><input type="date" className="input border-amber-300 bg-amber-100/60 text-amber-900 font-semibold" value={form.vip_end_date} onChange={(e) => set('vip_end_date',e.target.value)} /></div></div>}"""

new_vip_block = """{form.is_vip && (
                  <div className="space-y-3">
                    <div>
                      <label className="label text-amber-700 text-xs font-semibold">VIP Category <span className="text-red-500">*</span></label>
                      <div className="grid grid-cols-3 gap-2 mt-1.5">
                        {([
                          { value: 'individual', label: 'Individual', desc: 'Single person' },
                          { value: 'family', label: 'Family', desc: 'Immediate family' },
                          { value: 'extended_family', label: 'Extended', desc: 'Highest benefits' },
                        ] as const).map((t) => (
                          <button
                            key={t.value}
                            type="button"
                            onClick={() => set('vip_tier', t.value)}
                            className={`rounded-xl border-2 p-2.5 text-left transition-all ${form.vip_tier === t.value ? 'border-amber-500 bg-amber-100' : 'border-amber-200 bg-white hover:border-amber-300'}`}
                          >
                            <p className={`text-xs font-semibold ${form.vip_tier === t.value ? 'text-amber-800' : 'text-gray-700'}`}>{t.label}</p>
                            <p className={`text-[10px] mt-0.5 ${form.vip_tier === t.value ? 'text-amber-600' : 'text-gray-400'}`}>{t.desc}</p>
                          </button>
                        ))}
                      </div>
                      {!form.vip_tier && <p className="text-xs text-amber-600 mt-1.5">⚠️ Select a VIP category to continue</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="label text-amber-700 text-xs">VIP Start</label><input type="date" className="input border-amber-200" value={form.vip_start_date} onChange={(e) => { const s=e.target.value; setForm((p: any) => ({...p,vip_start_date:s,vip_end_date:s?oneYearFromDate(s):''})); }} /></div>
                      <div><label className="label text-amber-700 text-xs">VIP End (1 year)</label><input type="date" className="input border-amber-300 bg-amber-100/60 text-amber-900 font-semibold" value={form.vip_end_date} onChange={(e) => set('vip_end_date',e.target.value)} /></div>
                    </div>
                  </div>
                )}"""

assert old_vip_block in content, "❌ VIP is_vip block target not found"
content = content.replace(old_vip_block, new_vip_block)
print("✅ 5. Added VIP tier selector tiles with validation warning")

# ── 6. Update Register Patient button to also block if vip tier not selected ──
old_btn = "disabled={createMutation.isPending || !form.consent_given}"
new_btn = "disabled={createMutation.isPending || !form.consent_given || (form.is_vip && !form.vip_tier)}"
assert old_btn in content, "❌ Register button disabled target not found"
content = content.replace(old_btn, new_btn)
print("✅ 6. Register button now also disabled when VIP tier not selected")

with open(FILE, 'w') as f:
    f.write(content)

print("\n✅ All patches applied successfully to", FILE)
