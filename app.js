// ====================== STATE ======================
const state = {
  signedIn: false,
  email: '',
  plan: 'guest',
  aiCredits: 0,
  guestMsLeft: 10 * 60 * 1000,
  usageMsLeftToday: null,
};

// ====================== AUTH0 CONFIG ======================
const AUTH0_DOMAIN = 'dev-1kote2b2378g5pt1.us.auth0.com';
const AUTH0_CLIENT_ID = 'U6xekUwmIHa3B7reoViRre1W2uGYWsZF';
let auth0Client = null;

// Helper to get a consistent redirect URI (handles trailing slash)
function getRedirectUri() {
  const path = window.location.pathname.replace(/\/$/, '');
  return window.location.origin + path + '/';
}

// ====================== DOM ELEMENTS ======================
const editor = document.getElementById('editor');
const terminal = document.getElementById('terminal');
const languageSelect = document.getElementById('languageSelect');
const fileName = document.getElementById('fileName');
const fileExt = document.getElementById('fileExt');
const uploadInput = document.getElementById('uploadInput');
const signinPrompt = document.getElementById('signinPrompt');
const sessionStatus = document.getElementById('sessionStatus');
const usageStatus = document.getElementById('usageStatus');
const creditStatus = document.getElementById('creditStatus');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');

const langExt = {
  javascript: 'js', python: 'py', typescript: 'ts', html: 'html', css: 'css',
  java: 'java', cpp: 'cpp', c: 'c', go: 'go', rust: 'rs', php: 'php', ruby: 'rb',
  swift: 'swift', kotlin: 'kt', bash: 'sh', text: 'txt',
};

// ====================== HELPERS ======================
function writeTerminal(msg) {
  terminal.textContent = msg;
}

