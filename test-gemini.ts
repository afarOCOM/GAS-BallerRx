import { generateQuestions } from './src/lib/gemini.ts';

async function run() {
  try {
    const q = await generateQuestions("Cardiology", "Heart Murmurs", 2, "medium");
    console.log("Q:", q.length);
  } catch (e) {
    console.error(e);
  }
}

run();
