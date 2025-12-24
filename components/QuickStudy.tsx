
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob as GenAiBlob } from '@google/genai';
import { UploadedFile } from '../types';
import FileUpload from './FileUpload';
import { decode, encode, decodeAudioData } from '../utils/audioUtils';
import { 
    SparklesIcon, XMarkIcon, MicrophoneIcon, PaperAirplaneIcon, 
    StopCircleIcon, DocumentTextIcon, UserIcon, PlayIcon
} from './icons/Icons';

// --- Audio Helpers ---
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

const QuickStudy: React.FC = () => {
    const [file, setFile] = useState<UploadedFile | null>(null);
    
    // Session State
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isMicOn, setIsMicOn] = useState(false);
    const [status, setStatus] = useState('Idle');
    const [messages, setMessages] = useState<{ role: 'user' | 'model', text: string }[]>([]);
    const [streamingMessage, setStreamingMessage] = useState<string>(''); // For real-time "highlighting" effect
    const [input, setInput] = useState('');
    const [audioVolume, setAudioVolume] = useState(0);

    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const nextStartTimeRef = useRef<number>(0);
    const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const currentInputTranscription = useRef('');
    const currentOutputTranscription = useRef('');

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, streamingMessage]);

    const handleFileAdded = (name: string, uploadedFile: UploadedFile) => {
        setFile(uploadedFile);
        setIsConnected(false);
        setIsConnecting(false);
    };

    const stopSession = useCallback(() => {
        if (sessionPromiseRef.current) {
            sessionPromiseRef.current.then(session => session.close());
            sessionPromiseRef.current = null;
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
        
        setIsConnected(false);
        setIsConnecting(false);
        setIsMicOn(false);
        setStatus('Session Ended');
    }, []);

    // Helper to ensure audio is unblocked by browser
    const resumeAudio = async () => {
        if (outputAudioContextRef.current && outputAudioContextRef.current.state === 'suspended') {
            await outputAudioContextRef.current.resume();
        }
        if (inputAudioContextRef.current && inputAudioContextRef.current.state === 'suspended') {
            await inputAudioContextRef.current.resume();
        }
    };

    const connect = async () => {
        if (!file || isConnecting) return;
        setIsConnecting(true);
        setStatus('Connecting to Professor Zero...');
        
        const apiKey = process.env.API_KEY;
        if (!apiKey) {
            setStatus('API Key Missing');
            setIsConnecting(false);
            return;
        }

        try {
            // Setup Audio Contexts
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;
            
            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

            const ai = new GoogleGenAI({ apiKey });

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
                    systemInstruction: `You are "Professor Zero", an expert academic tutor.
                    - The user has uploaded a file: "${file.name}".
                    - **Math/Science Strategy**: If the file contains a math problem or scientific process, break the explanation down into numbered steps (Step 1, Step 2...). 
                    - **Explanation Style**: Read the step clearly, then explain the logic "why" we do it.
                    - **General Strategy**: Provide a concise, high-yield summary of key points.
                    - Act as a study partner. Answer questions, clarify doubts, and discuss the material.
                    - Be smart, direct, and encouraging.`
                },
                callbacks: {
                    onopen: () => {
                        setIsConnected(true);
                        setIsConnecting(false);
                        setStatus('Professor Zero is Online');
                        
                        sessionPromiseRef.current?.then(session => {
                            // Send File Context
                            if (file.mimeType.startsWith('image/')) {
                                session.sendRealtimeInput({ media: { mimeType: file.mimeType, data: file.base64 } });
                            } else {
                                if (file.mimeType === 'text/plain' || file.name.endsWith('.md')) {
                                     const text = atob(file.base64);
                                     session.sendRealtimeInput([{ text: `[Context Document]: ${text}` }]);
                                } else {
                                     session.sendRealtimeInput([{ text: "I have uploaded the file. Please summarize it if you can read it, otherwise ask me what it's about." }]);
                                }
                            }
                            
                            // Trigger intro
                            session.sendRealtimeInput([{ text: "Introduce yourself as Professor Zero. If you see a math problem, solve it step-by-step." }]);
                        });

                        // Setup Mic Stream (muted by default state logic)
                        const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
                        const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = scriptProcessor;

                        scriptProcessor.onaudioprocess = (e) => {
                            // Visualizer logic always runs to show mic activity
                            const inputData = e.inputBuffer.getChannelData(0);
                            let sum = 0;
                            for(let i = 0; i < inputData.length; i++) sum += Math.abs(inputData[i]);
                            setAudioVolume(sum / inputData.length * 100);

                            // Only send audio if Mic is On
                            if (isMicOn && sessionPromiseRef.current) {
                                const pcmBlob = createBlob(inputData);
                                sessionPromiseRef.current.then(session => session.sendRealtimeInput({ media: pcmBlob }));
                            }
                        };
                        
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContextRef.current!.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
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
                            setStreamingMessage(''); // Clear streaming buffer
                        }

                        const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                        if (base64Audio) {
                            const ctx = outputAudioContextRef.current!;
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
                        
                        if (message.serverContent?.interrupted) {
                             audioSourcesRef.current.forEach(source => source.stop());
                             audioSourcesRef.current.clear();
                             nextStartTimeRef.current = 0;
                             setStreamingMessage('');
                        }
                    },
                    onclose: () => stopSession(),
                    onerror: (e) => { 
                        console.error(e); 
                        setStatus('Connection Lost');
                        stopSession(); 
                    }
                }
            });

        } catch (e) {
            console.error(e);
            setStatus('Hardware Access Denied');
            setIsConnecting(false);
        }
    };

    useEffect(() => {
        return () => stopSession();
    }, [stopSession]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;
        
        await resumeAudio(); // Ensure audio context is running
        setMessages(prev => [...prev, { role: 'user', text: input }]);
        
        sessionPromiseRef.current?.then(session => {
            session.sendRealtimeInput([{ text: input }]);
        });
        setInput('');
    };

    const toggleMic = async () => {
        await resumeAudio(); // Ensure audio context is running
        setIsMicOn(!isMicOn);
    };

    if (!file) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-4">
                <div className="max-w-xl w-full text-center mb-8">
                    <div className="bg-white p-6 rounded-full inline-block mb-6 border border-slate-200">
                        <SparklesIcon className="w-12 h-12 text-blue-600" />
                    </div>
                     <h2 className="text-3xl font-extrabold text-slate-800 mb-2">Professor Zero's Quick Study</h2>
                     <p className="text-slate-500 font-medium text-lg">Upload any document. Professor Zero will explain it step-by-step.</p>
                </div>
                <FileUpload onSubjectAdded={handleFileAdded} />
            </div>
        );
    }

    const isImage = file.mimeType.startsWith('image/');
    const dataUri = `data:${file.mimeType};base64,${file.base64}`;

    return (
        <div className="flex flex-col h-full bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm relative">
            {/* Start Overlay (Ensures user click for hardware) */}
            {!isConnected && (
                <div className="absolute inset-0 bg-white/95 z-50 flex flex-col items-center justify-center p-6 text-center">
                    <div className="max-w-md">
                        <div className="h-20 w-20 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-blue-100">
                            {isImage ? (
                                <img src={dataUri} alt="preview" className="h-16 w-16 object-cover rounded-lg" />
                            ) : (
                                <DocumentTextIcon className="h-10 w-10 text-blue-500" />
                            )}
                        </div>
                        <h3 className="text-2xl font-black text-slate-800 mb-2">{file.name}</h3>
                        <p className="text-slate-500 font-medium mb-8">
                            Click below to start an interactive study session with Professor Zero. We'll need microphone access to talk!
                        </p>
                        <div className="flex flex-col gap-3">
                            <button 
                                onClick={connect}
                                disabled={isConnecting}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50"
                            >
                                {isConnecting ? <SparklesIcon className="w-6 h-6 animate-spin" /> : <PlayIcon className="w-6 h-6" />}
                                {isConnecting ? 'Initializing...' : 'Start Learning Session'}
                            </button>
                            <button 
                                onClick={() => { setFile(null); stopSession(); }}
                                className="text-slate-400 font-bold text-sm uppercase hover:text-slate-600"
                            >
                                Cancel
                            </button>
                        </div>
                        {status !== 'Idle' && status !== 'Professor Zero is Online' && (
                            <p className="mt-4 text-xs font-bold text-red-500 uppercase tracking-widest">{status}</p>
                        )}
                    </div>
                </div>
            )}

            {/* Header & File Preview */}
            <div className="flex-shrink-0 p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 bg-white rounded-lg border border-slate-200 overflow-hidden flex items-center justify-center">
                        {isImage ? (
                            <img src={dataUri} alt="preview" className="h-full w-full object-cover" />
                        ) : (
                            <DocumentTextIcon className="h-6 w-6 text-slate-400" />
                        )}
                    </div>
                    <div>
                         <h3 className="font-extrabold text-slate-800 text-lg truncate max-w-xs">{file.name}</h3>
                         <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">{status}</p>
                         </div>
                    </div>
                </div>
                <button 
                    onClick={() => { setFile(null); stopSession(); }}
                    className="p-2 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                >
                    <XMarkIcon className="w-5 h-5" />
                </button>
            </div>
            
            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'model' && (
                            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0 self-end mb-1">
                                <SparklesIcon className="w-5 h-5 text-blue-600" />
                            </div>
                        )}
                        <div className={`p-3 rounded-xl max-w-[85%] font-medium text-sm leading-relaxed shadow-sm whitespace-pre-wrap ${
                            msg.role === 'user' 
                            ? 'bg-blue-600 text-white rounded-br-none' 
                            : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none'
                        }`}>
                            {msg.text}
                        </div>
                    </div>
                ))}

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
            <div className="p-4 border-t border-slate-200 bg-white">
                <div className="flex items-center gap-2 max-w-3xl mx-auto">
                    <button 
                        onClick={toggleMic}
                        className={`p-3 rounded-lg transition-all duration-300 border ${
                            isMicOn 
                            ? 'bg-red-50 border-red-200 text-red-500 shadow-sm scale-105' 
                            : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'
                        }`}
                    >
                        {isMicOn ? <StopCircleIcon className="w-5 h-5 animate-pulse" /> : <MicrophoneIcon className="w-5 h-5" />}
                    </button>

                    {isMicOn && (
                        <div className="flex-1 h-12 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-center px-4 gap-1 overflow-hidden">
                            {[...Array(20)].map((_, i) => (
                                <div 
                                    key={i} 
                                    className="w-1 bg-red-500 rounded-full transition-all duration-75"
                                    style={{ height: `${Math.max(10, Math.min(100, audioVolume * (Math.random() + 0.5)))}%` }}
                                />
                            ))}
                        </div>
                    )}

                    {!isMicOn && (
                        <form onSubmit={handleSendMessage} className="flex-1 flex gap-2">
                            <input 
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                placeholder="Chat with Professor Zero..."
                                className="flex-1 bg-white border border-slate-200 rounded-lg px-4 font-medium text-slate-700 focus:outline-none focus:border-blue-500 transition-colors placeholder-slate-400"
                            />
                            <button 
                                type="submit" 
                                disabled={!input.trim()}
                                className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm active:translate-y-0.5"
                            >
                                <PaperAirplaneIcon className="w-5 h-5" />
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default QuickStudy;
