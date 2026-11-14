/**
 * Insert organization records that exist in data/ngos and are absent from a
 * published (or draft) bundle. Existing ids are left untouched, including
 * steward edits. Organizations that exist only in the bundle are kept.
 */

export type JsonObject = Record<string, unknown>;

export type NgoBundle = {
  registry: unknown;
  possibility: unknown;
  summary: unknown;
  emails: unknown;
  media: unknown;
};

export type UpsertPlan = {
  bundle: NgoBundle;
  addedIds: string[];
};

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readId(value: unknown, field: string): string | null {
  if (!isObject(value)) return null;
  const id = value[field];
  return typeof id === "string" && id.length > 0 ? id : null;
}

function appendMissing(
  existingList: unknown[],
  incomingList: unknown[],
  idField: string,
  onlyIds: Set<string> | null
): { list: unknown[]; addedIds: string[] } {
  const list = existingList.slice();
  const seen = new Set<string>();
  for (const item of list) {
    const id = readId(item, idField);
    if (id) seen.add(id);
  }
  const addedIds: string[] = [];
  for (const item of incomingList) {
    const id = readId(item, idField);
    if (!id || seen.has(id)) continue;
    if (onlyIds && !onlyIds.has(id)) continue;
    list.push(structuredClone(item));
    seen.add(id);
    addedIds.push(id);
  }
  return { list, addedIds };
}

function mergeListField(
  existing: unknown,
  source: unknown,
  listKey: string,
  idField: string,
  allow: Set<string>
): unknown {
  if (!isObject(source) || !Array.isArray(source[listKey])) return existing;
  if (!isObject(existing)) return existing;
  const current = existing[listKey];
  if (current !== undefined && !Array.isArray(current)) {
    throw new Error(`Existing ${listKey} is not an array; refusing to change the bundle`);
  }
  const merged = appendMissing(
    Array.isArray(current) ? current : [],
    source[listKey] as unknown[],
    idField,
    allow
  );
  if (merged.addedIds.length === 0) return existing;
  return { ...existing, [listKey]: merged.list };
}

/**
 * Plan an insert-only merge. When nothing is missing, `bundle` is `existing`
 * unchanged. Media is never rewritten.
 */
export function planBundleUpsert(existing: NgoBundle, source: NgoBundle): UpsertPlan {
  if (!isObject(existing.registry) || !Array.isArray(existing.registry.organizations)) {
    throw new Error(
      "Existing registry.organizations must be an array; refusing to change the bundle"
    );
  }
  if (!isObject(source.registry) || !Array.isArray(source.registry.organizations)) {
    throw new Error("Source registry.organizations must be an array");
  }

  const regMerge = appendMissing(
    existing.registry.organizations,
    source.registry.organizations,
    "id",
    null
  );

  if (regMerge.addedIds.length === 0) {
    return { bundle: existing, addedIds: [] };
  }

  const allow = new Set(regMerge.addedIds);
  const meta = isObject(existing.registry.meta)
    ? { ...existing.registry.meta, count: regMerge.list.length }
    : existing.registry.meta;

  const registry: JsonObject = {
    ...existing.registry,
    meta,
    organizations: regMerge.list,
  };

  return {
    bundle: {
      registry,
      possibility: mergeListField(
        existing.possibility,
        source.possibility,
        "organizations",
        "id",
        allow
      ),
      summary: mergeListField(existing.summary, source.summary, "researched", "id", allow),
      emails: mergeListField(existing.emails, source.emails, "contacts", "orgId", allow),
      media: existing.media,
    },
    addedIds: regMerge.addedIds,
  };
}
