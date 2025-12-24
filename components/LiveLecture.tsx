
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { UploadedFile, QuestScene, QuestState, QuestChallenge } from '../types';
import { startQuest, progressQuest, generatePodcastAudio } from '../services/geminiService';
import { GoogleGenAI, LiveServerMessage, Modality, Blob as GenAiBlob } from '@google/genai';
import { decode, encode, decodeAudioData } from '../utils/audioUtils';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { 
    SparklesIcon, XCircleIcon, HeartIcon, TrophyIcon, 
    ShieldCheckIcon, MapIcon, PuzzlePieceIcon, 
    PlayIcon, PaperAirplaneIcon, 
    SpeakerWaveIcon, MicrophoneIcon,
    LanguageIcon
} from './icons/Icons';

// --- HELPERS ---
export const createBlob = (data: Float32Array): GenAiBlob => {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        int16[i] = data[i] * 32768;
    }
    return {
        data: encode(new Uint8Array(int16.buffer)),
        mimeType: 'audio/pcm;rate=16000',
    };
};

const formatText = (text: string | undefined | null) => {
    if (!text) return '';
    try {
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong class="text-slate-800">$1</strong>')
            .replace(/\n/g, '<br/>');
    } catch (e) {
        console.warn("Text formatting error", e);
        return String(text || '');
    }
};

// --- GAME COMPONENTS ---

const HealthBar: React.FC<{ health: number, max: number }> = ({ health, max }) => {
    return (
        <div className="flex gap-1">
            {Array.from({ length: max }).map((_, i) => (
                <HeartIcon 
                    key={i} 
                    className={`w-6 h-6 transition-colors duration-500 ${i < health ? 'text-red-500 animate-pulse' : 'text-slate-300'}`} 
                />
            ))}
        </div>
    );
}

const QuestHUD: React.FC<{ state: QuestState }> = ({ state }) => {
    return (
        <div className="bg-white text-slate-800 p-4 rounded-xl mb-4 flex items-center justify-between shadow-sm border border-slate-200 flex-shrink-0">
            <div className="flex items-center gap-4">
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <span className="text-xs font-bold text-slate-400 block uppercase">Level</span>
                    <span className="text-xl font-extrabold text-blue-600">{state.level}</span>
                </div>
                <div>
                    <span className="text-xs font-bold text-slate-400 block uppercase">Health</span>
                    <HealthBar health={state.health} max={state.maxHealth} />
                </div>
            </div>
            
            <div className="flex items-center gap-6">
                <div className="text-right">
                    <span className="text-xs font-bold text-slate-400 block uppercase">XP</span>
                    <span className="text-xl font-extrabold text-blue-500">{state.xp}</span>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg flex items-center gap-2 border border-slate-100">
                    <PuzzlePieceIcon className="w-5 h-5 text-purple-500" />
                    <span className="font-bold text-slate-600">{state.inventory.length} Concepts</span>
                </div>
            </div>
        </div>
    )
}

// --- LIVE LECTURE SESSION COMPONENT ---

interface LectureSessionProps { 
    conceptName: string;
    conceptText: string;
    languageStyle: string;
    onStartMission?: () => void; // Optional if used standalone
    onClose?: () => void; // For standalone use
}

