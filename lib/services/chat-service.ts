import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import { Document } from "@langchain/core/documents";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { 
  document, 
  documentEmbeddings, 
  embeddingModels,
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
  private similarityThreshold = 0.7; // Minimum similarity score to consider

  private readonly RISK_THRESHOLDS = {
    HIGH: 40,
    MEDIUM: 70,
  };

  constructor(
    private config: {
      openAIApiKey: string;
      postgresUrl: string;
    }
  ) {
    const pool = new Pool({
      connectionString: config.postgresUrl
    });
    this.db = drizzle(pool);
    
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: config.openAIApiKey,
      modelName: "text-embedding-3-small"
    });

    this.vectorStore = new PGVectorStore(this.embeddings, {
      postgresConnectionOptions: {
        connectionString: config.postgresUrl
      },
      tableName: "document_embeddings",
      columns: {
        idColumnName: "id",
        vectorColumnName: "embedding",
        contentColumnName: "content",
        metadataColumnName: "metadata",
      },
    });

    this.llm = new ChatOpenAI({
      modelName: "gpt-4-turbo-preview",
      temperature: 0,
      apiKey: config.openAIApiKey,
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

    await this.db.insert(chatHistories).values(chatRecord);
  }

  async chat(
    query: string,
    options: {
      maxSources?: number;
      similarityThreshold?: number;
      userId?: string;
    } = {}
  ): Promise<ChatResponse> {
    // Get relevant documents
    const vectorResults = await this.vectorStore.similaritySearch(query, 
      options.maxSources || 5,
      { isActive: true }
    );

    // Calculate similarity scores
    const queryEmbedding = await this.embeddings.embedQuery(query);
    const sourcesWithSimilarity = await Promise.all(
      vectorResults.map(async (doc) => {
        const docEmbedding = await this.getDocumentEmbedding(doc.metadata.documentId);
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

    // Determine risk level
    const riskLevel = this.determineRiskLevel(averageAccuracy);

    // Handle high-risk or no sources scenarios
    if (riskLevel === 'high' || relevantSources.length === 0) {
      const response = {
        answer: "I apologize, but I cannot provide a reliable answer to this question based on the available information. The confidence level is too low to ensure accuracy.",
        sources: [],
        averageAccuracy,
        riskLevel
      };

      // Store in chat history
      await this.storeChatHistory(
        query,
        response.answer,
        averageAccuracy,
        [],
        riskLevel,
        options.userId
      );

      return response;
    }

    // Create prompt template with confidence information
    const prompt = PromptTemplate.fromTemplate(`
      Answer the question based ONLY on the following context. If you cannot answer the question based solely on the context, say "I cannot answer this question based on the available information."

      Context:
      {context}

      Question: {question}

      Current confidence level: {confidence}%

      Answer the question concisely and only use information from the provided context. Include relevant quotes if appropriate.
      If the confidence level is between 40-70%, preface your answer with a warning about potential inaccuracies.
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
      .from(chatHistories)
      .orderBy(desc(chatHistories.createdAt));

    if (options.userId) {
      query = query.where(eq(chatHistories.userId, options.userId));
    }

    if (options.riskLevel) {
      query = query.where(eq(chatHistories.riskLevel, options.riskLevel));
    }

    if (options.minAccuracy) {
      query = query.where(gte(chatHistories.accuracy, options.minAccuracy));
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
      .where(eq(documentEmbeddings.documentId, documentId));
    
    return result?.embedding ? JSON.parse(result.embedding as string) : [];
  }
} 