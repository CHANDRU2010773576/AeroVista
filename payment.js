/**
 * AeroVista Airlines – Step 8: Payment Gateway Logic
 * Connects directly to Flask backend (/api/payments & /api/bookings/<pnr>).
 * Features:
 * - Ingests booking reference (PNR) and queries database for verified amount.
 * - Enforces temporary seat hold countdown (15 minutes).
 * - Multi-channel simulated payment gateway (Credit Card, Debit Card, UPI).
 * - Real simulated outcome processing (Success vs Decline/Failure).
 * - Safe payment retries on pending bookings without duplicate booking creation.
 * - Redirects to Booking Confirmation upon confirmed payment.
 */

document.addEventListener('DOMContentLoaded', async () => {

  function formatShortINR(amount) {
    const num = Number(amount);
    if (isNaN(num)) return '₹0';
    return '₹' + num.toLocaleString('en-IN');
  }

  function formatDisplayDate(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr.replace(' ', 'T'));
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  }

  function formatDisplayTime(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr.replace(' ', 'T'));
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch (e) {
      return dateStr;
    }
  }

  // ==========================================================================
  // 1. Identify Target Booking PNR(s)
  // ==========================================================================
  const urlParams = new URLSearchParams(window.location.search);
  let outboundPnr = (urlParams.get('pnr') || '').trim().toUpperCase();
  let returnPnr = (urlParams.get('return_pnr') || '').trim().toUpperCase();

  let manifest = null;
  try {
    const rawManifest = sessionStorage.getItem('aerovista_booking_manifest');
    if (rawManifest) {
      manifest = JSON.parse(rawManifest);
    }
  } catch (e) {
    console.warn('Could not parse aerovista_booking_manifest', e);
  }

  if (!outboundPnr && manifest) {
    if (manifest.pnr) outboundPnr = manifest.pnr.trim().toUpperCase();
    if (manifest.backendBookings && Array.isArray(manifest.backendBookings)) {
      if (manifest.backendBookings[0]) outboundPnr = manifest.backendBookings[0].pnr.trim().toUpperCase();
      if (manifest.backendBookings[1]) returnPnr = manifest.backendBookings[1].pnr.trim().toUpperCase();
    }
  }

  // Fallback data if page is visited directly without booking
  if (!manifest) {
    const rawSeats = sessionStorage.getItem('aerovista_selected_seats');
    const rawFlight = sessionStorage.getItem('aerovista_selected_flight');
    const seatObj = rawSeats ? JSON.parse(rawSeats) : null;
    const flightObj = rawFlight ? JSON.parse(rawFlight) : null;

    manifest = {
      flightBooking: flightObj || (seatObj ? seatObj.flightBooking : {
        outbound: {
          flight: {
            airline: 'AeroVista Airlines',
            flightNumber: 'AV-801',
            sourceCity: 'Dubai',
            sourceCode: 'DXB',
            destCity: 'Mumbai',
            destCode: 'BOM',
            departureTime: '13:10',
            arrivalTime: '02:35'
          },
          cabin: 'economy',
          fare: 3705
        },
        return: null,
        totalPassengers: 1,
        searchQuery: { departureDate: '2026-11-19' }
      }),
      passengers: (seatObj && seatObj.passengers) ? seatObj.passengers : [
        {
          passengerNumber: 1,
          fullName: 'Alexander Wright',
          nationality: 'United Arab Emirates',
          seatAllocation: { outbound: { code: '10A', categoryLabel: 'Extra Legroom' } }
        }
      ],
      fareSummary: {
        totalTicketFare: 3705,
        totalTicketFareFormatted: '₹3,705',
        totalSeatCharges: (seatObj && seatObj.totalSeatCharges) || 500,
        totalSeatChargesFormatted: (seatObj && seatObj.totalSeatChargesFormatted) || '₹500',
        totalPayable: 4205,
        totalPayableFormatted: '₹4,205'
      }
    };
  }

  // ==========================================================================
  // 2. DOM Elements
  // ==========================================================================
  const payRouteAccent = document.getElementById('payRouteAccent');
  const payFlightMetaPills = document.getElementById('payFlightMetaPills');
  const paySummaryPassengerPill = document.getElementById('paySummaryPassengerPill');
  const paySummaryFlightMeta = document.getElementById('paySummaryFlightMeta');
  const paySummarySeatList = document.getElementById('paySummarySeatList');
  const payTicketFareVal = document.getElementById('payTicketFareVal');
  const paySeatChargesVal = document.getElementById('paySeatChargesVal');
  const payTotalAmountVal = document.getElementById('payTotalAmountVal');
  const btnPayNowLabel = document.getElementById('btnPayNowLabel');
  const btnPayNow = document.getElementById('btnPayNow');
  const successAmountText = document.getElementById('successAmountText');

  const tabCredit = document.getElementById('tabCreditCard');
  const tabDebit = document.getElementById('tabDebitCard');
  const tabUPI = document.getElementById('tabUPI');
  const cardFields = document.getElementById('cardFieldsContainer');
  const upiFields = document.getElementById('upiFieldsContainer');
  const cardPreview = document.getElementById('cardVisualPreview');
  const previewCardType = document.getElementById('previewCardType');

  const cardHolderName = document.getElementById('cardHolderName');
  const cardNumber = document.getElementById('cardNumber');
  const cardExpiry = document.getElementById('cardExpiry');
  const cardCvv = document.getElementById('cardCvv');
  const upiId = document.getElementById('upiId');

  const previewCardNumber = document.getElementById('previewCardNumber');
  const previewCardHolder = document.getElementById('previewCardHolder');
  const previewCardExpiry = document.getElementById('previewCardExpiry');

  const simulationOutcome = document.getElementById('simulationOutcome');
  const processingModal = document.getElementById('processingModal');
  const successModal = document.getElementById('successModal');
  const failureModal = document.getElementById('failureModal');
  const failureReasonText = document.getElementById('failureReasonText');
  const btnRetryPayment = document.getElementById('btnRetryPayment');
  const btnProceedConfirmation = document.getElementById('btnProceedConfirmation');

  let activeMethod = 'credit'; // 'credit', 'debit', or 'upi'
  let backendVerifiedBooking = null;
  let backendReturnBooking = null;
  let verifiedTotalAmount = null;
  let holdRemainingSeconds = 0;
  let holdTimerInterval = null;

  // ==========================================================================
  // 3. Fetch Verified Booking from Backend (Database-driven pricing & holds)
  // ==========================================================================
  if (outboundPnr) {
    try {
      const qUrl = `/api/bookings/${encodeURIComponent(outboundPnr)}${returnPnr ? '?return_pnr=' + encodeURIComponent(returnPnr) : ''}`;
      const res = await fetch(qUrl);
      if (res.ok) {
        const json = await res.json();
        backendVerifiedBooking = json.booking;
        backendReturnBooking = json.return_booking || null;

        // If already paid and confirmed, redirect immediately to confirmation
        if (backendVerifiedBooking.booking_status === 'Confirmed' && backendVerifiedBooking.payment_status === 'Paid') {
          window.location.href = `booking-confirmation.html?pnr=${encodeURIComponent(outboundPnr)}${returnPnr ? '&return_pnr=' + encodeURIComponent(returnPnr) : ''}`;
          return;
        }

        // If cancelled or expired
        if (backendVerifiedBooking.booking_status === 'Cancelled') {
          alert('This reservation has been cancelled or the temporary hold expired. Please search and select flights again.');
          if (btnPayNow) {
            btnPayNow.disabled = true;
            btnPayNow.style.opacity = '0.5';
            btnPayNow.style.cursor = 'not-allowed';
            btnPayNowLabel.textContent = 'Reservation Expired';
          }
          return;
        }

        // Compute total amount directly from database
        verifiedTotalAmount = backendVerifiedBooking.total_amount;
        if (backendReturnBooking) {
          verifiedTotalAmount += backendReturnBooking.total_amount;
        }

        holdRemainingSeconds = backendVerifiedBooking.hold_remaining_seconds || 0;
      }
    } catch (e) {
      console.warn('Could not fetch verified booking from backend:', e);
    }
  }

  // ==========================================================================
  // 4. Render Booking Summary & Metadata
  // ==========================================================================
  const bookingMeta = manifest.flightBooking || {};
  let outboundFlight = bookingMeta.outbound ? bookingMeta.outbound.flight : {
    airline: 'AeroVista Airlines',
    flightNumber: 'AV-801',
    sourceCity: 'Dubai',
    sourceCode: 'DXB',
    destCity: 'Mumbai',
    destCode: 'BOM',
    departureTime: '13:10',
    arrivalTime: '02:35'
  };

  if (backendVerifiedBooking && backendVerifiedBooking.flight) {
    const f = backendVerifiedBooking.flight;
    outboundFlight = {
      airline: f.airline,
      flightNumber: f.flight_number,
      sourceCity: f.source,
      sourceCode: f.source.substring(0, 3).toUpperCase(),
      destCity: f.destination,
      destCode: f.destination.substring(0, 3).toUpperCase(),
      departureTime: formatDisplayTime(f.departure_time),
      arrivalTime: formatDisplayTime(f.arrival_time),
      aircraft: f.aircraft
    };
  }

  const isRoundTrip = !!(backendReturnBooking || (bookingMeta.return && bookingMeta.return.flight));
  const cabinClass = (bookingMeta.outbound && bookingMeta.outbound.cabin) ? bookingMeta.outbound.cabin.toUpperCase() : 'ECONOMY';
  const travelDate = (bookingMeta.searchQuery && bookingMeta.searchQuery.departureDate) ? bookingMeta.searchQuery.departureDate : (backendVerifiedBooking ? formatDisplayDate(backendVerifiedBooking.flight.departure_time) : '2026-11-19');

  const passengersList = (backendVerifiedBooking && backendVerifiedBooking.passengers && backendVerifiedBooking.passengers.length > 0)
    ? backendVerifiedBooking.passengers
    : (manifest.passengers || []);
  const passengerCount = passengersList.length || 1;

  const payableAmount = verifiedTotalAmount !== null ? verifiedTotalAmount : (manifest.totalPayable || (manifest.fareSummary && manifest.fareSummary.totalPayable) || 4205);
  const payableAmountFormatted = formatShortINR(payableAmount);

  if (payRouteAccent) {
    payRouteAccent.textContent = `${outboundFlight.sourceCity} to ${outboundFlight.destCity}`;
  }

  function renderMetaPills(holdSeconds) {
    if (!payFlightMetaPills) return;
    let holdPillHtml = '';
    if (holdSeconds > 0) {
      const mins = Math.floor(holdSeconds / 60);
      const secs = holdSeconds % 60;
      const isUrgent = holdSeconds < 120;
      holdPillHtml = `
        <div class="meta-pill" style="border-color: ${isUrgent ? '#FF5A5F' : 'var(--color-gold)'}; color: ${isUrgent ? '#FF5A5F' : 'var(--color-gold-light)'}; font-weight: 700;">
          ⏱ Hold Expires: ${mins}:${secs < 10 ? '0' : ''}${secs}
        </div>
      `;
    }

    payFlightMetaPills.innerHTML = `
      <div class="meta-pill">Flight: <strong>${outboundFlight.flightNumber}</strong></div>
      <div class="meta-pill">Route: <strong>${outboundFlight.sourceCode} → ${outboundFlight.destCode}</strong></div>
      <div class="meta-pill">Date: <strong>${travelDate}</strong></div>
      <div class="meta-pill">Cabin: <strong>${cabinClass}</strong></div>
      <div class="meta-pill">Passengers: <strong>${passengerCount}</strong></div>
      ${outboundPnr ? `<div class="meta-pill" style="color:var(--color-gold);">PNR: <strong>${outboundPnr}</strong></div>` : ''}
      ${holdPillHtml}
    `;
  }

  renderMetaPills(holdRemainingSeconds);

  // Seat hold countdown interval
  if (holdRemainingSeconds > 0) {
    holdTimerInterval = setInterval(() => {
      holdRemainingSeconds -= 1;
      if (holdRemainingSeconds <= 0) {
        clearInterval(holdTimerInterval);
        renderMetaPills(0);
        if (btnPayNow) {
          btnPayNow.disabled = true;
          btnPayNow.style.opacity = '0.5';
          btnPayNow.style.cursor = 'not-allowed';
          btnPayNowLabel.textContent = 'Seat Hold Expired';
        }
        alert('Your 15-minute temporary seat hold has expired. Selected seats have been released back into inventory.');
      } else {
        renderMetaPills(holdRemainingSeconds);
      }
    }, 1000);
  }

  if (paySummaryPassengerPill) {
    paySummaryPassengerPill.textContent = `${passengerCount} Passenger${passengerCount > 1 ? 's' : ''}`;
  }

  if (paySummaryFlightMeta) {
    paySummaryFlightMeta.innerHTML = `
      <div class="flight-name">${outboundFlight.airline || 'AeroVista'} (${outboundFlight.flightNumber})</div>
      <div class="route-text">${outboundFlight.sourceCity} (${outboundFlight.sourceCode}) → ${outboundFlight.destCity} (${outboundFlight.destCode})</div>
      <div class="sub-meta">Dep: ${outboundFlight.departureTime} | Arr: ${outboundFlight.arrivalTime} | Class: ${cabinClass}</div>
      <div class="sub-meta">Travel Date: ${travelDate}</div>
      ${isRoundTrip ? `<div class="sub-meta" style="margin-top:4px; color:var(--color-gold-light);">Round Trip Reservation Protected</div>` : ''}
    `;
  }

  if (paySummarySeatList) {
    paySummarySeatList.innerHTML = '';
    passengersList.forEach((p, idx) => {
      const outSeat = p.seat_number || (p.seatAllocation && p.seatAllocation.outbound && p.seatAllocation.outbound.code) || (p.outboundSeat && p.outboundSeat.code) || 'Assigned';
      const catLabel = p.cabin_class || (p.seatAllocation && p.seatAllocation.outbound && p.seatAllocation.outbound.categoryLabel) || (p.outboundSeat && p.outboundSeat.categoryLabel) || 'Standard';
      const name = p.full_name || p.fullName || p.name || `Passenger ${idx + 1}`;

      const row = document.createElement('div');
      row.className = 'passenger-seat-item';
      row.innerHTML = `
        <span class="p-seat-name">${name}</span>
        <span class="p-seat-pill">Seat ${outSeat} (${catLabel})</span>
      `;
      paySummarySeatList.appendChild(row);
    });
  }

  if (payTicketFareVal) payTicketFareVal.textContent = payableAmountFormatted;
  if (paySeatChargesVal) paySeatChargesVal.textContent = 'Included';
  if (payTotalAmountVal) payTotalAmountVal.textContent = payableAmountFormatted;
  if (btnPayNowLabel) btnPayNowLabel.textContent = `Pay Now (${payableAmountFormatted})`;
  if (successAmountText) successAmountText.textContent = payableAmountFormatted;

  // ==========================================================================
  // 5. Payment Method Switching (Credit Card / Debit Card / UPI)
  // ==========================================================================
  function setPaymentMethod(method) {
    activeMethod = method;
    [tabCredit, tabDebit, tabUPI].forEach(btn => {
      if (btn) btn.classList.toggle('is-active', btn.getAttribute('data-method') === method);
    });

    if (method === 'upi') {
      if (cardFields) cardFields.style.display = 'none';
      if (cardPreview) cardPreview.style.display = 'none';
      if (upiFields) upiFields.style.display = 'block';
    } else {
      if (cardFields) cardFields.style.display = 'block';
      if (cardPreview) cardPreview.style.display = 'block';
      if (upiFields) upiFields.style.display = 'none';
      if (previewCardType) {
        previewCardType.textContent = method === 'debit' ? 'AEROVISTA DEBIT' : 'AEROVISTA ELITE';
      }
    }
  }

  if (tabCredit) tabCredit.addEventListener('click', () => setPaymentMethod('credit'));
  if (tabDebit) tabDebit.addEventListener('click', () => setPaymentMethod('debit'));
  if (tabUPI) tabUPI.addEventListener('click', () => setPaymentMethod('upi'));

  // Pre-fill primary passenger name on card
  const primaryName = passengersList[0] ? (passengersList[0].full_name || passengersList[0].fullName) : '';
  if (primaryName && cardHolderName) {
    cardHolderName.value = primaryName;
    if (previewCardHolder) previewCardHolder.textContent = primaryName.toUpperCase();
  }

  if (cardHolderName) {
    cardHolderName.addEventListener('input', () => {
      const val = cardHolderName.value.trim();
      if (previewCardHolder) previewCardHolder.textContent = val ? val.toUpperCase() : 'VALUED PASSENGER';
    });
  }

  if (cardNumber) {
    cardNumber.addEventListener('input', (e) => {
      let val = e.target.value.replace(/\D/g, '').substring(0, 16);
      let formatted = val.match(/.{1,4}/g)?.join(' ') || val;
      e.target.value = formatted;
      if (previewCardNumber) previewCardNumber.textContent = formatted || '•••• •••• •••• ••••';
    });
  }

  if (cardExpiry) {
    cardExpiry.addEventListener('input', (e) => {
      let val = e.target.value.replace(/\D/g, '').substring(0, 4);
      if (val.length >= 2) {
        val = val.substring(0, 2) + '/' + val.substring(2);
      }
      e.target.value = val;
      if (previewCardExpiry) previewCardExpiry.textContent = val || 'MM/YY';
    });
  }

  // ==========================================================================
  // 6. Form Validation
  // ==========================================================================
  function setError(inputEl, errorEl, msg) {
    if (inputEl) inputEl.classList.add('has-error');
    if (errorEl) {
      errorEl.textContent = msg;
      errorEl.classList.add('visible');
    }
  }

  function clearError(inputEl, errorEl) {
    if (inputEl) inputEl.classList.remove('has-error');
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.remove('visible');
    }
  }

  [cardHolderName, cardNumber, cardExpiry, cardCvv, upiId].forEach(input => {
    if (input) {
      input.addEventListener('input', () => {
        const err = document.getElementById(`${input.id}Error`);
        clearError(input, err);
      });
    }
  });

  function validatePaymentForm() {
    let isValid = true;

    if (activeMethod === 'credit' || activeMethod === 'debit') {
      const holderVal = cardHolderName ? cardHolderName.value.trim() : '';
      const holderErr = document.getElementById('cardHolderNameError');
      if (!holderVal || holderVal.length < 3) {
        setError(cardHolderName, holderErr, 'Please enter the cardholder name (min 3 characters).');
        isValid = false;
      } else {
        clearError(cardHolderName, holderErr);
      }

      const numVal = cardNumber ? cardNumber.value.replace(/\s/g, '') : '';
      const numErr = document.getElementById('cardNumberError');
      if (!numVal || numVal.length !== 16 || !/^\d{16}$/.test(numVal)) {
        setError(cardNumber, numErr, 'Please enter a valid 16-digit card number.');
        isValid = false;
      } else {
        clearError(cardNumber, numErr);
      }

      const expVal = cardExpiry ? cardExpiry.value.trim() : '';
      const expErr = document.getElementById('cardExpiryError');
      if (!expVal || !/^(0[1-9]|1[0-2])\/\d{2}$/.test(expVal)) {
        setError(cardExpiry, expErr, 'Please enter expiration date in MM/YY format.');
        isValid = false;
      } else {
        clearError(cardExpiry, expErr);
      }

      const cvvVal = cardCvv ? cardCvv.value.trim() : '';
      const cvvErr = document.getElementById('cardCvvError');
      if (!cvvVal || !/^\d{3,4}$/.test(cvvVal)) {
        setError(cardCvv, cvvErr, 'Please enter a valid 3 or 4 digit CVV/CVC.');
        isValid = false;
      } else {
        clearError(cardCvv, cvvErr);
      }
    } else if (activeMethod === 'upi') {
      const upiVal = upiId ? upiId.value.trim() : '';
      const upiErr = document.getElementById('upiIdError');
      if (!upiVal || !/^[a-zA-Z0-9.\-_]{2,}@[a-zA-Z]{2,}$/.test(upiVal)) {
        setError(upiId, upiErr, 'Please enter a valid UPI ID (e.g. username@bank).');
        isValid = false;
      } else {
        clearError(upiId, upiErr);
      }
    }

    return isValid;
  }

  // ==========================================================================
  // 7. Payment Execution & Server Processing
  // ==========================================================================
  if (btnPayNow) {
    btnPayNow.addEventListener('click', async () => {
      if (!validatePaymentForm()) return;

      if (!outboundPnr) {
        alert('No booking reference found to process payment. Please select flights first.');
        return;
      }

      btnPayNow.disabled = true;
      if (processingModal) processingModal.classList.add('is-active');

      const outcome = simulationOutcome ? simulationOutcome.value : 'success';
      const pnrsList = returnPnr ? [outboundPnr, returnPnr] : [outboundPnr];

      const payload = {
        pnr: outboundPnr,
        pnrs: pnrsList,
        payment_method: activeMethod === 'upi' ? 'UPI' : (activeMethod === 'debit' ? 'Debit Card' : 'Credit Card'),
        simulation_outcome: outcome
      };

      try {
        const response = await fetch('/api/payments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json().catch(() => ({}));

        if (processingModal) processingModal.classList.remove('is-active');
        btnPayNow.disabled = false;

        if (response.ok && data.status === 'success') {
          // Successful transaction confirmed by server
          if (holdTimerInterval) clearInterval(holdTimerInterval);

          const confirmedPayload = {
            ...manifest,
            pnr: data.primary_pnr || outboundPnr,
            returnPnr: returnPnr || null,
            bookingStatus: 'Confirmed',
            paymentDetails: {
              method: payload.payment_method,
              amountPaid: data.amount_paid,
              amountPaidFormatted: formatShortINR(data.amount_paid),
              transactionId: data.transaction_reference,
              bookingReference: data.primary_pnr || outboundPnr,
              paidAt: new Date().toISOString(),
              status: 'CONFIRMED'
            }
          };

          try {
            sessionStorage.setItem('aerovista_confirmed_booking', JSON.stringify(confirmedPayload));
            localStorage.setItem('aerovista_confirmed_booking', JSON.stringify(confirmedPayload));
          } catch (e) {
            console.warn('Could not save confirmed booking locally', e);
          }

          if (successAmountText) successAmountText.textContent = formatShortINR(data.amount_paid);

          if (btnProceedConfirmation) {
            btnProceedConfirmation.onclick = () => {
              window.location.href = `booking-confirmation.html?pnr=${encodeURIComponent(data.primary_pnr || outboundPnr)}${returnPnr ? '&return_pnr=' + encodeURIComponent(returnPnr) : ''}`;
            };
          }

          if (successModal) successModal.classList.add('is-active');

        } else {
          // Declined or Failed Payment (allows safe retry on existing pending booking)
          const errorMsg = data.message || 'Your bank or card issuer declined the transaction (Code: AV_ERR_502). No charges were deducted.';
          if (failureReasonText) failureReasonText.textContent = errorMsg;
          if (failureModal) failureModal.classList.add('is-active');
        }

      } catch (err) {
        console.error('Error during payment processing:', err);
        if (processingModal) processingModal.classList.remove('is-active');
        btnPayNow.disabled = false;
        if (failureReasonText) {
          failureReasonText.textContent = 'A network error occurred while communicating with the payment processor. Please verify your connection and try again.';
        }
        if (failureModal) failureModal.classList.add('is-active');
      }
    });
  }

  if (btnRetryPayment) {
    btnRetryPayment.addEventListener('click', () => {
      if (failureModal) failureModal.classList.remove('is-active');
      if (btnPayNow) btnPayNow.disabled = false;
    });
  }

  if (btnProceedConfirmation) {
    btnProceedConfirmation.addEventListener('click', () => {
      window.location.href = `booking-confirmation.html?pnr=${encodeURIComponent(outboundPnr)}${returnPnr ? '&return_pnr=' + encodeURIComponent(returnPnr) : ''}`;
    });
  }

});
