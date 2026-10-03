/*
 * My Knee Score: Advanced scoring engine.
 *
 * Line-for-line ports of the scoring logic in SportsHealing/kneescore-research.
 * DO NOT change the arithmetic in this file. Same answers must give the same
 * score as the source. tools/advanced/parity.test.tsx checks this against the
 * original React components.
 *
 *   quickScore   <- src/components/QuickCalculator.tsx   (result useMemo)
 *   ragZone      <- src/components/QuickCalculator.tsx   (RAGDial)
 *   sk11Score    <- src/components/SK11Calculator.tsx    (computedResult useMemo)
 *   pk7Score     <- src/components/PK7Calculator.tsx     (normalizedWeights + computedResult)
 *   scoreBand    <- src/lib/scoreUtils.ts                (getScoreBand labels)
 */
(function (root) {
  "use strict";

  // QuickCalculator: answers maps question id -> selected option value (string)
  function quickScore(questions, answers, scoringRange) {
    var answeredCount = Object.keys(answers).length;
    if (answeredCount === 0) return null;

    var totalScore = 0;
    var maxPossible = 0;

    questions.forEach(function (q) {
      var selectedValue = answers[q.id];
      if (selectedValue !== undefined) {
        var numeric = parseFloat(selectedValue);
        // Negative values mean "Do not do" (e.g. Norwich) - excluded from numerator and denominator
        if (isNaN(numeric) || numeric < 0) return;
        totalScore += numeric;
        // Find max value from options
        var maxOption = Math.max.apply(null, q.options.map(function (o) { return parseFloat(o.value); }).filter(function (v) { return !isNaN(v); }));
        maxPossible += maxOption;
      }
    });

    if (maxPossible === 0) return null;

    // Normalize to score's range
    var normalized = (totalScore / maxPossible) * scoringRange.max;
    var finalScore = Math.round(normalized);

    return {
      score: Math.max(scoringRange.min, Math.min(scoringRange.max, finalScore)),
      isComplete: answeredCount >= questions.length,
      answeredCount: answeredCount,
      totalQuestions: questions.length
    };
  }

  // QuickCalculator RAGDial zone
  function ragZone(score, maxScore, isHigherBetter) {
    var normalizedScore = (score / maxScore) * 100;
    var dialPosition = isHigherBetter ? normalizedScore : (100 - normalizedScore);
    var zone = dialPosition >= 70 ? "Good" : dialPosition >= 40 ? "Fair" : "Poor";
    return { zone: zone, dialPosition: dialPosition };
  }

  var SK11_QUESTIONS = [
    { id: 1, text: "How comfortable is your knee during usual activities?", domain: "Comfort", weight: 0.148221 },
    { id: 2, text: "How free is your knee from stiffness when first moving after rest?", domain: "Stiffness", weight: 0.069169 },
    { id: 3, text: "How little swelling do you have after activity?", domain: "Swelling", weight: 0.069169 },
    { id: 4, text: "How stable does your knee feel (no giving way)?", domain: "Stability", weight: 0.098815 },
    { id: 5, text: "How well can you walk long distances on level ground?", domain: "Walking", weight: 0.098815 },
    { id: 6, text: "How easily can you manage stairs (one flight)?", domain: "Stairs", weight: 0.079052 },
    { id: 7, text: "How easily can you kneel or squat?", domain: "Kneeling", weight: 0.079052 },
    { id: 8, text: "How free is your knee from mechanical symptoms (catching/locking)?", domain: "Mechanical", weight: 0.098815 },
    { id: 9, text: "What is your current activity level?", domain: "Activity", weight: 0.118577 },
    { id: 10, text: "Overall, how good does your knee function feel today?", domain: "Overall", weight: 0.128458 },
    { id: 11, text: "How little does your knee affect your sleep?", domain: "Sleep", weight: 0.011857 }
  ];

  // SK11Calculator: answers maps id -> number (0-10) or null
  function sk11Score(answers, incompleteThreshold) {
    if (incompleteThreshold === undefined) incompleteThreshold = 8;
    var answeredQuestions = SK11_QUESTIONS.filter(function (q) { return answers[q.id] !== null && answers[q.id] !== undefined; });

    if (answeredQuestions.length === 0) {
      return null;
    }

    var totalWeight = answeredQuestions.reduce(function (sum, q) { return sum + q.weight; }, 0);

    var weightedSum = answeredQuestions.reduce(function (sum, q) {
      var value = answers[q.id];
      var renormalizedWeight = q.weight / totalWeight;
      return sum + (value * renormalizedWeight);
    }, 0);

    var score = Math.round(10 * weightedSum);

    return {
      score: Math.max(0, Math.min(100, score)),
      answeredCount: answeredQuestions.length,
      totalQuestions: SK11_QUESTIONS.length,
      isIncomplete: answeredQuestions.length < incompleteThreshold,
      totalWeight: totalWeight
    };
  }

  var PK7_DOMAINS = [
    { id: 1, name: "Pain", maxValue: 10, defaultWeight: 1, description: "Current pain level" },
    { id: 2, name: "Disturbed sleep", maxValue: 10, defaultWeight: 1, description: "Sleep disturbance due to knee" },
    { id: 3, name: "Swelling", maxValue: 5, defaultWeight: 1, description: "Knee swelling severity" },
    { id: 4, name: "Instability & giving way", maxValue: 5, defaultWeight: 1, description: "Knee stability" },
    { id: 5, name: "Stiffness / restriction of movement", maxValue: 5, defaultWeight: 1, description: "Movement restriction" },
    { id: 6, name: "Stairs (climb & descend)", maxValue: 5, defaultWeight: 1, description: "Stair management ability" },
    { id: 7, name: "Function & mobility", maxValue: 10, defaultWeight: 1, description: "Overall functional mobility" }
  ];

  function pk7DefaultWeights() {
    var w = {};
    PK7_DOMAINS.forEach(function (d) { w[d.id] = d.defaultWeight; });
    return w;
  }

  // PK7Calculator weight input handler: parseFloat(value) || 0, floored at 0
  function pk7ParseWeight(value) {
    var numValue = parseFloat(value) || 0;
    return Math.max(0, numValue);
  }

  // PK7Calculator normalizedWeights useMemo
  function pk7NormalizedWeights(answers, weights) {
    var answeredDomains = PK7_DOMAINS.filter(function (d) { return answers[d.id] !== null && answers[d.id] !== undefined; });
    if (answeredDomains.length === 0) return {};

    var totalWeight = answeredDomains.reduce(function (sum, d) { return sum + weights[d.id]; }, 0);
    var out = {};
    answeredDomains.forEach(function (d) { out[d.id] = weights[d.id] / totalWeight; });
    return out;
  }

  // PK7Calculator computedResult useMemo
  function pk7Score(answers, weights, incompleteThreshold) {
    if (!weights) weights = pk7DefaultWeights();
    if (incompleteThreshold === undefined) incompleteThreshold = 5;
    var normalizedWeights = pk7NormalizedWeights(answers, weights);
    var answeredDomains = PK7_DOMAINS.filter(function (d) { return answers[d.id] !== null && answers[d.id] !== undefined; });

    if (answeredDomains.length === 0) {
      return null;
    }

    var weightedSum = answeredDomains.reduce(function (sum, domain) {
      var value = answers[domain.id];
      var normalizedValue = (value / domain.maxValue) * 100;
      var normalizedWeight = normalizedWeights[domain.id] || 0;
      return sum + (normalizedValue * normalizedWeight);
    }, 0);

    var score = Math.round(weightedSum);

    return {
      score: Math.max(0, Math.min(100, score)),
      answeredCount: answeredDomains.length,
      totalQuestions: PK7_DOMAINS.length,
      isIncomplete: answeredDomains.length < incompleteThreshold,
      normalizedWeights: normalizedWeights
    };
  }

  // scoreUtils getScoreBand (labels and descriptions only)
  function scoreBand(score) {
    if (score >= 85) return { label: "Excellent", description: "Optimal knee function" };
    if (score >= 70) return { label: "Good", description: "Good knee function with minor limitations" };
    if (score >= 60) return { label: "Fair", description: "Fair function with moderate limitations" };
    if (score >= 40) return { label: "Poor", description: "Poor function with significant limitations" };
    return { label: "Very Poor", description: "Severe functional impairment" };
  }

  var api = {
    quickScore: quickScore,
    ragZone: ragZone,
    SK11_QUESTIONS: SK11_QUESTIONS,
    sk11Score: sk11Score,
    PK7_DOMAINS: PK7_DOMAINS,
    pk7DefaultWeights: pk7DefaultWeights,
    pk7ParseWeight: pk7ParseWeight,
    pk7NormalizedWeights: pk7NormalizedWeights,
    pk7Score: pk7Score,
    scoreBand: scoreBand
  };

  if (typeof module !== "undefined" && module.exports) { module.exports = api; }
  else { root.MKSEngine = api; }
})(this);
