ALTER TABLE "Project"
RENAME COLUMN "gitUrl" TO "repoGitUrl";

ALTER TABLE "Project"
RENAME COLUMN "docSource" TO "docGitUrl";

ALTER TABLE "Project"
ADD COLUMN "repoLocalPath" TEXT;

UPDATE "Project"
SET "repoLocalPath" = "workspaceRootPath"
WHERE "repoLocalPath" IS NULL;

CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "repoGitUrl" TEXT NOT NULL,
    "repoLocalPath" TEXT NOT NULL,
    "workspaceRootPath" TEXT NOT NULL,
    "docGitUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "new_Project" (
    "id",
    "name",
    "description",
    "repoGitUrl",
    "repoLocalPath",
    "workspaceRootPath",
    "docGitUrl",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "name",
    "description",
    "repoGitUrl",
    "repoLocalPath",
    "workspaceRootPath",
    "docGitUrl",
    "createdAt",
    "updatedAt"
FROM "Project";

DROP TABLE "Project";

ALTER TABLE "new_Project"
RENAME TO "Project";
