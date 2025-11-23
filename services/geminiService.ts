import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ChatMessage, QuizQuestion, UploadedFile, ChatTool, RecapData, DailyRecapData, Flashcard } from "../types";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const fileToGenerativePart = (file: UploadedFile) => {
  return {
    inlineData: {
      data: file.base64,
      mimeType: file.mimeType,
    },
  };
};

export const chatWithDocument = async (files: UploadedFile[], history: ChatMessage[], newMessage: string, activeTool: ChatTool, toolSystemInstruction: string) => {
  const model = 'gemini-2.5-flash';
  const primaryFileName = files[0]?.name || 'the document';

  const historyContent = history.map(msg => ({ 
    role: msg.role, 
    parts: [{ text: msg.text }] 
  }));

  const fileParts = files.map(fileToGenerativePart);

  const userParts = [];
  // Only add the documents for the very first message of the conversation
  // or if switching from general to a specific tool for the first time in a session.
  if (history.length === 0 || (activeTool !== 'general' && history.length > 0 && history[history.length -1].role === 'model' && !history[history.length -1].text.includes('Tool:'))) {
    userParts.push(...fileParts);
  }
  userParts.push({ text: newMessage });

  const newUserContent = { role: 'user', parts: userParts };

  const systemInstruction = toolSystemInstruction.replace(/\${file.name}/g, primaryFileName) || `You are "Jawz", a highly capable AI study assistant.
- Your response header must be: "Tool: General Chat | Topic: ${primaryFileName}"
- Answer questions based ONLY on the content of the provided documents.
- If the answer is not in the documents, politely say so.
- Maintain a friendly, encouraging, and professional tone.
- Cite page references if you use them.
- Your response must end with: "Would you like to run another tool on this topic?"`;

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

    const systemInstruction = `You are "Cognita", an expert AI live tutor. Your role is to assist the user by analyzing the image they provide from their camera in a conversational chat.
- The user is showing you their work (e.g., math problems, diagrams, textbook pages).
- The user may have drawn on the image in bright cyan to highlight specific areas or ask questions. Pay close attention to these annotations.
- Analyze the image which shows the user's current work or study material.
- Crucially, you must consider the entire chat history to understand conversational context. The user might ask follow-up questions like "what about this part?" or "what's the next step?". Your answers must be relevant to the ongoing conversation.
- Read the user's question.
- Provide a helpful, step-by-step response to guide them. Do not just give the final answer.
- Be a patient and encouraging tutor for any subject shown.
- Keep your response concise and clear, suitable for being spoken aloud.`;

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

  const response = await ai.models.generateContent({
    model: model,
    contents: {
      role: 'user',
      parts: [...fileParts, { text: `You are "Jawz", an AI study assistant. From the document(s) provided, generate a 5-question multiple-choice quiz based on their key concepts. For each question, provide 4 options, the correct answer, a brief explanation, an estimated difficulty ('easy', 'medium', or 'hard'), a page reference if possible (e.g., "p. 5"), and an AI confidence score (from 0.0 to 1.0) for the correctness of the question. The response must be in JSON format.` }]
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
                description: 'Difficulty of the question: easy, medium, or hard.' 
            },
            page_ref: { 
                type: Type.STRING, 
                description: 'Page reference from the document, if available. E.g., "p. 5".' 
            },
            confidenceScore: {
                type: Type.NUMBER,
                description: 'AI confidence score for the correctness of the question, from 0.0 to 1.0.',
            },
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
      // Attempt to fix common JSON issues if possible, or return empty
      return [];
  }
};

export const generateNotes = async (files: UploadedFile[]): Promise<string> => {
  const model = 'gemini-2.5-flash';
  const fileParts = files.map(fileToGenerativePart);
  const primaryFileName = files[0]?.name || 'the document';

  const newPrompt = `You are "Jawz", an AI study assistant. Your task is to generate study notes from the provided document(s). Structure your entire response using markdown formatting as follows:

1.  **Header**: Start with a header line formatted exactly like this: \`Tool: Notes Generator | Topic: ${primaryFileName}\`
2.  **Hot Notes**: A section titled "### 🔥 Hot Notes (Quick Revision)" with a concise summary.
3.  **Deeper Study**: A section titled "### 📚 Deeper Study Notes" with expanded notes. Use bullet points starting with '* '. Clearly tag key formulas like so: **Formula: [formula]**. Clearly provide important definitions like so: **Definition: [term]** - [definition].
4.  **Self-Check**: A section titled "### 🤔 Check Yourself" with two thoughtful questions (without answers).
5.  **Footer**: Your response must end with the line: "Saved to Generated Notes. Would you like to run Q&A or generate a lecture for this topic?"

Base your notes ONLY on the provided document content.`;

  const response = await ai.models.generateContent({
    model: model,
    contents: {
      role: 'user',
      parts: [...fileParts, { text: newPrompt }]
    },
  });

  return response.text;
};

export const generatePodcastAudio = async (text: string): Promise<string | null> => {
    const model = "gemini-2.5-flash-preview-tts";
    
    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: [{ parts: [{ text: text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' },
                    },
                },
            },
        });
        
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        return base64Audio || null;
    } catch (error) {
        console.error("Error generating TTS audio:", error);
        return null;
    }
};

