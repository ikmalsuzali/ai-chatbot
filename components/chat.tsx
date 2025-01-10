'use client';

import type { Attachment, Message } from 'ai';
import { useChat } from 'ai/react';
import { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';

import { ChatHeader } from '@/components/chat-header';
import type { Vote } from '@/lib/db/schema';
import { fetcher } from '@/lib/utils';

import { Block } from './block';
import { MultimodalInput } from './multimodal-input';
import { Messages } from './messages';
import { VisibilityType } from './visibility-selector';
import { useBlockSelector } from '@/hooks/use-block';

export function Chat({
  id,
  initialMessages,
  selectedModelId,
  selectedVisibilityType,
  isReadonly,
}: {
  id: string;
  initialMessages: Array<Message>;
  selectedModelId: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
}) {
  const { mutate } = useSWRConfig();

  const {
    messages,
    setMessages,
    handleSubmit,
    input,
    setInput,
    append,
    isLoading,
    stop,
    reload,
  } = useChat({
    id,
    body: { id, modelId: selectedModelId },
    initialMessages,
    experimental_throttle: 100,
    onResponse: async (response) => {
      if (!response.ok) {
        console.error('Response error:', response.statusText);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        console.error('No reader available');
        return;
      }

      try {
        let accumulatedContent = '';
        let content = '';
        let buffer = ''; // Buffer for incomplete chunks
        
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log('Stream complete');
            // Set the final message with complete content
            if (content) {
              setMessages(prevMessages => {
                const lastMessage = prevMessages[prevMessages.length - 1];
                if (lastMessage?.role === 'assistant') {
                  return prevMessages.map((msg, i) => 
                    i === prevMessages.length - 1 
                      ? { ...msg, content }
                      : msg
                  );
                }
                return prevMessages;
              });
            }
            break;
          }

          // Decode the stream chunk
          const chunk = new TextDecoder().decode(value);
          buffer += chunk;

          // Process complete messages in buffer
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep the last incomplete line in buffer

          for (const line of lines) {
            if (line.trim() === '') continue;

            try {
              // Remove the "data: " prefix if it exists
              const jsonStr = line.replace(/^data: /, '').trim();
              if (!jsonStr) continue;

              const jsonData = JSON.parse(jsonStr);
              console.log('Parsed JSON:', jsonData);

              if (jsonData.type === 'done') {
                console.log('Received done signal');
                continue;
              }

              if (jsonData.type === 'error') {
                console.error('Error from server:', jsonData.error);
                continue;
              }

              // Handle message content
              if (jsonData.delta) {
                accumulatedContent += jsonData.delta;
              }

              if (jsonData.content) {
                content = jsonData.content;
              }

              // Update messages with accumulated content
              setMessages(prevMessages => {
                const lastMessage = prevMessages[prevMessages.length - 1];
                const newContent = content || accumulatedContent;

                if (lastMessage?.role === 'assistant') {
                  return prevMessages.map((msg, i) => 
                    i === prevMessages.length - 1 
                      ? { ...msg, content: newContent }
                      : msg
                  );
                } else {
                  return [...prevMessages, {
                    id: jsonData.id || `${id}-${Date.now()}`,
                    role: 'assistant',
                    content: newContent
                  }];
                }
              });

            } catch (error) {
              console.warn('Error parsing JSON chunk:', error, '\nLine:', line);
              continue;
            }
          }
        }
      } catch (error) {
        console.error('Error reading stream:', error);
      } finally {
        reader.releaseLock();
      }
    },
    onFinish: () => {
      mutate('/api/history');
    },
  });

  const { data: votes } = useSWR<Array<Vote>>(
    `/api/vote?chatId=${id}`,
    fetcher,
  );

  const [attachments, setAttachments] = useState<Array<Attachment>>([]);
  const isBlockVisible = useBlockSelector((state) => state.isVisible);

  return (
    <>
      <div className="flex flex-col min-w-0 h-dvh bg-background">
        <ChatHeader
          chatId={id}
          selectedModelId={selectedModelId}
          selectedVisibilityType={selectedVisibilityType}
          isReadonly={isReadonly}
        />

        <Messages
          chatId={id}
          isLoading={isLoading}
          votes={votes}
          messages={messages}
          setMessages={setMessages}
          reload={reload}
          isReadonly={isReadonly}
          isBlockVisible={isBlockVisible}
        />

        <form className="flex mx-auto px-4 bg-background pb-4 md:pb-6 gap-2 w-full md:max-w-3xl">
          {!isReadonly && (
            <MultimodalInput
              chatId={id}
              input={input}
              setInput={setInput}
              handleSubmit={handleSubmit}
              isLoading={isLoading}
              stop={stop}
              attachments={attachments}
              setAttachments={setAttachments}
              messages={messages}
              setMessages={setMessages}
              append={append}
            />
          )}
        </form>
      </div>

      <Block
        chatId={id}
        input={input}
        setInput={setInput}
        handleSubmit={handleSubmit}
        isLoading={isLoading}
        stop={stop}
        attachments={attachments}
        setAttachments={setAttachments}
        append={append}
        messages={messages}
        setMessages={setMessages}
        reload={reload}
        votes={votes}
        isReadonly={isReadonly}
      />
    </>
  );
}
