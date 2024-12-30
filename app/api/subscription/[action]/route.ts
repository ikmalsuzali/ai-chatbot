import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';

import { stripe } from '@/lib/stripe';
import { authOptions } from '@/app/(auth)/api/auth/[...nextauth]/route';

export async function POST(
  req: Request,
  { params }: { params: { action: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { subscriptionId } = await req.json();

    switch (params.action) {
      case 'cancel':
        await stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true,
        });
        break;

      case 'reactivate':
        await stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: false,
        });
        break;

      case 'upgrade':
        const { newPriceId } = await req.json();
        await stripe.subscriptions.update(subscriptionId, {
          items: [{ price: newPriceId }],
          proration_behavior: 'always_invoice',
        });
        break;

      default:
        return new NextResponse('Invalid action', { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Subscription action error:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
} 