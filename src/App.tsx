/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  BookOpen,
  Settings,
  Play,
  CheckCircle2,
  Target,
  History,
  Flag,
  FlagOff,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Trophy,
  PieChart as PieChartIcon,
  Home,
  Check,
  Plus,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Search,
  Menu,
  X,
  Keyboard,
  Moon,
  Sun,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

import {
  Question,
  Difficulty,
  Session,
  UserAnswer,
  UserProgress,
  Lesson,
} from "./types.ts";
import {
  generateQuestions,
  generatePerformanceSummary,
  parseDocumentToChapters,
  generateLesson,
} from "./lib/gemini.ts";

// --- Utility ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const ProgressBar = ({
  current,
  total,
  flagged,
}: {
  current: number;
  total: number;
  flagged: number[];
}) => (
  <div className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden flex">
    {Array.from({ length: total }).map((_, i) => (
      <div
        key={i}
        className={cn(
          "h-full flex-1 border-r border-white/20 last:border-0",
          i < current
            ? "bg-zinc-900 dark:bg-zinc-100"
            : i === current
              ? "bg-amber-400"
              : "bg-zinc-200 dark:bg-zinc-700",
          flagged.includes(i) && "ring-2 ring-inset ring-red-400",
        )}
      />
    ))}
  </div>
);

