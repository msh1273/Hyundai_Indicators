/* ===========================================
   JS § 5. 날짜 헬퍼
   · addMonths(yyyymm, n): n개월 전후 계산
   · nowYM(): 현재 YYYYMM 반환
   ═══════════════════════════════════════════ */
function addMonths(yyyymm, n) {
  var y = parseInt(yyyymm.substring(0,4));
  var m = parseInt(yyyymm.substring(4,6)) + n;
  while(m > 12){m -= 12; y++;}
  while(m < 1){m += 12; y--;}
  return y.toString() + (m<10?'0':'')+m.toString();
}
function nowYM() {
  var d = new Date();
  return d.getFullYear().toString() + (d.getMonth()<9?'0':'')+(d.getMonth()+1).toString();
}

/* ═══════════════════════════════════════════
   JS § 6. 포맷 헬퍼
   · fmtVal(val, unit): 단위별 숫자 포맷
     - % → #,##0.0%
     - 원/건/명 → #,##0 + 단위
     - p/조 → 정수 + 단위
   · fmtDiff(diff, unit): 증감 화살표 포맷
   ═══════════════════════════════════════════ */
// 단위별 포맷 규칙:
//   % → #,##0.0%  (소수점 1자리 + % 단위)
//   원 → #,##0원  (정수 콤마 + 원)
//   건/명/p/억원 등 → #,##0 + 단위
//   증감이 % 인 경우 → 부호 포함 #,##0.0%
function fmtVal(val, unit, isDiff) {
  if(val === null || val === undefined || isNaN(val)) return '-';
  var n = Number(val);
  var sign = isDiff ? (n > 0 ? '+' : '') : '';
  if(unit === '%') {
    // #,##0.0%
    return sign + n.toLocaleString('ko-KR', {minimumFractionDigits:1, maximumFractionDigits:1}) + '%';
  }
  if(unit === '원') {
    // #,##0원
    return sign + Math.round(n).toLocaleString('ko-KR') + '원';
  }
  if(unit === '건' || unit === '명') {
    // #,##0건/명
    return sign + Math.round(n).toLocaleString('ko-KR') + unit;
  }
  if(unit === 'p' || unit === '억원' || unit === '조') {
    // #,##0p 등 (소수점 없이)
    return sign + Math.round(n).toLocaleString('ko-KR') + (unit||'');
  }
  // 기본: 소수점 1자리
  return sign + n.toLocaleString('ko-KR', {minimumFractionDigits:1, maximumFractionDigits:1}) + (unit||'');
}

// 증감(diff)값 포맷: 단위에 따라 % 또는 원/건 등
function fmtDiff(diff, unit) {
  if(diff === null || diff === undefined || diff === '-') return '-';
  var n = Number(diff);
  var sign = n > 0 ? '▲ +' : n < 0 ? '▼ ' : '= ';
  var absN = Math.abs(n);
  if(unit === '%') {
    return sign + absN.toLocaleString('ko-KR', {minimumFractionDigits:1, maximumFractionDigits:1}) + '%p';
  }
  if(unit === '원') {
    return sign + Math.round(absN).toLocaleString('ko-KR') + '원';
  }
  if(unit === '건' || unit === '명') {
    return sign + Math.round(absN).toLocaleString('ko-KR') + unit;
  }
  if(unit === 'p') {
    return sign + Math.round(absN).toLocaleString('ko-KR') + 'p';
  }
  return sign + absN.toLocaleString('ko-KR', {minimumFractionDigits:1, maximumFractionDigits:1}) + (unit||'');
}

/* ═══════════════════════════════════════════
   JS § 7. 차트 레이블 생성
   · makeLabels(rows): API rows → 차트 레이블
   · makeMonthLabels(): 샘플용 1월~12월
   ═══════════════════════════════════════════ */


