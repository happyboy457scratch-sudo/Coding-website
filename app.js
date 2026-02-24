const state = {
  signedIn: false,
  email: '',
  plan: 'guest',
  aiCredits: 0,
  guestMsLeft: 10 * 60 * 1000,
  usageMsLeftToday: null,
};

const langExt = {
  javascript: 'js', python: 'py', typescript: 'ts', html: 'html', css: 'css',
  java: 'java', cpp: 'cpp', c: 'c', go: 'go', rust: 'rs', php: 'php', ruby: 'rb',
  swift: 'swift', kotlin: 'kt', bash: 'sh', text: 'txt',
};

const editor = document.getElementById('editor');
const terminal = document.getElementById('terminal');
const languageSelect = document.getElementById('languageSelect');
const fileName = document.getElementById('fileName');
const fileExt = document.getElementById('fileExt');
const uploadInput = document.getElementById('uploadInput');
const signinPrompt = document.getElementById('signinPrompt');
const authModal = document.getElementById('authModal');
const sessionStatus = document.getElementById('sessionStatus');
const usageStatus = document.getElementById('usageStatus');
const creditStatus = document.getElementById('creditStatus');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');

function writeTerminal(msg) { terminal.textContent = msg; }
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
  sessionStatus.textContent = state.signedIn ? `Signed in: ${state.email} (${state.plan})` : 'Guest mode';
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

function canUseEditor() {
  if (state.signedIn) return true;
  return state.guestMsLeft > 0;
}

function blockIfExpired() {
  if (canUseEditor()) return false;
  editor.disabled = true;
  writeTerminal('Guest time expired. Please sign in to continue.');
  return true;
}

function runCode() {
  if (blockIfExpired()) return;
  const lang = languageSelect.value;
  const code = editor.value;

  if (!code.trim()) return writeTerminal('No code to run.');

  if (lang === 'javascript') {
    try {
      const result = Function('"use strict";\n' + code)();
      writeTerminal(result === undefined ? 'JS executed successfully (no return).' : String(result));
    } catch (err) {
      writeTerminal(`JavaScript error: ${err instanceof Error ? err.message : String(err)}`);
    }
    return;
  }

  if (lang === 'html') {
    writeTerminal('HTML can be tested by downloading and opening in browser.');
    return;
  }

  writeTerminal(`Language set to ${lang}. Terminal simulation available; full runtime requires backend containers.`);
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
  let newCode = oldCode.replace(/pritn\(/g, 'print(').replace(/consol\.log/g, 'console.log');
  if (newCode === oldCode) {
    newCode = `${oldCode}\n\n// AI note: no obvious typo found; consider adding input validation and error handling.`;
  }
  editor.value = newCode;
  writeTerminal('AI auto-fix applied. Review the updated code before running.');
  syncUi();
}

function signIn(email, planRequested) {
  if (planRequested === 'premium' || planRequested === 'ultimate') {
    writeTerminal('Premium and Premium Ultimate are not available yet. Signed in on Free plan.');
  }

  state.signedIn = true;
  state.email = email;
  state.plan = 'free';
  state.aiCredits = 7;
  state.usageMsLeftToday = 5 * 60 * 60 * 1000;

  signinPrompt.classList.add('hidden');
  authModal.classList.add('hidden');
  editor.disabled = false;
  syncUi();
}

function signOut() {
  state.signedIn = false;
  state.email = '';
  state.plan = 'guest';
  state.aiCredits = 0;
  syncUi();
}

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

document.getElementById('runBtn').addEventListener('click', runCode);
document.getElementById('downloadBtn').addEventListener('click', downloadCode);
document.getElementById('uploadBtn').addEventListener('click', () => uploadInput.click());
document.getElementById('askAiBtn').addEventListener('click', aiAsk);
document.getElementById('fixAiBtn').addEventListener('click', aiAutoFix);

document.getElementById('closePromptBtn').addEventListener('click', () => signinPrompt.classList.add('hidden'));
document.getElementById('openLoginBtn').addEventListener('click', () => authModal.classList.remove('hidden'));
document.getElementById('loginBtn').addEventListener('click', () => authModal.classList.remove('hidden'));
document.getElementById('closeAuthBtn').addEventListener('click', () => authModal.classList.add('hidden'));
document.getElementById('logoutBtn').addEventListener('click', signOut);

document.getElementById('authForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const email = document.getElementById('emailInput').value.trim();
  const plan = document.getElementById('planSelect').value;
  signIn(email, plan);
});

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

editor.value = `print("Hello, world")\n# Use language selector for different formats.`;
refreshFileExtOptions();
syncUi();
