"""
AeroVista Airlines – E-Ticket PDF Generator
Generates high-resolution, luxury branded A4 PDF e-tickets matching AeroVista's Obsidian and Champagne Gold aesthetic.
"""
import io
import random
from datetime import datetime
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle, FancyBboxPatch

def generate_eticket_pdf(outbound_booking, return_booking=None, payment_record=None):
    """
    Renders an official AeroVista electronic ticket PDF.
    Supports One-Way and Round-Trip itineraries.
    Returns bytes of the generated PDF.
    """
    # A4 dimensions in inches: 8.27 x 11.69
    fig = plt.figure(figsize=(8.27, 11.69), dpi=150)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_facecolor('#0B0B0B')
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 140)
    ax.axis('off')

    # Border & frame
    ax.add_patch(Rectangle((2, 2), 96, 136, facecolor='#121212', edgecolor='#C6A66B', linewidth=1.5))
    ax.add_patch(Rectangle((3.5, 3.5), 93, 133, facecolor='none', edgecolor='#C6A66B', alpha=0.35, linewidth=0.8))

    # =========================================================================
    # 1. Header Banner & Logo
    # =========================================================================
    ax.add_patch(Rectangle((2, 124), 96, 14, facecolor='#191919', edgecolor='#C6A66B', linewidth=1.2))
    
    # Gold wing emblem accent
    ax.text(6, 132.5, 'AEROVISTA', color='#E5C98E', fontsize=18, fontweight='bold', fontfamily='sans-serif', va='center')
    ax.text(37, 132.5, 'AIRLINES', color='#C6A66B', fontsize=10, fontweight='bold', va='center')
    ax.text(6, 127.5, 'PRECISION LUXURY COMMERCIAL AVIATION • ELECTRONIC PASSENGER TICKET', color='#A0A0A0', fontsize=7.5, va='center')

    # PNR Pill
    primary_pnr = outbound_booking.pnr
    pnr_text = f"PNR: {primary_pnr}"
    if return_booking:
        pnr_text += f" / {return_booking.pnr}"

    ax.text(92, 132.5, pnr_text, color='#E5C98E', fontsize=12, fontweight='bold', ha='right', va='center')
    status_text = 'STATUS: CONFIRMED / TICKETED' if outbound_booking.booking_status == 'Confirmed' else f'STATUS: {outbound_booking.booking_status.upper()}'
    status_color = '#38BD78' if outbound_booking.booking_status == 'Confirmed' else '#E5C98E'
    ax.text(92, 127.5, status_text, color=status_color, fontsize=8.5, fontweight='bold', ha='right', va='center')

    # Gold separator line
    ax.plot([4, 96], [123.5, 123.5], color='#C6A66B', linewidth=1.2)

    # Current Y position cursor
    y = 118.0

    # Helper to draw journey card
    def draw_flight_leg(flight, booking, label, start_y):
        # Section Header Pill
        ax.add_patch(FancyBboxPatch((5, start_y - 3), 90, 4, boxstyle="round,pad=0.2", facecolor='#1E1A14', edgecolor='#C6A66B', linewidth=0.8))
        ax.text(7, start_y - 1, label.upper(), color='#E5C98E', fontsize=9.5, fontweight='bold', va='center')
        ax.text(93, start_y - 1, f"FLIGHT: {flight.airline} • {flight.flight_number}", color='#F5F2EB', fontsize=9, fontweight='bold', ha='right', va='center')

        # Flight details box
        box_y = start_y - 20
        ax.add_patch(FancyBboxPatch((5, box_y), 90, 16, boxstyle="round,pad=0.3", facecolor='#161616', edgecolor='#444444', alpha=0.9, linewidth=0.8))

        # Origin
        dept_time = flight.departure_time.strftime('%H:%M') if flight.departure_time else '00:00'
        dept_date = flight.departure_time.strftime('%a, %d %b %Y') if flight.departure_time else ''
        ax.text(9, box_y + 11.5, dept_time, color='#E5C98E', fontsize=15, fontweight='bold')
        ax.text(9, box_y + 7.5, flight.source, color='#F5F2EB', fontsize=9.5, fontweight='bold')
        ax.text(9, box_y + 4, dept_date, color='#A0A0A0', fontsize=8)

        # Duration & Midline
        ax.text(50, box_y + 12, f"Duration: {flight.duration} (Direct)", color='#C6A66B', fontsize=8, ha='center')
        ax.plot([30, 70], [box_y + 9, box_y + 9], color='#C6A66B', linestyle='--', linewidth=1)
        ax.text(50, box_y + 9, '✈', color='#E5C98E', fontsize=10, ha='center', va='center')
        ax.text(50, box_y + 5, f"Aircraft: {flight.aircraft}", color='#888888', fontsize=7.5, ha='center')

        # Destination
        arr_time = flight.arrival_time.strftime('%H:%M') if flight.arrival_time else '00:00'
        arr_date = flight.arrival_time.strftime('%a, %d %b %Y') if flight.arrival_time else ''
        ax.text(91, box_y + 11.5, arr_time, color='#E5C98E', fontsize=15, fontweight='bold', ha='right')
        ax.text(91, box_y + 7.5, flight.destination, color='#F5F2EB', fontsize=9.5, fontweight='bold', ha='right')
        ax.text(91, box_y + 4, arr_date, color='#A0A0A0', fontsize=8, ha='right')

        return box_y - 3

    # Draw Outbound
    y = draw_flight_leg(outbound_booking.flight, outbound_booking, "1. Outbound Journey", y)

    # Draw Return if Round Trip
    if return_booking and return_booking.flight:
        y = draw_flight_leg(return_booking.flight, return_booking, "2. Return Journey", y)

    # =========================================================================
    # 2. Passenger Manifest & Seat Allocation Table
    # =========================================================================
    ax.add_patch(FancyBboxPatch((5, y - 3), 90, 4, boxstyle="round,pad=0.2", facecolor='#1E1A14', edgecolor='#C6A66B', linewidth=0.8))
    ax.text(7, y - 1, "PASSENGER MANIFEST & SEAT ALLOCATION", color='#E5C98E', fontsize=9.5, fontweight='bold', va='center')
    ax.text(93, y - 1, f"TOTAL TRAVELERS: {len(outbound_booking.passengers)}", color='#F5F2EB', fontsize=8.5, ha='right', va='center')

    y -= 4
    # Table header
    ax.add_patch(Rectangle((5, y - 4), 90, 4, facecolor='#202020', edgecolor='#333333', linewidth=0.5))
    ax.text(7, y - 2, "Passenger Name", color='#C6A66B', fontsize=8, fontweight='bold', va='center')
    ax.text(38, y - 2, "Document / ID", color='#C6A66B', fontsize=8, fontweight='bold', va='center')
    ax.text(56, y - 2, "Nationality", color='#C6A66B', fontsize=8, fontweight='bold', va='center')
    ax.text(72, y - 2, "Outbound Seat", color='#C6A66B', fontsize=8, fontweight='bold', va='center')
    ax.text(86, y - 2, "Return Seat" if return_booking else "Cabin Class", color='#C6A66B', fontsize=8, fontweight='bold', va='center')

    y -= 4
    # Table rows
    for idx, p in enumerate(outbound_booking.passengers):
        bg_col = '#181818' if idx % 2 == 0 else '#141414'
        ax.add_patch(Rectangle((5, y - 5), 90, 5, facecolor=bg_col, edgecolor='#282828', linewidth=0.5))

        out_seat_str = p.seat.seat_number if p.seat else 'Assigned'
        ret_seat_str = '-'
        if return_booking and idx < len(return_booking.passengers):
            ret_p = return_booking.passengers[idx]
            ret_seat_str = ret_p.seat.seat_number if ret_p.seat else 'Assigned'

        doc_str = f"{p.identification_type[:4]}: {p.identification_number}" if p.identification_number else "Verified"
        cabin_str = p.seat.cabin_class if (p.seat and p.seat.cabin_class) else "Economy"

        ax.text(7, y - 2.5, f"{idx + 1}. {p.full_name[:24]}", color='#F5F2EB', fontsize=8, fontweight='bold', va='center')
        ax.text(38, y - 2.5, doc_str[:16], color='#A0A0A0', fontsize=7.5, va='center')
        ax.text(56, y - 2.5, (p.nationality or 'Global')[:14], color='#A0A0A0', fontsize=7.5, va='center')
        ax.text(72, y - 2.5, f"Seat {out_seat_str}", color='#E5C98E', fontsize=8, fontweight='bold', va='center')
        ax.text(86, y - 2.5, f"Seat {ret_seat_str}" if return_booking else cabin_str, color='#E5C98E' if return_booking else '#F5F2EB', fontsize=8, va='center')

        y -= 5

    # =========================================================================
    # 3. Payment Verification & Financial Settlement Box
    # =========================================================================
    y -= 3
    ax.add_patch(FancyBboxPatch((5, y - 18), 90, 18, boxstyle="round,pad=0.3", facecolor='#161616', edgecolor='#C6A66B', linewidth=1.0))
    ax.text(7, y - 3, "PAYMENT VERIFICATION & SETTLEMENT RECEIPT", color='#E5C98E', fontsize=9.5, fontweight='bold')

    # Payment details left column
    method = payment_record.payment_method if payment_record else 'Credit Card (Simulated)'
    txn_ref = payment_record.transaction_reference if payment_record else 'TXN-AEROVISTA-VERIFIED'
    pay_date = payment_record.payment_date.strftime('%d %b %Y, %H:%M UTC') if (payment_record and payment_record.payment_date) else datetime.utcnow().strftime('%d %b %Y, %H:%M UTC')
    
    ax.text(7, y - 7, f"Payment Channel: {method}", color='#D0D0D0', fontsize=8)
    ax.text(7, y - 10, f"Transaction Ref: {txn_ref}", color='#D0D0D0', fontsize=8)
    ax.text(7, y - 13, f"Payment Timestamp: {pay_date}", color='#D0D0D0', fontsize=8)
    ax.text(7, y - 16, "✓ Payment Verified & Confirmed in AeroVista Ledger", color='#38BD78', fontsize=8.5, fontweight='bold')

    # Fares right column
    total_val = float(outbound_booking.total_amount)
    if return_booking:
        total_val += float(return_booking.total_amount)

    ax.text(91, y - 6, f"Outbound Fare: ₹{float(outbound_booking.total_amount):,.2f}", color='#A0A0A0', fontsize=8, ha='right')
    if return_booking:
        ax.text(91, y - 9.5, f"Return Fare: ₹{float(return_booking.total_amount):,.2f}", color='#A0A0A0', fontsize=8, ha='right')
    
    total_y = y - 14 if return_booking else y - 11
    ax.text(91, total_y, f"Total Amount Paid: ₹{total_val:,.2f} INR", color='#E5C98E', fontsize=11, fontweight='bold', ha='right')

    # =========================================================================
    # 4. Barcode Simulation & Legal Notice Footer
    # =========================================================================
    footer_y = 12
    # Simulated 2D barcode / barcode lines
    rng = random.Random(hash(primary_pnr))
    bar_x = 7
    while bar_x < 93:
        w = rng.choice([0.4, 0.7, 1.2])
        ax.add_patch(Rectangle((bar_x, footer_y), w, 4.5, facecolor='#E5C98E' if rng.random() > 0.3 else '#555555'))
        bar_x += w + rng.choice([0.3, 0.5])

    ax.text(50, footer_y - 2, f"* {primary_pnr} * AEROVISTA ELECTRONIC SECURITY BARCODE *", color='#888888', fontsize=6.5, ha='center')
    ax.text(50, footer_y - 5, "IMPORTANT: Please present this e-ticket along with official government photo identification at the check-in desk.", color='#A0A0A0', fontsize=7, ha='center')
    ax.text(50, footer_y - 7.5, "© 2026 AeroVista Airlines. All rights reserved. Precision luxury commercial aviation.", color='#666666', fontsize=6.5, ha='center')

    # Render to memory
    buf = io.BytesIO()
    fig.savefig(buf, format='pdf', facecolor='#0B0B0B', edgecolor='none')
    plt.close(fig)
    return buf.getvalue()
