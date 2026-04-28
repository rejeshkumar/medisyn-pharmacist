#!/usr/bin/env node
/**
 * MediSyn Schedule Classifier
 * Classifies medicines as OTC / H / H1 / X based on brand name keywords
 * Run after import-stock to fix all schedule_class values
 *
 * Usage:
 *   DATABASE_URL=postgresql://... node schedule-classifier.js
 */

require('dotenv').config();
const { Client } = require('pg');

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const db = new Client({ connectionString: process.env.DATABASE_URL });

// ── Schedule X — Narcotics, psychotropics (strictest) ────────────────────────
const SCHEDULE_X = [
  'ALPRAZOLAM','CLONAZEPAM','DIAZEPAM','LORAZEPAM','NITRAZEPAM',
  'TRIAZOLAM','MIDAZOLAM','ZOLPIDEM','ZOPICLONE','BROTIZOLAM',
  'MORPHINE','CODEINE','TRAMADOL','FENTANYL','BUPRENORPHINE',
  'OXYCODONE','HYDROCODONE','METHADONE','PENTAZOCINE','TAPENTADOL',
  'PHENOBARBITONE','PHENOBARBITAL','BARBITURATE',
  'METHYLPHENIDATE','AMPHETAMINE','DEXTROAMPHETAMINE',
  'KETAMINE','THIOPENTAL','PROPOFOL',
  'NABILONE','DRONABINOL',
];

// ── Schedule H1 — Restricted antibiotics ─────────────────────────────────────
const SCHEDULE_H1 = [
  'CIPROFLOXACIN','OFLOXACIN','LEVOFLOXACIN','MOXIFLOXACIN','NORFLOXACIN',
  'GATIFLOXACIN','SPARFLOXACIN','PEFLOXACIN','FLEROXACIN',
  'CEFIXIME','CEFTRIAXONE','CEFPODOXIME','CEFUROXIME','CEFDINIR',
  'CEFOPERAZONE','CEFEPIME','CEFTAZIDIME','CEFAZOLIN',
  'AZITHROMYCIN','CLARITHROMYCIN','ROXITHROMYCIN','ERYTHROMYCIN',
  'AMOXICILLIN','AMPICILLIN','CLOXACILLIN','FLUCLOXACILLIN',
  'PIPERACILLIN','AMOXYCLAV','AUGMENTIN','CO-AMOXICLAV',
  'MEROPENEM','IMIPENEM','ERTAPENEM','DORIPENEM',
  'LINEZOLID','VANCOMYCIN','TEICOPLANIN','DAPTOMYCIN',
  'RIFAMPICIN','ISONIAZID','ETHAMBUTOL','PYRAZINAMIDE',
  'ACYCLOVIR','OSELTAMIVIR','VALACYCLOVIR','FAMCICLOVIR',
  'FLUCONAZOLE','ITRACONAZOLE','VORICONAZOLE','POSACONAZOLE',
  'METRONIDAZOLE','TINIDAZOLE','ORNIDAZOLE','SECNIDAZOLE',
  'DOXYCYCLINE','TETRACYCLINE','MINOCYCLINE',
  'CHLORAMPHENICOL','STREPTOMYCIN','KANAMYCIN','NEOMYCIN',
  'COLISTIN','POLYMYXIN','FOSFOMYCIN',
  'FAROPENEM','CLAVULANATE','SULBACTAM','TAZOBACTAM',
];

