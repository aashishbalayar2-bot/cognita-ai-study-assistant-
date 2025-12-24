
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ChatMessage, QuizQuestion, UploadedFile, ChatTool, RecapData, DailyRecapData, Flashcard, TeachingReport, QuestScene, StudyPlan, VisualReference, GlobalStudyPlan, StructuredNotes } from "../types";

// --- Helper Functions ---

const getAiClient = () => {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const fileToGenerativePart = (file: UploadedFile) => {
    return {
        inlineData: {
            data: file.base64,
            mimeType: file.mimeType,
        },
    };
};

const safeJsonParse = <T>(text: string, fallback: T): T => {
    if (!text) return fallback;
    try {
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanText) as T;
    } catch (e) {
        console.warn("JSON Parse Error", e);
        return fallback;
    }
};

// --- Exported API Functions ---

export const chatWithDocument = async (
    files: UploadedFile[],
    messages: ChatMessage[],
    input: string,
    tool: ChatTool,
    systemInstruction: string,
    extraFiles: UploadedFile[] = []
): Promise<string> => {
    const ai = getAiClient();
    const model = 'gemini-3-flash-preview';
    
    // Limit chat context to first 3 files + extras to ensure speed without losing too much context
    const fileParts = [...files.slice(0, 3), ...extraFiles].map(fileToGenerativePart);
    
    const chatContents = [
        ...messages.map(m => ({
            role: m.role,
            parts: [{ text: m.text }]
        })),
        {
            role: 'user',
            parts: [...fileParts, { text: input }]
        }
    ];

    const response = await ai.models.generateContent({
        model,
        contents: chatContents,
        config: {
            systemInstruction
        }
    });

    return response.text || "I'm sorry, I couldn't process that.";
};

export const generateFlashcardsFromConcept = async (
    files: UploadedFile[],
    topic: string,
    history: ChatMessage[]
): Promise<Flashcard[]> => {
    const ai = getAiClient();
    const model = 'gemini-3-flash-preview';
    const fileParts = files.slice(0, 3).map(fileToGenerativePart);
    
    const prompt = `Generate 5 high-quality flashcards based on the topic: "${topic}".
    Use the provided documents for context.
    Return a JSON array with types: qa, definition, problem, long_answer.`;

    const response = await ai.models.generateContent({
        model,
        contents: {
            role: 'user',
            parts: [...fileParts, { text: prompt }]
        },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        type: { type: Type.STRING, description: "qa, definition, problem, long_answer" },
                        front: { type: Type.STRING },
                        back: { type: Type.STRING }
                    },
                    required: ["type", "front", "back"]
                }
            }
        }
    });

    return safeJsonParse(response.text, []);
};

export const generateQuiz = async (
    files: UploadedFile[],
    count: number,
    type: 'mixed' | 'theoretical' | 'practical'
): Promise<QuizQuestion[]> => {
    const ai = getAiClient();
    const model = 'gemini-3-flash-preview';
    const fileParts = files.slice(0, 3).map(fileToGenerativePart);
    
    const prompt = `Generate a ${type} quiz with ${count} questions based on the documents. 
    Include explanations and difficulty levels. 
    If a question relates to a specific diagram or figure in the file, include a 'visualReference'.`;

    const response = await ai.models.generateContent({
        model,
        contents: {
            role: 'user',
            parts: [...fileParts, { text: prompt }]
        },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        question: { type: Type.STRING },
                        options: { type: Type.ARRAY, items: { type: Type.STRING } },
                        correctAnswer: { type: Type.STRING },
                        explanation: { type: Type.STRING },
                        difficulty: { type: Type.STRING },
                        page_ref: { type: Type.STRING },
                        visualReference: {
                            type: Type.OBJECT,
                            properties: {
                                type: { type: Type.STRING },
                                fileIndex: { type: Type.NUMBER },
                                pageNumber: { type: Type.NUMBER },
                                description: { type: Type.STRING }
                            },
                            required: ["type", "fileIndex", "description"]
                        }
                    },
                    required: ["question", "options", "correctAnswer", "explanation"]
                }
            }
        }
    });

    return safeJsonParse(response.text, []);
};

