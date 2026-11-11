"""
AeroVista Airlines – Database Architecture & Models
Configured with SQLite and Flask-SQLAlchemy.
Models:
1. User
2. Admin
3. Flight
4. Booking
5. Passenger
6. Seat
7. Payment
"""

from datetime import datetime, timezone
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

# Single shared SQLAlchemy instance
db = SQLAlchemy()


def utc_now():
    """Returns current datetime in UTC (timezone-aware)."""
    return datetime.now(timezone.utc)


# =============================================================================
# 1. User Model
# =============================================================================
class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    full_name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False, index=True)
    mobile_number = db.Column(db.String(25), nullable=True)
    password_hash = db.Column(db.String(255), nullable=False)
    registration_date = db.Column(db.DateTime, default=utc_now, nullable=False)
    account_status = db.Column(db.String(20), default='Active', nullable=False)  # Active, Inactive, Suspended

    # Relationships:
    # Notice: DO NOT cascade delete bookings. Preserves booking history when a user account is deleted.
    # Booking.user_id is set to NULL on User deletion.
    bookings = db.relationship('Booking', back_populates='user', lazy=True)

    def set_password(self, password):
        """Securely hashes and sets the user's password."""
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        """Verifies the password against the stored hash."""
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f"<User id={self.id} email='{self.email}' status='{self.account_status}'>"


# =============================================================================
# 2. Admin Model
# =============================================================================
class Admin(db.Model):
    __tablename__ = 'admins'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    account_status = db.Column(db.String(20), default='Active', nullable=False)  # Active, Inactive

    def set_password(self, password):
        """Securely hashes and sets the admin's password."""
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        """Verifies the password against the stored hash."""
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f"<Admin id={self.id} username='{self.username}'>"


# =============================================================================
# 3. Flight Model
# =============================================================================
class Flight(db.Model):
    __tablename__ = 'flights'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    flight_number = db.Column(db.String(20), unique=True, nullable=False, index=True)
    airline = db.Column(db.String(100), default='AeroVista Airlines', nullable=False)
    source = db.Column(db.String(100), nullable=False)  # e.g. Dubai (DXB)
    destination = db.Column(db.String(100), nullable=False)  # e.g. Mumbai (BOM)
    departure_time = db.Column(db.DateTime, nullable=False)
    arrival_time = db.Column(db.DateTime, nullable=False)
    duration = db.Column(db.String(30), nullable=False)  # e.g. 7h 45m
    aircraft = db.Column(db.String(100), default='Boeing 787-9 Dreamliner', nullable=False)
    cabin_info = db.Column(db.String(150), default='Economy, Business', nullable=False)
    ticket_fare = db.Column(db.Numeric(10, 2), nullable=False)  # Base fare
    total_seat_capacity = db.Column(db.Integer, nullable=False)
    available_seats = db.Column(db.Integer, nullable=False)
    flight_status = db.Column(db.String(30), default='Scheduled', nullable=False)  # Scheduled, On Time, Boarding, Delayed, Cancelled

    # Database CheckConstraints:
    # 1. Total capacity must be non-negative
    # 2. Available seats must be non-negative
    # 3. Available seats cannot exceed total seat capacity
    # 4. Ticket fare must be non-negative
    __table_args__ = (
        db.CheckConstraint('total_seat_capacity >= 0', name='ck_flight_total_capacity_non_negative'),
        db.CheckConstraint('available_seats >= 0', name='ck_flight_available_seats_non_negative'),
        db.CheckConstraint('available_seats <= total_seat_capacity', name='ck_flight_available_le_total'),
        db.CheckConstraint('ticket_fare >= 0', name='ck_flight_fare_non_negative'),
    )

    # Relationships
    bookings = db.relationship('Booking', back_populates='flight', lazy=True)
    seats = db.relationship('Seat', back_populates='flight', cascade='all, delete-orphan', lazy=True)

    def __repr__(self):
        return f"<Flight id={self.id} number='{self.flight_number}' route='{self.source}->{self.destination}'>"


# =============================================================================
# 4. Booking Model
# =============================================================================
class Booking(db.Model):
    __tablename__ = 'bookings'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    pnr = db.Column(db.String(12), unique=True, nullable=False, index=True)  # e.g. AV-X7K2M9
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True)
    flight_id = db.Column(db.Integer, db.ForeignKey('flights.id', ondelete='RESTRICT'), nullable=False, index=True)
    booking_date = db.Column(db.DateTime, default=utc_now, nullable=False)
    total_amount = db.Column(db.Numeric(10, 2), nullable=False)
    # Default is 'Pending' until successful payment confirms the booking
    booking_status = db.Column(db.String(30), default='Pending', nullable=False)  # Pending, Confirmed, Cancelled
    payment_status = db.Column(db.String(30), default='Pending', nullable=False)  # Pending, Paid, Refunded, Pending Refund

    # CheckConstraint for booking amount
    __table_args__ = (
        db.CheckConstraint('total_amount >= 0', name='ck_booking_amount_non_negative'),
    )

    # Relationships
    user = db.relationship('User', back_populates='bookings', lazy=True)
    flight = db.relationship('Flight', back_populates='bookings', lazy=True)
    passengers = db.relationship('Passenger', back_populates='booking', cascade='all, delete-orphan', lazy=True)
    payments = db.relationship('Payment', back_populates='booking', cascade='all, delete-orphan', lazy=True)
    seats = db.relationship('Seat', back_populates='booking', lazy=True)

    def release_seats(self):
        """
        Releases all seats assigned to this booking back to 'Available' status.
        Ensures cancelled bookings release their previously assigned seats.
        """
        for seat in self.seats:
            seat.seat_status = 'Available'
            seat.booking_id = None
            seat.passenger_id = None

    def __repr__(self):
        return f"<Booking id={self.id} pnr='{self.pnr}' status='{self.booking_status}'>"


