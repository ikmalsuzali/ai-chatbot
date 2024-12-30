import { NextResponse } from 'next/server';
import { 
  getQuestionnaireQuestions,
  getUserQuestionnaireAnswers,
  createUserQuestionnaireAnswers,
  updateUserQuestionnaireAnswers,
} from '@/lib/db/queries';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const [questions, answers] = await Promise.all([
      getQuestionnaireQuestions(),
      getUserQuestionnaireAnswers(userId),
    ]);

    return NextResponse.json({
      questions,
      answers,
    });
  } catch (error) {
    console.error('Failed to get questionnaire:', error);
    return NextResponse.json(
      { error: 'Failed to get questionnaire' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { userId, answers } = await req.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    await createUserQuestionnaireAnswers(userId, answers);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to create questionnaire:', error);
    return NextResponse.json(
      { error: 'Failed to create questionnaire' },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const { userId, answers } = await req.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    await updateUserQuestionnaireAnswers(userId, answers);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update questionnaire:', error);
    return NextResponse.json(
      { error: 'Failed to update questionnaire' },
      { status: 500 }
    );
  }
} 