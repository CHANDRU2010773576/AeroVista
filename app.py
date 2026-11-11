"""
AeroVista Airlines – Backend Flask Application
Serves frontend HTML pages, static assets, and SQLite database models.
"""

import os
import re
import io
import uuid
from datetime import datetime, timezone, timedelta, time
from decimal import Decimal
from flask import Flask, send_from_directory, jsonify, request, session, send_file
from sqlalchemy import text, or_, func
from models import db, User, Admin, Flight, Booking, Passenger, Seat, Payment
import ticket_generator

# Project root directory
BASE_DIR = os.path.abspath(os.path.dirname(__file__))

# SQLite database file path
DB_PATH = os.path.join(BASE_DIR, 'aerovista.db')

# Initialize Flask application configured to serve root static assets directly
app = Flask(__name__, static_folder=BASE_DIR, static_url_path='')

# Configuration: single secret key with environment variable and development fallback
app.config['SECRET_KEY'] = os.environ.get('AEROVISTA_SECRET_KEY', 'aerovista-secret-key-development-2026')
app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{DB_PATH}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize shared SQLAlchemy instance with Flask app
db.init_app(app)

# Ensure database tables exist without dropping or overwriting existing records
with app.app_context():
    db.create_all()


# =============================================================================
# 1. Health & Verification Route
# =============================================================================
@app.route('/api/status')
def api_status():
    """
    Health check endpoint verifying application and SQLite database connectivity.
    Returns HTTP 200 on success and HTTP 503 if the database is unavailable.
    """
    try:
        db.session.execute(text('SELECT 1'))
    except Exception as e:
        app.logger.error(f"Database connectivity check failed: {e}")
        return jsonify({
            "status": "degraded",
            "service": "AeroVista Airline Reservation Backend",
            "version": "1.0.0",
            "database": "aerovista.db",
            "message": "Database connection error"
        }), 503

    return jsonify({
        "status": "online",
        "service": "AeroVista Airline Reservation Backend",
        "version": "1.0.0",
        "database": "aerovista.db",
        "message": "Flask server and database initialized successfully"
    }), 200


# =============================================================================
# 2. Passenger Registration Endpoint
# =============================================================================
@app.route('/api/register', methods=['POST'])
def register():
    """
    Registers a new passenger account in the SQLite database.
    Validates required fields, password confirmation, email format, and unique email.
    """
    data = request.get_json(silent=True)
    if not data:
        data = request.form.to_dict()

    if not data:
        return jsonify({
            "status": "error",
            "message": "Invalid request payload. Expected JSON or form data."
        }), 400

    # Extract fields matching register.html form field names
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''
    confirm_password = data.get('confirmPassword') or data.get('confirm_password') or ''
    phone = (data.get('phone') or '').strip()
    country_code = (data.get('countryCode') or data.get('country_code') or '').strip()
    title = (data.get('title') or '').strip()
    first_name = (data.get('firstName') or data.get('first_name') or '').strip()
    middle_name = (data.get('middleName') or data.get('middle_name') or '').strip()
    last_name = (data.get('lastName') or data.get('last_name') or '').strip()
    date_of_birth = (data.get('dateOfBirth') or data.get('date_of_birth') or data.get('dob') or '').strip()
    residence = (data.get('residence') or '').strip()
    full_name_provided = (data.get('fullName') or data.get('full_name') or '').strip()

    # Determine full_name
    if not full_name_provided:
        name_parts = [p for p in [first_name, middle_name, last_name] if p]
        full_name = " ".join(name_parts)
    else:
        full_name = full_name_provided

    # Assemble mobile number
    mobile_number = f"{country_code} {phone}".strip() if country_code and phone else phone

    # 1. Validate Email
    if not email:
        return jsonify({"status": "error", "message": "Email address is required."}), 400

    email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(email_regex, email):
        return jsonify({"status": "error", "message": "Invalid email address format."}), 400

    # 2. Validate Password
    if not password:
        return jsonify({"status": "error", "message": "Password is required."}), 400

    if len(password) < 6:
        return jsonify({"status": "error", "message": "Password must be at least 6 characters."}), 400

    # 3. Validate Password Confirmation (explicitly required)
    if not confirm_password:
        return jsonify({"status": "error", "message": "Please confirm your password."}), 400

    if password != confirm_password:
        return jsonify({"status": "error", "message": "Passwords do not match."}), 400

    # 4. Validate Mandatory Personal Details
    if not first_name:
        return jsonify({"status": "error", "message": "First name is required."}), 400

    if not last_name:
        return jsonify({"status": "error", "message": "Last name is required."}), 400

    if not phone:
        return jsonify({"status": "error", "message": "Mobile number is required."}), 400

    # Check for existing email in database
    try:
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            return jsonify({
                "status": "error",
                "message": f"An account with email '{email}' already exists. Please sign in or use a different email."
            }), 409

        # Instantiate new passenger User record
        new_user = User(
            full_name=full_name,
            email=email,
            mobile_number=mobile_number or None,
            account_status='Active'
        )
        new_user.set_password(password)

        db.session.add(new_user)
        db.session.commit()

        return jsonify({
            "status": "success",
            "message": "Passenger account registered successfully.",
            "user": {
                "id": new_user.id,
                "full_name": new_user.full_name,
                "email": new_user.email,
                "account_status": new_user.account_status
            }
        }), 201

    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error during passenger registration: {e}")
        return jsonify({
            "status": "error",
            "message": "A database error occurred while registering your account. Please try again."
        }), 500


# =============================================================================
# 3. Backend Login Authentication Route
# =============================================================================
@app.route('/api/login', methods=['POST'])
def api_login():
    """
    Passenger login authentication endpoint.
    Accepts JSON with email and password, verifies credentials,
    checks account status, establishes a Flask session, and returns user details.
    """
    # Accept data from JSON payload or form-encoded submission
    data = request.get_json(silent=True)
    if not data:
        data = request.form.to_dict()

    if not data:
        return jsonify({
            "status": "error",
            "message": "Invalid request. Email and password are required."
        }), 400

    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''

    # Validate that both fields are provided
    if not email or not password:
        return jsonify({
            "status": "error",
            "message": "Email and password are required."
        }), 400

    try:
        # Find the passenger using the normalized lowercase email
        user = User.query.filter_by(email=email).first()

        # Reject incorrect email or password
        if not user or not user.check_password(password):
            return jsonify({
                "status": "error",
                "message": "Invalid email or password."
            }), 401

        # Reject accounts that are not Active
        if user.account_status != 'Active':
            return jsonify({
                "status": "error",
                "message": f"Account is {user.account_status.lower()}. Please contact AeroVista support."
            }), 403

        # Create Flask session storing authenticated user's ID
        session['user_id'] = user.id

        # Return user details (never return password or password hash)
        return jsonify({
            "status": "success",
            "message": "Login successful.",
            "user": {
                "id": user.id,
                "full_name": user.full_name,
                "email": user.email
            }
        }), 200

    except Exception as e:
        app.logger.error(f"Error during passenger login: {e}")
        return jsonify({
            "status": "error",
            "message": "A server error occurred during login. Please try again."
        }), 500


# =============================================================================
# 4. Session & Logout Authentication Routes
# =============================================================================
@app.route('/api/session', methods=['GET'])
def api_session():
    """
    Session verification endpoint.
    Checks whether a passenger is currently logged in via Flask session.
    If authenticated, returns the passenger's id, full name, and email.
    If not authenticated, returns an unauthenticated status response.
    """
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({
            "status": "unauthenticated",
            "authenticated": False,
            "message": "No active passenger session."
        }), 401

    try:
        user = User.query.get(user_id)
        if not user or user.account_status != 'Active':
            session.clear()
            return jsonify({
                "status": "unauthenticated",
                "authenticated": False,
                "message": "Session invalid or account is not active."
            }), 401

        return jsonify({
            "status": "authenticated",
            "authenticated": True,
            "user": {
                "id": user.id,
                "full_name": user.full_name,
                "email": user.email
            }
        }), 200
    except Exception as e:
        app.logger.error(f"Error checking session: {e}")
        return jsonify({
            "status": "error",
            "message": "An error occurred checking session status."
        }), 500


@app.route('/api/logout', methods=['POST'])
def api_logout():
    """
    Passenger logout endpoint.
    Removes user_id from the Flask session without interfering with admin_id.
    """
    try:
        session.pop('user_id', None)
        return jsonify({
            "status": "success",
            "message": "Logged out successfully."
        }), 200
    except Exception as e:
        app.logger.error(f"Error during passenger logout: {e}")
        return jsonify({
            "status": "error",
            "message": "An error occurred while logging out."
        }), 500


# =============================================================================
# 5. Admin Authentication & Management APIs (Phase 5)
# =============================================================================
@app.route('/api/admin/setup-status', methods=['GET'])
def api_admin_setup_status():
    """
    Checks whether initial admin setup is required.
    Setup is required only when the 'admins' table is completely empty.
    """
    try:
        admin_count = Admin.query.count()
        return jsonify({
            "status": "success",
            "setup_required": (admin_count == 0),
            "admin_count": admin_count
        }), 200
    except Exception as e:
        app.logger.error(f"Error checking admin setup status: {e}")
        return jsonify({
            "status": "error",
            "message": "Could not check admin setup status."
        }), 500


@app.route('/api/admin/initialize', methods=['POST'])
def api_admin_initialize():
    """
    One-time initial admin creation endpoint.
    Permitted ONLY when the 'admins' table contains zero records.
    Permanently locks once the first admin account is established.
    """
    data = request.get_json(silent=True)
    if not data:
        data = request.form.to_dict()

    if not data:
        return jsonify({
            "status": "error",
            "message": "Invalid request payload."
        }), 400

    username = (data.get('username') or '').strip()
    password = data.get('password') or ''
    confirm_password = data.get('confirm_password') or data.get('confirmPassword') or ''

    # Field presence
    if not username:
        return jsonify({"status": "error", "message": "Admin username is required."}), 400

    if not password:
        return jsonify({"status": "error", "message": "Admin password is required."}), 400

    if len(password) < 8:
        return jsonify({"status": "error", "message": "Admin password must be at least 8 characters long."}), 400

    if not confirm_password:
        return jsonify({"status": "error", "message": "Please confirm your admin password."}), 400

    if password != confirm_password:
        return jsonify({"status": "error", "message": "Passwords do not match."}), 400

    try:
        # Atomic check inside transaction to prevent race conditions
        admin_count = Admin.query.count()
        if admin_count > 0:
            return jsonify({
                "status": "error",
                "message": "Initial admin setup has already been completed. Further public initialization is permanently disabled."
            }), 403

        # Instantiate first admin record
        new_admin = Admin(
            username=username,
            account_status='Active'
        )
        new_admin.set_password(password)

        db.session.add(new_admin)
        db.session.commit()

        # Automatically authenticate the newly created administrator
        session['admin_id'] = new_admin.id

        return jsonify({
            "status": "success",
            "message": "Initial administrator account created and authenticated successfully.",
            "admin": {
                "id": new_admin.id,
                "username": new_admin.username,
                "account_status": new_admin.account_status
            }
        }), 201

    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error during admin initialization: {e}")
        return jsonify({
            "status": "error",
            "message": "A database error occurred while creating the initial administrator account."
        }), 500


@app.route('/api/admin/login', methods=['POST'])
def api_admin_login():
    """
    Administrator login authentication endpoint.
    Accepts username and password, verifies credentials,
    verifies active status, establishes an admin Flask session ('admin_id').
    """
    data = request.get_json(silent=True)
    if not data:
        data = request.form.to_dict()

    if not data:
        return jsonify({
            "status": "error",
            "message": "Username and password are required."
        }), 400

    username = (data.get('username') or data.get('email') or '').strip()
    password = data.get('password') or ''

    if not username or not password:
        return jsonify({
            "status": "error",
            "message": "Username and password are required."
        }), 400

    try:
        admin = Admin.query.filter_by(username=username).first()

        # Reject incorrect credentials
        if not admin or not admin.check_password(password):
            return jsonify({
                "status": "error",
                "message": "Invalid administrator username or password."
            }), 401

        # Reject inactive admin accounts
        if admin.account_status != 'Active':
            return jsonify({
                "status": "error",
                "message": f"Administrator account is {admin.account_status.lower()}. Please contact system administration."
            }), 403

        # Establish separate admin session
        session['admin_id'] = admin.id

        return jsonify({
            "status": "success",
            "message": "Administrator authenticated successfully.",
            "admin": {
                "id": admin.id,
                "username": admin.username,
                "account_status": admin.account_status
            }
        }), 200

    except Exception as e:
        app.logger.error(f"Error during admin login: {e}")
        return jsonify({
            "status": "error",
            "message": "A server error occurred during administrator login."
        }), 500


@app.route('/api/admin/session', methods=['GET'])
def api_admin_session():
    """
    Checks whether an administrator is currently authenticated.
    Returns safe admin info if authenticated; HTTP 401 otherwise.
    """
    admin_id = session.get('admin_id')
    if not admin_id:
        return jsonify({
            "status": "unauthenticated",
            "authenticated": False,
            "message": "No active administrator session."
        }), 401

    try:
        admin = Admin.query.get(admin_id)
        if not admin or admin.account_status != 'Active':
            session.pop('admin_id', None)
            return jsonify({
                "status": "unauthenticated",
                "authenticated": False,
                "message": "Administrator session is invalid or inactive."
            }), 401

        return jsonify({
            "status": "authenticated",
            "authenticated": True,
            "admin": {
                "id": admin.id,
                "username": admin.username,
                "account_status": admin.account_status
            }
        }), 200

    except Exception as e:
        app.logger.error(f"Error checking admin session: {e}")
        return jsonify({
            "status": "error",
            "message": "An error occurred checking administrator session."
        }), 500


