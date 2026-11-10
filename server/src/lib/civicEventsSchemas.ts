import { z } from "zod";

export const stewardEventSchema = z.object({
  title: z.string().trim().min(2).max(300),
  description: z.string().trim().max(30000).optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional().nullable(),
  timezone: z.string().trim().max(64).optional(),
  location: z.string().trim().max(300).optional(),
  isOnline: z.boolean().optional(),
  registryOrgId: z.string().trim().optional().nullable(),
  hostOrgIds: z.array(z.string().trim()).optional(),
  tags: z.array(z.string().trim().max(40)).optional(),
  sourceUrl: z.string().url().optional().or(z.literal("")),
  status: z.enum(["draft", "pending_review", "published", "cancelled", "rejected"]).optional(),
});

export const eventReviewSchema = z.object({
  action: z.enum(["publish", "reject", "merge"]),
  mergeIntoId: z.string().optional(),
});

export const scrapeSourceSchema = z.object({
  type: z.enum(["ics", "rss", "html_list", "eventbrite", "facebook", "public_calendar", "other"]),
  url: z.string().url(),
  registryOrgId: z.string().trim().optional().nullable(),
  enabled: z.boolean().optional(),
});

export const orgMemberSchema = z.object({
  registryOrgId: z.string().trim().min(1),
  clerkUserId: z.string().trim().min(1),
  role: z.enum(["contact", "admin"]).optional(),
});

export const threadCreateSchema = z.object({
  subject: z.string().trim().min(2).max(200),
  registryOrgId: z.string().trim().min(1),
  inviteOrgIds: z.array(z.string().trim()).optional(),
});

export const threadMessageSchema = z.object({
  registryOrgId: z.string().trim().min(1),
  body: z.string().trim().min(1).max(8000),
});
