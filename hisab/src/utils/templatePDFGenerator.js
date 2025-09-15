import pool from "../config/dbConnection.js";
import browserPool from "./browserPool.js";

// Convert number to words
const convertNumberToWords = (amount) => {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

  if (amount === 0) return 'Zero';
  if (amount < 0) return 'Minus ' + convertNumberToWords(-amount);

  let result = '';
  
  if (amount >= 10000000) {
    result += convertNumberToWords(Math.floor(amount / 10000000)) + ' Crore ';
    amount %= 10000000;
  }
  
  if (amount >= 100000) {
    result += convertNumberToWords(Math.floor(amount / 100000)) + ' Lakh ';
    amount %= 100000;
  }
  
  if (amount >= 1000) {
    result += convertNumberToWords(Math.floor(amount / 1000)) + ' Thousand ';
    amount %= 1000;
  }
  
  if (amount >= 100) {
    result += ones[Math.floor(amount / 100)] + ' Hundred ';
    amount %= 100;
  }
  
  if (amount >= 20) {
    result += tens[Math.floor(amount / 10)] + ' ';
    amount %= 10;
  } else if (amount >= 10) {
    result += teens[amount - 10] + ' ';
    return result.trim() + ' Only';
  }
  
  if (amount > 0) {
    result += ones[amount] + ' ';
  }
  
  return result.trim() + ' Only';
};

// Replace placeholders in HTML template with actual data
export const replacePlaceholders = (htmlTemplate, data) => {
  let processedHtml = htmlTemplate;

  // Helper function to safely get nested object values
  const getNestedValue = (obj, path) => {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : '';
    }, obj);
  };

  // Handle allocations array FIRST before conditional blocks
  const allocationsRegex = /\{\{#allocations\}\}([\s\S]*?)\{\{\/allocations\}\}/g;
  processedHtml = processedHtml.replace(allocationsRegex, (match, allocationTemplate) => {
    if (!data.allocations || !Array.isArray(data.allocations) || data.allocations.length === 0) {
      return '';
    }

    return data.allocations.map((allocation, index) => {
      let allocationHtml = allocationTemplate;
      
      // Replace allocation-specific placeholders
      allocationHtml = allocationHtml.replace(/\{\{([^}]+)\}\}/g, (allocationMatch, allocationKey) => {
        const trimmedKey = allocationKey.trim();
        const value = allocation[trimmedKey];
        return value !== undefined && value !== null ? value : '';
      });
      return allocationHtml;
    }).join('');
  });

  // Handle negative conditional blocks for allocations {{^allocations}} {{/allocations}}
  const negativeAllocationsRegex = /\{\{\^allocations\}\}([\s\S]*?)\{\{\/allocations\}\}/g;
  processedHtml = processedHtml.replace(negativeAllocationsRegex, (match, content) => {
    if (!data.allocations || !Array.isArray(data.allocations) || data.allocations.length === 0) {
      return content; // Show content when no allocations
    } else {
      return ''; // Hide content when allocations exist
    }
  });

  // Handle conditional blocks ({{#key}} ... {{/key}}) - AFTER allocations
  Object.keys(data).forEach(key => {
    if (key !== 'items' && key !== 'allocations') {
      const value = data[key];
      const conditionalRegex = new RegExp(`\\{\\{#${key}\\}\\}([\\s\\S]*?)\\{\\{\\/${key}\\}\\}`, 'g');
      
      if (value && value !== '' && value !== null && value !== undefined) {
        // Show the content and replace the placeholder within it
        processedHtml = processedHtml.replace(conditionalRegex, (match, content) => {
          return content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
        });
      } else {
        // Remove the entire conditional block
        processedHtml = processedHtml.replace(conditionalRegex, '');
      }
    }
  });

  // Handle negative conditional blocks for all keys ({{^key}} {{/key}}) - exactly like frontend
  Object.keys(data).forEach(key => {
    if (key !== 'items' && key !== 'allocations') {
      const value = data[key];
      const negativeConditionalRegex = new RegExp(`\\{\\{\\^${key}\\}\\}([\\s\\S]*?)\\{\\{\\/${key}\\}\\}`, 'g');
      
      if (!value || value === '' || value === null || value === undefined) {
        // Show the content when value is falsy
        processedHtml = processedHtml.replace(negativeConditionalRegex, (match, content) => {
          return content;
        });
      } else {
        // Remove the entire negative conditional block when value is truthy
        processedHtml = processedHtml.replace(negativeConditionalRegex, '');
      }
    }
  });

  // Handle items array with special {{#items}} {{/items}} blocks
  const itemsRegex = /\{\{#items\}\}([\s\S]*?)\{\{\/items\}\}/g;
  processedHtml = processedHtml.replace(itemsRegex, (match, itemTemplate) => {
    if (!data.items || !Array.isArray(data.items)) {
      return '';
    }

    return data.items.map((item, index) => {
      let itemHtml = itemTemplate;
      
      // Replace item-specific placeholders
      itemHtml = itemHtml.replace(/\{\{([^}]+)\}\}/g, (itemMatch, itemKey) => {
        const trimmedKey = itemKey.trim();
        
        // Handle special cases
        if (trimmedKey === 'index') return index + 1;
        if (trimmedKey === 'serialNumbers') {
          return item.serialNumbers && Array.isArray(item.serialNumbers) 
            ? item.serialNumbers.join(', ') 
            : '';
        }
        
        const value = getNestedValue(item, trimmedKey);
        return value !== undefined && value !== null ? value : '';
      });
      
      return itemHtml;
    }).join('');
  });

  // Allocations already handled above

  // Replace simple placeholders like {{companyName}}
  processedHtml = processedHtml.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const value = getNestedValue(data, key.trim());
    return value !== undefined && value !== null ? value : '';
  });

  return processedHtml;
};

