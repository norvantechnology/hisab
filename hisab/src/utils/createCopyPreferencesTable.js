import pool from '../config/dbConnection.js';

export const createCopyPreferencesTable = async () => {
  const client = await pool.connect();
  
  try {
    const sql = `
      -- User Copy Preferences table
      CREATE TABLE IF NOT EXISTS hisab."userCopyPreferences" (
          "id" SERIAL PRIMARY KEY,
          "userId" INTEGER NOT NULL,
          "companyId" INTEGER NOT NULL,
          "moduleType" TEXT NOT NULL CHECK ("moduleType" IN ('sales', 'purchase', 'payment')),
          "defaultCopies" INTEGER NOT NULL CHECK ("defaultCopies" IN (1, 2, 4)) DEFAULT 2,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          
          CONSTRAINT "userCopyPreferences_userId_fkey" 
              FOREIGN KEY ("userId") REFERENCES hisab."users"("id") ON DELETE CASCADE,
          CONSTRAINT "userCopyPreferences_companyId_fkey" 
              FOREIGN KEY ("companyId") REFERENCES hisab."companies"("id") ON DELETE CASCADE,
          
          -- Ensure one preference per user, company, and module type
          CONSTRAINT "userCopyPreferences_unique" 
              UNIQUE ("userId", "companyId", "moduleType")
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS "userCopyPreferences_userId_companyId_idx" 
          ON hisab."userCopyPreferences"("userId", "companyId");
      CREATE INDEX IF NOT EXISTS "userCopyPreferences_moduleType_idx" 
          ON hisab."userCopyPreferences"("moduleType");
    `;
    
    await client.query(sql);
    // userCopyPreferences table created/verified successfully
    
  } catch (error) {
    console.error('❌ Error creating userCopyPreferences table:', error);
  } finally {
    client.release();
  }
}; 