export const LectureSession: React.FC<LectureSessionProps> = ({ conceptName, conceptText, languageStyle, onStartMission, onClose }) => {
    const [isActive, setIsActive] = useState(false);
    const [isMicOn, setIsMicOn] = useState(true);
    const [status, setStatus] = useState('Ready to Start');
    const [chatInput, setChatInput] = useState('');
    const [hasPermissionError, setHasPermissionError] = useState(false);
    
    // Chat State
    const [messages, setMessages] = useState<{ role: 'user' | 'model', text: string }[]>([]);
    const [streamingResponse, setStreamingResponse] = useState('');
    const responseAccumulator = useRef('');
    const chatScrollRef = useRef<HTMLDivElement>(null);

    // Audio Refs
    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const nextStartTimeRef = useRef<number>(0);
    const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

    // Auto-scroll chat
    useEffect(() => {
        if (chatScrollRef.current) {
            chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
    }, [messages, streamingResponse]);

    const connect = async () => {
        setHasPermissionError(false);
        setStatus('Initializing Audio...');
        try {
            // Request permissions FIRST to satisfy user gesture requirements
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;

            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

            // Resume contexts immediately
            await inputAudioContextRef.current.resume();
            await outputAudioContextRef.current.resume();

            setStatus('Connecting to AI...');
            const apiKey = process.env.API_KEY || (import.meta as any).env?.VITE_API_KEY;
            const ai = new GoogleGenAI({ apiKey });

            const systemInstruction = `You are "Professor Zero", an expert professor giving a comprehensive lecture.
            - **Topic**: "${conceptName}".
            - **Lecture Notes**: "${conceptText}".
            - **Goal**: Teach this topic in extreme detail. The user wants to know everything contained in the notes.
            - **Language Style**: ${languageStyle}.
            - **Strategy**:
              1. **Be Thorough**: Do not gloss over details. Explain the definitions, the mechanics, the examples, and the nuances found in the Lecture Notes.
              2. **Structure**: Move logically from definitions to deep concepts.
              3. **Check-ins**: After covering a dense section, pause and ask the student if they follow.
              4. **Q&A**: If the student asks a question, answer it with depth.
            - Speak naturally but retain the academic rigor.`;

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    outputAudioTranscription: {}, // Enable transcription to show model's text
                    systemInstruction: systemInstruction,
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },
                },
                callbacks: {
                    onopen: () => {
                        setIsActive(true);
                        setStatus('Professor Zero is speaking...');
                        sessionPromiseRef.current?.then(session => {
                            session.sendRealtimeInput([{ text: "Start the lecture now. Greet the class, introduce the topic, and begin the deep-dive explanation." }]);
                        });
                        
                        // Setup Mic Stream
                        const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
                        const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = scriptProcessor;
                        
                        scriptProcessor.onaudioprocess = (e) => {
                            if (!isMicOn) return; // Mute logic
                            const inputData = e.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            sessionPromiseRef.current?.then(session => session.sendRealtimeInput({ media: pcmBlob }));
                        };
                        
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContextRef.current!.destination);
                    },
                    onmessage: async (msg: LiveServerMessage) => {
                        // Handle Text Transcription (Captions)
                        if (msg.serverContent?.outputTranscription) {
                            const text = msg.serverContent.outputTranscription.text;
                            responseAccumulator.current += text;
                            setStreamingResponse(responseAccumulator.current);
                        }
                        
                        if (msg.serverContent?.turnComplete) {
                            if (responseAccumulator.current.trim()) {
                                setMessages(prev => [...prev, { role: 'model', text: responseAccumulator.current }]);
                            }
                            responseAccumulator.current = '';
                            setStreamingResponse('');
                        }

                        // Handle Audio
                        const base64Audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                        if (base64Audio) {
                            const ctx = outputAudioContextRef.current!;
                            
                            // Resume if suspended (browser policy)
                            if (ctx.state === 'suspended') await ctx.resume();

                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                            const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
                            const source = ctx.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(ctx.destination);
                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;
                            audioSourcesRef.current.add(source);
                        }
                        
                        if (msg.serverContent?.interrupted) {
                             audioSourcesRef.current.forEach(source => source.stop());
                             audioSourcesRef.current.clear();
                             nextStartTimeRef.current = 0;
                             responseAccumulator.current = '';
                             setStreamingResponse('');
                        }
                    },
                    onclose: () => { setIsActive(false); setStatus('Lecture Paused'); },
                    onerror: (e) => { 
                        console.error(e); 
                        setStatus('Connection Error'); 
                        setIsActive(false);
                    }
                }
            });

        } catch (e) {
            console.error(e);
            setHasPermissionError(true);
            setStatus('Permission Denied');
        }
    };

    const disconnect = useCallback(() => {
        if (sessionPromiseRef.current) {
            sessionPromiseRef.current.then(s => s.close());
            sessionPromiseRef.current = null;
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(t => t.stop());
        }
        
        if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
            inputAudioContextRef.current.close();
        }
        if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
            outputAudioContextRef.current.close();
        }
        setIsActive(false);
        setStatus('Ready to Start');
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => disconnect();
    }, []); // Removed deps to prevent auto-restart loop

    // Handle Mic Toggle
    const toggleMic = () => {
        setIsMicOn(!isMicOn);
    };

    // Handle Text Input (Chat with Professor)
    const sendText = (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim()) return;
        if (!isActive) {
            alert("Please start the lecture first!");
            return;
        }
        
        // Optimistically add user message
        setMessages(prev => [...prev, { role: 'user', text: chatInput }]);
        
        sessionPromiseRef.current?.then(session => {
            session.sendRealtimeInput([{ text: chatInput }]);
        });
        setChatInput('');
    };

    return (
        <div className="h-full flex flex-col relative bg-white rounded-xl overflow-hidden shadow-sm border border-slate-200">
            {onClose && (
                <button 
                    onClick={() => { disconnect(); onClose(); }} 
                    className="absolute top-4 right-4 z-50 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full p-2 transition-colors shadow-sm"
                >
                    <XCircleIcon className="w-6 h-6" />
                </button>
            )}

            {/* Slide Content Wrapper - Flex-1 to take available space, relative for positioning */}
            <div className="flex-1 relative min-h-0">
                {/* Scrollable Content */}
                <div className="absolute inset-0 overflow-y-auto p-4 md:p-6 custom-scrollbar pb-64">
                    <div className="flex items-center gap-2 mb-4 md:mb-6">
                        <span className={`flex h-3 w-3 rounded-full ${isActive ? 'bg-red-500 animate-pulse' : 'bg-slate-300'}`}></span>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                            {isActive ? 'Live Lecture' : 'Paused'}
                        </span>
                    </div>
                    
                    <h4 className="text-xs font-extrabold text-blue-600 uppercase tracking-widest mb-2 mt-2">Current Topic</h4>
                    <h2 className="text-xl md:text-2xl font-black text-slate-800 mb-4 md:mb-6 leading-tight">{conceptName}</h2>
                    
                    <div className="prose prose-slate prose-sm md:prose-lg max-w-none text-slate-600 leading-relaxed font-medium" dangerouslySetInnerHTML={{ __html: formatText(conceptText) }}>
                    </div>
                </div>

                {/* Start Overlay */}
                {!isActive && !hasPermissionError && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-6 text-center">
                        <div className="bg-blue-50 p-6 rounded-full mb-6 animate-bounce">
                            <SpeakerWaveIcon className="w-12 h-12 text-blue-600" />
                        </div>
                        <h3 className="text-2xl font-extrabold text-slate-800 mb-2">Ready for Class?</h3>
                        <p className="text-slate-500 font-medium mb-8 max-w-sm">
                            Enable your microphone to interact with Professor Zero. Ask questions anytime during the lecture.
                        </p>
                        <button 
                            onClick={connect}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold py-3 md:py-4 px-8 md:px-10 rounded-xl shadow-lg transition-transform active:scale-95 flex items-center gap-3"
                        >
                            <PlayIcon className="w-6 h-6" />
                            Start Lecture
                        </button>
                    </div>
                )}
                
                {/* Permission Error Overlay */}
                {hasPermissionError && (
                    <div className="absolute inset-0 bg-white/90 z-40 flex flex-col items-center justify-center p-6 text-center">
                        <XCircleIcon className="w-16 h-16 text-red-500 mb-4" />
                        <h3 className="text-xl font-bold text-slate-800">Microphone Access Denied</h3>
                        <p className="text-slate-500 font-medium mt-2 max-w-xs">
                            Please allow microphone access in your browser settings to use this feature.
                        </p>
                        <button 
                            onClick={connect}
                            className="mt-6 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 px-6 rounded-lg transition-colors"
                        >
                            Try Again
                        </button>
                    </div>
                )}

                {/* Floating Chat Overlay - Sticky to bottom of viewer */}
                {(messages.length > 0 || streamingResponse) && (
                    <div className="absolute bottom-0 left-0 right-0 p-4 z-20 pointer-events-none bg-gradient-to-t from-white via-white/95 to-transparent pt-12">
                         <div 
                            ref={chatScrollRef}
                            className="bg-white/90 backdrop-blur-md border border-slate-200 shadow-lg rounded-xl p-3 max-h-48 md:max-h-60 overflow-y-auto custom-scrollbar flex flex-col gap-2 pointer-events-auto max-w-3xl mx-auto w-full"
                        >
                            {messages.map((msg, i) => (
                                <div key={i} className={`text-sm font-medium ${msg.role === 'user' ? 'text-blue-600 text-right' : 'text-slate-700'}`}>
                                    <span className="font-bold uppercase text-[10px] text-slate-400 block mb-0.5">{msg.role === 'user' ? 'You' : 'Professor Zero'}</span>
                                    {msg.text}
                                </div>
                            ))}
                            {streamingResponse && (
                                <div className="text-sm font-medium text-slate-700">
                                    <span className="font-bold uppercase text-[10px] text-slate-400 block mb-0.5">Professor Zero</span>
                                    {streamingResponse}
                                    <span className="inline-block w-1.5 h-3 bg-blue-500 ml-1 animate-pulse align-middle"></span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Interaction Bar */}
            <div className="bg-slate-50 p-3 md:p-4 border-t border-slate-200 relative z-30 shrink-0">
                <div className="flex flex-col gap-3">
                     <div className="flex items-center gap-2 md:gap-4">
                        <button 
                            onClick={toggleMic}
                            disabled={!isActive}
                            className={`p-3 rounded-full transition-all border shrink-0 ${isMicOn && isActive ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}
                        >
                            {isMicOn ? <MicrophoneIcon className="w-5 h-5" /> : <SpeakerWaveIcon className="w-5 h-5" />}
                        </button>
                        
                        <form onSubmit={sendText} className="flex-1 flex gap-2 min-w-0">
                            <input 
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                placeholder={isActive ? "Ask a doubt..." : "Start lecture to chat..."}
                                disabled={!isActive}
                                className="flex-1 bg-white border border-slate-200 rounded-lg px-3 md:px-4 py-2 font-medium text-slate-700 focus:outline-none focus:border-blue-500 transition-colors disabled:bg-slate-100 disabled:text-slate-400 text-sm md:text-base min-w-0"
                            />
                            <button 
                                type="submit" 
                                disabled={!isActive || !chatInput.trim()}
                                className="bg-blue-600 text-white p-2 md:p-3 rounded-lg hover:bg-blue-700 shadow-sm active:translate-y-0.5 disabled:bg-slate-200 disabled:cursor-not-allowed shrink-0"
                            >
                                <PaperAirplaneIcon className="w-5 h-5" />
                            </button>
                        </form>
                    </div>

                    <div className="flex justify-between items-center">
                        <p className={`text-xs font-bold uppercase tracking-wide truncate pr-2 ${isActive ? 'text-green-600' : 'text-slate-400'}`}>
                            {status}
                        </p>
                        {onStartMission && (
                            <button 
                                onClick={() => { disconnect(); onStartMission(); }}
                                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 md:py-3 md:px-8 rounded-lg flex items-center gap-2 shadow-md transition-all active:translate-y-0.5 text-xs md:text-sm whitespace-nowrap"
                            >
                                <span>Start Mission</span>
                                <PlayIcon className="w-4 h-4 md:w-5 md:h-5" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};


// --- MAIN COMPONENT ---

const NarrativeDisplay: React.FC<{ text: string }> = ({ text }) => {
    const { play, stop, isPlaying } = useAudioPlayer({ sampleRate: 24000 });
    const [hasPlayed, setHasPlayed] = useState(false);

    useEffect(() => {
        // Auto-play narrative when text changes
        const autoNarrate = async () => {
            if (!text) return;
            try {
                const audioBase64 = await generatePodcastAudio(text);
                if (audioBase64) {
                    play(decode(audioBase64));
                    setHasPlayed(true);
                }
            } catch (e) {
                console.error("Narrator failed:", e);
            }
        };

        setHasPlayed(false);
        stop();
        autoNarrate();

        return () => stop();
    }, [text]); // Re-run when text changes

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-6 relative overflow-hidden flex-shrink-0">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
             
             <div className="flex justify-between items-start mb-2">
                 <h4 className="text-xs font-bold text-blue-600 uppercase tracking-widest">Professor Zero</h4>
                 {isPlaying && (
                     <div className="flex items-center gap-1">
                         <span className="w-1 h-3 bg-blue-500 rounded-full animate-pulse"></span>
                         <span className="w-1 h-2 bg-blue-500 rounded-full animate-pulse [animation-delay:0.1s]"></span>
                         <span className="w-1 h-3 bg-blue-500 rounded-full animate-pulse [animation-delay:0.2s]"></span>
                     </div>
                 )}
             </div>

             <p className="text-lg md:text-xl font-medium text-slate-800 leading-relaxed whitespace-pre-wrap animate-in fade-in duration-700 font-sans">
                 {text}
             </p>
        </div>
    )
}

const ChallengeDisplay: React.FC<{ challenge: QuestChallenge, onAction: (ans: string) => void, isProcessing: boolean, index: number, total: number }> = ({ challenge, onAction, isProcessing, index, total }) => {
    return (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 shadow-sm animate-in slide-in-from-bottom-4 flex-shrink-0 mb-4">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <ShieldCheckIcon className="w-6 h-6 text-blue-600" />
                    <h3 className="text-xl font-extrabold text-slate-800">Concept Check</h3>
                </div>
                <div className="bg-white text-blue-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border border-slate-200 shadow-sm">
                    Question {index + 1} of {total}
                </div>
            </div>
            
            <p className="text-lg font-bold text-slate-700 mb-6">{challenge.question}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {challenge.options.map((opt, i) => (
                    <button
                        key={i}
                        disabled={isProcessing}
                        onClick={() => onAction(opt)}
                        className="bg-white hover:bg-slate-100 text-slate-600 hover:text-blue-600 font-bold py-4 px-6 rounded-xl border border-slate-200 hover:border-blue-300 transition-all text-left shadow-sm active:translate-y-0.5"
                    >
                        {opt}
                    </button>
                ))}
            </div>
        </div>
    )
}


const LiveLecture: React.FC<{ files: UploadedFile[] }> = ({ files }) => {
    const [gameState, setGameState] = useState<QuestState>({
        health: 3,
        maxHealth: 3,
        xp: 0,
        level: 1,
        inventory: [],
        isGameOver: false
    });
    
    const [currentScene, setCurrentScene] = useState<QuestScene | null>(null);
    const [activeChallengeIndex, setActiveChallengeIndex] = useState(0); // Track which question we are on
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasStarted, setHasStarted] = useState(false);
    const [viewMode, setViewMode] = useState<'briefing' | 'action'>('briefing');
    
    // Language Settings
    const [language, setLanguage] = useState('English');
    const [showLanguageMenu, setShowLanguageMenu] = useState(false);
    const languages = ['English', 'Hinglish (Hindi+English)', 'Spanish Mix', 'French Mix'];

    const initQuest = useCallback(async () => {
        setIsProcessing(true);
        setError(null);
        try {
            const scene = await startQuest(files);
            setCurrentScene(scene);
            setActiveChallengeIndex(0);
            setHasStarted(true);
            setViewMode('briefing'); 
            setGameState({
                health: 3,
                maxHealth: 3,
                xp: 0,
                level: 1,
                inventory: [],
                isGameOver: false
            });
        } catch (e) {
            console.error(e);
            setError("Failed to generate quest. Please try again.");
        } finally {
            setIsProcessing(false);
        }
    }, [files]);

    const startMission = () => {
        setViewMode('action');
    };

    const handleAction = async (choice: string) => {
        if (!currentScene) return;
        setIsProcessing(true);

        const currentChallenge = currentScene.challenges[activeChallengeIndex];
        const isCorrect = choice === currentChallenge.correctAnswer;
        
        // Immediate Feedback / State Update
        setGameState(prev => {
            const newHealth = isCorrect ? prev.health : Math.max(0, prev.health - 1);
            const newXP = prev.xp + (isCorrect ? 50 : 0); // 50 XP per question
            return {
                ...prev,
                health: newHealth,
                xp: newXP,
                level: Math.floor(newXP / 500) + 1,
                isGameOver: newHealth <= 0
            };
        });

        // Check if game over immediately
        if (!isCorrect && gameState.health - 1 <= 0) {
             setIsProcessing(false);
             return;
        }

        // Logic: Are there more questions in this scene?
        if (activeChallengeIndex < currentScene.challenges.length - 1) {
            // Move to next question immediately
            setTimeout(() => {
                setActiveChallengeIndex(prev => prev + 1);
                setIsProcessing(false);
            }, 500); // Small delay for visual feedback
        } else {
            // Last question answered, fetch NEXT SCENE
            try {
                const nextScene = await progressQuest(files, currentScene.narrative, choice, isCorrect);
                
                // Final state update from API (mostly for inventory/narrative)
                setGameState(prev => {
                    const newInventory = nextScene.conceptUnlocked ? [...prev.inventory, nextScene.conceptUnlocked] : prev.inventory;
                    return { ...prev, inventory: newInventory };
                });

                if (gameState.health > 0) {
                     setCurrentScene(nextScene);
                     setActiveChallengeIndex(0); // Reset for new scene
                     setViewMode('briefing'); // Back to Briefing for the NEXT concept
                }

            } catch (e) {
                 console.error(e);
                 setError("Connection lost with the Dungeon Master.");
            } finally {
                setIsProcessing(false);
            }
        }
    };

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center">
                <XCircleIcon className="w-16 h-16 text-red-500 mb-4" />
                <h3 className="text-xl font-bold text-slate-800">Quest Error</h3>
                <p className="text-slate-500 mb-4">{error}</p>
                <button onClick={initQuest} className="bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors">Try Again</button>
            </div>
        )
    }

    if (!hasStarted) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <div className="bg-white p-8 rounded-full mb-8 animate-bounce border border-slate-200 shadow-sm">
                    <MapIcon className="w-12 h-12 text-blue-600" />
                </div>
                <h2 className="text-3xl font-extrabold text-slate-800 mb-4">Quest Mode</h2>
                <p className="text-lg text-slate-500 font-medium max-w-lg mb-8">
                    High-Velocity Gamified Lectures. Master concepts through rapid-fire challenges.
                </p>
                
                <div className="relative mb-8">
                    <button 
                        onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                        className="bg-white border border-slate-200 text-slate-600 font-bold py-3 px-6 rounded-lg flex items-center gap-2 hover:border-blue-400 transition-colors shadow-sm"
                    >
                        <LanguageIcon className="w-5 h-5 text-slate-400" />
                        Teaching Language: <span className="text-blue-600">{language}</span>
                    </button>
                    {showLanguageMenu && (
                        <div className="absolute top-full mt-2 left-0 w-full bg-white border border-slate-200 rounded-lg shadow-xl z-20 overflow-hidden">
                            {languages.map(lang => (
                                <button
                                    key={lang}
                                    onClick={() => { setLanguage(lang); setShowLanguageMenu(false); }}
                                    className="w-full text-left px-4 py-3 hover:bg-slate-50 font-medium text-slate-600 text-sm"
                                >
                                    {lang}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <button 
                    onClick={initQuest} 
                    disabled={isProcessing}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold py-4 px-10 rounded-lg flex items-center gap-3 shadow-md transition-all active:translate-y-0.5"
                >
                    {isProcessing ? <SparklesIcon className="w-5 h-5 animate-spin"/> : <TrophyIcon className="w-5 h-5"/>}
                    {isProcessing ? 'Initializing Simulation...' : 'Enter Simulation'}
                </button>
            </div>
        )
    }

    if (gameState.isGameOver) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 bg-red-50 rounded-xl border border-red-100">
                <div className="bg-white p-6 rounded-full mb-6 border border-red-100 shadow-sm">
                    <XCircleIcon className="w-16 h-16 text-red-500" />
                </div>
                <h2 className="text-4xl font-black text-red-600 mb-2">MISSION FAILED</h2>
                <p className="text-xl text-red-500 font-bold mb-8">You were unprepared for the challenge.</p>
                <div className="bg-white p-6 rounded-xl shadow-sm mb-8 border border-slate-200">
                    <p className="font-bold text-slate-400 uppercase tracking-widest text-xs">Final Stats</p>
                    <div className="flex gap-8 mt-2">
                        <div><span className="text-2xl font-black text-slate-800">{gameState.level}</span> <span className="text-xs font-bold text-slate-400">LVL</span></div>
                        <div><span className="text-2xl font-black text-slate-800">{gameState.xp}</span> <span className="text-xs font-bold text-slate-400">XP</span></div>
                        <div><span className="text-2xl font-black text-slate-800">{gameState.inventory.length}</span> <span className="text-xs font-bold text-slate-400">CONCEPTS</span></div>
                    </div>
                </div>
                <button 
                    onClick={initQuest}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-lg transition-all shadow-md active:translate-y-0.5"
                >
                    Restart Simulation
                </button>
            </div>
        )
    }

    return (
        <div className="h-full flex flex-col max-w-4xl mx-auto relative overflow-hidden">
            {/* View Switching Logic */}
            {viewMode === 'briefing' && currentScene ? (
                <LectureSession 
                    conceptName={currentScene.conceptName}
                    conceptText={currentScene.conceptExplanation}
                    languageStyle={language}
                    onStartMission={startMission}
                    onClose={undefined}
                />
            ) : (
                <>
                    <QuestHUD state={gameState} />
                    
                    <div className="flex-1 overflow-y-auto pb-6 scrollbar-hide custom-scrollbar">
                        {currentScene ? (
                            <>
                                <NarrativeDisplay text={currentScene.narrative} />
                                
                                {isProcessing ? (
                                    <div className="flex justify-center p-8">
                                        <div className="flex items-center gap-2 text-blue-500 font-bold animate-pulse">
                                            <SparklesIcon className="w-5 h-5" />
                                            <span>Processing Action...</span>
                                        </div>
                                    </div>
                                ) : (
                                    <ChallengeDisplay 
                                        challenge={currentScene.challenges[activeChallengeIndex]} 
                                        onAction={handleAction} 
                                        isProcessing={isProcessing} 
                                        index={activeChallengeIndex}
                                        total={currentScene.challenges.length}
                                    />
                                )}
                            </>
                        ) : (
                            <div className="flex justify-center p-12">
                                <SparklesIcon className="w-12 h-12 text-slate-300 animate-spin" />
                            </div>
                        )}
                    </div>
                    
                    <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-widest mt-2 flex-shrink-0">
                        <span>Simulation Active</span>
                        <span>Powered by Gemini 2.5</span>
                    </div>
                </>
            )}
        </div>
    );
};

export default LiveLecture;