// Get user's default template or fallback to system default
export const getUserTemplate = async (userId, companyId, moduleType, templateId = null) => {
  const client = await pool.connect();
  
  try {
    let template = null;

    // If specific template ID is provided, use that
    if (templateId) {
      const specificTemplateQuery = `
        SELECT * FROM hisab."invoiceTemplates" 
        WHERE "id" = $1 
          AND "isActive" = true 
          AND "deletedAt" IS NULL
          AND ("companyId" IS NULL OR "companyId" = $2)
      `;
      const specificResult = await client.query(specificTemplateQuery, [templateId, companyId]);
      if (specificResult.rows.length > 0) {
        template = specificResult.rows[0];
      }
    }

    // If no specific template or template not found, get user's default
    if (!template) {
      const userDefaultQuery = `
        SELECT t.* FROM hisab."userTemplatePreferences" utp
        JOIN hisab."invoiceTemplates" t ON utp."templateId" = t."id"
        WHERE utp."userId" = $1 
          AND utp."companyId" = $2 
          AND utp."moduleType" = $3
          AND t."isActive" = true 
          AND t."deletedAt" IS NULL
      `;
      const userResult = await client.query(userDefaultQuery, [userId, companyId, moduleType]);
      if (userResult.rows.length > 0) {
        template = userResult.rows[0];
      }
    }

    // If still no template, get system default
    if (!template) {
      const systemDefaultQuery = `
        SELECT * FROM hisab."invoiceTemplates" 
        WHERE "moduleType" = $1 
          AND "isDefault" = true 
          AND "isActive" = true 
          AND "deletedAt" IS NULL
          AND ("companyId" IS NULL OR "companyId" = $2)
        ORDER BY "companyId" DESC NULLS LAST
        LIMIT 1
      `;
      const systemResult = await client.query(systemDefaultQuery, [moduleType, companyId]);
      if (systemResult.rows.length > 0) {
        template = systemResult.rows[0];
      }
    }

    return template;

  } finally {
    client.release();
  }
};

