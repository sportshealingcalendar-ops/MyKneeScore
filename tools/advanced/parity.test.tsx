/**
 * Parity test: original kneescore-research calculators vs advanced/assets/engine.js.
 *
 * Runs inside a checkout of SportsHealing/kneescore-research (see run-parity.sh).
 * It renders the ORIGINAL React components, answers them with random inputs,
 * reads the score they display, and requires engine.js to give the same result.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, fireEvent, act, cleanup } from "@testing-library/react";
import { createRequire } from "module";
import { kneeScores } from "@/lib/kneeScores";
import { getQuestionsForScore } from "@/lib/scoreQuestions";
import { calculateSK11, calculatePK7 } from "@/lib/scoreCalculations";
import { QuickCalculator } from "@/components/QuickCalculator";
import { SK11Calculator } from "@/components/SK11Calculator";
import { PK7Calculator } from "@/components/PK7Calculator";

const require = createRequire(import.meta.url);
const engine = require(process.env.MKS_ENGINE as string);

const RUNS_RENDERED = Number(process.env.MKS_RUNS_RENDERED || 12);
const RUNS_PURE = Number(process.env.MKS_RUNS_PURE || 5000);

// Seeded RNG so failures are reproducible
let seed = 20261003;
function rand() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];

beforeAll(() => {
  // jsdom gaps used by Radix
  (globalThis as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  (Element.prototype as any).hasPointerCapture = () => false;
  (Element.prototype as any).scrollIntoView = () => {};
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

// ---------- Library scores (QuickCalculator) ----------
describe("QuickCalculator parity", () => {
  for (const score of kneeScores) {
    const questions = getQuestionsForScore(score.name);
    it(`${score.name}: rendered component matches engine`, () => {
      const answerSets: Record<number, string>[] = [];
      const minSet: Record<number, string> = {}, maxSet: Record<number, string> = {};
      questions.forEach(q => {
        const vals = q.options.map(o => o.value);
        minSet[q.id] = vals.reduce((a, b) => (parseFloat(b) < parseFloat(a) ? b : a));
        maxSet[q.id] = vals.reduce((a, b) => (parseFloat(b) > parseFloat(a) ? b : a));
      });
      answerSets.push(minSet, maxSet);
      for (let r = 0; r < RUNS_RENDERED; r++) {
        const set: Record<number, string> = {};
        questions.forEach(q => { set[q.id] = pick(q.options).value; });
        answerSets.push(set);
      }

      for (const answers of answerSets) {
        vi.useFakeTimers();
        render(<QuickCalculator score={score} open={true} onOpenChange={() => {}} />);
        questions.forEach(q => {
          const el = document.getElementById(`q${q.id}-${answers[q.id]}`);
          expect(el, `option q${q.id}-${answers[q.id]}`).not.toBeNull();
          act(() => { fireEvent.click(el!); });
          act(() => { vi.advanceTimersByTime(350); });
        });
        const calc = [...document.querySelectorAll("button")].find(b => b.textContent?.includes("Calculate Score"));
        expect(calc).toBeTruthy();
        act(() => { fireEvent.click(calc!); });

        const ported = engine.quickScore(questions, answers, score.scoringRange);
        const dialEl = document.querySelector(".text-4xl");
        if (ported === null) {
          // Original shows no result when nothing scoreable was answered (e.g. all "Do not do")
          expect(dialEl).toBeNull();
          cleanup();
          vi.useRealTimers();
          continue;
        }
        const shown = dialEl!.textContent!; // e.g. "57/100"
        const shownScore = Number(shown.split("/")[0]);
        const zoneText = [...document.querySelectorAll("div")].find(d => /Knee Function$/.test(d.textContent || "") && d.children.length === 0)!.textContent;

        const zone = engine.ragZone(ported.score, score.scoringRange.max, score.scoringDirection === "higher_better").zone;
        expect(ported.score, JSON.stringify(answers)).toBe(shownScore);
        expect(`${zone} Knee Function`).toBe(zoneText);
        cleanup();
        vi.useRealTimers();
      }
    }, 120000);
  }

  it("engine matches a verbatim copy of the component formula on many random partial and full sets", () => {
    for (const score of kneeScores) {
      const questions = getQuestionsForScore(score.name);
      for (let r = 0; r < 300; r++) {
        const answers: Record<number, string> = {};
        questions.forEach(q => { if (rand() < 0.85) answers[q.id] = pick(q.options).value; });
        // verbatim from QuickCalculator.tsx
        const answeredCount = Object.keys(answers).length;
        let expected: number | null = null;
        if (answeredCount > 0) {
          let totalScore = 0, maxPossible = 0;
          questions.forEach(q => {
            const selectedValue = answers[q.id];
            if (selectedValue !== undefined) {
              const numeric = parseFloat(selectedValue);
              if (isNaN(numeric) || numeric < 0) return;
              totalScore += numeric;
              const maxOption = Math.max(...q.options.map(o => parseFloat(o.value)).filter(v => !isNaN(v)));
              maxPossible += maxOption;
            }
          });
          if (maxPossible !== 0) {
            const finalScore = Math.round((totalScore / maxPossible) * score.scoringRange.max);
            expected = Math.max(score.scoringRange.min, Math.min(score.scoringRange.max, finalScore));
          }
        }
        const got = engine.quickScore(questions, answers, score.scoringRange);
        expect(got === null ? null : got.score).toBe(expected);
      }
    }
  });
});

// ---------- Slider helpers ----------
function setSlider(thumb: Element, value: number) {
  act(() => { fireEvent.keyDown(thumb, { key: "Home" }); });
  for (let i = 0; i < value; i++) act(() => { fireEvent.keyDown(thumb, { key: "ArrowRight" }); });
}
function liveScore(): number | null {
  const el = document.querySelector(".text-2xl.font-bold");
  return el ? Number(el.textContent) : null;
}

// ---------- SK11 ----------
describe("SK11 parity", () => {
  it("rendered SK11Calculator matches engine (random subsets)", () => {
    for (let r = 0; r < RUNS_RENDERED * 3; r++) {
      render(<SK11Calculator />);
      const thumbs = [...document.querySelectorAll('[role="slider"]')];
      expect(thumbs.length).toBe(11);
      const answers: Record<number, number | null> = {};
      engine.SK11_QUESTIONS.forEach((q: any, i: number) => {
        if (r === 0 || rand() < 0.75) {
          const v = r === 1 ? 0 : r === 2 ? 10 : Math.floor(rand() * 11);
          setSlider(thumbs[i], v);
          answers[q.id] = v;
        } else answers[q.id] = null;
      });
      const ported = engine.sk11Score(answers);
      expect(ported ? ported.score : null, JSON.stringify(answers)).toBe(liveScore());
      cleanup();
    }
  }, 120000);

  it("engine matches src/lib/scoreCalculations.ts calculateSK11", () => {
    for (let r = 0; r < RUNS_PURE; r++) {
      const answers: Record<number, number | null> = {};
      for (let i = 1; i <= 11; i++) answers[i] = rand() < 0.8 ? Math.floor(rand() * 11) : null;
      const lib = calculateSK11(answers);
      const got = engine.sk11Score(answers);
      expect(got ? got.score : null).toBe(lib ? lib.score : null);
    }
  });
});

// ---------- PK7 ----------
describe("PK7 parity", () => {
  const weightInputs = ["1", "0", "2", "0.5", "3.7", "", "10"];

  it("rendered PK7Calculator matches engine (random subsets, default and custom weights)", () => {
    for (let r = 0; r < RUNS_RENDERED * 3; r++) {
      render(<PK7Calculator />);
      const custom = r % 2 === 1;
      const weights = engine.pk7DefaultWeights();
      if (custom) {
        const sw = document.querySelector('[role="switch"]')!;
        act(() => { fireEvent.click(sw); });
        const inputs = [...document.querySelectorAll('input[type="number"]')];
        expect(inputs.length).toBe(7);
        inputs.forEach((inp, i) => {
          const raw = pick(weightInputs);
          act(() => { fireEvent.change(inp, { target: { value: raw } }); });
          weights[i + 1] = engine.pk7ParseWeight(raw);
        });
      }
      const thumbs = [...document.querySelectorAll('[role="slider"]')];
      expect(thumbs.length).toBe(7);
      const answers: Record<number, number | null> = {};
      engine.PK7_DOMAINS.forEach((d: any, i: number) => {
        if (r < 2 || rand() < 0.75) {
          const v = r === 2 ? 0 : Math.floor(rand() * (d.maxValue + 1));
          setSlider(thumbs[i], v);
          answers[d.id] = v;
        } else answers[d.id] = null;
      });
      const ported = engine.pk7Score(answers, weights);
      expect(ported ? ported.score : null, JSON.stringify({ answers, weights })).toBe(liveScore());
      cleanup();
    }
  }, 120000);

  it("engine matches src/lib/scoreCalculations.ts calculatePK7 (positive weights)", () => {
    for (let r = 0; r < RUNS_PURE; r++) {
      const answers: Record<number, number | null> = {};
      const weights: Record<number, number> = {};
      engine.PK7_DOMAINS.forEach((d: any) => {
        answers[d.id] = rand() < 0.8 ? Math.floor(rand() * (d.maxValue + 1)) : null;
        weights[d.id] = 0.1 + rand() * 5;
      });
      const lib = calculatePK7(answers, weights);
      const got = engine.pk7Score(answers, weights);
      expect(got ? got.score : null).toBe(lib ? lib.score : null);
    }
  });
});

// ---------- Bands ----------
describe("Band parity", () => {
  it("scoreBand labels match scoreUtils.getScoreBand for 0..100", async () => {
    const { getScoreBand } = await import("@/lib/scoreUtils");
    for (let s = 0; s <= 100; s++) expect(engine.scoreBand(s).label).toBe(getScoreBand(s).label);
  });
});
