import { NextResponse } from 'next/server';
import { getSuggestedActions } from '@/lib/db/queries';

export async function GET() {
  try {
    const suggestedActions = await getSuggestedActions();
    return NextResponse.json(suggestedActions);
  } catch (error) {
    console.error('Failed to fetch suggested actions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch suggested actions' },
      { status: 500 },
    );
  }
} 