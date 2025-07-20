import { apiCall } from '../utils/apiCall';

export const getExpenseCategories = async () => {
    return apiCall({
        method: 'get',
        endpoint: '/expense/getExpenseCategories',
    });
};

export const createExpenseCategory = async (categoryName) => {
    return apiCall({
        method: 'post',
        endpoint: '/expense/createExpenseCategory',
        data: { name: categoryName },
    });
};

export const getIncomeCategories = async () => {
    return apiCall({
        method: 'get',
        endpoint: '/incomes/getIncomeCategories',
    });
};

export const createIncomeCategory = async (categoryName) => {
    return apiCall({
        method: 'post',
        endpoint: '/incomes/createIncomeCategory',
        data: { name: categoryName },
    });
};