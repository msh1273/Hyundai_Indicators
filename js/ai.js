/* ===========================================
   ai.js § 1. Direct Line 클라이언트 (Copilot Studio)
   =========================================== */

var _dlToken = null;
var _dlTokenExpiresAt = 0;
var _currentAbortController = null;

async function _getToken(signal) {
  var now = Date.now();
  if (_dlToken && now < _dlTokenExpiresAt) return _dlToken;
  var secret = localStorage.getItem('copilot_secret');
  if (!secret) throw new Error('Copilot Studio 키가 설정되지 않았습니다.');
  var res = await fetch('https://directline.botframework.com/v3/directline/tokens/generate', {
    method: 'POST', headers: { 'Authorization': 'Bearer ' + secret }, signal: signal
  });
  if (!res.ok) throw new Error('토큰 발급 실패 (' + res.status + ') — 키를 다시 확인하세요.');
  var data = await res.json();
  _dlToken = data.token;
  _dlTokenExpiresAt = now + (Math.max((data.expires_in || 1800) - 60, 30)) * 1000;
  return _dlToken;
}

function _dlHeaders(token) {
  return { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' };
}

async function askCopilotAgent(message, opts) {
  opts = opts || {};
  var timeoutMs      = opts.timeoutMs      || 90000;
  var pollIntervalMs = opts.pollIntervalMs || 2000;
  var onProgress     = opts.onProgress     || null;
  var signal         = opts.signal         || null;

  if (onProgress) onProgress(1, '🔑 Copilot 키 인증 중…');
  var token = await _getToken(signal);

  if (onProgress) onProgress(2, '🔗 에이전트 연결 중…');
  var convRes = await fetch('https://directline.botframework.com/v3/directline/conversations', {
    method: 'POST', headers: _dlHeaders(token), signal: signal
  });
  if (!convRes.ok) {
    _dlToken = null;
    token = await _getToken(signal);
    convRes = await fetch('https://directline.botframework.com/v3/directline/conversations', {
      method: 'POST', headers: _dlHeaders(token), signal: signal
    });
    if (!convRes.ok) throw new Error('대화 시작 실패 (' + convRes.status + ')');
  }
  var conv = await convRes.json();
  var convId    = conv.conversationId;
  var convToken = conv.token || token;
  var actUrl    = 'https://directline.botframework.com/v3/directline/conversations/' + convId + '/activities';

  /* 전송 전 watermark 캡처 (웰컴 메시지 무시용) */
  var preWatermark = null;
  try {
    var wmRes = await fetch(actUrl, { headers: { 'Authorization': 'Bearer ' + convToken }, signal: signal });
    if (wmRes.ok) preWatermark = (await wmRes.json()).watermark;
  } catch(e) {}

  if (onProgress) onProgress(3, '📨 분석 요청 전송 중…');
  var sendRes = await fetch(actUrl, {
    method: 'POST', headers: _dlHeaders(convToken),
    body: JSON.stringify({ type: 'message', from: { id: 'dashboard-user' }, text: message }),
    signal: signal
  });
  if (!sendRes.ok) throw new Error('메시지 전송 실패 (' + sendRes.status + ')');

  var watermark = preWatermark;
  var startTime = Date.now();
  var deadline  = startTime + timeoutMs;

  while (Date.now() < deadline) {
    if (signal && signal.aborted) throw new DOMException('중단됨', 'AbortError');
    await new Promise(function(r) { setTimeout(r, pollIntervalMs); });
    if (signal && signal.aborted) throw new DOMException('중단됨', 'AbortError');

    var elapsed = Math.floor((Date.now() - startTime) / 1000);
    if (onProgress) onProgress(4, '⏳ 응답 대기 중… (' + elapsed + '초 경과)');

    var url = actUrl + (watermark != null ? '?watermark=' + watermark : '');
    try {
      var pollRes = await fetch(url, { headers: { 'Authorization': 'Bearer ' + convToken }, signal: signal });
      if (!pollRes.ok) continue;
      var pollData = await pollRes.json();
      watermark = pollData.watermark;
      var botMsgs = (pollData.activities || []).filter(function(a) {
        return a.type === 'message' && a.from && a.from.id !== 'dashboard-user'
               && typeof a.text === 'string' && a.text.trim().length > 0;
      });
      if (botMsgs.length) return botMsgs.map(function(a) { return a.text; }).join('\n\n');
    } catch(e) {
      if (e.name === 'AbortError') throw e;
    }
  }
  throw new Error('응답 시간 초과 (' + Math.floor(timeoutMs / 1000) + '초)');
}

/* ===========================================
   ai.js § 2. Gemini
   =========================================== */
async function askGemini(message, opts) {
  opts = opts || {};
  var onProgress = opts.onProgress || null;
  var signal     = opts.signal     || null;

  var key = localStorage.getItem('gemini_api_key');
  if (!key) throw new Error('Gemini API 키가 설정되지 않았습니다.');

  if (onProgress) onProgress(1, '🔑 Gemini 키 확인 중…');
  if (onProgress) onProgress(3, '📨 Gemini에 요청 전송 중…');

  var progressTimer = setTimeout(function() {
    if (onProgress) onProgress(4, '⏳ Gemini 응답 대기 중…');
  }, 500);

  try {
    var res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=' + key,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: message }] }] }),
        signal: signal
      }
    );
    clearTimeout(progressTimer);
    if (!res.ok) {
      var err = await res.json().catch(function() { return {}; });
      throw new Error('Gemini 오류 (' + res.status + '): ' + ((err.error && err.error.message) || '알 수 없는 오류'));
    }
    var data = await res.json();
    var text = data.candidates && data.candidates[0] && data.candidates[0].content
               && data.candidates[0].content.parts && data.candidates[0].content.parts[0]
               && data.candidates[0].content.parts[0].text;
    if (!text) throw new Error('Gemini에서 응답을 받지 못했습니다.');
    return text;
  } catch(e) {
    clearTimeout(progressTimer);
    throw e;
  }
}

