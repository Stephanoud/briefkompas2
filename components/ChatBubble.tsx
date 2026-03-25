import React from "react";
import { ChatMessage } from "@/types";

interface ChatBubbleProps {
  message: ChatMessage;
}

function formatMessageTime(timestamp: ChatMessage["timestamp"]): string {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message }) => {
  const isAssistant = message.role === "assistant";

  return (
    <div className={`flex ${isAssistant ? "justify-start" : "justify-end"} mb-4`}>
      <div
        className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
          isAssistant
            ? "bg-gray-100 text-gray-900"
            : "bg-blue-600 text-white"
        }`}
      >
        <p className="text-sm leading-relaxed">{message.content}</p>
        <span className="text-xs opacity-70 mt-2 block" suppressHydrationWarning>
          {formatMessageTime(message.timestamp)}
        </span>
      </div>
    </div>
  );
};
