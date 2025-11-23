
import React, { useState, useEffect, useCallback } from 'react';
import { UploadedFile, QuizQuestion } from '../types';
import { generateQuiz } from '../services/geminiService';
import { SparklesIcon, CheckCircleIcon, XCircleIcon, ArrowPathIcon } from './icons/Icons';
import { saveToStorage, loadFromStorage } from '../utils/storageUtils';


interface QuizProps {
  files: UploadedFile[];
  subjectId: string;
}

const Quiz: React.FC<QuizProps> = ({ files, subjectId }) => {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);

  const fetchQuiz = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    setError(null);
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setScore(0);

    if (!forceRefresh) {
        const cachedQuiz = loadFromStorage<QuizQuestion[]>(subjectId, 'quiz');
        if (cachedQuiz && cachedQuiz.length > 0) {
            setQuestions(cachedQuiz);
            setIsCached(true);
            setIsLoading(false);
            return;
        }
    }

    setIsCached(false);
    try {
      const quizQuestions = await generateQuiz(files);
      if (quizQuestions && quizQuestions.length > 0) {
        setQuestions(quizQuestions);
        saveToStorage(subjectId, 'quiz', quizQuestions);
      } else {
        setError('Could not generate a quiz from the provided document(s). Please try different file(s).');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred while generating the quiz.');
    } finally {
      setIsLoading(false);
    }
  }, [files, subjectId]);

  useEffect(() => {
    fetchQuiz();
  }, [fetchQuiz]);

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
    setIsAnswered(false);
    setSelectedAnswer(null);
    setCurrentQuestionIndex(currentQuestionIndex + 1);
  };

  const handleRestart = () => {
      fetchQuiz(true);
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <SparklesIcon className="w-16 h-16 text-sky-500 animate-pulse mb-4" />
        <h3 className="text-xl font-bold text-slate-700">Generating your quiz...</h3>
        <p className="text-slate-400 font-medium">Please wait while our AI analyzes your documents.</p>
      </div>
    );
  }

  if (error) {
    return (
       <div className="flex flex-col items-center justify-center h-full text-center text-red-500">
        <XCircleIcon className="w-16 h-16 mb-4"/>
        <h3 className="text-xl font-bold">{error}</h3>
        <button onClick={() => fetchQuiz(true)} className="mt-6 bg-sky-500 hover:bg-sky-400 text-white font-bold py-3 px-6 rounded-2xl flex items-center gap-2 border-b-4 border-sky-700 active:border-b-0 active:translate-y-1">
            <ArrowPathIcon className="w-5 h-5" />
            Try Again
        </button>
      </div>
    );
  }
  
  const isFinished = currentQuestionIndex >= questions.length;

  if (isFinished) {
    return (
      <div className="text-center flex flex-col items-center justify-center h-full">
        <h2 className="text-4xl font-extrabold text-slate-800 mb-2">Quiz Complete!</h2>
        <p className="text-2xl text-slate-500 font-medium mb-8">Your score: <span className="font-extrabold text-sky-500">{score}</span> / {questions.length}</p>
        <button onClick={handleRestart} className="bg-sky-500 hover:bg-sky-400 text-white font-bold py-4 px-8 rounded-2xl flex items-center gap-2 border-b-4 border-sky-700 active:border-b-0 active:translate-y-1 shadow-md">
          <ArrowPathIcon className="w-6 h-6"/>
          Take Another Quiz
        </button>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="max-w-2xl mx-auto relative pt-8">
      {isCached && (
        <div className="absolute top-0 right-0">
            <span className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full uppercase tracking-wide">Offline Cache</span>
        </div>
      )}
      <div className="mb-8 text-center">
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Question {currentQuestionIndex + 1} of {questions.length}</p>
        <h2 className="text-2xl font-bold text-slate-800">{currentQuestion.question}</h2>
      </div>
      <div className="space-y-4">
        {currentQuestion.options.map((option, index) => {
          const isCorrect = option === currentQuestion.correctAnswer;
          const isSelected = option === selectedAnswer;
          
          let optionClass = "bg-white border-slate-200 text-slate-600 hover:bg-slate-50";
          if(isAnswered && isCorrect) optionClass = "bg-green-100 border-green-500 text-green-700";
          if(isAnswered && isSelected && !isCorrect) optionClass = "bg-red-100 border-red-500 text-red-700";
          if(!isAnswered && isSelected) optionClass = "bg-sky-100 border-sky-500 text-sky-700";

          return (
            <button
              key={index}
              onClick={() => handleAnswerSelect(option)}
              disabled={isAnswered}
              className={`w-full text-left p-4 rounded-2xl border-2 transition-all duration-200 font-bold text-lg shadow-sm ${optionClass} ${!isAnswered ? 'hover:border-slate-300 active:translate-y-0.5' : ''}`}
            >
              {option}
            </button>
          )
        })}
      </div>
      
      {isAnswered && (
        <div className={`mt-8 p-6 rounded-2xl border-2 ${selectedAnswer === currentQuestion.correctAnswer ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center gap-3 mb-2">
                {selectedAnswer === currentQuestion.correctAnswer ? <CheckCircleIcon className="w-8 h-8 text-green-500"/> : <XCircleIcon className="w-8 h-8 text-red-500"/>}
                <h3 className={`text-xl font-extrabold ${selectedAnswer === currentQuestion.correctAnswer ? 'text-green-700' : 'text-red-700'}`}>
                    {selectedAnswer === currentQuestion.correctAnswer ? 'Correct!' : 'Incorrect'}
                </h3>
            </div>
            <p className="text-slate-600 font-medium">{currentQuestion.explanation}</p>
            <div className="flex items-center gap-3 mt-4">
              {currentQuestion.difficulty && <span className="text-xs font-bold uppercase tracking-wider px-2 py-1 bg-white border border-slate-200 rounded-md text-slate-500">Difficulty: {currentQuestion.difficulty}</span>}
              {currentQuestion.page_ref && <span className="text-xs font-bold uppercase tracking-wider px-2 py-1 bg-white border border-slate-200 rounded-md text-slate-500">Ref: {currentQuestion.page_ref}</span>}
            </div>
        </div>
      )}
      
      <div className="mt-10 flex justify-between items-center">
        <button onClick={() => fetchQuiz(true)} className="text-slate-400 hover:text-slate-600 font-bold text-sm uppercase tracking-wide flex items-center gap-2 transition-colors">
            <ArrowPathIcon className="w-4 h-4"/> Restart
        </button>
        {!isAnswered ? (
             <button onClick={handleCheckAnswer} disabled={!selectedAnswer} className="bg-green-500 text-white font-bold py-3 px-10 rounded-2xl hover:bg-green-400 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed disabled:border-none transition-all border-b-4 border-green-700 active:border-b-0 active:translate-y-1 shadow-md">Check</button>
        ) : (
            <button onClick={handleNextQuestion} className="bg-green-500 text-white font-bold py-3 px-10 rounded-2xl hover:bg-green-400 transition-all border-b-4 border-green-700 active:border-b-0 active:translate-y-1 shadow-md">Next</button>
        )}
      </div>
    </div>
  );
};

export default Quiz;
