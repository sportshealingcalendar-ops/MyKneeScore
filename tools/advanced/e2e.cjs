// Browser check: answers every Advanced page in Chromium and compares the shown score to engine.js.
// Usage: python3 -m http.server 8765 (from the site root), then node tools/advanced/e2e.cjs
const { chromium } = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright");
const engine = require(require("path").resolve(__dirname, "../../advanced/assets/engine.js"));
const vm = require("vm");
const ctx = { window: {} }; vm.createContext(ctx);
vm.runInContext(require("fs").readFileSync(require("path").resolve(__dirname, "../../advanced/assets/scores-data.js"), "utf8"), ctx);
const DATA = ctx.window.MKS_SCORES;
const BASE = (process.env.MKS_BASE || "http://localhost:8765/") + "advanced/";
let seed = 7; const rand = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; page.on("pageerror", e => errors.push(e.message)); page.on("console", m => m.type() === "error" && errors.push(m.text()));
  let checks = 0, fails = 0;
  for (const [slug, s] of Object.entries(DATA)) {
    if (s.mode === "quick") {
      for (let run = 0; run < 3; run++) {
        await page.goto(BASE + slug + ".html");
        await page.click("[data-open-quiz]");
        const answers = {};
        for (let i = 0; i < s.questionSet.length; i++) {
          const q = s.questionSet[i];
          const k = Math.floor(rand() * q.options.length);
          answers[q.id] = q.options[k].value;
          await page.click(`label[for="q${q.id}-${k}"]`);
          await page.waitForTimeout(340);
          // run 1: go back once and change the previous answer, to exercise Back
          if (run === 1 && i === 1 && s.questionSet.length > 2) {
            await page.click("#backBtn");
            const k2 = (k + 1) % q.options.length;
            answers[q.id] = q.options[k2].value;
            await page.click(`label[for="q${q.id}-${k2}"]`);
            await page.waitForTimeout(340);
          }
        }
        await page.waitForSelector("#result.show", { timeout: 4000 });
        const exp = engine.quickScore(s.questionSet, answers, s.scoringRange);
        const shown = await page.$eval("#result", el => { const d = el.querySelector(".dial-num"); return d ? parseInt(d.textContent, 10) : null; });
        checks++;
        if ((exp ? exp.score : null) !== shown) { fails++; console.log("MISMATCH", slug, run, exp && exp.score, shown, JSON.stringify(answers)); }
      }
    } else {
      await page.goto(BASE + slug + ".html");
      const items = s.mode === "sk11" ? engine.SK11_QUESTIONS.map(q => ({ id: q.id, max: 10 })) : engine.PK7_DOMAINS.map(d => ({ id: d.id, max: d.maxValue }));
      const prefix = s.mode === "sk11" ? "sk" : "pk";
      const answers = {}; items.forEach(it => answers[it.id] = null);
      let weights = engine.pk7DefaultWeights();
      if (s.mode === "pk7") {
        await page.click("#weightsBox summary");
        for (const [id, val] of [[1, "2"], [3, "0"], [5, "0.5"]]) { await page.fill(`#w${id}`, val); weights[id] = engine.pk7ParseWeight(val); }
      }
      for (const it of items) {
        if (rand() < 0.2) continue;
        const v = Math.floor(rand() * (it.max + 1));
        answers[it.id] = v;
        await page.click(`label[for="${prefix}${it.id}-${v}"]`);
        const exp = s.mode === "sk11" ? engine.sk11Score(answers) : engine.pk7Score(answers, weights);
        const shown = parseInt(await page.textContent("#liveNum"), 10);
        checks++;
        if (exp.score !== shown) { fails++; console.log("MISMATCH", slug, exp.score, shown, JSON.stringify(answers)); }
      }
      await page.click("#reportBtn");
      await page.waitForSelector(".report");
    }
  }
  // hub filter
  await page.goto(BASE + "index.html");
  const total = await page.$$eval("#scoreGrid .score-card", c => c.length);
  await page.click('.chip[data-filter="Patellofemoral"]');
  const visible = await page.$$eval("#scoreGrid .score-card:not([hidden])", c => c.map(x => x.querySelector(".sc-acronym").textContent));
  console.log("hub cards", total, "patellofemoral filter ->", visible.join(", "));
  console.log(`checks=${checks} fails=${fails} pageErrors=${errors.length}`); errors.slice(0, 5).forEach(e => console.log("ERR", e));
  await browser.close();
})();
