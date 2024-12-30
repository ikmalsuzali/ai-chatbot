export type SubscriptionStatus =
  | 'active'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'past_due'
  | 'trialing'
  | 'unpaid';

export interface CustomerSubscription {
  id: string;
  status: SubscriptionStatus;
  priceId: string;
  customerId: string;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
} 