
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { UploadedFile, RecapData, KeyConcept, Flashcard } from '../types';
import { generateRecap, generateMoreFlashcards } from '../services/geminiService';
import { 
    SparklesIcon, XCircleIcon, ArrowPathIcon, ChevronDownIcon, 
    LightBulbIcon, ClipboardIcon, CheckIcon 
} from './icons/Icons';
import { saveToStorage, loadFromStorage } from '../utils/storageUtils';
import FlashcardStudySession from './FlashcardStudySession';

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

const FlashcardViewer: React.FC<{ flashcards: Flashcard[] }> = ({ flashcards }) => {
    const [activeTab, setActiveTab] = useState<'qa' | 'definition' | 'problem' | 'long_answer'>('qa');

    const qaCards = useMemo(() => flashcards.filter(f => f.type === 'qa'), [flashcards]);
    const definitionCards = useMemo(() => flashcards.filter(f => f.type === 'definition'), [flashcards]);
    const problemCards = useMemo(() => flashcards.filter(f => f.type === 'problem'), [flashcards]);
    const longAnswerCards = useMemo(() => flashcards.filter(f => f.type === 'long_answer'), [flashcards]);

    const activeCards = useMemo(() => {
        if (activeTab === 'qa') return qaCards;
        if (activeTab === 'definition') return definitionCards;
        if (activeTab === 'problem') return problemCards;
        return longAnswerCards;
    }, [activeTab, qaCards, definitionCards, problemCards, longAnswerCards]);
    
    // Auto-switch tabs if current is empty but others have content
    useEffect(() => {
        if (activeCards.length === 0) {
            if (activeTab === 'qa') {
                if (definitionCards.length > 0) setActiveTab('definition');
                else if (problemCards.length > 0) setActiveTab('problem');
                else if (longAnswerCards.length > 0) setActiveTab('long_answer');
            } else if (activeTab === 'definition') {
                 if (problemCards.length > 0) setActiveTab('problem');
                 else if (longAnswerCards.length > 0) setActiveTab('long_answer');
                 else if (qaCards.length > 0) setActiveTab('qa');
            } else if (activeTab === 'problem') {
                 if (longAnswerCards.length > 0) setActiveTab('long_answer');
                 else if (qaCards.length > 0) setActiveTab('qa');
                 else if (definitionCards.length > 0) setActiveTab('definition');
            } else if (activeTab === 'long_answer') {
                 if (qaCards.length > 0) setActiveTab('qa');
                 else if (definitionCards.length > 0) setActiveTab('definition');
                 else if (problemCards.length > 0) setActiveTab('problem');
            }
        }
    }, [qaCards, definitionCards, problemCards, longAnswerCards, activeTab, activeCards.length]);

    return (
        <div>
            <div className="flex justify-center mb-8 gap-2 sm:gap-4 flex-wrap">
                <button 
                    onClick={() => setActiveTab('qa')} 
                    className={`px-4 sm:px-6 py-2.5 font-bold rounded-xl border-2 border-b-4 active:border-b-2 active:translate-y-0.5 transition-all text-xs sm:text-sm ${activeTab === 'qa' ? 'bg-sky-500 border-sky-700 text-white' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                >
                    QUESTIONS
                </button>
                <button 
                    onClick={() => setActiveTab('definition')}
                    className={`px-4 sm:px-6 py-2.5 font-bold rounded-xl border-2 border-b-4 active:border-b-2 active:translate-y-0.5 transition-all text-xs sm:text-sm ${activeTab === 'definition' ? 'bg-sky-500 border-sky-700 text-white' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                >
                    DEFINITIONS
                </button>
                <button 
                    onClick={() => setActiveTab('problem')}
                    className={`px-4 sm:px-6 py-2.5 font-bold rounded-xl border-2 border-b-4 active:border-b-2 active:translate-y-0.5 transition-all text-xs sm:text-sm ${activeTab === 'problem' ? 'bg-sky-500 border-sky-700 text-white' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                >
                    PROBLEMS
                </button>
                <button 
                    onClick={() => setActiveTab('long_answer')}
                    className={`px-4 sm:px-6 py-2.5 font-bold rounded-xl border-2 border-b-4 active:border-b-2 active:translate-y-0.5 transition-all text-xs sm:text-sm ${activeTab === 'long_answer' ? 'bg-sky-500 border-sky-700 text-white' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                >
                    LONG ANSWERS
                </button>
            </div>
            
            {/* New Study Session Component */}
            <FlashcardStudySession cards={activeCards} cardType={activeTab} />
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
                <h2 className="text-2xl font-extrabold mb-8 text-center text-slate-800">Practice Mode</h2>
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
