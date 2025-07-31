from flask import Flask, send_from_directory, send_file, request, jsonify, Response
import os
import json
from datetime import datetime, timedelta
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Image
from reportlab.platypus.flowables import HRFlowable
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
import io
import tempfile
import hashlib
import qrcode
from qrcode import QRCode
from PIL import Image as PILImage

app = Flask(__name__, static_folder='.', static_url_path='')

def generate_security_hash(receipt_data):
    """Generate a complex security hash for receipt verification"""
    security_string = f"{receipt_data['student_name']}{receipt_data['roll_number']}{receipt_data['amount']}{receipt_data['fee_type']}{receipt_data['timestamp']}NAVADAYA_SECURITY_2025"
    hash_value = 0
    for char in security_string:
        hash_value = ((hash_value << 5) - hash_value) + ord(char)
        hash_value = hash_value & hash_value
    return abs(hash_value) % (16**12)

def generate_qr_code_data(receipt_number, verification_code, security_hash, roll_number, amount):
    """Generate QR code data with all essential verification information"""
    qr_payload = {
        'rcp': receipt_number,
        'vc': verification_code,
        'sh': str(security_hash)[:16],
        'roll': roll_number,
        'amt': str(amount),
        'ts': int(datetime.now().timestamp()),
        'host': 'navadaya.hostel'
    }
    return json.dumps(qr_payload)

def create_qr_code_image(data):
    """Create QR code image and return as temporary file"""
    import qrcode.constants
    qr = QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(data)
    qr.make(fit=True)
    
    # Create QR code image
    qr_image = qr.make_image(fill_color="black", back_color="white")
    
    # Save to temporary file
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.png')
    qr_image.save(temp_file.name)
    temp_file.close()
    
    return temp_file.name

@app.route('/')
def index():
    return send_file('index.html')

