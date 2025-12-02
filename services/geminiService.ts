import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ChatMessage, QuizQuestion, UploadedFile, ChatTool, RecapData, DailyRecapData, Flashcard, TeachingReport, QuestScene } from "../types";

// Helper to access API key safely in both Node-like and Vite environments
const getApiKey = () => {
  return process.env.API_KEY || (import.meta as any).env?.VITE_API_KEY;
};

const ai = new GoogleGenAI({ apiKey: getApiKey() });

const fileToGenerativePart = (file: UploadedFile) => {
  return {
    inlineData: {
      data: file.base64,
      mimeType: file.mimeType,
    },
  };
};

export const chatWithDocument = async (
    files: UploadedFile[], 
    history: ChatMessage[], 
    newMessage: string, 
    activeTool: ChatTool, 
    toolSystemInstruction: string,
    additionalFiles: UploadedFile[] = []
) => {
  const model = 'gemini-2.5-flash';
  const primaryFileName = files[0]?.name || 'the document';

  const historyContent = history.map(msg => ({ 
    role: msg.role, 
    parts: [{ text: msg.text }] 
  }));

  const fileParts = files.map(fileToGenerativePart);
  const additionalFileParts = additionalFiles.map(fileToGenerativePart);

  const userParts = [];
  // Only add the documents for the very first message of the conversation
  // or if switching from general to a specific tool for the first time in a session.
  if (history.length === 0 || (activeTool !== 'general' && history.length > 0 && history[history.length -1].role === 'model' && !history[history.length -1].text.includes('Tool:'))) {
    userParts.push(...fileParts);
  }
  
  // Always include additional files attached to this specific message
  if (additionalFileParts.length > 0) {
      userParts.push(...additionalFileParts);
  }

  userParts.push({ text: newMessage });

  const newUserContent = { role: 'user', parts: userParts };

  // DEEP LEARNING UPDATE: Changed default persona to be Socratic and Analogical
  const baseInstruction = `You are "Professor Zero", an expert AI Tutor designed to foster deep understanding, not just memorization.
- Your goal is to help the student *understand* the "Why" and "How", not just the "What".
- Response Header: "Tool: General Chat | Topic: ${primaryFileName}"
- Methodology:
  1. **Scaffolding**: If a concept is complex, break it down.
  2. **Analogies**: Use real-world analogies to explain abstract concepts.
  3. **Check for Understanding**: Occasionally ask "Does that make sense?" or "How would you explain this in your own words?".
  4. **Don't just Dump Facts**: If the user asks a broad question, guide them to the answer rather than writing an essay immediately.
- Cite page references if available.
- Tone: Encouraging, curious, and professional.
- Your response must end with: "Would you like to run another tool on this topic?"`;

  const systemInstruction = toolSystemInstruction.replace(/\${file.name}/g, primaryFileName) || baseInstruction;

  const response = await ai.models.generateContent({
    model: model,
    contents: [...historyContent, newUserContent],
    config: {
        systemInstruction: systemInstruction
    }
  });

  return response.text;
};

export const liveTutorAnalysis = async (
    base64Image: string,
    mimeType: string,
    history: ChatMessage[],
    newMessage: string
) => {
    const model = 'gemini-2.5-flash';

    const historyContent = history.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.text }] 
    }));

    const imagePart = {
        inlineData: {
            data: base64Image,
            mimeType: mimeType,
        },
    };

    const textPart = { text: newMessage };
    
    const newUserContent = { 
        role: 'user' as const, 
        parts: [imagePart, textPart] 
    };

    // DEEP LEARNING UPDATE: Focus on guiding the user through the problem visible in the camera
    const systemInstruction = `You are "Professor Zero", a friendly and helpful visual AI tutor. 
- The user is showing you their work/textbook.
- **Pedagogical Approach**: Do not just solve the problem for them.
- Ask: "What do you think is the first step?" or "Where are you getting stuck?"
- Guide them through the logic based on what you see.
- If they have a misconception, gently correct the *logic*, not just the answer.
- Keep responses concise and spoken-style.`;

    const response = await ai.models.generateContent({
        model: model,
        contents: [...historyContent, newUserContent],
        config: {
            systemInstruction: systemInstruction
        }
    });

    return response.text;
};


