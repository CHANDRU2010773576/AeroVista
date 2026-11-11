/**
 * AeroVista Airlines – Session & Profile Navigation Manager
 * Handles:
 * 1. Live authentication check via GET /api/session (Flask session is single source of truth)
 * 2. Dynamic rendering of Login/Register vs Profile Dropdown menu
 * 3. Profile dropdown toggling & outside-click handling
 * 4. Passenger Logout via POST /api/logout and redirect to index.html
 */

(function () {
  'use strict';

  // Prevent multiple initializations if loaded in multiple scripts
  if (window.__aerovista_session_initialized) return;
  window.__aerovista_session_initialized = true;

  /**
   * Fetches current session from Flask backend
   */
  async function checkSession() {
    try {
      const response = await fetch('/api/session', {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        credentials: 'same-origin'
      });
      if (!response.ok) {
        return null;
      }
      const data = await response.json();
      if (data && data.authenticated && data.user) {
        return data.user;
      }
      return null;
    } catch (err) {
      console.warn('Could not verify session with backend:', err);
      return null;
    }
  }

  /**
   * Dispatches logout request to backend
   */
  async function performLogout() {
    try {
      await fetch('/api/logout', {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        credentials: 'same-origin'
      });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      // Clear any legacy client-side user cache
      try {
        localStorage.removeItem('aerovista_user');
        sessionStorage.removeItem('aerovista_logged_user');
      } catch (e) {
        // ignore
      }
      // Redirect to index.html with logout notice
      window.location.href = 'index.html?logged_out=true';
    }
  }

  /**
   * Helper to get user initials
   */
  function getInitials(name) {
    if (!name) return 'AV';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  /**
   * Updates desktop and mobile navigation headers based on authentication state
   */
  function updateNavigationUI(user) {
    // 1. Desktop Nav Auth Groups (.nav-auth-group)
    const authGroups = document.querySelectorAll('.nav-auth-group');
    authGroups.forEach(group => {
      // Find mobile toggle button if nested inside the group
      const mobileToggle = group.querySelector('.mobile-toggle');

      if (user) {
        // Passenger is logged in: hide login/register and render profile menu
        const initials = getInitials(user.full_name);
        const firstName = user.full_name ? user.full_name.split(' ')[0] : 'Passenger';

        group.innerHTML = `
          <div class="user-profile-menu-container" id="userProfileMenuContainer">
            <button class="btn-profile-trigger" id="btnProfileTrigger" type="button" aria-expanded="false" aria-haspopup="true" aria-label="Passenger Profile Menu">
              <span class="profile-avatar-circle">${initials}</span>
              <span class="profile-user-name">${firstName}</span>
              <svg class="profile-chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
            <div class="profile-dropdown-menu" id="profileDropdownMenu" role="menu">
              <div class="profile-dropdown-header">
                <div class="profile-dropdown-name">${user.full_name || 'Passenger'}</div>
                <div class="profile-dropdown-email">${user.email || ''}</div>
              </div>
              <ul class="profile-dropdown-links">
                <li>
                  <a href="manage-booking.html" class="profile-dropdown-item" role="menuitem">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                      <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                    <span>My Bookings</span>
                  </a>
                </li>
                <li class="profile-dropdown-divider"></li>
                <li>
                  <button type="button" class="profile-dropdown-item profile-logout-btn" id="btnDropdownLogout" role="menuitem">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                      <polyline points="16 17 21 12 16 7"></polyline>
                      <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                    <span>Log Out</span>
                  </button>
                </li>
              </ul>
            </div>
          </div>
        `;

        if (mobileToggle) {
          group.appendChild(mobileToggle);
        }

        // Attach event listeners to newly created profile dropdown
        const triggerBtn = group.querySelector('#btnProfileTrigger');
        const container = group.querySelector('#userProfileMenuContainer');
        const logoutBtn = group.querySelector('#btnDropdownLogout');

        if (triggerBtn && container) {
          triggerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = container.classList.toggle('is-open');
            triggerBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
          });
        }

        if (logoutBtn) {
          logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            performLogout();
          });
        }
      } else {
        // Passenger is logged out: restore clean login & register buttons
        group.innerHTML = `
          <a href="login.html" class="btn-auth-outline" id="nav-login-btn">
            <svg class="icon-user" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
              stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            <span>Log In</span>
          </a>
          <a href="register.html" class="btn-auth-gold" id="nav-register-btn">Register</a>
        `;
        if (mobileToggle) {
          group.appendChild(mobileToggle);
        }
      }
    });

    // 2. Mobile Nav Panel (.mobile-nav-panel)
    const mobilePanel = document.getElementById('mobileNavPanel');
    if (mobilePanel) {
      // Find or create mobile auth container
      let mobileAuthSection = mobilePanel.querySelector('.mobile-auth-section');
      if (!mobileAuthSection) {
        // If divider exists, replace divider and everything after it
        const divider = mobilePanel.querySelector('.mobile-auth-divider');
        if (divider) {
          let sibling = divider.nextElementSibling;
          while (sibling) {
            const next = sibling.nextElementSibling;
            sibling.remove();
            sibling = next;
          }
          divider.remove();
        }
        mobileAuthSection = document.createElement('div');
        mobileAuthSection.className = 'mobile-auth-section';
        mobilePanel.appendChild(mobileAuthSection);
      }

      if (user) {
        const initials = getInitials(user.full_name);
        mobileAuthSection.innerHTML = `
          <div class="mobile-auth-divider" style="height: 1px; background: rgba(255,255,255,0.1); margin: 0.5rem 0;"></div>
          <div class="mobile-profile-card">
            <div class="mobile-profile-info">
              <span class="profile-avatar-circle">${initials}</span>
              <div>
                <div class="mobile-profile-name">${user.full_name || 'Passenger'}</div>
                <div class="mobile-profile-email">${user.email || ''}</div>
              </div>
            </div>
            <div class="mobile-profile-links">
              <a href="manage-booking.html" class="mobile-profile-link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px; color: var(--color-champagne);">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                </svg>
                <span>My Bookings</span>
              </a>
              <button type="button" class="mobile-profile-link mobile-logout-link" id="btnMobileLogout">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px; color: #FF7B7F;">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                <span>Log Out</span>
              </button>
            </div>
          </div>
        `;

        const mobileLogoutBtn = mobileAuthSection.querySelector('#btnMobileLogout');
        if (mobileLogoutBtn) {
          mobileLogoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            performLogout();
          });
        }
      } else {
        mobileAuthSection.innerHTML = `
          <div class="mobile-auth-divider" style="height: 1px; background: rgba(255,255,255,0.1); margin: 0.5rem 0;"></div>
          <a href="login.html" class="mobile-nav-link">Log In</a>
          <a href="register.html" class="mobile-nav-link mobile-btn-gold">Register</a>
        `;
      }
    }
  }

  // Close dropdown on outside click or Esc key
  document.addEventListener('click', (e) => {
    const containers = document.querySelectorAll('.user-profile-menu-container.is-open');
    containers.forEach(container => {
      if (!container.contains(e.target)) {
        container.classList.remove('is-open');
        const trigger = container.querySelector('.btn-profile-trigger');
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
      }
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const containers = document.querySelectorAll('.user-profile-menu-container.is-open');
      containers.forEach(container => {
        container.classList.remove('is-open');
        const trigger = container.querySelector('.btn-profile-trigger');
        if (trigger) {
          trigger.setAttribute('aria-expanded', 'false');
          trigger.focus();
        }
      });
    }
  });

  // Display optional logout confirmation toast/alert if redirected with ?logged_out=true
  function checkLogoutNotification() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('logged_out') === 'true') {
      // Remove query parameter without reload
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);

      // Show temporary elegant notification banner if on homepage
      const formAlert = document.getElementById('formAlertMessage') || document.getElementById('loginAlert');
      if (formAlert) {
        formAlert.className = 'form-alert alert-info auth-alert';
        formAlert.innerHTML = '✓ You have been logged out successfully.';
        formAlert.style.display = 'flex';
        setTimeout(() => {
          formAlert.style.display = 'none';
        }, 4000);
      }
    }
  }

  // Initialize on DOM ready
  document.addEventListener('DOMContentLoaded', async () => {
    checkLogoutNotification();
    const user = await checkSession();
    updateNavigationUI(user);
  });

  // Expose global session manager API for other modules if needed
  window.AeroVistaSession = {
    checkSession,
    performLogout,
    updateNavigationUI
  };
})();

