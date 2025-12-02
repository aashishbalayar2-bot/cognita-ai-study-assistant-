import React, { useState, useEffect, useCallback, useRef } from 'react';
import { UploadedFile, QuestScene, QuestState, QuestChallenge } from '../types';
import { startQuest, progressQuest, generatePodcastAudio } from '../services/geminiService';
import { GoogleGenAI, LiveServerMessage, Modality, Blob as GenAiBlob } from '@google/genai';
import { decode, encode, decodeAudioData } from '../utils/audioUtils';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { 
    SparklesIcon, XCircleIcon, HeartIcon, TrophyIcon, 
    ShieldCheckIcon, MapIcon, PuzzlePieceIcon, ArrowPathIcon,
    BookOpenIcon, PlayIcon, HandRaisedIcon, PaperAirplaneIcon, 
    SpeakerWaveIcon, MicrophoneIcon, StopIcon, ChatBubbleLeftRightIcon,
    LanguageIcon
} from './icons/Icons';

// --- HELPERS ---
const createBlob = (data: Float32Array): GenAiBlob => {
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
        <div className="bg-slate-900 text-white p-4 rounded-3xl mb-4 flex items-center justify-between shadow-lg border-b-4 border-slate-700 flex-shrink-0">
            <div className="flex items-center gap-4">
                <div className="bg-slate-800 p-2 rounded-xl">
                    <span className="text-xs font-bold text-slate-400 block uppercase">Level</span>
                    <span className="text-xl font-extrabold text-yellow-400">{state.level}</span>
                </div>
                <div>
                    <span className="text-xs font-bold text-slate-400 block uppercase">Health</span>
                    <HealthBar health={state.health} max={state.maxHealth} />
                </div>
            </div>
            
            <div className="flex items-center gap-6">
                <div className="text-right">
                    <span className="text-xs font-bold text-slate-400 block uppercase">XP</span>
                    <span className="text-xl font-extrabold text-sky-400">{state.xp}</span>
                </div>
                <div className="bg-slate-800 p-2 rounded-xl flex items-center gap-2">
                    <PuzzlePieceIcon className="w-5 h-5 text-purple-400" />
                    <span className="font-bold">{state.inventory.length} Concepts</span>
                </div>
            </div>
        </div>
    )
}

// --- LIVE LECTURE SESSION COMPONENT ---

