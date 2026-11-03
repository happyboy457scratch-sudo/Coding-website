// ====================== CONFIG ======================
const AUTH0_DOMAIN = 'dev-1kote2b2378g5pt1.us.auth0.com';
const AUTH0_CLIENT_ID = 'U6xekUwmIHa3B7reoViRre1W2uGYWsZF';

// ←←← PUT YOUR GROK API KEY HERE
const GROK_API_KEY = 'xai-your-key-here';   // ← replace this
const GROK_MODEL = 'grok-4.7';              // or grok-4.6, etc.

// ====================== STATE ======================
const state = {
  signedIn: false,
  email: '',
  plan: 'guest',
  aiCredits: 0,
  guestMsLeft: 10 * 60 * 1000,
  usageMsLeftToday: null,
};

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
    writeTerminal('Guest time expired. Please sign in to continue.');
    signinPrompt.classList.remove('hidden');
    return true;
  }
  return false;
}

// ====================== GROK API ======================
async function callGrok(messages) {
  if (!GROK_API_KEY || GROK_API_KEY.includes('your-key')) {
    throw new Error('Please add your Grok API key in app.js');
  }

  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROK_API_KEY}`
    },
    body: JSON.stringify({
      model: GROK_MODEL,
      messages: messages,
      temperature: 0.3
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Grok API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || 'No response from Grok';
}

// ====================== EDITOR ACTIONS ======================
function runCode() {
  if (blockIfExpired()) return;
  writeTerminal(`Running ${languageSelect.value} code...\n\n(Simulation only – full runtime needs a backend)`);
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

async function aiAsk() {
  if (blockIfExpired()) return;
  if (!state.signedIn) return writeTerminal('AI is only available for signed-in users.');
  if (state.aiCredits <= 0 && state.aiCredits !== Infinity) {
    return writeTerminal('No AI credits left this month.');
  }

  const userPrompt = document.getElementById('aiPrompt').value.trim() || 'Find bugs and suggest improvements';
  const code = editor.value;

  writeTerminal('Asking Grok...');

  try {
    if (state.aiCredits !== Infinity) state.aiCredits--;

    const reply = await callGrok([
      {
        role: 'system',
        content: 'You are an expert programming assistant. Be concise and helpful. Focus on bugs, improvements, and clear explanations.'
      },
      {
        role: 'user',
        content: `Language: ${languageSelect.value}\n\nCode:\n\`\`\`\n${code}\n\`\`\`\n\nUser request: ${userPrompt}`
      }
    ]);

    writeTerminal(reply);
    syncUi();
  } catch (err) {
    console.error(err);
    writeTerminal('Grok error: ' + err.message);
  }
}

async function aiAutoFix() {
  if (blockIfExpired()) return;
  if (!state.signedIn) return writeTerminal('AI auto-fix is only available for signed-in users.');
  if (state.aiCredits <= 0 && state.aiCredits !== Infinity) {
    return writeTerminal('No AI credits left this month.');
  }

  const code = editor.value;
  writeTerminal('Grok is fixing your code...');

  try {
    if (state.aiCredits !== Infinity) state.aiCredits--;

    const reply = await callGrok([
      {
        role: 'system',
        content: 'You are an expert programmer. Return ONLY the fixed/improved code. No explanations, no markdown fences, just the pure code.'
      },
      {
        role: 'user',
        content: `Fix and improve this ${languageSelect.value} code:\n\n${code}`
      }
    ]);

    // Clean possible markdown if Grok still adds it
    let fixed = reply.trim();
    if (fixed.startsWith('```')) {
      fixed = fixed.replace(/^```[a-z]*\n?/i, '').replace(/```$/, '').trim();
    }

    editor.value = fixed;
    writeTerminal('AI auto-fix applied by Grok. Review the changes.');
    syncUi();
  } catch (err) {
    console.error(err);
    writeTerminal('Grok error: ' + err.message);
  }
}

// ====================== AUTH0 ======================
async function loginWithAuth0() {
  if (!auth0Client) {
    writeTerminal('Auth0 is still loading...');
    return;
  }
  try {
    await auth0Client.loginWithRedirect({
      authorizationParams: { redirect_uri: getRedirectUri() }
    });
  } catch (err) {
    console.error(err);
    writeTerminal('Login failed: ' + err.message);
  }
}

async function logout() {
  if (!auth0Client) return;
  await auth0Client.logout({
    logoutParams: { returnTo: getRedirectUri() }
  });
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
  syncUi();
}, 1000);

// ====================== EVENTS ======================
document.getElementById('runBtn').addEventListener('click', runCode);
document.getElementById('downloadBtn').addEventListener('click', downloadCode);
document.getElementById('uploadBtn').addEventListener('click', () => uploadInput.click());
document.getElementById('askAiBtn').addEventListener('click', aiAsk);
document.getElementById('fixAiBtn').addEventListener('click', aiAutoFix);
document.getElementById('closePromptBtn').addEventListener('click', () => signinPrompt.classList.add('hidden'));
document.getElementById('openLoginBtn').addEventListener('click', loginWithAuth0);
document.getElementById('loginBtn').addEventListener('click', loginWithAuth0);
document.getElementById('logoutBtn').addEventListener('click', logout);
languageSelect.addEventListener('change', refreshFileExtOptions);

uploadInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    editor.value = reader.result;
    writeTerminal('Uploaded ' + file.name);
  };
  reader.readAsText(file);
});

// ====================== START ======================
editor.value = `print("Hello, world")\n# Use language selector for different formats.`;
refreshFileExtOptions();
syncUi();

// Auth0 init
(async function initAuth0() {
  try {
    auth0Client = await auth0.createAuth0Client({
      domain: AUTH0_DOMAIN,
      clientId: AUTH0_CLIENT_ID,
      authorizationParams: { redirect_uri: getRedirectUri() },
      cacheLocation: 'localstorage',
      useRefreshTokens: true
    });

    if (window.location.search.includes('code=') && window.location.search.includes('state=')) {
      await auth0Client.handleRedirectCallback();
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const isAuthenticated = await auth0Client.isAuthenticated();
    if (isAuthenticated) {
      const user = await auth0Client.getUser();
      state.signedIn = true;
      state.email = user.email || user.name || 'User';
      state.plan = 'free';
      state.aiCredits = 7;
      signinPrompt.classList.add('hidden');
      editor.disabled = false;
    }
    syncUi();
  } catch (err) {
    console.error(err);
    writeTerminal('Auth0 error: ' + err.message);
  }
})();
