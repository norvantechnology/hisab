// Generate sample data for template preview
export const generateSampleData = (moduleType, companyInfo = {}) => {
  const today = new Date().toLocaleDateString('en-IN');
  
  // Get actual frontend URL from environment or use current domain
  const frontendUrl = process.env.REACT_APP_API_BASE_URL 
    ? process.env.REACT_APP_API_BASE_URL.replace('/api', '') 
    : window.location.origin;

  switch (moduleType) {
    case 'sales':
      return {
        companyName: 'Norvan Technology',
        companyAddress: '203, platinum point, surat, gujarat, 394101',
        companyGstin: 'GSTIN123456789', // Show in preview
        companyLogoUrl: (() => {
          const logoUrl = companyInfo?.logoUrl;
          if (!logoUrl || logoUrl.trim() === '') {
            return null; // This will make {{#companyLogoUrl}} conditional blocks hide
          }
          return logoUrl;
        })(), // Return null when no logo to properly hide logo sections
        invoiceNumber: 'SI-0012',
        invoiceDate: today,
        customerName: 'જ્યોતિના કાર્ડિયમ',
        customerAddress: '202, platinum point સુરત, ગુજરાત, 394101',
        customerMobile: '9870008173',
        customerGstin: 'GSTIN987654321',
        status: 'Paid',
        items: [
          {
            name: 'Samsung Galaxy S23',
            quantity: 1,
            rate: '74999.00',
            taxRate: 18,
            taxAmount: '13499.82',
            discount: '0.00',
            total: '74999.00',
            index: 1
          }
        ],
        basicAmount: '74999.00',
        taxAmount: '13499.82',
        cgstAmount: '6749.91',
        sgstAmount: '6749.91',
        igstAmount: '0.00',
        cgstRate: '9',
        sgstRate: '9',
        igstRate: '0',
        totalDiscount: '0.00',
        transportationCharge: '0.00',
        roundOff: '0.00',
        netReceivable: '74999.00',
        amountInWords: 'Seventy Four Thousand Nine Hundred Ninety Nine Only',
        FRONTEND_URL: frontendUrl
      };

    case 'purchase':
      return {
        companyName: 'Sample Company',
        companyAddress: 'Address Line 1, City, State - 000000',
        companyGstin: 'GSTIN123456789',
        companyLogoUrl: (() => {
          const logoUrl = companyInfo?.logoUrl;
          if (!logoUrl || logoUrl.trim() === '') {
            return null; // This will make {{#companyLogoUrl}} conditional blocks hide
          }
          return logoUrl;
        })(), // Return null when no logo to properly hide logo sections
        invoiceNumber: 'PI-0001',
        invoiceDate: today,
        supplierName: 'Sample Supplier',
        supplierAddress: 'Supplier Address Line 1, City, State - 123456',
        supplierMobile: '9876543210',
        supplierGstin: 'GSTIN987654321',
        vendorName: 'Sample Vendor', // Keep for backward compatibility
        vendorAddress: 'Vendor Address Line 1, City, State - 123456',
        vendorMobile: '9876543210',
        status: 'Pending',
        items: [
          {
            name: 'Sample Item 1',
            quantity: 3,
            rate: '150.00',
            taxRate: 18,
            taxAmount: '81.00',
            discount: '0.00',
            total: '531.00',
            index: 1
          }
        ],
        basicAmount: '450.00',
        taxAmount: '81.00',
        cgstAmount: '40.50',
        sgstAmount: '40.50',
        igstAmount: '0.00',
        cgstRate: '9',
        sgstRate: '9',
        igstRate: '0',
        totalDiscount: '0.00',
        transportationCharge: '0.00',
        roundOff: '0.00',
        netPayable: '531.00',
        amountInWords: 'Five Hundred Thirty One Only',
        FRONTEND_URL: frontendUrl
      };

    case 'payment':
      return {
        companyName: 'Sample Company',
        companyAddress: 'Address Line 1, City, State - 000000',
        companyGstin: 'GSTIN123456789',
        companyLogoUrl: (() => {
          const logoUrl = companyInfo?.logoUrl;
          if (!logoUrl || logoUrl.trim() === '') {
            return null; // This will make {{#companyLogoUrl}} conditional blocks hide
          }
          return logoUrl;
        })(), // Return null when no logo to properly hide logo sections
        receiptNumber: 'RCP-0001',
        receiptDate: today,
        customerName: 'Sample Customer',
        customerAddress: 'Customer Address Line 1, City, State - 123456',
        customerMobile: '9876543210',
        customerGstin: 'GSTIN987654321',
        amount: '1000.00',
        paymentMethod: 'Bank Transfer',
        bankAccountName: 'HDFC Bank - Current Account',
        amountInWords: 'One Thousand Only',
        FRONTEND_URL: frontendUrl
      };

    default:
      return {};
  }
};

