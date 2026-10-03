/*
 * My Knee Score: Advanced score pages (UI only).
 * All scoring goes through MKSEngine (engine.js). Do not compute scores here.
 */
(function () {
  "use strict";
  var E = window.MKSEngine;
  var slug = document.body.getAttribute("data-score");
  var S = window.MKS_SCORES && window.MKS_SCORES[slug];
  if (!E || !S) return;

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function esc(v) {
    return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function toast(msg) {
    var t = document.createElement("div");
    t.className = "toast";
    t.setAttribute("role", "status");
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2200);
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast("Copied to clipboard"); }, function () { toast("Copy failed. Please try again"); });
    } else {
      toast("Copy is not supported in this browser");
    }
  }

  if (S.mode === "quick") initQuiz();
  else if (S.mode === "sk11") initSK11();
  else if (S.mode === "pk7") initPK7();

  // ---------------------------------------------------------------
  // Library scores: one question at a time (QuickCalculator flow)
  // ---------------------------------------------------------------
  function initQuiz() {
    var questions = S.questionSet;
    var total = questions.length;
    var app = document.getElementById("quizApp");
    var body = document.getElementById("quizBody");
    var nav = document.getElementById("quizNav");
    var backBtn = document.getElementById("backBtn");
    var nextBtn = document.getElementById("nextBtn");
    var fill = document.getElementById("progressFill");
    var meta = document.getElementById("progressMeta");
    var resultEl = document.getElementById("result");
    var answers = {};
    var current = 0;
    var timer = null;

    function allAnswered() {
      return questions.every(function (q) { return answers[q.id] !== undefined; });
    }
    function firstUnanswered() {
      for (var i = 0; i < total; i++) { if (answers[questions[i].id] === undefined) return i; }
      return -1;
    }

    function open() {
      app.hidden = false;
      app.classList.add("open");
      document.body.style.overflow = "hidden";
      document.body.classList.add("quiz-open");
      reset();
    }
    function close() {
      clearTimeout(timer);
      app.classList.remove("open");
      app.hidden = true;
      document.body.style.overflow = "";
      document.body.classList.remove("quiz-open");
    }
    function reset() {
      clearTimeout(timer);
      answers = {};
      resultEl.classList.remove("show");
      resultEl.innerHTML = "";
      nav.style.display = "";
      show(0);
    }

    function show(i) {
      current = i;
      var q = questions[i];
      var name = "q" + q.id;
      var html = '<h2 class="q-title" tabindex="-1">' + esc(q.text) + '</h2>' +
        '<div class="q-card"><p class="q-topic">' + esc(S.acronym) + ' &middot; Question ' + (i + 1) + '</p>' +
        '<div class="opts-stack" role="radiogroup" aria-label="' + esc(q.text) + '">';
      q.options.forEach(function (o, k) {
        var id = name + "-" + k;
        var checked = answers[q.id] === o.value ? " checked" : "";
        html += '<input type="radio" name="' + name + '" id="' + id + '" value="' + esc(o.value) + '"' + checked + '>' +
          '<label for="' + id + '">' + esc(o.label) + '</label>';
      });
      html += '</div></div>';
      body.innerHTML = html;

      fill.style.width = (((i + (answers[q.id] !== undefined ? 1 : 0)) / total) * 100) + "%";
      meta.textContent = "Question " + (i + 1) + " of " + total;
      backBtn.disabled = i === 0;
      var last = i === total - 1;
      nextBtn.textContent = last ? "See my score" : "Next";
      nextBtn.disabled = answers[q.id] === undefined;
      var h = body.querySelector(".q-title");
      if (h) h.focus();
    }

    body.addEventListener("change", function (e) {
      var t = e.target;
      if (!t || t.type !== "radio") return;
      var q = questions[current];
      answers[q.id] = t.value;
      nextBtn.disabled = false;
      fill.style.width = (((current + 1) / total) * 100) + "%";
      clearTimeout(timer);
      if (current < total - 1) {
        timer = setTimeout(function () { show(current + 1); }, reduce ? 0 : 300);
      } else if (allAnswered()) {
        timer = setTimeout(finish, reduce ? 0 : 320);
      }
    });

    nextBtn.addEventListener("click", function () {
      if (answers[questions[current].id] === undefined) return;
      clearTimeout(timer);
      if (current < total - 1) show(current + 1); else finish();
    });
    backBtn.addEventListener("click", function () {
      clearTimeout(timer);
      if (current > 0) show(current - 1);
    });
    document.getElementById("quizExit").addEventListener("click", close);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && app.classList.contains("open")) close();
    });
    [].forEach.call(document.querySelectorAll("[data-open-quiz]"), function (el) {
      el.addEventListener("click", function (e) { e.preventDefault(); open(); });
    });

    function finish() {
      var u = firstUnanswered();
      if (u > -1) { show(u); return; }

      var r = E.quickScore(questions, answers, S.scoringRange);
      body.innerHTML = "";
      nav.style.display = "none";
      fill.style.width = "100%";
      meta.textContent = "Complete";

      var higher = S.scoringDirection === "higher_better";
      var html = '<h3 tabindex="-1">Your ' + esc(S.acronym) + ' score</h3>';
      var copy = "";
      if (r) {
        var z = E.ragZone(r.score, S.scoringRange.max, higher);
        var pos = Math.max(0, Math.min(100, z.dialPosition));
        html += '<div class="dial" style="--value:' + pos + ';"><div class="dial-num">' + r.score +
          '<small>out of ' + S.scoringRange.max + '</small></div></div>' +
          '<p class="result-band">' + esc(z.zone) + ' knee function</p>' +
          '<p class="result-dir">' + (higher ? "Higher score = better function" : "Lower score = better function") + '</p>';
        copy = S.name + ": " + r.score + "/" + S.scoringRange.max + " (" + r.answeredCount + "/" + r.totalQuestions +
          " questions answered)\nCalculated: " + new Date().toLocaleString();
      } else {
        html += '<p class="result-advice">No score could be calculated. None of your answers count towards this score (for example, every item was marked as an activity you do not do).</p>';
      }
      html += '<div class="result-advice"><b>Reading your score</b>' + esc(S.scoringInterpretation) + '</div>' +
        '<p class="small">Note today\'s date and score, then retest to track change. This tool does not replace a medical assessment.</p>' +
        '<div class="result-actions">' +
        '<button type="button" class="btn btn-gold" data-act="retake">Retake</button>' +
        (r ? '<button type="button" class="btn btn-ghost" data-act="copy">Copy result</button>' : "") +
        '<button type="button" class="btn btn-ghost" data-act="print">Print</button>' +
        '<a class="btn btn-ghost" href="index.html">All scores</a></div>';
      resultEl.innerHTML = html;
      resultEl.classList.add("show");
      resultEl.querySelector('[data-act="retake"]').addEventListener("click", reset);
      resultEl.querySelector('[data-act="print"]').addEventListener("click", function () { window.print(); });
      var c = resultEl.querySelector('[data-act="copy"]');
      if (c) c.addEventListener("click", function () { copyText(copy); });
      app.scrollTop = 0;
      var h = resultEl.querySelector("h3");
      if (h) h.focus();
    }
  }

  // ---------------------------------------------------------------
  // Shared pieces for SK11 and PK7
  // ---------------------------------------------------------------
  function scaleHtml(name, max, value) {
    var h = '<div class="scale" role="radiogroup" style="--n:' + (max + 1) + '">';
    for (var v = 0; v <= max; v++) {
      var id = name + "-" + v;
      h += '<input type="radio" name="' + name + '" id="' + id + '" value="' + v + '"' + (value === v ? " checked" : "") + '>' +
        '<label for="' + id + '">' + v + '</label>';
    }
    return h + '</div><div class="scale-ends" style="--n:' + (max + 1) + '"><span>Worst</span><span>Best</span></div>';
  }

  function liveHtml() {
    return '<aside class="live" aria-live="polite">' +
      '<p class="eyebrow">Your score</p>' +
      '<div class="dial" id="liveDial" style="--value:0;"><div class="dial-num"><span id="liveNum">0</span><small>out of 100</small></div></div>' +
      '<span class="live-score" id="liveNumMobile">0</span>' +
      '<p class="live-band" id="liveBand">Not started</p>' +
      '<p class="live-status" id="liveStatus"></p>' +
      '<button type="button" class="btn btn-gold btn-sm" id="reportBtn" disabled>See report</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" id="resetBtn">Reset</button>' +
      '</aside>';
  }

  function updateLive(result, answered, totalItems, threshold) {
    var num = result ? result.score : 0;
    document.getElementById("liveNum").textContent = result ? num : "0";
    document.getElementById("liveNumMobile").textContent = result ? num : "0";
    document.getElementById("liveDial").style.setProperty("--value", num);
    document.getElementById("liveBand").textContent = result ? E.scoreBand(num).label : "Not started";
    var status = answered + " of " + totalItems + " answered";
    if (result && result.isIncomplete) status += ". Preliminary: answer at least " + threshold + " for a valid score";
    document.getElementById("liveStatus").textContent = status;
    document.getElementById("reportBtn").disabled = answered === 0;
  }

  function pct(x) { return (x * 100).toFixed(1) + "%"; }

  // ---------------------------------------------------------------
  // SK11 (SK11Calculator flow)
  // ---------------------------------------------------------------
  function initSK11() {
    var root = document.getElementById("toolApp");
    var Q = E.SK11_QUESTIONS;
    var threshold = 8;
    var answers = {};
    Q.forEach(function (q) { answers[q.id] = null; });

    function render() {
      var h = '<div class="tool-items">';
      Q.forEach(function (q, i) {
        h += '<div class="item' + (answers[q.id] !== null ? " done" : "") + '" id="item' + q.id + '">' +
          '<div class="item-head"><span class="item-num">' + (i + 1) + '</span><div>' +
          '<p class="item-text">' + esc(q.text) + '</p><p class="item-sub">' + esc(q.domain) + ' &middot; 0 = worst, 10 = best</p></div></div>' +
          scaleHtml("sk" + q.id, 10, answers[q.id]) + '</div>';
      });
      h += '<div id="report"></div></div>' + liveHtml();
      root.innerHTML = h;
      bind();
      refresh();
    }

    function answeredCount() {
      return Q.filter(function (q) { return answers[q.id] !== null; }).length;
    }
    function refresh() {
      var r = E.sk11Score(answers, threshold);
      updateLive(r, answeredCount(), Q.length, threshold);
      return r;
    }
    root.addEventListener("change", function (e) {
      var t = e.target;
      if (!t || t.type !== "radio") return;
      var id = Number(t.name.slice(2));
      answers[id] = Number(t.value);
      document.getElementById("item" + id).classList.add("done");
      refresh();
      var rep = document.getElementById("report");
      if (rep.innerHTML) report();
    });
    function bind() {
      document.getElementById("reportBtn").addEventListener("click", function () { report(); document.getElementById("report").scrollIntoView({ behavior: reduce ? "auto" : "smooth" }); });
      document.getElementById("resetBtn").addEventListener("click", function () {
        Q.forEach(function (q) { answers[q.id] = null; });
        render();
      });
    }

    function report() {
      var r = refresh();
      if (!r) return;
      // Display breakdown mirrors SK11Calculator domainBreakdown
      var answered = Q.filter(function (q) { return answers[q.id] !== null; });
      var totalWeight = answered.reduce(function (s, q) { return s + q.weight; }, 0) || 1;
      var rows = "", lines = [];
      Q.forEach(function (q) {
        var raw = answers[q.id];
        var w = raw !== null ? q.weight / totalWeight : q.weight;
        var contrib = raw !== null ? ((raw / 10) * 100 * w) / 100 * 10 : null;
        rows += '<tr><td>' + esc(q.domain) + '</td><td class="num">' + (raw !== null ? raw + "/10" : "Not answered") +
          '</td><td class="num">' + pct(w) + '</td><td class="num">' + (contrib !== null ? "+" + contrib.toFixed(1) : "") + '</td></tr>';
        lines.push(q.domain + ": " + (raw !== null ? raw + "/10" : "not answered") + " (weight " + pct(w) + ")");
      });
      var band = E.scoreBand(r.score).label;
      var text = "SK11 Assessment Results\nDate: " + new Date().toLocaleString() + "\n\nOverall Score: " + r.score + "/100 (" + band + ")\n" +
        "Completion: " + r.answeredCount + "/" + r.totalQuestions + " items\nStatus: " + (r.isIncomplete ? "Incomplete" : "Complete") + "\n\n" + lines.join("\n") + "\n\nGenerated by mykneescore";
      document.getElementById("report").innerHTML = '<div class="report"><h3>SK11 report: ' + r.score + '/100 (' + esc(band) + ')</h3>' +
        '<table><thead><tr><th>Domain</th><th class="num">Answer</th><th class="num">Weight</th><th class="num">Points</th></tr></thead><tbody>' + rows + '</tbody></table>' +
        '<p class="note">SK11 = round(10 &times; sum of answer &times; weight). Fixed weights, renormalised over answered items. Bands: 85+ Excellent, 70 to 84 Good, 60 to 69 Fair, 40 to 59 Poor, under 40 Very Poor.</p>' +
        '<div class="result-actions"><button type="button" class="btn btn-green btn-sm" id="copyRep">Copy result</button><button type="button" class="btn btn-ghost-green btn-sm" id="printRep">Print</button></div></div>';
      document.getElementById("copyRep").addEventListener("click", function () { copyText(text); });
      document.getElementById("printRep").addEventListener("click", function () { window.print(); });
    }

    render();
  }

  // ---------------------------------------------------------------
  // PK7 (PK7Calculator flow, including custom weights)
  // ---------------------------------------------------------------
  function initPK7() {
    var root = document.getElementById("toolApp");
    var D = E.PK7_DOMAINS;
    var threshold = 5;
    var answers = {};
    var weights = E.pk7DefaultWeights();
    var weightInputs = {};
    D.forEach(function (d) { answers[d.id] = null; weightInputs[d.id] = String(d.defaultWeight); });

    function render() {
      var h = '<div class="tool-items">';
      h += '<details class="weights" id="weightsBox"><summary>Custom domain weights (for clinicians)</summary>' +
        '<div class="weights-grid">';
      D.forEach(function (d) {
        h += '<div><label for="w' + d.id + '">' + esc(d.name) + '</label>' +
          '<input type="number" min="0" step="0.1" id="w' + d.id + '" data-w="' + d.id + '" value="' + esc(weightInputs[d.id]) + '"></div>';
      });
      h += '</div><p>Weights are automatically normalised to sum to 1.0 over the answered domains. <button type="button" class="btn btn-ghost-green btn-sm" id="resetWeights">Reset to equal</button></p></details>';
      D.forEach(function (d, i) {
        h += '<div class="item' + (answers[d.id] !== null ? " done" : "") + '" id="item' + d.id + '">' +
          '<div class="item-head"><span class="item-num">' + (i + 1) + '</span><div>' +
          '<p class="item-text">' + esc(d.name) + '</p><p class="item-sub">' + esc(d.description) + ' &middot; 0 = worst, ' + d.maxValue + ' = best</p></div></div>' +
          scaleHtml("pk" + d.id, d.maxValue, answers[d.id]) + '</div>';
      });
      h += '<div id="report"></div></div>' + liveHtml();
      root.innerHTML = h;
      bind();
      refresh();
    }

    function answeredCount() {
      return D.filter(function (d) { return answers[d.id] !== null; }).length;
    }
    function refresh() {
      var r = E.pk7Score(answers, weights, threshold);
      updateLive(r, answeredCount(), D.length, threshold);
      var rep = document.getElementById("report");
      if (rep && rep.innerHTML) report(r);
      return r;
    }
    root.addEventListener("change", function (e) {
      var t = e.target;
      if (!t || t.type !== "radio") return;
      var id = Number(t.name.slice(2));
      answers[id] = Number(t.value);
      document.getElementById("item" + id).classList.add("done");
      refresh();
    });
    root.addEventListener("input", function (e) {
      var t = e.target;
      if (!t || !t.hasAttribute("data-w")) return;
      var id = Number(t.getAttribute("data-w"));
      weightInputs[id] = t.value;
      weights[id] = E.pk7ParseWeight(t.value);
      refresh();
    });
    function bind() {
      document.getElementById("resetWeights").addEventListener("click", function () {
        weights = E.pk7DefaultWeights();
        D.forEach(function (d) {
          weightInputs[d.id] = String(d.defaultWeight);
          document.getElementById("w" + d.id).value = weightInputs[d.id];
        });
        refresh();
      });
      document.getElementById("reportBtn").addEventListener("click", function () { report(refresh()); document.getElementById("report").scrollIntoView({ behavior: reduce ? "auto" : "smooth" }); });
      document.getElementById("resetBtn").addEventListener("click", function () {
        D.forEach(function (d) { answers[d.id] = null; weightInputs[d.id] = String(d.defaultWeight); });
        weights = E.pk7DefaultWeights();
        render();
      });
    }

    function report(r) {
      if (!r) { document.getElementById("report").innerHTML = ""; return; }
      // Display breakdown mirrors PK7Calculator domainBreakdown
      var nw = r.normalizedWeights;
      var custom = D.some(function (d) { return weights[d.id] !== d.defaultWeight; });
      var rows = "", lines = [];
      D.forEach(function (d) {
        var raw = answers[d.id];
        var norm = raw !== null ? (raw / d.maxValue) * 100 : null;
        var w = nw[d.id] || weights[d.id] / D.length;
        rows += '<tr><td>' + esc(d.name) + '</td><td class="num">' + (raw !== null ? raw + "/" + d.maxValue : "Not answered") +
          '</td><td class="num">' + (norm !== null ? norm.toFixed(0) + "%" : "") + '</td><td class="num">' + pct(w) + '</td></tr>';
        lines.push(d.name + ": " + (raw !== null ? raw + "/" + d.maxValue : "not answered") + " (weight " + pct(w) + ")");
      });
      var band = E.scoreBand(r.score).label;
      var text = "PK7 Assessment Results\nDate: " + new Date().toLocaleString() + "\n\nOverall Score: " + r.score + "/100 (" + band + ")\n" +
        "Completion: " + r.answeredCount + "/" + r.totalQuestions + " items\nStatus: " + (r.isIncomplete ? "Incomplete" : "Complete") +
        (custom ? "\nCustom weights: yes" : "") + "\n\n" + lines.join("\n") + "\n\nGenerated by mykneescore";
      document.getElementById("report").innerHTML = '<div class="report"><h3>PK7 report: ' + r.score + '/100 (' + esc(band) + ')</h3>' +
        '<table><thead><tr><th>Domain</th><th class="num">Answer</th><th class="num">Scaled</th><th class="num">Weight</th></tr></thead><tbody>' + rows + '</tbody></table>' +
        '<p class="note">PK7: mixed scales normalised to 0 to 100, then weighted.' + (custom ? " Custom weights in use." : " Equal weights.") +
        ' Bands: 85+ Excellent, 70 to 84 Good, 60 to 69 Fair, 40 to 59 Poor, under 40 Very Poor.</p>' +
        '<div class="result-actions"><button type="button" class="btn btn-green btn-sm" id="copyRep">Copy result</button><button type="button" class="btn btn-ghost-green btn-sm" id="printRep">Print</button></div></div>';
      document.getElementById("copyRep").addEventListener("click", function () { copyText(text); });
      document.getElementById("printRep").addEventListener("click", function () { window.print(); });
    }

    render();
  }
})();
