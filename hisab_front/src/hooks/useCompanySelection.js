import { useState, useEffect, useCallback } from 'react';
import { getSelectedCompanyId, useCompanySelection } from '../utils/companyEvents';

/**
 * Custom hook for managing company selection state
 * Replaces the repetitive localStorage polling and event listening logic
 * @returns {Object} - { selectedCompanyId, loading }
 */
export const useCompanySelectionState = () => {
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize with current selection
  useEffect(() => {
    const currentCompanyId = getSelectedCompanyId();
    setSelectedCompanyId(currentCompanyId);
    setLoading(false);
  }, []);

  // Listen for company selection changes
  useEffect(() => {
    const cleanup = useCompanySelection((companyId) => {
      setSelectedCompanyId(companyId);
    });

    return cleanup;
  }, []);

  return { selectedCompanyId, loading };
};

export default useCompanySelectionState; 