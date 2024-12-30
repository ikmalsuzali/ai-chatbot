import { Document } from 'langchain/document';
import { OpenAIEmbeddings } from '@langchain/openai';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';

interface DocumentMetadata {
  id: string;
  title: string;
  kind: string;
  createdAt?: string;
  updatedAt?: string;
}

interface VerificationResult {
  isAccurate: boolean;
  explanation?: string;
}

interface QA {
  question: string;
  answer: string;
}

export class DocumentManager {
  private static instance: DocumentManager;
  private vectorStore: MemoryVectorStore;
  private qaHistory: Map<string, QA[]>;

  private constructor() {
    this.vectorStore = new MemoryVectorStore(new OpenAIEmbeddings());
    this.qaHistory = new Map();
  }

  public static getInstance(): DocumentManager {
    if (!DocumentManager.instance) {
      DocumentManager.instance = new DocumentManager();
    }
    return DocumentManager.instance;
  }

  async addDocument(content: string, metadata: DocumentMetadata): Promise<void> {
    const doc = new Document({ pageContent: content, metadata });
    await this.vectorStore.addDocuments([doc]);
  }

  async queryDocuments(query: string, chatId?: string): Promise<{
    documents: Document<DocumentMetadata>[];
    relevantQAs: QA[];
  }> {
    const documents = await this.vectorStore.similaritySearch(query, 5);
    const relevantQAs = chatId ? this.qaHistory.get(chatId) || [] : [];
    
    return {
      documents,
      relevantQAs
    };
  }

  async verifyAndTrackAnswer(
    chatId: string,
    question: string,
    answer: string,
    context: string,
    metadata: {
      modelId: string;
      documents: DocumentMetadata[];
    }
  ): Promise<{
    verification: VerificationResult;
    metadata: typeof metadata;
  }> {
    // Store QA pair in history
    if (!this.qaHistory.has(chatId)) {
      this.qaHistory.set(chatId, []);
    }
    this.qaHistory.get(chatId)?.push({ question, answer });

    // For now, return a simple verification
    // In a real implementation, you might want to use an LLM to verify accuracy
    return {
      verification: {
        isAccurate: true
      },
      metadata
    };
  }
} 