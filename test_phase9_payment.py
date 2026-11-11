import os
import sys
import unittest
from datetime import datetime, timezone, timedelta
from decimal import Decimal

# Ensure project root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, db, cleanup_expired_reservations
from models import Flight, Seat, Booking, Passenger, Payment

class TestPhase9PaymentAndTicket(unittest.TestCase):

    def setUp(self):
        app.config['TESTING'] = True
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        self.client = app.test_client()

        with app.app_context():
            db.create_all()

            # Create test flight 1 (Outbound: DXB to BOM)
            self.flight1 = Flight(
                flight_number='AV-901',
                airline='AeroVista Airlines',
                source='Dubai (DXB)',
                destination='Mumbai (BOM)',
                departure_time=datetime.now(timezone.utc) + timedelta(days=2),
                arrival_time=datetime.now(timezone.utc) + timedelta(days=2, hours=4),
                duration='4h 00m',
                total_seat_capacity=60,
                available_seats=60,
                ticket_fare=Decimal('5000.00'),
                flight_status='Active',
                aircraft='Boeing 787-9'
            )
            # Create test flight 2 (Return: BOM to DXB)
            self.flight2 = Flight(
                flight_number='AV-902',
                airline='AeroVista Airlines',
                source='Mumbai (BOM)',
                destination='Dubai (DXB)',
                departure_time=datetime.now(timezone.utc) + timedelta(days=5),
                arrival_time=datetime.now(timezone.utc) + timedelta(days=5, hours=4),
                duration='4h 00m',
                total_seat_capacity=60,
                available_seats=60,
                ticket_fare=Decimal('5500.00'),
                flight_status='Active',
                aircraft='Boeing 787-9'
            )
            db.session.add(self.flight1)
            db.session.add(self.flight2)
            db.session.commit()

            # Create seats for flight1
            self.seat1A = Seat(flight_id=self.flight1.id, seat_number='1A', cabin_class='Business', seat_status='Available')
            self.seat10A = Seat(flight_id=self.flight1.id, seat_number='10A', cabin_class='Economy', seat_status='Available')
            db.session.add_all([self.seat1A, self.seat10A])

            # Create seats for flight2
            self.seat2A = Seat(flight_id=self.flight2.id, seat_number='2A', cabin_class='Business', seat_status='Available')
            self.seat11A = Seat(flight_id=self.flight2.id, seat_number='11A', cabin_class='Economy', seat_status='Available')
            db.session.add_all([self.seat2A, self.seat11A])
            db.session.commit()

            self.f1_id = self.flight1.id
            self.f2_id = self.flight2.id

    def tearDown(self):
        with app.app_context():
            db.session.remove()
            db.drop_all()

    def test_01_booking_creation_and_details_fetch(self):
        """Verify booking creation sets Pending status, reserves seats, and details API returns hold time."""
        with app.app_context():
            # Create a booking via API
            payload = {
                "flight_id": self.f1_id,
                "cabin_class": "Economy",
                "journey_date": (datetime.now(timezone.utc) + timedelta(days=2)).strftime('%Y-%m-%d'),
                "passengers": [
                    {
                        "full_name": "Eleanor Vance",
                        "date_of_birth": "1992-04-15",
                        "gender": "Female",
                        "nationality": "British",
                        "identification_type": "Passport",
                        "identification_number": "GB99887766",
                        "contact_email": "eleanor@example.com",
                        "contact_phone": "+447911123456",
                        "seat_number": "10A"
                    }
                ]
            }
            res = self.client.post('/api/bookings', json=payload)
            self.assertEqual(res.status_code, 201)
            data = res.get_json()
            self.assertTrue(data['pnr'].startswith('AV-'))
            pnr = data['pnr']

            # Check GET /api/bookings/<pnr>
            get_res = self.client.get(f'/api/bookings/{pnr}')
            self.assertEqual(get_res.status_code, 200)
            b_info = get_res.get_json()['booking']
            self.assertEqual(b_info['booking_status'], 'Pending')
            self.assertEqual(b_info['payment_status'], 'Pending')
            self.assertGreater(b_info['hold_remaining_seconds'], 0)
            self.assertEqual(b_info['total_amount'], 5500.0) # Base fare (5000) + Seat 10A Extra Legroom (500)
            self.assertEqual(b_info['passengers'][0]['seat_number'], '10A')

            # Verify seat is Held
            seat = Seat.query.filter_by(flight_id=self.f1_id, seat_number='10A').first()
            self.assertEqual(seat.seat_status, 'Held')

    def test_02_payment_decline_simulation_and_retry(self):
        """Verify payment decline simulation keeps booking Pending, allows retry without creating a duplicate booking."""
        with app.app_context():
            # Create booking
            booking = Booking(
                user_id=None,
                flight_id=self.f1_id,
                booking_date=datetime.now(timezone.utc),
                total_amount=Decimal('5000.00'),
                booking_status='Pending',
                payment_status='Pending',
                pnr='AV-TEST01'
            )
            db.session.add(booking)
            db.session.commit()

            seat = Seat.query.filter_by(flight_id=self.f1_id, seat_number='10A').first()
            seat.seat_status = 'Held'
            seat.booking_id = booking.id
            db.session.commit()

            # 1. Process Payment with Simulation Outcome: 'failure'
            pay_payload = {
                "pnr": "AV-TEST01",
                "payment_method": "Credit Card",
                "simulation_outcome": "failure"
            }
            fail_res = self.client.post('/api/payments', json=pay_payload)
            self.assertEqual(fail_res.status_code, 400)
            fail_data = fail_res.get_json()
            self.assertEqual(fail_data['error_code'], 'AV_ERR_502')
            self.assertTrue(fail_data['can_retry'])

            # Booking must still be Pending
            refreshed = Booking.query.filter_by(pnr='AV-TEST01').first()
            self.assertEqual(refreshed.booking_status, 'Pending')
            self.assertEqual(refreshed.payment_status, 'Pending')

            # Check payment record recorded as Failed
            failed_payment = Payment.query.filter_by(booking_id=booking.id, payment_status='Failed').first()
            self.assertIsNotNone(failed_payment)
            self.assertTrue(failed_payment.transaction_reference.startswith('TXN-DECLINED-'))

            # 2. Retry Payment on the SAME booking with Simulation Outcome: 'success'
            retry_payload = {
                "pnr": "AV-TEST01",
                "payment_method": "Credit Card",
                "simulation_outcome": "success"
            }
            success_res = self.client.post('/api/payments', json=retry_payload)
            self.assertEqual(success_res.status_code, 200)
            success_data = success_res.get_json()
            self.assertEqual(success_data['status'], 'success')
            self.assertEqual(success_data['booking_status'], 'Confirmed')
            self.assertEqual(success_data['payment_status'], 'Successful')

            # Verify Booking and Seat status in DB
            db.session.refresh(booking)
            self.assertEqual(booking.booking_status, 'Confirmed')
            self.assertEqual(booking.payment_status, 'Paid')

            db.session.refresh(seat)
            self.assertEqual(seat.seat_status, 'Occupied')

    def test_03_duplicate_payment_prevention(self):
        """Verify that attempting to pay for an already confirmed booking is rejected."""
        with app.app_context():
            booking = Booking(
                flight_id=self.f1_id,
                booking_date=datetime.now(timezone.utc),
                total_amount=Decimal('5000.00'),
                booking_status='Confirmed',
                payment_status='Paid',
                pnr='AV-PAID01'
            )
            db.session.add(booking)
            db.session.commit()

            pay_payload = {
                "pnr": "AV-PAID01",
                "payment_method": "Credit Card",
                "simulation_outcome": "success"
            }
            res = self.client.post('/api/payments', json=pay_payload)
            self.assertEqual(res.status_code, 400)
            self.assertIn('already been paid and confirmed', res.get_json()['message'])

    def test_04_round_trip_simultaneous_payment(self):
        """Verify round trip outbound and return bookings are paid and confirmed together."""
        with app.app_context():
            out_b = Booking(
                flight_id=self.f1_id,
                booking_date=datetime.now(timezone.utc),
                total_amount=Decimal('5000.00'),
                booking_status='Pending',
                payment_status='Pending',
                pnr='AV-OUT01'
            )
            ret_b = Booking(
                flight_id=self.f2_id,
                booking_date=datetime.now(timezone.utc),
                total_amount=Decimal('5500.00'),
                booking_status='Pending',
                payment_status='Pending',
                pnr='AV-RET01'
            )
            db.session.add_all([out_b, ret_b])
            db.session.commit()

            s1 = Seat.query.filter_by(flight_id=self.f1_id, seat_number='10A').first()
            s2 = Seat.query.filter_by(flight_id=self.f2_id, seat_number='11A').first()
            s1.seat_status = 'Held'
            s1.booking_id = out_b.id
            s2.seat_status = 'Held'
            s2.booking_id = ret_b.id
            db.session.commit()

            # Pay both together
            pay_payload = {
                "pnrs": ["AV-OUT01", "AV-RET01"],
                "payment_method": "UPI",
                "simulation_outcome": "success"
            }
            res = self.client.post('/api/payments', json=pay_payload)
            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            self.assertEqual(data['amount_paid'], 10500.0) # 5000 + 5500
            self.assertEqual(len(data['pnrs']), 2)

            db.session.refresh(out_b)
            db.session.refresh(ret_b)
            self.assertEqual(out_b.booking_status, 'Confirmed')
            self.assertEqual(ret_b.booking_status, 'Confirmed')
            self.assertEqual(out_b.payment_status, 'Paid')
            self.assertEqual(ret_b.payment_status, 'Paid')

            db.session.refresh(s1)
            db.session.refresh(s2)
            self.assertEqual(s1.seat_status, 'Occupied')
            self.assertEqual(s2.seat_status, 'Occupied')

    def test_05_temporary_seat_hold_expiration(self):
        """Verify that expired seat holds (older than 15 mins) are cleaned up and rejected on pay."""
        with app.app_context():
            old_time = datetime.now(timezone.utc) - timedelta(minutes=16)
            old_booking = Booking(
                flight_id=self.f1_id,
                booking_date=old_time,
                total_amount=Decimal('5000.00'),
                booking_status='Pending',
                payment_status='Pending',
                pnr='AV-EXPIRED'
            )
            db.session.add(old_booking)
            db.session.commit()

            seat = Seat.query.filter_by(flight_id=self.f1_id, seat_number='10A').first()
            seat.seat_status = 'Held'
            seat.booking_id = old_booking.id
            db.session.commit()

            # Attempt to pay for expired booking
            res = self.client.post('/api/payments', json={"pnr": "AV-EXPIRED", "simulation_outcome": "success"})
            self.assertEqual(res.status_code, 400)
            self.assertIn('expired', res.get_json()['message'])

            # Verify booking status became Cancelled and seat was released
            db.session.refresh(old_booking)
            self.assertEqual(old_booking.booking_status, 'Cancelled')

            db.session.refresh(seat)
            self.assertEqual(seat.seat_status, 'Available')
            self.assertIsNone(seat.booking_id)

    def test_06_eticket_pdf_download_security_and_generation(self):
        """Verify e-ticket generation: 403 on unconfirmed booking, valid PDF for confirmed booking."""
        with app.app_context():
            # 1. Unconfirmed booking -> 403 Forbidden
            pending_b = Booking(
                flight_id=self.f1_id,
                booking_date=datetime.now(timezone.utc),
                total_amount=Decimal('5000.00'),
                booking_status='Pending',
                payment_status='Pending',
                pnr='AV-PEND01'
            )
            db.session.add(pending_b)
            db.session.commit()

            res403 = self.client.get('/api/bookings/AV-PEND01/ticket')
            self.assertEqual(res403.status_code, 403)

            # 2. Confirmed booking -> 200 PDF
            confirmed_b = Booking(
                flight_id=self.f1_id,
                booking_date=datetime.now(timezone.utc),
                total_amount=Decimal('5000.00'),
                booking_status='Confirmed',
                payment_status='Paid',
                pnr='AV-CONF01'
            )
            db.session.add(confirmed_b)
            db.session.commit()

            p = Passenger(
                booking_id=confirmed_b.id,
                full_name="Alexander Wright",
                date_of_birth=datetime(1988, 5, 12).date(),
                gender="Male",
                nationality="Emirati",
                identification_type="Passport",
                identification_number="AE77665544",
                contact_email="alexander@aerovista.test",
                contact_phone="+971501234567"
            )
            db.session.add(p)
            db.session.commit()

            seat = Seat.query.filter_by(flight_id=self.f1_id, seat_number='10A').first()
            seat.seat_status = 'Occupied'
            seat.booking_id = confirmed_b.id
            seat.passenger_id = p.id
            db.session.commit()

            payment = Payment(
                booking_id=confirmed_b.id,
                payment_method="Credit Card",
                amount=Decimal('5000.00'),
                transaction_reference="TXN-TEST-12345",
                payment_status="Successful",
                payment_date=datetime.now(timezone.utc)
            )
            db.session.add(payment)
            db.session.commit()

            ticket_res = self.client.get('/api/bookings/AV-CONF01/ticket')
            self.assertEqual(ticket_res.status_code, 200)
            self.assertEqual(ticket_res.mimetype, 'application/pdf')
            # Verify PDF magic header bytes
            pdf_data = ticket_res.data
            self.assertTrue(pdf_data.startswith(b'%PDF-'))
            self.assertGreater(len(pdf_data), 10000)

if __name__ == '__main__':
    unittest.main()
