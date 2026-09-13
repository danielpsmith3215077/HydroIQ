-- Run once in Supabase → SQL Editor → New query → Paste → Run
-- Creates HydroIQ schema + marks Prisma migration as applied.

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "OrgSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "emailFromName" TEXT NOT NULL DEFAULT 'Advanced Mobile Filtration Services',
    "emailFromAddress" TEXT NOT NULL DEFAULT 'info@amfsfiltration.com',
    "emailPhone" TEXT NOT NULL DEFAULT '(800) 484-4590',
    "emailSignoff" TEXT NOT NULL DEFAULT 'AMFS Filtration',
    "solutionUrl" TEXT NOT NULL DEFAULT 'https://amfsfiltration.com/technology/',
    "companyUrl" TEXT NOT NULL DEFAULT 'https://amfsfiltration.com/',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrgSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Lead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "variant" TEXT NOT NULL DEFAULT 'live_violation',
    "status" TEXT NOT NULL DEFAULT 'new',
    "facilityName" TEXT NOT NULL,
    "city" TEXT,
    "county" TEXT,
    "state" TEXT NOT NULL,
    "address" TEXT,
    "zip" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "summary" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "contaminantClass" TEXT,
    "violationType" TEXT,
    "fineAmount" DOUBLE PRECISION,
    "contractType" TEXT,
    "estimatedValue" DOUBLE PRECISION,
    "sourceRecordUrl" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "registryId" TEXT,
    "permitId" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventDate" TIMESTAMP(3),
    "emailSubject" TEXT NOT NULL DEFAULT '',
    "emailBody" TEXT NOT NULL DEFAULT '',
    "emailTo" TEXT,
    "emailSentAt" TIMESTAMP(3),
    "unread" BOOLEAN NOT NULL DEFAULT true,
    "forecastWindow" TEXT,
    "primeContractor" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "complianceHistory" TEXT,
    "flowMgd" DOUBLE PRECISION,
    "badgesJson" TEXT NOT NULL DEFAULT '[]',
    "metadataJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Lead_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Notification_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "BidComparable" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "recipient" TEXT,
    "agency" TEXT,
    "awardAmount" DOUBLE PRECISION NOT NULL,
    "awardedAt" TIMESTAMP(3),
    "naics" TEXT,
    "state" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "keywords" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BidComparable_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "SourceRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "recordsFound" INTEGER NOT NULL DEFAULT 0,
    "recordsCreated" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "SourceRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "FacilitySnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "registryId" TEXT NOT NULL,
    "facilityName" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "contaminantClass" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "violationCount" INTEGER NOT NULL DEFAULT 1,
    "source" TEXT NOT NULL,
    "sourceRecordUrl" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FacilitySnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "PfasSite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT NOT NULL,
    "branch" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "notes" TEXT,
    CONSTRAINT "PfasSite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "OrgSettings_organizationId_key" ON "OrgSettings"("organizationId");
CREATE INDEX "Lead_organizationId_detectedAt_idx" ON "Lead"("organizationId", "detectedAt");
CREATE INDEX "Lead_organizationId_status_idx" ON "Lead"("organizationId", "status");
CREATE INDEX "Lead_organizationId_score_idx" ON "Lead"("organizationId", "score");
CREATE UNIQUE INDEX "Lead_organizationId_source_sourceRecordId_key" ON "Lead"("organizationId", "source", "sourceRecordId");
CREATE INDEX "Notification_organizationId_readAt_idx" ON "Notification"("organizationId", "readAt");
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");
CREATE UNIQUE INDEX "BidComparable_organizationId_sourceRecordId_key" ON "BidComparable"("organizationId", "sourceRecordId");
CREATE INDEX "SourceRun_organizationId_source_startedAt_idx" ON "SourceRun"("organizationId", "source", "startedAt");
CREATE UNIQUE INDEX "FacilitySnapshot_organizationId_registryId_contaminantClass_periodKey_key" ON "FacilitySnapshot"("organizationId", "registryId", "contaminantClass", "periodKey");
CREATE UNIQUE INDEX "PfasSite_organizationId_name_state_key" ON "PfasSite"("organizationId", "name", "state");

CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id" VARCHAR(36) NOT NULL PRIMARY KEY,
    "checksum" VARCHAR(64) NOT NULL,
    "finished_at" TIMESTAMPTZ,
    "migration_name" VARCHAR(255) NOT NULL,
    "logs" TEXT,
    "rolled_back_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0
);

INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "applied_steps_count")
VALUES (
  gen_random_uuid()::text,
  'manual_supabase_init',
  now(),
  '20250912170000_init',
  1
);
