
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { UploadedFile } from '../types';
import { generateLectureScript, clarifyLectureDoubt, generatePodcastAudio } from '../services/geminiService';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { decode, encode, decodeAudioData } from '../utils/audioUtils';
import { GoogleGenAI, LiveServerMessage, Blob as GenAiBlob, Modality } from '@google/genai';
import { 
    SparklesIcon, XCircleIcon, ArrowPathIcon, HandRaisedIcon, 
    PaperAirplaneIcon, StopCircleIcon, ChevronLeftIcon, MicrophoneIcon 
} from './icons/Icons';

type LectureState = 'configuring' | 'generating' | 'lecturing' | 'paused' | 'finished' | 'error';
type QuestionMode = 'text' | 'voice';

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


const LiveLecture: React.FC<{ files: UploadedFile[] }> = ({ files }) => {
    const [lectureState, setLectureState] = useState<LectureState>('configuring');
    const [lectureScript, setLectureScript] = useState<string[]>([]);
    const [currentScriptIndex, setCurrentScriptIndex] = useState(0);
    const [userQuestion, setUserQuestion] = useState('');
    const [clarification, setClarification] = useState('');
    const [isClarifying, setIsClarifying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isFetchingAudio, setIsFetchingAudio] = useState(false);
    
    const [questionMode, setQuestionMode] = useState<QuestionMode>('text');
    const [isVoiceSessionActive, setIsVoiceSessionActive] = useState(false);
    const [liveTranscripts, setLiveTranscripts] = useState<{ type: 'user' | 'model'; text: string }[]>([]);

    const { isPlaying, play, stop } = useAudioPlayer({ sampleRate: 24000 });
    const audioTriggeredForIndex = useRef(-1);
    
    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const nextStartTimeRef = useRef<number>(0);
    const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const currentInputTranscription = useRef('');
    const currentOutputTranscription = useRef('');

    const stopVoiceChat = useCallback(() => {
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
        
        inputAudioContextRef.current?.close().then(() => inputAudioContextRef.current = null);
        outputAudioContextRef.current?.close().then(() => outputAudioContextRef.current = null);

        for (const source of audioSourcesRef.current.values()) {
            source.stop();
        }
        audioSourcesRef.current.clear();
        nextStartTimeRef.current = 0;

        setIsVoiceSessionActive(false);
        setLiveTranscripts([]);
        currentInputTranscription.current = '';
        currentOutputTranscription.current = '';
    }, []);

    const handleStartLecture = useCallback(async () => {
        setLectureState('generating');
        setError(null);
        try {
            const script = await generateLectureScript(files);
            if (script && script.length > 0) {
                setLectureScript(script);
                setCurrentScriptIndex(0);
                audioTriggeredForIndex.current = -1;
                setLectureState('lecturing');
            } else {
                setError('Could not generate a lecture from the provided document(s).');
                setLectureState('error');
            }
        } catch (err) {
            console.error(err);
            setError('An error occurred while generating the lecture script.');
            setLectureState('error');
        }
    }, [files]);
    
    useEffect(() => {
        if (lectureState === 'lecturing' && currentScriptIndex < lectureScript.length && audioTriggeredForIndex.current !== currentScriptIndex) {
            const playCurrentChunk = async () => {
                audioTriggeredForIndex.current = currentScriptIndex;
                setIsFetchingAudio(true);
                try {
                    const audioBase64 = await generatePodcastAudio(lectureScript[currentScriptIndex]);
                    if (audioBase64) {
                        const audioBytes = decode(audioBase64);
                        play(audioBytes);
                    }
                } catch(e) {
                    console.error("Error fetching or playing audio:", e);
                } finally {
                    setIsFetchingAudio(false);
                }
            };
            playCurrentChunk();
        }
    }, [lectureState, currentScriptIndex, lectureScript, play]);

    useEffect(() => {
        if (lectureState === 'lecturing' && !isPlaying && !isFetchingAudio && audioTriggeredForIndex.current === currentScriptIndex) {
             const timer = setTimeout(() => {
                if (currentScriptIndex < lectureScript.length - 1) {
                    setCurrentScriptIndex(prev => prev + 1);
                } else {
                    setLectureState('finished');
                }
            }, 200); 

            return () => clearTimeout(timer);
        }
    }, [isPlaying, isFetchingAudio, lectureState, currentScriptIndex, lectureScript.length]);
    
    useEffect(() => {
        return () => {
            stop();
            stopVoiceChat();
        }
    }, [stop, stopVoiceChat]);

    const handleRaiseHand = () => {
        stop();
        setQuestionMode('text');
        setLectureState('paused');
    };

    const handleAskQuestion = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userQuestion.trim() || isClarifying) return;
        
        setIsClarifying(true);
        setClarification('');
        
        const lectureContext = lectureScript.slice(0, currentScriptIndex + 1).join('\n\n');
        
        try {
            const response = await clarifyLectureDoubt(files, lectureContext, userQuestion);
            setClarification(response);
            const audioBase64 = await generatePodcastAudio(response);
            if(audioBase64) {
                play(decode(audioBase64));
            }

        } catch (err) {
            console.error("Error clarifying doubt:", err);
            setClarification("Sorry, I couldn't process that question.");
        } finally {
            setIsClarifying(false);
        }
    };
    
    const handleResumeLecture = () => {
        stop();
        stopVoiceChat();
        setClarification('');
        setUserQuestion('');
        setLectureState('lecturing');
        audioTriggeredForIndex.current = -1;
        setCurrentScriptIndex(currentScriptIndex); 
    };
    
    const handleRestart = () => {
        stop();
        stopVoiceChat();
        setLectureState('configuring');
        setLectureScript([]);
        setCurrentScriptIndex(0);
        setError(null);
        setClarification('');
        setUserQuestion('');
    };

    const handlePreviousSlide = () => {
        if (currentScriptIndex > 0) {
            stop();
            audioTriggeredForIndex.current = -1; 
            setCurrentScriptIndex(prev => prev - 1);
            setLectureState('lecturing');
        }
    };

    const startVoiceChat = async () => {
        if (isVoiceSessionActive) return;
        stop(); 
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;

            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

            const lectureContext = lectureScript.slice(0, currentScriptIndex + 1).join('\n\n');
            const fileNames = files.map(f => `"${f.name}"`).join(', ');
            const systemInstruction = `You are an expert AI lecturer.`;
            
            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
                    systemInstruction: systemInstruction,
                },
                callbacks: {
                    onopen: () => {
                        setIsVoiceSessionActive(true);
                        
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
                            
                            setLiveTranscripts(prev => {
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
                       if(isVoiceSessionActive) stopVoiceChat();
                    },
                    onerror: (e) => {
                        console.error("Voice session error:", e);
                        setError("Voice input failed.");
                        if(isVoiceSessionActive) stopVoiceChat();
                    },
                }
            });

        } catch (error) {
            console.error('Failed to start voice session:', error);
            setError('Could not access microphone.');
        }
    };


    if (lectureState === 'configuring') {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center">
                <h3 className="text-3xl font-extrabold text-slate-800">Interactive AI Lecture</h3>
                <p className="text-slate-500 font-medium mt-4 max-w-lg mb-8">Generate a live lecture from your subject documents. The AI will present the topics step-by-step with audio, and you can "Raise Hand" to ask questions anytime.</p>
                <button onClick={handleStartLecture} className="bg-sky-500 hover:bg-sky-400 text-white font-bold py-4 px-8 rounded-2xl flex items-center gap-3 border-b-4 border-sky-700 active:border-b-0 active:translate-y-1 transition-all">
                    <SparklesIcon className="w-6 h-6" />
                    Start Lecture
                </button>
            </div>
        );
    }
    
     if (lectureState === 'generating') {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center">
                <SparklesIcon className="w-16 h-16 text-sky-500 animate-pulse mb-4" />
                <h3 className="text-xl font-bold text-slate-800">Generating your lecture...</h3>
                <p className="text-slate-400 font-medium">Please wait while the AI prepares the presentation.</p>
            </div>
        );
    }
    
    if (lectureState === 'error') {
        return (
             <div className="flex flex-col items-center justify-center h-full text-center text-red-500">
                <XCircleIcon className="w-16 h-16 mb-4"/>
                <h3 className="text-xl font-bold">{error}</h3>
                <button onClick={handleRestart} className="mt-6 bg-sky-500 hover:bg-sky-400 text-white font-bold py-3 px-6 rounded-2xl flex items-center gap-2 border-b-4 border-sky-700 active:border-b-0 active:translate-y-1">
                    <ArrowPathIcon className="w-5 h-5" />
                    Try Again
                </button>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full">
            {/* Progress Bar */}
            <div className="w-full bg-slate-200 rounded-full h-3 mb-6">
                <div className="bg-sky-500 h-3 rounded-full transition-all duration-500 ease-out" style={{ width: `${((currentScriptIndex + 1) / lectureScript.length) * 100}%` }}></div>
            </div>
            
            {/* Whiteboard */}
            <div className="flex-1 bg-white border-2 border-slate-200 rounded-3xl p-8 overflow-y-auto mb-6 relative shadow-sm">
                <p className="text-2xl leading-relaxed text-slate-700 whitespace-pre-wrap font-medium">
                    {lectureScript.length > 0 ? lectureScript[currentScriptIndex] : 'Loading script...'}
                </p>
                 {lectureState === 'finished' && (
                    <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center text-center rounded-3xl">
                         <h3 className="text-4xl font-extrabold text-slate-800 mb-6">Lecture Finished!</h3>
                         <button onClick={handleRestart} className="bg-sky-500 hover:bg-sky-400 text-white font-bold py-4 px-8 rounded-2xl flex items-center gap-3 border-b-4 border-sky-700 active:border-b-0 active:translate-y-1">
                            <ArrowPathIcon className="w-6 h-6"/>
                            Start a New Lecture
                        </button>
                    </div>
                 )}
            </div>

            {/* Controls and Interaction */}
            <div className="flex-shrink-0">
                {(lectureState === 'lecturing' || lectureState === 'finished') && (
                    <div className="flex items-center gap-4">
                         <button onClick={handlePreviousSlide} disabled={currentScriptIndex === 0 || isFetchingAudio || lectureState === 'finished'} className="bg-white border-2 border-slate-200 hover:bg-slate-50 text-slate-500 font-bold py-4 px-6 rounded-2xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 border-b-4 active:border-b-2 active:translate-y-0.5">
                            <ChevronLeftIcon className="w-6 h-6"/>
                            Previous
                        </button>
                        <button onClick={handleRaiseHand} disabled={isFetchingAudio || lectureState === 'finished'} className="w-full bg-yellow-400 hover:bg-yellow-300 text-yellow-900 font-bold py-4 px-6 rounded-2xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 border-b-4 border-yellow-600 active:border-b-0 active:translate-y-1">
                            <HandRaisedIcon className="w-6 h-6"/>
                            {isFetchingAudio ? 'Loading...' : 'RAISE HAND (ASK QUESTION)'}
                        </button>
                    </div>
                )}
                
                {lectureState === 'paused' && (
                    <div className="bg-slate-50 border-2 border-slate-200 rounded-3xl p-6">
                        <h4 className="font-extrabold text-xl mb-4 text-center text-slate-800">Lecture Paused</h4>
                        
                        <div className="flex justify-center mb-6 p-1 bg-white border-2 border-slate-200 rounded-2xl">
                            <button onClick={() => setQuestionMode('text')} className={`w-1/2 px-4 py-2 text-sm font-bold rounded-xl transition-colors ${questionMode === 'text' ? 'bg-sky-100 text-sky-700' : 'text-slate-400 hover:text-slate-600'}`}>TYPE QUESTION</button>
                            <button onClick={() => setQuestionMode('voice')} className={`w-1/2 px-4 py-2 text-sm font-bold rounded-xl transition-colors ${questionMode === 'voice' ? 'bg-sky-100 text-sky-700' : 'text-slate-400 hover:text-slate-600'}`}>VOICE QUESTION</button>
                        </div>
                        
                        {questionMode === 'text' && (
                            <>
                                {clarification && (
                                    <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 mb-4">
                                        <p className="font-extrabold text-sky-500 mb-2 text-xs uppercase">AI Response:</p>
                                        <p className="text-slate-700 whitespace-pre-wrap font-medium">{clarification}</p>
                                    </div>
                                )}
                                <form onSubmit={handleAskQuestion} className="flex items-center gap-3">
                                    <input type="text" value={userQuestion} onChange={e => setUserQuestion(e.target.value)} placeholder="Type your question..." className="flex-1 bg-white border-2 border-slate-200 rounded-2xl py-3 px-4 text-slate-700 placeholder-slate-400 font-bold focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" disabled={isClarifying}/>
                                    <button type="submit" className="bg-sky-500 text-white p-3 rounded-2xl hover:bg-sky-400 disabled:bg-slate-200 border-b-4 border-sky-700 active:border-b-0 active:translate-y-1" disabled={isClarifying || !userQuestion.trim()}>
                                        {isClarifying ? <ArrowPathIcon className="w-6 h-6 animate-spin"/> : <PaperAirplaneIcon className="w-6 h-6" />}
                                    </button>
                                </form>
                            </>
                        )}
                        
                        {questionMode === 'voice' && (
                            <div className="text-center">
                                {isVoiceSessionActive ? (
                                    <>
                                        <div className="h-48 bg-white border-2 border-slate-200 rounded-2xl p-4 overflow-y-auto space-y-2 text-left mb-4 flex flex-col">
                                            {liveTranscripts.length === 0 && <p className="text-slate-400 text-center m-auto font-bold">Listening...</p>}
                                            {liveTranscripts.map((t, i) => (
                                                <div key={i} className={`p-3 rounded-2xl max-w-[90%] text-sm font-bold ${t.type === 'user' ? 'bg-sky-100 text-sky-800 self-end ml-auto rounded-br-none' : 'bg-slate-100 text-slate-700 self-start rounded-bl-none'}`}>
                                                   <span className="opacity-50 text-xs block uppercase mb-1">{t.type}</span>{t.text}
                                                </div>
                                            ))}
                                        </div>
                                        <button onClick={stopVoiceChat} className="mx-auto bg-red-500 hover:bg-red-400 text-white font-bold py-3 px-6 rounded-2xl flex items-center gap-2 border-b-4 border-red-700 active:border-b-0 active:translate-y-1">
                                            <StopCircleIcon className="w-5 h-5"/> Stop Chat
                                        </button>
                                    </>
                                ) : (
                                    <button onClick={startVoiceChat} className="mx-auto bg-green-500 hover:bg-green-400 text-white font-bold py-3 px-6 rounded-2xl flex items-center gap-2 border-b-4 border-green-700 active:border-b-0 active:translate-y-1">
                                        <MicrophoneIcon className="w-5 h-5"/> Start Voice Chat
                                    </button>
                                )}
                            </div>
                        )}
                        
                        <div className="flex items-center gap-4 mt-6 border-t-2 border-slate-200 pt-6">
                             <button onClick={handleResumeLecture} disabled={isPlaying || isClarifying || isVoiceSessionActive} className="flex-1 bg-green-500 hover:bg-green-400 text-white font-bold py-3 px-6 rounded-2xl border-b-4 border-green-700 active:border-b-0 active:translate-y-1 disabled:opacity-50">RESUME</button>
                             <button onClick={handleRestart} className="flex-1 bg-red-500 hover:bg-red-400 text-white font-bold py-3 px-6 rounded-2xl flex items-center justify-center gap-2 border-b-4 border-red-700 active:border-b-0 active:translate-y-1">
                                <StopCircleIcon className="w-5 h-5"/> END
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LiveLecture;
