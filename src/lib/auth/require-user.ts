import { getAuth } from "./index";
import { makeAppError, err, ok, type Result } from "@/lib/errors";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

export async function requireUser(
  request: Request
): Promise<Result<SessionUser>> {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || !session.user) {
      return err(makeAppError("AUTH", "Unauthorized: Valid session required"));
    }

    return ok({
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
    });
  } catch (error) {
    return err(
      makeAppError("AUTH", "Failed to authenticate session", { cause: error })
    );
  }
}
