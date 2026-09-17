/**
 * Deno GTM — auth page (log in / sign up).
 *
 * There is no auth backend in this project (no /api/auth/* routes) — this
 * mirrors the Deno Auth design itself, which is a self-contained mock with
 * hardcoded "last run" data. This script reproduces that design's client
 * state machine (mode, validation, password strength, pending panel) and,
 * on a successful login, hands off to the real workspace at app.html.
 */

const state = {
  mode: new URLSearchParams(location.search).get('mode') === 'signup' ? 'signup' : 'login',
  show: false,
  remember: true,
  agree: false,
  pending: false,
};

// ---- Element refs ----

const tabLogin = document.getElementById('tab-login');
const tabSignup = document.getElementById('tab-signup');
const headingLogin = document.getElementById('heading-login');
const headingSignup = document.getElementById('heading-signup');
const visualLogin = document.getElementById('visual-login');
const visualSignup = document.getElementById('visual-signup');
const fieldName = document.getElementById('field-name');
const rowRemember = document.getElementById('row-remember');
const chkAgree = document.getElementById('chk-agree');
const strengthRow = document.getElementById('strength-row');
const strengthFill = document.getElementById('strength-fill');
const strengthLabel = document.getElementById('strength-label');
const submitBtn = document.getElementById('submit-btn');
const switchPrompt = document.getElementById('switch-prompt');
const switchModeBtn = document.getElementById('switch-mode');
const authForm = document.getElementById('auth-form');
const pendingPanel = document.getElementById('pending-panel');
const pendingLabel = document.getElementById('pending-label');
const pendingTitle = document.getElementById('pending-title');
const pendingBody = document.getElementById('pending-body');
const pendingReset = document.getElementById('pending-reset');
const errorNotice = document.getElementById('error-notice');
const errorText = document.getElementById('error-text');
const togglePwBtn = document.getElementById('toggle-pw');
const fPw = document.getElementById('f-pw');
const fEmail = document.getElementById('f-email');
const fName = document.getElementById('f-name');
const chkRemember = document.getElementById('chk-remember');
const chkRememberBox = document.getElementById('chk-remember-box');
const chkAgreeBox = document.getElementById('chk-agree-box');

// ---- Mode rendering ----

function renderMode() {
  const isLogin = state.mode === 'login';

  tabLogin.classList.toggle('is-active', isLogin);
  tabSignup.classList.toggle('is-active', !isLogin);

  headingLogin.hidden = !isLogin;
  headingSignup.hidden = isLogin;
  visualLogin.hidden = !isLogin;
  visualSignup.hidden = isLogin;

  fieldName.hidden = isLogin;
  rowRemember.hidden = !isLogin;
  chkAgree.hidden = isLogin;
  strengthRow.hidden = isLogin;

  submitBtn.textContent = isLogin ? 'Log in' : 'Create account — free';
  switchPrompt.textContent = isLogin ? 'No account yet?' : 'Already validating with Deno?';
  switchModeBtn.textContent = isLogin ? 'Create a free account →' : 'Log in instead →';

  clearError();
}

function setMode(mode) {
  state.mode = mode;
  state.pending = false;
  pendingPanel.hidden = true;
  authForm.hidden = false;
  renderMode();
}

tabLogin.addEventListener('click', () => setMode('login'));
tabSignup.addEventListener('click', () => setMode('signup'));
switchModeBtn.addEventListener('click', () => setMode(state.mode === 'login' ? 'signup' : 'login'));

// ---- Password show/hide ----

togglePwBtn.addEventListener('click', () => {
  state.show = !state.show;
  fPw.type = state.show ? 'text' : 'password';
  togglePwBtn.textContent = state.show ? 'hide' : 'show';
});

// ---- Password strength (signup only) ----

function computeStrength(pw) {
  let s = 0;
  if (pw.length >= 10) s++;
  if (pw.length >= 14) s++;
  if (/[^a-zA-Z0-9]/.test(pw)) s++;
  if (/[0-9]/.test(pw) && /[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (!pw) return { pct: '0%', label: 'EMPTY', color: 'var(--lime)' };
  if (s <= 1) return { pct: '28%', label: 'WEAK', color: 'var(--red)' };
  if (s === 2) return { pct: '56%', label: 'OK', color: '#C8A21A' };
  if (s === 3) return { pct: '80%', label: 'STRONG', color: 'var(--green)' };
  return { pct: '100%', label: 'EXCELLENT', color: 'var(--green)' };
}

fPw.addEventListener('input', () => {
  if (state.mode !== 'signup') return;
  const st = computeStrength(fPw.value);
  strengthFill.style.width = st.pct;
  strengthFill.style.background = st.color;
  strengthLabel.textContent = st.label;
});

// ---- Checkboxes ----

chkRemember.addEventListener('click', () => {
  state.remember = !state.remember;
  chkRemember.setAttribute('aria-checked', String(state.remember));
  chkRememberBox.textContent = state.remember ? '✓' : '';
  chkRememberBox.style.background = state.remember ? 'var(--lime)' : 'transparent';
});

chkAgree.addEventListener('click', () => {
  state.agree = !state.agree;
  chkAgree.setAttribute('aria-checked', String(state.agree));
  chkAgreeBox.textContent = state.agree ? '✓' : '';
  chkAgreeBox.style.background = state.agree ? 'var(--lime)' : 'transparent';
  clearError();
});

// ---- Errors ----

function showError(msg) {
  errorText.textContent = msg;
  errorNotice.hidden = false;
  errorNotice.style.animation = 'none';
  // restart nudge animation
  requestAnimationFrame(() => { errorNotice.style.animation = 'denoNudge .32s ease both'; });
}

function clearError() {
  errorNotice.hidden = true;
}

// ---- Submit ----

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

authForm.addEventListener('submit', (e) => {
  e.preventDefault();
  clearError();

  const isLogin = state.mode === 'login';
  const email = fEmail.value.trim();
  const pw = fPw.value;
  const name = fName.value.trim();

  if (!email || !EMAIL_RE.test(email)) return showError('Enter a valid email address.');
  if (isLogin ? pw.length < 1 : pw.length < 10) {
    return showError(isLogin ? 'Enter your password.' : 'Passwords need at least 10 characters.');
  }
  if (!isLogin && !name) return showError('Add your name — posts get written in your voice.');
  if (!isLogin && !state.agree) return showError('Accept the terms and human-send policy to continue.');

  state.pending = true;
  authForm.hidden = true;
  pendingPanel.hidden = false;

  if (isLogin) {
    pendingLabel.textContent = 'AUTHENTICATING';
    pendingTitle.textContent = 'Opening your workspace…';
    pendingBody.textContent = 'Restoring your last run: BUILD verdict at 84% confidence, day 06 draft queued. Nothing was posted while you were away.';
    try {
      const store = state.remember ? window.localStorage : window.sessionStorage;
      store.setItem('deno.session', JSON.stringify({ email, at: Date.now() }));
    } catch (_e) { /* storage unavailable — proceed without persistence */ }
    window.setTimeout(() => { window.location.href = 'app.html'; }, 1100);
  } else {
    pendingLabel.textContent = 'CHECK YOUR INBOX';
    pendingTitle.textContent = "One link to confirm, then you're in.";
    pendingBody.textContent = `We sent a confirmation link to ${email || 'your email'}. No card, no onboarding call — the first validation run starts the moment you click it.`;
  }
});

pendingReset.addEventListener('click', () => {
  state.pending = false;
  pendingPanel.hidden = true;
  authForm.hidden = false;
  clearError();
});

renderMode();
