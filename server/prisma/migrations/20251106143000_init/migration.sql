-- CreateTable
CREATE TABLE "DraftBundle" (
    "id" INTEGER NOT NULL,
    "registry" JSONB NOT NULL,
    "possibility" JSONB NOT NULL,
    "summary" JSONB NOT NULL,
    "emails" JSONB NOT NULL,
    "media" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DraftBundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishedBundle" (
    "id" INTEGER NOT NULL,
    "registry" JSONB NOT NULL,
    "possibility" JSONB NOT NULL,
    "summary" JSONB NOT NULL,
    "emails" JSONB NOT NULL,
    "media" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublishedBundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorKey" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "detail" JSONB,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
