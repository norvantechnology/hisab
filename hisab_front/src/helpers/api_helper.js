import axios from "axios";
import { api } from "../config";

// default
axios.defaults.baseURL = api.API_URL;
// content type
axios.defaults.headers.post["Content-Type"] = "application/json";

// content type
const token = JSON.parse(sessionStorage.getItem("authUser")) ? JSON.parse(sessionStorage.getItem("authUser")).token : null;
if(token)
axios.defaults.headers.common["Authorization"] = "Bearer " + token;

// intercepting to capture errors
axios.interceptors.response.use(
  function (response) {
    return response.data ? response.data : response;
  },
  function (error) {
    // Any status codes that falls outside the range of 2xx cause this function to trigger
    let message;
    switch (error.status) {
      case 500:
        message = "Internal Server Error";
        break;
      case 401:
        message = "Invalid credentials";
        break;
      case 404:
        message = "Sorry! the data you are looking for could not be found";
        break;
      default:
        message = error.message || error;
    }
    return Promise.reject(message);
  }
);
/**
 * Sets the default authorization
 * @param {*} token
 */
const setAuthorization = (token) => {
  axios.defaults.headers.common["Authorization"] = "Bearer " + token;
};

class APIClient {
  /**
   * Fetches data from given url
   */

  //  get = (url, params) => {
  //   return axios.get(url, params);
  // };
  get = (url, params) => {
    let response;

    let paramKeys = [];

    if (params) {
      Object.keys(params).map(key => {
        paramKeys.push(key + '=' + params[key]);
        return paramKeys;
      });

      const queryString = paramKeys && paramKeys.length ? paramKeys.join('&') : "";
      response = axios.get(`${url}?${queryString}`, params);
    } else {
      response = axios.get(`${url}`, params);
    }

    return response;
  };
  /**
   * post given data to url
   */
  create = (url, data) => {
    return axios.post(url, data);
  };
  /**
   * Updates data
   */
  update = (url, data) => {
    return axios.patch(url, data);
  };

  put = (url, data) => {
    return axios.put(url, data);
  };
  /**
   * Delete
   */
  delete = (url, config) => {
    return axios.delete(url, { ...config });
  };
}
const getLoggedinUser = () => {
  // Check for remember me authentication in localStorage first
  let token = localStorage.getItem('authToken');
  let userData = localStorage.getItem('userData');
  let isRemembered = localStorage.getItem('rememberMe') === 'true';
  
  // If remember me was used, check if token is still valid
  if (isRemembered && token) {
    const tokenExpiry = localStorage.getItem('tokenExpiry');
    if (tokenExpiry && new Date() > new Date(tokenExpiry)) {
      // Token expired, clear localStorage
      localStorage.removeItem('authToken');
      localStorage.removeItem('userData');
      localStorage.removeItem('rememberMe');
      localStorage.removeItem('tokenExpiry');
      token = null;
      userData = null;
    }
  }
  
  // If no token in localStorage or it expired, check sessionStorage
  if (!token) {
    token = sessionStorage.getItem('authToken');
    userData = sessionStorage.getItem('userData');
  }
  
  // Legacy support - check for old authUser format
  if (!token && !userData) {
    const legacyUser = sessionStorage.getItem("authUser");
    if (legacyUser) {
      try {
        const parsed = JSON.parse(legacyUser);
        return parsed;
      } catch (e) {
        return null;
      }
    }
  }
  
  if (!token || !userData) {
    return null;
  }
  
  try {
    const user = JSON.parse(userData);
    return {
      token,
      ...user
    };
  } catch (e) {
    return null;
  }
};

export { APIClient, setAuthorization, getLoggedinUser };