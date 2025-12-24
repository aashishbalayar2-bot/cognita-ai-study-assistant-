import React, { useState, useEffect, useRef } from 'react';
import { Flashcard } from '../types';
import { 
    ChevronLeftIcon, ChevronRightIcon, ClockIcon, FireIcon, 
    ArrowPathIcon, CheckCircleIcon, XCircleIcon, HandThumbUpIcon, HandThumbDownIcon,
    SparklesIcon, CheckIcon
} from './icons/Icons';

type StudyMode = 'browse' | 'speed' | 'smart';

interface FlashcardStudySessionProps {
    cards: Flashcard[];
    cardType: 'qa' | 'definition' | 'problem' | 'long_answer';
}

const FlashcardStudySession: React.FC<FlashcardStudySessionProps> = ({ cards, cardType }) => {
    const [mode, setMode] = useState<StudyMode>('browse');
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    
    // Speed Run State
    const [timeLeft, setTimeLeft] = useState(60);
    const [score, setScore] = useState(0);
    const [isGameActive, setIsGameActive] = useState(false);
    const [streak, setStreak] = useState(0);

    // Smart Practice State
    const [studyQueue, setStudyQueue] = useState<Flashcard[]>([]);
    const [masteredCount, setMasteredCount] = useState(0);
    const [isSessionComplete, setIsSessionComplete] = useState(false);

    // Reset when cards or mode changes
    useEffect(() => {
        resetSession();
    }, [cards, mode]);

    const resetSession = () => {
        setCurrentIndex(0);
        setIsFlipped(false);
        setIsGameActive(false);
        setIsSessionComplete(false);
        setStudyQueue([...cards]); // Initialize queue with all cards
        setMasteredCount(0);
        setScore(0);
        setStreak(0);
        setTimeLeft(60);
    };

    // Timer logic for Speed Run
    useEffect(() => {
        let interval: number;
        if (mode === 'speed' && isGameActive && timeLeft > 0) {
            interval = window.setInterval(() => {
                setTimeLeft((prev) => prev - 1);
            }, 1000);
        } else if (timeLeft === 0) {
            setIsGameActive(false);
            setIsSessionComplete(true);
        }
        return () => clearInterval(interval);
    }, [mode, isGameActive, timeLeft]);

    const handleNext = () => {
        setIsFlipped(false);
        setTimeout(() => setCurrentIndex((prev) => (prev + 1) % cards.length), 150);
    };

    const handlePrev = () => {
        setIsFlipped(false);
        setTimeout(() => setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length), 150);
    };

    const getFrontLabel = () => {
        if (cardType === 'problem') return 'Problem';
        if (cardType === 'definition') return 'Term';
        if (cardType === 'long_answer') return 'Exam Question';
        return 'Question';
    };

    const getBackLabel = () => {
        if (cardType === 'problem') return 'Solution';
        if (cardType === 'definition') return 'Definition';
        if (cardType === 'long_answer') return 'Model Answer';
        return 'Answer';
    };

    // --- Mode Specific Handlers ---

    const startGame = () => {
        setIsGameActive(true);
        setTimeLeft(60);
        setScore(0);
        setStreak(0);
        setCurrentIndex(0);
        setIsFlipped(false);
        setIsSessionComplete(false);
    };

    const handleSpeedAnswer = (correct: boolean) => {
        if (correct) {
            setScore(s => s + 10 + (streak * 2)); // Streak bonus
            setStreak(s => s + 1);
        } else {
            setScore(s => Math.max(0, s - 5));
            setStreak(0);
        }
        
        // Move to next card immediately
        setIsFlipped(false);
        setTimeout(() => {
             // Cycle randomly or sequentially
             setCurrentIndex((prev) => (prev + 1) % cards.length);
        }, 100);
    };

    const handleSmartRating = (rating: 'hard' | 'good' | 'easy') => {
        const currentCard = studyQueue[currentIndex];
        const newQueue = [...studyQueue];

        // Remove current card from its current position
        newQueue.splice(currentIndex, 1);

        if (rating === 'easy') {
            // Mastered! Don't add back to queue.
            setMasteredCount(c => c + 1);
        } else if (rating === 'good') {
            // Add back to end of queue
            newQueue.push(currentCard);
        } else { // Hard
            // Insert 3 spots later (or end if < 3)
            const insertIdx = Math.min(newQueue.length, 2);
            newQueue.splice(insertIdx, 0, currentCard);
        }

        setStudyQueue(newQueue);
        setIsFlipped(false);

        if (newQueue.length === 0) {
            setIsSessionComplete(true);
        } else {
             // Loop index if needed (though we usually just take 0 if we are shifting queue)
             // But here we are manipulating the array so let's reset index to 0 effectively
             setCurrentIndex(0);
        }
    };

    if (!cards || cards.length === 0) {
        return <p className="text-center text-slate-500 font-bold h-64 flex items-center justify-center">No cards available.</p>;
    }

    // Determine which card to show
    const activeCard = mode === 'smart' ? studyQueue[currentIndex] : cards[currentIndex];

    // --- Renderers ---

    if (isSessionComplete) {
        return (
            <div className="flex flex-col items-center justify-center h-80 text-center space-y-6 animate-in zoom-in-95 duration-300">
                <div className="bg-white p-6 rounded-full border border-slate-200 shadow-sm">
                    {mode === 'speed' ? <FireIcon className="w-12 h-12 text-blue-500" /> : <CheckCircleIcon className="w-12 h-12 text-green-500" />}
                </div>
                <div>
                    <h3 className="text-3xl font-extrabold text-slate-800">
                        {mode === 'speed' ? 'Time\'s Up!' : 'Session Complete!'}
                    </h3>
                    <p className="text-slate-500 font-bold mt-2 text-lg">
                        {mode === 'speed' ? `Final Score: ${score}` : `You mastered ${masteredCount} concepts.`}
                    </p>
                </div>
                <button 
                    onClick={mode === 'speed' ? startGame : resetSession}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg shadow-md transition-all flex items-center gap-2 active:translate-y-0.5"
                >
                    <ArrowPathIcon className="w-5 h-5" />
                    {mode === 'speed' ? 'Play Again' : 'Practice Again'}
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center w-full max-w-lg mx-auto">
            {/* Mode Selector */}
            <div className="flex bg-slate-100 p-1 rounded-xl mb-8 w-full border border-slate-200">
                <button 
                    onClick={() => setMode('browse')} 
                    disabled={isGameActive}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'browse' ? 'bg-white text-slate-800 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Browse
                </button>
                <button 
                    onClick={() => setMode('speed')} 
                    disabled={isGameActive}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-1 ${mode === 'speed' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <ClockIcon className="w-4 h-4"/> Speed
                </button>
                <button 
                    onClick={() => setMode('smart')} 
                    disabled={isGameActive}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-1 ${mode === 'smart' ? 'bg-white text-green-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <SparklesIcon className="w-4 h-4"/> Smart
                </button>
            </div>

            {/* Mode Specific Headers */}
            {mode === 'speed' && (
                <div className="flex items-center justify-between w-full mb-4 px-2">
                    <div className={`flex items-center gap-2 font-black text-2xl ${timeLeft < 10 ? 'text-red-500 animate-pulse' : 'text-slate-700'}`}>
                        <ClockIcon className="w-6 h-6" /> {timeLeft}s
                    </div>
                    <div className="flex items-center gap-2 font-black text-xl text-blue-600">
                        <FireIcon className="w-6 h-6" /> {score}
                    </div>
                </div>
            )}
            
             {mode === 'smart' && (
                <div className="flex items-center justify-between w-full mb-4 px-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Queue: {studyQueue.length}</span>
                    <span className="text-xs font-bold text-green-600 uppercase tracking-wider">Mastered: {masteredCount}</span>
                </div>
            )}

            {/* Start Screen for Speed Mode */}
            {mode === 'speed' && !isGameActive ? (
                 <div className="h-72 w-full bg-white border border-blue-100 rounded-xl flex flex-col items-center justify-center text-center p-6 space-y-6 shadow-sm">
                    <ClockIcon className="w-16 h-16 text-blue-500" />
                    <div>
                        <h3 className="text-xl font-extrabold text-slate-800">Speed Run Challenge</h3>
                        <p className="text-blue-500 font-medium">60 seconds. How many can you get?</p>
                    </div>
                    <button 
                        onClick={startGame}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg shadow-md transition-all active:translate-y-0.5"
                    >
                        Start Timer
                    </button>
                </div>
            ) : (
                /* The Flashcard */
                <div className="w-full h-72 perspective-1000">
                    <div 
                        className={`relative w-full h-full transform-style-preserve-3d transition-transform duration-500 ${isFlipped ? 'rotate-y-180' : ''}`}
                        onClick={() => setIsFlipped(!isFlipped)}
                    >
                        {/* Front */}
                        <div className="absolute w-full h-full backface-hidden bg-white border border-slate-200 rounded-xl p-8 flex flex-col justify-center items-center text-center cursor-pointer shadow-md hover:border-blue-300 transition-colors">
                            <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-4">{getFrontLabel()}</p>
                            <p className="text-xl font-bold text-slate-800 overflow-y-auto max-h-48 scrollbar-hide">{activeCard.front}</p>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wide mt-auto pt-4">Tap to flip</p>
                        </div>
                        {/* Back */}
                        <div className="absolute w-full h-full backface-hidden bg-slate-50 border border-slate-200 rounded-xl p-8 flex flex-col justify-center items-center text-center cursor-pointer rotate-y-180 shadow-md">
                            <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-4">{getBackLabel()}</p>
                            <p className="text-lg font-medium text-slate-700 overflow-y-auto max-h-48 scrollbar-hide whitespace-pre-wrap">{activeCard.back}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Controls */}
            <div className="mt-8 w-full h-20 flex items-center justify-center">
                 {/* Browse Controls */}
                {mode === 'browse' && (
                    <div className="flex items-center justify-between w-full">
                        <button onClick={handlePrev} className="p-4 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors active:scale-95 shadow-sm">
                            <ChevronLeftIcon className="w-6 h-6" />
                        </button>
                        <span className="text-slate-400 font-bold text-sm uppercase tracking-widest">{currentIndex + 1} / {cards.length}</span>
                        <button onClick={handleNext} className="p-4 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors active:scale-95 shadow-sm">
                            <ChevronRightIcon className="w-6 h-6" />
                        </button>
                    </div>
                )}

                {/* Speed Mode Controls (Only show when flipped or active) */}
                {mode === 'speed' && isGameActive && (
                    <div className="flex gap-4 w-full">
                        <button 
                            onClick={() => handleSpeedAnswer(false)} 
                            disabled={!isFlipped}
                            className={`flex-1 py-4 rounded-xl font-bold flex items-center justify-center gap-2 active:translate-y-0.5 transition-all shadow-sm ${!isFlipped ? 'bg-slate-100 text-slate-400 border border-slate-200' : 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'}`}
                        >
                            <XCircleIcon className="w-6 h-6"/> Missed
                        </button>
                        <button 
                            onClick={() => handleSpeedAnswer(true)} 
                             disabled={!isFlipped}
                            className={`flex-1 py-4 rounded-xl font-bold flex items-center justify-center gap-2 active:translate-y-0.5 transition-all shadow-sm ${!isFlipped ? 'bg-slate-100 text-slate-400 border border-slate-200' : 'bg-green-50 text-green-600 border border-green-200 hover:bg-green-100'}`}
                        >
                            <CheckCircleIcon className="w-6 h-6"/> Got it
                        </button>
                    </div>
                )}

                 {/* Smart Mode Controls */}
                 {mode === 'smart' && (
                    <div className="flex gap-2 w-full">
                        <button 
                            onClick={() => handleSmartRating('hard')} 
                            disabled={!isFlipped}
                            className={`flex-1 py-3 rounded-xl font-bold active:translate-y-0.5 transition-all text-sm shadow-sm ${!isFlipped ? 'bg-slate-100 text-slate-400 border border-slate-200' : 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'}`}
                        >
                            Hard
                        </button>
                        <button 
                            onClick={() => handleSmartRating('good')} 
                            disabled={!isFlipped}
                            className={`flex-1 py-3 rounded-xl font-bold active:translate-y-0.5 transition-all text-sm shadow-sm ${!isFlipped ? 'bg-slate-100 text-slate-400 border border-slate-200' : 'bg-yellow-50 text-yellow-600 border border-yellow-200 hover:bg-yellow-100'}`}
                        >
                            Good
                        </button>
                        <button 
                            onClick={() => handleSmartRating('easy')} 
                            disabled={!isFlipped}
                            className={`flex-1 py-3 rounded-xl font-bold active:translate-y-0.5 transition-all text-sm shadow-sm ${!isFlipped ? 'bg-slate-100 text-slate-400 border border-slate-200' : 'bg-green-50 text-green-600 border border-green-200 hover:bg-green-100'}`}
                        >
                            Easy
                        </button>
                    </div>
                )}
            </div>
            
            <p className="mt-4 text-xs font-bold text-slate-400 uppercase tracking-wide">
                {isFlipped ? 'Select an option to continue' : 'Tap card to reveal answer'}
            </p>
        </div>
    );
};

export default FlashcardStudySession;