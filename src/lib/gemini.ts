/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import { Question, Difficulty } from "../types.ts";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const getDifficultyPrompt = (difficulty: Difficulty) => {
  switch (difficulty) {
    case 'easy':
      return `Generate a basic review question assessing core fundamental knowledge. 
- FORMAT: Direct question or very brief clinical scenario (1-2 sentences).
- COGNITIVE LEVEL: First-order recall or simple comprehension.
- REQUIRED ELEMENTS: Ask directly about a hallmark symptom, classic mechanism of action, or primary treatment. 
- DISTRACTORS: Must be easily excluded by a student with baseline knowledge. Do not use tricky 'except' phrasing.`;
    case 'medium':
      return `Generate a standard board-style clinical vignette. 
- FORMAT: Short clinical vignette (3-4 sentences). Include age, gender, presenting symptom, and 1-2 key physical exam or lab findings. 
- COGNITIVE LEVEL: Second-order thinking. Do not ask directly for the diagnosis. Instead, imply the diagnosis in the stem, and ask about the underlying pathophysiology, embryology, associated findings, primary adverse effect of the treatment, or next best step in management.
- DISTRACTORS: Use plausible options that relate to similar diseases or common conceptual pitfalls.`;
    case 'hard':
      return `Generate a complex, highly discriminatory USMLE/COMLEX board-style question.
- FORMAT: Detailed clinical vignette (4-6 sentences). Include pertinent positives, pertinent negatives, and specific lab values or imaging findings designed to mislead. 
- COGNITIVE LEVEL: Third-order thinking or multi-step reasoning. The student must synthesize conflicting information to arrive at a diagnosis, and then make a nuanced choice about an obscure mechanism, rare side-effect, or definitive vs. initial management.
- DISTRACTORS: All options must be highly plausible. Distractors should represent closely related conditions, earlier stages of the same condition, or treatments for similar but distinct diseases. Represent common cognitive errors.`;
    default:
      return "Generate a standard medical question.";
  }
};

export async function generateLesson(
  weakTopics: string[],
  originalObjectives: string
): Promise<string> {
  const prompt = `
    You are an expert medical educator. The student recently took a practice quiz generated around these objectives:
    "${originalObjectives.substring(0, 1000)}"

    The student struggled with the following specific topics:
    ${weakTopics.join(', ')}

    Your task is to generate a highly focused, concise study guide (lesson) addressing these specific weak areas, keeping in mind the original intent of the quiz objectives. 
    REQUIREMENTS:
    - NO FLUFF/FILLER. Output strictly the study content. Do not include introductory/concluding text like "Here is your study guide" or "Good luck on your exam".
    - Use pure Markdown for comprehensive formatting. DO NOT output HTML tags like <br> or <hr>. Use double newlines for paragraph breaks and spacing.
    - Use LaTeX for any mathematical notations or formulas (use \`$math$\` for inline and \`$$math$$\` for block).
    - Utilize spacing and line breaks generously to group information cleanly.
    - Use tables wherever beneficial to consolidate or contrast information (e.g. comparing distinct diseases side-by-side).
    - Keep the content clear, structured (use bullet points, bold text for emphasis), and actionable. Include mnemonics if applicable.
    - Focus strictly on the high-yield concepts the student missed, do not write a generic textbook chapter.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
    });
    return response.text || "Failed to generate lesson.";
  } catch (error) {
    console.error("Error generating lesson:", error);
    return "Error generating lesson content. Please try again later.";
  }
}

export async function generateQuestions(
  generalTopic: string,
  objectives: string,
  count: number,
  difficulty: Difficulty,
  onFallback?: () => void
): Promise<Question[]> {
  const difficultyPrompt = getDifficultyPrompt(difficulty);
  
  let focusTopics = "";
  let strictEnforcement = "";

  if (generalTopic && generalTopic !== 'All Systems (High Yield)') {
    focusTopics += `Primary System/Subject: ${generalTopic}\n    `;
  }
  if (objectives.trim()) {
    focusTopics += `Specific Focus/Objectives: ${objectives.trim().substring(0, 50000)}\n    `;
    strictEnforcement = "CRITICAL INSTRUCTION: You MUST strictly isolate and restrict ALL generated questions to the 'Specific Focus/Objectives' provided. Do not generate generic questions outside of this requested scope.";
  }
  if (!focusTopics.trim()) {
    focusTopics = "General high-yield USMLE/COMLEX Step 1 topics across various organ systems.";
  }
  
  const prompt = `
    You are an expert medical educator preparing questions for USMLE Step 1 and COMLEX Level 1.
    
    FOCUS TOPICS: 
    ${focusTopics}
    
    ${strictEnforcement}

    DIFFICULTY LEVEL PARAMETERS:
    Difficulty Requested: ${difficulty.toUpperCase()}
    ${difficultyPrompt}
    
    GENERAL QUESTION GUIDELINES:
    1. QUESTION INTEGRITY: Every \`stem\` MUST end with a clear, specific question (e.g., 'What is the most likely diagnosis?', 'Which of the following describes the mechanism of action?'). NEVER just describe a scenario without asking a question.
    2. EXPLANATIONS: Must be highly detailed. First paragraph MUST clearly explain why the correct answer is correct. Subsequent paragraphs MUST individually explain exactly why each distractor is incorrect.
    3. OPTION QUALITY: Ensure at least 4 options, preferably 5 distinct options (A through E). Do not use "All of the above" or "None of the above".
    4. CLINICAL RELEVANCE: Questions should test concepts necessary for safe and effective clinical practice.
    
    You must generate exactly ${count} unique questions in JSON format following the schema precisely.
  `;

  let attempts = 0;
  const maxAttempts = 3;
  let currentModel = "gemini-3.1-pro-preview";

  while (attempts < maxAttempts) {
    try {
      const response = await ai.models.generateContent({
        model: currentModel,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                stem: { type: Type.STRING, description: "The complete question text, MUST include both the clinical vignette (if applicable) AND the final question being asked." },
                options: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                correctAnswer: { type: Type.INTEGER, description: "Index of the correct option (0-indexed)" },
                explanation: { type: Type.STRING },
                system: { type: Type.STRING, description: "Broad organ system or discipline (e.g., Cardiology, Pharmacology, Behavioral Science)" },
                topic: { type: Type.STRING, description: "Specific learning objective or distinct topic (e.g., Heart Murmurs, Diuretics)" },
                difficulty: { type: Type.STRING },
              },
              required: ["id", "stem", "options", "correctAnswer", "explanation", "system", "topic", "difficulty"],
            },
          },
        },
      });

      let questions: Question[] = [];
      try {
        const parsed = JSON.parse(response.text || "[]");
        if (Array.isArray(parsed)) {
           questions = parsed;
        } else {
           console.error("AI did not return an array as expected", parsed);
           throw new Error("AI did not return an array");
        }
      } catch (parseError) {
        console.error("Failed to parse JSON response:", response.text);
        throw parseError; // Caught by outer try/catch to trigger retry
      }
      
      if (questions.length > 0) {
        // Ensure uniqueness of keys in React by overwriting AI-generated IDs which can sometimes be duplicated
        questions = questions.map(q => ({ ...q, id: crypto.randomUUID() }));
        return questions;
      } else {
        throw new Error("Generated questions array is empty");
      }
    } catch (error) {
      console.error(`Error generating questions (attempt ${attempts + 1}):`, error);
      const isRateLimit = error instanceof Error && error.message.includes("429");
      if (isRateLimit || (error as any)?.status === "RESOURCE_EXHAUSTED" || (error as any)?.status === 429) {
        if (currentModel !== "gemini-3-flash-preview") {
          currentModel = "gemini-3-flash-preview";
          if (onFallback) onFallback();
        }
        await new Promise(resolve => setTimeout(resolve, 2000 * Math.pow(2, attempts)));
      }
    }
    attempts++;
  }
  return [];
}

