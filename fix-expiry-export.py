#!/usr/bin/env python3
"""
Fix: Expiry report export not downloading on mobile Safari.

Root cause:
  1. Mobile Safari blocks blob: URL downloads via programmatic a.click()
  2. The near-expiry export may lack a dedicated streaming endpoint

Fix:
  - API: Add GET /reports/export/near-expiry that streams Excel directly
  - Frontend: Switch all report exports from blob URL pattern to window.open()
    which triggers native Safari download dialog

Run from project root:
  python3 fix-expiry-export.py
  git add -A && git commit -m "fix: expiry report export on mobile Safari" && git push
"""

import os, re

PROJECT = os.path.expanduser("~/Documents/NavamWorks/Project- AI/medisyn")
API_SRC = os.path.join(PROJECT, "apps/api/src")
WEB_SRC = os.path.join(PROJECT, "apps/web/src")

# ═══════════════════════════════════════════════════════════════════════════
# STEP 1: Add export/near-expiry endpoint to reports controller
# ═══════════════════════════════════════════════════════════════════════════

controller_path = os.path.join(API_SRC, "reports/reports.controller.ts")

if os.path.exists(controller_path):
    src = open(controller_path).read()

    # Check if export/near-expiry endpoint already exists
    if "export/near-expiry" not in src:
        # Find the last method (export/sales or closing brace) and add before class close
        export_endpoint = """
  @Get('export/near-expiry')
  @ApiOperation({ summary: 'Export near-expiry report to Excel' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  async exportNearExpiry(
    @Query('days') days: number,
    @Request() req,
    @Res() res: Response,
  ) {
    const buffer = await this.reportsService.exportNearExpiryToExcel(
      req.tenantId,
      days ? Number(days) : 90,
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=expiry-report-${days || 90}days.xlsx`,
    );
    res.send(buffer);
  }
"""
        # Insert before final closing brace of class
        # Find the last } in the file
        last_brace = src.rfind("}")
        src = src[:last_brace] + export_endpoint + "\n}\n"
        open(controller_path, "w").write(src)
        print("  ✓ Added GET /reports/export/near-expiry to controller")
    else:
        print("  ✓ export/near-expiry endpoint already exists")
else:
    print(f"  ✗ Controller not found at {controller_path}")

# ═══════════════════════════════════════════════════════════════════════════
# STEP 2: Add exportNearExpiryToExcel method to reports service
# ═══════════════════════════════════════════════════════════════════════════

service_path = os.path.join(API_SRC, "reports/reports.service.ts")

if os.path.exists(service_path):
    svc = open(service_path).read()

    if "exportNearExpiryToExcel" not in svc:
        export_method = """
  async exportNearExpiryToExcel(tenantId: string, days = 90): Promise<Buffer> {
    const rows = await this.dataSource.query(
      `SELECT
         m.brand_name,
         sb.batch_no,
         sb.expiry_date,
         sb.available_qty,
         sb.purchase_price,
         m.mrp,
         m.rack_location
       FROM stock_batches sb
       JOIN medicines m ON m.id = sb.medicine_id
       WHERE sb.tenant_id = $1
         AND sb.available_qty > 0
         AND sb.expiry_date <= CURRENT_DATE + INTERVAL '1 day' * $2
       ORDER BY sb.expiry_date ASC`,
      [tenantId, days],
    );

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Near Expiry');

    sheet.columns = [
      { header: 'Medicine', key: 'brand_name', width: 35 },
      { header: 'Batch No', key: 'batch_no', width: 18 },
      { header: 'Expiry Date', key: 'expiry_date', width: 15 },
      { header: 'Qty', key: 'available_qty', width: 10 },
      { header: 'Purchase Price', key: 'purchase_price', width: 15 },
      { header: 'MRP', key: 'mrp', width: 12 },
      { header: 'Rack', key: 'rack_location', width: 12 },
    ];

    // Style header
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF00475A' },
    };

    for (const row of rows) {
      const r = sheet.addRow({
        brand_name: row.brand_name,
        batch_no: row.batch_no,
        expiry_date: row.expiry_date
          ? new Date(row.expiry_date).toLocaleDateString('en-IN')
          : '-',
        available_qty: Number(row.available_qty),
        purchase_price: Number(row.purchase_price || 0).toFixed(2),
        mrp: Number(row.mrp || 0).toFixed(2),
        rack_location: row.rack_location || '-',
      });

      // Highlight expired rows in red
      if (new Date(row.expiry_date) < new Date()) {
        r.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFEE2E2' },
        };
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
"""
        # Insert before the final closing brace of the class
        last_brace = svc.rfind("}")
        svc = svc[:last_brace] + export_method + "\n}\n"
        open(service_path, "w").write(svc)
        print("  ✓ Added exportNearExpiryToExcel to service")
    else:
        print("  ✓ exportNearExpiryToExcel already exists")
