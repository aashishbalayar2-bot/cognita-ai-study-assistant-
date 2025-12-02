
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob as GenAiBlob } from '@google/genai';
import { decode, encode, decodeAudioData } from '../utils/audioUtils';
import { MicrophoneIcon, StopCircleIcon } from './icons/Icons';
import { UploadedFile } from '../types';

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

interface LiveRevisionProps {
    files: UploadedFile[];
}

const LiveRevision: React.FC<LiveRevisionProps> = ({ files }) => {
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [transcripts, setTranscripts] = useState<{ type: 'user' | 'model'; text: string }[]>([]);
    const [status, setStatus] = useState('Idle. Press Start to begin.');

    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const nextStartTimeRef = useRef<number>(0);
    const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    
    const currentInputTranscription = useRef('');
    const currentOutputTranscription = useRef('');

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
        
        inputAudioContextRef.current?.close();
        outputAudioContextRef.current?.close();
        
        inputAudioContextRef.current = null;
        outputAudioContextRef.current = null;

        setIsSessionActive(false);
        setTranscripts([]); 
        setStatus('Session ended. Press Start to begin again.');
    }, []);


    const startSession = async () => {
        setStatus('Requesting permissions...');
        if (isSessionActive) return;

        const apiKey = process.env.API_KEY || (import.meta as any).env?.VITE_API_KEY;
        if (!apiKey) {
            setStatus("API Key error. Check .env");
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;
            
            setStatus('Initializing session...');

            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            
            const ai = new GoogleGenAI({ apiKey: apiKey });
            
            const fileNames = files.map(f => `"${f.name}"`).join(', ');

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
                    systemInstruction: `You are "Cognita", an expert Socratic Teacher helping a student revise. 
                    - Your goal is NOT to just read the notes, but to check understanding.
                    - Use the provided documents: ${fileNames}.
                    - Ask probing questions like "Does that make sense?" or "Can you explain that back to me?".
                    - Use analogies to explain complex concepts.
                    - Speak naturally, with pauses and emphasis, like a real teacher.
                    - Be encouraging but ensure they actually understand the material before moving on.`
                },
                callbacks: {
                    onopen: () => {
                        setIsSessionActive(true);
                        setStatus('Connected! Start speaking.');
                        
                        const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
                        const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = scriptProcessor;

                        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            if (sessionPromiseRef.current) {
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
                            currentOutputTranscription.current += message.serverContent.outputTranscription.text;
                        }
                        if (message.serverContent?.turnComplete) {
                            const fullInput = currentInputTranscription.current.trim();
                            const fullOutput = currentOutputTranscription.current.trim();
                            
                            setTranscripts(prev => {
                                let newTranscripts = [...prev];
                                if(fullInput) newTranscripts.push({ type: 'user', text: fullInput});
                                if(fullOutput) newTranscripts.push({ type: 'model', text: fullOutput});
                                return newTranscripts;
                            });
                            
                            currentInputTranscription.current = '';
                            currentOutputTranscription.current = '';
                        }

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
                        console.error('Session error:', e);
                        setStatus('An error occurred. Session closed.');
                        stopSession();
                    },
                }
            });

        } catch (error) {
            console.error('Failed to start session:', error);
            setStatus('Failed to get microphone permissions.');
        }
    };
    
    useEffect(() => {
      return () => {
        stopSession();
      };
    }, [files]); 

    return (
        <div className="flex flex-col h-full">
            <div className="flex-none p-4 bg-white border-2 border-slate-200 rounded-2xl flex justify-between items-center mb-4 shadow-sm">
                <div>
                    <h3 className="text-lg font-extrabold text-slate-800">Live Socratic Revision</h3>
                    <p className={`text-xs font-bold uppercase tracking-wide ${isSessionActive ? 'text-green-500' : 'text-slate-400'}`}>{status}</p>
                </div>
                <button
                    onClick={isSessionActive ? stopSession : startSession}
                    className={`px-6 py-3 rounded-xl font-bold text-white flex items-center gap-2 transition-all border-b-4 active:border-b-0 active:translate-y-1 ${
                        isSessionActive ? 'bg-red-500 hover:bg-red-600 border-red-700' : 'bg-green-500 hover:bg-green-600 border-green-700'
                    }`}
                >
                    {isSessionActive ? <StopCircleIcon className="w-6 h-6" /> : <MicrophoneIcon className="w-6 h-6" />}
                    {isSessionActive ? 'Stop' : 'Start'}
                </button>
            </div>
            <div className="flex-1 bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 overflow-y-auto space-y-4">
                 {transcripts.length === 0 && (
                    <div className="flex items-center justify-center h-full text-slate-400 font-medium">
                        <p>Start the session to revise with your AI Teacher.</p>
                    </div>
                )}
                {transcripts.map((t, i) => (
                    <div key={i} className={`p-4 rounded-2xl max-w-[80%] font-medium shadow-sm ${t.type === 'user' ? 'bg-blue-600 text-white self-end ml-auto rounded-br-none' : 'bg-white text-slate-700 border-2 border-slate-200 self-start rounded-bl-none'}`}>
                       <span className="font-extrabold uppercase text-xs block mb-1 opacity-70">{t.type === 'model' ? 'Teacher' : 'You'}</span>{t.text}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default LiveRevision;
