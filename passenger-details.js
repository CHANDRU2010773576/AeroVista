/**
 * AeroVista Airlines – Passenger Details Logic (Step 7)
 * 
 * Functional Requirements:
 * 1. Read upstream booking data from sessionStorage:
 *    - 'aerovista_selected_seats' (contains flight, assigned seats, pricing)
 *    - 'aerovista_selected_flight'
 *    - 'aerovista_search_query'
 * 2. Pre-fill logged-in user profile from sessionStorage ('aerovista_logged_user') or localStorage ('aerovista_user').
 * 3. Generate individual passenger forms matching passenger count:
 *    - Full Name (as per identification)
 *    - Date of Birth
 *    - Gender
 *    - Nationality
 *    - Identification Type (Passport or Government ID)
 *    - Identification Number
 *    - For Primary Passenger (Passenger 1): Email Address & Mobile Number
 * 4. Display live Booking Summary:
 *    - Flight & route, travel date & timings, cabin class, passenger count
 *    - Passenger names and assigned seats (outbound & return if round-trip)
 *    - Ticket fare, seat selection charges, total payable amount
 * 5. Form validation:
 *    - Required check, valid email, valid phone, past DOB, ID format check
 *    - Clear errors dynamically and display messages beside fields
 * 6. Save validated passenger details to sessionStorage ('aerovista_booking_manifest') for Step 8: Payment.
 */

