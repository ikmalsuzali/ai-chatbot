'use server';

import { genSaltSync, hashSync } from 'bcrypt-ts';
import { and, asc, desc, eq, gt, gte } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { stripe } from '@/lib/stripe';

import {
  user,
  chat,
  type User,
  document,
  type Suggestion,
  suggestion,
  type Message,
  message,
  vote,
  questionnaireQuestion,
  userQuestionnaireAnswer,
} from './schema';
import { BlockKind } from '@/components/block';

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

export async function getUser(email: string): Promise<Array<User>> {
  try {
    return await db.select().from(user).where(eq(user.email, email));
  } catch (error) {
    console.error('Failed to get user from database');
    throw error;
  }
}

export async function createUser(email: string, password: string) {
  const salt = genSaltSync(10);
  const hash = hashSync(password, salt);

  try {
    return await db.insert(user).values({ email, password: hash });
  } catch (error) {
    console.error('Failed to create user in database');
    throw error;
  }
}

export async function saveChat({
  id,
  userId,
  title,
}: {
  id: string;
  userId: string;
  title: string;
}) {
  try {
    return await db.insert(chat).values({
      id,
      createdAt: new Date(),
      userId,
      title,
    });
  } catch (error) {
    console.error('Failed to save chat in database');
    throw error;
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    await db.delete(vote).where(eq(vote.chatId, id));
    await db.delete(message).where(eq(message.chatId, id));

    return await db.delete(chat).where(eq(chat.id, id));
  } catch (error) {
    console.error('Failed to delete chat by id from database');
    throw error;
  }
}

export async function getChatsByUserId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(chat)
      .where(eq(chat.userId, id))
      .orderBy(desc(chat.createdAt));
  } catch (error) {
    console.error('Failed to get chats by user from database');
    throw error;
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    return selectedChat;
  } catch (error) {
    console.error('Failed to get chat by id from database');
    throw error;
  }
}