// Helper function to safely get nested object values (matches backend)
const getNestedValue = (obj, path) => {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : '';
  }, obj);
};

// Generate preview HTML from template and data (matches backend replacePlaceholders exactly)
export const generatePreviewHTML = (template, data) => {
  if (!template || !template.htmlTemplate || !data) return '';



  let processedHtml = template.htmlTemplate;

  // Handle allocations FIRST - exactly like backend
  // (Moved to before conditional blocks)

  // Handle allocations array with special {{#allocations}} {{/allocations}} blocks - ADDED FOR PAYMENTS
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
    const hasAllocations = data.allocations && Array.isArray(data.allocations) && data.allocations.length > 0;
    
    if (!hasAllocations) {
      return content; // Show content when no allocations
    } else {
      return ''; // Hide content when allocations exist
    }
  });

  // Handle items array with special {{#items}} {{/items}} blocks - exactly like backend
  const itemsRegex = /\{\{#items\}\}([\s\S]*?)\{\{\/items\}\}/g;
  processedHtml = processedHtml.replace(itemsRegex, (match, itemTemplate) => {
    if (!data.items || !Array.isArray(data.items)) {
      return '';
    }

    return data.items.map((item, index) => {
      let itemHtml = itemTemplate;
      
      // Replace item-specific placeholders - exactly like backend
      itemHtml = itemHtml.replace(/\{\{([^}]+)\}\}/g, (itemMatch, itemKey) => {
        const trimmedKey = itemKey.trim();
        
        // Handle special cases - exactly like backend
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

  // Handle conditional blocks AFTER allocations and items - exactly like backend
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

  // Handle negative conditional blocks for all keys ({{^key}} {{/key}}) - exactly like backend
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



  // Handle image loading issues for print context - add onerror fallback to all logo images
  processedHtml = processedHtml.replace(
    /<img([^>]*src="[^"]*"[^>]*)>/g,
    (match, imgAttributes) => {
      // Check if this is a logo image and doesn't already have onerror
      if (imgAttributes.includes('alt="Logo"') || imgAttributes.includes('alt="Company Logo"')) {
        if (!imgAttributes.includes('onerror=')) {
          return `<img${imgAttributes} onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\\'font-size: 8px; color: #999; font-weight: bold; text-align: center; line-height: 1.2; padding: 5px;\\'>LOGO</div>';">`;
        }
      }
      return match;
    }
  );

  // Replace simple placeholders like {{companyName}} - exactly like backend
  processedHtml = processedHtml.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const value = getNestedValue(data, key.trim());
    return value !== undefined && value !== null ? value : '';
  });

  // Add error handling to logo images that don't already have it
  processedHtml = processedHtml.replace(
    /<img([^>]*src="[^"]*"[^>]*alt="[^"]*Logo[^"]*"[^>]*)>/gi,
    (match, imgAttributes) => {

      
      // Only add onerror if it doesn't already exist
      if (!imgAttributes.includes('onerror=')) {
        return `<img${imgAttributes} onerror="this.style.display='none'; var placeholder = document.createElement('div'); placeholder.style.cssText = 'font-size: 8px; color: #999; font-weight: bold; text-align: center; line-height: 1.2; padding: 5px;'; placeholder.textContent = 'LOGO'; this.parentElement.appendChild(placeholder);">`;
      }
      return match;
    }
  );



  return processedHtml;
};

// Adjust template CSS for different copy counts (matches backend logic exactly)
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

// Generate multiple copies of the invoice (matches backend logic)
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