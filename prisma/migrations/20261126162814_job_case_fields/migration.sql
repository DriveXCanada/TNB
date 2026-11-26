-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "courtCounty" TEXT,
ADD COLUMN     "courtDate" TIMESTAMP(3),
ADD COLUMN     "dateFiled" TIMESTAMP(3),
ADD COLUMN     "defendant" TEXT,
ADD COLUMN     "plaintiff" TEXT,
ADD COLUMN     "recipientEmail" TEXT,
ADD COLUMN     "recipientPhone" TEXT;
