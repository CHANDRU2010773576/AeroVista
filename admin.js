/**
 * AeroVista Airlines – Admin Dashboard & Flight Management Logic (Step 4)
 * Handles:
 * 1. Sidebar tab switching & view navigation
 * 2. Mobile sidebar toggle
 * 3. Flight Management State (CRUD: Add, Edit, Delete)
 * 4. Search and Filter controls (Flight Number, Source, Destination, Status)
 * 5. Duration calculation & Form validations (different origin/destination, seat constraints, fares)
 */

document.addEventListener('DOMContentLoaded', () => {
  // ==========================================================================
  // 1. Sidebar & View Switching
  // ==========================================================================
  const navItems = document.querySelectorAll('.admin-nav-item[data-target]');
  const viewSections = document.querySelectorAll('.view-section');
  const pageTitle = document.getElementById('topbarPageTitle');
  const sidebar = document.getElementById('adminSidebar');
  const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');

  const titles = {
    'dashboard-view': 'Flight Operations Dashboard',
    'flight-mgmt-view': 'Flight Management',
    'booking-mgmt-view': 'Passenger Reservations Management',
    'passenger-mgmt-view': 'Passenger Manifest & Records',
    'settings-mgmt-view': 'Administrator Security & Credentials'
  };

  function switchView(targetId) {
    navItems.forEach(item => {
      if (item.getAttribute('data-target') === targetId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    viewSections.forEach(section => {
      if (section.id === targetId) {
        section.classList.add('active');
      } else {
        section.classList.remove('active');
      }
    });

    if (pageTitle && titles[targetId]) {
      pageTitle.textContent = titles[targetId];
    }

    if (window.innerWidth <= 860 && sidebar) {
      sidebar.classList.remove('open');
    }

    if (targetId === 'dashboard-view') {
      loadDashboardData();
    }
  }

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const target = item.getAttribute('data-target');
      switchView(target);
    });
  });

  // Action links that jump to views (like buttons inside placeholder cards)
  document.querySelectorAll('a[data-target]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = link.getAttribute('data-target');
      switchView(target);
    });
  });

  // Mobile sidebar toggle
  if (sidebarToggleBtn && sidebar) {
    sidebarToggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 860 && sidebar.classList.contains('open')) {
        if (!sidebar.contains(e.target) && !sidebarToggleBtn.contains(e.target)) {
          sidebar.classList.remove('open');
        }
      }
    });
  }

  // Helper: Escape HTML to prevent XSS
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Helper: Format Indian Rupee currency (e.g. ₹5,500)
  function formatINR(amount) {
    const num = Number(amount);
    if (isNaN(num)) return '₹0';
    return '₹' + num.toLocaleString('en-IN');
  }

  // ==========================================================================
  // Dashboard Live Data Integration
  // ==========================================================================
  function renderDashboardStats(stats) {
    if (!stats) return;

    // Total Flights
    const totalFlightsEl = document.getElementById('dashTotalFlights');
    const flightsTrendText = document.getElementById('dashFlightsTrendText');
    if (totalFlightsEl) totalFlightsEl.textContent = Number(stats.total_flights || 0).toLocaleString();
    if (flightsTrendText) {
      const todayCount = stats.today_flights || 0;
      flightsTrendText.textContent = `+${todayCount} scheduled today`;
    }

    // Total Bookings: Exclude cancelled bookings from confirmed-booking statistics
    const totalBookingsEl = document.getElementById('dashTotalBookings');
    const bookingsTrendText = document.getElementById('dashBookingsTrendText');
    if (totalBookingsEl) {
      totalBookingsEl.textContent = Number(stats.confirmed_bookings || 0).toLocaleString();
    }
    if (bookingsTrendText) {
      const total = stats.total_bookings || 0;
      const cancelled = stats.cancelled_bookings || 0;
      const pending = stats.pending_bookings || 0;
      if (total === 0) {
        bookingsTrendText.textContent = '0 total bookings';
      } else {
        bookingsTrendText.textContent = `${total} total (${cancelled} cancelled, ${pending} pending)`;
      }
    }

    // Total Passengers
    const totalPaxEl = document.getElementById('dashTotalPassengers');
    const paxTrendText = document.getElementById('dashPassengersTrendText');
    if (totalPaxEl) {
      totalPaxEl.textContent = Number(stats.passenger_count || 0).toLocaleString();
    }
    if (paxTrendText) {
      const users = stats.registered_users || 0;
      paxTrendText.textContent = `${users} registered account${users === 1 ? '' : 's'}`;
    }

    // Available Seats
    const availSeatsEl = document.getElementById('dashAvailableSeats');
    const seatsTrendEl = document.getElementById('dashSeatsTrend');
    if (availSeatsEl) {
      availSeatsEl.textContent = Number(stats.available_seats || 0).toLocaleString();
    }
    if (seatsTrendEl) {
      const flightsCount = stats.total_flights || 0;
      seatsTrendEl.textContent = flightsCount > 0 ? `Across ${flightsCount} scheduled flight${flightsCount === 1 ? '' : 's'}` : 'Across all cabins';
    }
  }

  function renderBookingChart(chartData) {
    const chartEl = document.getElementById('dashBookingChart');
    const badgeEl = document.getElementById('dashChartBadge');
    const subTitleEl = document.getElementById('dashChartSubtitle');
    if (!chartEl) return;

    if (badgeEl) {
      badgeEl.textContent = 'Live Database Records';
      badgeEl.style.background = 'rgba(46, 204, 113, 0.15)';
      badgeEl.style.color = '#2ECC71';
      badgeEl.style.border = '1px solid rgba(46, 204, 113, 0.35)';
    }

    if (!chartData || !chartData.days || chartData.days.length === 0) {
      chartEl.innerHTML = `
        <div style="width:100%; text-align:center; padding: 2.5rem 1rem; color: var(--color-ivory-muted);">
          No booking records found in database.
        </div>
      `;
      return;
    }

    if (subTitleEl && chartData.start_date && chartData.end_date) {
      subTitleEl.textContent = `Weekly booking trends (${chartData.start_date} – ${chartData.end_date}) · ${chartData.total_chart_bookings || 0} active bookings`;
    }

    let html = '';
    chartData.days.forEach(day => {
      const heightPercent = day.percentage && day.percentage > 0 ? Math.max(12, day.percentage) : 4;
      const opacity = day.count > 0 ? '1' : '0.4';
      html += `
        <div class="bar-column">
          <div class="bar-pill" style="height: ${heightPercent}%; opacity: ${opacity};">
            <span class="bar-tooltip">${day.count} Booking${day.count === 1 ? '' : 's'} (${day.label || day.day})</span>
          </div>
          <span class="bar-label">${day.day}</span>
        </div>
      `;
    });
    chartEl.innerHTML = html;
  }

  function renderRecentBookings(bookings) {
    const tbody = document.getElementById('dashRecentBookingsBody');
    if (!tbody) return;

    if (!bookings || bookings.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="empty-table-state" style="text-align:center; padding: 2.5rem 1rem;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 32px; height: 32px; margin-bottom: 8px; opacity: 0.5;">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <div>No booking records found in database.</div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = bookings.map(b => {
      let pillClass = 'status-scheduled';
      if (b.booking_status === 'Confirmed') pillClass = 'status-confirmed';
      else if (b.booking_status === 'Cancelled') pillClass = 'status-cancelled';
      else if (b.booking_status === 'Pending') pillClass = 'status-delayed';

      return `
        <tr>
          <td><span class="booking-ref-code">${escapeHtml(b.pnr)}</span></td>
          <td>${escapeHtml(b.passenger_name)}</td>
          <td><span class="flight-code">${escapeHtml(b.flight_number)}</span></td>
          <td>${escapeHtml(b.travel_date)}</td>
          <td><span class="status-pill ${pillClass}">${escapeHtml(b.booking_status)}</span></td>
        </tr>
      `;
    }).join('');
  }

  function renderUpcomingFlights(flights) {
    const tbody = document.getElementById('dashUpcomingFlightsBody');
    if (!tbody) return;

    if (!flights || flights.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="empty-table-state" style="text-align:center; padding: 2.5rem 1rem;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 32px; height: 32px; margin-bottom: 8px; opacity: 0.5;">
              <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.3c.4-.2.6-.6.5-1.1z"></path>
            </svg>
            <div>No scheduled flights found.</div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = flights.map(f => {
      let pillClass = 'status-scheduled';
      if (f.flight_status === 'On Time') pillClass = 'status-on-time';
      else if (f.flight_status === 'Boarding') pillClass = 'status-boarding';
      else if (f.flight_status === 'Delayed') pillClass = 'status-delayed';
      else if (f.flight_status === 'Cancelled') pillClass = 'status-cancelled';

      return `
        <tr>
          <td><span class="flight-code">${escapeHtml(f.flight_number)}</span></td>
          <td>${escapeHtml(f.source)}</td>
          <td>${escapeHtml(f.destination)}</td>
          <td>${escapeHtml(f.departure_time)}</td>
          <td>${f.available_seats}</td>
          <td><span class="status-pill ${pillClass}">${escapeHtml(f.flight_status)}</span></td>
        </tr>
      `;
    }).join('');
  }

  async function loadDashboardData() {
    try {
      const response = await fetch('/api/admin/dashboard', {
        headers: { 'Accept': 'application/json' },
        credentials: 'same-origin'
      });
      if (response.status === 401) {
        window.location.href = 'admin-login.html';
        return;
      }
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.status === 'success') {
        renderDashboardStats(data.statistics);
        renderBookingChart(data.chart);
        renderRecentBookings(data.recent_bookings);
        renderUpcomingFlights(data.upcoming_flights);
      } else {
        console.warn('Dashboard data fetch response error:', data.message);
      }
    } catch (err) {
      console.error('Error fetching admin dashboard data:', err);
    }
  }

  // ==========================================================================
  // 2. Flight Management State & Database Backend Integration (Phase 6)
  // ==========================================================================
  let FLIGHTS_DATA = [];

  async function loadFlightsFromBackend() {
    try {
      const response = await fetch('/api/admin/flights', {
        headers: { 'Accept': 'application/json' },
        credentials: 'same-origin'
      });
      if (response.status === 401) {
        window.location.href = 'admin-login.html';
        return;
      }
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.status === 'success') {
        FLIGHTS_DATA = (data.flights || []).map(f => ({
          id: f.id,
          flightNumber: f.flight_number,
          airline: f.airline,
          source: f.source,
          destination: f.destination,
          departureDate: f.departure_date,
          departureTime: f.departure_time_str,
          arrivalDate: f.arrival_date,
          arrivalTime: f.arrival_time_str,
          duration: f.duration,
          fare: f.ticket_fare,
          totalSeats: f.total_seat_capacity,
          availableSeats: f.available_seats,
          occupiedSeats: f.occupied_seats,
          status: f.flight_status,
          bookingsCount: f.bookings_count || 0
        }));
        updateFilterDropdownOptions();
        renderFlightsTable();
        loadDashboardData();
      } else {
        console.error('Failed to load flights from backend:', data.message);
      }
    } catch (err) {
      console.error('Error fetching admin flights:', err);
    }
  }

  // DOM Elements for Flight Management
  const flightsTableBody = document.getElementById('flightsTableBody');
  const flightCountText = document.getElementById('flightCountText');
  const flightSearchInput = document.getElementById('flightSearchInput');
  const filterSourceSelect = document.getElementById('filterSourceSelect');
  const filterDestSelect = document.getElementById('filterDestSelect');
  const filterStatusSelect = document.getElementById('filterStatusSelect');
  const btnResetFilters = document.getElementById('btnResetFilters');

  // Modal Elements
  const flightFormModal = document.getElementById('flightFormModal');
  const modalFlightTitle = document.getElementById('modalFlightTitle');
  const openAddFlightModalBtn = document.getElementById('openAddFlightModalBtn');
  const closeFlightModalBtn = document.getElementById('closeFlightModalBtn');
  const cancelFlightModalBtn = document.getElementById('cancelFlightModalBtn');
  const flightRecordForm = document.getElementById('flightRecordForm');
  const saveFlightBtn = document.getElementById('saveFlightBtn');

  // Form Field Inputs
  const flightNumberInput = document.getElementById('flightNumberInput');
  const airlineNameInput = document.getElementById('airlineNameInput');
  const sourceAirportInput = document.getElementById('sourceAirportInput');
  const destAirportInput = document.getElementById('destAirportInput');
  const deptDateFormInput = document.getElementById('deptDateFormInput');
  const deptTimeFormInput = document.getElementById('deptTimeFormInput');
  const arrDateFormInput = document.getElementById('arrDateFormInput');
  const arrTimeFormInput = document.getElementById('arrTimeFormInput');
  const ticketFareInput = document.getElementById('ticketFareInput');
  const totalSeatsInput = document.getElementById('totalSeatsInput');
  const availableSeatsInput = document.getElementById('availableSeatsInput');
  const flightStatusSelect = document.getElementById('flightStatusSelect');
  const durationPreview = document.getElementById('durationPreview');

  // Delete Modal Elements
  const deleteConfirmModal = document.getElementById('deleteConfirmModal');
  const deleteFlightCodeText = document.getElementById('deleteFlightCodeText');
  const closeDeleteModalBtn = document.getElementById('closeDeleteModalBtn');
  const cancelDeleteModalBtn = document.getElementById('cancelDeleteModalBtn');
  const confirmDeleteFlightBtn = document.getElementById('confirmDeleteFlightBtn');
  const adminToastBanner = document.getElementById('adminToastBanner');

  let editingFlightId = null;
  let deletingFlightId = null;

  function showToast(message, type = 'success') {
    if (!adminToastBanner) return;
    adminToastBanner.className = `admin-toast-banner toast-${type}`;
    adminToastBanner.innerHTML = `${type === 'success' ? '✓' : '⚠️'} ${message}`;
    adminToastBanner.style.display = 'flex';
    setTimeout(() => {
      adminToastBanner.style.display = 'none';
    }, 4500);
  }

  // Helper: Status badge class map
  function getStatusBadgeClass(status) {
    switch (status) {
      case 'On Time': return 'status-on-time';
      case 'Boarding': return 'status-boarding';
      case 'Scheduled': return 'status-scheduled';
      case 'Delayed': return 'status-delayed';
      case 'Cancelled': return 'status-cancelled';
      default: return 'status-scheduled';
    }
  }

  // Helper: Split City & Code
  function formatAirport(airportStr) {
    const match = airportStr.match(/^(.+?)\s*\(([A-Z]{3})\)$/);
    if (match) {
      return `<div class="flight-route-cell"><span class="route-city">${match[1]}</span><span class="route-iata">${match[2]}</span></div>`;
    }
    return `<div class="flight-route-cell"><span class="route-city">${airportStr}</span></div>`;
  }

  // Populate Filter Dropdowns dynamically from current flight data
  function updateFilterDropdownOptions() {
    const sources = [...new Set(FLIGHTS_DATA.map(f => f.source))].sort();
    const destinations = [...new Set(FLIGHTS_DATA.map(f => f.destination))].sort();

    const currentSource = filterSourceSelect.value;
    const currentDest = filterDestSelect.value;

    filterSourceSelect.innerHTML = '<option value="">All Sources</option>';
    sources.forEach(src => {
      const opt = document.createElement('option');
      opt.value = src;
      opt.textContent = src;
      if (src === currentSource) opt.selected = true;
      filterSourceSelect.appendChild(opt);
    });

    filterDestSelect.innerHTML = '<option value="">All Destinations</option>';
    destinations.forEach(dst => {
      const opt = document.createElement('option');
      opt.value = dst;
      opt.textContent = dst;
      if (dst === currentDest) opt.selected = true;
      filterDestSelect.appendChild(opt);
    });
  }

  // Render Table Rows based on Search and Filter Criteria
  function renderFlightsTable() {
    const searchVal = flightSearchInput.value.toLowerCase().trim();
    const selectedSource = filterSourceSelect.value;
    const selectedDest = filterDestSelect.value;
    const selectedStatus = filterStatusSelect.value;

    const filtered = FLIGHTS_DATA.filter(flight => {
      const matchesSearch =
        flight.flightNumber.toLowerCase().includes(searchVal) ||
        flight.source.toLowerCase().includes(searchVal) ||
        flight.destination.toLowerCase().includes(searchVal) ||
        flight.airline.toLowerCase().includes(searchVal);

      const matchesSource = !selectedSource || flight.source === selectedSource;
      const matchesDest = !selectedDest || flight.destination === selectedDest;
      const matchesStatus = !selectedStatus || flight.status === selectedStatus;

      return matchesSearch && matchesSource && matchesDest && matchesStatus;
    });

    flightCountText.textContent = filtered.length;
    flightsTableBody.innerHTML = '';

    if (filtered.length === 0) {
      flightsTableBody.innerHTML = `
        <tr>
          <td colspan="13">
            <div class="empty-table-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <h4 style="color:var(--color-ivory); margin-bottom:0.25rem; font-size:1.1rem;">No Flights Found</h4>
              <p style="font-size:0.85rem;">No commercial flights match your current search and filter parameters.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    filtered.forEach(flight => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="flight-code">${flight.flightNumber}</span></td>
        <td>
          <div class="flight-airline-tag">
            <span class="airline-name">${flight.airline}</span>
          </div>
        </td>
        <td>${formatAirport(flight.source)}</td>
        <td>${formatAirport(flight.destination)}</td>
        <td>${flight.departureDate}</td>
        <td><strong>${flight.departureTime}</strong></td>
        <td><strong>${flight.arrivalTime}</strong></td>
        <td>${flight.duration}</td>
        <td><span class="flight-fare-val">${formatINR(flight.fare)}</span></td>
        <td><span class="seat-total">${flight.totalSeats} seats</span></td>
        <td>
          <div class="flight-seat-info">
            <span class="seat-avail">${flight.availableSeats}</span>
            <span class="seat-total">/ ${flight.totalSeats}</span>
          </div>
        </td>
        <td><span class="status-pill ${getStatusBadgeClass(flight.status)}">${flight.status}</span></td>
        <td style="text-align: right;">
          <div class="action-buttons-group">
            <button type="button" class="btn-action-btn btn-action-edit" data-id="${flight.id}" title="Edit flight details">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              <span>Edit</span>
            </button>
            <button type="button" class="btn-action-btn btn-action-delete" data-id="${flight.id}" title="Delete flight">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              <span>Delete</span>
            </button>
          </div>
        </td>
      `;

      // Attach actions
      const editBtn = tr.querySelector('.btn-action-edit');
      const deleteBtn = tr.querySelector('.btn-action-delete');

      editBtn.addEventListener('click', () => openEditFlightModal(flight.id));
      deleteBtn.addEventListener('click', () => openDeleteConfirmModal(flight.id));

      flightsTableBody.appendChild(tr);
    });
  }

  // Search & Filter event listeners
  flightSearchInput.addEventListener('input', renderFlightsTable);
  filterSourceSelect.addEventListener('change', renderFlightsTable);
  filterDestSelect.addEventListener('change', renderFlightsTable);
  filterStatusSelect.addEventListener('change', renderFlightsTable);

  btnResetFilters.addEventListener('click', () => {
    flightSearchInput.value = '';
    filterSourceSelect.value = '';
    filterDestSelect.value = '';
    filterStatusSelect.value = '';
    renderFlightsTable();
  });

  // Calculate duration between departure & arrival dates/times
  function computeDuration(dDate, dTime, aDate, aTime) {
    if (!dDate || !dTime || !aDate || !aTime) return null;
    const start = new Date(`${dDate}T${dTime}`);
    const end = new Date(`${aDate}T${aTime}`);
    const diffMs = end - start;
    if (isNaN(diffMs) || diffMs <= 0) return null;

    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
  }

  function updateDurationDisplay() {
    const dur = computeDuration(
      deptDateFormInput.value,
      deptTimeFormInput.value,
      arrDateFormInput.value,
      arrTimeFormInput.value
    );
    if (dur) {
      durationPreview.textContent = `Calculated Duration: ${dur}`;
      durationPreview.style.color = 'var(--color-champagne)';
    } else {
      durationPreview.textContent = 'Calculated Duration: (Requires valid departure and arrival)';
      durationPreview.style.color = 'var(--color-ivory-muted)';
    }
  }

  [deptDateFormInput, deptTimeFormInput, arrDateFormInput, arrTimeFormInput].forEach(inp => {
    inp.addEventListener('change', updateDurationDisplay);
  });

  // Automatically update available seats when total capacity changes if not yet manually set
  totalSeatsInput.addEventListener('input', () => {
    if (!editingFlightId && (!availableSeatsInput.value || availableSeatsInput.value === '')) {
      availableSeatsInput.value = totalSeatsInput.value;
    }
  });

  // ==========================================================================
  // 3. Modal Form Handling (Add / Edit)
  // ==========================================================================
  function clearFormErrors() {
    document.querySelectorAll('.modal-error-msg').forEach(msg => {
      msg.textContent = '';
      msg.classList.remove('visible');
    });
    document.querySelectorAll('.modal-input-control').forEach(ctrl => {
      ctrl.classList.remove('has-error');
    });
  }

  function setFieldError(fieldInput, errorElement, message) {
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.classList.add('visible');
    }
    if (fieldInput) {
      fieldInput.classList.add('has-error');
    }
  }

  function openAddFlightModal() {
    editingFlightId = null;
    modalFlightTitle.textContent = 'Add New Flight';
    saveFlightBtn.textContent = 'Save Flight';
    flightRecordForm.reset();
    clearFormErrors();

    // Default dates (departure tomorrow, arrival same day + 4h)
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    airlineNameInput.value = 'AeroVista Airlines';
    deptDateFormInput.value = dateStr;
    arrDateFormInput.value = dateStr;
    deptTimeFormInput.value = '10:00';
    arrTimeFormInput.value = '14:30';
    flightStatusSelect.value = 'Scheduled';
    updateDurationDisplay();

    flightFormModal.classList.add('active');
  }

  function openEditFlightModal(flightId) {
    const flight = FLIGHTS_DATA.find(f => f.id === flightId);
    if (!flight) return;

    editingFlightId = flightId;
    modalFlightTitle.textContent = `Edit Flight ${flight.flightNumber}`;
    saveFlightBtn.textContent = 'Update Flight';
    clearFormErrors();

    flightNumberInput.value = flight.flightNumber;
    airlineNameInput.value = flight.airline;
    sourceAirportInput.value = flight.source;
    destAirportInput.value = flight.destination;
    deptDateFormInput.value = flight.departureDate;
    deptTimeFormInput.value = flight.departureTime;
    arrDateFormInput.value = flight.arrivalDate || flight.departureDate;
    arrTimeFormInput.value = flight.arrivalTime;
    ticketFareInput.value = flight.fare;
    totalSeatsInput.value = flight.totalSeats;
    availableSeatsInput.value = flight.availableSeats;
    flightStatusSelect.value = flight.status;

    updateDurationDisplay();
    flightFormModal.classList.add('active');
  }

  function closeFlightModal() {
    flightFormModal.classList.remove('active');
    editingFlightId = null;
    flightRecordForm.reset();
    clearFormErrors();
  }

  openAddFlightModalBtn.addEventListener('click', openAddFlightModal);
  closeFlightModalBtn.addEventListener('click', closeFlightModal);
  cancelFlightModalBtn.addEventListener('click', closeFlightModal);

  // Form Submission (Add or Update) - Connected to Backend Database API
  flightRecordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFormErrors();

    let isValid = true;
    const flightNum = flightNumberInput.value.trim().toUpperCase();
    const airline = airlineNameInput.value.trim() || 'AeroVista Airlines';
    const source = sourceAirportInput.value;
    const dest = destAirportInput.value;
    const deptDate = deptDateFormInput.value;
    const deptTime = deptTimeFormInput.value;
    const arrDate = arrDateFormInput.value;
    const arrTime = arrTimeFormInput.value;
    const fare = parseFloat(ticketFareInput.value);
    const totalSeats = parseInt(totalSeatsInput.value, 10);
    const availSeats = parseInt(availableSeatsInput.value, 10);
    const status = flightStatusSelect.value;

    // 1. Flight Number
    if (!flightNum) {
      setFieldError(flightNumberInput, document.getElementById('errFlightNumber'), 'Flight number is required');
      isValid = false;
    }

    // 2. Airline
    if (!airline) {
      setFieldError(airlineNameInput, document.getElementById('errAirlineName'), 'Airline name is required');
      isValid = false;
    }

    // 3. Source & Destination validation (must not be identical)
    if (!source) {
      setFieldError(sourceAirportInput, document.getElementById('errSourceAirport'), 'Source airport is required');
      isValid = false;
    }

    if (!dest) {
      setFieldError(destAirportInput, document.getElementById('errDestAirport'), 'Destination airport is required');
      isValid = false;
    }

    if (source && dest && source === dest) {
      setFieldError(destAirportInput, document.getElementById('errDestAirport'), 'Source and Destination cannot be identical');
      isValid = false;
    }

    // 4. Departure Date & Time
    if (!deptDate) {
      setFieldError(deptDateFormInput, document.getElementById('errDeptDate'), 'Departure date is required');
      isValid = false;
    }
    if (!deptTime) {
      setFieldError(deptTimeFormInput, document.getElementById('errDeptTime'), 'Departure time is required');
      isValid = false;
    }

    // 5. Arrival Date & Time
    if (!arrDate) {
      setFieldError(arrDateFormInput, document.getElementById('errArrDate'), 'Arrival date is required');
      isValid = false;
    }
    if (!arrTime) {
      setFieldError(arrTimeFormInput, document.getElementById('errArrTime'), 'Arrival time is required');
      isValid = false;
    }

    // Chronological validation
    if (deptDate && deptTime && arrDate && arrTime) {
      const start = new Date(`${deptDate}T${deptTime}`);
      const end = new Date(`${arrDate}T${arrTime}`);
      if (end <= start) {
        setFieldError(arrTimeFormInput, document.getElementById('errArrTime'), 'Arrival must occur after departure');
        isValid = false;
      }
    }

    // 6. Ticket Fare
    if (isNaN(fare) || fare <= 0) {
      setFieldError(ticketFareInput, document.getElementById('errTicketFare'), 'Fare must be greater than ₹0');
      isValid = false;
    }

    // 7. Total Seats
    if (isNaN(totalSeats) || totalSeats <= 0 || totalSeats > 850) {
      setFieldError(totalSeatsInput, document.getElementById('errTotalSeats'), 'Total capacity must be between 1 and 850 seats');
      isValid = false;
    }

    // 8. Available Seats (must not exceed Total Seats)
    if (isNaN(availSeats) || availSeats < 0) {
      setFieldError(availableSeatsInput, document.getElementById('errAvailableSeats'), 'Available seats cannot be negative');
      isValid = false;
    } else if (availSeats > totalSeats) {
      setFieldError(availableSeatsInput, document.getElementById('errAvailableSeats'), `Available seats cannot exceed total capacity (${totalSeats})`);
      isValid = false;
    }

    if (!isValid) return;

    // Prevent duplicate form submission
    const origBtnHtml = saveFlightBtn.innerHTML;
    saveFlightBtn.disabled = true;
    saveFlightBtn.innerHTML = editingFlightId ? '<span>Updating...</span>' : '<span>Saving Flight...</span>';

    const payload = {
      flight_number: flightNum,
      airline: airline,
      source: source,
      destination: dest,
      departure_date: deptDate,
      departure_time: deptTime,
      arrival_date: arrDate,
      arrival_time: arrTime,
      ticket_fare: fare,
      total_seat_capacity: totalSeats,
      available_seats: availSeats,
      flight_status: status
    };

    try {
      const url = editingFlightId ? `/api/admin/flights/${editingFlightId}` : '/api/admin/flights';
      const method = editingFlightId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'same-origin',
        body: JSON.stringify(payload)
      });

      const result = await response.json().catch(() => ({}));

      if (response.ok && result.status === 'success') {
        showToast(result.message || (editingFlightId ? `Flight ${flightNum} updated.` : `Flight ${flightNum} created.`));
        closeFlightModal();
        await loadFlightsFromBackend();
      } else {
        const errorMsg = result.message || 'Failed to save flight record.';
        // Map backend errors to form inputs if specific
        if (errorMsg.toLowerCase().includes('flight number')) {
          setFieldError(flightNumberInput, document.getElementById('errFlightNumber'), errorMsg);
        } else if (errorMsg.toLowerCase().includes('source') || errorMsg.toLowerCase().includes('destination')) {
          setFieldError(destAirportInput, document.getElementById('errDestAirport'), errorMsg);
        } else if (errorMsg.toLowerCase().includes('arrival')) {
          setFieldError(arrTimeFormInput, document.getElementById('errArrTime'), errorMsg);
        } else if (errorMsg.toLowerCase().includes('fare')) {
          setFieldError(ticketFareInput, document.getElementById('errTicketFare'), errorMsg);
        } else if (errorMsg.toLowerCase().includes('capacity') || errorMsg.toLowerCase().includes('seats')) {
          setFieldError(totalSeatsInput, document.getElementById('errTotalSeats'), errorMsg);
        } else {
          showToast(`⚠️ ${errorMsg}`);
        }
      }
    } catch (err) {
      console.error('Error submitting flight form:', err);
      showToast('⚠️ A network error occurred while communicating with the server.');
    } finally {
      saveFlightBtn.disabled = false;
      saveFlightBtn.innerHTML = origBtnHtml;
    }
  });

  // ==========================================================================
  // 4. Delete Confirmation Handling - Connected to Backend Database API
  // ==========================================================================
  function openDeleteConfirmModal(flightId) {
    const flight = FLIGHTS_DATA.find(f => f.id === flightId);
    if (!flight) return;

    deletingFlightId = flightId;
    deleteFlightCodeText.textContent = `${flight.flightNumber} (${flight.source} → ${flight.destination})`;
    deleteConfirmModal.classList.add('active');
  }

  function closeDeleteModal() {
    deleteConfirmModal.classList.remove('active');
    deletingFlightId = null;
  }

  closeDeleteModalBtn.addEventListener('click', closeDeleteModal);
  cancelDeleteModalBtn.addEventListener('click', closeDeleteModal);

  confirmDeleteFlightBtn.addEventListener('click', async () => {
    if (!deletingFlightId) return;

    const origBtnHtml = confirmDeleteFlightBtn.innerHTML;
    confirmDeleteFlightBtn.disabled = true;
    confirmDeleteFlightBtn.innerHTML = '<span>Deleting...</span>';

    try {
      const response = await fetch(`/api/admin/flights/${deletingFlightId}`, {
        method: 'DELETE',
        headers: { 'Accept': 'application/json' },
        credentials: 'same-origin'
      });

      const result = await response.json().catch(() => ({}));

      if (response.ok && result.status === 'success') {
        showToast(result.message || 'Flight deleted successfully.');
        closeDeleteModal();
        await loadFlightsFromBackend();
      } else {
        const errorMsg = result.message || 'Could not delete flight record.';
        closeDeleteModal();
        showToast(`⚠️ ${errorMsg}`);
      }
    } catch (err) {
      console.error('Error deleting flight:', err);
      closeDeleteModal();
      showToast('⚠️ A network error occurred while attempting to delete the flight.');
    } finally {
      confirmDeleteFlightBtn.disabled = false;
      confirmDeleteFlightBtn.innerHTML = origBtnHtml;
    }
  });

  // Close modals on clicking overlay backdrop
  [flightFormModal, deleteConfirmModal].forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        if (modal === flightFormModal) closeFlightModal();
        if (modal === deleteConfirmModal) closeDeleteModal();
      }
    });
  });

  // ==========================================================================
  // 5. Booking Management Module (Admin Portal Step)
  // ==========================================================================
  // Ingest or initialize demonstration bookings shared with passenger flow
  function getDemonstrationBookings() {
    let bookings = [];

    // 1. Try to load saved admin bookings from localStorage
    try {
      const rawAdmin = localStorage.getItem('aerovista_admin_bookings');
      if (rawAdmin) {
        bookings = JSON.parse(rawAdmin);
      }
    } catch (e) {
      console.warn('Could not parse aerovista_admin_bookings', e);
    }

    // 2. Base realistic demonstration bookings dataset
    const baseBookings = [
      {
        pnr: 'AV-7K2M91',
        passengerName: 'Alexander Wright',
        title: 'Mr',
        email: 'alexander.wright@luxurytravel.com',
        phone: '+971 50 123 4567',
        nationality: 'United Arab Emirates',
        idType: 'Passport',
        idNumber: 'A12345678',
        flightNumber: 'AV-801',
        airline: 'AeroVista Airlines',
        sourceCity: 'Dubai',
        sourceCode: 'DXB',
        destCity: 'Mumbai',
        destCode: 'BOM',
        travelDate: '2026-11-19',
        departureTime: '13:10',
        arrivalTime: '02:35',
        cabinClass: 'Economy Class',
        passengerCount: 1,
        seats: [{ passenger: 'Alexander Wright', seat: '10A', category: 'Extra Legroom' }],
        ticketFare: 3705,
        seatCharges: 500,
        totalAmount: 4205,
        bookingStatus: 'Confirmed',
        paymentStatus: 'Paid',
        paymentMethod: 'Credit Card',
        transactionId: 'TXN-902183141'
      },
      {
        pnr: 'AV-9P4W28',
        passengerName: 'Eleanor Vance',
        title: 'Ms',
        email: 'e.vance@prestigesuites.co.uk',
        phone: '+44 7700 900123',
        nationality: 'United Kingdom',
        idType: 'Passport',
        idNumber: 'P89214729',
        flightNumber: 'AV-204',
        airline: 'AeroVista Airlines',
        sourceCity: 'Dubai',
        sourceCode: 'DXB',
        destCity: 'London',
        destCode: 'LHR',
        travelDate: '2026-11-10',
        departureTime: '14:30',
        arrivalTime: '19:15',
        cabinClass: 'Business Class',
        passengerCount: 2,
        seats: [
          { passenger: 'Eleanor Vance', seat: '2A', category: 'Business Suite' },
          { passenger: 'Julian Vance', seat: '2E', category: 'Business Suite' }
        ],
        ticketFare: 11000,
        seatCharges: 0,
        totalAmount: 11000,
        bookingStatus: 'Confirmed',
        paymentStatus: 'Paid',
        paymentMethod: 'Debit Card',
        transactionId: 'TXN-874192004'
      },
      {
        pnr: 'AV-3X8K62',
        passengerName: 'Rajesh Sharma',
        title: 'Dr',
        email: 'r.sharma@medglobal.in',
        phone: '+91 98201 54321',
        nationality: 'India',
        idType: 'Passport',
        idNumber: 'Z58129304',
        flightNumber: 'AV-101',
        airline: 'AeroVista Airlines',
        sourceCity: 'Mumbai',
        sourceCode: 'BOM',
        destCity: 'Doha',
        destCode: 'DOH',
        travelDate: '2026-11-10',
        departureTime: '16:45',
        arrivalTime: '18:50',
        cabinClass: 'Economy Class',
        passengerCount: 1,
        seats: [{ passenger: 'Rajesh Sharma', seat: '15C', category: 'Emergency Exit' }],
        ticketFare: 4200,
        seatCharges: 700,
        totalAmount: 4900,
        bookingStatus: 'Pending',
        paymentStatus: 'Pending',
        paymentMethod: 'UPI',
        transactionId: 'TXN-PENDING-718'
      },
      {
        pnr: 'AV-5M1Q83',
        passengerName: 'Sophie Dubois',
        title: 'Mrs',
        email: 'sophie.dubois@luxeparis.fr',
        phone: '+33 6 12 34 56 78',
        nationality: 'France',
        idType: 'Passport',
        idNumber: 'F90123841',
        flightNumber: 'AV-305',
        airline: 'AeroVista Airlines',
        sourceCity: 'Paris',
        sourceCode: 'CDG',
        destCity: 'New York',
        destCode: 'JFK',
        travelDate: '2026-11-11',
        departureTime: '18:15',
        arrivalTime: '21:05',
        cabinClass: 'Economy Class',
        passengerCount: 1,
        seats: [{ passenger: 'Sophie Dubois', seat: '12A', category: 'Standard' }],
        ticketFare: 7500,
        seatCharges: 0,
        totalAmount: 7500,
        bookingStatus: 'Cancelled',
        paymentStatus: 'Refunded',
        paymentMethod: 'Credit Card',
        transactionId: 'TXN-712984012'
      }
    ];

    if (!bookings || bookings.length === 0) {
      bookings = baseBookings;
    }

    // 3. Integrate live confirmed booking from passenger booking flow
    try {
      let rawLive = localStorage.getItem('aerovista_confirmed_booking');
      if (!rawLive) {
        rawLive = sessionStorage.getItem('aerovista_confirmed_booking');
      }

      if (rawLive) {
        const liveBooking = JSON.parse(rawLive);
        if (liveBooking && liveBooking.paymentDetails) {
          const livePnr = (liveBooking.paymentDetails.bookingReference || '').trim().toUpperCase();
          const liveFlight = liveBooking.flightBooking ? (liveBooking.flightBooking.outbound ? liveBooking.flightBooking.outbound.flight : {}) : {};
          const livePassengers = liveBooking.passengers || [];
          const leadPassenger = livePassengers[0] || {};
          const isCancelled = liveBooking.bookingStatus === 'CANCELLED' || liveBooking.paymentDetails.status === 'CANCELLED';

          const liveSeats = [];
          livePassengers.forEach(p => {
            let sCode = '10A';
            let sCat = 'Extra Legroom';
            if (p.seatAllocation && p.seatAllocation.outbound) {
              sCode = p.seatAllocation.outbound.code;
              sCat = p.seatAllocation.outbound.categoryLabel;
            } else if (p.outboundSeat) {
              sCode = p.outboundSeat.code;
              sCat = p.outboundSeat.categoryLabel;
            }
            liveSeats.push({
              passenger: `${p.title ? p.title + ' ' : ''}${p.fullName || 'Passenger'}`,
              seat: sCode,
              category: sCat
            });
          });

          const liveFormatted = {
            pnr: livePnr,
            passengerName: `${leadPassenger.title ? leadPassenger.title + ' ' : ''}${leadPassenger.fullName || 'Passenger'}`,
            title: leadPassenger.title || 'Mr',
            email: leadPassenger.contactEmail || 'passenger@aerovista.com',
            phone: leadPassenger.contactPhone || '+971 50 123 4567',
            nationality: leadPassenger.nationality || 'United Arab Emirates',
            idType: leadPassenger.idType || 'Passport',
            idNumber: leadPassenger.idNumber || 'Verified ID',
            flightNumber: liveFlight.flightNumber || 'AV-801',
            airline: liveFlight.airline || 'AeroVista Airlines',
            sourceCity: liveFlight.sourceCity || 'Dubai',
            sourceCode: liveFlight.sourceCode || 'DXB',
            destCity: liveFlight.destCity || 'Mumbai',
            destCode: liveFlight.destCode || 'BOM',
            travelDate: (liveBooking.flightBooking && liveBooking.flightBooking.searchQuery && liveBooking.flightBooking.searchQuery.departureDate) || '2026-11-19',
            departureTime: liveFlight.departureTime || '13:10',
            arrivalTime: liveFlight.arrivalTime || '02:35',
            cabinClass: (liveBooking.flightBooking && liveBooking.flightBooking.outbound && liveBooking.flightBooking.outbound.cabin === 'business') ? 'Business Class' : 'Economy Class',
            passengerCount: livePassengers.length || 1,
            seats: liveSeats.length > 0 ? liveSeats : [{ passenger: leadPassenger.fullName || 'Alexander Wright', seat: '10A', category: 'Extra Legroom' }],
            ticketFare: (liveBooking.fareSummary && liveBooking.fareSummary.totalTicketFare) || 3705,
            seatCharges: (liveBooking.fareSummary && liveBooking.fareSummary.totalSeatCharges) || 500,
            totalAmount: (liveBooking.paymentDetails && liveBooking.paymentDetails.amountPaid) || (liveBooking.fareSummary && liveBooking.fareSummary.totalPayable) || 4205,
            bookingStatus: isCancelled ? 'Cancelled' : 'Confirmed',
            paymentStatus: isCancelled ? 'Pending Refund' : 'Paid',
            paymentMethod: liveBooking.paymentDetails.method || 'Credit Card',
            transactionId: liveBooking.paymentDetails.transactionId || 'TXN-LIVE'
          };

          // Upsert into bookings array by PNR
          const existingIdx = bookings.findIndex(b => b.pnr.toUpperCase() === livePnr);
          if (existingIdx !== -1) {
            bookings[existingIdx] = liveFormatted;
          } else {
            bookings.unshift(liveFormatted);
          }
        }
      }
    } catch (err) {
      console.warn('Error incorporating live passenger booking:', err);
    }

    return bookings;
  }

  let BOOKINGS_DATA = getDemonstrationBookings();

  function saveAdminBookings() {
    try {
      localStorage.setItem('aerovista_admin_bookings', JSON.stringify(BOOKINGS_DATA));
    } catch (e) {
      console.warn('Could not save admin bookings', e);
    }
  }

  // Summary Card Elements
  const cardTotalBookings = document.getElementById('cardTotalBookings');
  const cardConfirmedBookings = document.getElementById('cardConfirmedBookings');
  const cardPendingBookings = document.getElementById('cardPendingBookings');
  const cardCancelledBookings = document.getElementById('cardCancelledBookings');
  const bookingCountText = document.getElementById('bookingCountText');

  // Filter Elements
  const bookingSearchInput = document.getElementById('bookingSearchInput');
  const filterBookingStatus = document.getElementById('filterBookingStatus');
  const filterPaymentStatus = document.getElementById('filterPaymentStatus');
  const filterTravelDate = document.getElementById('filterTravelDate');
  const btnResetBookingFilters = document.getElementById('btnResetBookingFilters');
  const bookingsTableBody = document.getElementById('bookingsTableBody');

  // Modal Elements
  const bookingDetailsModal = document.getElementById('bookingDetailsModal');
  const closeBookingDetailsModalBtn = document.getElementById('closeBookingDetailsModalBtn');
  const closeBookingDetailsBtn = document.getElementById('closeBookingDetailsBtn');
  const modalBtnCancelBooking = document.getElementById('modalBtnCancelBooking');

  const adminCancelConfirmModal = document.getElementById('adminCancelConfirmModal');
  const closeAdminCancelModalBtn = document.getElementById('closeAdminCancelModalBtn');
  const cancelAdminCancelModalBtn = document.getElementById('cancelAdminCancelModalBtn');
  const confirmAdminCancelBookingBtn = document.getElementById('confirmAdminCancelBookingBtn');
  const adminCancelPnrText = document.getElementById('adminCancelPnrText');

  let activeModalBooking = null;
  let targetCancelPnr = null;

  // Recalculate summary cards
  function updateBookingSummaryCards() {
    const total = BOOKINGS_DATA.length;
    const confirmed = BOOKINGS_DATA.filter(b => b.bookingStatus === 'Confirmed').length;
    const pending = BOOKINGS_DATA.filter(b => b.bookingStatus === 'Pending').length;
    const cancelled = BOOKINGS_DATA.filter(b => b.bookingStatus === 'Cancelled').length;

    if (cardTotalBookings) cardTotalBookings.textContent = total.toLocaleString();
    if (cardConfirmedBookings) cardConfirmedBookings.textContent = confirmed.toLocaleString();
    if (cardPendingBookings) cardPendingBookings.textContent = pending.toLocaleString();
    if (cardCancelledBookings) cardCancelledBookings.textContent = cancelled.toLocaleString();
  }

  // Render Table
  async function renderBookingsTable() {
    if (!bookingsTableBody) return;

    const searchTerm = (bookingSearchInput ? bookingSearchInput.value : '').trim().toLowerCase();
    const selBookingStatus = (filterBookingStatus ? filterBookingStatus.value : '').trim();
    const selPaymentStatus = (filterPaymentStatus ? filterPaymentStatus.value : '').trim();
    const selTravelDate = (filterTravelDate ? filterTravelDate.value : '').trim();

    try {
      const qParams = new URLSearchParams();
      if (searchTerm) qParams.set('search', searchTerm);
      if (selBookingStatus) qParams.set('booking_status', selBookingStatus);
      if (selPaymentStatus) qParams.set('payment_status', selPaymentStatus);
      if (selTravelDate) qParams.set('date', selTravelDate);

      const resp = await fetch(`/api/admin/bookings?${qParams.toString()}`);
      if (resp.ok) {
        const json = await resp.json();
        const serverBookings = json.bookings || [];
        if (json.metrics) {
          if (cardTotalBookings) cardTotalBookings.textContent = json.metrics.total.toLocaleString();
          if (cardConfirmedBookings) cardConfirmedBookings.textContent = json.metrics.confirmed.toLocaleString();
          if (cardPendingBookings) cardPendingBookings.textContent = json.metrics.pending.toLocaleString();
          if (cardCancelledBookings) cardCancelledBookings.textContent = json.metrics.cancelled.toLocaleString();
        }
        BOOKINGS_DATA = serverBookings;
      }
    } catch (e) {
      console.warn('Could not load bookings from backend, falling back to local data', e);
      BOOKINGS_DATA = getDemonstrationBookings();
      updateBookingSummaryCards();
    }

    const filtered = BOOKINGS_DATA.filter(b => {
      // 1. Search by PNR, passenger name or flight number
      if (searchTerm) {
        const matchPnr = b.pnr.toLowerCase().includes(searchTerm);
        const matchName = (b.passengerName || '').toLowerCase().includes(searchTerm);
        const matchFlight = (b.flightNumber || '').toLowerCase().includes(searchTerm);
        if (!matchPnr && !matchName && !matchFlight) return false;
      }

      // 2. Filter by booking status
      if (selBookingStatus && b.bookingStatus !== selBookingStatus) {
        return false;
      }

      // 3. Filter by payment status
      if (selPaymentStatus && b.paymentStatus !== selPaymentStatus) {
        return false;
      }

      // 4. Filter by travel date
      if (selTravelDate && b.travelDate !== selTravelDate) {
        return false;
      }

      return true;
    });

    if (bookingCountText) {
      bookingCountText.textContent = filtered.length;
    }

    bookingsTableBody.innerHTML = '';

    if (filtered.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td colspan="10" class="empty-table-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 32px; height: 32px; margin-bottom: 8px;">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <div>No booking reservations found matching the specified filters.</div>
        </td>
      `;
      bookingsTableBody.appendChild(tr);
      return;
    }

    filtered.forEach(b => {
      const tr = document.createElement('tr');

      // Status pill classes
      let bookingPillClass = 'status-scheduled';
      if (b.bookingStatus === 'Confirmed') bookingPillClass = 'status-confirmed';
      if (b.bookingStatus === 'Cancelled') bookingPillClass = 'status-cancelled';
      if (b.bookingStatus === 'Pending') bookingPillClass = 'status-delayed';

      let paymentPillClass = 'status-confirmed';
      if (b.paymentStatus === 'Pending') paymentPillClass = 'status-delayed';
      if (b.paymentStatus === 'Refunded' || b.paymentStatus === 'Pending Refund') paymentPillClass = 'status-cancelled';

      const isCancelled = b.bookingStatus === 'Cancelled';

      const sCity = b.sourceCity || (b.source ? b.source.replace(/\s*\([^)]*\)/, '').trim() : 'Dubai');
      const dCity = b.destCity || (b.destination ? b.destination.replace(/\s*\([^)]*\)/, '').trim() : 'Mumbai');
      const sCode = b.sourceCode || (b.source && b.source.match(/\(([A-Z]{3})\)/) ? b.source.match(/\(([A-Z]{3})\)/)[1] : (b.source ? b.source.substring(0, 3).toUpperCase() : 'DXB'));
      const dCode = b.destCode || (b.destination && b.destination.match(/\(([A-Z]{3})\)/) ? b.destination.match(/\(([A-Z]{3})\)/)[1] : (b.destination ? b.destination.substring(0, 3).toUpperCase() : 'BOM'));

      tr.innerHTML = `
        <td><span class="booking-ref-code">${b.pnr}</span></td>
        <td><strong>${b.passengerName}</strong></td>
        <td><span class="flight-code">${b.flightNumber}</span></td>
        <td>
          <div class="flight-route-cell">
            <span class="route-city">${sCity} → ${dCity}</span>
            <span class="route-iata">${sCode} - ${dCode}</span>
          </div>
        </td>
        <td>${b.travelDate}</td>
        <td><span style="font-weight:600; color:var(--color-ivory);">${b.passengerCount} Pax</span></td>
        <td><span class="flight-fare-val">${formatINR(b.totalAmount)}</span></td>
        <td><span class="status-pill ${bookingPillClass}">${b.bookingStatus}</span></td>
        <td><span class="status-pill ${paymentPillClass}">${b.paymentStatus}</span></td>
        <td>
          <div class="action-buttons-group">
            <button type="button" class="btn-action-btn btn-action-edit btn-view-booking" data-pnr="${b.pnr}" title="View Details">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
              <span>View</span>
            </button>
            <button type="button" class="btn-action-btn btn-action-delete btn-cancel-booking" data-pnr="${b.pnr}" ${isCancelled ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''} title="${isCancelled ? 'Already Cancelled' : 'Cancel Reservation'}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
              <span>${isCancelled ? 'Cancelled' : 'Cancel'}</span>
            </button>
          </div>
        </td>
      `;

      bookingsTableBody.appendChild(tr);
    });

    // Attach Event Listeners to View and Cancel buttons
    document.querySelectorAll('.btn-view-booking').forEach(btn => {
      btn.addEventListener('click', () => {
        const pnr = btn.getAttribute('data-pnr');
        openBookingDetailsModal(pnr);
      });
    });

    document.querySelectorAll('.btn-cancel-booking').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        const pnr = btn.getAttribute('data-pnr');
        openAdminCancelModal(pnr);
      });
    });
  }

  // Open Details Modal
  function openBookingDetailsModal(pnr) {
    const booking = BOOKINGS_DATA.find(b => b.pnr.toUpperCase() === pnr.toUpperCase());
    if (!booking) return;

    activeModalBooking = booking;

    const modalBookingPnr = document.getElementById('modalBookingPnr');
    const modalBookingStatusPill = document.getElementById('modalBookingStatusPill');
    const modalPaymentStatusPill = document.getElementById('modalPaymentStatusPill');
    const modalFlightNumber = document.getElementById('modalFlightNumber');
    const modalRoute = document.getElementById('modalRoute');
    const modalTravelDate = document.getElementById('modalTravelDate');
    const modalCabinClass = document.getElementById('modalCabinClass');
    const modalPassengersList = document.getElementById('modalPassengersList');
    const modalTicketFare = document.getElementById('modalTicketFare');
    const modalSeatCharges = document.getElementById('modalSeatCharges');
    const modalTotalPaid = document.getElementById('modalTotalPaid');
    const modalPaymentChannel = document.getElementById('modalPaymentChannel');

    if (modalBookingPnr) modalBookingPnr.textContent = booking.pnr;

    if (modalBookingStatusPill) {
      modalBookingStatusPill.textContent = booking.bookingStatus;
      modalBookingStatusPill.className = 'status-pill ' + (booking.bookingStatus === 'Confirmed' ? 'status-confirmed' : (booking.bookingStatus === 'Cancelled' ? 'status-cancelled' : 'status-delayed'));
    }

    if (modalPaymentStatusPill) {
      modalPaymentStatusPill.textContent = booking.paymentStatus;
      modalPaymentStatusPill.className = 'status-pill ' + (booking.paymentStatus === 'Paid' ? 'status-confirmed' : 'status-cancelled');
    }

    const modalSCity = booking.sourceCity || (booking.source ? booking.source.replace(/\s*\([^)]*\)/, '').trim() : 'Dubai');
    const modalDCity = booking.destCity || (booking.destination ? booking.destination.replace(/\s*\([^)]*\)/, '').trim() : 'Mumbai');
    const modalSCode = booking.sourceCode || (booking.source && booking.source.match(/\(([A-Z]{3})\)/) ? booking.source.match(/\(([A-Z]{3})\)/)[1] : 'DXB');
    const modalDCode = booking.destCode || (booking.destination && booking.destination.match(/\(([A-Z]{3})\)/) ? booking.destination.match(/\(([A-Z]{3})\)/)[1] : 'BOM');

    if (modalFlightNumber) modalFlightNumber.textContent = `${booking.airline || 'AeroVista Airlines'} ${booking.flightNumber}`;
    if (modalRoute) modalRoute.textContent = `${modalSCity} (${modalSCode}) → ${modalDCity} (${modalDCode})`;
    if (modalTravelDate) modalTravelDate.textContent = `${booking.travelDate} • ${booking.departureTime}`;
    if (modalCabinClass) modalCabinClass.textContent = booking.cabinClass;

    // Render passengers list
    if (modalPassengersList) {
      modalPassengersList.innerHTML = '';
      (booking.seats || []).forEach(s => {
        const item = document.createElement('div');
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';
        item.style.padding = '8px 12px';
        item.style.background = 'rgba(0,0,0,0.2)';
        item.style.borderRadius = '6px';
        item.style.fontSize = '0.84rem';
        item.innerHTML = `
          <div>
            <strong style="color: var(--color-champagne-light);">${s.passenger}</strong>
            <span style="color: var(--color-ivory-muted); font-size: 0.75rem; margin-left: 8px;">(${booking.idType || 'ID'}: ${booking.idNumber || 'Verified'})</span>
          </div>
          <div>
            <span style="display:inline-block; padding: 2px 8px; border-radius: 4px; background: rgba(198,166,107,0.15); border: 1px solid rgba(198,166,107,0.3); color: var(--color-champagne-light); font-weight: 600; font-size: 0.8rem;">
              Seat ${s.seat} • ${s.category}
            </span>
          </div>
        `;
        modalPassengersList.appendChild(item);
      });
    }

    if (modalTicketFare) modalTicketFare.textContent = formatINR(booking.ticketFare);
    if (modalSeatCharges) modalSeatCharges.textContent = formatINR(booking.seatCharges);
    if (modalTotalPaid) modalTotalPaid.textContent = formatINR(booking.totalAmount);
    if (modalPaymentChannel) modalPaymentChannel.textContent = `${booking.paymentMethod} (${booking.transactionId || 'TXN-PAID'})`;

    // Modal Cancel button state
    if (modalBtnCancelBooking) {
      if (booking.bookingStatus === 'Cancelled') {
        modalBtnCancelBooking.disabled = true;
        modalBtnCancelBooking.style.opacity = '0.4';
        modalBtnCancelBooking.style.cursor = 'not-allowed';
        modalBtnCancelBooking.querySelector('span').textContent = 'Already Cancelled';
      } else {
        modalBtnCancelBooking.disabled = false;
        modalBtnCancelBooking.style.opacity = '1';
        modalBtnCancelBooking.style.cursor = 'pointer';
        modalBtnCancelBooking.querySelector('span').textContent = 'Cancel This Booking';
      }
    }

    if (bookingDetailsModal) {
      bookingDetailsModal.classList.add('active');
    }
  }

  function closeBookingDetailsModal() {
    if (bookingDetailsModal) {
      bookingDetailsModal.classList.remove('active');
    }
    activeModalBooking = null;
  }

  if (closeBookingDetailsModalBtn) closeBookingDetailsModalBtn.addEventListener('click', closeBookingDetailsModal);
  if (closeBookingDetailsBtn) closeBookingDetailsBtn.addEventListener('click', closeBookingDetailsModal);

  // Trigger Cancel from inside Details Modal
  if (modalBtnCancelBooking) {
    modalBtnCancelBooking.addEventListener('click', () => {
      if (!activeModalBooking || activeModalBooking.bookingStatus === 'Cancelled') return;
      const pnr = activeModalBooking.pnr;
      closeBookingDetailsModal();
      openAdminCancelModal(pnr);
    });
  }

  // Open Cancel Confirmation Modal
  function openAdminCancelModal(pnr) {
    targetCancelPnr = pnr;
    if (adminCancelPnrText) adminCancelPnrText.textContent = pnr;
    if (adminCancelConfirmModal) adminCancelConfirmModal.classList.add('active');
  }

  function closeAdminCancelModal() {
    if (adminCancelConfirmModal) adminCancelConfirmModal.classList.remove('active');
    targetCancelPnr = null;
  }

  if (closeAdminCancelModalBtn) closeAdminCancelModalBtn.addEventListener('click', closeAdminCancelModal);
  if (cancelAdminCancelModalBtn) cancelAdminCancelModalBtn.addEventListener('click', closeAdminCancelModal);

  // Execute Cancellation
  if (confirmAdminCancelBookingBtn) {
    confirmAdminCancelBookingBtn.addEventListener('click', async () => {
      if (!targetCancelPnr) return;

      const pnrUpper = targetCancelPnr.toUpperCase();

      // 1. Call backend cancellation API
      try {
        const resp = await fetch(`/api/admin/bookings/${encodeURIComponent(pnrUpper)}/cancel`, {
          method: 'POST'
        });
        const data = await resp.json().catch(() => ({}));
        if (resp.ok) {
          showToast(`Reservation <strong>${pnrUpper}</strong> has been cancelled and seats released.`);
          closeAdminCancelModal();
          await renderBookingsTable();
          loadDashboardData();
          return;
        } else {
          console.warn('Backend cancel failed, updating local state:', data.message);
        }
      } catch (err) {
        console.warn('Network error while cancelling via admin API:', err);
      }

      const bIndex = BOOKINGS_DATA.findIndex(b => b.pnr.toUpperCase() === pnrUpper);

      if (bIndex !== -1) {
        BOOKINGS_DATA[bIndex].bookingStatus = 'Cancelled';
        BOOKINGS_DATA[bIndex].paymentStatus = 'Pending Refund';
        saveAdminBookings();

        // Release seats back to shared inventory
        try {
          const releasedSeats = [];
          if (BOOKINGS_DATA[bIndex].seats) {
            BOOKINGS_DATA[bIndex].seats.forEach(s => {
              if (s.seat) releasedSeats.push(s.seat);
            });
          }

          let globalReleased = [];
          const rawRel = localStorage.getItem('aerovista_released_seats');
          if (rawRel) globalReleased = JSON.parse(rawRel);
          globalReleased = Array.from(new Set([...globalReleased, ...releasedSeats]));
          localStorage.setItem('aerovista_released_seats', JSON.stringify(globalReleased));
        } catch (e) {
          console.warn('Error releasing seats in admin:', e);
        }

        // Synchronize with confirmed booking in localStorage/sessionStorage if this is the active user booking
        try {
          let rawLive = localStorage.getItem('aerovista_confirmed_booking') || sessionStorage.getItem('aerovista_confirmed_booking');
          if (rawLive) {
            const liveObj = JSON.parse(rawLive);
            if (liveObj && liveObj.paymentDetails && (liveObj.paymentDetails.bookingReference || '').toUpperCase() === pnrUpper) {
              liveObj.bookingStatus = 'CANCELLED';
              liveObj.refundStatus = 'PENDING_REFUND';
              liveObj.paymentDetails.status = 'CANCELLED';
              liveObj.paymentDetails.refundStatus = 'PENDING_REFUND';
              localStorage.setItem('aerovista_confirmed_booking', JSON.stringify(liveObj));
              sessionStorage.setItem('aerovista_confirmed_booking', JSON.stringify(liveObj));
            }
          }
        } catch (e) {
          console.warn('Error syncing live confirmed booking from admin cancel:', e);
        }

        showToast(`Reservation <strong>${pnrUpper}</strong> has been cancelled and seats released.`);
      }

      closeAdminCancelModal();
      renderBookingsTable();
      loadDashboardData();
    });
  }

  // Filter Listeners
  if (bookingSearchInput) {
    bookingSearchInput.addEventListener('input', renderBookingsTable);
  }
  if (filterBookingStatus) {
    filterBookingStatus.addEventListener('change', renderBookingsTable);
  }
  if (filterPaymentStatus) {
    filterPaymentStatus.addEventListener('change', renderBookingsTable);
  }
  if (filterTravelDate) {
    filterTravelDate.addEventListener('change', renderBookingsTable);
  }

  if (btnResetBookingFilters) {
    btnResetBookingFilters.addEventListener('click', () => {
      if (bookingSearchInput) bookingSearchInput.value = '';
      if (filterBookingStatus) filterBookingStatus.value = '';
      if (filterPaymentStatus) filterPaymentStatus.value = '';
      if (filterTravelDate) filterTravelDate.value = '';
      renderBookingsTable();
    });
  }

  // Close modals on clicking overlay backdrop
  [bookingDetailsModal, adminCancelConfirmModal].forEach(modal => {
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          if (modal === bookingDetailsModal) closeBookingDetailsModal();
          if (modal === adminCancelConfirmModal) closeAdminCancelModal();
        }
      });
    }
  });

  // Initial render of bookings
  renderBookingsTable();

  // Also re-render bookings table whenever switching to booking-mgmt-view
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      if (item.getAttribute('data-target') === 'booking-mgmt-view') {
        renderBookingsTable();
      }
    });
  });

  // Check URL hash on initial load (e.g. admin-dashboard.html#bookings)
  if (window.location.hash === '#bookings') {
    switchView('booking-mgmt-view');
    renderBookingsTable();
  }

  // ==========================================================================
  // 6. Passenger Management Module (Admin Portal Step)
  // ==========================================================================
  // Synchronized passenger directory logic
  function getDemonstrationPassengers() {
    let passengers = [];

    // 1. Try to load saved admin passengers from localStorage
    try {
      const rawAdminPax = localStorage.getItem('aerovista_admin_passengers');
      if (rawAdminPax) {
        passengers = JSON.parse(rawAdminPax);
      }
    } catch (e) {
      console.warn('Could not parse aerovista_admin_passengers', e);
    }

    // 2. Base realistic demonstration passengers directory
    const basePassengers = [
      {
        id: 'PAX-001',
        title: 'Mr',
        fullName: 'Alexander Wright',
        firstName: 'Alexander',
        lastName: 'Wright',
        email: 'alexander.wright@luxurytravel.com',
        phone: '+971 50 123 4567',
        dob: '1990-05-15',
        nationality: 'United Arab Emirates',
        idType: 'Passport',
        idNumber: 'A12345678',
        regDate: '2026-10-15',
        accountStatus: 'Active',
        notes: 'Frequent first/business class flyer'
      },
      {
        id: 'PAX-002',
        title: 'Ms',
        fullName: 'Eleanor Vance',
        firstName: 'Eleanor',
        lastName: 'Vance',
        email: 'e.vance@prestigesuites.co.uk',
        phone: '+44 7700 900123',
        dob: '1985-08-22',
        nationality: 'United Kingdom',
        idType: 'Passport',
        idNumber: 'P89214729',
        regDate: '2026-10-28',
        accountStatus: 'Active',
        notes: 'VIP Executive Member'
      },
      {
        id: 'PAX-003',
        title: 'Dr',
        fullName: 'Rajesh Sharma',
        firstName: 'Rajesh',
        lastName: 'Sharma',
        email: 'r.sharma@medglobal.in',
        phone: '+91 98201 54321',
        dob: '1978-11-04',
        nationality: 'India',
        idType: 'Passport',
        idNumber: 'Z58129304',
        regDate: '2026-11-01',
        accountStatus: 'Active',
        notes: 'Corporate travel partner'
      },
      {
        id: 'PAX-004',
        title: 'Mrs',
        fullName: 'Sophie Dubois',
        firstName: 'Sophie',
        lastName: 'Dubois',
        email: 'sophie.dubois@luxeparis.fr',
        phone: '+33 6 12 34 56 78',
        dob: '1992-03-19',
        nationality: 'France',
        idType: 'Passport',
        idNumber: 'F90123841',
        regDate: '2026-11-05',
        accountStatus: 'Inactive',
        notes: 'Account suspended on request'
      }
    ];

    if (!passengers || passengers.length === 0) {
      passengers = basePassengers;
    }

    // 3. Integrate registered user from auth (localStorage 'aerovista_user')
    try {
      const rawUser = localStorage.getItem('aerovista_user') || sessionStorage.getItem('aerovista_logged_user');
      if (rawUser) {
        const u = JSON.parse(rawUser);
        if (u && (u.email || u.fullName)) {
          const uEmail = (u.email || '').trim().toLowerCase();
          const existingIdx = passengers.findIndex(p => p.email.toLowerCase() === uEmail);
          const uFull = u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Registered Member';

          const userPax = {
            id: existingIdx !== -1 ? passengers[existingIdx].id : 'PAX-005',
            title: u.title || 'Mr',
            fullName: uFull,
            firstName: u.firstName || uFull.split(' ')[0],
            lastName: u.lastName || uFull.split(' ').slice(1).join(' '),
            email: u.email || 'member@aerovista.com',
            phone: u.phone || '+971 50 123 4567',
            dob: u.dob || '1990-05-15',
            nationality: u.nationality || 'United Arab Emirates',
            idType: 'Passport',
            idNumber: 'REG-VERIFIED',
            regDate: '2026-11-08',
            accountStatus: existingIdx !== -1 ? passengers[existingIdx].accountStatus : 'Active',
            notes: 'Registered via web portal'
          };

          if (existingIdx !== -1) {
            passengers[existingIdx] = { ...passengers[existingIdx], ...userPax };
          } else {
            passengers.unshift(userPax);
          }
        }
      }
    } catch (err) {
      console.warn('Error syncing registered user to passenger directory:', err);
    }

    // 4. Also check passenger details from active confirmed booking
    try {
      const rawBooking = localStorage.getItem('aerovista_confirmed_booking') || sessionStorage.getItem('aerovista_confirmed_booking');
      if (rawBooking) {
        const b = JSON.parse(rawBooking);
        if (b && b.passengers && b.passengers.length > 0) {
          b.passengers.forEach((p, idx) => {
            if (p.fullName) {
              const pEmail = (p.contactEmail || (b.passengers[0] ? b.passengers[0].contactEmail : '') || '').trim().toLowerCase();
              const existing = passengers.find(existingPax => (pEmail && existingPax.email.toLowerCase() === pEmail) || existingPax.fullName.toLowerCase() === p.fullName.toLowerCase());
              if (!existing) {
                passengers.push({
                  id: `PAX-00${passengers.length + 1}`,
                  title: p.title || 'Mr',
                  fullName: p.fullName,
                  firstName: p.fullName.split(' ')[0],
                  lastName: p.fullName.split(' ').slice(1).join(' '),
                  email: pEmail || `passenger${idx + 1}@flight.aero`,
                  phone: p.contactPhone || (b.passengers[0] ? b.passengers[0].contactPhone : '') || '+971 50 000 0000',
                  dob: p.dob || '1992-01-01',
                  nationality: p.nationality || 'Verified',
                  idType: p.idType || 'Government ID',
                  idNumber: p.idNumber || 'Verified ID',
                  regDate: '2026-11-09',
                  accountStatus: 'Active',
                  notes: 'Ticketed traveller'
                });
              }
            }
          });
        }
      }
    } catch (e) {
      console.warn('Error incorporating booking passengers:', e);
    }

    return passengers;
  }

  let PASSENGERS_DATA = getDemonstrationPassengers();

  function saveAdminPassengers() {
    try {
      localStorage.setItem('aerovista_admin_passengers', JSON.stringify(PASSENGERS_DATA));
    } catch (e) {
      console.warn('Could not save admin passengers', e);
    }
  }

  // Summary Card Elements for Passengers
  const cardTotalPassengers = document.getElementById('cardTotalPassengers');
  const cardActivePassengers = document.getElementById('cardActivePassengers');
  const cardPassengerTotalBookings = document.getElementById('cardPassengerTotalBookings');
  const cardRecentPassengers = document.getElementById('cardRecentPassengers');
  const passengerCountText = document.getElementById('passengerCountText');
  const passengerToastBanner = document.getElementById('passengerToastBanner');

  // Filter Elements for Passengers
  const passengerSearchInput = document.getElementById('passengerSearchInput');
  const filterAccountStatus = document.getElementById('filterAccountStatus');
  const filterRegDate = document.getElementById('filterRegDate');
  const btnResetPassengerFilters = document.getElementById('btnResetPassengerFilters');
  const passengersTableBody = document.getElementById('passengersTableBody');

  // Passenger Modal Elements
  const passengerDetailsModal = document.getElementById('passengerDetailsModal');
  const closePassengerDetailsModalBtn = document.getElementById('closePassengerDetailsModalBtn');
  const closePassengerDetailsBtn = document.getElementById('closePassengerDetailsBtn');
  const modalBtnToggleStatus = document.getElementById('modalBtnToggleStatus');
  const modalBtnToggleStatusText = document.getElementById('modalBtnToggleStatusText');

  const statusToggleConfirmModal = document.getElementById('statusToggleConfirmModal');
  const closeStatusToggleModalBtn = document.getElementById('closeStatusToggleModalBtn');
  const cancelStatusToggleModalBtn = document.getElementById('cancelStatusToggleModalBtn');
  const confirmStatusToggleBtn = document.getElementById('confirmStatusToggleBtn');
  const statusToggleActionWord = document.getElementById('statusToggleActionWord');
  const statusTogglePassengerName = document.getElementById('statusTogglePassengerName');
  const statusTogglePassengerId = document.getElementById('statusTogglePassengerId');
  const statusToggleExplanation = document.getElementById('statusToggleExplanation');

  let activeModalPassenger = null;
  let targetTogglePassengerId = null;

  // Helper: Find all bookings associated with a passenger (by matching name or email)
  function getBookingsForPassenger(passenger) {
    const currentBookings = getDemonstrationBookings();
    if (!passenger) return [];
    const pEmail = (passenger.email || '').toLowerCase().trim();
    const pName = (passenger.fullName || '').toLowerCase().trim();

    return currentBookings.filter(b => {
      if (b.email && b.email.toLowerCase().trim() === pEmail) return true;
      if (b.passengerName && b.passengerName.toLowerCase().trim() === pName) return true;
      if (b.seats) {
        return b.seats.some(s => s.passenger && s.passenger.toLowerCase().includes(pName));
      }
      return false;
    });
  }

  function showPassengerToast(msg) {
    if (!passengerToastBanner) return;
    passengerToastBanner.innerHTML = msg;
    passengerToastBanner.style.display = 'flex';
    setTimeout(() => {
      passengerToastBanner.style.display = 'none';
    }, 4500);
  }

  // Recalculate Passenger Summary Cards
  function updatePassengerSummaryCards() {
    const total = PASSENGERS_DATA.length;
    const active = PASSENGERS_DATA.filter(p => p.accountStatus === 'Active').length;

    // Total bookings count across all registered passengers
    let totalBookingsCount = 0;
    PASSENGERS_DATA.forEach(p => {
      const bList = getBookingsForPassenger(p);
      totalBookingsCount += bList.length;
    });

    // Recently registered within last 30 days (based on 2026-11-10)
    const recentThreshold = new Date('2026-10-10');
    const recent = PASSENGERS_DATA.filter(p => {
      if (!p.regDate) return false;
      const d = new Date(p.regDate);
      return !isNaN(d.getTime()) && d >= recentThreshold;
    }).length;

    if (cardTotalPassengers) cardTotalPassengers.textContent = total.toLocaleString();
    if (cardActivePassengers) cardActivePassengers.textContent = active.toLocaleString();
    if (cardPassengerTotalBookings) cardPassengerTotalBookings.textContent = totalBookingsCount.toLocaleString();
    if (cardRecentPassengers) cardRecentPassengers.textContent = recent.toLocaleString();
  }

  // Render Passengers Table
  async function renderPassengersTable() {
    if (!passengersTableBody) return;

    const searchTerm = (passengerSearchInput ? passengerSearchInput.value : '').trim().toLowerCase();
    const selAccountStatus = (filterAccountStatus ? filterAccountStatus.value : '').trim();
    const selRegDate = (filterRegDate ? filterRegDate.value : '').trim();

    try {
      const qParams = new URLSearchParams();
      if (searchTerm) qParams.set('search', searchTerm);
      if (selAccountStatus) qParams.set('account_status', selAccountStatus);
      if (selRegDate) qParams.set('date', selRegDate);

      const resp = await fetch(`/api/admin/passengers?${qParams.toString()}`);
      if (resp.ok) {
        const json = await resp.json();
        const serverPassengers = json.passengers || [];
        if (json.metrics) {
          if (cardTotalPassengers) cardTotalPassengers.textContent = json.metrics.total.toLocaleString();
          if (cardActivePassengers) cardActivePassengers.textContent = json.metrics.active.toLocaleString();
          if (cardPassengerTotalBookings) cardPassengerTotalBookings.textContent = json.metrics.total_bookings.toLocaleString();
          if (cardRecentPassengers) cardRecentPassengers.textContent = json.metrics.recent.toLocaleString();
        }
        PASSENGERS_DATA = serverPassengers;
      }
    } catch (e) {
      console.warn('Could not load passengers from backend, falling back to local data', e);
      PASSENGERS_DATA = getDemonstrationPassengers();
      updatePassengerSummaryCards();
    }

    const filtered = PASSENGERS_DATA.filter(p => {
      // 1. Search by name, email or phone
      if (searchTerm) {
        const matchName = (p.fullName || '').toLowerCase().includes(searchTerm);
        const matchEmail = (p.email || '').toLowerCase().includes(searchTerm);
        const matchPhone = (p.phone || '').toLowerCase().includes(searchTerm);
        const matchId = (p.id || '').toLowerCase().includes(searchTerm);
        if (!matchName && !matchEmail && !matchPhone && !matchId) return false;
      }

      // 2. Filter by account status
      if (selAccountStatus && p.accountStatus !== selAccountStatus) {
        return false;
      }

      // 3. Filter by registration date
      if (selRegDate && p.regDate !== selRegDate) {
        return false;
      }

      return true;
    });

    if (passengerCountText) {
      passengerCountText.textContent = filtered.length;
    }

    passengersTableBody.innerHTML = '';

    if (filtered.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td colspan="8" class="empty-table-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 32px; height: 32px; margin-bottom: 8px;">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <div>No passenger records found matching the specified filters.</div>
        </td>
      `;
      passengersTableBody.appendChild(tr);
      return;
    }

    filtered.forEach(p => {
      const tr = document.createElement('tr');
      const bookings = getBookingsForPassenger(p);
      const bookingCount = bookings.length;
      const isActive = p.accountStatus === 'Active';

      const statusPillClass = isActive ? 'status-confirmed' : 'status-cancelled';

      tr.innerHTML = `
        <td><span class="booking-ref-code">${p.id}</span></td>
        <td><strong>${p.fullName}</strong></td>
        <td><span style="color:var(--color-ivory-dim); font-size:0.84rem;">${p.email}</span></td>
        <td><span style="color:var(--color-ivory-dim); font-size:0.84rem;">${p.phone}</span></td>
        <td>${p.regDate || '2026-10-15'}</td>
        <td><span style="font-weight:600; color:var(--color-champagne-light);">${bookingCount} Booking${bookingCount !== 1 ? 's' : ''}</span></td>
        <td><span class="status-pill ${statusPillClass}">${p.accountStatus}</span></td>
        <td>
          <div class="action-buttons-group">
            <button type="button" class="btn-action-btn btn-action-edit btn-view-passenger" data-pax-id="${p.id}" title="View Passenger Profile">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
              <span>View</span>
            </button>
            <button type="button" class="btn-action-btn ${isActive ? 'btn-action-delete' : 'btn-action-edit'} btn-toggle-passenger-status" data-pax-id="${p.id}" title="${isActive ? 'Deactivate Account' : 'Activate Account'}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                ${isActive ? '<line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>' : '<polyline points="9 12 11 14 15 10"></polyline>'}
              </svg>
              <span>${isActive ? 'Deactivate' : 'Activate'}</span>
            </button>
          </div>
        </td>
      `;

      passengersTableBody.appendChild(tr);
    });

    // Attach View and Status Toggle listeners
    document.querySelectorAll('.btn-view-passenger').forEach(btn => {
      btn.addEventListener('click', () => {
        const pId = btn.getAttribute('data-pax-id');
        openPassengerDetailsModal(pId);
      });
    });

    document.querySelectorAll('.btn-toggle-passenger-status').forEach(btn => {
      btn.addEventListener('click', () => {
        const pId = btn.getAttribute('data-pax-id');
        openStatusToggleModal(pId);
      });
    });
  }

  // Open Passenger Details Profile Modal
  function openPassengerDetailsModal(paxId) {
    const passenger = PASSENGERS_DATA.find(p => p.id === paxId);
    if (!passenger) return;

    activeModalPassenger = passenger;

    const modalPassengerId = document.getElementById('modalPassengerId');
    const modalPassengerStatusPill = document.getElementById('modalPassengerStatusPill');
    const modalPassengerFullName = document.getElementById('modalPassengerFullName');
    const modalPassengerEmail = document.getElementById('modalPassengerEmail');
    const modalPassengerPhone = document.getElementById('modalPassengerPhone');
    const modalPassengerNationality = document.getElementById('modalPassengerNationality');
    const modalPassengerDob = document.getElementById('modalPassengerDob');
    const modalPassengerRegDate = document.getElementById('modalPassengerRegDate');
    const modalPassengerBookingsList = document.getElementById('modalPassengerBookingsList');

    if (modalPassengerId) modalPassengerId.textContent = passenger.id;
    if (modalPassengerStatusPill) {
      modalPassengerStatusPill.textContent = passenger.accountStatus;
      modalPassengerStatusPill.className = 'status-pill ' + (passenger.accountStatus === 'Active' ? 'status-confirmed' : 'status-cancelled');
    }

    if (modalPassengerFullName) modalPassengerFullName.textContent = `${passenger.title ? passenger.title + ' ' : ''}${passenger.fullName}`;
    if (modalPassengerEmail) modalPassengerEmail.textContent = passenger.email;
    if (modalPassengerPhone) modalPassengerPhone.textContent = passenger.phone;
    if (modalPassengerNationality) modalPassengerNationality.textContent = passenger.nationality || 'Not Specified';
    if (modalPassengerDob) modalPassengerDob.textContent = passenger.dob || 'Not Disclosed';
    if (modalPassengerRegDate) modalPassengerRegDate.textContent = passenger.regDate || '2026-10-15';

    // Populate Associated Bookings & PNR history
    const bookings = getBookingsForPassenger(passenger);
    if (modalPassengerBookingsList) {
      modalPassengerBookingsList.innerHTML = '';
      if (bookings.length === 0) {
        modalPassengerBookingsList.innerHTML = `
          <div style="font-size: 0.85rem; color: var(--color-ivory-muted); padding: 8px 0;">No flight reservations associated with this passenger account yet.</div>
        `;
      } else {
        bookings.forEach(b => {
          const item = document.createElement('div');
          item.style.display = 'flex';
          item.style.justifyContent = 'space-between';
          item.style.alignItems = 'center';
          item.style.padding = '10px 14px';
          item.style.background = 'rgba(0,0,0,0.25)';
          item.style.border = '1px solid rgba(198,166,107,0.15)';
          item.style.borderRadius = '6px';
          item.style.fontSize = '0.84rem';

          let bStatusColor = b.bookingStatus === 'Confirmed' ? '#2ECC71' : (b.bookingStatus === 'Cancelled' ? '#FF5A5F' : '#F39C12');

          const histSrc = b.sourceCode || (b.source && b.source.match(/\(([A-Z]{3})\)/) ? b.source.match(/\(([A-Z]{3})\)/)[1] : (b.source ? b.source.substring(0, 3).toUpperCase() : 'DXB'));
          const histDst = b.destCode || (b.destination && b.destination.match(/\(([A-Z]{3})\)/) ? b.destination.match(/\(([A-Z]{3})\)/)[1] : (b.destination ? b.destination.substring(0, 3).toUpperCase() : 'BOM'));

          item.innerHTML = `
            <div>
              <span class="booking-ref-code" style="margin-right: 8px;">${b.pnr}</span>
              <strong style="color: var(--color-champagne-light);">${b.flightNumber}</strong>
              <span style="color: var(--color-ivory-muted); margin-left: 6px;">(${histSrc} → ${histDst})</span>
              <div style="font-size: 0.76rem; color: var(--color-ivory-dim); margin-top: 3px;">
                Date: ${b.travelDate} • Total: ${formatINR(b.totalAmount)} • Payment: ${b.paymentStatus}
              </div>
            </div>
            <div>
              <span style="font-size: 0.75rem; font-weight: 700; color: ${bStatusColor}; text-transform: uppercase;">
                ${b.bookingStatus}
              </span>
            </div>
          `;
          modalPassengerBookingsList.appendChild(item);
        });
      }
    }

    // Modal Status Toggle Button Text & Style
    if (modalBtnToggleStatus && modalBtnToggleStatusText) {
      const isActive = passenger.accountStatus === 'Active';
      modalBtnToggleStatusText.textContent = isActive ? 'Deactivate Account' : 'Activate Account';
      modalBtnToggleStatus.className = 'btn-action-btn ' + (isActive ? 'btn-action-delete' : 'btn-action-edit');
    }

    if (passengerDetailsModal) {
      passengerDetailsModal.classList.add('active');
    }
  }

  function closePassengerDetailsModal() {
    if (passengerDetailsModal) {
      passengerDetailsModal.classList.remove('active');
    }
    activeModalPassenger = null;
  }

  if (closePassengerDetailsModalBtn) closePassengerDetailsModalBtn.addEventListener('click', closePassengerDetailsModal);
  if (closePassengerDetailsBtn) closePassengerDetailsBtn.addEventListener('click', closePassengerDetailsModal);

  // Trigger toggle status from inside Passenger Details Modal
  if (modalBtnToggleStatus) {
    modalBtnToggleStatus.addEventListener('click', () => {
      if (!activeModalPassenger) return;
      const pId = activeModalPassenger.id;
      closePassengerDetailsModal();
      openStatusToggleModal(pId);
    });
  }

  // Open Status Toggle Confirmation Modal
  function openStatusToggleModal(paxId) {
    const passenger = PASSENGERS_DATA.find(p => p.id === paxId);
    if (!passenger) return;

    targetTogglePassengerId = paxId;
    const isActivating = passenger.accountStatus !== 'Active';

    if (statusToggleActionWord) {
      statusToggleActionWord.textContent = isActivating ? 'activate' : 'deactivate';
      statusToggleActionWord.style.color = isActivating ? '#2ECC71' : '#FF5A5F';
    }
    if (statusTogglePassengerName) statusTogglePassengerName.textContent = passenger.fullName;
    if (statusTogglePassengerId) statusTogglePassengerId.textContent = passenger.id;

    if (statusToggleExplanation) {
      statusToggleExplanation.textContent = isActivating
        ? 'Activating this account will restore member access and enable direct reservations.'
        : 'Inactive accounts cannot log in to book or modify flights, but all historical booking records remain permanently intact.';
    }

    if (confirmStatusToggleBtn) {
      confirmStatusToggleBtn.textContent = isActivating ? 'Yes, Activate Account' : 'Yes, Deactivate Account';
      confirmStatusToggleBtn.className = isActivating ? 'btn-modal-save' : 'btn-modal-delete';
    }

    if (statusToggleConfirmModal) statusToggleConfirmModal.classList.add('active');
  }

  function closeStatusToggleModal() {
    if (statusToggleConfirmModal) statusToggleConfirmModal.classList.remove('active');
    targetTogglePassengerId = null;
  }

  if (closeStatusToggleModalBtn) closeStatusToggleModalBtn.addEventListener('click', closeStatusToggleModal);
  if (cancelStatusToggleModalBtn) cancelStatusToggleModalBtn.addEventListener('click', closeStatusToggleModal);

  // Execute Account Status Change
  if (confirmStatusToggleBtn) {
    confirmStatusToggleBtn.addEventListener('click', async () => {
      if (!targetTogglePassengerId) return;

      // 1. Call backend API if passenger has database integer ID
      try {
        const resp = await fetch(`/api/admin/passengers/${targetTogglePassengerId}/toggle-status`, {
          method: 'POST'
        });
        const data = await resp.json().catch(() => ({}));
        if (resp.ok) {
          showPassengerToast(`Passenger account for <strong>${data.full_name}</strong> set to <strong>${data.account_status}</strong>.`);
          closeStatusToggleModal();
          await renderPassengersTable();
          loadDashboardData();
          return;
        }
      } catch (err) {
        console.warn('API error toggling passenger status:', err);
      }

      const pIndex = PASSENGERS_DATA.findIndex(p => p.id === targetTogglePassengerId);
      if (pIndex !== -1) {
        const current = PASSENGERS_DATA[pIndex].accountStatus;
        const newStatus = current === 'Active' ? 'Inactive' : 'Active';
        PASSENGERS_DATA[pIndex].accountStatus = newStatus;
        saveAdminPassengers();

        showPassengerToast(`Passenger account for <strong>${PASSENGERS_DATA[pIndex].fullName}</strong> (${PASSENGERS_DATA[pIndex].id}) set to <strong>${newStatus}</strong>.`);
      }

      closeStatusToggleModal();
      renderPassengersTable();
      loadDashboardData();
    });
  }

  // Filter Listeners for Passengers
  if (passengerSearchInput) {
    passengerSearchInput.addEventListener('input', renderPassengersTable);
  }
  if (filterAccountStatus) {
    filterAccountStatus.addEventListener('change', renderPassengersTable);
  }
  if (filterRegDate) {
    filterRegDate.addEventListener('change', renderPassengersTable);
  }

  if (btnResetPassengerFilters) {
    btnResetPassengerFilters.addEventListener('click', () => {
      if (passengerSearchInput) passengerSearchInput.value = '';
      if (filterAccountStatus) filterAccountStatus.value = '';
      if (filterRegDate) filterRegDate.value = '';
      renderPassengersTable();
    });
  }

  // Close modals on clicking overlay backdrop
  [passengerDetailsModal, statusToggleConfirmModal].forEach(modal => {
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          if (modal === passengerDetailsModal) closePassengerDetailsModal();
          if (modal === statusToggleConfirmModal) closeStatusToggleModal();
        }
      });
    }
  });

  // Re-render passengers table whenever switching to passenger-mgmt-view
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      if (item.getAttribute('data-target') === 'passenger-mgmt-view') {
        renderPassengersTable();
      }
    });
  });

  // Check URL hash on initial load (e.g. admin-dashboard.html#passengers)
  if (window.location.hash === '#passengers') {
    switchView('passenger-mgmt-view');
    renderPassengersTable();
  }

  // Initial render of passengers
  renderPassengersTable();

  // ==========================================================================
  // 7. Initial Render & Existing Flights
  // ==========================================================================
  updateFilterDropdownOptions();
  renderFlightsTable();
  loadFlightsFromBackend();

  // ==========================================================================
  // 8. Admin Authentication & Session Verification (Phase 5)
  // ==========================================================================
  async function verifyAdminSession() {
    try {
      const resp = await fetch('/api/admin/session', {
        headers: { 'Accept': 'application/json' },
        credentials: 'same-origin'
      });
      if (!resp.ok) {
        window.location.href = 'admin-login.html';
        return;
      }
      const data = await resp.json().catch(() => ({}));
      if (!data || !data.authenticated) {
        window.location.href = 'admin-login.html';
        return;
      }

      // Update topbar with authenticated administrator's username
      if (data.admin) {
        const adminNameEl = document.querySelector('.admin-user-name');
        const adminAvatarEl = document.querySelector('.admin-avatar');
        if (adminNameEl && data.admin.username) {
          adminNameEl.textContent = data.admin.username;
        }
        if (adminAvatarEl && data.admin.username) {
          adminAvatarEl.textContent = data.admin.username.substring(0, 2).toUpperCase();
        }
      }
      loadDashboardData();
    } catch (err) {
      console.warn('Session verification request error:', err);
      window.location.href = 'admin-login.html';
    }
  }

  // Verify admin session on dashboard load
  verifyAdminSession();

  // Admin Logout Handler
  const btnLogout = document.getElementById('btnAdminLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await fetch('/api/admin/logout', {
          method: 'POST',
          headers: { 'Accept': 'application/json' },
          credentials: 'same-origin'
        });
      } catch (err) {
        console.error('Logout request error:', err);
      } finally {
        window.location.href = 'admin-login.html';
      }
    });
  }

  // Admin Credential Change Handler
  const credsForm = document.getElementById('adminCredentialsForm');
  if (credsForm) {
    const currPassInput = document.getElementById('currAdminPassword');
    const newUsernameInput = document.getElementById('newAdminUsername');
    const newPassInput = document.getElementById('newAdminPassword');
    const confirmNewPassInput = document.getElementById('confirmNewAdminPassword');
    const errCurrPass = document.getElementById('errCurrAdminPassword');
    const errNewUsername = document.getElementById('errNewAdminUsername');
    const errNewPass = document.getElementById('errNewAdminPassword');
    const errConfirmNewPass = document.getElementById('errConfirmNewAdminPassword');
    const alertBox = document.getElementById('credentialChangeAlert');
    const btnSubmit = document.getElementById('btnUpdateCredentials');

    function resetCredErrors() {
      [errCurrPass, errNewUsername, errNewPass, errConfirmNewPass].forEach(el => {
        if (el) { el.textContent = ''; el.classList.remove('visible'); }
      });
      if (alertBox) { alertBox.style.display = 'none'; alertBox.textContent = ''; }
    }

    [currPassInput, newUsernameInput, newPassInput, confirmNewPassInput].forEach(inp => {
      if (inp) inp.addEventListener('input', resetCredErrors);
    });

    credsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      resetCredErrors();

      const currPassword = (currPassInput.value || '').trim();
      const newUsername = (newUsernameInput.value || '').trim();
      const newPassword = newPassInput.value || '';
      const confirmNewPassword = confirmNewPassInput.value || '';

      let hasError = false;

      if (!currPassword) {
        if (errCurrPass) { errCurrPass.textContent = 'Current password is required to verify changes.'; errCurrPass.classList.add('visible'); }
        hasError = true;
      }

      if (newPassword) {
        if (newPassword.length < 8) {
          if (errNewPass) { errNewPass.textContent = 'New password must be at least 8 characters long.'; errNewPass.classList.add('visible'); }
          hasError = true;
        }
        if (!confirmNewPassword) {
          if (errConfirmNewPass) { errConfirmNewPass.textContent = 'Please confirm the new password.'; errConfirmNewPass.classList.add('visible'); }
          hasError = true;
        } else if (newPassword !== confirmNewPassword) {
          if (errConfirmNewPass) { errConfirmNewPass.textContent = 'New passwords do not match.'; errConfirmNewPass.classList.add('visible'); }
          hasError = true;
        }
      }

      if (!newUsername && !newPassword) {
        if (alertBox) {
          alertBox.className = 'auth-alert alert-error';
          alertBox.textContent = 'Please enter a new username or new password to update.';
          alertBox.style.display = 'flex';
        }
        return;
      }

      if (hasError) return;

      const origBtnHtml = btnSubmit ? btnSubmit.innerHTML : '';
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<span>Saving Changes...</span>';
      }

      try {
        const resp = await fetch('/api/admin/change-credentials', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          credentials: 'same-origin',
          body: JSON.stringify({
            current_password: currPassword,
            new_username: newUsername,
            new_password: newPassword,
            confirm_new_password: confirmNewPassword
          })
        });

        const data = await resp.json().catch(() => ({}));

        if (resp.ok && data.status === 'success') {
          if (alertBox) {
            alertBox.className = 'auth-alert alert-success';
            alertBox.textContent = `✓ ${data.message || 'Credentials updated successfully.'}`;
            alertBox.style.display = 'flex';
          }
          if (data.admin && data.admin.username) {
            const adminNameEl = document.querySelector('.admin-user-name');
            if (adminNameEl) adminNameEl.textContent = data.admin.username;
          }
          credsForm.reset();
        } else {
          if (alertBox) {
            alertBox.className = 'auth-alert alert-error';
            alertBox.textContent = data.message || 'Could not update credentials. Please try again.';
            alertBox.style.display = 'flex';
          }
        }
      } catch (err) {
        console.error('Credential update error:', err);
        if (alertBox) {
          alertBox.className = 'auth-alert alert-error';
          alertBox.textContent = 'A network error occurred while updating credentials.';
          alertBox.style.display = 'flex';
        }
      } finally {
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = origBtnHtml;
        }
      }
    });
  }
});
