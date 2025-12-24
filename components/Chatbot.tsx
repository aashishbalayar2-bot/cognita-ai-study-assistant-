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

const formatText = (text: string | undefined | null) => {
    if (!text) return '';
    try {
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold">$1</strong>')
            .replace(/### (.*?)\n/g, '<h3 class="text-lg font-bold mt-2 mb-1 text-slate-800">$1</h3>')
            .replace(/---/g, '<hr class="my-2 border-slate-200">');
    } catch (e) {
        console.warn("Formatting error", e);
        return String(text || '');
    }
};

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
                <div className="absolute w-full h-full backface-hidden bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-center items-center text-center shadow-sm hover:border-blue-300 transition-colors">
                    <span className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3">
                        {getFrontLabel(card.type)}
                    </span>
                    <p className="text-lg font-bold text-slate-800 overflow-y-auto max-h-40 scrollbar-hide">{card.front}</p>
                    <p className="text-xs text-slate-400 mt-4 absolute bottom-4 font-bold uppercase">Tap to flip</p>
                </div>

                {/* Back */}
                <div className="absolute w-full h-full backface-hidden bg-slate-50 border border-slate-300 rounded-xl p-6 flex flex-col justify-center items-center text-center rotate-y-180 shadow-sm">
                    <span className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3">
                        {getBackLabel(card.type)}
                    </span>
                    <p className="text-base font-medium text-slate-700 overflow-y-auto max-h-40 scrollbar-hide whitespace-pre-wrap">{card.back}</p>
                    <p className="text-xs text-blue-500 mt-4 absolute bottom-4 font-bold uppercase">Tap to flip back</p>
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
                    className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors"
                >
                    <ChevronLeftIcon className="w-5 h-5" />
                </button>
                <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">
                    {currentIndex + 1} / {cards.length}
                </span>
                <button 
                    onClick={handleNext} 
                    className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors"
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
        placeholder: 'Enter a topic, OR type "Convert above" to turn chat questions into flashcards...',
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
        // Pass current messages history to support context-aware flashcards
        const flashcards: Flashcard[] = await generateFlashcardsFromConcept(files, userMessageText, messages);
        
        if (flashcards && flashcards.length > 0) {
            generatedFlashcards = flashcards;
            responseText = `I've generated ${flashcards.length} flashcards based on your request. Tap them to flip!`;
        } else {
            responseText = `I couldn't generate flashcards for "${userMessageText}". If you want to convert previous questions, try saying "Convert the questions above".`;
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
      const toolSwitchMessage: ChatMessage = { role: 'model', text: `Tool switched to: ${tool?.name || 'General Chat'}. ${toolId === 'flashcard_generator' ? 'Type a topic OR say "Make flashcards from above" to convert previous questions.' : 'What would you like to do?'}` };
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
          <div className="text-center text-slate-400 p-8 flex flex-col items-center mt-10">
             <div className="bg-slate-100 p-4 rounded-full mb-4">
                <Squares2x2Icon className="w-8 h-8 text-slate-400" />
             </div>
            <h3 className="text-xl font-bold text-slate-700">Start Chatting</h3>
            <p className="font-medium text-sm text-slate-500">Ask a question about "{files[0].name}"</p>
          </div>
        )}
        {messages.map((msg, index) => (
          <div key={index} className={`flex items-end gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'model' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
                <SparklesIcon className="w-5 h-5 text-blue-600" />
              </div>
            )}
            <div className={`max-w-md lg:max-w-xl p-4 rounded-xl text-base font-medium shadow-sm border ${
                msg.role === 'user'
                  ? 'bg-blue-600 border-blue-600 text-white rounded-br-none'
                  : 'bg-white border-slate-200 text-slate-700 rounded-bl-none'
              }`}>
              <p className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: formatText(msg.text) }}></p>
              
              {/* Interactive Flashcards Render */}
              {msg.flashcards && msg.flashcards.length > 0 && (
                  <ChatFlashcardCarousel cards={msg.flashcards} />
              )}
            </div>
             {msg.role === 'user' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-100 border border-blue-200 flex items-center justify-center">
                <UserIcon className="w-5 h-5 text-blue-600" />
              </div>
            )}
          </div>
        ))}
        {isLoading && (
            <div className="flex items-end gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
                    <SparklesIcon className="w-5 h-5 text-blue-600 animate-pulse" />
                </div>
                <div className="p-4 rounded-xl bg-white border border-slate-200 rounded-bl-none">
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

      <div className="mt-4 border-t border-slate-200 pt-4">
        {/* Collapsible Tool Bar */}
        <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Active Tool:</span>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-slate-200 text-blue-600 font-semibold text-xs shadow-sm">
                    <currentTool.icon className="w-3.5 h-3.5" />
                    {currentTool.name}
                </div>
            </div>
            <button 
                onClick={() => setIsToolsExpanded(!isToolsExpanded)}
                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-all flex items-center gap-1 font-bold text-xs uppercase tracking-wide"
            >
                 {isToolsExpanded ? 'Hide' : 'Tools'}
                 <ChevronDownIcon className={`w-4 h-4 transition-transform duration-300 ${isToolsExpanded ? 'rotate-180' : ''}`} />
            </button>
        </div>

        {/* Expandable Tools Grid */}
        {isToolsExpanded && (
            <div className="mb-4 p-2 bg-slate-50 rounded-xl border border-slate-200 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex flex-wrap gap-2">
                    {toolDefinitions.filter(tool => tool.id !== 'general').map((tool) => (
                    <button
                        key={tool.id}
                        onClick={() => handleToolSelect(tool.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-colors border active:translate-y-0.5 ${
                        activeTool === tool.id
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'bg-white border-slate-200 text-slate-500 hover:bg-white hover:text-blue-600 hover:border-blue-200 shadow-sm'
                        }`}
                        disabled={isLoading}
                    >
                        <tool.icon className="w-3.5 h-3.5" />
                        {tool.name}
                    </button>
                    ))}
                    {activeTool !== 'general' && (
                    <button
                        onClick={() => handleToolSelect('general')}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-colors bg-slate-200 border border-slate-300 text-slate-600 hover:bg-slate-300 active:translate-y-0.5"
                        disabled={isLoading}
                    >
                        <Squares2x2Icon className="w-3.5 h-3.5" />
                        Back to General
                    </button>
                    )}
                </div>
            </div>
        )}

        {/* Homework Helper Specific Inputs */}
        {activeTool === 'homework_helper' && (
            <div className="mb-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Example Method Upload */}
                    <label htmlFor="homework-file-upload" className="flex items-center gap-4 cursor-pointer p-3 bg-white border border-slate-200 rounded-lg hover:border-blue-400 transition-colors shadow-sm">
                        <div className="flex-shrink-0 bg-blue-50 p-2 rounded-md">
                            <DocumentArrowUpIcon className="w-5 h-5 text-blue-500"/>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-700 truncate text-sm">
                                {isProcessingFile ? 'Processing...' : (homeworkFile ? homeworkFile.name : 'Upload Example')}
                            </p>
                            <p className="text-xs text-slate-400 font-bold uppercase">Method File</p>
                        </div>
                        <input id="homework-file-upload" name="homework-file-upload" type="file" className="sr-only" onChange={handleExampleFileChange} disabled={isProcessingFile || isLoading} accept="image/png, image/jpeg, image/webp, application/pdf" />
                    </label>
                    {/* Question File Upload */}
                    <label htmlFor="question-file-upload" className="flex items-center gap-4 cursor-pointer p-3 bg-white border border-slate-200 rounded-lg hover:border-blue-400 transition-colors shadow-sm">
                        <div className="flex-shrink-0 bg-green-50 p-2 rounded-md">
                            <DocumentPlusIcon className="w-5 h-5 text-green-500"/>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-700 truncate text-sm">
                                {isProcessingFile ? 'Processing...' : (questionFile ? questionFile.name : 'Upload Question')}
                            </p>
                            <p className="text-xs text-slate-400 font-bold uppercase">Problem File</p>
                        </div>
                        <input id="question-file-upload" name="question-file-upload" type="file" className="sr-only" onChange={handleQuestionFileChange} disabled={isProcessingFile || isLoading} accept="image/png, image/jpeg, image/webp, application/pdf" />
                    </label>
                </div>
                {fileError && <p className="text-red-500 text-xs mt-3 flex items-center gap-1 md:col-span-2 font-bold"><XCircleIcon className="w-4 h-4"/>{fileError}</p>}
            </div>
        )}

        <form onSubmit={handleSendMessage} className="flex items-center gap-2 md:gap-3 relative">
          
          {/* Pending File Previews */}
          {pendingFiles.length > 0 && (
              <div className="absolute bottom-full mb-3 left-0 w-full flex gap-2 overflow-x-auto p-1">
                  {pendingFiles.map((f, i) => (
                      <div key={i} className="flex-shrink-0 bg-white border border-slate-200 rounded-lg p-2 flex items-center gap-2 shadow-sm animate-in slide-in-from-bottom-2 fade-in duration-300">
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
                  <label htmlFor="chat-file-upload" className="flex-shrink-0 p-3.5 bg-white rounded-xl hover:bg-slate-50 cursor-pointer text-slate-400 hover:text-blue-600 transition-colors border border-slate-200 hover:border-blue-200 shadow-sm">
                      <PlusIcon className="w-5 h-5" />
                  </label>
              </>
          )}

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={currentTool.placeholder}
            className="flex-1 bg-white border border-slate-200 rounded-xl py-3.5 px-6 text-slate-700 placeholder-slate-400 font-medium focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-sm"
            disabled={isLoading}
          />
          <button
            type="submit"
            className="bg-blue-600 text-white p-3.5 rounded-xl hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-all shadow-md active:translate-y-0.5"
            disabled={!canSubmit}
          >
            <PaperAirplaneIcon className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default Chatbot;