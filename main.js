/**
 * AeroVista Airlines – Homepage Interactive Logic
 * Handles:
 * 1. Mobile menu toggle & navbar scroll effect
 * 2. Tab switching (Book a Flight vs Manage Booking)
 * 3. Trip type toggle (One-way vs Round-trip showing/hiding Return Date)
 * 4. Searchable city dropdown autocomplete & Origin-Destination swap
 * 5. Interactive passenger counter popover (Adults, Children, Infants)
 * 6. Form validations (date bounds, passenger ratio, city conflicts)
 * 7. Storing validated search parameters in sessionStorage for Step 2
 */

document.addEventListener('DOMContentLoaded', () => {
  // ==========================================
  // 1. DATA: Supported Airport/City Hubs
  // ==========================================
  const AIRPORTS = [
    { city: 'London', code: 'LHR', airport: 'Heathrow Airport', country: 'United Kingdom' },
    { city: 'Dubai', code: 'DXB', airport: 'Dubai International Airport', country: 'United Arab Emirates' },
    { city: 'Doha', code: 'DOH', airport: 'Hamad International Airport', country: 'Qatar' },
    { city: 'New York', code: 'JFK', airport: 'John F. Kennedy Intl', country: 'United States' },
    { city: 'Paris', code: 'CDG', airport: 'Charles de Gaulle Airport', country: 'France' },
    { city: 'Tokyo', code: 'HND', airport: 'Tokyo Haneda Airport', country: 'Japan' },
    { city: 'Singapore', code: 'SIN', airport: 'Singapore Changi Airport', country: 'Singapore' },
    { city: 'Sydney', code: 'SYD', airport: 'Sydney Kingsford Smith', country: 'Australia' },
    { city: 'Frankfurt', code: 'FRA', airport: 'Frankfurt am Main Airport', country: 'Germany' },
    { city: 'Mumbai', code: 'BOM', airport: 'Chhatrapati Shivaji Maharaj', country: 'India' },
    { city: 'Hong Kong', code: 'HKG', airport: 'Hong Kong International', country: 'Hong Kong' },
    { city: 'Rome', code: 'FCO', airport: 'Leonardo da Vinci–Fiumicino', country: 'Italy' }
  ];

  // ==========================================
  // 2. DOM Elements
  // ==========================================
  const navbar = document.getElementById('navbar');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const mobileNavPanel = document.getElementById('mobileNavPanel');

  const tabBookFlight = document.getElementById('tabBookFlight');
  const tabManageBooking = document.getElementById('tabManageBooking');
  const flightSearchForm = document.getElementById('flightSearchForm');
  const manageBookingPanel = document.getElementById('manageBookingPanel');
  const navManageBooking = document.getElementById('navManageBooking');
  const navBookFlights = document.getElementById('navBookFlights');
  const heroBookBtn = document.getElementById('heroBookBtn');

  const tripRadios = document.querySelectorAll('input[name="tripType"]');
  const flightFieldsGrid = document.getElementById('flightFieldsGrid');
  const returnDateFieldContainer = document.getElementById('returnDateFieldContainer');
  const returnDateInput = document.getElementById('returnDateInput');
  const deptDateInput = document.getElementById('deptDateInput');

  const fromCityInput = document.getElementById('fromCityInput');
  const toCityInput = document.getElementById('toCityInput');
  const fromCityDropdown = document.getElementById('fromCityDropdown');
  const toCityDropdown = document.getElementById('toCityDropdown');
  const swapCitiesBtn = document.getElementById('swapCitiesBtn');

  // Passenger popover & counters
  const passengerToggleBtn = document.getElementById('passengerToggleBtn');
  const passengerPopover = document.getElementById('passengerPopover');
  const passengerDisplayText = document.getElementById('passengerDisplayText');
  const donePassengerBtn = document.getElementById('donePassengerBtn');

  const countAdultsEl = document.getElementById('countAdults');
  const countChildrenEl = document.getElementById('countChildren');
  const countInfantsEl = document.getElementById('countInfants');

  const incAdults = document.getElementById('incAdults');
  const decAdults = document.getElementById('decAdults');
  const incChildren = document.getElementById('incChildren');
  const decChildren = document.getElementById('decChildren');
  const incInfants = document.getElementById('incInfants');
  const decInfants = document.getElementById('decInfants');

  // Error placeholders
  const fromError = document.getElementById('fromError');
  const toError = document.getElementById('toError');
  const deptError = document.getElementById('deptError');
  const returnError = document.getElementById('returnError');
  const passengerError = document.getElementById('passengerError');
  const formAlertMessage = document.getElementById('formAlertMessage');

  // Passenger State
  const passengerState = {
    adults: 1,
    children: 0,
    infants: 0
  };

  // ==========================================
  // 3. Mobile Navigation Menu Toggle
  // ==========================================
  if (mobileMenuBtn && mobileNavPanel) {
    mobileMenuBtn.addEventListener('click', () => {
      mobileNavPanel.classList.toggle('is-open');
    });

    mobileNavPanel.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mobileNavPanel.classList.remove('is-open');
      });
    });
  }

  // Smooth scroll helper
  function scrollToBooking() {
    const bookingSection = document.getElementById('booking-section');
    if (bookingSection) {
      bookingSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  if (navBookFlights) navBookFlights.addEventListener('click', (e) => { e.preventDefault(); scrollToBooking(); switchTab('book'); });
  if (heroBookBtn) heroBookBtn.addEventListener('click', (e) => { e.preventDefault(); scrollToBooking(); switchTab('book'); });
  if (navManageBooking) navManageBooking.addEventListener('click', (e) => { e.preventDefault(); scrollToBooking(); switchTab('manage'); });

  // Quick book destination buttons
  document.querySelectorAll('.btn-quick-select').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const code = btn.getAttribute('data-destination');
      const found = AIRPORTS.find(a => a.code === code);
      if (found) {
        toCityInput.value = `${found.city} (${found.code})`;
        clearError(toError, toCityInput);
      }
      scrollToBooking();
      switchTab('book');
    });
  });

  // ==========================================
  // 4. Booking Tabs (Book Flight vs Manage)
  // ==========================================
  function switchTab(target) {
    if (target === 'book') {
      tabBookFlight.classList.add('active');
      tabManageBooking.classList.remove('active');
      flightSearchForm.style.display = 'block';
      manageBookingPanel.style.display = 'none';
    } else {
      tabManageBooking.classList.add('active');
      tabBookFlight.classList.remove('active');
      flightSearchForm.style.display = 'none';
      manageBookingPanel.style.display = 'block';
    }
  }

  tabBookFlight.addEventListener('click', () => switchTab('book'));
  tabManageBooking.addEventListener('click', () => switchTab('manage'));

  // Dummy action for manage booking in Phase 1
  const findBookingBtn = document.getElementById('findBookingBtn');
  if (findBookingBtn) {
    findBookingBtn.addEventListener('click', () => {
      const ref = document.getElementById('bookingRefInput').value.trim();
      const lastName = document.getElementById('passengerLastNameInput').value.trim();
      if (!ref || !lastName) {
        alert('Please enter both your Booking Reference and Passenger Last Name.');
      } else {
        alert(`Booking Reference ${ref.toUpperCase()} for passenger ${lastName} found. Fetching your itinerary details...`);
      }
    });
  }

  // ==========================================
  // 5. Trip Type (One-way vs Round-trip)
  // ==========================================
  tripRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.value === 'round-trip') {
        returnDateFieldContainer.classList.remove('is-hidden');
        flightFieldsGrid.classList.add('has-return');
        returnDateInput.setAttribute('required', 'required');
      } else {
        returnDateFieldContainer.classList.add('is-hidden');
        flightFieldsGrid.classList.remove('has-return');
        returnDateInput.removeAttribute('required');
        returnDateInput.value = '';
        clearError(returnError, returnDateInput);
      }
    });
  });

  // ==========================================
  // 6. Date Setup & Constraints
  // ==========================================
  const today = new Date().toISOString().split('T')[0];
  deptDateInput.min = today;
  returnDateInput.min = today;

  // Set default departure date to 7 days from now
  const defaultDeparture = new Date();
  defaultDeparture.setDate(defaultDeparture.getDate() + 7);
  deptDateInput.value = defaultDeparture.toISOString().split('T')[0];

  deptDateInput.addEventListener('change', () => {
    clearError(deptError, deptDateInput);
    if (deptDateInput.value) {
      returnDateInput.min = deptDateInput.value;
      if (returnDateInput.value && returnDateInput.value < deptDateInput.value) {
        returnDateInput.value = deptDateInput.value;
      }
    }
  });

  returnDateInput.addEventListener('change', () => {
    clearError(returnError, returnDateInput);
  });

  // ==========================================
  // 7. City Autocomplete & Swap Origin/Dest
  // ==========================================
  function renderCityList(filterText, dropdownElement, targetInput, errorElement) {
    const query = filterText.toLowerCase().trim();
    const matched = AIRPORTS.filter(item =>
      item.city.toLowerCase().includes(query) ||
      item.code.toLowerCase().includes(query) ||
      item.country.toLowerCase().includes(query) ||
      item.airport.toLowerCase().includes(query)
    );

    dropdownElement.innerHTML = '';

    if (matched.length === 0) {
      dropdownElement.innerHTML = `<div style="padding: 0.85rem; font-size: 0.8rem; color: #8E8B83; text-align: center;">No airports matching "${filterText}"</div>`;
      dropdownElement.classList.add('is-open');
      return;
    }

    matched.forEach(item => {
      const option = document.createElement('div');
      option.className = 'city-item';
      option.setAttribute('role', 'option');
      option.innerHTML = `
        <div class="city-meta">
          <span class="city-name">${item.city}</span>
          <span class="city-country">${item.airport}, ${item.country}</span>
        </div>
        <span class="city-iata">${item.code}</span>
      `;
      option.addEventListener('click', () => {
        targetInput.value = `${item.city} (${item.code})`;
        dropdownElement.classList.remove('is-open');
        clearError(errorElement, targetInput);
      });
      dropdownElement.appendChild(option);
    });

    dropdownElement.classList.add('is-open');
  }

  fromCityInput.addEventListener('focus', () => {
    renderCityList(fromCityInput.value, fromCityDropdown, fromCityInput, fromError);
  });

  fromCityInput.addEventListener('input', () => {
    clearError(fromError, fromCityInput);
    renderCityList(fromCityInput.value, fromCityDropdown, fromCityInput, fromError);
  });

  toCityInput.addEventListener('focus', () => {
    renderCityList(toCityInput.value, toCityDropdown, toCityInput, toError);
  });

  toCityInput.addEventListener('input', () => {
    clearError(toError, toCityInput);
    renderCityList(toCityInput.value, toCityDropdown, toCityInput, toError);
  });

  // Swap origin and destination
  swapCitiesBtn.addEventListener('click', () => {
    const temp = fromCityInput.value;
    fromCityInput.value = toCityInput.value;
    toCityInput.value = temp;

    clearError(fromError, fromCityInput);
    clearError(toError, toCityInput);
  });

  // Close dropdowns on outside click
  document.addEventListener('click', (e) => {
    if (!fromCityInput.contains(e.target) && !fromCityDropdown.contains(e.target)) {
      fromCityDropdown.classList.remove('is-open');
    }
    if (!toCityInput.contains(e.target) && !toCityDropdown.contains(e.target)) {
      toCityDropdown.classList.remove('is-open');
    }
    if (!passengerToggleBtn.contains(e.target) && !passengerPopover.contains(e.target)) {
      passengerPopover.classList.remove('is-open');
      passengerToggleBtn.setAttribute('aria-expanded', 'false');
    }
  });

  // Set default initial cities for sleek demo experience
  fromCityInput.value = 'Dubai (DXB)';
  toCityInput.value = 'London (LHR)';

  // ==========================================
  // 8. Passenger Counter Popover & Controls
  // ==========================================
  passengerToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = passengerPopover.classList.toggle('is-open');
    passengerToggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  donePassengerBtn.addEventListener('click', () => {
    passengerPopover.classList.remove('is-open');
    passengerToggleBtn.setAttribute('aria-expanded', 'false');
  });

  function updatePassengerUI() {
    countAdultsEl.textContent = passengerState.adults;
    countChildrenEl.textContent = passengerState.children;
    countInfantsEl.textContent = passengerState.infants;

    decAdults.disabled = passengerState.adults <= 1;
    decChildren.disabled = passengerState.children <= 0;
    decInfants.disabled = passengerState.infants <= 0;

    // Total passenger cap (max 9 total passengers standard)
    const totalPassengers = passengerState.adults + passengerState.children + passengerState.infants;
    const isMax = totalPassengers >= 9;

    incAdults.disabled = isMax;
    incChildren.disabled = isMax;
    // Infants cannot exceed adults
    incInfants.disabled = isMax || (passengerState.infants >= passengerState.adults);

    // Build display text
    const parts = [];
    parts.push(`${passengerState.adults} Adult${passengerState.adults > 1 ? 's' : ''}`);
    if (passengerState.children > 0) {
      parts.push(`${passengerState.children} Child${passengerState.children > 1 ? 'ren' : ''}`);
    }
    if (passengerState.infants > 0) {
      parts.push(`${passengerState.infants} Infant${passengerState.infants > 1 ? 's' : ''}`);
    }

    passengerDisplayText.textContent = totalPassengers === 1 ? '1 Passenger' : `${totalPassengers} Passengers (${parts.join(', ')})`;
    clearError(passengerError);
  }

  incAdults.addEventListener('click', () => {
    if (passengerState.adults + passengerState.children + passengerState.infants < 9) {
      passengerState.adults++;
      updatePassengerUI();
    }
  });

  decAdults.addEventListener('click', () => {
    if (passengerState.adults > 1) {
      passengerState.adults--;
      // If infants now exceed adults, reduce infants
      if (passengerState.infants > passengerState.adults) {
        passengerState.infants = passengerState.adults;
      }
      updatePassengerUI();
    }
  });

  incChildren.addEventListener('click', () => {
    if (passengerState.adults + passengerState.children + passengerState.infants < 9) {
      passengerState.children++;
      updatePassengerUI();
    }
  });

  decChildren.addEventListener('click', () => {
    if (passengerState.children > 0) {
      passengerState.children--;
      updatePassengerUI();
    }
  });

  incInfants.addEventListener('click', () => {
    if (passengerState.infants < passengerState.adults && (passengerState.adults + passengerState.children + passengerState.infants < 9)) {
      passengerState.infants++;
      updatePassengerUI();
    }
  });

  decInfants.addEventListener('click', () => {
    if (passengerState.infants > 0) {
      passengerState.infants--;
      updatePassengerUI();
    }
  });

  updatePassengerUI();

  // ==========================================
  // 9. Validation & Form Submission
  // ==========================================
  function setError(errorElement, inputElement, message) {
    if (errorElement) errorElement.textContent = message;
    if (inputElement) {
      const box = inputElement.closest('.field-input-box');
      if (box) box.classList.add('has-error');
    }
  }

  function clearError(errorElement, inputElement) {
    if (errorElement) errorElement.textContent = '';
    if (inputElement) {
      const box = inputElement.closest('.field-input-box');
      if (box) box.classList.remove('has-error');
    }
  }

  function clearAllErrors() {
    [fromError, toError, deptError, returnError, passengerError].forEach(el => {
      if (el) el.textContent = '';
    });
    document.querySelectorAll('.field-input-box').forEach(box => box.classList.remove('has-error'));
    formAlertMessage.style.display = 'none';
  }

  function extractCityCode(str) {
    const match = str.match(/\(([A-Z]{3})\)/);
    return match ? match[1] : str.trim().toUpperCase();
  }

  flightSearchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    clearAllErrors();

    let isValid = true;
    const fromVal = fromCityInput.value.trim();
    const toVal = toCityInput.value.trim();
    const deptDateVal = deptDateInput.value;
    const selectedTripType = document.querySelector('input[name="tripType"]:checked').value;
    const returnDateVal = returnDateInput.value;
    const cabinClassVal = document.getElementById('cabinClassSelect').value;

    // 1. Source and Destination Mandatory
    if (!fromVal) {
      setError(fromError, fromCityInput, 'Please select departure city');
      isValid = false;
    }

    if (!toVal) {
      setError(toError, toCityInput, 'Please select destination city');
      isValid = false;
    }

    // 2. Source and Destination cannot be identical
    if (fromVal && toVal) {
      const codeFrom = extractCityCode(fromVal);
      const codeTo = extractCityCode(toVal);
      if (codeFrom === codeTo || fromVal.toLowerCase() === toVal.toLowerCase()) {
        setError(toError, toCityInput, 'Origin and destination cannot be identical');
        isValid = false;
      }
    }

    // 3. Departure Date validation
    if (!deptDateVal) {
      setError(deptError, deptDateInput, 'Please choose a departure date');
      isValid = false;
    } else {
      const chosenDept = new Date(deptDateVal);
      const curDate = new Date();
      curDate.setHours(0, 0, 0, 0);
      if (chosenDept < curDate) {
        setError(deptError, deptDateInput, 'Departure cannot be in the past');
        isValid = false;
      }
    }

    // 4. Return Date validation (if Round-trip)
    if (selectedTripType === 'round-trip') {
      if (!returnDateVal) {
        setError(returnError, returnDateInput, 'Please choose a return date');
        isValid = false;
      } else {
        const chosenDept = new Date(deptDateVal);
        const chosenReturn = new Date(returnDateVal);
        if (chosenReturn < chosenDept) {
          setError(returnError, returnDateInput, 'Return cannot be before departure');
          isValid = false;
        }
      }
    }

    // 5 & 6 & 7. Passenger rules
    if (passengerState.adults < 1) {
      setError(passengerError, null, 'At least 1 adult passenger is required');
      isValid = false;
    }

    if (passengerState.infants > passengerState.adults) {
      setError(passengerError, null, 'Infants cannot exceed number of adults');
      isValid = false;
    }

    if (!isValid) {
      formAlertMessage.className = 'form-alert alert-error';
      formAlertMessage.innerHTML = '⚠️ Please resolve the highlighted search requirements before proceeding.';
      formAlertMessage.style.display = 'flex';
      return;
    }

    // If all valid: Save criteria in sessionStorage for Step 2 Flight Results
    const searchPayload = {
      tripType: selectedTripType,
      origin: fromVal,
      originCode: extractCityCode(fromVal),
      destination: toVal,
      destinationCode: extractCityCode(toVal),
      departureDate: deptDateVal,
      returnDate: selectedTripType === 'round-trip' ? returnDateVal : null,
      passengers: {
        adults: passengerState.adults,
        children: passengerState.children,
        infants: passengerState.infants,
        total: passengerState.adults + passengerState.children + passengerState.infants
      },
      cabinClass: cabinClassVal,
      searchedAt: new Date().toISOString()
    };

    try {
      sessionStorage.setItem('aerovista_search_query', JSON.stringify(searchPayload));
    } catch (err) {
      console.warn('SessionStorage unavailable', err);
    }

    // Display clear, elegant feedback and navigate to Step 5: Search Results
    formAlertMessage.className = 'form-alert alert-success';
    formAlertMessage.innerHTML = `
      ✓ Flight search criteria confirmed for 
      <strong>${searchPayload.origin}</strong> to <strong>${searchPayload.destination}</strong>. 
      Navigating to available flights...
    `;
    formAlertMessage.style.display = 'flex';

    setTimeout(() => {
      window.location.href = 'search-results.html';
    }, 600);
  });
});

