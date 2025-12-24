
import React, { useState } from 'react';
import { 
    ChevronLeftIcon, ChevronRightIcon, PresentationChartBarIcon, 
    SparklesIcon, CpuChipIcon, VideoCameraIcon, UserGroupIcon, 
    BoltIcon, CheckCircleIcon, MapIcon, FireIcon, ArrowDownTrayIcon
} from './icons/Icons';

const slides = [
    {
        id: 'title',
        title: "Cognita",
        subtitle: "AI-Powered Personalized Revision Platform",
        content: (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-8">
                <div className="w-32 h-32 bg-blue-600 rounded-3xl flex items-center justify-center shadow-lg shadow-blue-200">
                    <SparklesIcon className="w-20 h-20 text-white" />
                </div>
                <div>
                    <h1 className="text-6xl font-black text-slate-800 mb-4 tracking-tight">Cognita</h1>
                    <p className="text-2xl text-slate-500 font-medium max-w-2xl mx-auto">
                        Revolutionizing Student Study Habits with Multimodal GenAI
                    </p>
                </div>
                <div className="mt-12 flex gap-4">
                    <span className="px-4 py-2 bg-slate-100 rounded-full text-slate-600 font-bold text-sm">React</span>
                    <span className="px-4 py-2 bg-slate-100 rounded-full text-slate-600 font-bold text-sm">Gemini 2.5</span>
                    <span className="px-4 py-2 bg-slate-100 rounded-full text-slate-600 font-bold text-sm">Web Audio API</span>
                </div>
            </div>
        )
    },
    {
        id: 'motivation',
        title: "Motivation",
        subtitle: "Why we built this",
        content: (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center h-full">
                <div className="space-y-6">
                    <div className="bg-red-50 p-6 rounded-2xl border border-red-100">
                        <h3 className="text-xl font-bold text-red-700 mb-2">The Problem</h3>
                        <p className="text-red-600">Students struggle with passive reading. Static PDFs and textbooks fail to engage active recall, leading to poor retention and exam anxiety.</p>
                    </div>
                    <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                        <h3 className="text-xl font-bold text-blue-700 mb-2">The Gap</h3>
                        <p className="text-blue-600">Existing tools are disconnected. Chatbots lack context, and LMS platforms lack interactivity. Students need a 1:1 tutor, but human tutors are expensive.</p>
                    </div>
                </div>
                <div className="flex items-center justify-center">
                    <div className="w-64 h-64 bg-slate-100 rounded-full flex items-center justify-center relative">
                        <div className="absolute inset-0 border-4 border-dashed border-slate-300 rounded-full animate-spin-slow"></div>
                        <UserGroupIcon className="w-32 h-32 text-slate-300" />
                        <div className="absolute -bottom-4 bg-white px-6 py-2 rounded-xl shadow-sm border border-slate-200 font-bold text-slate-600">
                            Student Centricity
                        </div>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: 'objectives',
        title: "Objectives",
        subtitle: "What we aim to achieve",
        content: (
            <div className="h-full flex flex-col justify-center">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[
                        { icon: VideoCameraIcon, title: "Multimodal Interaction", text: "Enable voice and video-based Socratic tutoring using Gemini Live API." },
                        { icon: BoltIcon, title: "Active Recall", text: "Automate the creation of flashcards, quizzes, and Cornell notes from raw documents." },
                        { icon: MapIcon, title: "Structured Learning", text: "Generate personalized study plans and roadmaps based on syllabus grids." },
                        { icon: FireIcon, title: "Gamification", text: "Increase engagement through Quest Mode, XP systems, and streak tracking." }
                    ].map((item, i) => (
                        <div key={i} className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm flex items-start gap-4">
                            <div className="bg-slate-50 p-3 rounded-lg">
                                <item.icon className="w-8 h-8 text-blue-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">{item.title}</h3>
                                <p className="text-slate-500 text-sm mt-1">{item.text}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )
    },
    {
        id: 'research',
        title: "Research Design",
        subtitle: "Technical Architecture",
        content: (
            <div className="h-full flex flex-col items-center justify-center">
                <div className="relative w-full max-w-4xl">
                    {/* Architecture Diagram Simulation */}
                    <div className="flex justify-between items-center relative z-10">
                        <div className="w-48 bg-white border-2 border-slate-800 p-4 rounded-xl text-center shadow-lg">
                            <div className="font-black text-slate-800 text-lg mb-1">Client Layer</div>
                            <div className="text-xs font-bold text-slate-500 uppercase">React + Vite</div>
                            <div className="mt-2 text-xs text-slate-400">AudioContext / Canvas</div>
                        </div>
                        
                        <div className="flex-1 h-1 bg-slate-300 mx-4 relative">
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-100 px-2 text-xs font-bold text-slate-500">WebSockets / REST</div>
                        </div>

                        <div className="w-48 bg-blue-600 border-2 border-blue-800 p-4 rounded-xl text-center shadow-lg text-white">
                            <div className="font-black text-white text-lg mb-1">Intelligence Layer</div>
                            <div className="text-xs font-bold text-blue-200 uppercase">Gemini 2.5 / 3.0</div>
                            <div className="mt-2 text-xs text-blue-200">Multimodal Processing</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mt-12">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
                            <h4 className="font-bold text-slate-700 mb-2">Ingestion</h4>
                            <p className="text-xs text-slate-500">PDF/Image processing via Base64 & Canvas</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
                            <h4 className="font-bold text-slate-700 mb-2">Orchestration</h4>
                            <p className="text-xs text-slate-500">Prompt Engineering & Context Management</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
                            <h4 className="font-bold text-slate-700 mb-2">Output</h4>
                            <p className="text-xs text-slate-500">JSON Schemas, PCM Audio, Markdown</p>
                        </div>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: 'results',
        title: "Expected Outcome",
        subtitle: "Impact & Results",
        content: (
            <div className="h-full flex items-center justify-center">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center">
                        <div className="text-5xl font-black text-green-500 mb-2">3x</div>
                        <div className="text-lg font-bold text-slate-700">Retention Rate</div>
                        <p className="text-sm text-slate-500 mt-2">Active recall via flashcards vs passive reading.</p>
                    </div>
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center">
                        <div className="text-5xl font-black text-blue-500 mb-2">&lt;500ms</div>
                        <div className="text-lg font-bold text-slate-700">Latency</div>
                        <p className="text-sm text-slate-500 mt-2">Real-time voice interaction feeling natural.</p>
                    </div>
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center">
                        <div className="text-5xl font-black text-purple-500 mb-2">100%</div>
                        <div className="text-lg font-bold text-slate-700">Personalized</div>
                        <p className="text-sm text-slate-500 mt-2">Every explanation tailored to the user's files.</p>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: 'conclusion',
        title: "Conclusion",
        subtitle: "The Future of Learning",
        content: (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-3xl mx-auto space-y-8">
                <div className="bg-green-50 p-6 rounded-full border border-green-100">
                    <CheckCircleIcon className="w-16 h-16 text-green-600" />
                </div>
                <p className="text-2xl font-bold text-slate-700 leading-relaxed">
                    Cognita successfully demonstrates that GenAI can transcend simple "chatbots" to become proactive, multimodal teachers.
                </p>
                <div className="bg-slate-800 text-white p-6 rounded-xl w-full text-left">
                    <h4 className="font-bold text-slate-300 uppercase tracking-widest text-sm mb-3">Key Takeaways</h4>
                    <ul className="space-y-2 font-medium">
                        <li className="flex gap-2"><span className="text-blue-400">✓</span> Multimodal input (Video/Audio) is essential for STEM.</li>
                        <li className="flex gap-2"><span className="text-blue-400">✓</span> Pedagogical scaffolding (Hints before Answers) works best.</li>
                        <li className="flex gap-2"><span className="text-blue-400">✓</span> Low latency is critical for engagement.</li>
                    </ul>
                </div>
            </div>
        )
    }
];

const ProjectReport: React.FC = () => {
    const [currentSlide, setCurrentSlide] = useState(0);

    const handleNext = () => {
        setCurrentSlide(prev => Math.min(prev + 1, slides.length - 1));
    };

    const handlePrev = () => {
        setCurrentSlide(prev => Math.max(prev - 1, 0));
    };

    const handleDownloadPPTX = () => {
        const pres = new window.PptxGenJS();
        
        // Define Slide Master for consistent branding
        pres.defineSlideMaster({
            title: "MASTER_SLIDE",
            background: { color: "F1F5F9" }, // Slate-100 background
            objects: [
                { rect: { x: 0, y: 0, w: "100%", h: 0.15, fill: { color: "3B82F6" } } }, // Top blue bar
                { text: { text: "Cognita Project Report", options: { x: 0.5, y: 7.2, w: 5, h: 0.3, fontSize: 10, color: "94A3B8" } } },
                { text: { text: "Powered by Gemini", options: { x: 8.5, y: 7.2, w: 2, h: 0.3, fontSize: 10, color: "94A3B8", align: "right" } } }
            ]
        });

        // 1. Title Slide
        let slide = pres.addSlide();
        slide.background = { color: "FFFFFF" };
        slide.addText("Cognita", { x: 1, y: 2.5, w: "80%", fontSize: 60, fontFace: "Arial", bold: true, color: "1E293B", align: "center" });
        slide.addText("AI-Powered Personalized Revision Platform", { x: 1, y: 3.5, w: "80%", fontSize: 24, color: "64748B", align: "center" });
        slide.addText("Revolutionizing Student Study Habits with Multimodal GenAI", { x: 1, y: 4.2, w: "80%", fontSize: 18, color: "94A3B8", align: "center", italic: true });
        
        // Tech Stack Tags
        slide.addShape(pres.ShapeType.roundRect, { x: 3.5, y: 5.5, w: 1.5, h: 0.5, fill: { color: "F1F5F9" } });
        slide.addText("React", { x: 3.5, y: 5.5, w: 1.5, h: 0.5, fontSize: 14, color: "475569", align: "center" });
        
        slide.addShape(pres.ShapeType.roundRect, { x: 5.2, y: 5.5, w: 1.5, h: 0.5, fill: { color: "F1F5F9" } });
        slide.addText("Gemini 2.5", { x: 5.2, y: 5.5, w: 1.5, h: 0.5, fontSize: 14, color: "475569", align: "center" });

        slide.addShape(pres.ShapeType.roundRect, { x: 6.9, y: 5.5, w: 1.8, h: 0.5, fill: { color: "F1F5F9" } });
        slide.addText("Web Audio API", { x: 6.9, y: 5.5, w: 1.8, h: 0.5, fontSize: 14, color: "475569", align: "center" });


        // 2. Motivation
        slide = pres.addSlide({ masterName: "MASTER_SLIDE" });
        slide.addText("Motivation", { x: 0.5, y: 0.5, fontSize: 32, bold: true, color: "1E293B" });
        slide.addText("Why we built this", { x: 0.5, y: 1.0, fontSize: 18, color: "3B82F6", bold: true });

        // Left Box: The Problem
        slide.addShape(pres.ShapeType.rect, { x: 0.5, y: 1.8, w: 4.2, h: 2.5, fill: { color: "FEF2F2" }, line: { color: "FECACA", width: 1 } });
        slide.addText("The Problem", { x: 0.7, y: 2.0, w: 3.8, fontSize: 18, bold: true, color: "B91C1C" });
        slide.addText("Students struggle with passive reading. Static PDFs and textbooks fail to engage active recall, leading to poor retention and exam anxiety.", { x: 0.7, y: 2.5, w: 3.8, fontSize: 14, color: "DC2626" });

        // Right Box: The Gap
        slide.addShape(pres.ShapeType.rect, { x: 5.3, y: 1.8, w: 4.2, h: 2.5, fill: { color: "EFF6FF" }, line: { color: "DBEAFE", width: 1 } });
        slide.addText("The Gap", { x: 5.5, y: 2.0, w: 3.8, fontSize: 18, bold: true, color: "1D4ED8" });
        slide.addText("Existing tools are disconnected. Chatbots lack context, and LMS platforms lack interactivity. Students need a 1:1 tutor, but human tutors are expensive.", { x: 5.5, y: 2.5, w: 3.8, fontSize: 14, color: "2563EB" });

        // Bottom: Student Centricity
        slide.addShape(pres.ShapeType.oval, { x: 4.25, y: 4.8, w: 1.5, h: 1.5, fill: { color: "F1F5F9" } });
        slide.addText("Student Centricity", { x: 3.5, y: 6.5, w: 3, h: 0.5, fontSize: 16, bold: true, color: "475569", align: "center" });


        // 3. Objectives
        slide = pres.addSlide({ masterName: "MASTER_SLIDE" });
        slide.addText("Objectives", { x: 0.5, y: 0.5, fontSize: 32, bold: true, color: "1E293B" });
        slide.addText("What we aim to achieve", { x: 0.5, y: 1.0, fontSize: 18, color: "3B82F6", bold: true });

        const objectives = [
            { title: "Multimodal Interaction", text: "Enable voice and video-based Socratic tutoring using Gemini Live API." },
            { title: "Active Recall", text: "Automate the creation of flashcards, quizzes, and Cornell notes from raw documents." },
            { title: "Structured Learning", text: "Generate personalized study plans and roadmaps based on syllabus grids." },
            { title: "Gamification", text: "Increase engagement through Quest Mode, XP systems, and streak tracking." }
        ];

        objectives.forEach((obj, i) => {
            const xPos = i % 2 === 0 ? 0.5 : 5.3;
            const yPos = i < 2 ? 1.8 : 4.2;
            
            slide.addShape(pres.ShapeType.rect, { x: xPos, y: yPos, w: 4.5, h: 1.8, fill: { color: "FFFFFF" }, line: { color: "E2E8F0" } });
            slide.addText(obj.title, { x: xPos + 0.2, y: yPos + 0.2, w: 4, fontSize: 16, bold: true, color: "1E293B" });
            slide.addText(obj.text, { x: xPos + 0.2, y: yPos + 0.6, w: 4, fontSize: 12, color: "64748B" });
        });


        // 4. Research Design
        slide = pres.addSlide({ masterName: "MASTER_SLIDE" });
        slide.addText("Research Design", { x: 0.5, y: 0.5, fontSize: 32, bold: true, color: "1E293B" });
        slide.addText("Technical Architecture", { x: 0.5, y: 1.0, fontSize: 18, color: "3B82F6", bold: true });

        // Client Layer Box
        slide.addShape(pres.ShapeType.rect, { x: 1.0, y: 2.5, w: 2.5, h: 1.5, fill: { color: "FFFFFF" }, line: { color: "1E293B", width: 2 } });
        slide.addText("Client Layer", { x: 1.0, y: 2.6, w: 2.5, fontSize: 14, bold: true, align: "center" });
        slide.addText("React + Vite", { x: 1.0, y: 3.0, w: 2.5, fontSize: 12, color: "64748B", align: "center" });
        slide.addText("AudioContext / Canvas", { x: 1.0, y: 3.4, w: 2.5, fontSize: 10, color: "94A3B8", align: "center" });

        // Connector Line
        slide.addShape(pres.ShapeType.line, { x: 3.5, y: 3.25, w: 3.0, h: 0, line: { color: "CBD5E1", width: 3 } });
        slide.addText("WebSockets / REST", { x: 3.5, y: 2.9, w: 3.0, fontSize: 10, bold: true, color: "64748B", align: "center" });

        // Intelligence Layer Box
        slide.addShape(pres.ShapeType.rect, { x: 6.5, y: 2.5, w: 2.5, h: 1.5, fill: { color: "2563EB" }, line: { color: "1E40AF", width: 2 } });
        slide.addText("Intelligence Layer", { x: 6.5, y: 2.6, w: 2.5, fontSize: 14, bold: true, color: "FFFFFF", align: "center" });
        slide.addText("Gemini 2.5 / 3.0", { x: 6.5, y: 3.0, w: 2.5, fontSize: 12, color: "BFDBFE", align: "center" });
        slide.addText("Multimodal Processing", { x: 6.5, y: 3.4, w: 2.5, fontSize: 10, color: "BFDBFE", align: "center" });

        // Bottom Boxes
        const boxes = [
            { t: "Ingestion", d: "PDF/Image processing via Base64 & Canvas" },
            { t: "Orchestration", d: "Prompt Engineering & Context Management" },
            { t: "Output", d: "JSON Schemas, PCM Audio, Markdown" }
        ];
        
        boxes.forEach((b, i) => {
            slide.addShape(pres.ShapeType.rect, { x: 1.0 + (i * 2.8), y: 5.0, w: 2.5, h: 1.2, fill: { color: "F8FAFC" }, line: { color: "E2E8F0" } });
            slide.addText(b.t, { x: 1.0 + (i * 2.8), y: 5.1, w: 2.5, fontSize: 12, bold: true, color: "334155", align: "center" });
            slide.addText(b.d, { x: 1.0 + (i * 2.8), y: 5.5, w: 2.5, fontSize: 10, color: "64748B", align: "center" });
        });


        // 5. Expected Outcome
        slide = pres.addSlide({ masterName: "MASTER_SLIDE" });
        slide.addText("Expected Outcome", { x: 0.5, y: 0.5, fontSize: 32, bold: true, color: "1E293B" });
        slide.addText("Impact & Results", { x: 0.5, y: 1.0, fontSize: 18, color: "3B82F6", bold: true });

        const results = [
            { val: "3x", label: "Retention Rate", desc: "Active recall via flashcards vs passive reading.", color: "22C55E" },
            { val: "<500ms", label: "Latency", desc: "Real-time voice interaction feeling natural.", color: "3B82F6" },
            { val: "100%", label: "Personalized", desc: "Every explanation tailored to the user's files.", color: "A855F7" }
        ];

        results.forEach((res, i) => {
            const xPos = 0.5 + (i * 3.2);
            slide.addShape(pres.ShapeType.rect, { x: xPos, y: 2.5, w: 2.8, h: 3.0, fill: { color: "FFFFFF" }, line: { color: "E2E8F0" } });
            slide.addText(res.val, { x: xPos, y: 2.8, w: 2.8, fontSize: 48, bold: true, color: res.color, align: "center" });
            slide.addText(res.label, { x: xPos, y: 4.0, w: 2.8, fontSize: 18, bold: true, color: "334155", align: "center" });
            slide.addText(res.desc, { x: xPos + 0.2, y: 4.5, w: 2.4, fontSize: 12, color: "64748B", align: "center" });
        });


        // 6. Conclusion
        slide = pres.addSlide({ masterName: "MASTER_SLIDE" });
        slide.addText("Conclusion", { x: 0.5, y: 0.5, fontSize: 32, bold: true, color: "1E293B" });
        slide.addText("The Future of Learning", { x: 0.5, y: 1.0, fontSize: 18, color: "3B82F6", bold: true });

        slide.addText("Cognita successfully demonstrates that GenAI can transcend simple \"chatbots\" to become proactive, multimodal teachers.", { x: 1.5, y: 2.5, w: 7, fontSize: 20, bold: true, color: "334155", align: "center" });

        // Dark Box for Takeaways
        slide.addShape(pres.ShapeType.rect, { x: 1.5, y: 4.0, w: 7, h: 2.5, fill: { color: "1E293B" }, rx: 10 });
        slide.addText("KEY TAKEAWAYS", { x: 1.5, y: 4.2, w: 7, fontSize: 12, bold: true, color: "CBD5E1", align: "center" });
        
        slide.addText("✓ Multimodal input (Video/Audio) is essential for STEM.", { x: 1.8, y: 4.8, w: 6.4, fontSize: 14, color: "FFFFFF" });
        slide.addText("✓ Pedagogical scaffolding (Hints before Answers) works best.", { x: 1.8, y: 5.3, w: 6.4, fontSize: 14, color: "FFFFFF" });
        slide.addText("✓ Low latency is critical for engagement.", { x: 1.8, y: 5.8, w: 6.4, fontSize: 14, color: "FFFFFF" });

        pres.writeFile({ fileName: 'Cognita_Project_Report.pptx' });
    };

    return (
        <div className="h-full bg-slate-100 flex flex-col p-4 md:p-8">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-black text-slate-800">Project Report</h2>
                    <p className="text-slate-500 font-medium">Cognita Development Presentation</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleDownloadPPTX}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-sm active:translate-y-0.5 mr-4"
                    >
                        <ArrowDownTrayIcon className="w-5 h-5" />
                        Download PPTX
                    </button>

                    <button 
                        onClick={handlePrev}
                        disabled={currentSlide === 0}
                        className="p-3 rounded-xl bg-white border border-slate-200 text-slate-600 disabled:opacity-50 hover:bg-slate-50 transition-colors shadow-sm"
                    >
                        <ChevronLeftIcon className="w-6 h-6" />
                    </button>
                    <span className="flex items-center px-4 font-bold text-slate-600 bg-white border border-slate-200 rounded-xl shadow-sm">
                        {currentSlide + 1} / {slides.length}
                    </span>
                    <button 
                        onClick={handleNext}
                        disabled={currentSlide === slides.length - 1}
                        className="p-3 rounded-xl bg-white border border-slate-200 text-slate-600 disabled:opacity-50 hover:bg-slate-50 transition-colors shadow-sm"
                    >
                        <ChevronRightIcon className="w-6 h-6" />
                    </button>
                </div>
            </div>

            <div className="flex-1 bg-white rounded-2xl shadow-xl overflow-hidden relative border border-slate-200">
                {/* Slide Header */}
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
                <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
                    <SparklesIcon className="w-32 h-32" />
                </div>

                <div className="h-full flex flex-col p-8 md:p-16">
                    <div className="mb-8 border-b border-slate-100 pb-4">
                        <h2 className="text-4xl font-extrabold text-slate-900">{slides[currentSlide].title}</h2>
                        <p className="text-xl text-blue-600 font-bold mt-2">{slides[currentSlide].subtitle}</p>
                    </div>
                    <div className="flex-1 relative">
                        {slides[currentSlide].content}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProjectReport;
