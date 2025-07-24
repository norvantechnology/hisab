import { apiCall } from '../utils/apiCall';

export const createCompany = async (companyData) => {
    return apiCall({
        method: 'post',
        endpoint: '/company/createCompany',
        data: companyData
    });
};

export const getAllCompanies = async () => {
    return apiCall({
        method: 'get',
        endpoint: '/company/getAllCompanies'
    });
};

export const updateCompany = async (companyData) => {
    return apiCall({
        method: 'put',
        endpoint: '/company/updateCompany',
        data: companyData
    });
};

export const deleteCompany = async (companyId) => {
    return apiCall({
        method: 'delete',
        endpoint: `/company/deleteCompany/${companyId}`
    });
};