# =============================================================================
# 5. Passenger Model
# =============================================================================
class Passenger(db.Model):
    __tablename__ = 'passengers'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    booking_id = db.Column(db.Integer, db.ForeignKey('bookings.id', ondelete='CASCADE'), nullable=False, index=True)
    full_name = db.Column(db.String(120), nullable=False)
    date_of_birth = db.Column(db.Date, nullable=True)
    gender = db.Column(db.String(20), nullable=True)
    nationality = db.Column(db.String(80), nullable=True)
    identification_type = db.Column(db.String(40), default='Passport', nullable=True)  # Passport, National ID, Driving License
    identification_number = db.Column(db.String(60), nullable=True)
    contact_email = db.Column(db.String(150), nullable=True)
    contact_phone = db.Column(db.String(25), nullable=True)

    # Relationships
    booking = db.relationship('Booking', back_populates='passengers', lazy=True)
    seat = db.relationship('Seat', back_populates='passenger', uselist=False, lazy=True)

    def __repr__(self):
        return f"<Passenger id={self.id} name='{self.full_name}' booking_id={self.booking_id}>"


# =============================================================================
# 6. Seat Model
# =============================================================================
class Seat(db.Model):
    __tablename__ = 'seats'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    flight_id = db.Column(db.Integer, db.ForeignKey('flights.id', ondelete='CASCADE'), nullable=False, index=True)
    seat_number = db.Column(db.String(10), nullable=False)  # e.g. 10A, 12F
    cabin_class = db.Column(db.String(30), default='Economy', nullable=False)  # Economy, Business
    seat_type = db.Column(db.String(30), default='Standard', nullable=False)  # Standard, Extra Legroom, Emergency Exit, Business Suite
    seat_status = db.Column(db.String(20), default='Available', nullable=False)  # Available, Occupied, Blocked, Selected

    # Associated booking and passenger (optional, populated when reserved in active booking)
    booking_id = db.Column(db.Integer, db.ForeignKey('bookings.id', ondelete='SET NULL'), nullable=True, index=True)
    passenger_id = db.Column(db.Integer, db.ForeignKey('passengers.id', ondelete='SET NULL'), nullable=True, unique=True, index=True)

    # Relationships
    flight = db.relationship('Flight', back_populates='seats', lazy=True)
    booking = db.relationship('Booking', back_populates='seats', lazy=True)
    passenger = db.relationship('Passenger', back_populates='seat', lazy=True)

    # Constraints:
    # 1. Seat uniqueness per flight: A flight cannot have duplicate seat numbers.
    __table_args__ = (
        db.UniqueConstraint('flight_id', 'seat_number', name='uq_flight_seat_number'),
    )

    def assign_to(self, booking, passenger=None):
        """Assigns this seat to an active booking and marks it Occupied."""
        if self.seat_status == 'Occupied' and self.booking_id != booking.id:
            raise ValueError(f"Seat {self.seat_number} on flight {self.flight_id} is already occupied by an active booking.")
        self.booking_id = booking.id
        self.passenger_id = passenger.id if passenger else None
        self.seat_status = 'Occupied'

    def release(self):
        """Releases this seat back to Available state when a booking is cancelled."""
        self.booking_id = None
        self.passenger_id = None
        self.seat_status = 'Available'

    def __repr__(self):
        return f"<Seat id={self.id} flight_id={self.flight_id} seat='{self.seat_number}' status='{self.seat_status}'>"


# =============================================================================
# 7. Payment Model
# =============================================================================
class Payment(db.Model):
    __tablename__ = 'payments'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    booking_id = db.Column(db.Integer, db.ForeignKey('bookings.id', ondelete='CASCADE'), nullable=False, index=True)
    payment_method = db.Column(db.String(30), nullable=False)  # Credit Card, Debit Card, UPI
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    transaction_reference = db.Column(db.String(60), unique=True, nullable=False, index=True)  # e.g. TXN-17298319
    # Default is 'Pending' until successful gateway completion
    payment_status = db.Column(db.String(30), default='Pending', nullable=False)  # Pending, Successful, Failed, Refunded
    payment_date = db.Column(db.DateTime, default=utc_now, nullable=False)

    # CheckConstraint: Payment amount must be non-negative
    __table_args__ = (
        db.CheckConstraint('amount >= 0', name='ck_payment_amount_non_negative'),
    )

    # Relationships
    booking = db.relationship('Booking', back_populates='payments', lazy=True)

    def __repr__(self):
        return f"<Payment id={self.id} ref='{self.transaction_reference}' amount={self.amount} status='{self.payment_status}'>"
