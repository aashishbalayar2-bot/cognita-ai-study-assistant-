
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import FileUploadModal from './components/FileUploadModal';
import Chatbot from './components/Chatbot';
import Quiz from './components/Quiz';
import Notes from './components/Notes';
import LiveRevision from './components/LiveRevision';
import SubjectTabs from './components/SubjectTabs';
import { Subject, UploadedFile, SubjectTab } from './types';
import { 
    ArrowLeftIcon, SparklesIcon, Bars3Icon
} from './components/icons/Icons';
import DocumentViewer from './components/DocumentViewer';
import Recap from './components/Recap';
import LiveTutor from './components/LiveTutor';
import Resources from './components/Resources';
import DailyRecapTool from './components/DailyRecapTool';
import LiveLecture from './components/LiveLecture';
import { saveToStorage, loadFromStorage } from './utils/storageUtils';


const App: React.FC = () => {
  // Initialize subjects from storage (Persistence for Single User)
  const [subjects, setSubjects] = useState<Subject[]>(() => {
      const saved = loadFromStorage<Subject[]>('user', 'subjects');
      return saved || [];
  });
  
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);
  const [activeSubjectTab, setActiveSubjectTab] = useState<SubjectTab>('chat');
  const [activeGlobalView, setActiveGlobalView] = useState<'subjects' | 'liveTutor' | 'dailyRecap'>('subjects');
  const [isAddSubjectModalOpen, setIsAddSubjectModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Persist subjects whenever they change
  useEffect(() => {
      saveToStorage('user', 'subjects', subjects);
  }, [subjects]);

  const handleAddSubject = (name: string, file: UploadedFile) => {
    const newSubject: Subject = {
      id: new Date().toISOString(), // simple unique id
      name,
      files: [file],
    };
    const newSubjects = [...subjects, newSubject];
    setSubjects(newSubjects);
    setActiveSubjectId(newSubject.id); // auto-select the new subject
    setActiveGlobalView('subjects');
    setActiveSubjectTab('chat'); // Reset to chat tab when selecting a new subject
    setIsAddSubjectModalOpen(false); // Close modal on success
  };
  
  const handleAddResource = (subjectId: string, file: UploadedFile) => {
    setSubjects(prevSubjects =>
      prevSubjects.map(subject =>
        subject.id === subjectId
          ? { ...subject, files: [...subject.files, file] }
          : subject
      )
    );
  };

  const handleSelectSubject = (id: string) => {
    setActiveSubjectId(id);
    setActiveGlobalView('subjects');
    setActiveSubjectTab('chat'); // Reset to chat tab when switching subjects
    setIsSidebarOpen(false); // Close sidebar on mobile
  };
  
  const handleSelectLiveTutor = () => {
    setActiveGlobalView('liveTutor');
    setActiveSubjectId(null);
    setIsSidebarOpen(false); // Close sidebar on mobile
  };
  
  const handleSelectDailyRecap = () => {
    setActiveGlobalView('dailyRecap');
    setActiveSubjectId(null);
    setIsSidebarOpen(false); // Close sidebar on mobile
  }

  const handleBackToSubjects = () => {
    setActiveGlobalView('subjects');
  }

  const activeSubject = subjects.find(s => s.id === activeSubjectId);

  const renderSubjectContent = () => {
    if (!activeSubject) return null;

    switch (activeSubjectTab) {
      case 'chat':
        return <Chatbot files={activeSubject.files} />;
      case 'quiz':
        return <Quiz files={activeSubject.files} subjectId={activeSubject.id} />;
      case 'notes':
        return <Notes files={activeSubject.files} subjectId={activeSubject.id} />;
      case 'recap':
        return <Recap files={activeSubject.files} subjectId={activeSubject.id} />;
      case 'lecture':
        return <LiveLecture files={activeSubject.files} />;
      case 'live_revision':
        return <LiveRevision files={activeSubject.files} />;
      case 'resources':
        return <Resources files={activeSubject.files} subjectId={activeSubject.id} onAddResource={handleAddResource} />;
      default:
        return null;
    }
  };

  const WelcomeView = () => (
    <div className="flex flex-col items-center justify-center h-full text-center bg-white border-2 border-slate-200 rounded-3xl p-8 relative overflow-hidden shadow-sm">
        <div className="bg-sky-100 p-6 rounded-full mb-6">
             <SparklesIcon className="w-16 h-16 text-sky-500" />
        </div>
        <h2 className="text-4xl font-extrabold mb-4 text-slate-800">Welcome to Cognita</h2>
        <p className="text-lg text-slate-500 max-w-xl mb-8">
            Your AI-powered revision partner. Select a subject from the sidebar to get started, or add a new one to begin your journey.
        </p>
        <button 
            onClick={() => setIsAddSubjectModalOpen(true)}
            className="px-8 py-4 bg-sky-500 hover:bg-sky-400 text-white font-bold rounded-2xl text-lg transition-transform hover:scale-105 shadow-md border-b-4 border-sky-700 active:border-b-0 active:translate-y-1"
        >
            Get Started
        </button>
    </div>
  );
  
  const renderSubjectView = () => (
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-full">
        <div className="lg:col-span-3 flex flex-col h-full bg-white border-2 border-slate-200 rounded-3xl p-6 overflow-hidden shadow-sm">
          <div className="flex-shrink-0">
            <div className="flex items-center gap-4 mb-6">
                <div className="flex-1">
                    <h2 className="text-3xl font-extrabold text-slate-800 truncate">{activeSubject?.name}</h2>
                    <p className="text-slate-400 font-medium truncate">Using file: {activeSubject?.files[0].name}</p>
                </div>
            </div>
            <div className="mb-6">
                <SubjectTabs activeTab={activeSubjectTab} setActiveTab={setActiveSubjectTab} />
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto pr-2">
            {renderSubjectContent()}
          </div>
        </div>

        <div className="hidden lg:block lg:col-span-2 h-full">
            {activeSubject && <DocumentViewer file={activeSubject.files[0]} />}
        </div>
      </div>
  )

  const renderLiveTutorView = () => (
    <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 sm:p-8 h-full shadow-sm">
        <div className="flex items-center gap-4 mb-6">
            <button onClick={handleBackToSubjects} className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-3 rounded-2xl transition-colors border-b-4 border-slate-300 active:border-b-0 active:translate-y-1">
                <ArrowLeftIcon className="w-6 h-6" />
            </button>
            <div>
                <h2 className="text-3xl font-extrabold text-slate-800">Live Visual Tutor</h2>
                <p className="text-slate-500 font-medium">Get real-time visual assistance from your AI tutor.</p>
            </div>
        </div>
        <LiveTutor />
    </div>
  )

  const renderDailyRecapView = () => (
    <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 sm:p-8 h-full flex flex-col shadow-sm">
        <div className="flex-shrink-0 flex items-center gap-4 mb-6">
            <button onClick={handleBackToSubjects} className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-3 rounded-2xl transition-colors border-b-4 border-slate-300 active:border-b-0 active:translate-y-1">
                <ArrowLeftIcon className="w-6 h-6" />
            </button>
            <div>
                <h2 className="text-3xl font-extrabold text-slate-800">Daily Recap Tool</h2>
                <p className="text-slate-500 font-medium">Select resources and topics to generate a cross-subject summary.</p>
            </div>
        </div>
        <div className="flex-1 min-h-0">
          <DailyRecapTool subjects={subjects} />
        </div>
    </div>
  )

  const renderContent = () => {
    if (activeGlobalView === 'liveTutor') {
      return renderLiveTutorView();
    }
    if (activeGlobalView === 'dailyRecap') {
      return renderDailyRecapView();
    }
    
    if (activeSubjectId && activeSubject) {
        return renderSubjectView();
    }
    
    return <WelcomeView />;
  };

  return (
    <div className="bg-slate-50 text-slate-700 min-h-screen font-sans selection:bg-sky-200 selection:text-sky-900">
      <div className="flex h-screen">
        <Sidebar 
          subjects={subjects}
          activeSubjectId={activeSubjectId}
          onSelectSubject={handleSelectSubject}
          onAddSubject={() => setIsAddSubjectModalOpen(true)}
          onSelectLiveTutor={handleSelectLiveTutor}
          isLiveTutorActive={activeGlobalView === 'liveTutor'}
          onSelectDailyRecap={handleSelectDailyRecap}
          isDailyRecapActive={activeGlobalView === 'dailyRecap'}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
        <main className="flex-1 flex flex-col p-4 sm:p-6 overflow-y-auto">
          {/* Mobile Header */}
          <div className="md:hidden flex items-center justify-between mb-4 flex-shrink-0">
            <button onClick={() => setIsSidebarOpen(true)} className="text-slate-600 hover:text-sky-600 p-2 -ml-2">
              <Bars3Icon className="w-8 h-8" />
            </button>
            <h1 className="text-2xl font-extrabold text-sky-500 tracking-tight">
              Cognita
            </h1>
            <div className="w-8"></div> {/* Spacer to balance the header */}
          </div>
          <div className="flex-1 min-h-0">
             {renderContent()}
          </div>
        </main>
      </div>

      {isAddSubjectModalOpen && (
        <FileUploadModal 
          onClose={() => setIsAddSubjectModalOpen(false)}
          onSubjectAdded={handleAddSubject}
        />
      )}
      
       <footer className="fixed bottom-0 right-0 p-2 text-slate-400 text-xs z-10 pointer-events-none">
        <p>Built with Gemini API</p>
      </footer>
    </div>
  );
};

export default App;
