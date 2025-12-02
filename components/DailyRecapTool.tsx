
import React, { useState, useMemo, useEffect } from 'react';
import { Subject, UploadedFile, DailyRecapData, KeyConcept, Flashcard, QuizQuestion } from '../types';
import { generateDailyRecap } from '../services/geminiService';
import PodcastPlayer from './PodcastPlayer';
import { 
    SparklesIcon, ChevronDownIcon, DocumentTextIcon, XCircleIcon, ArrowPathIcon, BookOpenIcon,
    LinkIcon, LightBulbIcon, ClipboardIcon, CheckIcon, CheckCircleIcon
} from './icons/Icons';
import FlashcardStudySession from './FlashcardStudySession';


// --- Reusable Components for Results View ---

const KeyConceptItem: React.FC<{ item: KeyConcept }> = ({ item }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="border-b-2 border-slate-100 last:border-b-0">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center text-left py-4 px-4 hover:bg-slate-50"
            >
                <span className="font-bold text-slate-700">{item.concept}</span>
                <ChevronDownIcon className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="pb-4 px-4 text-slate-600 leading-relaxed">
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


    if (!flashcards || flashcards.length === 0) {
        return <p className="text-center text-slate-400">No flashcards available.</p>;
    }

    return (
        <div>
            <div className="flex justify-center border-b-2 border-slate-100 mb-4 overflow-x-auto">
                <button 
                    onClick={() => setActiveTab('qa')} 
                    className={`px-4 py-2 text-sm font-bold border-b-4 -mb-0.5 transition-colors whitespace-nowrap ${activeTab === 'qa' ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    QUESTIONS
                </button>
                <button 
                    onClick={() => setActiveTab('definition')}
                    className={`px-4 py-2 text-sm font-bold border-b-4 -mb-0.5 transition-colors whitespace-nowrap ${activeTab === 'definition' ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    DEFINITIONS
                </button>
                <button 
                    onClick={() => setActiveTab('problem')}
                    className={`px-4 py-2 text-sm font-bold border-b-4 -mb-0.5 transition-colors whitespace-nowrap ${activeTab === 'problem' ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    PROBLEMS
                </button>
                <button 
                    onClick={() => setActiveTab('long_answer')}
                    className={`px-4 py-2 text-sm font-bold border-b-4 -mb-0.5 transition-colors whitespace-nowrap ${activeTab === 'long_answer' ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    LONG ANSWERS
                </button>
            </div>
             {/* New Study Session Component */}
             <FlashcardStudySession cards={activeCards} cardType={activeTab} />
        </div>
    );
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
                <div className="flex-shrink-0 bg-white border-2 border-sky-100 text-sky-500 p-3 rounded-xl shadow-sm">
                    <LightBulbIcon className="w-6 h-6" />
                </div>
                <div>
                    <h4 className="font-bold text-lg text-slate-700">Visual Aid Idea</h4>
                    <p className="text-slate-500 mt-1 italic">"{prompt}"</p>
                </div>
                <button onClick={handleCopy} className="ml-auto flex-shrink-0 p-2 rounded-xl bg-white border-2 border-sky-100 hover:border-sky-300 text-slate-400 hover:text-sky-500 transition-colors">
                    {copied ? <CheckIcon className="w-5 h-5 text-green-500" /> : <ClipboardIcon className="w-5 h-5" />}
                </button>
            </div>
        </div>
    )
}

const MiniQuiz: React.FC<{ questions: QuizQuestion[] }> = ({ questions }) => {
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [isAnswered, setIsAnswered] = useState(false);
    const [score, setScore] = useState(0);

    const handleAnswerSelect = (option: string) => {
        if (isAnswered) return;
        setSelectedAnswer(option);
        setIsAnswered(true);
        if (option === questions[currentQuestionIndex].correctAnswer) {
            setScore(s => s + 1);
        }
    };

    const handleNextQuestion = () => {
        setIsAnswered(false);
        setSelectedAnswer(null);
        setCurrentQuestionIndex(i => i + 1);
    };

    const handleRestart = () => {
        setCurrentQuestionIndex(0);
        setSelectedAnswer(null);
        setIsAnswered(false);
        setScore(0);
    };

    if (!questions || questions.length === 0) {
        return <p className="text-slate-400 text-center font-bold">No quiz questions available.</p>;
    }
    
    const isFinished = currentQuestionIndex >= questions.length;
    
    if (isFinished) {
        return (
            <div className="text-center">
                <h4 className="text-xl font-extrabold text-slate-800">Quiz Complete!</h4>
                <p className="text-lg mt-2 text-slate-500 font-medium">Your score: <span className="font-extrabold text-sky-500">{score}</span> / {questions.length}</p>
                <button onClick={handleRestart} className="mt-4 bg-sky-100 hover:bg-sky-200 text-sky-700 font-bold py-2 px-4 rounded-xl flex items-center gap-2 mx-auto text-sm border-b-4 border-sky-200 active:border-b-0 active:translate-y-0.5">
                    <ArrowPathIcon className="w-4 h-4"/>
                    Try Again
                </button>
            </div>
        );
    }

    const currentQuestion = questions[currentQuestionIndex];

    return (
        <div>
            <p className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-2">Question {currentQuestionIndex + 1} of {questions.length}</p>
            <h4 className="font-bold text-slate-800 mb-4 text-lg">{currentQuestion.question}</h4>
            <div className="space-y-3">
                {currentQuestion.options.map((option, index) => {
                    const isCorrect = option === currentQuestion.correctAnswer;
                    const isSelected = option === selectedAnswer;
                    let optionClass = "bg-white border-slate-200 hover:bg-slate-50 text-slate-600";
                    if(isAnswered && isCorrect) optionClass = "bg-green-100 border-green-500 text-green-800";
                    if(isAnswered && isSelected && !isCorrect) optionClass = "bg-red-100 border-red-500 text-red-800";
                    
                    return (
                        <button key={index} onClick={() => handleAnswerSelect(option)} disabled={isAnswered}
                            className={`w-full text-left p-3 text-sm font-bold rounded-xl border-2 transition-all duration-200 ${optionClass}`}>
                            {option}
                        </button>
                    )
                })}
            </div>
            {isAnswered && (
                 <div className="mt-4 text-sm">
                    <div className={`p-4 rounded-xl border-2 ${selectedAnswer === currentQuestion.correctAnswer ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                        <div className="flex items-center gap-2">
                             {selectedAnswer === currentQuestion.correctAnswer ? <CheckCircleIcon className="w-5 h-5 text-green-500"/> : <XCircleIcon className="w-5 h-5 text-red-500"/>}
                            <h5 className={`font-extrabold ${selectedAnswer === currentQuestion.correctAnswer ? 'text-green-700' : 'text-red-700'}`}>{selectedAnswer === currentQuestion.correctAnswer ? 'Correct!' : 'Incorrect'}</h5>
                        </div>
                         <p className="mt-2 text-slate-600 font-medium">{currentQuestion.explanation}</p>
                    </div>
                    <button onClick={handleNextQuestion} className="w-full mt-3 bg-sky-500 text-white font-bold py-3 px-4 rounded-xl hover:bg-sky-400 border-b-4 border-sky-700 active:border-b-0 active:translate-y-0.5">Next Question</button>
                </div>
            )}
        </div>
    );
};

const DailyRecapResults: React.FC<{ data: DailyRecapData; onReset: () => void; }> = ({ data, onReset }) => {
    const podcastText = `Here is your summary. ${data.summary}. Now, here are some connections I found. ${data.connections}`;
    return (
        <div>
            <button onClick={onReset} className="mb-6 bg-white border-2 border-slate-200 hover:bg-slate-50 text-slate-500 font-bold py-2 px-4 rounded-xl flex items-center gap-2 transition-colors">
                <ArrowPathIcon className="w-5 h-5" />
                Create a New Recap
            </button>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <div className="bg-white border-2 border-slate-200 rounded-3xl p-8 shadow-sm">
                        <h3 className="text-2xl font-extrabold mb-4 text-slate-800">Daily Summary</h3>
                        <p className="text-slate-600 leading-relaxed text-lg">{data.summary}</p>
                    </div>
                    <div className="bg-white border-2 border-slate-200 rounded-3xl p-8 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <LinkIcon className="w-7 h-7 text-sky-500" />
                            <h3 className="text-2xl font-extrabold text-slate-800">AI-Spotted Connections</h3>
                        </div>
                        <p className="text-slate-600 leading-relaxed text-lg">{data.connections}</p>
                    </div>
                    <div>
                        <h3 className="text-2xl font-extrabold mb-4 text-slate-800 px-2">Key Concepts</h3>
                        <div className="bg-white rounded-3xl border-2 border-slate-200 shadow-sm overflow-hidden">
                           {data.keyConcepts.map((item, index) => <KeyConceptItem key={index} item={item} />)}
                        </div>
                    </div>
                </div>
                <div className="lg:col-span-1 space-y-8">
                    <div className="bg-white border-2 border-slate-200 rounded-3xl p-4 shadow-sm">
                        <PodcastPlayer textToSpeak={podcastText} />
                    </div>
                    <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm">
                        <h3 className="text-xl font-extrabold mb-6 text-center text-slate-800">Test Your Knowledge</h3>
                        <MiniQuiz questions={data.quiz} />
                    </div>
                    <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm">
                        <h3 className="text-xl font-extrabold mb-6 text-center text-slate-800">Quick Flashcards</h3>
                        <FlashcardViewer flashcards={data.flashcards} />
                    </div>
                </div>
            </div>
            <div className="mt-8">
                <VisualAidPrompt prompt={data.visualAidPrompt} />
            </div>
        </div>
    );
};


// --- Main Tool Components ---

const SubjectAccordion: React.FC<{ subject: Subject; onFileToggle: (file: UploadedFile, isSelected: boolean) => void; selectedFiles: UploadedFile[] }> = ({ subject, onFileToggle, selectedFiles }) => {
    const [isOpen, setIsOpen] = useState(true);

    return (
        <div className="bg-white rounded-2xl border-2 border-slate-200 overflow-hidden">
            <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                <h3 className="font-extrabold text-lg text-slate-700">{subject.name}</h3>
                <ChevronDownIcon className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="p-4 border-t-2 border-slate-100 space-y-3 bg-slate-50/50">
                    {subject.files.map(file => (
                        <label key={file.name + subject.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white hover:shadow-sm cursor-pointer transition-all border-2 border-transparent hover:border-slate-200">
                            <input
                                type="checkbox"
                                className="h-5 w-5 rounded-md border-2 border-slate-300 text-sky-500 focus:ring-sky-200"
                                checked={selectedFiles.some(f => f.name === file.name && f.base64 === file.base64)}
                                onChange={(e) => onFileToggle(file, e.target.checked)}
                            />
                            <div className="bg-sky-100 p-1.5 rounded-lg">
                                <DocumentTextIcon className="w-5 h-5 text-sky-600" />
                            </div>
                            <span className="truncate font-bold text-slate-600 text-sm">{file.name}</span>
                        </label>
                    ))}
                </div>
            )}
        </div>
    )
}

interface DailyRecapToolProps {
    subjects: Subject[];
}

const DailyRecapTool: React.FC<DailyRecapToolProps> = ({ subjects }) => {
    const [selectedFiles, setSelectedFiles] = useState<UploadedFile[]>([]);
    const [topics, setTopics] = useState('');
    const [recap, setRecap] = useState<DailyRecapData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFileToggle = (file: UploadedFile, isSelected: boolean) => {
        setSelectedFiles(prev => {
            const isAlreadySelected = prev.some(f => f.name === file.name && f.base64 === file.base64);
            if (isSelected && !isAlreadySelected) return [...prev, file];
            if (!isSelected && isAlreadySelected) return prev.filter(f => !(f.name === file.name && f.base64 === file.base64));
            return prev;
        });
    };

    const handleGenerate = async () => {
        if (selectedFiles.length === 0 || !topics.trim()) {
            setError("Please select at least one resource and specify the topics for your recap.");
            return;
        }
        
        setError(null);
        setIsLoading(true);
        setRecap(null);

        try {
            const result = await generateDailyRecap(selectedFiles, topics);
            setRecap(result);
        } catch (e) {
            console.error(e);
            setError("Sorry, an unexpected error occurred while generating the recap.");
        } finally {
            setIsLoading(false);
        }
    };

    const canGenerate = useMemo(() => {
        return selectedFiles.length > 0 && topics.trim().length > 0 && !isLoading;
    }, [selectedFiles.length, topics, isLoading]);

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto pr-2 -mr-4">
                {/* Configuration View */}
                {!recap && !isLoading && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <h3 className="text-xl font-extrabold text-slate-800">1. Select Resources</h3>
                            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 -mr-2">
                                {subjects.length > 0 ? (
                                    subjects.map(subject => (
                                        <SubjectAccordion 
                                            key={subject.id} 
                                            subject={subject} 
                                            onFileToggle={handleFileToggle}
                                            selectedFiles={selectedFiles}
                                        />
                                    ))
                                ) : (
                                    <div className="text-center p-8 bg-slate-50 rounded-3xl border-2 border-slate-200 flex flex-col items-center border-dashed">
                                        <BookOpenIcon className="w-12 h-12 text-slate-300 mb-4"/>
                                        <p className="font-bold text-slate-500">No subjects found.</p>
                                        <p className="text-slate-400 text-sm mt-1 font-medium">Please add a subject from the sidebar to use this tool.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-xl font-extrabold text-slate-800">2. Specify Topics</h3>
                            <textarea
                                value={topics}
                                onChange={e => setTopics(e.target.value)}
                                placeholder="e.g., Photosynthesis, The Cold War, Python Data Structures"
                                className="w-full h-40 bg-white border-2 border-slate-200 rounded-2xl p-4 text-slate-800 placeholder-slate-400 font-medium focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all resize-none"
                            />
                             {error && <p className="text-red-500 text-sm flex items-center gap-1 font-bold"><XCircleIcon className="w-4 h-4"/>{error}</p>}
                            <button
                                onClick={handleGenerate}
                                disabled={!canGenerate}
                                className="w-full bg-sky-500 text-white font-bold py-4 px-6 rounded-2xl hover:bg-sky-400 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 border-b-4 border-sky-700 active:border-b-0 active:translate-y-1"
                            >
                                <SparklesIcon className="w-5 h-5"/>
                                Generate Recap
                            </button>
                        </div>
                    </div>
                )}

                {isLoading && (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <SparklesIcon className="w-16 h-16 text-sky-500 animate-pulse mb-4" />
                        <h3 className="text-xl font-bold text-slate-800">Generating your daily recap...</h3>
                        <p className="text-slate-400 max-w-md font-medium">Our AI is analyzing your selected documents and topics. This might take a moment.</p>
                    </div>
                )}
                
                {recap && !isLoading && (
                    <DailyRecapResults data={recap} onReset={() => { setRecap(null); setError(null); }} />
                )}
            </div>
        </div>
    );
};

export default DailyRecapTool;
