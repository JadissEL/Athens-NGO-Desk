import { z } from "zod";

export const employerRegisterSchema = z.object({
  legalName: z.string().trim().min(2).max(200),
  tradeName: z.string().trim().min(2).max(200),
  employerType: z.enum([
    "hotel",
    "tour_operator",
    "restaurant_group",
    "cruise",
    "other",
  ]),
  region: z.string().trim().max(120).optional(),
  address: z.string().trim().max(300).optional(),
  website: z.string().trim().url().optional().or(z.literal("")),
  contactEmail: z.string().trim().email(),
  afm: z.string().trim().max(20).optional(),
});

export const jobUpsertSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(20000).optional(),
  location: z.string().trim().min(2).max(200),
  contractType: z.string().trim().max(80).optional(),
  languagesRequired: z.array(z.string().trim().max(40)).optional(),
  languagesPreferred: z.array(z.string().trim().max(40)).optional(),
  seasonality: z.string().trim().max(120).optional(),
  payBandText: z.string().trim().max(120).optional(),
  fairHireFlags: z
    .object({
      trainingProvided: z.boolean().optional(),
      noExperienceRequired: z.boolean().optional(),
    })
    .optional(),
  status: z.enum(["draft", "published", "closed"]).optional(),
  closesAt: z.string().datetime().optional().nullable(),
});

export const applicationSchema = z.object({
  jobId: z.string().trim().min(1),
  seekerName: z.string().trim().min(2).max(160),
  seekerEmail: z.string().trim().email(),
  seekerPhone: z.string().trim().max(40).optional(),
  languages: z.array(z.string().trim().max(40)).optional(),
  workAuthorization: z.string().trim().max(200).optional(),
  residenceRegion: z.string().trim().max(120).optional(),
  coverMessage: z.string().trim().max(8000).optional(),
  cvStorageKey: z.string().trim().max(200).optional(),
  gdprConsent: z.literal(true),
});

export const applicationStatusSchema = z.object({
  status: z.enum(["submitted", "viewed", "shortlisted", "rejected"]),
});

export const stewardVerificationSchema = z.object({
  verificationStatus: z.enum(["pending", "verified", "suspended"]),
});

export function slugifyTradeName(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "employer";
}
