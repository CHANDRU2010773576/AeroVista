/**
 * AeroVista Airlines – Authentication Forms Logic (Login & Registration)
 * Frontend-only validation & UX interactions:
 * - Email format validation
 * - Mobile phone format validation
 * - Password matching verification
 * - Show/Hide password toggles
 * - Friendly error feedback without backend simulation
 */

document.addEventListener('DOMContentLoaded', () => {
  // ==========================================
  // 1. Password Visibility Toggles
  // ==========================================
  const toggleButtons = document.querySelectorAll('.btn-toggle-password');
  toggleButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = btn.getAttribute('data-target');
      const targetInput = document.getElementById(targetId);
      if (!targetInput) return;

      const isPassword = targetInput.type === 'password';
      targetInput.type = isPassword ? 'text' : 'password';

      // Switch icons
      const eyeIcon = btn.querySelector('.icon-eye');
      const eyeOffIcon = btn.querySelector('.icon-eye-off');
      if (eyeIcon && eyeOffIcon) {
        if (isPassword) {
          eyeIcon.style.display = 'none';
          eyeOffIcon.style.display = 'block';
          btn.setAttribute('aria-label', 'Hide password');
        } else {
          eyeIcon.style.display = 'block';
          eyeOffIcon.style.display = 'none';
          btn.setAttribute('aria-label', 'Show password');
        }
      }
    });
  });

  // Helper validation functions
  function isValidEmail(email) {
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return re.test(String(email).toLowerCase());
  }

  function isValidPhone(phone) {
    // Allows optional +, digits, spaces, hyphens, min 7 digits, max 16 digits
    const cleaned = phone.replace(/[\s-]/g, '');
    return /^\+?[0-9]{7,15}$/.test(cleaned);
  }

  function setError(inputElement, errorElement, message) {
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.classList.add('visible');
    }
    if (inputElement) {
      const wrapper = inputElement.closest('.auth-input-wrapper') || inputElement.closest('.auth-select-wrapper');
      if (wrapper) wrapper.classList.add('has-error');
    }
  }

  function clearError(inputElement, errorElement) {
    if (errorElement) {
      errorElement.textContent = '';
      errorElement.classList.remove('visible');
    }
    if (inputElement) {
      const wrapper = inputElement.closest('.auth-input-wrapper') || inputElement.closest('.auth-select-wrapper');
      if (wrapper) wrapper.classList.remove('has-error');
    }
  }

  // ==========================================
  // 2. Login Form Validation
  // ==========================================
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    const loginEmail = document.getElementById('loginEmail');
    const loginPassword = document.getElementById('loginPassword');
    const emailError = document.getElementById('loginEmailError');
    const passwordError = document.getElementById('loginPasswordError');
    const loginAlert = document.getElementById('loginAlert');

    [loginEmail, loginPassword].forEach(input => {
      if (input) {
        input.addEventListener('input', () => {
          if (input === loginEmail) clearError(loginEmail, emailError);
          if (input === loginPassword) clearError(loginPassword, passwordError);
          if (loginAlert) loginAlert.style.display = 'none';
        });
      }
    });

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      let isValid = true;
      if (loginAlert) {
        loginAlert.style.display = 'none';
        loginAlert.className = 'auth-alert';
        loginAlert.textContent = '';
      }

      const emailVal = loginEmail.value.trim();
      const passVal = loginPassword.value;

      // Email validation
      if (!emailVal) {
        setError(loginEmail, emailError, 'Email address is required');
        isValid = false;
      } else if (!isValidEmail(emailVal)) {
        setError(loginEmail, emailError, 'Please enter a valid email address (e.g. name@domain.com)');
        isValid = false;
      } else {
        clearError(loginEmail, emailError);
      }

      // Password validation
      if (!passVal) {
        setError(loginPassword, passwordError, 'Password is required');
        isValid = false;
      } else {
        clearError(loginPassword, passwordError);
      }

      if (!isValid) {
        if (loginAlert) {
          loginAlert.className = 'auth-alert alert-error';
          loginAlert.textContent = 'Please correct the highlighted fields below.';
          loginAlert.style.display = 'flex';
        }
        return;
      }

      // Submit credentials to backend API
      const submitBtn = document.getElementById('btnLoginSubmit');
      const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';

      try {
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = `
            <span>Signing In...</span>
            <span class="btn-spinner" aria-hidden="true"></span>
          `;
        }

        const response = await fetch('/api/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            email: emailVal,
            password: passVal
          })
        });

        const result = await response.json().catch(() => ({}));

        if (response.ok && result.status === 'success') {
          if (loginAlert) {
            loginAlert.className = 'auth-alert alert-success';
            loginAlert.innerHTML = `✓ Welcome back, <strong>${result.user && result.user.full_name ? result.user.full_name : 'Passenger'}</strong>! Redirecting to home...`;
            loginAlert.style.display = 'flex';
          }

          // Redirect to homepage after brief confirmation
          setTimeout(() => {
            window.location.href = 'index.html';
          }, 1000);
        } else {
          // Display backend error message
          const errorMsg = result.message || 'Invalid email or password. Please try again.';
          if (loginAlert) {
            loginAlert.className = 'auth-alert alert-error';
            loginAlert.textContent = errorMsg;
            loginAlert.style.display = 'flex';
          }
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnHtml;
          }
        }
      } catch (err) {
        console.error('Login request failed:', err);
        if (loginAlert) {
          loginAlert.className = 'auth-alert alert-error';
          loginAlert.textContent = 'Unable to connect to the login service. Please check your network and try again.';
          loginAlert.style.display = 'flex';
        }
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnHtml;
        }
      }
    });
  }

  // ==========================================
  // 3. Registration Form Validation
  // ==========================================
  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    // Section 1
    const regEmail = document.getElementById('regEmail');
    const regPassword = document.getElementById('regPassword');
    const regConfirmPassword = document.getElementById('regConfirmPassword');
    const regCountryCode = document.getElementById('regCountryCode');
    const regPhone = document.getElementById('regPhone');

    // Section 2
    const regTitle = document.getElementById('regTitle');
    const regFirstName = document.getElementById('regFirstName');
    const regMiddleName = document.getElementById('regMiddleName');
    const regLastName = document.getElementById('regLastName');

    // Section 3
    const regDob = document.getElementById('regDob');
    const regResidence = document.getElementById('regResidence');

    // Section 4
    const regTerms = document.getElementById('regTerms');

    // Errors
    const emailError = document.getElementById('regEmailError');
    const passError = document.getElementById('regPassError');
    const confirmPassError = document.getElementById('regConfirmPassError');
    const phoneError = document.getElementById('regPhoneError');

    const titleError = document.getElementById('regTitleError');
    const firstNameError = document.getElementById('regFirstNameError');
    const middleNameError = document.getElementById('regMiddleNameError');
    const lastNameError = document.getElementById('regLastNameError');

    const dobError = document.getElementById('regDobError');
    const residenceError = document.getElementById('regResidenceError');
    const termsError = document.getElementById('regTermsError');

    const registerAlert = document.getElementById('registerAlert');

          // Clear errors on change/input
          const textInputs = [
            { el: regEmail, err: emailError },
            { el: regPassword, err: passError },
            { el: regConfirmPassword, err: confirmPassError },
            { el: regPhone, err: phoneError },
            { el: regFirstName, err: firstNameError },
            { el: regMiddleName, err: middleNameError },
            { el: regLastName, err: lastNameError },
            { el: regDob, err: dobError }
          ];

          textInputs.forEach(item => {
            if (item.el) {
              item.el.addEventListener('input', () => {
                clearError(item.el, item.err);
                if (registerAlert) registerAlert.style.display = 'none';
              });
            }
          });

          [regTitle, regResidence].forEach(selectEl => {
            if (selectEl) {
              selectEl.addEventListener('change', () => {
                if (selectEl === regTitle) clearError(regTitle, titleError);
                if (selectEl === regResidence) clearError(regResidence, residenceError);
                if (registerAlert) registerAlert.style.display = 'none';
              });
            }
          });

          if (regTerms) {
            regTerms.addEventListener('change', () => {
              clearError(null, termsError);
              if (registerAlert) registerAlert.style.display = 'none';
            });
          }

          registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            let isValid = true;
            if (registerAlert) registerAlert.style.display = 'none';

            // 1. Email
            const emailVal = regEmail.value.trim();
            if (!emailVal) {
              setError(regEmail, emailError, 'Email address is required');
              isValid = false;
            } else if (!isValidEmail(emailVal)) {
              setError(regEmail, emailError, 'Please enter a valid email address (e.g. name@domain.com)');
              isValid = false;
            } else {
              clearError(regEmail, emailError);
            }

            // 2. Password
            const passVal = regPassword.value;
            if (!passVal) {
              setError(regPassword, passError, 'Password is required');
              isValid = false;
            } else if (passVal.length < 6) {
              setError(regPassword, passError, 'Password must be at least 6 characters');
              isValid = false;
            } else {
              clearError(regPassword, passError);
            }

            // 3. Confirm Password
            const confirmVal = regConfirmPassword.value;
            if (!confirmVal) {
              setError(regConfirmPassword, confirmPassError, 'Please confirm your password');
              isValid = false;
            } else if (passVal !== confirmVal) {
              setError(regConfirmPassword, confirmPassError, 'Passwords do not match');
              isValid = false;
            } else {
              clearError(regConfirmPassword, confirmPassError);
            }

            // 4. Mobile Number
            const phoneVal = regPhone.value.trim();
            if (!phoneVal) {
              setError(regPhone, phoneError, 'Mobile number is required');
              isValid = false;
            } else if (!isValidPhone(phoneVal)) {
              setError(regPhone, phoneError, 'Please enter a valid mobile number (e.g. 98765 43210)');
              isValid = false;
            } else {
              clearError(regPhone, phoneError);
            }

            // 5. Title
            if (!regTitle.value) {
              setError(regTitle, titleError, 'Please select your title');
              isValid = false;
            } else {
              clearError(regTitle, titleError);
            }

            // 6. First Name
            const firstNameVal = regFirstName.value.trim();
            if (!firstNameVal) {
              setError(regFirstName, firstNameError, 'First name is required');
              isValid = false;
            } else if (firstNameVal.length < 2) {
              setError(regFirstName, firstNameError, 'At least 2 characters required');
              isValid = false;
            } else {
              clearError(regFirstName, firstNameError);
            }

            // 7. Middle Name
            const middleNameVal = regMiddleName.value.trim();
            if (!middleNameVal) {
              setError(regMiddleName, middleNameError, 'Middle name is required');
              isValid = false;
            } else {
              clearError(regMiddleName, middleNameError);
            }

            // 8. Last Name
            const lastNameVal = regLastName.value.trim();
            if (!lastNameVal) {
              setError(regLastName, lastNameError, 'Last name is required');
              isValid = false;
            } else if (lastNameVal.length < 2) {
              setError(regLastName, lastNameError, 'At least 2 characters required');
              isValid = false;
            } else {
              clearError(regLastName, lastNameError);
            }

            // 9. Date of Birth
            const dobVal = regDob.value;
            if (!dobVal) {
              setError(regDob, dobError, 'Date of birth is required');
              isValid = false;
            } else {
              const birthDate = new Date(dobVal);
              const today = new Date();
              if (birthDate >= today) {
                setError(regDob, dobError, 'Date of birth must be in the past');
                isValid = false;
              } else {
                clearError(regDob, dobError);
              }
            }

            // 10. Country/Region of Residence
            if (!regResidence.value) {
              setError(regResidence, residenceError, 'Please select your country/region of residence');
              isValid = false;
            } else {
              clearError(regResidence, residenceError);
            }

            // 11. Terms and Conditions
            if (!regTerms.checked) {
              setError(null, termsError, 'You must agree to the Terms and Conditions to proceed');
              isValid = false;
            } else {
              clearError(null, termsError);
            }

            if (!isValid) {
              if (registerAlert) {
                registerAlert.className = 'auth-alert alert-error';
                registerAlert.textContent = 'Please complete all required fields correctly before submitting.';
                registerAlert.style.display = 'flex';
                registerAlert.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
              return;
            }

            // Disable submit button & show loading state
            const submitBtn = document.getElementById('btnRegisterSubmit');
            const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';
            if (submitBtn) {
              submitBtn.disabled = true;
              submitBtn.style.opacity = '0.7';
              submitBtn.style.cursor = 'wait';
              submitBtn.innerHTML = `
                <span>Creating Account...</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="spin-icon" style="animation: spin 1s linear infinite; width: 18px; height: 18px;">
                  <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
                  <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
                </svg>
              `;
            }

            // Prepare registration payload matching the backend API
            const payload = {
              email: emailVal,
              password: passVal,
              confirmPassword: confirmVal,
              phone: phoneVal,
              countryCode: regCountryCode.value,
              title: regTitle.value,
              firstName: firstNameVal,
              middleName: middleNameVal,
              lastName: lastNameVal,
              fullName: `${firstNameVal} ${middleNameVal ? middleNameVal + ' ' : ''}${lastNameVal}`.trim(),
              dateOfBirth: regDob.value,
              residence: regResidence.value
            };

            // Call Backend Registration API
            fetch('/api/register', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(payload)
            })
            .then(async (response) => {
              const data = await response.json().catch(() => ({}));
              if (!response.ok) {
                throw new Error(data.message || `Registration failed (HTTP ${response.status})`);
              }
              return data;
            })
            .then((data) => {
              // Registration Successful
              if (registerAlert) {
                registerAlert.className = 'auth-alert alert-info';
                registerAlert.innerHTML = `✓ ${data.message || 'Account registered successfully!'} Redirecting to login...`;
                registerAlert.style.display = 'flex';
                registerAlert.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }

              // Clear form inputs
              registerForm.reset();

              // Redirect to Login page after a short confirmation pause
              setTimeout(() => {
                window.location.href = 'login.html?registered=true';
              }, 1500);
            })
            .catch((err) => {
              // Registration Error
              if (registerAlert) {
                registerAlert.className = 'auth-alert alert-error';
                registerAlert.textContent = err.message || 'An error occurred during registration. Please try again.';
                registerAlert.style.display = 'flex';
                registerAlert.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }

              // Reset submit button state
              if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
                submitBtn.style.cursor = 'pointer';
                submitBtn.innerHTML = originalBtnHtml;
              }
            });
          });
        }
});

