import { apiCall } from '../utils/apiCall';

export const signup = async (userData) => {
  return apiCall({
    method: 'post',
    endpoint: '/auth/signup',
    data: userData,
    headers: {
      'Content-Type': 'application/json'
    }
  });
};

export const verifyEmail = async (token) => {
  return apiCall({
    method: 'get',
    endpoint: `/auth/verifyEmail?token=${token}`,
  });
};

export const login = async (credentials) => {
  return apiCall({
    method: 'post',
    endpoint: '/auth/login',
    data: credentials
  });
};