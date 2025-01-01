import { createTrialSubscription } from '@/lib/subscription';
import { createUser, createUserQuestionnaire } from '@/lib/db/queries';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { email, password, questionnaire } = await req.json();

    // Create user in database
    const result = await createUser(email, password);
    
    // Create user questionnaire
    // if (questionnaire) {
    //   await createUserQuestionnaire(result.id, questionnaire);
    // }
    
    // Set up trial subscription
    // await createTrialSubscription(result.id, email);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
} 