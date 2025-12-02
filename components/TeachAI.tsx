
import React, { useState, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob as GenAiBlob } from '@google/genai';
import { decode, encode, decodeAudioData } from '../utils/audioUtils';
import { generateTeachingFeedback } from '../services/geminiService';
import { 
    UserGroupIcon, VideoCameraIcon, StopCircleIcon, SparklesIcon, 
    CheckCircleIcon, XCircleIcon, DocumentTextIcon, DocumentArrowUpIcon 
} from './icons/Icons';
import { TeachingReport, UploadedFile } from '../types';
import { fileToBase64 } from '../utils/fileUtils';

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

const TeachAI: React.FC = () => {
    const [topic, setTopic] = useState('');
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [correctMeMode, setCorrectMeMode] = useState(false);
    const [report, setReport] = useState<TeachingReport | null>(null);
    const [status, setStatus] = useState('Setup your class');
    const [fullTranscript, setFullTranscript] = useState('');
    const [isLoadingReport, setIsLoadingReport] = useState(false);
    
    // File Upload State
    const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
    const [isProcessingFile, setIsProcessingFile] = useState(false);

    // AV Refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
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

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        if (!selectedFile) return;

        if (selectedFile.size > 5 * 1024 * 1024) {
            alert('File size must be less than 5MB.');
            return;
        }

        if (!['image/jpeg', 'image/png', 'image/webp', 'text/plain'].includes(selectedFile.type)) {
            alert('Only Images (JPEG, PNG, WEBP) and Text files are supported for live context.');
            return;
        }

        setIsProcessingFile(true);
        try {
            const base64 = await fileToBase64(selectedFile);
            setUploadedFile({
                name: selectedFile.name,
                base64,
                mimeType: selectedFile.type,
            });
        } catch (err) {
            console.error(err);
            alert('Failed to process file.');
        } finally {
            setIsProcessingFile(false);
        }
    };

    const stopSession = useCallback(async () => {
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
        
        setIsSessionActive(false);
        setStatus('Generating Report...');
        setIsLoadingReport(true);

        // Generate Feedback Report
        try {
            const feedback = await generateTeachingFeedback(fullTranscript, topic);
            setReport(feedback);
        } catch (e) {
            console.error(e);
            setStatus('Failed to generate report.');
        } finally {
            setIsLoadingReport(false);
        }
    }, [fullTranscript, topic]);

    const startSession = async () => {
        if (!topic.trim()) return;

        setStatus('Connecting to student...');
        const apiKey = process.env.API_KEY || (import.meta as any).env?.VITE_API_KEY;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: true, 
                video: { facingMode: 'user' } // Teacher's face/camera
            });
            mediaStreamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }

            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            
            const ai = new GoogleGenAI({ apiKey: apiKey });

            const systemInstruction = `You are a curious, beginner student learning about "${topic}".
            - The user is your teacher.
            - Ask naive but relevant clarifying questions.
            - Do not lecture. Listen and learn.
            - ${correctMeMode ? 'IMPORTANT: The user has enabled "Correct Me" mode. If the user says something factually incorrect, politely interrupt and correct them.' : 'Do NOT correct the user unless they ask.'}
            - Keep your responses short and conversational.
            - ${uploadedFile ? 'The user has shared a document/image with you. Refer to it if relevant.' : ''}`;

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {}, 
                    outputAudioTranscription: {},
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } } },
                    systemInstruction: systemInstruction
                },
                callbacks: {
                    onopen: () => {
                        setIsSessionActive(true);
                        setStatus('Class is in session!');
                        setReport(null);
                        setFullTranscript('');
                        
                        sessionPromiseRef.current?.then(session => {
                            // 1. Send File Context if available
                            if (uploadedFile) {
                                if (uploadedFile.mimeType.startsWith('image/')) {
                                     session.sendRealtimeInput({ media: { mimeType: uploadedFile.mimeType, data: uploadedFile.base64 } });
                                } else if (uploadedFile.mimeType === 'text/plain') {
                                     const text = atob(uploadedFile.base64);
                                     session.sendRealtimeInput([{ text: `[Context Document Shared by Teacher]: \n${text}` }]);
                                }
                            }

                            // 2. Trigger Greeting
                            session.sendRealtimeInput([{ text: `The session has started. I am your teacher. Please greet me enthusiastically and mention that you are excited to learn about "${topic}".` }]);
                        });

                        // Video Streaming Loop
                        videoIntervalRef.current = window.setInterval(async () => {
                            if (!videoRef.current || !canvasRef.current) return;
                            const video = videoRef.current;
                            const canvas = canvasRef.current;
                            const ctx = canvas.getContext('2d');
                            if (!ctx || video.videoWidth === 0) return;
                            canvas.width = video.videoWidth / 3; 
                            canvas.height = video.videoHeight / 3;
                            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                            const base64Data = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
                            sessionPromiseRef.current?.then(session => {
                                session.sendRealtimeInput({ media: { mimeType: 'image/jpeg', data: base64Data } });
                            });
                        }, 1000);

                        // Audio Streaming
                        const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
                        const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = scriptProcessor;
                        scriptProcessor.onaudioprocess = (e) => {
                            const inputData = e.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            sessionPromiseRef.current?.then(session => session.sendRealtimeInput({ media: pcmBlob }));
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
                            const turnText = `Teacher: ${currentInputTranscription.current}\nStudent: ${currentOutputTranscription.current}\n`;
                            setFullTranscript(prev => prev + turnText);
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
                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;
                            audioSourcesRef.current.add(source);
                        }
                    },
                    onclose: () => { /* handled by stopSession logic mostly */ },
                    onerror: (e) => { console.error(e); stopSession(); }
                }
            });

        } catch (e) {
            console.error(e);
            setStatus('Error accessing devices.');
        }
    };

    return (
        <div className="flex flex-col h-full bg-white border-2 border-slate-200 rounded-3xl overflow-hidden shadow-sm">
            {/* Header */}
            <div className="flex-shrink-0 p-6 border-b-2 border-slate-100 flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-extrabold text-slate-800">Teach the AI</h2>
                    <p className="text-slate-500 font-medium">The Feynman Technique: Learn by teaching.</p>
                </div>
                <div className={`px-4 py-2 rounded-xl font-bold text-sm uppercase tracking-wide ${isSessionActive ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                    {status}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                {/* Setup Mode */}
                {!isSessionActive && !report && !isLoadingReport && (
                    <div className="max-w-xl mx-auto space-y-6">
                        <div className="bg-white p-6 rounded-3xl border-2 border-slate-200 shadow-sm">
                            <label className="block font-bold text-slate-700 mb-2">What topic will you teach?</label>
                            <input 
                                type="text" 
                                value={topic}
                                onChange={e => setTopic(e.target.value)}
                                placeholder="e.g. Thermodynamics, The French Revolution"
                                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl py-3 px-4 font-bold focus:outline-none focus:border-blue-500 transition-colors"
                            />
                        </div>

                        {/* File Upload for Context */}
                        <div className="bg-white p-6 rounded-3xl border-2 border-slate-200 shadow-sm">
                            <label className="block font-bold text-slate-700 mb-2">Upload Context (Optional)</label>
                             <p className="text-sm text-slate-400 mb-4 font-medium">Share a photo (e.g., derivative) or text note to help the AI understand.</p>
                             
                             <label className="flex items-center gap-3 cursor-pointer group">
                                <div className="bg-sky-50 group-hover:bg-sky-100 p-3 rounded-xl border-2 border-sky-100 group-hover:border-sky-300 transition-colors">
                                     <DocumentArrowUpIcon className="w-6 h-6 text-sky-500" />
                                </div>
                                <div className="flex-1">
                                    <span className="font-bold text-slate-600 block group-hover:text-sky-600 transition-colors">
                                        {uploadedFile ? uploadedFile.name : 'Choose Image or Text File'}
                                    </span>
                                     <span className="text-xs font-bold text-slate-400 uppercase">Max 5MB</span>
                                </div>
                                <input 
                                    type="file" 
                                    className="sr-only" 
                                    accept="image/*, text/plain"
                                    onChange={handleFileChange}
                                    disabled={isProcessingFile}
                                />
                             </label>
                             {uploadedFile && (
                                 <button 
                                    onClick={() => setUploadedFile(null)} 
                                    className="mt-2 text-xs font-bold text-red-500 hover:text-red-600 uppercase tracking-wide ml-auto block"
                                >
                                     Remove File
                                 </button>
                             )}
                        </div>

                        <div className="flex items-center justify-between bg-white p-6 rounded-3xl border-2 border-slate-200 shadow-sm">
                            <div>
                                <h3 className="font-bold text-slate-800">Correct Me Mode</h3>
                                <p className="text-sm text-slate-500 font-medium">The AI will interrupt if you make a mistake.</p>
                            </div>
                            <button 
                                onClick={() => setCorrectMeMode(!correctMeMode)}
                                className={`w-14 h-8 rounded-full p-1 transition-colors ${correctMeMode ? 'bg-blue-500' : 'bg-slate-300'}`}
                            >
                                <div className={`w-6 h-6 bg-white rounded-full shadow-sm transition-transform ${correctMeMode ? 'translate-x-6' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        <button 
                            onClick={startSession}
                            disabled={!topic.trim() || isProcessingFile}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 border-b-4 border-blue-800 active:border-b-0 active:translate-y-1 transition-all disabled:opacity-50"
                        >
                            <UserGroupIcon className="w-6 h-6" />
                            Start Class
                        </button>
                    </div>
                )}

                {/* Live Session Mode */}
                {isSessionActive && (
                    <div className="h-full flex flex-col items-center justify-center space-y-6">
                        <div className="relative w-full max-w-2xl aspect-video bg-black rounded-3xl overflow-hidden border-4 border-slate-200 shadow-lg">
                            <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                            <canvas ref={canvasRef} className="hidden" />
                            <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-2">
                                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                <span className="text-white text-xs font-bold uppercase">On Air</span>
                            </div>
                             {uploadedFile && (
                                <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1 rounded-xl flex items-center gap-2">
                                    <DocumentTextIcon className="w-4 h-4 text-white" />
                                    <span className="text-white text-xs font-bold truncate max-w-[150px]">{uploadedFile.name} shared</span>
                                </div>
                            )}
                        </div>
                        <button 
                            onClick={stopSession}
                            className="bg-red-500 hover:bg-red-400 text-white font-bold py-4 px-12 rounded-2xl flex items-center gap-3 border-b-4 border-red-700 active:border-b-0 active:translate-y-1 transition-all shadow-md"
                        >
                            <StopCircleIcon className="w-8 h-8" />
                            Finish Class
                        </button>
                    </div>
                )}

                {/* Report Card Mode */}
                {isLoadingReport && (
                    <div className="flex flex-col items-center justify-center h-full">
                        <SparklesIcon className="w-16 h-16 text-blue-500 animate-pulse mb-4" />
                        <h3 className="text-xl font-bold text-slate-800">Grading your teaching...</h3>
                    </div>
                )}

                {report && (
                    <div className="max-w-2xl mx-auto space-y-6">
                        <div className="flex items-center justify-between">
                             <h3 className="text-3xl font-extrabold text-slate-800">Teaching Report</h3>
                             <button onClick={() => { setReport(null); setTopic(''); setUploadedFile(null); }} className="text-blue-500 font-bold hover:underline">Teach Another Topic</button>
                        </div>
                       
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white p-6 rounded-3xl border-2 border-slate-200 text-center shadow-sm">
                                <span className="block text-slate-400 font-bold uppercase text-xs tracking-widest mb-2">Teaching Score</span>
                                <span className="text-5xl font-extrabold text-blue-600">{report.score}%</span>
                            </div>
                            <div className="bg-white p-6 rounded-3xl border-2 border-slate-200 text-center shadow-sm">
                                <span className="block text-slate-400 font-bold uppercase text-xs tracking-widest mb-2">Clarity</span>
                                <span className={`text-4xl font-extrabold ${report.clarityRating === 'High' ? 'text-green-500' : report.clarityRating === 'Medium' ? 'text-yellow-500' : 'text-red-500'}`}>
                                    {report.clarityRating}
                                </span>
                            </div>
                        </div>

                        <div className="bg-white p-8 rounded-3xl border-2 border-slate-200 shadow-sm">
                            <h4 className="text-xl font-bold text-slate-800 mb-4">Feedback</h4>
                            <p className="text-slate-600 leading-relaxed font-medium">{report.feedback}</p>
                        </div>

                        {report.missedPoints && report.missedPoints.length > 0 && (
                            <div className="bg-red-50 p-8 rounded-3xl border-2 border-red-100 shadow-sm">
                                <div className="flex items-center gap-3 mb-4">
                                    <XCircleIcon className="w-6 h-6 text-red-500" />
                                    <h4 className="text-xl font-bold text-red-800">Missed Concepts</h4>
                                </div>
                                <ul className="list-disc list-inside space-y-2 text-red-700 font-medium">
                                    {report.missedPoints.map((point, i) => (
                                        <li key={i}>{point}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TeachAI;
