#!/usr/bin/env python3
"""
MediSyn UI Redesign — master patch script v2
Verified against actual source files. Safe to run.

Run from project root (/Users/navamworks/Documents/NavamWorks/Project-AI/medisyn):
    python3 patch_ui_v2.py

What changes:
  dashboard/page.tsx       — OwnerDashboard function replaced; all other roles untouched
  dispensing/page.tsx      — 2 surgical mobile changes via patch_dispensing_mobile.py
  receptionist/book-appointment/page.tsx — two-column layout + queue counts; all logic identical
  receptionist/book/page.tsx — unchanged (already just a redirect, preserved as-is)
"""

import os, shutil, sys, subprocess

ROOT = os.path.dirname(os.path.abspath(__file__))

FILES = {
    'dashboard-page.tsx': os.path.join(
        ROOT, 'apps', 'web', 'src', 'app', '(dashboard)', 'dashboard', 'page.tsx'),
    'book-appointment-page.tsx': os.path.join(
        ROOT, 'apps', 'web', 'src', 'app', 'receptionist', 'book-appointment', 'page.tsx'),
}

def patch_file(src_name, dest_path):
    src_path = os.path.join(ROOT, src_name)
    if not os.path.exists(src_path):
        print(f'  ✗  Source not found: {src_name}')
        return False
    if not os.path.exists(dest_path):
        print(f'  ✗  Destination not found: {dest_path}')
        return False
    backup = dest_path + '.bak'
    shutil.copy2(dest_path, backup)
    print(f'  ↩  Backed up: {os.path.basename(dest_path)} → .bak')
    shutil.copy2(src_path, dest_path)
    print(f'  ✓  Patched: {dest_path}')
    return True

def main():
    print('MediSyn UI redesign patch v2\n')

    # 1. Dashboard + book-appointment (full file replacements)
    for src, dest in FILES.items():
        patch_file(src, dest)

    print()

    # 2. Dispensing — surgical patch via its own script
    disp_script = os.path.join(ROOT, 'patch_dispensing_mobile.py')
    if os.path.exists(disp_script):
        print('Running dispensing surgical patch...')
        result = subprocess.run([sys.executable, disp_script], cwd=ROOT, capture_output=True, text=True)
        print(result.stdout.strip())
        if result.returncode != 0:
            print(f'  ✗  Dispensing patch failed:\n{result.stderr}')
    else:
        print(f'  ⚠  patch_dispensing_mobile.py not found — skipping dispensing changes')

    print('\n\nAll done. Run:\n  git add -A && git commit -m "feat: redesign owner dashboard, dispensing mobile, book-appointment two-column" && git push')

if __name__ == '__main__':
    main()
