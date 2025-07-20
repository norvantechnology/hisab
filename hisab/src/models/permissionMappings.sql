CREATE TABLE IF NOT EXISTS hisab."permissionMappings" (
  "id" SERIAL PRIMARY KEY,
  "permissionTypeId" INTEGER NOT NULL REFERENCES hisab."permissionTypes"(id) ON DELETE CASCADE,
  "permissionLevel" VARCHAR(20) NOT NULL,
  "endpoint" VARCHAR(255) NOT NULL,
  "method" VARCHAR(10) NOT NULL,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Permission mappings for access management
INSERT INTO hisab."permissionMappings" ("permissionTypeId", "permissionLevel", "endpoint", "method") VALUES
(3, 'ADMIN', '/api/company/grant', 'POST'),
(3, 'ADMIN', '/api/company/update', 'PUT'),
(3, 'ADMIN', '/api/company/revoke', 'DELETE'),
(3, 'ADMIN', '/api/company/list', 'GET');

-- Permission mappings for bank accounts
INSERT INTO hisab."permissionMappings" ("permissionTypeId", "permissionLevel", "endpoint", "method") VALUES
(1, 'VIEWER', '/api/bankAccount/getBankAccounts', 'GET'),
(2, 'EDITOR', '/api/bankAccount/createBankAccount', 'POST'),
(2, 'EDITOR', '/api/bankAccount/updateBankAccount', 'PUT'),
(2, 'EDITOR', '/api/bankAccount/activateBankAccount', 'POST'),
(2, 'EDITOR', '/api/bankAccount/deactivateBankAccount', 'POST'),
(3, 'ADMIN', '/api/bankAccount/deleteBankAccount', 'DELETE');

-- Permission mappings for company
INSERT INTO hisab."permissionMappings" ("permissionTypeId", "permissionLevel", "endpoint", "method") VALUES
(3, 'ADMIN', '/api/company/createCompany', 'POST');

-- Permission mappings for expenses
INSERT INTO hisab."permissionMappings" ("permissionTypeId", "permissionLevel", "endpoint", "method") VALUES
(1, 'VIEWER', '/api/expense/getExpenseCategories', 'GET'),
(1, 'VIEWER', '/api/expense/getExpenses', 'GET'),
(2, 'EDITOR', '/api/expense/createExpenseCategory', 'POST'),
(2, 'EDITOR', '/api/expense/createExpense', 'POST'),
(2, 'EDITOR', '/api/expense/updateExpense', 'PUT'),
(3, 'ADMIN', '/api/expense/deleteExpenseCategory', 'DELETE'),
(3, 'ADMIN', '/api/expense/deleteExpense', 'DELETE');

-- Permission mappings for incomes
INSERT INTO hisab."permissionMappings" ("permissionTypeId", "permissionLevel", "endpoint", "method") VALUES
(1, 'VIEWER', '/api/incomes/getIncomeCategories', 'GET'),
(1, 'VIEWER', '/api/incomes/getIncomes', 'GET'),
(2, 'EDITOR', '/api/incomes/createIncomeCategory', 'POST'),
(2, 'EDITOR', '/api/incomes/createIncome', 'POST'),
(2, 'EDITOR', '/api/incomes/updateIncome', 'PUT'),
(3, 'ADMIN', '/api/incomes/deleteIncomeCategory', 'DELETE'),
(3, 'ADMIN', '/api/incomes/deleteIncome', 'DELETE');