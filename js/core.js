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
              // 일별: 월이 바뀌는 곳에만 레이블, 나머지 빈칸
              // 월별: 그대로 표시
              callback: isDaily
                ? function(value, index) { return monthLabels[index] || ''; }
                : function(value, index) { return labels[index]; }
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
   JS § 10. KPI 패널 업데이트 (샘플 fallback)
   · API 실패 시 CD 객체의 cur/avg/yoy 값 표시
   ═══════════════════════════════════════════ */
function updateKPI(d) {
  // 샘플 데이터는 CD에 저장된 cur/avg/yoy 문자열 그대로 사용
  // (이미 포맷된 문자열이거나 계산된 값)
  document.getElementById('scur').textContent  = d.cur  || '-';
  document.getElementById('savg').textContent  = d.avg  || '-';
  document.getElementById('syoy').textContent  = d.yoy  || '-';
  var schg = document.getElementById('schg');
  schg.textContent = d.chg || '-';
  schg.className   = 'kc ' + (d.cc || 'neu');
  document.getElementById('snote').textContent  = d.note || '';
  document.getElementById('synote').textContent = d.yn   || '';
}
/* ===========================================
   JS § 13. ECOS 차트 로드 (loadEcosChart)
   · API 성공 → 실시간 데이터로 KPI + 차트 갱신
   · API 실패 → 샘플 데이터 fallback
   ═══════════════════════════════════════════ */
async function loadEcosChart(key) {
  var d = CD[key]; if(!d) return;
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

  // 전년 대비: rows 앞부분에서 계산
  var prevChartVals = vals.length >= 13 ? vals.slice(0, vals.length-12) : null;

  var yoyDiff = vals.length >= 13
    ? (latest - vals[vals.length-13])
    : null;

  document.getElementById('ctitle').textContent = d.title;
  setMetaLive(d, 'data.json');
  document.getElementById('scur').textContent   = fmtVal(latest, d.unit);
  document.getElementById('savg').textContent   = fmtVal(avg6, d.unit);
  document.getElementById('syoy').textContent   = yoyDiff !== null ? fmtVal(yoyDiff, d.unit, true) : '-';
  var schg = document.getElementById('schg');
  schg.textContent = fmtDiff(diff, d.unit);
  schg.className = 'kc ' + (diff>0?'up':diff<0?'down':'neu');
  document.getElementById('snote').textContent  = d.note;
  document.getElementById('synote').textContent = d.yn;

  renderChart(vals, prevChartVals, labels, d);
}

/* ═══════════════════════════════════════════
   JS § 13-1. KOSIS 연간 데이터 fetch + 차트 로드
   · 합계출산율(TFR) / 조혼인율 등 prdSe=Y 전용
   · 연간 레이블: "2020", "2021" ... 형식으로 표시
   · 차트: 막대(bar) 형태로 연도별 추이 강조
   ═══════════════════════════════════════════ */


async function loadKosisAnnualChart(key) {
  var d = CD[key]; if(!d) return;
  document.getElementById('ctitle').textContent = d.title;
  setMetaLoading();
  document.getElementById('scur').textContent = '...';
  document.getElementById('savg').textContent = '...';
  document.getElementById('syoy').textContent = '...';

  var jsonData = await loadDataJson();
  var rows = jsonData ? jsonData[key] : null;

  if(!rows || rows.length === 0) {
    /* API 실패 → 샘플 데이터 fallback */
    setMetaSample(d);
    updateKPI(d);
    /* 샘플 데이터로 연간 차트 렌더 */
    var sampleYears = [];
    var startY = new Date().getFullYear() - (d.data.length - 1);
    for(var i = 0; i < d.data.length; i++) sampleYears.push(String(startY + i));
    renderAnnualChart(d.data, sampleYears, d);
    return;
  }

  var vals   = rows.map(function(r){ return r.val; });
  var labels = rows.map(function(r){ return r.ym; }); /* "2023" 형식 */
  var latest = vals[vals.length - 1];
  var prev   = vals[vals.length - 2] || latest;
  var avg6   = vals.slice(-6).reduce(function(a,b){ return a+b; }, 0) / Math.min(6, vals.length);
  var diff   = latest - prev;
  var yoyDiff = vals.length >= 2 ? (latest - vals[vals.length - 2]) : null;

  setMetaLive(d, 'data.json');
  document.getElementById('ctitle').textContent = d.title;
  document.getElementById('scur').textContent   = fmtVal(latest, d.unit);
  document.getElementById('savg').textContent   = fmtVal(avg6,   d.unit);
  document.getElementById('syoy').textContent   = yoyDiff !== null ? fmtVal(yoyDiff, d.unit, true) : '-';
  var schg = document.getElementById('schg');
  schg.textContent = fmtDiff(diff, d.unit);
  schg.className   = 'kc ' + (diff > 0 ? 'up' : diff < 0 ? 'down' : 'neu');
  document.getElementById('snote').textContent  = d.note;
  document.getElementById('synote').textContent = d.yn;

  renderAnnualChart(vals, labels, d);
}

