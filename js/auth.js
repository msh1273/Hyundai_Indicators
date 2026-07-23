/* ===========================================
   auth.js — Microsoft (MSAL) 인증
   · Copilot Studio 봇 Client ID 하나로
     대시보드 로그인 + 봇 토큰 발급 통합
   · 미설정 시 로그인 없이 동작 (기존 방식)
   =========================================== */

var _msalInstance = null;

/* ── MSAL 초기화 ───────────────────────────── */
async function initMsal() {
  var clientId = localStorage.getItem('azure_bot_client_id');  // 봇 Client ID = 대시보드 앱도 겸함
  var tenantId = localStorage.getItem('azure_tenant_id');
  if (!clientId || !tenantId) return false;

  var config = {
    auth: {
      clientId: clientId,
      authority: 'https://login.microsoftonline.com/' + tenantId,
      redirectUri: window.location.origin + window.location.pathname
    },
    cache: {
      cacheLocation: 'sessionStorage',
      storeAuthStateInCookie: false
    }
  };

  _msalInstance = new msal.PublicClientApplication(config);
  await _msalInstance.handleRedirectPromise().catch(function() {});
  return true;
}

/* ── 현재 로그인 계정 ────────────────────────── */
function getMsalAccount() {
  if (!_msalInstance) return null;
  var accounts = _msalInstance.getAllAccounts();
  return accounts.length > 0 ? accounts[0] : null;
}

/* ── 팝업 로그인 ────────────────────────────── */
async function msalLogin() {
  if (!_msalInstance) throw new Error('Azure AD가 설정되지 않았습니다.');
  var result = await _msalInstance.loginPopup({
    scopes: ['User.Read', 'openid', 'profile']
  });
  return result.account;
}

/* ── 로그아웃 ───────────────────────────────── */
async function msalLogout() {
  if (!_msalInstance) return;
  var account = getMsalAccount();
  if (!account) return;
  await _msalInstance.logoutPopup({ account: account });
}

/* ── 봇 scope 토큰 획득 ─────────────────────── */
/* 봇 Client ID = 로그인 앱 Client ID이므로
   같은 앱의 scope로 토큰 발급 */
async function acquireTokenForBot() {
  if (!_msalInstance) return null;
  var account = getMsalAccount();
  if (!account) return null;

  var clientId = localStorage.getItem('azure_bot_client_id');
  if (!clientId) return null;

  var scope = 'api://' + clientId + '/.default';

  try {
    var r = await _msalInstance.acquireTokenSilent({ scopes: [scope], account: account });
    return r.accessToken;
  } catch(e) {
    try {
      var r2 = await _msalInstance.acquireTokenPopup({ scopes: [scope], account: account });
      return r2.accessToken;
    } catch(e2) {
      console.warn('[MSAL] 봇 토큰 획득 실패:', e2.message);
      return null;
    }
  }
}

/* ── UI 업데이트 ─────────────────────────────── */
function updateAuthUI() {
  var account  = getMsalAccount();
  var overlay  = document.getElementById('login-overlay');
  var nameEl   = document.getElementById('ms-user-name');
  var logoutEl = document.getElementById('ms-logout-btn');

  if (overlay)  overlay.style.display  = account ? 'none' : 'flex';
  if (nameEl)   nameEl.textContent     = account ? (account.name || account.username) : '';
  if (logoutEl) logoutEl.style.display = account ? 'inline-flex' : 'none';
}

/* ── 로그인 버튼 클릭 ────────────────────────── */
async function onClickLogin() {
  var btn = document.getElementById('login-btn');
  if (btn) { btn.disabled = true; btn.textContent = '로그인 중…'; }
  try {
    await msalLogin();
    updateAuthUI();
  } catch(e) {
    console.error('[MSAL] 로그인 실패:', e);
    alert('Microsoft 로그인에 실패했습니다.\n' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Microsoft 계정으로 로그인'; }
  }
}

/* ── 로그아웃 버튼 클릭 ──────────────────────── */
async function onClickLogout() {
  try {
    await msalLogout();
    updateAuthUI();
  } catch(e) {
    console.error('[MSAL] 로그아웃 실패:', e);
  }
}

/* ── Azure AD 설정 모달 ──────────────────────── */
function openAzureModal() {
  document.getElementById('az-bot-id').value    = localStorage.getItem('azure_bot_client_id') || '';
  document.getElementById('az-tenant-id').value = localStorage.getItem('azure_tenant_id')     || '';
  document.getElementById('az-conn-name').value = localStorage.getItem('copilot_conn_name')   || 'default';
  document.getElementById('azure-modal-backdrop').style.display = 'flex';
}

function closeAzureModal(e) {
  if (!e || e.target === document.getElementById('azure-modal-backdrop')) {
    document.getElementById('azure-modal-backdrop').style.display = 'none';
  }
}

async function saveAzureSettings() {
  var botId    = document.getElementById('az-bot-id').value.trim();
  var tenantId = document.getElementById('az-tenant-id').value.trim();
  var connName = document.getElementById('az-conn-name').value.trim() || 'default';

  if (botId)    localStorage.setItem('azure_bot_client_id', botId);    else localStorage.removeItem('azure_bot_client_id');
  if (tenantId) localStorage.setItem('azure_tenant_id',     tenantId); else localStorage.removeItem('azure_tenant_id');
  localStorage.setItem('copilot_conn_name', connName);

  closeAzureModal();

  _msalInstance = null;
  var ok = await initMsal();
  if (!ok) {
    alert('저장했습니다. (Azure AD 설정 없이 동작합니다.)');
    return;
  }
  updateAuthUI();
  alert('설정이 저장됐습니다.\nMicrosoft 계정으로 로그인해주세요.');
}

/* ── 페이지 초기화 ───────────────────────────── */
async function initAuth() {
  var ok = await initMsal();
  if (!ok) {
    var overlay = document.getElementById('login-overlay');
    if (overlay) overlay.style.display = 'none';
    return;
  }
  updateAuthUI();
}
