-- Invoice Templates table
CREATE TABLE IF NOT EXISTS hisab."invoiceTemplates" (
    "id" SERIAL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "moduleType" TEXT NOT NULL CHECK ("moduleType" IN ('sales', 'purchase', 'payment')),
    "htmlTemplate" TEXT NOT NULL, -- HTML content with placeholders like {{companyName}}, {{invoiceNumber}}, etc.
    "thumbnailUrl" TEXT, -- URL to template preview image
    "isDefault" BOOLEAN DEFAULT FALSE,
    "isActive" BOOLEAN DEFAULT TRUE,
    "createdBy" INTEGER,
    "companyId" INTEGER, -- NULL for global templates, specific company ID for company-specific templates
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP NULL,
    
    CONSTRAINT "invoiceTemplates_createdBy_fkey" 
        FOREIGN KEY ("createdBy") REFERENCES hisab."users"("id") ON DELETE SET NULL,
    CONSTRAINT "invoiceTemplates_companyId_fkey" 
        FOREIGN KEY ("companyId") REFERENCES hisab."companies"("id") ON DELETE CASCADE
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS "invoiceTemplates_moduleType_idx" ON hisab."invoiceTemplates"("moduleType");
CREATE INDEX IF NOT EXISTS "invoiceTemplates_companyId_idx" ON hisab."invoiceTemplates"("companyId");
CREATE INDEX IF NOT EXISTS "invoiceTemplates_isActive_idx" ON hisab."invoiceTemplates"("isActive");

-- Comments for documentation
COMMENT ON TABLE hisab."invoiceTemplates" IS 'Stores HTML templates for invoice generation across different modules';
COMMENT ON COLUMN hisab."invoiceTemplates"."moduleType" IS 'Type of module: sales, purchase, or payment';
COMMENT ON COLUMN hisab."invoiceTemplates"."htmlTemplate" IS 'HTML content with placeholders like {{companyName}}, {{invoiceNumber}}';
COMMENT ON COLUMN hisab."invoiceTemplates"."companyId" IS 'NULL for global templates, specific company ID for company-specific templates'; 