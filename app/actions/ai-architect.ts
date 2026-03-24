'use server'

import { GoogleGenAI, Type, Schema } from '@google/genai';

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    nodes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          type: { type: Type.STRING, description: "Must be one of: 'trigger', 'ai', 'processor', 'output'" },
          position: {
            type: Type.OBJECT,
            properties: {
              x: { type: Type.NUMBER },
              y: { type: Type.NUMBER }
            },
            required: ['x', 'y']
          },
          data: {
            type: Type.OBJECT,
            properties: {
              label: { type: Type.STRING }
            },
            required: ['label']
          }
        },
        required: ['id', 'type', 'position', 'data']
      }
    },
    edges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          source: { type: Type.STRING },
          target: { type: Type.STRING }
        },
        required: ['id', 'source', 'target']
      }
    }
  },
  required: ['nodes', 'edges']
};

export async function generateWorkflow(prompt: string, apiKey: string) {
  try {
    if (!apiKey) {
      throw new Error("API key is required to generate a workflow.");
    }
    
    const ai = new GoogleGenAI({ apiKey });
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: prompt,
      config: {
        systemInstruction: "You are an expert AI architect. Return ONLY a JSON object with 'nodes' and 'edges'. Node types: trigger, ai (for llm), processor (for logic), output. Use horizontal coordinates (x: 0, 300, 600) to map out a logical flow from left to right.",
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
      }
    });

    if (!response.text) throw new Error("No response generated.");
    
    // The response text is already formatted as JSON matching the schema
    const data = JSON.parse(response.text);
    return { success: true, data };
  } catch (error: any) {
    console.error("AI Architect Generation Error:", error);
    return { success: false, error: error.message || "Failed to generate workflow." };
  }
}
