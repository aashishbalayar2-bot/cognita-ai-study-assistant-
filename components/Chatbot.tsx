import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { UploadedFile, ChatMessage, ChatTool, ToolDefinition, Flashcard } from '../types';
import { chatWithDocument, generateFlashcardsFromConcept } from '../services/geminiService';
import { fileToBase64 } from '../utils/fileUtils';
import { 
  PaperAirplaneIcon, UserIcon, SparklesIcon,
  QuestionMarkCircleIcon, LightBulbIcon,
  ClipboardDocumentListIcon, Squares2x2Icon, CpuChipIcon, DocumentArrowUpIcon, XCircleIcon,
  DocumentPlusIcon, ClipboardDocumentCheckIcon, ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon,
  PlusIcon
} from './icons/Icons';

interface ChatbotProps {
  files: UploadedFile[];
}

// --- Interactive Flashcard Components for Chat ---

const ChatFlashcard: React.FC<{ card: Flashcard }> = ({ card }) => {
    const [isFlipped, setIsFlipped] = useState(false);

    useEffect(() => {
        setIsFlipped(false);
    }, [card]);

    // Helper to determine labels based on card type
    const getFrontLabel = (type: string) => {
        if (type === 'problem') return 'Problem';
        if (type === 'definition') return 'Term';
        if (type === 'long_answer') return 'Exam Question (Long)';
        return 'Question';
    };

    const getBackLabel = (type: string) => {
        if (type === 'problem') return 'Solution';
        if (type === 'definition') return 'Definition';
        if (type === 'long_answer') return 'Model Answer';
        return 'Answer';
    };

    return (
        <div 
            className="w-full h-64 perspective-1000 cursor-pointer group"
            onClick={() => setIsFlipped(!isFlipped)}
        >
            <div className={`relative w-full h-full transform-style-preserve-3d transition-transform duration-500 ${isFlipped ? 'rotate-y-180' : ''}`}>
                {/* Front */}
                <div className="absolute w-full h-full backface-hidden bg-white border-2 border-slate-200 rounded-2xl p-6 flex flex-col justify-center items-center text-center shadow-sm group-hover:border-sky-400 transition-colors">
                    <span className="text-xs font-extrabold text-sky-500 uppercase tracking-wider mb-3">
                        {getFrontLabel(card.type)}
                    </span>
                    <p className="text-lg font-bold text-slate-700 overflow-y-auto max-h-40 scrollbar-hide">{card.front}</p>
                    <p className="text-xs text-slate-400 mt-4 absolute bottom-4 font-bold uppercase">Tap to flip</p>
                </div>

                {/* Back */}
                <div className="absolute w-full h-full backface-hidden bg-sky-50 border-2 border-sky-200 rounded-2xl p-6 flex flex-col justify-center items-center text-center rotate-y-180 shadow-sm">
                    <span className="text-xs font-extrabold text-sky-500 uppercase tracking-wider mb-3">
                        {getBackLabel(card.type)}
                    </span>
                    <p className="text-base font-medium text-slate-700 overflow-y-auto max-h-40 scrollbar-hide whitespace-pre-wrap">{card.back}</p>
                    <p className="text-xs text-sky-400 mt-4 absolute bottom-4 font-bold uppercase">Tap to flip back</p>
                </div>
            </div>
        </div>
    );
};

