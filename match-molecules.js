#!/usr/bin/env node
// match-molecules.js
// Run: node match-molecules.js
// Reads your DB medicines, matches against Indian-Medicine-Dataset, 
// generates SQL updates for molecule/strength/dosage_form

const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── Normalize name for matching ────────────────────────────────────────
function normalize(name) {
  return name
    .toUpperCase()
    .replace(/^(TAB|CAP|SYP|SYRUP|INJ|DROPS?|CREAM|GEL|OINT(MENT)?|SUSP(ENSION)?|LIQD|LIQUID|SACHET|LOTION|SPRAY|POWDER|PWD|INH(ALER)?|PATCH|SOLN|SOLUTION)\s+/g, '')
    .replace(/\s+(TABLETS?|CAPSULES?|SYRUP|INJECTION|CREAM|GEL)\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Levenshtein distance (simple, no deps) ─────────────────────────────
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({length: m+1}, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] 
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

function similarity(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

// ── Parse molecule/strength from composition string ────────────────────
function parseMolecule(comp1, comp2) {
  // e.g. "Amoxycillin (500mg)" → molecule: "Amoxycillin", strength: "500mg"
  const parse = (s) => {
    if (!s || s === 'nan') return null;
    const m = s.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    if (m) return { name: m[1].trim(), strength: m[2].trim() };
    return { name: s.trim(), strength: null };
  };
  
  const p1 = parse(comp1);
  const p2 = parse(comp2);
  
  if (!p1) return { molecule: null, strength: null };
  
  if (p2) {
    // Combination drug
    const mol = `${p1.name} + ${p2.name}`;
    const str = [p1.strength, p2.strength].filter(Boolean).join(' + ');
    return { molecule: mol, strength: str };
  }
  
  return { molecule: p1.name, strength: p1.strength };
}

// ── Detect dosage form from pack_size_label ────────────────────────────
function detectForm(packSize, name) {
  const s = (packSize + ' ' + name).toUpperCase();
  if (s.includes('INJECT') || s.includes(' INJ')) return 'Injection';
  if (s.includes('SYRUP') || s.includes(' SYP') || s.includes('SUSPENSION')) return 'Syrup';
  if (s.includes('CAPSULE') || s.includes(' CAP ') || s.match(/\bCAP\b/)) return 'Capsule';
  if (s.includes('CREAM')) return 'Cream';
  if (s.includes('GEL')) return 'Gel';
  if (s.includes('OINTMENT') || s.includes(' OINT')) return 'Ointment';
  if (s.includes('DROPS')) return 'Drops';
  if (s.includes('SPRAY')) return 'Spray';
  if (s.includes('SACHET')) return 'Sachet';
  if (s.includes('LOTION')) return 'Lotion';
  if (s.includes('INHALER') || s.includes(' INH')) return 'Inhaler';
  if (s.includes('PATCH')) return 'Patch';
  if (s.includes('TABLET') || s.includes(' TAB')) return 'Tablet';
  return 'Tablet'; // default
}

async function main() {
  console.log('🔍 Loading reference dataset...');
  const refData = JSON.parse(fs.readFileSync('ref_medicines.json', 'utf8'));
  
  // Build lookup: normalized_name → array of ref entries
  const lookup = new Map();
  for (const r of refData) {
    const key = r.name_norm;
    if (!lookup.has(key)) lookup.set(key, []);
    lookup.get(key).push(r);
  }
  console.log(`✅ Reference: ${refData.length} medicines indexed`);
  
  // Get your medicines from DB
  console.log('\n📦 Loading your medicines from DB...');
  const { rows: medicines } = await pool.query(`
    SELECT id, brand_name, manufacturer, molecule, strength, dosage_form,
           molecule_verified, molecule_source
    FROM medicines
    WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
    ORDER BY brand_name
  `);
  console.log(`Found ${medicines.length} medicines`);
  
  const results = { matched: [], low_confidence: [], unmatched: [] };
  const sqlLines = [];
  
  for (const med of medicines) {
    const normName = normalize(med.brand_name);
    
    // Try exact match first
    let bestMatch = null;
    let bestScore = 0;
    
    // Exact lookup
    if (lookup.has(normName)) {
      const candidates = lookup.get(normName);
      bestMatch = candidates[0];
      bestScore = 1.0;
    } else {
      // Fuzzy: check all keys, find best score
      // Only check keys that start with same first 3 chars (performance)
      const prefix = normName.substring(0, 3);
      for (const [key, entries] of lookup.entries()) {
        if (!key.startsWith(prefix)) continue;
        const score = similarity(normName, key);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = entries[0];
        }
      }
    }
    
    if (!bestMatch || bestScore < 0.75) {
      results.unmatched.push({ id: med.id, name: med.brand_name, norm: normName });
      continue;
    }
    
    const { molecule, strength } = parseMolecule(
      bestMatch.short_composition1, bestMatch.short_composition2
    );
    
    if (!molecule) {
      results.unmatched.push({ id: med.id, name: med.brand_name });
      continue;
    }
    
    const dosageForm = detectForm(bestMatch.pack_size_label || '', med.brand_name);
    
    const entry = {
      id: med.id,
      brand_name: med.brand_name,
      matched_to: bestMatch.name,
      score: bestScore.toFixed(3),
      molecule,
      strength: strength || '',
      dosage_form: dosageForm,
    };
    
    if (bestScore >= 0.90) {
      results.matched.push(entry);
      sqlLines.push(
        `UPDATE medicines SET molecule=${sqlStr(molecule)}, strength=${sqlStr(strength||'')}, dosage_form=${sqlStr(dosageForm)}, molecule_verified=true, molecule_source='dataset-match' WHERE id='${med.id}';`
      );
    } else {
      results.low_confidence.push(entry);
    }
  }
  
  // Write SQL file
  fs.writeFileSync('molecule-updates.sql', sqlLines.join('\n'));
  
  // Write review CSV for low confidence
  const reviewRows = ['id,brand_name,matched_to,score,molecule,strength,dosage_form'];
  for (const r of results.low_confidence) {
    reviewRows.push(`"${r.id}","${r.brand_name}","${r.matched_to}",${r.score},"${r.molecule}","${r.strength}","${r.dosage_form}"`);
  }
  fs.writeFileSync('review-these.csv', reviewRows.join('\n'));
  
  // Summary
  console.log('\n📊 RESULTS:');
  console.log(`✅ High confidence (≥90%): ${results.matched.length} → SQL generated`);
  console.log(`⚠️  Low confidence (75-90%): ${results.low_confidence.length} → review-these.csv`);
  console.log(`❌ No match found (<75%): ${results.unmatched.length}`);
  console.log(`\nTotal coverage: ${((results.matched.length / medicines.length)*100).toFixed(1)}% auto-updated`);
  console.log('\n📁 Files generated:');
  console.log('  molecule-updates.sql → run this on your DB');
  console.log('  review-these.csv → check these manually');
  
  await pool.end();
}

function sqlStr(s) {
  return s ? `'${s.replace(/'/g, "''")}'` : 'NULL';
}

main().catch(console.error);