// Generate PDF from template
export const generatePDFFromTemplate = async (invoiceData, options = {}) => {
  const { 
    userId, 
    companyId, 
    moduleType, 
    templateId = null,
    pdfOptions = {},
    copies = 2 // Default to 2 copies per page
  } = options;

  let browser;
  let page;

  try {
    // Generate PDF from template data

    // Get the appropriate template
    const template = await getUserTemplate(userId, companyId, moduleType, templateId);
    
    if (!template) {
      throw new Error(`No template found for module type: ${moduleType}`);
    }

    // Using template for PDF generation

    // Process the HTML template with actual data
    let processedHtml = replacePlaceholders(template.htmlTemplate, invoiceData);
    
    // Template processing complete
    // Modify CSS based on number of copies
    processedHtml = adjustTemplateForCopies(processedHtml, copies);
    
    // If multiple copies, duplicate the content
    if (copies > 1) {
      processedHtml = generateMultipleCopies(processedHtml, copies);
    }

    // Template processed successfully

    // Generate PDF using browser pool
    browser = await browserPool.getBrowser();
    page = await browser.newPage();

    // Set user agent to avoid blocking
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Enable request interception to handle CORS and network issues
    await page.setRequestInterception(true);
    
    page.on('request', (req) => {
      // Allow all requests but add proper headers for images
      if (req.resourceType() === 'image') {
        req.continue({
          headers: {
            ...req.headers(),
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
          }
        });
      } else {
        req.continue();
      }
    });

    await page.setViewport({ width: 794, height: 1123 }); // A4 size
    
    // Set content and wait for all resources including images
    await page.setContent(processedHtml, {
      waitUntil: ['load', 'networkidle0'],
      timeout: 15000
    });
    
    // Additional wait for images to load with better error handling
    await page.evaluate(() => {
      return Promise.all(
        Array.from(document.images, img => {
          if (img.complete) return Promise.resolve();
          return new Promise((resolve) => {
            const timeout = setTimeout(() => {
              // If image fails to load, replace with fallback
              if (!img.complete) {
                img.style.display = 'none';
                const fallback = document.createElement('div');
                fallback.style.cssText = 'width: 80px; height: 80px; border: 2px solid #ccc; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #666; background: #f8f9fa; border-radius: 4px; margin: 0 auto;';
                fallback.textContent = 'LOGO';
                img.parentNode.appendChild(fallback);
              }
              resolve();
            }, 3000);
            
            img.addEventListener('load', () => {
              clearTimeout(timeout);
              resolve();
            });
            img.addEventListener('error', () => {
              clearTimeout(timeout);
              resolve();
            });
          });
        })
      );
    });

    const defaultPdfOptions = {
      format: 'A4',
      printBackground: true,
      margin: {
        top: '3mm',
        right: '3mm',
        bottom: '3mm',
        left: '3mm'
      },
      preferCSSPageSize: true,
      timeout: 10000
    };

    const finalPdfOptions = { ...defaultPdfOptions, ...pdfOptions };
    const pdfBuffer = await page.pdf(finalPdfOptions);

    return {
      pdfBuffer,
      template: {
        id: template.id,
        name: template.name,
        moduleType: template.moduleType
      },
      copies: copies
    };

  } finally {
    if (page) {
      await page.close();
    }
    if (browser) {
      await browserPool.returnBrowser(browser);
    }
  }
};

