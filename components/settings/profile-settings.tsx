'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QuestionnaireForm } from '@/components/questionnaire-form';
import { toast } from 'sonner';

interface Question {
  id: string;
  question: string;
  key: string;
  placeholder?: string;
  isRequired: boolean;
}

export function ProfileSettings() {
  const { data: session, update } = useSession();
  const [name, setName] = useState(session?.user?.name || '');
  const [email, setEmail] = useState(session?.user?.email || '');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadQuestionnaire = async () => {
      if (session?.user?.id) {
        try {
          const response = await fetch(`/api/user/questionnaire?userId=${session.user.id}`);
          if (response.ok) {
            const data = await response.json();
            setQuestions(data.questions);
            setAnswers(data.answers);
          }
        } catch (error) {
          console.error('Failed to load questionnaire:', error);
        } finally {
          setIsLoading(false);
        }
      }
    };

    loadQuestionnaire();
  }, [session?.user?.id]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Add your profile update logic here
  };

  const handleQuestionnaireSubmit = async (newAnswers: Record<string, string>) => {
    if (!session?.user?.id) return;

    const formattedAnswers = questions.map(question => ({
      questionId: question.id,
      answer: newAnswers[question.key] || '',
    }));

    try {
      const response = await fetch('/api/user/questionnaire', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: session.user.id,
          answers: formattedAnswers,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update preferences');
      }

      setAnswers(newAnswers);
    } catch (error) {
      throw error;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile Settings</CardTitle>
          <CardDescription>
            Update your personal information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button type="submit">Save Changes</Button>
          </form>
        </CardContent>
      </Card>

      {!isLoading && questions.length > 0 && (
        <QuestionnaireForm
          questions={questions}
          defaultValues={answers}
          onSubmit={handleQuestionnaireSubmit}
        />
      )}
    </div>
  );
} 