-- DropForeignKey
ALTER TABLE "Account" DROP CONSTRAINT "Account_parentId_fkey";

-- DropForeignKey
ALTER TABLE "BankStatementLine" DROP CONSTRAINT "BankStatementLine_bankAccountId_fkey";

-- DropForeignKey
ALTER TABLE "DirectExpense" DROP CONSTRAINT "DirectExpense_contactId_fkey";

-- DropForeignKey
ALTER TABLE "DirectExpense" DROP CONSTRAINT "DirectExpense_createdById_fkey";

-- DropForeignKey
ALTER TABLE "DirectExpenseLine" DROP CONSTRAINT "DirectExpenseLine_directExpenseId_fkey";

-- DropForeignKey
ALTER TABLE "FixedAssetDepreciation" DROP CONSTRAINT "FixedAssetDepreciation_fixedAssetId_fkey";

-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_createdById_fkey";

-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_paidBankAccountId_fkey";

-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_paidById_fkey";

-- DropForeignKey
ALTER TABLE "InvoiceItemPrice" DROP CONSTRAINT "InvoiceItemPrice_updatedById_fkey";

-- DropForeignKey
ALTER TABLE "InvoiceLine" DROP CONSTRAINT "InvoiceLine_invoiceId_fkey";

-- DropForeignKey
ALTER TABLE "JournalEntry" DROP CONSTRAINT "JournalEntry_createdById_fkey";

-- DropForeignKey
ALTER TABLE "JournalEntry" DROP CONSTRAINT "JournalEntry_reversalOfId_fkey";

-- DropForeignKey
ALTER TABLE "JournalLine" DROP CONSTRAINT "JournalLine_accountId_fkey";

-- DropForeignKey
ALTER TABLE "JournalLine" DROP CONSTRAINT "JournalLine_contactId_fkey";

-- DropForeignKey
ALTER TABLE "JournalLine" DROP CONSTRAINT "JournalLine_journalEntryId_fkey";

-- DropForeignKey
ALTER TABLE "SalesRecordLine" DROP CONSTRAINT "SalesRecordLine_salesRecordId_fkey";

-- DropTable
DROP TABLE "Account";

-- DropTable
DROP TABLE "AccountingNote";

-- DropTable
DROP TABLE "AccountingPeriod";

-- DropTable
DROP TABLE "BankAccount";

-- DropTable
DROP TABLE "BankStatementLine";

-- DropTable
DROP TABLE "Contact";

-- DropTable
DROP TABLE "DirectExpense";

-- DropTable
DROP TABLE "DirectExpenseLine";

-- DropTable
DROP TABLE "FixedAsset";

-- DropTable
DROP TABLE "FixedAssetDepreciation";

-- DropTable
DROP TABLE "Invoice";

-- DropTable
DROP TABLE "InvoiceCounter";

-- DropTable
DROP TABLE "InvoiceItemPrice";

-- DropTable
DROP TABLE "InvoiceLine";

-- DropTable
DROP TABLE "JournalEntry";

-- DropTable
DROP TABLE "JournalLine";

-- DropTable
DROP TABLE "ProductPhoto";

-- DropTable
DROP TABLE "SalesRecord";

-- DropTable
DROP TABLE "SalesRecordLine";

