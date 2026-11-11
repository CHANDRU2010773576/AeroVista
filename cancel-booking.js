/**
 * AeroVista Airlines – Step 11: Cancel Booking Logic
 * Connects directly to backend API (POST /api/bookings/<pnr>/cancel)
 * Requirements:
 * 1. Retrieve the actual booking using PNR from query parameter or stored booking.
 * 2. Display summary: PNR, Passenger names, Flight, Route, Date, Seats, Amount Paid, Booking Status.
 * 3. Display demonstrative cancellation policy and simulated refund notice.
 * 4. Add Cancel Booking button with confirmation dialog.
 * 5. Update booking status to Cancelled and refund status to Refunded/Simulated Refund.
 * 6. Release selected seats in database and local cache so seat availability updates persistently.
 * 7. Prevent cancelled booking from being cancelled again.
 * 8. Synchronize status across Manage Booking and Booking Confirmation.
 */

document.addEventListener('DOMContentLoaded', async () => {

  // DOM Elements
  const noBookingStateCard = document.getElementById('noBookingStateCard');
  const cancelMainContent = document.getElementById('cancelMainContent');
  const cancelledSuccessCard = document.getElementById('cancelledSuccessCard');
  const cancelledPnrDisplay = document.getElementById('cancelledPnrDisplay');

  // Summary elements
  const sumPnr = document.getElementById('sumPnr');
  const sumStatusPill = document.getElementById('sumStatusPill');
  const sumFlight = document.getElementById('sumFlight');
  const sumRoute = document.getElementById('sumRoute');
  const sumDeparture = document.getElementById('sumDeparture');
  const sumTotalPaid = document.getElementById('sumTotalPaid');
  const passengersManifestContainer = document.getElementById('passengersManifestContainer');

  // Policy & Refund
  const refundEstimateAmount = document.getElementById('refundEstimateAmount');
  const refundStatusLabel = document.getElementById('refundStatusLabel');

  // Buttons & Modals
  const btnTriggerCancelModal = document.getElementById('btnTriggerCancelModal');
  const confirmCancelModal = document.getElementById('confirmCancelModal');
  const btnDismissCancelModal = document.getElementById('btnDismissCancelModal');
  const btnConfirmFinalCancellation = document.getElementById('btnConfirmFinalCancellation');
  const modalPnrConfirm = document.getElementById('modalPnrConfirm');
  const btnCancelGoBack = document.getElementById('btnCancelGoBack');
  const navReturnManage = document.getElementById('navReturnManage');

  // ==========================================================================
  // 1. Ingest Booking
  // ==========================================================================
  function getStoredBooking() {
    try {
      let raw = localStorage.getItem('aerovista_confirmed_booking');
      if (!raw) {
        raw = sessionStorage.getItem('aerovista_confirmed_booking');
      }
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Error reading booking storage:', e);
    }
    return null;
  }

  function saveStoredBooking(booking) {
    try {
      const serialized = JSON.stringify(booking);
      localStorage.setItem('aerovista_confirmed_booking', serialized);
      sessionStorage.setItem('aerovista_confirmed_booking', serialized);
    } catch (e) {
      console.warn('Error saving updated booking:', e);
    }
  }

  function formatINR(amount) {
    const num = Number(amount);
    if (isNaN(num)) return '₹0';
    return '₹' + num.toLocaleString('en-IN');
  }

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

  let booking = getStoredBooking();
  const urlParams = new URLSearchParams(window.location.search);
  const reqPnr = (urlParams.get('pnr') || '').trim().toUpperCase();
  const reqLastName = (urlParams.get('lastName') || '').trim();

  // Try to query backend for verified reservation
  if (reqPnr) {
    try {
      const res = await fetch(`/api/bookings/${encodeURIComponent(reqPnr)}?lastName=${encodeURIComponent(reqLastName)}`);
      if (res.ok) {
        const json = await res.json();
        const b = json.booking;
        const flight = b.flight || {};
        const passengers = b.passengers || [];

        booking = {
          pnr: b.pnr,
          bookingStatus: b.booking_status,
          flightBooking: {
            outbound: {
              flight: {
                airline: flight.airline || 'AeroVista Airlines',
                flightNumber: flight.flight_number || 'AV-801',
                sourceCity: flight.source || 'Dubai',
                sourceCode: flight.source ? flight.source.substring(0, 3).toUpperCase() : 'DXB',
                destCity: flight.destination || 'Mumbai',
                destCode: flight.destination ? flight.destination.substring(0, 3).toUpperCase() : 'BOM',
                departureTime: flight.departure_time ? flight.departure_time.split(' ')[1] : '13:10',
                travelDate: flight.departure_time ? flight.departure_time.split(' ')[0] : ''
              },
              cabin: (passengers[0] && passengers[0].cabin_class) || 'Economy'
            },
            searchQuery: {
              departureDate: flight.departure_time ? flight.departure_time.split(' ')[0] : ''
            }
          },
          passengers: passengers.map(p => ({
            fullName: p.full_name,
            nationality: p.nationality,
            idType: p.identification_type,
            idNumber: p.identification_number,
            contactEmail: p.contact_email,
            contactPhone: p.contact_phone,
            outboundSeat: { code: p.seat_number || 'Assigned', categoryLabel: p.cabin_class || 'Standard' }
          })),
          paymentDetails: {
            method: b.payment ? b.payment.payment_method : 'Credit Card',
            amountPaid: b.total_amount,
            transactionId: b.payment ? b.payment.transaction_reference : 'TXN-CONFIRMED',
            bookingReference: b.pnr,
            status: b.booking_status === 'Confirmed' ? 'CONFIRMED' : (b.booking_status === 'Cancelled' ? 'CANCELLED' : b.booking_status),
            paidAt: b.payment ? b.payment.payment_date : b.booking_date
          },
          fareSummary: {
            totalPayable: b.total_amount
          }
        };
      }
    } catch (e) {
      console.warn('Could not fetch booking from backend:', e);
    }
  }

  // If no booking exists
  if (!booking || !booking.paymentDetails) {
    if (noBookingStateCard) noBookingStateCard.style.display = 'block';
    if (cancelMainContent) cancelMainContent.style.display = 'none';
    return;
  }

  const bookingPnr = (booking.pnr || booking.paymentDetails.bookingReference || '').trim().toUpperCase();

  // If URL has a PNR parameter that does not match the active confirmed booking
  if (reqPnr && bookingPnr && reqPnr !== bookingPnr) {
    if (noBookingStateCard) {
      noBookingStateCard.style.display = 'block';
      noBookingStateCard.querySelector('p').textContent = `No active reservation found matching reference "${reqPnr}". Please verify through Manage Booking.`;
    }
    if (cancelMainContent) cancelMainContent.style.display = 'none';
    return;
  }

  if (noBookingStateCard) noBookingStateCard.style.display = 'none';
  if (cancelMainContent) cancelMainContent.style.display = 'block';

  // Synchronize return links to preserve PNR lookup
  if (btnCancelGoBack) {
    btnCancelGoBack.href = `manage-booking.html?pnr=${encodeURIComponent(bookingPnr)}&lastName=${encodeURIComponent(reqLastName)}`;
  }
  if (navReturnManage) {
    navReturnManage.href = `manage-booking.html?pnr=${encodeURIComponent(bookingPnr)}&lastName=${encodeURIComponent(reqLastName)}`;
  }

  // ==========================================================================
  // 2. Render Reservation Details
  // ==========================================================================
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

  let isAlreadyCancelled = booking.bookingStatus === 'Cancelled' || booking.bookingStatus === 'CANCELLED' || (booking.paymentDetails && booking.paymentDetails.status === 'CANCELLED');
  const passengers = booking.passengers || [];
  const payment = booking.paymentDetails || {};
  const totalPaid = payment.amountPaid || (booking.fareSummary ? booking.fareSummary.totalPayable : 0);

  // Fill summary
  if (sumPnr) sumPnr.textContent = bookingPnr;
  if (sumFlight) sumFlight.textContent = `${outbound.airline || 'AeroVista Airlines'} ${outbound.flightNumber || 'AV-801'}`;
  if (sumRoute) {
    const src = outbound.sourceCode || 'DXB';
    const dst = outbound.destCode || 'BOM';
    sumRoute.textContent = `${src} → ${dst} (${outbound.sourceCity || 'Dubai'} to ${outbound.destCity || 'Mumbai'})`;
  }
  if (sumDeparture) sumDeparture.textContent = `${travelDate} • ${outbound.departureTime || '13:10'}`;
  if (sumTotalPaid) sumTotalPaid.textContent = formatINR(totalPaid);
  if (refundEstimateAmount) refundEstimateAmount.textContent = formatINR(totalPaid);

  if (modalPnrConfirm) modalPnrConfirm.textContent = bookingPnr;

  // Render Passenger Manifest in summary card
  if (passengersManifestContainer) {
    passengersManifestContainer.innerHTML = '';
    passengers.forEach((p, idx) => {
      let seatCode = 'Assigned';
      let seatCategory = 'Standard';

      if (p.seatAllocation && p.seatAllocation.outbound) {
        seatCode = p.seatAllocation.outbound.code || 'Assigned';
        seatCategory = p.seatAllocation.outbound.categoryLabel || 'Standard';
      } else if (p.outboundSeat) {
        seatCode = p.outboundSeat.code || 'Assigned';
        seatCategory = p.outboundSeat.categoryLabel || 'Standard';
      }

      const item = document.createElement('div');
      item.className = 'passenger-manifest-item';
      item.innerHTML = `
        <div class="passenger-meta">
          <span class="passenger-name">${p.title ? p.title + ' ' : ''}${p.fullName || 'Passenger ' + (idx + 1)}</span>
          <span class="passenger-doc">${p.idType || 'ID'}: ${p.idNumber || 'Verified Document'}</span>
        </div>
        <div class="passenger-seat-badge">
          Seat ${seatCode} (${seatCategory})
        </div>
      `;
      passengersManifestContainer.appendChild(item);
    });
  }

  function updateStatusDisplay(cancelled) {
    if (cancelled) {
      isAlreadyCancelled = true;
      if (sumStatusPill) {
        sumStatusPill.className = 'status-pill cancelled';
        sumStatusPill.textContent = 'Cancelled';
      }
      if (refundStatusLabel) {
        refundStatusLabel.textContent = 'Simulated Refund Processed';
        refundStatusLabel.style.color = '#FF6B6B';
      }
      if (btnTriggerCancelModal) {
        btnTriggerCancelModal.disabled = true;
        btnTriggerCancelModal.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>Already Cancelled</span>
        `;
      }
      if (cancelledSuccessCard) {
        cancelledSuccessCard.classList.add('is-visible');
        if (cancelledPnrDisplay) cancelledPnrDisplay.textContent = bookingPnr;
      }
    } else {
      if (sumStatusPill) {
        sumStatusPill.className = 'status-pill confirmed';
        sumStatusPill.textContent = 'Confirmed';
      }
      if (refundStatusLabel) {
        refundStatusLabel.textContent = 'Applicable on Cancellation';
        refundStatusLabel.style.color = '#2ECC71';
      }
      if (btnTriggerCancelModal) {
        btnTriggerCancelModal.disabled = false;
      }
      if (cancelledSuccessCard) {
        cancelledSuccessCard.classList.remove('is-visible');
      }
    }
  }

  updateStatusDisplay(isAlreadyCancelled);

  // ==========================================================================
  // 3. Modal Controls
  // ==========================================================================
  if (btnTriggerCancelModal) {
    btnTriggerCancelModal.addEventListener('click', () => {
      if (isAlreadyCancelled) return;
      if (confirmCancelModal) confirmCancelModal.classList.add('is-active');
    });
  }

  if (btnDismissCancelModal) {
    btnDismissCancelModal.addEventListener('click', () => {
      if (confirmCancelModal) confirmCancelModal.classList.remove('is-active');
    });
  }

  // Close modal on click outside card
  if (confirmCancelModal) {
    confirmCancelModal.addEventListener('click', (e) => {
      if (e.target === confirmCancelModal) {
        confirmCancelModal.classList.remove('is-active');
      }
    });
  }

  // ==========================================================================
  // 4. Confirm Cancellation Execution (Server-backed & transactional)
  // ==========================================================================
  if (btnConfirmFinalCancellation) {
    btnConfirmFinalCancellation.addEventListener('click', async () => {
      if (confirmCancelModal) confirmCancelModal.classList.remove('is-active');
      btnConfirmFinalCancellation.disabled = true;

      try {
        const response = await fetch(`/api/bookings/${encodeURIComponent(bookingPnr)}/cancel`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ lastName: reqLastName })
        });

        const data = await response.json().catch(() => ({}));

        if (response.ok && data.status === 'success') {
          // 1. Release assigned seats in local storage caches
          try {
            const releasedSeatCodes = data.released_seats || [];
            let globalReleasedSeats = [];
            try {
              const rawReleased = localStorage.getItem('aerovista_released_seats');
              if (rawReleased) globalReleasedSeats = JSON.parse(rawReleased);
            } catch (e) {}

            globalReleasedSeats = Array.from(new Set([...globalReleasedSeats, ...releasedSeatCodes]));
            localStorage.setItem('aerovista_released_seats', JSON.stringify(globalReleasedSeats));
          } catch (err) {
            console.warn('Error syncing local released seats cache:', err);
          }

          // 2. Update booking payload in storage
          booking.bookingStatus = 'Cancelled';
          booking.cancelledAt = new Date().toISOString();
          booking.refundStatus = data.refund_details ? data.refund_details.status : 'Refunded';
          booking.refundAmount = totalPaid;
          if (booking.paymentDetails) {
            booking.paymentDetails.status = 'CANCELLED';
            booking.paymentDetails.refundStatus = 'REFUNDED';
          }
          saveStoredBooking(booking);

          // 3. Update UI
          updateStatusDisplay(true);

          if (cancelledSuccessCard) {
            const desc = cancelledSuccessCard.querySelector('.cancelled-desc');
            if (desc && data.refund_details) {
              desc.innerHTML = `Your reservation <strong>${bookingPnr}</strong> has been successfully cancelled. All assigned seats have been released back into available airline inventory.<br><br><span style="color:var(--color-gold-light); font-weight:600;">Refund Status: ${data.refund_details.status}</span> — ${data.refund_details.message}`;
            }
            cancelledSuccessCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          return;

        } else {
          alert(data.message || 'Cancellation could not be completed. Please contact reservations support.');
          btnConfirmFinalCancellation.disabled = false;
        }

      } catch (err) {
        console.error('Cancellation network error:', err);
        alert('A network error occurred while communicating with the cancellation service.');
        btnConfirmFinalCancellation.disabled = false;
      }
    });
  }

});
