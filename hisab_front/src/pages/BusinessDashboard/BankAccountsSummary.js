import React from 'react';
import { Card, CardBody, CardHeader, Badge, Progress } from 'reactstrap';

const BankAccountsSummary = ({ accounts, formatCurrency }) => {
    if (!accounts || accounts.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <h5 className="card-title mb-0">
                        <i className="ri-bank-line text-primary me-2"></i>
                        Bank Accounts
                    </h5>
                </CardHeader>
                <CardBody>
                    <div className="text-center py-4">
                        <i className="ri-bank-line text-muted mb-3" style={{ fontSize: '2rem' }}></i>
                        <h6 className="text-muted">No bank accounts found</h6>
                        <p className="text-muted mb-0 fs-12">Add bank accounts to track balances</p>
                    </div>
                </CardBody>
            </Card>
        );
    }

    const totalBalance = accounts.reduce((sum, account) => sum + parseFloat(account.currentBalance || 0), 0);
    const maxBalance = Math.max(...accounts.map(account => parseFloat(account.currentBalance || 0)));

    return (
        <Card>
            <CardHeader>
                <h5 className="card-title mb-0">
                    <i className="ri-bank-line text-primary me-2"></i>
                    Bank Accounts
                </h5>
                <p className="text-muted mb-0">Account balances overview</p>
            </CardHeader>
            <CardBody>
                <div className="mb-3">
                    <div className="d-flex align-items-center justify-content-between">
                        <h6 className="text-muted mb-0">Total Balance</h6>
                        <h4 className={`mb-0 ${totalBalance >= 0 ? 'text-success' : 'text-danger'}`}>
                            {formatCurrency(totalBalance)}
                        </h4>
                    </div>
                </div>

                <div className="vstack gap-3">
                    {accounts.map((account, index) => {
                        const balance = parseFloat(account.currentBalance || 0);
                        const percentage = maxBalance > 0 ? Math.abs((balance / maxBalance) * 100) : 0;
                        
                        return (
                            <div key={account.id} className="d-flex align-items-center">
                                <div className="flex-shrink-0 me-3">
                                    <div className={`avatar-xs rounded-circle bg-${
                                        account.accountType === 'bank' ? 'primary' : 
                                        account.accountType === 'cash' ? 'success' :
                                        account.accountType === 'credit_card' ? 'warning' : 'info'
                                    }-subtle d-flex align-items-center justify-content-center`}>
                                        <i className={`${
                                            account.accountType === 'bank' ? 'ri-bank-line' : 
                                            account.accountType === 'cash' ? 'ri-money-dollar-box-line' :
                                            account.accountType === 'credit_card' ? 'ri-bank-card-line' : 'ri-wallet-line'
                                        } text-${
                                            account.accountType === 'bank' ? 'primary' : 
                                            account.accountType === 'cash' ? 'success' :
                                            account.accountType === 'credit_card' ? 'warning' : 'info'
                                        }`}></i>
                                    </div>
                                </div>
                                <div className="flex-grow-1">
                                    <div className="d-flex align-items-center justify-content-between mb-1">
                                        <h6 className="mb-0 fs-13">{account.accountName}</h6>
                                        <span className={`fw-semibold ${balance >= 0 ? 'text-success' : 'text-danger'}`}>
                                            {formatCurrency(balance)}
                                        </span>
                                    </div>
                                    <div className="d-flex align-items-center justify-content-between">
                                        <Badge 
                                            color={account.accountType === 'bank' ? 'primary' : 
                                                   account.accountType === 'cash' ? 'success' :
                                                   account.accountType === 'credit_card' ? 'warning' : 'info'} 
                                            className="badge-soft fs-10"
                                        >
                                            {account.accountType.replace('_', ' ').toUpperCase()}
                                        </Badge>
                                        <Badge 
                                            color={account.isActive ? 'success' : 'secondary'} 
                                            className="badge-soft fs-10"
                                        >
                                            {account.isActive ? 'Active' : 'Inactive'}
                                        </Badge>
                                    </div>
                                    {maxBalance > 0 && (
                                        <Progress 
                                            value={percentage} 
                                            color={balance >= 0 ? 'success' : 'danger'}
                                            className="mt-2"
                                            style={{ height: '4px' }}
                                        />
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardBody>
        </Card>
    );
};

export default BankAccountsSummary; 