export const generateRecap = async (files: UploadedFile[]): Promise<RecapData> => {
  const model = 'gemini-2.5-flash';
  const fileParts = files.map(fileToGenerativePart);

  const prompt = `You are "Jawz", an expert AI study assistant. Your task is to generate a comprehensive recap of the provided document(s). The recap should help a student quickly review and understand the core material. Structure your response in JSON format.

The JSON object must contain:
1.  "summary": A concise, one-paragraph overview of the document's main topic.
2.  "keyConcepts": An array of 3-5 of the most important concepts. Each object in the array should have a "concept" (the term or idea) and an "explanation" (a clear, brief definition or description).
3.  "flashcards": An array of 5-7 flashcards for self-testing. Each object in the array must have a "type" (either 'qa' for a question/answer pair, or 'definition' for a term/definition pair), a "front" (the question or term), and a "back" (the corresponding answer or definition).
4.  "visualAidPrompt": A creative and descriptive prompt (under 200 characters) that could be used with an image generation AI to create a helpful visual diagram, mind map, or illustration summarizing the topic.`;

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
                explanation: { type: Type.STRING },
              },
              required: ["concept", "explanation"],
            },
          },
          flashcards: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, description: "Either 'qa' or 'definition'" },
                front: { type: Type.STRING },
                back: { type: Type.STRING },
              },
              required: ["type", "front", "back"],
            },
          },
          visualAidPrompt: { type: Type.STRING },
        },
        required: ["summary", "keyConcepts", "flashcards", "visualAidPrompt"],
      },
    },
  });
  
  const jsonText = response.text.trim();
  try {
      return JSON.parse(jsonText);
  } catch (e) {
      console.error("Failed to parse recap JSON:", e);
      throw new Error("Failed to generate recap data.");
  }
};

export const generateMoreFlashcards = async (files: UploadedFile[], existingFlashcards: Flashcard[]): Promise<Flashcard[]> => {
  const model = 'gemini-2.5-flash';
  const fileParts = files.map(fileToGenerativePart);
  
  const existingFronts = existingFlashcards.map(f => `- ${f.front}`).join('\n');

  const prompt = `You are "Jawz", an expert AI study assistant. Your task is to generate 5 more unique flashcards based on the provided document(s) for a student to self-test.

**IMPORTANT**: Do not repeat questions or terms that have already been generated. Here are the existing flashcard fronts:
${existingFronts}

Generate 5 new flashcards. Create a mix of question/answer pairs and key term/definition pairs.
Each object in the array must have a "type" ('qa' for question/answer or 'definition' for term/definition), a "front" (the question or term), and a "back" (the corresponding answer or definition). The response must be in JSON format.`;

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
            type: { type: Type.STRING, description: "Either 'qa' or 'definition'" },
            front: { type: Type.STRING },
            back: { type: Type.STRING },
          },
          required: ["type", "front", "back"],
        },
      },
    },
  });
  
  const jsonText = response.text.trim();
  try {
      const newCards = JSON.parse(jsonText);
      return Array.isArray(newCards) ? newCards : [];
  } catch (e) {
      console.error("Failed to parse flashcards JSON:", e);
      return [];
  }
};

export const generateFlashcardsFromConcept = async (files: UploadedFile[], concept: string): Promise<Flashcard[]> => {
  const model = 'gemini-2.5-flash';
  const fileParts = files.map(fileToGenerativePart);

  const prompt = `You are "Jawz", an AI study assistant. Your task is to generate 5-10 flashcards based on the provided document(s) for a specific concept: "${concept}".

Generate a mix of question/answer pairs and key term/definition pairs.

Each flashcard object in the JSON array must have a "type" ('qa' for question/answer or 'definition' for term/definition), a "front" (the question or term), and a "back" (the corresponding answer or definition). The response must be in JSON format.`;

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
            type: { type: Type.STRING, description: "Either 'qa' or 'definition'" },
            front: { type: Type.STRING },
            back: { type: Type.STRING },
          },
          required: ["type", "front", "back"],
        },
      },
    },
  });
  
  const jsonText = response.text.trim();
  try {
      const newCards = JSON.parse(jsonText);
      return Array.isArray(newCards) ? newCards : [];
  } catch (e) {
      console.error("Failed to parse flashcards JSON:", e);
      return [];
  }
};