function makeLabels(rows) {
  return rows.map(function(r){
    if(r.ym && r.ym.length === 8) {
      // 일별(MM/DD): makeLabels가 MM/DD 형식 반환 → renderChart에서 월 단위로 표시
      return r.ym.substring(4,6)+'/'+r.ym.substring(6,8);
    }
    if(r.ym && r.ym.indexOf('Q') >= 0) return r.ym.substring(2,4)+'.'+r.ym.substring(4);
    return r.ym ? r.ym.substring(2,4)+'.'+r.ym.substring(4,6) : r;
  });
}
function makeMonthLabels() {
  return ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
}
/* ===========================================
   JS § 8. 차트 렌더링 (renderChart)
   · 일별 데이터(KOSPI 등): 포인트 숨김,
     가로축은 월이 바뀌는 첫 포인트에만 "N월" 표시
   · 월별/분기별: 일반 레이블 그대로 표시
   ═══════════════════════════════════════════ */
// 일별 데이터(KOSPI 등)일 때: 데이터 포인트는 일별 그대로 유지하되
// 가로축 레이블만 "월이 바뀌는 첫 번째 인덱스"에만 월 표시
function renderChart(vals, prevVals, labels, d) {
  if(mc){ mc.destroy(); mc = null; }

  // MM/DD 형식이면 일별 데이터로 판단
  var isDaily = labels.length > 0 && /^\d{2}\/\d{2}$/.test(labels[0]);

  // 일별일 때: 월이 바뀌는 첫 포인트에만 "N월" 표시, 나머지 빈 문자열
  var monthLabels = null;
  if(isDaily) {
    var lastMM = '';
    monthLabels = labels.map(function(lbl) {
      var mm = lbl.substring(0, 2); // "04" 등
      if(mm !== lastMM) {
        lastMM = mm;
        return parseInt(mm, 10) + '월'; // "4월"
      }
      return '';
    });
  }

  setTimeout(function(){
    var ctx = document.getElementById('mc').getContext('2d');
    var ptR  = isDaily ? 0 : 3;
    var ptR2 = isDaily ? 0 : 2;

    var datasets = [{
      label:'금년', data:vals,
      borderColor:d.color, backgroundColor:d.color+'18',
      borderWidth:2, pointRadius:ptR, pointBackgroundColor:d.color,
      fill:true, tension:0.35
    }];
    if(prevVals && prevVals.length > 0) {
      datasets.push({
        label:'전년', data:prevVals,
        borderColor:d.color+'88', backgroundColor:'transparent',
        borderWidth:1.5, borderDash:[5,4],
        pointRadius:ptR2, pointBackgroundColor:d.color+'88',
        fill:false, tension:0.35
      });
    }

    mc = new Chart(ctx, {
      type:'line',
      data:{labels:labels, datasets:datasets},
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{legend:{display:false}},
        scales:{
          x:{
            grid:{color:'rgba(128,128,128,0.07)'},
            ticks:{
              font:{size:9}, maxRotation:0,
              autoSkip: false,
              // 일별: 월이 바뀌는 첫 포인트에만 "N월"
              // 월별: 1월 → 연도('YY년), 4·7·10월 → 월만, 나머지 숨김
              callback: isDaily
                ? function(value, index) { return monthLabels[index] || ''; }
                : function(value, index) {
                    var lbl = labels[index];
                    if (!lbl) return '';
                    // lbl 형식: "24.01" (YY.MM)
                    var dot = lbl.indexOf('.');
                    if (dot < 0) return lbl; // 분기 등 다른 형식은 그대로
                    var yy = lbl.substring(0, dot);
                    var mm = parseInt(lbl.substring(dot + 1), 10);
                    if (mm === 1)  return "'" + yy + '년';
                    if (mm === 4 || mm === 7 || mm === 10) return mm + '월';
                    return '';
                  }
            }
          },
          y:{grid:{color:'rgba(128,128,128,0.07)'}, ticks:{font:{size:9}}}
        }
      }
    });
  }, 10);
}


/* ═══════════════════════════════════════════
   JS § 9. 출처 메타 표시 헬퍼
   · setMetaSample(d): 빨간색 "샘플 데이터" 표시
   · setMetaLive(d, src): 실시간 ECOS/KOSIS 표시
   · setMetaLoading(): 로딩 중 표시
   ═══════════════════════════════════════════ */
