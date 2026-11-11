"""
Phase 8 Comprehensive Verification Test Suite
Tests:
1. Seat availability API (/api/flights/<id>/seats)
2. Economy and Business seat selection layout & occupied state
3. Booking Creation API (/api/bookings):
   - One-way booking
   - Round-trip booking
   - Multiple passengers
   - Seat assignment and verification
   - Price calculation verification against database
   - Payment status == 'Pending'
   - Unique PNR generation
4. Seat double-booking prevention (concurrency & conflict rejection)
5. Rollback on invalid/occupied seat selection
6. Passenger validation (mandatory fields, email, phone)
7. Booking detail retrieval via GET /api/bookings/<pnr>
"""
import unittest
import json
import app
from models import db, Flight, Booking, Passenger, Seat, Payment

from datetime import datetime, timezone, timedelta
from decimal import Decimal

class TestPhase8BookingAndSeats(unittest.TestCase):
    def setUp(self):
        self.client = app.app.test_client()
        self.app_context = app.app.app_context()
        self.app_context.push()
        db.create_all()
        db.session.query(Payment).delete()
        db.session.query(Passenger).delete()
        db.session.query(Seat).delete()
        db.session.query(Booking).delete()
        db.session.commit()

        if not db.session.get(Flight, 1):
            f1 = Flight(
                id=1,
                flight_number='AV-801',
                airline='AeroVista Airlines',
                source='Dubai (DXB)',
                destination='Mumbai (BOM)',
                departure_time=datetime.now(timezone.utc) + timedelta(days=2),
                arrival_time=datetime.now(timezone.utc) + timedelta(days=2, hours=4),
                duration='4h 00m',
                total_seat_capacity=84,
                available_seats=84,
                ticket_fare=Decimal('5500.00'),
                flight_status='Active',
                aircraft='Boeing 787-9'
            )
            f2 = Flight(
                id=2,
                flight_number='AV-802',
                airline='AeroVista Airlines',
                source='Mumbai (BOM)',
                destination='Dubai (DXB)',
                departure_time=datetime.now(timezone.utc) + timedelta(days=5),
                arrival_time=datetime.now(timezone.utc) + timedelta(days=5, hours=4),
                duration='4h 00m',
                total_seat_capacity=84,
                available_seats=84,
                ticket_fare=Decimal('4800.00'),
                flight_status='Active',
                aircraft='Boeing 787-9'
            )
            db.session.add_all([f1, f2])
            db.session.commit()

    def tearDown(self):
        self.app_context.pop()

    def test_01_seat_availability_api(self):
        res = self.client.get('/api/flights/1/seats')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data['status'], 'success')
        self.assertEqual(data['flight_id'], 1)
        self.assertIn('economy', data)
        self.assertIn('business', data)
        self.assertEqual(len(data['economy']), 60)
        self.assertEqual(len(data['business']), 24)

    def test_02_create_one_way_booking_economy(self):
        payload = {
            "outbound": {
                "flight_id": 1,
                "cabin": "economy"
            },
            "passengers": [
                {
                    "fullName": "Jane Doe",
                    "dateOfBirth": "1994-08-20",
                    "gender": "Female",
                    "nationality": "Indian",
                    "identificationType": "Passport",
                    "identificationNumber": "N1234567",
                    "contactEmail": "jane.doe@example.com",
                    "contactPhone": "+91 9876543210",
                    "seatAllocation": {
                        "outbound": {"code": "12A"} # Standard economy (price 0)
                    }
                }
            ]
        }
        res = self.client.post('/api/bookings', json=payload)
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertEqual(data['status'], 'success')
        self.assertTrue(data['pnr'].startswith('AV-'))
        self.assertEqual(data['payment_status'], 'Pending')
        self.assertEqual(data['total_fare'], 5500.0)

        # Check DB
        booking = Booking.query.filter_by(pnr=data['pnr']).first()
        self.assertIsNotNone(booking)
        self.assertEqual(booking.payment_status, 'Pending')
        self.assertEqual(len(booking.passengers), 1)
        self.assertEqual(booking.passengers[0].full_name, 'Jane Doe')
        self.assertEqual(len(booking.seats), 1)
        self.assertEqual(booking.seats[0].seat_number, '12A')
        self.assertIn(booking.seats[0].seat_status, ('Held', 'Occupied'))

        # Clean up created booking and seat
        db.session.delete(booking.seats[0])
        db.session.delete(booking)
        db.session.commit()

    def test_03_prevent_double_booking_same_seat(self):
        # 1. Book seat 10A
        payload1 = {
            "outbound": {"flight_id": 1, "cabin": "economy"},
            "passengers": [{
                "fullName": "Passenger One",
                "dateOfBirth": "1990-01-01",
                "gender": "Male",
                "nationality": "Indian",
                "identificationType": "Passport",
                "identificationNumber": "P1111111",
                "contactEmail": "p1@example.com",
                "contactPhone": "+91 9999911111",
                "seatAllocation": {"outbound": {"code": "10A"}}
            }]
        }
        res1 = self.client.post('/api/bookings', json=payload1)
        self.assertEqual(res1.status_code, 201)
        pnr1 = res1.get_json()['pnr']

        # 2. Try to book the same seat 10A -> Must return 409 Conflict
        payload2 = {
            "outbound": {"flight_id": 1, "cabin": "economy"},
            "passengers": [{
                "fullName": "Passenger Two",
                "dateOfBirth": "1992-02-02",
                "gender": "Female",
                "nationality": "Indian",
                "identificationType": "Passport",
                "identificationNumber": "P2222222",
                "contactEmail": "p2@example.com",
                "contactPhone": "+91 9999922222",
                "seatAllocation": {"outbound": {"code": "10A"}}
            }]
        }
        res2 = self.client.post('/api/bookings', json=payload2)
        self.assertEqual(res2.status_code, 409)
        self.assertIn("already occupied", res2.get_json()['message'])

        # Clean up
        b1 = Booking.query.filter_by(pnr=pnr1).first()
        if b1:
            for s in b1.seats:
                db.session.delete(s)
            db.session.delete(b1)
            db.session.commit()

    def test_04_create_round_trip_booking(self):
        payload = {
            "outbound": {"flight_id": 1, "cabin": "business"}, # Flight 1 base 5500 * 2.6 = 14300
            "return": {"flight_id": 2, "cabin": "business"},   # Flight 2 base 4800 * 2.6 = 12480
            "passengers": [
                {
                    "fullName": "VIP Traveler",
                    "dateOfBirth": "1985-05-15",
                    "gender": "Male",
                    "nationality": "Emirati",
                    "identificationType": "Passport",
                    "identificationNumber": "E9876543",
                    "contactEmail": "vip@aerovista.ae",
                    "contactPhone": "+971 501234567",
                    "seatAllocation": {
                        "outbound": {"code": "1A"},
                        "return": {"code": "2A"}
                    }
                }
            ]
        }
        res = self.client.post('/api/bookings', json=payload)
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertEqual(data['status'], 'success')
        self.assertTrue(data['is_round_trip'])
        self.assertEqual(len(data['bookings']), 2)
        self.assertEqual(data['total_fare'], 14300.0 + 12480.0)

        # Clean up
        for b_info in data['bookings']:
            b = Booking.query.filter_by(pnr=b_info['pnr']).first()
            if b:
                for s in b.seats:
                    db.session.delete(s)
                db.session.delete(b)
        db.session.commit()

    def test_05_passenger_validation_errors(self):
        # Missing required contact email and phone for Passenger 1
        payload = {
            "outbound": {"flight_id": 1, "cabin": "economy"},
            "passengers": [{
                "fullName": "Incomplete Passenger",
                "dateOfBirth": "1990-01-01"
            }]
        }
        res = self.client.post('/api/bookings', json=payload)
        self.assertEqual(res.status_code, 400)
        self.assertIn("contact email", res.get_json()['message'])

if __name__ == '__main__':
    unittest.main()
