// @ts-nocheck

import { Document as LangchainDocument } from "@langchain/core/documents";
import { OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
import { CSVLoader } from "@langchain/community/document_loaders/fs/csv";
import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import * as XLSX from 'xlsx';
import * as path from 'path';
import { nanoid } from 'nanoid';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, and, sql, desc } from 'drizzle-orm';
import postgres from 'postgres';
import {
  document,
  documentEmbeddings,
  embeddingModels,
  user,
  type Document,
  type DocumentEmbedding,
  type EmbeddingModel,
} from '../../lib/db/schema';
import fs from 'fs/promises';

export class DataProcessor {
  private embeddings!: OpenAIEmbeddings;
  private vectorStore!: PGVectorStore;
  private textSplitter: RecursiveCharacterTextSplitter;
  private db: ReturnType<typeof drizzle>;
  private sql: ReturnType<typeof postgres>;
  private embeddingModel!: EmbeddingModel;
  private modelName: string;
  private openAIApiKey: string;
  private userId?: string;

  constructor(
    openAIApiKey: string,
    pgConfig: string,
    modelName: string = 'text-embedding-3-small',
    userId?: string,
  ) {
    this.openAIApiKey = openAIApiKey;
    this.modelName = modelName;
    this.userId = userId;
    
    // Initialize postgres.js client
    this.sql = postgres(pgConfig);
    
    // Initialize Drizzle with postgres.js client
    this.db = drizzle(this.sql);
    
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
  }