function setMetaSample(d) {
  var el = document.getElementById('cmeta');
  el.textContent = d.meta + ' 〔샘플 데이터〕';
  el.className = 'chart-src is-sample';
}
function setMetaLive(d, src) {
  var el = document.getElementById('cmeta');
  el.textContent = d.meta + ' (실시간 ' + src + ')';
  el.className = 'chart-src';
}
function setMetaLoading() {
  var el = document.getElementById('cmeta');
  el.textContent = '🔄 실시간 데이터 불러오는 중...';
  el.className = 'chart-src';
}

/* JS § 9-1. 가계소득 원 단위 포맷 (fmtIncome) — fmtVal로 대체 가능, 하위호환용 */
function fmtIncome(val) {
  return Number(val).toLocaleString('ko-KR') + '원';
}

/* ═══════════════════════════════════════════
   JS § 10. KPI 패널 업데이트
   ═══════════════════════════════════════════ */

/* 전년비 카드: 텍스트 + 색상 클래스 동시 적용 */
function setYoyKpi(yoyDiff, unit, formattedText) {
  var el = document.getElementById('syoy');
  if(!el) return;
  var txt = formattedText !== undefined
    ? formattedText
    : (yoyDiff !== null ? fmtVal(yoyDiff, unit, true) : '-');
  el.textContent = txt;
  var n = Number(yoyDiff);
  el.className = 'kv ' + (n > 0 ? 'up' : n < 0 ? 'down' : 'neu');
}

function updateKPI(d) {
  document.getElementById('scur').textContent  = d.cur  || '-';
  document.getElementById('savg').textContent  = d.avg  || '-';
  var schg = document.getElementById('schg');
  schg.textContent = d.chg || '-';
  schg.className   = 'kv ' + (d.cc || 'neu');
  document.getElementById('snote').textContent  = d.note || '';
  document.getElementById('synote').textContent = d.yn   || '';
  setYoyKpi(d.yoy, null, d.yoy || '-');
}
/* ===========================================
   JS § 13. ECOS 차트 로드 (loadEcosChart)
   · API 성공 → 실시간 데이터로 KPI + 차트 갱신
   · API 실패 → 샘플 데이터 fallback
   ═══════════════════════════════════════════ */
async function loadEcosChart(key) {
  var d = CD[key]; if(!d) return;
  var _wrap = document.querySelector('.canvas-wrap');
  if(_wrap) _wrap.style.height = '150px';
  document.getElementById('ctitle').textContent = d.title;
  document.getElementById('cmeta').textContent  = '🔄 실시간 데이터 불러오는 중...';
  document.getElementById('scur').textContent   = '...';
  document.getElementById('savg').textContent   = '...';
  document.getElementById('syoy').textContent   = '...';

  // data.json에서 로드
  var jsonData = await loadDataJson();
  var rows = jsonData ? jsonData[key] : null;

  if(!rows||rows.length===0) {
    setMetaSample(d);
    updateKPI(d);
    renderChart(d.data||[], null, makeMonthLabels(), d);
    return;
  }

  var vals   = rows.map(function(r){return r.val;});
  var labels = makeLabels(rows);
  var latest = vals[vals.length-1];
  var avg6   = vals.slice(-6).reduce(function(a,b){return a+b;},0)/Math.min(6,vals.length);
  var diff   = latest - (vals[vals.length-2]||latest);

  // 전년 대비 KPI 계산 (차트 라인 별도 표시 안 함 — 2년 시계열에 이미 포함)
  var yoyDiff = vals.length >= 13
    ? (latest - vals[vals.length-13])
    : null;

  document.getElementById('ctitle').textContent = d.title;
  setMetaLive(d, 'data.json');
  document.getElementById('scur').textContent   = fmtVal(latest, d.unit);
  document.getElementById('savg').textContent   = fmtVal(avg6, d.unit);
  setYoyKpi(yoyDiff, d.unit);
  var schg = document.getElementById('schg');
  schg.textContent = fmtDiff(diff, d.unit);
  schg.className = 'kv ' + (diff>0?'up':diff<0?'down':'neu');
  document.getElementById('snote').textContent  = d.note;
  document.getElementById('synote').textContent = d.yn;

  renderChart(vals, null, labels, d);
}

