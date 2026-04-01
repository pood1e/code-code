-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_ProfileSkill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    CONSTRAINT "ProfileSkill_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProfileSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ProfileSkill" ("id", "order", "profileId", "skillId")
SELECT
    "id",
    ROW_NUMBER() OVER (
        PARTITION BY "profileId"
        ORDER BY "order" ASC, "id" ASC
    ) - 1,
    "profileId",
    "skillId"
FROM "ProfileSkill";
DROP TABLE "ProfileSkill";
ALTER TABLE "new_ProfileSkill" RENAME TO "ProfileSkill";
CREATE UNIQUE INDEX "ProfileSkill_profileId_skillId_key" ON "ProfileSkill"("profileId", "skillId");
CREATE UNIQUE INDEX "ProfileSkill_profileId_order_key" ON "ProfileSkill"("profileId", "order");

CREATE TABLE "new_ProfileMCP" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "mcpId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "configOverride" JSONB,
    CONSTRAINT "ProfileMCP_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProfileMCP_mcpId_fkey" FOREIGN KEY ("mcpId") REFERENCES "MCP" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ProfileMCP" ("configOverride", "id", "mcpId", "order", "profileId")
SELECT
    "configOverride",
    "id",
    "mcpId",
    ROW_NUMBER() OVER (
        PARTITION BY "profileId"
        ORDER BY "order" ASC, "id" ASC
    ) - 1,
    "profileId"
FROM "ProfileMCP";
DROP TABLE "ProfileMCP";
ALTER TABLE "new_ProfileMCP" RENAME TO "ProfileMCP";
CREATE UNIQUE INDEX "ProfileMCP_profileId_mcpId_key" ON "ProfileMCP"("profileId", "mcpId");
CREATE UNIQUE INDEX "ProfileMCP_profileId_order_key" ON "ProfileMCP"("profileId", "order");

CREATE TABLE "new_ProfileRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    CONSTRAINT "ProfileRule_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProfileRule_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "Rule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ProfileRule" ("id", "order", "profileId", "ruleId")
SELECT
    "id",
    ROW_NUMBER() OVER (
        PARTITION BY "profileId"
        ORDER BY "order" ASC, "id" ASC
    ) - 1,
    "profileId",
    "ruleId"
FROM "ProfileRule";
DROP TABLE "ProfileRule";
ALTER TABLE "new_ProfileRule" RENAME TO "ProfileRule";
CREATE UNIQUE INDEX "ProfileRule_profileId_ruleId_key" ON "ProfileRule"("profileId", "ruleId");
CREATE UNIQUE INDEX "ProfileRule_profileId_order_key" ON "ProfileRule"("profileId", "order");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
