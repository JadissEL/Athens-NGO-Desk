-- CreateTable
CREATE TABLE "HospitalityEmployer" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "tradeName" TEXT NOT NULL,
    "employerType" TEXT NOT NULL,
    "region" TEXT,
    "address" TEXT,
    "website" TEXT,
    "contactEmail" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "verificationStatus" TEXT NOT NULL DEFAULT 'pending',
    "afm" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalityEmployer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalityJob" (
    "id" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL,
    "contractType" TEXT,
    "languagesRequired" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "languagesPreferred" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "seasonality" TEXT,
    "payBandText" TEXT,
    "fairHireFlags" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "closesAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalityJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobApplication" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "seekerName" TEXT NOT NULL,
    "seekerEmail" TEXT NOT NULL,
    "seekerPhone" TEXT,
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "workAuthorization" TEXT,
    "residenceRegion" TEXT,
    "coverMessage" TEXT,
    "cvStorageKey" TEXT,
    "gdprConsentAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "clientIp" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HospitalityEmployer_slug_key" ON "HospitalityEmployer"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "HospitalityEmployer_clerkUserId_key" ON "HospitalityEmployer"("clerkUserId");

-- CreateIndex
CREATE INDEX "HospitalityEmployer_verificationStatus_idx" ON "HospitalityEmployer"("verificationStatus");

-- CreateIndex
CREATE INDEX "HospitalityJob_status_publishedAt_idx" ON "HospitalityJob"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "JobApplication_jobId_createdAt_idx" ON "JobApplication"("jobId", "createdAt");

-- AddForeignKey
ALTER TABLE "HospitalityJob" ADD CONSTRAINT "HospitalityJob_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "HospitalityEmployer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "HospitalityJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
