#!/usr/bin/env python3
"""
Run both mobile responsive fixes in order.

    python3 patches/run_mobile_fixes.py
"""
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
scripts = [
    "fix_dispensing_mobile.py",
    "fix_dashboard_mobile.py",
]

print("=" * 60)
print("  Mobile Responsive Fix — running both patches")
print("=" * 60)

for s in scripts:
    p = HERE / s
    print(f"\n▶ Running {s}\n" + "-" * 60)
    result = subprocess.run([sys.executable, str(p)])
    if result.returncode not in (0, 2):
        # 0 = patched, 2 = already patched / no-op
        print(f"\n❌ {s} failed (exit {result.returncode})")
        sys.exit(result.returncode)

print("\n" + "=" * 60)
print("  ✅ All mobile fixes applied")
print("=" * 60)
print("\nNext steps:")
print("  git add apps/web/src/app/dispensing/page.tsx apps/web/src/app/globals.css")
print("  git commit -m 'fix: mobile responsive — dispensing + dashboard overflow'")
print("  git push")
print("\n  Railway will auto-deploy in ~2 minutes.")