/* ═══════════════════════════════════════════
   JS § 14. KOSIS 차트 로드 (loadKosisChart)
   · API 성공 → 실시간 데이터로 KPI + 차트 갱신
   · API 실패 → 샘플 데이터 fallback
   ═══════════════════════════════════════════ */
async function loadKosisChart(key) {
  var d = CD[key]; if(!d) return;
  var _wrap = document.querySelector('.canvas-wrap');
  if(_wrap) _wrap.style.height = '150px';
  document.getElementById('ctitle').textContent = d.title;
  document.getElementById('cmeta').textContent  = '🔄 실시간 데이터 불러오는 중...';
  document.getElementById('scur').textContent   = '...';
  document.getElementById('savg').textContent   = '...';
  document.getElementById('syoy').textContent   = '...';

  var jsonData = await loadDataJson();
  var rows = jsonData ? jsonData[key] : null;

  if(!rows||rows.length===0) {
    setMetaSample(d);
    updateKPI(d);
    renderChart(d.data||[], null, makeMonthLabels(), d);
    return;
  }

  var vals     = rows.map(function(r){return r.val;});
  var labels   = makeLabels(rows);
  var latest   = vals[vals.length-1];
  var avg6     = vals.slice(-6).reduce(function(a,b){return a+b;},0)/Math.min(6,vals.length);
  var diff     = latest - (vals[vals.length-2]||latest);
  var yoyDiff  = vals.length >= 13 ? (latest - vals[vals.length-13]) : null;
  var prevVals = null;

  // online: 억원→조 변환 (소수점 1자리)
  var displayUnit = d.unit;
  var displayLatest = latest;
  var displayAvg = avg6;
  var displayYoy = yoyDiff;
  var displayDiff = diff;
  if(key === 'online') {
    displayLatest = latest / 1000000;
    displayAvg    = avg6   / 1000000;
    displayYoy    = yoyDiff !== null ? yoyDiff / 1000000 : null;
    displayDiff   = diff   / 1000000;
    // 조 단위는 소수점 1자리로 표시
    var fmtJo = function(v, isDiff) {
      if(v === null || isNaN(v)) return '-';
      var sign = isDiff ? (v > 0 ? '+' : '') : '';
      return sign + v.toLocaleString('ko-KR', {minimumFractionDigits:1, maximumFractionDigits:1}) + '조';
    };
    document.getElementById('ctitle').textContent = d.title;
    setMetaLive(d, 'data.json');
    document.getElementById('scur').textContent = fmtJo(displayLatest);
    document.getElementById('savg').textContent = fmtJo(displayAvg);
    setYoyKpi(displayYoy, null, displayYoy !== null ? fmtJo(displayYoy, true) : '-');
    var schg = document.getElementById('schg');
    var sign2 = displayDiff > 0 ? '▲ +' : displayDiff < 0 ? '▼ ' : '= ';
    schg.textContent = sign2 + Math.abs(displayDiff).toLocaleString('ko-KR',{minimumFractionDigits:1,maximumFractionDigits:1}) + '조';
    schg.className = 'kv ' + (displayDiff>0?'up':displayDiff<0?'down':'neu');
    document.getElementById('snote').textContent  = d.note;
    document.getElementById('synote').textContent = d.yn;
    renderChart(vals, prevVals, labels, d);
    return;
  }

  document.getElementById('ctitle').textContent = d.title;
  setMetaLive(d, 'data.json');
  document.getElementById('scur').textContent   = fmtVal(displayLatest, displayUnit);
  document.getElementById('savg').textContent   = fmtVal(displayAvg, displayUnit);
  setYoyKpi(yoyDiff, displayUnit);
  var schg = document.getElementById('schg');
  schg.textContent = fmtDiff(diff, displayUnit);
  schg.className = 'kv ' + (diff>0?'up':diff<0?'down':'neu');
  document.getElementById('snote').textContent  = d.note;
  document.getElementById('synote').textContent = d.yn;

  renderChart(vals, prevVals, labels, d);
}
/* ═══════════════════════════════════════════
   JS § 14-2. 기준금리 스텝 차트 (loadRateChart)
   · X축: 월별 레이블
   · 데이터 포인트: 한국은행 결정일에만 표시
   · 선 형태: 계단(stepped) — 결정 후 유지
   ═══════════════════════════════════════════ */
