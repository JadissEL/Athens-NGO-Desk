import { z } from "zod";

/** Desk dashboard personas — preference only, not permissions. */
export const DASHBOARD_TYPES = [
  "jobseeker",
  "employer",
  "ngo_member",
  "funder",
  "donor",
  "steward",
] as const;

export type DashboardType = (typeof DASHBOARD_TYPES)[number];

export const setDashboardTypeBody = z.object({
  dashboardType: z.enum(DASHBOARD_TYPES),
});
