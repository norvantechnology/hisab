import React, { useState, useEffect, useCallback } from 'react';
import ReactSelect from 'react-select';
import { RiBankLine } from 'react-icons/ri';
import { ACCOUNT_TYPES } from '../BankAccounts';
import { getBankAccounts } from '../../services/bankAccount';

const BankAccountDropdown = ({
  value,
  onChange,
  onBlur,
  disabled = false,
  placeholder = "Select Bank Account...",
  error = null,
  touched = false,
  className = "",
  classNamePrefix = "react-select"
}) => {
  
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch bank accounts
  const fetchBankAccounts = useCallback(async (search = '') => {
    setLoading(true);
    try {
      const response = await getBankAccounts({ search });
      setBankAccounts(response.accounts || []);
    } catch (error) {
      console.error('Error fetching bank accounts:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchBankAccounts();
  }, [fetchBankAccounts]);

  // Handle search
  const handleSearch = useCallback((searchTerm) => {
    fetchBankAccounts(searchTerm);
  }, [fetchBankAccounts]);

  // Helper function to get account icon
  const getAccountIcon = (accountType) => {
    const accountTypeInfo = ACCOUNT_TYPES[accountType] || ACCOUNT_TYPES.bank;
    return accountTypeInfo.icon;
  };

  // Get current value
  const getCurrentValue = () => {
    if (!value) return null;
    
    const account = bankAccounts.find(a => String(a.id) === String(value));
    return account ? {
      value: account.id,
      label: account.accountName,
      account: account
    } : null;
  };

  const options = bankAccounts.map(account => ({
    value: account.id,
    label: account.accountName,
    account: account
  }));

  return (
    <ReactSelect
      options={options}
      value={getCurrentValue()}
      onChange={onChange}
      onBlur={onBlur}
      isDisabled={disabled}
      isLoading={loading}
      className={`react-select-container ${className} ${touched && error ? 'is-invalid' : ''}`}
      classNamePrefix={classNamePrefix}
      placeholder={placeholder}
      onInputChange={handleSearch}
      formatOptionLabel={(option) => {
        const account = option.account;
        const accountType = ACCOUNT_TYPES[account.accountType] || ACCOUNT_TYPES.bank;
        return (
          <div className="d-flex align-items-center">
            <span className={`text-${accountType.color} me-2`}>
              {getAccountIcon(account.accountType)}
            </span>
            <span>
              {account.accountName}
              {!account.isActive && <span className="text-muted"> (Inactive)</span>}
            </span>
          </div>
        );
      }}
    />
  );
};

export default BankAccountDropdown; 