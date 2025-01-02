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

      // Get the reader from the response body
      const reader = response.body?.getReader();
      if (!reader) {
        console.error('No reader available');
        return;
      }

      try {
        let accumulatedContent = '';
        
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log('Stream complete');
            break;
          }

          // Decode the stream chunk
          const data = new TextDecoder().decode(value);
          console.log('Received chunk:', data);

          // Parse the JSON data
          try {
            // Remove the "data: " prefix and parse the remaining JSON
            const jsonString = data.replace(/^data: /, '');
            const jsonData = JSON.parse(jsonString);
            console.log('Parsed JSON:', jsonData);
            if (jsonData.delta) {
              // Handle newlines and special characters
              const formattedDelta = jsonData.delta
                .replace(/\\n/g, '\n')  // Convert \n string to actual newlines
                .replace(/\\t/g, '\t')  // Convert \t string to actual tabs
                .replace(/\\\"/g, '"')  // Convert escaped quotes to regular quotes
                .replace(/\\\\/g, '\\'); // Convert double backslashes to single

              // Accumulate the content
              accumulatedContent += formattedDelta;
            }
          } catch (error) {
            console.error('Error parsing chunk:', error);
          }

          // Update the messages with the accumulated content
          setMessages(prevMessages => {
            const lastMessage = prevMessages[prevMessages.length - 1];
            if (lastMessage?.role === 'assistant') {
              // Update existing assistant message
              return prevMessages.map((msg, i) => 
                i === prevMessages.length - 1 
                  ? { ...msg, content: accumulatedContent }
                  : msg
              );
            } else {
              // Create new assistant message
              return [...prevMessages, {
                id: `${id}-${Date.now()}`,
                role: 'assistant',
                content: accumulatedContent
              }];
            }
          });
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
