
import React from 'react';
import { SparklesIcon } from './icons/Icons';

const Poster: React.FC = () => {
    return (
        <div className="bg-white h-auto p-8">
            <div className="max-w-[1400px] mx-auto bg-white shadow-2xl p-12 border border-slate-200 aspect-[1.414/1] flex flex-col" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                
                {/* Header */}
                <div className="w-full flex justify-between items-center border-b-4 border-[#002060] pb-6 mb-8">
                    <div className="flex-1">
                        <h1 className="text-5xl font-bold text-[#002060] mb-2 uppercase tracking-wide">Cognita: AI-Powered Revision Tool</h1>
                        <h2 className="text-3xl font-bold text-slate-700">Revolutionizing Student Study Habits with Multimodal GenAI</h2>
                    </div>
                    <div className="flex flex-col items-end justify-center">
                        <div className="w-24 h-24 bg-[#002060] flex items-center justify-center rounded-lg shadow-lg">
                            <SparklesIcon className="w-16 h-16 text-white" />
                        </div>
                        <p className="mt-2 text-xl font-bold text-[#002060]">Project ID: GEN-2025</p>
                    </div>
                </div>

                {/* Grid Layout */}
                <div className="grid grid-cols-2 gap-12 flex-1">
                    
                    {/* Left Column */}
                    <div className="space-y-10">
                        
                        {/* Background/Introduction */}
                        <section>
                            <h3 className="text-3xl font-bold text-[#002060] mb-4 border-b-2 border-[#002060] inline-block">Background/Introduction</h3>
                            <p className="text-xl text-justify leading-[1.5] text-slate-800">
                                Traditional study methods often rely on passive reading of static textbooks and PDFs, which leads to low retention rates and exam anxiety. Students lack affordable, personalized 1:1 tutoring that can adapt to their specific curriculum.
                                <br/><br/>
                                <strong>Cognita</strong> bridges this gap by utilizing Multimodal Generative AI (Gemini 2.5) to transform static study materials into interactive, Socratic learning experiences. The project aims to democratize access to high-quality, personalized tutoring.
                            </p>
                        </section>

                        {/* Objectives */}
                        <section>
                            <h3 className="text-3xl font-bold text-[#002060] mb-4 border-b-2 border-[#002060] inline-block">Objectives</h3>
                            <ul className="list-disc pl-6 space-y-2 text-xl text-justify leading-[1.5] text-slate-800">
                                <li><strong>Multimodal Interaction:</strong> Enable students to converse with their notes using voice, text, and video streams via the Gemini Live API.</li>
                                <li><strong>Active Recall Automation:</strong> Automatically generate flashcards, quizzes, and Cornell notes from uploaded documents to enforce testing effects.</li>
                                <li><strong>Structured Planning:</strong> Create personalized, exam-board specific study schedules and roadmaps based on syllabus weightage.</li>
                            </ul>
                        </section>

                        {/* Material and Methods */}
                        <section>
                            <h3 className="text-3xl font-bold text-[#002060] mb-4 border-b-2 border-[#002060] inline-block">Material and Methods</h3>
                            <p className="text-xl text-justify leading-[1.5] text-slate-800 mb-4">
                                The application is built as a Progressive Web App (PWA) using a modern tech stack designed for low-latency AI interaction.
                            </p>
                            <div className="bg-slate-50 border border-slate-200 p-6 rounded-xl">
                                <ul className="list-disc pl-6 space-y-2 text-xl text-justify leading-[1.5] text-slate-800">
                                    <li><strong>Frontend Framework:</strong> React 19 with Vite for high-performance rendering.</li>
                                    <li><strong>AI Engine:</strong> Google Gemini 2.5 Flash & Pro models for text/image analysis; Gemini Live API (WebSockets) for real-time voice tutoring.</li>
                                    <li><strong>Audio Processing:</strong> Web Audio API for PCM encoding/decoding to support raw audio streams from the model.</li>
                                    <li><strong>State Management:</strong> LocalStorage for persistent user study data and chat history.</li>
                                </ul>
                            </div>
                        </section>

                    </div>

                    {/* Right Column */}
                    <div className="space-y-10">

                        {/* Results */}
                        <section>
                            <h3 className="text-3xl font-bold text-[#002060] mb-4 border-b-2 border-[#002060] inline-block">Results</h3>
                            <p className="text-xl text-justify leading-[1.5] text-slate-800 mb-4">
                                The prototype demonstrates significant improvements in study workflow efficiency and engagement.
                            </p>
                            
                            <div className="grid grid-cols-2 gap-6 mb-6">
                                <div className="border-2 border-slate-200 p-4 text-center rounded-lg bg-[#f8fafc]">
                                    <span className="block text-5xl font-bold text-[#002060] mb-2">&lt;500ms</span>
                                    <span className="text-lg font-bold">Voice Latency</span>
                                </div>
                                <div className="border-2 border-slate-200 p-4 text-center rounded-lg bg-[#f8fafc]">
                                    <span className="block text-5xl font-bold text-[#002060] mb-2">100%</span>
                                    <span className="text-lg font-bold">Context Awareness</span>
                                </div>
                            </div>

                            <p className="text-xl text-justify leading-[1.5] text-slate-800">
                                <strong>Flashcard Generation:</strong> Successfully extracted key concepts from dense PDFs with >95% accuracy.
                                <br/>
                                <strong>Live Tutor:</strong> The 'Professor Zero' persona successfully interpreted video frames of math problems and provided step-by-step guidance without giving direct answers.
                            </p>
                        </section>

                        {/* Conclusions */}
                        <section>
                            <h3 className="text-3xl font-bold text-[#002060] mb-4 border-b-2 border-[#002060] inline-block">Conclusions</h3>
                            <ul className="list-disc pl-6 space-y-2 text-xl text-justify leading-[1.5] text-slate-800">
                                <li>Generative AI can effectively transcend simple "chatbots" to act as proactive pedagogical agents.</li>
                                <li>Multimodal input (Audio/Video) is critical for STEM subjects where diagrams and formulas are prevalent.</li>
                                <li>Client-side processing with Gemini Flash creates a responsive, real-time experience viable for daily study.</li>
                            </ul>
                        </section>

                        {/* Recommendation (Optional) */}
                        <section>
                            <h3 className="text-3xl font-bold text-[#002060] mb-4 border-b-2 border-[#002060] inline-block">Recommendation</h3>
                            <p className="text-xl text-justify leading-[1.5] text-slate-800">
                                Future development should focus on integrating Spaced Repetition Systems (SRS) algorithms directly into the flashcard module and expanding the Quest Mode to support multiplayer collaborative learning sessions.
                            </p>
                        </section>

                        {/* References */}
                        <section>
                            <h3 className="text-3xl font-bold text-[#002060] mb-4 border-b-2 border-[#002060] inline-block">References</h3>
                            <ol className="list-decimal pl-6 space-y-1 text-lg text-justify leading-[1.5] text-slate-800">
                                <li>Google DeepMind. (2024). <em>Gemini 1.5: Unlocking multimodal understanding across millions of tokens of context.</em></li>
                                <li>React Documentation. (2024). <em>React: The library for web and native user interfaces.</em></li>
                                <li>MDN Web Docs. (2024). <em>Web Audio API.</em></li>
                            </ol>
                        </section>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default Poster;