// ── Schedule H — Prescription required ───────────────────────────────────────
const SCHEDULE_H = [
  // Steroids / hormones
  'PREDNISOLONE','PREDNISONE','DEXAMETHASONE','BETAMETHASONE',
  'HYDROCORTISONE','METHYLPREDNISOLONE','TRIAMCINOLONE','BUDESONIDE',
  'BECLOMETHASONE','FLUTICASONE','MOMETASONE','CLOBETASOL',
  'INSULIN','GLIBENCLAMIDE','GLIMEPIRIDE','METFORMIN','GLICLAZIDE',
  'SITAGLIPTIN','VILDAGLIPTIN','EMPAGLIFLOZIN','DAPAGLIFLOZIN',
  'PIOGLITAZONE','ROSIGLITAZONE',
  // Antihypertensives
  'AMLODIPINE','ATENOLOL','METOPROLOL','BISOPROLOL','CARVEDILOL',
  'ENALAPRIL','LISINOPRIL','RAMIPRIL','PERINDOPRIL','TELMISARTAN',
  'LOSARTAN','VALSARTAN','OLMESARTAN','CANDESARTAN',
  'NIFEDIPINE','DILTIAZEM','VERAPAMIL','FELODIPINE',
  'FUROSEMIDE','HYDROCHLOROTHIAZIDE','SPIRONOLACTONE','CHLORTHALIDONE',
  // Cardiac
  'DIGOXIN','WARFARIN','HEPARIN','CLOPIDOGREL','ASPIRIN CARDIAC',
  'ATORVASTATIN','ROSUVASTATIN','SIMVASTATIN','LOVASTATIN',
  'AMIODARONE','PROPAFENONE','SOTALOL',
  // CNS
  'PHENYTOIN','CARBAMAZEPINE','VALPROATE','VALPROIC','LEVETIRACETAM',
  'OXCARBAZEPINE','LAMOTRIGINE','GABAPENTIN','PREGABALIN',
  'HALOPERIDOL','RISPERIDONE','OLANZAPINE','QUETIAPINE','ARIPIPRAZOLE',
  'CLOZAPINE','AMISULPRIDE','ZIPRASIDONE',
  'FLUOXETINE','SERTRALINE','PAROXETINE','ESCITALOPRAM','CITALOPRAM',
  'AMITRIPTYLINE','NORTRIPTYLINE','IMIPRAMINE','CLOMIPRAMINE',
  'VENLAFAXINE','DULOXETINE','MIRTAZAPINE','BUPROPION',
  // GI
  'OMEPRAZOLE','PANTOPRAZOLE','RABEPRAZOLE','ESOMEPRAZOLE','LANSOPRAZOLE',
  'DOMPERIDONE','METOCLOPRAMIDE','ONDANSETRON','GRANISETRON',
  'MESALAZINE','SULFASALAZINE',
  // Pain / muscle
  'DICLOFENAC','IBUPROFEN','NAPROXEN','PIROXICAM','MELOXICAM',
  'CELECOXIB','ETORICOXIB','ACECLOFENAC','KETOROLAC',
  'BACLOFEN','TIZANIDINE','CYCLOBENZAPRINE','METHOCARBAMOL',
  // Thyroid
  'LEVOTHYROXINE','THYROXINE','CARBIMAZOLE','PROPYLTHIOURACIL',
  // Others
  'HYDROXYCHLOROQUINE','CHLOROQUINE','QUININE',
  'COLCHICINE','ALLOPURINOL','FEBUXOSTAT',
  'SILDENAFIL','TADALAFIL','VARDENAFIL',
  'ISOTRETINOIN','TRETINOIN',
  'TACROLIMUS','CYCLOSPORINE','MYCOPHENOLATE','AZATHIOPRINE',
  'METHOTREXATE','HYDROXYCARBAMIDE','HYDROXYUREA',
];

async function classify() {
  await db.connect();
  console.log('✅ Connected\n');

  const { rows: medicines } = await db.query(
    `SELECT id, brand_name FROM medicines WHERE tenant_id = $1`,
    [TENANT_ID]
  );

  console.log(`📦 ${medicines.length} medicines to classify\n`);

  let x = 0, h1 = 0, h = 0, otc = 0;

  for (const med of medicines) {
    const name = med.brand_name.toUpperCase();
    let schedule = 'OTC';

    // Check X first (strictest)
    if (SCHEDULE_X.some(k => name.includes(k))) {
      schedule = 'X';
      x++;
    }
    // Then H1
    else if (SCHEDULE_H1.some(k => name.includes(k))) {
      schedule = 'H1';
      h1++;
    }
    // Then H
    else if (SCHEDULE_H.some(k => name.includes(k))) {
      schedule = 'H';
      h++;
    }
    else {
      otc++;
    }

    await db.query(
      `UPDATE medicines SET schedule_class = $1, updated_at = NOW() WHERE id = $2`,
      [schedule, med.id]
    );
  }

  console.log('✅ Classification complete!');
  console.log(`   Schedule X  : ${x}`);
  console.log(`   Schedule H1 : ${h1}`);
  console.log(`   Schedule H  : ${h}`);
  console.log(`   OTC         : ${otc}`);
  console.log(`   Total       : ${medicines.length}`);

  // Verify
  const { rows } = await db.query(
    `SELECT schedule_class, COUNT(*) FROM medicines WHERE tenant_id = $1 GROUP BY schedule_class ORDER BY schedule_class`,
    [TENANT_ID]
  );
  console.log('\n📊 DB verification:');
  rows.forEach(r => console.log(`   ${r.schedule_class}: ${r.count}`));

  await db.end();
}

classify().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
