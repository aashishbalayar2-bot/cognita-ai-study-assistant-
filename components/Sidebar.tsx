
import React from 'react';
import { Subject } from '../types';
import { 
    BookOpenIcon, PlusIcon, VideoCameraIcon, CalendarDaysIcon, 
    XMarkIcon, BoltIcon, UserGroupIcon 
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
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  subjects, activeSubjectId, onSelectSubject, onAddSubject, 
  onSelectLiveTutor, isLiveTutorActive, onSelectDailyRecap, 
  isDailyRecapActive, onSelectQuickStudy, isQuickStudyActive,
  onSelectTeachAI, isTeachAIActive, isOpen, onClose 
}) => {
  const handleAddSubjectClick = () => {
    onAddSubject();
    onClose();
  };

  return (
    <>
      {/* Overlay for mobile */}
      <div 
        className={`fixed inset-0 bg-slate-900/20 z-40 md:hidden transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      ></div>
      
      {/* Sidebar */}
      <aside className={`w-80 h-screen p-6 flex-col bg-white border-r-2 border-slate-200 
        md:flex md:static md:translate-x-0 
        fixed top-0 left-0 z-50 transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center justify-between mb-8 flex-shrink-0">
          <div className="">
            <h1 className="text-3xl font-extrabold text-blue-600 tracking-tight">
              Cognita
            </h1>
          </div>
          <button onClick={onClose} className="md:hidden text-slate-400 hover:text-slate-600 p-2">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        
        <div className="flex-1 flex flex-col min-h-0">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2 mb-4">Subjects</h2>
          <ul className="space-y-2 overflow-y-auto pr-2 -mr-2 flex-1">
            {subjects.map(subject => (
              <li key={subject.id}>
                <button
                  onClick={() => onSelectSubject(subject.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all duration-200 border-2 ${
                    activeSubjectId === subject.id && !isLiveTutorActive && !isDailyRecapActive && !isQuickStudyActive && !isTeachAIActive
                        ? 'bg-blue-100 border-blue-200 text-blue-700' 
                        : 'bg-transparent border-transparent text-slate-600 hover:bg-slate-50 hover:border-slate-200'
                  }`}
                >
                  <div className="flex-shrink-0">
                      <BookOpenIcon className={`w-5 h-5 ${activeSubjectId === subject.id && !isLiveTutorActive && !isDailyRecapActive && !isQuickStudyActive && !isTeachAIActive ? 'text-blue-500' : 'text-slate-400'}`}/>
                  </div>
                  <div className="flex-1 truncate">
                      <p className="font-bold text-sm">{subject.name}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
           <button onClick={handleAddSubjectClick} className="w-full mt-6 flex items-center justify-center gap-2 p-3 rounded-xl font-bold text-slate-500 border-2 border-dashed border-slate-300 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all">
              <PlusIcon className="w-5 h-5" />
              ADD SUBJECT
          </button>
        </div>
        
        <div className="mt-6 pt-6 border-t-2 border-slate-100 space-y-2">
          <button 
              onClick={onSelectLiveTutor}
              className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all duration-200 border-2 ${
                  isLiveTutorActive 
                    ? 'bg-blue-100 border-blue-200 text-blue-700' 
                    : 'bg-transparent border-transparent text-slate-600 hover:bg-slate-50 hover:border-slate-200'
              }`}
          >
              <div className="flex-shrink-0">
                  <VideoCameraIcon className={`w-5 h-5 ${isLiveTutorActive ? 'text-blue-500' : 'text-slate-400'}`}/>
              </div>
              <div>
                  <p className="font-bold text-sm">Live Visual Tutor</p>
              </div>
          </button>
          
           <button 
              onClick={onSelectTeachAI}
              className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all duration-200 border-2 ${
                  isTeachAIActive 
                    ? 'bg-blue-100 border-blue-200 text-blue-700' 
                    : 'bg-transparent border-transparent text-slate-600 hover:bg-slate-50 hover:border-slate-200'
              }`}
          >
              <div className="flex-shrink-0">
                  <UserGroupIcon className={`w-5 h-5 ${isTeachAIActive ? 'text-blue-500' : 'text-slate-400'}`}/>
              </div>
              <div>
                  <p className="font-bold text-sm">Teach the AI</p>
              </div>
          </button>

          <button 
              onClick={onSelectDailyRecap}
              className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all duration-200 border-2 ${
                  isDailyRecapActive 
                    ? 'bg-blue-100 border-blue-200 text-blue-700' 
                    : 'bg-transparent border-transparent text-slate-600 hover:bg-slate-50 hover:border-slate-200'
              }`}
          >
              <div className="flex-shrink-0">
                  <CalendarDaysIcon className={`w-5 h-5 ${isDailyRecapActive ? 'text-blue-500' : 'text-slate-400'}`}/>
              </div>
              <div>
                  <p className="font-bold text-sm">Daily Recap</p>
              </div>
          </button>

          <button 
              onClick={onSelectQuickStudy}
              className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all duration-200 border-2 ${
                  isQuickStudyActive 
                    ? 'bg-blue-100 border-blue-200 text-blue-700' 
                    : 'bg-transparent border-transparent text-slate-600 hover:bg-slate-50 hover:border-slate-200'
              }`}
          >
              <div className="flex-shrink-0">
                  <BoltIcon className={`w-5 h-5 ${isQuickStudyActive ? 'text-blue-500' : 'text-slate-400'}`}/>
              </div>
              <div>
                  <p className="font-bold text-sm">Quick Study</p>
              </div>
          </button>
        </div>

        <div className="mt-6 pt-6 border-t-2 border-slate-100 flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-xl bg-blue-100 border-2 border-blue-200 flex items-center justify-center text-blue-600 font-bold">
                TU
            </div>
            <div className="flex-1">
                <p className="text-sm font-bold text-slate-700">Test User</p>
                <p className="text-xs text-slate-400 font-bold">PRO ACCOUNT</p>
            </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
