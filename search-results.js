/**
 * AeroVista Airlines – Flight Search Results Logic (Step 5)
 * Handles:
 * 1. Read 'aerovista_search_query' from sessionStorage or load default Dubai -> Mumbai
 * 2. Extended FLIGHTS_DATABASE synced with Admin Flight Management & INR (₹) fares
 * 3. Horizontal 7-Day Date Selector Strip
 * 4. Sorting & Filter Toolbar (Lowest Fare, Duration, Departure, Direct/Stops)
 * 5. Expandable Flight Details Accordion
 * 6. Flight Selection State (Outbound & Return for Round-trips)
 * 7. Save selection to sessionStorage ('aerovista_selected_flight') ready for Step 6
 */

document.addEventListener('DOMContentLoaded', () => {

  // ==========================================================================
  // 1. Shared Flight Database (Synced with Admin & expanded with return legs)
  // ==========================================================================
  const FLIGHT_CATALOG = [
    {
      id: 'F001',
      flightNumber: 'AV-204',
      airline: 'AeroVista Airlines',
      sourceCode: 'DXB',
      sourceCity: 'Dubai',
      sourceAirport: 'Dubai International Airport',
      destCode: 'LHR',
      destCity: 'London',
      destAirport: 'Heathrow Airport',
      departureTime: '14:30',
      arrivalTime: '19:15',
      duration: '7h 45m',
      durationMinutes: 465,
      economyFare: 5500,
      businessFare: 14200,
      totalSeats: 280,
      availableSeats: 24,
      stops: 0,
      stopsText: 'Direct Flight',
      aircraft: 'Boeing 787-9 Dreamliner',
      hasWifi: true,
      mealIncluded: true,
      baggageAllowance: '30 kg Checked + 7 kg Cabin'
    },
    {
      id: 'F002',
      flightNumber: 'AV-101',
      airline: 'AeroVista Airlines',
      sourceCode: 'BOM',
      sourceCity: 'Mumbai',
      sourceAirport: 'Chhatrapati Shivaji Maharaj Intl',
      destCode: 'DOH',
      destCity: 'Doha',
      destAirport: 'Hamad International Airport',
      departureTime: '16:45',
      arrivalTime: '18:50',
      duration: '3h 35m',
      durationMinutes: 215,
      economyFare: 4200,
      businessFare: 11500,
      totalSeats: 220,
      availableSeats: 42,
      stops: 0,
      stopsText: 'Direct Flight',
      aircraft: 'Airbus A350-900',
      hasWifi: true,
      mealIncluded: true,
      baggageAllowance: '30 kg Checked + 7 kg Cabin'
    },
    // Dubai to Mumbai (matching reference screenshot)
    {
      id: 'F008',
      flightNumber: 'AV-801',
      airline: 'AeroVista Airlines',
      sourceCode: 'DXB',
      sourceCity: 'Dubai',
      sourceAirport: 'Dubai International Airport',
      destCode: 'BOM',
      destCity: 'Mumbai',
      destAirport: 'Chhatrapati Shivaji Maharaj Intl',
      departureTime: '13:10',
      arrivalTime: '02:35',
      nextDayArrival: true,
      duration: '11h 55m',
      durationMinutes: 715,
      economyFare: 3705,
      businessFare: 12695,
      totalSeats: 260,
      availableSeats: 18,
      stops: 1,
      stopsText: '1 Stop, 11h 55m (via DOH)',
      aircraft: 'Airbus A350-1000',
      hasWifi: true,
      mealIncluded: true,
      baggageAllowance: '35 kg Checked + 7 kg Cabin'
    },
    {
      id: 'F009',
      flightNumber: 'AV-803',
      airline: 'AeroVista Airlines',
      sourceCode: 'DXB',
      sourceCity: 'Dubai',
      sourceAirport: 'Dubai International Airport',
      destCode: 'BOM',
      destCity: 'Mumbai',
      destAirport: 'Chhatrapati Shivaji Maharaj Intl',
      departureTime: '11:55',
      arrivalTime: '02:35',
      nextDayArrival: true,
      duration: '13h 10m',
      durationMinutes: 790,
      economyFare: 2845,
      businessFare: 7825,
      totalSeats: 280,
      availableSeats: 30,
      stops: 1,
      stopsText: '1 Stop, 13h 10m (via DOH)',
      aircraft: 'Boeing 777-300ER',
      hasWifi: true,
      mealIncluded: true,
      baggageAllowance: '30 kg Checked + 7 kg Cabin'
    },
    {
      id: 'F010',
      flightNumber: 'AV-805',
      airline: 'AeroVista Airlines',
      sourceCode: 'DXB',
      sourceCity: 'Dubai',
      sourceAirport: 'Dubai International Airport',
      destCode: 'BOM',
      destCity: 'Mumbai',
      destAirport: 'Chhatrapati Shivaji Maharaj Intl',
      departureTime: '17:20',
      arrivalTime: '21:55',
      nextDayArrival: false,
      duration: '3h 05m',
      durationMinutes: 185,
      economyFare: 4890,
      businessFare: 15400,
      totalSeats: 240,
      availableSeats: 14,
      stops: 0,
      stopsText: 'Direct Flight',
      aircraft: 'Boeing 787-9 Dreamliner',
      hasWifi: true,
      mealIncluded: true,
      baggageAllowance: '35 kg Checked + 10 kg Cabin'
    },
    // Mumbai to Dubai (Return leg for round trip)
    {
      id: 'F011',
      flightNumber: 'AV-802',
      airline: 'AeroVista Airlines',
      sourceCode: 'BOM',
      sourceCity: 'Mumbai',
      sourceAirport: 'Chhatrapati Shivaji Maharaj Intl',
      destCode: 'DXB',
      destCity: 'Dubai',
      destAirport: 'Dubai International Airport',
      departureTime: '04:15',
      arrivalTime: '06:30',
      nextDayArrival: false,
      duration: '3h 45m',
      durationMinutes: 225,
      economyFare: 3650,
      businessFare: 11950,
      totalSeats: 250,
      availableSeats: 38,
      stops: 0,
      stopsText: 'Direct Flight',
      aircraft: 'Boeing 787-9 Dreamliner',
      hasWifi: true,
      mealIncluded: true,
      baggageAllowance: '35 kg Checked + 7 kg Cabin'
    },
    {
      id: 'F012',
      flightNumber: 'AV-804',
      airline: 'AeroVista Airlines',
      sourceCode: 'BOM',
      sourceCity: 'Mumbai',
      sourceAirport: 'Chhatrapati Shivaji Maharaj Intl',
      destCode: 'DXB',
      destCity: 'Dubai',
      destAirport: 'Dubai International Airport',
      departureTime: '19:40',
      arrivalTime: '03:15',
      nextDayArrival: true,
      duration: '9h 05m',
      durationMinutes: 545,
      economyFare: 2950,
      businessFare: 8400,
      totalSeats: 220,
      availableSeats: 22,
      stops: 1,
      stopsText: '1 Stop, 9h 05m (via DOH)',
      aircraft: 'Airbus A350-900',
      hasWifi: true,
      mealIncluded: true,
      baggageAllowance: '30 kg Checked + 7 kg Cabin'
    },
    // Paris to New York (AV-305)
    {
      id: 'F003',
      flightNumber: 'AV-305',
      airline: 'AeroVista Airlines',
      sourceCode: 'CDG',
      sourceCity: 'Paris',
      sourceAirport: 'Charles de Gaulle Airport',
      destCode: 'JFK',
      destCity: 'New York',
      destAirport: 'John F. Kennedy Intl',
      departureTime: '18:15',
      arrivalTime: '21:05',
      nextDayArrival: false,
      duration: '8h 50m',
      durationMinutes: 530,
      economyFare: 7500,
      businessFare: 21000,
      totalSeats: 300,
      availableSeats: 18,
      stops: 0,
      stopsText: 'Direct Flight',
      aircraft: 'Boeing 777-300ER',
      hasWifi: true,
      mealIncluded: true,
      baggageAllowance: '2x 23 kg Checked + 8 kg Cabin'
    },
    // Tokyo to Singapore (AV-408)
    {
      id: 'F004',
      flightNumber: 'AV-408',
      airline: 'AeroVista Airlines',
      sourceCode: 'HND',
      sourceCity: 'Tokyo',
      sourceAirport: 'Haneda Airport',
      destCode: 'SIN',
      destCity: 'Singapore',
      destAirport: 'Changi Airport',
      departureTime: '21:00',
      arrivalTime: '03:40',
      nextDayArrival: true,
      duration: '7h 40m',
      durationMinutes: 460,
      economyFare: 6000,
      businessFare: 16800,
      totalSeats: 250,
      availableSeats: 35,
      stops: 0,
      stopsText: 'Direct Flight',
      aircraft: 'Boeing 787-10',
      hasWifi: true,
      mealIncluded: true,
      baggageAllowance: '30 kg Checked + 7 kg Cabin'
    },
    // London to Sydney (AV-512)
    {
      id: 'F005',
      flightNumber: 'AV-512',
      airline: 'AeroVista Airlines',
      sourceCode: 'LHR',
      sourceCity: 'London',
      sourceAirport: 'Heathrow Airport',
      destCode: 'SYD',
      destCity: 'Sydney',
      destAirport: 'Kingsford Smith Airport',
      departureTime: '23:30',
      arrivalTime: '06:15',
      nextDayArrival: true,
      duration: '21h 45m',
      durationMinutes: 1305,
      economyFare: 9500,
      businessFare: 28900,
      totalSeats: 320,
      availableSeats: 12,
      stops: 1,
      stopsText: '1 Stop, 21h 45m (via SIN)',
      aircraft: 'Airbus A380-800',
      hasWifi: true,
      mealIncluded: true,
      baggageAllowance: '35 kg Checked + 10 kg Cabin'
    },
    // Frankfurt to Dubai (AV-620)
    {
      id: 'F006',
      flightNumber: 'AV-620',
      airline: 'AeroVista Airlines',
      sourceCode: 'FRA',
      sourceCity: 'Frankfurt',
      sourceAirport: 'Frankfurt Airport',
      destCode: 'DXB',
      destCity: 'Dubai',
      destAirport: 'Dubai International Airport',
      departureTime: '11:20',
      arrivalTime: '19:40',
      nextDayArrival: false,
      duration: '6h 20m',
      durationMinutes: 380,
      economyFare: 5800,
      businessFare: 15200,
      totalSeats: 240,
      availableSeats: 58,
      stops: 0,
      stopsText: 'Direct Flight',
      aircraft: 'Boeing 787-9 Dreamliner',
      hasWifi: true,
      mealIncluded: true,
      baggageAllowance: '30 kg Checked + 7 kg Cabin'
    },
    // Hong Kong to London (AV-733)
    {
      id: 'F007',
      flightNumber: 'AV-733',
      airline: 'AeroVista Airlines',
      sourceCode: 'HKG',
      sourceCity: 'Hong Kong',
      sourceAirport: 'Hong Kong International',
      destCode: 'LHR',
      destCity: 'London',
      destAirport: 'Heathrow Airport',
      departureTime: '01:15',
      arrivalTime: '07:30',
      nextDayArrival: false,
      duration: '13h 15m',
      durationMinutes: 795,
      economyFare: 8000,
      businessFare: 22400,
      totalSeats: 290,
      availableSeats: 40,
      stops: 0,
      stopsText: 'Direct Flight',
      aircraft: 'Airbus A350-1000',
      hasWifi: true,
      mealIncluded: true,
      baggageAllowance: '35 kg Checked + 7 kg Cabin'
    },
    // London to Dubai return
    {
      id: 'F013',
      flightNumber: 'AV-205',
      airline: 'AeroVista Airlines',
      sourceCode: 'LHR',
      sourceCity: 'London',
      sourceAirport: 'Heathrow Airport',
      destCode: 'DXB',
      destCity: 'Dubai',
      destAirport: 'Dubai International Airport',
      departureTime: '20:10',
      arrivalTime: '06:45',
      nextDayArrival: true,
      duration: '7h 05m',
      durationMinutes: 425,
      economyFare: 5600,
      businessFare: 14500,
      totalSeats: 280,
      availableSeats: 32,
      stops: 0,
      stopsText: 'Direct Flight',
      aircraft: 'Boeing 787-9 Dreamliner',
      hasWifi: true,
      mealIncluded: true,
      baggageAllowance: '30 kg Checked + 7 kg Cabin'
    }
  ];

  // ==========================================================================
  // 2. Application State & Query Retrieval
  // ==========================================================================
  let searchQuery = null;
  try {
    const raw = sessionStorage.getItem('aerovista_search_query');
    if (raw) {
      searchQuery = JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Could not read sessionStorage', e);
  }

  // Default fallback if passenger arrived directly
  if (!searchQuery) {
    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);
    searchQuery = {
      tripType: 'round-trip',
      origin: 'Dubai (DXB)',
      originCode: 'DXB',
      destination: 'Mumbai (BOM)',
      destinationCode: 'BOM',
      departureDate: today.toISOString().split('T')[0],
      returnDate: nextWeek.toISOString().split('T')[0],
      passengers: { adults: 1, children: 0, infants: 0, total: 1 },
      cabinClass: 'economy'
    };
  }

  // Current active leg state ('outbound' or 'return')
  let currentLeg = 'outbound';
  let selectedOutboundFlight = null;
  let selectedOutboundCabin = null;
  let selectedReturnFlight = null;
  let selectedReturnCabin = null;

  // Real database flights cached by leg
  let backendOutboundFlights = [];
  let backendReturnFlights = [];
  let isBackendLoading = false;
  let backendSearchError = null;

  // Selected date on the carousel strip
  let activeTravelDate = searchQuery.departureDate;
  let currentSortBy = 'price-low';
  let currentStopFilter = 'all';

  // Format currency in Indian Rupees
  function formatINR(val) {
    const num = Number(val);
    if (isNaN(num)) return '₹0';
    return '₹' + num.toLocaleString('en-IN');
  }

  // Parse 'YYYY-MM-DD' safely in local calendar date without UTC offset shifting
  function parseYMD(ymdStr) {
    if (!ymdStr) return new Date();
    const parts = ymdStr.split('-').map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
  }

  // Format Date to 'YYYY-MM-DD' using local calendar date
  function formatYMD(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Format Date strings (e.g. "Wed, 18 Nov 2026")
  function formatFullDate(dateStr) {
    if (!dateStr) return '';
    const d = parseYMD(dateStr);
    return d.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  // Extract pure city name
  function cleanCityName(raw) {
    if (!raw) return '';
    return raw.replace(/\s*\([A-Z]{3}\).*/, '').trim();
  }

  function cleanCode(raw) {
    if (!raw) return '';
    const m = raw.match(/\(([A-Z]{3})\)/);
    return m ? m[1] : raw.substring(0, 3).toUpperCase();
  }

  // ==========================================================================
  // 3. Populate Journey Summary Bar & Main Heading
  // ==========================================================================
  const summaryRouteCodes = document.getElementById('summaryRouteCodes');
  const summaryDates = document.getElementById('summaryDates');
  const summaryPassengers = document.getElementById('summaryPassengers');
  const summaryCabin = document.getElementById('summaryCabin');
  const journeyTitle = document.getElementById('journeyTitle');
  const journeySubDate = document.getElementById('journeySubDate');
  const tripLegBadge = document.getElementById('tripLegBadge');
  const outboundBanner = document.getElementById('outboundConfirmedBanner');

  function updateHeaderDisplays() {
    const originCity = cleanCityName(searchQuery.origin);
    const destCity = cleanCityName(searchQuery.destination);
    const originCode = cleanCode(searchQuery.origin);
    const destCode = cleanCode(searchQuery.destination);

    // Summary bar chips
    if (summaryRouteCodes) {
      summaryRouteCodes.textContent = `${originCode} ⇄ ${destCode}`;
    }
    if (summaryDates) {
      if (searchQuery.tripType === 'round-trip' && searchQuery.returnDate) {
        summaryDates.textContent = `${formatFullDate(searchQuery.departureDate)} – ${formatFullDate(searchQuery.returnDate)}`;
      } else {
        summaryDates.textContent = `${formatFullDate(searchQuery.departureDate)}`;
      }
    }
    if (summaryPassengers) {
      const count = searchQuery.passengers.total;
      summaryPassengers.textContent = `${count} passenger${count > 1 ? 's' : ''}`;
    }
    if (summaryCabin) {
      summaryCabin.textContent = searchQuery.cabinClass.charAt(0).toUpperCase() + searchQuery.cabinClass.slice(1);
    }

    // Title Block
    if (currentLeg === 'outbound') {
      if (tripLegBadge) tripLegBadge.innerHTML = `<span class="step-badge">1</span> OUTBOUND FLIGHT`;
      if (journeyTitle) {
        journeyTitle.innerHTML = `Select your departure flight from <span class="gold-city">${originCity}</span> to <span class="gold-city">${destCity}</span>`;
      }
      if (journeySubDate) {
        journeySubDate.textContent = formatFullDate(activeTravelDate);
      }
      if (outboundBanner) outboundBanner.style.display = 'none';
    } else {
      if (tripLegBadge) tripLegBadge.innerHTML = `<span class="step-badge">2</span> RETURN FLIGHT`;
      if (journeyTitle) {
        journeyTitle.innerHTML = `Select your return flight from <span class="gold-city">${destCity}</span> to <span class="gold-city">${originCity}</span>`;
      }
      if (journeySubDate) {
        journeySubDate.textContent = formatFullDate(activeTravelDate);
      }
      if (outboundBanner) {
        outboundBanner.style.display = 'flex';
        const outboundDetails = document.getElementById('outboundConfirmedDetails');
        if (outboundDetails && selectedOutboundFlight) {
          outboundDetails.innerHTML = `
            <strong>Outbound Confirmed:</strong> ${selectedOutboundFlight.flightNumber} (${selectedOutboundFlight.sourceCode} → ${selectedOutboundFlight.destCode}) • 
            ${selectedOutboundFlight.departureTime} - ${selectedOutboundFlight.arrivalTime} • 
            ${selectedOutboundCabin.toUpperCase()} (${formatINR(selectedOutboundFlight[selectedOutboundCabin + 'Fare'])})
          `;
        }
      }
    }
  }

  // ==========================================================================
  // 4. Horizontal 7-Day Travel Date Selector
  // ==========================================================================
  const dateSelectorTrack = document.getElementById('dateSelectorTrack');

  function renderDateSelector() {
    if (!dateSelectorTrack) return;
    dateSelectorTrack.innerHTML = '';

    const baseDate = parseYMD(activeTravelDate);
    // We render 7 days centered on the active day: -3 days to +3 days
    const daysToShow = [];
    for (let offset = -3; offset <= 3; offset++) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + offset);
      daysToShow.push(d);
    }

    daysToShow.forEach((dateObj) => {
      const dateIso = formatYMD(dateObj);
      const isSelected = dateIso === activeTravelDate;
      const dayName = dateObj.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = `date-selector-tab ${isSelected ? 'is-active' : ''}`;
      tab.setAttribute('aria-label', `${dayName}${isSelected ? ' (Selected Departure Date)' : ''}`);
      if (isSelected) {
        tab.setAttribute('aria-current', 'date');
      }

      tab.innerHTML = `
        <span class="tab-day-name">${dayName}</span>
      `;

      tab.addEventListener('click', () => {
        activeTravelDate = dateIso;
        if (currentLeg === 'outbound') {
          searchQuery.departureDate = dateIso;
        } else {
          searchQuery.returnDate = dateIso;
        }

        try {
          sessionStorage.setItem('aerovista_search_query', JSON.stringify(searchQuery));
        } catch (e) {
          console.warn('SessionStorage update failed', e);
        }

        renderDateSelector();
        updateHeaderDisplays();
        fetchLiveFlightsFromBackend();
      });

      dateSelectorTrack.appendChild(tab);
    });
  }

  // ==========================================================================
  // 5. Backend Database Flight Fetching (Phase 7)
  // ==========================================================================
  async function fetchLiveFlightsFromBackend() {
    isBackendLoading = true;
    backendSearchError = null;
    renderFlightResults();

    try {
      const params = new URLSearchParams({
        trip_type: searchQuery.tripType || 'one-way',
        source: searchQuery.origin || '',
        destination: searchQuery.destination || '',
        departure_date: searchQuery.departureDate || activeTravelDate,
        passengers: String((searchQuery.passengers && searchQuery.passengers.total) || 1)
      });

      if (searchQuery.tripType === 'round-trip' && searchQuery.returnDate) {
        params.append('return_date', searchQuery.returnDate);
      }

      const response = await fetch(`/api/flights/search?${params.toString()}`, {
        headers: { 'Accept': 'application/json' }
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.status === 'success') {
        backendOutboundFlights = (data.outbound && data.outbound.flights) || [];
        backendReturnFlights = (data.return && data.return.flights) || [];
        backendSearchError = null;
      } else {
        backendOutboundFlights = [];
        backendReturnFlights = [];
        backendSearchError = data.message || 'Unable to retrieve matching flights from the reservation system.';
      }
    } catch (err) {
      console.error('Error fetching live flights:', err);
      backendSearchError = 'Network error: could not connect to the flight reservation server.';
      backendOutboundFlights = [];
      backendReturnFlights = [];
    } finally {
      isBackendLoading = false;
      renderFlightResults();
    }
  }

  // ==========================================================================
  // 5. Filter & Sort Matching Flights
  // ==========================================================================
  function getMatchingFlights() {
    // Source of truth: live database flights returned by backend API
    let rawList = (currentLeg === 'outbound') ? backendOutboundFlights : backendReturnFlights;
    let matches = [...rawList];

    // Apply Stops Filter
    if (currentStopFilter === 'direct') {
      matches = matches.filter(f => f.stops === 0);
    } else if (currentStopFilter === 'stops') {
      matches = matches.filter(f => f.stops > 0);
    }

    // Apply Sorting
    matches.sort((a, b) => {
      const aFare = (a.economyFare !== undefined) ? a.economyFare : a.ticketFare;
      const bFare = (b.economyFare !== undefined) ? b.economyFare : b.ticketFare;
      if (currentSortBy === 'price-low') {
        return aFare - bFare;
      } else if (currentSortBy === 'price-high') {
        return bFare - aFare;
      } else if (currentSortBy === 'duration') {
        return (a.duration || '').localeCompare(b.duration || '');
      } else if (currentSortBy === 'earliest') {
        return (a.departureTime || '').localeCompare(b.departureTime || '');
      } else if (currentSortBy === 'latest') {
        return (b.departureTime || '').localeCompare(a.departureTime || '');
      }
      return 0;
    });

    return matches;
  }

  // ==========================================================================
  // 6. Render Flight Result Cards
  // ==========================================================================
  const flightListContainer = document.getElementById('flightListContainer');
  const resultsCountNumber = document.getElementById('resultsCountNumber');

  function renderFlightResults() {
    if (!flightListContainer) return;
    flightListContainer.innerHTML = '';

    if (isBackendLoading) {
      flightListContainer.innerHTML = `
        <div class="no-flights-state" style="padding: 3rem 1rem;">
          <div class="btn-spinner" style="width: 38px; height: 38px; margin: 0 auto 1.25rem; border: 3px solid rgba(198,166,107,0.25); border-top-color: var(--color-champagne); border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
          <h3 class="no-flights-title" style="color: var(--color-champagne-light);">Searching AeroVista Database...</h3>
          <p class="no-flights-desc">Retrieving live commercial flight schedules and seat availability.</p>
        </div>
      `;
      return;
    }

    if (backendSearchError) {
      flightListContainer.innerHTML = `
        <div class="no-flights-state">
          <svg class="no-flights-icon" viewBox="0 0 24 24" fill="none" stroke="#FF5A5F" stroke-width="1.8">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <h3 class="no-flights-title" style="color: #FF5A5F;">Search Request Notice</h3>
          <p class="no-flights-desc">${backendSearchError}</p>
        </div>
      `;
      if (resultsCountNumber) resultsCountNumber.textContent = '0 results';
      return;
    }

    const flights = getMatchingFlights();

    if (resultsCountNumber) {
      resultsCountNumber.textContent = `${flights.length} result${flights.length === 1 ? '' : 's'}`;
    }

    if (flights.length === 0) {
      const legLabel = (currentLeg === 'outbound') ? 'outbound' : 'return';
      flightListContainer.innerHTML = `
        <div class="no-flights-state">
          <svg class="no-flights-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
          </svg>
          <h3 class="no-flights-title">No Available ${legLabel.charAt(0).toUpperCase() + legLabel.slice(1)} Flights Found</h3>
          <p class="no-flights-desc">
            We couldn't find scheduled AeroVista flights matching the selected criteria for this date. 
            Please try selecting an adjacent date from the top date strip or modifying your search route.
          </p>
          <button class="btn-modify-search" id="btnResetFilters" style="margin: 0 auto;">
            Reset All Filters
          </button>
        </div>
      `;
      const resetBtn = document.getElementById('btnResetFilters');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          currentStopFilter = 'all';
          currentSortBy = 'price-low';
          document.querySelectorAll('.filter-pill-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-filter') === 'all');
          });
          const sortSelect = document.getElementById('sortSelect');
          if (sortSelect) sortSelect.value = 'price-low';
          renderFlightResults();
        });
      }
      return;
    }

    // Render cards
    flights.forEach((flight, index) => {
      const isSelectedFlight = (currentLeg === 'outbound' && selectedOutboundFlight && String(selectedOutboundFlight.id) === String(flight.id)) ||
                               (currentLeg === 'return' && selectedReturnFlight && String(selectedReturnFlight.id) === String(flight.id));
      const activeSelectedCabin = (currentLeg === 'outbound' && isSelectedFlight) ? selectedOutboundCabin :
                                  (currentLeg === 'return' && isSelectedFlight) ? selectedReturnCabin : null;

      const card = document.createElement('div');
      card.className = `flight-card ${isSelectedFlight ? 'is-selected' : ''}`;
      card.id = `flight-card-${flight.id}`;

      const isDirect = flight.stops === 0;
      const passengerMultiplier = searchQuery.passengers.total;
      const ecoTotal = flight.economyFare * passengerMultiplier;
      const bizTotal = flight.businessFare * passengerMultiplier;

      // Determine feature badges
      const featurePills = [];
      if (flight.hasWifi) {
        featurePills.push(`
          <span class="feature-tag-chip">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12.55a11 11 0 0 1 14.08 0"></path><path d="M1.42 9a16 16 0 0 1 21.16 0"></path><path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path><line x1="12" y1="20" x2="12.01" y2="20"></line></svg>
            Starlink Wi-Fi
          </span>
        `);
      }
      if (index === 0 && currentSortBy === 'price-low') {
        featurePills.push(`<span class="feature-tag-badge">Lowest Fare</span>`);
      }

      card.innerHTML = `
        <div class="flight-card-features">
          ${featurePills.join('')}
          <span class="flight-number-tag">${flight.airline} • ${flight.flightNumber}</span>
        </div>

        <div class="flight-card-main-grid">
          <!-- Route Column -->
          <div class="flight-route-column">
            <div class="flight-times-track">
              <!-- Origin Departure -->
              <div class="time-block">
                <div class="time-val">${flight.departureTime}</div>
                <div class="airport-code-label">${flight.sourceCode}</div>
                <div class="airport-city-sub">${flight.sourceCity}</div>
              </div>

              <!-- Duration Track -->
              <div class="route-duration-diagram">
                <span class="flight-duration-label">${flight.duration}</span>
                <div class="flight-line-track">
                  <svg class="plane-mid-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
                  </svg>
                </div>
                <span class="flight-stops-label ${isDirect ? 'direct' : ''}">${flight.stopsText}</span>
              </div>

              <!-- Destination Arrival -->
              <div class="time-block arrival">
                <div class="time-val">${flight.arrivalTime} ${flight.nextDayArrival ? '<sup class="next-day-sup">+1</sup>' : ''}</div>
                <div class="airport-code-label">${flight.destCode}</div>
                <div class="airport-city-sub">${flight.destCity}</div>
              </div>
            </div>

            <div class="flight-card-bottom-bar">
              <span class="flight-aircraft-info">${flight.aircraft}</span>
              <button class="btn-flight-details-toggle" data-flight-id="${flight.id}" aria-expanded="false">
                Flight Details
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </button>
            </div>
          </div>

          <!-- Cabin Pricing Column (Economy & Business) -->
          <div class="flight-cabins-column">
            <!-- Economy Fare Box -->
            <div class="cabin-fare-box ${activeSelectedCabin === 'economy' ? 'is-selected' : ''}" data-cabin="economy">
              <div>
                <div class="cabin-name-row">
                  <span class="cabin-name">Economy Classic</span>
                  <span class="cabin-badge special">Best Value</span>
                </div>
                <div class="cabin-price-block">
                  <span class="fare-currency-sym">₹</span>
                  <span class="fare-numeric-val">${flight.economyFare.toLocaleString('en-IN')}</span>
                  <span class="fare-per-person">per passenger ${passengerMultiplier > 1 ? `(Total: ${formatINR(ecoTotal)})` : ''}</span>
                </div>
              </div>
              <button class="btn-select-cabin ${activeSelectedCabin === 'economy' ? 'selected' : ''}" data-flight-id="${flight.id}" data-cabin="economy">
                ${activeSelectedCabin === 'economy' ? '✓ Economy Selected' : 'Select Economy'}
              </button>
            </div>

            <!-- Business Fare Box -->
            <div class="cabin-fare-box is-preferred ${activeSelectedCabin === 'business' ? 'is-selected' : ''}" data-cabin="business">
              <div>
                <div class="cabin-name-row">
                  <span class="cabin-name">Business Class</span>
                  <span class="cabin-badge premium">Luxury Suite</span>
                </div>
                <div class="cabin-price-block">
                  <span class="fare-currency-sym">₹</span>
                  <span class="fare-numeric-val">${flight.businessFare.toLocaleString('en-IN')}</span>
                  <span class="fare-per-person">per passenger ${passengerMultiplier > 1 ? `(Total: ${formatINR(bizTotal)})` : ''}</span>
                </div>
              </div>
              <button class="btn-select-cabin ${activeSelectedCabin === 'business' ? 'selected' : ''}" data-flight-id="${flight.id}" data-cabin="business">
                ${activeSelectedCabin === 'business' ? '✓ Business Selected' : 'Select Business'}
              </button>
            </div>
          </div>
        </div>

        <!-- Expandable Flight Details Container -->
        <div class="flight-details-expanded" id="details-${flight.id}">
          <div class="details-grid">
            <!-- Flight Route Timeline -->
            <div>
              <div class="details-section-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Flight Timeline & Schedule
              </div>
              <div class="itinerary-timeline">
                <div class="timeline-point">
                  <div class="point-time">${flight.departureTime} • ${flight.sourceCity} (${flight.sourceCode})</div>
                  <div class="point-airport">${flight.sourceAirport}</div>
                </div>
                <div class="timeline-point">
                  <div class="point-time">${flight.arrivalTime} ${flight.nextDayArrival ? '(Next Day)' : ''} • ${flight.destCity} (${flight.destCode})</div>
                  <div class="point-airport">${flight.destAirport}</div>
                </div>
              </div>
            </div>

            <!-- Cabin Comfort & Amenities -->
            <div>
              <div class="details-section-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                Cabin Inclusions
              </div>
              <ul class="amenities-list">
                <li class="amenity-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>High-speed In-flight Wi-Fi</span>
                </li>
                <li class="amenity-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>Complimentary Gourmet Dining</span>
                </li>
                <li class="amenity-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>4K Touchscreen Entertainment</span>
                </li>
              </ul>
            </div>

            <!-- Baggage Allowance -->
            <div>
              <div class="details-section-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                Baggage Allowance
              </div>
              <ul class="baggage-list">
                <li class="baggage-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>${flight.baggageAllowance}</span>
                </li>
                <li class="baggage-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>Personal Item Included</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      `;

      flightListContainer.appendChild(card);
    });

    // Attach Accordion Toggle Handlers
    document.querySelectorAll('.btn-flight-details-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.getAttribute('data-flight-id');
        const detailsEl = document.getElementById(`details-${id}`);
        if (!detailsEl) return;
        const isOpen = detailsEl.classList.toggle('is-open');
        btn.classList.toggle('is-open', isOpen);
        btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });
    });

    // Attach Flight Selection Handlers
    document.querySelectorAll('.btn-select-cabin').forEach(btn => {
      btn.addEventListener('click', () => {
        const flightId = btn.getAttribute('data-flight-id');
        const cabin = btn.getAttribute('data-cabin');
        const flight = flights.find(f => String(f.id) === String(flightId) || String(f.flight_id) === String(flightId));
        if (!flight) {
          console.warn('Flight not found for ID:', flightId, flights);
          return;
        }
        handleFlightSelection(flight, cabin);
      });
    });
  }

  // ==========================================================================
  // 7. Flight Selection & Multi-Leg Handling
  // ==========================================================================
  const selectionBottomDock = document.getElementById('selectionBottomDock');
  const dockTitle = document.getElementById('dockTitle');
  const dockSub = document.getElementById('dockSub');
  const dockTotalAmount = document.getElementById('dockTotalAmount');
  const btnContinueStep6 = document.getElementById('btnContinueStep6');

  function handleFlightSelection(flight, cabin) {
    if (currentLeg === 'outbound') {
      selectedOutboundFlight = flight;
      selectedOutboundCabin = cabin;

      // Update Card Visuals & Rerender to reflect selected cabin and state
      renderFlightResults();

      // If it's a Round-trip, advance to select the return leg!
      if (searchQuery.tripType === 'round-trip') {
        currentLeg = 'return';
        activeTravelDate = searchQuery.returnDate;
        updateHeaderDisplays();
        renderDateSelector();
        renderFlightResults();
        window.scrollTo({ top: 120, behavior: 'smooth' });
        return;
      } else {
        // One-way journey complete: show dock
        showSelectionDock();
      }
    } else {
      // Return leg selected
      selectedReturnFlight = flight;
      selectedReturnCabin = cabin;
      renderFlightResults();
      showSelectionDock();
    }
  }

  function showSelectionDock() {
    if (!selectionBottomDock) return;
    const count = searchQuery.passengers.total;

    let totalFare = 0;
    let titleStr = '';
    let subStr = '';

    if (searchQuery.tripType === 'round-trip') {
      const outFare = selectedOutboundFlight[selectedOutboundCabin + 'Fare'] * count;
      const retFare = selectedReturnFlight[selectedReturnCabin + 'Fare'] * count;
      totalFare = outFare + retFare;
      titleStr = `${selectedOutboundFlight.flightNumber} & ${selectedReturnFlight.flightNumber} Selected`;
      subStr = `Outbound: ${selectedOutboundFlight.sourceCode} → ${selectedOutboundFlight.destCode} (${selectedOutboundCabin.toUpperCase()}) | Return: ${selectedReturnFlight.sourceCode} → ${selectedReturnFlight.destCode} (${selectedReturnCabin.toUpperCase()})`;
    } else {
      totalFare = selectedOutboundFlight[selectedOutboundCabin + 'Fare'] * count;
      titleStr = `${selectedOutboundFlight.flightNumber} Selected (${selectedOutboundCabin.toUpperCase()})`;
      subStr = `${selectedOutboundFlight.sourceCity} (${selectedOutboundFlight.sourceCode}) to ${selectedOutboundFlight.destCity} (${selectedOutboundFlight.destCode}) • ${count} Passenger${count > 1 ? 's' : ''}`;
    }

    if (dockTitle) dockTitle.textContent = titleStr;
    if (dockSub) dockSub.textContent = subStr;
    if (dockTotalAmount) dockTotalAmount.textContent = formatINR(totalFare);

    selectionBottomDock.classList.add('is-visible');
  }

  // Change outbound leg button in banner
  const btnChangeOutbound = document.getElementById('btnChangeOutbound');
  if (btnChangeOutbound) {
    btnChangeOutbound.addEventListener('click', () => {
      currentLeg = 'outbound';
      activeTravelDate = searchQuery.departureDate;
      selectedReturnFlight = null;
      if (selectionBottomDock) selectionBottomDock.classList.remove('is-visible');
      updateHeaderDisplays();
      renderDateSelector();
      renderFlightResults();
    });
  }

  // ==========================================================================
  // 8. Sorting & Filtering Handlers
  // ==========================================================================
  const sortSelect = document.getElementById('sortSelect');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSortBy = e.target.value;
      renderFlightResults();
    });
  }

  document.querySelectorAll('.filter-pill-btn').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.filter-pill-btn').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentStopFilter = pill.getAttribute('data-filter');
      renderFlightResults();
    });
  });

  // Modify Search Drawer Elements
  const btnModifySearch = document.getElementById('btnModifySearch');
  const modifySearchDrawer = document.getElementById('modifySearchDrawer');
  const btnCancelModify = document.getElementById('btnCancelModify');
  const modifyForm = document.getElementById('modifySearchForm');
  const modifyErrorAlert = document.getElementById('modifyErrorAlert');

  const modTrip = document.getElementById('modTripType');
  const modFrom = document.getElementById('modFromCity');
  const modTo = document.getElementById('modToCity');
  const modDept = document.getElementById('modDeptDate');
  const modReturn = document.getElementById('modReturnDate');
  const modReturnGroup = document.getElementById('modReturnGroup');
  const modAdults = document.getElementById('modAdults');
  const modChildren = document.getElementById('modChildren');
  const modInfants = document.getElementById('modInfants');
  const modCabin = document.getElementById('modCabinClass');

  // Set min attribute for date inputs to prevent past dates
  const todayIso = new Date().toISOString().split('T')[0];
  if (modDept) modDept.min = todayIso;
  if (modReturn) modReturn.min = todayIso;

  // Toggle Return Date field visibility based on Trip Type
  function updateReturnFieldVisibility() {
    if (!modTrip || !modReturnGroup) return;
    if (modTrip.value === 'round-trip') {
      modReturnGroup.style.display = 'flex';
      if (modReturn) modReturn.required = true;
    } else {
      modReturnGroup.style.display = 'none';
      if (modReturn) modReturn.required = false;
    }
  }

  if (modTrip) {
    modTrip.addEventListener('change', updateReturnFieldVisibility);
  }

  // Populate drawer fields from current searchQuery
  function populateModifyDrawer() {
    if (!searchQuery) return;
    if (modTrip) modTrip.value = searchQuery.tripType || 'round-trip';
    if (modFrom) modFrom.value = searchQuery.origin || '';
    if (modTo) modTo.value = searchQuery.destination || '';
    if (modDept) modDept.value = searchQuery.departureDate || '';
    if (modReturn) modReturn.value = searchQuery.returnDate || '';

    if (modAdults) modAdults.value = searchQuery.passengers ? searchQuery.passengers.adults || 1 : 1;
    if (modChildren) modChildren.value = searchQuery.passengers ? searchQuery.passengers.children || 0 : 0;
    if (modInfants) modInfants.value = searchQuery.passengers ? searchQuery.passengers.infants || 0 : 0;

    if (modCabin) modCabin.value = searchQuery.cabinClass || 'economy';

    if (modifyErrorAlert) modifyErrorAlert.style.display = 'none';
    updateReturnFieldVisibility();
  }

  // Open Drawer only on passenger click
  if (btnModifySearch && modifySearchDrawer) {
    btnModifySearch.addEventListener('click', () => {
      const willOpen = !modifySearchDrawer.classList.contains('is-open');
      if (willOpen) {
        populateModifyDrawer();
        modifySearchDrawer.classList.add('is-open');
        btnModifySearch.setAttribute('aria-expanded', 'true');
      } else {
        modifySearchDrawer.classList.remove('is-open');
        btnModifySearch.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Cancel closes the drawer without altering search results
  if (btnCancelModify && modifySearchDrawer) {
    btnCancelModify.addEventListener('click', () => {
      modifySearchDrawer.classList.remove('is-open');
      if (btnModifySearch) btnModifySearch.setAttribute('aria-expanded', 'false');
      if (modifyErrorAlert) modifyErrorAlert.style.display = 'none';
    });
  }

  // Submit and update search criteria
  if (modifyForm) {
    modifyForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (modifyErrorAlert) modifyErrorAlert.style.display = 'none';

      const tripTypeVal = modTrip.value;
      const fromVal = modFrom.value.trim();
      const toVal = modTo.value.trim();
      const deptVal = modDept.value;
      const returnVal = modReturn.value;
      const adultsVal = parseInt(modAdults.value, 10) || 1;
      const childrenVal = parseInt(modChildren.value, 10) || 0;
      const infantsVal = parseInt(modInfants.value, 10) || 0;
      const cabinVal = modCabin.value;

      // Validation
      if (!fromVal || !toVal) {
        showModifyError('Please specify both Origin and Destination airports/cities.');
        return;
      }

      if (fromVal.toLowerCase() === toVal.toLowerCase()) {
        showModifyError('Origin and destination cannot be identical.');
        return;
      }

      if (!deptVal) {
        showModifyError('Please select a valid Departure Date.');
        return;
      }

      if (tripTypeVal === 'round-trip') {
        if (!returnVal) {
          showModifyError('Please select a Return Date for round-trip flights.');
          return;
        }
        if (new Date(returnVal) < new Date(deptVal)) {
          showModifyError('Return Date cannot precede Departure Date.');
          return;
        }
      }

      if (adultsVal < 1) {
        showModifyError('At least 1 adult passenger is required.');
        return;
      }

      if (infantsVal > adultsVal) {
        showModifyError('The number of infants cannot exceed the number of accompanying adults.');
        return;
      }

      // Update in-memory search state
      const totalPassengers = adultsVal + childrenVal + infantsVal;
      searchQuery.tripType = tripTypeVal;
      searchQuery.origin = fromVal;
      searchQuery.originCode = cleanCode(fromVal);
      searchQuery.destination = toVal;
      searchQuery.destinationCode = cleanCode(toVal);
      searchQuery.departureDate = deptVal;
      searchQuery.returnDate = tripTypeVal === 'round-trip' ? returnVal : null;
      searchQuery.passengers = {
        adults: adultsVal,
        children: childrenVal,
        infants: infantsVal,
        total: totalPassengers
      };
      searchQuery.cabinClass = cabinVal;

      activeTravelDate = deptVal;
      currentLeg = 'outbound';
      selectedOutboundFlight = null;
      selectedReturnFlight = null;
      if (selectionBottomDock) selectionBottomDock.classList.remove('is-visible');

      // Persist to sessionStorage
      try {
        sessionStorage.setItem('aerovista_search_query', JSON.stringify(searchQuery));
      } catch (err) {
        console.warn('SessionStorage update failed', err);
      }

      // Close drawer & refresh UI
      modifySearchDrawer.classList.remove('is-open');
      if (btnModifySearch) btnModifySearch.setAttribute('aria-expanded', 'false');
      updateHeaderDisplays();
      renderDateSelector();
      fetchLiveFlightsFromBackend();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  function showModifyError(msg) {
    if (!modifyErrorAlert) {
      alert(msg);
      return;
    }
    modifyErrorAlert.textContent = `⚠️ ${msg}`;
    modifyErrorAlert.style.display = 'block';
  }

  // ==========================================================================
  // 9. Proceed to Step 6 / Confirmation Modal
  // ==========================================================================
  const step6Modal = document.getElementById('step6Modal');
  const btnCloseModal = document.getElementById('btnCloseModal');
  const modalFlightDetails = document.getElementById('modalFlightDetails');

  if (btnContinueStep6) {
    btnContinueStep6.addEventListener('click', () => {
      if (!selectedOutboundFlight) {
        alert('Please select an outbound flight before continuing.');
        return;
      }
      if (searchQuery.tripType === 'round-trip' && !selectedReturnFlight) {
        alert('Please select a return flight before continuing.');
        return;
      }

      const selectionPayload = {
        flight_id: selectedOutboundFlight.id || selectedOutboundFlight.flight_id,
        cabinClass: selectedOutboundCabin,
        departureDate: searchQuery.departureDate,
        totalPassengers: searchQuery.passengers.total,
        tripType: searchQuery.tripType,
        searchQuery: searchQuery,
        outbound: {
          flight: selectedOutboundFlight,
          cabin: selectedOutboundCabin,
          fare: selectedOutboundFlight[selectedOutboundCabin + 'Fare']
        },
        return: selectedReturnFlight ? {
          flight: selectedReturnFlight,
          cabin: selectedReturnCabin,
          fare: selectedReturnFlight[selectedReturnCabin + 'Fare']
        } : null,
        totalFareFormatted: dockTotalAmount ? dockTotalAmount.textContent : '₹0',
        savedAt: new Date().toISOString()
      };

      try {
        sessionStorage.setItem('aerovista_selected_flight', JSON.stringify(selectionPayload));
      } catch (e) {
        console.warn('SessionStorage write error', e);
      }

      // Seamlessly navigate forward to Step 6: Aircraft Seat Selection
      window.location.href = 'seat-selection.html';
    });
  }

  if (btnCloseModal && step6Modal) {
    btnCloseModal.addEventListener('click', () => {
      step6Modal.classList.remove('is-active');
    });
  }

  // ==========================================================================
  // 10. Initial Run
  // ==========================================================================
  updateHeaderDisplays();
  renderDateSelector();
  fetchLiveFlightsFromBackend();
});
