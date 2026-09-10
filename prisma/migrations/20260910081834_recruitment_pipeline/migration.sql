-- DropForeignKey
ALTER TABLE "Candidate" DROP CONSTRAINT "Candidate_createdById_fkey";

-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN     "address" TEXT,
ADD COLUMN     "birthDate" TIMESTAMP(3),
ADD COLUMN     "birthPlace" TEXT,
ADD COLUMN     "expectedSalary" INTEGER,
ADD COLUMN     "experience" TEXT,
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "institution" TEXT,
ADD COLUMN     "lastEducation" TEXT,
ADD COLUMN     "preferredOutlet" TEXT,
ADD COLUMN     "publicToken" TEXT NOT NULL,
ALTER COLUMN "createdById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "JobPosting" ADD COLUMN     "positionId" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "Position" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "passingScore" INTEGER NOT NULL DEFAULT 70,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PsychTestQuestion" (
    "id" SERIAL NOT NULL,
    "positionId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PsychTestQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PsychTestOption" (
    "id" SERIAL NOT NULL,
    "questionId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PsychTestOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PsychTestSubmission" (
    "id" SERIAL NOT NULL,
    "candidateId" INTEGER NOT NULL,
    "totalScore" INTEGER NOT NULL,
    "maxScore" INTEGER NOT NULL,
    "percentage" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PsychTestSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PsychTestAnswer" (
    "id" SERIAL NOT NULL,
    "submissionId" INTEGER NOT NULL,
    "questionId" INTEGER NOT NULL,
    "optionId" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,

    CONSTRAINT "PsychTestAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewSlot" (
    "id" SERIAL NOT NULL,
    "candidateId" INTEGER NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Position_name_key" ON "Position"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PsychTestSubmission_candidateId_key" ON "PsychTestSubmission"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewSlot_candidateId_key" ON "InterviewSlot"("candidateId");

-- CreateIndex
CREATE INDEX "InterviewSlot_scheduledAt_idx" ON "InterviewSlot"("scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_publicToken_key" ON "Candidate"("publicToken");

-- AddForeignKey
ALTER TABLE "PsychTestQuestion" ADD CONSTRAINT "PsychTestQuestion_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PsychTestOption" ADD CONSTRAINT "PsychTestOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "PsychTestQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPosting" ADD CONSTRAINT "JobPosting_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "HrUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PsychTestSubmission" ADD CONSTRAINT "PsychTestSubmission_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PsychTestAnswer" ADD CONSTRAINT "PsychTestAnswer_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "PsychTestSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PsychTestAnswer" ADD CONSTRAINT "PsychTestAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "PsychTestQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PsychTestAnswer" ADD CONSTRAINT "PsychTestAnswer_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "PsychTestOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewSlot" ADD CONSTRAINT "InterviewSlot_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

