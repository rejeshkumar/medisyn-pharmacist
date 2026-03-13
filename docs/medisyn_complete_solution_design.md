# MediSyn Integrated Clinic & Pharmacy Solution Design

*Extracted from `medisyn_complete_solution_design.docx`*

---

## 1. System Overview

MediSyn is designed as a modular healthcare platform that supports:

1. Standalone Clinic Patient Management System (PMS)
2. Standalone Pharmacy Management System
3. Fully Integrated Clinic + Pharmacy System

The platform supports digital workflows for patient registration, consultation, prescription generation, pharmacy dispensing, billing, and AI-assisted features such as voice prescription and prescription OCR.

---

## 2. Core Modules

### Clinic Module

- Patient Registration
- Queue Management
- Nurse Pre-check
- Doctor Consultation
- Prescription Creation

### Pharmacy Module

- Medicine Master
- Molecule & Formulation Database
- Barcode Scanning
- Inventory & Stock Batches
- Dispensing & Billing
- Expiry Management

### AI Module

- Voice-to-Prescription
- Prescription Image OCR
- Medicine Recommendation Engine

---

## 3. Roles

**Receptionist**

- Register patients
- Create visits
- Manage billing and payments

**Nurse**

- Capture vitals
- Record symptoms

**Doctor**

- Consult patient
- Record diagnosis
- Generate prescription (manual or voice)

**Pharmacist**

- Scan medicines
- Dispense medicines
- Generate pharmacy bill

**Admin**

- Configure system settings
- Manage medicines and users

---

## 4. End-to-End Workflow

1. **Patient Registration** – Reception registers patient and creates visit.  
   Status: REGISTERED

2. **Nurse Pre-check** – Vitals captured (Temperature, BP, Pulse, Weight).  
   Status: PRECHECK_COMPLETED

3. **Doctor Consultation** – Doctor reviews patient and records diagnosis.  
   Status: CONSULTATION_IN_PROGRESS

4. **Prescription Generation** – Medicines prescribed using search or voice.  
   Status: PRESCRIBED

5. **Pharmacy Dispensing** – Pharmacist scans medicines and selects stock batch.  
   Status: DISPENSED

6. **Billing** – Medicine bill returned to reception.

7. **Payment** – Patient pays consultation + medicine cost.  
   Status: PAYMENT_COMPLETED

8. **Visit Closed** – Visit marked COMPLETED.

---

## 5. Status Lifecycle

REGISTERED → PRECHECK_COMPLETED → CONSULTATION_IN_PROGRESS → PRESCRIBED → DISPENSED → PAYMENT_COMPLETED → COMPLETED

---

## 6. Medicine Database Design

- **Molecules** – Generic drug ingredients.
- **Formulations** – Molecule + strength + dosage form.
- **Medicines** – Brand medicines linked to formulation.
- **Stock Batches** – Batch number, expiry date, quantity.

---

## 7. Barcode Scanning

- Pharmacist scans medicine barcode.
- System identifies medicine and adds to dispensing cart.
- Unknown barcodes can be manually mapped for future use.

---

## 8. Expiry Detection

- Expired medicines cannot be dispensed.
- Medicines expiring soon generate warning.
- Batch selection uses FEFO (First Expiry First Out).

---

## 9. Prescription OCR

- Pharmacist uploads prescription photo.
- OCR extracts text and detects medicines.
- Detected medicines matched with MediSyn database.
- Pharmacist confirms before dispensing.

---

## 10. Voice Prescription

- Doctor speaks prescription.
- Speech converted to text.
- Medicines extracted and structured prescription generated.

---

## 11. AI Recommendation Engine

- Suggest alternative medicines.
- Detect drug interactions.
- Check dosage safety.
- Check pharmacy stock availability.

---

## 12. Pricing

- **Consultation Fee** – defined per doctor.
- **Medicine Cost** – calculated from pharmacy inventory.
- **Final Bill** = Consultation Fee + Medicine Cost

---

## 13. Deployment Modes

- **Clinic Only** – Patient consultation without pharmacy.
- **Pharmacy Only** – Pharmacy POS system.
- **Full MediSyn** – Integrated clinic and pharmacy workflow.