export async function generatePerformanceSummary(
  topics: { sys: string; name: string; correct: number; total: number }[],
  overallScore: number
): Promise<string> {
  const topicsText = topics.map(t => `- ${t.sys} > ${t.name}: ${t.correct}/${t.total} correct`).join('\n');
  const prompt = `You are an expert USMLE/COMLEX tutor providing a highly concise performance breakdown. Use zero filler words.

Overall Score: ${overallScore}%
Topic Breakdown:
${topicsText}

Requirements:
1. Quickly summarize performance clinically and directly.
2. Identify strong areas.
3. Identify areas for improvement and MUST format them in **bold**.
4. Identify which missed/weak topics are high-yield and essential for the boards.
5. Keep it to a brief paragraph or short bullets. Do not use markdown headers.`;

  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      return response.text || "No insights generated.";
    } catch (error) {
      console.error(`Error generating insights (attempt ${attempts + 1}):`, error);
      const isRateLimit = error instanceof Error && error.message.includes("429");
      if (isRateLimit || (error as any)?.status === "RESOURCE_EXHAUSTED" || (error as any)?.status === 429) {
        await new Promise(resolve => setTimeout(resolve, 2000 * Math.pow(2, attempts)));
      }
    }
    attempts++;
  }
  return "Failed to generate performance insights due to a network error or API timeout.";
}

export async function parseDocumentToChapters(documentText: string) {
  const prompt = `You are a medical study assistant. The user has uploaded a document containing study objectives, topics, or a syllabus.
Parse the document and divide it into logical "chapters" or "sections". For each chapter, extract the specific topics and learning objectives it covers into a concise summary.

Document Text (truncated):
${documentText.substring(0, 400000)}
`;

  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: "Name of the chapter or section" },
                content: { type: Type.STRING, description: "Detailed list or summary of all learning objectives and topics in this chapter" }
              },
              required: ["title", "content"]
            }
          }
        }
      });
      return JSON.parse(response.text || "[]") as { title: string, content: string }[];
    } catch (error) {
      console.error(`Failed to parse document to chapters (attempt ${attempts + 1}):`, error);
      const isRateLimit = error instanceof Error && error.message.includes("429");
      if (isRateLimit || (error as any)?.status === "RESOURCE_EXHAUSTED" || (error as any)?.status === 429) {
        await new Promise(resolve => setTimeout(resolve, 2000 * Math.pow(2, attempts)));
      }
    }
    attempts++;
  }
  return [];
}
