#!/usr/bin/env python3
"""
Dispensing page — surgical mobile UI patch.
Only 2 changes:
  1. Upload Rx button — made more prominent on mobile
  2. Mobile bottom bar — upgraded with patient name + total prominent
Zero changes to state, logic, API calls, or any other part of the file.

Run from project root:
    python3 patch_dispensing_mobile.py
"""

import re, shutil, os, sys

TARGET = os.path.join(
    'apps', 'web', 'src', 'app', '(dashboard)', 'dispensing', 'page.tsx'
)

def patch():
    if not os.path.exists(TARGET):
        print(f'ERROR: File not found at {TARGET}')
        sys.exit(1)

    with open(TARGET, 'r', encoding='utf-8') as f:
        src = f.read()

    # ── Backup ────────────────────────────────────────────────────────────────
    backup = TARGET + '.bak'
    shutil.copy2(TARGET, backup)
    print(f'  ↩  Backed up → {backup}')

    original = src

    # ── Change 1: Make Upload Rx button more prominent on mobile ─────────────
    # Find the Upload Rx button and make it teal-styled on mobile
    OLD_RX_BTN = (
        '          <button onClick={() => fileRef.current?.click()}\n'
        '            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200">'
    )
    NEW_RX_BTN = (
        '          <button onClick={() => fileRef.current?.click()}\n'
        '            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-teal-50 text-[#00475a] rounded-lg hover:bg-teal-100 border border-teal-200 sm:bg-slate-100 sm:text-slate-600 sm:border-0 sm:hover:bg-slate-200">'
    )
    if OLD_RX_BTN in src:
        src = src.replace(OLD_RX_BTN, NEW_RX_BTN, 1)
        print('  ✓  Change 1: Upload Rx button — teal style on mobile')
    else:
        print('  ⚠  Change 1: Upload Rx button pattern not matched — skipped (safe)')

    # ── Change 2: Mobile bottom bar — show patient name when selected ─────────
    OLD_BOTTOM = (
        '      {/* ── Mobile bottom bar ── */}\n'
        '      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 px-4 py-3 bg-white border-t border-slate-200 shadow-lg" style={{paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))"}}>\n'
        '        <div className="flex items-center gap-3">\n'
        '          <div className="flex-1 min-w-0">\n'
        '            <p className="text-xs text-slate-400 truncate">\n'
        '              {cart.length > 0 ? `${cart.length} item${cart.length !== 1 ? \'s\' : \'\'}` : \'No items yet\'}\n'
        '              {paymentMode && <span className="ml-2 font-semibold text-[#00475a] uppercase">{paymentMode === \'hybrid\' ? \'Cash+UPI\' : paymentMode}</span>}\n'
        '            </p>\n'
        '            <p className="text-base font-bold text-slate-900">{formatCurrency(netTotal)}</p>\n'
        '          </div>'
    )
    NEW_BOTTOM = (
        '      {/* ── Mobile bottom bar ── */}\n'
        '      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#00475a] shadow-lg" style={{paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))"}}>\n'
        '        <div className="flex items-center gap-3 px-4 py-3">\n'
        '          <div className="flex-1 min-w-0">\n'
        '            <p className="text-xs text-white/60 truncate">\n'
        '              {compliance.patient_name\n'
        '                ? <span className="text-white/90 font-medium">{compliance.patient_name}</span>\n'
        '                : \'Walk-in\'}\n'
        '              {cart.length > 0 && <span className="ml-1.5">· {cart.length} item{cart.length !== 1 ? \'s\' : \'\'}</span>}\n'
        '              {paymentMode && <span className="ml-1.5 font-semibold uppercase">{paymentMode === \'hybrid\' ? \'Cash+UPI\' : paymentMode}</span>}\n'
        '            </p>\n'
        '            <p className="text-lg font-bold text-white">{formatCurrency(netTotal)}</p>\n'
        '          </div>'
    )
    if OLD_BOTTOM in src:
        src = src.replace(OLD_BOTTOM, NEW_BOTTOM, 1)
        print('  ✓  Change 2: Mobile bottom bar — dark teal, patient name + total')
    else:
        print('  ⚠  Change 2: Mobile bottom bar pattern not matched — skipped (safe)')

    # ── Write only if changed ─────────────────────────────────────────────────
    if src == original:
        print('\n  ℹ  No changes made (patterns may have already been applied)')
        return

    with open(TARGET, 'w', encoding='utf-8') as f:
        f.write(src)
    print(f'\n  ✅  Patched: {TARGET}')

if __name__ == '__main__':
    print('Dispensing mobile patch\n')
    patch()
    print('\nDone. Now run:\n  git add -A && git commit -m "fix: dispensing mobile — prominent upload Rx + teal bill bar" && git push')
