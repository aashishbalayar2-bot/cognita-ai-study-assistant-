
import React from 'react';
import {
    ChatBubbleLeftRightIcon,
    AcademicCapIcon,
    DocumentTextIcon,
    MicrophoneIcon,
    ClipboardDocumentCheckIcon,
    FolderPlusIcon,
    TrophyIcon,
} from './icons/Icons';
import { SubjectTab } from '../types';

interface SubjectTabsProps {
  activeTab: SubjectTab;
  setActiveTab: (tab: SubjectTab) => void;
}

type Tab = {
  id: SubjectTab;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
}

const subjectTabs: Tab[] = [
  { id: 'chat', name: 'CHAT', icon: ChatBubbleLeftRightIcon },
  { id: 'quiz', name: 'QUIZ', icon: AcademicCapIcon },
  { id: 'notes', name: 'NOTES', icon: DocumentTextIcon },
  { id: 'recap', name: 'RECAP', icon: ClipboardDocumentCheckIcon },
  { id: 'lecture', name: 'QUEST', icon: TrophyIcon },
  { id: 'live_revision', name: 'LIVE', icon: MicrophoneIcon },
  { id: 'resources', name: 'FILES', icon: FolderPlusIcon },
];

const SubjectTabs: React.FC<SubjectTabsProps> = ({ activeTab, setActiveTab }) => {
  return (
    <nav className="w-full overflow-x-auto pb-2 scrollbar-hide border-b border-slate-100">
      <ul className="flex items-center gap-6 min-w-max px-2">
        {subjectTabs.map((tab) => (
          <li key={tab.id}>
            <button
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 pb-3 text-xs font-bold transition-all duration-200 border-b-2 ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              <span>{tab.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default SubjectTabs;
