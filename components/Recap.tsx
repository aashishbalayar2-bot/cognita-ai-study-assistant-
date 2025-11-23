
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { UploadedFile, RecapData, KeyConcept, Flashcard } from '../types';
import { generateRecap, generateMoreFlashcards } from '../services/geminiService';
import { 
    SparklesIcon, XCircleIcon, ArrowPathIcon, ChevronDownIcon, 
    ChevronLeftIcon, ChevronRightIcon, LightBulbIcon, ClipboardIcon, CheckIcon 
} from './icons/Icons';
import { saveToStorage, loadFromStorage } from '../utils/storageUtils';

const KeyConceptItem: React.FC<{ item: KeyConcept }> = ({ item }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="border-b-2 border-slate-100 last:border-b-0">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center text-left py-4 px-4 hover:bg-slate-50 transition-colors"
            >
                <span className="font-bold text-slate-700 text-lg">{item.concept}</span>
                <ChevronDownIcon className={`w-6 h-6 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="pb-6 px-4 text-slate-600 leading-relaxed">
                    <p>{item.explanation}</p>
                </div>
            )}
        </div>
    );
};

const CardFlipper: React.FC<{ cards: Flashcard[]; cardType: 'qa' | 'definition' }> = ({ cards, cardType }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);

    useEffect(() => {
        setCurrentIndex(0);
        setIsFlipped(false);
    }, [cards]);

    const handleNext = () => {
        setIsFlipped(false);
        setTimeout(() => setCurrentIndex((prev) => (prev + 1) % cards.length), 150);
    };

    const handlePrev = () => {
        setIsFlipped(false);
        setTimeout(() => setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length), 150);
    };

    if (!cards || cards.length === 0) {
        return <p className="text-slate-400 text-center h-64 flex items-center justify-center font-medium">No {cardType === 'qa' ? 'questions' : 'definitions'} available.</p>;
    }

    const currentCard = cards[currentIndex];
    if (!currentCard) return null;

    return (
        <div className="flex flex-col items-center">
            <div className="w-full max-w-lg h-72 perspective-1000">
                <div 
                    className={`relative w-full h-full transform-style-preserve-3d transition-transform duration-500 ${isFlipped ? 'rotate-y-180' : ''}`}
                    onClick={() => setIsFlipped(!isFlipped)}
                >
                    {/* Front of card */}
                    <div className="absolute w-full h-full backface-hidden bg-white border-2 border-slate-200 rounded-3xl p-8 flex flex-col justify-center items-center text-center cursor-pointer shadow-sm hover:border-sky-300 transition-colors">
                        <p className="text-xs font-extrabold text-sky-500 uppercase tracking-widest mb-4">{cardType === 'qa' ? 'Question' : 'Term'}</p>
                        <p className="text-2xl font-bold text-slate-800">{currentCard.front}</p>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wide mt-auto pt-4">Tap to flip</p>
                    </div>
                    {/* Back of card */}
                    <div className="absolute w-full h-full backface-hidden bg-sky-50 border-2 border-sky-200 rounded-3xl p-8 flex flex-col justify-center items-center text-center cursor-pointer rotate-y-180 shadow-sm">
                         <p className="text-xs font-extrabold text-sky-500 uppercase tracking-widest mb-4">{cardType === 'qa' ? 'Answer' : 'Definition'}</p>
                        <p className="text-xl font-medium text-slate-700">{currentCard.back}</p>
                        <p className="text-xs text-sky-400 font-bold uppercase tracking-wide mt-auto pt-4">Tap to flip back</p>
                    </div>
                </div>
            </div>
            <div className="mt-8 flex items-center justify-between w-full max-w-lg">
                <button onClick={handlePrev} className="p-3 rounded-2xl bg-white border-2 border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors active:translate-y-0.5">
                    <ChevronLeftIcon className="w-6 h-6" />
                </button>
                <span className="text-slate-400 font-bold text-sm uppercase tracking-widest">{currentIndex + 1} / {cards.length}</span>
                <button onClick={handleNext} className="p-3 rounded-2xl bg-white border-2 border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors active:translate-y-0.5">
                    <ChevronRightIcon className="w-6 h-6" />
                </button>
            </div>
        </div>
    );
};


const FlashcardViewer: React.FC<{ flashcards: Flashcard[] }> = ({ flashcards }) => {
    const [activeTab, setActiveTab] = useState<'qa' | 'definition'>('qa');

    const qaCards = useMemo(() => flashcards.filter(f => f.type === 'qa'), [flashcards]);
    const definitionCards = useMemo(() => flashcards.filter(f => f.type === 'definition'), [flashcards]);

    const activeCards = activeTab === 'qa' ? qaCards : definitionCards;
    
    useEffect(() => {
        if (activeCards.length === 0) {
            if (activeTab === 'qa' && definitionCards.length > 0) {
                setActiveTab('definition');
            } else if (activeTab === 'definition' && qaCards.length > 0) {
                setActiveTab('qa');
            }
        }
    }, [qaCards, definitionCards, activeTab, activeCards.length]);

    return (
        <div>
            <div className="flex justify-center mb-8 gap-4">
                <button 
                    onClick={() => setActiveTab('qa')} 
                    className={`px-6 py-2.5 font-bold rounded-xl border-2 border-b-4 active:border-b-2 active:translate-y-0.5 transition-all ${activeTab === 'qa' ? 'bg-sky-500 border-sky-700 text-white' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                >
                    QUESTIONS
                </button>
                <button 
                    onClick={() => setActiveTab('definition')}
                    className={`px-6 py-2.5 font-bold rounded-xl border-2 border-b-4 active:border-b-2 active:translate-y-0.5 transition-all ${activeTab === 'definition' ? 'bg-sky-500 border-sky-700 text-white' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                >
                    DEFINITIONS
                </button>
            </div>
            <CardFlipper cards={activeCards} cardType={activeTab} />
        </div>
    )
};

const VisualAidPrompt: React.FC<{ prompt: string }> = ({ prompt }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(prompt);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="bg-sky-50 border-2 border-sky-100 rounded-2xl p-6">
            <div className="flex items-start gap-4">
                <div className="flex-shrink-0 bg-white p-3 rounded-xl border-2 border-sky-100 text-sky-500 shadow-sm">
                    <LightBulbIcon className="w-6 h-6" />
                </div>
                <div>
                    <h4 className="font-bold text-lg text-slate-700">Visual Aid Idea</h4>
                    <p className="text-slate-500 mt-2 italic leading-relaxed">"{prompt}"</p>
                </div>
                <button onClick={handleCopy} className="ml-auto flex-shrink-0 p-2 rounded-xl bg-white border-2 border-sky-100 text-slate-400 hover:text-sky-500 hover:border-sky-300 transition-all">
                    {copied ? <CheckIcon className="w-5 h-5 text-green-500" /> : <ClipboardIcon className="w-5 h-5" />}
                </button>
            </div>
        </div>
    )
}

const Recap: React.FC<{ files: UploadedFile[]; subjectId: string }> = ({ files, subjectId }) => {
    const [recapData, setRecapData] = useState<RecapData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isGeneratingMore, setIsGeneratingMore] = useState(false);
    const [isCached, setIsCached] = useState(false);


    const fetchRecap = useCallback(async (forceRefresh = false) => {
        setIsLoading(true);
        setError(null);
        setRecapData(null);

        if (!forceRefresh) {
            const cachedRecap = loadFromStorage<RecapData>(subjectId, 'recap');
            if (cachedRecap) {
                setRecapData(cachedRecap);
                setIsCached(true);
                setIsLoading(false);
                return;
            }
        }

        setIsCached(false);
        try {
            const data = await generateRecap(files);
            setRecapData(data);
            saveToStorage(subjectId, 'recap', data);
        } catch (err) {
            console.error(err);
            setError('An error occurred while generating the recap.');
        } finally {
            setIsLoading(false);
        }
    }, [files, subjectId]);

    useEffect(() => {
        fetchRecap();
    }, [fetchRecap]);

    const handleGenerateMore = async () => {
        if (!recapData) return;
        setIsGeneratingMore(true);
        try {
            const newFlashcards = await generateMoreFlashcards(files, recapData.flashcards);
            if (newFlashcards.length > 0) {
                setRecapData(prevData => {
                    if (!prevData) return null;
                    const existingFronts = new Set(prevData.flashcards.map(f => f.front));
                    const uniqueNewFlashcards = newFlashcards.filter(f => !existingFronts.has(f.front));
                    
                    const updatedData = {
                        ...prevData,
                        flashcards: [...prevData.flashcards, ...uniqueNewFlashcards]
                    };
                    saveToStorage(subjectId, 'recap', updatedData);
                    return updatedData;
                });
            }
        } catch (err) {
            console.error("Failed to generate more flashcards", err);
        } finally {
            setIsGeneratingMore(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center">
                <SparklesIcon className="w-16 h-16 text-sky-500 animate-pulse mb-4" />
                <h3 className="text-xl font-bold text-slate-800">Generating your recap...</h3>
                <p className="text-slate-400 font-medium">Please wait while our AI builds a summary of your document.</p>
            </div>
        );
    }

    if (error || !recapData) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center text-red-500">
                <XCircleIcon className="w-16 h-16 mb-4" />
                <h3 className="text-xl font-bold">{error || 'Could not load recap data.'}</h3>
                <button onClick={() => fetchRecap(true)} className="mt-6 bg-sky-500 hover:bg-sky-400 text-white font-bold py-3 px-6 rounded-2xl flex items-center gap-2 border-b-4 border-sky-700 active:border-b-0 active:translate-y-1">
                    <ArrowPathIcon className="w-5 h-5" />
                    Try Again
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-12 relative">
            {isCached && (
                <div className="absolute -top-6 right-0">
                     <span className="text-xs font-bold text-slate-400 bg-white border border-slate-200 px-3 py-1 rounded-full uppercase tracking-wide">Offline Cache</span>
                </div>
            )}
            {/* Summary Section */}
            <div>
                <div className="flex items-center justify-between mb-6">
                     <h2 className="text-2xl font-extrabold text-slate-800">Overall Summary</h2>
                     <button onClick={() => fetchRecap(true)} className="text-slate-400 hover:text-sky-500 text-xs font-bold uppercase tracking-wide flex items-center gap-1 transition-colors">
                         <ArrowPathIcon className="w-4 h-4"/> Regenerate
                     </button>
                </div>
               
                <p className="text-lg text-slate-600 leading-relaxed bg-white p-6 rounded-3xl border-2 border-slate-200 shadow-sm">{recapData.summary}</p>
            </div>

            {/* Key Concepts Section */}
            <div>
                <h2 className="text-2xl font-extrabold mb-6 text-slate-800">Key Concepts</h2>
                <div className="bg-white rounded-3xl border-2 border-slate-200 shadow-sm overflow-hidden">
                    {recapData.keyConcepts.map((item, index) => (
                        <KeyConceptItem key={index} item={item} />
                    ))}
                </div>
            </div>

            {/* Flashcards Section */}
            <div>
                <h2 className="text-2xl font-extrabold mb-8 text-center text-slate-800">Test Your Knowledge</h2>
                <FlashcardViewer flashcards={recapData.flashcards} />
                <div className="text-center mt-8">
                    <button 
                        onClick={handleGenerateMore} 
                        disabled={isGeneratingMore}
                        className="bg-white border-2 border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 font-bold py-3 px-6 rounded-2xl flex items-center gap-2 mx-auto transition-all border-b-4 active:border-b-2 active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ArrowPathIcon className={`w-5 h-5 ${isGeneratingMore ? 'animate-spin' : ''}`} />
                        {isGeneratingMore ? 'GENERATING...' : 'GENERATE 5 MORE'}
                    </button>
                </div>
            </div>
            
            {/* Visual Aid Prompt */}
            <div>
                <VisualAidPrompt prompt={recapData.visualAidPrompt} />
            </div>
        </div>
    );
};

export default Recap;
