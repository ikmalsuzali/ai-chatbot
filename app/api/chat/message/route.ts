import { ChatService } from "@/lib/services/chat-service";
import { auth } from '@/app/(auth)/auth';
import { saveMessages } from '@/lib/db/queries';
import { generateUUID } from '@/lib/utils';

export const maxDuration = 60;

const chatService = new ChatService(
  process.env.POSTGRES_URL!,
  process.env.OPENAI_API_KEY!
);

export async function POST(request: Request) {
  const { messages, id } = await request.json();
  
  let session = await auth();

  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const lastUserMessage = messages[messages.length - 1];
  const userMessageId = generateUUID();

  // Save the user message
  await saveMessages({
    messages: [
      { 
        ...lastUserMessage, 
        id: userMessageId, 
        createdAt: new Date(), 
        chatId: id 
      },
    ],
  });

  const encoder = new TextEncoder();
  
  try {
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Generate message ID once at the start
          const assistantMessageId = generateUUID();

          // Initial message to show the assistant is responding
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              id: assistantMessageId,
              role: 'assistant',
              content: '',
              createdAt: new Date().toISOString()
            })}\n\n`)
          );

          const response = await chatService.chat(
            lastUserMessage.content,
            {
              maxSources: 5,
              similarityThreshold: 0.3,
              userId: session.user?.id
            }
          );

          let fullContent = '';
          const chunkSize = 20;
          const chunks = response.answer.match(new RegExp(`.{1,${chunkSize}}`, 'g')) || [];
          
          for (const chunk of chunks) {
            fullContent += chunk;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                id: assistantMessageId,
                role: 'assistant',
                content: fullContent,
                delta: chunk
              })}\n\n`)
            );
            
            await new Promise(resolve => setTimeout(resolve, 50));
          }

          // Save the complete message to the database
          await saveMessages({
            messages: [{
              id: assistantMessageId,
              content: response.answer,
              role: 'assistant',
              chatId: id,
              createdAt: new Date()
            }]
          });

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