export const generateDailyRecap = async (files: UploadedFile[], topics: string): Promise<DailyRecapData> => {
  const model = 'gemini-2.5-flash';
  const fileParts = files.map(fileToGenerativePart);
  const fileNames = files.map(f => `"${f.name}"`).join(', ');

  const prompt = `You are "Cognita", an expert AI study assistant. Your task is to generate an enhanced daily recap based on the content of the provided documents (${fileNames}).
The user wants a summary focused specifically on these topics: "${topics}".

Your response must be a single JSON object with the following structure:
1.  "summary": A concise, one-paragraph summary of the requested topics, synthesized from the provided documents.
2.  "connections": A short paragraph (2-3 sentences) highlighting any interesting connections or overlaps between the topics based on the documents.
3.  "keyConcepts": An array of 3-5 of the most important concepts from the topics. Each object should have a "concept" and an "explanation".
4.  "flashcards": An array of 5 flashcards for self-testing. Each object should have a "type" ('qa' for question/answer or 'definition' for term/definition), a "front" (the question or term), and a "back" (the answer or definition).
5.  "quiz": An array of 3 multiple-choice quiz questions based on the recap. Each question object must have "question", "options" (an array of 4 strings), "correctAnswer" (a string), and "explanation".
6.  "visualAidPrompt": A creative prompt (under 200 characters) for an image generation AI to create a visual summary of the topics.

Generate the recap ONLY from the provided documents. If the topics aren't covered, return an object with an empty summary and empty arrays.`;

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
                explanation: { type: Type.STRING },
              },
              required: ["concept", "explanation"],
            },
          },
          flashcards: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, description: "Either 'qa' or 'definition'" },
                front: { type: Type.STRING },
                back: { type: Type.STRING },
              },
              required: ["type", "front", "back"],
            },
          },
          quiz: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctAnswer: { type: Type.STRING },
                explanation: { type: Type.STRING },
              },
              required: ["question", "options", "correctAnswer", "explanation"],
            },
          },
          visualAidPrompt: { type: Type.STRING },
        },
        required: ["summary", "connections", "keyConcepts", "flashcards", "quiz", "visualAidPrompt"],
      },
    },
  });

  const jsonText = response.text.trim();
  try {
      return JSON.parse(jsonText);
  } catch (e) {
      console.error("Failed to parse daily recap JSON:", e);
      throw new Error("Failed to generate daily recap data.");
  }
};


export const generateLectureScript = async (files: UploadedFile[]): Promise<string[]> => {
  const model = 'gemini-2.5-flash';
  const fileParts = files.map(fileToGenerativePart);

  const prompt = `You are an expert AI lecturer. Your task is to generate a comprehensive and engaging lecture script based on the provided document(s). The lecture should be structured for a student to follow along easily.

Your response must be a single JSON object. This object must contain a single key, "script", which is an array of strings.
- Each string in the "script" array should be a short, digestible paragraph or a "chunk" of the lecture (about 2-4 sentences long).
- Start with a clear introduction.
- Break down complex topics into smaller, understandable parts.
- Conclude with a summary.
- The tone should be educational, clear, and engaging.
- Base the entire lecture ONLY on the content of the provided document(s).`;

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
          script: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ["script"],
      },
    },
  });

  const jsonText = response.text.trim();
  try {
    const parsed = JSON.parse(jsonText);
    return parsed.script || [];
  } catch (e) {
    console.error("Failed to parse lecture script JSON:", e);
    throw new Error("Failed to generate lecture script.");
  }
};

export const clarifyLectureDoubt = async (files: UploadedFile[], lectureContext: string, userQuestion: string): Promise<string> => {
  const model = 'gemini-2.5-flash';
  const fileParts = files.map(fileToGenerativePart);

  const prompt = `You are an expert AI lecturer, currently in the middle of a live lecture. A student has raised their hand to ask a question for clarification. Your task is to pause the lecture and provide a clear, concise answer to the student's question.

**Lecture Context (what you've covered so far):**
---
${lectureContext}
---

**Student's Question:**
"${userQuestion}"

Based on the lecture context and the content of the original document(s) you were provided, answer the student's question directly and helpfully. Keep the tone of a patient and knowledgeable teacher. Do not resume the lecture in this response; simply answer the question.`;

  const response = await ai.models.generateContent({
    model: model,
    contents: {
      role: 'user',
      parts: [...fileParts, { text: prompt }]
    },
  });

  return response.text;
};