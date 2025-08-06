import {apiCall} from '../utils/apiCall';

// Portal authentication
export const portalLogin = async (credentials) => {
  return await apiCall({
    method: 'post',
    endpoint: '/portal/login',
    data: credentials
  });
};

// Get contact transactions
export const getContactTransactions = async (contactId, params = {}) => {
  const queryParams = new URLSearchParams(params).toString();
  const result = await apiCall({
    method: 'get',
    endpoint: `/portal/transactions/${contactId}?${queryParams}`
  });

  return result;
};

// Get contact summary
export const getContactSummary = async (contactId) => {
  const result = await apiCall({
    method: 'get',
    endpoint: `/portal/summary/${contactId}`
  });

  return result;
};

// Get contact financial summary
export const getContactFinancialSummary = async (contactId) => {
  const result = await apiCall({
    method: 'get',
    endpoint: `/portal/financial-summary/${contactId}`
  });

  return result;
};

// Get dashboard financial summary
export const getDashboardFinancialSummary = async (contactId) => {
  const result = await apiCall({
    method: 'get',
    endpoint: `/portal/dashboard-summary/${contactId}`
  });

  return result;
};

// Get contact profile
export const getContactProfile = async (contactId) => {
  const result = await apiCall({
    method: 'get',
    endpoint: `/portal/profile/${contactId}`
  });

  return result;
};

// Generate portal access token (admin only)
export const generatePortalAccess = async (contactId, expiryHours = 24) => {
  return apiCall({
    method: 'post',
    endpoint: `/contact/${contactId}/generate-portal-access`,
    data: { expiryHours }
  });
}; 