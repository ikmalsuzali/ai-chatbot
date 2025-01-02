import { ChatMessage, HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence } from '@langchain/core/runnables';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { ChatOpenAI } from '@langchain/openai';
import { BufferMemory } from 'langchain/memory';
import { z } from 'zod';
import { NextRequest, NextResponse } from "next/server";
import { ChatService } from "@/lib/services/chat-service";

import { auth } from '@/app/(auth)/auth';
import { models } from '@/lib/ai/models';
import { DocumentManager } from '@/lib/ai/document-store';
import {
  codePrompt,
  systemPrompt,
  updateDocumentPrompt,
} from '@/lib/ai/prompts';
import {
  deleteChatById,
  getChatById,
  getDocumentById,
  saveChat,
  saveDocument,
  saveMessages,
  saveSuggestions,
  getUserQuestionnaire,
  getQuestionnaireQuestions,
  getUserQuestionnaireAnswers,
  getUser,
  createUser,
} from '@/lib/db/queries';
import { generateUUID } from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../actions';

export const maxDuration = 60;

// Define tool types and arrays similar to before
type AllowedTools = 'createDocument' | 'updateDocument' | 'requestSuggestions' | 'getWeather';

const blocksTools: AllowedTools[] = [
  'createDocument',
  'updateDocument',
  'requestSuggestions',
];

const weatherTools: AllowedTools[] = ['getWeather'];

const allTools: AllowedTools[] = [...blocksTools, ...weatherTools];

// Create a memory store for each chat
const chatMemories = new Map<string, BufferMemory>();

function getChatMemory(chatId: string) {
  if (!chatMemories.has(chatId)) {
    chatMemories.set(chatId, new BufferMemory({
      returnMessages: true,
      memoryKey: "chat_history",
    }));
  }
  return chatMemories.get(chatId)!;
}

const requestSchema = z.object({
  query: z.string().min(1),
  maxSources: z.number().optional(),
  similarityThreshold: z.number().min(0).max(1).optional(),
  userId: z.string().optional(),
});

const chatService = new ChatService(
  process.env.POSTGRES_URL!,
  process.env.OPENAI_API_KEY!
);

export async function POST(request: Request) {
  const { id, messages, options } = await request.json();

  let session = await auth();

  if (!session?.user?.id) {
    // Look for system user or create one
    let systemUser = await getUser('system@example.com');
    
    if (!systemUser) {
      systemUser = await createUser(
         'system@example.com',
         'password'
      );
    }
    
    session = { 
      user: systemUser[0],
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };
  }

  let chat = await getChatById({ id });

  if (!chat) {
    const title = await generateTitleFromUserMessage({ 
      message: messages[messages.length - 1] 
    });

    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }

    chat = await saveChat({ 
      userId: session.user.id, 
      title: title || 'New Chat'
    });

    if (!chat) {
      throw new Error('Failed to create chat');
    }
  }

  const userMessageId = generateUUID();
  const lastUserMessage = messages[messages.length - 1];

  await saveMessages({
    messages: [
      { 
        ...lastUserMessage, 
        id: userMessageId, 
        createdAt: new Date(), 
        chatId: chat.id 
      },
    ],
  });

  const encoder = new TextEncoder();

  try {
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial message to indicate processing
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'status',
              content: 'Processing your request...'
            })}\n\n`)
          );

          const response = await chatService.chat(
            lastUserMessage.content,
            {
              maxSources: 5,
              similarityThreshold: options?.similarityThreshold || 0.3,
              userId: session.user?.id
            }
          );

          // Stream the response content in smaller chunks
          const chunkSize = 20; // Adjust this value based on your needs
          const chunks = response.answer.match(new RegExp(`.{1,${chunkSize}}`, 'g')) || [];
          
          for (const chunk of chunks) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                type: 'text-delta',
                content: chunk,
                role: 'assistant'
              })}\n\n`)
            );
            
            // Add a small delay between chunks to simulate streaming
            await new Promise(resolve => setTimeout(resolve, 50));
          }

          // Send completion with metadata
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'complete',
              id: generateUUID(),
              content: response.answer,
              role: 'assistant',
              sources: response.sources,
              accuracy: response.averageAccuracy,
              riskLevel: response.riskLevel,
              createdAt: new Date().toISOString()
            })}\n\n`)
          );

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } catch (error) {
          console.error('Error in chat processing:', error);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'error',
              error: 'Error processing chat'
            })}\n\n`)
          );
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Error in chat processing:', error);
    return new Response('Error processing chat', { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new Response('Not Found', { status: 404 });
  }

  const session = await auth();

  if (!session || !session.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const chat = await getChatById({ id });

    if (!chat) {
      return new Response('Chat not found', { status: 404 });
    }

    if (chat.userId !== session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    await deleteChatById({ id });

    return new Response('Chat deleted', { status: 200 });
  } catch (error) {
    return new Response('An error occurred while processing your request', {
      status: 500,
    });
  }
}