// Adjust template CSS based on number of copies
export const adjustTemplateForCopies = (html, copies) => {
  let copiesCSS = '';
  
  switch (copies) {
    case 1:
      copiesCSS = `
        .invoice-container, .invoice, .receipt { 
          width: 98% !important; 
          height: auto !important; 
          margin: 1% !important; 
          padding: 15px !important; 
          float: none !important; 
          font-size: 12px !important;
          border: 2px solid #000 !important;
          box-shadow: none !important;
          line-height: 1.3 !important;
        }
        .invoice-container *, .invoice *, .receipt * { 
          font-size: inherit !important; 
          line-height: 1.3 !important;
        }
        .company-name { font-size: 20px !important; margin-bottom: 4px !important; }
        .invoice-title, .receipt-title, .doc-header, .doc-banner, .invoice-banner { 
          font-size: 14px !important; 
          padding: 4px !important; 
          margin: 6px 0 !important;
        }
        .items-table th, .items-table td, .items-grid th, .items-grid td { 
          padding: 4px !important; 
          font-size: 10px !important; 
          line-height: 1.2 !important;
        }
        .items-table th, .items-grid th { 
          font-size: 9px !important; 
          font-weight: bold !important;
        }
        .total-section, .totals, .summary, .summary-section, .summary-card, .totals-card { 
          font-size: 11px !important; 
          padding: 6px !important;
          margin: 5px 0 !important;
        }
        .final-total, .grand-total, .summary-total, .summary-final { 
          font-size: 13px !important; 
          font-weight: bold !important;
          padding: 4px 0 !important;
        }
        .amount-words, .words-section, .words-box, .words-container, .words-panel { 
          font-size: 10px !important; 
          padding: 6px !important;
          margin: 5px 0 !important;
        }
        .customer-section, .customer-card, .customer-info, .supplier-section, .supplier-card { 
          padding: 6px !important; 
          margin: 5px 0 !important;
          font-size: 11px !important;
        }
        .section-title, .card-header, .customer-header, .supplier-header { 
          font-size: 10px !important; 
          margin-bottom: 4px !important;
        }
        .info-box, .detail-card, .meta-box { 
          padding: 4px !important; 
          font-size: 10px !important;
        }
        .header, .letterhead { 
          padding: 8px !important; 
          margin-bottom: 8px !important;
        }
        .footer, .signatures, .auth-section { 
          margin-top: 10px !important; 
          font-size: 9px !important;
        }
        .signature-line, .auth-line { 
          height: 30px !important; 
          margin-bottom: 5px !important;
        }
      `;
      break;
    case 2:
      copiesCSS = `
        .invoice-container, .invoice, .receipt { 
          width: 49% !important; 
          height: auto !important; 
          margin: 0.5% !important; 
          padding: 8px !important;
          float: left !important; 
          font-size: 10px !important;
          border: 1px solid #333 !important;
        }
        .invoice-container *, .invoice *, .receipt * { 
          font-size: inherit !important; 
          line-height: 1.2 !important;
        }
        .company-name { font-size: 16px !important; font-weight: bold !important; margin-bottom: 4px !important; }
        .invoice-title, .receipt-title, .doc-header, .doc-banner, .invoice-banner { 
          font-size: 12px !important; 
          padding: 4px !important; 
          margin: 6px 0 !important;
          background: #333 !important;
          color: #fff !important;
        }
        .header { padding: 6px !important; margin-bottom: 8px !important; }
        .customer-section, .customer-card, .supplier-section, .supplier-card { 
          padding: 6px !important; 
          margin: 6px 0 !important;
          font-size: 9px !important;
        }
        .section-title, .section-header { 
          font-size: 9px !important; 
          font-weight: bold !important;
          margin-bottom: 4px !important;
        }
        .customer-name, .supplier-name { 
          font-size: 11px !important; 
          font-weight: bold !important;
          color: #000 !important;
        }
        .items-table, .items-grid, .products-table, .allocations-table { 
          margin: 6px 0 !important;
        }
        .items-table th, .items-table td, .items-grid th, .items-grid td, 
        .products-table th, .products-table td, .allocations-table th, .allocations-table td { 
          padding: 3px 2px !important; 
          font-size: 8px !important; 
          border: 1px solid #333 !important;
        }
        .items-table th, .items-grid th, .products-table th, .allocations-table th { 
          background: #f0f0f0 !important;
          font-weight: bold !important;
          color: #000 !important;
        }
        .item-name, .item-description, .product-desc { 
          font-weight: bold !important;
          color: #000 !important;
        }
        .total-section, .totals, .summary, .totals-section, .calculations, .financial-summary { 
          padding: 6px !important; 
          margin: 6px 0 !important;
          font-size: 9px !important;
        }
        .final-total, .grand-total, .total-amount, .final-amount { 
          font-size: 11px !important; 
          font-weight: bold !important;
          color: #000 !important;
          background: #f0f0f0 !important;
          padding: 4px !important;
        }
        .amount-words, .words-section, .amount-declaration { 
          padding: 6px !important; 
          margin: 6px 0 !important;
          font-size: 8px !important;
        }
        .terms, .terms-section { 
          padding: 4px !important; 
          font-size: 7px !important;
        }
        .signatures, .signature-box { 
          margin-top: 8px !important;
          font-size: 7px !important;
        }
        .signature-line { 
          height: 15px !important;
          margin-bottom: 3px !important;
        }
      `;
      break;
    case 4:
      copiesCSS = `
        .invoice-container, .invoice, .receipt { 
          width: 49% !important; 
          height: auto !important; 
          margin: 0.5% !important; 
          padding: 6px !important; 
          float: left !important; 
          font-size: 8px !important;
          border: 1px solid #333 !important;
        }
        .invoice-container *, .invoice *, .receipt * { 
          font-size: inherit !important; 
          line-height: 1.1 !important;
          margin: 1px 0 !important;
          padding: 1px !important;
        }
        .company-name { 
          font-size: 12px !important; 
          font-weight: bold !important; 
          color: #000 !important;
          margin-bottom: 2px !important;
        }
        .invoice-title, .receipt-title, .doc-header, .doc-banner, .invoice-banner { 
          font-size: 9px !important; 
          padding: 2px !important; 
          margin: 3px 0 !important;
          background: #333 !important;
          color: #fff !important;
          font-weight: bold !important;
        }
        .header { padding: 4px !important; margin-bottom: 4px !important; }
        .customer-section, .customer-card, .supplier-section, .supplier-card { 
          padding: 4px !important; 
          margin: 3px 0 !important;
          font-size: 7px !important;
          background: #f9f9f9 !important;
        }
        .section-title, .section-header { 
          font-size: 7px !important; 
          font-weight: bold !important;
          color: #000 !important;
          margin-bottom: 2px !important;
        }
        .customer-name, .supplier-name { 
          font-size: 8px !important; 
          font-weight: bold !important;
          color: #000 !important;
        }
        .items-table, .items-grid, .products-table, .allocations-table { 
          margin: 3px 0 !important;
        }
        .items-table th, .items-table td, .items-grid th, .items-grid td,
        .products-table th, .products-table td, .allocations-table th, .allocations-table td { 
          padding: 2px 1px !important; 
          font-size: 6px !important; 
          border: 1px solid #333 !important;
        }
        .items-table th, .items-grid th, .products-table th, .allocations-table th { 
          background: #f0f0f0 !important;
          font-weight: bold !important;
          color: #000 !important;
        }
        .item-name, .item-description, .product-desc { 
          font-weight: bold !important;
          color: #000 !important;
        }
        .total-section, .totals, .summary, .totals-section, .calculations, .financial-summary { 
          padding: 4px !important; 
          margin: 3px 0 !important;
          font-size: 7px !important;
          background: #f9f9f9 !important;
        }
        .final-total, .grand-total, .total-amount, .final-amount { 
          font-size: 8px !important; 
          font-weight: bold !important;
          color: #000 !important;
          background: #f0f0f0 !important;
          padding: 2px !important;
        }
        .amount-section { 
          font-size: 9px !important;
          font-weight: bold !important;
          color: #000 !important;
          background: #f0f0f0 !important;
          padding: 4px !important;
        }
        .detail-box { 
          padding: 3px !important;
          font-size: 7px !important;
        }
        .detail-value { 
          font-size: 8px !important;
          font-weight: bold !important;
          color: #000 !important;
        }
        /* Hide less important elements for space */
        .amount-words, .words-section, .words-box, .words-container, .words-panel { display: none !important; }
        .terms, .terms-section, .terms-text { display: none !important; }
        .signatures, .auth-section, .footer-section, .footer { display: none !important; }
        .company-tagline, .company-subtitle { display: none !important; }
        .item-code, .item-hsn, .product-code { display: none !important; }
        .tax-breakdown { display: none !important; }
      `;
      break;
  }
  
  // Inject the CSS into the template
  const cssInjection = `<style>${copiesCSS}</style></head>`;
  return html.replace('</head>', cssInjection);
};

