import { apiCall } from '../utils/apiCall';

export const login = async (credentials) => {
    return apiCall({
        method: 'post',
        endpoint: '/auth/login',
        data: credentials
    });
};

export const signup = async (userData) => {
    return apiCall({
        method: 'post',
        endpoint: '/auth/signup',
        data: userData
    });
};

export const changePassword = async (passwordData) => {
    return apiCall({
        method: 'post',
        endpoint: '/auth/changePassword',
        data: passwordData
    });
};

export const verifyEmail = async (token) => {
    return apiCall({
      method: 'get',
      endpoint: `/auth/verifyEmail?token=${token}`,
    });
  };