/* 연간 데이터 전용 차트: 막대(bar) + 선 혼합 */
function renderAnnualChart(vals, labels, d) {
  if(mc){ mc.destroy(); mc = null; }
  setTimeout(function(){
    var ctx = document.getElementById('mc').getContext('2d');
    mc = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: '연간',
          data: vals,
          backgroundColor: d.color + 'BB',
          borderColor:     d.color,
          borderWidth: 1.5,
          borderRadius: 3
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            grid: { color: 'rgba(128,128,128,0.07)' },
            ticks: { font: { size: 9 }, maxRotation: 0 }
          },
          y: {
            grid: { color: 'rgba(128,128,128,0.07)' },
            ticks: { font: { size: 9 } }
          }
        }
      }
    });
  }, 10);
}

/* ═══════════════════════════════════════════
   JS § 14. KOSIS 차트 로드 (loadKosisChart)
   · API 성공 → 실시간 데이터로 KPI + 차트 갱신
   · API 실패 → 샘플 데이터 fallback
   ═══════════════════════════════════════════ */
async function loadKosisChart(key) {
  var d = CD[key]; if(!d) return;
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
    document.getElementById('syoy').textContent = displayYoy !== null ? fmtJo(displayYoy, true) : '-';
    var schg = document.getElementById('schg');
    var sign2 = displayDiff > 0 ? '▲ +' : displayDiff < 0 ? '▼ ' : '= ';
    schg.textContent = sign2 + Math.abs(displayDiff).toLocaleString('ko-KR',{minimumFractionDigits:1,maximumFractionDigits:1}) + '조';
    schg.className = 'kc ' + (displayDiff>0?'up':displayDiff<0?'down':'neu');
    document.getElementById('snote').textContent  = d.note;
    document.getElementById('synote').textContent = d.yn;
    renderChart(vals, prevVals, labels, d);
    return;
  }

  document.getElementById('ctitle').textContent = d.title;
  setMetaLive(d, 'data.json');
  document.getElementById('scur').textContent   = fmtVal(displayLatest, displayUnit);
  document.getElementById('savg').textContent   = fmtVal(displayAvg, displayUnit);
  document.getElementById('syoy').textContent   = yoyDiff !== null ? fmtVal(yoyDiff, displayUnit, true) : '-';
  var schg = document.getElementById('schg');
  schg.textContent = fmtDiff(diff, displayUnit);
  schg.className = 'kc ' + (diff>0?'up':diff<0?'down':'neu');
  document.getElementById('snote').textContent  = d.note;
  document.getElementById('synote').textContent = d.yn;

  renderChart(vals, prevVals, labels, d);
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
var grpToBtnIdx = {'grp1':0,'grp3':1,'grp4':2,'grp7':3,'grp2':4,'grp5':5,'grp6':6};
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

  if(ECOS_MAP[key]) {
    await loadEcosChart(key);
  } else if(KOSIS_ANNUAL_MAP[key]) {
    /* 연간 전용 지표: 합계출산율, 조혼인율 */
    await loadKosisAnnualChart(key);
  } else if(KOSIS_MAP[key]) {
    await loadKosisChart(key);
  } else {
    document.getElementById('ctitle').textContent = d.title;
    document.getElementById('cmeta').textContent  = d.meta+' (샘플 데이터)';
    updateKPI(d);
    renderChart(d.data||[], null, makeMonthLabels(), d);
  }
}
