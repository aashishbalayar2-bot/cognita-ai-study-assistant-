
import React, { useState, useEffect, useMemo } from 'react';
import { Subject, GlobalStudyPlan, SyllabusModule, UploadedFile, GlobalTask } from '../types';
import { generateGlobalStudyPlan, generateConceptExplanation } from '../services/geminiService';
import { loadFromStorage, saveToStorage } from '../utils/storageUtils';
import { fileToBase64 } from '../utils/fileUtils';
import { LectureSession } from './LiveLecture';
import { 
    CalendarDaysIcon, MapIcon, AcademicCapIcon, CheckCircleIcon, 
    SparklesIcon, ArrowPathIcon, TrashIcon, BookOpenIcon, XCircleIcon, 
    DocumentArrowUpIcon, PlayIcon, QuestionMarkCircleIcon, ClockIcon
} from './icons/Icons';

interface GlobalStudyPlannerProps {
    subjects: Subject[];
}

type WizardStep = 'context' | 'resources' | 'personalize' | 'generating' | 'view';

const GlobalStudyPlanner: React.FC<GlobalStudyPlannerProps> = ({ subjects }) => {
    const [step, setStep] = useState<WizardStep>('context');
    const [plan, setPlan] = useState<GlobalStudyPlan | null>(null);
    
    // Wizard State
    const [country, setCountry] = useState('');
    const [examBoard, setExamBoard] = useState('');
    const [selectedSubjectIds, setSelectedSubjectIds] = useState<Set<string>>(new Set());
    const [personalization, setPersonalization] = useState('');
    const [goal, setGoal] = useState('');
    const [specFile, setSpecFile] = useState<UploadedFile | null>(null);
    const [isSpecProcessing, setIsSpecProcessing] = useState(false);

    // Live Lecture State
    const [activeLectureTask, setActiveLectureTask] = useState<GlobalTask | null>(null);
    const [lectureContent, setLectureContent] = useState<string>('');
    const [isLoadingLecture, setIsLoadingLecture] = useState(false);
    
    // Loading Status Messages
    const [loadingMessageIdx, setLoadingMessageIdx] = useState(0);
    const loadingMessages = [
        "Analyzing your study materials...",
        "Processing CDC Syllabus Grids...",
        "Identifying high-yield exam topics...",
        "Mapping resources to the syllabus...",
        "Generating important practice questions...",
        "Finalizing your master schedule..."
    ];

    useEffect(() => {
        const savedPlan = loadFromStorage<GlobalStudyPlan>('user', 'global_study_plan');
        if (savedPlan && savedPlan.modules && Array.isArray(savedPlan.modules) && savedPlan.modules.length > 0) {
            setPlan(savedPlan);
            setStep('view');
        } else if (savedPlan) {
            saveToStorage('user', 'global_study_plan', null);
        }
    }, []);

    useEffect(() => {
        // Explicitly handle null to ensure persistence when deleting
        if (plan !== undefined) {
            saveToStorage('user', 'global_study_plan', plan);
        }
    }, [plan]);

    useEffect(() => {
        let interval: number;
        if (step === 'generating') {
            interval = window.setInterval(() => {
                setLoadingMessageIdx(prev => (prev + 1) % loadingMessages.length);
            }, 4000);
        }
        return () => clearInterval(interval);
    }, [step]);

    const handleSubjectToggle = (id: string) => {
        const newSet = new Set(selectedSubjectIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedSubjectIds(newSet);
    };

    const handleSpecFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setIsSpecProcessing(true);
        try {
            const base64 = await fileToBase64(file);
            setSpecFile({ name: file.name, mimeType: file.type, base64 });
        } catch (e) {
            console.error(e);
            alert("Failed to process specification file");
        } finally {
            setIsSpecProcessing(false);
        }
    };

    const handleGenerate = async () => {
        setStep('generating');
        const selectedFiles = subjects
            .filter(s => selectedSubjectIds.has(s.id))
            .flatMap(s => s.files);

        try {
            const newPlan = await generateGlobalStudyPlan(selectedFiles, country, examBoard, goal, personalization, specFile || undefined);
            if (newPlan && newPlan.modules && newPlan.modules.length > 0) {
                setPlan(newPlan);
                setStep('view');
            } else {
                throw new Error("Empty plan generated");
            }
        } catch (e) {
            console.error(e);
            alert("The AI had trouble reading your files or timed out. Please try selecting fewer files or ensuring they contain text.");
            setStep('context');
        }
    };

    const handleDeletePlan = () => {
        if (confirm("Are you sure you want to delete this master study plan?")) {
            setPlan(null);
            setStep('context');
        }
    };

    const handleStartLecture = async (task: GlobalTask, e: React.MouseEvent) => {
        e.stopPropagation();
        setIsLoadingLecture(true);
        const selectedFiles = subjects
            .filter(s => selectedSubjectIds.has(s.id))
            .flatMap(s => s.files);

        try {
            const content = await generateConceptExplanation(selectedFiles, task.topic);
            setLectureContent(content);
            setActiveLectureTask(task);
        } catch (err) {
            console.error(err);
            alert("Could not start lecture.");
        } finally {
            setIsLoadingLecture(false);
        }
    };

    const toggleTask = (moduleId: string, taskId: string) => {
        if (!plan) return;
        setPlan(prev => {
            if (!prev) return null;
            const newModules = prev.modules.map(mod => {
                if (mod.id !== moduleId) return mod;
                const newTasks = mod.tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t);
                return { ...mod, tasks: newTasks, completed: newTasks.every(t => t.completed) };
            });
            return { ...prev, modules: newModules };
        });
    };

    const progress = useMemo(() => {
        if (!plan) return { secured: 0, total: 0, percentage: 0 };
        let secured = 0;
        plan.modules.forEach(mod => {
            const completedCount = mod.tasks.filter(t => t.completed).length;
            if (mod.tasks.length > 0) {
                secured += (completedCount / mod.tasks.length) * mod.weightage;
            }
        });
        const total = plan.totalMarks || 100;
        return { secured: Math.round(secured), total, percentage: Math.round((secured / total) * 100) };
    }, [plan]);

    if (step === 'context') {
        return (
            <div className="max-w-xl mx-auto py-10 px-4 animate-in fade-in slide-in-from-bottom-4">
                <div className="text-center mb-10">
                    <div className="bg-blue-50 p-4 rounded-full inline-block mb-4 border border-blue-100">
                        <MapIcon className="w-10 h-10 text-blue-600" />
                    </div>
                    <h2 className="text-3xl font-extrabold text-slate-800">Exam Context</h2>
                    <p className="text-slate-500 mt-2">Tailor the plan to your specific syllabus grid.</p>
                </div>
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Country</label>
                            <input value={country} onChange={e => setCountry(e.target.value)} placeholder="e.g. UK" className="w-full p-4 rounded-xl border border-slate-200 bg-white font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Board</label>
                            <input value={examBoard} onChange={e => setExamBoard(e.target.value)} placeholder="e.g. AQA" className="w-full p-4 rounded-xl border border-slate-200 bg-white font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Syllabus / CDC Grid (PDF)</label>
                        {!specFile ? (
                            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 group">
                                <DocumentArrowUpIcon className="w-8 h-8 text-slate-400 mb-2 group-hover:text-blue-500" />
                                <p className="text-sm text-slate-500"><span className="font-bold">Upload</span> Spec / Grid</p>
                                <input type="file" className="hidden" onChange={handleSpecFileChange} accept="application/pdf" />
                            </label>
                        ) : (
                            <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-xl">
                                <span className="font-bold text-blue-900 truncate text-sm">{specFile.name}</span>
                                <button onClick={() => setSpecFile(null)} className="text-blue-400 hover:text-red-500"><XCircleIcon className="w-5 h-5" /></button>
                            </div>
                        )}
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Your Exam Goal</label>
                        <input value={goal} onChange={e => setGoal(e.target.value)} placeholder="e.g. Pass with Distinction" className="w-full p-4 rounded-xl border border-slate-200 bg-white font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                    </div>
                    <button disabled={!country || !examBoard || !goal || isSpecProcessing} onClick={() => setStep('resources')} className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 shadow-md">Next: Select Materials</button>
                </div>
            </div>
        );
    }

    if (step === 'resources') {
        return (
            <div className="max-w-xl mx-auto py-10 px-4 animate-in fade-in slide-in-from-right-4">
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-extrabold text-slate-800">Select Study Materials</h2>
                    <p className="text-slate-500 mt-2">The AI will strictly only use the content from these subjects.</p>
                </div>
                <div className="space-y-3 mb-8 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                    {subjects.map(sub => (
                        <div key={sub.id} onClick={() => handleSubjectToggle(sub.id)} className={`p-4 rounded-xl border cursor-pointer flex items-center justify-between transition-all ${selectedSubjectIds.has(sub.id) ? 'bg-blue-50 border-blue-500 shadow-sm' : 'bg-white border-slate-200 hover:border-blue-300'}`}>
                            <div className="flex items-center gap-3">
                                <BookOpenIcon className={`w-5 h-5 ${selectedSubjectIds.has(sub.id) ? 'text-blue-600' : 'text-slate-400'}`} />
                                <span className={`font-bold ${selectedSubjectIds.has(sub.id) ? 'text-slate-800' : 'text-slate-600'}`}>{sub.name}</span>
                            </div>
                            {selectedSubjectIds.has(sub.id) && <CheckCircleIcon className="w-6 h-6 text-blue-600" />}
                        </div>
                    ))}
                </div>
                <div className="flex gap-4">
                    <button onClick={() => setStep('context')} className="flex-1 bg-slate-100 text-slate-600 font-bold py-4 rounded-xl">Back</button>
                    <button disabled={selectedSubjectIds.size === 0} onClick={() => setStep('personalize')} className="flex-1 bg-blue-600 text-white font-bold py-4 rounded-xl shadow-md">Next Step</button>
                </div>
            </div>
        );
    }

    if (step === 'personalize') {
        return (
            <div className="max-w-xl mx-auto py-10 px-4">
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-extrabold text-slate-800">Personalization</h2>
                    <p className="text-slate-500 mt-2">Any special requests for the AI?</p>
                </div>
                <textarea value={personalization} onChange={e => setPersonalization(e.target.value)} placeholder="e.g. Focus more on practical questions..." className="w-full h-40 p-4 rounded-xl border border-slate-200 mb-8" />
                <div className="flex gap-4">
                    <button onClick={() => setStep('resources')} className="flex-1 bg-slate-100 text-slate-600 font-bold py-4 rounded-xl">Back</button>
                    <button onClick={handleGenerate} className="flex-1 bg-blue-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-md"><SparklesIcon className="w-5 h-5" /> Generate Plan</button>
                </div>
            </div>
        );
    }

    if (step === 'generating') {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <AcademicCapIcon className="w-16 h-16 text-blue-600 mb-4 animate-bounce" />
                <h2 className="text-2xl font-extrabold text-slate-800 mb-2">Analyzing Resources...</h2>
                <p className="text-slate-500 font-medium animate-pulse">{loadingMessages[loadingMessageIdx]}</p>
                <div className="mt-8 flex gap-1">
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
                </div>
            </div>
        );
    }

    if (plan) {
        return (
            <div className="h-full flex flex-col relative">
                {isLoadingLecture && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
                        <SparklesIcon className="w-12 h-12 text-blue-600 animate-pulse mb-2" />
                        <h3 className="font-bold text-slate-800">Starting Live Lecture...</h3>
                    </div>
                )}

                {activeLectureTask && (
                    <div className="fixed inset-0 z-[60] bg-slate-900/95 p-4 flex items-center justify-center">
                        <div className="w-full max-w-4xl h-[90vh]">
                            <LectureSession 
                                conceptName={activeLectureTask.topic} 
                                conceptText={lectureContent} 
                                languageStyle="Concise" 
                                onClose={() => setActiveLectureTask(null)} 
                            />
                        </div>
                    </div>
                )}

                <div className="flex-shrink-0 bg-white border-b border-slate-200 p-6 shadow-sm">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h2 className="text-2xl font-extrabold text-slate-800">{plan.goal}</h2>
                            <p className="text-slate-500 text-sm font-bold mt-1 uppercase tracking-wide">{plan.country} • {plan.examBoard}</p>
                        </div>
                        <button onClick={handleDeletePlan} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><TrashIcon className="w-5 h-5" /></button>
                    </div>

                    <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-lg">
                        <div className="flex items-end justify-between mb-4">
                            <div>
                                <p className="text-blue-300 font-bold uppercase text-[10px] tracking-widest mb-1">Marks Breakdown</p>
                                <div className="text-5xl font-black">{progress.secured} <span className="text-2xl text-slate-500">/ {progress.total}</span></div>
                            </div>
                            <div className="text-right">
                                <div className="text-3xl font-bold text-green-400">{progress.percentage}%</div>
                                <p className="text-slate-400 text-[10px] font-bold uppercase">Syllabus Coverage</p>
                            </div>
                        </div>
                        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-blue-500 to-green-400 transition-all duration-1000" style={{ width: `${progress.percentage}%` }}></div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-slate-50 space-y-6 custom-scrollbar pb-20">
                    {plan.modules.map(mod => (
                        <div key={mod.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                                <div>
                                    <h4 className="font-bold text-slate-800 text-lg">{mod.title}</h4>
                                    <span className="text-[10px] font-extrabold bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded border border-yellow-200 uppercase tracking-wide">
                                        Weightage: {mod.weightage} Marks
                                    </span>
                                </div>
                                {mod.completed && <CheckCircleIcon className="w-6 h-6 text-green-500" />}
                            </div>
                            <div className="divide-y divide-slate-100">
                                {mod.tasks.map(task => (
                                    <div key={task.id} className="p-5 flex flex-col gap-4">
                                        <div className="flex items-start gap-4">
                                            <div onClick={() => toggleTask(mod.id, task.id)} className={`mt-1 w-6 h-6 rounded-full border-2 cursor-pointer flex items-center justify-center transition-all ${task.completed ? 'bg-blue-600 border-blue-600 shadow-sm' : 'border-slate-300 hover:border-blue-400'}`}>
                                                {task.completed && <CheckCircleIcon className="w-4 h-4 text-white" />}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex justify-between items-start gap-4">
                                                    <div>
                                                        <p className={`font-bold text-lg leading-tight ${task.completed ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{task.topic}</p>
                                                        <p className="text-xs text-slate-500 mt-1">{task.description}</p>
                                                    </div>
                                                    {!task.completed && (
                                                        <button onClick={(e) => handleStartLecture(task, e)} className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 font-bold rounded-lg text-xs hover:bg-blue-200 transition-all uppercase tracking-wide shrink-0">
                                                            <PlayIcon className="w-4 h-4" /> Start Lecture
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {!task.completed && task.importantQuestions && task.importantQuestions.length > 0 && (
                                            <div className="ml-10 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                                                <div className="flex items-center gap-2 text-blue-600 mb-1">
                                                    <QuestionMarkCircleIcon className="w-4 h-4" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Important Exam Questions</span>
                                                </div>
                                                {task.importantQuestions.map((q, i) => (
                                                    <div key={i} className="bg-white p-3 rounded-lg border border-slate-100 text-sm font-medium text-slate-700 flex gap-3 group">
                                                        <span className="text-blue-500 font-bold">Q{i+1}:</span>
                                                        <span>{q}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return null;
};

export default GlobalStudyPlanner;
