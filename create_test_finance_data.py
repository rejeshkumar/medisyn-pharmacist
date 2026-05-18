#!/usr/bin/env python3
"""
Create test purchase orders with realistic financial data for Finance Module testing
"""

import psycopg2
from datetime import datetime, timedelta
import uuid

# Database connection
DB_URL = "postgresql://postgres:DiEdeHygIWJrKSwMdRXNJmBwrajJrnev@shortline.proxy.rlwy.net:28446/railway"
TENANT_ID = "00000000-0000-0000-0000-000000000001"

def create_test_pos():
    conn = psycopg2.connect(DB_URL)
    cursor = conn.cursor()
    
    try:
        print("=" * 70)
        print("Creating Test Purchase Orders for Finance Module")
        print("=" * 70)
        print()
        
        # Test PO 1: CANNANORE PHARMA - Overdue
        supplier1_id = "6a5789e1-9841-4ca7-a139-4358d0592a89"
        po1_id = str(uuid.uuid4())
        po1_date = datetime.now() - timedelta(days=20)
        po1_due_date = po1_date + timedelta(days=15)  # 5 days overdue
        
        print("📦 Creating PO 1: CANNANORE PHARMA (Overdue)")
        
        # Insert PO (need a created_by user ID - using a placeholder)
        cursor.execute("""
            INSERT INTO purchase_orders (
                id, tenant_id, po_number, supplier_id, order_date, 
                status, total_amount,
                payment_status, credit_days, payment_due_date,
                receiving_status, items_received_count, total_items_count,
                created_by, created_at, updated_at
            ) VALUES (
                %s, %s, 'PO-TEST-001', %s, %s,
                'received', 44800.00,
                'unpaid', 15, %s,
                'complete', 5, 5,
                %s, %s, %s
            )
        """, (po1_id, TENANT_ID, supplier1_id, po1_date, po1_due_date, TENANT_ID, po1_date, po1_date))
        
        # Insert pharmacy_purchase entry
        cursor.execute("""
            INSERT INTO pharmacy_purchases (
                tenant_id, po_id, supplier_id, purchase_date,
                total_amount, paid_amount, payment_status, vendor_name
            ) VALUES (
                %s, %s, %s, %s,
                44800.00, 0.00, 'unpaid', 'CANNANORE PHARMA'
            )
        """, (TENANT_ID, po1_id, supplier1_id, po1_date))
        
        print(f"  ✅ PO-TEST-001: ₹44,800 (Overdue by 5 days)")
        print()
        
        # Test PO 2: CARE SURGICALS - Due Soon
        supplier2_id = "22ad0e86-35c4-41f3-8402-37a004598112"
        po2_id = str(uuid.uuid4())
        po2_date = datetime.now() - timedelta(days=20)
        po2_due_date = po2_date + timedelta(days=30)  # Due in 10 days
        
        print("📦 Creating PO 2: CARE SURGICALS (Due in 10 days)")
        
        cursor.execute("""
            INSERT INTO purchase_orders (
                id, tenant_id, po_number, supplier_id, order_date,
                status, total_amount,
                payment_status, credit_days, payment_due_date,
                receiving_status, items_received_count, total_items_count,
                created_by, created_at, updated_at
            ) VALUES (
                %s, %s, 'PO-TEST-002', %s, %s,
                'received', 31360.00,
                'unpaid', 30, %s,
                'complete', 3, 3,
                %s, %s, %s
            )
        """, (po2_id, TENANT_ID, supplier2_id, po2_date, po2_due_date, TENANT_ID, po2_date, po2_date))
        
        cursor.execute("""
            INSERT INTO pharmacy_purchases (
                tenant_id, po_id, supplier_id, purchase_date,
                total_amount, paid_amount, payment_status, vendor_name
            ) VALUES (
                %s, %s, %s, %s,
                31360.00, 0.00, 'unpaid', 'CARE SURGICALS&PHARMACEUTICALS'
            )
        """, (TENANT_ID, po2_id, supplier2_id, po2_date))
        
        print(f"  ✅ PO-TEST-002: ₹31,360 (Due in 10 days)")
        print()
        
        # Test PO 3: DAXON HEALTHCARE - Partially Paid
        supplier3_id = "ffdc41f5-98f4-4aca-b3f2-a66260ddd772"
        po3_id = str(uuid.uuid4())
        po3_date = datetime.now() - timedelta(days=15)
        po3_due_date = po3_date + timedelta(days=30)  # Due in 15 days
        
        print("📦 Creating PO 3: DAXON HEALTHCARE (Partially Paid)")
        
        cursor.execute("""
            INSERT INTO purchase_orders (
                id, tenant_id, po_number, supplier_id, order_date,
                status, total_amount,
                payment_status, credit_days, payment_due_date,
                receiving_status, items_received_count, total_items_count,
                created_by, created_at, updated_at
            ) VALUES (
                %s, %s, 'PO-TEST-003', %s, %s,
                'received', 56000.00,
                'partial', 30, %s,
                'complete', 7, 7,
                %s, %s, %s
            )
        """, (po3_id, TENANT_ID, supplier3_id, po3_date, po3_due_date, TENANT_ID, po3_date, po3_date))
        
        cursor.execute("""
            INSERT INTO pharmacy_purchases (
                tenant_id, po_id, supplier_id, purchase_date,
                total_amount, paid_amount, payment_status, vendor_name,
                last_payment_date
            ) VALUES (
                %s, %s, %s, %s,
                56000.00, 20000.00, 'partial', 'DAXON HEALTHCARE PRIVATE LIMITED',
                %s
            )
        """, (TENANT_ID, po3_id, supplier3_id, po3_date, datetime.now() - timedelta(days=5)))
        
        print(f"  ✅ PO-TEST-003: ₹56,000 (₹20,000 paid, ₹36,000 pending)")
        print()
        
        conn.commit()
        
        print("=" * 70)
        print("✅ Test data created successfully!")
        print("=" * 70)
        print()
        print("Summary:")
        print("  • Total POs created: 3")
        print("  • Total amount: ₹1,32,160")
        print("  • Paid: ₹20,000")
        print("  • Pending: ₹1,12,160")
        print()
        print("Next steps:")
        print("  1. Build API endpoints")
        print("  2. Test payment recording")
        print("  3. Verify dashboard shows correct data")
        print()
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Error: {e}")
        raise
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    create_test_pos()