/* ===========================================
   ai.js § 3. Anthropic (Claude)
   =========================================== */
async function askAnthropic(message, opts) {
  opts = opts || {};
  var onProgress = opts.onProgress || null;
  var signal     = opts.signal     || null;

  var key = localStorage.getItem('anthropic_api_key');
  if (!key) throw new Error('Anthropic API 키가 설정되지 않았습니다.');

  if (onProgress) onProgress(1, '🔑 Claude 키 확인 중…');
  if (onProgress) onProgress(3, '📨 Claude에 요청 전송 중…');

  var progressTimer = setTimeout(function() {
    if (onProgress) onProgress(4, '⏳ Claude 응답 대기 중…');
  }, 500);

  try {
    var res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        messages: [{ role: 'user', content: message }]
      }),
      signal: signal
    });
    clearTimeout(progressTimer);
    if (!res.ok) {
      var err = await res.json().catch(function() { return {}; });
      throw new Error('Claude 오류 (' + res.status + '): ' + ((err.error && err.error.message) || '알 수 없는 오류'));
    }
    var data = await res.json();
    var text = data.content && data.content[0] && data.content[0].text;
    if (!text) throw new Error('Claude에서 응답을 받지 못했습니다.');
    return text;
  } catch(e) {
    clearTimeout(progressTimer);
    throw e;
  }
}

/* ===========================================
   ai.js § 4. Groq (llama-3.3-70b, 무료)
   =========================================== */
async function askGroq(message, opts) {
  opts = opts || {};
  var onProgress = opts.onProgress || null;
  var signal     = opts.signal     || null;

  var key = localStorage.getItem('groq_api_key');
  if (!key) throw new Error('Groq API 키가 설정되지 않았습니다.');

  if (onProgress) onProgress(1, '🔑 Groq 키 확인 중…');
  if (onProgress) onProgress(3, '📨 Groq에 요청 전송 중…');

  var progressTimer = setTimeout(function() {
    if (onProgress) onProgress(4, '⏳ Groq 응답 대기 중…');
  }, 500);

  try {
    var res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: message }],
        max_tokens: 2048
      }),
      signal: signal
    });
    clearTimeout(progressTimer);
    if (!res.ok) {
      var err = await res.json().catch(function() { return {}; });
      throw new Error('Groq 오류 (' + res.status + '): ' + ((err.error && err.error.message) || '알 수 없는 오류'));
    }
    var data = await res.json();
    var text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!text) throw new Error('Groq에서 응답을 받지 못했습니다.');
    return text;
  } catch(e) {
    clearTimeout(progressTimer);
    throw e;
  }
}

/* ===========================================
   ai.js § 5. 프로바이더 디스패처
   =========================================== */
async function askAI(message, opts) {
  var provider = localStorage.getItem('ai_provider') || 'copilot';
  switch (provider) {
    case 'gemini':    return askGemini(message, opts);
    case 'anthropic': return askAnthropic(message, opts);
    case 'groq':      return askGroq(message, opts);
    default:          return askCopilotAgent(message, opts);
  }
}

/* ===========================================
   ai.js § 5. 교차분석 UI
   =========================================== */

