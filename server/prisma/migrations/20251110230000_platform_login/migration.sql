-- Platform login: dashboard preference per Clerk user (no RBAC).
CREATE TABLE "PlatformUserPreference" (
    "clerkUserId" TEXT NOT NULL,
    "dashboardType" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformUserPreference_pkey" PRIMARY KEY ("clerkUserId")
);