const ChatFlashcardCarousel: React.FC<{ cards: Flashcard[] }> = ({ cards }) => {
    const [currentIndex, setCurrentIndex] = useState(0);

    const handleNext = () => {
        setCurrentIndex((prev) => (prev + 1) % cards.length);
    };

    const handlePrev = () => {
        setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
    };

    if (!cards || cards.length === 0) return null;

    return (
        <div className="mt-4 w-full max-w-sm mx-auto">
            <ChatFlashcard card={cards[currentIndex]} />
            
            <div className="flex items-center justify-between mt-3 px-2">
                <button 
                    onClick={handlePrev} 
                    className="p-2 rounded-xl bg-white border-2 border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors"
                >
                    <ChevronLeftIcon className="w-5 h-5" />
                </button>
                <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">
                    {currentIndex + 1} / {cards.length}
                </span>
                <button 
                    onClick={handleNext} 
                    className="p-2 rounded-xl bg-white border-2 border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors"
                >
                    <ChevronRightIcon className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};


const Chatbot: React.FC<ChatbotProps> = ({ files }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTool, setActiveTool] = useState<ChatTool>('general');
  const [isToolsExpanded, setIsToolsExpanded] = useState(false);
  const [homeworkFile, setHomeworkFile] = useState<UploadedFile | null>(null);
  const [questionFile, setQuestionFile] = useState<UploadedFile | null>(null);
  const [pendingFiles, setPendingFiles] = useState<UploadedFile[]>([]);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const toolDefinitions: ToolDefinition[] = useMemo(() => {
    const primaryFileName = files[0]?.name || 'the document';
    return [
      {
        id: 'general',
        name: 'General Chat',
        icon: Squares2x2Icon,
        placeholder: `Ask anything about your document...`,
        systemInstruction: `You are "Professor Zero", a highly capable AI study assistant.`
      },
      {
        id: 'qna_solver',
        name: 'QnA Solver',
        icon: QuestionMarkCircleIcon,
        placeholder: 'Ask your question for the QnA Solver...',
        systemInstruction: `You are "Professor Zero", an AI QnA Solver.`
      },
      {
        id: 'concept_explainer',
        name: 'Concept Explainer',
        icon: LightBulbIcon,
        placeholder: 'Which concept would you like explained?',
        systemInstruction: `You are "Professor Zero", an AI Concept Explainer.`
      },
      {
        id: 'notes_summarizer',
        name: 'Notes Summarizer',
        icon: ClipboardDocumentListIcon,
        placeholder: 'What specific notes or sections should I summarize?',
        systemInstruction: `You are "Professor Zero", an AI Notes Summarizer.`
      },
       {
        id: 'homework_helper',
        name: 'Homework Helper',
        icon: CpuChipIcon,
        placeholder: 'Upload files & type your question...',
        systemInstruction: `You are "Professor Zero", an AI Homework Helper.`
      },
      {
        id: 'flashcard_generator',
        name: 'Flashcard Generator',
        icon: ClipboardDocumentCheckIcon,
        placeholder: 'What concept do you want flashcards for?',
        systemInstruction: `You are "Professor Zero", an AI Flashcard Generator.`
      },
    ]
  }, [files]);

  const currentTool = useMemo(() => toolDefinitions.find(tool => tool.id === activeTool) || toolDefinitions[0], [activeTool, toolDefinitions]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);
  
  const createFileHandler = (setter: React.Dispatch<React.SetStateAction<UploadedFile | null>>) => 
    useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = event.target.files?.[0];
      if (!selectedFile) return;

      setFileError(null);
      if (selectedFile.size > 5 * 1024 * 1024) { 
          setFileError('File size must be less than 5MB.');
          return;
      }
      if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(selectedFile.type)) {
          setFileError('Only JPEG, PNG, WebP, and PDF files are supported.');
          return;
      }

      setIsProcessingFile(true);
      try {
          const base64 = await fileToBase64(selectedFile);
          setter({
              name: selectedFile.name,
              base64,
              mimeType: selectedFile.type,
          });
      } catch (err) {
          setFileError('Failed to process file.');
          console.error(err);
      } finally {
          setIsProcessingFile(false);
      }
  }, [setter]);

  const handleExampleFileChange = createFileHandler(setHomeworkFile);
  const handleQuestionFileChange = createFileHandler(setQuestionFile);

  const handlePendingFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = event.target.files;
      if (!selectedFiles) return;

      setFileError(null);
      setIsProcessingFile(true);
      
      try {
          const newFiles: UploadedFile[] = [];
          for (let i = 0; i < selectedFiles.length; i++) {
              const file = selectedFiles[i];
              if (file.size > 5 * 1024 * 1024) {
                  setFileError(`File ${file.name} is too large (max 5MB).`);
                  continue;
              }
              if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) {
                  setFileError(`File ${file.name} format not supported.`);
                  continue;
              }
              const base64 = await fileToBase64(file);
              newFiles.push({
                  name: file.name,
                  base64,
                  mimeType: file.type
              });
          }
          setPendingFiles(prev => [...prev, ...newFiles]);
      } catch (err) {
          console.error(err);
          setFileError('Failed to process one or more files.');
      } finally {
          setIsProcessingFile(false);
          // Reset input value to allow selecting same file again
          event.target.value = '';
      }
  }, []);

  const removePendingFile = (index: number) => {
      setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    if (activeTool === 'homework_helper') {
        if (!homeworkFile) {
            setMessages((prev) => [...prev, { role: 'model', text: 'Please upload an example file showing the method to use.' }]);
            return;
        }
        if (!questionFile && !input.trim()) {
            setMessages((prev) => [...prev, { role: 'model', text: 'Please either type your question or upload it as a file.' }]);
            return;
        }
    } else if (activeTool === 'general') {
        if (!input.trim() && pendingFiles.length === 0) return;
    } else {
        if (!input.trim()) return;
    }
    
    const userMessageText = input.trim();
    
    // Display attached files in user message
    let displayText = userMessageText;
    if (pendingFiles.length > 0) {
        const fileNames = pendingFiles.map(f => `[Attached: ${f.name}]`).join('\n');
        displayText = `${displayText}\n\n${fileNames}`.trim();
    }

    const userMessage: ChatMessage = { role: 'user', text: displayText };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      let responseText = '';
      let generatedFlashcards: Flashcard[] | undefined = undefined;

      if (activeTool === 'flashcard_generator') {
        const flashcards: Flashcard[] = await generateFlashcardsFromConcept(files, userMessageText);
        
        if (flashcards && flashcards.length > 0) {
            generatedFlashcards = flashcards;
            responseText = `I've generated ${flashcards.length} flashcards for "${userMessageText}". Tap them to flip!`;
        } else {
            responseText = `I couldn't generate flashcards for "${userMessageText}" based on the document. Please try another concept.`;
        }
      } else {
        let filesForApi = [...files];
        let extraFiles: UploadedFile[] = [];

        if (activeTool === 'homework_helper') {
            if (homeworkFile) filesForApi.push(homeworkFile);
            if (questionFile) filesForApi.push(questionFile);
        } else if (activeTool === 'general') {
            extraFiles = [...pendingFiles];
        }

        responseText = await chatWithDocument(filesForApi, messages, userMessageText, activeTool, currentTool.systemInstruction, extraFiles);
        
        if (activeTool === 'homework_helper') {
            setHomeworkFile(null); // Reset after use
            setQuestionFile(null);
        }
        if (activeTool === 'general') {
            setPendingFiles([]); // Clear pending files after sending
        }
      }
      
      const modelMessage: ChatMessage = { 
        role: 'model', 
        text: responseText,
        flashcards: generatedFlashcards 
      };
      setMessages((prev) => [...prev, modelMessage]);

    } catch (error) {
      console.error(error);
      const errorMessage: ChatMessage = { role: 'model', text: 'Sorry, I encountered an error. Please try again.' };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToolSelect = (toolId: ChatTool) => {
    setActiveTool(toolId);
    setIsToolsExpanded(false); // Auto collapse when tool is selected
    setHomeworkFile(null); 
    setQuestionFile(null);
    setPendingFiles([]); // Clear pending files on tool switch
    setFileError(null);
    const tool = toolDefinitions.find(t => t.id === toolId);
    setMessages(prev => {
      const toolSwitchMessage: ChatMessage = { role: 'model', text: `Tool switched to: ${tool?.name || 'General Chat'}. ${toolId === 'homework_helper' ? 'Please upload an example file and your question file.' : 'What would you like to do?'}` };
      return [...prev, toolSwitchMessage];
    });
  };
  
  const canSubmit = useMemo(() => {
    if (isLoading) return false;
    if (activeTool === 'homework_helper') {
      return !!homeworkFile && (!!questionFile || !!input.trim());
    }
    return !!input.trim() || pendingFiles.length > 0;
  }, [isLoading, activeTool, homeworkFile, questionFile, input, pendingFiles.length]);


  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto pr-4 -mr-4 space-y-6 p-2">
        {messages.length === 0 && (
          <div className="text-center text-slate-400 p-8 flex flex-col items-center">
             <div className="bg-slate-100 p-6 rounded-full mb-4">
                <Squares2x2Icon className="w-12 h-12 text-slate-300" />
             </div>
            <h3 className="text-xl font-bold text-slate-600">Start Chatting</h3>
            <p className="font-medium">Ask a question about "{files[0].name}"</p>
          </div>
        )}
        {messages.map((msg, index) => (
          <div key={index} className={`flex items-end gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'model' && (
              <div className="flex-shrink-0 w-10 h-10 rounded-2xl bg-white border-2 border-slate-200 flex items-center justify-center shadow-sm">
                <SparklesIcon className="w-6 h-6 text-sky-500" />
              </div>
            )}
            <div className={`max-w-md lg:max-w-xl p-4 rounded-2xl text-base font-medium shadow-sm border-2 ${
                msg.role === 'user'
                  ? 'bg-blue-600 border-blue-700 text-white rounded-br-none'
                  : 'bg-white border-slate-200 text-slate-700 rounded-bl-none'
              }`}>
              <p className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: msg.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/### (.*?)\n/g, '<h3 class="text-lg font-bold mt-2 mb-1">$1</h3>').replace(/---/g, '<hr class="my-2 border-slate-200">') }}></p>
              
              {/* Interactive Flashcards Render */}
              {msg.flashcards && msg.flashcards.length > 0 && (
                  <ChatFlashcardCarousel cards={msg.flashcards} />
              )}
            </div>
             {msg.role === 'user' && (
              <div className="flex-shrink-0 w-10 h-10 rounded-2xl bg-blue-100 border-2 border-blue-200 flex items-center justify-center">
                <UserIcon className="w-6 h-6 text-blue-600" />
              </div>
            )}
          </div>
        ))}
        {isLoading && (
            <div className="flex items-end gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-2xl bg-white border-2 border-slate-200 flex items-center justify-center">
                    <SparklesIcon className="w-6 h-6 text-sky-500 animate-pulse" />
                </div>
                <div className="p-4 rounded-2xl bg-white border-2 border-slate-200 rounded-bl-none">
                   <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                    </div>
                </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="mt-4 border-t-2 border-slate-100 pt-4">
        {/* Collapsible Tool Bar */}
        <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Active Tool:</span>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-xl border-2 border-blue-100 text-blue-700 font-bold text-sm">
                    <currentTool.icon className="w-4 h-4" />
                    {currentTool.name}
                </div>
            </div>
            <button 
                onClick={() => setIsToolsExpanded(!isToolsExpanded)}
                className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all flex items-center gap-1 font-bold text-xs uppercase tracking-wide"
            >
                 {isToolsExpanded ? 'Collapse' : 'Change'}
                 <ChevronDownIcon className={`w-5 h-5 transition-transform duration-300 ${isToolsExpanded ? 'rotate-180' : ''}`} />
            </button>
        </div>

        {/* Expandable Tools Grid */}
        {isToolsExpanded && (
            <div className="mb-4 p-3 bg-slate-50 rounded-2xl border-2 border-slate-200 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex flex-wrap gap-2">
                    {toolDefinitions.filter(tool => tool.id !== 'general').map((tool) => (
                    <button
                        key={tool.id}
                        onClick={() => handleToolSelect(tool.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors border-2 border-b-4 active:border-b-2 active:translate-y-1 ${
                        activeTool === tool.id
                            ? 'bg-blue-500 border-blue-700 text-white'
                            : 'bg-white border-slate-200 text-slate-500 hover:bg-white hover:border-blue-300 hover:text-blue-500'
                        }`}
                        disabled={isLoading}
                    >
                        <tool.icon className="w-4 h-4" />
                        {tool.name}
                    </button>
                    ))}
                    {activeTool !== 'general' && (
                    <button
                        onClick={() => handleToolSelect('general')}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors bg-slate-100 border-2 border-b-4 border-slate-300 text-slate-500 hover:bg-slate-200 active:border-b-2 active:translate-y-1"
                        disabled={isLoading}
                    >
                        <Squares2x2Icon className="w-4 h-4" />
                        Back to General
                    </button>
                    )}
                </div>
            </div>
        )}

        {/* Homework Helper Specific Inputs */}
        {activeTool === 'homework_helper' && (
            <div className="mb-4 p-4 bg-blue-50 border-2 border-blue-100 rounded-2xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Example Method Upload */}
                    <label htmlFor="homework-file-upload" className="flex items-center gap-4 cursor-pointer p-3 bg-white border-2 border-slate-200 rounded-xl hover:border-sky-400 transition-colors">
                        <div className="flex-shrink-0 bg-sky-100 p-3 rounded-lg">
                            <DocumentArrowUpIcon className="w-6 h-6 text-sky-500"/>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-700 truncate">
                                {isProcessingFile ? 'Processing...' : (homeworkFile ? homeworkFile.name : 'Upload Example')}
                            </p>
                            <p className="text-xs text-slate-400 font-bold uppercase">Method File</p>
                        </div>
                        <input id="homework-file-upload" name="homework-file-upload" type="file" className="sr-only" onChange={handleExampleFileChange} disabled={isProcessingFile || isLoading} accept="image/png, image/jpeg, image/webp, application/pdf" />
                    </label>
                    {/* Question File Upload */}
                    <label htmlFor="question-file-upload" className="flex items-center gap-4 cursor-pointer p-3 bg-white border-2 border-slate-200 rounded-xl hover:border-sky-400 transition-colors">
                        <div className="flex-shrink-0 bg-teal-100 p-3 rounded-lg">
                            <DocumentPlusIcon className="w-6 h-6 text-teal-500"/>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-700 truncate">
                                {isProcessingFile ? 'Processing...' : (questionFile ? questionFile.name : 'Upload Question')}
                            </p>
                            <p className="text-xs text-slate-400 font-bold uppercase">Problem File</p>
                        </div>
                        <input id="question-file-upload" name="question-file-upload" type="file" className="sr-only" onChange={handleQuestionFileChange} disabled={isProcessingFile || isLoading} accept="image/png, image/jpeg, image/webp, application/pdf" />
                    </label>
                </div>
                {fileError && <p className="text-red-500 text-sm mt-3 flex items-center gap-1 md:col-span-2 font-bold"><XCircleIcon className="w-4 h-4"/>{fileError}</p>}
            </div>
        )}

        <form onSubmit={handleSendMessage} className="flex items-center gap-2 md:gap-4 relative">
          
          {/* Pending File Previews */}
          {pendingFiles.length > 0 && (
              <div className="absolute bottom-full mb-3 left-0 w-full flex gap-2 overflow-x-auto p-1 bg-gradient-to-t from-white to-transparent">
                  {pendingFiles.map((f, i) => (
                      <div key={i} className="flex-shrink-0 bg-white border-2 border-slate-200 rounded-xl p-2 flex items-center gap-2 shadow-sm animate-in slide-in-from-bottom-2 fade-in duration-300">
                          <span className="text-xs font-bold text-slate-600 truncate max-w-[100px]">{f.name}</span>
                          <button type="button" onClick={() => removePendingFile(i)} className="text-slate-400 hover:text-red-500 transition-colors">
                              <XCircleIcon className="w-4 h-4" />
                          </button>
                      </div>
                  ))}
              </div>
          )}

          {/* Plus Button for General Chat */}
          {activeTool === 'general' && (
              <>
                  <input id="chat-file-upload" type="file" multiple className="hidden" onChange={handlePendingFileChange} accept="image/png, image/jpeg, image/webp, application/pdf" disabled={isLoading} />
                  <label htmlFor="chat-file-upload" className="flex-shrink-0 p-4 bg-slate-100 rounded-2xl hover:bg-slate-200 cursor-pointer text-slate-500 hover:text-blue-600 transition-colors border-2 border-slate-200 hover:border-blue-200">
                      <PlusIcon className="w-6 h-6" />
                  </label>
              </>
          )}

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={currentTool.placeholder}
            className="flex-1 bg-white border-2 border-slate-200 rounded-2xl py-4 px-6 text-slate-700 placeholder-slate-400 font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
            disabled={isLoading}
          />
          <button
            type="submit"
            className="bg-blue-600 text-white p-4 rounded-2xl hover:bg-blue-500 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-all border-b-4 border-blue-800 active:border-b-0 active:translate-y-1"
            disabled={!canSubmit}
          >
            <PaperAirplaneIcon className="w-6 h-6" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default Chatbot;