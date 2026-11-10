import type { FastifyRequest } from "fastify";
import type { JWTPayload } from "jose";
import { getClerkVerifyOptions } from "./auth.js";
import { verifyToken as verifyClerkToken } from "@clerk/backend";

function h(req: FastifyRequest, name: string): string | undefined {
  const v = req.headers[name] as string | string[] | undefined;
  if (Array.isArray(v)) return v[0];
  return v;
}

export type ClerkSessionAuth =
  | { ok: true; subject: string; claims: JWTPayload }
  | { ok: false };

/** Any signed-in Clerk user (employers). Steward routes still use `authorizeSteward`. */
export async function authorizeClerkSession(req: FastifyRequest): Promise<ClerkSessionAuth> {
  const opts = getClerkVerifyOptions();
  if (!opts) return { ok: false };
  const bearer = h(req, "authorization");
  if (!bearer?.startsWith("Bearer ")) return { ok: false };
  const token = bearer.slice(7).trim();
  try {
    const payload = (await verifyClerkToken(token, opts)) as unknown as JWTPayload;
    const sub = String(payload.sub ?? "clerk-user");
    return { ok: true, subject: sub, claims: payload };
  } catch {
    return { ok: false };
  }
}