/* 체크박스 카운터 — DOMContentLoaded로 안전하게 바인딩 */
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.ind-chk').forEach(function(chk) {
    chk.addEventListener('change', function() {
      var checked = document.querySelectorAll('.ind-chk:checked');
      var counter = document.getElementById('chk-counter');
      if (checked.length > 5) { this.checked = false; return; }
      if (counter) counter.textContent = checked.length + '/5 선택됨';
    });
  });
});

/* 체크박스 ID → data.json 키 매핑 */
var CHK_TO_KEY = {
  ic_csi:        'csi',
  ic_cpi:        'cpi',
  ic_rate:       'rate',
  ic_fx:         'fx',
  ic_kospi:      'kospi',
  ic_tourist:    'tourist',
  ic_income:     'income',
  ic_employ:     'employ',
  ic_houseprice: 'houseprice',
  ic_retail:     'retail'
};

/* raw data를 가져와 텍스트로 변환 */
async function buildRawDataBlock(checked) {
  var jsonData = null;
  try {
    jsonData = await loadDataJson();
  } catch(e) {}

  var lines = [];
  Array.from(checked).forEach(function(chk) {
    var dataKey = CHK_TO_KEY[chk.id];
    var label   = (document.querySelector('label[for="' + chk.id + '"]') || {}).textContent || chk.value;
    var rows    = jsonData && dataKey ? jsonData[dataKey] : null;
    if (rows && rows.length > 0) {
      // 최근 24개월(또는 전체)
      var recent = rows.slice(-24);
      var dataStr = recent.map(function(r) {
        return r.ym + ': ' + r.val;
      }).join(', ');
      lines.push('[' + label.trim() + '] ' + dataStr);
    } else {
      lines.push('[' + label.trim() + '] 데이터 없음');
    }
  });
  return lines.join('\n');
}

/* 기본 프롬프트 생성 (체크박스 선택 시 textarea에 표시) */
function buildDefaultPrompt(checked) {
  var labels = Array.from(checked).map(function(chk) {
    return (document.querySelector('label[for="' + chk.id + '"]') || {}).textContent || chk.value;
  }).map(function(l) { return l.trim(); });

  return '아래 경제 지표 데이터를 바탕으로 현대백화점 상품본부 관점에서 분석 보고서를 작성해 주세요.\n\n' +
    '분석 지표: ' + labels.join(', ') + '\n\n' +
    '다음 구성으로 마크다운 형식으로 작성해 주세요:\n' +
    '1. 지표 간 상관관계 및 현황 요약\n' +
    '2. 현대백화점 매출·고객 방문에 미치는 영향 분석\n' +
    '3. 상품 카테고리별 기회/리스크 (예: 명품, 식품, 생활, 스포츠 등)\n' +
    '4. 단기(1~3개월) 대응 전략 제언\n\n' +
    '(실제 지표 수치는 아래 [데이터] 섹션에 포함됩니다.)';
}

function updateDefaultPrompt() {
  var checked  = document.querySelectorAll('.ind-chk:checked');
  var textarea = document.getElementById('custom-prompt-input');
  if (!textarea) return;
  if (checked.length === 0) {
    textarea.value = '';
    return;
  }
  textarea.value = buildDefaultPrompt(checked);
}

function selectedIndicatorsToPrompt(checked) {
  return Array.from(checked).map(function(c) { return c.value; }).join(', ');
}

function cancelInsight() {
  if (_currentAbortController) {
    _currentAbortController.abort();
    _currentAbortController = null;
  }
}

/* 프로바이더별 단계 레이블 */
var PROVIDER_STEPS = {
  copilot:   ['키 인증', '에이전트 연결', '요청 전송', '응답 대기'],
  gemini:    ['키 확인', '—', '요청 전송', '응답 수신'],
  anthropic: ['키 확인', '—', '요청 전송', '응답 수신'],
  groq:      ['키 확인', '—', '요청 전송', '응답 수신']
};

