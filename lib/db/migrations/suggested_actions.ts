import { sql } from 'drizzle-orm';
import { pgTable, uuid, text, boolean, timestamp, integer } from 'drizzle-orm/pg-core';

export async function up(db: any) {
  await db.schema.createTable('SuggestedAction', (table: any) => {
    table.uuid('id').primaryKey().notNull().defaultRandom();
    table.text('title').notNull();
    table.text('label').notNull();
    table.text('action').notNull();
    table.boolean('isActive').notNull().default(true);
    table.timestamp('createdAt').notNull().defaultNow();
    table.timestamp('updatedAt').notNull().defaultNow();
    table.integer('order').notNull();
  });

  // Create indexes
  await sql`
    CREATE INDEX idx_suggested_action_active ON "SuggestedAction"("isActive");
    CREATE INDEX idx_suggested_action_order ON "SuggestedAction"("order");
  `;

  // Insert default suggested actions
  await db.insert(pgTable('SuggestedAction', {
    id: uuid('id'),
    title: text('title'),
    label: text('label'),
    action: text('action'),
    isActive: boolean('isActive'),
    createdAt: timestamp('createdAt'),
    updatedAt: timestamp('updatedAt'),
    order: integer('order')
  })).values([
    {
      title: 'What are the advantages',
      label: 'of using Next.js?',
      action: 'What are the advantages of using Next.js?',
      order: 1,
    },
    {
      title: 'Write code that',
      label: `demonstrates djikstra's algorithm`,
      action: `Write code that demonstrates djikstra's algorithm`,
      order: 2,
    },
    {
      title: 'Help me write an essay',
      label: `about silicon valley`,
      action: `Help me write an essay about silicon valley`,
      order: 3,
    },
    {
      title: 'What is the weather',
      label: 'in San Francisco?',
      action: 'What is the weather in San Francisco?',
      order: 4,
    },
  ]);
}

export async function down(db: any) {
  await db.schema.dropTable('SuggestedAction');
} 