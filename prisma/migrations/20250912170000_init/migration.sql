-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrgSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "emailFromName" TEXT NOT NULL DEFAULT 'Advanced Mobile Filtration Services',
    "emailFromAddress" TEXT NOT NULL DEFAULT 'info@amfsfiltration.com',
    "emailPhone" TEXT NOT NULL DEFAULT '(800) 484-4590',
    "emailSignoff" TEXT NOT NULL DEFAULT 'AMFS Filtration',
    "solutionUrl" TEXT NOT NULL DEFAULT 'https://amfsfiltration.com/technology/',
    "companyUrl" TEXT NOT NULL DEFAULT 'https://amfsfiltration.com/',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OrgSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
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
    "latitude" REAL,
    "longitude" REAL,
    "summary" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "contaminantClass" TEXT,
    "violationType" TEXT,
    "fineAmount" REAL,
    "contractType" TEXT,
    "estimatedValue" REAL,
    "sourceRecordUrl" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "registryId" TEXT,
    "permitId" TEXT,
    "detectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventDate" DATETIME,
    "emailSubject" TEXT NOT NULL DEFAULT '',
    "emailBody" TEXT NOT NULL DEFAULT '',
    "emailTo" TEXT,
    "emailSentAt" DATETIME,
    "unread" BOOLEAN NOT NULL DEFAULT true,
    "forecastWindow" TEXT,
    "primeContractor" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "complianceHistory" TEXT,
    "flowMgd" REAL,
    "badgesJson" TEXT NOT NULL DEFAULT '[]',
    "metadataJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Lead_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Notification_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BidComparable" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "recipient" TEXT,
    "agency" TEXT,
    "awardAmount" REAL NOT NULL,
    "awardedAt" DATETIME,
    "naics" TEXT,
    "state" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "keywords" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BidComparable_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SourceRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "recordsFound" INTEGER NOT NULL DEFAULT 0,
    "recordsCreated" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    CONSTRAINT "SourceRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
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
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FacilitySnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
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

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "OrgSettings_organizationId_key" ON "OrgSettings"("organizationId");

-- CreateIndex
CREATE INDEX "Lead_organizationId_detectedAt_idx" ON "Lead"("organizationId", "detectedAt");

-- CreateIndex
CREATE INDEX "Lead_organizationId_status_idx" ON "Lead"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Lead_organizationId_score_idx" ON "Lead"("organizationId", "score");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_organizationId_source_sourceRecordId_key" ON "Lead"("organizationId", "source", "sourceRecordId");

-- CreateIndex
CREATE INDEX "Notification_organizationId_readAt_idx" ON "Notification"("organizationId", "readAt");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BidComparable_organizationId_sourceRecordId_key" ON "BidComparable"("organizationId", "sourceRecordId");

-- CreateIndex
CREATE INDEX "SourceRun_organizationId_source_startedAt_idx" ON "SourceRun"("organizationId", "source", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FacilitySnapshot_organizationId_registryId_contaminantClass_periodKey_key" ON "FacilitySnapshot"("organizationId", "registryId", "contaminantClass", "periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "PfasSite_organizationId_name_state_key" ON "PfasSite"("organizationId", "name", "state");

