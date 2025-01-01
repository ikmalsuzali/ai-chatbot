import { NextRequest, NextResponse } from "next/server";
import { ChatService } from "@/lib/services/chat-service";
import { z } from "zod";

const requestSchema = z.object({
  query: z.string().min(1),
  maxSources: z.number().optional(),
  similarityThreshold: z.number().min(0).max(1).optional(),
  userId: z.string().optional(),
});

const chatService = new ChatService({
  huggingFaceApiKey: process.env.HUGGINGFACE_API_KEY!,
  openAIApiKey: process.env.OPENAI_API_KEY!,
  pgConfig: {
    host: process.env.POSTGRES_HOST!,
    port: parseInt(process.env.POSTGRES_PORT || "5432"),
    user: process.env.POSTGRES_USER!,
    password: process.env.POSTGRES_PASSWORD!,
    database: process.env.POSTGRES_DATABASE!,
  },
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, maxSources, similarityThreshold, userId } = requestSchema.parse(body);

    const response = await chatService.chat(query, {
      maxSources,
      similarityThreshold,
      userId,
    });

    return NextResponse.json({
      success: true,
      data: {
        answer: response.answer,
        sources: response.sources.map(source => ({
          content: source.content,
          metadata: source.metadata,
          similarity: Math.round(source.similarity * 100) / 100,
        })),
        accuracy: Math.round(response.averageAccuracy * 100) / 100,
        riskLevel: response.riskLevel,
      },
    });
  } catch (error: unknown) {
    console.error("Chat API Error:", error);
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Unknown error occurred';
      
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 400 }
    );
  }
} 