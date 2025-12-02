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
    <nav className="w-full overflow-x-auto pb-2 scrollbar-hide">
      <ul className="flex items-center gap-2 min-w-max">
        {subjectTabs.map((tab) => (
          <li key={tab.id}>
            <button
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all duration-200 border-b-4 active:border-b-0 active:translate-y-1 ${
                activeTab === tab.id
                  ? 'bg-sky-500 border-sky-700 text-white'
                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
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