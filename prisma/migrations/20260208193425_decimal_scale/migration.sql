/*
  Warnings:

  - You are about to alter the column `balance` on the `User` table. The data in that column could be lost. The data in that column will be cast from `Decimal` to `Decimal(64,2)`.

*/
-- AlterTable
ALTER TABLE "User" ALTER COLUMN "balance" SET DATA TYPE DECIMAL(64,2);