/* rate_decisions → 월별 시계열 변환 (JS) */
function decisionsToMonthly(decisions, startYm) {
  startYm = startYm || '202401';
  var now = new Date();
  var endY = now.getFullYear(), endM = now.getMonth() + 1;
  var months = [];
  var y = parseInt(startYm.substring(0,4)), m = parseInt(startYm.substring(4,6));
  while(y < endY || (y === endY && m <= endM)) {
    months.push(y.toString() + (m<10?'0':'') + m.toString());
    m++; if(m>12){m=1;y++;}
  }
  return months.map(function(ym) {
    var val = null;
    for(var i = decisions.length-1; i>=0; i--) {
      if(decisions[i].date.substring(0,6) <= ym){ val = decisions[i].val; break; }
    }
    return val !== null ? {ym:ym, val:val} : null;
  }).filter(Boolean);
}

async function loadRateChart() {
  var d = CD['rate']; if(!d) return;
  var _wrap = document.querySelector('.canvas-wrap');
  if(_wrap) _wrap.style.height = '170px';

  document.getElementById('ctitle').textContent = d.title;
  document.getElementById('cmeta').textContent  = '🔄 실시간 데이터 불러오는 중...';
  document.getElementById('scur').textContent   = '...';
  document.getElementById('savg').textContent   = '...';

  var jsonData  = await loadDataJson();
  var decisions = jsonData ? jsonData['rate_decisions'] : null;

  if(!decisions || decisions.length === 0) {
    setMetaSample(d);
    updateKPI(d);
    renderChart(d.data||[], null, makeMonthLabels(), d);
    return;
  }

  /* decisions → 월별 시계열 (2024-01 ~ 현재) */
  var rows   = decisionsToMonthly(decisions, '202401');
  var vals   = rows.map(function(r){return r.val;});
  var ymList = rows.map(function(r){return r.ym;});
  var labels = makeLabels(rows);

  /* KPI */
  var latest  = vals[vals.length-1];
  var avg6    = vals.slice(-6).reduce(function(a,b){return a+b;},0)/Math.min(6,vals.length);
  var yoyDiff = vals.length>=13 ? round2(latest-vals[vals.length-13]) : null;
  /* 전월비: 마지막 실제 변경 폭 (직전 결정 대비) */
  var lastDec = decisions[decisions.length-1];
  var prevDec = decisions.length>=2 ? decisions[decisions.length-2] : null;
  var diff    = prevDec ? round2(lastDec.val - prevDec.val) : 0;

  function round2(v){ return Math.round(v*100)/100; }

  setMetaLive(d, 'data.json');
  document.getElementById('ctitle').textContent = d.title;
  document.getElementById('scur').textContent   = fmtVal(latest, d.unit);
  document.getElementById('savg').textContent   = fmtVal(avg6, d.unit);
  setYoyKpi(yoyDiff, d.unit);
  var schg = document.getElementById('schg');
  schg.textContent = diff !== 0 ? fmtDiff(diff, d.unit) : '동결';
  schg.className   = 'kv ' + (diff>0?'up':diff<0?'down':'neu');
  document.getElementById('snote').textContent  = d.note;
  document.getElementById('synote').textContent = d.yn;

  /* 결정월 마킹 */
  var decisionMonths = {};
  decisions.forEach(function(dec){ decisionMonths[dec.date.substring(0,6)] = true; });
  var pointRadii = ymList.map(function(ym){ return decisionMonths[ym] ? 5 : 0; });
  var pointColors= ymList.map(function(ym){ return decisionMonths[ym] ? d.color : 'transparent'; });

  if(mc){ mc.destroy(); mc = null; }
  setTimeout(function(){
    var ctx = document.getElementById('mc').getContext('2d');
    mc = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: '기준금리',
          data: vals,
          borderColor: d.color,
          backgroundColor: d.color + '18',
          borderWidth: 2,
          stepped: 'after',
          pointRadius: pointRadii,
          pointBackgroundColor: pointColors,
          pointHoverRadius: 6,
          fill: true,
          tension: 0
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: 'index', intersect: false,
            callbacks: {
              label: function(ctx) { return '기준금리: ' + ctx.parsed.y.toFixed(2) + '%'; },
              afterLabel: function(ctx) { return decisionMonths[ymList[ctx.dataIndex]] ? '📌 한국은행 결정월' : ''; }
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(128,128,128,0.07)' },
            ticks: {
              font:{size:9}, maxRotation:0, autoSkip:false,
              callback: function(value, index) {
                var lbl = labels[index]; if(!lbl) return '';
                var dot = lbl.indexOf('.');
                if(dot<0) return lbl;
                var mm = parseInt(lbl.substring(dot+1), 10);
                /* 2008년부터 장기 시계열 — 1월마다 연도만 표시 */
                if(mm === 1) return lbl.substring(0, dot) + '년';
                return '';
              }
            }
          },
          y: {
            grid: { color: 'rgba(128,128,128,0.07)' },
            ticks: { font:{size:9}, callback: function(v){ return v.toFixed(2)+'%'; } },
            title: { display:true, text:'기준금리 (%)', font:{size:8}, color:'var(--text3)' }
          }
        }
      }
    });
  }, 10);
}

