import { z } from "zod";
import { runTurn } from "@/lib/agent/loop";

export const maxDuration = 60;

const chatRequestBodySchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().min(1, "Message cannot be empty"),
  search: z.boolean().optional(),
  model: z.enum(["primary", "fallback"]).optional(),
  effort: z.enum(["low", "standard", "max"]).optional(),
});

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const parsed = chatRequestBodySchema.safeParse(rawBody);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          error: "Invalid request payload",
          details: parsed.error.format(),
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return await runTurn({
      request,
      input: {
        conversationId: parsed.data.conversationId,
        text: parsed.data.message,
        search: parsed.data.search,
        model: parsed.data.model,
        effort: parsed.data.effort,
      },
    });
  } catch {
    return new Response(
      JSON.stringify({ error: "Malformed request payload" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
