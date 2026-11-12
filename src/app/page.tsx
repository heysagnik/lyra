import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { ChatContainer } from "@/components/chat/ChatContainer";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Gate the chat surface: unauthenticated visitors land on the login page
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/sign-in");
  }

  return <ChatContainer />;
}
