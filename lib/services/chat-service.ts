import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres  from "postgres";
import { 
  documentEmbeddings, 
  chatHistory,
  type ChatHistory 
} from "../db/schema";
import { eq, and, desc, gte } from "drizzle-orm";
import { cosineSimilarity } from "../utils/similarity";

interface ChatResponse {
  answer: string;
  sources: {
    content: string;
    metadata: any;
    similarity: number;
  }[];
  averageAccuracy: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export class ChatService {
  private embeddings: OpenAIEmbeddings;
  private vectorStore: PGVectorStore;
  private llm: ChatOpenAI;
  private db: ReturnType<typeof drizzle>;
  private similarityThreshold = 0.2; // Minimum similarity score to consider
  private sql: ReturnType<typeof postgres>;

  private readonly RISK_THRESHOLDS = {
    HIGH: 30,
    MEDIUM: 50,
  };

  private readonly HIGH_RISK_PROMPT = PromptTemplate.fromTemplate(`
    I understand you're looking for information about {question}

    While I don't have enough specific information to answer your question directly, I can offer some general advice about improving presentations and charisma:

    1. Consider how this topic might be presented more effectively
    2. Think about the audience's perspective and needs
    3. Focus on clear, confident communication

    Based on these principles and the following context (if relevant):
    {context}

    Here's my suggestion:
  `);

  private readonly GENERIC_RESPONSE_PROMPT = PromptTemplate.fromTemplate(`
    Thank you for your question about {question}

    I am an AI assistant specialized in helping you become a better presenter and speaker. I can help you with:

    1. Crafting engaging presentations
    2. Improving your public speaking skills
    3. Developing better communication techniques
    4. Building charisma and stage presence
    5. Managing presentation anxiety
    6. Structuring your content effectively

    To get the most out of our interaction, try asking specific questions about:
    - How to present a particular topic
    - Techniques for engaging your audience
    - Ways to improve specific aspects of your communication

    Based on your current question, here's my suggestion:
    {context}
  `);

  constructor(
    pgConfig: string,
    openAIApiKey: string,
  ) {

    this.sql = postgres(pgConfig);

    this.db = drizzle(this.sql);
    
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: openAIApiKey,
      modelName: "text-embedding-3-small"
    });

    this.vectorStore = new PGVectorStore(this.embeddings, {
      postgresConnectionOptions: {
        connectionString: pgConfig
      },
      tableName: "document_embeddings",
      columns: {
        idColumnName: "id",
        vectorColumnName: "embedding",
        contentColumnName: "content",
        metadataColumnName: "metadata",
      },
      distanceStrategy: "cosine",
   

    });

