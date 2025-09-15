-- User Template Preferences table
CREATE TABLE IF NOT EXISTS hisab."userTemplatePreferences" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "moduleType" TEXT NOT NULL CHECK ("moduleType" IN ('sales', 'purchase', 'payment')),
    "templateId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "userTemplatePreferences_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES hisab."users"("id") ON DELETE CASCADE,
    CONSTRAINT "userTemplatePreferences_companyId_fkey" 
        FOREIGN KEY ("companyId") REFERENCES hisab."companies"("id") ON DELETE CASCADE,
    CONSTRAINT "userTemplatePreferences_templateId_fkey" 
        FOREIGN KEY ("templateId") REFERENCES hisab."invoiceTemplates"("id") ON DELETE CASCADE,
    
    -- Ensure one preference per user, company, and module type
    CONSTRAINT "userTemplatePreferences_unique" 
        UNIQUE ("userId", "companyId", "moduleType")
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "userTemplatePreferences_userId_companyId_idx" 
    ON hisab."userTemplatePreferences"("userId", "companyId");
CREATE INDEX IF NOT EXISTS "userTemplatePreferences_moduleType_idx" 
    ON hisab."userTemplatePreferences"("moduleType");

-- Comments for documentation
COMMENT ON TABLE hisab."userTemplatePreferences" IS 'Stores user default template preferences for each module type';
COMMENT ON COLUMN hisab."userTemplatePreferences"."moduleType" IS 'Type of module: sales, purchase, or payment'; 