export default function App() {
  // Navigation & State
  const [view, setView] = useState<
    | "home"
    | "config"
    | "loading"
    | "quiz"
    | "report"
    | "history"
    | "review"
    | "lessons"
    | "flaggedItems"
  >("home");
  const [objectives, setObjectives] = useState("");
  const [generalTopic, setGeneralTopic] = useState("All Systems (High Yield)");
  const [config, setConfig] = useState<{
    count: number;
    difficulty: Difficulty;
    isCustomCount: boolean;
    quizMode: "guided" | "practice";
  }>({
    count: 10,
    difficulty: "medium",
    isCustomCount: false,
    quizMode: "guided",
  });
  const [questions, setQuestions] = useState<Question[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [history, setHistory] = useState<Session[]>([]);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [currentReportSummary, setCurrentReportSummary] = useState<
    string | null
  >(null);
  const [reportSession, setReportSession] = useState<Session | null>(null);

  // Additional states for Review functionality
  const [expandedSystems, setExpandedSystems] = useState<string[]>([]);
  const [reviewState, setReviewState] = useState<{
    topic: string;
    questions: Question[];
    session: Session;
    currentIndex: number;
  } | null>(null);
  const [reportSearchQuery, setReportSearchQuery] = useState("");
  const [showJumpMenu, setShowJumpMenu] = useState(false);

  // Specific states for Flagged Items view
  
  const [unflaggedItems, setUnflaggedItems] = useState<{
    unflaggedAt: number;
    question: Question;
    sessionId: string;
    topic: string;
  }[]>([]);

  const [selectedFlaggedTopic, setSelectedFlaggedTopic] = useState<
    string | null
  >(null);
  const [currentFlaggedIndex, setCurrentFlaggedIndex] = useState(0);

  // Document/Syllabus states
  const [documentChapters, setDocumentChapters] = useState<
    { title: string; content: string }[] | null
  >(null);
  const [documentName, setDocumentName] = useState<string | null>(null);
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
  const [showChapterDropdown, setShowChapterDropdown] = useState(false);
  const [isParsingDocument, setIsParsingDocument] = useState(false);
  const [parseProgress, setParseProgress] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState<{
    completed: number;
    total: number;
    generatedItems: number;
    targetItems: number;
  } | null>(null);
  const [didFallbackModel, setDidFallbackModel] = useState(false);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isGeneratingLesson, setIsGeneratingLesson] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const [shortcutFeedback, setShortcutFeedback] = useState<{
    message: string;
    id: number;
  } | null>(null);

  // Theme Management
  useEffect(() => {
    const savedTheme = localStorage.getItem("omni_board_theme");
    if (
      savedTheme === "dark" ||
      (!savedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches)
    ) {
      setTheme("dark");
      document.documentElement.classList.add("dark");
    } else {
      setTheme("light");
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("omni_board_theme", newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  // Load History & Active Session
  useEffect(() => {
    const saved = localStorage.getItem("omni_board_history");
    if (saved) {
      try {
        const parsedHistory = JSON.parse(saved) as Session[];
        // Deduplicate history by session ID in case of previously corrupted state
        const uniqueHistory = [];
        const seenIds = new Set();
        for (const session of parsedHistory) {
          if (!seenIds.has(session.id)) {
            uniqueHistory.push(session);
            seenIds.add(session.id);
          }
        }
        setHistory(uniqueHistory);
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
    const savedActive = localStorage.getItem("omni_board_active");
    if (savedActive) {
      try {
        const parsed: Session = JSON.parse(savedActive);
        if (!parsed.isCompleted) {
          setActiveSession(parsed);
          setQuestions(parsed.questions);
          // Auto-resume to the next unanswered question if possible
          setCurrentIndex(
            Math.min(parsed.answers.length, parsed.maxQuestions - 1),
          );
        }
      } catch (e) {
        console.error("Failed to parse active session", e);
      }
    }

    // Load chapters
    const savedChapters = localStorage.getItem("omni_board_chapters");
    if (savedChapters) {
      try {
        setDocumentChapters(JSON.parse(savedChapters));
      } catch (e) {
        console.error("Failed to parse chapters", e);
      }
    }

    const savedLessons = localStorage.getItem("omni_board_lessons");
    if (savedLessons) {
      try {
        setLessons(JSON.parse(savedLessons));
      } catch (e) {
        console.error("Failed to parse lessons", e);
      }
    }

    const savedUnflag = localStorage.getItem("omni_board_unflagged");
    if (savedUnflag) {
      try {
        const parsed = JSON.parse(savedUnflag);
        const valid = parsed.filter((item) => item.unflaggedAt > Date.now() - 7 * 24 * 60 * 60 * 1000);
        setUnflaggedItems(valid);
        if (valid.length !== parsed.length) localStorage.setItem("omni_board_unflagged", JSON.stringify(valid));
      } catch (e) {
        console.error("Failed to parse unflagged", e);
      }
    }
  }, []);

  // Continuously sync activeSession
  useEffect(() => {
    if (activeSession) {
      localStorage.setItem("omni_board_active", JSON.stringify(activeSession));
    } else {
      localStorage.removeItem("omni_board_active");
    }
  }, [activeSession]);


  // Sync unflaggedItems
  useEffect(() => {
    localStorage.setItem("omni_board_unflagged", JSON.stringify(unflaggedItems));
  }, [unflaggedItems]);

  useEffect(() => {
    let isSubscribed = true;

    if (view === "report" && reportSession) {
      setCurrentReportSummary(null);
      setIsGeneratingSummary(true);

      const score = reportSession.answers.filter((a) => a.isCorrect).length;
      const pct = Math.round((score / reportSession.maxQuestions) * 100);

      const topicsList: {
        sys: string;
        name: string;
        correct: number;
        total: number;
      }[] = [];
      const grouped: any = {};
      reportSession.questions.forEach((q) => {
        const sys = q.system || "General";
        const top = q.topic || "General";
        const ans = reportSession.answers.find((a) => a.questionId === q.id);
        const isCorrect = ans?.isCorrect || false;
        const key = `${sys}|${top}`;
        if (!grouped[key])
          grouped[key] = { sys, name: top, correct: 0, total: 0 };
        grouped[key].total += 1;
        if (isCorrect) grouped[key].correct += 1;
      });
      Object.keys(grouped).forEach((k) => topicsList.push(grouped[k]));

      generatePerformanceSummary(topicsList, pct).then((summary) => {
        if (isSubscribed) {
          setCurrentReportSummary(summary);
          setIsGeneratingSummary(false);
        }
      });
    }

    return () => {
      isSubscribed = false;
    };
  }, [view, reportSession?.id]);

  const saveHistory = (newHistory: Session[]) => {
    setHistory(newHistory);
    localStorage.setItem("omni_board_history", JSON.stringify(newHistory));
  };

  const saveLessons = (newLessons: Lesson[]) => {
    setLessons(newLessons);
    localStorage.setItem("omni_board_lessons", JSON.stringify(newLessons));
  };

  const clearDocument = () => {
    setDocumentChapters(null);
    setDocumentName(null);
    setObjectives("");
    setSelectedChapters([]);
    localStorage.removeItem("omni_board_chapters");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingDocument(true);
    setParseProgress("Reading file...");
    setDocumentName(file.name);
    try {
      let text = "";
      if (file.type === "application/pdf") {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        let fullText = "";
        const limit = Math.min(pdf.numPages, 120); // Cap at 120 pages for reasonable extraction (gemini limit is high, but lets be reasonable)
        for (let i = 1; i <= limit; i++) {
          setParseProgress(`Extracting PDF page ${i} of ${pdf.numPages}...`);
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          // @ts-ignore
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(" ");
          fullText += pageText + "\n";
        }
        text = fullText;
        if (pdf.numPages > limit) {
          console.warn(`PDF truncated to ${limit} pages to avoid limits.`);
        }
      } else {
        text = await file.text();
      }

      if (text.trim()) {
        setParseProgress(
          "Analyzing content and extracting chapters (this might take a minute)...",
        );
        const chapters = await parseDocumentToChapters(text);
        if (chapters && chapters.length > 0) {
          setDocumentChapters(chapters);
          localStorage.setItem("omni_board_chapters", JSON.stringify(chapters));
          alert(`Successfully extracted ${chapters.length} chapters!`);
        } else {
          alert(
            "Could not extract any chapters from this file. Ensure it's a valid study document.",
          );
        }
      } else {
        alert(
          "We couldn't extract any readable text from this file. If this is a PDF, it might be composed of images (e.g., a scanned document) or have restricted text extraction. Try using an OCR tool to convert it to text, or uploading a text-based document instead.",
        );
      }
    } catch (error: any) {
      console.error("Upload error", error);
      let errorMessage = "Failed to read the file.";

      if (error && error.name === "PasswordException") {
        errorMessage =
          "This PDF is password-protected. Please remove the password and try again.";
      } else if (
        error &&
        error.message &&
        error.message.includes("Invalid PDF structure")
      ) {
        errorMessage =
          "The PDF appears to be corrupted or its structure is invalid. Please ensure the file is not damaged.";
      } else {
        errorMessage = `Failed to read the file: ${error instanceof Error ? error.message : String(error)}. \n\nIf this issue persists, try converting the file to a standard .txt or .md format.`;
      }

      alert(errorMessage);
    }
    setIsParsingDocument(false);
    setParseProgress(null);
    if (e.target) {
      e.target.value = ""; // Reset input so same file can be uploaded again if needed
    }
  };

  // --- Handlers ---

  const handleStartSession = async () => {
    setView("loading");
    setGenerationProgress(null);
    setDidFallbackModel(false);

    type BatchRequest = { objectives: string; count: number };
    let batches: BatchRequest[] = [];

    if (
      documentChapters &&
      documentChapters.length > 0 &&
      selectedChapters.length > 0
    ) {
      const numChapters = selectedChapters.length;
      const baseCount = Math.floor(config.count / numChapters);
      const remainder = config.count % numChapters;

      batches = selectedChapters
        .map((chapterTitle, index) => {
          const chapter = documentChapters.find(
            (c) => c.title === chapterTitle,
          );
          const chapterObjective = `Chapter: ${chapter?.title}\nObjectives:\n${chapter?.content}`;
          const chapterCount = baseCount + (index < remainder ? 1 : 0);
          return { objectives: chapterObjective, count: chapterCount };
        })
        .filter((b) => b.count > 0);
    } else {
      let remainingCount = config.count;
      const chunkSize = 5;
      while (remainingCount > 0) {
        const currentChunk = Math.min(remainingCount, chunkSize);
        batches.push({ objectives: objectives, count: currentChunk });
        remainingCount -= currentChunk;
      }
    }

    if (batches.length === 0) {
      alert("No questions to generate.");
      setView("config");
      return;
    }

    setGenerationProgress({
      completed: 0,
      total: batches.length,
      generatedItems: 0,
      targetItems: config.count,
    });

    let generated: Question[] = [];
    let completedBatches = 0;

    let sessionName = objectives || generalTopic;
    if (
      documentChapters &&
      documentChapters.length > 0 &&
      selectedChapters.length > 0
    ) {
      if (selectedChapters.length === 1) {
        sessionName = `Document: ${documentName || "Syllabus"} - ${selectedChapters[0]}`;
      } else {
        sessionName = `Document: ${documentName || "Syllabus"} (${selectedChapters.length} chapters)`;
      }
    }

    for (const batch of batches) {
      try {
        const bgGenerated = await generateQuestions(
          generalTopic,
          batch.objectives,
          batch.count,
          config.difficulty,
          () => setDidFallbackModel(true),
        );
        if (bgGenerated.length > 0) {
          generated = [...generated, ...bgGenerated];
        }
      } catch (err) {
        console.error("Batch generation error:", err);
      }
      completedBatches++;
      setGenerationProgress({
        completed: completedBatches,
        total: batches.length,
        generatedItems: generated.length,
        targetItems: config.count,
      });
    }

    if (generated.length === 0) {
      alert(
        "Failed to generate questions. Please check your connection or objectives.",
      );
      setView("config");
      return;
    }

    setQuestions([...generated]);

    const newSession: Session = {
      id: crypto.randomUUID(),
      startTime: Date.now(),
      objectives: sessionName,
      difficulty: config.difficulty,
      maxQuestions: generated.length,
      questions: [...generated],
      answers: [],
      isCompleted: false,
      quizMode: config.quizMode,
      flaggedQuestionIds: [],
      generationContext: {
        generalTopic,
        batches: batches.map((b) => ({
          objectives: b.objectives,
          parameters: {
            count: b.count,
            difficulty: config.difficulty,
          },
        })),
      },
    };

    setActiveSession(newSession);
    setCurrentIndex(0);
    setShowExplanation(false);
    setSelectedOption(null);
    setView("quiz");
  };

  const handleExtendSession = async () => {
    if (!activeSession) return;

    setView("loading");
    setGenerationProgress(null);
    setDidFallbackModel(false);

    const context = activeSession.generationContext || {
      generalTopic: "General Medical Knowledge",
      batches: [{
        objectives: activeSession.objectives,
        parameters: { count: activeSession.maxQuestions, difficulty: activeSession.difficulty }
      }],
    };
    const numBatches = context.batches.length;
    const countToAdd = config.count;
    const baseCount = Math.floor(countToAdd / numBatches);
    const remainder = countToAdd % numBatches;

    type BatchRequest = { objectives: string; count: number; difficulty: Difficulty };
    let batchReqs: BatchRequest[] = context.batches
      .map((batchObj, i) => {
        return { 
          objectives: typeof batchObj === 'string' ? batchObj : batchObj.objectives, 
          count: baseCount + (i < remainder ? 1 : 0),
          difficulty: typeof batchObj === 'string' ? config.difficulty : (batchObj.parameters?.difficulty || config.difficulty)
        };
      })
      .filter((b) => b.count > 0);

    if (batchReqs.length === 0) {
      setView("report");
      return;
    }

    let generated: Question[] = [];
    let completedBatches = 0;

    setGenerationProgress({
      completed: 0,
      total: batchReqs.length,
      generatedItems: 0,
      targetItems: countToAdd,
    });

    for (const batch of batchReqs) {
      try {
        const bgGenerated = await generateQuestions(
          context.generalTopic,
          batch.objectives,
          batch.count,
          batch.difficulty,
          () => setDidFallbackModel(true),
        );
        if (bgGenerated.length > 0) {
          generated = [...generated, ...bgGenerated];
        }
      } catch (err) {
        console.error("Batch generation error:", err);
      }
      completedBatches++;
      setGenerationProgress({
        completed: completedBatches,
        total: batchReqs.length,
        generatedItems: generated.length,
        targetItems: countToAdd,
      });
    }

    if (generated.length === 0) {
      alert("Failed to generate additional questions.");
      setView("report");
      return;
    }

    const updatedSession = {
      ...activeSession,
      questions: [...activeSession.questions, ...generated],
      maxQuestions: activeSession.maxQuestions + generated.length,
      isCompleted: false,
      generationContext: {
        generalTopic: context.generalTopic,
        batches: [
          ...context.batches.map(b => (typeof b === 'string' ? { objectives: b, parameters: { count: activeSession.maxQuestions, difficulty: activeSession.difficulty } } : b)),
          ...batchReqs.map(br => ({
            objectives: br.objectives,
            parameters: { count: br.count, difficulty: br.difficulty }
          }))
        ]
      }
    };

    setQuestions(updatedSession.questions);
    setActiveSession(updatedSession);
    setHistory((prev) =>
      prev.map((s) => (s.id === updatedSession.id ? updatedSession : s)),
    );

    setCurrentIndex(activeSession.questions.length);
    setShowExplanation(false);
    setSelectedOption(null);
    setView("quiz");
  };

  // Helper to show shortcut feedback toast
  const showShortcutFeedback = useCallback((message: string) => {
    const id = Date.now();
    setShortcutFeedback({ message, id });
    setTimeout(() => {
      setShortcutFeedback((current) => (current?.id === id ? null : current));
    }, 1500);
  }, []);

  // Keyboard Shortcuts Listener
  useEffect(() => {
    if (view !== "quiz" || !activeSession || !questions[currentIndex]) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or textarea
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        e.altKey ||
        e.ctrlKey ||
        e.metaKey
      ) {
        return;
      }

      const currentQuestion = questions[currentIndex];
      const key = e.key.toLowerCase();

      // Number keys for option selection (1-6)
      const numKey = parseInt(key, 10);
      if (
        !isNaN(numKey) &&
        numKey >= 1 &&
        numKey <= currentQuestion.options.length
      ) {
        e.preventDefault();
        const btn = document.getElementById(`option-btn-${numKey - 1}`);
        if (btn && !btn.hasAttribute("disabled")) {
          btn.click();
          showShortcutFeedback(
            `Selected Option ${String.fromCharCode(64 + numKey)}`,
          );
        }
        return;
      }

      switch (key) {
        case "f":
          e.preventDefault();
          document.getElementById("flag-btn")?.click();
          showShortcutFeedback("Toggled Flag");
          break;
        case "arrowright":
        case "enter": {
          e.preventDefault();
          const nextBtn = document.getElementById("next-btn");
          if (nextBtn && !nextBtn.hasAttribute("disabled")) {
            nextBtn.click();
            showShortcutFeedback(
              currentIndex >= activeSession.maxQuestions - 1
                ? "Finished Block"
                : "Next Item",
            );
          }
          break;
        }
        case "arrowleft": {
          e.preventDefault();
          const prevBtn = document.getElementById("prev-btn");
          if (prevBtn && !prevBtn.hasAttribute("disabled")) {
            prevBtn.click();
            showShortcutFeedback("Previous Item");
          }
          break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [view, activeSession, questions, currentIndex, showShortcutFeedback]);

  const currentQuestion = questions[currentIndex];
  const currentAnswer = activeSession?.answers.find(
    (a) => a.questionId === currentQuestion?.id,
  );

  const handleAnswer = (optionIndex: number) => {
    if (!activeSession || !currentQuestion) return;
    const isGuided =
      activeSession.quizMode === "guided" || !activeSession.quizMode;

    // In guided mode, if it's already answered, block overriding
    if (isGuided && currentAnswer) return;

    const isCorrect = optionIndex === currentQuestion.correctAnswer;
    const newAnswer: UserAnswer = {
      questionId: currentQuestion.id,
      selectedOption: optionIndex,
      isCorrect,
      isFlagged: false, // We use flaggedQuestionIds now
      timeSpent: 0,
    };

    const updatedAnswers = [
      ...activeSession.answers.filter(
        (a) => a.questionId !== currentQuestion.id,
      ),
      newAnswer,
    ];
    setActiveSession({ ...activeSession, answers: updatedAnswers });

    if (isGuided) {
      setShowExplanation(true);
    }
  };

  const handleFlag = () => {
    if (!activeSession || !currentQuestion) return;
    const isFlagged = activeSession.flaggedQuestionIds?.includes(
      currentQuestion.id,
    );
    let newFlagged = activeSession.flaggedQuestionIds || [];

    if (isFlagged) {
      newFlagged = newFlagged.filter((id) => id !== currentQuestion.id);
    } else {
      newFlagged = [...newFlagged, currentQuestion.id];
    }

    setActiveSession({ ...activeSession, flaggedQuestionIds: newFlagged });
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setShowExplanation(false);
      setSelectedOption(null);
    } else if (questions.length < (activeSession?.maxQuestions || 0)) {
      alert("Still generating the next questions... please wait a moment.");
    } else {
      handleFinish();
    }
  };

  const handleFinish = () => {
    if (!activeSession) return;
    const finishedSession = { ...activeSession, isCompleted: true };
    const newHistory = [
      finishedSession,
      ...history.filter((s) => s.id !== finishedSession.id),
    ];
    saveHistory(newHistory);
    setActiveSession(null); // Clear from active
    setReportSession(finishedSession);
    setView("report");
  };

  const handleViewSession = (session: Session) => {
    setReportSession(session);
    setExpandedSystems([]);
    setView("report");
  };

  const handleGenerateMore = (topic: string) => {
    setObjectives(topic);
    setGeneralTopic("All Systems (High Yield)");
    setView("config");
  };

  const toggleSystem = (system: string) => {
    setExpandedSystems((prev) =>
      prev.includes(system)
        ? prev.filter((s) => s !== system)
        : [...prev, system],
    );
  };

  const openReview = (topic: string, sysQuestions: Question[]) => {
    if (!reportSession) return;
    setReviewState({
      topic,
      questions: sysQuestions,
      session: reportSession,
      currentIndex: 0,
    });
    setView("review");
  };

  // --- Views ---

  const renderSidebar = () => (
    <aside className="w-14 lg:w-40 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-r border-zinc-200/50 dark:border-zinc-800/50 text-zinc-800 dark:text-zinc-200 flex flex-col min-h-screen transition-all z-50 sticky top-0">
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-center lg:justify-start">
        <div className="flex items-center gap-3">
          <img
            src="/hasty.jpg"
            alt="Hasty"
            className="w-10 h-10 rounded-xl object-cover border-2 border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800"
          />
          <span className="hidden lg:inline text-xl font-bold tracking-tight">
            BallerRx
          </span>
        </div>
      </div>
      <nav className="flex-1 py-4 px-1 lg:px-2 space-y-1 flex flex-col items-center lg:items-stretch">
        <button
          onClick={() => setView("home")}
          className={
            view === "home" || view === "config"
              ? "w-full btn-ghost-active flex justify-center lg:justify-start"
              : "w-full btn-ghost flex justify-center lg:justify-start"
          }
          title="Home"
        >
          <Home size={20} className="shrink-0" />{" "}
          <span className="hidden lg:inline">Home</span>
        </button>
        {activeSession && !activeSession.isCompleted && (
          <button
            onClick={() => setView("quiz")}
            className={
              view === "quiz"
                ? "w-full btn-ghost-active flex justify-center lg:justify-start"
                : "w-full btn-ghost flex justify-center lg:justify-start"
            }
            title="Active Quiz"
          >
            <Play size={20} className="shrink-0" />{" "}
            <span className="hidden lg:inline">Active Quiz</span>
          </button>
        )}
        <button
          onClick={() => {
            setView("history");
          }}
          className={
            view === "history" || view === "report" || view === "review"
              ? "w-full btn-ghost-active flex justify-center lg:justify-start"
              : "w-full btn-ghost flex justify-center lg:justify-start"
          }
          title="Performance"
        >
          <PieChartIcon size={20} className="shrink-0" />{" "}
          <span className="hidden lg:inline">Performance</span>
        </button>
        <button
          onClick={() => {
            setView("flaggedItems");
            setSelectedFlaggedTopic(null); // Reset back to main topics list when clicked
          }}
          className={
            view === "flaggedItems"
              ? "w-full btn-ghost-active flex justify-center lg:justify-start"
              : "w-full btn-ghost flex justify-center lg:justify-start"
          }
          title="Flagged"
        >
          <Flag size={20} className="shrink-0" />{" "}
          <span className="hidden lg:inline">Flagged</span>
        </button>
        <button
          onClick={() => {
            setView("lessons");
            setSelectedLesson(null);
          }}
          className={
            view === "lessons"
              ? "w-full btn-ghost-active flex justify-center lg:justify-start"
              : "w-full btn-ghost flex justify-center lg:justify-start"
          }
          title="Lessons"
        >
          <BookOpen size={20} className="shrink-0" />{" "}
          <span className="hidden lg:inline">Lessons</span>
        </button>
      </nav>
      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-center lg:justify-start">
        <button
          onClick={toggleTheme}
          className="w-full btn-ghost flex justify-center lg:justify-start"
          title="Toggle Theme"
        >
          {theme === "light" ? (
            <>
              <Moon size={20} className="shrink-0" />{" "}
              <span className="hidden lg:inline">Dark Mode</span>
            </>
          ) : (
            <>
              <Sun size={20} className="shrink-0" />{" "}
              <span className="hidden lg:inline">Light Mode</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );

  const renderHome = () => {
    // Dynamic Calculations
    const avgScore =
      history.length > 0
        ? Math.round(
            (history.reduce(
              (acc, s) =>
                acc +
                s.answers.filter((a) => a.isCorrect).length / s.maxQuestions,
              0,
            ) /
              history.length) *
              100,
          )
        : 0;

    const totalFlagged = history.reduce(
      (acc, s) => acc + s.answers.filter((a) => a.isFlagged).length,
      0,
    );

    const calculateStreak = () => {
      if (history.length === 0) return 0;
      const activeDates = new Set(
        history.map((s) => {
          const d = new Date(s.startTime);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        }),
      );

      let currentStreak = 0;
      const today = new Date();
      let checkDate = new Date(today);
      let dateString = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, "0")}-${String(checkDate.getDate()).padStart(2, "0")}`;

      if (!activeDates.has(dateString)) {
        checkDate.setDate(checkDate.getDate() - 1);
        dateString = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, "0")}-${String(checkDate.getDate()).padStart(2, "0")}`;
        if (!activeDates.has(dateString)) {
          return 0; // Neither today nor yesterday has activity
        }
      }

      while (activeDates.has(dateString)) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
        dateString = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, "0")}-${String(checkDate.getDate()).padStart(2, "0")}`;
      }
      return currentStreak;
    };
    const streak = calculateStreak();

    // Top Topics for Recent Performance
    const topicStats: Record<string, { total: number; correct: number }> = {};
    history.forEach((session) => {
      session.questions.forEach((q) => {
        const sys = q.system || q.topic || "General";
        if (!topicStats[sys]) topicStats[sys] = { total: 0, correct: 0 };
        topicStats[sys].total += 1;
        const ans = session.answers.find((a) => a.questionId === q.id);
        if (ans?.isCorrect) topicStats[sys].correct += 1;
      });
    });

    const topTopics = Object.entries(topicStats)
      .map(([name, stats]) => ({
        name,
        ...stats,
        pct: Math.round((stats.correct / stats.total) * 100),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 2);

    const weakTopics = Object.entries(topicStats)
      .map(([name, stats]) => ({
        name,
        ...stats,
        pct: Math.round((stats.correct / stats.total) * 100),
      }))
      // Filter topics where the user has at least attempted a few, and percentage is low
      .filter((t) => t.total > 0 && t.pct < 60)
      // Sort by worst performing first
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 3);

    const medicalTopics = [
      "All Systems (High Yield)",
      "Cardiology",
      "Pulmonology",
      "Gastroenterology",
      "Neurology",
      "Psychiatry / Behavioral Science",
      "Endocrinology",
      "Reproductive / Genitourinary",
      "Nephrology",
      "Dermatology",
      "Hematology / Oncology",
      "Immunology / Rheumatology",
      "Infectious Diseases",
      "Anatomy & Embryology",
      "Biochemistry & Genetics",
      "Pharmacology (General)",
      "Pathology (General)",
    ];

    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black font-display tracking-tight text-zinc-900 dark:text-zinc-100">
              BallerRx Home
            </h1>
            <p className="text-zinc-500">
              Customize your USMLE / COMLEX preparation block.
            </p>
          </div>
          <div className="flex gap-4">
            <div className="px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/50 rounded-lg shadow-sm dark:shadow-none text-sm">
              <span className="text-zinc-400">Streak:</span>{" "}
              <span className="font-bold text-orange-500">
                {streak} {streak === 1 ? "Day" : "Days"}
              </span>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-8 space-y-6">
            <div className="app-card">
              <label className="label-caps mb-2 block">
                System / Topic Focus
              </label>
              <div className="relative mb-6">
                <select
                  value={generalTopic}
                  onChange={(e) => setGeneralTopic(e.target.value)}
                  className="w-full p-4 pr-10 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 rounded-xl text-sm font-bold text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 appearance-none"
                >
                  {medicalTopics.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
                  size={16}
                />
              </div>

              <div className="flex justify-between items-end mb-2">
                <label className="label-caps block">Specific Objectives</label>
                <div className="relative flex flex-col items-end">
                  <input
                    type="file"
                    accept=".pdf,.txt,.md,.csv"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="syllabus-upload"
                    disabled={isParsingDocument}
                  />
                  <label
                    htmlFor="syllabus-upload"
                    className={cn(
                      "cursor-pointer text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1",
                      isParsingDocument
                        ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700/50 pointer-events-none"
                        : "bg-zinc-50 dark:bg-zinc-900/30 text-zinc-900 dark:text-zinc-100 border-zinc-100 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900/50",
                    )}
                  >
                    {isParsingDocument ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <BookOpen size={14} />
                    )}
                    {isParsingDocument ? "Processing..." : "+ Upload Syllabus"}
                  </label>
                  {parseProgress && (
                    <div className="absolute top-full mt-1 right-0 text-[10px] font-medium text-zinc-500 whitespace-nowrap bg-white dark:bg-zinc-900 px-2 py-0.5 rounded shadow-sm dark:shadow-none border border-zinc-100 dark:border-zinc-800/50 z-10">
                      {parseProgress}
                    </div>
                  )}
                </div>
              </div>

              {documentChapters && documentChapters.length > 0 ? (
                <div className="mb-4 bg-zinc-50 dark:bg-zinc-900/20 border border-zinc-100 dark:border-zinc-800/50 p-4 rounded-xl">
                  <div className="flex justify-between items-center mb-3">
                    <span
                      className="text-sm font-bold text-zinc-900 line-clamp-1 pr-4"
                      title={documentName || "Extracted Chapters"}
                    >
                      {documentName
                        ? `Syllabus: ${documentName}`
                        : "Extracted Chapters"}
                    </span>
                    <button
                      onClick={clearDocument}
                      className="text-xs text-zinc-500 hover:text-zinc-700 font-medium whitespace-nowrap"
                    >
                      Clear Document
                    </button>
                  </div>
                  <div className="relative mb-3">
                    <button
                      onClick={() =>
                        setShowChapterDropdown(!showChapterDropdown)
                      }
                      className="w-full p-3 pr-10 bg-white dark:bg-zinc-900 border border-zinc-200 rounded-lg text-sm font-bold text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 flex justify-between items-center text-left"
                    >
                      <span className="truncate">
                        {selectedChapters.length === 0
                          ? "Select chapters..."
                          : `${selectedChapters.length} chapter(s) selected`}
                      </span>
                      <ChevronDown
                        className="absolute right-4 text-zinc-400"
                        size={16}
                      />
                    </button>

                    {showChapterDropdown && (
                      <div className="absolute z-10 w-full mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {documentChapters.map((chap) => {
                          const isSelected = selectedChapters.includes(
                            chap.title,
                          );
                          return (
                            <label
                              key={chap.title}
                              className="flex items-start gap-3 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer border-b border-zinc-100 dark:border-zinc-800/50 last:border-0 transition-all duration-200 hover:scale-105 active:scale-95"
                            >
                              <input
                                type="checkbox"
                                className="mt-1 flex-shrink-0"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedChapters([
                                      ...selectedChapters,
                                      chap.title,
                                    ]);
                                  } else {
                                    setSelectedChapters(
                                      selectedChapters.filter(
                                        (t) => t !== chap.title,
                                      ),
                                    );
                                  }
                                }}
                              />
                              <div className="flex flex-col">
                                <span
                                  className={cn(
                                    "text-sm",
                                    isSelected
                                      ? "font-bold text-zinc-700"
                                      : "font-medium text-zinc-700 dark:text-zinc-300",
                                  )}
                                >
                                  {chap.title}
                                </span>
                                <span className="text-xs text-zinc-500 line-clamp-1 mt-0.5">
                                  {chap.content}
                                </span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="text-xs italic text-zinc-900/80">
                    Select one or more chapters to build a custom quiz block!
                  </div>
                </div>
              ) : (
                <>
                  <textarea
                    value={objectives}
                    onChange={(e) => setObjectives(e.target.value)}
                    className="w-full h-32 p-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 rounded-xl resize-none text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500/20"
                    placeholder="Type specific items here (e.g. Heart Murmurs...) or upload a syllabus file to automatically parse chapters!"
                  />
                  <div className="mt-2 text-xs text-zinc-400 italic">
                    Combine specific objectives with the general topic above to
                    direct the AI.
                  </div>
                </>
              )}
            </div>

            <div className="app-card">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div>
                  <label className="label-caps mb-4 block">Quiz Mode</label>
                  <div className="space-y-2">
                    <button
                      onClick={() =>
                        setConfig({ ...config, quizMode: "guided" })
                      }
                      className={cn(
                        "w-full py-2 px-2 rounded-lg border transition-all font-medium text-sm",
                        config.quizMode === "guided"
                          ? "bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 shadow-md"
                          : "border-zinc-200 dark:border-zinc-700/50 text-zinc-500 hover:border-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900/20",
                      )}
                    >
                      Guided Quiz
                    </button>
                    <button
                      onClick={() =>
                        setConfig({ ...config, quizMode: "practice" })
                      }
                      className={cn(
                        "w-full py-2 px-2 rounded-lg border transition-all font-medium text-sm",
                        config.quizMode === "practice"
                          ? "bg-zinc-800 text-white border-zinc-800 shadow-md"
                          : "border-zinc-200 dark:border-zinc-700/50 text-zinc-500 hover:border-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/50",
                      )}
                    >
                      Practice Quiz
                    </button>
                  </div>
                  <div className="mt-2 text-[10px] text-zinc-400">
                    {config.quizMode === "guided"
                      ? "Grades immediately and shows explanations."
                      : "Grades at the very end of the block."}
                  </div>
                </div>
                <div>
                  <label className="label-caps mb-4 block">Block Size</label>
                  <div className="flex gap-2 mb-3">
                    {[10, 25, 50].map((num) => (
                      <button
                        key={num}
                        onClick={() =>
                          setConfig({
                            ...config,
                            count: num,
                            isCustomCount: false,
                          })
                        }
                        className={cn(
                          "flex-1 py-2 px-2 rounded-lg border transition-all font-medium text-sm",
                          !config.isCustomCount && config.count === num
                            ? "bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 text-white border-zinc-900 dark:border-zinc-100 shadow-md"
                            : "border-zinc-200 dark:border-zinc-700/50 hover:border-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900/20",
                        )}
                      >
                        {num}
                      </button>
                    ))}
                    <button
                      onClick={() =>
                        setConfig({
                          ...config,
                          isCustomCount: true,
                          count: config.isCustomCount ? config.count : 15,
                        })
                      }
                      className={cn(
                        "flex-1 py-2 px-2 rounded-lg border transition-all font-medium text-sm",
                        config.isCustomCount
                          ? "bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 text-white border-zinc-900 dark:border-zinc-100 shadow-md"
                          : "border-zinc-200 dark:border-zinc-700/50 hover:border-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900/20",
                      )}
                    >
                      Custom
                    </button>
                  </div>
                  <AnimatePresence>
                    {config.isCustomCount && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-2">
                          <label className="text-xs font-bold text-zinc-400 uppercase mb-1 block">
                            Custom Amount
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={config.count}
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                count: Math.max(
                                  1,
                                  parseInt(e.target.value) || 1,
                                ),
                              })
                            }
                            className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500/20"
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <div>
                  <label className="label-caps">Difficulty</label>
                  <div className="space-y-2">
                    {(["easy", "medium", "hard"] as const).map((level) => (
                      <div
                        key={level}
                        onClick={() =>
                          setConfig({ ...config, difficulty: level })
                        }
                        className={cn(
                          "p-3 rounded-xl cursor-pointer flex items-center gap-3 transition-all hover:scale-105 active:scale-95",
                          config.difficulty === level
                            ? "border-2 border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-900/20"
                            : "border border-zinc-200 dark:border-zinc-700/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/50",
                        )}
                      >
                        <div
                          className={cn(
                            "w-4 h-4 rounded-full border-2",
                            config.difficulty === level
                              ? "border-4 border-zinc-900 dark:border-zinc-100"
                              : "border-zinc-300",
                          )}
                        ></div>
                        <div className="text-sm">
                          <div className="font-bold capitalize">{level}</div>
                          <div className="text-xs text-zinc-400">
                            {level === "easy" &&
                              "Content review, no vignettes."}
                            {level === "medium" &&
                              "Short vignettes, 2nd order questions."}
                            {level === "hard" &&
                              "Exam-style stems & distractors."}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="md:col-span-4 space-y-6">
            <div className="app-card">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-4 uppercase tracking-widest text-zinc-400">
                Overall Performance
              </h3>
              <div className="flex items-end gap-2 mb-4">
                <span className="text-4xl font-black font-display tracking-tight text-zinc-900">
                  {avgScore}%
                </span>
                <span className="text-sm text-zinc-400 font-medium mb-1">
                  average score
                </span>
              </div>
              <div className="space-y-3">
                {topTopics.length > 0 ? (
                  topTopics.map((topic, i) => (
                    <React.Fragment key={topic.name}>
                      <div className="flex justify-between text-sm pt-2 border-t border-zinc-50 mt-2">
                        <span className="text-zinc-500">{topic.name}</span>
                        <span className="font-medium">{topic.pct}%</span>
                      </div>
                      <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full">
                        <div
                          className={cn(
                            "h-1.5 rounded-full",
                            i === 0 ? "bg-zinc-900 dark:bg-zinc-100" : "bg-orange-400",
                          )}
                          style={{ width: `${topic.pct}%` }}
                        ></div>
                      </div>
                    </React.Fragment>
                  ))
                ) : (
                  <div className="text-sm text-zinc-400 italic">
                    No topics studied yet.
                  </div>
                )}
              </div>
            </div>

            <div className="bg-zinc-900 rounded-2xl p-6 text-white space-y-6">
              <div>
                <h3 className="text-sm font-bold mb-4 uppercase tracking-widest text-zinc-400">
                  Study Progress
                </h3>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center text-orange-500">
                    <Flag size={24} />
                  </div>
                  <div>
                    <div className="text-lg font-bold">
                      {history.reduce(
                        (count, s) =>
                          count + (s.flaggedQuestionIds?.length || 0),
                        0,
                      )}{" "}
                      Items
                    </div>
                    <div className="text-xs text-zinc-400">
                      Flagged for review
                    </div>
                  </div>
                </div>
                <button className="w-full py-3 bg-zinc-800 rounded-xl text-sm font-bold hover:bg-zinc-800 dark:hover:bg-zinc-200 border border-zinc-700 transition-all duration-200 hover:scale-105 active:scale-95">
                  Resume Vault Session
                </button>
              </div>

              <div className="pt-6 border-t border-zinc-800/50">
                <h3 className="text-sm font-bold mb-3 uppercase tracking-widest text-orange-400">
                  Areas For Improvement
                </h3>
                {weakTopics.length > 0 ? (
                  <div className="space-y-3">
                    {weakTopics.map((t) => (
                      <div
                        key={t.name}
                        className="flex justify-between items-center text-sm bg-zinc-800/50 p-2.5 rounded-lg border border-zinc-700/50"
                      >
                        <span
                          className="text-zinc-300 font-medium truncate pr-2 flex-1"
                          title={t.name}
                        >
                          {t.name}
                        </span>
                        <span className="text-orange-400 font-bold shrink-0">
                          {t.pct}%
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-zinc-500 italic">
                    Play more sessions to gather data.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-8">
          <button
            onClick={handleStartSession}
            className="px-10 py-4 bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 rounded-2xl font-bold text-lg shadow-xl shadow-zinc-500/30 hover:bg-zinc-800 dark:hover:bg-zinc-200 hover:translate-y-[-1px] transition-all hover:scale-105 active:scale-95"
          >
            Start Study Session
          </button>
        </div>
      </div>
    );
  };

  const renderLoading = () => {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="text-zinc-500"
        >
          <Loader2 size={48} />
        </motion.div>
        <div className="text-center space-y-2">
          <h3 className="text-xl font-bold">Preparing Your Study Session</h3>
          <p className="text-zinc-500 max-w-xs mx-auto">
            {generationProgress && generationProgress.total > 1
              ? `Generating questions (Batch ${Math.min(generationProgress.completed + 1, generationProgress.total)} of ${generationProgress.total})...`
              : `Tuning questions to: ${
                  documentChapters &&
                  documentChapters.length > 0 &&
                  selectedChapters.length > 0
                    ? `"${documentName || "Syllabus"}"`
                    : `"${(objectives || generalTopic).slice(0, 40)}${(objectives || generalTopic).length > 40 ? "..." : ""}"`
                }`}
          </p>

          {didFallbackModel && (
            <div className="pt-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs font-bold rounded-lg border border-amber-200 dark:border-amber-800">
                <AlertTriangle size={14} />
                High demand. Falling back to Gemini 3 Flash.
              </span>
            </div>
          )}

          <div className="pt-4 max-w-xs mx-auto w-full">
            <div className="flex justify-between text-xs font-bold text-zinc-400 mb-1">
              <span className="uppercase tracking-widest text-[10px]">
                AI Generation Progress
              </span>
              <span className="text-[10px] tabular-nums">
                {generationProgress?.generatedItems || 0} /{" "}
                {generationProgress?.targetItems || config.count} Generated
              </span>
            </div>
            <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden relative">
              <div
                className="bg-zinc-900 dark:bg-zinc-100 h-full transition-all duration-300"
                style={{
                  width: `${generationProgress ? Math.max(5, (generationProgress.generatedItems / generationProgress.targetItems) * 100) : 5}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderQuiz = () => {
    if (!currentQuestion) return null;
    const isAnswered = !!currentAnswer;

    return (
      <div className="max-w-4xl mx-auto py-2 relative">
        <header className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4 relative">
            <button
              onClick={() => setShowJumpMenu(!showJumpMenu)}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors relative z-20"
            >
              {showJumpMenu ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="w-48 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-zinc-900 dark:bg-zinc-100 transition-all duration-300"
                style={{
                  width: `${((currentIndex + 1) / Math.max(1, activeSession?.maxQuestions || questions.length)) * 100}%`,
                }}
              ></div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest leading-none">
                Question {currentIndex + 1}/
                {activeSession?.maxQuestions || questions.length}
              </span>
              {generationProgress &&
                generationProgress.completed < generationProgress.total && (
                  <span className="text-[10px] font-bold text-zinc-900 bg-zinc-50 dark:bg-zinc-900/30 px-2 py-0.5 rounded-full flex items-center gap-1.5 uppercase tracking-wider">
                    <Loader2 size={10} className="animate-spin" />
                    {questions.length} /{" "}
                    {activeSession?.maxQuestions || questions.length} Generated
                  </span>
                )}
            </div>

            <AnimatePresence>
              {showJumpMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute top-12 left-0 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/50 shadow-2xl rounded-2xl p-4 z-50 grid grid-cols-5 gap-2"
                >
                  <div className="col-span-5 flex justify-between items-center mb-2 px-1">
                    <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                      Jump to Question
                    </span>
                    <button
                      onClick={() => {
                        if (confirm("End session early?")) handleFinish();
                      }}
                      className="text-xs font-bold text-red-500 hover:text-red-600 transition-all duration-200 hover:scale-105 active:scale-95"
                    >
                      End Session
                    </button>
                  </div>
                  {Array.from({
                    length: activeSession?.maxQuestions || questions.length,
                  }).map((_, i) => {
                    const q = questions[i];
                    if (!q) {
                      return (
                        <div
                          key={i}
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold border-2 border-zinc-100 dark:border-zinc-800/50 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-300"
                        >
                          <Loader2 size={14} className="animate-spin" />
                        </div>
                      );
                    }
                    const isAns = activeSession?.answers.find(
                      (a) => a.questionId === q.id,
                    );
                    const isFlagged =
                      activeSession?.flaggedQuestionIds?.includes(q.id);
                    return (
                      <button
                        key={q.id}
                        onClick={() => {
                          setCurrentIndex(i);
                          setShowJumpMenu(false);
                          setShowExplanation(false);
                          setSelectedOption(null);
                        }}
                        className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold border-2 transition-all relative",
                          i === currentIndex
                            ? "border-zinc-500 bg-zinc-50 dark:bg-zinc-900/20 text-zinc-900 dark:text-zinc-100"
                            : isAns
                              ? "border-zinc-200 dark:border-zinc-700/50 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100"
                              : "border-zinc-100 dark:border-zinc-800/50 bg-white dark:bg-zinc-900 text-zinc-400 hover:border-zinc-200",
                        )}
                      >
                        {i + 1}
                        {isFlagged && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-zinc-800"></div>
                        )}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden lg:block text-[10px] font-black uppercase tracking-[0.2em] px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-500">
              {currentQuestion.topic}
            </span>
            <button
              id="flag-btn"
              onClick={handleFlag}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl border font-bold transition-all hover:scale-105 active:scale-95",
                activeSession?.flaggedQuestionIds?.includes(currentQuestion.id)
                  ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-500 dark:text-red-400"
                  : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700/50 text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50",
              )}
            >
              <Flag
                size={18}
                className={
                  activeSession?.flaggedQuestionIds?.includes(
                    currentQuestion.id,
                  )
                    ? "fill-current"
                    : ""
                }
              />
              {activeSession?.flaggedQuestionIds?.includes(currentQuestion.id)
                ? "Flagged"
                : "Flag"}
            </button>
          </div>
        </header>

        <div className="space-y-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm dark:shadow-none border border-zinc-200 dark:border-zinc-700/50 p-4 lg:p-6 overflow-hidden relative">
            <div className="prose prose-zinc dark:prose-invert max-w-none mb-6 prose-p:my-2 prose-ul:my-2">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeRaw, rehypeKatex]}
              >
                {currentQuestion.stem}
              </ReactMarkdown>
            </div>

            <div className="space-y-2">
              {currentQuestion.options.map((option, idx) => {
                const isSelected = currentAnswer?.selectedOption === idx;
                const isCorrect = idx === currentQuestion.correctAnswer;
                const isGuided = activeSession?.quizMode !== "practice";

                let stateClass =
                  "border-zinc-100 dark:border-zinc-800/50 hover:border-zinc-200 hover:bg-zinc-50/10 cursor-pointer text-zinc-700 dark:text-zinc-300";
                if (isGuided && isAnswered) {
                  if (isSelected && isCorrect)
                    stateClass =
                      "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-900 dark:text-green-100";
                  else if (isSelected && !isCorrect)
                    stateClass =
                      "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-100";
                  else if (isCorrect)
                    stateClass =
                      "border-green-600 bg-green-50/20 dark:bg-green-900/10 text-green-800 dark:text-green-200";
                  else
                    stateClass =
                      "opacity-50 border-zinc-50 cursor-default text-zinc-500 dark:text-zinc-400";
                } else if (!isGuided && isAnswered && isSelected) {
                  stateClass =
                    "border-zinc-500 bg-zinc-50 dark:bg-zinc-900/20 ring-2 ring-zinc-500/20 dark:ring-zinc-500/40 text-zinc-900 dark:text-zinc-100";
                }

                return (
                  <button
                    id={`option-btn-${idx}`}
                    key={idx}
                    disabled={isGuided && isAnswered}
                    onClick={() => handleAnswer(idx)}
                    className={cn(
                      "w-full p-3 lg:p-4 rounded-xl border-2 text-left transition-all flex items-start gap-4 font-medium",
                      stateClass,
                    )}
                  >
                    <span
                      className={cn(
                        "flex-none w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm",
                        isSelected
                          ? "bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 text-white"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500",
                      )}
                    >
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="flex-1 mt-0.5">{option}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <AnimatePresence>
            {(showExplanation || isAnswered) &&
              activeSession?.quizMode !== "practice" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-zinc-900 rounded-xl p-6 text-white shadow-xl shadow-zinc-900/10 dark:shadow-none"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center">
                      <BookOpen size={16} />
                    </div>
                    <h4 className="font-bold text-lg">Reasoning & Feedback</h4>
                  </div>
                  <div className="prose prose-invert prose-sm max-w-none opacity-80 leading-relaxed font-medium prose-p:my-2 prose-ul:my-2">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeRaw, rehypeKatex]}
                    >
                      {currentQuestion.explanation}
                    </ReactMarkdown>
                  </div>
                </motion.div>
              )}
          </AnimatePresence>
        </div>

        <div className="mt-4 flex justify-between">
          <button
            id="prev-btn"
            disabled={currentIndex === 0}
            onClick={() => {
              setCurrentIndex(currentIndex - 1);
              setShowExplanation(false);
              setSelectedOption(null);
            }}
            className="px-6 py-3 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/50 rounded-xl font-bold flex items-center gap-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all disabled:opacity-50"
          >
            <ChevronLeft size={18} />
            Previous
          </button>

          <button
            id="next-btn"
            disabled={activeSession?.quizMode !== "practice" && !isAnswered}
            onClick={handleNext}
            className={cn(
              "px-6 py-3 bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 text-white rounded-xl font-bold flex items-center gap-2 transition-all hover:scale-105 active:scale-95",
              activeSession?.quizMode !== "practice" && !isAnswered
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-zinc-800 dark:hover:bg-zinc-200",
            )}
          >
            {currentIndex >=
            (activeSession?.maxQuestions || questions.length) - 1
              ? "Finish Block"
              : currentIndex === questions.length - 1 &&
                  questions.length < (activeSession?.maxQuestions || 0)
                ? "Generating..."
                : "Next Item"}
            {currentIndex === questions.length - 1 &&
            questions.length < (activeSession?.maxQuestions || 0) ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <ChevronRight size={18} />
            )}
          </button>
        </div>
      </div>
    );
  };

  const handleGenerateWeaknessesQuiz = () => {
    if (!currentReportSummary) return;

    // Extract bolded text assuming it's weaknesses based on the instruction
    const matches = [...currentReportSummary.matchAll(/\*\*(.*?)\*\*/g)];
    const weakSpots = matches.map((m) => m[1]).join(", ");

    setObjectives(
      `Target these weak spots: ${weakSpots.length > 0 ? weakSpots : "Review all weak areas from the last session"}`,
    );

    // Clear document variables so textarea is visible
    setDocumentChapters(null);
    setDocumentName(null);
    setSelectedChapters([]);

    // Switch view back to home
    setView("home");

    // Scroll to top
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const renderReport = () => {
    if (!reportSession) return null;
    const score = reportSession.answers.filter((a) => a.isCorrect).length;
    const pct = Math.round((score / reportSession.maxQuestions) * 100);

    // Topic breakdown with System -> Topic grouping
    const groupedData: Record<
      string,
      {
        total: number;
        correct: number;
        topics: Record<
          string,
          { total: number; correct: number; questions: Question[] }
        >;
      }
    > = {};

    reportSession.questions.forEach((q) => {
      const sys = q.system || "General";
      const top = q.topic || "General";
      const ans = reportSession.answers.find((a) => a.questionId === q.id);
      const isCorrect = ans?.isCorrect || false;

      if (!groupedData[sys]) {
        groupedData[sys] = { total: 0, correct: 0, topics: {} };
      }
      groupedData[sys].total += 1;
      if (isCorrect) groupedData[sys].correct += 1;

      if (!groupedData[sys].topics[top]) {
        groupedData[sys].topics[top] = { total: 0, correct: 0, questions: [] };
      }
      groupedData[sys].topics[top].total += 1;
      if (isCorrect) groupedData[sys].topics[top].correct += 1;
      groupedData[sys].topics[top].questions.push(q);
    });

    const chartData = Object.keys(groupedData).map((sys) => ({
      name: sys,
      accuracy: Math.round(
        (groupedData[sys].correct / groupedData[sys].total) * 100,
      ),
      count: groupedData[sys].total,
    }));

    const lowAccuracyTopics: {
      name: string;
      sys: string;
      correct: number;
      total: number;
    }[] = [];
    Object.entries(groupedData).forEach(([sys, sysData]) => {
      Object.entries(sysData.topics).forEach(([topic, topicData]) => {
        if (topicData.total > 0 && topicData.correct / topicData.total < 0.6) {
          lowAccuracyTopics.push({
            name: topic,
            sys,
            correct: topicData.correct,
            total: topicData.total,
          });
        }
      });
    });

    return (
      <div className="space-y-8 max-w-5xl mx-auto py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black font-display tracking-tight text-zinc-900 dark:text-zinc-100">
              Session Report
            </h1>
            <p className="text-zinc-500">
              Summary of your performance in this block.
            </p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={handleExtendSession}
              className="flex-1 sm:flex-none px-6 py-3 bg-zinc-50 dark:bg-zinc-900/20 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-sm shadow-sm hover:bg-zinc-100 dark:hover:bg-zinc-900/40 transition-all flex items-center justify-center gap-2"
            >
              <Plus size={16} /> Add More Questions
            </button>
            <button
              onClick={() => setView("home")}
              className="flex-1 sm:flex-none px-6 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/50 rounded-xl font-bold text-sm shadow-sm dark:shadow-none hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all text-center"
            >
              Return Home
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="col-span-12">
            <div className="bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 rounded-2xl relative overflow-hidden app-card border-none">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <Target size={120} />
              </div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400 mb-4">
                AI Performance Insights
              </h3>
              {isGeneratingSummary || !currentReportSummary ? (
                <div className="flex items-center gap-3 text-zinc-400 py-4">
                  <Loader2 size={20} className="animate-spin" />
                  <span className="text-sm">
                    Analyzing performance and identifying high-yield topics...
                  </span>
                </div>
              ) : (
                <div className="relative z-10 w-full mb-2">
                  <div className="prose prose-invert prose-sm max-w-none leading-relaxed prose-p:my-2 prose-ul:my-2">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeRaw, rehypeKatex]}
                    >
                      {currentReportSummary}
                    </ReactMarkdown>
                  </div>
                  <div className="mt-6 pt-6 border-t border-zinc-800 flex flex-wrap gap-4">
                    <button
                      onClick={handleGenerateWeaknessesQuiz}
                      className="px-5 py-2.5 bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white text-sm font-bold rounded-xl transition-colors shadow-lg shadow-zinc-500/20 flex items-center gap-2"
                    >
                      <BookOpen size={16} /> Test Weaknesses
                    </button>

                    <button
                      onClick={async () => {
                        if (lowAccuracyTopics.length === 0) {
                          alert(
                            "You did great! No specific weak areas to generate a lesson for.",
                          );
                          return;
                        }
                        setIsGeneratingLesson(true);
                        try {
                          const topicsList = lowAccuracyTopics.map(
                            (t) => t.name,
                          );
                          const newLessonContent = await generateLesson(
                            topicsList,
                            reportSession!.objectives || "",
                          );
                          const newLesson: Lesson = {
                            id: crypto.randomUUID(),
                            topic: `Review: ${topicsList.slice(0, 2).join(", ")}${topicsList.length > 2 ? "..." : ""}`,
                            content: newLessonContent,
                            relatedSessionId: reportSession!.id,
                            createdAt: Date.now(),
                            weakTopics: topicsList,
                            originalObjectives: reportSession!.objectives || "",
                          };
                          saveLessons([newLesson, ...lessons]);
                          setView("lessons");
                        } catch (err) {
                          alert("Failed to generate lesson. Please try again.");
                        } finally {
                          setIsGeneratingLesson(false);
                        }
                      }}
                      disabled={
                        isGeneratingLesson || lowAccuracyTopics.length === 0
                      }
                      className="px-5 py-2.5 bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white text-sm font-bold rounded-xl transition-colors shadow-lg shadow-zinc-500/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isGeneratingLesson ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <BookOpen size={16} />
                      )}
                      {isGeneratingLesson
                        ? "Generating..."
                        : "Generate Target Lesson"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="col-span-12 md:col-span-4 flex flex-col gap-6">
            <div className="app-card text-center space-y-4">
              <div className="text-sm font-bold text-zinc-400 uppercase tracking-widest">
                Aggregate Score
              </div>
              <div className="text-6xl font-black font-display tracking-tight text-zinc-900">{pct}%</div>
              <div className="text-xs text-zinc-500 font-medium">
                {score} Correct out of {reportSession.maxQuestions}
              </div>
            </div>
            <div className="bg-zinc-900 rounded-2xl p-6 text-white space-y-4 flex-1">
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                Action Plan (Review)
              </h3>
              <div className="space-y-3">
                {lowAccuracyTopics.map((t, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-orange-500 shrink-0 mt-1.5"></div>
                    <div>
                      <div
                        className="text-sm font-medium line-clamp-1"
                        title={t.name}
                      >
                        {t.name}
                      </div>
                      <div className="text-xs text-zinc-400">
                        {t.sys} • {Math.round((t.correct / t.total) * 100)}%
                      </div>
                    </div>
                  </div>
                ))}
                {lowAccuracyTopics.length === 0 && (
                  <p className="text-sm text-zinc-400 italic">
                    No major weak areas identified.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="col-span-12 md:col-span-8">
            <div className="app-card h-full min-h-[400px]">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-8">
                Performance by Discipline
              </h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ left: 10, right: 20 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      horizontal={false}
                      stroke="#f1f5f9"
                    />
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={110}
                      style={{ fontSize: "10px", fontWeight: "bold" }}
                      tick={{ fill: "#64748b" }}
                    />
                    <Tooltip
                      cursor={{ fill: "transparent" }}
                      contentStyle={{
                        borderRadius: "8px",
                        border: "none",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      }}
                    />
                    <Bar dataKey="accuracy" radius={[0, 8, 8, 0]}>
                      {chartData.map((entry: any, index: number) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            entry.accuracy > 70
                              ? "#2563eb"
                              : entry.accuracy > 50
                                ? "#60a5fa"
                                : "#f97316"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="col-span-12 space-y-4 mt-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                Systems & Objectives Review
              </h3>
              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                />
                <input
                  type="text"
                  placeholder="Search topics or systems..."
                  value={reportSearchQuery}
                  onChange={(e) => setReportSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500/20 md:w-64"
                />
              </div>
            </div>
            <div className="space-y-4">
              {Object.entries(groupedData)
                .filter(([sys, sysData]) => {
                  const q = reportSearchQuery.toLowerCase();
                  const matchesSystem = sys.toLowerCase().includes(q);
                  const matchesTopic = Object.keys(sysData.topics).some((t) =>
                    t.toLowerCase().includes(q),
                  );
                  return q === "" || matchesSystem || matchesTopic;
                })
                .map(([sys, sysData]) => {
                  const isExpanded =
                    expandedSystems.includes(sys) ||
                    reportSearchQuery.length > 0;

                  const filteredTopics = Object.entries(sysData.topics).filter(
                    ([topic]) => {
                      const q = reportSearchQuery.toLowerCase();
                      return (
                        q === "" ||
                        sys.toLowerCase().includes(q) ||
                        topic.toLowerCase().includes(q)
                      );
                    },
                  );

                  // Skip rendering system if query doesn't match the system AND it matched 0 topics
                  if (
                    reportSearchQuery &&
                    !sys
                      .toLowerCase()
                      .includes(reportSearchQuery.toLowerCase()) &&
                    filteredTopics.length === 0
                  )
                    return null;

                  return (
                    <div
                      key={sys}
                      className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm dark:shadow-none border border-zinc-200 dark:border-zinc-700/50 overflow-hidden transition-all duration-300"
                    >
                      <button
                        onClick={() => toggleSystem(sys)}
                        className="w-full p-6 flex items-center justify-between bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all duration-200 hover:scale-105 active:scale-95"
                      >
                        <div className="flex items-center gap-5">
                          <div className="w-14 h-14 rounded-2xl bg-zinc-50 dark:bg-zinc-900/20 text-zinc-900 dark:text-zinc-100 flex items-center justify-center font-black text-xl">
                            {Math.round(
                              (sysData.correct / sysData.total) * 100,
                            )}
                            <span className="text-xs ml-0.5">%</span>
                          </div>
                          <div className="text-left">
                            <span className="font-bold text-lg block text-zinc-800 dark:text-zinc-200">
                              {sys}
                            </span>
                            <span className="text-sm text-zinc-500 font-medium">
                              ({sysData.correct} of {sysData.total} Correct)
                            </span>
                          </div>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-center border border-zinc-100 dark:border-zinc-800/50">
                          {isExpanded ? (
                            <ChevronUp size={20} className="text-zinc-400" />
                          ) : (
                            <ChevronDown size={20} className="text-zinc-400" />
                          )}
                        </div>
                      </button>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-800/50 overflow-hidden"
                          >
                            <div className="p-6 space-y-3">
                              {filteredTopics.map(([topic, topicData]) => (
                                <div
                                  key={topic}
                                  className="flex flex-col md:flex-row md:items-center justify-between bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/50 p-5 rounded-2xl shadow-sm dark:shadow-none gap-4 transition-all hover:border-zinc-200"
                                >
                                  <div className="flex-1">
                                    <h4 className="font-bold text-zinc-800 dark:text-zinc-200 text-base">
                                      {topic}
                                    </h4>
                                    <div className="flex items-center gap-3 mt-1.5">
                                      <span className="text-xs font-bold px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-500">
                                        {topicData.total} Questions
                                      </span>
                                      <span
                                        className={cn(
                                          "text-xs font-bold",
                                          topicData.correct / topicData.total >
                                            0.7
                                            ? "text-green-600"
                                            : topicData.correct /
                                                  topicData.total >
                                                0.5
                                              ? "text-zinc-900"
                                              : "text-orange-500",
                                        )}
                                      >
                                        Score: {topicData.correct}/
                                        {topicData.total} (
                                        {Math.round(
                                          (topicData.correct /
                                            topicData.total) *
                                            100,
                                        )}
                                        %)
                                      </span>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() =>
                                      openReview(topic, topicData.questions)
                                    }
                                    className="px-5 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 dark:hover:bg-zinc-200 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-xl text-sm font-bold transition-colors flex items-center gap-2 whitespace-nowrap"
                                  >
                                    <BookOpen size={16} /> Review Answers
                                  </button>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderHistory = () => (
    <div className="space-y-8 max-w-4xl mx-auto py-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black font-display tracking-tight text-zinc-900 dark:text-zinc-100">
            Session History
          </h1>
          <p className="text-zinc-500">
            Review your past study blocks and scores.
          </p>
        </div>
      </header>

      <div className="space-y-3">
        {history.map((session) => (
          <div
            key={session.id}
            onClick={() => handleViewSession(session)}
            className="app-card flex items-center justify-between group cursor-pointer hover:border-zinc-300 transition-all duration-300 hover:scale-[1.01] hover:shadow-lg dark:hover:shadow-zinc-800/50"
          >
            <div className="flex items-center gap-6">
              <div className="w-12 h-12 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl flex flex-col items-center justify-center border border-zinc-100 dark:border-zinc-800/50">
                <span className="text-[10px] font-bold text-zinc-400 leading-none mb-0.5">
                  {new Date(session.startTime).toLocaleString("default", {
                    month: "short",
                  })}
                </span>
                <span className="text-lg font-black text-zinc-800 dark:text-zinc-200 leading-none">
                  {new Date(session.startTime).getDate()}
                </span>
              </div>
              <div>
                <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200 line-clamp-1">
                  {session.objectives}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                    {session.difficulty}
                  </span>
                  <span className="text-[10px] text-zinc-400">•</span>
                  <span className="text-[10px] text-zinc-400 font-medium">
                    {session.maxQuestions} Items
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right mr-4">
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                  Score
                </p>
                <p className="text-xl font-black text-zinc-900">
                  {Math.round(
                    (session.answers.filter((a) => a.isCorrect).length /
                      session.maxQuestions) *
                      100,
                  )}
                  %
                </p>
              </div>
              <ChevronRight
                size={20}
                className="text-zinc-300 group-hover:text-zinc-500 transition-all duration-200 hover:scale-105 active:scale-95"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderReview = () => {
    if (!reviewState) return null;
    const {
      topic,
      questions: reviewQuestions,
      session,
      currentIndex,
    } = reviewState;
    const q = reviewQuestions[currentIndex];
    if (!q) return null;

    const ans = session.answers.find((a) => a.questionId === q.id);
    const isCorrect = ans?.isCorrect;

    return (
      <div className="max-w-4xl mx-auto py-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setView("report")}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
            >
              <ChevronLeft size={20} />
            </button>
            <div>
              <h1 className="text-3xl font-black font-display tracking-tight text-zinc-900 dark:text-zinc-100 line-clamp-1">
                Review: {topic}
              </h1>
              <p className="text-zinc-500">
                Item {currentIndex + 1} of {reviewQuestions.length}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleGenerateMore(topic)}
              className="px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl text-sm font-bold transition-all flex items-center gap-2 mr-2"
            >
              <RefreshCw size={16} /> Generate More
            </button>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  setReviewState({
                    ...reviewState,
                    currentIndex: Math.max(0, currentIndex - 1),
                  })
                }
                disabled={currentIndex === 0}
                className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors disabled:opacity-50"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={() =>
                  setReviewState({
                    ...reviewState,
                    currentIndex: Math.min(
                      reviewQuestions.length - 1,
                      currentIndex + 1,
                    ),
                  })
                }
                disabled={currentIndex === reviewQuestions.length - 1}
                className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors disabled:opacity-50"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </header>

        <div className="app-card space-y-6 relative overflow-hidden">
          <div
            className={cn(
              "absolute top-0 left-0 w-1.5 h-full",
              isCorrect ? "bg-green-500" : "bg-red-500",
            )}
          />

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-zinc-400 uppercase tracking-widest text-[10px]">
                Item {currentIndex + 1}
              </span>
              {!ans && (
                <span className="text-[10px] font-bold px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-500 uppercase">
                  Unanswered
                </span>
              )}
            </div>
            {ans?.isFlagged && (
              <Flag size={16} className="text-red-500 fill-current" />
            )}
          </div>

          <div className="prose prose-zinc dark:prose-invert max-w-none font-medium">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeRaw, rehypeKatex]}
            >
              {q.stem}
            </ReactMarkdown>
          </div>

          <div className="space-y-2">
            {q.options.map((opt, optIdx) => {
              const isSelected = ans?.selectedOption === optIdx;
              const isCorrectOpt = q.correctAnswer === optIdx;

              let stateClass =
                "border-zinc-100 dark:border-zinc-800/50 bg-zinc-50 dark:bg-zinc-800/50 border-2";
              if (isSelected && isCorrectOpt)
                stateClass =
                  "border-green-500 bg-green-50 dark:bg-green-900/20 font-bold text-green-900 dark:text-green-100";
              else if (isSelected && !isCorrectOpt)
                stateClass =
                  "border-red-500 bg-red-50 dark:bg-red-900/20 font-bold text-red-900 dark:text-red-100";
              else if (isCorrectOpt)
                stateClass =
                  "border-green-400 bg-green-50/20 dark:bg-green-900/10 font-bold text-green-800 dark:text-green-200";
              else if (!ans && isCorrectOpt)
                stateClass =
                  "border-zinc-300 bg-white dark:bg-zinc-900 font-bold text-zinc-900 dark:text-zinc-100";

              return (
                <div
                  key={optIdx}
                  className={cn(
                    "p-4 rounded-xl flex gap-4 text-sm transition-all duration-200 hover:scale-105 active:scale-95",
                    stateClass,
                  )}
                >
                  <span
                    className={cn(
                      "flex-none w-6 h-6 rounded flex items-center justify-center font-bold text-xs shrink-0",
                      isSelected
                        ? "bg-white dark:bg-zinc-900 border shadow-sm dark:shadow-none"
                        : "bg-white dark:bg-zinc-900/50 text-zinc-500 mix-blend-multiply",
                    )}
                  >
                    {String.fromCharCode(65 + optIdx)}
                  </span>
                  <span className="flex-1 mt-0.5">{opt}</span>
                </div>
              );
            })}
          </div>

          {(q.explanation || isCorrect !== undefined) && (
            <div className="bg-zinc-900 text-white rounded-xl p-6 mt-6">
              <h4 className="font-bold mb-4 flex items-center gap-2 text-sm uppercase tracking-widest text-zinc-400">
                <BookOpen size={16} className="text-zinc-400" /> Explanation
              </h4>
              <div className="prose prose-sm prose-invert max-w-none opacity-90 leading-relaxed font-medium">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeRaw, rehypeKatex]}
                >
                  {q.explanation}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 flex justify-between">
          <button
            disabled={currentIndex === 0}
            onClick={() =>
              setReviewState({ ...reviewState, currentIndex: currentIndex - 1 })
            }
            className="px-8 py-4 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/50 rounded-2xl font-bold flex items-center gap-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all disabled:opacity-50"
          >
            <ChevronLeft size={18} /> Previous
          </button>

          <button
            onClick={() => {
              if (currentIndex === reviewQuestions.length - 1) {
                setView("report");
              } else {
                setReviewState({
                  ...reviewState,
                  currentIndex: currentIndex + 1,
                });
              }
            }}
            className="px-8 py-4 bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 rounded-2xl font-bold flex items-center gap-2 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all hover:scale-105 active:scale-95"
          >
            {currentIndex === reviewQuestions.length - 1
              ? "Finish Review"
              : "Next Item"}
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    );
  };

  const renderFlaggedItems = () => {
    // Collect all flagged questions from history grouped by topic
    const flaggedByTopic: Record<
      string,
      { question: Question; session: Session }[]
    > = {};
    const allSessions = activeSession ? [activeSession, ...history] : history;

    allSessions.forEach((session) => {
      if (session.flaggedQuestionIds && session.flaggedQuestionIds.length > 0) {
        session.questions.forEach((q) => {
          if (session.flaggedQuestionIds.includes(q.id)) {
            const isUnflagged = unflaggedItems.some((u) => u.sessionId === session.id && u.question.id === q.id);
            if (!isUnflagged) {
              const topic = q.topic || "General";
              if (!flaggedByTopic[topic]) flaggedByTopic[topic] = [];
              flaggedByTopic[topic].push({ question: q, session });
            }
          }
        });
      }
    });

    const topics = Object.entries(flaggedByTopic).sort(
      (a, b) => b[1].length - a[1].length,
    );

    if (!selectedFlaggedTopic || !flaggedByTopic[selectedFlaggedTopic]) {
      return (
        <div className="max-w-5xl mx-auto py-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <header className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-black font-display tracking-tight text-zinc-900 dark:text-zinc-100">
                Flagged Items
              </h1>
              <p className="text-zinc-500">
                Review all questions you have flagged by topic.
              </p>
            </div>
          </header>

          {topics.length === 0 ? (
            <div className="app-card flex flex-col items-center justify-center py-24 text-center space-y-4">
              <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-400 rounded-2xl flex items-center justify-center mb-2">
                <Flag size={32} />
              </div>
              <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-200">
                No Flagged Items
              </h2>
              <p className="text-zinc-500 max-w-md">
                You haven't flagged any questions yet. When taking a quiz, click
                the "Flag" button to save questions here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {topics.map(([topic, items]) => (
                <button
                  key={topic}
                  onClick={() => {
                    setSelectedFlaggedTopic(topic);
                    setCurrentFlaggedIndex(0);
                  }}
                  className="app-card text-left flex flex-col hover:border-zinc-300 transition-all duration-300 hover:scale-[1.01] hover:shadow-lg dark:hover:shadow-zinc-800/50 group"
                >
                  <div className="flex w-full justify-between items-start mb-4">
                    <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-900/20 text-orange-500 dark:text-orange-400 flex items-center justify-center">
                      <Flag size={20} className="fill-current" />
                    </div>
                    <span className="text-xs font-bold px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-500">
                      {items.length} items
                    </span>
                  </div>
                  <h3 className="font-bold text-zinc-800 dark:text-zinc-200 line-clamp-2 leading-tight min-h-[2.5rem]">
                    {topic}
                  </h3>
                </button>
              ))}
            </div>
          )}
          
          {unflaggedItems.length > 0 && (
            <div className="mt-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <h2 className="text-2xl font-black font-display text-zinc-900 dark:text-zinc-100 mb-6 flex items-center gap-3">
                <History size={24} className="text-zinc-400" />
                Previously Flagged (Past Week)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...unflaggedItems].sort((a,b) => b.unflaggedAt - a.unflaggedAt).map((item, idx) => (
                  <div key={idx} className="app-card flex flex-col gap-4 opacity-75 hover:opacity-100 transition-all">
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-bold px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-500">
                        {item.topic}
                      </span>
                      <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-400">
                        {new Date(item.unflaggedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm font-medium line-clamp-3 text-zinc-800 dark:text-zinc-200 mb-2">
                      {item.question.stem}
                    </p>
                    <div className="mt-auto pt-4 border-t border-zinc-100 dark:border-zinc-800/50">
                       <button 
                         onClick={() => {
                           setUnflaggedItems(unflaggedItems.filter(u => u !== item));
                         }}
                         className="text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors flex items-center gap-1.5"
                       >
                         <Flag size={14} className="fill-current text-orange-500 opacity-70" /> Restore Flag
                       </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    // Interactive Flagged Review Carousel Interface
    const items = flaggedByTopic[selectedFlaggedTopic];
    const currentItem = items[currentFlaggedIndex];
    if (!currentItem) return null; // Fallback

    const { question: q, session } = currentItem;
    const ans = session.answers.find((a) => a.questionId === q.id);
    const isCorrect = ans?.isCorrect;

    return (
      <div className="max-w-4xl mx-auto py-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSelectedFlaggedTopic(null)}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors shrink-0"
            >
              <ChevronLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 line-clamp-1">
                {selectedFlaggedTopic}
              </h1>
              <p className="text-zinc-500">
                Item {currentFlaggedIndex + 1} of {items.length}
              </p>
            </div>
          </div>
          {/* Top Pagination Controls */}
          <div className="flex gap-2 items-center">
            <button
              onClick={() => {
                setUnflaggedItems([
                  ...unflaggedItems,
                  {
                    unflaggedAt: Date.now(),
                    question: q,
                    sessionId: session.id,
                    topic: selectedFlaggedTopic
                  }
                ]);
                if (currentFlaggedIndex >= items.length - 1) {
                  if (items.length <= 1) setSelectedFlaggedTopic(null);
                  else setCurrentFlaggedIndex(currentFlaggedIndex - 1);
                }
              }}
              className="btn-ghost flex items-center gap-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 px-3"
              title="Remove from Flagged Items"
            >
              <FlagOff size={16} /> <span className="font-bold text-sm hidden sm:inline">Unflag</span>
            </button>
            <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-800 mx-1"></div>
            <div className="flex gap-2">
            <button
              onClick={() =>
                setCurrentFlaggedIndex(Math.max(0, currentFlaggedIndex - 1))
              }
              disabled={currentFlaggedIndex === 0}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors disabled:opacity-50"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={() =>
                setCurrentFlaggedIndex(
                  Math.min(items.length - 1, currentFlaggedIndex + 1),
                )
              }
              disabled={currentFlaggedIndex === items.length - 1}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors disabled:opacity-50"
            >
              <ChevronRight size={20} />
            </button>
          </div>
          </div>
        </header>

        <div className="app-card space-y-6 relative overflow-hidden">
          {ans && (
            <div
              className={cn(
                "absolute top-0 left-0 w-1.5 h-full",
                isCorrect ? "bg-green-500" : "bg-red-500",
              )}
            />
          )}

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-zinc-400 uppercase tracking-widest text-[10px]">
                Flagged Item {currentFlaggedIndex + 1}
              </span>
              {!ans && (
                <span className="text-[10px] font-bold px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-500 uppercase">
                  Unanswered
                </span>
              )}
            </div>
            <Flag size={16} className="text-orange-500 fill-current" />
          </div>

          <div className="prose prose-zinc dark:prose-invert max-w-none font-medium">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeRaw, rehypeKatex]}
            >
              {q.stem}
            </ReactMarkdown>
          </div>

          <div className="space-y-2">
            {q.options.map((opt, optIdx) => {
              const isSelected = ans?.selectedOption === optIdx;
              const isCorrectOpt = q.correctAnswer === optIdx;

              let stateClass =
                "border-zinc-100 dark:border-zinc-800/50 bg-zinc-50 dark:bg-zinc-800/50 border-2";
              if (isSelected && isCorrectOpt)
                stateClass =
                  "border-green-500 bg-green-50 dark:bg-green-900/20 font-bold text-green-900 dark:text-green-100";
              else if (isSelected && !isCorrectOpt)
                stateClass =
                  "border-red-500 bg-red-50 dark:bg-red-900/20 font-bold text-red-900 dark:text-red-100";
              else if (isCorrectOpt)
                stateClass =
                  "border-green-400 bg-green-50/20 dark:bg-green-900/10 font-bold text-green-800 dark:text-green-200";
              else if (!ans && isCorrectOpt)
                stateClass =
                  "border-zinc-300 bg-white dark:bg-zinc-900 font-bold text-zinc-900 dark:text-zinc-100";

              return (
                <div
                  key={optIdx}
                  className={cn(
                    "p-4 rounded-xl flex gap-4 text-sm transition-all duration-200 hover:scale-105 active:scale-95",
                    stateClass,
                  )}
                >
                  <span
                    className={cn(
                      "flex-none w-6 h-6 rounded flex items-center justify-center font-bold text-xs shrink-0",
                      isSelected
                        ? "bg-white dark:bg-zinc-900 border shadow-sm dark:shadow-none"
                        : "bg-white dark:bg-zinc-900/50 text-zinc-500 mix-blend-multiply",
                    )}
                  >
                    {String.fromCharCode(65 + optIdx)}
                  </span>
                  <span className="flex-1 mt-0.5">{opt}</span>
                </div>
              );
            })}
          </div>

          {q.explanation && (
            <div className="bg-zinc-900 text-white rounded-xl p-6 mt-6">
              <h4 className="font-bold mb-4 flex items-center gap-2 text-sm uppercase tracking-widest text-zinc-400">
                <BookOpen size={16} className="text-zinc-400" /> Explanation
              </h4>
              <div className="prose prose-sm prose-invert max-w-none opacity-90 leading-relaxed font-medium">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeRaw, rehypeKatex]}
                >
                  {q.explanation}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 flex justify-between">
          <button
            disabled={currentFlaggedIndex === 0}
            onClick={() => setCurrentFlaggedIndex(currentFlaggedIndex - 1)}
            className="px-8 py-4 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/50 rounded-2xl font-bold flex items-center gap-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all disabled:opacity-50"
          >
            <ChevronLeft size={18} /> Previous
          </button>

          <button
            onClick={() => {
              if (currentFlaggedIndex === items.length - 1) {
                setSelectedFlaggedTopic(null);
              } else {
                setCurrentFlaggedIndex(currentFlaggedIndex + 1);
              }
            }}
            className="px-8 py-4 bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 rounded-2xl font-bold flex items-center gap-2 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all hover:scale-105 active:scale-95"
          >
            {currentFlaggedIndex === items.length - 1
              ? "Finish Topic"
              : "Next Item"}
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    );
  };

  // --- Lessons View ---
  const handleRegenerateLesson = async () => {
    if (!selectedLesson) return;
    const weakTopics = selectedLesson.weakTopics || [selectedLesson.topic];
    const originalObjectives = selectedLesson.originalObjectives || "";
    setIsGeneratingLesson(true);
    try {
      const newLessonContent = await generateLesson(
        weakTopics,
        originalObjectives,
      );
      const updatedLesson = { ...selectedLesson, content: newLessonContent };
      setSelectedLesson(updatedLesson);
      const updatedLessons = lessons.map((l) =>
        l.id === selectedLesson.id ? updatedLesson : l,
      );
      saveLessons(updatedLessons);
    } catch (err) {
      alert("Failed to regenerate lesson. Please try again.");
    } finally {
      setIsGeneratingLesson(false);
    }
  };

  const renderLessons = () => {
    if (selectedLesson) {
      return (
        <div className="space-y-8 max-w-4xl mx-auto py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <header className="flex justify-between items-start">
            <div>
              <button
                onClick={() => setSelectedLesson(null)}
                className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-widest transition-all duration-200 hover:scale-105 active:scale-95"
              >
                <ChevronLeft size={16} /> Back to Lessons
              </button>
              <h1 className="text-3xl font-black font-display tracking-tight text-zinc-900 dark:text-zinc-100">
                {selectedLesson.topic}
              </h1>
              <div className="flex items-center gap-4 mt-2">
                <p className="text-zinc-500 text-sm">
                  Generated on{" "}
                  {new Date(selectedLesson.createdAt).toLocaleDateString()}
                </p>
                <button
                  onClick={handleRegenerateLesson}
                  disabled={isGeneratingLesson}
                  className="px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-bold rounded-lg border border-amber-200 dark:border-amber-800 flex items-center gap-1.5 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={12} />
                  {isGeneratingLesson
                    ? "Regenerating..."
                    : "Regenerate Content"}
                </button>
              </div>
            </div>
          </header>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700/50 p-4 sm:p-6 md:p-10 lg:p-12 prose prose-zinc dark:prose-invert max-w-none w-full overflow-hidden prose-p:my-4 prose-p:leading-relaxed prose-li:my-2 prose-ul:my-4 prose-headings:font-bold prose-h1:mt-10 prose-h2:mt-10 prose-h3:mt-8 md:prose-base lg:prose-lg">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeRaw, rehypeKatex]}
            >
              {selectedLesson.content}
            </ReactMarkdown>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-8 max-w-5xl mx-auto py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <header>
          <h1 className="text-3xl font-black font-display tracking-tight text-zinc-900 dark:text-zinc-100">
            Lessons Vault
          </h1>
          <p className="text-zinc-500">
            Access targeted, concise lessons generated from your missed topics.
          </p>
        </header>

        {lessons.length === 0 ? (
          <div className="app-card flex flex-col items-center justify-center py-24 text-center space-y-4">
            <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-900/20 text-zinc-500 dark:text-zinc-400 rounded-2xl flex items-center justify-center mb-2">
              <BookOpen size={32} />
            </div>
            <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-200">
              No Lessons Yet
            </h2>
            <p className="text-zinc-500 max-w-md">
              Complete quizzes and click "Generate Target Lesson" in the report
              view to create custom review guides.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lessons.map((lesson) => (
              <div
                key={lesson.id}
                onClick={() => setSelectedLesson(lesson)}
                className="app-card hover:border-zinc-300 hover:shadow-md cursor-pointer transition-all flex flex-col items-start text-left h-full group"
              >
                <div className="w-10 h-10 bg-zinc-50 dark:bg-zinc-900/20 text-zinc-900 dark:text-zinc-100 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <BookOpen size={20} />
                </div>
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 mb-2 line-clamp-2">
                  {lesson.topic}
                </h3>
                <p className="text-xs font-bold text-zinc-400 mt-auto uppercase tracking-widest">
                  {new Date(lesson.createdAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex bg-zinc-50 dark:bg-zinc-950 bg-dot-pattern min-h-screen text-zinc-800 dark:text-zinc-200 overflow-x-hidden font-sans">
      <AnimatePresence>
        {shortcutFeedback && (
          <motion.div
            key={shortcutFeedback.id}
            initial={{ opacity: 0, y: 20, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, scale: 0.9, x: "-50%" }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-8 left-1/2 bg-zinc-800/90 backdrop-blur-sm shadow-xl shadow-zinc-900/10 text-white px-5 py-3 rounded-2xl font-bold text-sm z-[100] flex items-center gap-3 pointer-events-none"
          >
            <Keyboard size={18} className="text-zinc-400" />
            {shortcutFeedback.message}
          </motion.div>
        )}
      </AnimatePresence>
      {renderSidebar()}
      <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
        {view === "home" && renderHome()}
        {view === "config" && renderHome()}
        {view === "loading" && renderLoading()}
        {view === "quiz" && renderQuiz()}
        {view === "report" && renderReport()}
        {view === "history" && renderHistory()}
        {view === "review" && renderReview()}
        {view === "flaggedItems" && renderFlaggedItems()}
        {view === "lessons" && renderLessons()}
      </main>
    </div>
  );
}
