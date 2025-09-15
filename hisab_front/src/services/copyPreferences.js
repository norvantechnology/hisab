import { apiCall } from '../utils/apiCall';

export const getCopyPreferences = async () => {
    return apiCall({
        method: 'get',
        endpoint: '/copyPreferences/preferences'
    });
};

export const setCopyPreference = async (data) => {
    return apiCall({
        method: 'post',
        endpoint: '/copyPreferences/preferences',
        data
    });
};

export const getDefaultCopies = async (moduleType) => {
    return apiCall({
        method: 'get',
        endpoint: '/copyPreferences/default',
        params: { moduleType }
    });
}; 