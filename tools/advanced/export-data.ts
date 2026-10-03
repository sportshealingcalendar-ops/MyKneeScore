// Bundled with esbuild and run inside a kneescore-research checkout (see build.sh).
// Exports score metadata plus the exact question set each score uses in QuickCalculator.
import { kneeScores } from "./src/lib/kneeScores";
import { getQuestionsForScore } from "./src/lib/scoreQuestions";
const out = kneeScores.map(s => ({ ...s, questionSet: getQuestionsForScore(s.name) }));
process.stdout.write(JSON.stringify(out));
