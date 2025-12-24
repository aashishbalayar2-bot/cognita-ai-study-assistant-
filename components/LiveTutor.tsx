
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob as GenAiBlob } from '@google/genai';
import { decode, encode, decodeAudioData } from '../utils/audioUtils';
import { 
    VideoCameraIcon, StopCircleIcon, SparklesIcon, ArrowPathIcon, 
    SpeakerWaveIcon, XCircleIcon, PaperAirplaneIcon, MicrophoneIcon, UserIcon
} from './icons/Icons';

// Helper to create a PCM blob for the API
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

const LiveTutor: React.FC = () => {
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [status, setStatus] = useState('Ready to start');
    const [error, setError] = useState<string | null>(null);
    const [audioVolume, setAudioVolume] = useState(0); // Visualizer state
    
    // Chat State
    const [messages, setMessages] = useState<{ role: 'user' | 'model', text: string }[]>([]);
    const [streamingMessage, setStreamingMessage] = useState<string>('');
    const [input, setInput] = useState('');
    const [isMicOn, setIsMicOn] = useState(true); // Default to mic on for video calls

    // HTML Refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    
    // Session Refs
    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const nextStartTimeRef = useRef<number>(0);
    const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const videoIntervalRef = useRef<number | null>(null);
    const currentInputTranscription = useRef('');
    const currentOutputTranscription = useRef('');

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, streamingMessage]);

    const stopSession = useCallback(() => {
        if (sessionPromiseRef.current) {
            sessionPromiseRef.current.then(session => session.close());
            sessionPromiseRef.current = null;
        }

        if (videoIntervalRef.current) {
            window.clearInterval(videoIntervalRef.current);
            videoIntervalRef.current = null;
        }

        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }

        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        
        if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
            inputAudioContextRef.current.close();
        }
        if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
            outputAudioContextRef.current.close();
        }
        
        for (const source of audioSourcesRef.current.values()) {
            source.stop();
        }
        audioSourcesRef.current.clear();
        nextStartTimeRef.current = 0;

        setIsSessionActive(false);
        setStatus('Session ended');
    }, []);

    const startSession = async () => {
        setError(null);
        setStatus('Requesting camera access...');
        
        // Fix: Use process.env.API_KEY directly as per guidelines.
        const apiKey = process.env.API_KEY;
        if (!apiKey) {
            setError("API Key not found.");
            setIsSessionActive(false);
            return;
        }
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: true, 
                video: { 
                    facingMode: { ideal: 'environment' }, 
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                } 
            });
            
            mediaStreamRef.current = stream;
            
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }

            setStatus('Connecting to Professor Zero...');

            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            
            const ai = new GoogleGenAI({ apiKey: apiKey });

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
                    systemInstruction: `You are "Professor Zero", an expert visual AI tutor.
                    1. **ACCURACY IS PARAMOUNT**. You must carefully analyze the image frames stream.
                    2. **VERIFY VISIBILITY**: If the text, problem, or diagram is blurry, cut off, or unreadable, STOP and tell the user: "I can't see that clearly. Please hold the camera steady or move closer." DO NOT GUESS.
                    3. **STEP-BY-STEP**: When solving a math or science problem:
                       - First, state clearly what you see: "Okay, I see a quadratic equation..."
                       - Second, explain the *first step* only.
                       - Ask the user if they follow before moving to the next step.
                    4. **INTERACTION**: You can hear the user and read their chat messages. Respond to both.
                    5. Keep explanations concise and conversational.`
                },
                callbacks: {
                    onopen: () => {
                        setIsSessionActive(true);
                        setStatus('Live! Professor Zero is watching.');
                        setMessages([]); // Clear previous chat

                        sessionPromiseRef.current?.then(session => {
                            session.sendRealtimeInput([{ text: "The video stream has started. Greet the user and ask them to show you the problem." }]);
                        });

                        const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
                        const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = scriptProcessor;

                        scriptProcessor.onaudioprocess = (e) => {
                            // Always visualize
                            const inputData = e.inputBuffer.getChannelData(0);
                            let sum = 0;
                            for(let i = 0; i < inputData.length; i++) sum += Math.abs(inputData[i]);
                            setAudioVolume(sum / inputData.length * 50); 

                            // Only send audio if Mic is On
                            if (isMicOn && sessionPromiseRef.current) {
                                const pcmBlob = createBlob(inputData);
                                sessionPromiseRef.current.then(session => session.sendRealtimeInput({ media: pcmBlob }));
                            }
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContextRef.current!.destination);

                        // Send Video Frames (1 FPS is usually sufficient for homework and saves tokens/bandwidth)
                        videoIntervalRef.current = window.setInterval(async () => {
                            if (!videoRef.current || !canvasRef.current) return;
                            
                            const video = videoRef.current;
                            const canvas = canvasRef.current;
                            const ctx = canvas.getContext('2d');
                            
                            if (!ctx || video.videoWidth === 0) return;

                            // Scale down slightly for performance
                            canvas.width = video.videoWidth / 1.5; 
                            canvas.height = video.videoHeight / 1.5;
                            
                            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                            
                            // Use higher quality JPEG for better text readability
                            const base64Data = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
                            
                            sessionPromiseRef.current?.then(session => {
                                session.sendRealtimeInput({ 
                                    media: { 
                                        mimeType: 'image/jpeg', 
                                        data: base64Data 
                                    } 
                                });
                            });

                        }, 1000); 
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        // Handle Transcripts (Chat Bubble Logic)
                        if (message.serverContent?.inputTranscription) {
                            currentInputTranscription.current += message.serverContent.inputTranscription.text;
                        }
                        if (message.serverContent?.outputTranscription) {
                            const text = message.serverContent.outputTranscription.text;
                            currentOutputTranscription.current += text;
                            setStreamingMessage(currentOutputTranscription.current);
                        }
                        
                        if (message.serverContent?.turnComplete) {
                            const userText = currentInputTranscription.current.trim();
                            const modelText = currentOutputTranscription.current.trim();
                            
                            setMessages(prev => {
                                const newMsgs = [...prev];
                                if (userText) newMsgs.push({ role: 'user', text: userText });
                                if (modelText) newMsgs.push({ role: 'model', text: modelText });
                                return newMsgs;
                            });
                            
                            currentInputTranscription.current = '';
                            currentOutputTranscription.current = '';
                            setStreamingMessage('');
                        }

                        // Audio Playback
                        const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                        if (base64Audio) {
                            const ctx = outputAudioContextRef.current!;
                            
                            // Browser Autoplay Policy Fix
                            if (ctx.state === 'suspended') await ctx.resume();

                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                            const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
                            
                            const source = ctx.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(ctx.destination);
                            
                            source.addEventListener('ended', () => {
                                audioSourcesRef.current.delete(source);
                            });
                            
                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;
                            audioSourcesRef.current.add(source);
                        }
                        
                        if (message.serverContent?.interrupted) {
                             audioSourcesRef.current.forEach(source => source.stop());
                             audioSourcesRef.current.clear();
                             nextStartTimeRef.current = 0;
                             setStreamingMessage('');
                        }
                    },
                    onclose: () => {
                        stopSession();
                    },
                    onerror: (e) => {
                        console.error("Session Error", e);
                        setError("Connection lost. Please check your network.");
                        stopSession();
                    },
                }
            });

        } catch (err) {
            console.error("Failed to start session:", err);
            setError("Could not access camera or microphone.");
            setStatus("Error");
            setIsSessionActive(false);
        }
    };

    useEffect(() => {
        return () => stopSession();
    }, [stopSession]);

    // Handle Manual Text Sending
    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;
        
        // Ensure audio context is ready
        if (outputAudioContextRef.current && outputAudioContextRef.current.state === 'suspended') {
            await outputAudioContextRef.current.resume();
        }

        setMessages(prev => [...prev, { role: 'user', text: input }]);
        sessionPromiseRef.current?.then(session => {
            session.sendRealtimeInput([{ text: input }]);
        });
        setInput('');
    };

    const toggleMic = () => {
        setIsMicOn(!isMicOn);
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm">
            {/* Top Half: Video Feed */}
            <div className={`relative w-full bg-black transition-all duration-500 ${isSessionActive ? 'h-2/5' : 'h-full'}`}>
                <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="w-full h-full object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Overlay UI */}
                {!isSessionActive && !error && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-sm z-10 text-center p-6">
                        <div className="bg-blue-500/20 p-4 rounded-full mb-6 animate-pulse border border-blue-500/50">
                            <VideoCameraIcon className="w-12 h-12 text-blue-400" />
                        </div>
                        <h2 className="text-2xl font-extrabold text-white mb-2">Live Visual Tutor</h2>
                        <p className="text-slate-300 max-w-md mb-8 font-medium text-sm">
                            I see what you see. Point your camera at homework, and I'll explain it step-by-step.
                        </p>
                        <button 
                            onClick={startSession}
                            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-base flex items-center gap-3 transition-transform hover:scale-105 shadow-lg active:translate-y-0.5"
                        >
                            <SparklesIcon className="w-5 h-5" />
                            Start Live Session
                        </button>
                    </div>
                )}
                
                {/* Active Status Overlay */}
                {isSessionActive && (
                     <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-20">
                        <div className="bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
                            <div className="relative">
                                <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping absolute inset-0"></div>
                                <div className="w-2.5 h-2.5 bg-red-500 rounded-full relative"></div>
                            </div>
                            <span className="text-white font-bold text-xs uppercase tracking-wider">Live Video</span>
                        </div>
                        <button onClick={stopSession} className="bg-red-500/80 hover:bg-red-600 text-white p-2 rounded-full backdrop-blur-md transition-colors">
                            <StopCircleIcon className="w-5 h-5" />
                        </button>
                    </div>
                )}

                {/* Error Overlay */}
                {error && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 z-30 text-center p-6">
                        <XCircleIcon className="w-12 h-12 text-red-500 mb-4" />
                        <h3 className="text-lg font-bold text-white mb-2">Connection Error</h3>
                        <p className="text-slate-300 mb-6 text-sm">{error}</p>
                         <button onClick={startSession} className="px-6 py-2 bg-white hover:bg-slate-100 text-slate-800 font-bold rounded-lg flex items-center gap-2">
                            <ArrowPathIcon className="w-4 h-4" />
                            Try Again
                        </button>
                    </div>
                )}
            </div>

            {/* Bottom Half: Chat Interface (Only visible when active) */}
            {isSessionActive && (
                <div className="flex-1 flex flex-col bg-slate-50 border-t border-slate-200 min-h-0">
                    {/* Message List */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {messages.length === 0 && !streamingMessage && (
                            <div className="text-center text-slate-400 mt-4">
                                <p className="font-medium text-sm">Professor Zero is watching...</p>
                                <p className="text-xs mt-1">Speak or type your question.</p>
                            </div>
                        )}
                        
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {msg.role === 'model' && (
                                    <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0 self-end mb-1">
                                        <SparklesIcon className="w-5 h-5 text-blue-600" />
                                    </div>
                                )}
                                <div className={`p-3 rounded-xl max-w-[85%] font-medium text-sm leading-relaxed shadow-sm ${
                                    msg.role === 'user' 
                                    ? 'bg-blue-600 text-white rounded-br-none' 
                                    : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none'
                                }`}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}

                        {/* Streaming Bubble */}
                        {streamingMessage && (
                            <div className="flex gap-3 justify-start animate-in fade-in slide-in-from-bottom-2">
                                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0 self-end mb-1">
                                    <SparklesIcon className="w-5 h-5 text-blue-600 animate-pulse" />
                                </div>
                                <div className="p-3 rounded-xl max-w-[85%] font-medium text-sm leading-relaxed shadow-md bg-white border border-slate-200 text-slate-700 rounded-bl-none">
                                    {streamingMessage}
                                    <span className="inline-block w-2 h-4 bg-blue-500 ml-1 align-middle animate-pulse"></span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-3 bg-white border-t border-slate-200">
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={toggleMic}
                                className={`p-3 rounded-lg transition-all duration-200 border ${
                                    isMicOn 
                                    ? 'bg-red-50 border-red-200 text-red-500 shadow-sm' 
                                    : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'
                                }`}
                            >
                                {isMicOn ? <MicrophoneIcon className="w-5 h-5 animate-pulse" /> : <MicrophoneIcon className="w-5 h-5" />}
                            </button>

                            <form onSubmit={handleSendMessage} className="flex-1 flex gap-2">
                                <input 
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    placeholder="Type to Professor Zero..."
                                    className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 font-medium text-slate-700 focus:outline-none focus:border-blue-500 transition-colors text-sm"
                                />
                                <button 
                                    type="submit" 
                                    disabled={!input.trim()}
                                    className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm active:translate-y-0.5"
                                >
                                    <PaperAirplaneIcon className="w-5 h-5" />
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LiveTutor;
