import axios from 'axios';

const getSelectedCompanyId = () => {
  try {
    const stored = localStorage.getItem('selectedCompanyId');
    if (stored) {
      const companyData = JSON.parse(stored);
      return companyData?.id || null;
    }
    return null;
  } catch (error) {
    console.error('Error reading selected company from localStorage:', error);
    return null;
  }
};

const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || '',
  timeout: 10000,
  // Don't set default Content-Type - handle it dynamically in apiCall
});

export const apiCall = async ({
  method = 'get',
  endpoint,
  data = null,
  headers = {},
  params = {},
}) => {
  try {
    const companyId = getSelectedCompanyId();

    // Build headers, handling FormData specially
    const requestHeaders = { ...headers, companyId };
    
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
    };

    if (method.toLowerCase() !== 'get' && data) {
      config.data = data;
    }
    
    console.log("config>>", config);
    console.log("data type>>", data instanceof FormData ? 'FormData' : typeof data);
    
    const response = await apiClient.request(config);
    return response.data;
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
    const token = sessionStorage.getItem('authToken');
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

export { apiClient };