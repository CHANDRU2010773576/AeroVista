/**
 * AeroVista Airlines – Step 9: Booking Confirmation & E-Ticket Logic
 * Ingests and verifies confirmed booking from backend API (GET /api/bookings/<pnr>).
 * Enforces strict security check: never displays an official ticket unless the booking
 * is confirmed and paid in the backend database.
 */

document.addEventListener('DOMContentLoaded', async () => {

  const unconfirmedCard = document.getElementById('unconfirmedStateCard');
  const confirmedContent = document.getElementById('confirmedBookingContent');

  function showUnconfirmedState(customMessage) {
    if (unconfirmedCard) {
      unconfirmedCard.style.display = 'block';
      if (customMessage) {
        const desc = unconfirmedCard.querySelector('p');
        if (desc) desc.textContent = customMessage;
      }
    }
    if (confirmedContent) confirmedContent.style.display = 'none';
  }

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
  let pnr = (urlParams.get('pnr') || '').trim().toUpperCase();
  let returnPnr = (urlParams.get('return_pnr') || '').trim().toUpperCase();

  let localCache = null;
  try {
    const raw = sessionStorage.getItem('aerovista_confirmed_booking') || localStorage.getItem('aerovista_confirmed_booking');
    if (raw) localCache = JSON.parse(raw);
  } catch (e) {
    console.warn('Could not read local booking cache', e);
  }

  if (!pnr && localCache) {
    pnr = (localCache.pnr || (localCache.paymentDetails && localCache.paymentDetails.bookingReference) || '').trim().toUpperCase();
    if (!returnPnr && localCache.returnPnr) {
      returnPnr = localCache.returnPnr.trim().toUpperCase();
    }
  }

  if (!pnr) {
    try {
      const rawManifest = sessionStorage.getItem('aerovista_booking_manifest');
      if (rawManifest) {
        const manifestObj = JSON.parse(rawManifest);
        if (manifestObj.pnr) pnr = manifestObj.pnr.trim().toUpperCase();
        if (manifestObj.backendBookings && Array.isArray(manifestObj.backendBookings)) {
          if (manifestObj.backendBookings[0]) pnr = manifestObj.backendBookings[0].pnr.trim().toUpperCase();
          if (manifestObj.backendBookings[1]) returnPnr = manifestObj.backendBookings[1].pnr.trim().toUpperCase();
        }
      }
    } catch (e) {
      console.warn('Could not inspect manifest', e);
    }
  }

  // If still no PNR, unconfirmed state
  if (!pnr) {
    showUnconfirmedState('No booking reference was provided. Please complete flight selection and payment to obtain your official ticket.');
    return;
  }

  // ==========================================================================
  // 2. Fetch Verified Booking from Backend
  // ==========================================================================
  let bookingData = null;
  let returnBookingData = null;

  try {
    const queryUrl = `/api/bookings/${encodeURIComponent(pnr)}${returnPnr ? '?return_pnr=' + encodeURIComponent(returnPnr) : ''}`;
    const res = await fetch(queryUrl);

    if (res.status === 404) {
      showUnconfirmedState(`Booking reference ${pnr} was not found in the reservation system.`);
      return;
    }

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      showUnconfirmedState(errJson.message || `Unable to load reservation details for ${pnr}.`);
      return;
    }

    const json = await res.json();
    bookingData = json.booking;
    returnBookingData = json.return_booking || null;

  } catch (netErr) {
    console.error('Error fetching booking details:', netErr);
    showUnconfirmedState('A network error occurred while communicating with the reservation server. Please refresh.');
    return;
  }

  // Strict verification check: must be Confirmed and Paid
  if (!bookingData || bookingData.booking_status !== 'Confirmed' || bookingData.payment_status !== 'Paid') {
    const statusText = bookingData ? `Status is ${bookingData.booking_status} / Payment: ${bookingData.payment_status}` : 'Unconfirmed';
    showUnconfirmedState(`Reservation ${pnr} is not confirmed (${statusText}). Payment has not been cleared or transaction failed.`);
    return;
  }

  // Display confirmed content
  if (unconfirmedCard) unconfirmedCard.style.display = 'none';
  if (confirmedContent) confirmedContent.style.display = 'block';

  // ==========================================================================
  // 3. Populate Confirmed Ticket Details
  // ==========================================================================
  const flight = bookingData.flight || {};
  const passengers = bookingData.passengers || [];
  const payment = bookingData.payment || {};
  const travelDateFormatted = formatDisplayDate(flight.departure_time);
  const primaryPassengerClass = (passengers[0] && passengers[0].cabin_class) ? passengers[0].cabin_class.toUpperCase() : 'ECONOMY';

  // Elements
  const displayPnrCode = document.getElementById('displayPnrCode');
  const ticketHeaderPnr = document.getElementById('ticketHeaderPnr');
  const ticketOriginCode = document.getElementById('ticketOriginCode');
  const ticketOriginCity = document.getElementById('ticketOriginCity');
  const ticketDepTime = document.getElementById('ticketDepTime');
  const ticketDestCode = document.getElementById('ticketDestCode');
  const ticketDestCity = document.getElementById('ticketDestCity');
  const ticketArrTime = document.getElementById('ticketArrTime');
  const ticketDuration = document.getElementById('ticketDuration');
  const ticketFlightNumber = document.getElementById('ticketFlightNumber');
  const ticketTravelDate = document.getElementById('ticketTravelDate');
  const ticketCabinClass = document.getElementById('ticketCabinClass');
  const ticketAircraft = document.getElementById('ticketAircraft');
  const ticketTravelerCount = document.getElementById('ticketTravelerCount');
  const ticketPassengerTableBody = document.getElementById('ticketPassengerTableBody');

  const receiptMethod = document.getElementById('receiptMethod');
  const receiptTxn = document.getElementById('receiptTxn');
  const receiptDate = document.getElementById('receiptDate');
  const receiptTicketFare = document.getElementById('receiptTicketFare');
  const receiptSeatCharges = document.getElementById('receiptSeatCharges');
  const receiptTotalPaid = document.getElementById('receiptTotalPaid');

  const btnDownloadTicket = document.getElementById('btnDownloadTicket');
  const btnPrintTicket = document.getElementById('btnPrintTicket');

  // Hero & Header PNR
  if (displayPnrCode) displayPnrCode.textContent = bookingData.pnr;
  if (ticketHeaderPnr) ticketHeaderPnr.textContent = `PNR: ${bookingData.pnr}${returnBookingData ? ' / ' + returnBookingData.pnr : ''}`;

  // Outbound Flight Details
  if (ticketOriginCode) ticketOriginCode.textContent = flight.source ? flight.source.substring(0, 3).toUpperCase() : 'DXB';
  if (ticketOriginCity) ticketOriginCity.textContent = flight.source || 'Dubai';
  if (ticketDepTime) ticketDepTime.textContent = `${formatDisplayTime(flight.departure_time)} Departure`;

  if (ticketDestCode) ticketDestCode.textContent = flight.destination ? flight.destination.substring(0, 3).toUpperCase() : 'BOM';
  if (ticketDestCity) ticketDestCity.textContent = flight.destination || 'Mumbai';
  if (ticketArrTime) ticketArrTime.textContent = `${formatDisplayTime(flight.arrival_time)} Arrival`;

  if (ticketDuration) ticketDuration.textContent = flight.duration || 'Non-Stop';
  if (ticketFlightNumber) ticketFlightNumber.textContent = `${flight.airline || 'AeroVista'} • ${flight.flight_number}`;

  if (ticketTravelDate) ticketTravelDate.textContent = travelDateFormatted || 'Scheduled';
  if (ticketCabinClass) ticketCabinClass.textContent = `${primaryPassengerClass} CLASS`;
  if (ticketAircraft) ticketAircraft.textContent = flight.aircraft || 'Boeing 787-9 Dreamliner';
  if (ticketTravelerCount) ticketTravelerCount.textContent = `${passengers.length} Passenger${passengers.length > 1 ? 's' : ''}`;

  // Return Flight (Round Trip)
  const returnFlightCard = document.getElementById('returnFlightCard');
  if (returnBookingData && returnFlightCard) {
    const retFlight = returnBookingData.flight || {};
    returnFlightCard.style.display = 'flex';

    const ticketRetOriginCode = document.getElementById('ticketRetOriginCode');
    const ticketRetOriginCity = document.getElementById('ticketRetOriginCity');
    const ticketRetDepTime = document.getElementById('ticketRetDepTime');
    const ticketRetDestCode = document.getElementById('ticketRetDestCode');
    const ticketRetDestCity = document.getElementById('ticketRetDestCity');
    const ticketRetArrTime = document.getElementById('ticketRetArrTime');
    const ticketRetFlightNumber = document.getElementById('ticketRetFlightNumber');
    const ticketRetDuration = document.getElementById('ticketRetDuration');

    if (ticketRetOriginCode) ticketRetOriginCode.textContent = retFlight.source ? retFlight.source.substring(0, 3).toUpperCase() : 'BOM';
    if (ticketRetOriginCity) ticketRetOriginCity.textContent = retFlight.source || 'Mumbai';
    if (ticketRetDepTime) ticketRetDepTime.textContent = `${formatDisplayTime(retFlight.departure_time)} Departure`;

    if (ticketRetDestCode) ticketRetDestCode.textContent = retFlight.destination ? retFlight.destination.substring(0, 3).toUpperCase() : 'DXB';
    if (ticketRetDestCity) ticketRetDestCity.textContent = retFlight.destination || 'Dubai';
    if (ticketRetArrTime) ticketRetArrTime.textContent = `${formatDisplayTime(retFlight.arrival_time)} Arrival`;

    if (ticketRetFlightNumber) ticketRetFlightNumber.textContent = `${retFlight.airline || 'AeroVista'} • ${retFlight.flight_number}`;
    if (ticketRetDuration) ticketRetDuration.textContent = retFlight.duration || 'Return Leg';
  }

  // Passenger Manifest Table
  if (ticketPassengerTableBody) {
    ticketPassengerTableBody.innerHTML = '';
    passengers.forEach((p, idx) => {
      const assignedSeat = p.seat_number || 'Assigned';
      const cabin = p.cabin_class || primaryPassengerClass;
      const contact = (p.contact_email || p.contact_phone)
        ? `${p.contact_email || ''}${p.contact_email && p.contact_phone ? '<br>' : ''}${p.contact_phone || ''}`
        : 'Primary Passenger Contact';
      const idInfo = (p.identification_type && p.identification_number)
        ? `${p.identification_type}: ${p.identification_number}`
        : 'Verified Travel ID';

      // If round trip, check return seat
      let returnSeatStr = '';
      if (returnBookingData && returnBookingData.passengers && returnBookingData.passengers[idx]) {
        returnSeatStr = ` | Ret: Seat ${returnBookingData.passengers[idx].seat_number || 'Assigned'}`;
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <strong style="color:var(--color-gold-light);">${p.full_name}</strong>
          ${idx === 0 ? '<div style="font-size:0.75rem; color:var(--color-text-muted);">Lead Passenger</div>' : ''}
        </td>
        <td>${idInfo}</td>
        <td>${p.nationality || 'Verified'}</td>
        <td><span class="seat-code-pill">Seat ${assignedSeat} (${cabin})${returnSeatStr}</span></td>
        <td><span style="font-size:0.8rem; color:var(--color-text-muted);">${contact}</span></td>
      `;
      ticketPassengerTableBody.appendChild(tr);
    });
  }

  // Payment Receipt Block
  const totalPaid = bookingData.total_amount + (returnBookingData ? returnBookingData.total_amount : 0);
  if (receiptMethod) receiptMethod.textContent = payment.payment_method || 'Credit Card';
  if (receiptTxn) receiptTxn.textContent = payment.transaction_reference || 'TXN-CONFIRMED';
  if (receiptDate) {
    const rawDate = payment.payment_date || bookingData.booking_date;
    receiptDate.textContent = formatDisplayDate(rawDate) + ' ' + formatDisplayTime(rawDate);
  }
  if (receiptTicketFare) receiptTicketFare.textContent = formatShortINR(totalPaid);
  if (receiptSeatCharges) receiptSeatCharges.textContent = 'Included';
  if (receiptTotalPaid) receiptTotalPaid.textContent = formatShortINR(totalPaid);

  // Wire Download PDF E-Ticket Button
  if (btnDownloadTicket) {
    const ticketUrl = `/api/bookings/${encodeURIComponent(bookingData.pnr)}/ticket${returnBookingData ? '?return_pnr=' + encodeURIComponent(returnBookingData.pnr) : ''}`;
    btnDownloadTicket.href = ticketUrl;
    btnDownloadTicket.setAttribute('download', `AeroVista_ETicket_${bookingData.pnr}.pdf`);
  }

  // Wire Print Button
  if (btnPrintTicket) {
    btnPrintTicket.addEventListener('click', () => {
      window.print();
    });
  }

});
