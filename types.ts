
import React from 'react';

// Global declaration for canvas-confetti and pptxgenjs
declare global {
    interface Window {
        confetti: (options?: any) => Promise<null>;
        PptxGenJS: any;
    }
}

export interface UploadedFile {
  name: string;
  base64: string;
  mimeType: string;
}

export interface Flashcard {
  type: 'qa' | 'definition' | 'problem' | 'long_answer';
  front: string;
  back: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  flashcards?: Flashcard[];
}

export interface VisualReference {
  type: 'image_file' | 'pdf_reference' | 'text_reference';
  fileIndex: number;
  pageNumber?: number; // for PDF
  description: string; // e.g. "Figure 3.1"
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  difficulty?: string;
  page_ref?: string;
  confidenceScore?: number;
  visualReference?: VisualReference; // Changed from visualContext
}

export interface Subject {
  id: string;
  name: string;
  files: UploadedFile[];
}

// Updated SubjectTab to remove 'plan' as it is now global
export type SubjectTab = 'chat' | 'quiz' | 'notes' | 'recap' | 'live_revision' | 'resources' | 'lecture';

export type ChatTool = 'general' | 'qna_solver' | 'concept_explainer' | 'notes_summarizer' | 'homework_helper' | 'flashcard_generator';

export interface ToolDefinition {
  id: ChatTool;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  placeholder: string;
  systemInstruction: string;
}

export interface KeyConcept {
  concept: string;
  explanation: string;
}

export interface RecapData {
  summary: string;
  keyConcepts: KeyConcept[];
  flashcards: Flashcard[];
  visualAidPrompt: string;
}

export interface DailyRecapData {
  summary: string;
  connections: string;
  keyConcepts: KeyConcept[];
  flashcards: Flashcard[];
  quiz: QuizQuestion[];
  visualAidPrompt: string;
}

export interface TeachingReport {
    score: number;
    feedback: string;
    clarityRating: 'Low' | 'Medium' | 'High';
    missedPoints: string[];
}

// --- NOTES SPECIFIC TYPES ---

export interface CornellSection {
    cue: string; // The question or keyword on the left
    content: string; // The detailed notes on the right
    visualIndex?: number; // Optional visual reference
}

export interface StructuredNotes {
    title: string;
    examTips: string[]; // High yield points specifically for exams
    sections: CornellSection[];
    summary: string;
    visuals: VisualReference[];
}

// --- SUBJECT SPECIFIC STUDY PLANNER TYPES ---

export interface StudyTask {
  id: string;
  day: number;
  topic: string;
  activity: string;
  completed: boolean;
  importantQuestions?: string[];
}

export interface StudyPlan {
  goal: string;
  durationDays: number;
  country?: string;
  examBoard?: string;
  tasks: StudyTask[];
}

// --- QUEST MODE TYPES ---

export interface QuestChallenge {
    question: string; // The challenge presented in the story context
    options: string[]; // Options for MC
    correctAnswer: string; // String for MC
}

export interface QuestScene {
    conceptName: string; // The topic being taught
    conceptExplanation: string; // The "Lecture" content
    narrative: string; // The story text
    visualPrompt: string; // Prompt for a background image (optional implementation)
    challenges: QuestChallenge[]; // Multiple questions per scene
    conceptUnlocked?: string; // If they pass, they get this item/concept
    hpChange?: number; // -1 if wrong last time
    xpGain?: number; // +XP if correct
    visualReference?: VisualReference; // Reference to a figure in the source PDF
}

export interface QuestState {
    health: number;
    maxHealth: number;
    xp: number;
    level: number;
    inventory: string[]; // Concepts collected
    isGameOver: boolean;
}

// --- GLOBAL STUDY PLANNER TYPES ---

export interface GlobalTask {
    id: string;
    topic: string;
    description: string;
    completed: boolean;
    importantQuestions?: string[];
}

export interface SyllabusModule {
    id: string;
    title: string;
    weightage: number; // approximate marks
    tasks: GlobalTask[];
    completed: boolean;
}

export interface GlobalStudyPlan {
    country: string;
    examBoard: string;
    goal: string;
    totalMarks: number;
    modules: SyllabusModule[];
}
