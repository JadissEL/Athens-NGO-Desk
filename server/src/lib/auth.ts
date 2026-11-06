import type { FastifyRequest } from "fastify";
import * as jwt from "jsonwebtoken";
import { verifyToken as verifyClerkToken } from "@clerk/backend";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

const HEADER = "x-steward-key";

export function parseStewardKeys(): Set<string> {
  const raw = process.env.STEWARD_API_KEYS ?? "";
  return new Set(
    raw
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean)
  );
}

/** HS256 shared secret for steward JWTs (optional alternative to API keys) */
export function getStewardJwtSecret(): string | null {
  const s = process.env.STEWARD_JWT_SECRET?.trim();
  return s && s.length > 0 ? s : null;
}

let jwksSet: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks(): ReturnType<typeof createRemoteJWKSet> | null {
  const url = process.env.STEWARD_JWKS_URL?.trim();
  if (!url) return null;
  if (!jwksSet) {
    jwksSet = createRemoteJWKSet(new URL(url));
  }
  return jwksSet;
}

function h(
  req: FastifyRequest,
  name: string
): string | undefined {
  const v = req.headers[name] as string | string[] | undefined;
  if (Array.isArray(v)) return v[0];
  return v;
}

/**
 * Clerk session JWT verification — set `CLERK_SECRET_KEY` and/or `CLERK_JWT_KEY`
 * (see server/.env.example). Optional `CLERK_AUTHORIZED_PARTIES` (comma-separated origins).
 */
export function getClerkVerifyOptions(): {
  secretKey?: string;
  jwtKey?: string;
  authorizedParties?: string[];
  audience?: string | string[];
  issuer?: string | string[];
} | null {
  const secretKey = process.env.CLERK_SECRET_KEY?.trim();
  const jwtKey = process.env.CLERK_JWT_KEY?.trim();
  if (!secretKey && !jwtKey) {
    return null;
  }
  const partiesRaw = process.env.CLERK_AUTHORIZED_PARTIES?.trim();
  const authorizedParties = partiesRaw
    ? partiesRaw.split(",").map((s: string) => s.trim()).filter(Boolean)
    : undefined;
  const audienceRaw = process.env.CLERK_JWT_AUDIENCE?.trim();
  const issuerRaw = process.env.CLERK_JWT_ISSUER?.trim();
  return {
    ...(secretKey ? { secretKey } : {}),
    ...(jwtKey ? { jwtKey } : {}),
    ...(authorizedParties?.length ? { authorizedParties } : {}),
    ...(audienceRaw ? { audience: audienceRaw } : {}),
    ...(issuerRaw ? { issuer: issuerRaw } : {}),
  };
}

function getNested(obj: Record<string, unknown>, dotPath: string): unknown {
  let cur: unknown = obj;
  for (const part of dotPath.split(".")) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

async function verifyClerkSessionJwt(token: string): Promise<JWTPayload | null> {
  const opts = getClerkVerifyOptions();
  if (!opts) return null;
  try {
    const payload = await verifyClerkToken(token, opts);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

function stewardJwtAllowedGeneric(payload: JWTPayload): boolean {
  const required = process.env.STEWARD_JWT_REQUIRED_ROLE?.trim();
  if (!required) return true;
  const roleClaim = process.env.STEWARD_JWT_ROLE_CLAIM ?? "role";
  const roles = payload[roleClaim];
  if (Array.isArray(roles)) return roles.map(String).includes(required);
  if (typeof roles === "string") return roles === required || roles.split(",").map((s) => s.trim()).includes(required);
  return false;
}

/**
 * Steward role for Clerk: default `public_metadata.role` when `STEWARD_JWT_REQUIRED_ROLE` is set.
 * Override path with `CLERK_STEWARD_ROLE_METADATA_PATH` (e.g. `public_metadata.steward_role`).
 */
function stewardJwtAllowedClerk(payload: JWTPayload): boolean {
  const required =
    process.env.STEWARD_JWT_REQUIRED_ROLE?.trim() ||
    process.env.CLERK_STEWARD_REQUIRED_ROLE?.trim();
  if (!required) return true;
  const path =
    process.env.CLERK_STEWARD_ROLE_METADATA_PATH?.trim() || "public_metadata.role";
  const record = payload as unknown as Record<string, unknown>;
  const raw = path.includes(".") ? getNested(record, path) : record[path];
  if (Array.isArray(raw)) return raw.map(String).includes(required);
  if (typeof raw === "string") return raw === required || raw.split(",").map((s) => s.trim()).includes(required);
  return false;
}

async function verifyStewardJwt(token: string): Promise<JWTPayload | null> {
  const jwks = getJwks();
  if (jwks) {
    const issuer = process.env.STEWARD_JWT_ISSUER;
    const audience = process.env.STEWARD_JWT_AUDIENCE;
    try {
      const { payload } = await jwtVerify(token, jwks, {
        issuer: issuer || undefined,
        audience: audience || undefined,
      });
      return payload;
    } catch {
      return null;
    }
  }
  const secret = getStewardJwtSecret();
  if (!secret) return null;
  try {
    const payload = jwt.verify(token, secret, {
      algorithms: ["HS256"],
    }) as jwt.JwtPayload & JWTPayload;
    return payload;
  } catch {
    return null;
  }
}

export type AuthResult =
  | { ok: true; mode: "apikey"; subject: string }
  | { ok: true; mode: "jwt"; subject: string; claims: JWTPayload }
  | { ok: true; mode: "clerk"; subject: string; claims: JWTPayload }
  | { ok: false };

/**
 * Steward auth: API key (Bearer raw key or x-steward-key), OR Clerk session JWT (verifyToken),
 * OR generic Bearer JWT (JWKS / HS256).
 */
export async function authorizeSteward(req: FastifyRequest): Promise<AuthResult> {
  const keys = parseStewardKeys();
  const bearer = h(req, "authorization");
  if (bearer?.startsWith("Bearer ")) {
    const token = bearer.slice(7).trim();
    if (keys.has(token)) {
      return { ok: true, mode: "apikey", subject: maskKey(token) };
    }
    const clerkPayload = await verifyClerkSessionJwt(token);
    if (clerkPayload && stewardJwtAllowedClerk(clerkPayload)) {
      const sub = String(clerkPayload.sub ?? clerkPayload.email ?? "clerk-user");
      return { ok: true, mode: "clerk", subject: sub, claims: clerkPayload };
    }
    const payload = await verifyStewardJwt(token);
    if (payload && stewardJwtAllowedGeneric(payload)) {
      const sub = String(payload.sub ?? payload.email ?? "jwt-user");
      return { ok: true, mode: "jwt", subject: sub, claims: payload };
    }
    return { ok: false };
  }
  const direct = h(req, HEADER);
  if (direct && keys.has(direct.trim())) {
    return { ok: true, mode: "apikey", subject: maskKey(direct.trim()) };
  }
  return { ok: false };
}

function maskKey(k: string): string {
  if (k.length <= 8) return "***";
  return `${k.slice(0, 4)}…${k.slice(-4)}`;
}

export function getActorSubject(auth: AuthResult): string {
  if (!auth.ok) return "unknown";
  return auth.subject;
}