export const generateNotes = async (
    files: UploadedFile[],
    style: 'cornell' | 'bullet'
): Promise<StructuredNotes> => {
    const ai = getAiClient();
    const model = 'gemini-3-flash-preview';
    const fileParts = files.slice(0, 3).map(fileToGenerativePart);
    
    const prompt = `Generate highly effective, exam-focused study notes in ${style} style based on the files.
    
    Structure:
    1. Title: The main topic.
    2. Exam Tips: List 3-5 high-yield facts, common pitfalls, or things examiners specifically look for.
    3. Sections: Divide the content into logical sections. 
       - For 'cornell': 'cue' is the question/keyword, 'content' is the detailed explanation.
       - For 'bullet': 'cue' is the sub-heading, 'content' is the bulleted list.
    4. Visuals: If you find important diagrams in the files, capture their reference.
    5. Summary: A concise 2-3 sentence summary of the entire topic.
    
    Return valid JSON.`;

    const response = await ai.models.generateContent({
        model,
        contents: {
            role: 'user',
            parts: [...fileParts, { text: prompt }]
        },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    examTips: { type: Type.ARRAY, items: { type: Type.STRING } },
                    sections: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                cue: { type: Type.STRING },
                                content: { type: Type.STRING },
                                visualIndex: { type: Type.NUMBER, nullable: true }
                            },
                            required: ["cue", "content"]
                        }
                    },
                    summary: { type: Type.STRING },
                    visuals: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                type: { type: Type.STRING },
                                fileIndex: { type: Type.NUMBER },
                                pageNumber: { type: Type.NUMBER },
                                description: { type: Type.STRING }
                            },
                            required: ["type", "fileIndex", "description"]
                        }
                    }
                },
                required: ["title", "sections", "summary", "visuals", "examTips"]
            }
        }
    });

    return safeJsonParse(response.text, { title: 'Notes', examTips: [], sections: [], summary: '', visuals: [] });
};

export const generateRecap = async (files: UploadedFile[]): Promise<RecapData> => {
    const ai = getAiClient();
    const model = 'gemini-3-flash-preview';
    const fileParts = files.slice(0, 3).map(fileToGenerativePart);
    
    const prompt = `Generate a recap for these documents including a summary, key concepts, and 5 initial flashcards. 
    Also suggest a visualAidPrompt for a diagram.`;

    const response = await ai.models.generateContent({
        model,
        contents: {
            role: 'user',
            parts: [...fileParts, { text: prompt }]
        },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    summary: { type: Type.STRING },
                    keyConcepts: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                concept: { type: Type.STRING },
                                explanation: { type: Type.STRING }
                            },
                            required: ["concept", "explanation"]
                        }
                    },
                    flashcards: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                type: { type: Type.STRING },
                                front: { type: Type.STRING },
                                back: { type: Type.STRING }
                            },
                            required: ["type", "front", "back"]
                        }
                    },
                    visualAidPrompt: { type: Type.STRING }
                },
                required: ["summary", "keyConcepts", "flashcards", "visualAidPrompt"]
            }
        }
    });

    return safeJsonParse(response.text, { summary: '', keyConcepts: [], flashcards: [], visualAidPrompt: '' });
};

export const generateMoreFlashcards = async (files: UploadedFile[], existing: Flashcard[]): Promise<Flashcard[]> => {
    const ai = getAiClient();
    const model = 'gemini-3-flash-preview';
    const fileParts = files.slice(0, 3).map(fileToGenerativePart);
    const existingTopics = existing.map(f => f.front).join(', ');

    const prompt = `Generate 5 additional unique flashcards. Do not repeat these topics: ${existingTopics}`;

    const response = await ai.models.generateContent({
        model,
        contents: {
            role: 'user',
            parts: [...fileParts, { text: prompt }]
        },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        type: { type: Type.STRING },
                        front: { type: Type.STRING },
                        back: { type: Type.STRING }
                    },
                    required: ["type", "front", "back"]
                }
            }
        }
    });

    return safeJsonParse(response.text, []);
};

export const generateDailyRecap = async (files: UploadedFile[], topics: string): Promise<DailyRecapData> => {
    const ai = getAiClient();
    const model = 'gemini-3-flash-preview';
    // Limit to 3 files to balance speed and context
    const fileParts = files.slice(0, 3).map(fileToGenerativePart);
    
    const prompt = `Generate a cross-subject daily recap for the topics: "${topics}". 
    Identify connections between different materials. Include a mini-quiz.`;

    const response = await ai.models.generateContent({
        model,
        contents: {
            role: 'user',
            parts: [...fileParts, { text: prompt }]
        },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    summary: { type: Type.STRING },
                    connections: { type: Type.STRING },
                    keyConcepts: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                concept: { type: Type.STRING },
                                explanation: { type: Type.STRING }
                            }
                        }
                    },
                    flashcards: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                type: { type: Type.STRING },
                                front: { type: Type.STRING },
                                back: { type: Type.STRING }
                            }
                        }
                    },
                    quiz: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                question: { type: Type.STRING },
                                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                                correctAnswer: { type: Type.STRING },
                                explanation: { type: Type.STRING }
                            }
                        }
                    },
                    visualAidPrompt: { type: Type.STRING }
                }
            }
        }
    });

    return safeJsonParse(response.text, { summary: '', connections: '', keyConcepts: [], flashcards: [], quiz: [], visualAidPrompt: '' });
};