export async function saveMessages({ messages }: { messages: Array<Message> }) {
  try {
    return await db.insert(message).values(messages);
  } catch (error) {
    console.error('Failed to save messages in database', error);
    throw error;
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (error) {
    console.error('Failed to get messages by chat id from database', error);
    throw error;
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: 'up' | 'down';
}) {
  try {
    const [existingVote] = await db
      .select()
      .from(vote)
      .where(and(eq(vote.messageId, messageId)));

    if (existingVote) {
      return await db
        .update(vote)
        .set({ isUpvoted: type === 'up' })
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    }
    return await db.insert(vote).values({
      chatId,
      messageId,
      isUpvoted: type === 'up',
    });
  } catch (error) {
    console.error('Failed to upvote message in database', error);
    throw error;
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await db.select().from(vote).where(eq(vote.chatId, id));
  } catch (error) {
    console.error('Failed to get votes by chat id from database', error);
    throw error;
  }
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
}: {
  id: string;
  title: string;
  kind: BlockKind;
  content: string;
  userId: string;
}) {
  try {
    return await db.insert(document).values({
      id,
      title,
      kind,
      content,
      userId,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error('Failed to save document in database');
    throw error;
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  try {
    const documents = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (error) {
    console.error('Failed to get document by id from database');
    throw error;
  }
}

export async function getDocumentById({ id }: { id: string }) {
  try {
    const [selectedDocument] = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (error) {
    console.error('Failed to get document by id from database');
    throw error;
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  try {
    await db
      .delete(suggestion)
      .where(
        and(
          eq(suggestion.documentId, id),
          gt(suggestion.documentCreatedAt, timestamp),
        ),
      );

    return await db
      .delete(document)
      .where(and(eq(document.id, id), gt(document.createdAt, timestamp)));
  } catch (error) {
    console.error(
      'Failed to delete documents by id after timestamp from database',
    );
    throw error;
  }
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Array<Suggestion>;
}) {
  try {
    return await db.insert(suggestion).values(suggestions);
  } catch (error) {
    console.error('Failed to save suggestions in database');
    throw error;
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  try {
    return await db
      .select()
      .from(suggestion)
      .where(and(eq(suggestion.documentId, documentId)));
  } catch (error) {
    console.error(
      'Failed to get suggestions by document version from database',
    );
    throw error;
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (error) {
    console.error('Failed to get message by id from database');
    throw error;
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    return await db
      .delete(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp)),
      );
  } catch (error) {
    console.error(
      'Failed to delete messages by id after timestamp from database',
    );
    throw error;
  }
}

export async function updateChatVisiblityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: 'private' | 'public';
}) {
  try {
    return await db.update(chat).set({ visibility }).where(eq(chat.id, chatId));
  } catch (error) {
    console.error('Failed to update chat visibility in database');
    throw error;
  }
}

export async function getUserSubscription(userId: string) {
  return await db.query.user.findFirst({
    where: eq(user.id, userId),
    columns: {
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      subscriptionStatus: true,
      currentPeriodEnd: true,
    },
  });
}

export async function updateUserSubscription(
  userId: string,
  subscriptionId: string,
  status: string,
  periodEnd: Date
) {
  return await db
    .update(user)
    .set({
      stripeSubscriptionId: subscriptionId,
      subscriptionStatus: status,
      currentPeriodEnd: periodEnd,
    })
    .where(eq(user.id, userId));
}

export async function getUserQuestionnaire(userId: string) {
  try {
    return await db
      .select()
      .from(userQuestionnaire)
      .where(eq(userQuestionnaire.userId, userId))
      .limit(1);
  } catch (error) {
    console.error('Failed to get user questionnaire from database');
    throw error;
  }
}

export async function createUserQuestionnaire(
  userId: string,
  data: {
    purpose: string;
    expertise: string;
    interests: string;
    preferredStyle: string;
  },
) {
  try {
    return await db.insert(userQuestionnaire).values({
      userId,
      ...data,
    });
  } catch (error) {
    console.error('Failed to create user questionnaire in database');
    throw error;
  }
}

export async function updateUserQuestionnaire(
  userId: string,
  data: {
    purpose: string;
    expertise: string;
    interests: string;
    preferredStyle: string;
  },
) {
  try {
    return await db
      .update(userQuestionnaire)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(userQuestionnaire.userId, userId));
  } catch (error) {
    console.error('Failed to update user questionnaire in database');
    throw error;
  }
}

export async function getQuestionnaireQuestions() {
  try {
    return await db
      .select()
      .from(questionnaireQuestion)
      .orderBy(asc(questionnaireQuestion.order));
  } catch (error) {
    console.error('Failed to get questionnaire questions from database');
    throw error;
  }
}

export async function getUserQuestionnaireAnswers(userId: string) {
  try {
    const answers = await db
      .select({
        questionId: userQuestionnaireAnswer.questionId,
        answer: userQuestionnaireAnswer.answer,
        question: questionnaireQuestion.question,
        key: questionnaireQuestion.key,
      })
      .from(userQuestionnaireAnswer)
      .innerJoin(
        questionnaireQuestion,
        eq(questionnaireQuestion.id, userQuestionnaireAnswer.questionId),
      )
      .where(eq(userQuestionnaireAnswer.userId, userId));

    return answers.reduce((acc, { key, answer }) => {
      acc[key] = answer;
      return acc;
    }, {} as Record<string, string>);
  } catch (error) {
    console.error('Failed to get user questionnaire answers from database');
    throw error;
  }
}

export async function createUserQuestionnaireAnswers(
  userId: string,
  answers: Array<{ questionId: string; answer: string }>,
) {
  try {
    return await db.insert(userQuestionnaireAnswer).values(
      answers.map((answer) => ({
        userId,
        questionId: answer.questionId,
        answer: answer.answer,
      })),
    );
  } catch (error) {
    console.error('Failed to create user questionnaire answers in database');
    throw error;
  }
}

export async function updateUserQuestionnaireAnswers(
  userId: string,
  answers: Array<{ questionId: string; answer: string }>,
) {
  try {
    // Delete existing answers
    await db
      .delete(userQuestionnaireAnswer)
      .where(eq(userQuestionnaireAnswer.userId, userId));

    // Insert new answers
    return await createUserQuestionnaireAnswers(userId, answers);
  } catch (error) {
    console.error('Failed to update user questionnaire answers in database');
    throw error;
  }
}

export async function createOrRetrieveCustomer(userId: string, email: string) {
  const existingUser = await db.query.user.findFirst({
    where: eq(user.id, userId),
  });

  if (existingUser?.stripeCustomerId) {
    return existingUser.stripeCustomerId;
  }

  // Create new Stripe customer
  const customer = await stripe.customers.create({
    email,
    metadata: {
      userId,
    },
  });

  // Update user with Stripe customer ID
  await db
    .update(user)
    .set({ stripeCustomerId: customer.id })
    .where(eq(user.id, userId));

  return customer.id;
}
