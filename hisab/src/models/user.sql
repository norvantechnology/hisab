CREATE TABLE IF NOT EXISTS hisab."users" (
    "id" SERIAL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT UNIQUE NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT DEFAULT 'user',
    "isActive" BOOLEAN DEFAULT TRUE,
    "isVerified" BOOLEAN DEFAULT FALSE,
    "verificationToken" TEXT,
    "verificationTokenExpiry" TIMESTAMP,
    "passwordResetToken" TEXT,
    "passwordResetExpiry" TIMESTAMP,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
