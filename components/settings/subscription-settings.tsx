'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { checkSubscriptionStatus } from '@/lib/subscription';
import type { CustomerSubscription } from '@/types/stripe';
import { toast } from 'sonner';
import { InformationCircleIcon } from '@radix-ui/react-icons';

export function SubscriptionSettings() {
  const { data: session } = useSession();
  const [subscription, setSubscription] = useState<CustomerSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSubscription();
  }, [session]);

  const loadSubscription = async () => {
    if (session?.user?.id) {
      const status = await checkSubscriptionStatus(session.user.id);
      setSubscription(status);
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    try {
      const response = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) throw new Error('Failed to create portal session');

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      toast.error('Failed to open subscription portal');
      console.error('Portal session error:', error);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subscription Settings</CardTitle>
        <CardDescription>
          Manage your subscription and billing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <h3 className="font-medium">Current Plan</h3>
          <p className="text-sm text-muted-foreground">
            Status: {subscription?.status || 'No active subscription'}
          </p>
          {subscription?.currentPeriodEnd && (
            <p className="text-sm text-muted-foreground">
              Next billing date: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
            </p>
          )}
        </div>

        <Button onClick={handleManageSubscription}>
          {subscription ? 'Manage Subscription' : 'Subscribe Now'}
        </Button>

        {subscription?.status === 'trialing' && (
          <div className="rounded-md bg-blue-50 p-4 mb-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <InformationCircleIcon className="h-5 w-5 text-blue-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  Trial Period Active
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>
                    Your trial will end on{' '}
                    {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 