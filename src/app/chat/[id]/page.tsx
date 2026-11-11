import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { ChatContainer } from "@/components/chat/ChatContainer";

export const dynamic = "force-dynamic";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/sign-in");
  }

  const { id } = await params;

  return (
    <QueryProvider>
      <ChatContainer initialConversationId={id} />
    </QueryProvider>
  );
}
