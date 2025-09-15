import axios from 'axios';
import { getSelectedCompanyId as getCompanyId } from './companyEvents';

// Keep backward compatibility
const getSelectedCompanyId = getCompanyId;

const pendingRequests = new Map();

const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || '',
  timeout: 120000, // Increased to 2 minutes (120 seconds) to handle longer operations
  // Don't set default Content-Type - handle it dynamically in apiCall
});

// Helper function for long-running operations (PDF generation, file uploads, exports)
export const longRunningApiCall = async (config) => {
  return apiCall({
    ...config,
    timeout: 300000 // 5 minutes for long operations
  });
};

export const apiCall = async ({
  method = 'get',
  endpoint,
  data = null,
  headers = {},
  params = {},
  responseType = 'json',
  timeout = null // Allow custom timeout override
}) => {
  try {
    const companyId = getSelectedCompanyId();
    
    // Check if companyId is available
    if (!companyId) {
      console.warn('No companyId found for API call:', endpoint);
    }

    // Build headers, handling FormData specially
    const requestHeaders = { ...headers, companyid: companyId };
    
    // If data is FormData, don't set Content-Type - let browser handle it
    if (data instanceof FormData) {
      // Remove any Content-Type header to let browser set multipart/form-data with boundary
      delete requestHeaders['Content-Type'];
    } else if (!requestHeaders['Content-Type']) {
      // Only set JSON content-type if not already specified and not FormData
      requestHeaders['Content-Type'] = 'application/json';
    }

    const config = {
      method,
      url: endpoint,
      headers: requestHeaders,
      params,
      responseType
    };

    // Apply custom timeout if provided
    if (timeout !== null) {
      config.timeout = timeout;
    }

    if (method.toLowerCase() !== 'get' && data) {
      config.data = data;
    }

    // Generate request key for pending requests check
    const key = `${method}:${endpoint}:${JSON.stringify(params)}:${JSON.stringify(data)}`;
    
    // Check if request is already pending
    if (pendingRequests.has(key)) {

      return await pendingRequests.get(key);
    }

    // Create promise for this request
    const requestPromise = (async () => {
      try {
    
        
        const response = await apiClient.request(config);
        
        // For blob responses, return the blob directly
        if (responseType === 'blob') {
          return response.data;
        }
        
        const result = response.data;
        
        return result;
      } finally {
        // Remove from pending requests
        pendingRequests.delete(key);
      }
    })();

    // Store the promise
    pendingRequests.set(key, requestPromise);
    
    return await requestPromise;
    
  } catch (error) {
    if (error.response) {
      throw {
        message: error.response.data?.message || 'An error occurred',
        status: error.response.status,
        data: error.response.data,
      };
    } else if (error.request) {
      throw {
        message: 'No response received from server',
        status: null,
      };
    } else {
      throw {
        message: error.message,
        status: null,
      };
    }
  }
};

apiClient.interceptors.request.use(
  (config) => {
    // Check for regular user token in both storages (localStorage for remember me, sessionStorage for regular login)
    let token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
    

    
    // If no regular token, check for portal token
    if (!token) {
      token = localStorage.getItem('portalToken');

    }
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export { apiClient, getSelectedCompanyId };