import { sql } from 'drizzle-orm';
import { varchar, datetime } from 'drizzle-orm/pg-core';
import { pgTable } from 'drizzle-orm/pg-table';

export async function up(db: any) {
  await db.schema.alterTable('users', (table) => {
    table.addColumn('stripe_customer_id', varchar('stripe_customer_id').unique());
    table.addColumn('stripe_subscription_id', varchar('stripe_subscription_id').unique());
    table.addColumn('subscription_status', varchar('subscription_status'));
    table.addColumn('current_period_end', datetime('current_period_end'));
  });
}

export async function down(db: any) {
  await db.schema.alterTable('users', (table) => {
    table.dropColumn('stripe_customer_id');
    table.dropColumn('stripe_subscription_id');
    table.dropColumn('subscription_status');
    table.dropColumn('current_period_end');
  });
} 