export const startQuest = async (files: UploadedFile[]): Promise<QuestScene> => {
    const ai = getAiClient();
    const model = 'gemini-3-flash-preview';
    const fileParts = files.slice(0, 3).map(fileToGenerativePart);

    const prompt = `Start a Socratic 'Quest' simulation based on the documents. 
    The student enters a learning environment. Provide a narrative, a concept explanation, and 3 initial challenges.`;

    const response = await ai.models.generateContent({
        model,
        contents: {
            role: 'user',
            parts: [...fileParts, { text: prompt }]
        },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    conceptName: { type: Type.STRING },
                    conceptExplanation: { type: Type.STRING },
                    narrative: { type: Type.STRING },
                    visualPrompt: { type: Type.STRING },
                    challenges: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                question: { type: Type.STRING },
                                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                                correctAnswer: { type: Type.STRING }
                            }
                        }
                    }
                }
            }
        }
    });

    return safeJsonParse(response.text, {} as QuestScene);
};

export const progressQuest = async (files: UploadedFile[], previousNarrative: string, userChoice: string, isCorrect: boolean): Promise<QuestScene> => {
    const ai = getAiClient();
    const model = 'gemini-3-flash-preview';
    const fileParts = files.slice(0, 3).map(fileToGenerativePart);

    const prompt = `Continue the Quest simulation. 
    The student answered: "${userChoice}" (${isCorrect ? 'Correct' : 'Incorrect'}).
    Previous scene: "${previousNarrative}".
    Deliver the next scene's narrative, concept, and challenges.`;

    const response = await ai.models.generateContent({
        model,
        contents: {
            role: 'user',
            parts: [...fileParts, { text: prompt }]
        },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    conceptName: { type: Type.STRING },
                    conceptExplanation: { type: Type.STRING },
                    narrative: { type: Type.STRING },
                    challenges: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                question: { type: Type.STRING },
                                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                                correctAnswer: { type: Type.STRING }
                            }
                        }
                    },
                    conceptUnlocked: { type: Type.STRING }
                }
            }
        }
    });

    return safeJsonParse(response.text, {} as QuestScene);
};

export const generatePodcastAudio = async (text: string): Promise<string> => {
    const ai = getAiClient();
    const model = "gemini-2.5-flash-preview-tts";
    
    const response = await ai.models.generateContent({
        model,
        contents: [{ parts: [{ text: `Read this clearly: ${text}` }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Kore' },
                },
            },
        },
    });

    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
};

export const generateTeachingFeedback = async (transcript: string, topic: string): Promise<TeachingReport> => {
    const ai = getAiClient();
    const model = 'gemini-3-flash-preview';
    
    const prompt = `Evaluate this teaching transcript on "${topic}". Rate clarity.`;

    const response = await ai.models.generateContent({
        model,
        contents: {
            role: 'user',
            parts: [{ text: prompt }, { text: transcript }]
        },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    score: { type: Type.NUMBER },
                    feedback: { type: Type.STRING },
                    clarityRating: { type: Type.STRING },
                    missedPoints: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["score", "feedback", "clarityRating", "missedPoints"]
            }
        }
    });

    return safeJsonParse(response.text, { score: 0, feedback: '', clarityRating: 'Medium', missedPoints: [] } as TeachingReport);
};

