// ====================== STATE ======================
const state = {
  signedIn: false,
  email: '',
  plan: 'guest',
  aiCredits: 0,
  guestMsLeft: 10 * 60 * 1000,
  usageMsLeftToday: null,
};

// ====================== AUTH0 ======================
const AUTH0_DOMAIN = 'dev-1kote2b2378g5pt1.us.auth0.com';
const AUTH0_CLIENT_ID = 'U6xekUwmIHa3B7reoViRre1W2uGYWsZF';
let auth0Client = null;

function getRedirectUri() {
  let path = window.location.pathname;
  if (!path.endsWith('/')) path += '/';
  return window.location.origin + path;
}

// ====================== DOM ======================
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
  console.log(msg);
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
  const opt = document.createElement('option');
  opt.value = ext;
  opt.textContent = `.${ext}`;
  fileExt.appendChild(opt);
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
  } else {
    loginBtn.classList.add('hidden');
    logoutBtn.classList.remove('hidden');
    usageStatus.textContent = 'Usage: Standard signed-in access';
  }
}

function blockIfExpired() {
  if (!state.signedIn && state.guestMsLeft <= 0) {
    editor.disabled = true;
    writeTerminal('Guest time expired. Please sign in.');
    signinPrompt.classList.remove('hidden');
    return true;
  }
  return false;
}

// ====================== ACTIONS ======================
function runCode() {
  if (blockIfExpired()) return;
  writeTerminal(`Running ${languageSelect.value} code... (simulation)`);
}

function downloadCode() {
  if (blockIfExpired()) return;
  const safe = (fileName.value || 'main').trim().replace(/\s+/g, '_') || 'main';
  const ext = fileExt.value || 'txt';
  const blob = new Blob([editor.value], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${safe}.${ext}`;
  a.click();
  writeTerminal(`Downloaded ${safe}.${ext}`);
}

function aiAsk() {
  if (blockIfExpired()) return;
  if (!state.signedIn) return writeTerminal('AI disabled for guests.');
  writeTerminal('AI response (demo)');
}

function aiAutoFix() {
  if (blockIfExpired()) return;
  if (!state.signedIn) return writeTerminal('AI disabled for guests.');
  editor.value = editor.value.replace(/pritn\(/g, 'print(').replace(/consol\.log/g, 'console.log');
  writeTerminal('AI auto-fix applied');
}

// ====================== LOGIN ======================
async function loginWithAuth0() {
  writeTerminal('Login button clicked...');

  if (!auth0Client) {
    writeTerminal('ERROR: Auth0 client is not ready yet. Wait a second and try again.');
    console.error('auth0Client is null');
    return;
  }

  try {
    const redirectUri = getRedirectUri();
    writeTerminal('Redirecting to Auth0...\