function formatMs(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function refreshFileExtOptions() {
  const lang = languageSelect.value;
  const ext = langExt[lang] || 'txt';
  fileExt.innerHTML = '';
  const single = document.createElement('option');
  single.value = ext;
  single.textContent = `.${ext}`;
  fileExt.appendChild(single);
}

function syncUi() {
  sessionStatus.textContent = state.signedIn
    ? `Signed in: ${state.email} (${state.plan})`
    : 'Guest mode';

  creditStatus.textContent = `AI credits: ${state.aiCredits === Infinity ? '∞' : state.aiCredits}`;

  if (!state.signedIn) {
    usageStatus.textContent = `Guest time left: ${formatMs(state.guestMsLeft)}`;
    loginBtn.classList.remove('hidden');
    logoutBtn.classList.add('hidden');
    return;
  }

  loginBtn.classList.add('hidden');
  logoutBtn.classList.remove('hidden');

  if (state.plan === 'free') usageStatus.textContent = 'Usage: Standard signed-in access';
  if (state.plan === 'premium') usageStatus.textContent = `Premium daily time left: ${formatMs(state.usageMsLeftToday)}`;
  if (state.plan === 'ultimate') usageStatus.textContent = 'Premium Ultimate: Infinite usage';
}

function blockIfExpired() {
  if (!state.signedIn && state.guestMsLeft <= 0) {
    editor.disabled = true;
    writeTerminal('Guest time expired. Please sign in to continue.');
    signinPrompt.classList.remove('hidden');
    return true;
  }
  return false;
}

// ====================== EDITOR ACTIONS ======================
function runCode() {
  if (blockIfExpired()) return;
  const code = editor.value;
  const lang = languageSelect.value;
  writeTerminal(`Running ${lang} code...\n\n${code.slice(0, 300)}${code.length > 300 ? '...' : ''}\n\n(Simulation only – full runtime needs a backend)`);
}

function downloadCode() {
  if (blockIfExpired()) return;
  const safe = (fileName.value || 'main').trim().replace(/\s+/g, '_').replace(/[\\/:*?"<>|]/g, '') || 'main';
  const ext = fileExt.value || 'txt';
  const blob = new Blob([editor.value], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safe}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  writeTerminal(`Downloaded ${safe}.${ext}`);
}

function canUseAi() {
  return state.signedIn && (state.aiCredits > 0 || state.aiCredits === Infinity);
}

function spendAiCredit() {
  if (state.aiCredits === Infinity) return true;
  if (state.aiCredits <= 0) return false;
  state.aiCredits -= 1;
  return true;
}

function aiAsk() {
  if (blockIfExpired()) return;
  if (!state.signedIn) return writeTerminal('AI is disabled for guests. Please sign in.');
  if (!spendAiCredit()) return writeTerminal('No AI credits left this month.');

  const prompt = document.getElementById('aiPrompt').value.trim() || 'fix bugs';
  writeTerminal(`AI response: Review complete for request "${prompt}". Suggested fixes: validate inputs, handle nulls, and add error states.`);
  syncUi();
}

function aiAutoFix() {
  if (blockIfExpired()) return;
  if (!state.signedIn) return writeTerminal('AI auto-fix is disabled for guests. Please sign in.');
  if (!spendAiCredit()) return writeTerminal('No AI credits left this month.');

  const oldCode = editor.value;
  let newCode = oldCode
    .replace(/pritn\(/g, 'print(')
    .replace(/consol\.log/g, 'console.log');

  if (newCode === oldCode) {
    newCode = `${oldCode}\n\n// AI note: no obvious typo found; consider adding input validation and error handling.`;
  }
  editor.value = newCode;
  writeTerminal('AI auto-fix applied. Review the updated code before running.');
  syncUi();
}

// ====================== AUTH0 LOGIN / LOGOUT ======================
async function loginWithAuth0() {
  try {
    await auth0Client.loginWithRedirect({
      authorizationParams: {
        redirect_uri: getRedirectUri()
      }
    });
  } catch (err) {
    console.error(err);
    writeTerminal('Login failed. See console for details.');
  }
}

async function logout() {
  try {
    await auth0Client.logout({
      logoutParams: {
        returnTo: getRedirectUri()
      }
    });
  } catch (err) {
    console.error(err);
  }
}

// ====================== TIMER ======================
setInterval(() => {
  if (!state.signedIn && state.guestMsLeft > 0) {
    state.guestMsLeft -= 1000;
    if (state.guestMsLeft <= 0) {
      state.guestMsLeft = 0;
      blockIfExpired();
    }
  }

  if (state.signedIn && state.plan === 'premium' && state.usageMsLeftToday > 0) {
    state.usageMsLeftToday -= 1000;
    if (state.usageMsLeftToday <= 0) {
      state.usageMsLeftToday = 0;
      editor.disabled = true;
      writeTerminal('Premium daily 5-hour usage limit reached.');
    }
  }

  syncUi();
}, 1000);

// ====================== EVENT LISTENERS ======================
document.getElementById('runBtn').addEventListener('click', runCode);
document.getElementById('downloadBtn').addEventListener('click', downloadCode);
document.getElementById('uploadBtn').addEventListener('click', () => uploadInput.click());
document.getElementById('askAiBtn').addEventListener('click', aiAsk);
document.getElementById('fixAiBtn').addEventListener('click', aiAutoFix);

document.getElementById('closePromptBtn').addEventListener('click', () => {
  signinPrompt.classList.add('hidden');
});
document.getElementById('openLoginBtn').addEventListener('click', loginWithAuth0);
document.getElementById('loginBtn').addEventListener('click', loginWithAuth0);
document.getElementById('logoutBtn').addEventListener('click', logout);

languageSelect.addEventListener('change', refreshFileExtOptions);

uploadInput.addEventListener('change', (e) => {
  if (blockIfExpired()) return;
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    editor.value = String(reader.result || '');
    fileName.value = file.name.replace(/\.[^/.]+$/, '');
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const match = Object.keys(langExt).find((lang) => langExt[lang] === ext);
    if (match) languageSelect.value = match;
    refreshFileExtOptions();
    writeTerminal(`Uploaded ${file.name}`);
  };
  reader.readAsText(file);
  uploadInput.value = '';
});

// ====================== INIT ======================
editor.value = `print("Hello, world")\n# Use language selector for different formats.`;
refreshFileExtOptions();
syncUi();

// ====================== AUTH0 INITIALIZATION ======================
(async function initAuth0() {
  try {
    auth0Client = await auth0.createAuth0Client({
      domain: AUTH0_DOMAIN,
      clientId: AUTH0_CLIENT_ID,
      authorizationParams: {
        redirect_uri: getRedirectUri()
      },
      cacheLocation: 'localstorage',
      useRefreshTokens: true
    });

    // Handle the redirect callback from Auth0
    if (window.location.search.includes('code=') && window.location.search.includes('state=')) {
      try {
        await auth0Client.handleRedirectCallback();
        // Clean the URL so the code/state parameters disappear
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (err) {
        console.error('handleRedirectCallback error:', err);
      }
    }

    const isAuthenticated = await auth0Client.isAuthenticated();
    console.log('Auth0 isAuthenticated:', isAuthenticated);

    if (isAuthenticated) {
      const user = await auth0Client.getUser();
      console.log('Logged in as:', user);

      state.signedIn = true;
      state.email = user.email || user.name || 'User';
      state.plan = 'free';
      state.aiCredits = 7;
      state.usageMsLeftToday = 5 * 60 * 60 * 1000;

      // Hide the popup
      signinPrompt.classList.add('hidden');
      editor.disabled = false;
    }

    syncUi();
  } catch (err) {
    console.error('Auth0 init error:', err);
    writeTerminal('Auth0 failed to initialize. Open the browser console (F12) for details.');
  }
})();
