'use client';

import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { ChatRequestOptions, CreateMessage, Message } from 'ai';
import { memo, useEffect, useState } from 'react';

interface SuggestedAction {
  id: string;
  title: string;
  label: string;
  action: string;
  order: number;
}

interface SuggestedActionsProps {
  chatId: string;
  append: (
    message: Message | CreateMessage,
    chatRequestOptions?: ChatRequestOptions,
  ) => Promise<string | null | undefined>;
}

function PureSuggestedActions({ chatId, append }: SuggestedActionsProps) {
  const [suggestedActions, setSuggestedActions] = useState<SuggestedAction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSuggestedActions = async () => {
      try {
        const response = await fetch('/api/suggested-actions');
        if (!response.ok) {
          throw new Error('Failed to fetch suggested actions');
        }
        const actions = await response.json();
        setSuggestedActions(actions);
      } catch (error) {
        console.error('Failed to fetch suggested actions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSuggestedActions();
  }, []);

  if (isLoading) {
    return (
      <div className="grid sm:grid-cols-2 gap-2 w-full animate-pulse">
        {[1, 2, 3, 4].map((index) => (
          <div
            key={`skeleton-${index}`}
            className={`h-20 bg-gray-200 rounded-xl ${
              index > 1 ? 'hidden sm:block' : 'block'
            }`}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 gap-2 w-full">
      {suggestedActions.map((suggestedAction, index) => (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ delay: 0.05 * index }}
          key={`suggested-action-${suggestedAction.id}`}
          className={index > 1 ? 'hidden sm:block' : 'block'}
        >
          <Button
            variant="ghost"
            onClick={async () => {
              window.history.replaceState({}, '', `/chat/${chatId}`);

              append({
                role: 'user',
                content: suggestedAction.action,
              });
            }}
            className="text-left border rounded-xl px-4 py-3.5 text-sm flex-1 gap-1 sm:flex-col w-full h-auto justify-start items-start"
          >
            <span className="font-medium">{suggestedAction.title}</span>
            <span className="text-muted-foreground">
              {suggestedAction.label}
            </span>
          </Button>
        </motion.div>
      ))}
    </div>
  );
}

export const SuggestedActions = memo(PureSuggestedActions, () => true);
