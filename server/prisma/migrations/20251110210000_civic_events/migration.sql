-- CreateTable
CREATE TABLE "CivicEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Athens',
    "location" TEXT,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "registryOrgId" TEXT,
    "hostOrgIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "externalKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "scrapeMeta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CivicEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventScrapeSource" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "registryOrgId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventScrapeSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventScrapeRun" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "found" INTEGER NOT NULL DEFAULT 0,
    "inserted" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,

    CONSTRAINT "EventScrapeRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgMember" (
    "id" TEXT NOT NULL,
    "registryOrgId" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'contact',
    "assignedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventThread" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "createdByOrgId" TEXT NOT NULL,
    "createdByClerkUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventThreadParticipant" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "registryOrgId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventThreadParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventThreadMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "authorOrgId" TEXT NOT NULL,
    "authorClerkUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "EventThreadMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CivicEvent_source_externalKey_key" ON "CivicEvent"("source", "externalKey");

-- CreateIndex
CREATE INDEX "CivicEvent_status_startsAt_idx" ON "CivicEvent"("status", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrgMember_registryOrgId_clerkUserId_key" ON "OrgMember"("registryOrgId", "clerkUserId");

-- CreateIndex
CREATE INDEX "OrgMember_clerkUserId_idx" ON "OrgMember"("clerkUserId");

-- CreateIndex
CREATE UNIQUE INDEX "EventThreadParticipant_threadId_registryOrgId_key" ON "EventThreadParticipant"("threadId", "registryOrgId");

-- CreateIndex
CREATE INDEX "EventThreadMessage_threadId_createdAt_idx" ON "EventThreadMessage"("threadId", "createdAt");

-- AddForeignKey
ALTER TABLE "EventScrapeRun" ADD CONSTRAINT "EventScrapeRun_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "EventScrapeSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventThread" ADD CONSTRAINT "EventThread_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CivicEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventThreadParticipant" ADD CONSTRAINT "EventThreadParticipant_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "EventThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventThreadMessage" ADD CONSTRAINT "EventThreadMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "EventThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