async function runCustomInsight() {
  var checked = document.querySelectorAll('.ind-chk:checked');
  if (checked.length < 2) { alert('2개 이상 선택해주세요.'); return; }

  var provider      = localStorage.getItem('ai_provider') || 'copilot';
  var userPrompt    = (document.getElementById('custom-prompt-input') || {}).value || buildDefaultPrompt(checked);
  var selectedLabels = Array.from(checked).map(function(c) {
    var lbl = document.querySelector('label[for="' + c.id + '"]');
    return lbl ? lbl.textContent.trim() : c.value;
  });

  var resultBox   = document.getElementById('custom-result');
  var cirBody     = document.getElementById('cir-body');
  var cirPulse    = document.getElementById('cir-pulse');
  var cirSelected = document.getElementById('cir-selected');
  var runBtn      = document.getElementById('custom-run-btn');
  var cancelBtn   = document.getElementById('custom-cancel-btn');

  /* 선택 지표 태그 */
  cirSelected.innerHTML = selectedLabels.map(function(l) {
    return '<span class="cir-tag">' + l + '</span>';
  }).join('');
  cirSelected.style.display = 'flex';

  resultBox.classList.add('show');
  cirPulse.style.display = 'inline';
  runBtn.disabled = true;
  cancelBtn.style.display = 'inline-block';

  /* 프로바이더별 진행 단계 */
  var STEPS = PROVIDER_STEPS[provider] || PROVIDER_STEPS.copilot;
  /* Gemini/Anthropic은 2단계 없으므로 건너뛸 step 지정 */
  var skipStep2 = (provider !== 'copilot');

  function renderProgress(currentStep, statusMsg) {
    var stepsHtml = STEPS.map(function(label, i) {
      var idx = i + 1;
      if (skipStep2 && idx === 2) return ''; /* Gemini/Claude는 연결 단계 표시 안 함 */
      var done   = idx < currentStep;
      var active = idx === currentStep;
      var cls    = done ? 'ai-step done' : active ? 'ai-step active' : 'ai-step pending';
      var icon   = done ? '✓'
                 : active ? '<span class="pulse" style="width:7px;height:7px;margin:0"></span>'
                 : String(idx);
      return '<div class="' + cls + '"><span class="ai-step-icon">' + icon + '</span>' + label + '</div>';
    }).join('');
    cirBody.innerHTML =
      '<div class="ai-progress-steps">' + stepsHtml + '</div>' +
      '<div class="ai-progress-msg">' + statusMsg + '</div>';
  }

  renderProgress(1, '시작 중…');

  _currentAbortController = new AbortController();

  try {
    /* raw data 수집 후 최종 메시지 조합 */
    var rawBlock = await buildRawDataBlock(checked);
    var finalMessage = userPrompt.trim()
      + '\n\n---\n[데이터]\n' + rawBlock;

    var txt = await askAI(finalMessage, {
      onProgress: function(step, msg) { renderProgress(step, msg); },
      signal: _currentAbortController.signal
    });

    cirPulse.style.display = 'none';
    cancelBtn.style.display = 'none';
    await typewriterRender(txt || '분석 결과를 가져오지 못했습니다.', cirBody);

  } catch(e) {
    console.error('runCustomInsight error:', e);
    cirBody.innerHTML = e.name === 'AbortError'
      ? '<span style="color:#888">⊘ 분석이 중단되었습니다.</span>'
      : '<span style="color:#C0392B">⚠ ' + e.message + '</span>';
  } finally {
    cirPulse.style.display = 'none';
    cancelBtn.style.display = 'none';
    runBtn.disabled = false;
    _currentAbortController = null;
  }
}

function cancelInsight() {
  if (_currentAbortController) {
    _currentAbortController.abort();
    _currentAbortController = null;
  }
}

/* ===========================================
   ai.js § 7. 타입라이터 렌더링
   =========================================== */
function typewriterRender(rawText, container) {
  var CHARS_PER_FRAME = 25;
  var html = (typeof marked !== 'undefined') ? marked.parse(rawText) : rawText.replace(/\n/g, '<br>');
  var temp = document.createElement('div');
  temp.innerHTML = html;
  var fullText = temp.textContent || temp.innerText || '';
  container.innerHTML = '';

  return new Promise(function(resolve) {
    var idx = 0;
    var output = document.createElement('div');
    output.className = 'markdown-body';
    container.appendChild(output);

    function tick() {
      if (idx >= fullText.length) {
        output.innerHTML = html;
        resolve();
        return;
      }
      idx = Math.min(idx + CHARS_PER_FRAME, fullText.length);
      output.textContent = fullText.slice(0, idx);
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

/* ===========================================
   ai.js § 8. 체크박스 카운터 + 프롬프트 자동 업데이트
   =========================================== */
document.addEventListener('DOMContentLoaded', function() {
  document.addEventListener('change', function(e) {
    if (!e.target.classList.contains('ind-chk')) return;
    var checked = document.querySelectorAll('.ind-chk:checked');
    var counter = document.getElementById('chk-counter');
    if (checked.length > 5) { e.target.checked = false; return; }
    if (counter) counter.textContent = checked.length + '/5 선택됨';
    updateDefaultPrompt();
  });
});
