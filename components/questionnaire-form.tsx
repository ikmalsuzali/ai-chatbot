'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

interface Question {
  id: string;
  question: string;
  key: string;
  placeholder?: string;
  isRequired: boolean;
}

interface QuestionnaireFormProps {
  questions: Question[];
  defaultValues?: Record<string, string>;
  onSubmit: (data: Record<string, string>) => Promise<void>;
  submitLabel?: string;
  isLoading?: boolean;
}

export function QuestionnaireForm({ 
  questions = [],
  defaultValues = {}, 
  onSubmit, 
  submitLabel = 'Save Changes',
  isLoading = false
}: QuestionnaireFormProps) {
  const [answers, setAnswers] = useState<Record<string, string>>(defaultValues);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (JSON.stringify(answers) !== JSON.stringify(defaultValues)) {
      setAnswers(defaultValues);
    }
  }, [defaultValues]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onSubmit(answers);
      toast.success('Preferences saved successfully');
    } catch (error) {
      toast.error('Failed to save preferences');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-[200px]" />
          <Skeleton className="h-4 w-[300px] mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-[250px]" />
                <Skeleton className="h-24 w-full" />
              </div>
            ))}
            <Skeleton className="h-10 w-[120px]" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chat Preferences</CardTitle>
        <CardDescription>
          Help us personalize your chat experience by answering a few questions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {questions?.map((question) => (
            <div key={question.id} className="space-y-2">
              <Label htmlFor={question.id}>
                {question.question}
                {question.isRequired && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <Textarea
                id={question.id}
                value={answers[question.key] || ''}
                onChange={(e) => setAnswers(prev => ({
                  ...prev,
                  [question.key]: e.target.value
                }))}
                placeholder={question.placeholder}
                required={question.isRequired}
              />
            </div>
          ))}

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : submitLabel}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
} 