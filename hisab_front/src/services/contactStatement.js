import { apiCall } from '../utils/apiCall';

// Get contact statement data (JSON format)
export const getContactStatement = async (contactId, params = {}) => {
    return apiCall({
        method: 'get',
        endpoint: `/contactStatement/statement/${contactId}`,
        params: {
            format: 'json',
            ...params
        }
    });
};

// Download contact statement as PDF - using common apiCall with blob
export const downloadContactStatementPDF = async (contactId, params = {}) => {
    try {
        const blob = await apiCall({
            method: 'get',
            endpoint: `/contactStatement/statement/${contactId}`,
            params: {
                format: 'pdf',
                ...params
            },
            responseType: 'blob' // Important for PDF download
        });

        // Create download link
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `contact_statement_${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);

        return { success: true };
    } catch (error) {
        console.error('Error downloading PDF:', error);
        return { success: false, message: error.message };
    }
};

// Download contact statement as Excel - using common apiCall with blob
export const downloadContactStatementExcel = async (contactId, params = {}) => {
    try {
        const blob = await apiCall({
            method: 'get',
            endpoint: `/contactStatement/statement/${contactId}`,
            params: {
                format: 'excel',
                ...params
            },
            responseType: 'blob' // Important for Excel download
        });

        // Create download link
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `contact_statement_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);

        return { success: true };
    } catch (error) {
        console.error('Error downloading Excel:', error);
        return { success: false, message: error.message };
    }
};

// Share contact statement via email
export const shareContactStatement = async (contactId, data) => {
    return apiCall({
        method: 'post',
        endpoint: `/contactStatement/statement/${contactId}/share`,
        data
    });
}; 