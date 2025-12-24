
import React, { useState, useEffect, useMemo } from 'react';
import { UploadedFile, StudyPlan, StudyTask } from '../types';
import { generateStudyPlan, generateConceptExplanation } from '../services/geminiService';
import { saveToStorage, loadFromStorage } from '../utils/storageUtils';
import { LectureSession } from './LiveLecture';
import { 
    CalendarDaysIcon, SparklesIcon, CheckCircleIcon, ArrowPathIcon, 
    FireIcon, ClockIcon, TrashIcon, QuestionMarkCircleIcon, PlayIcon
} from './icons/Icons';

interface StudyPlannerProps {
    files: UploadedFile[];
    subjectId: string;
}

const StudyPlanner: React.FC<StudyPlannerProps> = ({ files, subjectId }) => {
    const [plan, setPlan] = useState<StudyPlan | null>(null);
    const [goalInput, setGoalInput] = useState('');
    const [daysInput, setDaysInput] = useState(7);
    const [isGenerating, setIsGenerating] = useState(false);
    
    // Live Lecture State
    const [activeLectureTask, setActiveLectureTask] = useState<StudyTask | null>(null);
    const [lectureContent, setLectureContent] = useState<string>('');
    const [isLoadingLecture, setIsLoadingLecture] = useState(false);

    // Load existing plan
    useEffect(() => {
        const savedPlan = loadFromStorage<StudyPlan>(subjectId, 'study_plan');
        if (savedPlan) {
            setPlan(savedPlan);
        }
    }, [subjectId]);

    // Save plan on updates (including null for deletion)
    useEffect(() => {
        if (plan !== undefined) {
            saveToStorage(subjectId, 'study_plan', plan);
        }
    }, [plan, subjectId]);

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!goalInput.trim()) return;

        setIsGenerating(true);
        try {
            const newPlan = await generateStudyPlan(files, goalInput, daysInput);
            setPlan(newPlan);
        } catch (error) {
            console.error("Failed to generate plan", error);
        } finally {
            setIsGenerating(false);
        }
    };

    const toggleTask = (taskId: string) => {
        if (!plan) return;
        setPlan(prev => {
            if (!prev) return null;
            const newTasks = (prev.tasks || []).map(t => 
                t.id === taskId ? { ...t, completed: !t.completed } : t
            );
            return { ...prev, tasks: newTasks };
        });
    };

    const handleDeletePlan = () => {
        if (window.confirm("Are you sure you want to delete this study plan?")) {
            setPlan(null);
        }
    };

    const handleStartLecture = async (task: StudyTask, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent toggling task completion
        setIsLoadingLecture(true);
        try {
            const summary = await generateConceptExplanation(files, task.topic);
            setLectureContent(summary);
            setActiveLectureTask(task);
        } catch (err) {
            console.error("Failed to prepare lecture", err);
            alert("Could not start lecture. Please try again.");
        } finally {
            setIsLoadingLecture(false);
        }
    };

    const handleCloseLecture = () => {
        setActiveLectureTask(null);
        setLectureContent('');
    };

    // Derived stats
    const stats = useMemo(() => {
        if (!plan) return { completed: 0, total: 0, percent: 0 };
        const tasks = plan.tasks || [];
        const completed = tasks.filter(t => t.completed).length;
        const total = tasks.length;
        return {
            completed,
            total,
            percent: total > 0 ? Math.round((completed / total) * 100) : 0
        };
    }, [plan]);

    // Group tasks by day
    const tasksByDay = useMemo(() => {
        if (!plan) return {} as Record<string, StudyTask[]>;
        const groups: Record<string, StudyTask[]> = {};
        const tasks = plan.tasks || [];
        tasks.forEach(task => {
            const dayKey = String(task.day);
            if (!groups[dayKey]) groups[dayKey] = [];
            groups[dayKey].push(task);
        });
        return groups;
    }, [plan]);

    const sortedDays = useMemo(() => {
        return Object.keys(tasksByDay).sort((a, b) => Number(a) - Number(b));
    }, [tasksByDay]);

    if (isGenerating) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="bg-blue-50 p-4 rounded-full mb-4 animate-bounce">
                    <CalendarDaysIcon className="w-12 h-12 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-800">Building your schedule...</h3>
                <p className="text-slate-500 font-medium mt-2 max-w-md">
                    Professor Zero is analyzing your documents to create a perfect {daysInput}-day roadmap.
                </p>
            </div>
        );
    }

    if (!plan) {
        return (
            <div className="max-w-xl mx-auto py-8">
                <div className="text-center mb-8">
                    <h2 className="text-3xl font-extrabold text-slate-800 mb-2">Create a Study Plan</h2>
                    <p className="text-slate-500 font-medium">
                        Tell us your goal and timeline. AI will organize your study materials into a clear, actionable schedule.
                    </p>
                </div>

                <form onSubmit={handleGenerate} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">What is your goal?</label>
                        <input 
                            type="text" 
                            value={goalInput}
                            onChange={(e) => setGoalInput(e.target.value)}
                            placeholder="e.g. Pass the final exam with an A, Master Chapter 4"
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg py-3 px-4 font-bold text-slate-700 focus:outline-none focus:border-blue-500 transition-colors placeholder-slate-400"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Duration (Days)</label>
                        <div className="flex items-center gap-4">
                            <input 
                                type="range" 
                                min="1" 
                                max="30" 
                                value={daysInput}
                                onChange={(e) => setDaysInput(parseInt(e.target.value))}
                                className="flex-1 accent-blue-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                            />
                            <span className="bg-blue-50 text-blue-600 font-bold px-4 py-2 rounded-lg min-w-[3rem] text-center border border-blue-100">
                                {daysInput}
                            </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-2 font-medium">Recommended: 1 day per major chapter or 5-7 days for exam prep.</p>
                    </div>

                    <button 
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-md transition-all active:translate-y-0.5 flex items-center justify-center gap-2"
                    >
                        <SparklesIcon className="w-5 h-5" />
                        Generate Plan
                    </button>
                </form>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col relative">
            {/* Loading Overlay for Lecture Start */}
            {isLoadingLecture && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
                    <SparklesIcon className="w-12 h-12 text-blue-600 animate-pulse mb-4" />
                    <h3 className="text-xl font-bold text-slate-800">Preparing Lecture...</h3>
                </div>
            )}

            {/* Live Lecture Modal */}
            {activeLectureTask && (
                <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-sm p-4 flex items-center justify-center animate-in fade-in duration-200">
                    <div className="w-full max-w-4xl h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl relative">
                        <LectureSession 
                            conceptName={activeLectureTask.topic}
                            conceptText={lectureContent}
                            languageStyle="English"
                            onClose={handleCloseLecture}
                        />
                    </div>
                </div>
            )}

            {/* Header / Progress */}
            <div className="flex-shrink-0 bg-white border border-slate-200 rounded-xl p-6 mb-6 shadow-sm">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h2 className="text-xl font-extrabold text-slate-800">{plan.goal}</h2>
                        <p className="text-slate-500 font-medium text-sm flex items-center gap-2 mt-1">
                            <ClockIcon className="w-4 h-4" /> {plan.durationDays} Day Plan
                        </p>
                    </div>
                    <button 
                        onClick={handleDeletePlan}
                        className="text-slate-400 hover:text-red-500 p-2 transition-colors rounded-lg hover:bg-slate-50"
                        title="Delete Plan"
                    >
                        <TrashIcon className="w-5 h-5" />
                    </button>
                </div>

                <div className="relative pt-1">
                    <div className="flex mb-2 items-center justify-between">
                        <div>
                            <span className="text-xs font-bold inline-block py-1 px-2 rounded-full text-blue-600 bg-blue-100 uppercase tracking-wide">
                                Progress
                            </span>
                        </div>
                        <div className="text-right">
                            <span className="text-sm font-bold inline-block text-blue-600">
                                {stats.percent}%
                            </span>
                        </div>
                    </div>
                    <div className="overflow-hidden h-3 mb-4 text-xs flex rounded-full bg-slate-100">
                        <div 
                            style={{ width: `${stats.percent}%` }} 
                            className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-600 transition-all duration-500"
                        />
                    </div>
                    {stats.percent === 100 && (
                        <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm font-bold flex items-center gap-2 animate-in slide-in-from-top-2">
                            <FireIcon className="w-5 h-5" />
                            Congratulations! You've completed your study plan.
                        </div>
                    )}
                </div>
            </div>

            {/* Timeline */}
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-8 pb-10">
                {sortedDays.map((day) => {
                    const tasks = tasksByDay[day];
                    return (
                        <div key={day} className="relative pl-8 border-l-2 border-slate-200 last:border-0 pb-2">
                            {/* Day Marker */}
                            <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-2 border-blue-500 shadow-sm" />
                            
                            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Day {day}</h4>
                            
                            <div className="space-y-4">
                                {tasks.map(task => (
                                    <div 
                                        key={task.id}
                                        onClick={() => toggleTask(task.id)}
                                        className={`group cursor-pointer p-5 rounded-xl border transition-all duration-200 shadow-sm hover:shadow-md ${
                                            task.completed 
                                                ? 'bg-slate-50 border-slate-200' 
                                                : 'bg-white border-slate-200 hover:border-blue-300'
                                        }`}
                                    >
                                        <div className="flex items-start gap-4 mb-4">
                                            <div className={`mt-1 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                                                task.completed 
                                                    ? 'bg-blue-500 border-blue-500' 
                                                    : 'border-slate-300 group-hover:border-blue-400'
                                            }`}>
                                                {task.completed && <CheckCircleIcon className="w-4 h-4 text-white" />}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex justify-between items-start gap-2">
                                                    <h5 className={`font-bold text-lg leading-tight transition-colors ${
                                                        task.completed ? 'text-slate-500 line-through' : 'text-slate-800 group-hover:text-blue-600'
                                                    }`}>
                                                        {task.topic}
                                                    </h5>
                                                    {!task.completed && (
                                                        <button 
                                                            onClick={(e) => handleStartLecture(task, e)}
                                                            className="flex-shrink-0 bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide hover:bg-blue-200 transition-colors flex items-center gap-1.5"
                                                        >
                                                            <PlayIcon className="w-3 h-3" />
                                                            Start Lecture
                                                        </button>
                                                    )}
                                                </div>
                                                <p className={`text-sm mt-1 transition-colors ${
                                                    task.completed ? 'text-slate-400' : 'text-slate-600'
                                                }`}>
                                                    {task.activity}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Key Questions Section */}
                                        {task.importantQuestions && task.importantQuestions.length > 0 && !task.completed && (
                                            <div className="ml-10 bg-blue-50/50 rounded-lg p-3 border border-blue-100">
                                                <div className="flex items-center gap-2 mb-2 text-blue-600">
                                                    <QuestionMarkCircleIcon className="w-4 h-4" />
                                                    <span className="text-xs font-bold uppercase tracking-wide">Key Questions</span>
                                                </div>
                                                <ul className="space-y-1">
                                                    {task.importantQuestions.map((q, idx) => (
                                                        <li key={idx} className="text-sm text-slate-700 font-medium pl-2 border-l-2 border-blue-200">
                                                            {q}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default StudyPlanner;
