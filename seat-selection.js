/**
 * AeroVista Airlines – Aircraft Seat Selection Logic (Step 6 Final Implementation)
 * Requirements:
 * 1. Read 'aerovista_selected_flight' & 'aerovista_search_query' from sessionStorage.
 * 2. Display selected flight info (Airline, Flight #, Origin, Destination, Departure/Arrival Date & Time, Cabin Class, Passengers, Ticket Fare).
 * 3. Render ONLY the seat layout matching the passenger's selected cabin class:
 *    - Economy Class: 3-3 arrangement (ABC - aisle - DEF) with Standard (₹0), Extra Legroom (₹500), Exit Row (₹700).
 *    - Business Class: 1-2-1 layout (A - aisle - EF - aisle - K) with All Seats Included in Ticket Fare (₹0 additional).
 * 4. Distinct states: Available (selectable), Selected (Champagne gold), Occupied (disabled).
 * 5. Passenger-wise seat allocation: exactly matches total passenger count, allows re-assignment and deselection.
 * 6. "Confirm Seats" button disabled until all passenger seats are selected.
 * 7. "Skip Seat Selection" button removed as per requirements.
 * 8. Back to Flight Results option preserved.
 * 9. Save selections to sessionStorage ('aerovista_selected_seats') ready for Step 7.
 */