/* ===========================================
   JS § 15. 카테고리 토글 (toggleCat)
   · 카테고리 버튼 클릭 → 해당 서브패널 열림
   ═══════════════════════════════════════════ */
function toggleCat(btn, grpId) {
  var isOpen = btn.classList.contains('open');
  document.querySelectorAll('.cat-col-btn').forEach(function(b){ b.classList.remove('open'); });
  document.querySelectorAll('.sub-panel').forEach(function(s){ s.classList.remove('open'); });
  if(!isOpen) {
    btn.classList.add('open');
    var grp = document.getElementById(grpId);
    if(grp) grp.classList.add('open');

    /* 하위 첫 번째 버튼 자동 활성화 */
    var firstSubBtn = grp && grp.querySelector('.sub-btn');
    if(firstSubBtn) firstSubBtn.click();
  }
}

/* ═══════════════════════════════════════════
   JS § 16. 지표 선택 (selChart)
   · 버튼 클릭 → ECOS/KOSIS/샘플 분기 처리
   · AI 해석 초기화
   ═══════════════════════════════════════════ */
function selChart(key, btn, grpId) {
  // onload 전에 호출되는 경우의 안전망
  selChartWithAPI(key, btn, grpId);
}

async function selChartWithAPI(key, btn, grpId) {
  curKey = key;
  document.querySelectorAll('.sub-btn').forEach(function(b){ b.classList.remove('on'); });
  btn.classList.add('on');
  document.querySelectorAll('.sub-panel').forEach(function(s){ s.classList.remove('open'); });
  document.querySelectorAll('.cat-col-btn').forEach(function(b){ b.classList.remove('open'); });
  var grp = document.getElementById(grpId);
  if(grp) grp.classList.add('open');
var grpToBtnIdx = {'grp1':0,'grp3':1,'grp4':2,'grp7':3,'grp5':4};
var idx = grpToBtnIdx[grpId];
var catBtns = document.querySelectorAll('.cat-col-btn');
if(idx !== undefined && catBtns[idx]) catBtns[idx].classList.add('open');



  // ★ 지수 설명 표시 (indexNote가 있는 지표만)
  var noteEl = document.getElementById('index-note');
  var d0 = CD[key];
  if(noteEl) {
    if(d0 && d0.indexNote) {
      noteEl.textContent = '💡 ' + d0.indexNote;
      noteEl.classList.add('show');
    } else {
      noteEl.textContent = '';
      noteEl.classList.remove('show');
    }
  }

  var d = CD[key]; if(!d) return;

  /* 유통채널 외 지표 선택 시 품목 필터 패널 숨김 */
  if(key!=='dept' && key!=='mart' && key!=='convenience') hideItemFilterPanel();

  if(key === 'rate') {
    await loadRateChart();
  } else if(ECOS_MAP[key]) {
    await loadEcosChart(key);
  } else if(key==='dept'||key==='mart'||key==='convenience') {
    await loadRetailItemChart(key);
  } else if(KOSIS_MAP[key]) {
    await loadKosisChart(key);
  } else {
    document.getElementById('ctitle').textContent = d.title;
    document.getElementById('cmeta').textContent  = d.meta+' (샘플 데이터)';
    updateKPI(d);
    renderChart(d.data||[], null, makeMonthLabels(), d);
  }

  /* AI 지표 해석 (AI 키 설정 시 자동 실행) */
  if (typeof runIndicatorInsight === 'function') {
    runIndicatorInsight(key);
  }
}

