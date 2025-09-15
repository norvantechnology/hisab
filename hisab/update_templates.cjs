const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: { rejectUnauthorized: false }
});

// Professional Templates
const templates = [
  // SALES TEMPLATES
  {
    id: 1,
    name: 'Traditional Gujarati Sales',
    moduleType: 'sales',
    isDefault: true,
    htmlTemplate: `<!DOCTYPE html>
<html>
<head>image.png
  <meta charset="UTF-8">
  <title>Sales Invoice - {{invoiceNumber}}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Noto Sans Gujarati', Arial, sans-serif; font-size: 10px; line-height: 1.2; color: #000; }
    .invoice { width: 48%; min-height: 45vh; max-height: none; margin: 0.5%; padding: 8px; border: 2px solid #000; float: left; page-break-inside: avoid; background: #fff; }
    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 6px; }
    .company-name { font-size: 16px; font-weight: bold; margin-bottom: 2px; }
    .company-address { font-size: 9px; color: #333; margin-bottom: 1px; }
    .company-gstin { font-size: 8px; color: #666; }
    .invoice-title { background: #000; color: #fff; text-align: center; padding: 3px; margin-bottom: 5px; font-size: 11px; font-weight: bold; }
    .invoice-info { display: flex; justify-content: space-between; margin-bottom: 5px; }
    .info-box { border: 1px solid #000; padding: 3px; text-align: center; background: #f0f0f0; width: 48%; font-size: 9px; }
    .customer-section { border: 1px solid #000; padding: 4px; margin-bottom: 5px; background: #f9f9f9; }
    .section-title { font-size: 9px; font-weight: bold; margin-bottom: 2px; border-bottom: 1px solid #000; padding-bottom: 1px; }
    .items-table { width: 100%; border-collapse: collapse; border: 2px solid #000; margin-bottom: 5px; }
    .items-table th { background: #e0e0e0; padding: 1.5px; font-size: 7px; font-weight: bold; border: 1px solid #000; text-align: center; line-height: 1.1; }
    .items-table td { border: 1px solid #000; padding: 1px; font-size: 7px; text-align: center; line-height: 1.1; }
    .item-name { text-align: left !important; }
    .total-section { border: 1px solid #000; padding: 4px; background: #f0f0f0; text-align: right; margin-bottom: 5px; }
    .total-row { font-size: 8px; margin-bottom: 1px; line-height: 1.1; }
    .final-total { font-weight: bold; border-top: 2px solid #000; padding-top: 2px; margin-top: 2px; font-size: 9px; }
    .amount-words { border: 1px solid #000; padding: 3px; background: #f9f9f9; margin-bottom: 4px; font-size: 8px; line-height: 1.2; }
    .footer { display: flex; justify-content: space-between; font-size: 8px; color: #666; }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="header">
      {{#companyLogoUrl}}
      <div class="company-logo">
        <img src="{{companyLogoUrl}}" alt="Logo" style="max-width: 30px; max-height: 30px; object-fit: contain;">
      </div>
      {{/companyLogoUrl}}
      {{^companyLogoUrl}}
      <div class="company-logo placeholder">
        <div style="font-size: 6px; color: #999;">LOGO</div>
      </div>
      {{/companyLogoUrl}}
      <div class="company-info">
        <div class="company-name">{{companyName}}</div>
        <div class="company-address">{{companyAddress}}</div>
        {{#companyGstin}}<div class="company-gstin">જીએસટીઆઈએન: {{companyGstin}}</div>{{/companyGstin}}
      </div>
    </div>
    
    <div class="invoice-title">વેચાણ બિલ / SALES INVOICE</div>
    
    <div class="invoice-info">
      <div class="info-box">
        <div><strong>બિલ નં. / Bill No.</strong></div>
        <div>{{invoiceNumber}}</div>
      </div>
      <div class="info-box">
        <div><strong>તારીખ / Date</strong></div>
        <div>{{invoiceDate}}</div>
      </div>
    </div>
    
    <div class="customer-section">
      <div class="section-title">ગ્રાહક વિગતો / CUSTOMER DETAILS</div>
      <div><strong>{{customerName}}</strong></div>
      {{#customerAddress}}<div>{{customerAddress}}</div>{{/customerAddress}}
      {{#customerGstin}}<div><strong>જીએસટીઆઈએન:</strong> {{customerGstin}}</div>{{/customerGstin}}
      {{#customerMobile}}<div><strong>મોબાઇલ:</strong> {{customerMobile}}</div>{{/customerMobile}}
    </div>
    
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 6%;">ક્રમ<br>Sr</th>
          <th style="width: 35%;">માલનું નામ<br>Product</th>
          <th style="width: 8%;">નંગ<br>Qty</th>
          <th style="width: 12%;">ભાવ (કર વગર)<br>Rate (Without tax)</th>
          <th style="width: 8%;">છૂટ<br>Disc</th>
          <th style="width: 7%;">કર%<br>Tax</th>
          <th style="width: 10%;">કર રકમ<br>Tax Amt</th>
          <th style="width: 14%;">કુલ<br>Total</th>
        </tr>
      </thead>
      <tbody>
        {{#items}}
        <tr>
          <td>{{index}}</td>
          <td class="item-name">{{name}}</td>
          <td>{{quantity}}</td>
          <td>₹{{rateWithoutTax}}</td>
          <td>{{#discount}}₹{{discount}}{{/discount}}{{^discount}}-{{/discount}}</td>
          <td>{{taxRate}}%</td>
          <td>₹{{taxAmount}}</td>
          <td>₹{{total}}</td>
        </tr>
        {{/items}}
      </tbody>
    </table>
    
    <div class="total-section">
      <div class="total-row">મૂળ રકમ / Subtotal: ₹{{basicAmount}}</div>
      {{#totalDiscount}}<div class="total-row">કુલ છૂટ / Discount: -₹{{totalDiscount}}</div>{{/totalDiscount}}
      {{#cgstAmount}}<div class="total-row">સી.જી.એસ.ટી / CGST ({{cgstRate}}%): ₹{{cgstAmount}}</div>{{/cgstAmount}}
      {{#sgstAmount}}<div class="total-row">એસ.જી.એસ.ટી / SGST ({{sgstRate}}%): ₹{{sgstAmount}}</div>{{/sgstAmount}}
      {{#igstAmount}}<div class="total-row">આઈ.જી.એસ.ટી / IGST ({{igstRate}}%): ₹{{igstAmount}}</div>{{/igstAmount}}
      {{#transportationCharge}}<div class="total-row">પરિવહન / Transport: ₹{{transportationCharge}}</div>{{/transportationCharge}}
      {{#roundOff}}<div class="total-row">રાઉન્ડ ઓફ / Round Off: ₹{{roundOff}}</div>{{/roundOff}}
      <div class="final-total">કુલ રકમ / TOTAL: ₹{{netReceivable}}</div>
    </div>
    
    <div class="amount-words">
      <strong>અક્ષરે રકમ / Amount in Words:</strong> {{amountInWords}}
    </div>
    
    <div class="footer">
      <div>આભાર / Thank You</div>
      <div>સ્ટેટસ: {{status}}</div>
    </div>
  </div>
</body>
</html>`
  },
  
  {
    id: 2,
    name: 'Business Gujarati Sales',
    moduleType: 'sales',
    isDefault: false,
    htmlTemplate: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Sales Invoice - {{invoiceNumber}}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Noto Sans Gujarati', Arial, sans-serif; font-size: 10px; color: #000; line-height: 1.2; }
    .invoice { width: 48%; min-height: 45vh; max-height: none; margin: 0.5%; padding: 8px; border: 1px solid #333; float: left; page-break-inside: avoid; background: #fff; }
    .header { display: flex; align-items: center; border-bottom: 2px solid #333; padding-bottom: 6px; margin-bottom: 8px; }
    .logo { width: 50px; height: 50px; border: 1px solid #ccc; margin-right: 10px; display: flex; align-items: center; justify-content: center; }
    .company-info { flex: 1; }
    .company-name { font-size: 18px; font-weight: bold; margin-bottom: 2px; }
    .company-details { font-size: 9px; color: #666; }
    .invoice-banner { background: #f0f0f0; border: 1px solid #333; text-align: center; padding: 4px; margin-bottom: 8px; }
    .meta { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 10px; }
    .customer { border: 1px solid #333; padding: 5px; margin-bottom: 8px; background: #fafafa; }
    .items-table { width: 100%; border-collapse: collapse; border: 1px solid #333; margin-bottom: 8px; }
    .items-table th { background: #e8e8e8; padding: 3px; font-size: 8px; border: 1px solid #333; text-align: center; }
    .items-table td { border: 1px solid #333; padding: 2px; font-size: 8px; text-align: center; }
    .item-desc { text-align: left !important; }
    .totals { border: 1px solid #333; padding: 5px; background: #f5f5f5; text-align: right; margin-bottom: 6px; }
    .total-line { font-size: 9px; margin-bottom: 1px; }
    .grand-total { font-weight: bold; border-top: 1px solid #333; padding-top: 2px; margin-top: 2px; }
    .words { border: 1px solid #333; padding: 4px; background: #fafafa; margin-bottom: 6px; font-size: 9px; }
    .signatures { display: flex; justify-content: space-between; margin-top: 10px; }
    .sign-box { text-align: center; width: 45%; }
    .sign-line { border-bottom: 1px solid #333; height: 20px; margin-bottom: 3px; }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="header">
      {{#companyLogoUrl}}
      <div class="logo">
        <img src="{{companyLogoUrl}}" style="max-width: 45px; max-height: 45px;">
      </div>
      {{/companyLogoUrl}}
      {{^companyLogoUrl}}
      <div class="logo" style="font-size: 8px; color: #999;">LOGO</div>
      {{/companyLogoUrl}}
      <div class="company-info">
        <div class="company-name">{{companyName}}</div>
        <div class="company-details">{{companyAddress}}</div>
        {{#companyGstin}}<div class="company-details">GST: {{companyGstin}}</div>{{/companyGstin}}
      </div>
    </div>
    
    <div class="invoice-banner">
      <strong>વેચાણ બિલ / SALES INVOICE</strong>
    </div>
    
    <div class="meta">
      <div><strong>ઇન્વૉઇસ નં.:</strong> {{invoiceNumber}}</div>
      <div><strong>તારીખ:</strong> {{invoiceDate}}</div>
      <div><strong>સ્ટેટસ:</strong> {{status}}</div>
    </div>
    
    <div class="customer">
      <div style="font-weight: bold; margin-bottom: 3px;">ગ્રાહક / Customer:</div>
      <div><strong>{{customerName}}</strong></div>
      {{#customerAddress}}<div>{{customerAddress}}</div>{{/customerAddress}}
      {{#customerMobile}}<div>મોબાઇલ: {{customerMobile}}</div>{{/customerMobile}}
      {{#customerGstin}}<div>GST: {{customerGstin}}</div>{{/customerGstin}}
    </div>
    
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 6%;">ક્રમ</th>
          <th style="width: 35%;">પ્રોડક્ટ</th>
          <th style="width: 8%;">નંગ</th>
          <th style="width: 12%;">ભાવ</th>
          <th style="width: 8%;">છૂટ</th>
          <th style="width: 7%;">કર%</th>
          <th style="width: 10%;">કર</th>
          <th style="width: 14%;">કુલ</th>
        </tr>
      </thead>
      <tbody>
        {{#items}}
        <tr>
          <td>{{index}}</td>
          <td class="item-desc">{{name}}</td>
          <td>{{quantity}}</td>
          <td>₹{{rate}}</td>
          <td>{{#discount}}₹{{discount}}{{/discount}}{{^discount}}-{{/discount}}</td>
          <td>{{taxRate}}%</td>
          <td>₹{{taxAmount}}</td>
          <td>₹{{total}}</td>
        </tr>
        {{/items}}
      </tbody>
    </table>
    
    <div class="totals">
      <div class="total-line">સબટોટલ: ₹{{basicAmount}}</div>
      {{#totalDiscount}}<div class="total-line">છૂટ: -₹{{totalDiscount}}</div>{{/totalDiscount}}
      {{#taxAmount}}<div class="total-line">કર: ₹{{taxAmount}}</div>{{/taxAmount}}
      {{#transportationCharge}}<div class="total-line">પરિવહન: ₹{{transportationCharge}}</div>{{/transportationCharge}}
      {{#roundOff}}<div class="total-line">રાઉન્ડ ઓફ: ₹{{roundOff}}</div>{{/roundOff}}
      <div class="grand-total">કુલ રકમ: ₹{{netReceivable}}</div>
    </div>
    
    <div class="words">
      <strong>અક્ષરે:</strong> {{amountInWords}}
    </div>
    
    <div class="signatures">
      <div class="sign-box">
        <div class="sign-line"></div>
        <div>ગ્રાહક સહી</div>
      </div>
      <div class="sign-box">
        <div class="sign-line"></div>
        <div>અધિકૃત સહી</div>
      </div>
    </div>
  </div>
</body>
</html>`
  },

  {
    id: 3,
    name: 'Modern Gujarati Sales',
    moduleType: 'sales',
    isDefault: false,
    htmlTemplate: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Sales Invoice - {{invoiceNumber}}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Noto Sans Gujarati', Arial, sans-serif; font-size: 11px; color: #2d3748; }
    .invoice { width: 48%; height: 45vh; margin: 1%; padding: 12px; border: 1px solid #e2e8f0; float: left; page-break-inside: avoid; background: #fff; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; padding: 8px; margin: -12px -12px 10px -12px; border-radius: 6px 6px 0 0; }
    .company-name { font-size: 18px; font-weight: 600; margin-bottom: 2px; }
    .company-subtitle { font-size: 9px; opacity: 0.9; }
    .invoice-header { background: #f7fafc; border-left: 4px solid #4299e1; padding: 6px; margin-bottom: 8px; }
    .invoice-title { font-size: 12px; font-weight: 600; color: #2d3748; }
    .invoice-meta { display: flex; justify-content: space-between; font-size: 10px; color: #4a5568; }
    .customer-card { background: #f7fafc; border-radius: 4px; padding: 6px; margin-bottom: 8px; }
    .customer-name { font-size: 11px; font-weight: 600; color: #2d3748; margin-bottom: 2px; }
    .customer-details { font-size: 9px; color: #718096; }
    .items-table { width: 100%; border-collapse: collapse; border-radius: 4px; overflow: hidden; border: 1px solid #e2e8f0; margin-bottom: 8px; }
    .items-table th { background: #edf2f7; padding: 4px; font-size: 8px; color: #4a5568; border-bottom: 1px solid #cbd5e1; text-align: center; }
    .items-table td { padding: 3px; font-size: 8px; border-bottom: 1px solid #f1f5f9; text-align: center; }
    .item-name { text-align: left !important; color: #2d3748; font-weight: 500; }
    .summary { background: #f7fafc; padding: 6px; border-radius: 4px; margin-bottom: 8px; }
    .summary-row { display: flex; justify-content: space-between; font-size: 9px; margin-bottom: 2px; color: #4a5568; }
    .summary-total { font-weight: 600; color: #2d3748; border-top: 1px solid #cbd5e1; padding-top: 3px; margin-top: 3px; }
    .words-section { background: #edf2f7; padding: 5px; border-radius: 4px; margin-bottom: 6px; }
    .words-text { font-size: 9px; color: #4a5568; font-style: italic; }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="header">
      <div class="company-name">{{companyName}}</div>
      <div class="company-subtitle">વ્યાવસાયિક સમાધાન / Business Solutions</div>
    </div>
    
    <div class="invoice-header">
      <div class="invoice-title">વેચાણ ઇન્વૉઇસ / Sales Invoice</div>
      <div class="invoice-meta">
        <span><strong>નં.:</strong> {{invoiceNumber}}</span>
        <span><strong>તારીખ:</strong> {{invoiceDate}}</span>
        <span><strong>સ્ટેટસ:</strong> {{status}}</span>
      </div>
    </div>
    
    <div class="customer-card">
      <div class="customer-name">{{customerName}}</div>
      <div class="customer-details">
        {{#customerAddress}}<div>{{customerAddress}}</div>{{/customerAddress}}
        {{#customerMobile}}<div>મોબાઇલ: {{customerMobile}}</div>{{/customerMobile}}
        {{#customerGstin}}<div>GST: {{customerGstin}}</div>{{/customerGstin}}
      </div>
    </div>
    
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 6%;">ક્રમ</th>
          <th style="width: 40%;">આઇટમ</th>
          <th style="width: 10%;">નંગ</th>
          <th style="width: 14%;">ભાવ</th>
          <th style="width: 10%;">છૂટ</th>
          <th style="width: 8%;">કર%</th>
          <th style="width: 12%;">કુલ</th>
        </tr>
      </thead>
      <tbody>
        {{#items}}
        <tr>
          <td>{{index}}</td>
          <td class="item-name">{{name}}</td>
          <td>{{quantity}}</td>
          <td>₹{{rate}}</td>
          <td>{{#discount}}₹{{discount}}{{/discount}}{{^discount}}-{{/discount}}</td>
          <td>{{taxRate}}%</td>
          <td>₹{{total}}</td>
        </tr>
        {{/items}}
      </tbody>
    </table>
    
    <div class="summary">
      <div class="summary-row"><span>મૂળ રકમ:</span><span>₹{{basicAmount}}</span></div>
      {{#totalDiscount}}<div class="summary-row"><span>છૂટ:</span><span>-₹{{totalDiscount}}</span></div>{{/totalDiscount}}
      {{#taxAmount}}<div class="summary-row"><span>કર:</span><span>₹{{taxAmount}}</span></div>{{/taxAmount}}
      {{#transportationCharge}}<div class="summary-row"><span>પરિવહન:</span><span>₹{{transportationCharge}}</span></div>{{/transportationCharge}}
      {{#roundOff}}<div class="summary-row"><span>રાઉન્ડ ઓફ:</span><span>₹{{roundOff}}</span></div>{{/roundOff}}
      <div class="summary-row summary-total"><span>કુલ રકમ:</span><span>₹{{netReceivable}}</span></div>
    </div>
    
    <div class="words-section">
      <div class="words-text"><strong>અક્ષરે:</strong> {{amountInWords}}</div>
    </div>
  </div>
</body>
</html>`
  },

  {
    id: 4,
    name: 'Professional English Sales',
    moduleType: 'sales',
    isDefault: false,
    htmlTemplate: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Sales Invoice - {{invoiceNumber}}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1a202c; }
    .invoice { width: 48%; height: 45vh; margin: 1%; padding: 12px; border: 1px solid #e2e8f0; float: left; page-break-inside: avoid; background: #fff; }
    .letterhead { background: #f8fafc; border: 1px solid #cbd5e1; padding: 8px; margin-bottom: 10px; text-align: center; border-radius: 4px; }
    .company-name { font-size: 18px; font-weight: 700; color: #2d3748; margin-bottom: 2px; }
    .company-tagline { font-size: 9px; color: #718096; margin-bottom: 3px; font-style: italic; }
    .company-address { font-size: 10px; color: #4a5568; margin-bottom: 2px; }
    .company-reg { font-size: 8px; color: #a0aec0; }
    .doc-header { background: #2d3748; color: #fff; text-align: center; padding: 5px; margin-bottom: 8px; border-radius: 3px; }
    .doc-title { font-size: 12px; font-weight: 600; margin-bottom: 1px; }
    .doc-subtitle { font-size: 8px; opacity: 0.8; }
    .invoice-details { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .detail-card { border: 1px solid #e2e8f0; padding: 5px; background: #f7fafc; width: 48%; border-radius: 3px; }
    .card-header { font-size: 8px; font-weight: 600; color: #4a5568; margin-bottom: 3px; text-transform: uppercase; }
    .card-content { font-size: 9px; color: #2d3748; }
    .items-table { width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; margin-bottom: 8px; border-radius: 4px; overflow: hidden; }
    .items-table th { background: #edf2f7; padding: 4px; font-size: 8px; color: #4a5568; border-bottom: 1px solid #cbd5e1; text-align: center; font-weight: 600; }
    .items-table td { padding: 3px; font-size: 8px; border-bottom: 1px solid #f1f5f9; text-align: center; }
    .item-description { text-align: left !important; color: #2d3748; font-weight: 500; }
    .summary-table { width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; margin-bottom: 8px; border-radius: 4px; overflow: hidden; }
    .summary-table td { padding: 3px 6px; font-size: 9px; border-bottom: 1px solid #f1f5f9; }
    .summary-label { background: #f7fafc; font-weight: 600; text-align: right; width: 70%; color: #4a5568; }
    .summary-value { text-align: right; color: #2d3748; }
    .total-row { background: #edf2f7; font-weight: 700; color: #2d3748; }
    .words-container { background: #f7fafc; padding: 5px; border-radius: 4px; margin-bottom: 8px; }
    .words-label { font-size: 8px; font-weight: 600; color: #4a5568; margin-bottom: 2px; }
    .words-text { font-size: 9px; color: #2d3748; font-style: italic; }
    .footer { display: flex; justify-content: space-between; margin-top: 8px; }
    .signature-area { text-align: center; width: 45%; }
    .signature-line { border-bottom: 1px solid #cbd5e1; height: 20px; margin-bottom: 3px; }
    .signature-label { font-size: 8px; color: #718096; }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="letterhead">
      <div class="company-name">{{companyName}}</div>
      <div class="company-tagline">Your Trusted Business Partner</div>
      <div class="company-address">{{companyAddress}}</div>
      {{#companyGstin}}<div class="company-reg">GSTIN: {{companyGstin}} | PAN: ABCDE1234F</div>{{/companyGstin}}
    </div>
    
    <div class="doc-header">
      <div class="doc-title">SALES INVOICE</div>
      <div class="doc-subtitle">Tax Invoice as per GST Act</div>
    </div>
    
    <div class="invoice-details">
      <div class="detail-card">
        <div class="card-header">Invoice Details</div>
        <div class="card-content">
          <div><strong>Invoice No:</strong> {{invoiceNumber}}</div>
          <div><strong>Date:</strong> {{invoiceDate}}</div>
          <div><strong>Status:</strong> {{status}}</div>
        </div>
      </div>
      <div class="detail-card">
        <div class="card-header">Bill To</div>
        <div class="card-content">
          <div><strong>{{customerName}}</strong></div>
          {{#customerAddress}}<div>{{customerAddress}}</div>{{/customerAddress}}
          {{#customerMobile}}<div>Mobile: {{customerMobile}}</div>{{/customerMobile}}
          {{#customerGstin}}<div>GSTIN: {{customerGstin}}</div>{{/customerGstin}}
        </div>
      </div>
    </div>
    
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 5%;">Sr</th>
          <th style="width: 35%;">Description</th>
          <th style="width: 8%;">Qty</th>
          <th style="width: 12%;">Rate</th>
          <th style="width: 8%;">Disc</th>
          <th style="width: 7%;">Tax%</th>
          <th style="width: 10%;">Tax Amt</th>
          <th style="width: 15%;">Total</th>
        </tr>
      </thead>
      <tbody>
        {{#items}}
        <tr>
          <td>{{index}}</td>
          <td class="item-description">{{name}}</td>
          <td>{{quantity}}</td>
          <td>₹{{rate}}</td>
          <td>{{#discount}}₹{{discount}}{{/discount}}{{^discount}}-{{/discount}}</td>
          <td>{{taxRate}}%</td>
          <td>₹{{taxAmount}}</td>
          <td>₹{{total}}</td>
        </tr>
        {{/items}}
      </tbody>
    </table>
    
    <table class="summary-table">
      <tr><td class="summary-label">Subtotal:</td><td class="summary-value">₹{{basicAmount}}</td></tr>
      {{#totalDiscount}}<tr><td class="summary-label">Discount:</td><td class="summary-value">-₹{{totalDiscount}}</td></tr>{{/totalDiscount}}
      {{#cgstAmount}}<tr><td class="summary-label">CGST ({{cgstRate}}%):</td><td class="summary-value">₹{{cgstAmount}}</td></tr>{{/cgstAmount}}
      {{#sgstAmount}}<tr><td class="summary-label">SGST ({{sgstRate}}%):</td><td class="summary-value">₹{{sgstAmount}}</td></tr>{{/sgstAmount}}
      {{#igstAmount}}<tr><td class="summary-label">IGST ({{igstRate}}%):</td><td class="summary-value">₹{{igstAmount}}</td></tr>{{/igstAmount}}
      {{#transportationCharge}}<tr><td class="summary-label">Transportation:</td><td class="summary-value">₹{{transportationCharge}}</td></tr>{{/transportationCharge}}
      {{#roundOff}}<tr><td class="summary-label">Round Off:</td><td class="summary-value">₹{{roundOff}}</td></tr>{{/roundOff}}
      <tr class="total-row"><td class="summary-label">TOTAL AMOUNT:</td><td class="summary-value">₹{{netReceivable}}</td></tr>
    </table>
    
    <div class="words-container">
      <div class="words-label">Amount in Words</div>
      <div class="words-text">{{amountInWords}}</div>
    </div>
    
    <div class="footer">
      <div class="signature-area">
        <div class="signature-line"></div>
        <div class="signature-label">Customer Signature</div>
      </div>
      <div class="signature-area">
        <div class="signature-line"></div>
        <div class="signature-label">Authorized Signatory</div>
      </div>
    </div>
  </div>
</body>
</html>`
  },

  // PURCHASE TEMPLATES
  {
    id: 5,
    name: 'Traditional Gujarati Purchase',
    moduleType: 'purchase',
    isDefault: true,
    htmlTemplate: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Purchase Invoice - {{invoiceNumber}}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Noto Sans Gujarati', Arial, sans-serif; font-size: 10px; line-height: 1.2; color: #000; }
    .invoice { width: 48%; min-height: 45vh; max-height: none; margin: 0.5%; padding: 8px; border: 2px solid #000; float: left; page-break-inside: avoid; background: #fff; }
    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 6px; }
    .company-name { font-size: 16px; font-weight: bold; margin-bottom: 2px; }
    .company-address { font-size: 9px; color: #333; margin-bottom: 1px; }
    .company-gstin { font-size: 8px; color: #666; }
    .invoice-title { background: #000; color: #fff; text-align: center; padding: 3px; margin-bottom: 5px; font-size: 11px; font-weight: bold; }
    .invoice-info { display: flex; justify-content: space-between; margin-bottom: 5px; }
    .info-box { border: 1px solid #000; padding: 3px; text-align: center; background: #f0f0f0; width: 48%; font-size: 9px; }
    .supplier-section { border: 1px solid #000; padding: 4px; margin-bottom: 5px; background: #f9f9f9; }
    .section-title { font-size: 9px; font-weight: bold; margin-bottom: 2px; border-bottom: 1px solid #000; padding-bottom: 1px; }
    .items-table { width: 100%; border-collapse: collapse; border: 2px solid #000; margin-bottom: 5px; }
    .items-table th { background: #e0e0e0; padding: 1.5px; font-size: 7px; font-weight: bold; border: 1px solid #000; text-align: center; line-height: 1.1; }
    .items-table td { border: 1px solid #000; padding: 1px; font-size: 7px; text-align: center; line-height: 1.1; }
    .item-name { text-align: left !important; }
    .total-section { border: 1px solid #000; padding: 4px; background: #f0f0f0; text-align: right; margin-bottom: 5px; }
    .total-row { font-size: 8px; margin-bottom: 1px; line-height: 1.1; }
    .final-total { font-weight: bold; border-top: 2px solid #000; padding-top: 2px; margin-top: 2px; font-size: 9px; }
    .amount-words { border: 1px solid #000; padding: 3px; background: #f9f9f9; margin-bottom: 4px; font-size: 8px; line-height: 1.2; }
    .footer { display: flex; justify-content: space-between; font-size: 8px; color: #666; }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="header">
      <div class="company-name">{{companyName}}</div>
      <div class="company-address">{{companyAddress}}</div>
      {{#companyGstin}}<div class="company-gstin">જીએસટીઆઈએન: {{companyGstin}}</div>{{/companyGstin}}
    </div>
    
    <div class="invoice-title">ખરીદી બિલ / PURCHASE INVOICE</div>
    
    <div class="invoice-info">
      <div class="info-box">
        <div><strong>બિલ નં. / Bill No.</strong></div>
        <div>{{invoiceNumber}}</div>
      </div>
      <div class="info-box">
        <div><strong>તારીખ / Date</strong></div>
        <div>{{invoiceDate}}</div>
      </div>
    </div>
    
    <div class="supplier-section">
      <div class="section-title">સપ્લાયર વિગતો / SUPPLIER DETAILS</div>
      <div><strong>{{supplierName}}</strong></div>
      {{#supplierAddress}}<div>{{supplierAddress}}</div>{{/supplierAddress}}
      {{#supplierGstin}}<div><strong>જીએસટીઆઈએન:</strong> {{supplierGstin}}</div>{{/supplierGstin}}
      {{#supplierMobile}}<div><strong>મોબાઇલ:</strong> {{supplierMobile}}</div>{{/supplierMobile}}
    </div>
    
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 6%;">ક્રમ<br>Sr</th>
          <th style="width: 35%;">માલનું નામ<br>Product</th>
          <th style="width: 8%;">નંગ<br>Qty</th>
          <th style="width: 12%;">ભાવ (કર વગર)<br>Rate (Without tax)</th>
          <th style="width: 8%;">છૂટ<br>Disc</th>
          <th style="width: 7%;">કર%<br>Tax</th>
          <th style="width: 10%;">કર રકમ<br>Tax Amt</th>
          <th style="width: 14%;">કુલ<br>Total</th>
        </tr>
      </thead>
      <tbody>
        {{#items}}
        <tr>
          <td>{{index}}</td>
          <td class="item-name">{{name}}</td>
          <td>{{quantity}}</td>
          <td>₹{{rateWithoutTax}}</td>
          <td>{{#discount}}₹{{discount}}{{/discount}}{{^discount}}-{{/discount}}</td>
          <td>{{taxRate}}%</td>
          <td>₹{{taxAmount}}</td>
          <td>₹{{total}}</td>
        </tr>
        {{/items}}
      </tbody>
    </table>
    
    <div class="total-section">
      <div class="total-row">મૂળ રકમ / Subtotal: ₹{{basicAmount}}</div>
      {{#totalDiscount}}<div class="total-row">કુલ છૂટ / Discount: -₹{{totalDiscount}}</div>{{/totalDiscount}}
      {{#cgstAmount}}<div class="total-row">સી.જી.એસ.ટી / CGST ({{cgstRate}}%): ₹{{cgstAmount}}</div>{{/cgstAmount}}
      {{#sgstAmount}}<div class="total-row">એસ.જી.એસ.ટી / SGST ({{sgstRate}}%): ₹{{sgstAmount}}</div>{{/sgstAmount}}
      {{#igstAmount}}<div class="total-row">આઈ.જી.એસ.ટી / IGST ({{igstRate}}%): ₹{{igstAmount}}</div>{{/igstAmount}}
      {{#transportationCharge}}<div class="total-row">પરિવહન / Transport: ₹{{transportationCharge}}</div>{{/transportationCharge}}
      {{#roundOff}}<div class="total-row">રાઉન્ડ ઓફ / Round Off: ₹{{roundOff}}</div>{{/roundOff}}
      <div class="final-total">કુલ ચૂકવવાપાત્ર / TOTAL PAYABLE: ₹{{netPayable}}</div>
    </div>
    
    <div class="amount-words">
      <strong>અક્ષરે રકમ / Amount in Words:</strong> {{amountInWords}}
    </div>
    
    <div class="footer">
      <div>આભાર / Thank You</div>
      <div>સ્ટેટસ: {{status}}</div>
    </div>
  </div>
</body>
</html>`
  },

  {
    id: 6,
    name: 'Business Gujarati Purchase',
    moduleType: 'purchase',
    isDefault: false,
    htmlTemplate: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Purchase Invoice - {{invoiceNumber}}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Noto Sans Gujarati', Arial, sans-serif; font-size: 11px; color: #000; }
    .invoice { width: 48%; height: 45vh; margin: 1%; padding: 10px; border: 1px solid #333; float: left; page-break-inside: avoid; background: #fff; }
    .header { display: flex; align-items: center; border-bottom: 2px solid #333; padding-bottom: 6px; margin-bottom: 8px; }
    .logo { width: 50px; height: 50px; border: 1px solid #ccc; margin-right: 10px; display: flex; align-items: center; justify-content: center; border-radius: 4px; }
    .company-info { flex: 1; }
    .company-name { font-size: 18px; font-weight: bold; margin-bottom: 2px; }
    .company-details { font-size: 9px; color: #666; }
    .invoice-banner { background: #f0f0f0; border: 1px solid #333; text-align: center; padding: 4px; margin-bottom: 8px; }
    .meta { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 10px; }
    .supplier { border: 1px solid #333; padding: 5px; margin-bottom: 8px; background: #fafafa; }
    .items-table { width: 100%; border-collapse: collapse; border: 1px solid #333; margin-bottom: 8px; }
    .items-table th { background: #e8e8e8; padding: 3px; font-size: 8px; border: 1px solid #333; text-align: center; }
    .items-table td { border: 1px solid #333; padding: 2px; font-size: 8px; text-align: center; }
    .item-desc { text-align: left !important; }
    .totals { border: 1px solid #333; padding: 5px; background: #f5f5f5; text-align: right; margin-bottom: 6px; }
    .total-line { font-size: 9px; margin-bottom: 1px; }
    .grand-total { font-weight: bold; border-top: 1px solid #333; padding-top: 2px; margin-top: 2px; }
    .words { border: 1px solid #333; padding: 4px; background: #fafafa; margin-bottom: 6px; font-size: 9px; }
    .signatures { display: flex; justify-content: space-between; margin-top: 10px; }
    .sign-box { text-align: center; width: 45%; }
    .sign-line { border-bottom: 1px solid #333; height: 20px; margin-bottom: 3px; }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="header">
      {{#companyLogoUrl}}
      <div class="logo">
        <img src="{{companyLogoUrl}}" style="max-width: 45px; max-height: 45px;">
      </div>
      {{/companyLogoUrl}}
      {{^companyLogoUrl}}
      <div class="logo" style="font-size: 8px; color: #999;">LOGO</div>
      {{/companyLogoUrl}}
      <div class="company-info">
        <div class="company-name">{{companyName}}</div>
        <div class="company-details">{{companyAddress}}</div>
        {{#companyGstin}}<div class="company-details">GST: {{companyGstin}}</div>{{/companyGstin}}
      </div>
    </div>
    
    <div class="invoice-banner">
      <strong>ખરીદી બિલ / PURCHASE INVOICE</strong>
    </div>
    
    <div class="meta">
      <div><strong>ઇન્વૉઇસ નં.:</strong> {{invoiceNumber}}</div>
      <div><strong>તારીખ:</strong> {{invoiceDate}}</div>
      <div><strong>સ્ટેટસ:</strong> {{status}}</div>
    </div>
    
    <div class="supplier">
      <div style="font-weight: bold; margin-bottom: 3px;">સપ્લાયર / Supplier:</div>
      <div><strong>{{supplierName}}</strong></div>
      {{#supplierAddress}}<div>{{supplierAddress}}</div>{{/supplierAddress}}
      {{#supplierMobile}}<div>મોબાઇલ: {{supplierMobile}}</div>{{/supplierMobile}}
      {{#supplierGstin}}<div>GST: {{supplierGstin}}</div>{{/supplierGstin}}
    </div>
    
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 6%;">ક્રમ</th>
          <th style="width: 35%;">પ્રોડક્ટ</th>
          <th style="width: 8%;">નંગ</th>
          <th style="width: 12%;">ભાવ</th>
          <th style="width: 8%;">છૂટ</th>
          <th style="width: 7%;">કર%</th>
          <th style="width: 10%;">કર</th>
          <th style="width: 14%;">કુલ</th>
        </tr>
      </thead>
      <tbody>
        {{#items}}
        <tr>
          <td>{{index}}</td>
          <td class="item-desc">{{name}}</td>
          <td>{{quantity}}</td>
          <td>₹{{rate}}</td>
          <td>{{#discount}}₹{{discount}}{{/discount}}{{^discount}}-{{/discount}}</td>
          <td>{{taxRate}}%</td>
          <td>₹{{taxAmount}}</td>
          <td>₹{{total}}</td>
        </tr>
        {{/items}}
      </tbody>
    </table>
    
    <div class="totals">
      <div class="total-line">સબટોટલ: ₹{{basicAmount}}</div>
      {{#totalDiscount}}<div class="total-line">છૂટ: -₹{{totalDiscount}}</div>{{/totalDiscount}}
      {{#taxAmount}}<div class="total-line">કર: ₹{{taxAmount}}</div>{{/taxAmount}}
      {{#transportationCharge}}<div class="total-line">પરિવહન: ₹{{transportationCharge}}</div>{{/transportationCharge}}
      {{#roundOff}}<div class="total-line">રાઉન્ડ ઓફ: ₹{{roundOff}}</div>{{/roundOff}}
      <div class="grand-total">કુલ ચૂકવવાપાત્ર: ₹{{netPayable}}</div>
    </div>
    
    <div class="words">
      <strong>અક્ષરે:</strong> {{amountInWords}}
    </div>
    
    <div class="signatures">
      <div class="sign-box">
        <div class="sign-line"></div>
        <div>પ્રાપ્ત કર્યું</div>
      </div>
      <div class="sign-box">
        <div class="sign-line"></div>
        <div>અધિકૃત સહી</div>
      </div>
    </div>
  </div>
</body>
</html>`
  },

  {
    id: 7,
    name: 'Modern Gujarati Purchase',
    moduleType: 'purchase',
    isDefault: false,
    htmlTemplate: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Purchase Invoice - {{invoiceNumber}}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Noto Sans Gujarati', Arial, sans-serif; font-size: 11px; color: #2d3748; }
    .invoice { width: 48%; height: 45vh; margin: 1%; padding: 12px; border: 1px solid #e2e8f0; float: left; page-break-inside: avoid; background: #fff; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: #fff; padding: 8px; margin: -12px -12px 10px -12px; border-radius: 6px 6px 0 0; }
    .company-name { font-size: 18px; font-weight: 600; margin-bottom: 2px; }
    .company-subtitle { font-size: 9px; opacity: 0.9; }
    .invoice-header { background: #f7fafc; border-left: 4px solid #f093fb; padding: 6px; margin-bottom: 8px; }
    .invoice-title { font-size: 12px; font-weight: 600; color: #2d3748; }
    .invoice-meta { display: flex; justify-content: space-between; font-size: 10px; color: #4a5568; }
    .supplier-card { background: #f7fafc; border-radius: 4px; padding: 6px; margin-bottom: 8px; }
    .supplier-name { font-size: 11px; font-weight: 600; color: #2d3748; margin-bottom: 2px; }
    .supplier-details { font-size: 9px; color: #718096; }
    .items-table { width: 100%; border-collapse: collapse; border-radius: 4px; overflow: hidden; border: 1px solid #e2e8f0; margin-bottom: 8px; }
    .items-table th { background: #edf2f7; padding: 4px; font-size: 8px; color: #4a5568; border-bottom: 1px solid #cbd5e1; text-align: center; }
    .items-table td { padding: 3px; font-size: 8px; border-bottom: 1px solid #f1f5f9; text-align: center; }
    .item-name { text-align: left !important; color: #2d3748; font-weight: 500; }
    .summary { background: #f7fafc; padding: 6px; border-radius: 4px; margin-bottom: 8px; }
    .summary-row { display: flex; justify-content: space-between; font-size: 9px; margin-bottom: 2px; color: #4a5568; }
    .summary-total { font-weight: 600; color: #2d3748; border-top: 1px solid #cbd5e1; padding-top: 3px; margin-top: 3px; }
    .words-section { background: #edf2f7; padding: 5px; border-radius: 4px; margin-bottom: 6px; }
    .words-text { font-size: 9px; color: #4a5568; font-style: italic; }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="header">
      <div class="company-name">{{companyName}}</div>
      <div class="company-subtitle">વ્યાવસાયિક સમાધાન / Business Solutions</div>
    </div>
    
    <div class="invoice-header">
      <div class="invoice-title">ખરીદી ઇન્વૉઇસ / Purchase Invoice</div>
      <div class="invoice-meta">
        <span><strong>નં.:</strong> {{invoiceNumber}}</span>
        <span><strong>તારીખ:</strong> {{invoiceDate}}</span>
        <span><strong>સ્ટેટસ:</strong> {{status}}</span>
      </div>
    </div>
    
    <div class="supplier-card">
      <div class="supplier-name">{{supplierName}}</div>
      <div class="supplier-details">
        {{#supplierAddress}}<div>{{supplierAddress}}</div>{{/supplierAddress}}
        {{#supplierMobile}}<div>મોબાઇલ: {{supplierMobile}}</div>{{/supplierMobile}}
        {{#supplierGstin}}<div>GST: {{supplierGstin}}</div>{{/supplierGstin}}
      </div>
    </div>
    
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 6%;">ક્રમ</th>
          <th style="width: 40%;">આઇટમ</th>
          <th style="width: 10%;">નંગ</th>
          <th style="width: 14%;">ભાવ</th>
          <th style="width: 10%;">છૂટ</th>
          <th style="width: 8%;">કર%</th>
          <th style="width: 12%;">કુલ</th>
        </tr>
      </thead>
      <tbody>
        {{#items}}
        <tr>
          <td>{{index}}</td>
          <td class="item-name">{{name}}</td>
          <td>{{quantity}}</td>
          <td>₹{{rate}}</td>
          <td>{{#discount}}₹{{discount}}{{/discount}}{{^discount}}-{{/discount}}</td>
          <td>{{taxRate}}%</td>
          <td>₹{{total}}</td>
        </tr>
        {{/items}}
      </tbody>
    </table>
    
    <div class="summary">
      <div class="summary-row"><span>મૂળ રકમ:</span><span>₹{{basicAmount}}</span></div>
      {{#totalDiscount}}<div class="summary-row"><span>છૂટ:</span><span>-₹{{totalDiscount}}</span></div>{{/totalDiscount}}
      {{#taxAmount}}<div class="summary-row"><span>કર:</span><span>₹{{taxAmount}}</span></div>{{/taxAmount}}
      {{#transportationCharge}}<div class="summary-row"><span>પરિવહન:</span><span>₹{{transportationCharge}}</span></div>{{/transportationCharge}}
      {{#roundOff}}<div class="summary-row"><span>રાઉન્ડ ઓફ:</span><span>₹{{roundOff}}</span></div>{{/roundOff}}
      <div class="summary-row summary-total"><span>કુલ ચૂકવવાપાત્ર:</span><span>₹{{netPayable}}</span></div>
    </div>
    
    <div class="words-section">
      <div class="words-text"><strong>અક્ષરે:</strong> {{amountInWords}}</div>
    </div>
  </div>
</body>
</html>`
  },

  {
    id: 8,
    name: 'Professional English Purchase',
    moduleType: 'purchase',
    isDefault: false,
    htmlTemplate: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Purchase Invoice - {{invoiceNumber}}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1a202c; }
    .invoice { width: 48%; height: 45vh; margin: 1%; padding: 12px; border: 1px solid #e2e8f0; float: left; page-break-inside: avoid; background: #fff; }
    .letterhead { background: #f8fafc; border: 1px solid #cbd5e1; padding: 8px; margin-bottom: 10px; text-align: center; border-radius: 4px; }
    .company-name { font-size: 18px; font-weight: 700; color: #2d3748; margin-bottom: 2px; }
    .company-tagline { font-size: 9px; color: #718096; margin-bottom: 3px; font-style: italic; }
    .company-address { font-size: 10px; color: #4a5568; margin-bottom: 2px; }
    .company-reg { font-size: 8px; color: #a0aec0; }
    .doc-header { background: #2d3748; color: #fff; text-align: center; padding: 5px; margin-bottom: 8px; border-radius: 3px; }
    .doc-title { font-size: 12px; font-weight: 600; margin-bottom: 1px; }
    .doc-subtitle { font-size: 8px; opacity: 0.8; }
    .invoice-details { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .detail-card { border: 1px solid #e2e8f0; padding: 5px; background: #f7fafc; width: 48%; border-radius: 3px; }
    .card-header { font-size: 8px; font-weight: 600; color: #4a5568; margin-bottom: 3px; text-transform: uppercase; }
    .card-content { font-size: 9px; color: #2d3748; }
    .items-table { width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; margin-bottom: 8px; border-radius: 4px; overflow: hidden; }
    .items-table th { background: #edf2f7; padding: 4px; font-size: 8px; color: #4a5568; border-bottom: 1px solid #cbd5e1; text-align: center; font-weight: 600; }
    .items-table td { padding: 3px; font-size: 8px; border-bottom: 1px solid #f1f5f9; text-align: center; }
    .item-description { text-align: left !important; color: #2d3748; font-weight: 500; }
    .summary-table { width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; margin-bottom: 8px; border-radius: 4px; overflow: hidden; }
    .summary-table td { padding: 3px 6px; font-size: 9px; border-bottom: 1px solid #f1f5f9; }
    .summary-label { background: #f7fafc; font-weight: 600; text-align: right; width: 70%; color: #4a5568; }
    .summary-value { text-align: right; color: #2d3748; }
    .total-row { background: #edf2f7; font-weight: 700; color: #2d3748; }
    .words-container { background: #f7fafc; padding: 5px; border-radius: 4px; margin-bottom: 8px; }
    .words-label { font-size: 8px; font-weight: 600; color: #4a5568; margin-bottom: 2px; }
    .words-text { font-size: 9px; color: #2d3748; font-style: italic; }
    .footer { display: flex; justify-content: space-between; margin-top: 8px; }
    .signature-area { text-align: center; width: 45%; }
    .signature-line { border-bottom: 1px solid #cbd5e1; height: 20px; margin-bottom: 3px; }
    .signature-label { font-size: 8px; color: #718096; }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="letterhead">
      <div class="company-name">{{companyName}}</div>
      <div class="company-tagline">Your Trusted Business Partner</div>
      <div class="company-address">{{companyAddress}}</div>
      {{#companyGstin}}<div class="company-reg">GSTIN: {{companyGstin}} | PAN: ABCDE1234F</div>{{/companyGstin}}
    </div>
    
    <div class="doc-header">
      <div class="doc-title">PURCHASE INVOICE</div>
      <div class="doc-subtitle">Tax Invoice as per GST Act</div>
    </div>
    
    <div class="invoice-details">
      <div class="detail-card">
        <div class="card-header">Invoice Details</div>
        <div class="card-content">
          <div><strong>Invoice No:</strong> {{invoiceNumber}}</div>
          <div><strong>Date:</strong> {{invoiceDate}}</div>
          <div><strong>Status:</strong> {{status}}</div>
        </div>
      </div>
      <div class="detail-card">
        <div class="card-header">Supplier Details</div>
        <div class="card-content">
          <div><strong>{{supplierName}}</strong></div>
          {{#supplierAddress}}<div>{{supplierAddress}}</div>{{/supplierAddress}}
          {{#supplierMobile}}<div>Mobile: {{supplierMobile}}</div>{{/supplierMobile}}
          {{#supplierGstin}}<div>GSTIN: {{supplierGstin}}</div>{{/supplierGstin}}
        </div>
      </div>
    </div>
    
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 5%;">Sr</th>
          <th style="width: 35%;">Description</th>
          <th style="width: 8%;">Qty</th>
          <th style="width: 12%;">Rate</th>
          <th style="width: 8%;">Disc</th>
          <th style="width: 7%;">Tax%</th>
          <th style="width: 10%;">Tax Amt</th>
          <th style="width: 15%;">Total</th>
        </tr>
      </thead>
      <tbody>
        {{#items}}
        <tr>
          <td>{{index}}</td>
          <td class="item-description">{{name}}</td>
          <td>{{quantity}}</td>
          <td>₹{{rate}}</td>
          <td>{{#discount}}₹{{discount}}{{/discount}}{{^discount}}-{{/discount}}</td>
          <td>{{taxRate}}%</td>
          <td>₹{{taxAmount}}</td>
          <td>₹{{total}}</td>
        </tr>
        {{/items}}
      </tbody>
    </table>
    
    <table class="summary-table">
      <tr><td class="summary-label">Subtotal:</td><td class="summary-value">₹{{basicAmount}}</td></tr>
      {{#totalDiscount}}<tr><td class="summary-label">Discount:</td><td class="summary-value">-₹{{totalDiscount}}</td></tr>{{/totalDiscount}}
      {{#cgstAmount}}<tr><td class="summary-label">CGST ({{cgstRate}}%):</td><td class="summary-value">₹{{cgstAmount}}</td></tr>{{/cgstAmount}}
      {{#sgstAmount}}<tr><td class="summary-label">SGST ({{sgstRate}}%):</td><td class="summary-value">₹{{sgstAmount}}</td></tr>{{/sgstAmount}}
      {{#igstAmount}}<tr><td class="summary-label">IGST ({{igstRate}}%):</td><td class="summary-value">₹{{igstAmount}}</td></tr>{{/igstAmount}}
      {{#transportationCharge}}<tr><td class="summary-label">Transportation:</td><td class="summary-value">₹{{transportationCharge}}</td></tr>{{/transportationCharge}}
      {{#roundOff}}<tr><td class="summary-label">Round Off:</td><td class="summary-value">₹{{roundOff}}</td></tr>{{/roundOff}}
      <tr class="total-row"><td class="summary-label">TOTAL PAYABLE:</td><td class="summary-value">₹{{netPayable}}</td></tr>
    </table>
    
    <div class="words-container">
      <div class="words-label">Amount in Words</div>
      <div class="words-text">{{amountInWords}}</div>
    </div>
    
    <div class="footer">
      <div class="signature-area">
        <div class="signature-line"></div>
        <div class="signature-label">Received By</div>
      </div>
      <div class="signature-area">
        <div class="signature-line"></div>
        <div class="signature-label">Authorized Signatory</div>
      </div>
    </div>
  </div>
</body>
</html>`
  },

  // PAYMENT TEMPLATES
  {
    id: 9,
    name: 'Traditional Gujarati Payment',
    moduleType: 'payment',
    isDefault: true,
    htmlTemplate: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Payment Receipt - {{receiptNumber}}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Noto Sans Gujarati', Arial, sans-serif; font-size: 12px; line-height: 1.3; color: #000; }
    .receipt { width: 48%; height: 45vh; margin: 1%; padding: 10px; border: 2px solid #000; float: left; page-break-inside: avoid; background: #fff; }
    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 8px; }
    .company-name { font-size: 18px; font-weight: bold; margin-bottom: 2px; }
    .company-address { font-size: 10px; color: #333; margin-bottom: 2px; }
    .company-gstin { font-size: 8px; color: #666; }
    .receipt-title { background: #000; color: #fff; text-align: center; padding: 4px; margin-bottom: 6px; font-size: 12px; font-weight: bold; }
    .receipt-info { display: flex; justify-content: space-between; margin-bottom: 6px; }
    .info-box { border: 1px solid #000; padding: 4px; text-align: center; background: #f0f0f0; width: 48%; }
    .customer-section { border: 1px solid #000; padding: 6px; margin-bottom: 6px; background: #f9f9f9; }
    .section-title { font-size: 10px; font-weight: bold; margin-bottom: 3px; border-bottom: 1px solid #000; padding-bottom: 2px; }
    .payment-details { border: 1px solid #000; padding: 6px; margin-bottom: 6px; background: #f0f0f0; }
    .payment-row { display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 11px; }
    .amount-section { border: 2px solid #000; padding: 8px; background: #f9f9f9; text-align: center; margin-bottom: 6px; }
    .amount-display { font-size: 14px; font-weight: bold; margin-bottom: 2px; }
    .amount-words { border: 1px solid #000; padding: 4px; background: #f9f9f9; margin-bottom: 6px; }
    .footer { display: flex; justify-content: space-between; font-size: 8px; color: #666; }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <div class="company-name">{{companyName}}</div>
      <div class="company-address">{{companyAddress}}</div>
      {{#companyGstin}}<div class="company-gstin">જીએસટીઆઈએન: {{companyGstin}}</div>{{/companyGstin}}
    </div>
    
    <div class="receipt-title">ચૂકવણી રસીદ / PAYMENT RECEIPT</div>
    
    <div class="receipt-info">
      <div class="info-box">
        <div><strong>રસીદ નં. / Receipt No.</strong></div>
        <div>{{receiptNumber}}</div>
      </div>
      <div class="info-box">
        <div><strong>તારીખ / Date</strong></div>
        <div>{{receiptDate}}</div>
      </div>
    </div>
    
    <div class="customer-section">
      <div class="section-title">ગ્રાહક વિગતો / CUSTOMER DETAILS</div>
      <div><strong>{{customerName}}</strong></div>
      {{#customerAddress}}<div>{{customerAddress}}</div>{{/customerAddress}}
      {{#customerGstin}}<div><strong>જીએસટીઆઈએન:</strong> {{customerGstin}}</div>{{/customerGstin}}
      {{#customerMobile}}<div><strong>મોબાઇલ:</strong> {{customerMobile}}</div>{{/customerMobile}}
    </div>
    
    <div class="payment-details">
      <div class="payment-row">
        <span><strong>ચૂકવણી પદ્ધતિ / Payment Method:</strong></span>
        <span>{{paymentMethod}}</span>
      </div>
      {{#bankAccountName}}
      <div class="payment-row">
        <span><strong>બેંક ખાતું / Bank Account:</strong></span>
        <span>{{bankAccountName}}</span>
      </div>
      {{/bankAccountName}}
    </div>
    
    {{#hasAllocations}}
    <div class="payment-details">
      <div class="section-title">ચૂકવણી વિગતો / PAYMENT ALLOCATIONS</div>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; margin-bottom: 6px; font-size: 10px;">
        <thead>
          <tr style="background: #e0e0e0;">
            <th style="border: 1px solid #000; padding: 2px; text-align: left;">વર્ણન / Description</th>
            <th style="border: 1px solid #000; padding: 2px; text-align: center;">પ્રકાર / Type</th>
            <th style="border: 1px solid #000; padding: 2px; text-align: center;">બેલેન્સ / Balance</th>
            <th style="border: 1px solid #000; padding: 2px; text-align: right;">રકમ / Amount</th>
          </tr>
        </thead>
        <tbody>
          {{#allocations}}
          <tr>
            <td style="border: 1px solid #000; padding: 2px;">{{description}}</td>
            <td style="border: 1px solid #000; padding: 2px; text-align: center;">{{type}}</td>
            <td style="border: 1px solid #000; padding: 2px; text-align: center;">{{balanceTypeGujarati}}</td>
            <td style="border: 1px solid #000; padding: 2px; text-align: right;">₹{{amount}}</td>
          </tr>
          {{/allocations}}
        </tbody>
      </table>
    </div>
    {{/hasAllocations}}
    
    <div class="amount-section">
      <div class="amount-display">મળેલ રકમ / Amount Received: ₹{{amount}}</div>
    </div>
    
    <div class="amount-words">
      <strong>અક્ષરે રકમ / Amount in Words:</strong> {{amountInWords}}
    </div>
    
    <div class="footer">
      <div>આભાર / Thank You</div>
      <div>રસીદ માન્ય છે / Receipt Valid</div>
    </div>
  </div>
</body>
</html>`
  },

  {
    id: 10,
    name: 'Business Gujarati Payment',
    moduleType: 'payment',
    isDefault: false,
    htmlTemplate: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Payment Receipt - {{receiptNumber}}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Noto Sans Gujarati', Arial, sans-serif; font-size: 12px; color: #000; }
    .receipt { width: 48%; height: 45vh; margin: 1%; padding: 10px; border: 1px solid #333; float: left; page-break-inside: avoid; background: #fff; }
    .header { display: flex; align-items: center; border-bottom: 2px solid #333; padding-bottom: 6px; margin-bottom: 8px; }
    .logo { width: 50px; height: 50px; border: 1px solid #ccc; margin-right: 10px; display: flex; align-items: center; justify-content: center; border-radius: 4px; }
    .company-info { flex: 1; }
    .company-name { font-size: 18px; font-weight: bold; margin-bottom: 2px; }
    .company-details { font-size: 9px; color: #666; }
    .receipt-banner { background: #f0f0f0; border: 1px solid #333; text-align: center; padding: 4px; margin-bottom: 8px; }
    .meta { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 10px; }
    .customer { border: 1px solid #333; padding: 5px; margin-bottom: 8px; background: #fafafa; }
    .payment-info { border: 1px solid #333; padding: 5px; margin-bottom: 8px; background: #f5f5f5; }
    .amount-display { border: 2px solid #333; padding: 8px; background: #f9f9f9; text-align: center; margin-bottom: 6px; font-size: 14px; font-weight: bold; }
    .words { border: 1px solid #333; padding: 4px; background: #fafafa; margin-bottom: 6px; font-size: 10px; }
    .footer { display: flex; justify-content: space-between; font-size: 8px; color: #666; }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      {{#companyLogoUrl}}
      <div class="logo">
        <img src="{{companyLogoUrl}}" style="max-width: 45px; max-height: 45px;">
      </div>
      {{/companyLogoUrl}}
      {{^companyLogoUrl}}
      <div class="logo" style="font-size: 8px; color: #999;">LOGO</div>
      {{/companyLogoUrl}}
      <div class="company-info">
        <div class="company-name">{{companyName}}</div>
        <div class="company-details">{{companyAddress}}</div>
        {{#companyGstin}}<div class="company-details">GST: {{companyGstin}}</div>{{/companyGstin}}
      </div>
    </div>
    
    <div class="receipt-banner">
      <strong>ચૂકવણી રસીદ / PAYMENT RECEIPT</strong>
    </div>
    
    <div class="meta">
      <div><strong>રસીદ નં.:</strong> {{receiptNumber}}</div>
      <div><strong>તારીખ:</strong> {{receiptDate}}</div>
    </div>
    
    <div class="customer">
      <div style="font-weight: bold; margin-bottom: 3px;">પ્રાપ્ત કરેલ / Received From:</div>
      <div><strong>{{customerName}}</strong></div>
      {{#customerAddress}}<div>{{customerAddress}}</div>{{/customerAddress}}
      {{#customerMobile}}<div>મોબાઇલ: {{customerMobile}}</div>{{/customerMobile}}
    </div>
    
    <div class="payment-info">
      <div style="font-weight: bold; margin-bottom: 3px;">ચૂકવણી વિગતો / Payment Details:</div>
      <div><strong>પદ્ધતિ:</strong> {{paymentMethod}}</div>
      {{#bankAccountName}}<div><strong>બેંક:</strong> {{bankAccountName}}</div>{{/bankAccountName}}
    </div>
    
    {{#allocations}}
    <div class="payment-details" style="border: 1px solid #000; padding: 6px; margin-bottom: 6px; background: #f0f0f0;">
      <div style="font-size: 10px; font-weight: bold; margin-bottom: 3px; border-bottom: 1px solid #000; padding-bottom: 2px;">ચૂકવણી વિગતો / PAYMENT ALLOCATIONS</div>
      <table style="width: 100%; border-collapse: collapse; font-size: 9px;">
        <thead>
          <tr style="background: #e0e0e0;">
            <th style="border: 1px solid #000; padding: 2px; text-align: left;">વર્ણન / Description</th>
            <th style="border: 1px solid #000; padding: 2px; text-align: center;">પ્રકાર / Type</th>
            <th style="border: 1px solid #000; padding: 2px; text-align: center;">બેલેન્સ / Balance</th>
            <th style="border: 1px solid #000; padding: 2px; text-align: right;">રકમ / Amount</th>
          </tr>
        </thead>
        <tbody>
          {{#allocations}}
          <tr>
            <td style="border: 1px solid #000; padding: 2px;">{{description}}</td>
            <td style="border: 1px solid #000; padding: 2px; text-align: center;">{{type}}</td>
            <td style="border: 1px solid #000; padding: 2px; text-align: center;">{{balanceTypeGujarati}}</td>
            <td style="border: 1px solid #000; padding: 2px; text-align: right;">₹{{amount}}</td>
          </tr>
          {{/allocations}}
        </tbody>
      </table>
    </div>
    {{/hasAllocations}}
    
    <div class="amount-display">
      મળેલ રકમ: ₹{{amount}}
    </div>
    
    <div class="words">
      <strong>અક્ષરે રકમ:</strong> {{amountInWords}}
    </div>
    
    <div class="footer">
      <div>આભાર / Thank You</div>
      <div>રસીદ માન્ય છે</div>
    </div>
  </div>
</body>
</html>`
  },

  {
    id: 11,
    name: 'Professional English Payment',
    moduleType: 'payment',
    isDefault: false,
    htmlTemplate: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Payment Receipt - {{receiptNumber}}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1a202c; }
    .receipt { width: 48%; height: 45vh; margin: 1%; padding: 12px; border: 1px solid #e2e8f0; float: left; page-break-inside: avoid; background: #fff; }
    .letterhead { background: #f8fafc; border: 1px solid #cbd5e1; padding: 8px; margin-bottom: 10px; text-align: center; border-radius: 4px; }
    .company-name { font-size: 18px; font-weight: 700; color: #2d3748; margin-bottom: 2px; }
    .company-tagline { font-size: 9px; color: #718096; margin-bottom: 3px; font-style: italic; }
    .company-address { font-size: 10px; color: #4a5568; margin-bottom: 2px; }
    .company-reg { font-size: 8px; color: #a0aec0; }
    .doc-header { background: #2d3748; color: #fff; text-align: center; padding: 5px; margin-bottom: 8px; border-radius: 3px; }
    .doc-title { font-size: 12px; font-weight: 600; margin-bottom: 1px; }
    .doc-subtitle { font-size: 8px; opacity: 0.8; }
    .receipt-details { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .detail-card { border: 1px solid #e2e8f0; padding: 5px; background: #f7fafc; width: 48%; border-radius: 3px; }
    .card-header { font-size: 8px; font-weight: 600; color: #4a5568; margin-bottom: 3px; text-transform: uppercase; }
    .card-content { font-size: 9px; color: #2d3748; }
    .amount-highlight { background: #edf2f7; border: 1px solid #cbd5e1; padding: 8px; text-align: center; margin-bottom: 8px; border-radius: 4px; }
    .amount-value { font-size: 16px; font-weight: 700; color: #2d3748; margin-bottom: 2px; }
    .amount-method { font-size: 10px; color: #4a5568; }
    .words-container { background: #f7fafc; padding: 5px; border-radius: 4px; margin-bottom: 8px; }
    .words-label { font-size: 8px; font-weight: 600; color: #4a5568; margin-bottom: 2px; }
    .words-text { font-size: 9px; color: #2d3748; font-style: italic; }
    .footer { display: flex; justify-content: space-between; margin-top: 8px; }
    .signature-area { text-align: center; width: 45%; }
    .signature-line { border-bottom: 1px solid #cbd5e1; height: 20px; margin-bottom: 3px; }
    .signature-label { font-size: 8px; color: #718096; }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="letterhead">
      <div class="company-name">{{companyName}}</div>
      <div class="company-tagline">Professional Payment Solutions</div>
      <div class="company-address">{{companyAddress}}</div>
      {{#companyGstin}}<div class="company-reg">GSTIN: {{companyGstin}} | PAN: ABCDE1234F</div>{{/companyGstin}}
    </div>
    
    <div class="doc-header">
      <div class="doc-title">PAYMENT RECEIPT</div>
      <div class="doc-subtitle">Official Payment Acknowledgment</div>
    </div>
    
    <div class="receipt-details">
      <div class="detail-card">
        <div class="card-header">Receipt Details</div>
        <div class="card-content">
          <div><strong>Receipt No:</strong> {{receiptNumber}}</div>
          <div><strong>Date:</strong> {{receiptDate}}</div>
        </div>
      </div>
      <div class="detail-card">
        <div class="card-header">Received From</div>
        <div class="card-content">
          <div><strong>{{customerName}}</strong></div>
          {{#customerAddress}}<div>{{customerAddress}}</div>{{/customerAddress}}
          {{#customerMobile}}<div>Mobile: {{customerMobile}}</div>{{/customerMobile}}
        </div>
      </div>
    </div>
    
    {{#hasAllocations}}
    <div style="background: #f7fafc; border: 1px solid #cbd5e1; padding: 6px; margin-bottom: 8px; border-radius: 4px;">
      <div style="font-size: 10px; font-weight: 600; color: #4a5568; margin-bottom: 3px; text-transform: uppercase;">Payment Allocations</div>
      <table style="width: 100%; border-collapse: collapse; font-size: 9px;">
        <thead>
          <tr style="background: #edf2f7;">
            <th style="border: 1px solid #cbd5e1; padding: 3px; text-align: left; color: #4a5568;">Description</th>
            <th style="border: 1px solid #cbd5e1; padding: 3px; text-align: center; color: #4a5568;">Type</th>
            <th style="border: 1px solid #cbd5e1; padding: 3px; text-align: right; color: #4a5568;">Amount</th>
          </tr>
        </thead>
        <tbody>
          {{#allocations}}
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 3px; color: #2d3748;">{{description}}</td>
            <td style="border: 1px solid #cbd5e1; padding: 3px; text-align: center; color: #2d3748;">{{type}}</td>
            <td style="border: 1px solid #cbd5e1; padding: 3px; text-align: right; color: #2d3748;">₹{{amount}}</td>
          </tr>
          {{/allocations}}
        </tbody>
      </table>
    </div>
    {{/hasAllocations}}
    
    <div class="amount-highlight">
      <div class="amount-value">₹{{amount}}</div>
      <div class="amount-method">Payment Method: {{paymentMethod}}</div>
      {{#bankAccountName}}<div class="amount-method">Bank: {{bankAccountName}}</div>{{/bankAccountName}}
    </div>
    
    <div class="words-container">
      <div class="words-label">Amount in Words</div>
      <div class="words-text">{{amountInWords}}</div>
    </div>
    
    <div class="footer">
      <div class="signature-area">
        <div class="signature-line"></div>
        <div class="signature-label">Received By</div>
      </div>
      <div class="signature-area">
        <div class="signature-line"></div>
        <div class="signature-label">Authorized Signatory</div>
      </div>
    </div>
  </div>
</body>
</html>`
  },

  {
    id: 12,
    name: 'Modern English Payment',
    moduleType: 'payment',
    isDefault: false,
    htmlTemplate: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Payment Receipt - {{receiptNumber}}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #2d3748; }
    .receipt { width: 48%; height: 45vh; margin: 1%; padding: 12px; border: 1px solid #e2e8f0; float: left; page-break-inside: avoid; background: #fff; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: #fff; padding: 8px; margin: -12px -12px 10px -12px; border-radius: 6px 6px 0 0; }
    .company-name { font-size: 18px; font-weight: 600; margin-bottom: 2px; }
    .company-subtitle { font-size: 9px; opacity: 0.9; }
    .receipt-header { background: #f7fafc; border-left: 4px solid #4facfe; padding: 6px; margin-bottom: 8px; }
    .receipt-title { font-size: 12px; font-weight: 600; color: #2d3748; }
    .receipt-meta { display: flex; justify-content: space-between; font-size: 10px; color: #4a5568; }
    .customer-card { background: #f7fafc; border-radius: 4px; padding: 6px; margin-bottom: 8px; }
    .customer-name { font-size: 11px; font-weight: 600; color: #2d3748; margin-bottom: 2px; }
    .customer-details { font-size: 9px; color: #718096; }
    .payment-summary { background: #edf2f7; border-radius: 4px; padding: 8px; text-align: center; margin-bottom: 8px; }
    .amount-display { font-size: 16px; font-weight: 700; color: #2d3748; margin-bottom: 3px; }
    .payment-method { font-size: 10px; color: #4a5568; }
    .words-section { background: #f7fafc; padding: 5px; border-radius: 4px; margin-bottom: 6px; }
    .words-text { font-size: 9px; color: #4a5568; font-style: italic; }
    .footer { display: flex; justify-content: space-between; margin-top: 8px; }
    .signature-area { text-align: center; width: 45%; }
    .signature-line { border-bottom: 1px solid #cbd5e1; height: 20px; margin-bottom: 3px; }
    .signature-label { font-size: 8px; color: #718096; }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <div class="company-name">{{companyName}}</div>
      <div class="company-subtitle">Professional Payment Solutions</div>
    </div>
    
    <div class="receipt-header">
      <div class="receipt-title">Payment Receipt</div>
      <div class="receipt-meta">
        <span><strong>Receipt:</strong> {{receiptNumber}}</span>
        <span><strong>Date:</strong> {{receiptDate}}</span>
      </div>
    </div>
    
    <div class="customer-card">
      <div class="customer-name">{{customerName}}</div>
      <div class="customer-details">
        {{#customerAddress}}<div>{{customerAddress}}</div>{{/customerAddress}}
        {{#customerMobile}}<div>Mobile: {{customerMobile}}</div>{{/customerMobile}}
        {{#customerGstin}}<div>GSTIN: {{customerGstin}}</div>{{/customerGstin}}
      </div>
    </div>
    
    {{#allocations}}
    <div style="background: #f7fafc; border: 1px solid #cbd5e1; padding: 6px; margin-bottom: 8px; border-radius: 4px;">
      <div style="font-size: 10px; font-weight: 600; color: #4a5568; margin-bottom: 3px; text-transform: uppercase;">Payment Allocations</div>
      <table style="width: 100%; border-collapse: collapse; font-size: 9px;">
        <thead>
          <tr style="background: #edf2f7;">
            <th style="border: 1px solid #cbd5e1; padding: 3px; text-align: left; color: #4a5568;">Description</th>
            <th style="border: 1px solid #cbd5e1; padding: 3px; text-align: center; color: #4a5568;">Type</th>
            <th style="border: 1px solid #cbd5e1; padding: 3px; text-align: right; color: #4a5568;">Amount</th>
          </tr>
        </thead>
        <tbody>
          {{#allocations}}
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 3px; color: #2d3748;">{{description}}</td>
            <td style="border: 1px solid #cbd5e1; padding: 3px; text-align: center; color: #2d3748;">{{type}}</td>
            <td style="border: 1px solid #cbd5e1; padding: 3px; text-align: right; color: #2d3748;">₹{{amount}}</td>
          </tr>
          {{/allocations}}
        </tbody>
      </table>
    </div>
    {{/hasAllocations}}
    
    <div class="payment-summary">
      <div class="amount-display">₹{{amount}}</div>
      <div class="payment-method">via {{paymentMethod}}</div>
      {{#bankAccountName}}<div class="payment-method">{{bankAccountName}}</div>{{/bankAccountName}}
    </div>
    
    <div class="words-section">
      <div class="words-text"><strong>Amount in Words:</strong> {{amountInWords}}</div>
    </div>
    
    <div class="footer">
      <div class="signature-area">
        <div class="signature-line"></div>
        <div class="signature-label">Received By</div>
      </div>
      <div class="signature-area">
        <div class="signature-line"></div>
        <div class="signature-label">Authorized Signatory</div>
      </div>
    </div>
  </div>
</body>
</html>`
  },

  // COMPACT OPTIMIZED TEMPLATES
  {
    id: 13,
    name: 'Compact Sales Invoice',
    moduleType: 'sales',
    isDefault: false,
    htmlTemplate: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Sales Invoice - {{invoiceNumber}}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Noto Sans Gujarati', Arial, sans-serif; font-size: 9px; line-height: 1.1; color: #000; }
    .invoice { width: 48%; min-height: 45vh; max-height: none; margin: 0.3%; padding: 6px; border: 1px solid #000; float: left; page-break-inside: avoid; background: #fff; }
    .header { text-align: center; border-bottom: 1px solid #000; padding-bottom: 1px; margin-bottom: 2px; }
    .company-name { font-size: 11px; font-weight: bold; margin-bottom: 0px; }
    .company-address { font-size: 6px; color: #333; }
    .company-gstin { font-size: 5px; color: #666; }
    .invoice-title { background: #000; color: #fff; text-align: center; padding: 1px; margin-bottom: 2px; font-size: 8px; font-weight: bold; }
    .invoice-info { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; margin-bottom: 2px; }
    .info-box { border: 1px solid #000; padding: 1px; text-align: center; background: #f0f0f0; font-size: 6px; }
    .customer-section { border: 1px solid #000; padding: 2px; margin-bottom: 2px; background: #f9f9f9; }
    .section-title { font-size: 6px; font-weight: bold; margin-bottom: 1px; border-bottom: 1px solid #000; padding-bottom: 0px; }
    .items-table { width: 100%; border-collapse: collapse; border: 1px solid #000; margin-bottom: 2px; }
    .items-table th { background: #e0e0e0; padding: 0.5px; font-size: 5px; font-weight: bold; border: 1px solid #000; text-align: center; line-height: 1; }
    .items-table td { border: 1px solid #000; padding: 0.5px; font-size: 5px; text-align: center; line-height: 1; }
    .item-name { text-align: left !important; }
    .total-section { border: 1px solid #000; padding: 2px; background: #f0f0f0; margin-bottom: 2px; }
    .totals-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; font-size: 6px; }
    .total-left { text-align: left; }
    .total-right { text-align: right; }
    .final-total { grid-column: span 2; font-weight: bold; border-top: 1px solid #000; padding-top: 1px; margin-top: 1px; font-size: 7px; text-align: center; }
    .amount-words { border: 1px solid #000; padding: 1px; background: #f9f9f9; margin-bottom: 2px; font-size: 6px; line-height: 1.1; }
    .footer { display: flex; justify-content: space-between; font-size: 5px; color: #666; }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="header">
      <div class="company-name">{{companyName}}</div>
      <div class="company-address">{{companyAddress}}</div>
      {{#companyGstin}}<div class="company-gstin">જીએસટીઆઈએન: {{companyGstin}}</div>{{/companyGstin}}
    </div>
    
    <div class="invoice-title">વેચાણ બિલ / SALES INVOICE</div>
    
    <div class="invoice-info">
      <div class="info-box">
        <div><strong>બિલ નં.</strong></div>
        <div>{{invoiceNumber}}</div>
      </div>
      <div class="info-box">
        <div><strong>તારીખ</strong></div>
        <div>{{invoiceDate}}</div>
      </div>
    </div>
    
    <div class="customer-section">
      <div class="section-title">ગ્રાહક / CUSTOMER</div>
      <div><strong>{{customerName}}</strong></div>
      {{#customerAddress}}<div>{{customerAddress}}</div>{{/customerAddress}}
      {{#customerGstin}}<div>જીએસટીઆઈએન: {{customerGstin}}</div>{{/customerGstin}}
    </div>
    
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 5%;">ક્રમ</th>
          <th style="width: 40%;">માલનું નામ</th>
          <th style="width: 7%;">નંગ</th>
          <th style="width: 12%;">ભાવ</th>
          <th style="width: 7%;">છૂટ</th>
          <th style="width: 6%;">કર%</th>
          <th style="width: 8%;">કર રકમ</th>
          <th style="width: 15%;">કુલ</th>
        </tr>
      </thead>
      <tbody>
        {{#items}}
        <tr>
          <td>{{index}}</td>
          <td class="item-name">{{name}}</td>
          <td>{{quantity}}</td>
          <td>₹{{rate}}</td>
          <td>{{#discount}}₹{{discount}}{{/discount}}{{^discount}}-{{/discount}}</td>
          <td>{{taxRate}}%</td>
          <td>₹{{taxAmount}}</td>
          <td>₹{{total}}</td>
        </tr>
        {{/items}}
      </tbody>
    </table>
    
    <div class="total-section">
      <div class="totals-grid">
        <div class="total-left">મૂળ રકમ:</div><div class="total-right">₹{{basicAmount}}</div>
        {{#totalDiscount}}<div class="total-left">કુલ છૂટ:</div><div class="total-right">-₹{{totalDiscount}}</div>{{/totalDiscount}}
        {{#cgstAmount}}<div class="total-left">CGST ({{cgstRate}}%):</div><div class="total-right">₹{{cgstAmount}}</div>{{/cgstAmount}}
        {{#sgstAmount}}<div class="total-left">SGST ({{sgstRate}}%):</div><div class="total-right">₹{{sgstAmount}}</div>{{/sgstAmount}}
        {{#igstAmount}}<div class="total-left">IGST ({{igstRate}}%):</div><div class="total-right">₹{{igstAmount}}</div>{{/igstAmount}}
        {{#transportationCharge}}<div class="total-left">પરિવહન:</div><div class="total-right">₹{{transportationCharge}}</div>{{/transportationCharge}}
        {{#roundOff}}<div class="total-left">રાઉન્ડ ઓફ:</div><div class="total-right">₹{{roundOff}}</div>{{/roundOff}}
        <div class="final-total">કુલ રકમ / TOTAL: ₹{{netReceivable}}</div>
      </div>
    </div>
    
    <div class="amount-words">
      <strong>અક્ષરે રકમ:</strong> {{amountInWords}}
    </div>
    
    <div class="footer">
      <div>આભાર</div>
      <div>{{status}}</div>
    </div>
  </div>
</body>
</html>`
  },

  {
    id: 14,
    name: 'Compact Purchase Invoice',
    moduleType: 'purchase',
    isDefault: false,
    htmlTemplate: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Purchase Invoice - {{invoiceNumber}}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Noto Sans Gujarati', Arial, sans-serif; font-size: 9px; line-height: 1.1; color: #000; }
    .invoice { width: 48%; min-height: 45vh; max-height: none; margin: 0.3%; padding: 6px; border: 1px solid #000; float: left; page-break-inside: avoid; background: #fff; }
    .header { text-align: center; border-bottom: 1px solid #000; padding-bottom: 1px; margin-bottom: 2px; }
    .company-name { font-size: 11px; font-weight: bold; margin-bottom: 0px; }
    .company-address { font-size: 6px; color: #333; }
    .company-gstin { font-size: 5px; color: #666; }
    .invoice-title { background: #000; color: #fff; text-align: center; padding: 1px; margin-bottom: 2px; font-size: 8px; font-weight: bold; }
    .invoice-info { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; margin-bottom: 2px; }
    .info-box { border: 1px solid #000; padding: 1px; text-align: center; background: #f0f0f0; font-size: 6px; }
    .supplier-section { border: 1px solid #000; padding: 2px; margin-bottom: 2px; background: #f9f9f9; }
    .section-title { font-size: 6px; font-weight: bold; margin-bottom: 1px; border-bottom: 1px solid #000; padding-bottom: 0px; }
    .items-table { width: 100%; border-collapse: collapse; border: 1px solid #000; margin-bottom: 2px; }
    .items-table th { background: #e0e0e0; padding: 0.5px; font-size: 5px; font-weight: bold; border: 1px solid #000; text-align: center; line-height: 1; }
    .items-table td { border: 1px solid #000; padding: 0.5px; font-size: 5px; text-align: center; line-height: 1; }
    .item-name { text-align: left !important; }
    .total-section { border: 1px solid #000; padding: 2px; background: #f0f0f0; margin-bottom: 2px; }
    .totals-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; font-size: 6px; }
    .total-left { text-align: left; }
    .total-right { text-align: right; }
    .final-total { grid-column: span 2; font-weight: bold; border-top: 1px solid #000; padding-top: 1px; margin-top: 1px; font-size: 7px; text-align: center; }
    .amount-words { border: 1px solid #000; padding: 1px; background: #f9f9f9; margin-bottom: 2px; font-size: 6px; line-height: 1.1; }
    .footer { display: flex; justify-content: space-between; font-size: 5px; color: #666; }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="header">
      <div class="company-name">{{companyName}}</div>
      <div class="company-address">{{companyAddress}}</div>
      {{#companyGstin}}<div class="company-gstin">જીએસટીઆઈએન: {{companyGstin}}</div>{{/companyGstin}}
    </div>
    
    <div class="invoice-title">ખરીદી બિલ / PURCHASE INVOICE</div>
    
    <div class="invoice-info">
      <div class="info-box">
        <div><strong>બિલ નં.</strong></div>
        <div>{{invoiceNumber}}</div>
      </div>
      <div class="info-box">
        <div><strong>તારીખ</strong></div>
        <div>{{invoiceDate}}</div>
      </div>
    </div>
    
    <div class="supplier-section">
      <div class="section-title">સપ્લાયર / SUPPLIER</div>
      <div><strong>{{supplierName}}</strong></div>
      {{#supplierAddress}}<div>{{supplierAddress}}</div>{{/supplierAddress}}
      {{#supplierGstin}}<div>જીએસટીઆઈએન: {{supplierGstin}}</div>{{/supplierGstin}}
    </div>
    
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 5%;">ક્રમ</th>
          <th style="width: 40%;">માલનું નામ</th>
          <th style="width: 7%;">નંગ</th>
          <th style="width: 12%;">ભાવ</th>
          <th style="width: 7%;">છૂટ</th>
          <th style="width: 6%;">કર%</th>
          <th style="width: 8%;">કર રકમ</th>
          <th style="width: 15%;">કુલ</th>
        </tr>
      </thead>
      <tbody>
        {{#items}}
        <tr>
          <td>{{index}}</td>
          <td class="item-name">{{name}}</td>
          <td>{{quantity}}</td>
          <td>₹{{rate}}</td>
          <td>{{#discount}}₹{{discount}}{{/discount}}{{^discount}}-{{/discount}}</td>
          <td>{{taxRate}}%</td>
          <td>₹{{taxAmount}}</td>
          <td>₹{{total}}</td>
        </tr>
        {{/items}}
      </tbody>
    </table>
    
    <div class="total-section">
      <div class="totals-grid">
        <div class="total-left">મૂળ રકમ:</div><div class="total-right">₹{{basicAmount}}</div>
        {{#totalDiscount}}<div class="total-left">કુલ છૂટ:</div><div class="total-right">-₹{{totalDiscount}}</div>{{/totalDiscount}}
        {{#cgstAmount}}<div class="total-left">CGST ({{cgstRate}}%):</div><div class="total-right">₹{{cgstAmount}}</div>{{/cgstAmount}}
        {{#sgstAmount}}<div class="total-left">SGST ({{sgstRate}}%):</div><div class="total-right">₹{{sgstAmount}}</div>{{/sgstAmount}}
        {{#igstAmount}}<div class="total-left">IGST ({{igstRate}}%):</div><div class="total-right">₹{{igstAmount}}</div>{{/igstAmount}}
        {{#transportationCharge}}<div class="total-left">પરિવહન:</div><div class="total-right">₹{{transportationCharge}}</div>{{/transportationCharge}}
        {{#roundOff}}<div class="total-left">રાઉન્ડ ઓફ:</div><div class="total-right">₹{{roundOff}}</div>{{/roundOff}}
        <div class="final-total">કુલ રકમ / TOTAL: ₹{{netPayable}}</div>
      </div>
    </div>
    
    <div class="amount-words">
      <strong>અક્ષરે રકમ:</strong> {{amountInWords}}
    </div>
    
    <div class="footer">
      <div>આભાર</div>
      <div>{{status}}</div>
    </div>
  </div>
</body>
</html>`
  },

  // PROFESSIONAL LOGO TEMPLATES
  {
    id: 15,
    name: 'Professional Sales Invoice with Logo',
    moduleType: 'sales',
    isDefault: true,
    htmlTemplate: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Sales Invoice - {{invoiceNumber}}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Noto Sans Gujarati', Arial, sans-serif; font-size: 10px; line-height: 1.2; color: #000; }
    .invoice { width: 48%; min-height: 45vh; max-height: none; margin: 0.5%; padding: 8px; border: 2px solid #000; float: left; page-break-inside: avoid; background: #fff; }
    .header { display: flex; align-items: center; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 6px; }
    .company-logo { width: 40px; height: 40px; margin-right: 10px; display: flex; align-items: center; justify-content: center; border: 1px solid #ddd; border-radius: 6px; background: #f8f9fa; flex-shrink: 0; }
    .company-logo img { max-width: 35px; max-height: 35px; object-fit: contain; border-radius: 4px; display: block; }
    .company-logo.placeholder { font-size: 8px; color: #999; text-align: center; line-height: 1.2; font-weight: bold; }
    .company-info { flex: 1; text-align: center; }
    .company-name { font-size: 16px; font-weight: bold; margin-bottom: 2px; color: #333; }
    .company-address { font-size: 9px; color: #666; margin-bottom: 1px; }
    .company-gstin { font-size: 8px; color: #888; }
    .invoice-title { background: #000; color: #fff; text-align: center; padding: 3px; margin-bottom: 5px; font-size: 11px; font-weight: bold; }
    .invoice-info { display: flex; justify-content: space-between; margin-bottom: 5px; }
    .info-box { border: 1px solid #000; padding: 3px; text-align: center; background: #f0f0f0; width: 48%; font-size: 9px; }
    .customer-section { border: 1px solid #000; padding: 4px; margin-bottom: 5px; background: #f9f9f9; }
    .section-title { font-size: 9px; font-weight: bold; margin-bottom: 2px; border-bottom: 1px solid #000; padding-bottom: 1px; }
    .items-table { width: 100%; border-collapse: collapse; border: 2px solid #000; margin-bottom: 5px; }
    .items-table th { background: #e0e0e0; padding: 1.5px; font-size: 7px; font-weight: bold; border: 1px solid #000; text-align: center; line-height: 1.1; }
    .items-table td { border: 1px solid #000; padding: 1px; font-size: 7px; text-align: center; line-height: 1.1; }
    .item-name { text-align: left !important; }
    .total-section { border: 1px solid #000; padding: 4px; background: #f0f0f0; text-align: right; margin-bottom: 5px; }
    .total-row { font-size: 8px; margin-bottom: 1px; line-height: 1.1; }
    .final-total { font-weight: bold; border-top: 2px solid #000; padding-top: 2px; margin-top: 2px; font-size: 9px; }
    .amount-words { border: 1px solid #000; padding: 3px; background: #f9f9f9; margin-bottom: 4px; font-size: 8px; line-height: 1.2; }
    .footer { display: flex; justify-content: space-between; font-size: 8px; color: #666; }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="header">
      <div class="company-logo{{^companyLogoUrl}} placeholder{{/companyLogoUrl}}">
        {{#companyLogoUrl}}
        <img src="{{companyLogoUrl}}" alt="Company Logo" onerror="this.parentElement.innerHTML='<div style=\'font-size: 8px; color: #999; font-weight: bold; text-align: center;\'>LOGO</div>'">
        {{/companyLogoUrl}}
        {{^companyLogoUrl}}
        LOGO
        {{/companyLogoUrl}}
      </div>
      <div class="company-info">
        <div class="company-name">{{companyName}}</div>
        <div class="company-address">{{companyAddress}}</div>
        {{#companyGstin}}<div class="company-gstin">જીએસટીઆઈએન: {{companyGstin}}</div>{{/companyGstin}}
      </div>
    </div>
    
    <div class="invoice-title">વેચાણ બિલ / SALES INVOICE</div>
    
    <div class="invoice-info">
      <div class="info-box">
        <div><strong>બિલ નં. / Bill No.</strong></div>
        <div>{{invoiceNumber}}</div>
      </div>
      <div class="info-box">
        <div><strong>તારીખ / Date</strong></div>
        <div>{{invoiceDate}}</div>
      </div>
    </div>
    
    <div class="customer-section">
      <div class="section-title">ગ્રાહક વિગતો / CUSTOMER DETAILS</div>
      <div><strong>{{customerName}}</strong></div>
      {{#customerAddress}}<div>{{customerAddress}}</div>{{/customerAddress}}
      {{#customerGstin}}<div><strong>જીએસટીઆઈએન:</strong> {{customerGstin}}</div>{{/customerGstin}}
      {{#customerMobile}}<div><strong>મોબાઇલ:</strong> {{customerMobile}}</div>{{/customerMobile}}
    </div>
    
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 6%;">ક્રમ<br>Sr</th>
          <th style="width: 35%;">માલનું નામ<br>Product</th>
          <th style="width: 8%;">નંગ<br>Qty</th>
          <th style="width: 12%;">ભાવ (કર વગર)<br>Rate (Without tax)</th>
          <th style="width: 8%;">છૂટ<br>Disc</th>
          <th style="width: 7%;">કર%<br>Tax</th>
          <th style="width: 10%;">કર રકમ<br>Tax Amt</th>
          <th style="width: 14%;">કુલ<br>Total</th>
        </tr>
      </thead>
      <tbody>
        {{#items}}
        <tr>
          <td>{{index}}</td>
          <td class="item-name">{{name}}</td>
          <td>{{quantity}}</td>
          <td>₹{{rateWithoutTax}}</td>
          <td>{{#discount}}₹{{discount}}{{/discount}}{{^discount}}-{{/discount}}</td>
          <td>{{taxRate}}%</td>
          <td>₹{{taxAmount}}</td>
          <td>₹{{total}}</td>
        </tr>
        {{/items}}
      </tbody>
    </table>
    
    <div class="total-section">
      <div class="total-row">મૂળ રકમ / Subtotal: ₹{{basicAmount}}</div>
      {{#totalDiscount}}<div class="total-row">કુલ છૂટ / Discount: -₹{{totalDiscount}}</div>{{/totalDiscount}}
      {{#cgstAmount}}<div class="total-row">સી.જી.એસ.ટી / CGST ({{cgstRate}}%): ₹{{cgstAmount}}</div>{{/cgstAmount}}
      {{#sgstAmount}}<div class="total-row">એસ.જી.એસ.ટી / SGST ({{sgstRate}}%): ₹{{sgstAmount}}</div>{{/sgstAmount}}
      {{#igstAmount}}<div class="total-row">આઈ.જી.એસ.ટી / IGST ({{igstRate}}%): ₹{{igstAmount}}</div>{{/igstAmount}}
      {{#transportationCharge}}<div class="total-row">પરિવહન / Transport: ₹{{transportationCharge}}</div>{{/transportationCharge}}
      {{#roundOff}}<div class="total-row">રાઉન્ડ ઓફ / Round Off: ₹{{roundOff}}</div>{{/roundOff}}
      <div class="final-total">કુલ રકમ / TOTAL: ₹{{netReceivable}}</div>
    </div>
    
    <div class="amount-words">
      <strong>અક્ષરે રકમ / Amount in Words:</strong> {{amountInWords}}
    </div>
    
    <div class="footer">
      <div>આભાર / Thank You</div>
      <div>સ્ટેટસ: {{status}}</div>
    </div>
  </div>
</body>
</html>`
  },

  {
    id: 16,
    name: 'Professional Purchase Invoice with Logo',
    moduleType: 'purchase',
    isDefault: true,
    htmlTemplate: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Purchase Invoice - {{invoiceNumber}}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Noto Sans Gujarati', Arial, sans-serif; font-size: 10px; line-height: 1.2; color: #000; }
    .invoice { width: 48%; min-height: 45vh; max-height: none; margin: 0.5%; padding: 8px; border: 2px solid #000; float: left; page-break-inside: avoid; background: #fff; }
    .header { display: flex; align-items: center; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 6px; }
    .company-logo { width: 40px; height: 40px; margin-right: 10px; display: flex; align-items: center; justify-content: center; border: 1px solid #ddd; border-radius: 6px; background: #f8f9fa; flex-shrink: 0; }
    .company-logo img { max-width: 35px; max-height: 35px; object-fit: contain; border-radius: 4px; display: block; }
    .company-logo.placeholder { font-size: 8px; color: #999; text-align: center; line-height: 1.2; font-weight: bold; }
    .company-info { flex: 1; text-align: center; }
    .company-name { font-size: 16px; font-weight: bold; margin-bottom: 2px; color: #333; }
    .company-address { font-size: 9px; color: #666; margin-bottom: 1px; }
    .company-gstin { font-size: 8px; color: #888; }
    .invoice-title { background: #000; color: #fff; text-align: center; padding: 3px; margin-bottom: 5px; font-size: 11px; font-weight: bold; }
    .invoice-info { display: flex; justify-content: space-between; margin-bottom: 5px; }
    .info-box { border: 1px solid #000; padding: 3px; text-align: center; background: #f0f0f0; width: 48%; font-size: 9px; }
    .supplier-section { border: 1px solid #000; padding: 4px; margin-bottom: 5px; background: #f9f9f9; }
    .section-title { font-size: 9px; font-weight: bold; margin-bottom: 2px; border-bottom: 1px solid #000; padding-bottom: 1px; }
    .items-table { width: 100%; border-collapse: collapse; border: 2px solid #000; margin-bottom: 5px; }
    .items-table th { background: #e0e0e0; padding: 1.5px; font-size: 7px; font-weight: bold; border: 1px solid #000; text-align: center; line-height: 1.1; }
    .items-table td { border: 1px solid #000; padding: 1px; font-size: 7px; text-align: center; line-height: 1.1; }
    .item-name { text-align: left !important; }
    .total-section { border: 1px solid #000; padding: 4px; background: #f0f0f0; text-align: right; margin-bottom: 5px; }
    .total-row { font-size: 8px; margin-bottom: 1px; line-height: 1.1; }
    .final-total { font-weight: bold; border-top: 2px solid #000; padding-top: 2px; margin-top: 2px; font-size: 9px; }
    .amount-words { border: 1px solid #000; padding: 3px; background: #f9f9f9; margin-bottom: 4px; font-size: 8px; line-height: 1.2; }
    .footer { display: flex; justify-content: space-between; font-size: 8px; color: #666; }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="header">
      <div class="company-logo{{^companyLogoUrl}} placeholder{{/companyLogoUrl}}">
        {{#companyLogoUrl}}
        <img src="{{companyLogoUrl}}" alt="Company Logo" onerror="this.parentElement.innerHTML='<div style=\'font-size: 8px; color: #999; font-weight: bold; text-align: center;\'>LOGO</div>'">
        {{/companyLogoUrl}}
        {{^companyLogoUrl}}
        LOGO
        {{/companyLogoUrl}}
      </div>
      <div class="company-info">
        <div class="company-name">{{companyName}}</div>
        <div class="company-address">{{companyAddress}}</div>
        {{#companyGstin}}<div class="company-gstin">જીએસટીઆઈએન: {{companyGstin}}</div>{{/companyGstin}}
      </div>
    </div>
    
    <div class="invoice-title">ખરીદી બિલ / PURCHASE INVOICE</div>
    
    <div class="invoice-info">
      <div class="info-box">
        <div><strong>બિલ નં. / Bill No.</strong></div>
        <div>{{invoiceNumber}}</div>
      </div>
      <div class="info-box">
        <div><strong>તારીખ / Date</strong></div>
        <div>{{invoiceDate}}</div>
      </div>
    </div>
    
    <div class="supplier-section">
      <div class="section-title">સપ્લાયર વિગતો / SUPPLIER DETAILS</div>
      <div><strong>{{supplierName}}</strong></div>
      {{#supplierAddress}}<div>{{supplierAddress}}</div>{{/supplierAddress}}
      {{#supplierGstin}}<div><strong>જીએસટીઆઈએન:</strong> {{supplierGstin}}</div>{{/supplierGstin}}
      {{#supplierMobile}}<div><strong>મોબાઇલ:</strong> {{supplierMobile}}</div>{{/supplierMobile}}
    </div>
    
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 6%;">ક્રમ<br>Sr</th>
          <th style="width: 35%;">માલનું નામ<br>Product</th>
          <th style="width: 8%;">નંગ<br>Qty</th>
          <th style="width: 12%;">ભાવ (કર વગર)<br>Rate (Without tax)</th>
          <th style="width: 8%;">છૂટ<br>Disc</th>
          <th style="width: 7%;">કર%<br>Tax</th>
          <th style="width: 10%;">કર રકમ<br>Tax Amt</th>
          <th style="width: 14%;">કુલ<br>Total</th>
        </tr>
      </thead>
      <tbody>
        {{#items}}
        <tr>
          <td>{{index}}</td>
          <td class="item-name">{{name}}</td>
          <td>{{quantity}}</td>
          <td>₹{{rateWithoutTax}}</td>
          <td>{{#discount}}₹{{discount}}{{/discount}}{{^discount}}-{{/discount}}</td>
          <td>{{taxRate}}%</td>
          <td>₹{{taxAmount}}</td>
          <td>₹{{total}}</td>
        </tr>
        {{/items}}
      </tbody>
    </table>
    
    <div class="total-section">
      <div class="total-row">મૂળ રકમ / Subtotal: ₹{{basicAmount}}</div>
      {{#totalDiscount}}<div class="total-row">કુલ છૂટ / Discount: -₹{{totalDiscount}}</div>{{/totalDiscount}}
      {{#cgstAmount}}<div class="total-row">સી.જી.એસ.ટી / CGST ({{cgstRate}}%): ₹{{cgstAmount}}</div>{{/cgstAmount}}
      {{#sgstAmount}}<div class="total-row">એસ.જી.એસ.ટી / SGST ({{sgstRate}}%): ₹{{sgstAmount}}</div>{{/sgstAmount}}
      {{#igstAmount}}<div class="total-row">આઈ.જી.એસ.ટી / IGST ({{igstRate}}%): ₹{{igstAmount}}</div>{{/igstAmount}}
      {{#transportationCharge}}<div class="total-row">પરિવહન / Transport: ₹{{transportationCharge}}</div>{{/transportationCharge}}
      {{#roundOff}}<div class="total-row">રાઉન્ડ ઓફ / Round Off: ₹{{roundOff}}</div>{{/roundOff}}
      <div class="final-total">કુલ રકમ / TOTAL: ₹{{netPayable}}</div>
    </div>
    
    <div class="amount-words">
      <strong>અક્ષરે રકમ / Amount in Words:</strong> {{amountInWords}}
    </div>
    
    <div class="footer">
      <div>આભાર / Thank You</div>
      <div>સ્ટેટસ: {{status}}</div>
    </div>
  </div>
</body>
</html>`
  }
];

async function updateTemplates() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Updating invoice templates...');
    
    // Clear existing templates
    await client.query(`DELETE FROM hisab."invoiceTemplates" WHERE "moduleType" IN ('sales', 'purchase', 'payment')`);
    
    // Insert new templates
    for (const template of templates) {
      await client.query(`
        INSERT INTO hisab."invoiceTemplates" (
          id, "name", "moduleType", "htmlTemplate", "isDefault", "isActive", 
          "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      `, [
        template.id,
        template.name,
        template.moduleType,
        template.htmlTemplate,
        template.isDefault,
        true
      ]);
    }
    
    console.log('✅ Templates updated successfully!');
    console.log(`📊 Inserted ${templates.length} templates`);
    
  } catch (error) {
    console.error('❌ Error updating templates:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

updateTemplates(); 