@app.route('/api/generate-student-report', methods=['POST'])
def generate_student_report():
    try:
        data = request.json or {}
        student_data = data.get('student', {})
        fees_data = data.get('fees', [])
        room_data = data.get('room', {})
        
        # Create PDF in memory
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=72, leftMargin=72, topMargin=72, bottomMargin=18)
        
        # Create styles
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=20,
            spaceAfter=30,
            alignment=TA_CENTER,
            textColor=colors.darkblue
        )
        
        header_style = ParagraphStyle(
            'CustomHeader',
            parent=styles['Heading2'],
            fontSize=14,
            spaceAfter=12,
            textColor=colors.darkgreen
        )
        
        normal_style = ParagraphStyle(
            'CustomNormal',
            parent=styles['Normal'],
            fontSize=10,
            spaceAfter=6
        )
        
        # Build PDF content
        story = []
        
        # Header
        story.append(Paragraph("Girls Hostel Management System", title_style))
        story.append(Paragraph("Complete Student Report", header_style))
        story.append(Spacer(1, 20))
        
        # Report metadata
        report_date = datetime.now().strftime("%d %B %Y at %I:%M %p")
        story.append(Paragraph(f"<b>Report Generated:</b> {report_date}", normal_style))
        story.append(Spacer(1, 20))
        story.append(HRFlowable(width="100%", thickness=1, lineCap='round', color=colors.grey))
        story.append(Spacer(1, 20))
        
        # Student Information Section
        story.append(Paragraph("STUDENT INFORMATION", header_style))
        
        student_info = [
            ['Field', 'Details'],
            ['Full Name', f"{student_data.get('firstName', '')} {student_data.get('lastName', '')}"],
            ['Roll Number', student_data.get('rollNumber', 'N/A')],
            ['Course', student_data.get('course', 'N/A')],
            ['Year', str(student_data.get('year', 'N/A'))],
            ['Email', student_data.get('email', 'N/A')],
            ['Phone', student_data.get('phone', 'N/A')],
            ['Address', student_data.get('address', 'N/A')],
            ['Guardian Name', student_data.get('guardianName', 'N/A')],
            ['Guardian Phone', student_data.get('guardianPhone', 'N/A')],
            ['Status', student_data.get('status', 'Active').title()],
            ['Admission Date', student_data.get('createdAt', 'N/A')[:10] if student_data.get('createdAt') else 'N/A']
        ]
        
        student_table = Table(student_info, colWidths=[2*inch, 4*inch])
        student_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        
        story.append(student_table)
        story.append(Spacer(1, 20))
        
        # Room Information Section
        if room_data:
            story.append(Paragraph("ROOM INFORMATION", header_style))
            
            room_info = [
                ['Field', 'Details'],
                ['Room Number', room_data.get('roomNumber', 'N/A')],
                ['Floor', str(room_data.get('floor', 'N/A'))],
                ['Capacity', f"{room_data.get('occupiedBeds', 0)}/{room_data.get('capacity', 0)} beds"],
                ['Monthly Rent', f"₹{room_data.get('monthlyRent', 0):,.2f}"],
                ['Room Type', room_data.get('roomType', 'N/A')],
                ['Facilities', room_data.get('facilities', 'N/A')]
            ]
            
            room_table = Table(room_info, colWidths=[2*inch, 4*inch])
            room_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 12),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            
            story.append(room_table)
            story.append(Spacer(1, 20))
        
        # Fees Information Section
        story.append(Paragraph("FEES DETAILS", header_style))
        
        if fees_data:
            # Calculate totals
            total_amount = sum(fee.get('amount', 0) for fee in fees_data)
            paid_amount = sum(fee.get('amount', 0) for fee in fees_data if fee.get('status') == 'paid')
            pending_amount = sum(fee.get('amount', 0) for fee in fees_data if fee.get('status') == 'pending')
            overdue_amount = sum(fee.get('amount', 0) for fee in fees_data if fee.get('status') == 'overdue')
            
            # Fees summary
            fees_summary = [
                ['Summary', 'Amount (₹)'],
                ['Total Fees Generated', f"₹{total_amount:,.2f}"],
                ['Amount Paid', f"₹{paid_amount:,.2f}"],
                ['Amount Pending', f"₹{pending_amount:,.2f}"],
                ['Overdue Amount', f"₹{overdue_amount:,.2f}"]
            ]
            
            summary_table = Table(fees_summary, colWidths=[3*inch, 2*inch])
            summary_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.darkgreen),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 12),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.lightgrey),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            
            story.append(summary_table)
            story.append(Spacer(1, 20))
            
            # Detailed fees table
            story.append(Paragraph("DETAILED FEES BREAKDOWN", header_style))
            
            fees_details = [['Period/Type', 'Amount (₹)', 'Status', 'Due Date', 'Payment Date']]
            
            for fee in fees_data:
                fee_type_map = {
                    'monthly_rent': 'Monthly Rent',
                    'security_deposit': 'Security Deposit',
                    'maintenance': 'Maintenance',
                    'electricity': 'Electricity',
                    'other': 'Other'
                }
                
                period = fee.get('feeType', '')
                if fee.get('month') and fee.get('year'):
                    period = f"{fee_type_map.get(fee.get('feeType'), fee.get('feeType', ''))} ({fee.get('month')}/{fee.get('year')})"
                else:
                    period = fee_type_map.get(fee.get('feeType'), fee.get('feeType', ''))
                
                status = fee.get('status', 'pending').title()
                due_date = fee.get('dueDate', 'N/A')
                payment_date = fee.get('paymentDate', 'N/A') if fee.get('status') == 'paid' else '-'
                
                fees_details.append([
                    period,
                    f"₹{fee.get('amount', 0):,.2f}",
                    status,
                    due_date[:10] if due_date != 'N/A' else 'N/A',
                    payment_date[:10] if payment_date != 'N/A' and payment_date != '-' else payment_date
                ])
            
            fees_table = Table(fees_details, colWidths=[2*inch, 1.2*inch, 1*inch, 1*inch, 1*inch])
            fees_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.darkblue),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('FONTSIZE', (0, 1), (-1, -1), 9),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            
            story.append(fees_table)
        else:
            story.append(Paragraph("No fees data available for this student.", normal_style))
        
        story.append(Spacer(1, 40))
        story.append(HRFlowable(width="100%", thickness=1, lineCap='round', color=colors.grey))
        story.append(Spacer(1, 20))
        
        # Footer
        footer_text = f"This report was generated automatically by the Girls Hostel Management System on {report_date}."
        story.append(Paragraph(footer_text, ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, alignment=TA_CENTER, textColor=colors.grey)))
        
        # Build PDF
        doc.build(story)
        buffer.seek(0)
        
        # Generate filename
        student_name = f"{student_data.get('firstName', '')}-{student_data.get('lastName', '')}"
        filename = f"Student-Report-{student_name}-{datetime.now().strftime('%Y%m%d')}.pdf"
        
        return Response(
            buffer.getvalue(),
            mimetype='application/pdf',
            headers={
                'Content-Disposition': f'attachment; filename="{filename}"',
                'Content-Type': 'application/pdf'
            }
        )
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/generate-all-students-report', methods=['POST'])
def generate_all_students_report():
    try:
        data = request.json or {}
        students_data = data.get('studentsData', [])
        filters = data.get('filters', {})
        
        # Create PDF in memory
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=72, leftMargin=72, topMargin=72, bottomMargin=18)
        
        # Create styles
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=20,
            spaceAfter=30,
            alignment=TA_CENTER,
            textColor=colors.darkblue
        )
        
        header_style = ParagraphStyle(
            'CustomHeader',
            parent=styles['Heading2'],
            fontSize=16,
            spaceAfter=15,
            textColor=colors.darkgreen
        )
        
        sub_header_style = ParagraphStyle(
            'SubHeader',
            parent=styles['Heading3'],
            fontSize=12,
            spaceAfter=10,
            textColor=colors.darkblue
        )
        
        normal_style = ParagraphStyle(
            'CustomNormal',
            parent=styles['Normal'],
            fontSize=9,
            spaceAfter=6
        )
        
        # Build PDF content
        story = []
        
        # Header
        story.append(Paragraph("Girls Hostel Management System", title_style))
        story.append(Paragraph("All Students Complete Report", header_style))
        story.append(Spacer(1, 20))
        
        # Report metadata
        report_date = datetime.now().strftime("%d %B %Y at %I:%M %p")
        story.append(Paragraph(f"<b>Report Generated:</b> {report_date}", normal_style))
        story.append(Paragraph(f"<b>Total Students:</b> {len(students_data)}", normal_style))
        
        # Applied filters
        if filters:
            filter_text = []
            if filters.get('year'):
                filter_text.append(f"Year: {filters['year']}")
            if filters.get('month'):
                filter_text.append(f"Month: {filters['month']}")
            
            if filter_text:
                story.append(Paragraph(f"<b>Applied Filters:</b> {', '.join(filter_text)}", normal_style))
        
        story.append(Spacer(1, 20))
        story.append(HRFlowable(width="100%", thickness=1, lineCap='round', color=colors.grey))
        story.append(Spacer(1, 20))
        
        # Process each student
        for idx, student_data in enumerate(students_data):
            student = student_data.get('student', {})
            fees = student_data.get('fees', [])
            room = student_data.get('room', {})
            
            # Student header
            story.append(Paragraph(f"STUDENT {idx + 1}: {student.get('firstName', '')} {student.get('lastName', '')}", sub_header_style))
            story.append(Spacer(1, 10))
            
            # Student basic info table
            student_info = [
                ['Roll No.', student.get('rollNumber', 'N/A')],
                ['Course & Year', f"{student.get('course', 'N/A')} - Year {student.get('year', 'N/A')}"],
                ['Email', student.get('email', 'N/A')],
                ['Phone', student.get('phone', 'N/A')],
                ['Guardian', f"{student.get('guardianName', 'N/A')} ({student.get('guardianPhone', 'N/A')})"],
                ['Room', f"Room {room.get('roomNumber', 'Not Assigned')}" if room else 'Not Assigned'],
                ['Monthly Rent', f"₹{room.get('monthlyRent', 0):,.2f}" if room else 'N/A']
            ]
            
            student_table = Table(student_info, colWidths=[1.5*inch, 3*inch])
            student_table.setStyle(TableStyle([
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey)
            ]))
            
            story.append(student_table)
            story.append(Spacer(1, 15))
            
            # Fees summary for this student
            if fees:
                total_fees = sum(fee.get('amount', 0) for fee in fees)
                paid_fees = sum(fee.get('amount', 0) for fee in fees if fee.get('status') == 'paid')
                pending_fees = sum(fee.get('amount', 0) for fee in fees if fee.get('status') == 'pending')
                overdue_fees = sum(fee.get('amount', 0) for fee in fees if fee.get('status') == 'overdue')
                
                fees_summary = [
                    ['Total Fees', f"₹{total_fees:,.2f}"],
                    ['Paid', f"₹{paid_fees:,.2f}"],
                    ['Pending', f"₹{pending_fees:,.2f}"],
                    ['Overdue', f"₹{overdue_fees:,.2f}"]
                ]
                
                fees_summary_table = Table(fees_summary, colWidths=[1.5*inch, 1.5*inch])
                fees_summary_table.setStyle(TableStyle([
                    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                    ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, -1), 8),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                    ('BACKGROUND', (0, 0), (-1, -1), colors.lightgrey),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.black)
                ]))
                
                story.append(Paragraph("<b>Fees Summary:</b>", normal_style))
                story.append(fees_summary_table)
            else:
                story.append(Paragraph("<b>No fees data available</b>", normal_style))
            
            # Add separator between students (except for last student)
            if idx < len(students_data) - 1:
                story.append(Spacer(1, 20))
                story.append(HRFlowable(width="100%", thickness=1, lineCap='round', color=colors.lightgrey))
                story.append(Spacer(1, 20))
            else:
                story.append(Spacer(1, 30))
        
        # Overall summary at the end
        story.append(HRFlowable(width="100%", thickness=1, lineCap='round', color=colors.grey))
        story.append(Spacer(1, 20))
        story.append(Paragraph("OVERALL SUMMARY", header_style))
        
        # Calculate overall totals
        total_students = len(students_data)
        students_with_rooms = len([s for s in students_data if s.get('room')])
        all_fees = [fee for student_data in students_data for fee in student_data.get('fees', [])]
        
        overall_total = sum(fee.get('amount', 0) for fee in all_fees)
        overall_paid = sum(fee.get('amount', 0) for fee in all_fees if fee.get('status') == 'paid')
        overall_pending = sum(fee.get('amount', 0) for fee in all_fees if fee.get('status') == 'pending')
        overall_overdue = sum(fee.get('amount', 0) for fee in all_fees if fee.get('status') == 'overdue')
        
        overall_summary = [
            ['Total Students', str(total_students)],
            ['Students with Rooms', str(students_with_rooms)],
            ['Students without Rooms', str(total_students - students_with_rooms)],
            ['Total Fees Generated', f"₹{overall_total:,.2f}"],
            ['Total Amount Collected', f"₹{overall_paid:,.2f}"],
            ['Total Amount Pending', f"₹{overall_pending:,.2f}"],
            ['Total Overdue Amount', f"₹{overall_overdue:,.2f}"],
            ['Collection Rate', f"{(overall_paid/overall_total*100) if overall_total > 0 else 0:.1f}%"]
        ]
        
        overall_table = Table(overall_summary, colWidths=[2.5*inch, 2*inch])
        overall_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.darkgreen),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        
        story.append(overall_table)
        story.append(Spacer(1, 40))
        
        # Footer
        footer_text = f"This comprehensive report contains complete information for all {total_students} students and was generated automatically by the Girls Hostel Management System on {report_date}."
        story.append(Paragraph(footer_text, ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, alignment=TA_CENTER, textColor=colors.grey)))
        
        # Build PDF
        doc.build(story)
        buffer.seek(0)
        
        # Generate filename
        filename = f"All-Students-Complete-Report-{datetime.now().strftime('%Y%m%d-%H%M')}.pdf"
        
        return Response(
            buffer.getvalue(),
            mimetype='application/pdf',
            headers={
                'Content-Disposition': f'attachment; filename="{filename}"',
                'Content-Type': 'application/pdf'
            }
        )
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/generate-fees-report', methods=['POST'])
def generate_fees_report():
    try:
        data = request.json or {}
        students_data = data.get('students', [])
        fees_data = data.get('fees', [])
        rooms_data = data.get('rooms', [])
        filters = data.get('filters', {})
        
        # Create PDF in memory
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=72, leftMargin=72, topMargin=72, bottomMargin=18)
        
        # Create styles
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=18,
            spaceAfter=30,
            alignment=TA_CENTER,
            textColor=colors.darkblue
        )
        
        header_style = ParagraphStyle(
            'CustomHeader',
            parent=styles['Heading2'],
            fontSize=12,
            spaceAfter=12,
            textColor=colors.darkgreen
        )
        
        normal_style = ParagraphStyle(
            'CustomNormal',
            parent=styles['Normal'],
            fontSize=9,
            spaceAfter=6
        )
        
        # Build PDF content
        story = []
        
        # Header
        story.append(Paragraph("Girls Hostel Management System", title_style))
        story.append(Paragraph("Comprehensive Fees Report", header_style))
        story.append(Spacer(1, 20))
        
        # Report metadata
        report_date = datetime.now().strftime("%d %B %Y at %I:%M %p")
        story.append(Paragraph(f"<b>Report Generated:</b> {report_date}", normal_style))
        
        # Applied filters
        if filters:
            filter_text = []
            if filters.get('year'):
                filter_text.append(f"Year: {filters['year']}")
            if filters.get('month'):
                filter_text.append(f"Month: {filters['month']}")
            if filters.get('status'):
                filter_text.append(f"Status: {filters['status'].title()}")
            if filters.get('feeType'):
                filter_text.append(f"Fee Type: {filters['feeType'].replace('_', ' ').title()}")
            
            if filter_text:
                story.append(Paragraph(f"<b>Applied Filters:</b> {', '.join(filter_text)}", normal_style))
        
        story.append(Spacer(1, 20))
        story.append(HRFlowable(width="100%", thickness=1, lineCap='round', color=colors.grey))
        story.append(Spacer(1, 20))
        
        # Overall Summary
        story.append(Paragraph("OVERALL SUMMARY", header_style))
        
        total_students = len(students_data)
        total_amount = sum(fee.get('amount', 0) for fee in fees_data)
        paid_amount = sum(fee.get('amount', 0) for fee in fees_data if fee.get('status') == 'paid')
        pending_amount = sum(fee.get('amount', 0) for fee in fees_data if fee.get('status') == 'pending')
        overdue_amount = sum(fee.get('amount', 0) for fee in fees_data if fee.get('status') == 'overdue')
        
        summary_data = [
            ['Metric', 'Value'],
            ['Total Students', str(total_students)],
            ['Total Fees Generated', f"₹{total_amount:,.2f}"],
            ['Amount Collected', f"₹{paid_amount:,.2f}"],
            ['Amount Pending', f"₹{pending_amount:,.2f}"],
            ['Overdue Amount', f"₹{overdue_amount:,.2f}"],
            ['Collection Rate', f"{(paid_amount/total_amount*100) if total_amount > 0 else 0:.1f}%"]
        ]
        
        summary_table = Table(summary_data, colWidths=[3*inch, 2*inch])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.darkgreen),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 11),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.lightgrey),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        
        story.append(summary_table)
        story.append(Spacer(1, 20))
        
        # Detailed Student-wise Breakdown
        story.append(Paragraph("STUDENT-WISE FEES BREAKDOWN", header_style))
        
        # Group fees by student
        student_fees = {}
        for fee in fees_data:
            student_id = fee.get('studentId')
            if student_id not in student_fees:
                student_fees[student_id] = []
            student_fees[student_id].append(fee)
        
        # Create student-wise table
        student_breakdown = [['Student', 'Room', 'Total Fees', 'Paid', 'Pending', 'Overdue']]
        
        for student in students_data:
            student_id = student.get('id')
            student_name = f"{student.get('firstName', '')} {student.get('lastName', '')}"
            
            # Find room info
            room_number = 'N/A'
            if student.get('assignedRoom'):
                room = next((r for r in rooms_data if r.get('id') == student.get('assignedRoom')), None)
                if room:
                    room_number = room.get('roomNumber', 'N/A')
            
            # Calculate student totals
            student_total = sum(fee.get('amount', 0) for fee in student_fees.get(student_id, []))
            student_paid = sum(fee.get('amount', 0) for fee in student_fees.get(student_id, []) if fee.get('status') == 'paid')
            student_pending = sum(fee.get('amount', 0) for fee in student_fees.get(student_id, []) if fee.get('status') == 'pending')
            student_overdue = sum(fee.get('amount', 0) for fee in student_fees.get(student_id, []) if fee.get('status') == 'overdue')
            
            student_breakdown.append([
                student_name,
                room_number,
                f"₹{student_total:,.2f}",
                f"₹{student_paid:,.2f}",
                f"₹{student_pending:,.2f}",
                f"₹{student_overdue:,.2f}"
            ])
        
        breakdown_table = Table(student_breakdown, colWidths=[2*inch, 0.8*inch, 1*inch, 1*inch, 1*inch, 1*inch])
        breakdown_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.darkblue),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        
        story.append(breakdown_table)
        story.append(Spacer(1, 40))
        story.append(HRFlowable(width="100%", thickness=1, lineCap='round', color=colors.grey))
        story.append(Spacer(1, 20))
        
        # Footer
        footer_text = f"This comprehensive fees report was generated automatically by the Girls Hostel Management System on {report_date}."
        story.append(Paragraph(footer_text, ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, alignment=TA_CENTER, textColor=colors.grey)))
        
        # Build PDF
        doc.build(story)
        buffer.seek(0)
        
        # Generate filename
        filename = f"Fees-Report-{datetime.now().strftime('%Y%m%d-%H%M')}.pdf"
        
        return Response(
            buffer.getvalue(),
            mimetype='application/pdf',
            headers={
                'Content-Disposition': f'attachment; filename="{filename}"',
                'Content-Type': 'application/pdf'
            }
        )
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/generate-fee-receipt', methods=['POST'])
def generate_fee_receipt():
    try:
        data = request.json or {}
        student_data = data.get('student', {})
        fee_data = data.get('fee', {})
        room_data = data.get('room', {})
        
        # Create PDF in memory
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=72, leftMargin=72, topMargin=72, bottomMargin=18)
        
        # Create styles
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'ReceiptTitle',
            parent=styles['Heading1'],
            fontSize=20,
            spaceAfter=20,
            alignment=TA_CENTER,
            textColor=colors.darkblue
        )
        
        header_style = ParagraphStyle(
            'ReceiptHeader',
            parent=styles['Heading2'],
            fontSize=14,
            spaceAfter=12,
            textColor=colors.darkgreen
        )
        
        normal_style = ParagraphStyle(
            'ReceiptNormal',
            parent=styles['Normal'],
            fontSize=11,
            spaceAfter=8
        )
        
        right_align_style = ParagraphStyle(
            'RightAlign',
            parent=styles['Normal'],
            fontSize=11,
            alignment=TA_RIGHT
        )
        
        # Build PDF content
        story = []
        
        # Header
        story.append(Paragraph("Navadaya Girls Hostel Management System", title_style))
        story.append(Paragraph("Fee Payment Receipt", header_style))
        story.append(Spacer(1, 20))
        
        # Enhanced security features
        timestamp = datetime.now()
        receipt_number = f"RCP-{fee_data.get('id', 'UNKNOWN')[-8:].upper()}"
        receipt_date = timestamp.strftime("%d %B %Y")
        
        # Generate enhanced verification code with multiple parameters
        verification_base = f"{fee_data.get('id', '')}{student_data.get('rollNumber', '')}{fee_data.get('amount', 0)}{timestamp.timestamp()}NAVADAYA{timestamp.year}"
        verification_hash = hash(verification_base) & 0x7FFFFFFF
        verification_code = f"{verification_hash % 999999:06d}-{(verification_hash // 1000) % 999:03d}"
        
        # Generate security hash for tampering detection
        security_string = f"{student_data.get('firstName', '')}{student_data.get('lastName', '')}{student_data.get('rollNumber', '')}{fee_data.get('amount', 0)}{fee_data.get('feeType', '')}{timestamp.timestamp()}NAVADAYA_SECURITY_2025"
        security_hash = hash(security_string) & 0x7FFFFFFF
        security_code = f"{security_hash:012X}"[:12]
        
        header_info = [
            [f"Receipt No: {receipt_number}", f"Date: {receipt_date}"],
        ]
        
        header_table = Table(header_info, colWidths=[3*inch, 3*inch])
        header_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (0, 0), 'LEFT'),
            ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 11),
        ]))
        
        story.append(header_table)
        story.append(Spacer(1, 20))
        story.append(HRFlowable(width="100%", thickness=1, lineCap='round', color=colors.grey))
        story.append(Spacer(1, 20))
        
        # Student Information
        story.append(Paragraph("STUDENT INFORMATION", header_style))
        
        # Get room number from either room_data or student_data
        room_number = 'Not Assigned'
        if room_data.get('roomNumber'):
            room_number = f"Room {room_data.get('roomNumber')}"
        elif student_data.get('assignedRoom'):
            room_number = f"Room {student_data.get('assignedRoom')}"
        
        student_info = [
            ['Name:', f"{student_data.get('firstName', '')} {student_data.get('lastName', '')}"],
            ['Roll Number:', student_data.get('rollNumber', 'N/A')],
            ['Room Number:', room_number],
            ['Contact:', student_data.get('phone', 'N/A')],
        ]
        
        student_table = Table(student_info, colWidths=[1.5*inch, 4*inch])
        student_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        
        story.append(student_table)
        story.append(Spacer(1, 20))
        
        # Fee Details
        story.append(Paragraph("FEE DETAILS", header_style))
        
        # Fee type mapping
        fee_type_map = {
            'monthly_rent': 'Monthly Rent',
            'security_deposit': 'Security Deposit',
            'maintenance': 'Maintenance',
            'electricity': 'Electricity',
            'other': 'Other'
        }
        
        fee_type = fee_type_map.get(fee_data.get('feeType', ''), fee_data.get('feeType', 'N/A'))
        fee_period = f"{fee_data.get('month', 'N/A')}/{fee_data.get('year', 'N/A')}"
        fee_amount = fee_data.get('amount', 0)
        
        # Format payment date properly
        payment_date = 'N/A'
        if fee_data.get('paymentDate'):
            try:
                # Handle different date formats
                raw_date = fee_data.get('paymentDate')
                if isinstance(raw_date, str) and len(raw_date) >= 10:
                    payment_date = raw_date[:10]  # Take first 10 characters (YYYY-MM-DD)
                else:
                    payment_date = str(raw_date)
            except:
                payment_date = 'N/A'
        
        # Format payment method properly
        payment_method = 'N/A'
        if fee_data.get('paymentMethod'):
            raw_method = fee_data.get('paymentMethod')
            if raw_method:
                payment_method = str(raw_method).replace('_', ' ').title()
        
        fee_details = [
            ['Fee Type:', fee_type],
            ['Period:', fee_period],
            ['Amount:', f"₹{fee_amount:,.2f}"],
            ['Payment Date:', payment_date],
            ['Payment Method:', payment_method],
            ['Status:', 'PAID']
        ]
        
        fee_table = Table(fee_details, colWidths=[1.5*inch, 4*inch])
        fee_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('BACKGROUND', (0, 5), (-1, 5), colors.lightgreen),
            ('FONTNAME', (0, 5), (-1, 5), 'Helvetica-Bold'),
        ]))
        
        story.append(fee_table)
        story.append(Spacer(1, 30))
        
        # Amount summary box
        amount_box = [
            ['Total Amount Paid:', f"₹{fee_amount:,.2f}"]
        ]
        
        amount_table = Table(amount_box, colWidths=[4*inch, 2*inch])
        amount_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.lightblue),
            ('ALIGN', (0, 0), (0, 0), 'LEFT'),
            ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 14),
            ('GRID', (0, 0), (-1, -1), 2, colors.darkblue),
            ('TOPPADDING', (0, 0), (-1, -1), 12),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ]))
        
        story.append(amount_table)
        story.append(Spacer(1, 40))
        
        # Notes section
        if fee_data.get('notes'):
            story.append(Paragraph("ADDITIONAL NOTES", header_style))
            story.append(Paragraph(fee_data.get('notes', ''), normal_style))
            story.append(Spacer(1, 20))
        
        # Security Information Section
        story.append(Paragraph("SECURITY VERIFICATION", header_style))
        
        security_info = [
            ['Verification Code:', verification_code],
            ['Security Hash:', security_code],
            ['Digital Timestamp:', timestamp.strftime("%Y%m%d%H%M%S")],
            ['Hostel Auth Code:', 'NAVADAYA-2025']
        ]
        
        security_table = Table(security_info, colWidths=[2*inch, 4*inch])
        security_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (1, 0), (-1, -1), 'Courier'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('BACKGROUND', (0, 0), (-1, -1), colors.lightyellow),
            ('GRID', (0, 0), (-1, -1), 1, colors.orange),
        ]))
        
        story.append(security_table)
        story.append(Spacer(1, 20))
        
        # Generate and add QR Code
        try:
            receipt_data_for_hash = {
                'student_name': f"{student_data.get('firstName', '')} {student_data.get('lastName', '')}",
                'roll_number': student_data.get('rollNumber', ''),
                'amount': fee_amount,
                'fee_type': fee_type,
                'timestamp': timestamp.timestamp()
            }
            
            security_hash = generate_security_hash(receipt_data_for_hash)
            qr_data = generate_qr_code_data(receipt_number, verification_code, security_hash, 
                                          student_data.get('rollNumber', ''), fee_amount)
            qr_temp_file = create_qr_code_image(qr_data)
            
            # QR Code section
            story.append(Paragraph("QR CODE VERIFICATION", header_style))
            
            # Create QR code table with image and description
            qr_description = """
            Scan this QR code with any smartphone to verify this receipt's authenticity.
            The QR code contains encrypted verification data including receipt number,
            security hash, and payment details.
            """
            
            qr_info_table = Table([
                [Image(qr_temp_file, width=80, height=80), 
                 Paragraph(qr_description, ParagraphStyle('QRDesc', parent=styles['Normal'], fontSize=9, spaceAfter=6))]
            ], colWidths=[1.5*inch, 4*inch])
            
            qr_info_table.setStyle(TableStyle([
                ('ALIGN', (0, 0), (0, 0), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('LEFTPADDING', (1, 0), (1, 0), 15),
                ('BACKGROUND', (0, 0), (-1, -1), colors.lightgrey),
                ('GRID', (0, 0), (-1, -1), 1, colors.darkgrey),
            ]))
            
            story.append(qr_info_table)
            story.append(Spacer(1, 20))
            
            # Clean up temporary file
            if os.path.exists(qr_temp_file):
                os.unlink(qr_temp_file)
                
        except Exception as qr_error:
            # If QR code generation fails, continue without it
            story.append(Paragraph("QR Code generation temporarily unavailable", 
                                 ParagraphStyle('QRError', parent=styles['Normal'], fontSize=9, alignment=TA_CENTER, textColor=colors.grey)))
            story.append(Spacer(1, 10))
        
        story.append(HRFlowable(width="100%", thickness=1, lineCap='round', color=colors.grey))
        story.append(Spacer(1, 20))
        
        # Enhanced Security Warning
        security_warning = """
        🔒 SECURITY FEATURES: This receipt contains multiple security verification codes to prevent forgery and unauthorized duplication. 
        Any attempt to modify, copy, or duplicate this receipt is strictly prohibited and may result in disciplinary action.
        
        ⚠️ VERIFICATION: Use the verification code and security hash above to verify authenticity at the hostel office.
        """
        story.append(Paragraph(security_warning, ParagraphStyle('SecurityWarning', parent=styles['Normal'], fontSize=9, alignment=TA_CENTER, textColor=colors.red, spaceAfter=15)))
        
        # Footer
        footer_text = "This is a computer-generated receipt with enhanced security features. Please keep this receipt for your records."
        story.append(Paragraph(footer_text, ParagraphStyle('Footer', parent=styles['Normal'], fontSize=9, alignment=TA_CENTER, textColor=colors.grey, spaceAfter=10)))
        
        generated_text = f"Generated automatically by Navadaya Girls Hostel Management System on {receipt_date}"
        story.append(Paragraph(generated_text, ParagraphStyle('Generated', parent=styles['Normal'], fontSize=8, alignment=TA_CENTER, textColor=colors.grey)))
        
        # Build PDF
        doc.build(story)
        buffer.seek(0)
        
        # Generate filename
        student_name = f"{student_data.get('firstName', '')}-{student_data.get('lastName', '')}"
        filename = f"Fee-Receipt-{student_name}-{receipt_number}.pdf"
        
        return Response(
            buffer.getvalue(),
            mimetype='application/pdf',
            headers={
                'Content-Disposition': f'attachment; filename="{filename}"',
                'Content-Type': 'application/pdf'
            }
        )
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/health')
def health_check():
    """Health check endpoint for deployment monitoring"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'service': 'Navadaya Girls Hostel Management System',
        'version': '2.1.0'
    })

@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory('.', filename)

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5000, debug=True)