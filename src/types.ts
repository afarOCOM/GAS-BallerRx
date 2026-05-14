/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Question {
  id: string;
  stem: string;
  options: string[];
  correctAnswer: number; // Index of options
  explanation: string;
  system?: string;
  topic: string;
  difficulty: Difficulty;
}

export interface UserAnswer {
  questionId: string;
  selectedOption: number;
  isCorrect: boolean;
  isFlagged: boolean;
  timeSpent: number; // in seconds
}

export interface Session {
  id: string;
  startTime: number;
  objectives: string;
  difficulty: Difficulty;
  maxQuestions: number;
  questions: Question[]; 
  answers: UserAnswer[];
  isCompleted: boolean;
  performanceSummary?: string;
  quizMode?: 'guided' | 'practice';
  flaggedQuestionIds?: string[];
  generationContext?: {
    generalTopic: string;
    batches: {
      objectives: string;
      parameters: {
        count: number;
        difficulty: Difficulty;
      }
    }[];
  };
}

export interface Lesson {
  id: string;
  topic: string;
  content: string;
  relatedSessionId?: string;
  createdAt: number;
  weakTopics?: string[];
  originalObjectives?: string;
}

export interface UserProgress {
  history: Session[];
  lessons?: Lesson[];
}
