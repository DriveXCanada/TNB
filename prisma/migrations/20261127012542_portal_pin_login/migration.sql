-- Client portal: sign in with name + PIN instead of email invitations.
ALTER TABLE "PortalUser" ADD COLUMN "loginName" TEXT;
ALTER TABLE "PortalUser" ADD COLUMN "failedAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PortalUser" ADD COLUMN "lockedUntil" TIMESTAMP(3);

-- Existing logins sign in with their name (lower-case, single spaces). Duplicate names get a short suffix.
UPDATE "PortalUser" SET "loginName" = lower(regexp_replace(trim("name"), '\s+', ' ', 'g'));
UPDATE "PortalUser" p SET "loginName" = p."loginName" || ' ' || substr(p."id", length(p."id") - 3)
WHERE p."id" NOT IN (SELECT min("id") FROM "PortalUser" GROUP BY "loginName");
-- Invited users never set a password by email; staff will set a PIN for them.
ALTER TABLE "PortalUser" ALTER COLUMN "loginName" SET NOT NULL;
CREATE UNIQUE INDEX "PortalUser_loginName_key" ON "PortalUser"("loginName");

DROP INDEX IF EXISTS "PortalUser_email_key";
DROP INDEX IF EXISTS "PortalUser_inviteToken_key";
ALTER TABLE "PortalUser" DROP COLUMN "email";
ALTER TABLE "PortalUser" DROP COLUMN "inviteToken";
ALTER TABLE "PortalUser" DROP COLUMN "inviteExpires";
