export type NormalizedEvent = {
  title: string;
  description?: string;
  startsAt: Date;
  endsAt?: Date;
  location?: string;
  isOnline?: boolean;
  sourceUrl?: string;
  externalKey: string;
  registryOrgId?: string | null;
  scrapeMeta?: Record<string, unknown>;
};

export type ScrapeAdapter = {
  type: string;
  fetch: (url: string, registryOrgId?: string | null) => Promise<NormalizedEvent[]>;
};