export const generateStudyPlan = async (files: UploadedFile[], goal: string, durationDays: number): Promise<StudyPlan> => {
    const ai = getAiClient();
    const model = 'gemini-3-flash-preview';
    const fileParts = files.slice(0, 3).map(fileToGenerativePart);

    const prompt = `Generate a structured ${durationDays}-day study plan for: "${goal}".
    Use the provided documents as the primary source.
    
    REQUIREMENTS:
    1. Create exactly ${durationDays} daily tasks.
    2. Each task must have a topic, activity, and 'importantQuestions'.
    3. If documents are insufficient, use general knowledge for "${goal}".
    4. Return valid JSON.`;

    const response = await ai.models.generateContent({
        model,
        contents: {
            role: 'user',
            parts: [...fileParts, { text: prompt }]
        },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    goal: { type: Type.STRING },
                    durationDays: { type: Type.NUMBER },
                    tasks: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id: { type: Type.STRING },
                                day: { type: Type.NUMBER },
                                topic: { type: Type.STRING },
                                activity: { type: Type.STRING },
                                completed: { type: Type.BOOLEAN },
                                importantQuestions: { type: Type.ARRAY, items: { type: Type.STRING } }
                            },
                            required: ["id", "day", "topic", "activity", "completed"]
                        }
                    }
                }
            }
        }
    });

    return safeJsonParse(response.text, { goal, durationDays, tasks: [] });
};

export const generateGlobalStudyPlan = async (
    files: UploadedFile[], 
    country: string, 
    examBoard: string, 
    goal: string, 
    personalization: string, 
    specFile?: UploadedFile
): Promise<GlobalStudyPlan> => {
    const ai = getAiClient();
    const model = 'gemini-3-pro-preview'; // UPGRADED to PRO for better complex reasoning
    
    // Process main files (limit to 3 for context window if needed, or maybe just send them)
    // The prompt in GlobalStudyPlanner suggests selecting files.
    const fileParts = files.slice(0, 5).map(fileToGenerativePart);
    
    let specPart = null;
    if (specFile) {
        specPart = fileToGenerativePart(specFile);
    }
    
    const parts = [...fileParts];
    if (specPart) parts.push(specPart);
    
    const prompt = `Generate a comprehensive exam-focused study plan based on the provided documents.
    Context:
    - Country: ${country}
    - Exam Board: ${examBoard}
    - Goal: ${goal}
    - User Preferences: ${personalization}
    
    Task:
    Analyze the provided content (and specification/syllabus grid if available) against the exam board syllabus.
    Create a modular study plan. Break down the syllabus into modules (chapters/units).
    
    **CRITICAL WEIGHTAGE RULES**:
    1. Determine the 'totalMarks' for the full exam paper (e.g. 75, 80, 100).
    2. Assign a 'weightage' (marks) to each module representing its contribution to the total.
    3. The sum of weightages of ALL modules must roughly equal 'totalMarks'.
    4. **DO NOT** assign the total exam marks to a single module. For example, if Total is 75, a single chapter might be 5, 10, or 12 marks, NOT 75.
    5. If the uploaded files only cover a *part* of the syllabus, assign realistic marks for those specific chapters (e.g., 10 marks total) but keep 'totalMarks' as the full exam total (e.g., 75).
    
    Create specific tasks for each module.
    Identify "importantQuestions" for each task that are likely to appear in exams.
    
    Return JSON format matching the schema.`;

    const response = await ai.models.generateContent({
        model,
        contents: {
            role: 'user',
            parts: [...parts, { text: prompt }]
        },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    country: { type: Type.STRING },
                    examBoard: { type: Type.STRING },
                    goal: { type: Type.STRING },
                    totalMarks: { type: Type.NUMBER },
                    modules: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id: { type: Type.STRING },
                                title: { type: Type.STRING },
                                weightage: { type: Type.NUMBER },
                                completed: { type: Type.BOOLEAN },
                                tasks: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            id: { type: Type.STRING },
                                            topic: { type: Type.STRING },
                                            description: { type: Type.STRING },
                                            completed: { type: Type.BOOLEAN },
                                            importantQuestions: { type: Type.ARRAY, items: { type: Type.STRING } }
                                        },
                                        required: ["id", "topic", "description", "completed"]
                                    }
                                }
                            },
                            required: ["id", "title", "weightage", "tasks", "completed"]
                        }
                    }
                },
                required: ["country", "examBoard", "goal", "totalMarks", "modules"]
            }
        }
    });

    return safeJsonParse(response.text, { country, examBoard, goal, totalMarks: 100, modules: [] } as GlobalStudyPlan);
};

export const generateConceptExplanation = async (files: UploadedFile[], topic: string): Promise<string> => {
    const ai = getAiClient();
    const model = 'gemini-3-flash-preview';
    const fileParts = files.slice(0, 2).map(fileToGenerativePart);
    
    const prompt = `Act as a Lecturer. Summarize "${topic}" with core intuition and 1 example.`;

    const response = await ai.models.generateContent({
        model,
        contents: {
            role: 'user',
            parts: [...fileParts, { text: prompt }]
        },
    });
    
    return response.text || "Could not generate lecture content.";
};
