#!/usr/bin/env python3
"""
MediSyn Vendor CSV Standardizer
Converts multiple vendor CSV formats (Inter Link, MediWMS, etc.) into a unified procurement format.
"""

import csv
import sys
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Tuple

class VendorCSVStandardizer:
    """Detects vendor format and normalizes to MediSyn standard schema."""
    
    # Standard output columns expected by MediSyn bulk upload
    STANDARD_SCHEMA = [
        'supplier_name',
        'bill_no',
        'bill_date',
        'product_code',
        'product_name',
        'batch_no',
        'expiry_date',
        'quantity',
        'free_qty',
        'rate',
        'mrp',
        'tax_percent',
        'discount_percent',
        'hsncode',
        'packing',
        'items_per_pack'
    ]
    
    def __init__(self, filepath: str):
        self.filepath = filepath
        self.filename = Path(filepath).name
        self.vendor_type = None
        self.data = []
        self.metadata = {}
        
    def detect_format(self) -> str:
        """Auto-detect vendor format by inspecting first few rows."""
        with open(self.filepath, 'r', encoding='utf-8-sig') as f:
            first_lines = [f.readline() for _ in range(3)]
        
        # Check for MediWMS format (starts with H, TH row)
        if first_lines[0].strip().startswith('H,MediWMS'):
            self.vendor_type = 'MEDIWMS'
            return 'MEDIWMS'
        
        # Check for Inter Link format (has SUPPLIER, BILL NO., DATE columns)
        if 'SUPPLIER' in first_lines[0] and 'BILL NO' in first_lines[0]:
            self.vendor_type = 'INTER_LINK'
            return 'INTER_LINK'
        
        return 'UNKNOWN'
    
    def parse_mediwms(self) -> List[Dict]:
        """Parse MediWMS format (H, TH, T, F rows)."""
        records = []
        metadata = {}
        
        with open(self.filepath, 'r', encoding='utf-8-sig') as f:
            lines = f.readlines()
        
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            
            # Header row (H)
            if line.startswith('H,'):
                parts = line.split(',')
                if len(parts) >= 11:
                    # H,MediWMS,1.0,206,02/04/2026,,,Credit,N00005,AJESH P.P,64078,MEDISYN SPECIALITY CLINIC,4
                    metadata['bill_no'] = parts[3]
                    metadata['bill_date'] = parts[4]
                    metadata['supplier_rep'] = parts[9] if len(parts) > 9 else ''
                    metadata['supplier_name'] = parts[11] if len(parts) > 11 else 'Unknown Supplier'
            
            # Transaction header (TH)
            elif line.startswith('TH,'):
                pass  # Skip header row
            
            # Transaction row (T)
            elif line.startswith('T,'):
                parts = [p.strip() for p in line.split(',')]
                if len(parts) >= 18:
                    record = {
                        'supplier_name': metadata.get('supplier_name', ''),
                        'bill_no': metadata.get('bill_no', ''),
                        'bill_date': metadata.get('bill_date', ''),
                        'product_code': parts[1],
                        'product_name': parts[2],
                        'batch_no': parts[3],
                        'expiry_date': parts[4],
                        'quantity': parts[8],
                        'free_qty': parts[9],
                        'rate': parts[10],
                        'mrp': parts[12],
                        'tax_percent': parts[13],
                        'discount_percent': parts[17],
                        'hsncode': parts[22] if len(parts) > 22 else '',
                        'packing': parts[6],
                        'items_per_pack': parts[7],
                    }
                    records.append(record)
            
            i += 1
        
        self.metadata = metadata
        return records
    
    def parse_inter_link(self) -> List[Dict]:
        """Parse Inter Link format (single header row)."""
        records = []
        
        with open(self.filepath, 'r', encoding='utf-8-sig') as f:
            # Read header and clean column names
            header_line = f.readline()
            headers = [h.strip() for h in header_line.split(',')]
            
            # Create mapping from cleaned header to original position
            header_map = {h: i for i, h in enumerate(headers)}
            
            # Read data rows
            reader = csv.reader(f)
            for row in reader:
                if not row or len(row) < 5:
                    continue
                
                # Extract values by position (more reliable than DictReader with bad spacing)
                try:
                    record = {
                        'supplier_name': row[header_map.get('SUPPLIER', 0)].strip() if header_map.get('SUPPLIER', 0) < len(row) else 'Unknown',
                        'bill_no': row[header_map.get('BILL NO.', 1)].strip() if header_map.get('BILL NO.', 1) < len(row) else '',
                        'bill_date': row[header_map.get('DATE', 2)].strip() if header_map.get('DATE', 2) < len(row) else '',
                        'product_code': row[header_map.get('CODE', 4)].strip() if header_map.get('CODE', 4) < len(row) else '',
                        'product_name': row[header_map.get('ITEM NAME', 6)].strip() if header_map.get('ITEM NAME', 6) < len(row) else '',
                        'batch_no': row[header_map.get('BATCH', 8)].strip() if header_map.get('BATCH', 8) < len(row) else '',
                        'expiry_date': row[header_map.get('EXPIRY', 9)].strip() if header_map.get('EXPIRY', 9) < len(row) else '',
                        'quantity': row[header_map.get('QTY', 10)].strip() if header_map.get('QTY', 10) < len(row) else '0',
                        'free_qty': row[header_map.get('F.QTY', 11)].strip() if header_map.get('F.QTY', 11) < len(row) else '0',
                        'rate': (row[header_map.get('FTRATE', 13)].strip() if header_map.get('FTRATE', 13) < len(row) else '') or 
                               (row[header_map.get('SRATE', 14)].strip() if header_map.get('SRATE', 14) < len(row) else ''),
                        'mrp': row[header_map.get('MRP', 15)].strip() if header_map.get('MRP', 15) < len(row) else '0',
                        'tax_percent': row[header_map.get('VAT', 18)].strip() if header_map.get('VAT', 18) < len(row) else '0',
                        'discount_percent': row[header_map.get('DIS', 16)].strip() if header_map.get('DIS', 16) < len(row) else '0',
                        'hsncode': row[header_map.get('HSNCODE', 33)].strip() if header_map.get('HSNCODE', 33) < len(row) else '',
                        'packing': row[header_map.get('PACK', 7)].strip() if header_map.get('PACK', 7) < len(row) else '',
                        'items_per_pack': '1',  # Inter Link doesn't have this; default to 1
                    }
                    
                    # Skip rows where product name is empty
                    if record['product_name']:
                        records.append(record)
                except (IndexError, ValueError):
                    continue
        
        return records
    
    def standardize(self) -> Tuple[List[Dict], str]:
        """Detect format and parse accordingly."""
        vendor_type = self.detect_format()
        print(f"✓ Detected format: {vendor_type}")
        
        if vendor_type == 'MEDIWMS':
            records = self.parse_mediwms()
        elif vendor_type == 'INTER_LINK':
            records = self.parse_inter_link()
        else:
            raise ValueError(f"Unknown vendor format in {self.filename}")
        
        # Clean numeric fields
        for record in records:
            for field in ['quantity', 'free_qty', 'rate', 'mrp', 'tax_percent', 'discount_percent', 'items_per_pack']:
                if record.get(field):
                    try:
                        # Remove backticks and convert to float
                        val = str(record[field]).replace('`', '').strip()
                        record[field] = float(val) if val else 0
                    except ValueError:
                        record[field] = 0
        
        self.data = records
        return records, vendor_type
    
    def export(self, output_path: str) -> str:
        """Export standardized records to CSV."""
        if not self.data:
            raise ValueError("No data to export. Call standardize() first.")
        
        with open(output_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=self.STANDARD_SCHEMA)
            writer.writeheader()
            writer.writerows(self.data)
        
        return output_path


