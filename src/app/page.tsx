"use client";

import { QueryProvider } from "@/components/providers/QueryProvider";
import { ChatContainer } from "@/components/chat/ChatContainer";

export default function HomePage() {
  return (
    <QueryProvider>
      <ChatContainer />
    </QueryProvider>
  );
}
