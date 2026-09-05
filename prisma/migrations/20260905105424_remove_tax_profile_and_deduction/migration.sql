/*
  Warnings:

  - You are about to drop the `TaxDeduction` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TaxProfile` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "TaxDeduction" DROP CONSTRAINT "TaxDeduction_userId_fkey";

-- DropForeignKey
ALTER TABLE "TaxProfile" DROP CONSTRAINT "TaxProfile_userId_fkey";

-- DropTable
DROP TABLE "TaxDeduction";

-- DropTable
DROP TABLE "TaxProfile";