@app.route('/api/admin/logout', methods=['POST'])
def api_admin_logout():
    """
    Administrator logout endpoint.
    Clears only the admin session key ('admin_id'), keeping passenger session intact.
    """
    try:
        session.pop('admin_id', None)
        return jsonify({
            "status": "success",
            "message": "Administrator logged out successfully."
        }), 200
    except Exception as e:
        app.logger.error(f"Error during admin logout: {e}")
        return jsonify({
            "status": "error",
            "message": "An error occurred while logging out administrator."
        }), 500


@app.route('/api/admin/change-credentials', methods=['POST'])
def api_admin_change_credentials():
    """
    Allows the authenticated administrator to update their username and/or password.
    Requires the current password before applying changes.
    """
    admin_id = session.get('admin_id')
    if not admin_id:
        return jsonify({
            "status": "unauthenticated",
            "message": "Administrator authentication required."
        }), 401

    try:
        admin = Admin.query.get(admin_id)
        if not admin or admin.account_status != 'Active':
            session.pop('admin_id', None)
            return jsonify({
                "status": "unauthenticated",
                "message": "Invalid administrator session."
            }), 401

        data = request.get_json(silent=True)
        if not data:
            data = request.form.to_dict()

        if not data:
            return jsonify({"status": "error", "message": "Invalid request payload."}), 400

        current_password = data.get('current_password') or ''
        new_username = (data.get('new_username') or '').strip()
        new_password = data.get('new_password') or ''
        confirm_new_password = data.get('confirm_new_password') or data.get('confirmNewPassword') or ''

        # Current password is required
        if not current_password:
            return jsonify({"status": "error", "message": "Current password is required to verify changes."}), 400

        if not admin.check_password(current_password):
            return jsonify({"status": "error", "message": "Current password is incorrect."}), 401

        # Check if username update is requested
        if new_username and new_username != admin.username:
            existing = Admin.query.filter_by(username=new_username).first()
            if existing and existing.id != admin.id:
                return jsonify({"status": "error", "message": f"Username '{new_username}' is already in use."}), 409
            admin.username = new_username

        # Check if password update is requested
        if new_password:
            if len(new_password) < 8:
                return jsonify({"status": "error", "message": "New password must be at least 8 characters long."}), 400
            if not confirm_new_password:
                return jsonify({"status": "error", "message": "Please confirm the new password."}), 400
            if new_password != confirm_new_password:
                return jsonify({"status": "error", "message": "New passwords do not match."}), 400
            admin.set_password(new_password)

        db.session.commit()

        return jsonify({
            "status": "success",
            "message": "Administrator credentials updated successfully.",
            "admin": {
                "id": admin.id,
                "username": admin.username
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error changing admin credentials: {e}")
        return jsonify({
            "status": "error",
            "message": "A database error occurred while updating administrator credentials."
        }), 500


# =============================================================================
# 6. Admin Flight Management (CRUD) APIs (Phase 6)
# =============================================================================
def _parse_flight_datetime(date_str, time_str, field_label):
    """Helper to parse date and time into a datetime object."""
    date_clean = (date_str or '').strip()
    time_clean = (time_str or '').strip()
    if not date_clean or not time_clean:
        return None, f"{field_label} date and time are required."

    # Try common formats
    for fmt in ('%Y-%m-%d %H:%M', '%Y-%m-%d %H:%M:%S'):
        try:
            return datetime.strptime(f"{date_clean} {time_clean}", fmt), None
        except ValueError:
            pass

    # Try ISO combined format if time contains date or vice-versa
    try:
        return datetime.fromisoformat(f"{date_clean}T{time_clean}"), None
    except Exception:
        return None, f"Invalid {field_label} format. Expected YYYY-MM-DD and HH:MM."


def _compute_flight_duration(dept_dt, arr_dt):
    """Computes human-readable duration between departure and arrival."""
    diff = arr_dt - dept_dt
    total_seconds = int(diff.total_seconds())
    if total_seconds <= 0:
        return None
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    return f"{hours}h {minutes}m"


@app.route('/api/admin/flights', methods=['GET'])
def api_admin_get_flights():
    """
    Retrieves commercial flight records with optional search and status filtering.
    Requires an authenticated administrator session.
    """
    admin_id = session.get('admin_id')
    if not admin_id:
        return jsonify({"status": "unauthenticated", "message": "Administrator authentication required."}), 401

    try:
        search_query = (request.args.get('search') or '').strip()
        status_filter = (request.args.get('status') or '').strip()
        source_filter = (request.args.get('source') or '').strip()
        dest_filter = (request.args.get('destination') or '').strip()

        query = Flight.query

        if status_filter:
            query = query.filter(Flight.flight_status.ilike(status_filter))

        if source_filter:
            query = query.filter(Flight.source == source_filter)

        if dest_filter:
            query = query.filter(Flight.destination == dest_filter)

        if search_query:
            term = f"%{search_query}%"
            query = query.filter(
                or_(
                    Flight.flight_number.ilike(term),
                    Flight.source.ilike(term),
                    Flight.destination.ilike(term),
                    Flight.airline.ilike(term),
                    Flight.aircraft.ilike(term)
                )
            )

        flights = query.order_by(Flight.departure_time.asc()).all()

        results = []
        for f in flights:
            dept_dt = f.departure_time
            arr_dt = f.arrival_time
            results.append({
                "id": f.id,
                "flight_number": f.flight_number,
                "airline": f.airline,
                "source": f.source,
                "destination": f.destination,
                "departure_time": dept_dt.isoformat(),
                "arrival_time": arr_dt.isoformat(),
                "departure_date": dept_dt.strftime('%Y-%m-%d'),
                "departure_time_str": dept_dt.strftime('%H:%M'),
                "arrival_date": arr_dt.strftime('%Y-%m-%d'),
                "arrival_time_str": arr_dt.strftime('%H:%M'),
                "duration": f.duration,
                "aircraft": f.aircraft,
                "cabin_info": f.cabin_info,
                "ticket_fare": float(f.ticket_fare),
                "total_seat_capacity": f.total_seat_capacity,
                "available_seats": f.available_seats,
                "occupied_seats": f.total_seat_capacity - f.available_seats,
                "flight_status": f.flight_status,
                "bookings_count": len(f.bookings)
            })

        return jsonify({
            "status": "success",
            "count": len(results),
            "flights": results
        }), 200

    except Exception as e:
        app.logger.error(f"Error fetching admin flights: {e}")
        return jsonify({"status": "error", "message": "An error occurred retrieving flights."}), 500


@app.route('/api/admin/flights', methods=['POST'])
def api_admin_create_flight():
    """
    Creates a new flight in the flights table.
    Requires authenticated administrator session and validates all fields.
    """
    admin_id = session.get('admin_id')
    if not admin_id:
        return jsonify({"status": "unauthenticated", "message": "Administrator authentication required."}), 401

    data = request.get_json(silent=True)
    if not data:
        data = request.form.to_dict()

    if not data:
        return jsonify({"status": "error", "message": "Request payload is required."}), 400

    flight_num = (data.get('flight_number') or data.get('flightNumber') or '').strip().upper()
    airline = (data.get('airline') or 'AeroVista Airlines').strip()
    source = (data.get('source') or '').strip()
    destination = (data.get('destination') or '').strip()
    dept_date = data.get('departure_date') or data.get('departureDate')
    dept_time = data.get('departure_time') or data.get('departureTime')
    arr_date = data.get('arrival_date') or data.get('arrivalDate')
    arr_time = data.get('arrival_time') or data.get('arrivalTime')
    aircraft = (data.get('aircraft') or 'Boeing 787-9 Dreamliner').strip()
    cabin_info = (data.get('cabin_info') or data.get('cabinInfo') or 'Economy, Business').strip()
    status = (data.get('flight_status') or data.get('status') or 'Scheduled').strip()

    # 1. Required fields presence
    if not flight_num:
        return jsonify({"status": "error", "message": "Flight number is required."}), 400
    if not source:
        return jsonify({"status": "error", "message": "Source origin is required."}), 400
    if not destination:
        return jsonify({"status": "error", "message": "Destination is required."}), 400

    # 2. Source and Destination must be different
    if source.lower() == destination.lower():
        return jsonify({"status": "error", "message": "Source and destination cannot be identical."}), 400

    # 3. Check for duplicate flight number
    existing_flight = Flight.query.filter_by(flight_number=flight_num).first()
    if existing_flight:
        return jsonify({
            "status": "error",
            "message": f"Flight number '{flight_num}' already exists in the system."
        }), 409

    # 4. Parse Dates & Times
    dept_dt, dept_err = _parse_flight_datetime(dept_date, dept_time, "Departure")
    if dept_err:
        return jsonify({"status": "error", "message": dept_err}), 400

    arr_dt, arr_err = _parse_flight_datetime(arr_date, arr_time, "Arrival")
    if arr_err:
        return jsonify({"status": "error", "message": arr_err}), 400

    # Arrival must be after Departure (supports next-day arrivals)
    if arr_dt <= dept_dt:
        return jsonify({
            "status": "error",
            "message": "Arrival date and time must be strictly after departure date and time."
        }), 400

    duration = _compute_flight_duration(dept_dt, arr_dt)
    if not duration:
        return jsonify({"status": "error", "message": "Invalid flight duration computed."}), 400

    # 5. Ticket Fare validation
    raw_fare = data.get('ticket_fare') or data.get('ticketFare') or data.get('fare')
    try:
        fare = Decimal(str(raw_fare))
        if fare < 0:
            return jsonify({"status": "error", "message": "Ticket fare cannot be negative."}), 400
    except (ValueError, TypeError, ArithmeticError):
        return jsonify({"status": "error", "message": "Valid numeric ticket fare is required."}), 400

    # 6. Total Capacity & Available Seats validation
    raw_capacity = data.get('total_seat_capacity') or data.get('totalSeats') or data.get('total_capacity')
    try:
        total_capacity = int(raw_capacity)
        if total_capacity <= 0 or total_capacity > 850:
            return jsonify({"status": "error", "message": "Total seat capacity must be between 1 and 850."}), 400
    except (ValueError, TypeError):
        return jsonify({"status": "error", "message": "Valid integer seat capacity is required."}), 400

    raw_avail = data.get('available_seats') or data.get('availableSeats')
    if raw_avail is not None and str(raw_avail).strip() != '':
        try:
            available_seats = int(raw_avail)
            if available_seats < 0:
                return jsonify({"status": "error", "message": "Available seats cannot be negative."}), 400
            if available_seats > total_capacity:
                return jsonify({
                    "status": "error",
                    "message": f"Available seats ({available_seats}) cannot exceed total capacity ({total_capacity})."
                }), 400
        except (ValueError, TypeError):
            return jsonify({"status": "error", "message": "Valid integer available seats count required."}), 400
    else:
        # Default to full capacity for new flights
        available_seats = total_capacity

    try:
        new_flight = Flight(
            flight_number=flight_num,
            airline=airline,
            source=source,
            destination=destination,
            departure_time=dept_dt,
            arrival_time=arr_dt,
            duration=duration,
            aircraft=aircraft,
            cabin_info=cabin_info,
            ticket_fare=fare,
            total_seat_capacity=total_capacity,
            available_seats=available_seats,
            flight_status=status
        )
        db.session.add(new_flight)
        db.session.commit()

        return jsonify({
            "status": "success",
            "message": f"Flight {flight_num} created successfully.",
            "flight": {
                "id": new_flight.id,
                "flight_number": new_flight.flight_number,
                "airline": new_flight.airline,
                "source": new_flight.source,
                "destination": new_flight.destination,
                "departure_time": new_flight.departure_time.isoformat(),
                "arrival_time": new_flight.arrival_time.isoformat(),
                "duration": new_flight.duration,
                "ticket_fare": float(new_flight.ticket_fare),
                "total_seat_capacity": new_flight.total_seat_capacity,
                "available_seats": new_flight.available_seats,
                "flight_status": new_flight.flight_status
            }
        }), 201

    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error creating flight: {e}")
        return jsonify({"status": "error", "message": "A database error occurred while creating the flight."}), 500


@app.route('/api/admin/flights/<int:flight_id>', methods=['PUT'])
def api_admin_update_flight(flight_id):
    """
    Updates an existing commercial flight record.
    Preserves booking history, ensures capacity is not reduced below occupied seats,
    and recalculates available seats accurately.
    """
    admin_id = session.get('admin_id')
    if not admin_id:
        return jsonify({"status": "unauthenticated", "message": "Administrator authentication required."}), 401

    flight = Flight.query.get(flight_id)
    if not flight:
        return jsonify({"status": "error", "message": f"Flight ID {flight_id} not found."}), 404

    data = request.get_json(silent=True)
    if not data:
        data = request.form.to_dict()

    if not data:
        return jsonify({"status": "error", "message": "Request payload is required."}), 400

    # 1. Flight Number
    if 'flight_number' in data or 'flightNumber' in data:
        flight_num = (data.get('flight_number') or data.get('flightNumber') or '').strip().upper()
        if not flight_num:
            return jsonify({"status": "error", "message": "Flight number cannot be empty."}), 400
        if flight_num != flight.flight_number:
            existing = Flight.query.filter_by(flight_number=flight_num).first()
            if existing and existing.id != flight.id:
                return jsonify({"status": "error", "message": f"Flight number '{flight_num}' already in use."}), 409
            flight.flight_number = flight_num

    # 2. Airline
    if 'airline' in data:
        airline = (data.get('airline') or '').strip()
        if airline:
            flight.airline = airline

    # 3. Source & Destination
    source = (data.get('source') or flight.source).strip()
    destination = (data.get('destination') or flight.destination).strip()
    if source.lower() == destination.lower():
        return jsonify({"status": "error", "message": "Source and destination cannot be identical."}), 400
    flight.source = source
    flight.destination = destination

    # 4. Departure & Arrival Datetimes (Supports overnight flights)
    dept_date = data.get('departure_date') or data.get('departureDate')
    dept_time = data.get('departure_time') or data.get('departureTime')
    arr_date = data.get('arrival_date') or data.get('arrivalDate')
    arr_time = data.get('arrival_time') or data.get('arrivalTime')

    if dept_date or dept_time or arr_date or arr_time:
        d_date = dept_date or flight.departure_time.strftime('%Y-%m-%d')
        d_time = dept_time or flight.departure_time.strftime('%H:%M')
        a_date = arr_date or flight.arrival_time.strftime('%Y-%m-%d')
        a_time = arr_time or flight.arrival_time.strftime('%H:%M')

        dept_dt, dept_err = _parse_flight_datetime(d_date, d_time, "Departure")
        if dept_err:
            return jsonify({"status": "error", "message": dept_err}), 400

        arr_dt, arr_err = _parse_flight_datetime(a_date, a_time, "Arrival")
        if arr_err:
            return jsonify({"status": "error", "message": arr_err}), 400

        if arr_dt <= dept_dt:
            return jsonify({
                "status": "error",
                "message": "Arrival date and time must be strictly after departure date and time."
            }), 400

        flight.departure_time = dept_dt
        flight.arrival_time = arr_dt
        duration = _compute_flight_duration(dept_dt, arr_dt)
        if duration:
            flight.duration = duration

    # 5. Ticket Fare
    raw_fare = data.get('ticket_fare') or data.get('ticketFare') or data.get('fare')
    if raw_fare is not None:
        try:
            fare = Decimal(str(raw_fare))
            if fare < 0:
                return jsonify({"status": "error", "message": "Ticket fare cannot be negative."}), 400
            flight.ticket_fare = fare
        except (ValueError, TypeError, ArithmeticError):
            return jsonify({"status": "error", "message": "Valid numeric ticket fare is required."}), 400

    # 6. Capacity & Available Seats Integrity
    # Calculate actual occupied seats from confirmed/pending bookings
    occupied_seats = flight.total_seat_capacity - flight.available_seats
    if occupied_seats < 0:
        occupied_seats = 0

    raw_capacity = data.get('total_seat_capacity') or data.get('totalSeats') or data.get('total_capacity')
    if raw_capacity is not None:
        try:
            new_capacity = int(raw_capacity)
            if new_capacity <= 0 or new_capacity > 850:
                return jsonify({"status": "error", "message": "Total seat capacity must be between 1 and 850."}), 400
            # CRITICAL RULE: Capacity cannot be reduced below occupied seats
            if new_capacity < occupied_seats:
                return jsonify({
                    "status": "error",
                    "message": f"Cannot reduce capacity to {new_capacity}. There are currently {occupied_seats} occupied seats."
                }), 400

            # Calculate remaining available seats based on actual occupancy
            flight.total_seat_capacity = new_capacity
            flight.available_seats = new_capacity - occupied_seats
        except (ValueError, TypeError):
            return jsonify({"status": "error", "message": "Valid integer seat capacity is required."}), 400

    # 7. Status update (e.g. Scheduled, On Time, Boarding, Delayed, Cancelled)
    new_status = data.get('flight_status') or data.get('status')
    if new_status:
        flight.flight_status = new_status.strip()

    if 'aircraft' in data:
        flight.aircraft = (data.get('aircraft') or flight.aircraft).strip()

    try:
        db.session.commit()
        return jsonify({
            "status": "success",
            "message": f"Flight {flight.flight_number} updated successfully.",
            "flight": {
                "id": flight.id,
                "flight_number": flight.flight_number,
                "airline": flight.airline,
                "source": flight.source,
                "destination": flight.destination,
                "departure_time": flight.departure_time.isoformat(),
                "arrival_time": flight.arrival_time.isoformat(),
                "duration": flight.duration,
                "ticket_fare": float(flight.ticket_fare),
                "total_seat_capacity": flight.total_seat_capacity,
                "available_seats": flight.available_seats,
                "occupied_seats": flight.total_seat_capacity - flight.available_seats,
                "flight_status": flight.flight_status
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error updating flight: {e}")
        return jsonify({"status": "error", "message": "A database error occurred while updating the flight."}), 500


@app.route('/api/admin/flights/<int:flight_id>', methods=['DELETE'])
def api_admin_delete_flight(flight_id):
    """
    Deletes a flight only when it has NO dependent bookings.
    If bookings exist, rejects deletion to protect booking and payment history.
    """
    admin_id = session.get('admin_id')
    if not admin_id:
        return jsonify({"status": "unauthenticated", "message": "Administrator authentication required."}), 401

    flight = Flight.query.get(flight_id)
    if not flight:
        return jsonify({"status": "error", "message": f"Flight ID {flight_id} not found."}), 404

    try:
        # Check for dependent bookings
        booking_count = len(flight.bookings)
        if booking_count > 0:
            return jsonify({
                "status": "error",
                "message": (
                    f"Flight {flight.flight_number} cannot be deleted because it has {booking_count} "
                    "associated reservation record(s). Historical booking and payment integrity must be preserved. "
                    "To prevent further reservations, change the flight status to 'Cancelled' or 'Inactive' instead."
                ),
                "has_dependent_records": True,
                "booking_count": booking_count
            }), 409

        flight_num = flight.flight_number
        db.session.delete(flight)
        db.session.commit()

        return jsonify({
            "status": "success",
            "message": f"Flight {flight_num} deleted successfully."
        }), 200

    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error deleting flight: {e}")
        return jsonify({"status": "error", "message": "A database error occurred while deleting the flight."}), 500


# =============================================================================
# 7. Passenger Flight Search & Results APIs (Phase 7)
# =============================================================================
def _extract_code(text):
    """Extract 3-letter airport code from e.g. 'Dubai (DXB)' or 'DXB'."""
    m = re.search(r'\(([A-Z]{3})\)', text or '')
    if m:
        return m.group(1)
    m2 = re.search(r'\b([A-Z]{3})\b', text or '')
    return m2.group(1) if m2 else (text[:3].upper() if text else '')


def _extract_city(text):
    """Extract city name from e.g. 'Dubai (DXB)'."""
    if not text:
        return ''
    return re.sub(r'\s*\([A-Z]{3}\).*', '', text).strip()


def _format_flight_payload(f, passenger_count):
    """Formats a Flight model instance for passenger search results."""
    dept_dt = f.departure_time
    arr_dt = f.arrival_time
    base_fare = float(f.ticket_fare)
    # Business fare default multiplier 2.6x if cabin includes Business
    business_fare = round(base_fare * 2.6, 2)

    source_code = _extract_code(f.source)
    dest_code = _extract_code(f.destination)
    source_city = _extract_city(f.source)
    dest_city = _extract_city(f.destination)

    return {
        "id": f.id,
        "flight_id": f.id,
        "flightNumber": f.flight_number,
        "airline": f.airline,
        "source": f.source,
        "sourceCode": source_code,
        "sourceCity": source_city,
        "sourceAirport": f"{source_city} International Airport" if source_city else f.source,
        "destination": f.destination,
        "destCode": dest_code,
        "destCity": dest_city,
        "destAirport": f"{dest_city} International Airport" if dest_city else f.destination,
        "departureTime": dept_dt.strftime('%H:%M'),
        "arrivalTime": arr_dt.strftime('%H:%M'),
        "departureDate": dept_dt.strftime('%Y-%m-%d'),
        "arrivalDate": arr_dt.strftime('%Y-%m-%d'),
        "nextDayArrival": (arr_dt.date() > dept_dt.date()),
        "duration": f.duration,
        "ticketFare": base_fare,
        "economyFare": base_fare,
        "businessFare": business_fare,
        "totalFareEconomy": round(base_fare * passenger_count, 2),
        "totalFareBusiness": round(business_fare * passenger_count, 2),
        "totalSeats": f.total_seat_capacity,
        "availableSeats": f.available_seats,
        "status": f.flight_status,
        "aircraft": f.aircraft,
        "cabinInfo": f.cabin_info,
        "stops": 0,
        "stopsText": "Direct Flight",
        "hasWifi": True,
        "mealIncluded": True,
        "baggageAllowance": "30 kg Checked + 7 kg Cabin"
    }


def _search_flights_direction(source_term, dest_term, date_obj, passenger_count, now_dt):
    """
    Queries active flights matching source, destination, full departure date,
    having departure in the future, and having sufficient available seats.
    """
    # Exact date bounds for departure date
    start_of_day = datetime(date_obj.year, date_obj.month, date_obj.day, 0, 0, 0)
    end_of_day = datetime(date_obj.year, date_obj.month, date_obj.day, 23, 59, 59)

    # Active status check: Exclude Cancelled and Inactive
    # Case-insensitive route match: match either full name or code (e.g. "Dubai (DXB)" or "DXB" or "Dubai")
    src_clean = source_term.strip()
    dst_clean = dest_term.strip()

    # Extract code if present
    src_code_match = re.search(r'\(([A-Z]{3})\)', src_clean)
    dst_code_match = re.search(r'\(([A-Z]{3})\)', dst_clean)
    src_code = src_code_match.group(1) if src_code_match else src_clean
    dst_code = dst_code_match.group(1) if dst_code_match else dst_clean

    src_like = f"%{src_code}%"
    dst_like = f"%{dst_code}%"

    query = Flight.query.filter(
        Flight.source.ilike(src_like),
        Flight.destination.ilike(dst_like),
        Flight.departure_time >= start_of_day,
        Flight.departure_time <= end_of_day,
        Flight.departure_time > now_dt,  # Exclude already departed flights
        Flight.available_seats >= passenger_count,  # Sufficient seat capacity
        Flight.flight_status.notin_(['Cancelled', 'Inactive'])  # Only Active/Scheduled/On Time
    ).order_by(Flight.departure_time.asc())

    return query.all()


@app.route('/api/flights/search', methods=['GET'])
def api_flights_search():
    """
    Passenger flight search API supporting One Way and Round Trip journeys.
    Validates parameters, rejects past dates/invalid counts, queries the flights table,
    and returns matching active flights.
    """
    trip_type = (request.args.get('trip_type') or request.args.get('tripType') or 'one-way').strip().lower()
    source = (request.args.get('source') or request.args.get('origin') or '').strip()
    destination = (request.args.get('destination') or '').strip()
    dept_date_str = (request.args.get('departure_date') or request.args.get('departureDate') or '').strip()
    return_date_str = (request.args.get('return_date') or request.args.get('returnDate') or '').strip()
    raw_passengers = request.args.get('passengers') or request.args.get('total_passengers') or '1'

    # 1. Parameter presence validation
    if not source:
        return jsonify({"status": "error", "message": "Source origin is required."}), 400
    if not destination:
        return jsonify({"status": "error", "message": "Destination is required."}), 400
    if not dept_date_str:
        return jsonify({"status": "error", "message": "Departure date is required."}), 400

    # 2. Source and Destination must differ
    if source.lower() == destination.lower():
        return jsonify({"status": "error", "message": "Source and destination cannot be identical."}), 400

    # 3. Passenger count validation
    try:
        passenger_count = int(raw_passengers)
        if passenger_count <= 0 or passenger_count > 9:
            return jsonify({"status": "error", "message": "Passenger count must be between 1 and 9."}), 400
    except (ValueError, TypeError):
        return jsonify({"status": "error", "message": "Valid integer passenger count is required."}), 400

    # 4. Date validation
    try:
        dept_date = datetime.strptime(dept_date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({"status": "error", "message": "Invalid departure date format. Use YYYY-MM-DD."}), 400

    now = datetime.now()
    today = now.date()

    if dept_date < today:
        return jsonify({"status": "error", "message": "Departure date cannot be in the past."}), 400

    # Round Trip validations
    is_round_trip = (trip_type == 'round-trip')
    return_date = None
    if is_round_trip:
        if not return_date_str:
            return jsonify({"status": "error", "message": "Return date is required for round-trip searches."}), 400
        try:
            return_date = datetime.strptime(return_date_str, '%Y-%m-%d').date()
        except ValueError:
            return jsonify({"status": "error", "message": "Invalid return date format. Use YYYY-MM-DD."}), 400

        if return_date <= dept_date:
            return jsonify({"status": "error", "message": "Return date must be strictly after departure date."}), 400

    try:
        # Outbound query: Source -> Destination on Departure Date
        outbound_flights = _search_flights_direction(source, destination, dept_date, passenger_count, now)
        outbound_list = [_format_flight_payload(f, passenger_count) for f in outbound_flights]

        # Return query: Destination -> Source on Return Date (opposite direction)
        return_list = []
        if is_round_trip and return_date:
            return_flights = _search_flights_direction(destination, source, return_date, passenger_count, now)
            return_list = [_format_flight_payload(f, passenger_count) for f in return_flights]

        return jsonify({
            "status": "success",
            "trip_type": trip_type,
            "passengers": passenger_count,
            "departure_date": dept_date_str,
            "return_date": return_date_str if is_round_trip else None,
            "source": source,
            "destination": destination,
            "outbound": {
                "count": len(outbound_list),
                "flights": outbound_list,
                "has_flights": len(outbound_list) > 0
            },
            "return": {
                "count": len(return_list),
                "flights": return_list,
                "has_flights": len(return_list) > 0
            } if is_round_trip else None
        }), 200

    except Exception as e:
        app.logger.error(f"Error during flight search: {e}")
        return jsonify({"status": "error", "message": "An error occurred while searching for flights."}), 500


# =============================================================================
# 8. Seat Map & Availability API (Phase 8)
# =============================================================================
# Seat pricing configuration by cabin and seat type
SEAT_PRICING = {
    'economy': {
        'standard': 0.0,
        'extra-legroom': 500.0,
        'emergency-exit': 700.0
    },
    'business': {
        'business-suite': 0.0
    }
}

# Aircraft Seat Specifications
ECONOMY_SEAT_CONFIG = [
    # Row 10: Extra-legroom Bulkhead (₹500)
    {'code': '10A', 'col': 'A', 'position': 'window', 'category': 'extra-legroom', 'price': 500, 'row': 10},
    {'code': '10B', 'col': 'B', 'position': 'middle', 'category': 'extra-legroom', 'price': 500, 'row': 10},
    {'code': '10C', 'col': 'C', 'position': 'aisle', 'category': 'extra-legroom', 'price': 500, 'row': 10},
    {'code': '10D', 'col': 'D', 'position': 'aisle', 'category': 'extra-legroom', 'price': 500, 'row': 10},
    {'code': '10E', 'col': 'E', 'position': 'middle', 'category': 'extra-legroom', 'price': 500, 'row': 10},
    {'code': '10F', 'col': 'F', 'position': 'window', 'category': 'extra-legroom', 'price': 500, 'row': 10},
    # Row 11: Extra-legroom (₹500)
    {'code': '11A', 'col': 'A', 'position': 'window', 'category': 'extra-legroom', 'price': 500, 'row': 11},
    {'code': '11B', 'col': 'B', 'position': 'middle', 'category': 'extra-legroom', 'price': 500, 'row': 11},
    {'code': '11C', 'col': 'C', 'position': 'aisle', 'category': 'extra-legroom', 'price': 500, 'row': 11},
    {'code': '11D', 'col': 'D', 'position': 'aisle', 'category': 'extra-legroom', 'price': 500, 'row': 11},
    {'code': '11E', 'col': 'E', 'position': 'middle', 'category': 'extra-legroom', 'price': 500, 'row': 11},
    {'code': '11F', 'col': 'F', 'position': 'window', 'category': 'extra-legroom', 'price': 500, 'row': 11},
    # Row 12: Standard Economy (₹0)
    {'code': '12A', 'col': 'A', 'position': 'window', 'category': 'standard', 'price': 0, 'row': 12},
    {'code': '12B', 'col': 'B', 'position': 'middle', 'category': 'standard', 'price': 0, 'row': 12},
    {'code': '12C', 'col': 'C', 'position': 'aisle', 'category': 'standard', 'price': 0, 'row': 12},
    {'code': '12D', 'col': 'D', 'position': 'aisle', 'category': 'standard', 'price': 0, 'row': 12},
    {'code': '12E', 'col': 'E', 'position': 'middle', 'category': 'standard', 'price': 0, 'row': 12},
    {'code': '12F', 'col': 'F', 'position': 'window', 'category': 'standard', 'price': 0, 'row': 12},
    # Row 14: Standard Economy (₹0)
    {'code': '14A', 'col': 'A', 'position': 'window', 'category': 'standard', 'price': 0, 'row': 14},
    {'code': '14B', 'col': 'B', 'position': 'middle', 'category': 'standard', 'price': 0, 'row': 14},
    {'code': '14C', 'col': 'C', 'position': 'aisle', 'category': 'standard', 'price': 0, 'row': 14},
    {'code': '14D', 'col': 'D', 'position': 'aisle', 'category': 'standard', 'price': 0, 'row': 14},
    {'code': '14E', 'col': 'E', 'position': 'middle', 'category': 'standard', 'price': 0, 'row': 14},
    {'code': '14F', 'col': 'F', 'position': 'window', 'category': 'standard', 'price': 0, 'row': 14},
    # Row 15: Emergency Exit Row (₹700)
    {'code': '15A', 'col': 'A', 'position': 'window', 'category': 'emergency-exit', 'price': 700, 'row': 15, 'isExit': True},
    {'code': '15B', 'col': 'B', 'position': 'middle', 'category': 'emergency-exit', 'price': 700, 'row': 15, 'isExit': True},
    {'code': '15C', 'col': 'C', 'position': 'aisle', 'category': 'emergency-exit', 'price': 700, 'row': 15, 'isExit': True},
    {'code': '15D', 'col': 'D', 'position': 'aisle', 'category': 'emergency-exit', 'price': 700, 'row': 15, 'isExit': True},
    {'code': '15E', 'col': 'E', 'position': 'middle', 'category': 'emergency-exit', 'price': 700, 'row': 15, 'isExit': True},
    {'code': '15F', 'col': 'F', 'position': 'window', 'category': 'emergency-exit', 'price': 700, 'row': 15, 'isExit': True},
    # Rows 16 - 20: Standard Economy (₹0)
    {'code': '16A', 'col': 'A', 'position': 'window', 'category': 'standard', 'price': 0, 'row': 16},
    {'code': '16B', 'col': 'B', 'position': 'middle', 'category': 'standard', 'price': 0, 'row': 16},
    {'code': '16C', 'col': 'C', 'position': 'aisle', 'category': 'standard', 'price': 0, 'row': 16},
    {'code': '16D', 'col': 'D', 'position': 'aisle', 'category': 'standard', 'price': 0, 'row': 16},
    {'code': '16E', 'col': 'E', 'position': 'middle', 'category': 'standard', 'price': 0, 'row': 16},
    {'code': '16F', 'col': 'F', 'position': 'window', 'category': 'standard', 'price': 0, 'row': 16},
    {'code': '17A', 'col': 'A', 'position': 'window', 'category': 'standard', 'price': 0, 'row': 17},
    {'code': '17B', 'col': 'B', 'position': 'middle', 'category': 'standard', 'price': 0, 'row': 17},
    {'code': '17C', 'col': 'C', 'position': 'aisle', 'category': 'standard', 'price': 0, 'row': 17},
    {'code': '17D', 'col': 'D', 'position': 'aisle', 'category': 'standard', 'price': 0, 'row': 17},
    {'code': '17E', 'col': 'E', 'position': 'middle', 'category': 'standard', 'price': 0, 'row': 17},
    {'code': '17F', 'col': 'F', 'position': 'window', 'category': 'standard', 'price': 0, 'row': 17},
    {'code': '18A', 'col': 'A', 'position': 'window', 'category': 'standard', 'price': 0, 'row': 18},
    {'code': '18B', 'col': 'B', 'position': 'middle', 'category': 'standard', 'price': 0, 'row': 18},
    {'code': '18C', 'col': 'C', 'position': 'aisle', 'category': 'standard', 'price': 0, 'row': 18},
    {'code': '18D', 'col': 'D', 'position': 'aisle', 'category': 'standard', 'price': 0, 'row': 18},
    {'code': '18E', 'col': 'E', 'position': 'middle', 'category': 'standard', 'price': 0, 'row': 18},
    {'code': '18F', 'col': 'F', 'position': 'window', 'category': 'standard', 'price': 0, 'row': 18},
    {'code': '19A', 'col': 'A', 'position': 'window', 'category': 'standard', 'price': 0, 'row': 19},
    {'code': '19B', 'col': 'B', 'position': 'middle', 'category': 'standard', 'price': 0, 'row': 19},
    {'code': '19C', 'col': 'C', 'position': 'aisle', 'category': 'standard', 'price': 0, 'row': 19},
    {'code': '19D', 'col': 'D', 'position': 'aisle', 'category': 'standard', 'price': 0, 'row': 19},
    {'code': '19E', 'col': 'E', 'position': 'middle', 'category': 'standard', 'price': 0, 'row': 19},
    {'code': '19F', 'col': 'F', 'position': 'window', 'category': 'standard', 'price': 0, 'row': 19},
    {'code': '20A', 'col': 'A', 'position': 'window', 'category': 'standard', 'price': 0, 'row': 20},
    {'code': '20B', 'col': 'B', 'position': 'middle', 'category': 'standard', 'price': 0, 'row': 20},
    {'code': '20C', 'col': 'C', 'position': 'aisle', 'category': 'standard', 'price': 0, 'row': 20},
    {'code': '20D', 'col': 'D', 'position': 'aisle', 'category': 'standard', 'price': 0, 'row': 20},
    {'code': '20E', 'col': 'E', 'position': 'middle', 'category': 'standard', 'price': 0, 'row': 20},
    {'code': '20F', 'col': 'F', 'position': 'window', 'category': 'standard', 'price': 0, 'row': 20}
]

BUSINESS_SEAT_CONFIG = [
    # Rows 1 - 6: Business Suites (₹0 additional)
    {'code': '1A', 'col': 'A', 'position': 'window', 'category': 'business-suite', 'price': 0, 'row': 1},
    {'code': '1E', 'col': 'E', 'position': 'middle', 'category': 'business-suite', 'price': 0, 'row': 1},
    {'code': '1F', 'col': 'F', 'position': 'middle', 'category': 'business-suite', 'price': 0, 'row': 1},
    {'code': '1K', 'col': 'K', 'position': 'window', 'category': 'business-suite', 'price': 0, 'row': 1},
    {'code': '2A', 'col': 'A', 'position': 'window', 'category': 'business-suite', 'price': 0, 'row': 2},
    {'code': '2E', 'col': 'E', 'position': 'middle', 'category': 'business-suite', 'price': 0, 'row': 2},
    {'code': '2F', 'col': 'F', 'position': 'middle', 'category': 'business-suite', 'price': 0, 'row': 2},
    {'code': '2K', 'col': 'K', 'position': 'window', 'category': 'business-suite', 'price': 0, 'row': 2},
    {'code': '3A', 'col': 'A', 'position': 'window', 'category': 'business-suite', 'price': 0, 'row': 3},
    {'code': '3E', 'col': 'E', 'position': 'middle', 'category': 'business-suite', 'price': 0, 'row': 3},
    {'code': '3F', 'col': 'F', 'position': 'middle', 'category': 'business-suite', 'price': 0, 'row': 3},
    {'code': '3K', 'col': 'K', 'position': 'window', 'category': 'business-suite', 'price': 0, 'row': 3},
    {'code': '4A', 'col': 'A', 'position': 'window', 'category': 'business-suite', 'price': 0, 'row': 4},
    {'code': '4E', 'col': 'E', 'position': 'middle', 'category': 'business-suite', 'price': 0, 'row': 4},
    {'code': '4F', 'col': 'F', 'position': 'middle', 'category': 'business-suite', 'price': 0, 'row': 4},
    {'code': '4K', 'col': 'K', 'position': 'window', 'category': 'business-suite', 'price': 0, 'row': 4},
    {'code': '5A', 'col': 'A', 'position': 'window', 'category': 'business-suite', 'price': 0, 'row': 5},
    {'code': '5E', 'col': 'E', 'position': 'middle', 'category': 'business-suite', 'price': 0, 'row': 5},
    {'code': '5F', 'col': 'F', 'position': 'middle', 'category': 'business-suite', 'price': 0, 'row': 5},
    {'code': '5K', 'col': 'K', 'position': 'window', 'category': 'business-suite', 'price': 0, 'row': 5},
    {'code': '6A', 'col': 'A', 'position': 'window', 'category': 'business-suite', 'price': 0, 'row': 6},
    {'code': '6E', 'col': 'E', 'position': 'middle', 'category': 'business-suite', 'price': 0, 'row': 6},
    {'code': '6F', 'col': 'F', 'position': 'middle', 'category': 'business-suite', 'price': 0, 'row': 6},
    {'code': '6K', 'col': 'K', 'position': 'window', 'category': 'business-suite', 'price': 0, 'row': 6}
]

# Quick lookup sets
ALL_ECONOMY_CODES = {s['code']: s for s in ECONOMY_SEAT_CONFIG}
ALL_BUSINESS_CODES = {s['code']: s for s in BUSINESS_SEAT_CONFIG}

# Hold duration for temporary seat reservations (configurable, default: 15 minutes)
HOLD_DURATION_MINUTES = int(os.environ.get('AEROVISTA_HOLD_DURATION_MINUTES', 15))


def cleanup_expired_reservations():
    """
    Finds pending bookings whose hold duration has elapsed (default: 15 minutes).
    Releases their held seats back to 'Available', restores available_seats on the flight,
    and marks the booking as 'Cancelled' with payment_status 'Failed'.
    """
    try:
        now_utc = datetime.now(timezone.utc)
        pending_bookings = Booking.query.filter_by(booking_status='Pending').all()
        updated = False
        for b in pending_bookings:
            b_date = b.booking_date
            if b_date.tzinfo is None:
                b_date = b_date.replace(tzinfo=timezone.utc)
            if (now_utc - b_date).total_seconds() > (HOLD_DURATION_MINUTES * 60):
                for seat in b.seats:
                    seat.release()
                if b.flight:
                    b.flight.available_seats += len(b.passengers)
                b.booking_status = 'Cancelled'
                b.payment_status = 'Failed'
                updated = True
        if updated:
            db.session.commit()
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error cleaning up expired reservations: {e}")


@app.route('/api/flights/<int:flight_id>/seats', methods=['GET'])
def get_flight_seats(flight_id):
    """
    Returns the real-time seat availability for the given flight.
    Cross-checks active database reservations (Occupied seats) from the 'seats' table.
    """
    cleanup_expired_reservations()
    flight = db.session.get(Flight, flight_id)
    if not flight:
        return jsonify({"status": "error", "message": "Flight not found."}), 404

    cabin_requested = (request.args.get('cabin') or '').lower().strip()

    # Query currently occupied or held seats for this flight in the database
    db_occupied_seats = Seat.query.filter_by(flight_id=flight.id).filter(Seat.seat_status.in_(['Occupied', 'Held'])).all()
    occupied_seat_codes = set(s.seat_number for s in db_occupied_seats)

    # Format list
    def _format_seat_list(configs):
        res = []
        for s in configs:
            is_occupied = s['code'] in occupied_seat_codes
            res.append({
                "code": s['code'],
                "row": s['row'],
                "col": s['col'],
                "position": s['position'],
                "category": s['category'],
                "price": s['price'],
                "occupied": is_occupied,
                "isExit": s.get('isExit', False)
            })
        return res

    resp_data = {
        "status": "success",
        "flight_id": flight.id,
        "flightNumber": flight.flight_number,
        "totalSeats": flight.total_seat_capacity,
        "availableSeats": flight.available_seats,
        "occupiedCount": len(occupied_seat_codes),
        "occupiedSeats": list(occupied_seat_codes)
    }

    if cabin_requested == 'business':
        resp_data["business"] = _format_seat_list(BUSINESS_SEAT_CONFIG)
    elif cabin_requested == 'economy':
        resp_data["economy"] = _format_seat_list(ECONOMY_SEAT_CONFIG)
    else:
        resp_data["business"] = _format_seat_list(BUSINESS_SEAT_CONFIG)
        resp_data["economy"] = _format_seat_list(ECONOMY_SEAT_CONFIG)

    return jsonify(resp_data), 200


# =============================================================================
# 9. Booking Creation API (Phase 8)
# =============================================================================
import string
import random

def _generate_unique_pnr():
    """Generates a guaranteed unique 6-character alphanumeric PNR with 'AV-' prefix."""
    for _ in range(20):
        code = 'AV-' + ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        if not Booking.query.filter_by(pnr=code).first():
            return code
    # Fallback with timestamp
    return 'AV-' + hex(int(datetime.now().timestamp()))[-6:].upper()


@app.route('/api/bookings', methods=['POST'])
def create_booking():
    """
    Creates a new flight reservation in the SQLite database.
    - Validates flight existence and active status.
    - Validates passenger manifest (names, DOB, gender, nationality, passport/ID, email, phone).
    - Validates seat availability using database row checks.
    - Calculates total fare strictly from database ticket fare and seat fees.
    - Decrements available_seats count on the Flight record.
    - Uses an atomic database transaction (commits all or rolls back).
    - Sets booking payment status to 'Pending'.
    """
    cleanup_expired_reservations()
    payload = request.get_json(silent=True)
    if not payload:
        return jsonify({"status": "error", "message": "Invalid JSON payload."}), 400

    # Determine user session if logged in
    user_id = session.get('passenger_id') or session.get('user_id')
    if user_id:
        logged_user = db.session.get(User, user_id)
        if logged_user and logged_user.account_status != 'Active':
            return jsonify({
                "status": "error",
                "message": f"Your passenger account is {logged_user.account_status.lower()}. You cannot create new flight reservations."
            }), 403

    # Detect journey structure: one-way or round-trip
    # Can accept either unified payload or breakdown by legs
    outbound_data = payload.get('outbound')
    return_data = payload.get('return')
    passengers_data = payload.get('passengers') or []

    # If payload provided at top level for a simple one-way:
    if not outbound_data and payload.get('flight_id'):
        outbound_data = {
            "flight_id": payload.get('flight_id'),
            "cabin": payload.get('cabinClass') or payload.get('cabin') or 'economy'
        }

    if not outbound_data or not outbound_data.get('flight_id'):
        return jsonify({"status": "error", "message": "Outbound flight details are required."}), 400

    if not passengers_data or not isinstance(passengers_data, list) or len(passengers_data) == 0:
        return jsonify({"status": "error", "message": "At least one passenger must be provided in the manifest."}), 400

    passenger_count = len(passengers_data)

    # Validate passenger details fields
    validated_passengers = []
    for idx, p in enumerate(passengers_data, start=1):
        full_name = (p.get('fullName') or p.get('full_name') or p.get('name') or '').strip()
        if not full_name:
            return jsonify({"status": "error", "message": f"Full name is required for Passenger {idx}."}), 400

        dob_str = (p.get('dateOfBirth') or p.get('date_of_birth') or p.get('dob') or '').strip()
        dob = None
        if dob_str:
            try:
                dob = datetime.strptime(dob_str, '%Y-%m-%d').date()
            except ValueError:
                return jsonify({"status": "error", "message": f"Invalid date of birth format for Passenger {idx}. Expected YYYY-MM-DD."}), 400

        gender = (p.get('gender') or '').strip()
        nationality = (p.get('nationality') or '').strip()
        id_type = (p.get('identificationType') or p.get('identification_type') or 'Passport').strip()
        id_number = (p.get('identificationNumber') or p.get('identification_number') or '').strip()

        # Primary passenger (Passenger 1) contact validation
        email = (p.get('contactEmail') or p.get('contact_email') or p.get('email') or '').strip().lower()
        phone = (p.get('contactPhone') or p.get('contact_phone') or p.get('phone') or '').strip()

        if idx == 1:
            if not email or '@' not in email:
                return jsonify({"status": "error", "message": "A valid contact email address is required for Passenger 1."}), 400
            if not phone:
                return jsonify({"status": "error", "message": "A contact mobile number is required for Passenger 1."}), 400

        # Seat assignments
        seat_alloc = p.get('seatAllocation') or p.get('seats') or {}
        outbound_seat = seat_alloc.get('outbound') or p.get('outboundSeat') or p.get('seat_number') or p.get('outbound_seat')
        return_seat = seat_alloc.get('return') or p.get('returnSeat') or p.get('return_seat')

        # Format seat string / dict
        out_code = outbound_seat.get('code') if isinstance(outbound_seat, dict) else (outbound_seat or None)
        ret_code = return_seat.get('code') if isinstance(return_seat, dict) else (return_seat or None)

        validated_passengers.append({
            "full_name": full_name,
            "dob": dob,
            "gender": gender,
            "nationality": nationality,
            "identification_type": id_type,
            "identification_number": id_number,
            "contact_email": email if email else None,
            "contact_phone": phone if phone else None,
            "outbound_seat_code": out_code,
            "return_seat_code": ret_code
        })

    # Prepare legs to book: Outbound (always) + Return (if round trip)
    legs_to_process = []
    
    # Process Outbound Leg
    out_flight_id = outbound_data.get('flight_id')
    out_cabin = (outbound_data.get('cabin') or 'economy').lower()
    legs_to_process.append({
        "type": "outbound",
        "flight_id": out_flight_id,
        "cabin": out_cabin,
        "seat_key": "outbound_seat_code"
    })

    # Process Return Leg if present
    is_round_trip = bool(return_data and return_data.get('flight_id'))
    if is_round_trip:
        ret_flight_id = return_data.get('flight_id')
        ret_cabin = (return_data.get('cabin') or 'economy').lower()
        legs_to_process.append({
            "type": "return",
            "flight_id": ret_flight_id,
            "cabin": ret_cabin,
            "seat_key": "return_seat_code"
        })

    # Atomic Booking Creation inside Transaction
    try:
        created_bookings = []
        overall_total_fare = Decimal('0.00')

        for leg in legs_to_process:
            flight = db.session.get(Flight, leg["flight_id"])
            if not flight:
                db.session.rollback()
                return jsonify({"status": "error", "message": f"Flight ID {leg['flight_id']} not found."}), 404

            if flight.flight_status in ('Cancelled', 'Delayed - Indefinite'):
                db.session.rollback()
                return jsonify({"status": "error", "message": f"Flight {flight.flight_number} is currently {flight.flight_status} and cannot be booked."}), 400

            if flight.available_seats < passenger_count:
                db.session.rollback()
                return jsonify({"status": "error", "message": f"Insufficient available seats on flight {flight.flight_number}. Required {passenger_count}, available {flight.available_seats}."}), 400

            # Calculate base ticket fare
            base_ticket_fare = Decimal(str(flight.ticket_fare))
            if leg["cabin"] in ('business', 'first'):
                leg_ticket_fare = round(base_ticket_fare * Decimal('2.6'), 2)
                allowed_seat_configs = ALL_BUSINESS_CODES
            else:
                leg_ticket_fare = base_ticket_fare
                allowed_seat_configs = ALL_ECONOMY_CODES

            leg_total_amount = leg_ticket_fare * passenger_count

            # Collect requested seats for this leg
            requested_seat_codes = [p[leg["seat_key"]] for p in validated_passengers if p[leg["seat_key"]]]

            # Ensure no duplicate seat codes within this booking request
            if len(requested_seat_codes) != len(set(requested_seat_codes)):
                db.session.rollback()
                return jsonify({"status": "error", "message": f"Duplicate seat selections detected on {leg['type']} flight."}), 400

            # Verify that each requested seat belongs to the selected cabin and check availability in DB
            leg_seat_charges = Decimal('0.00')
            for seat_code in requested_seat_codes:
                if seat_code not in allowed_seat_configs:
                    db.session.rollback()
                    return jsonify({"status": "error", "message": f"Seat {seat_code} is not valid for {leg['cabin'].title()} class on flight {flight.flight_number}."}), 400

                seat_spec = allowed_seat_configs[seat_code]
                leg_seat_charges += Decimal(str(seat_spec.get('price', 0)))

                # Check if already occupied or held in database
                existing_seat = Seat.query.filter_by(
                    flight_id=flight.id,
                    seat_number=seat_code
                ).filter(Seat.seat_status.in_(['Occupied', 'Held'])).first()
                if existing_seat:
                    db.session.rollback()
                    return jsonify({"status": "error", "message": f"Seat {seat_code} on flight {flight.flight_number} is already occupied or reserved. Please select an available seat."}), 409

            leg_total_amount += leg_seat_charges

            # Generate unique PNR for this booking
            pnr = _generate_unique_pnr()

            # Create Booking instance
            booking = Booking(
                pnr=pnr,
                user_id=user_id,
                flight_id=flight.id,
                total_amount=leg_total_amount,
                booking_status='Pending',
                payment_status='Pending'
            )
            db.session.add(booking)
            db.session.flush() # populate booking.id

            # Create Passengers and assign Seats
            for p_dict in validated_passengers:
                passenger = Passenger(
                    booking_id=booking.id,
                    full_name=p_dict["full_name"],
                    date_of_birth=p_dict["dob"],
                    gender=p_dict["gender"],
                    nationality=p_dict["nationality"],
                    identification_type=p_dict["identification_type"],
                    identification_number=p_dict["identification_number"],
                    contact_email=p_dict["contact_email"],
                    contact_phone=p_dict["contact_phone"]
                )
                db.session.add(passenger)
                db.session.flush() # populate passenger.id

                seat_code = p_dict[leg["seat_key"]]
                if seat_code:
                    seat_spec = allowed_seat_configs[seat_code]
                    seat = Seat.query.filter_by(flight_id=flight.id, seat_number=seat_code).first()
                    if not seat:
                        seat = Seat(
                            flight_id=flight.id,
                            seat_number=seat_code,
                            cabin_class=leg["cabin"].title(),
                            seat_type=seat_spec.get('category', 'Standard').replace('-', ' ').title(),
                            seat_status='Held',
                            booking_id=booking.id,
                            passenger_id=passenger.id
                        )
                        db.session.add(seat)
                    else:
                        seat.booking_id = booking.id
                        seat.passenger_id = passenger.id
                        seat.seat_status = 'Held'

            # Decrement flight available seats
            flight.available_seats -= passenger_count

            overall_total_fare += leg_total_amount
            created_bookings.append({
                "booking_id": booking.id,
                "pnr": booking.pnr,
                "flight_id": flight.id,
                "flight_number": flight.flight_number,
                "route": f"{flight.source} -> {flight.destination}",
                "cabin": leg["cabin"].title(),
                "passengers_count": passenger_count,
                "total_amount": float(leg_total_amount),
                "booking_status": booking.booking_status,
                "payment_status": booking.payment_status
            })

        # Commit transaction atomically
        db.session.commit()

        # Primary PNR is the outbound booking PNR
        primary_pnr = created_bookings[0]["pnr"]

        return jsonify({
            "status": "success",
            "message": "Flight booking created successfully.",
            "pnr": primary_pnr,
            "booking_reference": primary_pnr,
            "bookings": created_bookings,
            "total_fare": float(overall_total_fare),
            "payment_status": "Pending",
            "is_round_trip": is_round_trip
        }), 201

    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Booking creation error: {e}")
        return jsonify({"status": "error", "message": f"Failed to complete reservation: {str(e)}"}), 500


# =============================================================================
# 10. Booking Inspection API (GET /api/bookings/<pnr>)
# =============================================================================
@app.route('/api/bookings/<string:pnr>', methods=['GET'])
def get_booking_details(pnr):
    """
    Retrieves complete booking details by PNR reference.
    Includes flight details, passenger list, seat numbers, latest payment info,
    and hold expiry status.
    """
    cleanup_expired_reservations()

    pnr_clean = pnr.strip().upper()
    booking = Booking.query.filter_by(pnr=pnr_clean).first()
    if not booking:
        return jsonify({"status": "error", "message": f"Booking with PNR {pnr_clean} not found."}), 404

    # Verification: If passenger name / last name query param is supplied (e.g. from Manage Booking)
    req_name = (request.args.get('lastName') or request.args.get('last_name') or request.args.get('passengerName') or '').strip().lower()
    if req_name:
        name_matched = False
        for p in booking.passengers:
            p_full = (p.full_name or '').strip().lower()
            parts = p_full.split()
            if parts and (parts[-1] == req_name or p_full == req_name or req_name in parts or req_name in p_full or p_full in req_name):
                name_matched = True
                break
        if not name_matched and booking.user and booking.user.full_name:
            u_full = booking.user.full_name.strip().lower()
            parts = u_full.split()
            if parts and (parts[-1] == req_name or u_full == req_name or req_name in parts or req_name in u_full or u_full in req_name):
                name_matched = True

        if not name_matched:
            return jsonify({
                "status": "error",
                "message": f"Verification failed: Passenger name '{req_name}' does not match the passenger manifest for booking reference {pnr_clean}."
            }), 404
    else:
        # Check if passenger ownership applies when no name is supplied
        is_admin = bool(_get_authenticated_admin()) if '_get_authenticated_admin' in globals() else bool(session.get('admin_id'))
        current_user_id = session.get('passenger_id') or session.get('user_id')
        if not is_admin and current_user_id and booking.user_id and booking.user_id != current_user_id:
            return jsonify({"status": "error", "message": "Unauthorized access to this booking."}), 403

    def _format_booking_dict(b):
        flight = b.flight
        passengers_list = []
        for p in b.passengers:
            assigned_seat = p.seat.seat_number if p.seat else None
            seat_class = p.seat.cabin_class if p.seat else None
            passengers_list.append({
                "id": p.id,
                "full_name": p.full_name,
                "date_of_birth": p.date_of_birth.strftime('%Y-%m-%d') if p.date_of_birth else None,
                "gender": p.gender,
                "nationality": p.nationality,
                "identification_type": p.identification_type,
                "identification_number": p.identification_number,
                "contact_email": p.contact_email,
                "contact_phone": p.contact_phone,
                "seat_number": assigned_seat,
                "cabin_class": seat_class
            })

        latest_payment = Payment.query.filter_by(booking_id=b.id).order_by(Payment.payment_date.desc()).first()
        payment_dict = None
        if latest_payment:
            payment_dict = {
                "id": latest_payment.id,
                "payment_method": latest_payment.payment_method,
                "amount": float(latest_payment.amount),
                "transaction_reference": latest_payment.transaction_reference,
                "payment_status": latest_payment.payment_status,
                "payment_date": latest_payment.payment_date.strftime('%Y-%m-%d %H:%M:%S')
            }

        # Calculate remaining hold seconds if still Pending
        now_utc = datetime.now(timezone.utc)
        b_date = b.booking_date
        if b_date.tzinfo is None:
            b_date = b_date.replace(tzinfo=timezone.utc)
        elapsed = (now_utc - b_date).total_seconds()
        remaining_hold = max(0, int((HOLD_DURATION_MINUTES * 60) - elapsed))

        return {
            "id": b.id,
            "pnr": b.pnr,
            "booking_date": b.booking_date.strftime('%Y-%m-%d %H:%M:%S'),
            "total_amount": float(b.total_amount),
            "booking_status": b.booking_status,
            "payment_status": b.payment_status,
            "hold_remaining_seconds": remaining_hold if b.booking_status == 'Pending' else 0,
            "flight": {
                "id": flight.id,
                "flight_number": flight.flight_number,
                "airline": flight.airline,
                "source": flight.source,
                "destination": flight.destination,
                "departure_time": flight.departure_time.strftime('%Y-%m-%d %H:%M:%S'),
                "arrival_time": flight.arrival_time.strftime('%Y-%m-%d %H:%M:%S'),
                "duration": flight.duration,
                "aircraft": flight.aircraft,
                "flight_status": flight.flight_status
            },
            "passengers": passengers_list,
            "payment": payment_dict
        }

    resp = {
        "status": "success",
        "booking": _format_booking_dict(booking)
    }

    # Check for return booking if requested
    return_pnr = request.args.get('return_pnr')
    if return_pnr:
        ret_booking = Booking.query.filter_by(pnr=return_pnr.strip().upper()).first()
        if ret_booking:
            resp["return_booking"] = _format_booking_dict(ret_booking)

    return jsonify(resp), 200


# =============================================================================
# 11. Simulated Payment Processing API (Phase 9)
# =============================================================================
@app.route('/api/payments', methods=['POST'])
@app.route('/api/bookings/<string:pnr>/pay', methods=['POST'])
def process_payment(pnr=None):
    """
    Simulated Payment Processing Endpoint (Phase 9)
    - Validates booking existence and pending status.
    - Prevents double payment/confirmation.
    - Checks temporary seat hold expiration (15-min limit).
    - Verifies amount using database records (never trusts frontend values).
    - Handles 'success' and 'failure' simulation scenarios.
    - Records transactions in the 'payments' table.
    - On success: updates booking to 'Confirmed', payment to 'Paid', finalizes seats.
    - On failure: keeps booking 'Pending' (unless expired), allows retry.
    """
    cleanup_expired_reservations()

    payload = request.get_json(silent=True) or {}
    
    # Extract PNR(s)
    pnr_candidates = []
    if pnr:
        pnr_candidates.append(pnr.strip().upper())
    if payload.get('pnr'):
        pnr_candidates.append(payload.get('pnr').strip().upper())
    if payload.get('pnrs') and isinstance(payload.get('pnrs'), list):
        for p in payload.get('pnrs'):
            if p and isinstance(p, str):
                pnr_candidates.append(p.strip().upper())
    
    # Deduplicate while preserving order
    seen_pnrs = set()
    pnr_list = []
    for p in pnr_candidates:
        if p and p not in seen_pnrs:
            seen_pnrs.add(p)
            pnr_list.append(p)
            
    if not pnr_list:
        return jsonify({"status": "error", "message": "PNR reference is required to process payment."}), 400

    bookings = []
    for p_code in pnr_list:
        b = Booking.query.filter_by(pnr=p_code).first()
        if not b:
            return jsonify({"status": "error", "message": f"Booking with PNR {p_code} not found."}), 404

        # Ownership check if passenger is logged in
        current_user_id = session.get('passenger_id') or session.get('user_id')
        if current_user_id and b.user_id and b.user_id != current_user_id:
            return jsonify({"status": "error", "message": "Unauthorized: You do not have permission to pay for this booking."}), 403

        if b.booking_status == 'Confirmed' or b.payment_status == 'Paid':
            return jsonify({"status": "error", "message": f"Booking {p_code} has already been paid and confirmed."}), 400

        if b.booking_status == 'Cancelled':
            return jsonify({"status": "error", "message": f"Booking {p_code} has been cancelled or has expired. Please initiate a new flight reservation."}), 400

        # Check if the temporary seat hold has expired
        now_utc = datetime.now(timezone.utc)
        b_date = b.booking_date
        if b_date.tzinfo is None:
            b_date = b_date.replace(tzinfo=timezone.utc)
        if (now_utc - b_date).total_seconds() > (HOLD_DURATION_MINUTES * 60):
            # Expire this booking and release seats
            for seat in b.seats:
                seat.release()
            if b.flight:
                b.flight.available_seats += len(b.passengers)
            b.booking_status = 'Cancelled'
            b.payment_status = 'Failed'
            db.session.commit()
            return jsonify({
                "status": "error",
                "message": f"The temporary seat reservation for booking {p_code} has expired (15-minute hold limit). Selected seats have been released."
            }), 400

        bookings.append(b)

    # Calculate actual total amount from database
    total_amount = sum(Decimal(str(b.total_amount)) for b in bookings)
    
    # Extract method and outcome
    payment_method = (payload.get('payment_method') or payload.get('paymentMethod') or 'Credit Card').strip()
    if payment_method.lower() in ('credit', 'credit card'):
        payment_method = 'Credit Card'
    elif payment_method.lower() in ('debit', 'debit card'):
        payment_method = 'Debit Card'
    elif payment_method.lower() in ('upi', 'upi / qr'):
        payment_method = 'UPI'

    simulation_outcome = (payload.get('simulation_outcome') or payload.get('simulationOutcome') or 'success').lower().strip()

    try:
        if simulation_outcome == 'success':
            txn_ref = f"TXN-{int(datetime.now().timestamp())}-{uuid.uuid4().hex[:6].upper()}"
            
            for b in bookings:
                b_txn_ref = txn_ref if len(bookings) == 1 else f"{txn_ref}-{b.id}"
                payment = Payment(
                    booking_id=b.id,
                    payment_method=payment_method,
                    amount=b.total_amount,
                    transaction_reference=b_txn_ref,
                    payment_status='Successful',
                    payment_date=datetime.now(timezone.utc)
                )
                db.session.add(payment)
                b.booking_status = 'Confirmed'
                b.payment_status = 'Paid'
                for seat in b.seats:
                    seat.seat_status = 'Occupied'
            
            db.session.commit()

            return jsonify({
                "status": "success",
                "message": "Payment authorized and booking confirmed successfully.",
                "transaction_reference": txn_ref,
                "payment_status": "Successful",
                "booking_status": "Confirmed",
                "amount_paid": float(total_amount),
                "primary_pnr": bookings[0].pnr,
                "pnrs": [b.pnr for b in bookings],
                "is_simulated": True
            }), 200

        else:
            # Simulated Failure / Decline
            fail_ref = f"TXN-DECLINED-{int(datetime.now().timestamp())}-{uuid.uuid4().hex[:6].upper()}"
            for b in bookings:
                b_fail_ref = fail_ref if len(bookings) == 1 else f"{fail_ref}-{b.id}"
                payment = Payment(
                    booking_id=b.id,
                    payment_method=payment_method,
                    amount=b.total_amount,
                    transaction_reference=b_fail_ref,
                    payment_status='Failed',
                    payment_date=datetime.now(timezone.utc)
                )
                db.session.add(payment)
                # Keep booking in Pending state so user can retry payment within the hold window
                b.booking_status = 'Pending'
                b.payment_status = 'Pending'

            db.session.commit()

            return jsonify({
                "status": "error",
                "error_code": "AV_ERR_502",
                "message": "Payment authorization declined by card issuer/bank (Code: AV_ERR_502). No charges were deducted. You may retry your payment.",
                "can_retry": True,
                "primary_pnr": bookings[0].pnr,
                "pnrs": [b.pnr for b in bookings],
                "booking_status": "Pending",
                "payment_status": "Pending",
                "is_simulated": True
            }), 400

    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error processing payment: {e}")
        return jsonify({"status": "error", "message": f"Payment processing error: {str(e)}"}), 500


# =============================================================================
# 12. E-Ticket PDF Download API (Phase 9)
# =============================================================================
@app.route('/api/bookings/<string:pnr>/ticket', methods=['GET'])
def download_ticket(pnr):
    """
    Generates and downloads the official AeroVista electronic ticket PDF.
    Enforces security: only confirmed and paid bookings can generate an e-ticket.
    Supports ?return_pnr=<pnr2> to bundle both journeys in one e-ticket.
    """
    cleanup_expired_reservations()

    pnr_clean = pnr.strip().upper()
    booking = Booking.query.filter_by(pnr=pnr_clean).first()
    if not booking:
        return jsonify({"status": "error", "message": f"Booking with PNR {pnr_clean} not found."}), 404

    # Security check: Never issue e-ticket for unconfirmed or unpaid bookings!
    if booking.booking_status != 'Confirmed' or booking.payment_status != 'Paid':
        return jsonify({
            "status": "error",
            "message": "E-ticket is only available for confirmed and paid reservations. Please complete payment first."
        }), 403

    # Check for return booking
    return_booking = None
    return_pnr = request.args.get('return_pnr')
    if return_pnr:
        ret_clean = return_pnr.strip().upper()
        return_booking = Booking.query.filter_by(pnr=ret_clean).first()
        if return_booking and (return_booking.booking_status != 'Confirmed' or return_booking.payment_status != 'Paid'):
            return_booking = None

    # Get latest successful payment record
    payment = Payment.query.filter_by(booking_id=booking.id, payment_status='Successful').order_by(Payment.payment_date.desc()).first()

    # Generate PDF bytes
    pdf_bytes = ticket_generator.generate_eticket_pdf(booking, return_booking, payment)

    return send_file(
        io.BytesIO(pdf_bytes),
        mimetype='application/pdf',
        as_attachment=True,
        download_name=f'AeroVista_ETicket_{pnr_clean}.pdf'
    )


# =============================================================================
# 13. Phase 10: Admin Booking Management & Cancellation APIs
# =============================================================================
def _get_authenticated_admin():
    """Helper to verify and return the currently authenticated administrator."""
    admin_id = session.get('admin_id')
    if not admin_id:
        return None
    admin = db.session.get(Admin, admin_id)
    if not admin or admin.account_status != 'Active':
        return None
    return admin


@app.route('/api/admin/dashboard', methods=['GET'])
def admin_get_dashboard():
    """
    Returns live aggregated dashboard metrics, recent bookings, upcoming flights,
    and daily booking statistics for the administrator dashboard.
    Protected by administrator authentication.
    """
    cleanup_expired_reservations()
    admin = _get_authenticated_admin()
    if not admin:
        return jsonify({"status": "error", "message": "Administrator authentication required."}), 401

    now_utc = datetime.now(timezone.utc)
    today_date = now_utc.date()

    # 1. Flights
    total_flights = Flight.query.count()
    today_start = datetime.combine(today_date, time.min)
    today_end = datetime.combine(today_date, time.max)
    today_flights = Flight.query.filter(
        Flight.departure_time >= today_start,
        Flight.departure_time <= today_end
    ).count()

    # Available seats and total capacity across all flights
    available_seats = db.session.query(
        func.coalesce(func.sum(Flight.available_seats), 0)
    ).scalar() or 0
    total_capacity = db.session.query(
        func.coalesce(func.sum(Flight.total_seat_capacity), 0)
    ).scalar() or 0

    # 2. Bookings
    all_bookings = Booking.query.order_by(Booking.booking_date.desc()).all()
    total_bookings = len(all_bookings)
    confirmed_bookings = sum(1 for b in all_bookings if b.booking_status == 'Confirmed')
    pending_bookings = sum(1 for b in all_bookings if b.booking_status == 'Pending')
    cancelled_bookings = sum(1 for b in all_bookings if b.booking_status == 'Cancelled')

    # 3. Passengers (Exclude cancelled bookings from active passenger count)
    passenger_count = Passenger.query.join(Booking).filter(
        Booking.booking_status != 'Cancelled'
    ).count()
    registered_users = User.query.count()

    # 4. Booking Chart (7-day window grouped by date, excluding cancelled bookings)
    non_cancelled_bookings = [b for b in all_bookings if b.booking_status != 'Cancelled']

    date_counts = {}
    for b in non_cancelled_bookings:
        d_str = b.booking_date.strftime('%Y-%m-%d')
        date_counts[d_str] = date_counts.get(d_str, 0) + 1

    end_chart_date = today_date
    if date_counts and not any(date_counts.get((today_date - timedelta(days=i)).strftime('%Y-%m-%d'), 0) > 0 for i in range(7)):
        latest_booking_dt = max(datetime.strptime(k, '%Y-%m-%d').date() for k in date_counts.keys())
        end_chart_date = latest_booking_dt

    chart_days = []
    for i in range(6, -1, -1):
        day_date = end_chart_date - timedelta(days=i)
        d_str = day_date.strftime('%Y-%m-%d')
        cnt = date_counts.get(d_str, 0)
        chart_days.append({
            "date": d_str,
            "day": day_date.strftime('%a'),
            "label": day_date.strftime('%a %d'),
            "count": cnt
        })

    max_count = max([d['count'] for d in chart_days] or [1])
    for d in chart_days:
        d['percentage'] = round((d['count'] / max_count) * 100) if max_count > 0 and d['count'] > 0 else 0

    total_chart_bookings = sum(d['count'] for d in chart_days)

    # 5. Recent Bookings (Latest 5 to 10 records)
    recent_bookings = []
    for b in all_bookings[:10]:
        pax_name = "Unknown Passenger"
        if b.passengers and len(b.passengers) > 0:
            pax_name = b.passengers[0].full_name
            if len(b.passengers) > 1:
                pax_name += f" (+{len(b.passengers) - 1})"
        elif b.user and b.user.full_name:
            pax_name = b.user.full_name

        flight_num = b.flight.flight_number if b.flight else "N/A"
        travel_dt_str = b.flight.departure_time.strftime('%d %b %Y') if b.flight else b.booking_date.strftime('%d %b %Y')

        recent_bookings.append({
            "id": b.id,
            "pnr": b.pnr,
            "passenger_name": pax_name,
            "flight_number": flight_num,
            "travel_date": travel_dt_str,
            "booking_date": b.booking_date.strftime('%d %b %Y'),
            "booking_status": b.booking_status,
            "payment_status": b.payment_status,
            "total_amount": float(b.total_amount)
        })

    # 6. Upcoming Flights
    flights_query = Flight.query.filter(
        Flight.departure_time >= now_utc - timedelta(hours=3)
    ).order_by(Flight.departure_time.asc()).limit(8).all()

    if not flights_query:
        flights_query = Flight.query.order_by(Flight.departure_time.desc()).limit(8).all()

    upcoming_flights = []
    for f in flights_query:
        upcoming_flights.append({
            "id": f.id,
            "flight_number": f.flight_number,
            "airline": f.airline,
            "source": f.source,
            "destination": f.destination,
            "departure_time": f.departure_time.strftime('%H:%M'),
            "departure_datetime_str": f.departure_time.strftime('%d %b %Y, %H:%M'),
            "available_seats": f.available_seats,
            "total_seats": f.total_seat_capacity,
            "flight_status": f.flight_status
        })

    return jsonify({
        "status": "success",
        "statistics": {
            "total_flights": total_flights,
            "today_flights": today_flights,
            "total_bookings": total_bookings,
            "confirmed_bookings": confirmed_bookings,
            "pending_bookings": pending_bookings,
            "cancelled_bookings": cancelled_bookings,
            "passenger_count": passenger_count,
            "registered_users": registered_users,
            "available_seats": int(available_seats),
            "total_capacity": int(total_capacity)
        },
        "chart": {
            "days": chart_days,
            "total_chart_bookings": total_chart_bookings,
            "max_count": max_count,
            "start_date": chart_days[0]['label'] if chart_days else "",
            "end_date": chart_days[-1]['label'] if chart_days else ""
        },
        "recent_bookings": recent_bookings,
        "upcoming_flights": upcoming_flights
    }), 200


@app.route('/api/admin/bookings', methods=['GET'])
def admin_get_bookings():
    """
    Retrieves all passenger bookings for the administrator portal with search and filtering.
    Protected by administrator authentication.
    """
    cleanup_expired_reservations()
    admin = _get_authenticated_admin()
    if not admin:
        return jsonify({"status": "error", "message": "Administrator authentication required."}), 401

    search_query = (request.args.get('search') or '').strip().lower()
    status_filter = (request.args.get('booking_status') or request.args.get('status') or '').strip()
    payment_filter = (request.args.get('payment_status') or '').strip()
    date_filter = (request.args.get('date') or '').strip()

    all_bookings = Booking.query.order_by(Booking.booking_date.desc()).all()

    # Calculate global metrics
    total_count = len(all_bookings)
    confirmed_count = sum(1 for b in all_bookings if b.booking_status == 'Confirmed')
    pending_count = sum(1 for b in all_bookings if b.booking_status == 'Pending')
    cancelled_count = sum(1 for b in all_bookings if b.booking_status == 'Cancelled')

    filtered_bookings = []
    for b in all_bookings:
        # Status filters
        if status_filter and b.booking_status.lower() != status_filter.lower():
            continue
        if payment_filter and b.payment_status.lower() != payment_filter.lower():
            continue

        flight = b.flight
        passengers = b.passengers
        lead_pax = passengers[0] if passengers else None
        lead_name = lead_pax.full_name if lead_pax else "Passenger"

        # Travel date filter
        if date_filter:
            flight_dep_date = flight.departure_time.strftime('%Y-%m-%d') if flight else ''
            if flight_dep_date != date_filter:
                continue

        # Search filter (PNR, passenger name, flight number)
        if search_query:
            match_pnr = search_query in b.pnr.lower()
            match_flight = flight and (search_query in flight.flight_number.lower())
            match_passenger = any(search_query in p.full_name.lower() for p in passengers)
            if not (match_pnr or match_flight or match_passenger):
                continue

        seats_list = [s.seat_number for s in b.seats]
        seat_objects = []
        for s in b.seats:
            pax_name = s.passenger.full_name if s.passenger else lead_name
            seat_objects.append({
                "passenger": pax_name,
                "seat": s.seat_number,
                "cabin": s.cabin_class,
                "category": s.seat_type
            })

        latest_payment = b.payments[-1] if b.payments else None

        source_val = flight.source if flight else 'N/A'
        dest_val = flight.destination if flight else 'N/A'
        source_city = _extract_city(source_val) if flight else 'N/A'
        dest_city = _extract_city(dest_val) if flight else 'N/A'
        source_code = _extract_code(source_val) if flight else 'N/A'
        dest_code = _extract_code(dest_val) if flight else 'N/A'

        filtered_bookings.append({
            "id": b.id,
            "pnr": b.pnr,
            "bookingDate": b.booking_date.strftime('%Y-%m-%d %H:%M:%S'),
            "passengerName": lead_name,
            "email": (lead_pax.contact_email if lead_pax else None) or (b.user.email if b.user else 'guest@aerovista.test'),
            "phone": (lead_pax.contact_phone if lead_pax else None) or (b.user.mobile_number if b.user else 'N/A'),
            "nationality": (lead_pax.nationality if lead_pax else None) or 'Verified',
            "idType": (lead_pax.identification_type if lead_pax else None) or 'Passport',
            "idNumber": (lead_pax.identification_number if lead_pax else None) or 'Verified ID',
            "flightNumber": flight.flight_number if flight else 'N/A',
            "airline": flight.airline if flight else 'AeroVista',
            "source": source_val,
            "sourceCity": source_city,
            "sourceCode": source_code,
            "destination": dest_val,
            "destCity": dest_city,
            "destCode": dest_code,
            "route": f"{source_city} → {dest_city}" if flight else 'N/A',
            "travelDate": flight.departure_time.strftime('%Y-%m-%d %H:%M') if flight else 'N/A',
            "departureTime": flight.departure_time.strftime('%H:%M') if flight else 'N/A',
            "arrivalTime": flight.arrival_time.strftime('%H:%M') if flight else 'N/A',
            "cabinClass": b.seats[0].cabin_class if b.seats else 'Economy',
            "passengerCount": len(passengers),
            "seats": seat_objects,
            "seatsList": seats_list,
            "seatsStr": ", ".join(seats_list) if seats_list else "Assigned",
            "totalAmount": float(b.total_amount),
            "bookingStatus": b.booking_status,
            "paymentStatus": b.payment_status,
            "paymentMethod": latest_payment.payment_method if latest_payment else 'Credit Card',
            "transactionId": latest_payment.transaction_reference if latest_payment else 'TXN-RECORDED'
        })

    return jsonify({
        "status": "success",
        "metrics": {
            "total": total_count,
            "confirmed": confirmed_count,
            "pending": pending_count,
            "cancelled": cancelled_count
        },
        "count": len(filtered_bookings),
        "bookings": filtered_bookings
    }), 200


@app.route('/api/admin/bookings/<string:identifier>', methods=['GET'])
def admin_get_booking_detail(identifier):
    """
    Returns complete booking details for an administrator by ID or PNR.
    """
    cleanup_expired_reservations()
    admin = _get_authenticated_admin()
    if not admin:
        return jsonify({"status": "error", "message": "Administrator authentication required."}), 401

    booking = None
    if identifier.isdigit():
        booking = db.session.get(Booking, int(identifier))
    if not booking:
        booking = Booking.query.filter_by(pnr=identifier.strip().upper()).first()

    if not booking:
        return jsonify({"status": "error", "message": f"Booking {identifier} not found."}), 404

    flight = booking.flight
    passengers = []
    for p in booking.passengers:
        assigned_seat = p.seat.seat_number if p.seat else 'Assigned'
        seat_class = p.seat.cabin_class if p.seat else 'Economy'
        passengers.append({
            "id": p.id,
            "full_name": p.full_name,
            "date_of_birth": p.date_of_birth.strftime('%Y-%m-%d') if p.date_of_birth else None,
            "gender": p.gender,
            "nationality": p.nationality,
            "identification_type": p.identification_type,
            "identification_number": p.identification_number,
            "contact_email": p.contact_email,
            "contact_phone": p.contact_phone,
            "seat_number": assigned_seat,
            "cabin_class": seat_class
        })

    payments = []
    for pay in booking.payments:
        payments.append({
            "id": pay.id,
            "amount": float(pay.amount),
            "payment_method": pay.payment_method,
            "transaction_reference": pay.transaction_reference,
            "payment_status": pay.payment_status,
            "payment_date": pay.payment_date.strftime('%Y-%m-%d %H:%M:%S')
        })

    lead_pax = booking.passengers[0] if booking.passengers else None

    return jsonify({
        "status": "success",
        "booking": {
            "id": booking.id,
            "pnr": booking.pnr,
            "booking_date": booking.booking_date.strftime('%Y-%m-%d %H:%M:%S'),
            "booking_status": booking.booking_status,
            "payment_status": booking.payment_status,
            "total_amount": float(booking.total_amount),
            "lead_passenger": lead_pax.full_name if lead_pax else 'Passenger',
            "flight": {
                "id": flight.id if flight else None,
                "flight_number": flight.flight_number if flight else 'N/A',
                "airline": flight.airline if flight else 'AeroVista',
                "source": flight.source if flight else 'N/A',
                "destination": flight.destination if flight else 'N/A',
                "departure_time": flight.departure_time.strftime('%Y-%m-%d %H:%M:%S') if flight else None,
                "arrival_time": flight.arrival_time.strftime('%Y-%m-%d %H:%M:%S') if flight else None,
                "duration": flight.duration if flight else 'N/A',
                "aircraft": flight.aircraft if flight else 'N/A'
            },
            "passengers": passengers,
            "seats": [s.seat_number for s in booking.seats],
            "payments": payments
        }
    }), 200


@app.route('/api/admin/bookings/<int:booking_id>/status', methods=['PUT'])
def admin_update_booking_status(booking_id):
    """
    Updates a booking's status.
    Enforces business requirement: Unpaid or failed-payment bookings cannot be marked as confirmed.
    """
    admin = _get_authenticated_admin()
    if not admin:
        return jsonify({"status": "error", "message": "Administrator authentication required."}), 401

    booking = db.session.get(Booking, booking_id)
    if not booking:
        return jsonify({"status": "error", "message": f"Booking {booking_id} not found."}), 404

    data = request.get_json(silent=True) or {}
    new_status = (data.get('booking_status') or data.get('status') or '').strip().title()

    if new_status not in ('Confirmed', 'Pending', 'Cancelled'):
        return jsonify({"status": "error", "message": f"Invalid booking status '{new_status}'."}), 400

    # Critical Guard: Ensure unpaid or failed-payment bookings cannot be marked as confirmed!
    if new_status == 'Confirmed':
        if booking.payment_status != 'Paid':
            return jsonify({
                "status": "error",
                "message": "Unpaid or failed-payment bookings cannot be marked as confirmed. Payment must be cleared first."
            }), 400
        # If moving to confirmed, ensure seats are marked occupied
        for seat in booking.seats:
            seat.seat_status = 'Occupied'

    elif new_status == 'Cancelled' and booking.booking_status != 'Cancelled':
        # Release seats
        for seat in booking.seats:
            seat.release()
        if booking.flight:
            booking.flight.available_seats = min(booking.flight.total_seat_capacity, booking.flight.available_seats + len(booking.passengers))

    booking.booking_status = new_status
    db.session.commit()

    return jsonify({
        "status": "success",
        "message": f"Booking status updated to {new_status}.",
        "booking_id": booking.id,
        "booking_status": booking.booking_status,
        "payment_status": booking.payment_status
    }), 200


# =============================================================================
# 14. Phase 10: Admin Passenger Management APIs
# =============================================================================
@app.route('/api/admin/passengers', methods=['GET'])
def admin_get_passengers():
    """
    Lists registered passengers for the administrator portal with search, filters, and metrics.
    Protected by administrator authentication.
    """
    admin = _get_authenticated_admin()
    if not admin:
        return jsonify({"status": "error", "message": "Administrator authentication required."}), 401

    search_query = (request.args.get('search') or '').strip().lower()
    status_filter = (request.args.get('account_status') or request.args.get('status') or '').strip().title()
    reg_date_filter = (request.args.get('date') or request.args.get('reg_date') or '').strip()

    all_users = User.query.order_by(User.registration_date.desc()).all()
    now_utc = datetime.now(timezone.utc)
    thirty_days_ago = now_utc - timedelta(days=30)

    total_passengers = len(all_users)
    active_passengers = sum(1 for u in all_users if u.account_status == 'Active')
    total_bookings_count = sum(len(u.bookings) for u in all_users)

    recent_count = 0
    for u in all_users:
        u_reg = u.registration_date
        if u_reg.tzinfo is None:
            u_reg = u_reg.replace(tzinfo=timezone.utc)
        if u_reg >= thirty_days_ago:
            recent_count += 1

    passengers_list = []
    for u in all_users:
        if status_filter and u.account_status != status_filter:
            continue

        u_reg_str = u.registration_date.strftime('%Y-%m-%d')
        if reg_date_filter and u_reg_str != reg_date_filter:
            continue

        if search_query:
            match_name = search_query in u.full_name.lower()
            match_email = search_query in u.email.lower()
            match_phone = u.mobile_number and (search_query in u.mobile_number.lower())
            if not (match_name or match_email or match_phone):
                continue

        passengers_list.append({
            "id": u.id,
            "fullName": u.full_name,
            "email": u.email,
            "phone": u.mobile_number or 'Not provided',
            "mobile_number": u.mobile_number or 'Not provided',
            "registrationDate": u_reg_str,
            "regDate": u_reg_str,
            "accountStatus": u.account_status,
            "totalBookings": len(u.bookings)
        })

    return jsonify({
        "status": "success",
        "metrics": {
            "total": total_passengers,
            "active": active_passengers,
            "total_bookings": total_bookings_count,
            "recent": recent_count
        },
        "count": len(passengers_list),
        "passengers": passengers_list
    }), 200


@app.route('/api/admin/passengers/<int:user_id>', methods=['GET'])
def admin_get_passenger_detail(user_id):
    """
    Returns detailed profile and booking history for a specific passenger.
    """
    admin = _get_authenticated_admin()
    if not admin:
        return jsonify({"status": "error", "message": "Administrator authentication required."}), 401

    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"status": "error", "message": f"Passenger with ID {user_id} not found."}), 404

    bookings = []
    for b in user.bookings:
        flight = b.flight
        source_val = flight.source if flight else 'N/A'
        dest_val = flight.destination if flight else 'N/A'
        bookings.append({
            "id": b.id,
            "pnr": b.pnr,
            "bookingDate": b.booking_date.strftime('%Y-%m-%d %H:%M:%S'),
            "flightNumber": flight.flight_number if flight else 'N/A',
            "airline": flight.airline if flight else 'AeroVista',
            "source": source_val,
            "sourceCity": _extract_city(source_val) if flight else 'N/A',
            "sourceCode": _extract_code(source_val) if flight else 'N/A',
            "destination": dest_val,
            "destCity": _extract_city(dest_val) if flight else 'N/A',
            "destCode": _extract_code(dest_val) if flight else 'N/A',
            "route": f"{flight.source} → {flight.destination}" if flight else 'N/A',
            "travelDate": flight.departure_time.strftime('%Y-%m-%d %H:%M') if flight else 'N/A',
            "totalAmount": float(b.total_amount),
            "bookingStatus": b.booking_status,
            "paymentStatus": b.payment_status,
            "seats": [s.seat_number for s in b.seats]
        })

    return jsonify({
        "status": "success",
        "passenger": {
            "id": user.id,
            "fullName": user.full_name,
            "email": user.email,
            "phone": user.mobile_number or 'Not provided',
            "registrationDate": user.registration_date.strftime('%Y-%m-%d'),
            "accountStatus": user.account_status,
            "totalBookings": len(bookings),
            "bookings": bookings
        }
    }), 200


@app.route('/api/admin/passengers/<int:user_id>/toggle-status', methods=['POST'])
@app.route('/api/admin/passengers/<int:user_id>/status', methods=['PUT'])
def admin_toggle_passenger_status(user_id):
    """
    Activates or deactivates a passenger account.
    Deactivated accounts are blocked from logging in or making new bookings.
    All historical booking records are strictly preserved.
    """
    admin = _get_authenticated_admin()
    if not admin:
        return jsonify({"status": "error", "message": "Administrator authentication required."}), 401

    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"status": "error", "message": f"Passenger with ID {user_id} not found."}), 404

    payload = request.get_json(silent=True) or {}
    if 'account_status' in payload or 'status' in payload:
        new_status = (payload.get('account_status') or payload.get('status')).strip().title()
        if new_status not in ('Active', 'Inactive', 'Suspended'):
            return jsonify({"status": "error", "message": f"Invalid status '{new_status}'."}), 400
    else:
        # Toggle
        new_status = 'Inactive' if user.account_status == 'Active' else 'Active'

    user.account_status = new_status
    db.session.commit()

    return jsonify({
        "status": "success",
        "message": f"Passenger account status updated to {new_status}.",
        "user_id": user.id,
        "full_name": user.full_name,
        "account_status": user.account_status
    }), 200


# =============================================================================
# 15. Phase 10: Passenger Booking History & Cancellation APIs
# =============================================================================
@app.route('/api/passenger/bookings', methods=['GET'])
@app.route('/api/user/bookings', methods=['GET'])
def passenger_get_my_bookings():
    """
    Allows a logged-in passenger to view their personal booking history.
    Strictly isolated to the authenticated user's own reservations.
    """
    cleanup_expired_reservations()
    user_id = session.get('passenger_id') or session.get('user_id')
    if not user_id:
        return jsonify({"status": "error", "message": "Passenger authentication required to view booking history."}), 401

    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"status": "error", "message": "Passenger account not found."}), 404

    bookings = Booking.query.filter_by(user_id=user_id).order_by(Booking.booking_date.desc()).all()
    results = []
    for b in bookings:
        flight = b.flight
        lead_pax = b.passengers[0] if b.passengers else None
        results.append({
            "id": b.id,
            "pnr": b.pnr,
            "booking_date": b.booking_date.strftime('%Y-%m-%d %H:%M:%S'),
            "total_amount": float(b.total_amount),
            "booking_status": b.booking_status,
            "payment_status": b.payment_status,
            "lead_passenger": lead_pax.full_name if lead_pax else user.full_name,
            "passenger_count": len(b.passengers),
            "seats": [s.seat_number for s in b.seats],
            "seats_str": ", ".join(s.seat_number for s in b.seats),
            "flight": {
                "flight_number": flight.flight_number if flight else 'N/A',
                "airline": flight.airline if flight else 'AeroVista',
                "source": flight.source if flight else 'N/A',
                "destination": flight.destination if flight else 'N/A',
                "departure_time": flight.departure_time.strftime('%Y-%m-%d %H:%M:%S') if flight else None,
                "arrival_time": flight.arrival_time.strftime('%Y-%m-%d %H:%M:%S') if flight else None,
                "aircraft": flight.aircraft if flight else 'N/A'
            }
        })

    return jsonify({
        "status": "success",
        "passenger": {
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email
        },
        "count": len(results),
        "bookings": results
    }), 200


@app.route('/api/bookings/<string:pnr>/cancel', methods=['POST'])
@app.route('/api/admin/bookings/<string:pnr>/cancel', methods=['POST'])
def cancel_booking(pnr):
    """
    Cancels an eligible flight reservation.
    - Validates ownership (logged-in user owns booking, or matching passenger last name, or admin).
    - Checks eligibility (cannot cancel already cancelled flights or departed flights).
    - Releases associated seats back to Available and increments available_seats.
    - Prevents double cancellation and duplicate seat releases.
    - Records simulated refund without claiming real bank transfers.
    - Preserves all historical records.
    """
    cleanup_expired_reservations()
    pnr_clean = pnr.strip().upper()
    booking = Booking.query.filter_by(pnr=pnr_clean).first()
    if not booking:
        return jsonify({"status": "error", "message": f"Booking with reference {pnr_clean} not found."}), 404

    # 1. Authorization check
    is_admin = bool(_get_authenticated_admin())
    current_user_id = session.get('passenger_id') or session.get('user_id')
    payload = request.get_json(silent=True) or {}
    req_last_name = (payload.get('lastName') or payload.get('last_name') or request.args.get('lastName') or '').strip().lower()

    if not is_admin:
        if current_user_id and booking.user_id:
            if booking.user_id != current_user_id:
                return jsonify({
                    "status": "error",
                    "message": "Unauthorized: You are not authorized to cancel another passenger's reservation."
                }), 403
        elif req_last_name:
            # Guest checkout verification: verify last name matches at least one passenger in manifest
            name_matched = False
            for p in booking.passengers:
                parts = p.full_name.strip().split()
                if parts and parts[-1].lower() == req_last_name:
                    name_matched = True
                    break
            if not name_matched:
                return jsonify({
                    "status": "error",
                    "message": f"Verification failed: Last name '{req_last_name}' does not match the passenger manifest for booking {pnr_clean}."
                }), 403

    # 2. Eligibility checks
    if booking.booking_status == 'Cancelled':
        return jsonify({
            "status": "error",
            "message": f"Booking {pnr_clean} is already cancelled. Duplicate cancellation is prevented."
        }), 400

    flight = booking.flight
    now_utc = datetime.now(timezone.utc)
    if flight:
        dep_time = flight.departure_time
        if dep_time.tzinfo is None:
            dep_time = dep_time.replace(tzinfo=timezone.utc)
        if now_utc >= dep_time:
            return jsonify({
                "status": "error",
                "message": f"Flight {flight.flight_number} has already departed. Past flights are ineligible for cancellation."
            }), 400

    try:
        # 3. Release assigned seats
        released_seats = []
        for seat in booking.seats:
            released_seats.append(seat.seat_number)
            seat.release()

        # 4. Restore flight available capacity safely
        pax_count = len(booking.passengers)
        if flight:
            flight.available_seats = min(flight.total_seat_capacity, flight.available_seats + pax_count)

        # 5. Update booking status
        booking.booking_status = 'Cancelled'

        # 6. Record Simulated Refund
        refund_message = "No charges were deducted (Pending reservation cancelled)."
        if booking.payment_status == 'Paid':
            booking.payment_status = 'Refunded'
            refund_ref = f"TXN-REFUND-{int(datetime.now().timestamp())}-{uuid.uuid4().hex[:6].upper()}"
            refund_payment = Payment(
                booking_id=booking.id,
                payment_method=booking.payments[-1].payment_method if booking.payments else 'Credit Card',
                amount=booking.total_amount,
                transaction_reference=refund_ref,
                payment_status='Refunded',
                payment_date=datetime.now(timezone.utc)
            )
            db.session.add(refund_payment)
            refund_message = "Simulated refund processed successfully. (Note: Demonstration mode - no real banking transfer occurred)."
        else:
            booking.payment_status = 'Cancelled'

        db.session.commit()

        return jsonify({
            "status": "success",
            "message": f"Reservation {pnr_clean} has been successfully cancelled. Assigned seats have been released.",
            "pnr": pnr_clean,
            "booking_status": "Cancelled",
            "payment_status": booking.payment_status,
            "released_seats": released_seats,
            "seats_released_count": len(released_seats),
            "refund_details": {
                "amount": float(booking.total_amount),
                "status": "Refunded" if booking.payment_status == 'Refunded' else "Not Charged",
                "message": refund_message,
                "is_simulated": True
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error cancelling booking {pnr_clean}: {e}")
        return jsonify({"status": "error", "message": f"Cancellation failed: {str(e)}"}), 500



# =============================================================================
# 13. Main Homepage Route
# =============================================================================
@app.route('/')
def home():
    """Serves the main landing page (index.html)."""
    return send_from_directory(BASE_DIR, 'index.html')


# =============================================================================
# 6. Static Files & HTML Page Catch-All Route
# =============================================================================
@app.route('/<path:filename>')
def serve_static(filename):
    """
    Serves existing HTML pages (e.g. search-results.html, login.html, admin-dashboard.html),
    CSS files, JS scripts, and images directly without altering frontend file structure.
    """
    file_path = os.path.join(BASE_DIR, filename)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return send_from_directory(BASE_DIR, filename)

    # Clean URL fallback (e.g. /login -> login.html)
    html_fallback = os.path.join(BASE_DIR, f"{filename}.html")
    if os.path.exists(html_fallback) and os.path.isfile(html_fallback):
        return send_from_directory(BASE_DIR, f"{filename}.html")

    return jsonify({"error": "Resource not found", "path": filename}), 404


# =============================================================================
# 7. Server Execution
# =============================================================================
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug_mode = os.environ.get('FLASK_DEBUG', 'True').lower() in ('true', '1', 't')
    print(f"Starting AeroVista Flask Server on http://localhost:{port} (debug={debug_mode}) ...")
    app.run(host='0.0.0.0', port=port, debug=debug_mode)
