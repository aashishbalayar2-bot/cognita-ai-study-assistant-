
import React from 'react';
import { Subject } from '../types';
import { 
    BookOpenIcon, PlusIcon, VideoCameraIcon, CalendarDaysIcon, 
    XMarkIcon, BoltIcon, UserGroupIcon, MapIcon
} from './icons/Icons';

interface SidebarProps {
  subjects: Subject[];
  activeSubjectId: string | null;
  onSelectSubject: (id: string) => void;
  onAddSubject: () => void;
  onSelectLiveTutor: () => void;
  isLiveTutorActive: boolean;
  onSelectDailyRecap: () => void;
  isDailyRecapActive: boolean;
  onSelectQuickStudy: () => void;
  isQuickStudyActive: boolean;
  onSelectTeachAI: () => void;
  isTeachAIActive: boolean;
  onSelectExamPlanner: () => void;
  isExamPlannerActive: boolean;
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  subjects, activeSubjectId, onSelectSubject, onAddSubject, 
  onSelectLiveTutor, isLiveTutorActive, onSelectDailyRecap, 
  isDailyRecapActive, onSelectQuickStudy, isQuickStudyActive,
  onSelectTeachAI, isTeachAIActive, onSelectExamPlanner, isExamPlannerActive,
  isOpen, onClose 
}) => {
  const handleAddSubjectClick = () => {
    onAddSubject();
    onClose();
  };

  return (
    <>
      {/* Overlay for mobile */}
      <div 
        className={`fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      ></div>
      
      {/* Sidebar */}
      <aside className={`w-72 h-screen p-4 flex-col bg-white border-r border-slate-200 
        md:flex md:static md:translate-x-0 
        fixed top-0 left-0 z-50 transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center justify-between mb-8 flex-shrink-0 px-2 mt-2">
          <div className="">
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">
              Cognita
            </h1>
          </div>
          <button onClick={onClose} className="md:hidden text-slate-400 hover:text-slate-600 p-2">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 flex flex-col min-h-0">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-4 mb-3">Subjects</h2>
          <ul className="space-y-1 overflow-y-auto px-2 flex-1 custom-scrollbar">
            {subjects.map(subject => (
              <li key={subject.id}>
                <button
                  onClick={() => onSelectSubject(subject.id)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all duration-200 ${
                    activeSubjectId === subject.id && !isLiveTutorActive && !isDailyRecapActive && !isQuickStudyActive && !isTeachAIActive && !isExamPlannerActive
                        ? 'bg-blue-50 text-blue-700 font-semibold' 
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
                  }`}
                >
                  <div className="flex-shrink-0">
                      <BookOpenIcon className={`w-4 h-4 ${activeSubjectId === subject.id && !isLiveTutorActive && !isDailyRecapActive && !isQuickStudyActive && !isTeachAIActive && !isExamPlannerActive ? 'text-blue-600' : 'text-slate-400'}`}/>
                  </div>
                  <div className="flex-1 truncate">
                      <p className="text-sm">{subject.name}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
           <button onClick={handleAddSubjectClick} className="w-full mt-4 flex items-center justify-center gap-2 p-2.5 rounded-lg font-bold text-blue-600 border border-dashed border-blue-200 hover:bg-blue-50 transition-all text-sm">
              <PlusIcon className="w-4 h-4" />
              New Subject
          </button>
        </div>
        
        <div className="mt-4 pt-4 border-t border-slate-100 space-y-1 px-2">
          
          <button 
              onClick={onSelectExamPlanner}
              className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all duration-200 ${
                  isExamPlannerActive 
                    ? 'bg-blue-50 text-blue-700 font-semibold' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
              }`}
          >
              <div className="flex-shrink-0">
                  <MapIcon className={`w-4 h-4 ${isExamPlannerActive ? 'text-blue-600' : 'text-slate-400'}`}/>
              </div>
              <div>
                  <p className="text-sm">Exam Planner</p>
              </div>
          </button>

          <button 
              onClick={onSelectLiveTutor}
              className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all duration-200 ${
                  isLiveTutorActive 
                    ? 'bg-blue-50 text-blue-700 font-semibold' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
              }`}
          >
              <div className="flex-shrink-0">
                  <VideoCameraIcon className={`w-4 h-4 ${isLiveTutorActive ? 'text-blue-600' : 'text-slate-400'}`}/>
              </div>
              <div>
                  <p className="text-sm">Live Visual Tutor</p>
              </div>
          </button>
          
           <button 
              onClick={onSelectTeachAI}
              className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all duration-200 ${
                  isTeachAIActive 
                    ? 'bg-blue-50 text-blue-700 font-semibold' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
              }`}
          >
              <div className="flex-shrink-0">
                  <UserGroupIcon className={`w-4 h-4 ${isTeachAIActive ? 'text-blue-600' : 'text-slate-400'}`}/>
              </div>
              <div>
                  <p className="text-sm">Teach the AI</p>
              </div>
          </button>

          <button 
              onClick={onSelectDailyRecap}
              className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all duration-200 ${
                  isDailyRecapActive 
                    ? 'bg-blue-50 text-blue-700 font-semibold' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
              }`}
          >
              <div className="flex-shrink-0">
                  <CalendarDaysIcon className={`w-4 h-4 ${isDailyRecapActive ? 'text-blue-600' : 'text-slate-400'}`}/>
              </div>
              <div>
                  <p className="text-sm">Daily Recap</p>
              </div>
          </button>

          <button 
              onClick={onSelectQuickStudy}
              className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all duration-200 ${
                  isQuickStudyActive 
                    ? 'bg-blue-50 text-blue-700 font-semibold' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
              }`}
          >
              <div className="flex-shrink-0">
                  <BoltIcon className={`w-4 h-4 ${isQuickStudyActive ? 'text-blue-600' : 'text-slate-400'}`}/>
              </div>
              <div>
                  <p className="text-sm">Quick Study</p>
              </div>
          </button>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-3 px-4">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                TU
            </div>
            <div className="flex-1">
                <p className="text-sm font-bold text-slate-700">Test User</p>
                <p className="text-xs text-slate-400 font-medium">Pro Account</p>
            </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
