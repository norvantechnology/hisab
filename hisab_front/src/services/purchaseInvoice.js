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
    console.log('🚀 STEP F: updatePurchases API service called!', {
        data,
        endpoint: '/purchase/updatePurchase',
        method: 'PUT',
        timestamp: new Date().toISOString(),
        message: 'This proves the API service function was reached'
    });
    
    try {
        const result = await apiCall({
            method: 'put',
            endpoint: '/purchase/updatePurchase',
            data,
        });
        
        console.log('🚀 STEP G: API call result:', {
            result,
            success: result?.success,
            message: 'API call completed'
        });
        
        return result;
    } catch (error) {
        console.error('❌ STEP G ERROR: API call failed:', error);
        throw error;
    }
};
export const deletePurchase = async (params) => {
    return apiCall({
        method: 'delete',
        endpoint: '/purchase/deletePurchase',
        params,
    });
};

export const bulkDeletePurchases = async (ids) => {
    return apiCall({
        method: 'post',
        endpoint: '/purchase/bulkDeletePurchases',
        data: { ids },
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
    data: {
      ...shareData,
      copies: 1 // Always use 1 copy for email sharing
    }
  });
};
