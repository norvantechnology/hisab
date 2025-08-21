// Company Event System - Centralized company selection management
export const COMPANY_EVENTS = {
  COMPANY_SELECTED: 'companySelected',
  COMPANY_CHANGED: 'companyChanged'
};

// Get selected company from localStorage
export const getSelectedCompany = () => {
  try {
    const stored = localStorage.getItem('selectedCompanyId');
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('Error reading selected company from localStorage:', error);
    return null;
  }
};

// Get only the company ID
export const getSelectedCompanyId = () => {
  const company = getSelectedCompany();
  return company?.id || null;
};

// Set selected company and dispatch events
export const setSelectedCompany = (companyId, companyData) => {
  try {
    const dataToStore = {
      id: companyId,
      name: companyData.name,
      logoUrl: companyData.logoUrl,
      selectedAt: new Date().toISOString()
    };
    
    // Store in localStorage
    localStorage.setItem('selectedCompanyId', JSON.stringify(dataToStore));
    
    // Dispatch custom event for same-window components
    const customEvent = new CustomEvent(COMPANY_EVENTS.COMPANY_SELECTED, {
      detail: { companyId, companyData: dataToStore }
    });
    window.dispatchEvent(customEvent);
    
    // Also dispatch a storage-like event for cross-window compatibility
    const storageEvent = new StorageEvent('storage', {
      key: 'selectedCompanyId',
      newValue: JSON.stringify(dataToStore),
      oldValue: localStorage.getItem('selectedCompanyId')
    });
    window.dispatchEvent(storageEvent);
    
  } catch (error) {
    console.error('Error saving selected company:', error);
  }
};

// Hook for listening to company changes
export const useCompanySelection = (callback) => {
  const handleCompanyChange = (event) => {
    if (event.detail) {
      // Custom event
      callback(event.detail.companyId, event.detail.companyData);
    } else if (event.key === 'selectedCompanyId') {
      // Storage event
      try {
        const companyData = event.newValue ? JSON.parse(event.newValue) : null;
        callback(companyData?.id || null, companyData);
      } catch (error) {
        console.error('Error parsing company data from storage event:', error);
      }
    }
  };

  // Listen for both custom events and storage events
  window.addEventListener(COMPANY_EVENTS.COMPANY_SELECTED, handleCompanyChange);
  window.addEventListener('storage', handleCompanyChange);

  // Return cleanup function
  return () => {
    window.removeEventListener(COMPANY_EVENTS.COMPANY_SELECTED, handleCompanyChange);
    window.removeEventListener('storage', handleCompanyChange);
  };
};

// Initialize company selection on app startup
export const initializeCompanySelection = () => {
  const selectedCompany = getSelectedCompany();
  if (selectedCompany) {
    // Dispatch event to notify all components about the current selection
    setTimeout(() => {
      const customEvent = new CustomEvent(COMPANY_EVENTS.COMPANY_SELECTED, {
        detail: { 
          companyId: selectedCompany.id, 
          companyData: selectedCompany 
        }
      });
      window.dispatchEvent(customEvent);
    }, 100); // Small delay to ensure components are mounted
  }
}; 