export const generateQuiz = async (files: UploadedFile[]): Promise<QuizQuestion[]> => {
  const model = 'gemini-2.5-flash';
  const fileParts = files.map(fileToGenerativePart);

  // DEEP LEARNING UPDATE: Focus on Application and Analysis (Bloom's Taxonomy)
  const prompt = `You are "Jawz", an expert exam setter. Generate a 5-question multiple-choice quiz based on the provided documents.
  - **CRITICAL**: Avoid simple "definition recall" questions (e.g., "What is X?").
  - **Focus on Application**: Create scenario-based questions (e.g., "If X happens, what is the likely outcome for Y?").
  - **Focus on Analysis**: Ask about relationships between concepts.
  - Difficulty should vary.
  - Include an 'explanation' that explains *why* the answer is correct and *why* the others are wrong.
  - Provide an AI confidence score (0.0-1.0).
  - Return JSON.`;

  const response = await ai.models.generateContent({
    model: model,
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
            difficulty: { 
                type: Type.STRING, 
                description: 'Difficulty: easy, medium, or hard.' 
            },
            page_ref: { type: Type.STRING },
            confidenceScore: { type: Type.NUMBER },
          },
          required: ["question", "options", "correctAnswer", "explanation"],
        },
      },
    },
  });
  
  const jsonText = response.text.trim();
  try {
      return JSON.parse(jsonText);
  } catch (e) {
      console.error("Failed to parse quiz JSON:", e);
      return [];
  }
};

export const generateNotes = async (files: UploadedFile[], style: 'cornell' | 'bullet' = 'cornell'): Promise<string> => {
    const model = 'gemini-2.5-flash';
    const fileParts = files.map(fileToGenerativePart);
    
    let prompt = '';

    if (style === 'cornell') {
        // DEEP LEARNING UPDATE: Cornell Note-Taking Method (Active Recall)
        prompt = `You are "Jawz", an expert study coach. Create structured revision notes using the **Cornell Note-Taking Method** principles to promote Active Recall.
      
        Structure required:
        1. **# Main Topic Title**
        2. **## Executive Summary** (Brief overview)
        3. **### Q: [Insightful Question]**
           * (Provide the answer/details here. Using questions as headers forces the student to think before reading).
        4. **### Q: [Another Insightful Question]**
           * (Details...)
        5. **## Key Connections** (How these concepts relate to each other).
        6. **## Summary**
        
        - Use Markdown.
        - Make the questions probing (e.g., "Why is X critical for Y?" instead of "What is X?").
        - Highlight key terms in **bold**.`;
    } else {
        // QUICK REVISION UPDATE: Bullet Points & Chunks ("Goated Revision")
        prompt = `You are "Jawz", an elite revision expert. Create "Goated Revision Notes" optimized for rapid visual scanning and memory retention.
        
        Structure required:
        1. **# ⚡ High-Yield Overview** (3 sentences max).
        2. **## 🧠 Brain Chunks** (Break the topic into distinct, logical blocks. Do NOT use long paragraphs).
           - Use **Bullet Points** for everything.
           - Use **Bold** for keywords so the eye can scan.
           - Use emojis (e.g., ⚠️, ✅, 💡) to mark important warnings or tips.
        3. **## 📝 Rapid Fire Facts** (List of single-line facts perfect for memorization).
        4. **## 🚫 Common Pitfalls** (What do students usually get wrong?).
        
        - Keep lines short.
        - Focus on "Signal vs Noise" - only the most important info.
        - Use Markdown.`;
    }

    const response = await ai.models.generateContent({
      model: model,
      contents: {
        role: 'user',
        parts: [...fileParts, { text: prompt }]
      }
    });
  
    return response.text;
  };

  export const generateRecap = async (files: UploadedFile[]): Promise<RecapData> => {
    const model = 'gemini-2.5-flash';
    const fileParts = files.map(fileToGenerativePart);
  
    // DEEP LEARNING UPDATE: Synthesis and Connection Flashcards
    const prompt = `Analyze the provided document(s) and generate a deep-learning study recap in JSON format.
        1. 'summary': A synthesis of the main argument (not just a list of facts).
        2. 'keyConcepts': An array of 5 key concepts, each with a 'concept' name and a detailed 'explanation' that includes examples.
        3. 'flashcards': An array of 5 flashcards.
           - **CRITICAL**: Include at least 2 'problem' or 'long_answer' cards that test *relationships* between concepts (e.g. "Compare and contrast X and Y").
           - Avoid simple definitions.
           - 'type': Must be 'qa', 'definition', 'problem', or 'long_answer'.
           - 'front': The question, term, problem statement, or exam question.
           - 'back': The answer, definition, step-by-step solution, or model answer.
        4. 'visualAidPrompt': A creative image generation prompt that would best visually represent the core topic (e.g. a diagram of a process).`;

    const response = await ai.models.generateContent({
      model: model,
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
                }
              }
            },
            flashcards: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, enum: ['qa', 'definition', 'problem', 'long_answer'] },
                  front: { type: Type.STRING },
                  back: { type: Type.STRING }
                }
              }
            },
            visualAidPrompt: { type: Type.STRING }
          }
        }
      }
    });
  
    return JSON.parse(response.text);
  };
  
