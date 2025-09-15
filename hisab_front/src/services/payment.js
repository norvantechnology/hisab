import { apiCall } from '../utils/apiCall';

export const createPayment = async (data) => {
    return apiCall({
        method: 'post',
        endpoint: '/payment/createPayment',
        data
    });
};

export const listPayments = async (params) => {
    return apiCall({
        method: 'get',
        endpoint: '/payment/listPayments',
        params
    });
};

export const updatePayment = async (data) => {
    return apiCall({
        method: 'put',
        endpoint: '/payment/updatePayment',
        data
    });
};

export const deletePayment = async (paymentId) => {
    return apiCall({
        method: 'delete',
        endpoint: '/payment/deletePayment',
        params: { id: paymentId }
    });
};

export const getPaymentDetails = async (paymentId) => {
    return apiCall({
        method: 'get',
        endpoint: '/payment/getPaymentDetails',
        params: { id: paymentId }
    });
};

export const getPendingTransactions = async (contactId) => {
    return apiCall({
        method: 'get',
        endpoint: '/payment/getPendingTransactions',
        params: { contactId }
    });
};

export const generatePaymentInvoicePDF = async (paymentId, copies = 2) => {
    return apiCall({
        method: 'get',
        endpoint: '/payment/generateInvoicePDF',
        params: { id: paymentId, copies: copies }
    });
};

export const downloadPaymentPDF = (pdfUrl, fileName) => {
    // Create a temporary link to download the PDF
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = fileName || 'payment_invoice.pdf';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const openPaymentPDFInNewTab = (pdfUrl) => {
    window.open(pdfUrl, '_blank');
};

export const getPaymentForPrint = async (paymentId) => {
    return apiCall({
        method: 'get',
        endpoint: `/payment/getPaymentForPrint/${paymentId}`
    });
};