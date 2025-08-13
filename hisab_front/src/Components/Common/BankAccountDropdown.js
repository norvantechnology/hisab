import React, { useState, useEffect, useCallback } from 'react';
import ReactSelect from 'react-select';
import { RiBankLine } from 'react-icons/ri';
import { ACCOUNT_TYPES } from '../BankAccounts';
import { getBankAccounts } from '../../services/bankAccount';
import { getSelectedCompanyId } from '../../utils/apiCall';

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
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);

  // Check for selected company ID
  useEffect(() => {
    const checkCompanyId = () => {
      const companyId = getSelectedCompanyId();
      setSelectedCompanyId(companyId);
    };
    
    // Check immediately
    checkCompanyId();
    
    // Also check when localStorage changes (in case company selection happens)
    const handleStorageChange = () => {
      checkCompanyId();
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Check periodically to catch company selection
    const interval = setInterval(checkCompanyId, 1000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  // Fetch bank accounts
  const fetchBankAccounts = useCallback(async (search = '') => {
    // Don't proceed if no company is selected
    if (!selectedCompanyId) {
      console.log('No company selected, skipping bank accounts fetch');
      return;
    }

    setLoading(true);
    try {
      const response = await getBankAccounts({ search });
      if (response.success) {
        setBankAccounts(response.accounts || []);
      } else {
        console.error('Failed to fetch bank accounts:', response.message);
        setBankAccounts([]);
      }
    } catch (error) {
      console.error('Error fetching bank accounts:', error);
      setBankAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId]);

  // Only fetch bank accounts when a company is selected
  useEffect(() => {
    if (selectedCompanyId) {
      fetchBankAccounts();
    }
  }, [selectedCompanyId, fetchBankAccounts]);

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