// Generate multiple copies of the invoice
export const generateMultipleCopies = (html, copies) => {
  const bodyContent = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyContent) return html;
  
  const singleInvoice = bodyContent[1];
  let multipleCopies = '';
  
  for (let i = 0; i < copies; i++) {
    multipleCopies += singleInvoice;
    
    // Add page break after every 2 copies for 4-copy layout
    if (copies === 4 && i === 1) {
      multipleCopies += '<div class="page-break"></div>';
    }
  }
  
  // Add clear float after all copies
  multipleCopies += '<div style="clear: both; height: 0;"></div>';
  
  return html.replace(bodyContent[1], multipleCopies);
};

// Generate filename for invoice PDF
export const generateInvoicePDFFileName = (invoiceData, moduleType) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const invoiceNumber = invoiceData.invoiceNumber || invoiceData.receiptNumber || 'INV';
  const prefix = moduleType === 'sales' ? 'SI' : moduleType === 'purchase' ? 'PI' : 'RCP';
  
  return `${prefix}_${invoiceNumber}_${timestamp}.pdf`;
};

// Generate unique filename for payment PDF
export const generatePaymentPDFFileName = (paymentNumber, companyName) => {
  const timestamp = Date.now();
  const cleanPaymentNumber = paymentNumber.toString().replace(/[^a-zA-Z0-9]/g, '_');
  const cleanCompanyName = companyName.toString().replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
  return `payment_${cleanCompanyName}_${cleanPaymentNumber}_${timestamp}.pdf`;
};

