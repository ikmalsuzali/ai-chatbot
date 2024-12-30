import { db } from './db';
import { questionnaireQuestion } from './schema';

export async function seedQuestionnaireQuestions() {
  const defaultQuestions = [
    {
      question: 'What will you primarily use the chatbot for?',
      key: 'purpose',
      placeholder: 'E.g., Learning programming, getting help with work tasks, brainstorming ideas...',
      order: 1,
      isRequired: true,
    },
    {
      question: "What's your level of expertise in the areas you'll discuss?",
      key: 'expertise',
      placeholder: 'E.g., Beginner in Python, experienced in web development...',
      order: 2,
      isRequired: true,
    },
    {
      question: 'What specific topics or technologies interest you most?',
      key: 'interests',
      placeholder: 'E.g., Machine learning, web development, mobile apps...',
      order: 3,
      isRequired: true,
    },
    {
      question: 'How would you like the chatbot to communicate with you?',
      key: 'preferred_style',
      placeholder: 'E.g., Detailed technical explanations, simple step-by-step guides, concise answers...',
      order: 4,
      isRequired: true,
    },
  ];

  try {
    await db.insert(questionnaireQuestion).values(defaultQuestions);
    console.log('Successfully seeded questionnaire questions');
  } catch (error) {
    console.error('Failed to seed questionnaire questions:', error);
  }
} 