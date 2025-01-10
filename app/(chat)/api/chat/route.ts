import { BufferMemory } from 'langchain/memory';
import { z } from 'zod';
import { ChatService } from "@/lib/services/chat-service";

import { auth } from '@/app/(auth)/auth';

import {
  deleteChatById,
  getChatById,
  saveChat,
  saveMessages,
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

interface ChatOptions {
  maxSources?: number;
  similarityThreshold?: number;
  userId?: string;
  context?: {
    chatHistory: any[];
    userMessage: any;
    previousMessages: any[];
  };
}

interface SaveMessageParams {
  id: string;
  content: unknown;
  role: string;
  chatId: string;
  createdAt: Date;
  metadata?: {
    sources?: any[];
    accuracy?: number;
    riskLevel?: string;
  };
}

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
  const memory = getChatMemory(id);

  // Store the message in memory
  await memory.saveContext(
    { input: lastUserMessage.content },
    { output: 'placeholder' }
  );

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
          const assistantMessageId = generateUUID();

          // Get chat history from memory
          const history = await memory.loadMemoryVariables({});
          const chatHistory = history.chat_history || [];

          const response = await chatService.chat(
            lastUserMessage.content,
            {
              maxSources: 5,
              similarityThreshold: options?.similarityThreshold || 0.3,
              userId: session?.user?.id,
              context: {
                chatHistory,
                userMessage: lastUserMessage,
                previousMessages: messages.slice(-3)
              }
            } as ChatOptions
          );

          let fullContent = '';
          const text = response.answer;
          let currentIndex = 0;
          const chunkSize = 20;
          
          // Helper function to send stream data
          const sendChunk = (chunk: string, isComplete = false) => {
            fullContent += chunk;
            const streamData = {
              id: assistantMessageId,
              role: 'assistant',
              content: fullContent,
              delta: chunk,
              metadata: {
                sources: response.sources,
                accuracy: response.averageAccuracy,
                riskLevel: response.riskLevel
              },
              type: isComplete ? 'complete' : 'partial'
            };

            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(streamData, null, 0)}\n\n`)
            );
          };
          
          while (currentIndex < text.length) {
            const chunk = text.slice(currentIndex, currentIndex + chunkSize);
            sendChunk(chunk);
            currentIndex += chunkSize;
            await new Promise(resolve => setTimeout(resolve, 50));
          }

          // Send final chunk with complete flag
          sendChunk('', true);

          // Store the complete response in memory
          await memory.saveContext(
            { input: lastUserMessage.content },
            { output: response.answer }
          );

          // Save the complete message to the database
          await saveMessages({
            messages: [{
              id: assistantMessageId,
              content: response.answer,
              role: 'assistant',
              chatId: chat.id,
              createdAt: new Date(),
              metadata: {
                sources: response.sources,
                accuracy: response.averageAccuracy,
                riskLevel: response.riskLevel
              }
            } as SaveMessageParams]
          });

          // Send the DONE message
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ 
              type: "done",
              metadata: {
                sources: response.sources,
                accuracy: response.averageAccuracy,
                riskLevel: response.riskLevel
              }
            })}\n\n`)
          );
        } catch (error) {
          console.error('Error in chat processing:', error);
          // Send detailed error information
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'error',
              error: error instanceof Error ? error.message : 'Unknown error occurred',
              errorType: error instanceof Error ? error.constructor.name : 'Unknown',
              timestamp: new Date().toISOString()
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
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        timestamp: new Date().toISOString()
      }), 
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
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
