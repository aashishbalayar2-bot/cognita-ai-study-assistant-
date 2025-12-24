import React, { useState, useEffect, useCallback } from 'react';
import { UploadedFile, QuizQuestion, VisualReference } from '../types';
import { generateQuiz } from '../services/geminiService';
import { SparklesIcon, CheckCircleIcon, XCircleIcon, ArrowPathIcon, AcademicCapIcon, BoltIcon, BookOpenIcon, Squares2x2Icon } from './icons/Icons';
import { saveToStorage, loadFromStorage } from '../utils/storageUtils';
import { SourceVisualDisplay } from './SourceVisualDisplay';

interface QuizProps {
  files: UploadedFile[];
  subjectId: string;
}

type QuizView = 'setup' | 'loading' | 'quiz' | 'result' | 'error';
type QuizType = 'mixed' | 'theoretical' | 'practical';

const Quiz: React.FC<QuizProps> = ({ files, subjectId }) => {
  const [view, setView] = useState<QuizView>('setup');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);
  
  // Quiz Configuration State
  const [questionCount, setQuestionCount] = useState(5);
  const [quizType, setQuizType] = useState<QuizType>('mixed');

  // Load cache on mount, but check if user wants to resume or start new
  useEffect(() => {
    const cachedQuiz = loadFromStorage<QuizQuestion[]>(subjectId, 'quiz');
    if (cachedQuiz && cachedQuiz.length > 0) {
        setQuestions(cachedQuiz);
        setIsCached(true);
        setView('quiz'); 
    } else {
        setView('setup');
    }
  }, [subjectId]);

  const startQuiz = async () => {
    setIsCached(false);
    setView('loading');
    setError(null);
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setScore(0);
    setSelectedAnswer(null);
    setIsAnswered(false);

    try {
      const quizQuestions = await generateQuiz(files, questionCount, quizType);
      if (quizQuestions && quizQuestions.length > 0) {
        setQuestions(quizQuestions);
        saveToStorage(subjectId, 'quiz', quizQuestions);
        setView('quiz');
      } else {
        setError('Could not generate a quiz from the provided document(s). Please try different file(s).');
        setView('error');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred while generating the quiz.');
      setView('error');
    }
  };

  const handleAnswerSelect = (option: string) => {
    if (isAnswered) return;
    setSelectedAnswer(option);
  };
  
  const handleCheckAnswer = () => {
    if(!selectedAnswer) return;
    setIsAnswered(true);
    if (selectedAnswer === questions[currentQuestionIndex].correctAnswer) {
      setScore(score + 1);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex >= questions.length - 1) {
        setView('result');
        return;
    }
    setIsAnswered(false);
    setSelectedAnswer(null);
    setCurrentQuestionIndex(currentQuestionIndex + 1);
  };

  const resetToSetup = () => {
      setView('setup');
      setScore(0);
      setCurrentQuestionIndex(0);
      setIsAnswered(false);
      setSelectedAnswer(null);
  }

  // --- VIEWS ---

  if (view === 'setup') {
      return (
          <div className="flex flex-col items-center justify-center h-full max-w-xl mx-auto text-center px-4">
              <div className="bg-blue-50 p-6 rounded-full mb-8 border border-blue-100 shadow-sm animate-in zoom-in-50 duration-300">
                  <AcademicCapIcon className="w-16 h-16 text-blue-600" />
              </div>
              <h2 className="text-3xl font-extrabold text-slate-800 mb-2">Configure Your Quiz</h2>
              <p className="text-slate-500 font-medium mb-10">Customize your practice session to target your weak spots.</p>

              <div className="w-full space-y-8">
                  {/* Count Slider */}
                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                      <div className="flex justify-between items-center mb-4">
                          <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">Number of Questions</label>
                          <span className="text-2xl font-black text-blue-600">{questionCount}</span>
                      </div>
                      <input 
                          type="range" 
                          min="1" 
                          max="20" 
                          value={questionCount} 
                          onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                          className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                      <div className="flex justify-between text-xs font-bold text-slate-400 mt-2">
                          <span>1</span>
                          <span>10</span>
                          <span>20</span>
                      </div>
                  </div>

                  {/* Type Selector */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <button 
                          onClick={() => setQuizType('theoretical')}
                          className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${quizType === 'theoretical' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-500 hover:border-blue-200'}`}
                      >
                          <BookOpenIcon className="w-6 h-6" />
                          <span className="font-bold text-sm">Theoretical</span>
                      </button>
                      <button 
                          onClick={() => setQuizType('practical')}
                          className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${quizType === 'practical' ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 bg-white text-slate-500 hover:border-green-200'}`}
                      >
                          <BoltIcon className="w-6 h-6" />
                          <span className="font-bold text-sm">Practical</span>
                      </button>
                       <button 
                          onClick={() => setQuizType('mixed')}
                          className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${quizType === 'mixed' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-slate-200 bg-white text-slate-500 hover:border-purple-200'}`}
                      >
                          <Squares2x2Icon className="w-6 h-6" />
                          <span className="font-bold text-sm">Mixed</span>
                      </button>
                  </div>

                  <button 
                      onClick={startQuiz}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-md transition-all active:translate-y-0.5 flex items-center justify-center gap-2 text-lg"
                  >
                      <SparklesIcon className="w-5 h-5" />
                      Generate Quiz
                  </button>
              </div>
          </div>
      )
  }

  if (view === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <SparklesIcon className="w-12 h-12 text-blue-500 animate-pulse mb-4" />
        <h3 className="text-xl font-bold text-slate-800">Generating your quiz...</h3>
        <p className="text-slate-500 font-medium mt-1"> crafting {questionCount} {quizType} questions.</p>
      </div>
    );
  }

  if (view === 'error') {
    return (
       <div className="flex flex-col items-center justify-center h-full text-center text-red-500">
        <XCircleIcon className="w-12 h-12 mb-4"/>
        <h3 className="text-xl font-bold">{error || 'Something went wrong.'}</h3>
        <button onClick={resetToSetup} className="mt-6 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-2 px-6 rounded-lg flex items-center gap-2 shadow-sm transition-all active:translate-y-0.5">
            <ArrowPathIcon className="w-4 h-4" />
            Try Again
        </button>
      </div>
    );
  }
  
  if (view === 'result') {
    // Trigger confetti if score is good
    if (score > questions.length / 2 && window.confetti) {
        window.confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#2563eb', '#3b82f6', '#60a5fa']
        });
    }

    return (
      <div className="text-center flex flex-col items-center justify-center h-full animate-in fade-in zoom-in-95 duration-300">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-lg mb-8 max-w-sm w-full">
            <h2 className="text-3xl font-extrabold text-slate-800 mb-2">Quiz Complete!</h2>
            <div className="my-6">
                <span className="text-6xl font-black text-blue-600 block">{Math.round((score / questions.length) * 100)}%</span>
                <p className="text-slate-400 font-bold uppercase tracking-widest text-sm mt-2">Accuracy</p>
            </div>
            <p className="text-lg text-slate-600 font-medium">You got <span className="font-bold text-slate-800">{score}</span> out of {questions.length} correct.</p>
        </div>
        
        <button onClick={resetToSetup} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg flex items-center gap-2 shadow-md transition-all active:translate-y-0.5">
          <ArrowPathIcon className="w-5 h-5"/>
          New Quiz
        </button>
      </div>
    );
  }

  // --- QUIZ ACTIVE VIEW ---
  
  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="max-w-2xl mx-auto relative pt-4 h-full flex flex-col">
      {/* Header Bar */}
      <div className="flex justify-between items-center mb-6">
          <button 
            onClick={resetToSetup}
            className="text-xs font-bold text-slate-400 hover:text-slate-600 uppercase tracking-wide flex items-center gap-1 transition-colors"
          >
              <ArrowPathIcon className="w-3 h-3"/> New Quiz
          </button>
          
          <div className="flex items-center gap-2">
                {isCached && (
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full uppercase tracking-wide">Cached</span>
                )}
               <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded uppercase tracking-wide">Question {currentQuestionIndex + 1} / {questions.length}</span>
          </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          
          {/* Question Block */}
          <div className="mb-6">
            <div className="flex gap-2 mb-3">
                 {currentQuestion.difficulty && (
                     <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${
                         currentQuestion.difficulty === 'hard' ? 'bg-red-50 text-red-600 border-red-100' : 
                         currentQuestion.difficulty === 'medium' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' : 
                         'bg-green-50 text-green-600 border-green-100'
                     }`}>
                         {currentQuestion.difficulty}
                     </span>
                 )}
            </div>
            <h2 className="text-xl font-bold text-slate-800 leading-snug">{currentQuestion.question}</h2>
          </div>

          {/* Source Visual Render (Moved below question for better flow) */}
          {currentQuestion.visualReference && (
              <SourceVisualDisplay visual={currentQuestion.visualReference} files={files} compact={true} />
          )}

          {/* Options */}
          <div className="space-y-3 mb-8">
            {currentQuestion.options.map((option, index) => {
              const isCorrect = option === currentQuestion.correctAnswer;
              const isSelected = option === selectedAnswer;
              
              let optionClass = "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300";
              let iconColor = "border-slate-300";
              
              if(isAnswered) {
                  if(isCorrect) {
                      optionClass = "bg-green-50 border-green-500 text-green-800 ring-1 ring-green-500";
                      iconColor = "border-green-600 bg-green-600";
                  } else if(isSelected && !isCorrect) {
                      optionClass = "bg-red-50 border-red-500 text-red-800 ring-1 ring-red-500";
                      iconColor = "border-red-500";
                  } else {
                      optionClass = "bg-slate-50 border-slate-200 text-slate-400 opacity-70";
                  }
              } else if(isSelected) {
                  optionClass = "bg-blue-50 border-blue-500 text-blue-800 ring-1 ring-blue-500";
                  iconColor = "border-blue-600";
              }

              return (
                <button
                  key={index}
                  onClick={() => handleAnswerSelect(option)}
                  disabled={isAnswered}
                  className={`w-full text-left p-4 rounded-xl border transition-all duration-200 font-medium text-base shadow-sm ${optionClass} ${!isAnswered ? 'active:scale-[0.99]' : ''}`}
                >
                  <div className="flex items-start gap-3">
                      <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${iconColor}`}>
                          {isAnswered && isCorrect && <CheckCircleIcon className="w-3.5 h-3.5 text-white" />}
                          {isAnswered && isSelected && !isCorrect && <XCircleIcon className="w-3.5 h-3.5 text-red-500" />}
                          {!isAnswered && isSelected && <div className="w-2.5 h-2.5 bg-blue-600 rounded-full" />}
                      </div>
                      <span className="leading-snug">{option}</span>
                  </div>
                </button>
              )
            })}
          </div>
          
          {/* Explanation Reveal */}
          {isAnswered && (
            <div className={`mt-6 p-5 rounded-xl border animate-in fade-in slide-in-from-bottom-2 duration-300 ${selectedAnswer === currentQuestion.correctAnswer ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                    <span className={`font-bold uppercase text-xs tracking-wide ${selectedAnswer === currentQuestion.correctAnswer ? 'text-green-700' : 'text-red-700'}`}>
                        {selectedAnswer === currentQuestion.correctAnswer ? 'Correct Explanation' : 'Why it\'s wrong'}
                    </span>
                </div>
                <p className="text-slate-700 font-medium text-sm leading-relaxed">{currentQuestion.explanation}</p>
                {currentQuestion.page_ref && (
                    <div className="mt-3 pt-3 border-t border-black/5 text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1">
                        <BookOpenIcon className="w-3 h-3" />
                        Reference: {currentQuestion.page_ref}
                    </div>
                )}
            </div>
          )}
      </div>
      
      <div className="mt-4 pt-4 border-t border-slate-100 bg-white sticky bottom-0">
        {!isAnswered ? (
             <button 
                onClick={handleCheckAnswer} 
                disabled={!selectedAnswer} 
                className="w-full bg-blue-600 text-white font-bold py-3.5 px-8 rounded-xl hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed disabled:shadow-none transition-all shadow-md active:translate-y-0.5 text-base"
            >
                Check Answer
            </button>
        ) : (
            <button 
                onClick={handleNextQuestion} 
                className="w-full bg-blue-600 text-white font-bold py-3.5 px-8 rounded-xl hover:bg-blue-700 transition-all shadow-md active:translate-y-0.5 text-base"
            >
                {currentQuestionIndex >= questions.length - 1 ? 'Finish Quiz' : 'Next Question'}
            </button>
        )}
      </div>
    </div>
  );
};

export default Quiz;