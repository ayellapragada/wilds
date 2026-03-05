export const ADMIN_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Wilds Admin</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #111; color: #eee; padding: 2rem; max-width: 900px; margin: 0 auto; }
    h1 { margin-bottom: 1rem; color: #8f8; }
    .login { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; align-items: center; }
    .login input { width: 140px; }
    .lookup { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; }
    input { padding: 0.5rem 0.75rem; border-radius: 6px; border: 1px solid #444; background: #222; color: #eee; font-size: 1rem; flex: 1; }
    button { padding: 0.5rem 1rem; border-radius: 6px; border: none; background: #8f8; color: #111; font-weight: 600; cursor: pointer; font-size: 1rem; }
    button:hover { background: #6d6; }
    button.danger { background: #f66; color: #fff; }
    button.danger:hover { background: #d44; }
    #status { margin-bottom: 1rem; padding: 0.75rem; border-radius: 6px; background: #222; display: none; }
    #status.error { border-left: 3px solid #f66; }
    #status.success { border-left: 3px solid #8f8; }
    .room-info { background: #1a1a1a; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }
    .room-info h2 { color: #8f8; margin-bottom: 0.5rem; }
    .room-meta { display: flex; gap: 1rem; margin-bottom: 1rem; color: #aaa; flex-wrap: wrap; }
    .room-meta span { background: #222; padding: 0.25rem 0.5rem; border-radius: 4px; }
    .actions { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
    pre { background: #0a0a0a; padding: 1rem; border-radius: 6px; overflow-x: auto; font-size: 0.85rem; max-height: 500px; overflow-y: auto; line-height: 1.4; }
    .hidden { display: none !important; }
    .logged-in-as { color: #8f8; font-size: 0.85rem; margin-bottom: 1rem; }
  </style>
</head>
<body>
  <h1>Wilds Admin</h1>

  <div id="loginSection">
    <div class="login">
      <input type="text" id="username" placeholder="Username" />
      <input type="password" id="password" placeholder="Password" />
      <button onclick="login()">Login</button>
    </div>
  </div>

  <div id="mainSection" class="hidden">
    <div class="logged-in-as" id="loggedInAs"></div>
    <div class="lookup">
      <input type="text" id="roomCode" placeholder="Enter room code..." />
      <button onclick="lookupRoom()">Inspect</button>
    </div>
    <div id="status"></div>
    <div id="result"></div>
  </div>

  <script>
    let authHeader = '';

    const savedAuth = sessionStorage.getItem('wilds_admin_auth');
    if (savedAuth) {
      authHeader = savedAuth;
      showMain();
    }

    function login() {
      const user = document.getElementById('username').value;
      const pass = document.getElementById('password').value;
      if (!user || !pass) return;
      authHeader = 'Basic ' + btoa(user + ':' + pass);
      // verify credentials
      fetch('/parties/wilds/_ping', { headers: { 'Authorization': authHeader } })
        .then(res => {
          if (res.status === 403) {
            showStatus('Wrong credentials', 'error');
            authHeader = '';
            return;
          }
          // Even a 404 or other response means auth passed (401 = bad auth)
          if (res.status === 401) {
            showStatus('Wrong credentials', 'error');
            authHeader = '';
            return;
          }
          sessionStorage.setItem('wilds_admin_auth', authHeader);
          showMain();
        })
        .catch(() => {
          showStatus('Network error — is the server running?', 'error');
          authHeader = '';
        });
    }

    document.getElementById('password').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') login();
    });

    function showMain() {
      document.getElementById('loginSection').classList.add('hidden');
      document.getElementById('mainSection').classList.remove('hidden');
      const decoded = atob(authHeader.slice(6));
      document.getElementById('loggedInAs').textContent = 'Logged in as: ' + decoded.split(':')[0];
    }

    const roomInput = document.getElementById('roomCode');
    const statusEl = document.getElementById('status');
    const resultEl = document.getElementById('result');

    roomInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') lookupRoom();
    });

    function showStatus(msg, type) {
      statusEl.textContent = msg;
      statusEl.className = type;
      statusEl.style.display = 'block';
      if (type === 'success') setTimeout(() => statusEl.style.display = 'none', 3000);
    }

    async function apiFetch(path, options = {}) {
      const headers = { ...options.headers, 'Authorization': authHeader };
      return fetch(path, { ...options, headers });
    }

    async function lookupRoom() {
      const code = roomInput.value.trim();
      if (!code) return;

      statusEl.style.display = 'none';

      try {
        const res = await apiFetch('/parties/wilds/' + encodeURIComponent(code));
        if (res.status === 401 || res.status === 403) {
          showStatus('Auth failed', 'error');
          return;
        }
        if (!res.ok) {
          showStatus('Room not found or error: ' + res.status, 'error');
          return;
        }
        const data = await res.json();
        renderRoom(data);
      } catch (err) {
        showStatus('Request failed: ' + err.message, 'error');
      }
    }

    let currentRoomCode = '';

    function renderRoom(data) {
      const { roomCode, connections, state } = data;
      currentRoomCode = roomCode;
      const trainers = state?.trainers ? Object.keys(state.trainers) : [];

      resultEl.innerHTML = '<div class="room-info">'
        + '<h2>Room: ' + esc(roomCode) + '</h2>'
        + '<div class="room-meta">'
        + '<span>Phase: ' + esc(state?.phase || 'unknown') + '</span>'
        + '<span>Connections: ' + connections + '</span>'
        + '<span>Players: ' + trainers.length + '</span>'
        + '</div>'
        + '<div class="actions">'
        + '<button id="refreshBtn">Refresh</button>'
        + '<button class="danger" id="resetBtn">Reset Room</button>'
        + '</div>'
        + '<pre>' + esc(JSON.stringify(state, null, 2)) + '</pre>'
        + '</div>';

      document.getElementById('refreshBtn').onclick = () => lookupRoom();
      document.getElementById('resetBtn').onclick = () => resetRoom();
    }

    function esc(str) {
      const d = document.createElement('div');
      d.textContent = String(str);
      return d.innerHTML;
    }

    async function resetRoom() {
      const code = currentRoomCode;
      if (!confirm('Reset room ' + code + '? This will kick all players back to lobby.')) return;
      try {
        const res = await apiFetch('/parties/wilds/' + encodeURIComponent(code), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reset' }),
        });
        const data = await res.json();
        if (data.ok) {
          showStatus('Room reset!', 'success');
          await lookupRoom();
        } else {
          showStatus('Reset failed: ' + (data.error || 'unknown'), 'error');
        }
      } catch (err) {
        showStatus('Reset failed: ' + err.message, 'error');
      }
    }
  </script>
</body>
</html>`;