/* ═══════════════════════════════════════════
   JS § 17. 유통채널 품목별 멀티라인 차트
   · loadRetailItemChart(key): 합계 KPI + 품목 체크박스
   · renderCheckedRetailItems(): 체크된 품목만 차트 렌더
   ═══════════════════════════════════════════ */
var RETAIL_PALETTE = [
  '#185FA5','#1D9E75','#D85A30','#7B5EA7','#E6A817',
  '#2E86AB','#A23B72','#F18F01','#4B8B3B','#C0392B'
];

/* 현재 로드된 품목 데이터 (체크박스 변경 시 재렌더용) */
var _retailItemsObj  = null;
var _retailYmList    = [];
var _retailLabels    = [];
var _retailChartDef  = null;

function renderRetailItemsChart(itemsObj, ymList, labels, d) {
  if(mc){ mc.destroy(); mc = null; }
  var itemNames = Object.keys(itemsObj);
  var allNames  = Object.keys(_retailItemsObj || itemsObj);

  var datasets = itemNames.map(function(nm) {
    var paletteIdx = allNames.indexOf(nm);
    var valMap = {};
    itemsObj[nm].forEach(function(r){ valMap[r.ym] = r.val; });
    var vals = ymList.map(function(ym){
      return valMap[ym] !== undefined ? valMap[ym] : null;
    });
    var color = RETAIL_PALETTE[paletteIdx % RETAIL_PALETTE.length];
    return {
      label: nm,
      data: vals,
      borderColor: color,
      backgroundColor: 'transparent',
      borderWidth: nm === '총계' ? 2 : 1.5,
      pointRadius: 1.5,
      pointHoverRadius: 4,
      fill: false,
      tension: 0.35,
      spanGaps: true
    };
  });

  var _wrap = document.querySelector('.canvas-wrap');
  var hasLegend = itemNames.length > 1;
  if(_wrap) _wrap.style.height = hasLegend ? '182px' : '150px';

  setTimeout(function(){
    var ctx = document.getElementById('mc').getContext('2d');
    mc = new Chart(ctx, {
      type: 'line',
      data: {labels: labels, datasets: datasets},
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: {
            display: hasLegend, position: 'bottom',
            labels: {font:{size:8}, boxWidth:10, padding:5, usePointStyle:true}
          },
          tooltip: {mode:'index', intersect:false}
        },
        scales: {
          x: {
            grid: {color:'rgba(128,128,128,0.07)'},
            ticks: {
              font:{size:9}, maxRotation:0, autoSkip:false,
              callback: function(value, index) {
                var lbl = labels[index]; if(!lbl) return '';
                var dot = lbl.indexOf('.'); if(dot<0) return lbl;
                var yy = lbl.substring(0,dot);
                var mm = parseInt(lbl.substring(dot+1), 10);
                if(mm===1)  return "'"+yy+'년';
                if(mm===4||mm===7||mm===10) return mm+'월';
                return '';
              }
            }
          },
          y: {
            grid: {color:'rgba(128,128,128,0.07)'},
            ticks: {font:{size:9}},
            title: {display:true, text:'전년동월비 (%)', font:{size:8}, color:'var(--text3)'}
          }
        }
      }
    });
  }, 10);
}

/* 체크된 품목만 걸러서 차트 재렌더 */
function renderCheckedRetailItems() {
  if(!_retailItemsObj) return;
  var checked = Array.from(
    document.querySelectorAll('#item-filter-checks input:checked')
  ).map(function(el){ return el.value; });
  if(checked.length === 0) return;
  var filtered = {};
  checked.forEach(function(nm){ if(_retailItemsObj[nm]) filtered[nm] = _retailItemsObj[nm]; });
  renderRetailItemsChart(filtered, _retailYmList, _retailLabels, _retailChartDef);
}

