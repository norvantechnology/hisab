# HISAB - Accounting Management System

A comprehensive accounting and inventory management system with separate backend and frontend applications.

## Project Structure

```
HISAB/
├── hisab/          # Backend API (Node.js/Express)
├── hisab_front/    # Frontend Application (React)
└── README.md       # This file
```

## Backend (hisab/)

The backend is a Node.js/Express API that handles:
- User authentication and authorization
- Company management
- Contact management
- Product and inventory management
- Purchase and sales management
- Payment processing
- Bank account management
- Financial reporting

### Setup Backend

```bash
cd hisab
npm install
npm start
```

The backend will run on `http://localhost:5000`

## Frontend (hisab_front/)

The frontend is a React application that provides:
- Modern, responsive user interface
- Dashboard with analytics
- User management
- Inventory management
- Financial reporting
- Invoice generation

### Setup Frontend

```bash
cd hisab_front
npm install
npm start
```

The frontend will run on `http://localhost:3000`

## Features

- **Multi-company Support**: Manage multiple companies from a single installation
- **User Management**: Role-based access control with permissions
- **Inventory Management**: Track products, serial numbers, and stock levels
- **Financial Management**: Handle purchases, sales, payments, and receipts
- **Bank Integration**: Manage multiple bank accounts and transfers
- **Reporting**: Generate financial reports and analytics
- **Invoice Management**: Create and manage purchase and sales invoices

## Technology Stack

### Backend
- Node.js
- Express.js
- PostgreSQL
- JWT Authentication
- bcrypt for password hashing

### Frontend
- React.js
- Redux Toolkit
- Bootstrap
- Chart.js
- React Router

## Development

This repository contains both backend and frontend code in a monorepo structure. All changes to both applications should be committed to this single repository.

## Contributing

1. Make changes in the appropriate folder (hisab/ or hisab_front/)
2. Test your changes thoroughly
3. Commit with descriptive messages
4. Push to the main branch

## License

This project is proprietary software developed by Norvan Technology. 