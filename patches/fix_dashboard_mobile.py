#!/usr/bin/env python3
"""Fix mobile horizontal overflow globally via globals.css."""
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
APP_DIR = PROJECT_ROOT / "apps/web"
if not APP_DIR.exists():
    print(f"❌ Next.js app directory not found at {APP_DIR}")
    sys.exit(1)

candidates = []
for p in APP_DIR.glob("**/globals.css"):
    if "node_modules" not in str(p):
        candidates.append(p)

if not candidates:
    print(f"❌ globals.css not found anywhere under {APP_DIR}")
    sys.exit(1)

TARGET = candidates[0]
print(f"📂 Target: {TARGET.relative_to(PROJECT_ROOT)}\n")

src = TARGET.read_text(encoding="utf-8")
MARKER = "/* === MOBILE OVERFLOW GUARDRAILS === */"

if MARKER in src:
    print(f"⚠️  Guardrails already present — skipping.")
    sys.exit(0)

ADDITIONS = """

""" + MARKER + """
/* Prevent any page from exceeding viewport width on mobile. */
html, body {
  overflow-x: hidden;
  max-width: 100vw;
}

#__next, main {
  max-width: 100vw;
  overflow-x: hidden;
}

.hscroll-allowed {
  overflow-x: auto !important;
  max-width: 100% !important;
}

@media (max-width: 640px) {
  .stat-card, .dashboard-card {
    padding-left: 0.75rem;
    padding-right: 0.75rem;
  }
  .truncate-mobile-allow {
    white-space: normal !important;
    word-break: break-word;
  }
}
/* === END MOBILE OVERFLOW GUARDRAILS === */
"""

src += ADDITIONS
TARGET.write_text(src, encoding="utf-8")
print(f"✅ Added mobile overflow guardrails to {TARGET.relative_to(PROJECT_ROOT)}")
print(f"CHANGED_FILE: {TARGET.relative_to(PROJECT_ROOT)}")