  async initialize(): Promise<void> {
    // Fetch embedding model using Drizzle


    // Initialize OpenAI embeddings
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: this.openAIApiKey,
      modelName: 'text-embedding-3-small'
    });

    // Initialize vector store
    this.vectorStore = new PGVectorStore(this.embeddings, {
      postgresConnectionOptions: { connectionString: this.pgConfig },
      tableName: 'document_embeddings',
      columns: {
        idColumnName: 'id',
        vectorColumnName: 'embedding',
        contentColumnName: 'content',
        metadataColumnName: 'metadata',
      },
    });
  }

  private async createDocumentRecord(data: Partial<Document>): Promise<Document> {
    if (!this.userId) {
      const [systemUser] = await this.db
        .select()
        .from(user)
        .where(eq(user.email, 'system@example.com'))
        .limit(1);

      if (systemUser) {
        this.userId = systemUser.id;
      } else {
        const [newSystemUser] = await this.db
          .insert(user)
          .values({
            email: 'system@example.com',
            password: null,
          })
          .returning();
        this.userId = newSystemUser.id;
      }
    }

    const [newDocument] = await this.db
      .insert(document)
      .values({
        ...data,
        createdAt: new Date(),
        userId: this.userId,
        kind: 'text',
      })
      .returning();
    return newDocument;
  }

  async toggleDocumentActive(documentId: number, active: boolean): Promise<void> {
    await this.db.transaction(async (tx) => {
      // Update document
      await tx
        .update(document)
        .set({ 
          isActive: active,
          lastAccessedAt: new Date()
        })
        .where(eq(document.id, documentId));

      // Update related embeddings
      await tx
        .update(documentEmbeddings)
        .set({ isActive: active })
        .where(eq(documentEmbeddings.documentId, documentId));
    });
  }

  async getDocumentInfo(documentId: number): Promise<Document | null> {
    const [document] = await this.db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId));
    return document || null;
  }

  async listDocuments(options: {
    activeOnly?: boolean;
    fileTypes?: string[];
    groupId?: string;
  } = {}): Promise<Document[]> {
    let query = this.db
      .select()
      .from(document)
      .orderBy(desc(document.createdAt));

    if (options.activeOnly) {
      query = query.where(eq(document.isActive, true));
    }

    if (options.fileTypes?.length) {
      query = query.where(sql`${document.fileType} = ANY(${options.fileTypes})`);
    }

    if (options.groupId) {
      query = query.where(eq(document.documentGroupId, options.groupId));
    }

    return await query;
  }

  async cleanupExpiredDocuments(): Promise<void> {
    await this.db.transaction(async (tx) => {
      const expiredDocs = await tx
        .select({ id: document.id })
        .from(document)
        .where(
          and(
            sql`${document.expiresAt} < NOW()`,
            eq(document.isActive, true)
          )
        );

      if (expiredDocs.length > 0) {
        const expiredIds = expiredDocs.map(d => d.id);
        
        await tx
          .update(document)
          .set({ isActive: false })
          .where(sql`id = ANY(${expiredIds})`);

        await tx
          .update(documentEmbeddings)
          .set({ isActive: false })
          .where(sql`document_id = ANY(${expiredIds})`);
      }
    });
  }

  async getDocumentGroups(): Promise<any[]> {
    return await this.db
      .select({
        documentGroupId: document.documentGroupId,
        documentCount: sql<number>`COUNT(*)`,
        latestVersion: sql<number>`MAX(${document.version})`,
        firstCreated: sql<Date>`MIN(${document.createdAt})`,
        lastUpdated: sql<Date>`MAX(${document.createdAt})`,
        hasActiveDocuments: sql<boolean>`bool_or(${document.isActive})`
      })
      .from(document)
      .groupBy(document.documentGroupId)
      .orderBy(desc(sql`MAX(${document.createdAt})`));
  }

  private async processFile(filePath: string): Promise<{ content: string; metadata: Record<string, any> }> {
    const extension = path.extname(filePath).toLowerCase();
    const stats = await fs.stat(filePath);
    const baseMetadata = {
      filename: path.basename(filePath),
      path: filePath,
      size: stats.size,
      modified: stats.mtime,
      fileType: extension.slice(1)
    };

    try {
      switch (extension) {
        case '.pdf': {
          const loader = new PDFLoader(filePath, {
            splitPages: true,
            pdfjs: async () => {
              const pdfjsLib = await import('pdfjs-dist');
              pdfjsLib.GlobalWorkerOptions.workerSrc = await import('pdfjs-dist/build/pdf.worker.entry');
              return pdfjsLib;
            }
          });
          const docs = await loader.load();
          return {
            content: docs.map(doc => doc.pageContent).join('\n\n'),
            metadata: {
              ...baseMetadata,
              ...docs[0].metadata,
              pageCount: docs.length
            }
          };
        }

        case '.csv': {
          const loader = new CSVLoader(filePath, {
            column: 'content',
          });
          const docs = await loader.load();
          return {
            content: docs.map(doc => doc.pageContent).join('\n'),
            metadata: {
              ...baseMetadata,
              rowCount: docs.length,
              columns: Object.keys(docs[0].metadata)
            }
          };
        }

        case '.docx':
        case '.doc': {
          const loader = new DocxLoader(filePath);
          const docs = await loader.load();
          return {
            content: docs.map(doc => doc.pageContent).join('\n\n'),
            metadata: {
              ...baseMetadata,
              ...docs[0].metadata
            }
          };
        }

        case '.xlsx':
        case '.xls': {
          const workbook = XLSX.readFile(filePath);
          const sheets = workbook.SheetNames;
          const allContent: string[] = [];
          const sheetData: Record<string, any> = {};

          for (const sheet of sheets) {
            const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheet]);
            const sheetContent = data.map(row => Object.values(row).join(' ')).join('\n');
            allContent.push(`Sheet: ${sheet}\n${sheetContent}`);
            sheetData[sheet] = {
              rowCount: data.length,
              columns: data.length > 0 ? Object.keys(data[0]) : []
            };
          }

          return {
            content: allContent.join('\n\n'),
            metadata: {
              ...baseMetadata,
              sheets: sheetData,
              sheetCount: sheets.length
            }
          };
        }

        default:
          throw new Error(`Unsupported file type: ${extension}`);
      }
    } catch (error: unknown) {
      throw new Error(`Error processing ${extension} file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async processDirectory(directoryPath: string): Promise<void> {
    try {
      const files = await fs.readdir(directoryPath);
      
      if (files.length === 0) {
        throw new Error(`No files found in directory: ${directoryPath}`);
      }
      
      for (const file of files) {
        const filePath = path.join(directoryPath, file);
        const stats = await fs.stat(filePath);

        if (stats.isFile()) {
          const [existingDoc] = await this.db
            .select()
            .from(document)
            .where(eq(document.urlPath, filePath));

          if (existingDoc) {
            console.log(`Skipping ${filePath} - already processed`);
            continue;
          }

          const { content, metadata } = await this.processFile(filePath);
          await this.processDocument(content, metadata);
        }
      }
    } catch (error: unknown) {
      throw new Error(`Error processing directory: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async processPostgresData(
    query: string,
    contentColumns: string[],
    metadataColumns: string[]
  ): Promise<void> {
    try {
      const result = await this.pool.query(query);
      
      for (const row of result.rows) {
        // Combine content from specified columns
        const content = contentColumns
          .map(col => row[col])
          .filter(Boolean)
          .join('\n');

        // Create metadata object from specified columns
        const metadata = metadataColumns.reduce((acc, col) => {
          acc[col] = row[col];
          return acc;
        }, {} as Record<string, any>);

        // Process the document content and generate embeddings
        await this.processDocument(content, metadata);
      }
    } catch (error: unknown) {
      throw new Error(`Error processing database data: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async listAvailableModels(): Promise<any[]> {
    try {
      // Query your database or API to get available embedding models
      const result = await this.pool.query(`
        SELECT 
          model_id,
          name,
          description,
          dimensions,
          status
        FROM embedding_models
        WHERE status = 'active'
        ORDER BY name
      `);
      
      return result.rows;
    } catch (error: unknown) {
      throw new Error(`Error listing available models: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async processDocument(content: string, metadata: Record<string, any>): Promise<void> {
    try {
      // Double-check initialization
      if (!this.embeddingModel) {
        await this.initialize();
      }

      // First, create the document record
      const documentRecord = await this.createDocumentRecord({
        urlPath: metadata.path,
        fileType: metadata.fileType,
        title: metadata.filename,
        metadata: metadata,
        isActive: true,
        content: content,
      });

      // Split content into chunks
      const docs = await this.textSplitter.splitText(content);
      
      // Process each chunk
      for (const [index, chunk] of docs.entries()) {
        const embedding = await this.generateEmbedding(chunk);
        
        // Store in database with chunk metadata and document ID
        await this.db.insert(documentEmbeddings).values({
          documentId: documentRecord.id,
          content: chunk,
          metadata: {
            ...metadata,
            chunkIndex: index,
            totalChunks: docs.length
          },
          embedding: embedding,
          fileType: metadata.fileType,
          isActive: true
        });
      }
    } catch (error: unknown) {
      throw new Error(`Error processing document: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Use the OpenAI embeddings instance that was initialized in the constructor
      const embeddings = await this.embeddings.embedQuery(text);
      return embeddings;
    } catch (error: unknown) {
      throw new Error(`Error generating embedding: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async close(): Promise<void> {
    await this.sql.end();
  }

  // ... rest of the methods remain similar, just updated to use Drizzle where appropriate
} 