else:
    print(f"  ✗ Service not found at {service_path}")

# ═══════════════════════════════════════════════════════════════════════════
# STEP 3: Fix frontend — replace blob download with window.open() for
#         mobile Safari compatibility
# ═══════════════════════════════════════════════════════════════════════════

reports_page = os.path.join(WEB_SRC, "app/(dashboard)/reports/page.tsx")

if os.path.exists(reports_page):
    page = open(reports_page).read()
    changed = False

    # Pattern 1: Fix the sales export blob pattern
    # Look for the blob URL pattern and replace with window.open
    old_blob_pattern = """const response = await api.get(`/reports/export/sales?from=${from}&to=${to}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a'); a.href=url; a.download=`sales-report-${from}-to-${to}.xlsx`; a.click();"""

    new_window_open = """const baseUrl = api.defaults.baseURL || '';
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
      window.open(`${baseUrl}/reports/export/sales?from=${from}&to=${to}&token=${token}`, '_blank');"""

    if old_blob_pattern in page:
        page = page.replace(old_blob_pattern, new_window_open)
        changed = True
        print("  ✓ Fixed sales export: blob → window.open")

    # Pattern 2: Add near-expiry export handler if not present
    if "handleExportNearExpiry" not in page:
        # Add the handler function after handleExportSales
        export_handler = """
  const handleExportNearExpiry = async () => {
    try {
      const baseUrl = api.defaults.baseURL || '';
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
      window.open(\`\${baseUrl}/reports/export/near-expiry?days=90&token=\${token}\`, '_blank');
      toast.success('Downloading expiry report...');
    } catch { toast.error('Export failed'); }
  };
"""
        # Find handleExportSales closing and insert after
        # Look for the end of handleExportSales function
        sales_fn_end = page.find("toast.success('Export downloaded');")
        if sales_fn_end == -1:
            sales_fn_end = page.find("handleExportSales")
        if sales_fn_end > -1:
            # Find the next }; after it
            next_close = page.find("};", sales_fn_end)
            if next_close > -1:
                insert_pos = next_close + 2
                page = page[:insert_pos] + "\n" + export_handler + page[insert_pos:]
                changed = True
                print("  ✓ Added handleExportNearExpiry function")

    # Pattern 3: Add export button to near-expiry tab if not present
    # Look for the near-expiry section and add an export button
    if "handleExportNearExpiry" in page and "Export Expiry" not in page:
        # Find near-expiry tab content rendering section
        near_expiry_marker = "tab==='near-expiry'"
        if near_expiry_marker not in page:
            near_expiry_marker = "tab === 'near-expiry'"
        
        if near_expiry_marker in page:
            # Find the section and add export button
            marker_pos = page.find(near_expiry_marker)
            if marker_pos > -1:
                # Look for the opening of the near-expiry content section
                # Find the next return/render after this tab check
                section_start = page.find("<", marker_pos)
                if section_start > -1:
                    # Add export button near the section
                    export_btn = """<div className="flex justify-end mb-3"><button onClick={handleExportNearExpiry} className="btn-secondary flex items-center gap-2 text-sm"><Download className="w-4 h-4" /> Export Expiry Report</button></div>"""
                    
                    # Find the section that renders near-expiry data
                    # Usually after a conditional check like {tab === 'near-expiry' && (
                    section_content = page.find("&&", marker_pos)
                    if section_content > -1:
                        paren_or_bracket = page.find("(", section_content)
                        if paren_or_bracket > -1 and paren_or_bracket < section_content + 20:
                            # Insert export button after the opening ( or first div
                            next_div = page.find("<div", paren_or_bracket)
                            if next_div > -1 and next_div < paren_or_bracket + 50:
                                # Find end of this opening div tag
                                div_close = page.find(">", next_div)
                                if div_close > -1:
                                    page = page[:div_close+1] + "\n            " + export_btn + "\n" + page[div_close+1:]
                                    changed = True
                                    print("  ✓ Added Export button to near-expiry tab")

    if changed:
        open(reports_page, "w").write(page)
        print("  ✓ Reports page updated")
    else:
        print("  ⚠ Reports page — no blob pattern found to replace.")
        print("    The export might use a different pattern. Check the file manually.")
        print(f"    Path: {reports_page}")
