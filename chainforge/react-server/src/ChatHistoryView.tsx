import React, { forwardRef } from "react";

export interface ChatHistoryViewProps {
  messages: React.ReactNode[];
  /** Class names for the bubbles, alternating, e.g. to color the conversation and the new message differently. */
  bubbleClassNames?: string[];
}

const ChatHistoryView = forwardRef<HTMLDivElement, ChatHistoryViewProps>(
  function ChatHistoryView({ messages, bubbleClassNames }, ref) {
    return (
      <div ref={ref} className="chat-history">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={
              "chat-bubble chat-msg-" +
              (idx % 2 === 0 ? "left" : "right") +
              (bubbleClassNames
                ? " " + bubbleClassNames[idx % bubbleClassNames.length]
                : "")
            }
          >
            {msg}
          </div>
        ))}
      </div>
    );
  },
);

export default ChatHistoryView;
