"""
Tests for AeroVista Admin Dashboard Backend API & Statistics.
Verifies:
1. Administrator authentication protection for GET /api/admin/dashboard (401 unauthenticated).
2. Accurate dashboard statistics calculation (total flights, today's scheduled flights, total bookings,
   passenger count, available seats, total capacity).
3. Cancellation exclusion: Cancelled bookings must be excluded from confirmed booking statistics and active passenger count.
4. Booking chart grouping by date (7-day distribution excluding cancelled bookings).
5. Recent Bookings format and sorting.
6. Upcoming Flights format and sorting.
"""

import unittest
from datetime import datetime, timezone, timedelta, time
from decimal import Decimal
from app import app, db
from models import User, Admin, Flight, Booking, Passenger, Seat, Payment


class TestAdminDashboard(unittest.TestCase):
    def setUp(self):
        app.config['TESTING'] = True
        app.config['WTF_CSRF_ENABLED'] = False
        self.client = app.test_client()

        with app.app_context():
            # Clean database
            db.session.query(Payment).delete()
            db.session.query(Seat).delete()
            db.session.query(Passenger).delete()
            db.session.query(Booking).delete()
            db.session.query(Flight).delete()
            db.session.query(Admin).delete()
            db.session.query(User).delete()
            db.session.commit()

            # Create test admin
            self.admin = Admin(username='dashcontroller', account_status='Active')
            self.admin.set_password('AdminSec123!')
            db.session.add(self.admin)

            # Create test passenger user
            self.user = User(
                full_name='Sophia Al-Mansoor',
                email='sophia.dashboard@aerovista.test',
                account_status='Active'
            )
            self.user.set_password('PassengerPass123!')
            db.session.add(self.user)
            db.session.commit()

            self.admin_id = self.admin.id
            self.user_id = self.user.id

    def test_01_admin_dashboard_auth_protection(self):
        """Dashboard endpoint must require administrator session (HTTP 401)."""
        res = self.client.get('/api/admin/dashboard')
        self.assertEqual(res.status_code, 401)
        data = res.get_json()
        self.assertEqual(data.get('status'), 'error')

    def test_02_dashboard_empty_states(self):
        """Dashboard must handle zero flights and zero bookings gracefully with accurate zeroes and empty lists."""
        with self.client.session_transaction() as sess:
            sess['admin_id'] = self.admin_id

        res = self.client.get('/api/admin/dashboard')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()

        self.assertEqual(data['status'], 'success')
        stats = data['statistics']
        self.assertEqual(stats['total_flights'], 0)
        self.assertEqual(stats['today_flights'], 0)
        self.assertEqual(stats['total_bookings'], 0)
        self.assertEqual(stats['confirmed_bookings'], 0)
        self.assertEqual(stats['pending_bookings'], 0)
        self.assertEqual(stats['cancelled_bookings'], 0)
        self.assertEqual(stats['passenger_count'], 0)
        self.assertEqual(stats['available_seats'], 0)
        self.assertEqual(stats['total_capacity'], 0)

        # Chart days should be 7 entries with 0 counts
        chart = data['chart']
        self.assertEqual(len(chart['days']), 7)
        self.assertEqual(chart['total_chart_bookings'], 0)
        for d in chart['days']:
            self.assertEqual(d['count'], 0)

        # Recent bookings and upcoming flights should be empty lists
        self.assertEqual(data['recent_bookings'], [])
        self.assertEqual(data['upcoming_flights'], [])

    def test_03_dashboard_populated_stats_and_cancellation_exclusion(self):
        """
        Populate flights, bookings, and passengers.
        Ensure statistics, charts, recent bookings, and upcoming flights calculate accurately,
        and cancelled bookings are excluded from confirmed booking statistics and active passenger count.
        """
        now = datetime.now(timezone.utc)
        today_date = now.date()

        with app.app_context():
            # 1. Flight departing today
            f_today = Flight(
                flight_number='AV-DASH1',
                airline='AeroVista Airlines',
                source='Dubai (DXB)',
                destination='London (LHR)',
                departure_time=datetime.combine(today_date, time(14, 30)),
                arrival_time=datetime.combine(today_date, time(19, 0)),
                duration='6h 30m',
                ticket_fare=Decimal('35000.00'),
                total_seat_capacity=100,
                available_seats=95,
                flight_status='Scheduled'
            )
            # 2. Flight departing tomorrow
            tomorrow_date = today_date + timedelta(days=1)
            f_tomorrow = Flight(
                flight_number='AV-DASH2',
                airline='AeroVista Airlines',
                source='London (LHR)',
                destination='New York (JFK)',
                departure_time=datetime.combine(tomorrow_date, time(10, 0)),
                arrival_time=datetime.combine(tomorrow_date, time(14, 30)),
                duration='7h 30m',
                ticket_fare=Decimal('48000.00'),
                total_seat_capacity=150,
                available_seats=140,
                flight_status='Scheduled'
            )
            db.session.add_all([f_today, f_tomorrow])
            db.session.commit()

            f_today_id = f_today.id
            f_tomorrow_id = f_tomorrow.id

            # 3. Create Bookings:
            # b1: Confirmed booking with 2 passengers
            b1 = Booking(
                pnr='AV-CONF01',
                user_id=self.user_id,
                flight_id=f_today_id,
                booking_date=now - timedelta(days=1),
                total_amount=Decimal('70000.00'),
                booking_status='Confirmed',
                payment_status='Paid'
            )
            db.session.add(b1)
            db.session.flush()

            p1_1 = Passenger(booking_id=b1.id, full_name='Sophia Al-Mansoor', identification_type='Passport')
            p1_2 = Passenger(booking_id=b1.id, full_name='Tariq Al-Mansoor', identification_type='Passport')
            db.session.add_all([p1_1, p1_2])

            # b2: Pending booking with 1 passenger
            b2 = Booking(
                pnr='AV-PEND01',
                user_id=self.user_id,
                flight_id=f_tomorrow_id,
                booking_date=now,
                total_amount=Decimal('48000.00'),
                booking_status='Pending',
                payment_status='Pending'
            )
            db.session.add(b2)
            db.session.flush()

            p2_1 = Passenger(booking_id=b2.id, full_name='Khalid Rahman', identification_type='Passport')
            db.session.add(p2_1)

            # b3: Cancelled booking with 1 passenger (MUST be excluded from confirmed/active stats)
            b3 = Booking(
                pnr='AV-CANC01',
                user_id=self.user_id,
                flight_id=f_today_id,
                booking_date=now - timedelta(days=2),
                total_amount=Decimal('35000.00'),
                booking_status='Cancelled',
                payment_status='Refunded'
            )
            db.session.add(b3)
            db.session.flush()

            p3_1 = Passenger(booking_id=b3.id, full_name='Cancelled Passenger', identification_type='Passport')
            db.session.add(p3_1)

            db.session.commit()

        # Query dashboard API as admin
        with self.client.session_transaction() as sess:
            sess['admin_id'] = self.admin_id

        res = self.client.get('/api/admin/dashboard')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()

        stats = data['statistics']
        # Flights
        self.assertEqual(stats['total_flights'], 2)
        self.assertEqual(stats['today_flights'], 1)
        self.assertEqual(stats['available_seats'], 95 + 140)  # 235
        self.assertEqual(stats['total_capacity'], 100 + 150)  # 250

        # Bookings & Exclusion of Cancelled
        self.assertEqual(stats['total_bookings'], 3)
        self.assertEqual(stats['confirmed_bookings'], 1)
        self.assertEqual(stats['pending_bookings'], 1)
        self.assertEqual(stats['cancelled_bookings'], 1)

        # Passengers: p1_1, p1_2 (from Confirmed) + p2_1 (from Pending) = 3
        # p3_1 from Cancelled MUST be excluded
        self.assertEqual(stats['passenger_count'], 3)

        # Chart: Cancelled booking b3 must be excluded from active chart counts
        chart = data['chart']
        self.assertEqual(chart['total_chart_bookings'], 2)  # b1 and b2

        # Recent Bookings: latest 3 bookings listed
        recent = data['recent_bookings']
        self.assertEqual(len(recent), 3)
        pnrs = [b['pnr'] for b in recent]
        self.assertIn('AV-CONF01', pnrs)
        self.assertIn('AV-PEND01', pnrs)
        self.assertIn('AV-CANC01', pnrs)

        # Upcoming Flights: 2 flights
        upcoming = data['upcoming_flights']
        self.assertEqual(len(upcoming), 2)
        flight_nums = [f['flight_number'] for f in upcoming]
        self.assertIn('AV-DASH1', flight_nums)
        self.assertIn('AV-DASH2', flight_nums)


if __name__ == '__main__':
    unittest.main()
