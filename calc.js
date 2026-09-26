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

  function bind() {
    document.querySelectorAll("form[data-calc]").forEach(function (f) {
      var box = f.querySelector(".result");
      var run = function () { try { C[f.getAttribute("data-calc")](box); } catch (e) { console.error(e); } };
      f.addEventListener("submit", function (e) { e.preventDefault(); run(); });
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
  window.SehuCalc = { progTax: progTax, sepTax: sepTax, C: C };
})();
