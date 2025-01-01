import { ChatMessage, HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence } from '@langchain/core/runnables';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { ChatOpenAI } from '@langchain/openai';
import { BufferMemory } from 'langchain/memory';
import { z } from 'zod';

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

export async function POST(request: Request) {
  const { id, messages, modelId } = await request.json();

  const session = await auth();

  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const model = models.find((model) => model.id === modelId);

  if (!model) {
    return new Response('Model not found', { status: 404 });
  }

  // Convert messages to LangChain format
  const langChainMessages = messages.map((msg: { role: string; content: string }) => {
    switch (msg.role) {
      case 'user':
        return new HumanMessage({ content: msg.content });
      case 'assistant':
        return new AIMessage({ content: msg.content });
      case 'system':
        return new SystemMessage({ content: msg.content });
      default:
        return new SystemMessage({ content: msg.content });
    }
  });

  const chat = await getChatById({ id });

  if (!chat) {
    const title = await generateTitleFromUserMessage({ 
      message: messages[messages.length - 1] 
    });
    await saveChat({ id, userId: session.user.id, title });
  }

  const userMessageId = generateUUID();
  const lastUserMessage = messages[messages.length - 1];

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

  const memory = getChatMemory(id);
  const documentManager = DocumentManager.getInstance();

  // Enhanced tools with document integration
  const tools = [
    new DynamicStructuredTool({
      name: 'searchDocuments',
      description: 'Search through existing documents for relevant information',
      schema: z.object({
        query: z.string()
      }),
      func: async ({ query }: { query: string }) => {
        const { documents } = await documentManager.queryDocuments(query, id);
        return documents.map(doc => ({
          content: doc.pageContent,
          metadata: doc.metadata
        }));
      }
    }),

    new DynamicStructuredTool({
      name: 'createDocument',
      description: 'Create a document for a writing activity',
      schema: z.object({
        title: z.string(),
        kind: z.enum(['text', 'code']),
        content: z.string()
      }),
      func: async ({ title, kind, content }: { 
        title: string;
        kind: 'text' | 'code';
        content: string;
      }) => {
        const docId = generateUUID();
        
        // Save to vector store for future retrieval
        await documentManager.addDocument(content, {
          id: docId,
          title,
          kind,
          createdAt: new Date().toISOString()
        });

        // Save to database
        if (session.user?.id) {
          await saveDocument({
            id: docId,
            title,
            kind,
            content,
            userId: session.user.id
          });
        }

        return { id: docId, title, kind };
      }
    }),

    new DynamicStructuredTool({
      name: 'updateDocument',
      description: 'Update an existing document',
      schema: z.object({
        id: z.string(),
        content: z.string(),
        description: z.string()
      }),
      func: async ({ id, content, description }: {
        id: string;
        content: string;
        description: string;
      }) => {
        const document = await getDocumentById({ id });
        if (!document) {
          throw new Error('Document not found');
        }

        // Update vector store
        await documentManager.addDocument(content, {
          id,
          title: document.title,
          kind: document.kind,
          updatedAt: new Date().toISOString()
        });

        // Ensure session.user exists before accessing id
        if (!session.user) {
          throw new Error('User not authenticated');
        }

        // Update database
        await saveDocument({
          id,
          title: document.title,
          kind: document.kind,
          content,
          userId: session.user.id
        });

        return {
          id,
          title: document.title,
          message: `Document updated: ${description}`
        };
      }
    }),
  ];

  // Create streaming response
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Initialize chat model with memory
  const chatModel = new ChatOpenAI({
    modelName: model.apiIdentifier,
    streaming: true,
    callbacks: [{
      handleLLMNewToken(token) {
        writer.write(encoder.encode(`data: ${JSON.stringify({
          type: 'text-delta',
          content: token
        })}\n\n`));
      }
    }]
  });

  // Create a more sophisticated chain with memory
  const chain = RunnableSequence.from([
    {
      memory: async (input) => {
        const history = await memory.loadMemoryVariables({});
        return [...(history.chat_history || []), new HumanMessage({ content: input.message })];
      },
      tools: async () => tools,
      systemMessage: async () => {
        let systemMessageContent = systemPrompt;
        
        if (session?.user?.id) {
          const [questions, answers] = await Promise.all([
            getQuestionnaireQuestions(),
            getUserQuestionnaireAnswers(session.user.id),
          ]);

          if (questions.length > 0 && Object.keys(answers).length > 0) {
            systemMessageContent = `${systemMessageContent}\n\nUser Context:`;
            questions.forEach(question => {
              if (answers[question.key]) {
                systemMessageContent += `\n- ${question.question}: ${answers[question.key]}`;
              }
            });
          }
        }
        
        return new SystemMessage({ content: systemMessageContent });
      },
      context: async (input) => {
        const { documents, relevantQAs } = await documentManager.queryDocuments(
          input.message,
          id
        );
        
        return {
          documents,
          relevantQAs,
          contextText: documents.map(doc => doc.pageContent).join('\n\n')
        };
      }
    },
    async (input) => {
      try {
        const messages = [
          input.systemMessage,
          new SystemMessage({ 
            content: `Relevant context:\n${input.context.contextText}\n\nRelevant previous QA:\n${
              input.context.relevantQAs.map((qa: { question: string; answer: string }) => 
                `Q: ${qa.question}\nA: ${qa.answer}\n`
              ).join('\n')
            }`
          }),
          ...input.memory,
        ];

        // Use generate instead of invoke to handle streaming properly
        const response = await chatModel.generate([messages]);
        const content = response.generations[0][0].text;

        // Save to memory immediately after getting response
        if (input.memory.length > 0) {
          const lastMessage = input.memory[input.memory.length - 1];
          await memory.saveContext(
            { input: lastMessage.content },
            { output: content }
          );
        }

        return content;
      } catch (error) {
        console.error('Error in chain:', error);
        throw error; // Re-throw to be caught by the main error handler
      }
    },
    new StringOutputParser()
  ]);

  try {
    const lastMessage = messages[messages.length - 1];
    
    // Start the response immediately
    writer.write(encoder.encode(`data: ${JSON.stringify({
      type: 'start',
      id: generateUUID(),
      createdAt: new Date().toISOString()
    })}\n\n`));

    const response = await chain.invoke({
      message: lastMessage.content
    });

    // Save response message
    if (session.user?.id) {
      const messageId = generateUUID();
      await saveMessages({
        messages: [{
          id: messageId,
          chatId: id,
          role: 'assistant',
          content: response,
          createdAt: new Date()
        }]
      });
    }

    // Ensure we write the completion message
    writer.write(encoder.encode(`data: ${JSON.stringify({
      type: 'complete',
      id: generateUUID(),
      content: response,
      createdAt: new Date().toISOString()
    })}\n\n`));

    writer.write(encoder.encode('data: [DONE]\n\n'));
    await writer.close();

    return new Response(stream.readable, {
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
