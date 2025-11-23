
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob as GenAiBlob } from '@google/genai';
import { decode, encode, decodeAudioData } from '../utils/audioUtils';
import { 
    VideoCameraIcon, StopCircleIcon, SparklesIcon, ArrowPathIcon, 
    SpeakerWaveIcon, XCircleIcon
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

const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64data = reader.result as string;
            resolve(base64data.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

const LiveTutor: React.FC = () => {
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [status, setStatus] = useState('Ready to start');
    const [error, setError] = useState<string | null>(null);
    const [audioVolume, setAudioVolume] = useState(0); // Visualizer state

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    // Session Refs
    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const nextStartTimeRef = useRef<number>(0);
    const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const videoIntervalRef = useRef<number | null>(null);

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
        
        inputAudioContextRef.current?.close();
        outputAudioContextRef.current?.close();
        
        inputAudioContextRef.current = null;
        outputAudioContextRef.current = null;
        
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
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: true, 
                video: { 
                    facingMode: 'environment', // Prefer back camera
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                } 
            });
            
            mediaStreamRef.current = stream;
            
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }

            setStatus('Connecting to AI Tutor...');

            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
                    systemInstruction: `You are "Cognita", a friendly and helpful visual AI tutor. 
- You can see what the user is showing you through their camera.
- The user will point their camera at textbooks, homework, or diagrams.
- Your goal is to verbally guide them, answer questions, and explain concepts based on what you see.
- IMPORTANT: As soon as the session starts, GREET the user enthusiastically and ask them to show you what they are working on.
- Keep your responses concise, conversational, and encouraging.
- Do not mention that you are analyzing frames, just act like you are looking at it live.`
                },
                callbacks: {
                    onopen: () => {
                        setIsSessionActive(true);
                        setStatus('Live! Show me your work.');

                        sessionPromiseRef.current?.then(session => {
                            session.sendRealtimeInput([{ text: "I have just started the session. Please greet me now." }]);
                        });

                        const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
                        const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = scriptProcessor;

                        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            let sum = 0;
                            for(let i = 0; i < inputData.length; i++) sum += Math.abs(inputData[i]);
                            setAudioVolume(sum / inputData.length * 50); 

                            const pcmBlob = createBlob(inputData);
                            sessionPromiseRef.current?.then(session => session.sendRealtimeInput({ media: pcmBlob }));
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContextRef.current!.destination);

                        videoIntervalRef.current = window.setInterval(async () => {
                            if (!videoRef.current || !canvasRef.current) return;
                            
                            const video = videoRef.current;
                            const canvas = canvasRef.current;
                            const ctx = canvas.getContext('2d');
                            
                            if (!ctx || video.videoWidth === 0) return;

                            canvas.width = video.videoWidth / 2; 
                            canvas.height = video.videoHeight / 2;
                            
                            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                            
                            const base64Data = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
                            
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
                        const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                        if (base64Audio) {
                            const audioContext = outputAudioContextRef.current!;
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, audioContext.currentTime);
                            const audioBuffer = await decodeAudioData(decode(base64Audio), audioContext, 24000, 1);
                            
                            const source = audioContext.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(audioContext.destination);
                            
                            source.addEventListener('ended', () => {
                                audioSourcesRef.current.delete(source);
                            });
                            
                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;
                            audioSourcesRef.current.add(source);
                        }
                        
                        if(message.serverContent?.interrupted){
                             for (const source of audioSourcesRef.current.values()) {
                                source.stop();
                             }
                             audioSourcesRef.current.clear();
                             nextStartTimeRef.current = 0;
                        }
                    },
                    onclose: () => {
                        stopSession();
                    },
                    onerror: (e) => {
                        console.error("Session Error", e);
                        setError("Connection lost.");
                        stopSession();
                    },
                }
            });

        } catch (err) {
            console.error("Failed to start session:", err);
            setError("Could not access camera or microphone. Please ensure permissions are granted.");
            setStatus("Error");
            setIsSessionActive(false);
        }
    };

    useEffect(() => {
        return () => stopSession();
    }, [stopSession]);

    return (
        <div className="relative w-full h-full bg-slate-900 rounded-3xl overflow-hidden border-4 border-slate-200 flex flex-col shadow-sm">
            {/* Video Feed */}
            <div className="relative flex-1 bg-black">
                {/* Video Element */}
                <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="absolute inset-0 w-full h-full object-cover"
                />
                
                <canvas ref={canvasRef} className="hidden" />

                {/* Overlay UI */}
                {!isSessionActive && !error && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-sm z-10 text-center p-6">
                        <div className="bg-sky-500/20 p-6 rounded-full mb-6 animate-pulse border-2 border-sky-500/50">
                            <VideoCameraIcon className="w-16 h-16 text-sky-400" />
                        </div>
                        <h2 className="text-3xl font-extrabold text-white mb-2">Live Visual Tutor</h2>
                        <p className="text-slate-300 max-w-md mb-8 font-medium">
                            I can see what you see. Point your camera at your work, and I'll help you solve it verbally.
                        </p>
                        <button 
                            onClick={startSession}
                            className="px-8 py-4 bg-sky-500 hover:bg-sky-400 text-white font-bold rounded-2xl text-lg flex items-center gap-3 transition-transform hover:scale-105 border-b-4 border-sky-700 active:border-b-0 active:translate-y-1"
                        >
                            <SparklesIcon className="w-6 h-6" />
                            Start Live Session
                        </button>
                    </div>
                )}
                
                {/* Loading / Status Overlay */}
                {isSessionActive && (
                     <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-20">
                        <div className="bg-black/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 flex items-center gap-3">
                            <div className="relative">
                                <div className="w-3 h-3 bg-red-500 rounded-full animate-ping absolute inset-0"></div>
                                <div className="w-3 h-3 bg-red-500 rounded-full relative"></div>
                            </div>
                            <span className="text-white font-bold text-sm uppercase tracking-wider">Live</span>
                        </div>
                        
                        {/* Audio Visualizer */}
                         <div className="bg-black/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 flex items-center gap-2">
                             <SpeakerWaveIcon className={`w-5 h-5 ${audioVolume > 0.5 ? 'text-sky-400' : 'text-slate-400'}`} />
                             <div className="flex gap-1 items-end h-4">
                                 {[1,2,3,4].map(i => (
                                     <div key={i} 
                                        className="w-1 bg-sky-500 rounded-full transition-all duration-75"
                                        style={{ height: `${Math.min(100, Math.max(20, audioVolume * i))}%` }}
                                     ></div>
                                 ))}
                             </div>
                         </div>
                    </div>
                )}

                {/* Error Overlay */}
                {error && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 z-30 text-center p-6">
                        <XCircleIcon className="w-16 h-16 text-red-500 mb-4" />
                        <h3 className="text-xl font-bold text-white mb-2">Connection Error</h3>
                        <p className="text-slate-300 mb-6">{error}</p>
                         <button 
                            onClick={startSession}
                            className="px-6 py-3 bg-white hover:bg-slate-100 text-slate-800 font-bold rounded-2xl flex items-center gap-2"
                        >
                            <ArrowPathIcon className="w-5 h-5" />
                            Try Again
                        </button>
                    </div>
                )}
            </div>

            {/* Bottom Controls */}
            {isSessionActive && (
                <div className="flex-none bg-white border-t-2 border-slate-200 p-6 flex items-center justify-center">
                     <button 
                        onClick={stopSession}
                        className="w-full max-w-sm bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 transition-colors shadow-md border-b-4 border-red-700 active:border-b-0 active:translate-y-1"
                    >
                        <StopCircleIcon className="w-8 h-8" />
                        End Session
                    </button>
                </div>
            )}
        </div>
    );
};

export default LiveTutor;
