import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@/lib/generated/prisma";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { prompt, instructions, userId } = await req.json();

    // 1. Fetch vault and secrets
    let resolvedInstructions = instructions;
    let apiKey = process.env.OPENAI_API_KEY; // Fallback if no vault entry matches

    if (userId) {
      const vault = await prisma.vault.findUnique({
        where: { userId },
      });
      
      if (vault) {
        // Parse the stored secrets (assumed to be JSON)
        try {
          const secrets = JSON.parse(vault.encrypted_keys);
          
          // Find any {{vault.KEY}} references and replace them
          resolvedInstructions = instructions.replace(/{{\s*vault\.([^}]+)\s*}}/g, (_: string, key: string) => {
            const secret = secrets[key.trim()];
            if (secret) return secret;
            return `[REDACTED SECRET: ${key}]`;
          });

          // Special logic for AI key injection
          // If the prompt itself is a vault ref or contains one, resolve it for the AI call
          if (secrets['OPENAI_API_KEY']) apiKey = secrets['OPENAI_API_KEY'];
          if (secrets['GEMINI_API_KEY']) apiKey = secrets['GEMINI_API_KEY'];
        } catch (e) {
          console.error("Failed to parse vault secrets:", e);
        }
      }
    }

    if (!apiKey) {
      // return NextResponse.json({ error: "No API key found in Vault." }, { status: 401 });
      // For demo, we still allow proceeding if there's a fallback
    }

    // 2. Call OpenAI or Gemini API (Simulated Streaming)
    // In a real app, you'd use openai.chat.completions.create({ stream: true, ... }) 
    // and use resolvedInstructions as the system or user prompt.
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const fullText = `Mock Server Execution Result based on API Key retrieval.\nPrompt: ${prompt}\nInstructions: ${instructions}`;
        const words = fullText.split(" ");
        
        for (const word of words) {
          controller.enqueue(encoder.encode(word + " "));
          await new Promise(r => setTimeout(r, 50)); // Simulated network latency
        }
        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      }
    });

  } catch (error: any) {
    console.error("Execution Engine Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
