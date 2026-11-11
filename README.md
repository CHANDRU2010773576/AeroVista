# AeroVista Airlines – Airline Reservation & Management System

[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=flat&logo=python&logoColor=white)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.1.3-000000?style=flat&logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![SQLite](https://img.shields.io/badge/Database-SQLite3-003B57?style=flat&logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Architecture](https://img.shields.io/badge/Architecture-REST%20%2F%20SPA-gold?style=flat)]()

AeroVista is a full-stack airline reservation and operations management web platform designed with an **Obsidian & Champagne Gold** luxury aesthetic. It provides a complete passenger booking journey — from flight discovery and interactive seat selection to simulated checkout and automated PDF e-ticket generation — alongside an administrative control suite for scheduling flights, managing passenger bookings, and monitoring system analytics.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Technologies Used](#technologies-used)
- [Key Features](#key-features)
  - [Passenger Experience](#passenger-experience)
  - [Administrative Suite](#administrative-suite)
- [Project Directory Structure](#project-directory-structure)
- [Installation & Setup](#installation--setup)
  - [1. Prerequisites](#1-prerequisites)
  - [2. Navigate to the Project Directory](#2-navigate-to-the-project-directory)
  - [3. Create & Activate Virtual Environment](#3-create--activate-virtual-environment)
  - [4. Install Dependencies](#4-install-dependencies)
  - [5. Database Initialization & Admin Setup](#5-database-initialization--admin-setup)
- [Running the Application](#running-the-application)
- [Running Automated Tests](#running-automated-tests)
- [Configuration & Security Notes](#configuration--security-notes)
- [Screenshots](#screenshots)
- [License](#license)

---

## Project Overview

AeroVista models the operational and transactional workflows of a modern commercial airline. The system pairs a lightweight Python/Flask backend with responsive, client-rendered interfaces.

### Core Architecture Highlights

- **Atomic Booking Transactions:** Flight reservations, multi-passenger record creation, seat locking, and simulated payments occur in a single database transaction to prevent partial or corrupted states.
- **Dynamic Inventory & Seat Allocation:** Real-time seat maps reflect current cabin availability and enforce seat collision prevention.
- **Automated PDF E-Tickets:** Generates branded A4 PDF passenger itineraries using Python and Matplotlib.
- **Role-Based Access Control:** Separate session authentication flows for registered passengers and system administrators.

---

## Technologies Used

### Backend

| Package | Version | Purpose |
| :--- | :--- | :--- |
| **Python** | 3.10+ | Core runtime |
| **Flask** | 3.1.3 | Web framework, routing, session management, REST API |
| **Flask-SQLAlchemy** | 3.1.1 | SQLAlchemy ORM integration with Flask |
| **SQLAlchemy** | 2.1.8 | ORM, relationships, constraints, transactions |
| **Werkzeug** | 3.1.9 | Password hashing (`generate_password_hash`, `check_password_hash`) |
| **Matplotlib** | 3.11.2 | Headless PDF e-ticket generation (Agg backend) |
| **SQLite 3** | (built-in) | Embedded relational database (`aerovista.db`) |

### Frontend

- **HTML5** – Semantic markup across all passenger and admin views.
- **CSS3** – Custom properties (variables), Flexbox, Grid, and bespoke luxury styling. No external CSS framework.
- **Vanilla JavaScript (ES6+)** – Fetch API for asynchronous REST calls, dynamic DOM updates, and `sessionStorage` state management.

---

## Key Features

### Passenger Experience

1. **Flight Search & Discovery** (`index.html`, `search-results.html`)
   - One-Way and Round-Trip route search.
   - Synchronized 7-day horizontal date selector strip.
   - Filter by stops (Direct / 1+ Stops).
2. **Passenger Details Entry** (`passenger-details.html`)
   - Dynamic multi-passenger form based on initial search count.
   - Validation for name, date of birth, gender, nationality, passport/ID, and contact info.
3. **Interactive Seat Map** (`seat-selection.html`)
   - Visual cabin layout with seat classifications (Standard, Extra Legroom, Emergency Exit, Business Suite).
   - Real-time fare calculator updating as seats are selected.
   - Prevents selection of occupied or reserved seats.
4. **Simulated Payment Gateway** (`payment.html`)
   - Credit Card, Debit Card, and UPI payment simulations.
   - Server-side validation transitions reservations from `Pending` to `Confirmed`.
5. **Booking Confirmation & PDF E-Ticket** (`booking-confirmation.html`)
   - Itinerary summary with PNR, flight timings, passenger roster, and assigned seats.
   - E-ticket download via `/api/bookings/<pnr>/ticket` (confirmed and paid bookings only).
6. **Self-Service Itinerary Lookup** (`manage-booking.html`)
   - Retrieve booking and itinerary details by PNR and Passenger Name.
7. **Self-Service Cancellation** (`cancel-booking.html`)
   - Cancel a booking; reserved seats are automatically released back to flight inventory and a simulated refund is processed.
8. **User Authentication** (`login.html`, `register.html`)
   - Passenger account registration and session-based login.

### Administrative Suite

1. **Executive Dashboard** (`admin-dashboard.html`)
   - Live metrics: Total Flights, Today's Scheduled Flights, Total Bookings, Registered Passengers, Available Seat Capacity.
   - Booking trends chart grouped by date.
   - Quick-reference tables for Recent Bookings and Upcoming Flights.
2. **Flight Management**
   - Create flights with custom aircraft, schedules, cabin info, and pricing.
   - Update flight status (`Scheduled`, `On Time`, `Delayed`, `Boarding`, `Cancelled`).
   - Delete flights.
3. **Booking Management**
   - Full ledger of all passenger reservations.
   - Search by PNR, passenger name, or flight number.
   - Filter by Booking Status and Payment Status.
   - View complete booking detail per PNR.
4. **Passenger Account Governance**
   - Directory of registered passenger accounts with registration date and status.
   - Activate or deactivate accounts; deactivated users are blocked from logging in or making bookings while their records and history are preserved.
5. **Secure Admin Portal** (`admin-login.html`)
   - One-time initialization wizard on first run.
   - Locks permanently once the first administrator account is created.
   - Credential-change endpoint (`/api/admin/change-credentials`).

---

## Project Directory Structure

```text
AeroVista/
├── css/
│   ├── admin.css                           # Admin portal styling
│   ├── auth.css                            # Passenger authentication styling
│   ├── booking-confirmation.css            # Confirmation page styling
│   ├── cancel-booking.css                  # Cancellation page styling
│   ├── manage-booking.css                  # Booking lookup styling
│   ├── passenger-details.css               # Passenger form styling
│   ├── payment.css                         # Payment gateway styling
│   ├── search-results.css                  # Flight results & date strip styling
│   ├── seat-selection.css                  # Seat map styling
│   └── style.css                           # Global theme & landing page styling
├── js/
│   ├── admin-auth.js                       # Admin login & initialization
│   ├── admin.js                            # Admin dashboard, flights, bookings, passengers
│   ├── auth.js                             # Passenger login & registration
│   ├── booking-confirmation.js             # Confirmation view & e-ticket download trigger
│   ├── cancel-booking.js                   # Cancellation flow
│   ├── main.js                             # Landing page flight search
│   ├── manage-booking.js                   # PNR lookup controller
│   ├── passenger-details.js                # Passenger form & submission
│   ├── payment.js                          # Payment simulation
│   ├── search-results.js                   # Results rendering & 7-day date strip
│   ├── seat-selection.js                   # Interactive seat map & selection
│   └── session-nav.js                      # Global session navigation & auth state
├── images/                                 # Static image assets
├── admin-dashboard.html                    # Admin control centre
├── admin-login.html                        # Admin login / first-run setup
├── booking-confirmation.html               # Passenger booking confirmation
├── cancel-booking.html                     # Self-service cancellation
├── index.html                              # Homepage & flight search
├── login.html                              # Passenger sign-in
├── manage-booking.html                     # PNR itinerary lookup
├── passenger-details.html                  # Multi-passenger details form
├── payment.html                            # Checkout & payment gateway
├── register.html                           # Passenger registration
├── search-results.html                     # Available flights listing
├── seat-selection.html                     # Interactive seat picker
├── app.py                                  # Flask application & all REST API routes
├── models.py                               # SQLAlchemy models, relationships & constraints
├── ticket_generator.py                     # Matplotlib PDF e-ticket utility
├── requirements.txt                        # Python dependencies
├── aerovista.db                            # SQLite database (auto-created on first run)
├── test_admin_dashboard.py                 # Admin dashboard API tests
├── test_flight_class_selection.py          # Cabin class selection tests
├── test_phase8_booking.py                  # Booking creation tests
├── test_phase9_payment.py                  # Payment processing tests
├── test_phase10_admin_and_cancellation.py  # Admin management & cancellation tests
└── README.md
```

---

## Installation & Setup

### 1. Prerequisites

Ensure **Python 3.10 or later** is installed. Open a terminal and verify:

```
python --version
```

### 2. Navigate to the Project Directory

Open a terminal (PowerShell or Command Prompt on Windows, Terminal on macOS/Linux) and change into the project root:

```
cd path/to/AeroVista
```

### 3. Create & Activate Virtual Environment

```bash
# Create virtual environment
python -m venv venv
```

**Windows – PowerShell:**
```powershell
.\venv\Scripts\Activate.ps1
```

> If script execution is restricted, run first:
> `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`

**Windows – Command Prompt:**
```cmd
.\venv\Scripts\activate.bat
```

**macOS / Linux:**
```bash
source venv/bin/activate
```

### 4. Install Dependencies

With the virtual environment active, install all required packages from `requirements.txt`:

```bash
pip install -r requirements.txt
```

The file pins the following packages:

```
Flask==3.1.3
Flask-SQLAlchemy==3.1.1
matplotlib==3.11.2
SQLAlchemy==2.1.8
Werkzeug==3.1.9
```

### 5. Database Initialization & Admin Setup

**Automatic table creation:**  
All database tables (`users`, `admins`, `flights`, `bookings`, `passengers`, `seats`, `payments`) are created automatically when `app.py` starts for the first time. No separate migration step is required.

**First-time administrator setup:**
1. Launch the application (see next section).
2. Navigate to `http://localhost:5000/admin-login.html`.
3. Because no administrator accounts exist yet, the page automatically displays the **Initialize Administrator** form.
4. Enter your chosen **Username** and a **Password** (minimum 8 characters), confirm the password, and submit.
5. The endpoint creates the account, logs you in automatically, and redirects you to the Admin Dashboard. The initialization endpoint is permanently disabled once any admin account exists.

---

## Running the Application

With the virtual environment active, start the Flask development server:

```bash
python app.py
```

Expected output:
```
Starting AeroVista Flask Server on http://localhost:5000 (debug=True) ...
 * Running on http://127.0.0.1:5000
```

### Local Access URLs

| Page | URL |
| :--- | :--- |
| Passenger Homepage | http://localhost:5000/ |
| Flight Search Results | http://localhost:5000/search-results.html |
| Manage Booking (PNR Lookup) | http://localhost:5000/manage-booking.html |
| Cancel Booking | http://localhost:5000/cancel-booking.html |
| Passenger Sign In | http://localhost:5000/login.html |
| Admin Portal | http://localhost:5000/admin-login.html |
| Admin Dashboard | http://localhost:5000/admin-dashboard.html |
| Backend Health Check | http://localhost:5000/api/status |

---

## Running Automated Tests

Run any of the included test scripts from the project root with the virtual environment active:

```bash
python test_admin_dashboard.py
python test_phase8_booking.py
python test_phase9_payment.py
python test_phase10_admin_and_cancellation.py
python test_flight_class_selection.py
```

Each script uses Python's standard `unittest` library and reports pass/fail results directly in the terminal.

---

## Configuration & Security Notes

- **Simulated payments:** All payment transactions (Credit Card, Debit Card, UPI) are simulated. No real payment gateway or bank network is involved.

- **Secret key:** A development fallback key is included in `app.py`. For any deployment beyond local development, override it with an environment variable:

  ```bash
  # Windows PowerShell
  $env:AEROVISTA_SECRET_KEY = "your-secure-random-key"

  # macOS / Linux
  export AEROVISTA_SECRET_KEY="your-secure-random-key"
  ```

- **Port & debug mode:** Default port is `5000` with debug mode enabled. Override with environment variables:

  ```bash
  # Windows PowerShell
  $env:PORT = "8080"
  $env:FLASK_DEBUG = "False"

  # macOS / Linux
  export PORT=8080
  export FLASK_DEBUG=False
  ```

- **Data integrity:** SQLAlchemy check constraints enforce non-negative fares, non-negative seat counts, and valid seat capacities at the database level. Deactivating a passenger account blocks future logins and bookings while preserving all historical booking records.

- **E-ticket security:** The `/api/bookings/<pnr>/ticket` endpoint only generates a PDF for bookings with status `Confirmed` and payment status `Paid`. Unconfirmed or unpaid bookings are rejected with HTTP 403.

---

## Screenshots

Place application screenshots in the `images/` directory and update the paths below.

| Landing Page & Search | Seat Selection Map |
| :---: | :---: |
| ![Homepage](images/screenshot-home.png) | ![Seat Selection](images/screenshot-seats.png) |

| Admin Dashboard | PDF E-Ticket Preview |
| :---: | :---: |
| ![Admin Dashboard](images/screenshot-admin.png) | ![E-Ticket](images/screenshot-ticket.png) |

---

## License

No license file is present in this repository. All rights are reserved by the author unless a license is explicitly added.
