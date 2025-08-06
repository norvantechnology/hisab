import { apiCall } from '../utils/apiCall';

export const createBankAccount = async (accountData) => {
    return apiCall({
        method: 'post',
        endpoint: '/bankAccount/createBankAccount',
        data: accountData,
        headers: {
            'Content-Type': 'application/json',
        }
    });
};

export const getBankAccounts = async (params) => {
    return apiCall({
        method: 'get',
        endpoint: '/bankAccount/getBankAccounts',
        params
    });
};

export const getBankStatement = async (bankAccountId, params) => {
    return apiCall({
        method: 'get',
        endpoint: `/bankAccount/getBankStatement/${bankAccountId}`,
        params
    });
};

export const exportBankStatementPDF = async (bankAccountId, params) => {
    return apiCall({
        method: 'get',
        endpoint: `/bankAccount/exportBankStatementPDF/${bankAccountId}`,
        params,
        responseType: 'blob' // Important for PDF download
    });
};

export const updateBankAccount = async (accountData) => {
    return apiCall({
        method: 'put',
        endpoint: `/bankAccount/updateBankAccount`,
        data: accountData,
        headers: {
            'Content-Type': 'application/json',
        }
    });
};

export const deleteBankAccount = async (id) => {
    return apiCall({
        method: 'delete',
        endpoint: `/bankAccount/deleteBankAccount`,
        headers: {
        },
        params: { id }
    });
};