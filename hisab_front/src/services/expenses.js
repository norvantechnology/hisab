import { apiCall } from '../utils/apiCall';

export const createExpense = async (data) => {
    return apiCall({
        method: 'post',
        endpoint: '/expense/createExpense',
        data
    });
};

export const getExpenses = async (params) => {
    return apiCall({
        method: 'get',
        endpoint: '/expense/getExpenses',
        params
    });
};

export const deleteExpense = async (id) => {
    return apiCall({
        method: 'delete',
        endpoint: '/expense/deleteExpense',
        params: { id }
    });
};
export const updateExpense = async (data) => {
    return apiCall({
        method: 'put',
        endpoint: '/expense/updateExpense',
        data
    });
};