else:
    print(f"  ✗ Reports page not found at {reports_page}")

# ═══════════════════════════════════════════════════════════════════════════
# STEP 4: Also fix compliance page export if it uses blob pattern
# ═══════════════════════════════════════════════════════════════════════════

compliance_page = os.path.join(WEB_SRC, "app/(dashboard)/compliance/page.tsx")
if os.path.exists(compliance_page):
    comp = open(compliance_page).read()
    # Check for blob pattern in compliance export
    if "responseType: 'blob'" in comp and "URL.createObjectURL" in comp:
        # Replace blob pattern with window.open
        comp = re.sub(
            r"const response = await api\.get\(`([^`]+)`\s*,\s*\{\s*responseType:\s*'blob'\s*\}\);\s*"
            r"const url = URL\.createObjectURL\(new Blob\(\[response\.data\]\)\);\s*"
            r"const a = document\.createElement\('a'\);\s*"
            r"a\.href\s*=\s*url;\s*a\.download\s*=\s*`([^`]+)`;\s*a\.click\(\);\s*"
            r"(URL\.revokeObjectURL\(url\);)?",
            lambda m: (
                f"const baseUrl = api.defaults.baseURL || '';\n"
                f"      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';\n"
                f"      window.open(`${{baseUrl}}{m.group(1)}&token=${{token}}`, '_blank');"
            ),
            comp,
        )
        open(compliance_page, "w").write(comp)
        print("  ✓ Fixed compliance page export: blob → window.open")
    else:
        print("  ✓ Compliance page export already fixed or uses different pattern")

# ═══════════════════════════════════════════════════════════════════════════
# STEP 5: Ensure API supports token query param for auth (for window.open)
# ═══════════════════════════════════════════════════════════════════════════

# Check if auth guard supports token query param
auth_guard_paths = [
    os.path.join(API_SRC, "common/guards/jwt-auth.guard.ts"),
    os.path.join(API_SRC, "auth/jwt-auth.guard.ts"),
    os.path.join(API_SRC, "auth/guards/jwt-auth.guard.ts"),
    os.path.join(API_SRC, "common/jwt-auth.guard.ts"),
]

auth_guard = None
for p in auth_guard_paths:
    if os.path.exists(p):
        auth_guard = p
        break

if auth_guard:
    guard_src = open(auth_guard).read()
    if "query.token" not in guard_src and "query?.token" not in guard_src:
        # Add token query param fallback to auth guard
        # Look for where it extracts the bearer token
        if "authorization" in guard_src.lower() or "bearer" in guard_src.lower():
            print(f"  ⚠ Auth guard found at {auth_guard}")
            print("    You may need to add token query param support for window.open exports.")
            print("    Add this to your JWT extraction logic:")
            print("      const token = request.headers.authorization?.split(' ')[1]")
            print("                  || request.query?.token;")
        else:
            print("  ⚠ Auth guard structure not recognized — check manually")
    else:
        print("  ✓ Auth guard already supports token query param")
else:
    print("  ⚠ Auth guard not found — you'll need to add token query param support manually")

print()
print("═" * 60)
print("DONE! Next steps:")
print("═" * 60)
print()
print("1. cd ~/Documents/NavamWorks/Project-\\ AI/medisyn")
print("2. Review the changes:")
print("   git diff")
print()
print("3. If auth guard needs updating, add token query param:")
print("   In your JWT auth guard, extract token from query too:")
print("     const token = req.headers.authorization?.split(' ')[1]")
print("                 || req.query?.token;")
print()
print("4. Commit and push:")
print("   git add -A")
print('   git commit -m "fix: expiry report export on mobile Safari"')
print("   git push origin main")
print()
print("5. Wait ~4 min for Railway deploy")
print()