    this.llm = new ChatOpenAI({
      modelName: "gpt-4-turbo-preview",
      temperature: 0,
      apiKey: openAIApiKey,
    });
  }

  private determineRiskLevel(accuracy: number): 'low' | 'medium' | 'high' {
    if (accuracy < this.RISK_THRESHOLDS.HIGH) return 'high';
    if (accuracy < this.RISK_THRESHOLDS.MEDIUM) return 'medium';
    return 'low';
  }

  private async storeChatHistory(
    question: string,
    answer: string,
    accuracy: number,
    sources: any[],
    riskLevel: 'low' | 'medium' | 'high',
    userId?: string
  ): Promise<void> {
    const chatRecord: ChatHistory = {
      question,
      answer,
      accuracy,
      riskLevel,
      sources: sources as any,
      metadata: {
        timestamp: new Date().toISOString(),
        userId,
      },
      userId,
    };

    await this.db.insert(chatHistory).values(chatRecord);
  }

  private async processVectorResults(vectorResults: any[], queryEmbedding: number[]) {
    const sourcesWithSimilarity = [];
    for (const doc of vectorResults) {
      const docEmbedding = await this.getDocumentEmbedding(doc.id as string);
      const similarity = cosineSimilarity(queryEmbedding, docEmbedding);
      sourcesWithSimilarity.push({
        content: doc.pageContent,
        metadata: doc.metadata,
        similarity
      });
    }
    return sourcesWithSimilarity;
  }

  private isGenericQuestion(query: string): boolean {
    const genericPatterns = [
      /what can you do/i,
      /how can you help/i,
      /what (are )?your capabilities/i,
      /what (kind of )?questions/i,
      /how does this work/i,
      /tell me about yourself/i,
      /what should i ask/i
    ];
    return genericPatterns.some(pattern => pattern.test(query));
  }

  async chat(
    query: string,
    options: {
      maxSources?: number;
      similarityThreshold?: number;
      userId?: string;
    } = {}
  ): Promise<ChatResponse> {
    try {
      // 1. First check if it's a generic question
      if (this.isGenericQuestion(query)) {
        const answer = await RunnableSequence.from([
          {
            question: (input: { question: string; context: string }) => input.question,
            context: (input: { question: string; context: string }) => input.context,
          },
          this.GENERIC_RESPONSE_PROMPT,
          this.llm,
          new StringOutputParser(),
        ]).invoke({
          question: query,
          context: "Let me help you understand how I can assist you with your presentation and communication goals.",
        });

        const response: ChatResponse = {
          answer: answer.trim(),
          sources: [],
          averageAccuracy: 100,
          riskLevel: 'low'
        };

        // Store in chat history
        await this.storeChatHistory(
          query,
          response.answer,
          100,
          [],
          'low',
          options.userId
        );

        return response;
      }

      // 2. If not generic, proceed with vector search
      const vectorResults = await this.vectorStore.similaritySearch(query, 
        options.maxSources || 5,
      );

      // Calculate similarity scores
      const queryEmbedding = await this.embeddings.embedQuery(query);

      const sourcesWithSimilarity = await Promise.all(
        vectorResults.map(async (doc) => {
          const docEmbedding = await this.getDocumentEmbedding(doc.id as string);
          const similarity = cosineSimilarity(queryEmbedding, docEmbedding);
          return {
            content: doc.pageContent,
            metadata: doc.metadata,
            similarity
          };
        })
      );

      // Filter by similarity threshold
      const threshold = options.similarityThreshold || this.similarityThreshold;
      const relevantSources = sourcesWithSimilarity.filter(
        source => source.similarity >= threshold
      );

      // Calculate average accuracy
      const averageAccuracy = relevantSources.length > 0
        ? (relevantSources.reduce((acc, source) => acc + source.similarity, 0) / relevantSources.length * 100)
        : 0;

      // 3. Only then check for risk level and handle accordingly
      const riskLevel = this.determineRiskLevel(averageAccuracy);

      // Handle high-risk or no sources scenarios
      if (riskLevel === 'high' || relevantSources.length === 0) {
        const answer = await RunnableSequence.from([
          {
            question: (input: { question: string; context: string }) => input.question,
            context: (input: { question: string; context: string }) => input.context,
          },
          this.HIGH_RISK_PROMPT,
          this.llm,
          new StringOutputParser(),
        ]).invoke({
          question: query,
          context: relevantSources.map(s => s.content).join("\n\n") || "No specific context available.",
        });

        const response = {
          answer,
          sources: [],
          averageAccuracy,
          riskLevel
        };

        await this.storeChatHistory(
          query,
          answer,
          averageAccuracy,
          [],
          riskLevel,
          options.userId
        );

        return response;
      }

      // Create prompt template with confidence information
      const prompt = PromptTemplate.fromTemplate(`
        Answer the question based ONLY on the following context.

        Context:
        {context}

        Question: {question}

        Current confidence level: {confidence}%

      `);

      // Create chain
      const chain = RunnableSequence.from([
        {
          context: (input: { question: string; context: string; confidence: number }) => input.context,
          question: (input: { question: string; context: string; confidence: number }) => input.question,
          confidence: (input: { question: string; context: string; confidence: number }) => input.confidence,
        },
        prompt,
        this.llm,
        new StringOutputParser(),
      ]);

      // Generate response
      const answer = await chain.invoke({
        question: query,
        context: relevantSources.map(s => s.content).join("\n\n"),
        confidence: Math.round(averageAccuracy),
      });

      const response = {
        answer,
        sources: relevantSources,
        averageAccuracy,
        riskLevel,
      };

      // Store in chat history
      await this.storeChatHistory(
        query,
        answer,
        averageAccuracy,
        relevantSources,
        riskLevel,
        options.userId
      );

      return response;
    } catch (error) {
      console.error("Error in chat function:", error);
      throw error;
    }
  }

  async getChatHistory(
    options: {
      userId?: string;
      riskLevel?: 'low' | 'medium' | 'high';
      minAccuracy?: number;
      limit?: number;
    } = {}
  ) {
    let query = this.db
      .select()
      .from(chatHistory)
      .orderBy(desc(chatHistory.createdAt));

    if (options.userId) {
      query = query.where(eq(chatHistory.userId, options.userId));
    }

    if (options.riskLevel) {
      query = query.where(eq(chatHistory.riskLevel, options.riskLevel));
    }

    if (options.minAccuracy) {
      query = query.where(gte(chatHistory.accuracy, options.minAccuracy));
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    return await query;
  }

  private async getDocumentEmbedding(documentId: string): Promise<number[]> {
    const [result] = await this.db
      .select({ embedding: documentEmbeddings.embedding })
      .from(documentEmbeddings)
      .where(eq(documentEmbeddings.id, documentId));
    
    return Array.isArray(result?.embedding) ? result.embedding : [];
  }
} 