export const generateMoreFlashcards = async (files: UploadedFile[], existingFlashcards: Flashcard[]): Promise<Flashcard[]> => {
    const model = 'gemini-2.5-flash';
    const fileParts = files.map(fileToGenerativePart);
    const existingFronts = existingFlashcards.map(f => f.front).join(" | ");

    const response = await ai.models.generateContent({
        model: model,
        contents: {
            role: 'user',
            parts: [...fileParts, { text: `Generate 5 NEW flashcards based on the documents. 
            - Do NOT duplicate these existing cards: ${existingFronts}.
            - **Focus**: Second-order thinking. Ask "Why", "How", and "What if".
            - Include 'problem' type for derivations or logic chains.
            - Include 'long_answer' for explaining processes.
            Return JSON.` }]
        },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        type: { type: Type.STRING, enum: ['qa', 'definition', 'problem', 'long_answer'] },
                        front: { type: Type.STRING },
                        back: { type: Type.STRING }
                    }
                }
            }
        }
    });

    return JSON.parse(response.text);
};

export const generateFlashcardsFromConcept = async (files: UploadedFile[], concept: string): Promise<Flashcard[]> => {
    const model = 'gemini-2.5-flash';
    const fileParts = files.map(fileToGenerativePart);

    const response = await ai.models.generateContent({
        model: model,
        contents: {
            role: 'user',
            parts: [...fileParts, { text: `Generate 5 flashcards specifically focused on the concept: "${concept}". 
            - Focus on understanding the *mechanisms* and *principles* behind this concept.
            - Use a mix of 'qa', 'definition', 'problem', and 'long_answer' types.
            - If it involves math or processes, use 'problem'.
            - If it's a broad topic, include a 'long_answer' exam question.
            Return JSON.` }]
        },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        type: { type: Type.STRING, enum: ['qa', 'definition', 'problem', 'long_answer'] },
                        front: { type: Type.STRING },
                        back: { type: Type.STRING }
                    }
                }
            }
        }
    });

    return JSON.parse(response.text);
};

// --- QUEST MODE SERVICES ---

export const startQuest = async (files: UploadedFile[]): Promise<QuestScene> => {
    const model = 'gemini-2.5-flash';
    const fileParts = files.map(fileToGenerativePart);

    // PEDAGOGY UPDATE: Lecture then Game with MULTIPLE QUESTIONS
    const prompt = `You are "Professor Zero", creating a Gamified Learning Experience.
    1. **Setting**: Create a high-stakes story setting (Sci-Fi, Mystery, etc.).
    2. **Scene 1**: 
       - **Concept Phase**: Identify the FIRST key concept. Explain it as a **High-Density Micro-Lecture**.
         - Use clear bullet points.
         - Use **Bold** for critical terms.
         - Maximize information density so the student can answer questions quickly.
       - **Narrative Phase**: Create a story scene where the user faces a problem related to the concept.
    3. **Challenges**: 
       - **CRITICAL**: Generate **3 DISTINCT** multiple-choice questions to test this concept thoroughly.
       - Question 1: Recall (Definition/Fact).
       - Question 2: Understanding (Mechanism/Process).
       - Question 3: Application (Scenario/Calculation).
       - Keep questions direct and academic.
    4. **Output**: Return strictly JSON.`;

    const response = await ai.models.generateContent({
        model: model,
        contents: {
            role: 'user',
            parts: [...fileParts, { text: prompt }]
        },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    conceptName: { type: Type.STRING, description: "Title of the concept being taught" },
                    conceptExplanation: { type: Type.STRING, description: "The educational explanation/lecture" },
                    narrative: { type: Type.STRING, description: "The story text starting the adventure." },
                    visualPrompt: { type: Type.STRING },
                    conceptUnlocked: { type: Type.STRING },
                    challenges: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                type: { type: Type.STRING, enum: ['multiple_choice', 'ordering'] },
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

    return JSON.parse(response.text);
};

export const progressQuest = async (files: UploadedFile[], previousScene: string, userAction: string, wasCorrect: boolean): Promise<QuestScene> => {
    const model = 'gemini-2.5-flash';
    const fileParts = files.map(fileToGenerativePart);

    const prompt = `You are "Professor Zero". Continue the Educational RPG.
    - Previous Scene: "${previousScene}"
    - User Last Action: "${userAction}" (Result: ${wasCorrect ? 'Success' : 'Fail'})
    
    1. **Narrative**:
       - Briefly describe the result of the previous encounter.
       - Introduce the NEXT key concept in the story flow.
    2. **Concept Phase**:
       - Explain the NEW concept as a **High-Density Micro-Lecture** (Bullets, Bold keywords).
    3. **Challenges**:
       - **CRITICAL**: Generate **3 DISTINCT** multiple-choice questions for this NEW concept.
       - Ensure they cover Recall, Understanding, and Application.
    4. **Output**: JSON.`;

    const response = await ai.models.generateContent({
        model: model,
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
                    conceptUnlocked: { type: Type.STRING },
                    xpGain: { type: Type.NUMBER },
                    hpChange: { type: Type.NUMBER },
                    challenges: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                type: { type: Type.STRING, enum: ['multiple_choice', 'ordering'] },
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

    return JSON.parse(response.text);
};


export const generateLectureScript = async (files: UploadedFile[]): Promise<string[]> => {
    const model = 'gemini-2.5-flash';
    const fileParts = files.map(fileToGenerativePart);

    // DEEP LEARNING UPDATE: Engaging Lecture Style
    const prompt = `Create an engaging lecture script based on these documents.
    - Break the content into 5-8 slide-sized distinct paragraphs. 
    - **Style**: Storytelling and Explanation. Don't just list facts.
    - Use rhetorical questions to keep the student thinking.
    - Explain *why* this topic matters.
    - Return the result as a JSON array of strings.`;

    const response = await ai.models.generateContent({
        model: model,
        contents: {
            role: 'user',
            parts: [...fileParts, { text: prompt }]
        },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
            }
        }
    });

    return JSON.parse(response.text);
};

export const clarifyLectureDoubt = async (files: UploadedFile[], lectureContext: string, question: string): Promise<string> => {
    const model = 'gemini-2.5-flash';
    const fileParts = files.map(fileToGenerativePart);

    const response = await ai.models.generateContent({
        model: model,
        contents: {
            role: 'user',
            parts: [...fileParts, { text: `You are "Professor Zero", a lecturer. You have just said this: "${lectureContext}". 
            Student Question: "${question}".
            Answer conceptually. Use an analogy if helpful. Keep it conversational.` }]
        }
    });

    return response.text;
};

export const generatePodcastAudio = async (text: string): Promise<string> => {
    const model = 'gemini-2.5-flash-preview-tts';
    
    const response = await ai.models.generateContent({
        model: model,
        contents: {
            parts: [{ text: text }]
        },
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Puck' } 
                }
            }
        }
    });

    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || '';
};

