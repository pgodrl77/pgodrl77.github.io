/* 세후계산소 계산 모듈 — 모든 금액 입력 단위는 만원, 결과는 원 단위로 표시 */
(function () {
  "use strict";
  var W = 10000;
  function num(id) {
    var el = document.getElementById(id);
    if (!el) return 0;
    var v = parseFloat(String(el.value).replace(/,/g, ""));
    return isFinite(v) ? v : 0;
  }
  function val(id) { var el = document.getElementById(id); return el ? el.value : ""; }
  function won(x) {
    x = Math.round(x);
    var a = Math.abs(x), s = x < 0 ? "-" : "";
    if (a >= 1e8) {
      var eok = Math.floor(a / 1e8), man = Math.round((a % 1e8) / 1e4);
      return s + eok.toLocaleString("ko-KR") + "억" + (man ? " " + man.toLocaleString("ko-KR") + "만" : "") + "원";
    }
    if (a >= 1e4) {
      var m1 = Math.floor(a / 1e4), r1 = Math.round((a % 1e4) / 100) * 100;
      if (r1 === 1e4) { m1 += 1; r1 = 0; }
      return s + m1.toLocaleString("ko-KR") + "만" + (r1 ? " " + r1.toLocaleString("ko-KR") + "원" : "원");
    }
    return s + a.toLocaleString("ko-KR") + "원";
  }
  function pct(x, d) { return (x * 100).toFixed(d == null ? 1 : d) + "%"; }
  function show(box, big, rows, note) {
    var html = '<div class="big">' + big + "</div><ul class=\"rows\">";
    rows.forEach(function (r) { html += "<li><span>" + r[0] + "</span><b>" + r[1] + "</b></li>"; });
    html += "</ul>";
    if (note) html += '<div class="note">' + note + "</div>";
    box.innerHTML = html;
    box.classList.add("on");
  }

  /* 종합소득세 기본세율 (2023년 귀속 이후) — 과세표준 원 단위 */
  var BRACKETS = [
    [14e6, 0.06, 0], [50e6, 0.15, 1.26e6], [88e6, 0.24, 5.76e6], [150e6, 0.35, 15.44e6],
    [300e6, 0.38, 19.94e6], [500e6, 0.40, 25.94e6], [1e9, 0.42, 35.94e6], [Infinity, 0.45, 65.94e6]
  ];
  function progTax(base) {
    if (base <= 0) return 0;
    for (var i = 0; i < BRACKETS.length; i++) if (base <= BRACKETS[i][0]) return base * BRACKETS[i][1] - BRACKETS[i][2];
    return 0;
  }
  /* 고배당기업 배당소득 분리과세 (2026~2028 지급분, 지방세 제외) */
  var SEP = [[20e6, 0.14], [300e6, 0.20], [5e9, 0.25], [Infinity, 0.30]];
  function sepTax(x) {
    var t = 0, prev = 0;
    for (var i = 0; i < SEP.length && x > prev; i++) {
      var top = Math.min(x, SEP[i][0]);
      t += (top - prev) * SEP[i][1];
      prev = SEP[i][0];
    }
    return t;
  }

  var C = {};

  C.dividend = function (box) {
    var gross = num("d-amount") * W, type = val("d-type"), rate, label, note = "";
    if (type === "kr") { rate = 0.154; label = "국내 원천징수 15.4% (소득세 14% + 지방소득세 1.4%)"; }
    else if (type === "us") { rate = 0.15; label = "미국 현지 원천징수 15% (한·미 조세조약, 국내 추가 징수 없음)"; }
    else if (type === "isa") {
      var lim = num("d-isa-limit") * W;
      var over = Math.max(0, gross - lim);
      var t = over * 0.099;
      show(box, "세후 " + won(gross - t), [
        ["세전 배당금", won(gross)], ["비과세 한도", won(lim)], ["한도 초과분 (9.9% 분리과세)", won(over)],
        ["예상 세금", won(t)], ["실효세율", gross ? pct(t / gross, 2) : "0%"]
      ], "ISA는 계좌 안에서 발생한 배당·이자·매매손익을 만기(해지) 시점에 합산해 과세합니다. 연간 금액이 아니라 계좌 전체 기간의 순이익 기준입니다.");
      return;
    } else { rate = 0; label = "연금계좌: 인출 전까지 과세이연 (인출 시 연금소득세 3.3~5.5%)"; }
    var tax = gross * rate;
    if (gross > 20e6 && type !== "pension") note = "연간 이자+배당이 2,000만원을 넘으면 초과분이 다른 소득과 합산되는 금융소득종합과세 대상이 됩니다. <a href=\"/financial-income-tax\">추가 세금 계산하기 →</a>";
    show(box, "세후 " + won(gross - tax), [
      ["세전 배당금", won(gross)], ["적용 기준", label], ["원천징수 세금", won(tax)],
      ["실효세율", pct(rate, 1)], ["세후 월 환산", won((gross - tax) / 12)]
    ], note);
  };

  C.reverse = function (box) {
    var net = num("r-net") * W, rate = parseFloat(val("r-type"));
    var gross = net / (1 - rate);
    show(box, "세전 " + won(gross) + " 필요", [
      ["목표 세후 배당", won(net)], ["적용 세율", pct(rate, 1)], ["세금으로 빠지는 돈", won(gross - net)]
    ]);
  };

  C.fin = function (box) {
    var F = num("f-total") * W, S = Math.min(num("f-sep") * W, F), O = num("f-other") * W;
    var R = F - S, withheld = R * 0.14, sepT = sepTax(S), sepExtra = sepT - S * 0.14;
    var base = progTax(O), extra = 0, A = 0, B = 0, over = R > 20e6;
    if (over) {
      A = progTax(O + (R - 20e6)) + 20e6 * 0.14;
      B = base + R * 0.14;
      extra = Math.max(A, B) - base - withheld;
    }
    var totalExtra = (Math.max(0, extra) + Math.max(0, sepExtra)) * 1.1;
    var rows = [
      ["금융소득 합계", won(F)],
      ["종합과세 판정 대상 (분리과세 선택분 제외)", won(R)],
      ["2,000만원 기준 초과 여부", over ? "초과 — 종합과세 대상" : "이하 — 원천징수로 종결"],
      ["이미 원천징수된 세금 (14%)", won(withheld)]
    ];
    if (over) {
      rows.push(["방법 ① 종합과세 산출세액", won(A)]);
      rows.push(["방법 ② 분리과세 가정 세액", won(B)]);
    }
    if (S > 0) rows.push(["고배당 분리과세 세액 (14~30%)", won(sepT)]);
    rows.push(["5월 추가 납부 예상 (지방세 포함)", won(totalExtra)]);
    show(box, totalExtra > 0 ? "추가 납부 약 " + won(totalExtra) : "추가 세금 없음", rows,
      "비교과세: 종합과세로 계산한 세액(①)과 금융소득 전액을 14%로 계산한 세액(②) 중 큰 금액을 냅니다. 배당가산(Gross-up)과 배당세액공제, 각종 공제는 반영하지 않은 추정치입니다.");
  };

  C.monthly = function (box) {
    var target = num("m-target") * W, y = num("m-yield") / 100, rate = parseFloat(val("m-tax"));
    var cur = num("m-now") * W, add = num("m-add") * W, g = num("m-growth") / 100;
    if (y <= 0) { show(box, "배당수익률을 입력하세요", []); return; }
    var need = target * 12 / (1 - rate) / y;
    var rows = [["목표 세후 월 배당", won(target)], ["필요한 세전 연 배당", won(target * 12 / (1 - rate))], ["필요 투자원금", won(need)]];
    if (target * 12 / (1 - rate) > 20e6 && rate > 0) rows.push(["주의", "연 배당 2,000만원 초과 → 종합과세"]);
    var months = null, bal = cur;
    if (bal < need) {
      var my = y / 12 * (1 - rate), mg = Math.pow(1 + g, 1 / 12) - 1;
      for (var m = 1; m <= 600; m++) { bal = bal * (1 + mg) + bal * my + add; if (bal >= need) { months = m; break; } }
      rows.push(["현재 투자금", won(cur)]);
      rows.push(["달성까지 (배당 재투자)", months ? Math.floor(months / 12) + "년 " + (months % 12) + "개월" : "50년 이상"]);
    } else rows.push(["현재 투자금", won(cur) + " — 이미 달성"]);
    show(box, won(need) + " 필요", rows, "주가 상승률과 배당수익률이 매년 일정하다고 가정한 단순 시뮬레이션입니다. 실제 배당은 삭감·증액될 수 있습니다.");
  };

  C.isa = function (box) {
    var p = num("i-profit") * W, lim = num("i-limit") * W;
    var normal = Math.max(0, p) * 0.154, isaT = Math.max(0, p - lim) * 0.099;
    show(box, "절세액 " + won(normal - isaT), [
      ["ISA 계좌 순이익", won(p)], ["비과세 한도", won(lim)], ["ISA 세금 (초과분 9.9%)", won(isaT)],
      ["일반계좌였다면 (15.4%)", won(normal)], ["세후 수령액 (ISA)", won(p - isaT)]
    ], "일반계좌 비교는 배당·이자·해외 ETF 매매차익처럼 15.4%가 과세되는 이익을 기준으로 했습니다. 국내 주식 매매차익은 일반계좌에서도 비과세입니다.");
  };

  C.pension = function (box) {
    var sal = num("p-salary") * W, basis = val("p-basis"), ps = num("p-pension") * W, irp = num("p-irp") * W, isa = num("p-isa") * W;
    var low = basis === "salary" ? sal <= 55e6 : sal <= 45e6;
    var rate = low ? 0.165 : 0.132;
    var a = Math.min(ps, 6e6), b = Math.min(irp, 9e6 - a), isaC = Math.min(isa * 0.1, 3e6);
    var base = a + b + isaC, refund = base * rate;
    var rows = [
      ["공제율", pct(rate, 1) + (low ? " (지방세 포함, 저소득 구간)" : " (지방세 포함)")],
      ["연금저축 공제 대상 (한도 600만원)", won(a)],
      ["IRP 공제 대상 (합산 900만원)", won(b)]
    ];
    if (isa > 0) rows.push(["ISA 만기 이전 추가 (10%, 최대 300만원)", won(isaC)]);
    rows.push(["공제 대상 합계", won(base)]);
    var note = "";
    if (ps + irp > 9e6) note = "연금저축+IRP 합산 900만원을 넘는 " + won(ps + irp - 9e6) + "은 세액공제를 받지 못합니다. (연 1,800만원까지 납입은 가능)";
    else if (a + b < 9e6) note = "추가로 " + won(9e6 - a - b) + "을 더 넣으면 " + won((9e6 - a - b) * rate) + "을 더 돌려받을 수 있습니다.";
    show(box, "환급 예상 " + won(refund), rows, note);
  };

  C.overseas = function (box) {
    var g = num("o-gain") * W, l = num("o-loss") * W, fee = num("o-fee") * W;
    var net = g - l - fee, taxable = Math.max(0, net - 2.5e6), tax = taxable * 0.22;
    var rows = [["실현 이익 합계", won(g)], ["실현 손실 합계", won(l)], ["수수료 등 필요경비", won(fee)],
      ["양도차익 (손익 통산)", won(net)], ["기본공제", "250만원"], ["과세표준", won(taxable)], ["세율", "22% (양도세 20% + 지방세 2%)"]];
    var note = tax > 0 ? "평가손실 종목을 연말 전에 매도해 손실을 확정하면 같은 해 이익과 통산되어 세금이 줄어듭니다. 이익 " + won(taxable) + "을 줄이면 최대 " + won(tax) + " 절세." : "올해 양도차익이 250만원 이하라 낼 세금이 없습니다.";
    show(box, "양도소득세 " + won(tax), rows, note + " 신고·납부 기한은 다음 해 5월입니다.");
  };

  /* 국내 상장주식 매매: 증권거래세(2026: 코스피·코스닥 0.20%, 코넥스 0.10%) + 수수료 + 대주주 양도세 */
  C.domestic = function (box) {
    var b = num("d-buy") * W, s = num("d-sell") * W, r = parseFloat(val("d-mkt")) || 0.002,
      f = (num("d-fee") || 0) / 100, major = val("d-major");
    var fee = (b + s) * f, stt = s * r, gain = s - b, tax = 0, base = 0;
    if (major !== "no") {
      base = Math.max(0, gain - fee - stt - 2.5e6);
      tax = major === "y33" ? base * 0.33 : (base <= 3e8 ? base * 0.22 : 3e8 * 0.22 + (base - 3e8) * 0.275);
    }
    var net = gain - fee - stt - tax, ret = b > 0 ? net / b : 0;
    var be = (1 - f - r) > 0 ? (1 + f) / (1 - f - r) - 1 : 0;
    var mk = r >= 0.002 ? "코스피·코스닥 0.20%" : "코넥스 0.10%";
    var rows = [["매매차익 (매도 − 매수)", won(gain)], ["증권거래세 (" + mk + ", 매도금액 기준)", won(stt)],
      ["증권사 수수료 (매수+매도)", won(fee)]];
    if (major !== "no") rows.push(["양도소득세 과세표준 (250만원 공제 후)", won(base)], ["양도소득세 (지방세 포함)", won(tax)]);
    else rows.push(["양도소득세", "0원 (소액주주 비과세)"]);
    rows.push(["세후 수익률", pct(ret, 2)], ["본전이 되는 주가 상승률", pct(be, 3)]);
    var note = major === "no"
      ? "소액주주는 국내 상장주식 매매차익에 양도세가 없고, 증권거래세와 수수료만 냅니다. 종목당 보유액 50억원 이상이거나 지분율 코스피 1%·코스닥 2%·코넥스 4% 이상이면 대주주로 양도세 대상입니다."
      : "대주주 양도세는 반기 다음 달 말까지 예정신고하고, 다음 해 5월에 확정신고합니다. 같은 해 다른 국내주식 손실과 통산할 수 있습니다.";
    if (gain < 0) note = "손실이 나도 증권거래세는 매도금액 기준으로 냅니다. " + note;
    show(box, (net >= 0 ? "세후 순이익 " : "세후 순손실 ") + won(Math.abs(net)), rows, note);
  };

  /* 보유 주식 기준: 주식 수 × 주당 배당금 × 지급 횟수 (원화·달러) */
  C.holding = function (box) {
    var n = num("h-shares"), dps = num("h-dps"), cur = val("h-cur"), fx = num("h-fx") || 1, basis = val("h-basis"), freq = parseFloat(val("h-freq")) || 4;
    var rate = parseFloat(val("h-tax"));
    var k = cur === "usd" ? fx : 1;
    var annualDps = basis === "per" ? dps * freq : dps;
    var gross = n * annualDps * k, tax = gross * rate, net = gross - tax;
    var rows = [["연간 주당 배당금", (cur === "usd" ? "$" + annualDps.toFixed(4) + " (" + won(annualDps * k) + ")" : won(annualDps))],
      ["세전 연 배당금", won(gross)], ["세금 (" + pct(rate, 1) + ")", won(tax)],
      ["1회 지급 세후 (연 " + freq + "회)", won(net / freq)], ["세후 월평균", won(net / 12)]];
    var price = num("h-price");
    if (price > 0) rows.push(["세전 배당수익률", pct(annualDps / price, 2)]);
    var note = cur === "usd" ? "달러 배당은 지급일 환율로 원화 환산되어 과세됩니다. 환율이 10% 오르면 원화 배당도 10% 늘어납니다." : "";
    if (gross > 20e6 && rate > 0) note += " 연 배당이 2,000만원을 넘어 금융소득종합과세 대상입니다. <a href=\"/financial-income-tax\">추가 세금 계산 →</a>";
    show(box, "세후 연 " + won(net), rows, note);
  };

  /* 배당 재투자(DRIP) 시뮬레이션 — 월 단위 복리 */
  C.drip = function (box) {
    var P0 = num("r-init") * W, add = num("r-add") * W, y = num("r-yield") / 100, dg = num("r-dg") / 100, pg = num("r-pg") / 100;
    var years = Math.min(60, Math.max(1, Math.round(num("r-years")))), rate = parseFloat(val("r-tax")), reinvest = val("r-re") === "1";
    var price = 1, units = P0, principal = P0, cash = 0, cumDiv = 0, rows = [], yld = y;
    var mg = Math.pow(1 + pg, 1 / 12) - 1;
    for (var yr = 1; yr <= years; yr++) {
      var yDiv = 0;
      for (var m = 0; m < 12; m++) {
        price *= 1 + mg;
        units += add / price; principal += add;
        var d = units * price * yld / 12 * (1 - rate);
        yDiv += d; cumDiv += d;
        if (reinvest) units += d / price; else cash += d;
      }
      yld = yld * (1 + dg) / (1 + pg);
      rows.push([yr, principal, units * price + cash, yDiv]);
    }
    var last = rows[rows.length - 1], endVal = last[2], nextMonthly = units * price * yld / 12 * (1 - rate);
    var tbl = '<div class="tablewrap"><table class="yr"><thead><tr><th>연차</th><th>누적 원금</th><th>평가액</th><th>그해 세후 배당</th><th>월평균</th></tr></thead><tbody>';
    rows.forEach(function (r) { if (years <= 15 || r[0] % 5 === 0 || r[0] === 1) tbl += "<tr><td>" + r[0] + "년</td><td>" + won(r[1]) + "</td><td>" + won(r[2]) + "</td><td>" + won(r[3]) + "</td><td>" + won(r[3] / 12) + "</td></tr>"; });
    tbl += "</tbody></table></div>";
    var maxV = Math.max.apply(null, rows.map(function (r) { return r[2]; })) || 1, Wd = 600, H = 220, bw = Wd / rows.length;
    var svg = '<svg class="chart" viewBox="0 0 ' + Wd + " " + (H + 24) + '" role="img" aria-label="연도별 원금과 평가액">';
    rows.forEach(function (r, i) {
      var h1 = r[1] / maxV * H, h2 = r[2] / maxV * H, x = i * bw + bw * 0.15, w = bw * 0.7;
      svg += '<rect x="' + x + '" y="' + (H - h2) + '" width="' + w + '" height="' + h2 + '" fill="#1B64DA" opacity=".85"><title>' + r[0] + "년 평가액 " + won(r[2]) + "</title></rect>";
      svg += '<rect x="' + x + '" y="' + (H - h1) + '" width="' + w + '" height="' + h1 + '" fill="#9EC1F5"><title>' + r[0] + "년 누적 원금 " + won(r[1]) + "</title></rect>";
      if (rows.length <= 15 || r[0] % 5 === 0) svg += '<text x="' + (x + w / 2) + '" y="' + (H + 16) + '" text-anchor="middle" font-size="11" fill="#5b6475">' + r[0] + "</text>";
    });
    svg += "</svg><div class=\"legend\"><span><i style=\"background:#9EC1F5\"></i>누적 원금</span><span><i style=\"background:#1B64DA\"></i>평가액</span></div>";
    show(box, years + "년 뒤 " + won(endVal), [
      ["넣은 원금 합계", won(last[1])], ["평가액", won(endVal)], ["수익 (평가액 − 원금)", won(endVal - last[1])],
      ["누적 세후 배당", won(cumDiv)], [years + "년차 세후 월 배당", won(last[3] / 12)], ["다음 해 예상 세후 월 배당", won(nextMonthly)]
    ], (reinvest ? "세후 배당을 매달 같은 종목에 다시 사는 것으로 가정했습니다. " : "배당을 재투자하지 않고 현금으로 쌓는 것으로 가정했습니다. ") + "배당수익률·성장률·주가상승률이 매년 일정하다는 단순 가정이며 미래 수익을 보장하지 않습니다.");
    box.insertAdjacentHTML("beforeend", svg + tbl);
  };

  /* ═══ 2026-10 신규: 연봉 실수령액·적금·예금 이자 (요율은 calc_kr.py 와 같아야 함) ═══ */
  var R26 = { pension: 0.095, pMin: 410000, pMax: 6590000, health: 0.0719, ltc: 0.009448, ltcOfHealth: 0.1314, employ: 0.009, hMax: 4591740, hMin: 10080 };
  function f10(x) { return Math.floor(x / 10 + 1e-9) * 10; }
  var WT = null, wtWait = [];
  function loadWT(cb) {
    if (WT) { cb(); return; }
    wtWait.push(cb);
    if (wtWait.length > 1) return;
    var s = document.querySelector('script[src*="calc.js"]');
    var url = s ? s.src.replace(/calc\.js.*$/, "wtax2026.json") : "/assets/wtax2026.json";
    fetch(url).then(function (r) { return r.json(); }).then(function (j) { WT = j; wtWait.forEach(function (f) { f(); }); wtWait = []; })
      .catch(function (e) { console.error(e); });
  }
  function kidCredit(k) { return k <= 0 ? 0 : k === 1 ? 20830 : 45830 + Math.max(0, k - 2) * 33330; }
  /* 근로소득 간이세액표(소득세법 시행령 별표2, 2026.3.1 이후 원천징수분) */
  function withholding(taxable, fam, kids) {
    var n = Math.min(Math.max(Math.floor(fam), 1), 11), k = taxable / 1000, rows = WT.rows, t;
    if (k < rows[0][0]) t = 0;
    else if (k < WT.end) {
      var lo = 0, hi = rows.length - 1;
      while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (rows[mid][0] <= k) lo = mid; else hi = mid - 1; }
      t = rows[lo][n];
    } else {
      var b = WT.r10000[n - 1], X = taxable;
      if (X <= 10e6) t = b;
      else if (X <= 14e6) t = b + (X - 10e6) * 0.98 * 0.35 + 25000;
      else if (X <= 28e6) t = b + 1397000 + (X - 14e6) * 0.98 * 0.38;
      else if (X <= 30e6) t = b + 6610600 + (X - 28e6) * 0.98 * 0.40;
      else if (X <= 45e6) t = b + 7394600 + (X - 30e6) * 0.40;
      else if (X <= 87e6) t = b + 13394600 + (X - 45e6) * 0.42;
      else t = b + 31034600 + (X - 87e6) * 0.45;
      t = f10(t);
    }
    return Math.max(0, t - kidCredit(kids));
  }
  function salaryCalc(gross, nontax, fam, kids, ratio) {
    var taxable = Math.max(0, gross - Math.min(nontax, gross));
    var base = Math.min(Math.max(Math.floor(taxable / 1000) * 1000, R26.pMin), R26.pMax);
    var pension = f10(f10(base * R26.pension) / 2);
    var hTotal = f10(taxable * R26.health);
    var health = Math.min(Math.max(f10(hTotal / 2), R26.hMin), R26.hMax);
    var ltc = f10(f10(hTotal * R26.ltcOfHealth) / 2);
    var employ = f10(taxable * R26.employ);
    kids = Math.min(kids, Math.max(0, fam - 1));
    var itax = f10(withholding(taxable, fam, kids) * (ratio || 1)), ltax = f10(itax * 0.1);
    var ded = pension + health + ltc + employ + itax + ltax;
    return { gross: gross, taxable: taxable, base: base, pension: pension, health: health, ltc: ltc, employ: employ, itax: itax, ltax: ltax, ded: ded, net: gross - ded };
  }

  C.salary = function (box) {
    if (!WT) { box.innerHTML = '<div class="big">세액표 불러오는 중…</div>'; box.classList.add("on"); loadWT(function () { C.salary(box); }); return; }
    var mode = val("s-mode"), amt = num("s-amount") * W, sev = val("s-sev") === "in";
    var gross = mode === "month" ? amt : amt / (sev ? 13 : 12);
    var fam = Math.max(1, Math.round(num("s-fam"))), kids = Math.max(0, Math.round(num("s-kids")));
    var ratio = parseFloat(val("s-ratio")) || 1;
    var r = salaryCalc(gross, num("s-nontax") * W, fam, kids, ratio);
    var rows = [
      ["월 급여 (세전)" + (mode === "year" && sev ? " — 연봉 ÷ 13" : ""), won(r.gross)],
      ["비과세 (식대 등)", won(r.gross - r.taxable)],
      ["국민연금 4.75%" + (r.base === R26.pMax ? " (상한 659만원 적용)" : r.base === R26.pMin ? " (하한 41만원 적용)" : ""), "−" + won(r.pension)],
      ["건강보험 3.595%", "−" + won(r.health)],
      ["장기요양 (건강보험료의 13.14%)", "−" + won(r.ltc)],
      ["고용보험 0.9%", "−" + won(r.employ)],
      ["소득세 (간이세액표" + (ratio !== 1 ? " " + Math.round(ratio * 100) + "%" : "") + (kids ? ", 자녀 " + Math.min(kids, fam - 1) + "명 공제" : "") + ")", "−" + won(r.itax)],
      ["지방소득세 (소득세의 10%)", "−" + won(r.ltax)],
      ["공제 합계", "−" + won(r.ded)],
      ["연 환산 실수령 (월 × 12)", won(r.net * 12)]
    ];
    var note = "4대보험은 2026년 요율(국민연금 기준소득월액 2026.7~ 기준), 소득세는 2026.3.1부터 쓰는 근로소득 간이세액표 기준입니다. 실제 세금은 연말정산에서 확정되어 환급·추가 납부가 생길 수 있습니다.";
    if (kids > fam - 1) note = "8~20세 자녀 수는 공제대상가족(본인 포함) 수보다 작아야 해서 " + (fam - 1) + "명으로 계산했습니다. " + note;
    if (mode === "year" && sev) note = "퇴직금 포함 연봉은 13으로 나눠 월급을 구했습니다(1/13은 퇴직금으로 적립). " + note;
    show(box, "월 실수령액 " + won(r.net), rows, note);
  };

  /* 이자 과세: 일반 15.4% · 세금우대 9.5%(소득세 9%+농특세 0.5%) · 상호금융 1.4%(농특세) · 비과세 */
  function intTax(I, kind) {
    if (I <= 0 || kind === "free") return 0;
    if (kind === "gen") { var inc = f10(I * 0.14); return inc + f10(inc * 0.1); }
    if (kind === "pref") return f10(I * 0.09) + f10(I * 0.005);
    if (kind === "mutual") return f10(I * 0.014);
    return 0;
  }
  var TAXK = [["gen", "일반과세 15.4%"], ["pref", "세금우대 9.5%"], ["mutual", "상호금융 1.4%"], ["free", "비과세 0%"]];
  function savI(P, n, r, m) { var i = r / 12; if (!i) return 0; return Math.round(m === "simple" ? P * i * n * (n + 1) / 2 : P * (1 + i) * (Math.pow(1 + i, n) - 1) / i - P * n); }
  function depI(P, n, r, m) { return Math.round(m === "simple" ? P * r * n / 12 : m === "monthly" ? P * (Math.pow(1 + r / 12, n) - 1) : P * (Math.pow(1 + r, n / 12) - 1)); }
  function compareTable(fnI, methods, cur) {
    var h = '<div class="tablewrap"><table><thead><tr><th>과세 방식</th>';
    methods.forEach(function (m) { h += "<th>" + m[1] + " 세후 이자</th>"; });
    h += "</tr></thead><tbody>";
    TAXK.forEach(function (k) {
      h += "<tr><td>" + (k[0] === cur ? "<b>" + k[1] + "</b>" : k[1]) + "</td>";
      methods.forEach(function (m) { var I = fnI(m[0]); h += "<td>" + won(I - intTax(I, k[0])) + "</td>"; });
      h += "</tr>";
    });
    return h + "</tbody></table></div>";
  }

  C.savings = function (box) {
    var P = num("sv-pay") * W, n = Math.max(1, Math.round(num("sv-months"))), r = num("sv-rate") / 100, m = val("sv-method"), k = val("sv-tax");
    var I = savI(P, n, r, m), tax = intTax(I, k), prin = P * n;
    var eff = prin ? I / prin / (n / 12) : 0, effNet = prin ? (I - tax) / prin / (n / 12) : 0;
    show(box, "만기 세후 " + won(prin + I - tax), [
      ["납입 원금 (" + won(P) + " × " + n + "개월)", won(prin)], ["세전 이자 (" + (m === "simple" ? "단리" : "월복리") + ")", won(I)],
      ["이자 세금 (" + TAXK.filter(function (x) { return x[0] === k; })[0][1] + ")", "−" + won(tax)], ["세후 이자", won(I - tax)],
      ["넣은 돈 대비 실제 연수익률 (세전 / 세후)", pct(eff, 2) + " / " + pct(effNet, 2)]
    ], "적금은 첫 달 납입분만 " + n + "개월 동안 이자가 붙고 마지막 달 납입분은 1개월치만 붙습니다. 그래서 연 " + pct(r, 1) + " 적금의 실제 수익률은 약 " + pct(eff, 2) + "입니다. 매월 같은 날 납입, 중도해지 없음 기준입니다.");
    box.insertAdjacentHTML("beforeend", "<h3>과세 방식 × 이자 계산 방식 비교</h3>" + compareTable(function (mm) { return savI(P, n, r, mm); }, [["simple", "단리"], ["compound", "월복리"]], k));
  };

  C.savingsGoal = function (box) {
    var goal = num("sg-goal") * W, n = Math.max(1, Math.round(num("sg-months"))), r = num("sg-rate") / 100, m = val("sg-method"), k = val("sg-tax");
    var keep = { gen: 0.846, pref: 0.905, mutual: 0.986, free: 1 }[k];
    var P = Math.max(1000, Math.floor(goal / (n + savI(1e6, n, r, m) / 1e6 * keep) / 1000) * 1000);
    var net = function (p) { var i = savI(p, n, r, m); return p * n + i - intTax(i, k); };
    for (var g = 0; g < 1000 && net(P) < goal; g++) P += 1000;
    var I = savI(P, n, r, m), tax = intTax(I, k);
    show(box, "매월 " + won(P) + " 납입", [
      ["목표 세후 만기액", won(goal)], ["납입 원금 합계", won(P * n)], ["세전 이자", won(I)], ["세금", "−" + won(tax)], ["예상 세후 만기액", won(P * n + I - tax)]
    ], "목표액 이상이 되도록 1천원 단위로 올려 계산했습니다.");
  };

  C.deposit = function (box) {
    var P = num("dp-amount") * W, n = Math.max(1, Math.round(num("dp-months"))), r = num("dp-rate") / 100, m = val("dp-method"), k = val("dp-tax");
    var I = depI(P, n, r, m), tax = intTax(I, k), net = I - tax;
    var mName = { simple: "단리", monthly: "월복리", annual: "연복리" }[m];
    var rows = [
      ["예치금", won(P)], ["세전 이자 (" + mName + ", " + n + "개월)", won(I)],
      ["이자 세금 (" + TAXK.filter(function (x) { return x[0] === k; })[0][1] + ")", "−" + won(tax)], ["세후 이자", won(net)],
      ["만기 수령액", won(P + net)], ["세후 연수익률", P ? pct(net / P / (n / 12), 2) : "—"], ["세후 이자 월 환산", won(net / n)]
    ];
    var I1 = depI(1e8, n, r, m) / 1e8, notes = [];
    if (k === "gen" || k === "pref") {
      if (I > 20e6) notes.push("세전 이자 " + won(I) + "이 2,000만원을 넘습니다. 이자를 받는 해의 다른 이자·배당과 합쳐 2,000만원 초과분은 <a href=\"/financial-income-tax\">금융소득종합과세</a> 대상입니다.");
      else if (I1 > 0) rows.push(["이 조건에서 이자 2,000만원이 되는 예치금", won(20e6 / I1)]);
    }
    if (P + I > 1e8) notes.push("예금자보호는 한 금융회사당 원금과 이자를 합쳐 1억원까지입니다(2025.9.1~). 1억원을 넘는 부분은 다른 금융회사로 나누는 것이 안전합니다.");
    notes.push("만기 일시지급, 중도해지 없음 기준입니다. 이자는 받는 날이 속한 해의 금융소득으로 잡힙니다.");
    show(box, "세후 이자 " + won(net), rows, notes.join(" "));
    box.insertAdjacentHTML("beforeend", "<h3>과세 방식 × 이자 계산 방식 비교</h3>" + compareTable(function (mm) { return depI(P, n, r, mm); }, [["simple", "단리"], ["monthly", "월복리"], ["annual", "연복리"]], k));
  };

  /* 홈 빠른 계산: 같은 배당을 계좌별로 받으면 */
  C.quick = function (box) {
    var g = num("q-amount") * W;
    var isa = Math.max(0, g - 2e6) * 0.099;
    show(box, "일반계좌 세후 " + won(g * 0.846), [
      ["국내주식·국내상장 ETF (15.4%)", won(g * 0.846)], ["미국주식 직투 (15%)", won(g * 0.85)],
      ["ISA 일반형 (200만원 비과세, 초과 9.9%)", won(g - isa)], ["연금저축·IRP (인출 전 과세이연)", won(g)],
      ["일반계좌 대비 ISA 절세액", won(g * 0.154 - isa)]
    ], g > 20e6 ? "연 2,000만원을 넘으면 금융소득종합과세 대상입니다. <a href=\"/financial-income-tax\">추가 세금 계산 →</a>" : "");
  };

  /* 결과 복사·조건 공유 링크 */
  function tools(f, box) {
    if (f.querySelector(".share")) return;
    var bar = document.createElement("div"); bar.className = "share";
    bar.innerHTML = '<button type="button" data-a="copy">결과 복사</button><button type="button" data-a="link">조건 링크 복사</button><button type="button" data-a="print">인쇄</button>';
    f.appendChild(bar);
    bar.addEventListener("click", function (e) {
      var a = e.target.getAttribute("data-a"); if (!a) return;
      if (a === "print") { window.print(); return; }
      var text;
      if (a === "copy") {
        text = document.title.split("|")[0].trim() + "\n" + [].map.call(box.querySelectorAll(".big, .rows li"), function (li) { return li.innerText.replace(/\n/g, " : "); }).join("\n") + "\n" + location.origin + location.pathname;
      } else {
        var q = [].map.call(f.querySelectorAll("input,select"), function (el) { return el.id ? encodeURIComponent(el.id) + "=" + encodeURIComponent(el.value) : ""; }).filter(Boolean).join("&");
        text = location.origin + location.pathname + "?" + q;
      }
      var done = function () { e.target.textContent = "복사했습니다"; setTimeout(function () { e.target.textContent = a === "copy" ? "결과 복사" : "조건 링크 복사"; }, 1500); };
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () { prompt("복사하세요", text); });
      else prompt("복사하세요", text);
    });
  }
  function prefill() {
    if (!location.search) return;
    location.search.slice(1).split("&").forEach(function (kv) {
      var p = kv.split("="), el = document.getElementById(decodeURIComponent(p[0] || ""));
      if (el && p.length > 1) el.value = decodeURIComponent(p[1]);
    });
  }

  /* 연봉·순자산 상위 % — 국세청 근로소득 백분위(천분위) 2024년 귀속(2025.12.31 공개, 2,107만 8,535명)
     분위별 1인당 평균 총급여(만원)를 각 분위의 중앙 위치로 놓고 직선 보간. 순자산은 2025 가계금융복지조사(2025.3월말) 구간 분포 + 경계값 */
  var RK_M = [99937,43898,34951,30162,27054,24747,23086,21763,20752,19953,17332,14717,13117,11984,11136,10456,9925,9498,9117,8770,8454,8162,7887,7626,7377,7148,6932,6727,6534,6352,6180,6022,5874,5727,5583,5446,5314,5186,5063,4947,4837,4737,4634,4537,4443,4350,4263,4182,4101,4021,3945,3870,3799,3728,3660,3601,3543,3480,3417,3358,3299,3239,3179,3121,3064,3009,2964,2905,2853,2797,2749,2696,2645,2597,2543,2508,2475,2430,2384,2311,2243,2168,2090,2008,1922,1838,1763,1671,1584,1499,1412,1320,1236,1170,1079,994,913,828,767,694,616,536,456,384,305,231,165,92,21];
  var RK_SAL = RK_M.map(function (m, i) { return [m, i < 10 ? 0.05 + 0.1 * i : i - 8 - 0.5]; });
  var RK_NW = [[971000,0.1],[474000,0.5],[348000,1],[163000,5],[110000,10],[100000,11.8],[90000,14.2],[80000,16.6],[70000,19.9],[60000,23.4],[50000,28.0],[40000,34.2],[30000,43.1],[23860,50],[20000,55.2],[10000,70.6],[0,97.0],[-10000,99.8]];
  function rkUp(t, v) {
    if (v >= t[0][0]) return t[0][1];
    for (var j = 0; j < t.length - 1; j++) {
      var a = t[j], b = t[j + 1];
      if (v <= a[0] && v >= b[0]) return a[1] + (b[1] - a[1]) * (a[0] - v) / (a[0] - b[0]);
    }
    return t[t.length - 1][1];
  }
  function rkAmt(t, p) {
    for (var j = 0; j < t.length - 1; j++) {
      var a = t[j], b = t[j + 1];
      if (p >= a[1] && p <= b[1]) return a[0] + (b[0] - a[0]) * (p - a[1]) / (b[1] - a[1]);
    }
    return null;
  }
  function rkPct(p) { return p < 0.1 ? "0.1% 이내" : (p < 1 ? p.toFixed(2) : p.toFixed(1)) + "%"; }
  C.rank = function (box) {
    var mode = val("rk-mode") || "salary", v = num("rk-amount");
    var sal = mode === "salary", t = sal ? RK_SAL : RK_NW;
    var p = rkUp(t, v), rows = [];
    if (sal) {
      var n = 21078535, ahead = Math.max(1, Math.round(n * p / 100));
      rows.push(["전국 근로소득자 2,108만 명 중", "약 " + ahead.toLocaleString("ko-KR") + "번째"]);
      rows.push(["평균 연봉 4,475만원 대비", (v / 4475).toFixed(2) + "배"]);
      rows.push(["중위 연봉 3,388만원 대비", (v / 3388).toFixed(2) + "배"]);
      rows.push(["월급 환산 (세전, 12개월)", won(v * W / 12)]);
    } else {
      rows.push(["전체 가구 평균 순자산 4억 7,144만원 대비", (v / 47144).toFixed(2) + "배"]);
      rows.push(["중위 순자산 2억 3,860만원 대비", (v / 23860).toFixed(2) + "배"]);
    }
    [50, 20, 10, 5, 1].forEach(function (g) {
      if (p > g) {
        var need = rkAmt(t, g);
        if (need != null) rows.push(["상위 " + g + "% 기준선까지", won((need - v) * W) + " 더"]);
      }
    });
    var note = sal
      ? "국세청 2024년 귀속 근로소득 백분위(천분위) 자료 기준 세전 총급여(비과세 제외) 추정치입니다. 연중 입사·퇴사자와 단시간 근로자까지 포함된 통계라 정규직끼리 비교한 위치보다 높게 나옵니다."
      : "2025년 가계금융복지조사(2025년 3월 말) 가구 순자산 분포 기준 추정치입니다. 순자산 = 부동산·금융자산·전월세보증금 − 부채, 개인이 아닌 가구 단위입니다.";
    if (sal && v >= 2000 && v <= 15000) {
      var near = Math.round(v / 500) * 500;
      note += ' <a href="/salary-net-' + near + '">연봉 ' + near.toLocaleString("ko-KR") + "만원 실수령액 보기 →</a>";
    }
    show(box, (sal ? "내 연봉은 " : "우리 집 순자산은 ") + "<b>상위 " + rkPct(p) + "</b>", rows, note);
  };

  function bind() {
    prefill();
    document.querySelectorAll("form[data-calc]").forEach(function (f) {
      var box = f.querySelector(".result");
      tools(f, box);
      var run = function () { try { C[f.getAttribute("data-calc")](box); } catch (e) { console.error(e); } };
      f.addEventListener("submit", function (e) {
        e.preventDefault(); run();
        box.classList.remove("pop"); void box.offsetWidth; box.classList.add("pop");
        var r = box.getBoundingClientRect();
        if (r.top > window.innerHeight - 120 || r.top < 0) box.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      f.addEventListener("change", run); f.addEventListener("input", run);
      if (f.hasAttribute("data-autorun")) run();
    });
    var sel = document.getElementById("d-type");
    if (sel) {
      var row = document.getElementById("d-isa-row");
      var sync = function () { if (row) row.style.display = sel.value === "isa" ? "" : "none"; };
      sel.addEventListener("change", sync); sync();
    }
    var it = document.getElementById("i-type");
    if (it) it.addEventListener("change", function () { document.getElementById("i-limit").value = it.value; });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind); else bind();
  window.SehuCalc = { progTax: progTax, sepTax: sepTax, C: C, salaryCalc: salaryCalc, withholding: withholding, intTax: intTax, savI: savI, depI: depI, setWT: function (j) { WT = j; } };
})();
