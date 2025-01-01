import { DataProcessor } from '../utils/data_processor';
import dotenv from 'dotenv';

dotenv.config();

async function addModel() {
  const pgConfig = {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || '',
    database: process.env.POSTGRES_DATABASE || 'your_database',
  };

  // Add a new model
  await DataProcessor.addEmbeddingModel(
    pgConfig,
    'multilingual-hf',
    'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
    384
  );

}

addModel().catch(console.error); 