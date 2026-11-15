import { ChatShellSkeleton } from "@/components/chat/chat-skeletons";

/**
 * Chat shell skeleton shown while the (force-dynamic) chat pages render on
 * the server — e.g. returning to the chat from Settings. ChatShellSkeleton
 * mirrors the real ChatContainer layout so nothing jumps when the page
 * replaces it.
 */
export default function ChatLoading() {
  return <ChatShellSkeleton />;
}
