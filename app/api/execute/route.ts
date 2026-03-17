import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@/lib/generated/prisma";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { prompt, instructions, userId } = await req.json();

    // 1. Fetch decrypted key from Vault model 
    // In a real application we would decrypt the key here.
    // Assuming 'userId' is passed from the client or auth logic.
    // For now, we mock fetching if userId is not provided.
    
    let apiKey = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || process.env.OPENAI_API_KEY;

    if (userId) {
      const vault = await prisma.vault.findUnique({
        where: { userId },
      });
      if (vault) {
        // Mock Decryption logic using ENCRYPTION_KEY
        // e.g. apiKey = decrypt(vault.encrypted_keys, process.env.NEXT_PUBLIC_ENCRYPTION_KEY)
        apiKey = vault.encrypted_keys; 
      }
    }

    if (!apiKey) {
      return NextResponse.json({ error: "No API key found in Vault." }, { status: 401 });
    }

    // 2. Call OpenAI or Gemini API (Mocked for streaming simulation since real key isn't guaranteed valid)
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
