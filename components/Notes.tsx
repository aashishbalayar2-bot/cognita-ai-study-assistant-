
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { UploadedFile, VisualReference, StructuredNotes } from '../types';
import { generateNotes } from '../services/geminiService';
import { SparklesIcon, XCircleIcon, ArrowPathIcon, ClipboardDocumentListIcon, BookOpenIcon, SpeakerWaveIcon, LightBulbIcon } from './icons/Icons';
import PodcastPlayer from './PodcastPlayer';
import { saveToStorage, loadFromStorage } from '../utils/storageUtils';
import { SourceVisualDisplay } from './SourceVisualDisplay';

interface NotesProps {
  files: UploadedFile[];
  subjectId: string;
}

const Notes: React.FC<NotesProps> = ({ files, subjectId }) => {
  const [notesData, setNotesData] = useState<StructuredNotes | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [activeStyle, setActiveStyle] = useState<'cornell' | 'bullet'>('cornell');

  const fetchNotes = useCallback(async (style: 'cornell' | 'bullet', forceRefresh = false) => {
    setIsLoading(true);
    setError(null);
    setNotesData(null);
    const cacheKey = style === 'cornell' ? 'notes_cornell_structured' : 'notes_bullet_structured';
    
    if (!forceRefresh) {
        const cachedData = loadFromStorage<StructuredNotes>(subjectId, cacheKey);
        // We do not support legacy string markdown here anymore, forcing a re-gen if old format
        if (cachedData && cachedData.sections) {
            setNotesData(cachedData);
            setIsCached(true);
            setIsLoading(false);
            return;
        }
    }

    setIsCached(false);
    try {
      const generatedData = await generateNotes(files, style);
      setNotesData(generatedData);
      saveToStorage(subjectId, cacheKey, generatedData);
    } catch (err) {
      console.error(err);
      setError('An error occurred while generating the notes.');
    } finally {
      setIsLoading(false);
    }
  }, [files, subjectId]);

  useEffect(() => {
    fetchNotes(activeStyle);
  }, [fetchNotes, activeStyle]);

  const handleStyleChange = (style: 'cornell' | 'bullet') => {
      setActiveStyle(style);
  };

  const handleRegenerate = () => {
      fetchNotes(activeStyle, true);
  };

  // Convert structured notes to simple text for podcast player
  const podcastText = useMemo(() => {
      if (!notesData) return '';
      return `${notesData.title}. Here are the high yield exam tips. ${notesData.examTips.join('. ')}. Now, the main content. ${notesData.sections.map(s => `${s.cue}. ${s.content}`).join(' ')}. Summary. ${notesData.summary}`;
  }, [notesData]);

  const renderContentText = (text: string) => {
      return text.split('\n').map((line, idx) => (
          <p key={idx} className="mb-2 last:mb-0 leading-relaxed text-slate-700">
              {line.split('**').map((part, i) => i % 2 === 1 ? <strong key={i} className="font-bold text-slate-900">{part}</strong> : part)}
          </p>
      ));
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <SparklesIcon className="w-12 h-12 text-blue-500 animate-pulse mb-4" />
        <h3 className="text-xl font-bold text-slate-800">
            {activeStyle === 'cornell' ? 'Structuring Cornell Notes...' : 'Synthesizing Rapid Revision Chunks...'}
        </h3>
        <p className="text-slate-500 font-medium mt-1">Extracting high-yield exam signals and key visuals.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-red-500">
        <XCircleIcon className="w-12 h-12 mb-4"/>
        <h3 className="text-xl font-bold">{error}</h3>
        <button onClick={() => handleRegenerate()} className="mt-6 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-2 px-6 rounded-lg flex items-center gap-2 shadow-sm transition-all active:translate-y-0.5">
            <ArrowPathIcon className="w-4 h-4" />
            Try Again
        </button>
      </div>
    );
  }

  if (!notesData) return null;

  return (
    <div className="relative h-full flex flex-col">
        {/* Toolbar */}
        <div className="flex-shrink-0 z-20 mb-4 bg-white rounded-xl p-3 border border-slate-200 shadow-sm space-y-3">
            <div className="flex bg-slate-100 p-1 rounded-lg">
                 <button 
                    onClick={() => handleStyleChange('cornell')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-bold transition-all ${activeStyle === 'cornell' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                 >
                     <BookOpenIcon className="w-4 h-4" />
                     Cornell Method
                 </button>
                 <button 
                    onClick={() => handleStyleChange('bullet')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-bold transition-all ${activeStyle === 'bullet' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                 >
                     <ClipboardDocumentListIcon className="w-4 h-4" />
                     Quick Revise
                 </button>
            </div>

            <div className="flex justify-between items-center px-1">
                <PodcastPlayer textToSpeak={podcastText} />
                <div className="flex items-center gap-4">
                     {isCached && <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded uppercase">Cached</span>}
                    <button 
                        onClick={handleRegenerate}
                        className="text-xs font-bold text-slate-400 hover:text-blue-600 uppercase tracking-wide flex items-center gap-1 transition-colors"
                    >
                        <ArrowPathIcon className="w-4 h-4" /> Regenerate
                    </button>
                </div>
            </div>
        </div>

        {/* Scrollable Notes Area */}
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar pb-10">
            <div className="max-w-4xl mx-auto">
                
                {/* Header Section */}
                <div className="mb-8 text-center">
                     <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-2">{notesData.title}</h1>
                </div>

                {/* Exam Signals Box */}
                {notesData.examTips && notesData.examTips.length > 0 && (
                    <div className="mb-8 bg-amber-50 border-l-4 border-amber-400 p-6 rounded-r-xl shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <LightBulbIcon className="w-6 h-6 text-amber-500" />
                            <h3 className="text-lg font-extrabold text-amber-800 uppercase tracking-wide">High Yield Exam Signals</h3>
                        </div>
                        <ul className="space-y-2">
                            {notesData.examTips.map((tip, idx) => (
                                <li key={idx} className="flex items-start gap-3 text-amber-900 font-medium">
                                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0"></span>
                                    <span>{tip}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Cornell Grid */}
                <div className="space-y-4">
                    {notesData.sections.map((section, idx) => (
                        <div key={idx} className={`flex flex-col md:flex-row gap-0 md:gap-0 border border-slate-200 rounded-xl overflow-hidden shadow-sm ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                            {/* Cue Column */}
                            <div className="w-full md:w-1/3 bg-blue-50/50 p-6 border-b md:border-b-0 md:border-r border-slate-200">
                                <h4 className="font-bold text-blue-800 text-sm uppercase tracking-wide mb-2">
                                    {activeStyle === 'cornell' ? 'Recall Question' : 'Topic'}
                                </h4>
                                <p className="font-bold text-slate-800 text-lg leading-tight">
                                    {section.cue}
                                </p>
                            </div>

                            {/* Content Column */}
                            <div className="w-full md:w-2/3 p-6 bg-white">
                                {renderContentText(section.content)}
                                {section.visualIndex !== undefined && section.visualIndex !== null && notesData.visuals[section.visualIndex] && (
                                    <div className="mt-4 pt-4 border-t border-slate-100">
                                        <SourceVisualDisplay visual={notesData.visuals[section.visualIndex]} files={files} compact={true} />
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Summary Footer */}
                <div className="mt-8 bg-slate-800 text-white p-8 rounded-xl shadow-lg">
                    <h3 className="text-lg font-bold text-slate-300 uppercase tracking-widest mb-3">Summary</h3>
                    <p className="text-lg font-medium leading-relaxed opacity-90">
                        {notesData.summary}
                    </p>
                </div>

            </div>
        </div>
    </div>
  );
};

export default Notes;
