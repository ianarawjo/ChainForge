import React, { forwardRef } from "react";

export interface ChatHistoryViewProps {
  messages: React.ReactNode[];
  bgColors?: string[];
}

const ChatHistoryView = forwardRef<HTMLDivElement, ChatHistoryViewProps>(
  function ChatHistoryView({ messages, bgColors }, ref) {
    const _bg_color = bgColors !== undefined ? bgColors : ["#333", "#333"];
    return (
      <div ref={ref} className="chat-history">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={
              "chat-bubble chat-msg-" + (idx % 2 === 0 ? "left" : "right")
            }
            style={{ backgroundColor: _bg_color[idx % 2] }}
          >
            {msg}
          </div>
        ))}
      </div>
    );
  },
);

export default ChatHistoryView;
