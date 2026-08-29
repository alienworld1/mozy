import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let limits: { solver: Ratelimit; ip: Ratelimit } | undefined;

function getLimits() {
  if (limits) return limits;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) throw new Error("rate_limit_unavailable");
  const redis = new Redis({ url, token });
  limits = {
    solver: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "1 m"),
      prefix: "mozy:registration:solver",
    }),
    ip: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, "1 m"),
      prefix: "mozy:registration:ip",
    }),
  };
  return limits;
}

export async function checkRegistrationRateLimit(
  solver: string,
  reservationId: string,
  ipAddress: string,
) {
  const rateLimits = getLimits();
  const [solverResult, ipResult] = await Promise.all([
    rateLimits.solver.limit(`${solver.toLowerCase()}:${reservationId}`),
    rateLimits.ip.limit(ipAddress),
  ]);
  return solverResult.success && ipResult.success;
}