// Create template data for sales invoice
export const createSalesInvoiceTemplateData = (invoiceData) => {
  const { sale, company, contact, bankAccount, items = [] } = invoiceData;

  // Calculate totals
  const basicAmount = parseFloat(sale.basicAmount || 0);
  const totalDiscount = parseFloat(sale.totalDiscount || 0);
  const taxAmount = parseFloat(sale.taxAmount || 0);
  const transportationCharge = parseFloat(sale.transportationCharge || 0);
  const roundOff = parseFloat(sale.roundOff || 0);
  const netReceivable = parseFloat(sale.netReceivable || 0);

  // Calculate tax breakdowns (assuming 18% GST split into CGST + SGST)
  const cgstAmount = (taxAmount / 2).toFixed(2);
  const sgstAmount = (taxAmount / 2).toFixed(2);
  const igstAmount = '0.00'; // For interstate transactions
  const cgstRate = taxAmount > 0 ? '9' : '0';
  const sgstRate = taxAmount > 0 ? '9' : '0';
  const igstRate = taxAmount > 0 ? '18' : '0';

  return {
    // Company details
    companyName: company?.name || '',
    companyAddress: [
      company?.address1,
      company?.address2,
      company?.city,
      company?.state,
      company?.pincode
    ].filter(Boolean).join(', '),
    companyGstin: company?.gstin || '',
    companyLogoUrl: (() => {
      // Return null/undefined if no logo exists to properly hide logo sections
      const logoUrl = company?.logoUrl;
      if (!logoUrl || logoUrl.trim() === '') {
        return null; // This will make {{#companyLogoUrl}} conditional blocks hide
      }
      return logoUrl;
    })(),

    // Invoice details
    invoiceNumber: sale?.invoiceNumber || '',
    invoiceDate: sale?.invoiceDate ? new Date(sale.invoiceDate).toLocaleDateString('en-IN') : '',
    
    // Customer details
    customerName: contact?.name || bankAccount?.accountName || 'Walk-in Customer',
    customerAddress: contact ? [
      contact?.billingAddress1,
      contact?.billingAddress2,
      contact?.billingCity,
      contact?.billingState,
      contact?.billingPincode
    ].filter(Boolean).join(', ') : '',
    customerGstin: contact?.gstin || '',
    customerMobile: contact?.mobile || '',

    // Items with enhanced tax and discount details
    items: items.map((item, index) => {
      const rate = parseFloat(item.rate || 0);
      const taxRate = parseFloat(item.taxRate || 0);
      // Calculate rate without tax based on rate type
      let rateWithoutTax;
      if (item.rateType === 'with_tax' && taxRate > 0) {
        // Rate includes tax, so extract the base rate
        rateWithoutTax = rate / (1 + (taxRate / 100));
      } else {
        // Rate is already without tax or no tax applicable
        rateWithoutTax = rate;
      }
      
      return {
        index: index + 1,
        name: item.name || item.productName || '',
        hsnCode: item.hsnCode || item.hsn || '',
        quantity: parseFloat(item.quantity || 0),
        rate: rate.toFixed(2),
        rateWithoutTax: rateWithoutTax.toFixed(2),
        discount: parseFloat(item.discount || 0).toFixed(2),
        taxRate: parseFloat(item.taxRate || 0),
        taxAmount: parseFloat(item.taxAmount || 0).toFixed(2),
        total: parseFloat(item.total || item.lineTotal || 0).toFixed(2)
      };
    }),

    // Totals
    basicAmount: items.reduce((sum, item) => {
      const quantity = parseFloat(item.quantity || 0);
      const rate = parseFloat(item.rate || 0);
      const taxRate = parseFloat(item.taxRate || 0);
      // Calculate rate without tax based on rate type (assuming backend data follows same logic)
      let rateWithoutTax;
      if (item.rateType === 'with_tax' && taxRate > 0) {
        // Rate includes tax, so extract the base rate
        rateWithoutTax = rate / (1 + (taxRate / 100));
      } else {
        // Rate is already without tax or no tax applicable
        rateWithoutTax = rate;
      }
      return sum + (quantity * rateWithoutTax);
    }, 0).toFixed(2),
    totalDiscount: totalDiscount.toFixed(2),
    taxAmount: taxAmount.toFixed(2),
    cgstAmount: cgstAmount,
    sgstAmount: sgstAmount,
    igstAmount: igstAmount,
    cgstRate: cgstRate,
    sgstRate: sgstRate,
    igstRate: igstRate,
    transportationCharge: transportationCharge.toFixed(2),
    roundOff: roundOff.toFixed(2),
    netReceivable: netReceivable.toFixed(2),
    amountInWords: convertNumberToWords(netReceivable),

    // Status
    status: sale?.status ? sale.status.charAt(0).toUpperCase() + sale.status.slice(1) : 'Pending',
    
    // Website URL (will be replaced by backend)
    FRONTEND_URL: process.env.FRONTEND_URL || ''
  };
};