export const generateDailyRecap = async (files: UploadedFile[], topics: string): Promise<DailyRecapData> => {
    const model = 'gemini-2.5-flash';
    const fileParts = files.map(fileToGenerativePart);

    // DEEP LEARNING UPDATE: Focus on Synthesis across topics
    const prompt = `Generate a 'Daily Recap' based on the provided documents, specifically focusing on these topics: "${topics}".
            The output must be JSON with:
            1. 'summary': A cohesive paragraph summarizing how these topics relate across the different documents. Synthesize information.
            2. 'connections': A paragraph explicitly pointing out interesting connections, contradictions, or themes between the documents.
            3. 'keyConcepts': 5 key concepts from these topics (concept, explanation).
            4. 'flashcards': 5 flashcards testing the *intersections* of these topics (mix of 'qa', 'definition', 'problem', 'long_answer').
            5. 'quiz': 3 multiple choice questions (question, options, correctAnswer, explanation).
            6. 'visualAidPrompt': An image prompt that synthesizes these topics.`;

    const response = await ai.models.generateContent({
        model: model,
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
                                type: { type: Type.STRING, enum: ['qa', 'definition', 'problem', 'long_answer'] },
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

    return JSON.parse(response.text);
};

export const generateTeachingFeedback = async (transcript: string, topic: string): Promise<TeachingReport> => {
    const model = 'gemini-2.5-flash';
    
    // DEEP LEARNING UPDATE: Evaluate on conceptual clarity, not just fact recall
    const prompt = `Evaluate my teaching on "${topic}". Transcript: "${transcript}".
    - Did I explain the *intuition* behind the concept?
    - Did I use examples?
    - **Score**: 0-100 based on ability to simplify complex ideas (Feynman Technique).
    - **Feedback**: Constructive criticism on my explanation style.
    - Return JSON.`;

    const response = await ai.models.generateContent({
        model: model,
        contents: {
            role: 'user',
            parts: [{ text: prompt }]
        },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    score: { type: Type.NUMBER },
                    feedback: { type: Type.STRING },
                    clarityRating: { type: Type.STRING, enum: ['Low', 'Medium', 'High'] },
                    missedPoints: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
            }
        }
    });

    return JSON.parse(response.text);
};