const LectureSession: React.FC<{ 
    conceptName: string;
    conceptText: string;
    languageStyle: string;
    onStartMission: () => void;
}> = ({ conceptName, conceptText, languageStyle, onStartMission }) => {
    const [isActive, setIsActive] = useState(false);
    const [isMicOn, setIsMicOn] = useState(true);
    const [status, setStatus] = useState('Connecting to Professor Zero...');
    const [chatInput, setChatInput] = useState('');

    // Audio Refs
    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const nextStartTimeRef = useRef<number>(0);
    const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

    const connect = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;

            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

            const apiKey = process.env.API_KEY || (import.meta as any).env?.VITE_API_KEY;
            const ai = new GoogleGenAI({ apiKey });

            const systemInstruction = `You are "Professor Zero", a charismatic university professor.
            - **Goal**: Explain the concept on the slide: "${conceptName}".
            - **Context content**: "${conceptText}".
            - **Language Style**: ${languageStyle} (e.g. if 'Hinglish', mix Hindi and English naturally. If 'English', use standard academic English).
            - **Pedagogy**: Do NOT just read the text. Explain the *intuition* behind it. Use analogies.
            - **Interaction**: 
              1. Start by explaining the core idea.
              2. PAUSE after a few sentences and explicitly ask: "Did you get that?" or "Samajh aaya?" (in context).
              3. If the user speaks/chats, stop and clarify their doubt immediately.
            - Keep it engaging and spoken-style.`;

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    systemInstruction: systemInstruction,
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },
                },
                callbacks: {
                    onopen: () => {
                        setIsActive(true);
                        setStatus('Professor Zero is speaking...');
                        sessionPromiseRef.current?.then(session => {
                            session.sendRealtimeInput([{ text: "Start the lecture now. Greet the class and explain the concept." }]);
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
                        const base64Audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                        if (base64Audio) {
                            const ctx = outputAudioContextRef.current!;
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                            const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
                            const source = ctx.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(ctx.destination);
                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;
                            audioSourcesRef.current.add(source);
                        }
                    },
                    onclose: () => { setIsActive(false); setStatus('Lecture Paused'); },
                    onerror: (e) => { console.error(e); setStatus('Connection Error'); }
                }
            });

        } catch (e) {
            console.error(e);
            setStatus('Mic Access Denied');
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
        inputAudioContextRef.current?.close();
        outputAudioContextRef.current?.close();
        setIsActive(false);
    }, []);

    // Auto-connect on mount
    useEffect(() => {
        connect();
        return () => disconnect();
    }, [conceptName, languageStyle]);

    // Handle Mic Toggle
    const toggleMic = () => {
        setIsMicOn(!isMicOn);
    };

    // Handle Text Input (Chat with Professor)
    const sendText = (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim()) return;
        sessionPromiseRef.current?.then(session => {
            session.sendRealtimeInput([{ text: chatInput }]);
        });
        setChatInput('');
    };

    return (
        <div className="h-full flex flex-col">
            {/* Slide Content */}
            <div className="flex-1 bg-white rounded-t-3xl p-6 overflow-y-auto border-b-2 border-slate-100 relative">
                <div className="absolute top-4 right-4 flex items-center gap-2">
                    <span className={`flex h-3 w-3 rounded-full ${isActive ? 'bg-red-500 animate-pulse' : 'bg-slate-300'}`}></span>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                        {isActive ? 'Live Lecture' : 'Paused'}
                    </span>
                </div>
                
                <h4 className="text-sm font-extrabold text-blue-500 uppercase tracking-widest mb-2">High-Yield Micro-Lecture</h4>
                <h2 className="text-3xl font-black text-slate-800 mb-6">{conceptName}</h2>
                <div className="prose prose-slate prose-lg max-w-none text-slate-600 leading-relaxed font-medium" dangerouslySetInnerHTML={{ __html: conceptText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>') }}>
                </div>
            </div>

            {/* Interaction Bar */}
            <div className="bg-slate-50 p-4 border-t-2 border-slate-200 rounded-b-3xl">
                <div className="flex items-center gap-4 mb-4">
                    <button 
                        onClick={toggleMic}
                        className={`p-4 rounded-full transition-all ${isMicOn ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-400'}`}
                    >
                        {isMicOn ? <MicrophoneIcon className="w-6 h-6" /> : <SpeakerWaveIcon className="w-6 h-6" />}
                    </button>
                    
                    <form onSubmit={sendText} className="flex-1 flex gap-2">
                        <input 
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder="Ask Professor Zero a doubt..."
                            className="flex-1 bg-white border-2 border-slate-200 rounded-xl px-4 font-bold text-slate-700 focus:outline-none focus:border-blue-500"
                        />
                        <button type="submit" className="bg-blue-500 text-white p-3 rounded-xl hover:bg-blue-600">
                            <PaperAirplaneIcon className="w-5 h-5" />
                        </button>
                    </form>
                </div>

                <div className="flex justify-between items-center">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                        {status}
                    </p>
                    <button 
                        onClick={() => { disconnect(); onStartMission(); }}
                        className="bg-green-500 hover:bg-green-400 text-white font-bold py-3 px-8 rounded-2xl flex items-center gap-2 border-b-4 border-green-700 active:border-b-0 active:translate-y-1 transition-all shadow-md"
                    >
                        <span>START MISSION</span>
                        <PlayIcon className="w-5 h-5" />
                    </button>
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
        <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm mb-6 relative overflow-hidden flex-shrink-0">
             <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-purple-500"></div>
             
             <div className="flex justify-between items-start mb-2">
                 <h4 className="text-xs font-bold text-purple-500 uppercase tracking-widest">Professor Zero</h4>
                 {isPlaying && (
                     <div className="flex items-center gap-1">
                         <span className="w-1 h-3 bg-purple-500 rounded-full animate-pulse"></span>
                         <span className="w-1 h-2 bg-purple-500 rounded-full animate-pulse [animation-delay:0.1s]"></span>
                         <span className="w-1 h-3 bg-purple-500 rounded-full animate-pulse [animation-delay:0.2s]"></span>
                     </div>
                 )}
             </div>

             <p className="text-lg md:text-xl font-medium text-slate-800 leading-relaxed whitespace-pre-wrap animate-in fade-in duration-700">
                 {text}
             </p>
        </div>
    )
}

const ChallengeDisplay: React.FC<{ challenge: QuestChallenge, onAction: (ans: string) => void, isProcessing: boolean, index: number, total: number }> = ({ challenge, onAction, isProcessing, index, total }) => {
    return (
        <div className="bg-blue-50 border-4 border-blue-200 rounded-3xl p-6 shadow-sm animate-in slide-in-from-bottom-4 flex-shrink-0 mb-4">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <ShieldCheckIcon className="w-8 h-8 text-blue-600" />
                    <h3 className="text-xl font-extrabold text-blue-900">Concept Check</h3>
                </div>
                <div className="bg-blue-200 text-blue-800 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
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
                        className="bg-white hover:bg-sky-100 text-slate-700 hover:text-sky-800 font-bold py-4 px-6 rounded-2xl border-b-4 border-slate-300 hover:border-sky-300 active:border-b-0 active:translate-y-1 transition-all text-left"
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
                <button onClick={initQuest} className="bg-sky-500 text-white font-bold py-3 px-6 rounded-2xl">Try Again</button>
            </div>
        )
    }

    if (!hasStarted) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <div className="bg-sky-100 p-8 rounded-full mb-8 animate-bounce">
                    <MapIcon className="w-16 h-16 text-sky-600" />
                </div>
                <h2 className="text-4xl font-extrabold text-slate-800 mb-4">Quest Mode</h2>
                <p className="text-xl text-slate-500 font-medium max-w-lg mb-8">
                    High-Velocity Gamified Lectures. Master concepts through rapid-fire challenges.
                </p>
                
                <div className="relative mb-8">
                    <button 
                        onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                        className="bg-white border-2 border-slate-200 text-slate-700 font-bold py-3 px-6 rounded-xl flex items-center gap-2 hover:border-blue-400 transition-colors"
                    >
                        <LanguageIcon className="w-5 h-5 text-slate-400" />
                        Teaching Language: <span className="text-blue-600">{language}</span>
                    </button>
                    {showLanguageMenu && (
                        <div className="absolute top-full mt-2 left-0 w-full bg-white border-2 border-slate-200 rounded-xl shadow-xl z-20 overflow-hidden">
                            {languages.map(lang => (
                                <button
                                    key={lang}
                                    onClick={() => { setLanguage(lang); setShowLanguageMenu(false); }}
                                    className="w-full text-left px-4 py-3 hover:bg-slate-50 font-bold text-slate-600 text-sm"
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
                    className="bg-sky-500 hover:bg-sky-400 text-white text-xl font-extrabold py-5 px-10 rounded-2xl border-b-8 border-sky-700 active:border-b-0 active:translate-y-2 transition-all flex items-center gap-3"
                >
                    {isProcessing ? <SparklesIcon className="w-6 h-6 animate-spin"/> : <TrophyIcon className="w-6 h-6"/>}
                    {isProcessing ? 'Initializing Simulation...' : 'ENTER SIMULATION'}
                </button>
            </div>
        )
    }

    if (gameState.isGameOver) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 bg-red-50 rounded-3xl border-4 border-red-100">
                <div className="bg-red-100 p-6 rounded-full mb-6">
                    <XCircleIcon className="w-20 h-20 text-red-500" />
                </div>
                <h2 className="text-5xl font-black text-red-900 mb-2">MISSION FAILED</h2>
                <p className="text-xl text-red-700 font-bold mb-8">You were unprepared for the challenge.</p>
                <div className="bg-white p-6 rounded-2xl shadow-sm mb-8">
                    <p className="font-bold text-slate-500 uppercase tracking-widest text-xs">Final Stats</p>
                    <div className="flex gap-8 mt-2">
                        <div><span className="text-2xl font-black text-slate-800">{gameState.level}</span> <span className="text-xs font-bold text-slate-400">LVL</span></div>
                        <div><span className="text-2xl font-black text-slate-800">{gameState.xp}</span> <span className="text-xs font-bold text-slate-400">XP</span></div>
                        <div><span className="text-2xl font-black text-slate-800">{gameState.inventory.length}</span> <span className="text-xs font-bold text-slate-400">CONCEPTS</span></div>
                    </div>
                </div>
                <button 
                    onClick={initQuest}
                    className="bg-red-500 hover:bg-red-400 text-white font-bold py-4 px-8 rounded-2xl border-b-4 border-red-700 active:border-b-0 active:translate-y-1 transition-all"
                >
                    RESTART SIMULATION
                </button>
            </div>
        )
    }

    return (
        <div className="h-full flex flex-col max-w-3xl mx-auto relative overflow-hidden">
            {/* View Switching Logic */}
            {viewMode === 'briefing' && currentScene ? (
                <LectureSession 
                    conceptName={currentScene.conceptName}
                    conceptText={currentScene.conceptExplanation}
                    languageStyle={language}
                    onStartMission={startMission}
                />
            ) : (
                <>
                    <QuestHUD state={gameState} />
                    
                    <div className="flex-1 overflow-y-auto pb-6 scrollbar-hide">
                        {currentScene ? (
                            <>
                                <NarrativeDisplay text={currentScene.narrative} />
                                
                                {isProcessing ? (
                                    <div className="flex justify-center p-8">
                                        <div className="flex items-center gap-2 text-sky-500 font-bold animate-pulse">
                                            <SparklesIcon className="w-6 h-6" />
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
                    
                    <div className="flex justify-between items-center text-xs font-bold text-slate-300 uppercase tracking-widest mt-2 flex-shrink-0">
                        <span>Simulation Active</span>
                        <span>Powered by Gemini 2.5</span>
                    </div>
                </>
            )}
        </div>
    );
};

export default LiveLecture;