// Create template data for purchase invoice
export const createPurchaseInvoiceTemplateData = (invoiceData) => {
  const { purchase, company, contact, bankAccount, items = [] } = invoiceData;

  // Calculate totals
  const basicAmount = parseFloat(purchase.basicAmount || 0);
  const totalDiscount = parseFloat(purchase.totalDiscount || 0);
  const taxAmount = parseFloat(purchase.taxAmount || 0);
  const transportationCharge = parseFloat(purchase.transportationCharge || 0);
  const roundOff = parseFloat(purchase.roundOff || 0);
  const netPayable = parseFloat(purchase.netPayable || 0);

  return {
    // Company details
    companyName: company?.name || '',
    companyNameEnglish: company?.nameEnglish || company?.name || '',
    companyAddress: [
      company?.address1,
      company?.address2,
      company?.city,
      company?.state,
      company?.pincode
    ].filter(Boolean).join(', '),
    companyGstin: company?.gstin || '',
    companyLogoUrl: (() => {
      const logoUrl = company?.logoUrl;
      if (!logoUrl || logoUrl.trim() === '') {
        return null; // This will make {{#companyLogoUrl}} conditional blocks hide
      }
      return logoUrl;
    })(),
    companyPan: company?.pan || 'ABCDE1234F',
    companyCin: company?.cin || 'U12345AB1234PTC123456',

    // Invoice details
    invoiceNumber: purchase?.invoiceNumber || '',
    invoiceDate: purchase?.invoiceDate ? new Date(purchase.invoiceDate).toLocaleDateString('en-IN') : '',
    dueDate: purchase?.dueDate ? new Date(purchase.dueDate).toLocaleDateString('en-IN') : '',
    
    // Supplier details (for purchase templates)
    supplierName: contact?.name || '',
    supplierAddress: [
      contact?.billingAddress1,
      contact?.billingAddress2,
      contact?.billingCity,
      contact?.billingState,
      contact?.billingPincode
    ].filter(Boolean).join(', '),
    supplierGstin: contact?.gstin || '',
    supplierEmail: contact?.email || '',
    supplierMobile: contact?.mobile || '',
    supplierPan: contact?.pan || '',
    
    // Also keep vendor fields for backward compatibility
    vendorName: contact?.name || '',
    vendorAddress: [
      contact?.billingAddress1,
      contact?.billingAddress2,
      contact?.billingCity,
      contact?.billingState,
      contact?.billingPincode
    ].filter(Boolean).join(', '),
    vendorGstin: contact?.gstin || '',
    vendorEmail: contact?.email || '',
    vendorMobile: contact?.mobile || '',
    vendorPan: contact?.pan || '',

    // Bank details
    bankAccountName: bankAccount?.accountName || '',
    bankAccountType: bankAccount?.accountType || '',

    // Items with enhanced tax and discount details
    items: items.map((item, index) => {
      const rate = parseFloat(item.rate || 0);
      const taxRate = parseFloat(item.taxRate || 0);
      // Calculate rate without tax based on rate type
      let rateWithoutTax;
      if (item.rateType === 'with_tax' && taxRate > 0) {
        // Rate includes tax, so extract the base rate
        rateWithoutTax = rate / (1 + (taxRate / 100));
      } else {
        // Rate is already without tax or no tax applicable
        rateWithoutTax = rate;
      }
      
      return {
        index: index + 1,
        name: item.name || item.productName || '',
        code: item.code || item.productCode || '',
        hsnCode: item.hsnCode || item.hsn || '1234',
        quantity: parseFloat(item.qty || item.quantity || 0), // Purchase items use 'qty', sales use 'quantity'
        rate: rate.toFixed(2),
        rateWithoutTax: rateWithoutTax.toFixed(2),
        discount: parseFloat(item.discountAmount || item.discount || 0).toFixed(2),
        taxRate: parseFloat(item.taxRate || 0),
        taxAmount: parseFloat(item.taxAmount || 0).toFixed(2),
        total: parseFloat(item.total || item.lineTotal || 0).toFixed(2),
        serialNumbers: item.serialNumbers || [],
        unit: item.unit || 'Nos'
      };
    }),

    // Totals with tax breakdown
    basicAmount: items.reduce((sum, item) => {
      const quantity = parseFloat(item.qty || item.quantity || 0);
      const rate = parseFloat(item.rate || 0);
      const taxRate = parseFloat(item.taxRate || 0);
      // Calculate rate without tax based on rate type
      let rateWithoutTax;
      if (item.rateType === 'with_tax' && taxRate > 0) {
        // Rate includes tax, so extract the base rate
        rateWithoutTax = rate / (1 + (taxRate / 100));
      } else {
        // Rate is already without tax or no tax applicable
        rateWithoutTax = rate;
      }
      return sum + (quantity * rateWithoutTax);
    }, 0).toFixed(2),
    totalDiscount: totalDiscount.toFixed(2),
    taxAmount: taxAmount.toFixed(2),
    cgstAmount: (taxAmount / 2).toFixed(2),
    sgstAmount: (taxAmount / 2).toFixed(2),
    igstAmount: '0.00',
    cgstRate: taxAmount > 0 ? '9' : '0',
    sgstRate: taxAmount > 0 ? '9' : '0',
    igstRate: taxAmount > 0 ? '18' : '0',
    transportationCharge: transportationCharge.toFixed(2),
    roundOff: roundOff.toFixed(2),
    netPayable: netPayable.toFixed(2),
    netReceivable: netPayable.toFixed(2), // Purchase templates use netReceivable
    amountInWords: convertNumberToWords(netPayable),

    // Status and additional info
    status: purchase?.status ? purchase.status.charAt(0).toUpperCase() + purchase.status.slice(1) : 'Pending',
    
    // Notes
    internalNotes: purchase?.internalNotes || '',
    
    // Additional professional fields
    businessCode: 'BC001',
    licenseNumber: 'LIC123456',
    
    // Website URL (will be replaced by backend)
    FRONTEND_URL: process.env.FRONTEND_URL || 'yourdomain.com'
  };
};

