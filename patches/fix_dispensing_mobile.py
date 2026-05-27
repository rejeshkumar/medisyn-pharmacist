#!/usr/bin/env python3
"""Mobile responsive fix for dispensing page — auto-detects path."""
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
APP_DIR = PROJECT_ROOT / "apps/web/src/app"
if not APP_DIR.exists():
    print(f"❌ Next.js app directory not found at {APP_DIR}")
    sys.exit(1)

candidates = list(APP_DIR.glob("**/dispensing/page.tsx"))
if not candidates:
    print(f"❌ No dispensing/page.tsx found under {APP_DIR}")
    sys.exit(1)

TARGET = candidates[0]
print(f"📂 Target: {TARGET.relative_to(PROJECT_ROOT)}\n")

src = TARGET.read_text(encoding="utf-8")
original = src

def patch(find, replace, label):
    global src
    count = src.count(find)
    if count == 0:
        print(f"⚠️  Not found: {label}")
        return
    src = src.replace(find, replace)
    print(f"  ✓ {label}")

print("Applying mobile fixes...\n")

patch(
    '<div className="flex h-full flex-col overflow-hidden bg-slate-50">',
    '<div className="flex h-full flex-col overflow-hidden bg-slate-50 max-w-full">',
    "Top-level wrapper: max-w-full")

patch(
    '<div className="flex flex-1 overflow-hidden">',
    '<div className="flex flex-1 overflow-hidden min-w-0 relative">',
    "Main flex container: min-w-0 + relative")

patch(
    '<div className="relative w-80 max-w-[85vw] bg-white flex flex-col shadow-2xl">',
    '<div className="absolute left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-white flex flex-col shadow-2xl z-10">',
    "Mobile Rx drawer: absolute overlay")

patch(
    '<div className="flex-1 overflow-auto pb-20 lg:pb-0">',
    '<div className="flex-1 overflow-auto pb-20 lg:pb-0 min-w-0">',
    "Cart container: min-w-0")

patch(
    '<table className="w-full border-collapse">',
    '<table className="w-full border-collapse table-fixed sm:table-auto">',
    "Cart table: table-fixed on mobile")

patch(
    '<th className="px-3 py-2 text-center text-[10px] font-bold text-slate-500 uppercase w-20">Qty</th>',
    '<th className="px-1.5 sm:px-3 py-2 text-center text-[10px] font-bold text-slate-500 uppercase w-14 sm:w-20">Qty</th>',
    "Qty header: narrower on mobile")

patch(
    '<th className="px-3 py-2 text-right text-[10px] font-bold text-slate-500 uppercase w-28">Amount</th>',
    '<th className="px-1.5 sm:px-3 py-2 text-right text-[10px] font-bold text-slate-500 uppercase w-20 sm:w-28">Amount</th>',
    "Amount header: narrower on mobile")

patch(
    '<th className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase w-8">No</th>',
    '<th className="px-1 sm:px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase w-7 sm:w-8">No</th>',
    "No header: tighter padding")

patch(
    '<th className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase">Medicine / Batch</th>',
    '<th className="px-2 sm:px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase">Medicine / Batch</th>',
    "Medicine header: tighter padding")

patch(
    '<div className="flex flex-col items-center justify-center h-48 text-slate-400">',
    '<div className="flex flex-col items-center justify-center h-48 text-slate-400 px-4 text-center">',
    "Empty-cart hint: centered with padding")

patch(
    'className="w-16 text-center text-sm font-bold border border-slate-200 rounded focus:outline-none focus:border-[#00475a] py-1" />',
    'className="w-11 sm:w-16 text-center text-sm font-bold border border-slate-200 rounded focus:outline-none focus:border-[#00475a] py-1" />',
    "Qty input: narrower on mobile")

if src == original:
    print("\n⚠️  No changes made.")
    sys.exit(2)

TARGET.write_text(src, encoding="utf-8")
print(f"\n✅ Patched: {TARGET.relative_to(PROJECT_ROOT)}")
print(f"CHANGED_FILE: {TARGET.relative_to(PROJECT_ROOT)}")
