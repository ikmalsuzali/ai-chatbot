import { ChatMessage, HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence } from '@langchain/core/runnables';
import { StructuredTool } from '@langchain/core/tools';
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
  const langChainMessages = messages.map(msg => {
    if (msg.role === 'user') return new HumanMessage(msg.content);
    if (msg.role === 'assistant') return new AIMessage(msg.content);
    return new SystemMessage(msg.content);
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
    new StructuredTool({
      name: 'searchDocuments',
      description: 'Search through existing documents for relevant information',
      schema: z.object({
        query: z.string()
      }),
      func: async ({ query }) => {
        const { documents } = await documentManager.queryDocuments(query, id);
        return documents.map(doc => ({
          content: doc.pageContent,
          metadata: doc.metadata
        }));
      }
    }),

    new StructuredTool({
      name: 'createDocument',
      description: 'Create a document for a writing activity',
      schema: z.object({
        title: z.string(),
        kind: z.enum(['text', 'code']),
        content: z.string()
      }),
      func: async ({ title, kind, content }) => {
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

    new StructuredTool({
      name: 'updateDocument',
      description: 'Update an existing document',
      schema: z.object({
        id: z.string(),
        content: z.string(),
        description: z.string()
      }),
      func: async ({ id, content, description }) => {
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

        // Update database
        await saveDocument({
          id,
          title: document.title,
          kind: document.kind,
          content,
          userId: session.user.id!
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
        return [...history.chat_history, new HumanMessage(input.message)];
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
        
        return new SystemMessage(systemMessageContent);
      },
      context: async (input) => {
        // Get relevant context and QA history
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
      const response = await chatModel.invoke({
        messages: [
          input.systemMessage,
          // Include relevant context in the prompt
          new SystemMessage(`Relevant context:\n${input.context.contextText}\n\nRelevant previous QA:\n${
            input.context.relevantQAs.map(qa => 
              `Q: ${qa.question}\nA: ${qa.answer}\n`
            ).join('\n')
          }`),
          ...input.memory,
        ],
        tools: input.tools
      });

      // Verify and track the answer
      const verificationResult = await documentManager.verifyAndTrackAnswer(
        id,
        input.memory[input.memory.length - 1].content,
        response.content,
        input.context.contextText,
        {
          modelId,
          documents: input.context.documents.map(doc => doc.metadata)
        }
      );

      // If the answer is not accurate, append a correction
      if (!verificationResult.verification.isAccurate) {
        response.content += `\n\nNote: I need to correct my previous statement. ${verificationResult.verification.explanation}`;
      }

      // Save to memory
      await memory.saveContext(
        { input: input.memory[input.memory.length - 1].content },
        { output: response.content }
      );

      return response;
    },
    new StringOutputParser()
  ]);

  try {
    const lastMessage = messages[messages.length - 1];
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