// Create template data for payment receipt
export const createPaymentReceiptTemplateData = (paymentData) => {
  const { payment, company, contact, bankAccount, allocations = [] } = paymentData;

  // Process allocations for template
  const validAllocations = allocations.filter(a => parseFloat(a.paidAmount || 0) > 0);

  const amount = parseFloat(payment.amount || 0);

  return {
    // Company details
    companyName: company?.name || '',
    companyNameEnglish: company?.nameEnglish || company?.name || '',
    companyAddress: [
      company?.address1,
      company?.address2,
      company?.city,
      company?.state,
      company?.pincode
    ].filter(Boolean).join(', '),
    companyGstin: company?.gstin || '',
    companyLogoUrl: (() => {
      const logoUrl = company?.logoUrl;
      if (!logoUrl || logoUrl.trim() === '') {
        return null; // This will make {{#companyLogoUrl}} conditional blocks hide
      }
      return logoUrl;
    })(),
    companyPan: company?.pan || 'ABCDE1234F',
    companyCin: company?.cin || 'U12345AB1234PTC123456',

    // Receipt details
    receiptNumber: payment?.receiptNumber || payment?.paymentNumber || '',
    receiptDate: payment?.paymentDate ? new Date(payment.paymentDate).toLocaleDateString('en-IN') : 
                 payment?.date ? new Date(payment.date).toLocaleDateString('en-IN') : 
                 new Date().toLocaleDateString('en-IN'),
    
    // Customer details
    customerName: contact?.name || '',
    customerAddress: [
      contact?.billingAddress1,
      contact?.billingAddress2,
      contact?.billingCity,
      contact?.billingState,
      contact?.billingPincode
    ].filter(Boolean).join(', '),
    customerGstin: contact?.gstin || '',
    customerEmail: contact?.email || '',
    customerMobile: contact?.mobile || '',
    customerPan: contact?.pan || '',

    // Payment details
    amount: amount.toFixed(2),
    amountInWords: convertNumberToWords(amount),
    paymentMethod: payment?.paymentMethod || 'Cash',
    bankAccountName: bankAccount?.accountName || '',
    
    // Notes
    notes: payment?.notes || payment?.description || '',
    
    // Transaction allocations (what this payment was for)
    allocations: validAllocations.map((allocation, index) => {
      const mapped = {
        index: index + 1,
        description: allocation.description || 'Payment allocation',
        reference: allocation.reference || 'N/A',
        amount: parseFloat(allocation.paidAmount || 0).toFixed(2),
        type: allocation.allocationType || 'general',
        allocationType: allocation.allocationType || 'general',
        balanceType: allocation.balanceType || 'payable',
        balanceTypeDisplay: allocation.balanceType === 'receivable' ? 'Receivable' : 'Payable',
        balanceTypeGujarati: allocation.balanceType === 'receivable' ? 'મળવાપાત્ર' : 'ચૂકવવાપાત્ર',
        transactionId: allocation.transactionId || 'N/A',
        date: allocation.date ? new Date(allocation.date).toLocaleDateString('en-IN') : ''
      };
      
      console.log('🔍 Payment Template Allocation Debug:', {
        originalAllocation: allocation,
        mappedAllocation: mapped
      });
      
      return mapped;
    }),
    
    // Summary of allocations
    totalAllocations: validAllocations.length,
    hasAllocations: validAllocations.length > 0,
    

    
    // Additional professional fields
    businessCode: 'BC001',
    licenseNumber: 'LIC123456',
    transactionId: `TXN${payment?.receiptNumber || payment?.paymentNumber || ''}`,
    
    // Website URL (will be replaced by backend)
    FRONTEND_URL: process.env.FRONTEND_URL || 'yourdomain.com'
  };
  
  console.log('🔍 Final Payment Template Data:', {
    hasAllocations: result.hasAllocations,
    totalAllocations: result.totalAllocations,
    allocationsCount: result.allocations?.length || 0,
    firstAllocation: result.allocations?.[0]
  });
  
  return result;
}; 