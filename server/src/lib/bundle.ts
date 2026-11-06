export type NgoDataBundle = {
  registry: unknown;
  possibility: unknown;
  summary: unknown;
  emails: unknown;
  media: unknown;
};

export function assertBundleShape(b: unknown): asserts b is NgoDataBundle {
  if (!b || typeof b !== "object") throw new Error("Bundle must be an object");
  const o = b as Record<string, unknown>;
  for (const k of ["registry", "possibility", "summary", "emails", "media"]) {
    if (!(k in o)) throw new Error(`Missing key: ${k}`);
  }
}