def main():
    """Process all uploaded vendor CSVs and create a unified import file."""
    input_dir = Path('/mnt/user-data/uploads')
    output_dir = Path('/mnt/user-data/outputs')
    output_dir.mkdir(exist_ok=True)
    
    csv_files = list(input_dir.glob('*.csv'))
    
    if not csv_files:
        print("❌ No CSV files found in uploads directory")
        sys.exit(1)
    
    all_records = []
    summary = []
    
    for csv_file in sorted(csv_files):
        print(f"\n📄 Processing: {csv_file.name}")
        try:
            standardizer = VendorCSVStandardizer(str(csv_file))
            records, vendor_type = standardizer.standardize()
            all_records.extend(records)
            
            summary.append({
                'file': csv_file.name,
                'vendor_type': vendor_type,
                'supplier': standardizer.metadata.get('supplier_name', records[0].get('supplier_name', 'N/A') if records else 'N/A'),
                'bill_no': standardizer.metadata.get('bill_no', records[0].get('bill_no', 'N/A') if records else 'N/A'),
                'records': len(records)
            })
            
            print(f"  ✓ Parsed {len(records)} medicine records")
        
        except Exception as e:
            print(f"  ❌ Error: {str(e)}")
            summary.append({
                'file': csv_file.name,
                'vendor_type': 'ERROR',
                'supplier': 'N/A',
                'bill_no': 'N/A',
                'records': 0
            })
    
    # Export unified CSV
    unified_output = output_dir / 'MEDISYN_UNIFIED_BULK_UPLOAD.csv'
    if all_records:
        with open(unified_output, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=VendorCSVStandardizer.STANDARD_SCHEMA)
            writer.writeheader()
            writer.writerows(all_records)
        
        print(f"\n✅ SUCCESS!")
        print(f"   Unified file: {unified_output.name}")
        print(f"   Total records: {len(all_records)}")
        print(f"\n📊 Summary:")
        for item in summary:
            print(f"   • {item['file']}: {item['records']} records ({item['vendor_type']})")
    else:
        print("\n❌ No records were extracted.")


if __name__ == '__main__':
    main()
