import { apiCall } from '../utils/apiCall';

export const listPurchases = async (params) => {
    return apiCall({
        method: 'get',
        endpoint: '/purchase/listPurchases',
        params,
    });
};
export const createPurchase = async (data) => {
    return apiCall({
        method: 'post',
        endpoint: '/purchase/createPurchase',
        data,
    });
};
export const updatePurchases = async (data) => {
    return apiCall({
        method: 'put',
        endpoint: '/purchase/updatePurchase',
        data,
    });
};
export const deletePurchase = async (params) => {
    return apiCall({
        method: 'delete',
        endpoint: '/purchase/deletePurchase',
        params,
    });
};
export const getPurchase = async (params) => {
    return apiCall({
        method: 'get',
        endpoint: '/purchase/getPurchase',
        params,
    });
};

export const getNextInvoiceNumber = async () => {
    return apiCall({
        method: 'get',
        endpoint: '/purchase/getNextInvoiceNumber',
    });
};

export const generatePurchaseInvoicePDF = async (purchaseId, copies = 2) => {
    return apiCall({
        method: 'get',
        endpoint: '/purchase/generateInvoicePDF',
        params: { id: purchaseId, copies: copies }
    });
};

export const getPurchaseInvoiceForPrint = async (purchaseId) => {
    return apiCall({
        method: 'get',
        endpoint: `/purchase/getInvoiceForPrint/${purchaseId}`
    });
};

export const downloadPurchasePDF = (pdfUrl, fileName) => {
    // Create a temporary link to download the PDF
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = fileName || 'purchase_invoice.pdf';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const openPurchasePDFInNewTab = (pdfUrl) => {
    window.open(pdfUrl, '_blank');
};

// Share purchase invoice
export const sharePurchaseInvoice = async (invoiceId, shareData) => {
  return apiCall({
    method: 'post',
    endpoint: `/purchase/share/${invoiceId}`,
    data: shareData
  });
};
