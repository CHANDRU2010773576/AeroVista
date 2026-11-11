import os
import sys
import unittest
from datetime import datetime, timezone, timedelta
from decimal import Decimal

# Ensure project root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, db
from models import User, Admin, Flight, Seat, Booking, Passenger, Payment

class TestPhase10AdminAndCancellation(unittest.TestCase):

    def setUp(self):
        app.config['TESTING'] = True
        self.client = app.test_client()

        with app.app_context():
            db.create_all()
            db.session.query(Payment).delete()
            db.session.query(Passenger).delete()
            db.session.query(Seat).delete()
            db.session.query(Booking).delete()
            db.session.query(Flight).delete()
            db.session.query(User).delete()
            db.session.query(Admin).delete()
            db.session.commit()

            # 1. Create active Admin
            self.admin = Admin(username='chief_controller', account_status='Active')
            self.admin.set_password('AdminPass123!')
            db.session.add(self.admin)

            # 2. Create two Users
            self.user1 = User(
                full_name='Alexander Wright',
                email='alexander@aerovista.test',
                mobile_number='+971501234567',
                account_status='Active'
            )
            self.user1.set_password('PassengerPass123!')

            self.user2 = User(
                full_name='Eleanor Vance',
                email='eleanor@aerovista.test',
                mobile_number='+447700900123',
                account_status='Active'
            )
            self.user2.set_password('PassengerPass123!')
            db.session.add_all([self.user1, self.user2])
            db.session.commit()

            # 3. Create Flight
            self.flight = Flight(
                flight_number='AV-801',
                airline='AeroVista Airlines',
                source='Dubai (DXB)',
                destination='Mumbai (BOM)',
                departure_time=datetime.now(timezone.utc) + timedelta(days=3),
                arrival_time=datetime.now(timezone.utc) + timedelta(days=3, hours=4),
                duration='4h 00m',
                total_seat_capacity=60,
                available_seats=58,
                ticket_fare=Decimal('5000.00'),
                flight_status='Active',
                aircraft='Boeing 787-9'
            )
            db.session.add(self.flight)
            db.session.commit()

            # 4. Create Seats
            self.seat1 = Seat(flight_id=self.flight.id, seat_number='10A', cabin_class='Economy', seat_status='Occupied')
            self.seat2 = Seat(flight_id=self.flight.id, seat_number='10B', cabin_class='Economy', seat_status='Held')
            db.session.add_all([self.seat1, self.seat2])
            db.session.commit()

            # 5. Create Confirmed Booking for User 1
            self.booking1 = Booking(
                pnr='AV-CONF01',
                user_id=self.user1.id,
                flight_id=self.flight.id,
                booking_date=datetime.now(timezone.utc),
                total_amount=Decimal('5000.00'),
                booking_status='Confirmed',
                payment_status='Paid'
            )
            db.session.add(self.booking1)
            db.session.commit()

            self.p1 = Passenger(
                booking_id=self.booking1.id,
                full_name='Alexander Wright',
                date_of_birth=datetime(1990, 5, 15).date(),
                gender='Male',
                nationality='Emirati',
                identification_type='Passport',
                identification_number='A12345678',
                contact_email='alexander@aerovista.test',
                contact_phone='+971501234567'
            )
            db.session.add(self.p1)
            self.seat1.booking_id = self.booking1.id
            self.seat1.passenger_id = self.p1.id

            self.pay1 = Payment(
                booking_id=self.booking1.id,
                payment_method='Credit Card',
                amount=Decimal('5000.00'),
                transaction_reference='TXN-ORIGINAL-001',
                payment_status='Successful',
                payment_date=datetime.now(timezone.utc)
            )
            db.session.add(self.pay1)

            # 6. Create Pending Booking for User 2
            self.booking2 = Booking(
                pnr='AV-PEND02',
                user_id=self.user2.id,
                flight_id=self.flight.id,
                booking_date=datetime.now(timezone.utc),
                total_amount=Decimal('5000.00'),
                booking_status='Pending',
                payment_status='Pending'
            )
            db.session.add(self.booking2)
            db.session.commit()

            self.p2 = Passenger(
                booking_id=self.booking2.id,
                full_name='Eleanor Vance',
                date_of_birth=datetime(1985, 8, 22).date(),
                gender='Female',
                nationality='British',
                identification_type='Passport',
                identification_number='P89214729',
                contact_email='eleanor@aerovista.test',
                contact_phone='+447700900123'
            )
            db.session.add(self.p2)
            self.seat2.booking_id = self.booking2.id
            self.seat2.passenger_id = self.p2.id
            db.session.commit()

            self.admin_id = self.admin.id
            self.user1_id = self.user1.id
            self.user2_id = self.user2.id
            self.flight_id = self.flight.id
            self.booking1_id = self.booking1.id
            self.booking2_id = self.booking2.id

    def tearDown(self):
        with app.app_context():
            db.session.remove()
            db.drop_all()

    # =========================================================================
    # 1. Admin Booking Management Tests
    # =========================================================================
    def test_01_admin_bookings_auth_and_listing(self):
        """Verify admin bookings API requires admin session, returns correct metrics and filtered lists."""
        # Unauthenticated request -> 401
        res401 = self.client.get('/api/admin/bookings')
        self.assertEqual(res401.status_code, 401)

        # Authenticate as Admin
        with self.client.session_transaction() as sess:
            sess['admin_id'] = self.admin_id

        # Authenticated request -> 200
        res = self.client.get('/api/admin/bookings')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data['status'], 'success')
        self.assertEqual(data['metrics']['total'], 2)
        self.assertEqual(data['metrics']['confirmed'], 1)
        self.assertEqual(data['metrics']['pending'], 1)
        self.assertEqual(data['metrics']['cancelled'], 0)

        # Search by PNR
        search_res = self.client.get('/api/admin/bookings?search=CONF01')
        self.assertEqual(search_res.status_code, 200)
        self.assertEqual(search_res.get_json()['count'], 1)
        self.assertEqual(search_res.get_json()['bookings'][0]['pnr'], 'AV-CONF01')

        # Filter by booking status
        filter_res = self.client.get('/api/admin/bookings?booking_status=Confirmed')
        self.assertEqual(filter_res.status_code, 200)
        self.assertEqual(filter_res.get_json()['count'], 1)

    def test_02_admin_booking_detail_and_cannot_confirm_unpaid(self):
        """Ensure unpaid or failed-payment bookings cannot be marked as confirmed."""
        with self.client.session_transaction() as sess:
            sess['admin_id'] = self.admin_id

        # Attempt to mark pending/unpaid booking as Confirmed -> rejected with 400
        update_res = self.client.put(f'/api/admin/bookings/{self.booking2_id}/status', json={
            "booking_status": "Confirmed"
        })
        self.assertEqual(update_res.status_code, 400)
        self.assertIn('Unpaid or failed-payment bookings cannot be marked as confirmed', update_res.get_json()['message'])

        # Get details for booking1
        detail_res = self.client.get('/api/admin/bookings/AV-CONF01')
        self.assertEqual(detail_res.status_code, 200)
        b_info = detail_res.get_json()['booking']
        self.assertEqual(b_info['pnr'], 'AV-CONF01')
        self.assertEqual(len(b_info['passengers']), 1)
        self.assertEqual(b_info['seats'], ['10A'])

    # =========================================================================
    # 2. Admin Passenger Management Tests
    # =========================================================================
    def test_03_admin_passenger_management_and_deactivation(self):
        """Verify admin can list passengers, view details, and deactivate accounts blocking login/booking."""
        # Unauthenticated request -> 401
        res401 = self.client.get('/api/admin/passengers')
        self.assertEqual(res401.status_code, 401)

        with self.client.session_transaction() as sess:
            sess['admin_id'] = self.admin_id

        # List passengers
        res = self.client.get('/api/admin/passengers')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data['status'], 'success')
        self.assertEqual(data['metrics']['total'], 2)
        self.assertEqual(data['metrics']['active'], 2)

        # Deactivate user 1
        toggle_res = self.client.post(f'/api/admin/passengers/{self.user1_id}/toggle-status')
        self.assertEqual(toggle_res.status_code, 200)
        self.assertEqual(toggle_res.get_json()['account_status'], 'Inactive')

        # Deactivated user cannot log in
        login_res = self.client.post('/api/login', json={
            "email": "alexander@aerovista.test",
            "password": "PassengerPass123!"
        })
        self.assertEqual(login_res.status_code, 403)
        self.assertIn('inactive', login_res.get_json()['message'].lower())

        # Deactivated user cannot create new booking
        with self.client.session_transaction() as sess:
            sess['user_id'] = self.user1_id
            sess.pop('admin_id', None)

        book_res = self.client.post('/api/bookings', json={
            "flight_id": self.flight_id,
            "cabin": "economy",
            "passengers": [{
                "fullName": "Alexander Wright",
                "dob": "1990-05-15",
                "gender": "Male",
                "nationality": "Emirati",
                "identificationType": "Passport",
                "identificationNumber": "A12345678",
                "contactEmail": "alexander@aerovista.test",
                "contactPhone": "+971501234567"
            }]
        })
        self.assertEqual(book_res.status_code, 403)
        self.assertTrue('inactive' in book_res.get_json()['message'].lower() or 'deactivated' in book_res.get_json()['message'].lower())

        # Admin passenger detail view preserves historical bookings
        with self.client.session_transaction() as sess:
            sess['admin_id'] = self.admin_id

        pax_detail_res = self.client.get(f'/api/admin/passengers/{self.user1_id}')
        self.assertEqual(pax_detail_res.status_code, 200)
        pax_data = pax_detail_res.get_json()['passenger']
        self.assertEqual(pax_data['accountStatus'], 'Inactive')
        self.assertEqual(len(pax_data['bookings']), 1)
        self.assertEqual(pax_data['bookings'][0]['pnr'], 'AV-CONF01')

    # =========================================================================
    # 3. Passenger Booking Cancellation Tests
    # =========================================================================
    def test_04_passenger_cancellation_flow(self):
        """Verify passenger cancellation releases seats, restores capacity, records simulated refund, and prevents duplicates."""
        # 1. User 2 cannot cancel User 1's booking -> 403 Forbidden
        with self.client.session_transaction() as sess:
            sess['user_id'] = self.user2_id

        unauth_cancel = self.client.post('/api/bookings/AV-CONF01/cancel')
        self.assertEqual(unauth_cancel.status_code, 403)

        # 2. User 1 cancels own confirmed booking -> 200 Success
        with self.client.session_transaction() as sess:
            sess['user_id'] = self.user1_id

        cancel_res = self.client.post('/api/bookings/AV-CONF01/cancel')
        self.assertEqual(cancel_res.status_code, 200)
        cancel_data = cancel_res.get_json()
        self.assertEqual(cancel_data['booking_status'], 'Cancelled')
        self.assertEqual(cancel_data['payment_status'], 'Refunded')
        self.assertEqual(cancel_data['seats_released_count'], 1)
        self.assertTrue(cancel_data['refund_details']['is_simulated'])

        # Verify DB states
        with app.app_context():
            b = Booking.query.filter_by(pnr='AV-CONF01').first()
            self.assertEqual(b.booking_status, 'Cancelled')
            self.assertEqual(b.payment_status, 'Refunded')

            s = Seat.query.filter_by(seat_number='10A').first()
            self.assertEqual(s.seat_status, 'Available')
            self.assertIsNone(s.booking_id)

            f = db.session.get(Flight, self.flight_id)
            self.assertEqual(f.available_seats, 59) # restored from 58 to 59

            # Simulated refund payment record created
            refund_pay = Payment.query.filter_by(booking_id=b.id, payment_status='Refunded').first()
            self.assertIsNotNone(refund_pay)
            self.assertTrue(refund_pay.transaction_reference.startswith('TXN-REFUND-'))

        # 3. Duplicate cancellation prevented -> 400
        dup_cancel = self.client.post('/api/bookings/AV-CONF01/cancel')
        self.assertEqual(dup_cancel.status_code, 400)
        self.assertIn('already cancelled', dup_cancel.get_json()['message'])

    def test_05_passenger_view_my_bookings_history(self):
        """Verify logged-in passengers can view their booking history."""
        with self.client.session_transaction() as sess:
            sess['user_id'] = self.user2_id

        res = self.client.get('/api/passenger/bookings')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data['count'], 1)
        self.assertEqual(data['bookings'][0]['pnr'], 'AV-PEND02')

if __name__ == '__main__':
    unittest.main()
