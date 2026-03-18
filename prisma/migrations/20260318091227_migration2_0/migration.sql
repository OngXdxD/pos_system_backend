/*
  Warnings:

  - The primary key for the `employee_passcodes` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `user_passcodes` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[employeeId]` on the table `employee_passcodes` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId]` on the table `user_passcodes` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "auth_login_attempts_identifier_createdAt_idx";

-- AlterTable
ALTER TABLE "employee_passcodes" DROP CONSTRAINT "employee_passcodes_pkey";

-- AlterTable
ALTER TABLE "user_passcodes" DROP CONSTRAINT "user_passcodes_pkey";

-- CreateIndex
CREATE UNIQUE INDEX "employee_passcodes_employeeId_key" ON "employee_passcodes"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "user_passcodes_userId_key" ON "user_passcodes"("userId");
