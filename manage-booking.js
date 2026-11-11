/**
 * AeroVista Airlines – Step 10: Manage Booking Logic
 * Handles booking lookup by PNR and Passenger Last Name.
 * Retrieves and validates the confirmed booking from session/local storage.
 * Synchronizes with Booking Confirmation and enforces security checks.
 */

document.addEventListener('DOMContentLoaded', () => {

  // Form & Input elements
  const manageLookupForm = document.getElementById('manageLookupForm');
  const lookupPnrInput = document.getElementById('lookupPnr');
  const lookupLastNameInput = document.getElementById('lookupLastName');
  const lookupPnrError = document.getElementById('lookupPnrError');
  const lookupLastNameError = document.getElementById('lookupLastNameError');
  const lookupErrorMessage = document.getElementById('lookupErrorMessage');

  // Result display elements
  const bookingResultContainer = document.getElementById('bookingResultContainer');
  const resStatusBadge = document.getElementById('resStatusBadge');
  const resPnrDisplay = document.getElementById('resPnrDisplay');
  const resFlightNumber = document.getElementById('resFlightNumber');
  const resRoute = document.getElementById('resRoute');
  const resDeparture = document.getElementById('resDeparture');
  const resCabin = document.getElementById('resCabin');
  const resPassengersTableBody = document.getElementById('resPassengersTableBody');
  const resPaymentChannel = document.getElementById('resPaymentChannel');
  const resTxnId = document.getElementById('resTxnId');
  const resPaidDate = document.getElementById('resPaidDate');
  const resTotalPaidAmt = document.getElementById('resTotalPaidAmt');
  const btnProceedCancel = document.getElementById('btnProceedCancel');
  const btnViewETicket = document.getElementById('btnViewETicket');

  /**
   * Helper: Retrieve confirmed booking from sessionStorage or localStorage
   */
  function getStoredBooking() {
    try {
      let raw = sessionStorage.getItem('aerovista_confirmed_booking');
      if (!raw) {
        raw = localStorage.getItem('aerovista_confirmed_booking');
      }
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Error reading stored booking:', e);
    }
    return null;
  }

  /**
   * Helper: Format Currency
   */
  function formatINR(amount) {
    const num = Number(amount);
    if (isNaN(num)) return '₹0';
    return '₹' + num.toLocaleString('en-IN');
  }

  /**
   * Helper: Format Date String
   */
  function formatDate(isoOrDateStr) {
    if (!isoOrDateStr) return 'N/A';
    try {
      const d = new Date(isoOrDateStr);
      if (isNaN(d.getTime())) return isoOrDateStr;
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
      return isoOrDateStr;
    }
  }

  /**
   * Helper: Extract last name from full name
   */
  function getLastName(fullName) {
    if (!fullName) return '';
    const parts = fullName.trim().split(/\s+/);
    return parts[parts.length - 1].toLowerCase();
  }

  /**
   * Helper: Extract city name and 3-letter IATA code from airport string like "Dubai (DXB)"
   */
  function extractCityAndCode(text) {
    if (!text) return { city: '', code: '' };
    const m = text.match(/\(([A-Z]{3})\)/);
    const code = m ? m[1].toUpperCase() : (text.match(/\b([A-Z]{3})\b/) ? text.match(/\b([A-Z]{3})\b/)[1].toUpperCase() : text.substring(0, 3).toUpperCase());
    const city = text.replace(/\s*\([A-Z]{3}\).*/, '').trim() || text;
    return { city, code };
  }

  /**
   * Check if a given last name matches any passenger in the reservation
   */
  function checkLastNameMatch(passengers, searchLastName) {
    if (!searchLastName) return false;
    const cleanSearch = searchLastName.trim().toLowerCase();

    return passengers.some(p => {
      // Check direct lastName field if present
      if (p.lastName && p.lastName.trim().toLowerCase() === cleanSearch) {
        return true;
      }
      // Check full name last word or full match
      if (p.fullName) {
        const pFull = p.fullName.trim().toLowerCase();
        if (pFull === cleanSearch || pFull.includes(cleanSearch) || cleanSearch.includes(pFull)) return true;
        const pLastName = getLastName(p.fullName);
        if (pLastName === cleanSearch) return true;
        // Also check if full name contains the search string as a distinct token
        const tokens = pFull.split(/\s+/);
        if (tokens.includes(cleanSearch) || cleanSearch.split(/\s+/).some(t => tokens.includes(t))) return true;
      }
      return false;
    });
  }

  /**
   * Render retrieved booking details into the page
   */
  function renderBookingDetails(booking, lastName = '') {
    const flightBooking = booking.flightBooking || {};
    const outbound = flightBooking.outbound ? flightBooking.outbound.flight : {
      airline: 'AeroVista Airlines',
      flightNumber: 'AV-801',
      sourceCity: 'Dubai',
      sourceCode: 'DXB',
      destCity: 'Mumbai',
      destCode: 'BOM',
      departureTime: '13:10',
      arrivalTime: '02:35'
    };

    const travelDate = (flightBooking.searchQuery && flightBooking.searchQuery.departureDate)
      ? formatDate(flightBooking.searchQuery.departureDate)
      : '19 Nov 2026';

    const cabin = (flightBooking.outbound && flightBooking.outbound.cabin)
      ? (flightBooking.outbound.cabin.charAt(0).toUpperCase() + flightBooking.outbound.cabin.slice(1).toLowerCase() + ' Class')
      : 'Economy Class';

    const pnr = booking.paymentDetails ? booking.paymentDetails.bookingReference : 'AV-XXXXXX';
    const passengers = booking.passengers || [];
    const payment = booking.paymentDetails || {};
    const fareSummary = booking.fareSummary || {};

    // 1. Status & PNR
    const isCancelled = booking.bookingStatus === 'CANCELLED' || (booking.paymentDetails && booking.paymentDetails.status === 'CANCELLED');
    if (resStatusBadge) {
      if (isCancelled) {
        resStatusBadge.textContent = 'Status: Cancelled (Pending Refund)';
        resStatusBadge.style.background = 'rgba(217, 83, 79, 0.18)';
        resStatusBadge.style.color = '#FF6B6B';
        resStatusBadge.style.borderColor = 'rgba(217, 83, 79, 0.4)';
      } else {
        resStatusBadge.textContent = 'Status: Confirmed / Ticketed';
        resStatusBadge.style.background = 'rgba(46, 204, 113, 0.15)';
        resStatusBadge.style.color = '#2ECC71';
        resStatusBadge.style.borderColor = 'rgba(46, 204, 113, 0.35)';
      }
    }
    if (resPnrDisplay) {
      resPnrDisplay.textContent = pnr;
    }

    // 2. Flight Itinerary
    if (resFlightNumber) {
      resFlightNumber.textContent = `${outbound.airline || 'AeroVista Airlines'} ${outbound.flightNumber || 'AV-801'}`;
    }
    if (resRoute) {
      const src = outbound.sourceCode || (outbound.sourceCity ? outbound.sourceCity.substring(0, 3).toUpperCase() : 'DXB');
      const dst = outbound.destCode || (outbound.destCity ? outbound.destCity.substring(0, 3).toUpperCase() : 'BOM');
      resRoute.textContent = `${src} → ${dst} (${outbound.sourceCity || 'Dubai'} to ${outbound.destCity || 'Mumbai'})`;
    }
    if (resDeparture) {
      resDeparture.textContent = `${travelDate} • ${outbound.departureTime || '13:10'}`;
    }
    if (resCabin) {
      resCabin.textContent = cabin;
    }

    // 3. Passenger Manifest
    if (resPassengersTableBody) {
      resPassengersTableBody.innerHTML = '';
      passengers.forEach(p => {
        const row = document.createElement('tr');

        // Seat text
        let seatText = 'Not Assigned';
        if (p.seatAllocation && p.seatAllocation.outbound) {
          const seatObj = p.seatAllocation.outbound;
          seatText = `${seatObj.code || 'Assigned'} (${seatObj.categoryLabel || 'Seat'})`;
        } else if (p.seatNumber) {
          seatText = p.seatNumber;
        }

        const nameDisplay = `${p.title ? p.title + ' ' : ''}${p.fullName || 'Passenger'}${p.isPrimary ? ' <span style="font-size:0.75rem; color:var(--color-gold); font-weight:600;">(Lead)</span>' : ''}`;
        const idDisplay = `${p.idType || 'ID'}: ${p.idNumber || 'N/A'}`;
        const contactDisplay = p.contactEmail || p.contactPhone ? `${p.contactEmail || ''}${p.contactEmail && p.contactPhone ? '<br>' : ''}${p.contactPhone || ''}` : '—';

        row.innerHTML = `
          <td><strong>${nameDisplay}</strong></td>
          <td>${idDisplay}</td>
          <td>${p.nationality || 'N/A'}</td>
          <td><span style="display:inline-block; padding:3px 10px; border-radius:4px; background:rgba(198,166,107,0.15); border:1px solid rgba(198,166,107,0.3); color:var(--color-gold-light); font-weight:600; font-size:0.85rem;">${seatText}</span></td>
          <td style="font-size:0.82rem; color:var(--color-text-muted);">${contactDisplay}</td>
        `;
        resPassengersTableBody.appendChild(row);
      });
    }

    // 4. Payment Meta
    if (resPaymentChannel) {
      let methodText = payment.method || 'Credit / Debit Card';
      if (methodText === 'CREDIT') methodText = 'Credit Card';
      if (methodText === 'DEBIT') methodText = 'Debit Card';
      if (methodText === 'UPI') methodText = 'UPI Transfer';
      resPaymentChannel.textContent = methodText;
    }
    if (resTxnId) {
      resTxnId.textContent = payment.transactionId || 'TXN-PAID';
    }
    if (resPaidDate) {
      resPaidDate.textContent = payment.paidAt ? formatDate(payment.paidAt) : 'Confirmed';
    }
    if (resTotalPaidAmt) {
      const amt = payment.amountPaid || fareSummary.totalPayable || 0;
      resTotalPaidAmt.textContent = formatINR(amt);
    }

    // 5. Update Cancel Booking link with PNR parameter or update text if already cancelled
    if (btnProceedCancel) {
      const lastNameQuery = lastName ? `&lastName=${encodeURIComponent(lastName)}` : '';
      btnProceedCancel.href = `cancel-booking.html?pnr=${encodeURIComponent(pnr)}${lastNameQuery}`;
      if (isCancelled) {
        btnProceedCancel.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
          <span>View Cancellation Details</span>
        `;
      } else {
        btnProceedCancel.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
          <span>Cancel Booking (Step 11)</span>
        `;
      }
    }

    if (btnViewETicket) {
      btnViewETicket.href = `booking-confirmation.html?pnr=${encodeURIComponent(pnr)}`;
    }

    // Display the container smoothly
    if (bookingResultContainer) {
      bookingResultContainer.classList.add('is-visible');
      bookingResultContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  /**
   * Lookup Form Submission Handler
   */
  if (manageLookupForm) {
    manageLookupForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const pnrVal = (lookupPnrInput.value || '').trim();
      const lastNameVal = (lookupLastNameInput.value || '').trim();

      let hasError = false;

      // Validate PNR
      if (!pnrVal) {
        lookupPnrInput.classList.add('has-error');
        if (lookupPnrError) lookupPnrError.classList.add('is-visible');
        hasError = true;
      } else {
        lookupPnrInput.classList.remove('has-error');
        if (lookupPnrError) lookupPnrError.classList.remove('is-visible');
      }

      // Validate Last Name
      if (!lastNameVal) {
        lookupLastNameInput.classList.add('has-error');
        if (lookupLastNameError) lookupLastNameError.classList.add('is-visible');
        hasError = true;
      } else {
        lookupLastNameInput.classList.remove('has-error');
        if (lookupLastNameError) lookupLastNameError.classList.remove('is-visible');
      }

      // Hide results and clear general error
      if (lookupErrorMessage) {
        lookupErrorMessage.classList.remove('is-visible');
        lookupErrorMessage.textContent = '';
      }
      if (bookingResultContainer) {
        bookingResultContainer.classList.remove('is-visible');
      }

      if (hasError) {
        return;
      }

      // 1. Try to fetch verified booking from Flask Backend
      try {
        const response = await fetch(`/api/bookings/${encodeURIComponent(pnrVal)}?lastName=${encodeURIComponent(lastNameVal)}`);
        if (response.ok) {
          const data = await response.json();
          const b = data.booking;
          const flight = b.flight || {};
          const passengers = b.passengers || [];

          const srcInfo = extractCityAndCode(flight.source);
          const dstInfo = extractCityAndCode(flight.destination);
          const depParts = (flight.departure_time || '').split(' ');
          const depDate = depParts[0] || '';
          const depTime = depParts[1] ? depParts[1].substring(0, 5) : (flight.departure_time || '13:10');

          // Format backend booking for renderBookingDetails
          const formattedBooking = {
            pnr: b.pnr,
            bookingStatus: b.booking_status,
            flightBooking: {
              outbound: {
                flight: {
                  airline: flight.airline || 'AeroVista Airlines',
                  flightNumber: flight.flight_number || 'AV-801',
                  sourceCity: srcInfo.city || flight.source || 'Dubai',
                  sourceCode: srcInfo.code || 'DXB',
                  destCity: dstInfo.city || flight.destination || 'Mumbai',
                  destCode: dstInfo.code || 'BOM',
                  departureTime: depTime,
                  travelDate: depDate
                },
                cabin: (passengers[0] && passengers[0].cabin_class) ? (passengers[0].cabin_class + ' Class') : 'Economy Class'
              },
              searchQuery: {
                departureDate: depDate
              }
            },
            passengers: passengers.map((p, idx) => ({
              fullName: p.full_name,
              nationality: p.nationality,
              idType: p.identification_type,
              idNumber: p.identification_number,
              contactEmail: p.contact_email,
              contactPhone: p.contact_phone,
              seatNumber: p.seat_number,
              cabinClass: p.cabin_class,
              isPrimary: idx === 0,
              seatAllocation: {
                outbound: {
                  code: p.seat_number || 'Assigned',
                  categoryLabel: p.cabin_class || 'Standard'
                }
              }
            })),
            paymentDetails: {
              method: b.payment ? b.payment.payment_method : 'Credit Card',
              amountPaid: b.payment ? b.payment.amount : b.total_amount,
              transactionId: b.payment ? b.payment.transaction_reference : 'TXN-CONFIRMED',
              bookingReference: b.pnr,
              status: b.booking_status === 'Confirmed' ? 'CONFIRMED' : (b.booking_status === 'Cancelled' ? 'CANCELLED' : b.booking_status),
              paidAt: b.payment ? b.payment.payment_date : b.booking_date
            },
            fareSummary: {
              totalPayable: b.total_amount
            }
          };

          renderBookingDetails(formattedBooking, lastNameVal);
          return;
        } else {
          const errData = await response.json().catch(() => ({}));
          // If backend reports not found or mismatch, check stored fallback
          const storedBooking = getStoredBooking();
          if (storedBooking && storedBooking.paymentDetails && (storedBooking.paymentDetails.bookingReference || '').toUpperCase() === pnrVal.toUpperCase()) {
            const passengers = storedBooking.passengers || [];
            if (checkLastNameMatch(passengers, lastNameVal)) {
              renderBookingDetails(storedBooking, lastNameVal);
              return;
            }
          }
          if (lookupErrorMessage) {
            lookupErrorMessage.textContent = errData.message || `No booking found for Reference "${pnrVal.toUpperCase()}". Please verify the PNR or passenger last name.`;
            lookupErrorMessage.classList.add('is-visible');
          }
          return;
        }
      } catch (netErr) {
        console.warn('Network error during booking lookup, falling back to local storage:', netErr);
      }

      // 2. Fallback to confirmed booking in session/local storage
      const storedBooking = getStoredBooking();

      const isBookingActiveOrCancelled = storedBooking && storedBooking.paymentDetails && (storedBooking.paymentDetails.status === 'CONFIRMED' || storedBooking.paymentDetails.status === 'CANCELLED' || storedBooking.bookingStatus === 'CANCELLED');

      if (!isBookingActiveOrCancelled) {
        if (lookupErrorMessage) {
          lookupErrorMessage.textContent = `No active or confirmed booking found for Reference "${pnrVal.toUpperCase()}". Please verify the PNR or complete payment first.`;
          lookupErrorMessage.classList.add('is-visible');
        }
        return;
      }

      const bookingPnr = (storedBooking.paymentDetails.bookingReference || '').trim().toUpperCase();
      const inputPnr = pnrVal.toUpperCase();

      if (bookingPnr !== inputPnr) {
        if (lookupErrorMessage) {
          lookupErrorMessage.textContent = `No booking found matching Booking Reference "${pnrVal.toUpperCase()}". Please verify the booking code on your e-ticket.`;
          lookupErrorMessage.classList.add('is-visible');
        }
        return;
      }

      const passengers = storedBooking.passengers || [];
      const isLastNameMatch = checkLastNameMatch(passengers, lastNameVal);

      if (!isLastNameMatch) {
        if (lookupErrorMessage) {
          lookupErrorMessage.textContent = `The passenger last name "${lastNameVal}" does not match the passenger manifest for booking reference "${bookingPnr}". Please verify spelling and try again.`;
          lookupErrorMessage.classList.add('is-visible');
        }
        return;
      }

      renderBookingDetails(storedBooking, lastNameVal);
    });
  }

  // Clear validation styling upon typing
  if (lookupPnrInput) {
    lookupPnrInput.addEventListener('input', () => {
      lookupPnrInput.classList.remove('has-error');
      if (lookupPnrError) lookupPnrError.classList.remove('is-visible');
      if (lookupErrorMessage) lookupErrorMessage.classList.remove('is-visible');
    });
  }

  if (lookupLastNameInput) {
    lookupLastNameInput.addEventListener('input', () => {
      lookupLastNameInput.classList.remove('has-error');
      if (lookupLastNameError) lookupLastNameError.classList.remove('is-visible');
      if (lookupErrorMessage) lookupErrorMessage.classList.remove('is-visible');
    });
  }

  // Check URL parameters (e.g. ?pnr=AV-123456&lastName=Wright) for direct navigation
  const urlParams = new URLSearchParams(window.location.search);
  const pnrParam = urlParams.get('pnr');
  const lastNameParam = urlParams.get('lastName');

  if (pnrParam && lookupPnrInput) {
    lookupPnrInput.value = pnrParam.trim().toUpperCase();
  }
  if (lastNameParam && lookupLastNameInput) {
    lookupLastNameInput.value = lastNameParam.trim();
  }
  if (pnrParam && lastNameParam && manageLookupForm) {
    // Auto-trigger lookup if both query params are provided
    manageLookupForm.dispatchEvent(new Event('submit'));
  }

});

