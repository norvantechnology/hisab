import React, { useState, useEffect, useCallback } from 'react';
import ReactSelect from 'react-select';
import { RiBankLine, RiUserLine } from 'react-icons/ri';
import { ACCOUNT_TYPES } from '../BankAccounts';
import { getBankAccounts } from '../../services/bankAccount';
import { getContacts } from '../../services/contacts';
import { getSelectedCompanyId } from '../../utils/apiCall';
import { debounce } from 'lodash';
import ContactForm from '../Contacts/ContactForm';
import useCompanySelectionState from '../../hooks/useCompanySelection';

const BankAccountContactDropdown = ({
  // Common props
  value,
  onChange,
  onBlur,
  disabled = false,
  placeholder = "Select Bank Account or Contact...",
  label = "",
  error = null,
  touched = false,
  
  // ReactSelect specific props
  className = "",
  classNamePrefix = "react-select",
  
  // Search and pagination
  searchTerm = "",
  enableSearch = true,
  enablePagination = true,
  showBankAccounts = true,
  showContacts = true
}) => {
  
  const [bankAccounts, setBankAccounts] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  // Contact form modal state
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isCreatingContact, setIsCreatingContact] = useState(false);

  // Pagination state
  const [bankAccountsPagination, setBankAccountsPagination] = useState({
    page: 1,
    totalPages: 1
  });
  const [contactsPagination, setContactsPagination] = useState({
    page: 1,
    totalPages: 1
  });

  // Use the modern company selection hook
  const { selectedCompanyId } = useCompanySelectionState();

  // Fetch bank accounts
  const fetchBankAccounts = useCallback(async (search = '', page = 1) => {
    // Don't proceed if no company is selected
    if (!selectedCompanyId) {
      console.log('No company selected, skipping bank accounts fetch');
      return;
    }

    if (page === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    
    try {
      const response = await getBankAccounts({ search, page });
      if (response.success) {
        if (page === 1) {
          setBankAccounts(response.accounts || []);
          setBankAccountsPagination({
            page: response.currentPage || 1,
            totalPages: response.totalPages || 1
          });
        } else {
          setBankAccounts(prev => [...prev, ...(response.accounts || [])]);
          setBankAccountsPagination(prev => ({
            ...prev,
            page: response.currentPage || page
          }));
        }
      } else {
        console.error('Failed to fetch bank accounts:', response.message);
        setBankAccounts([]);
      }
    } catch (error) {
      console.error('Error fetching bank accounts:', error);
      setBankAccounts([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [selectedCompanyId]);

  // Fetch contacts
  const fetchContacts = useCallback(async (search = '', page = 1) => {
    // Don't proceed if no company is selected
    if (!selectedCompanyId) {
      console.log('No company selected, skipping contacts fetch');
      return;
    }

    if (page === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    
    try {
      const response = await getContacts({ search, page });
      if (page === 1) {
        setContacts(response.contacts || []);
        setContactsPagination({
          page: response.currentPage || 1,
          totalPages: response.totalPages || 1
        });
      } else {
        setContacts(prev => [...prev, ...(response.contacts || [])]);
        setContactsPagination(prev => ({
          ...prev,
          page: response.currentPage || page
        }));
      }
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [selectedCompanyId]);

  // Only fetch data when a company is selected
  useEffect(() => {
    if (selectedCompanyId) {
      if (showBankAccounts) {
        fetchBankAccounts();
      }
      if (showContacts) {
        fetchContacts();
      }
    }
  }, [selectedCompanyId, showBankAccounts, showContacts, fetchBankAccounts, fetchContacts]);

  // Handle search
  const handleSearch = useCallback((searchTerm) => {
    setSearchValue(searchTerm);
    fetchBankAccounts(searchTerm, 1);
    fetchContacts(searchTerm, 1);
  }, [fetchBankAccounts, fetchContacts]);

  // Debounced search for better performance
  const debouncedSearch = useCallback(
    debounce((searchTerm) => {
      handleSearch(searchTerm);
    }, 300),
    [handleSearch]
  );

  // Handle input change with debouncing
  const handleInputChange = useCallback((newValue, actionMeta) => {
    if (actionMeta.action === 'input-change') {
      setSearchValue(newValue);
      debouncedSearch(newValue);
    } else if (actionMeta.action === 'menu-close' || actionMeta.action === 'blur') {
      // Clear search when dropdown closes or loses focus
      setSearchValue('');
      fetchBankAccounts('', 1);
      fetchContacts('', 1);
    }
    return newValue;
  }, [debouncedSearch, fetchBankAccounts, fetchContacts]);

  // Handle load more
  const handleLoadMore = useCallback(() => {
    if (bankAccountsPagination.page < bankAccountsPagination.totalPages) {
      fetchBankAccounts(searchValue, bankAccountsPagination.page + 1);
    }
    if (contactsPagination.page < contactsPagination.totalPages) {
      fetchContacts(searchValue, contactsPagination.page + 1);
    }
  }, [fetchBankAccounts, fetchContacts, contactsPagination.page, contactsPagination.totalPages, searchValue]);

  // Helper function to get account icon
  const getAccountIcon = (accountType) => {
    const accountTypeInfo = ACCOUNT_TYPES[accountType] || ACCOUNT_TYPES.bank;
    return accountTypeInfo.icon;
  };

  // Helper function to get contact icon
  const getContactIcon = () => {
    return <RiUserLine />;
  };

  // Custom onChange handler
  const handleChange = (selectedOption) => {
    // Pass through normal selections
    if (onChange) {
      onChange(selectedOption);
    }
  };

  // Handle contact form submission
  const handleContactSubmit = async (contactData) => {
    setIsCreatingContact(true);
    try {
      // Import the createContact service
      const { createContact } = await import('../../services/contacts');
      const newContact = await createContact(contactData);
      
      // Add the new contact to the list
      setContacts(prev => [newContact, ...prev]);
      
      // Close the modal
      setIsContactModalOpen(false);
      
      // Optionally select the newly created contact
      if (onChange) {
        onChange({
          value: `contact_${newContact.id}`,
          label: newContact.name,
          type: 'contact',
          contact: newContact
        });
      }
    } catch (error) {
      console.error('Error creating contact:', error);
    } finally {
      setIsCreatingContact(false);
    }
  };

  // Toggle contact modal
  const toggleContactModal = () => {
    setIsContactModalOpen(!isContactModalOpen);
  };

  // For ReactSelect
  const options = [];
  
  // Add bank accounts section (only if there are bank accounts)
  if (showBankAccounts && bankAccounts.length > 0) {
    options.push({
      label: 'Bank Accounts',
      options: bankAccounts.map(account => ({
        value: `bank_${account.id}`,
        label: account.accountName,
        type: 'bank',
        account: account
      }))
    });
  }
  
  // Always add contacts section with "Add Contact" option
  const contactOptions = contacts.map(contact => ({
    value: `contact_${contact.id}`,
    label: contact.name,
    type: 'contact',
    contact: contact
  }));

  if (showContacts) {
    options.push({
      label: 'Contacts',
      options: contactOptions
    });
  }

  // Get current value for ReactSelect
  const getCurrentValue = () => {
    if (!value) return null;
    
    const [type, id] = value.split('_');
    
    if (type === 'bank') {
      const account = bankAccounts.find(a => String(a.id) === String(id));
      return account ? {
        value: `bank_${account.id}`,
        label: account.accountName,
        type: 'bank',
        account: account
      } : null;
    } else if (type === 'contact') {
      const contact = contacts.find(c => String(c.id) === String(id));
      return contact ? {
        value: `contact_${contact.id}`,
        label: contact.name,
        type: 'contact',
        contact: contact
      } : null;
    }
    
    return null;
  };

  return (
    <>
      <ReactSelect
        options={options}
        value={getCurrentValue()}
        onChange={handleChange}
        onBlur={onBlur}
        isDisabled={disabled}
        isLoading={loading}
        className={`react-select-container ${className} ${touched && error ? 'is-invalid' : ''}`}
        classNamePrefix={classNamePrefix}
        placeholder={placeholder}
        onInputChange={enableSearch ? handleInputChange : undefined}
        onMenuScrollToBottom={enablePagination ? handleLoadMore : undefined}
        inputValue={enableSearch ? searchValue : ''}
        isClearable={false}
        isSearchable={enableSearch}
        components={{
          MenuList: ({ children, ...props }) => {
            return (
              <div {...props}>
                {children}
                <div 
                  className="add-contact-option"
                  onClick={() => setIsContactModalOpen(true)}
                >
                  <div className="d-flex align-items-center">
                    <div className="option-icon me-2">
                      <span className="text-muted" style={{ fontSize: '14px' }}>
                        <RiUserLine />
                      </span>
                    </div>
                    <div className="option-content">
                      <div className="option-title text-primary">
                        Add New Contact
                      </div>
                      <div className="option-subtitle">
                        Create a new contact
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          }
        }}
        filterOption={(option, inputValue) => {
          // For all options, use default filtering
          if (!inputValue) return true;
          
          const label = option.label || '';
          return label.toLowerCase().includes(inputValue.toLowerCase());
        }}
        noOptionsMessage={({ inputValue }) => {
          if (inputValue) {
            return "No options";
          }
          return "No options";
        }}

        styles={{
          control: (provided, state) => ({
            ...provided,
            minHeight: '36px',
            fontSize: '0.875rem',
            border: state.isFocused ? '1px solid var(--vz-primary)' : '1px solid var(--vz-border-color)',
            boxShadow: state.isFocused ? '0 0 0 0.2rem rgba(13, 110, 253, 0.1)' : 'none',
            '&:hover': {
              borderColor: 'var(--vz-primary)'
            }
          }),
          menu: (provided) => ({
            ...provided,
            border: '1px solid var(--vz-border-color)',
            borderRadius: '6px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden',
            zIndex: 9999,
            maxHeight: '200px'
          }),
          option: (provided, state) => ({
            ...provided,
            backgroundColor: state.isFocused ? 'var(--vz-light-bg-subtle)' : 'var(--vz-body-bg)',
            color: 'var(--vz-body-color)',
            padding: '8px 12px',
            fontSize: '0.875rem',
            cursor: 'pointer',
            borderBottom: '1px solid var(--vz-border-color)',
            '&:hover': {
              backgroundColor: 'var(--vz-light-bg-subtle)'
            },
            '&:last-child': {
              borderBottom: 'none'
            }
          }),
          groupHeading: (provided) => ({
            ...provided,
            margin: 0,
            padding: 0,
            fontSize: '0.75rem',
            fontWeight: 600
          }),
          menuList: (provided) => ({
            ...provided,
            padding: 0,
            maxHeight: '200px'
          }),
          placeholder: (provided) => ({
            ...provided,
            color: 'var(--vz-secondary-color)',
            fontSize: '0.875rem'
          }),
          singleValue: (provided) => ({
            ...provided,
            fontSize: '0.875rem',
            color: 'var(--vz-body-color)'
          })
        }}
        formatOptionLabel={(option) => {
          // Check if option has the required properties
          if (!option || !option.type) {
            return option?.label || '';
          }

          if (option.type === 'bank' && option.account) {
            const account = option.account;
            const accountType = ACCOUNT_TYPES[account.accountType] || ACCOUNT_TYPES.bank;
            return (
              <div className="d-flex align-items-center">
                <div className="option-icon me-2">
                  <span className="text-muted" style={{ fontSize: '14px' }}>
                    {getAccountIcon(account.accountType)}
                  </span>
                </div>
                <div className="option-content">
                  <div className="option-title">
                    {account.accountName}
                    {!account.isActive && <span className="text-danger ms-1">(Inactive)</span>}
                  </div>
                  <div className="option-subtitle">
                    {ACCOUNT_TYPES[account.accountType]?.label || account.accountType}
                  </div>
                </div>
              </div>
            );
          } else if (option.type === 'contact' && option.contact) {
            return (
              <div className="d-flex align-items-center">
                <div className="option-icon me-2">
                  <span className="text-muted" style={{ fontSize: '14px' }}>
                    {getContactIcon()}
                  </span>
                </div>
                <div className="option-content">
                  <div className="option-title">
                    {option.contact.name}
                  </div>
                  {option.contact.gstin && (
                    <div className="option-subtitle">
                      GSTIN: {option.contact.gstin}
                    </div>
                  )}
                </div>
              </div>
            );
          }
          
          // Fallback for any other option types
          return option.label || '';
        }}
        formatGroupLabel={(data) => (
          <div className="group-header">
            <span className="group-title">{data.label}</span>
          </div>
        )}
      />
      
      {/* Contact Creation Modal */}
      <ContactForm
        isOpen={isContactModalOpen}
        toggle={toggleContactModal}
        isEditMode={false}
        selectedContact={null}
        onSubmit={handleContactSubmit}
        isLoading={isCreatingContact}
      />

      <style jsx>{`
        .option-icon {
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .option-content {
          flex: 1;
          min-width: 0;
        }

        .option-title {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--vz-body-color);
          line-height: 1.2;
          margin-bottom: 0.125rem;
        }

        .option-subtitle {
          font-size: 0.75rem;
          color: var(--vz-secondary-color);
          line-height: 1.1;
        }

        .group-header {
          background: var(--vz-light-bg-subtle);
          padding: 0.5rem 0.75rem;
          border-bottom: 1px solid var(--vz-border-color);
          margin: 0;
        }

        .group-title {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--vz-body-color);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .add-contact-option {
          background: var(--vz-light-bg-subtle);
          border-top: 1px solid var(--vz-border-color);
          padding: 0.75rem;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }

        .add-contact-option:hover {
          background: var(--vz-secondary-bg);
        }

        .react-select-container {
          position: relative;
        }

        .react-select__menu {
          border-radius: 6px;
          overflow: hidden;
        }

        .react-select__option {
          transition: background-color 0.2s ease;
        }

        .react-select__group-heading {
          padding: 0;
          margin: 0;
        }

        .react-select__control--is-focused {
          border-color: var(--vz-primary) !important;
          box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.1) !important;
        }
      `}</style>
    </>
  );
};

export default BankAccountContactDropdown;