document.addEventListener('DOMContentLoaded', () => {

  // ==========================================================================
  // 1. Ingest Upstream Booking Data
  // ==========================================================================
  let bookingPayload = null;
  let searchQuery = null;
  let existingSeatPayload = null;

  try {
    const rawFlight = sessionStorage.getItem('aerovista_selected_flight');
    if (rawFlight) {
      bookingPayload = JSON.parse(rawFlight);
    }
    const rawSearch = sessionStorage.getItem('aerovista_search_query');
    if (rawSearch) {
      searchQuery = JSON.parse(rawSearch);
    }
    const rawSeats = sessionStorage.getItem('aerovista_selected_seats');
    if (rawSeats) {
      existingSeatPayload = JSON.parse(rawSeats);
    }
  } catch (err) {
    console.warn('Could not read sessionStorage', err);
  }

  // Safe realistic fallback if passenger visited directly
  if (!bookingPayload) {
    bookingPayload = {
      searchQuery: {
        tripType: 'one-way',
        origin: 'Dubai (DXB)',
        originCode: 'DXB',
        destination: 'Mumbai (BOM)',
        destinationCode: 'BOM',
        departureDate: '2026-11-19',
        returnDate: null,
        passengers: { adults: 1, children: 0, infants: 0, total: 1 },
        cabinClass: 'economy'
      },
      outbound: {
        flight: {
          flightNumber: 'AV-801',
          airline: 'AeroVista Airlines',
          sourceCode: 'DXB',
          sourceCity: 'Dubai',
          destCode: 'BOM',
          destCity: 'Mumbai',
          departureTime: '13:10',
          arrivalTime: '02:35',
          duration: '11h 55m',
          aircraft: 'Boeing 787-9 Dreamliner'
        },
        cabin: 'economy',
        fare: 3705
      },
      return: null,
      totalPassengers: 1,
      totalFareFormatted: '₹3,705'
    };
  }

  // Determine round-trip status cleanly (must have return flight object)
  const isRoundTrip = !!(bookingPayload.return && bookingPayload.return.flight);
  let activeLeg = 'outbound'; // 'outbound' or 'return'
  let activePassengerIndex = 0;

  // Selected cabin class for the active leg ('economy' or 'business')
  function getActiveCabinClass() {
    const legObj = activeLeg === 'outbound' ? bookingPayload.outbound : bookingPayload.return;
    const cabin = (legObj && legObj.cabin) ? legObj.cabin.toLowerCase() : 'economy';
    return (cabin === 'business' || cabin === 'first') ? 'business' : 'economy';
  }

  // Passenger Manifest List - One consistent source of truth
  const totalPassengers = Number(
    bookingPayload.totalPassengers ||
    (bookingPayload.searchQuery && bookingPayload.searchQuery.passengers && bookingPayload.searchQuery.passengers.total) ||
    1
  );
  const passengers = [];
  const adultCount = Number(
    (bookingPayload.searchQuery && bookingPayload.searchQuery.passengers && bookingPayload.searchQuery.passengers.adults) ||
    1
  );

  for (let i = 0; i < totalPassengers; i++) {
    const isChild = i >= adultCount;
    // Restore pre-existing seat assignments if matching passenger exists
    let existingOutbound = null;
    let existingReturn = null;
    if (existingSeatPayload && Array.isArray(existingSeatPayload.passengers) && existingSeatPayload.passengers[i]) {
      const prevP = existingSeatPayload.passengers[i];
      if (prevP.outboundSeat) existingOutbound = prevP.outboundSeat;
      if (prevP.returnSeat) existingReturn = prevP.returnSeat;
    }

    passengers.push({
      id: `P${i + 1}`,
      name: `Passenger ${i + 1}`,
      type: isChild ? 'Child (2-11 yrs)' : 'Adult (12+ yrs)',
      avatar: `P${i + 1}`,
      seats: {
        outbound: existingOutbound,
        return: existingReturn
      }
    });
  }

  // Currency helpers
  function formatINR(amount) {
    const num = Number(amount);
    if (isNaN(num)) return '₹0';
    if (num === 0) return '₹0 (Included)';
    return '₹' + num.toLocaleString('en-IN');
  }

  function formatShortINR(amount) {
    const num = Number(amount);
    if (isNaN(num)) return '₹0';
    return '₹' + num.toLocaleString('en-IN');
  }

  // ==========================================================================
  // 2. Structured Aircraft Seating Configurations & Pricing Rules
  // ==========================================================================
  // ECONOMY CLASS SEAT MAP (Rows 10 - 20, 3-3 Arrangement)
  // Pricing:
  // - Standard Economy: ₹0
  // - Extra Legroom: ₹500
  // - Exit Row: ₹700
  const ECONOMY_SEAT_ROWS = [
    // Row 10: Extra-legroom Bulkhead (₹500)
    {
      rowNumber: 10,
      isExit: false,
      seats: [
        { code: '10A', col: 'A', position: 'window', category: 'extra-legroom', price: 500, occupied: false },
        { code: '10B', col: 'B', position: 'middle', category: 'extra-legroom', price: 500, occupied: false },
        { code: '10C', col: 'C', position: 'aisle', category: 'extra-legroom', price: 500, occupied: false },
        { code: '10D', col: 'D', position: 'aisle', category: 'extra-legroom', price: 500, occupied: true },
        { code: '10E', col: 'E', position: 'middle', category: 'extra-legroom', price: 500, occupied: false },
        { code: '10F', col: 'F', position: 'window', category: 'extra-legroom', price: 500, occupied: false }
      ]
    },
    // Row 11: Extra-legroom (₹500)
    {
      rowNumber: 11,
      isExit: false,
      seats: [
        { code: '11A', col: 'A', position: 'window', category: 'extra-legroom', price: 500, occupied: false },
        { code: '11B', col: 'B', position: 'middle', category: 'extra-legroom', price: 500, occupied: false },
        { code: '11C', col: 'C', position: 'aisle', category: 'extra-legroom', price: 500, occupied: false },
        { code: '11D', col: 'D', position: 'aisle', category: 'extra-legroom', price: 500, occupied: false },
        { code: '11E', col: 'E', position: 'middle', category: 'extra-legroom', price: 500, occupied: true },
        { code: '11F', col: 'F', position: 'window', category: 'extra-legroom', price: 500, occupied: true }
      ]
    },
    // Row 12: Standard Economy (₹0)
    {
      rowNumber: 12,
      isExit: false,
      seats: [
        { code: '12A', col: 'A', position: 'window', category: 'standard', price: 0, occupied: false },
        { code: '12B', col: 'B', position: 'middle', category: 'standard', price: 0, occupied: true },
        { code: '12C', col: 'C', position: 'aisle', category: 'standard', price: 0, occupied: false },
        { code: '12D', col: 'D', position: 'aisle', category: 'standard', price: 0, occupied: false },
        { code: '12E', col: 'E', position: 'middle', category: 'standard', price: 0, occupied: false },
        { code: '12F', col: 'F', position: 'window', category: 'standard', price: 0, occupied: false }
      ]
    },
    // Row 14: Standard Economy (₹0)
    {
      rowNumber: 14,
      isExit: false,
      seats: [
        { code: '14A', col: 'A', position: 'window', category: 'standard', price: 0, occupied: true },
        { code: '14B', col: 'B', position: 'middle', category: 'standard', price: 0, occupied: false },
        { code: '14C', col: 'C', position: 'aisle', category: 'standard', price: 0, occupied: false },
        { code: '14D', col: 'D', position: 'aisle', category: 'standard', price: 0, occupied: true },
        { code: '14E', col: 'E', position: 'middle', category: 'standard', price: 0, occupied: false },
        { code: '14F', col: 'F', position: 'window', category: 'standard', price: 0, occupied: false }
      ]
    },
    // Row 15: Emergency Exit Row (₹700)
    {
      rowNumber: 15,
      isExit: true,
      seats: [
        { code: '15A', col: 'A', position: 'window', category: 'emergency-exit', price: 700, occupied: false },
        { code: '15B', col: 'B', position: 'middle', category: 'emergency-exit', price: 700, occupied: false },
        { code: '15C', col: 'C', position: 'aisle', category: 'emergency-exit', price: 700, occupied: false },
        { code: '15D', col: 'D', position: 'aisle', category: 'emergency-exit', price: 700, occupied: false },
        { code: '15E', col: 'E', position: 'middle', category: 'emergency-exit', price: 700, occupied: false },
        { code: '15F', col: 'F', position: 'window', category: 'emergency-exit', price: 700, occupied: true }
      ]
    },
    // Rows 16 - 20: Standard Economy (₹0)
    {
      rowNumber: 16,
      isExit: false,
      seats: [
        { code: '16A', col: 'A', position: 'window', category: 'standard', price: 0, occupied: false },
        { code: '16B', col: 'B', position: 'middle', category: 'standard', price: 0, occupied: false },
        { code: '16C', col: 'C', position: 'aisle', category: 'standard', price: 0, occupied: false },
        { code: '16D', col: 'D', position: 'aisle', category: 'standard', price: 0, occupied: false },
        { code: '16E', col: 'E', position: 'middle', category: 'standard', price: 0, occupied: false },
        { code: '16F', col: 'F', position: 'window', category: 'standard', price: 0, occupied: false }
      ]
    },
    {
      rowNumber: 17,
      isExit: false,
      seats: [
        { code: '17A', col: 'A', position: 'window', category: 'standard', price: 0, occupied: true },
        { code: '17B', col: 'B', position: 'middle', category: 'standard', price: 0, occupied: true },
        { code: '17C', col: 'C', position: 'aisle', category: 'standard', price: 0, occupied: false },
        { code: '17D', col: 'D', position: 'aisle', category: 'standard', price: 0, occupied: false },
        { code: '17E', col: 'E', position: 'middle', category: 'standard', price: 0, occupied: false },
        { code: '17F', col: 'F', position: 'window', category: 'standard', price: 0, occupied: false }
      ]
    },
    {
      rowNumber: 18,
      isExit: false,
      seats: [
        { code: '18A', col: 'A', position: 'window', category: 'standard', price: 0, occupied: false },
        { code: '18B', col: 'B', position: 'middle', category: 'standard', price: 0, occupied: false },
        { code: '18C', col: 'C', position: 'aisle', category: 'standard', price: 0, occupied: false },
        { code: '18D', col: 'D', position: 'aisle', category: 'standard', price: 0, occupied: true },
        { code: '18E', col: 'E', position: 'middle', category: 'standard', price: 0, occupied: true },
        { code: '18F', col: 'F', position: 'window', category: 'standard', price: 0, occupied: false }
      ]
    },
    {
      rowNumber: 19,
      isExit: false,
      seats: [
        { code: '19A', col: 'A', position: 'window', category: 'standard', price: 0, occupied: false },
        { code: '19B', col: 'B', position: 'middle', category: 'standard', price: 0, occupied: false },
        { code: '19C', col: 'C', position: 'aisle', category: 'standard', price: 0, occupied: false },
        { code: '19D', col: 'D', position: 'aisle', category: 'standard', price: 0, occupied: false },
        { code: '19E', col: 'E', position: 'middle', category: 'standard', price: 0, occupied: false },
        { code: '19F', col: 'F', position: 'window', category: 'standard', price: 0, occupied: false }
      ]
    },
    {
      rowNumber: 20,
      isExit: false,
      seats: [
        { code: '20A', col: 'A', position: 'window', category: 'standard', price: 0, occupied: false },
        { code: '20B', col: 'B', position: 'middle', category: 'standard', price: 0, occupied: false },
        { code: '20C', col: 'C', position: 'aisle', category: 'standard', price: 0, occupied: false },
        { code: '20D', col: 'D', position: 'aisle', category: 'standard', price: 0, occupied: false },
        { code: '20E', col: 'E', position: 'middle', category: 'standard', price: 0, occupied: false },
        { code: '20F', col: 'F', position: 'window', category: 'standard', price: 0, occupied: false }
      ]
    }
  ];

  // BUSINESS CLASS SEAT MAP (Rows 1 - 6, 1-2-1 Spacious Arrangement)
  // Pricing: Included in Ticket Fare (₹0 additional)
  const BUSINESS_SEAT_ROWS = [
    {
      rowNumber: 1,
      isExit: false,
      seats: [
        { code: '1A', col: 'A', position: 'window', category: 'business-suite', price: 0, occupied: false },
        { code: '1E', col: 'E', position: 'middle', category: 'business-suite', price: 0, occupied: true },
        { code: '1F', col: 'F', position: 'middle', category: 'business-suite', price: 0, occupied: false },
        { code: '1K', col: 'K', position: 'window', category: 'business-suite', price: 0, occupied: false }
      ]
    },
    {
      rowNumber: 2,
      isExit: false,
      seats: [
        { code: '2A', col: 'A', position: 'window', category: 'business-suite', price: 0, occupied: false },
        { code: '2E', col: 'E', position: 'middle', category: 'business-suite', price: 0, occupied: false },
        { code: '2F', col: 'F', position: 'middle', category: 'business-suite', price: 0, occupied: true },
        { code: '2K', col: 'K', position: 'window', category: 'business-suite', price: 0, occupied: true }
      ]
    },
    {
      rowNumber: 3,
      isExit: false,
      seats: [
        { code: '3A', col: 'A', position: 'window', category: 'business-suite', price: 0, occupied: true },
        { code: '3E', col: 'E', position: 'middle', category: 'business-suite', price: 0, occupied: false },
        { code: '3F', col: 'F', position: 'middle', category: 'business-suite', price: 0, occupied: false },
        { code: '3K', col: 'K', position: 'window', category: 'business-suite', price: 0, occupied: false }
      ]
    },
    {
      rowNumber: 4,
      isExit: false,
      seats: [
        { code: '4A', col: 'A', position: 'window', category: 'business-suite', price: 0, occupied: false },
        { code: '4E', col: 'E', position: 'middle', category: 'business-suite', price: 0, occupied: false },
        { code: '4F', col: 'F', position: 'middle', category: 'business-suite', price: 0, occupied: false },
        { code: '4K', col: 'K', position: 'window', category: 'business-suite', price: 0, occupied: false }
      ]
    },
    {
      rowNumber: 5,
      isExit: false,
      seats: [
        { code: '5A', col: 'A', position: 'window', category: 'business-suite', price: 0, occupied: false },
        { code: '5E', col: 'E', position: 'middle', category: 'business-suite', price: 0, occupied: true },
        { code: '5F', col: 'F', position: 'middle', category: 'business-suite', price: 0, occupied: false },
        { code: '5K', col: 'K', position: 'window', category: 'business-suite', price: 0, occupied: false }
      ]
    },
    {
      rowNumber: 6,
      isExit: false,
      seats: [
        { code: '6A', col: 'A', position: 'window', category: 'business-suite', price: 0, occupied: false },
        { code: '6E', col: 'E', position: 'middle', category: 'business-suite', price: 0, occupied: false },
        { code: '6F', col: 'F', position: 'middle', category: 'business-suite', price: 0, occupied: false },
        { code: '6K', col: 'K', position: 'window', category: 'business-suite', price: 0, occupied: true }
      ]
    }
  ];

  function getCategoryName(category) {
    switch (category) {
      case 'business-suite': return 'Business Class Suite';
      case 'extra-legroom': return 'Extra Legroom';
      case 'emergency-exit': return 'Exit Row';
      default: return 'Standard Economy';
    }
  }

  // ==========================================================================
  // 3. Render Header & Flight Meta Information
  // ==========================================================================
  const flightTitleHeader = document.getElementById('flightTitleHeader');
  const flightMetaPills = document.getElementById('flightMetaPills');
  const legToggleContainer = document.getElementById('legToggleContainer');
  const cabinModeBadge = document.getElementById('cabinModeBadge');
  const cabinModeNote = document.getElementById('cabinModeNote');
  const seatLegendBar = document.getElementById('seatLegendBar');
  const fuselageAircraftTitle = document.getElementById('fuselageAircraftTitle');

  function renderHeaderMeta() {
    const flightObj = activeLeg === 'outbound' ? bookingPayload.outbound.flight : bookingPayload.return.flight;
    const cabin = getActiveCabinClass();
    const legObj = activeLeg === 'outbound' ? bookingPayload.outbound : bookingPayload.return;
    const ticketFare = (legObj && legObj.fare) ? legObj.fare : 0;

    if (flightTitleHeader) {
      flightTitleHeader.innerHTML = `Select Seats: <span class="gold-accent">${flightObj.sourceCity} to ${flightObj.destCity}</span>`;
    }

    if (flightMetaPills) {
      flightMetaPills.innerHTML = `
        <div class="meta-pill">Airline: <strong>${flightObj.airline || 'AeroVista Airlines'}</strong></div>
        <div class="meta-pill">Flight: <strong>${flightObj.flightNumber}</strong></div>
        <div class="meta-pill">Route: <strong>${flightObj.sourceCode} → ${flightObj.destCode}</strong></div>
        <div class="meta-pill">Dep: <strong>${flightObj.departureTime}</strong></div>
        <div class="meta-pill">Arr: <strong>${flightObj.arrivalTime}</strong></div>
        <div class="meta-pill">Class: <strong>${cabin.toUpperCase()}</strong></div>
        <div class="meta-pill">Passengers: <strong>${totalPassengers}</strong></div>
        <div class="meta-pill">Ticket Fare: <strong>${formatShortINR(ticketFare)}</strong>/pax</div>
      `;
    }

    if (fuselageAircraftTitle) {
      fuselageAircraftTitle.textContent = `${flightObj.airline || 'AeroVista'} • ${cabin.toUpperCase()} CABIN`;
    }

    // Cabin Mode Banner
    if (cabinModeBadge && cabinModeNote) {
      if (cabin === 'business') {
        cabinModeBadge.textContent = 'BUSINESS CLASS CABIN';
        cabinModeBadge.style.background = 'linear-gradient(135deg, #c084fc 0%, #9333ea 100%)';
        cabinModeBadge.style.color = '#fff';
        cabinModeNote.textContent = 'Showing 1-2-1 Lie-Flat Suite layout. Seat selection is included in your ticket fare.';
      } else {
        cabinModeBadge.textContent = 'ECONOMY CLASS CABIN';
        cabinModeBadge.style.background = 'var(--color-gold)';
        cabinModeBadge.style.color = '#121212';
        cabinModeNote.textContent = 'Showing 3-3 seating configuration (ABC - aisle - DEF). Standard seats are ₹0.';
      }
    }

    // Dynamic Seat Legend (showing only states relevant to selected cabin)
    if (seatLegendBar) {
      if (cabin === 'business') {
        seatLegendBar.innerHTML = `
          <div class="legend-item">
            <span class="legend-icon available"></span>
            <span>Available <strong>(Included in Fare)</strong></span>
          </div>
          <div class="legend-item">
            <span class="legend-icon selected"></span>
            <span>Selected</span>
          </div>
          <div class="legend-item">
            <span class="legend-icon occupied"></span>
            <span>Occupied</span>
          </div>
          <div class="legend-item">
            <span class="legend-icon business-suite"></span>
            <span>Business Suite <strong>(₹0 Additional)</strong></span>
          </div>
        `;
      } else {
        seatLegendBar.innerHTML = `
          <div class="legend-item">
            <span class="legend-icon available"></span>
            <span>Available</span>
          </div>
          <div class="legend-item">
            <span class="legend-icon selected"></span>
            <span>Selected</span>
          </div>
          <div class="legend-item">
            <span class="legend-icon occupied"></span>
            <span>Occupied</span>
          </div>
          <div class="legend-item">
            <span class="legend-icon available" style="border-color: rgba(255,255,255,0.38);"></span>
            <span>Standard <strong>(₹0)</strong></span>
          </div>
          <div class="legend-item">
            <span class="legend-icon extra-legroom"></span>
            <span>Extra Legroom <strong>(+₹500)</strong></span>
          </div>
          <div class="legend-item">
            <span class="legend-icon exit-row"></span>
            <span>Exit Row <strong>(+₹700)</strong></span>
          </div>
        `;
      }
    }

    // Multi-leg switcher
    if (legToggleContainer) {
      if (isRoundTrip) {
        legToggleContainer.innerHTML = `
          <div class="leg-toggle-group">
            <button class="btn-leg-tab ${activeLeg === 'outbound' ? 'is-active' : ''}" id="btnLegOutbound">
              1. Outbound (${bookingPayload.outbound.flight.sourceCode} → ${bookingPayload.outbound.flight.destCode})
            </button>
            <button class="btn-leg-tab ${activeLeg === 'return' ? 'is-active' : ''}" id="btnLegReturn">
              2. Return (${bookingPayload.return.flight.sourceCode} → ${bookingPayload.return.flight.destCode})
            </button>
          </div>
        `;
        document.getElementById('btnLegOutbound').addEventListener('click', () => switchFlightLeg('outbound'));
        document.getElementById('btnLegReturn').addEventListener('click', () => switchFlightLeg('return'));
      } else {
        legToggleContainer.innerHTML = '';
      }
    }
  }

  function switchFlightLeg(targetLeg) {
    activeLeg = targetLeg;
    renderHeaderMeta();
    renderPassengerTabs();
    fetchLiveSeatAvailability(targetLeg);
    renderSeatMap();
    updateBookingSummary();
  }

  // ==========================================================================
  // 4. Render Aircraft Top-Down Seat Map (Strictly Current Cabin Only)
  // ==========================================================================
  const seatRowsContainer = document.getElementById('seatRowsContainer');

  function renderSeatMap() {
    if (!seatRowsContainer) return;
    seatRowsContainer.innerHTML = '';

    const cabin = getActiveCabinClass();

    if (cabin === 'business') {
      renderBusinessCabinSection();
    } else {
      renderEconomyCabinSection();
    }
  }

  function renderBusinessCabinSection() {
    // Column letters header: A || E F || K
    const colHeader = document.createElement('div');
    colHeader.className = 'seat-columns-header business-header';
    colHeader.appendChild(document.createElement('div')); // row number blank

    ['A', '', 'E', 'F', '', 'K'].forEach(col => {
      if (col === '') {
        const aisle = document.createElement('div');
        aisle.className = 'aisle-gap-col';
        colHeader.appendChild(aisle);
      } else {
        const lbl = document.createElement('div');
        lbl.className = 'col-letter-label';
        lbl.textContent = col;
        colHeader.appendChild(lbl);
      }
    });
    seatRowsContainer.appendChild(colHeader);

    // Rows
    BUSINESS_SEAT_ROWS.forEach(rowConfig => {
      const rowEl = document.createElement('div');
      rowEl.className = 'seat-row business-row';

      const rowNum = document.createElement('div');
      rowNum.className = 'row-number-indicator';
      rowNum.textContent = rowConfig.rowNumber;
      rowEl.appendChild(rowNum);

      const seatA = rowConfig.seats.find(s => s.col === 'A');
      const seatE = rowConfig.seats.find(s => s.col === 'E');
      const seatF = rowConfig.seats.find(s => s.col === 'F');
      const seatK = rowConfig.seats.find(s => s.col === 'K');

      if (seatA) rowEl.appendChild(createSeatButton(seatA));
      rowEl.appendChild(createAisleGap());
      if (seatE) rowEl.appendChild(createSeatButton(seatE));
      if (seatF) rowEl.appendChild(createSeatButton(seatF));
      rowEl.appendChild(createAisleGap());
      if (seatK) rowEl.appendChild(createSeatButton(seatK));

      seatRowsContainer.appendChild(rowEl);
    });
  }

  function renderEconomyCabinSection() {
    // Column letters header: A B C || D E F
    const colHeader = document.createElement('div');
    colHeader.className = 'seat-columns-header';
    colHeader.appendChild(document.createElement('div'));

    ['A', 'B', 'C', '', 'D', 'E', 'F'].forEach(col => {
      if (col === '') {
        const aisle = document.createElement('div');
        aisle.className = 'aisle-gap-col';
        colHeader.appendChild(aisle);
      } else {
        const lbl = document.createElement('div');
        lbl.className = 'col-letter-label';
        lbl.textContent = col;
        colHeader.appendChild(lbl);
      }
    });
    seatRowsContainer.appendChild(colHeader);

    // Rows
    ECONOMY_SEAT_ROWS.forEach(rowConfig => {
      if (rowConfig.isExit) {
        const exitMarker = document.createElement('div');
        exitMarker.className = 'exit-row-marker';
        exitMarker.innerHTML = `
          <span class="exit-door-pill">◄ EXIT DOOR</span>
          <span style="font-size: 0.72rem; color: #fbbf24; font-weight: 700;">Emergency Exit Row (+₹700)</span>
          <span class="exit-door-pill">EXIT DOOR ►</span>
        `;
        seatRowsContainer.appendChild(exitMarker);
      }

      const rowEl = document.createElement('div');
      rowEl.className = 'seat-row';

      const rowNum = document.createElement('div');
      rowNum.className = 'row-number-indicator';
      rowNum.textContent = rowConfig.rowNumber;
      rowEl.appendChild(rowNum);

      const seatA = rowConfig.seats.find(s => s.col === 'A');
      const seatB = rowConfig.seats.find(s => s.col === 'B');
      const seatC = rowConfig.seats.find(s => s.col === 'C');
      const seatD = rowConfig.seats.find(s => s.col === 'D');
      const seatE = rowConfig.seats.find(s => s.col === 'E');
      const seatF = rowConfig.seats.find(s => s.col === 'F');

      if (seatA) rowEl.appendChild(createSeatButton(seatA));
      if (seatB) rowEl.appendChild(createSeatButton(seatB));
      if (seatC) rowEl.appendChild(createSeatButton(seatC));
      rowEl.appendChild(createAisleGap());
      if (seatD) rowEl.appendChild(createSeatButton(seatD));
      if (seatE) rowEl.appendChild(createSeatButton(seatE));
      if (seatF) rowEl.appendChild(createSeatButton(seatF));

      seatRowsContainer.appendChild(rowEl);
    });
  }

  function createAisleGap() {
    const aisle = document.createElement('div');
    aisle.className = 'aisle-gap-col';
    return aisle;
  }

  function createSeatButton(seatData) {
    const btn = document.createElement('button');
    btn.className = `seat-btn ${seatData.category}`;
    btn.id = `seat-${seatData.code}`;
    btn.setAttribute('data-seat-code', seatData.code);

    const feeText = seatData.price === 0 ? 'Included' : `+ ${formatShortINR(seatData.price)} `;
    const categoryName = getCategoryName(seatData.category);

    btn.setAttribute('data-tooltip', `${seatData.code} • ${categoryName} • ${feeText} `);

    // Seat inner code
    const codeSpan = document.createElement('span');
    codeSpan.className = 'seat-inner-code';
    codeSpan.textContent = seatData.code;
    btn.appendChild(codeSpan);

      // Check if released by cancellation in localStorage
      let releasedSeatsList = [];
      try {
        const rawRel = localStorage.getItem('aerovista_released_seats');
        if (rawRel) releasedSeatsList = JSON.parse(rawRel);
      } catch (e) { }

      const isReleased = releasedSeatsList.includes(seatData.code);

      // Occupied state: Check real backend occupied seats first, fallback to static template
      const isDbOccupied = backendOccupiedSeats[activeLeg] && backendOccupiedSeats[activeLeg].has(seatData.code);
      if (isDbOccupied || (seatData.occupied && !isReleased)) {
        btn.disabled = true;
        btn.setAttribute('title', `${seatData.code} is occupied`);
        return btn;
      }

      // Selected by any passenger for this flight leg?
      const assignedPassenger = passengers.find(p => p.seats[activeLeg] && p.seats[activeLeg].code === seatData.code);
      if (assignedPassenger) {
        btn.classList.add('is-selected');
      }

      // Click handler
      btn.addEventListener('click', () => {
        handleSeatClick(seatData);
      });

      return btn;
    }

    // Live Database Occupied Seats by Flight Leg
    let backendOccupiedSeats = {
      outbound: new Set(),
      return: new Set()
    };

    async function fetchLiveSeatAvailability(legKey) {
      const legObj = legKey === 'outbound' ? bookingPayload.outbound : bookingPayload.return;
      if (!legObj || !legObj.flight) return;
      const flightId = legObj.flight.id || legObj.flight.flight_id;
      if (!flightId) return;

      try {
        const cabin = (legObj.cabin || 'economy').toLowerCase();
        const res = await fetch(`/api/flights/${flightId}/seats?cabin=${cabin}`);
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.occupiedSeats)) {
            backendOccupiedSeats[legKey] = new Set(data.occupiedSeats);
            if (activeLeg === legKey) {
              renderSeatMap();
            }
          }
        }
      } catch (err) {
        console.warn(`Could not fetch live seat availability for ${legKey}:`, err);
      }
    }
    function handleSeatClick(seatData) {
      // Check if the clicked seat is occupied
      if (seatData.occupied) {
        alert(`Seat ${seatData.code} is occupied and unavailable.Please choose another seat.`);
        return;
      }

      const curPassenger = passengers[activePassengerIndex];
      const existingSeat = curPassenger.seats[activeLeg];

      // Case 1: Clicking the seat currently assigned to this active passenger -> Deselect
      if (existingSeat && existingSeat.code === seatData.code) {
        curPassenger.seats[activeLeg] = null;
      } else {
        // Case 2: Is this seat already assigned to ANOTHER passenger on this flight leg?
        const otherPassenger = passengers.find(p => p.seats[activeLeg] && p.seats[activeLeg].code === seatData.code);
        if (otherPassenger) {
          otherPassenger.seats[activeLeg] = null;
        }
        // Assign seat to current passenger
        curPassenger.seats[activeLeg] = seatData;

        // Auto-advance active passenger index to the next unassigned passenger
        autoAdvancePassenger();
      }

      // Refresh UI states
      updateSeatMapSelectionClasses();
      renderPassengerTabs();
      updateBookingSummary();
    }

    function autoAdvancePassenger() {
      const nextUnassigned = passengers.findIndex(p => !p.seats[activeLeg]);
      if (nextUnassigned !== -1) {
        activePassengerIndex = nextUnassigned;
      }
    }

    function updateSeatMapSelectionClasses() {
      document.querySelectorAll('.seat-btn').forEach(btn => {
        const code = btn.getAttribute('data-seat-code');
        const isAssigned = passengers.some(p => p.seats[activeLeg] && p.seats[activeLeg].code === code);
        btn.classList.toggle('is-selected', isAssigned);
      });
    }

    // ==========================================================================
    // 6. Passenger Tabs Sidebar
    // ==========================================================================
    const passengerTabList = document.getElementById('passengerTabList');
    const seatProgressCounter = document.getElementById('seatProgressCounter');

    function renderPassengerTabs() {
      if (!passengerTabList) return;
      passengerTabList.innerHTML = '';

      let assignedCount = 0;

      passengers.forEach((p, idx) => {
        const item = document.createElement('div');
        item.className = `passenger-tab-item ${idx === activePassengerIndex ? 'is-active' : ''}`;

        const assignedSeat = p.seats[activeLeg];
        if (assignedSeat) assignedCount++;

        const seatText = assignedSeat ? assignedSeat.code : 'No Seat';
        const seatClass = assignedSeat ? 'assigned' : 'unassigned';

        item.innerHTML = `
        <div class="p-tab-left">
          <div class="p-avatar-circle">${p.avatar}</div>
          <div class="p-meta-info">
            <span class="p-name">${p.name}</span>
            <span class="p-type-tag">${p.type}</span>
          </div>
        </div>
        <span class="p-seat-pill ${seatClass}">${seatText}</span>
      `;

        item.addEventListener('click', () => {
          activePassengerIndex = idx;
          renderPassengerTabs();
        });

        passengerTabList.appendChild(item);
      });

      if (seatProgressCounter) {
        seatProgressCounter.textContent = `${assignedCount} / ${totalPassengers} Selected`;
        if (assignedCount === totalPassengers) {
          seatProgressCounter.style.background = 'rgba(56, 189, 120, 0.15)';
          seatProgressCounter.style.borderColor = '#38bd78';
          seatProgressCounter.style.color = '#38bd78';
        } else {
          seatProgressCounter.style.background = 'rgba(198, 166, 107, 0.15)';
          seatProgressCounter.style.borderColor = 'var(--color-gold)';
          seatProgressCounter.style.color = 'var(--color-gold-light)';
        }
      }
    }

    // ==========================================================================
    // 7. Booking Summary, Fare Separation & Confirmation State
    // ==========================================================================
    const summaryFlightMini = document.getElementById('summaryFlightMini');
    const flightTicketFareVal = document.getElementById('flightTicketFareVal');
    const flightTicketFareSub = document.getElementById('flightTicketFareSub');
    const seatChargesList = document.getElementById('seatChargesList');
    const totalSeatChargesAmt = document.getElementById('totalSeatChargesAmt');
    const btnProceedCheckout = document.getElementById('btnProceedCheckout');
    const btnDisabledHint = document.getElementById('btnDisabledHint');

    function updateBookingSummary() {
      const flightObj = activeLeg === 'outbound' ? bookingPayload.outbound.flight : bookingPayload.return.flight;
      const legObj = activeLeg === 'outbound' ? bookingPayload.outbound : bookingPayload.return;
      const cabin = getActiveCabinClass();
      const travelDate = (bookingPayload.searchQuery) ? (activeLeg === 'outbound' ? bookingPayload.searchQuery.departureDate : bookingPayload.searchQuery.returnDate) : '';

      // Flight Info Summary
      if (summaryFlightMini) {
        summaryFlightMini.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: baseline;">
          <strong>${flightObj.airline || 'AeroVista'} (${flightObj.flightNumber})</strong>
          <span style="color: var(--color-gold); font-weight: 700;">${cabin.toUpperCase()}</span>
        </div>
        <div style="color: var(--color-text-muted); font-size: 0.82rem;">
          Route: ${flightObj.sourceCity} (${flightObj.sourceCode}) → ${flightObj.destCity} (${flightObj.destCode})
        </div>
        <div style="color: var(--color-text-muted); font-size: 0.8rem;">
          Travel Date: ${travelDate || 'Confirmed'} • ${totalPassengers} Passenger${totalPassengers > 1 ? 's' : ''}
        </div>
      `;
      }

      // Ticket Fare Separation Display
      const singleTicketFare = (legObj && legObj.fare) ? legObj.fare : 0;
      const totalTicketFares = singleTicketFare * totalPassengers;
      if (flightTicketFareVal) {
        flightTicketFareVal.textContent = formatShortINR(totalTicketFares);
      }
      if (flightTicketFareSub) {
        flightTicketFareSub.textContent = `${formatShortINR(singleTicketFare)} × ${totalPassengers} passenger${totalPassengers > 1 ? 's' : ''} (Base Fare)`;
      }

      // Additional Seat Charges List
      if (!seatChargesList) return;
      seatChargesList.innerHTML = '';

      let totalSeatFees = 0;

      passengers.forEach(p => {
        // Outbound leg seat
        if (p.seats.outbound) {
          totalSeatFees += p.seats.outbound.price;
          const row = document.createElement('div');
          row.className = 'charge-row';
          row.innerHTML = `
          <div class="charge-title">
            <span>${p.name}:</span>
            <span class="seat-pill-inline">${p.seats.outbound.code} (${getCategoryName(p.seats.outbound.category)})</span>
          </div>
          <span class="charge-amt">${p.seats.outbound.price === 0 ? '₹0' : formatShortINR(p.seats.outbound.price)}</span>
        `;
          seatChargesList.appendChild(row);
        }

        // Return leg seat (if round trip)
        if (isRoundTrip && p.seats.return) {
          totalSeatFees += p.seats.return.price;
          const row = document.createElement('div');
          row.className = 'charge-row';
          row.innerHTML = `
          <div class="charge-title">
            <span>${p.name}:</span>
            <span class="seat-pill-inline">${p.seats.return.code} (Return)</span>
          </div>
          <span class="charge-amt">${p.seats.return.price === 0 ? '₹0' : formatShortINR(p.seats.return.price)}</span>
        `;
          seatChargesList.appendChild(row);
        }
      });

      const hasAnySelection = passengers.some(p => p.seats.outbound || (isRoundTrip && p.seats.return));
      if (!hasAnySelection) {
        seatChargesList.innerHTML = `
        <div style="font-size: 0.82rem; color: #888; text-align: center; padding: 10px 0;">
          No seat selections made yet. Tap available aircraft seats to assign.
        </div>
      `;
      }

      if (totalSeatChargesAmt) {
        totalSeatChargesAmt.textContent = formatShortINR(totalSeatFees);
      }

      // Validation: Require all passengers to have a seat on all booked legs
      const allOutboundAssigned = passengers.every(p => p.seats.outbound !== null && p.seats.outbound !== undefined);
      const allReturnAssigned = !isRoundTrip || passengers.every(p => p.seats.return !== null && p.seats.return !== undefined);
      const isSelectionComplete = allOutboundAssigned && allReturnAssigned;

      if (btnProceedCheckout) {
        btnProceedCheckout.disabled = !isSelectionComplete;
      }

      if (btnDisabledHint) {
        if (isSelectionComplete) {
          btnDisabledHint.textContent = '✓ All seats allocated. Ready to proceed.';
          btnDisabledHint.style.color = '#38bd78';
        } else {
          const remainingThisLeg = passengers.filter(p => !p.seats[activeLeg]).length;
          if (remainingThisLeg > 0) {
            btnDisabledHint.textContent = `Please select ${remainingThisLeg} more seat${remainingThisLeg > 1 ? 's' : ''} for ${activeLeg === 'outbound' ? 'Outbound' : 'Return'} flight`;
          } else if (isRoundTrip && !allReturnAssigned) {
            const remainingRet = passengers.filter(p => !p.seats.return).length;
            btnDisabledHint.textContent = `Please switch to Return flight and select ${remainingRet} more seat${remainingRet > 1 ? 's' : ''}`;
          } else {
            btnDisabledHint.textContent = 'Please assign seats for all passengers to continue';
          }
          btnDisabledHint.style.color = '#f87171';
        }
      }
    }

    // ==========================================================================
    // 8. Confirm Seats & Step 7 Hand-Off
    // ==========================================================================
    const checkoutModal = document.getElementById('checkoutModal');
    const btnCloseCheckoutModal = document.getElementById('btnCloseCheckoutModal');
    const btnProceedStep7 = document.getElementById('btnProceedStep7');
    const modalSeatBreakdown = document.getElementById('modalSeatBreakdown');

    function saveAndProceed() {
      // Validate assignments before proceeding
      const allOutboundAssigned = passengers.every(p => p.seats.outbound !== null && p.seats.outbound !== undefined);
      const allReturnAssigned = !isRoundTrip || passengers.every(p => p.seats.return !== null && p.seats.return !== undefined);
      if (!allOutboundAssigned || !allReturnAssigned) {
        alert('Please complete seat selection for all passengers before proceeding.');
        return;
      }

      let totalSeatFees = 0;
      const finalAssignments = passengers.map(p => {
        const outP = p.seats.outbound ? (Number(p.seats.outbound.price) || 0) : 0;
        const retP = p.seats.return ? (Number(p.seats.return.price) || 0) : 0;
        totalSeatFees += outP + retP;

        return {
          passengerId: p.id,
          name: p.name,
          type: p.type,
          outboundSeat: p.seats.outbound ? {
            code: p.seats.outbound.code,
            category: p.seats.outbound.category,
            categoryLabel: getCategoryName(p.seats.outbound.category),
            price: p.seats.outbound.price
          } : null,
          returnSeat: (isRoundTrip && p.seats.return) ? {
            code: p.seats.return.code,
            category: p.seats.return.category,
            categoryLabel: getCategoryName(p.seats.return.category),
            price: p.seats.return.price
          } : null
        };
      });

      const seatPayload = {
        flightBooking: bookingPayload,
        passengers: finalAssignments,
        totalSeatCharges: totalSeatFees,
        totalSeatChargesFormatted: formatShortINR(totalSeatFees),
        savedAt: new Date().toISOString()
      };

      try {
        sessionStorage.setItem('aerovista_selected_seats', JSON.stringify(seatPayload));
      } catch (e) {
        console.warn('SessionStorage write error', e);
      }

      // Navigate directly to Passenger Details (Step 7)
      window.location.href = 'passenger-details.html';
    }

    if (btnProceedCheckout) {
      btnProceedCheckout.addEventListener('click', () => {
        saveAndProceed();
      });
    }

    if (btnCloseCheckoutModal && checkoutModal) {
      btnCloseCheckoutModal.addEventListener('click', () => {
        checkoutModal.classList.remove('is-active');
      });
    }

    if (btnProceedStep7) {
      btnProceedStep7.addEventListener('click', () => {
        window.location.href = 'passenger-details.html';
      });
    }

    // ==========================================================================
    // 9. Initial Load Run
    // ==========================================================================
    renderHeaderMeta();
    renderPassengerTabs();
    fetchLiveSeatAvailability('outbound');
    if (isRoundTrip) {
      fetchLiveSeatAvailability('return');
    }
    renderSeatMap();
    updateBookingSummary();
  });
