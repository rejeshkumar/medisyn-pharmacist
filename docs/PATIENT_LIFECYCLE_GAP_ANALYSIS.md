# Patient Lifecycle — Design vs Implementation Gap Analysis

**Source:** `medisyn_complete_solution_design.docx` §4 End-to-End Workflow, §5 Status Lifecycle

---

## Design Document Status Lifecycle

```
REGISTERED → PRECHECK_COMPLETED → CONSULTATION_IN_PROGRESS → PRESCRIBED → DISPENSED → PAYMENT_COMPLETED → COMPLETED
```

---

## Implementation Status Lifecycle (QueueStatus enum)

```
waiting → in_precheck → precheck_done → in_consultation → consultation_done → dispensing → completed
         (never set)                                    (skip dispensing)   (never set)
```

---

## Step-by-Step Comparison

| Step | Design | Design Status | Implementation | Impl Status | Match? |
|------|--------|---------------|-----------------|-------------|-------|
| 1 | Reception registers patient, creates visit | REGISTERED | POST /queue (book) | waiting | ⚠️ Different name |
| 2 | Nurse captures vitals | PRECHECK_COMPLETED | Nurse saves pre-check | precheck_done | ⚠️ Different name |
| 3 | Doctor reviews, records diagnosis | CONSULTATION_IN_PROGRESS | Doctor calls → consult page | in_consultation | ⚠️ Different name |
| 4 | Doctor prescribes (search/voice) | PRESCRIBED | Doctor creates Rx + completes | consultation_done | ⚠️ Different name |
| 5 | Pharmacist scans, dispenses | DISPENSED | Pharmacist creates bill, markDispensed | — | ❌ **Queue never moves to `dispensing`** |
| 6 | Billing: Medicine bill returned to reception | — | — | — | ❌ **Not implemented** |
| 7 | Payment: Patient pays consultation + medicine | PAYMENT_COMPLETED | — | — | ❌ **Not implemented** |
| 8 | Visit closed | COMPLETED | markDispensed advances queue | completed | ✅ |

---

## Detailed Gaps

### 1. Status `IN_PRECHECK` is never set

**Design:** Patient moves to "pre-check in progress" when nurse starts.

**Implementation:** Nurse opens precheck page (patient still `waiting`), saves vitals → queue jumps directly `waiting` → `precheck_done`. The `in_precheck` status exists in the enum but is **never assigned** anywhere.

**Fix:** When nurse navigates to `/nurse/precheck/[queueId]`, call `PATCH /queue/:id/status` with `in_precheck` before showing the form. When nurse saves, advance to `precheck_done`.

---

### 2. Status `DISPENSING` is never set

**Design:** After prescription, patient goes to pharmacy. Status DISPENSED when pharmacist finishes.

**Implementation:** Queue stays at `consultation_done` until pharmacist dispenses. Then `markDispensed` advances directly to `completed`. The `dispensing` status is **never used**.

**Fix:** When consultation completes (prescription created), advance queue to `dispensing` instead of (or in addition to) `consultation_done`. Or: when pharmacist loads prescription from bridge, advance that queue entry to `dispensing`. Then `markDispensed` advances `dispensing` → `completed`.

---

### 3. No "Billing returned to reception" flow

**Design:** "Billing – Medicine bill returned to reception."

**Implementation:** Bill is created at pharmacy. Patient pays at pharmacy counter. No "return to reception" step. Receptionist has no view of pending/paid bills for a visit.

**Fix:** Either:
- **Option A:** Add reception billing view — when pharmacy creates bill for a clinic prescription, it's "pending at reception". Reception collects payment, marks paid, then visit can close.
- **Option B:** Keep current flow (payment at pharmacy) but document it as the chosen workflow. Design doc would need to be updated.

---

### 4. No PAYMENT_COMPLETED status

**Design:** "Payment – Patient pays consultation + medicine cost. Status: PAYMENT_COMPLETED"

**Implementation:** No payment step in queue. Payment is implicit when pharmacy creates sale (sale has `payment_mode`). No consultation fee. No separate "payment collected" state.

**Fix:** 
- Add `payment_completed` to QueueStatus (or use a visit-level payment flag).
- Add consultation fee (per doctor) and combined bill (consultation + medicine).
- Reception (or pharmacy) marks payment received → queue advances to `payment_completed` or `completed`.

---

### 5. Consultation fee not tracked

**Design:** "Consultation Fee – defined per doctor. Final Bill = Consultation Fee + Medicine Cost."

**Implementation:** Only medicine cost (pharmacy sale). No consultation fee field. No combined bill.

**Fix:** Add `consultation_fee` to doctor or availability config. When generating final bill, include consultation fee + medicine total.

---

### 6. Status naming mismatch

| Design | Implementation |
|--------|----------------|
| REGISTERED | waiting |
| PRECHECK_COMPLETED | precheck_done |
| CONSULTATION_IN_PROGRESS | in_consultation |
| PRESCRIBED | consultation_done |
| DISPENSED | (dispensing — never set) |
| PAYMENT_COMPLETED | (missing) |
| COMPLETED | completed |

The implementation uses different labels. A simple fix is to add a status-label mapping in the UI so reception/queue views show design-aligned labels (e.g. "Prescribed" for consultation_done, "Awaiting Pharmacy" for dispensing).

---

## Actual Flow Today (What Happens)

1. **Reception** books via `/receptionist/book` → `POST /queue` → status `waiting`
2. **Nurse** opens precheck, saves vitals → `recordPreCheck` → status `precheck_done` (skips `in_precheck`)
3. **Doctor** calls patient → `PATCH status in_consultation` → opens consult page
4. **Doctor** saves consultation → `POST /consultations` (creates consultation, queue already in_consultation)
5. **Doctor** adds prescription, clicks Finish → `POST /prescriptions` + `PATCH complete` → status `consultation_done`
6. **Pharmacist** sees patient in Prescription Bridge (filter: consultation_done), loads Rx, creates bill
7. **Pharmacist** confirms bill → `markDispensed` → status `completed`
8. **No** reception payment step, **no** consultation fee, **no** DISPENSING status

---

## Recommended Fixes (Priority Order)

| # | Fix | Effort | Impact |
|---|-----|--------|--------|
| 1 | Set `in_precheck` when nurse opens precheck page | 0.5 day | Aligns with design |
| 2 | Set `dispensing` when prescription created (or when pharmacist loads Rx) | 0.5 day | Makes "at pharmacy" visible |
| 3 | Add status label mapping (Design names in UI) | 0.25 day | Clarity |
| 4 | Consultation fee + combined bill at reception | 1–2 days | Full design compliance |
| 5 | Payment step at reception (bill to reception, mark paid) | 1–2 days | Full design compliance |

---

## Summary

| Aspect | Design | Implementation | Gap |
|--------|--------|-----------------|-----|
| Status count | 7 | 7 (but 2 unused) | IN_PRECHECK, DISPENSING never set |
| Payment flow | Reception collects consultation + medicine | Pharmacy collects (medicine only) | No reception payment, no consultation fee |
| Billing | Bill returned to reception | Bill stays at pharmacy | Different workflow |
| Status names | REGISTERED, PRESCRIBED, etc. | waiting, consultation_done, etc. | Naming only |
