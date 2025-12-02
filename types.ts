
import React from 'react';

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

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  difficulty?: string;
  page_ref?: string;
  confidenceScore?: number; // Added AI confidence score
}

export interface Subject {
  id: string;
  name: string;
  files: UploadedFile[];
}

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

// --- QUEST MODE TYPES ---

export interface QuestChallenge {
    type: 'multiple_choice' | 'ordering';
    question: string; // The challenge presented in the story context
    options: string[]; // Options for MC or steps for Ordering
    correctAnswer: string; // String for MC
}

export interface QuestScene {
    conceptName: string; // New: The topic being taught
    conceptExplanation: string; // New: The "Lecture" content
    narrative: string; // The story text
    visualPrompt: string; // Prompt for a background image (optional implementation)
    challenges: QuestChallenge[]; // UPDATED: Multiple questions per scene
    conceptUnlocked?: string; // If they pass, they get this item/concept
    hpChange?: number; // -1 if wrong last time
    xpGain?: number; // +XP if correct
}

export interface QuestState {
    health: number;
    maxHealth: number;
    xp: number;
    level: number;
    inventory: string[]; // Concepts collected
    isGameOver: boolean;
}