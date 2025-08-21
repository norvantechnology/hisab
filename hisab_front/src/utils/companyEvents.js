// Company Event System - Centralized company selection management
export const COMPANY_EVENTS = {
  COMPANY_SELECTED: 'companySelected',
  COMPANY_CHANGED: 'companyChanged'
};

// Get selected company from sessionStorage (more reliable for API calls)
export const getSelectedCompany = () => {
  try {
    const stored = sessionStorage.getItem('selectedCompanyId');
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('Error reading selected company from sessionStorage:', error);
    return null;
  }
};

// Get only the company ID - with fallback logic
export const getSelectedCompanyId = () => {
  try {
    // First try sessionStorage for immediate availability
    let stored = sessionStorage.getItem('selectedCompanyId');
    
    // If not in sessionStorage, check localStorage and copy over
    if (!stored) {
      stored = localStorage.getItem('selectedCompanyId');
      if (stored) {
        sessionStorage.setItem('selectedCompanyId', stored);
      }
    }
    
    if (stored) {
      const companyData = JSON.parse(stored);
      return companyData?.id || null;
    }
    
    return null;
  } catch (error) {
    console.error('Error reading selected company ID:', error);
    return null;
  }
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
    
    // Store in both localStorage (for persistence) and sessionStorage (for API reliability)
    localStorage.setItem('selectedCompanyId', JSON.stringify(dataToStore));
    sessionStorage.setItem('selectedCompanyId', JSON.stringify(dataToStore));
    
    // Dispatch custom event for same-window components
    const customEvent = new CustomEvent(COMPANY_EVENTS.COMPANY_SELECTED, {
      detail: { companyId, companyData: dataToStore }
    });
    window.dispatchEvent(customEvent);
    
    // Also dispatch a storage-like event for cross-window compatibility
    const storageEvent = new StorageEvent('storage', {
      key: 'selectedCompanyId',
      newValue: JSON.stringify(dataToStore),
      oldValue: sessionStorage.getItem('selectedCompanyId')
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
  // First check sessionStorage, then fallback to localStorage
  let selectedCompany = null;
  try {
    selectedCompany = sessionStorage.getItem('selectedCompanyId');
    if (!selectedCompany) {
      // Fallback to localStorage and copy to sessionStorage
      const localStored = localStorage.getItem('selectedCompanyId');
      if (localStored) {
        sessionStorage.setItem('selectedCompanyId', localStored);
        selectedCompany = localStored;
      }
    }
    selectedCompany = selectedCompany ? JSON.parse(selectedCompany) : null;
  } catch (error) {
    console.error('Error initializing company selection:', error);
    return;
  }

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