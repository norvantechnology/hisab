import { apiCall } from '../utils/apiCall';

export const listSales = async (params) => {
    return apiCall({
        method: 'get',
        endpoint: '/sales/listSales',
        params,
    });
};

export const createSale = async (data) => {
    return apiCall({
        method: 'post',
        endpoint: '/sales/createSale',
        data,
    });
};

export const updateSales = async (data) => {
    return apiCall({
        method: 'put',
        endpoint: '/sales/updateSale',
        data,
    });
};

export const deleteSale = async (params) => {
    return apiCall({
        method: 'delete',
        endpoint: '/sales/deleteSale',
        params,
    });
};

export const getSale = async (params) => {
    return apiCall({
        method: 'get',
        endpoint: '/sales/getSale',
        params,
    });
}; 

export const getNextInvoiceNumber = async () => {
    return apiCall({
        method: 'get',
        endpoint: '/sales/getNextInvoiceNumber',
    });
}; 

export const generateSalesInvoicePDF = async (saleId) => {
    return apiCall({
        method: 'get',
        endpoint: '/sales/generateInvoicePDF',
        params: { id: saleId }
    });
};

export const downloadSalesPDF = (pdfUrl, fileName) => {
    // Create a temporary link to download the PDF
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = fileName || 'sales_invoice.pdf';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const openSalesPDFInNewTab = (pdfUrl) => {
    window.open(pdfUrl, '_blank');
}; 

// Share sales invoice
export const shareSalesInvoice = async (invoiceId, shareData) => {
  return apiCall({
    method: 'post',
    endpoint: `/sales/share/${invoiceId}`,
    data: shareData
  });
}; 