document.addEventListener('DOMContentLoaded', () => {

  // ==========================================================================
  // 1. Ingest Upstream Booking & Seat Allocation Data
  // ==========================================================================
  let seatDataPayload = null;
  let flightBookingPayload = null;
  let searchQuery = null;

  try {
    const rawSeats = sessionStorage.getItem('aerovista_selected_seats');
    if (rawSeats) {
      seatDataPayload = JSON.parse(rawSeats);
    }
    const rawFlight = sessionStorage.getItem('aerovista_selected_flight');
    if (rawFlight) {
      flightBookingPayload = JSON.parse(rawFlight);
    }
    const rawSearch = sessionStorage.getItem('aerovista_search_query');
    if (rawSearch) {
      searchQuery = JSON.parse(rawSearch);
    }
  } catch (err) {
    console.warn('Could not read sessionStorage', err);
  }

  // Realistic fallback matching user workflow if visited directly
  if (!seatDataPayload) {
    seatDataPayload = {
      flightBooking: {
        searchQuery: {
          tripType: 'one-way',
          origin: 'Dubai (DXB)',
          originCode: 'DXB',
          destination: 'Mumbai (BOM)',
          destinationCode: 'BOM',
          departureDate: '2026-11-19',
          returnDate: null,
          passengers: { adults: 2, children: 0, infants: 0, total: 2 },
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
        totalPassengers: 2,
        totalFareFormatted: '₹7,410'
      },
      passengers: [
        {
          passengerId: 'P1',
          name: 'Passenger 1',
          type: 'Adult (12+ yrs)',
          outboundSeat: { code: '10A', category: 'extra-legroom', categoryLabel: 'Extra Legroom', price: 500 },
          returnSeat: null
        },
        {
          passengerId: 'P2',
          name: 'Passenger 2',
          type: 'Adult (12+ yrs)',
          outboundSeat: { code: '12A', category: 'standard', categoryLabel: 'Standard Economy', price: 0 },
          returnSeat: null
        }
      ],
      totalSeatCharges: 500,
      totalSeatChargesFormatted: '₹500'
    };
  }

  const booking = seatDataPayload.flightBooking || flightBookingPayload;
  const outboundFlight = booking.outbound ? booking.outbound.flight : {
    airline: 'AeroVista Airlines',
    flightNumber: 'AV-801',
    sourceCity: 'Dubai',
    sourceCode: 'DXB',
    destCity: 'Mumbai',
    destCode: 'BOM',
    departureTime: '13:10',
    arrivalTime: '02:35'
  };

  const isRoundTrip = !!booking.return;
  const returnFlight = isRoundTrip ? booking.return.flight : null;
  const cabinClass = (booking.outbound && booking.outbound.cabin) ? booking.outbound.cabin.toUpperCase() : 'ECONOMY';
  const totalPassengers = booking.totalPassengers || (seatDataPayload.passengers ? seatDataPayload.passengers.length : 2);
  const travelDate = (booking.searchQuery && booking.searchQuery.departureDate) ? booking.searchQuery.departureDate : '2026-11-19';

  // Currency helpers
  function formatShortINR(amount) {
    const num = Number(amount);
    if (isNaN(num)) return '₹0';
    return '₹' + num.toLocaleString('en-IN');
  }

  // Fare calculations
  const singleTicketFare = (booking.outbound && booking.outbound.fare) ? booking.outbound.fare : 3705;
  const returnTicketFare = (booking.return && booking.return.fare) ? booking.return.fare : 0;
  const totalTicketFare = (singleTicketFare + returnTicketFare) * totalPassengers;
  const totalSeatCharges = seatDataPayload.totalSeatCharges || 0;
  const totalPayableAmount = totalTicketFare + totalSeatCharges;

  // ==========================================================================
  // 2. Logged-in Passenger Integration & Account Detection
  // ==========================================================================
  let loggedInUser = null;
  try {
    const rawLogged = sessionStorage.getItem('aerovista_logged_user') || localStorage.getItem('aerovista_user');
    if (rawLogged) {
      loggedInUser = JSON.parse(rawLogged);
    }
  } catch (e) {
    console.warn('Could not read logged in user info', e);
  }

  const prefillBanner = document.getElementById('prefillNoticeBanner');
  const prefillUserName = document.getElementById('prefillUserName');
  const navAuthGroup = document.getElementById('navAuthGroup');

  if (loggedInUser && loggedInUser.loggedIn) {
    if (prefillBanner && prefillUserName) {
      prefillUserName.textContent = loggedInUser.fullName || loggedInUser.firstName || loggedInUser.email || 'Valued Passenger';
      prefillBanner.style.display = 'flex';
    }
    if (navAuthGroup) {
      navAuthGroup.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; color: var(--color-gold-light); font-size: 0.88rem; font-weight: 600;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          <span>${loggedInUser.fullName || loggedInUser.email}</span>
        </div>
      `;
    }
  }

  // ==========================================================================
  // 3. Render Header Meta & Booking Summary
  // ==========================================================================
  const routeAccent = document.getElementById('routeAccent');
  const headerFlightMetaPills = document.getElementById('headerFlightMetaPills');
  const summaryPassengerCountPill = document.getElementById('summaryPassengerCountPill');
  const summaryFlightMeta = document.getElementById('summaryFlightMeta');
  const summarySeatList = document.getElementById('summarySeatList');
  const summaryTicketFareVal = document.getElementById('summaryTicketFareVal');
  const summarySeatChargesVal = document.getElementById('summarySeatChargesVal');
  const summaryTotalPayableVal = document.getElementById('summaryTotalPayableVal');

  if (routeAccent) {
    routeAccent.textContent = `${outboundFlight.sourceCity} to ${outboundFlight.destCity}`;
  }

  if (headerFlightMetaPills) {
    headerFlightMetaPills.innerHTML = `
      <div class="meta-pill">Airline: <strong>${outboundFlight.airline || 'AeroVista Airlines'}</strong></div>
      <div class="meta-pill">Flight: <strong>${outboundFlight.flightNumber}</strong></div>
      <div class="meta-pill">Route: <strong>${outboundFlight.sourceCode} → ${outboundFlight.destCode}</strong></div>
      <div class="meta-pill">Date: <strong>${travelDate}</strong></div>
      <div class="meta-pill">Cabin: <strong>${cabinClass}</strong></div>
      <div class="meta-pill">Passengers: <strong>${totalPassengers}</strong></div>
    `;
  }

  if (summaryPassengerCountPill) {
    summaryPassengerCountPill.textContent = `${totalPassengers} Passenger${totalPassengers > 1 ? 's' : ''}`;
  }

  if (summaryFlightMeta) {
    summaryFlightMeta.innerHTML = `
      <div class="flight-name">${outboundFlight.airline || 'AeroVista'} (${outboundFlight.flightNumber})</div>
      <div class="route-text">${outboundFlight.sourceCity} (${outboundFlight.sourceCode}) → ${outboundFlight.destCity} (${outboundFlight.destCode})</div>
      <div class="sub-meta">Dep: ${outboundFlight.departureTime} | Arr: ${outboundFlight.arrivalTime} | Class: ${cabinClass}</div>
      <div class="sub-meta">Date: ${travelDate}</div>
      ${isRoundTrip ? `<div class="sub-meta" style="margin-top:4px; color:var(--color-gold-light);">Return: ${returnFlight.sourceCode} → ${returnFlight.destCode} (${returnFlight.flightNumber})</div>` : ''}
    `;
  }

  if (summaryTicketFareVal) summaryTicketFareVal.textContent = formatShortINR(totalTicketFare);
  if (summarySeatChargesVal) summarySeatChargesVal.textContent = formatShortINR(totalSeatCharges);
  if (summaryTotalPayableVal) summaryTotalPayableVal.textContent = formatShortINR(totalPayableAmount);

  // Render Seat Assignment List in Sidebar
  function renderSummarySeats(namesList) {
    if (!summarySeatList) return;
    summarySeatList.innerHTML = '';

    for (let i = 0; i < totalPassengers; i++) {
      const pSeatObj = (seatDataPayload.passengers && seatDataPayload.passengers[i]) ? seatDataPayload.passengers[i] : null;
      const assignedSeatCode = pSeatObj && pSeatObj.outboundSeat ? pSeatObj.outboundSeat.code : 'Assigned';
      const seatCategory = pSeatObj && pSeatObj.outboundSeat ? pSeatObj.outboundSeat.categoryLabel : 'Standard';
      const displayName = (namesList && namesList[i]) ? namesList[i] : `Passenger ${i + 1}`;

      const row = document.createElement('div');
      row.className = 'passenger-seat-item';
      row.innerHTML = `
        <span class="p-seat-name" id="summaryPassengerName_${i}">${displayName}</span>
        <span class="p-seat-pill">Seat ${assignedSeatCode} (${seatCategory})</span>
      `;
      summarySeatList.appendChild(row);
    }
  }

  renderSummarySeats();

  // ==========================================================================
  // 4. Generate Dynamic Passenger Form Cards
  // ==========================================================================
  const passengerCardsList = document.getElementById('passengerCardsList');
  const nationalities = [
    'United Arab Emirates', 'India', 'United Kingdom', 'United States', 'Singapore',
    'Germany', 'France', 'Canada', 'Australia', 'Saudi Arabia', 'Qatar', 'Switzerland',
    'Japan', 'Netherlands', 'Italy', 'Spain', 'South Africa', 'New Zealand', 'Other'
  ];

  function buildPassengerCard(index) {
    const pNumber = index + 1;
    const isPrimary = index === 0;
    const pSeatObj = (seatDataPayload.passengers && seatDataPayload.passengers[index]) ? seatDataPayload.passengers[index] : null;
    const assignedSeatCode = pSeatObj && pSeatObj.outboundSeat ? pSeatObj.outboundSeat.code : 'Assigned';
    const assignedCategory = pSeatObj && pSeatObj.outboundSeat ? pSeatObj.outboundSeat.categoryLabel : 'Economy';

    // Pre-fill values if logged in and primary passenger
    const defaultName = (isPrimary && loggedInUser && loggedInUser.fullName) ? loggedInUser.fullName : '';
    const defaultEmail = (isPrimary && loggedInUser && loggedInUser.email) ? loggedInUser.email : '';
    const defaultPhone = (isPrimary && loggedInUser && loggedInUser.phone) ? loggedInUser.phone : '';
    const defaultDob = (isPrimary && loggedInUser && loggedInUser.dob) ? loggedInUser.dob : '';
    const defaultNationality = (isPrimary && loggedInUser && loggedInUser.nationality) ? loggedInUser.nationality : 'United Arab Emirates';

    const card = document.createElement('div');
    card.className = 'passenger-card';
    card.id = `passengerCard_${index}`;

    card.innerHTML = `
      <div class="passenger-card-header">
        <div class="p-header-left">
          <div class="p-badge-number">${pNumber}</div>
          <div>
            <h2>Passenger ${pNumber} ${isPrimary ? '<span style="font-size:0.85rem; color:var(--color-gold); font-weight:600;">(Primary Traveler)</span>' : ''}</h2>
            <span class="passenger-type-badge">${isPrimary ? 'Adult / Lead Contact' : 'Adult / Accompanying Traveler'}</span>
          </div>
        </div>
        <div class="passenger-seat-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M7 13h10M7 17h10M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"></path>
          </svg>
          <span>Seat ${assignedSeatCode} • ${assignedCategory}</span>
        </div>
      </div>

      <!-- Identity & Personal Information -->
      <div class="form-grid-3">
        <div class="form-field-group">
          <label class="form-field-label" for="pTitle_${index}">Title <span class="req-star">*</span></label>
          <div class="input-container">
            <select class="form-select" id="pTitle_${index}" name="title_${index}" required>
              <option value="Mr">Mr</option>
              <option value="Ms">Ms</option>
              <option value="Mrs">Mrs</option>
              <option value="Dr">Dr</option>
              <option value="Prof">Prof</option>
            </select>
            <div class="field-error-msg" id="pTitleError_${index}"></div>
          </div>
        </div>

        <div class="form-field-group" style="grid-column: span 2;">
          <label class="form-field-label" for="pFullName_${index}">
            <span>Full Name (as per Passport / ID)</span>
            <span class="req-star">*</span>
          </label>
          <div class="input-container">
            <input type="text" class="form-input" id="pFullName_${index}" name="fullName_${index}"
              placeholder="e.g. Alexander James Wright" value="${defaultName}" required autocomplete="name">
            <div class="field-error-msg" id="pFullNameError_${index}"></div>
          </div>
        </div>
      </div>

      <div class="form-grid-3">
        <div class="form-field-group">
          <label class="form-field-label" for="pDob_${index}">Date of Birth <span class="req-star">*</span></label>
          <div class="input-container">
            <input type="date" class="form-input" id="pDob_${index}" name="dob_${index}" value="${defaultDob}" required>
            <div class="field-error-msg" id="pDobError_${index}"></div>
          </div>
        </div>

        <div class="form-field-group">
          <label class="form-field-label" for="pGender_${index}">Gender <span class="req-star">*</span></label>
          <div class="input-container">
            <select class="form-select" id="pGender_${index}" name="gender_${index}" required>
              <option value="">Select Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Undisclosed">Undisclosed</option>
            </select>
            <div class="field-error-msg" id="pGenderError_${index}"></div>
          </div>
        </div>

        <div class="form-field-group">
          <label class="form-field-label" for="pNationality_${index}">Nationality <span class="req-star">*</span></label>
          <div class="input-container">
            <select class="form-select" id="pNationality_${index}" name="nationality_${index}" required>
              <option value="">Select Nationality</option>
              ${nationalities.map(n => `<option value="${n}" ${n === defaultNationality ? 'selected' : ''}>${n}</option>`).join('')}
            </select>
            <div class="field-error-msg" id="pNationalityError_${index}"></div>
          </div>
        </div>
      </div>

      <div class="form-grid-2">
        <div class="form-field-group">
          <label class="form-field-label" for="pIdType_${index}">Identification Type <span class="req-star">*</span></label>
          <div class="input-container">
            <select class="form-select" id="pIdType_${index}" name="idType_${index}" required>
              <option value="Passport" selected>Passport</option>
              <option value="Government ID">Government Issued National ID</option>
            </select>
            <div class="field-error-msg" id="pIdTypeError_${index}"></div>
          </div>
        </div>

        <div class="form-field-group">
          <label class="form-field-label" for="pIdNumber_${index}">
            <span>Identification Number</span>
            <span class="req-star">*</span>
          </label>
          <div class="input-container">
            <input type="text" class="form-input" id="pIdNumber_${index}" name="idNumber_${index}"
              placeholder="e.g. A12345678 or 784-1990-1234567-1" required>
            <div class="field-error-msg" id="pIdNumberError_${index}"></div>
          </div>
        </div>
      </div>

      ${isPrimary ? `
        <!-- Contact Information for Primary Passenger Only -->
        <div class="section-sub-header">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
            <polyline points="22,6 12,13 2,6"></polyline>
          </svg>
          <span>Primary Contact & Booking Dispatch (Flight Updates & E-Ticket)</span>
        </div>

        <div class="form-grid-2">
          <div class="form-field-group">
            <label class="form-field-label" for="pEmail">
              <span>Email Address</span>
              <span class="req-star">*</span>
            </label>
            <div class="input-container">
              <input type="email" class="form-input" id="pEmail" name="email"
                placeholder="passenger@domain.com" value="${defaultEmail}" required autocomplete="email">
              <div class="field-error-msg" id="pEmailError"></div>
            </div>
          </div>

          <div class="form-field-group">
            <label class="form-field-label" for="pPhone">
              <span>Mobile Contact Number</span>
              <span class="req-star">*</span>
            </label>
            <div class="input-container">
              <input type="tel" class="form-input" id="pPhone" name="phone"
                placeholder="+971 50 123 4567" value="${defaultPhone}" required autocomplete="tel">
              <div class="field-error-msg" id="pPhoneError"></div>
            </div>
          </div>
        </div>
      ` : ''}
    `;

    return card;
  }

  // Populate cards
  if (passengerCardsList) {
    passengerCardsList.innerHTML = '';
    for (let i = 0; i < totalPassengers; i++) {
      passengerCardsList.appendChild(buildPassengerCard(i));
    }
  }

  // Live update of names in Booking Summary sidebar as the user types
  for (let i = 0; i < totalPassengers; i++) {
    const inputEl = document.getElementById(`pFullName_${i}`);
    if (inputEl) {
      inputEl.addEventListener('input', () => {
        const summaryNameEl = document.getElementById(`summaryPassengerName_${i}`);
        if (summaryNameEl) {
          summaryNameEl.textContent = inputEl.value.trim() || `Passenger ${i + 1}`;
        }
      });
    }
  }

  // ==========================================================================
  // 5. Validation Utilities & Error Handling
  // ==========================================================================
  function isValidEmail(email) {
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return re.test(String(email).trim().toLowerCase());
  }

  function isValidPhone(phone) {
    const cleaned = String(phone).replace(/[\s\-\(\)]/g, '');
    return /^\+?[0-9]{7,15}$/.test(cleaned);
  }

  function setError(inputEl, errorEl, message) {
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.add('visible');
    }
    if (inputEl) {
      inputEl.classList.add('has-error');
    }
  }

  function clearError(inputEl, errorEl) {
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.remove('visible');
    }
    if (inputEl) {
      inputEl.classList.remove('has-error');
    }
  }

  // Wire clear on input/change
  for (let i = 0; i < totalPassengers; i++) {
    const fullNameInput = document.getElementById(`pFullName_${i}`);
    const fullNameErr = document.getElementById(`pFullNameError_${i}`);
    if (fullNameInput) {
      fullNameInput.addEventListener('input', () => clearError(fullNameInput, fullNameErr));
    }

    const dobInput = document.getElementById(`pDob_${i}`);
    const dobErr = document.getElementById(`pDobError_${i}`);
    if (dobInput) {
      dobInput.addEventListener('change', () => clearError(dobInput, dobErr));
      dobInput.addEventListener('input', () => clearError(dobInput, dobErr));
    }

    const genderInput = document.getElementById(`pGender_${i}`);
    const genderErr = document.getElementById(`pGenderError_${i}`);
    if (genderInput) {
      genderInput.addEventListener('change', () => clearError(genderInput, genderErr));
    }

    const natInput = document.getElementById(`pNationality_${i}`);
    const natErr = document.getElementById(`pNationalityError_${i}`);
    if (natInput) {
      natInput.addEventListener('change', () => clearError(natInput, natErr));
    }

    const idNumberInput = document.getElementById(`pIdNumber_${i}`);
    const idNumberErr = document.getElementById(`pIdNumberError_${i}`);
    if (idNumberInput) {
      idNumberInput.addEventListener('input', () => clearError(idNumberInput, idNumberErr));
    }
  }

  const pEmail = document.getElementById('pEmail');
  const pEmailErr = document.getElementById('pEmailError');
  if (pEmail) {
    pEmail.addEventListener('input', () => clearError(pEmail, pEmailErr));
  }

  const pPhone = document.getElementById('pPhone');
  const pPhoneErr = document.getElementById('pPhoneError');
  if (pPhone) {
    pPhone.addEventListener('input', () => clearError(pPhone, pPhoneErr));
  }

  // ==========================================================================
  // 6. Comprehensive Form Submission & Manifest Persistence
  // ==========================================================================
  const passengerDetailsForm = document.getElementById('passengerDetailsForm');
  const globalValidationAlert = document.getElementById('globalValidationAlert');
  const paymentTransitionModal = document.getElementById('paymentTransitionModal');
  const modalPassengerBreakdown = document.getElementById('modalPassengerBreakdown');
  const btnModifyPassengerDetails = document.getElementById('btnModifyPassengerDetails');
  const btnProceedStep8 = document.getElementById('btnProceedStep8');

  async function validateAndSaveManifest() {
    let isValid = true;
    let firstErrorField = null;
    const collectedPassengers = [];

    if (globalValidationAlert) globalValidationAlert.classList.remove('visible');

    for (let i = 0; i < totalPassengers; i++) {
      const pNumber = i + 1;
      const isPrimary = i === 0;

      const titleEl = document.getElementById(`pTitle_${i}`);
      const fullNameEl = document.getElementById(`pFullName_${i}`);
      const fullNameErr = document.getElementById(`pFullNameError_${i}`);
      const dobEl = document.getElementById(`pDob_${i}`);
      const dobErr = document.getElementById(`pDobError_${i}`);
      const genderEl = document.getElementById(`pGender_${i}`);
      const genderErr = document.getElementById(`pGenderError_${i}`);
      const nationalityEl = document.getElementById(`pNationality_${i}`);
      const nationalityErr = document.getElementById(`pNationalityError_${i}`);
      const idTypeEl = document.getElementById(`pIdType_${i}`);
      const idNumberEl = document.getElementById(`pIdNumber_${i}`);
      const idNumberErr = document.getElementById(`pIdNumberError_${i}`);

      // 1. Full Name check
      const fullNameVal = fullNameEl ? fullNameEl.value.trim() : '';
      if (!fullNameVal) {
        setError(fullNameEl, fullNameErr, `Full name is required for Passenger ${pNumber}`);
        isValid = false;
        if (!firstErrorField) firstErrorField = fullNameEl;
      } else if (fullNameVal.length < 3) {
        setError(fullNameEl, fullNameErr, 'Please enter a valid full name (min 3 characters)');
        isValid = false;
        if (!firstErrorField) firstErrorField = fullNameEl;
      } else {
        clearError(fullNameEl, fullNameErr);
      }

      // 2. Date of Birth check
      const dobVal = dobEl ? dobEl.value : '';
      if (!dobVal) {
        setError(dobEl, dobErr, `Date of birth is required for Passenger ${pNumber}`);
        isValid = false;
        if (!firstErrorField) firstErrorField = dobEl;
      } else {
        const bDate = new Date(dobVal);
        const today = new Date();
        if (isNaN(bDate.getTime()) || bDate >= today) {
          setError(dobEl, dobErr, 'Date of birth must be a valid date in the past');
          isValid = false;
          if (!firstErrorField) firstErrorField = dobEl;
        } else {
          clearError(dobEl, dobErr);
        }
      }

      // 3. Gender check
      const genderVal = genderEl ? genderEl.value : '';
      if (!genderVal) {
        setError(genderEl, genderErr, `Please select gender for Passenger ${pNumber}`);
        isValid = false;
        if (!firstErrorField) firstErrorField = genderEl;
      } else {
        clearError(genderEl, genderErr);
      }

      // 4. Nationality check
      const nationalityVal = nationalityEl ? nationalityEl.value : '';
      if (!nationalityVal) {
        setError(nationalityEl, nationalityErr, `Please select nationality for Passenger ${pNumber}`);
        isValid = false;
        if (!firstErrorField) firstErrorField = nationalityEl;
      } else {
        clearError(nationalityEl, nationalityErr);
      }

      // 5. Identification Number check
      const idNumberVal = idNumberEl ? idNumberEl.value.trim() : '';
      if (!idNumberVal) {
        setError(idNumberEl, idNumberErr, `Identification number is required for Passenger ${pNumber}`);
        isValid = false;
        if (!firstErrorField) firstErrorField = idNumberEl;
      } else if (idNumberVal.length < 5) {
        setError(idNumberEl, idNumberErr, 'Identification number must be at least 5 characters');
        isValid = false;
        if (!firstErrorField) firstErrorField = idNumberEl;
      } else {
        clearError(idNumberEl, idNumberErr);
      }

      // Primary passenger contact checks
      let emailVal = '';
      let phoneVal = '';
      if (isPrimary) {
        emailVal = pEmail ? pEmail.value.trim() : '';
        if (!emailVal) {
          setError(pEmail, pEmailErr, 'Contact email address is required');
          isValid = false;
          if (!firstErrorField) firstErrorField = pEmail;
        } else if (!isValidEmail(emailVal)) {
          setError(pEmail, pEmailErr, 'Please enter a valid email address (e.g. name@domain.com)');
          isValid = false;
          if (!firstErrorField) firstErrorField = pEmail;
        } else {
          clearError(pEmail, pEmailErr);
        }

        phoneVal = pPhone ? pPhone.value.trim() : '';
        if (!phoneVal) {
          setError(pPhone, pPhoneErr, 'Contact mobile number is required');
          isValid = false;
          if (!firstErrorField) firstErrorField = pPhone;
        } else if (!isValidPhone(phoneVal)) {
          setError(pPhone, pPhoneErr, 'Please enter a valid phone number (min 7 digits with country code)');
          isValid = false;
          if (!firstErrorField) firstErrorField = pPhone;
        } else {
          clearError(pPhone, pPhoneErr);
        }
      }

      // Retrieve associated seat selection from Step 6 payload
      const pSeatObj = (seatDataPayload.passengers && seatDataPayload.passengers[i]) ? seatDataPayload.passengers[i] : null;

      collectedPassengers.push({
        passengerNumber: pNumber,
        isPrimary: isPrimary,
        title: titleEl ? titleEl.value : 'Mr',
        fullName: fullNameVal,
        dob: dobVal,
        gender: genderVal,
        nationality: nationalityVal,
        idType: idTypeEl ? idTypeEl.value : 'Passport',
        idNumber: idNumberVal,
        contactEmail: isPrimary ? emailVal : null,
        contactPhone: isPrimary ? phoneVal : null,
        seatAllocation: pSeatObj ? {
          outbound: pSeatObj.outboundSeat,
          return: pSeatObj.returnSeat
        } : null
      });
    }

    if (!isValid) {
      if (globalValidationAlert) {
        globalValidationAlert.textContent = 'Please resolve all highlighted fields in the passenger forms before proceeding to Payment.';
        globalValidationAlert.classList.add('visible');
      }
      if (firstErrorField) {
        firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstErrorField.focus();
      }
      return false;
    }

    // Build Step 7 Manifest Payload
    const manifestPayload = {
      flightBooking: booking,
      passengers: collectedPassengers,
      fareSummary: {
        totalTicketFare: totalTicketFare,
        totalTicketFareFormatted: formatShortINR(totalTicketFare),
        totalSeatCharges: totalSeatCharges,
        totalSeatChargesFormatted: formatShortINR(totalSeatCharges),
        totalPayable: totalPayableAmount,
        totalPayableFormatted: formatShortINR(totalPayableAmount)
      },
      status: 'PASSENGER_DETAILS_CONFIRMED',
      savedAt: new Date().toISOString()
    };

    // Show loading state on button
    if (btnContinuePayment) {
      btnContinuePayment.disabled = true;
      btnContinuePayment.innerHTML = `<span>Creating Reservation...</span>`;
    }

    // Call POST /api/bookings to create the official database reservation
    const bookingApiPayload = {
      outbound: {
        flight_id: outboundFlight.id || outboundFlight.flight_id,
        cabin: booking.outbound ? booking.outbound.cabin : cabinClass.toLowerCase()
      },
      return: (isRoundTrip && returnFlight) ? {
        flight_id: returnFlight.id || returnFlight.flight_id,
        cabin: booking.return ? booking.return.cabin : cabinClass.toLowerCase()
      } : null,
      passengers: collectedPassengers.map(p => ({
        fullName: p.fullName,
        dateOfBirth: p.dateOfBirth,
        gender: p.gender,
        nationality: p.nationality,
        identificationType: p.identificationType,
        identificationNumber: p.identificationNumber,
        contactEmail: p.contactEmail,
        contactPhone: p.contactPhone,
        seatAllocation: {
          outbound: p.seatAllocation ? p.seatAllocation.outbound : null,
          return: p.seatAllocation ? p.seatAllocation.return : null
        }
      }))
    };

    try {
      const resp = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(bookingApiPayload)
      });
      const data = await resp.json().catch(() => ({}));

      if (!resp.ok || data.status !== 'success') {
        const errorMsg = data.message || 'Failed to reserve booking. Please check passenger details and seat availability.';
        if (globalValidationAlert) {
          globalValidationAlert.textContent = `⚠️ ${errorMsg}`;
          globalValidationAlert.style.display = 'block';
          globalValidationAlert.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          alert(errorMsg);
        }
        if (btnContinuePayment) {
          btnContinuePayment.disabled = false;
          btnContinuePayment.innerHTML = `<span>Continue to Payment</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
        }
        return false;
      }

      // Booking successfully created in backend with Pending status and real PNR
      manifestPayload.pnr = data.pnr;
      manifestPayload.booking_reference = data.pnr;
      manifestPayload.backendBookings = data.bookings;
      manifestPayload.totalPayable = data.total_fare;
      manifestPayload.totalPayableFormatted = formatShortINR(data.total_fare);

    } catch (netErr) {
      console.error('Error creating booking:', netErr);
      if (globalValidationAlert) {
        globalValidationAlert.textContent = '⚠️ Network error: could not connect to reservation server. Please try again.';
        globalValidationAlert.style.display = 'block';
      }
      if (btnContinuePayment) {
        btnContinuePayment.disabled = false;
        btnContinuePayment.innerHTML = `<span>Continue to Payment</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
      }
      return false;
    } finally {
      if (btnContinuePayment) {
        btnContinuePayment.disabled = false;
        btnContinuePayment.innerHTML = `<span>Continue to Payment</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
      }
    }

    try {
      sessionStorage.setItem('aerovista_booking_manifest', JSON.stringify(manifestPayload));
    } catch (e) {
      console.warn('SessionStorage write error', e);
    }

    // Populate and show Transition Modal
    if (modalPassengerBreakdown) {
      let passengerRows = '';
      collectedPassengers.forEach(p => {
        const seatStr = (p.seatAllocation && p.seatAllocation.outbound) ? `Seat ${p.seatAllocation.outbound.code}` : 'Seat Assigned';
        passengerRows += `
          <div class="modal-row">
            <span>Passenger ${p.passengerNumber}: ${p.fullName}</span>
            <span>${seatStr} (${p.nationality})</span>
          </div>
        `;
      });

      const pnrBadge = manifestPayload.pnr ? `<div class="modal-row" style="color: var(--color-gold); font-weight: 700;"><span>Booking PNR:</span><span>${manifestPayload.pnr}</span></div>` : '';

      modalPassengerBreakdown.innerHTML = `
        ${pnrBadge}
        <div class="modal-row">
          <span>Flight Selection</span>
          <span>${outboundFlight.airline || 'AeroVista'} ${outboundFlight.flightNumber} (${outboundFlight.sourceCode} → ${outboundFlight.destCode})</span>
        </div>
        <div class="modal-row">
          <span>Travel Date &amp; Class</span>
          <span>${travelDate} • ${cabinClass}</span>
        </div>
        ${passengerRows}
        <div class="modal-row">
          <span>Total Payable Amount</span>
          <span>${manifestPayload.totalPayableFormatted}</span>
        </div>
      `;
    }

    if (paymentTransitionModal) {
      paymentTransitionModal.classList.add('is-active');
    }

    return true;
  }

  // Handle Form Submission
  if (passengerDetailsForm) {
    passengerDetailsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      validateAndSaveManifest();
    });
  }

  if (btnModifyPassengerDetails && paymentTransitionModal) {
    btnModifyPassengerDetails.addEventListener('click', () => {
      paymentTransitionModal.classList.remove('is-active');
    });
  }

  if (btnProceedStep8) {
    btnProceedStep8.addEventListener('click', () => {
      window.location.href = 'payment.html';
    });
  }

});

