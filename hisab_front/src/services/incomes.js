import { apiCall } from '../utils/apiCall';

export const createIncome = async (data) => {
    return apiCall({
        method: 'post',
        endpoint: '/incomes/createIncome',
        data
    });
};

export const getIncomes = async (params) => {
    return apiCall({
        method: 'get',
        endpoint: '/incomes/getIncomes',
        params
    });
};

export const deleteIncome = async (id) => {
    return apiCall({
        method: 'delete',
        endpoint: '/incomes/deleteIncome',
        params: { id }
    });
};
export const updateIncome = async (data) => {
    return apiCall({
        method: 'put',
        endpoint: '/incomes/updateIncome',
        data
    });
};

export const bulkDeleteIncomes = async (ids) => {
    return apiCall({
        method: 'post',
        endpoint: '/incomes/bulkDeleteIncomes',
        data: { ids },
    });
};