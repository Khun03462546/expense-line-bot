/*
  Warnings:

  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "language" TEXT DEFAULT 'th',
ADD COLUMN     "pictureUrl" TEXT,
ADD COLUMN     "timezone" TEXT DEFAULT 'Asia/Bangkok',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
