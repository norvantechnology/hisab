import { apiCall } from '../utils/apiCall';

export const createCompany = async (companyData) => {
    return apiCall({
        method: 'post',
        endpoint: '/company/createCompany',
        data: companyData,
        headers: {
            'Content-Type': 'application/json'
        }
    });
};

export const getAllCompanies = async () => {
    return apiCall({
        method: 'get',
        endpoint: '/company/getAllCompanies',
        headers: {
            'Content-Type': 'application/json'
        }
    });
};

export const updateCompany = async (companyData) => {
    return apiCall({
        method: 'put',
        endpoint: '/company/updateCompany',
        data: companyData,
        headers: {
            'Content-Type': 'application/json'
        }
    });
};
