import { sql } from 'drizzle-orm';
import { pgTable, serial, text, varchar, timestamp, numeric, jsonb } from 'drizzle-orm/pg-core';

export async function up(db: any) {
  await db.schema.createTable('chat_history', (table: any) => {
    table.serial('id').primaryKey();
    table.text('question').notNull();
    table.text('answer').notNull();
    table.decimal('accuracy', 5, 2).notNull();
    table.varchar('risk_level', { length: 50 }).notNull();
    table.jsonb('sources').notNull();
    table.jsonb('metadata');
    table.timestamp('created_at').defaultNow();
    table.varchar('user_id', { length: 255 });
  });

  // Create indexes
  await sql`
    CREATE INDEX idx_chat_history_risk ON chat_history(risk_level);
    CREATE INDEX idx_chat_history_accuracy ON chat_history(accuracy);
    CREATE INDEX idx_chat_history_created ON chat_history(created_at);
  `;
}

export async function down(db: any) {
  await db.schema.dropTable('chat_history');
} 