/* 개별 체크박스 변경 */
function onRetailItemChange() {
  /* 전체 체크박스 동기화 */
  var all  = document.querySelectorAll('#item-filter-checks input');
  var chkd = document.querySelectorAll('#item-filter-checks input:checked');
  var allChk = document.getElementById('item-chk-all');
  if(allChk) allChk.checked = (all.length === chkd.length);
  renderCheckedRetailItems();
}

/* 전체 선택/해제 */
function onRetailAllChange(master) {
  document.querySelectorAll('#item-filter-checks input').forEach(function(el){
    el.checked = master.checked;
  });
  renderCheckedRetailItems();
}

/* 품목 체크박스 패널 구성 */
function buildItemFilterPanel(itemsObj) {
  var panel  = document.getElementById('item-filter-panel');
  var checks = document.getElementById('item-filter-checks');
  var allChk = document.getElementById('item-chk-all');
  if(!panel || !checks) return;
  checks.innerHTML = '';
  var names = Object.keys(itemsObj);
  names.forEach(function(nm) {
    var lbl = document.createElement('label');
    lbl.className = 'item-chk-label';
    var inp = document.createElement('input');
    inp.type  = 'checkbox';
    inp.value = nm;
    inp.checked = (nm === '총계');
    inp.onchange = onRetailItemChange;
    lbl.appendChild(inp);
    lbl.appendChild(document.createTextNode(nm));
    checks.appendChild(lbl);
  });
  if(allChk) allChk.checked = false;
  panel.style.display = 'block';
}

/* 품목 필터 패널 숨김 */
function hideItemFilterPanel() {
  var panel = document.getElementById('item-filter-panel');
  if(panel) panel.style.display = 'none';
  _retailItemsObj = null;
}

async function loadRetailItemChart(key) {
  var d = CD[key]; if(!d) return;
  document.getElementById('ctitle').textContent = d.title;
  document.getElementById('cmeta').textContent  = '🔄 실시간 데이터 불러오는 중...';
  document.getElementById('scur').textContent   = '...';
  document.getElementById('savg').textContent   = '...';
  document.getElementById('syoy').textContent   = '...';

  var jsonData  = await loadDataJson();
  var totalRows = jsonData ? jsonData[key]           : null;
  var itemsObj  = jsonData ? jsonData[key+'_items']  : null;

  if(!totalRows || totalRows.length === 0) {
    setMetaSample(d);
    updateKPI(d);
    hideItemFilterPanel();
    renderChart(d.data||[], null, makeMonthLabels(), d);
    return;
  }

  var vals    = totalRows.map(function(r){return r.val;});
  var ymList  = totalRows.map(function(r){return r.ym;});
  var labels  = makeLabels(totalRows);
  var latest  = vals[vals.length-1];
  var avg6    = vals.slice(-6).reduce(function(a,b){return a+b;},0)/Math.min(6,vals.length);
  var yoyDiff = vals.length>=13 ? (latest-vals[vals.length-13]) : null;
  var diff    = latest - (vals[vals.length-2]||latest);

  setMetaLive(d, 'data.json');
  document.getElementById('ctitle').textContent = d.title;
  document.getElementById('scur').textContent   = fmtVal(latest, d.unit);
  document.getElementById('savg').textContent   = fmtVal(avg6, d.unit);
  setYoyKpi(yoyDiff, d.unit);
  var schg = document.getElementById('schg');
  schg.textContent = fmtDiff(diff, d.unit);
  schg.className   = 'kv '+(diff>0?'up':diff<0?'down':'neu');
  document.getElementById('snote').textContent  = d.note;
  document.getElementById('synote').textContent = d.yn;

  if(itemsObj && Object.keys(itemsObj).length > 0) {
    _retailItemsObj = itemsObj;
    _retailYmList   = ymList;
    _retailLabels   = labels;
    _retailChartDef = d;
    buildItemFilterPanel(itemsObj);
    /* 기본: 총계만 체크된 상태로 렌더 */
    renderCheckedRetailItems();
  } else {
    hideItemFilterPanel();
    renderChart(vals, null, labels, d);
  }
}
