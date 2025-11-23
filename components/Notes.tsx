
import React, { useState, useEffect, useCallback } from 'react';
import { UploadedFile } from '../types';
import { generateNotes } from '../services/geminiService';
import { SparklesIcon, XCircleIcon, ArrowPathIcon, DocumentTextIcon } from './icons/Icons';
import PodcastPlayer from './PodcastPlayer';
import { saveToStorage, loadFromStorage } from '../utils/storageUtils';


interface NotesProps {
  files: UploadedFile[];
  subjectId: string;
}

// A simple markdown-like renderer
const renderFormattedText = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, index) => {
        if (line.startsWith('### ')) {
            return <h3 key={index} className="text-xl font-extrabold mt-6 mb-3 text-slate-800">{line.substring(4)}</h3>;
        }
        if (line.startsWith('## ')) {
            return <h2 key={index} className="text-2xl font-extrabold mt-8 mb-4 text-sky-600">{line.substring(3)}</h2>;
        }
        if (line.startsWith('# ')) {
            return <h1 key={index} className="text-3xl font-extrabold mt-10 mb-6 text-sky-600 border-b-2 border-slate-100 pb-2">{line.substring(2)}</h1>;
        }
        if (line.startsWith('* ')) {
            return <li key={index} className="ml-6 list-disc text-slate-600 my-1">{line.substring(2)}</li>;
        }
        if (line.includes('**')) {
            const parts = line.split('**');
            return <p key={index} className="my-2 text-slate-600 leading-relaxed">{parts.map((part, i) => i % 2 === 1 ? <strong key={i} className="text-slate-800 font-bold">{part}</strong> : part)}</p>
        }
        return <p key={index} className="my-2 text-slate-600 leading-relaxed">{line}</p>;
    });
};


const Notes: React.FC<NotesProps> = ({ files, subjectId }) => {
  const [notes, setNotes] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);

  const fetchNotes = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    setError(null);
    setNotes('');
    
    if (!forceRefresh) {
        const cachedNotes = loadFromStorage<string>(subjectId, 'notes');
        if (cachedNotes) {
            setNotes(cachedNotes);
            setIsCached(true);
            setIsLoading(false);
            return;
        }
    }

    setIsCached(false);
    try {
      const generatedNotes = await generateNotes(files);
      setNotes(generatedNotes);
      saveToStorage(subjectId, 'notes', generatedNotes);
    } catch (err) {
      console.error(err);
      setError('An error occurred while generating the notes.');
    } finally {
      setIsLoading(false);
    }
  }, [files, subjectId]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const handleRegenerate = () => {
      fetchNotes(true);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <SparklesIcon className="w-16 h-16 text-sky-500 animate-pulse mb-4" />
        <h3 className="text-xl font-bold text-slate-800">Crafting your revision notes...</h3>
        <p className="text-slate-400 font-medium">Our AI is summarizing and structuring the key points for you.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-red-500">
        <XCircleIcon className="w-16 h-16 mb-4"/>
        <h3 className="text-xl font-bold">{error}</h3>
        <button onClick={() => handleRegenerate()} className="mt-6 bg-sky-500 hover:bg-sky-400 text-white font-bold py-3 px-6 rounded-2xl flex items-center gap-2 border-b-4 border-sky-700 active:border-b-0 active:translate-y-1">
            <ArrowPathIcon className="w-5 h-5" />
            Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
        {isCached && (
            <div className="absolute top-0 right-0 z-10">
                 <span className="text-xs font-bold text-slate-400 bg-white border border-slate-200 px-3 py-1 rounded-full uppercase tracking-wide">Offline Cache</span>
            </div>
        )}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 sticky top-0 z-10 mb-6 border-2 border-slate-200 flex justify-between items-center shadow-sm">
             <PodcastPlayer textToSpeak={notes} />
             <button 
                onClick={handleRegenerate}
                className="text-xs font-bold text-slate-400 hover:text-sky-500 uppercase tracking-wide flex items-center gap-1 ml-4 transition-colors"
             >
                 <ArrowPathIcon className="w-4 h-4" /> Regenerate
             </button>
        </div>
        <div className="prose prose-slate max-w-none">
            {renderFormattedText(notes)}
        </div>
    </div>
  );
};

export default Notes;
