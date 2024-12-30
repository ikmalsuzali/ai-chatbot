import { stripe } from '@/lib/stripe';
import { getUserSubscription } from '@/lib/db/queries';
import type { SubscriptionStatus, CustomerSubscription } from '@/types/stripe';
import { createOrRetrieveCustomer } from '@/lib/db/queries';
import { user } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { updateUserSubscription } from '@/lib/db/queries';

export async function checkSubscriptionStatus(userId: string): Promise<CustomerSubscription | null> {
  const user = await getUserSubscription(userId);

  if (!user?.stripeSubscriptionId) return null;

  // Fetch the actual subscription from Stripe
  const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);

  return {
    id: subscription.id,
    status: subscription.status as SubscriptionStatus,
    priceId: subscription.items.data[0].price.id,
    customerId: subscription.customer as string,
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  };
}

export async function createSubscription(priceId: string) {
  try {
    const response = await fetch('/api/create-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId }),
    });

    if (!response.ok) {
      throw new Error('Subscription creation failed');
    }

    const data = await response.json();
    window.location.href = data.url;
  } catch (error) {
    console.error('Error:', error);
    throw new Error('Failed to create subscription');
  }
}

export async function manageSubscription(
  action: 'cancel' | 'reactivate' | 'upgrade',
  subscriptionId: string,
  newPriceId?: string
) {
  try {
    const response = await fetch(`/api/subscription/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscriptionId, newPriceId }),
    });

    if (!response.ok) {
      throw new Error('Subscription management failed');
    }

    return await response.json();
  } catch (error) {
    console.error('Error:', error);
    throw new Error(`Failed to ${action} subscription`);
  }
}

export async function createTrialSubscription(userId: string, email: string) {
  try {
    const customerId = await createOrRetrieveCustomer(userId, email);

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: process.env.STRIPE_PRICE_ID }],
      trial_period_days: 14,
      metadata: {
        userId,
      },
    });

    // Update user subscription using the new function
    await updateUserSubscription(
      userId,
      subscription.id,
      subscription.status,
      new Date(subscription.current_period_end * 1000)
    );

    return subscription;
  } catch (error) {
    console.error('Error creating trial subscription:', error);
    throw error;
  }
}

export async function getTrialStatus(subscriptionId: string) {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    return {
      isTrialing: subscription.status === 'trialing',
      trialEnd: subscription.trial_end 
        ? new Date(subscription.trial_end * 1000)
        : null,
      daysRemaining: subscription.trial_end 
        ? Math.ceil((subscription.trial_end * 1000 - Date.now()) / (1000 * 60 * 60 * 24))
        : 0,
    };
  } catch (error) {
    console.error('Error getting trial status:', error);
    return null;
  }
} 