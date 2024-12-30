import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { checkSubscriptionStatus } from '@/lib/subscription';

export async function middleware(req: Request) {
  const token = await getToken({ req });

  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Check if route requires premium subscription
  if (req.nextUrl.pathname.startsWith('/premium')) {
    const subscription = await checkSubscriptionStatus(token.sub!);
    
    if (!subscription?.isActive) {
      return NextResponse.redirect(new URL('/billing', req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/premium/:path*'],
};
