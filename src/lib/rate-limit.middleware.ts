import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

// In-memory store for rate limiting
// Note: In a production worker, this would be a KV store or Durable Object
// for multi-node consistency, but for this sandbox, global variable works.
const rateLimitStore = new Map<string, { count: number; reset: number }>();

const WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS = 60; // 60 requests per minute per user

export const rateLimitMiddleware = createMiddleware({ type: "function" }).server(
  async ({ next, context }) => {
    const userId = (context as any).userId;
    if (!userId) return next();

    const now = Date.now();
    const userLimit = rateLimitStore.get(userId);

    if (!userLimit || now > userLimit.reset) {
      rateLimitStore.set(userId, {
        count: 1,
        reset: now + WINDOW_MS,
      });
      return next();
    }

    if (userLimit.count >= MAX_REQUESTS) {
      throw new Error("Muitas solicitações. Por favor, tente novamente em um minuto.");
    }

    userLimit.count += 1;
    return next();
  }
);
