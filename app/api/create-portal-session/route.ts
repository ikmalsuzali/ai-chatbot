import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { authOptions } from '@/app/(auth)/api/auth/[...nextauth]/route';
import { getUserSubscription } from '@/lib/db/queries';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const user = await getUserSubscription(session.user.id);

    if (!user?.stripeCustomerId) {
      return new NextResponse('No stripe customer found', { status: 400 });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?tab=subscription`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    console.error('Error:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
} 