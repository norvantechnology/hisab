import React, { useState, useEffect, useCallback } from 'react';
import ReactSelect from 'react-select';
import { RiBankLine, RiUser3Line } from 'react-icons/ri';
import { ACCOUNT_TYPES } from '../BankAccounts';
import { getBankAccounts } from '../../services/bankAccount';
import { getContacts } from '../../services/contacts';
import { debounce } from 'lodash';
import ContactForm from '../Contacts/ContactForm';

const BankAccountContactDropdown = ({
  // Common props
  value,
  onChange,
  onBlur,
  disabled = false,
  placeholder = "Select...",
  label = "",
  error = null,
  touched = false,
  
  // ReactSelect specific props
  className = "",
  classNamePrefix = "react-select",
  
  // Search and pagination
  searchTerm = "",
  enableSearch = true,
  enablePagination = true
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

  // Fetch bank accounts
  const fetchBankAccounts = useCallback(async (search = '', page = 1) => {
    if (page === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    
    try {
      const response = await getBankAccounts({ search, page });
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
    } catch (error) {
      console.error('Error fetching bank accounts:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Fetch contacts
  const fetchContacts = useCallback(async (search = '', page = 1) => {
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
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchBankAccounts();
    fetchContacts();
  }, [fetchBankAccounts, fetchContacts]);

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
    return <RiUser3Line />;
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
  if (bankAccounts.length > 0) {
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

  options.push({
    label: 'Contacts',
    options: contactOptions
  });

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
                  className="p-2 text-center border-top"
                  style={{ 
                    backgroundColor: '#ffffff', 
                    borderTop: '1px solid #dee2e6',
                    cursor: 'pointer'
                  }}
                  onClick={() => setIsContactModalOpen(true)}
                >
                  <div className="text-primary">
                    <RiUser3Line className="me-2" />
                    Add New Contact
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
          menu: (provided) => ({
            ...provided,
            border: '1px solid #dee2e6',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            overflow: 'hidden'
          }),
          option: (provided, state) => ({
            ...provided,
            backgroundColor: state.isFocused ? '#e3f2fd' : 'white',
            color: '#333',
            padding: '6px 12px',
            borderBottom: '1px solid #f0f0f0',
            cursor: 'pointer',
            '&:hover': {
              backgroundColor: '#e3f2fd'
            }
          }),
          groupHeading: (provided) => ({
            ...provided,
            margin: 0,
            padding: 0
          }),
          menuList: (provided) => ({
            ...provided,
            padding: 0
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
              <div className="d-flex align-items-center py-0">
                <span className={`text-${accountType.color} me-2`} style={{ fontSize: '16px' }}>
                  {getAccountIcon(account.accountType)}
                </span>
                <div>
                  <div className="fw-medium">
                    {account.accountName} ({ACCOUNT_TYPES[account.accountType]?.label || account.accountType})
                    {!account.isActive && <span className="text-danger ms-2">(Inactive)</span>}
                  </div>
                </div>
              </div>
            );
          } else if (option.type === 'contact' && option.contact) {
            return (
              <div className="d-flex align-items-center py-0">
                <span className="text-info me-2" style={{ fontSize: '16px' }}>
                  {getContactIcon()}
                </span>
                <div>
                  <div className="fw-medium">
                    {option.contact.name}{option.contact.gstin ? ` (${option.contact.gstin})` : ''}
                  </div>
                </div>
              </div>
            );
          }
          
          // Fallback for any other option types
          return option.label || '';
        }}
        formatGroupLabel={(data) => (
          <div className="d-flex align-items-center fw-bold text-primary py-1 px-2" style={{ 
            backgroundColor: '#f8f9fa', 
            borderBottom: '2px solid #dee2e6',
            marginTop: '4px',
            fontSize: '14px'
          }}>
            {data.label}
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
    </>
  );
};

export default BankAccountContactDropdown;