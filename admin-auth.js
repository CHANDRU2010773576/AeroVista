/**
 * AeroVista Airlines – Admin Authentication & Setup Logic
 * Handles:
 * 1. GET /api/admin/setup-status to dynamically toggle between Setup Form and Login Form
 * 2. POST /api/admin/initialize for first-time administrator account creation
 * 3. POST /api/admin/login for administrator authentication
 * 4. Automatic session establishment and redirect to admin-dashboard.html
 */

document.addEventListener('DOMContentLoaded', async () => {
  const alertBox = document.getElementById('adminLoginAlert');
  const adminLoginForm = document.getElementById('adminLoginForm');
  const adminSetupForm = document.getElementById('adminSetupForm');
  const heading = document.getElementById('adminLoginHeading');

  function showAlert(msg, isError = true) {
    if (!alertBox) return;
    alertBox.className = `auth-alert ${isError ? 'alert-error' : 'alert-success'}`;
    alertBox.textContent = msg;
    alertBox.style.display = 'flex';
  }

  function hideAlert() {
    if (!alertBox) return;
    alertBox.style.display = 'none';
    alertBox.textContent = '';
  }

  function setFieldValidation(input, errorEl, msg) {
    if (errorEl) {
      errorEl.textContent = msg || '';
      if (msg) errorEl.classList.add('visible');
      else errorEl.classList.remove('visible');
    }
    if (input) {
      const wrapper = input.closest('.auth-input-wrapper');
      if (wrapper) {
        if (msg) wrapper.classList.add('has-error');
        else wrapper.classList.remove('has-error');
      }
    }
  }

  // 1. Check Setup Status
  try {
    const res = await fetch('/api/admin/setup-status', {
      headers: { 'Accept': 'application/json' },
      credentials: 'same-origin'
    });
    const statusData = await res.json().catch(() => ({}));

    if (res.ok && statusData.setup_required) {
      // First-time setup required
      if (adminLoginForm) adminLoginForm.style.display = 'none';
      if (adminSetupForm) adminSetupForm.style.display = 'block';
      if (heading) heading.textContent = 'Initialize Administrator';
    } else {
      // Admin accounts already exist
      if (adminSetupForm) adminSetupForm.style.display = 'none';
      if (adminLoginForm) adminLoginForm.style.display = 'block';
      if (heading) heading.textContent = 'Administrator Login';

      // Check if already authenticated
      const sessRes = await fetch('/api/admin/session', {
        headers: { 'Accept': 'application/json' },
        credentials: 'same-origin'
      });
      if (sessRes.ok) {
        window.location.href = 'admin-dashboard.html';
        return;
      }
    }
  } catch (err) {
    console.warn('Could not query admin setup status:', err);
  }

  // 2. Setup Form Submission
  if (adminSetupForm) {
    const usernameInput = document.getElementById('setupUsername');
    const passwordInput = document.getElementById('setupPassword');
    const confirmInput = document.getElementById('setupConfirmPassword');
    const errUsername = document.getElementById('setupUsernameError');
    const errPassword = document.getElementById('setupPasswordError');
    const errConfirm = document.getElementById('setupConfirmPasswordError');
    const btnSubmit = document.getElementById('btnAdminSetupSubmit');

    [usernameInput, passwordInput, confirmInput].forEach(inp => {
      if (inp) {
        inp.addEventListener('input', () => {
          hideAlert();
          if (inp === usernameInput) setFieldValidation(usernameInput, errUsername, '');
          if (inp === passwordInput) setFieldValidation(passwordInput, errPassword, '');
          if (inp === confirmInput) setFieldValidation(confirmInput, errConfirm, '');
        });
      }
    });

    adminSetupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert();

      const username = (usernameInput.value || '').trim();
      const password = passwordInput.value || '';
      const confirmPassword = confirmInput.value || '';

      let valid = true;
      if (!username) {
        setFieldValidation(usernameInput, errUsername, 'Admin username is required.');
        valid = false;
      }

      if (!password) {
        setFieldValidation(passwordInput, errPassword, 'Admin password is required.');
        valid = false;
      } else if (password.length < 8) {
        setFieldValidation(passwordInput, errPassword, 'Password must be at least 8 characters long.');
        valid = false;
      }

      if (!confirmPassword) {
        setFieldValidation(confirmInput, errConfirm, 'Please confirm the admin password.');
        valid = false;
      } else if (password && password !== confirmPassword) {
        setFieldValidation(confirmInput, errConfirm, 'Passwords do not match.');
        valid = false;
      }

      if (!valid) return;

      const origBtn = btnSubmit ? btnSubmit.innerHTML : '';
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `<span>Initializing Administrator...</span>`;
      }

      try {
        const resp = await fetch('/api/admin/initialize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          credentials: 'same-origin',
          body: JSON.stringify({
            username: username,
            password: password,
            confirmPassword: confirmPassword
          })
        });

        const data = await resp.json().catch(() => ({}));

        if (resp.ok && data.status === 'success') {
          showAlert(`✓ ${data.message || 'Administrator account initialized.'} Redirecting to dashboard...`, false);
          setTimeout(() => {
            window.location.href = 'admin-dashboard.html';
          }, 1000);
        } else {
          showAlert(data.message || 'Initialization failed. An administrator account may already exist.', true);
          if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = origBtn;
          }
        }
      } catch (err) {
        console.error('Admin initialization network error:', err);
        showAlert('Could not connect to the operations server. Please try again.', true);
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = origBtn;
        }
      }
    });
  }

  // 3. Login Form Submission
  if (adminLoginForm) {
    const adminEmail = document.getElementById('adminEmail');
    const adminPassword = document.getElementById('adminPassword');
    const emailError = document.getElementById('adminEmailError');
    const passwordError = document.getElementById('adminPasswordError');
    const btnSubmit = document.getElementById('btnAdminLoginSubmit');

    [adminEmail, adminPassword].forEach(inp => {
      if (inp) {
        inp.addEventListener('input', () => {
          hideAlert();
          if (inp === adminEmail) setFieldValidation(adminEmail, emailError, '');
          if (inp === adminPassword) setFieldValidation(adminPassword, passwordError, '');
        });
      }
    });

    adminLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert();

      const usernameVal = (adminEmail.value || '').trim();
      const passVal = adminPassword.value || '';

      let valid = true;
      if (!usernameVal) {
        setFieldValidation(adminEmail, emailError, 'Admin username is required.');
        valid = false;
      }
      if (!passVal) {
        setFieldValidation(adminPassword, passwordError, 'Password is required.');
        valid = false;
      }

      if (!valid) return;

      const origBtn = btnSubmit ? btnSubmit.innerHTML : '';
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `<span>Signing In...</span>`;
      }

      try {
        const resp = await fetch('/api/admin/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          credentials: 'same-origin',
          body: JSON.stringify({
            username: usernameVal,
            password: passVal
          })
        });

        const data = await resp.json().catch(() => ({}));

        if (resp.ok && data.status === 'success') {
          showAlert(`✓ Authentication verified. Redirecting to Flight Operations Dashboard...`, false);
          setTimeout(() => {
            window.location.href = 'admin-dashboard.html';
          }, 800);
        } else {
          showAlert(data.message || 'Invalid administrator username or password.', true);
          if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = origBtn;
          }
        }
      } catch (err) {
        console.error('Admin login network error:', err);
        showAlert('Could not connect to the operations server. Please check connection.', true);
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = origBtn;
        }
      }
    });
  }
});

