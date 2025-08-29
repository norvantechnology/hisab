/**
 * Common tax calculation utilities for the HISAB application
 * This file contains functions for calculating tax amounts, totals, and discounts
 * based on different rate types (with_tax vs without_tax)
 */

/**
 * Calculate tax amount and total based on rate type
 * @param {Object} params - Calculation parameters
 * @param {number} params.rate - The item rate
 * @param {number} params.quantity - The item quantity
 * @param {number} params.taxRate - The tax rate percentage
 * @param {number} params.discountRate - The discount rate percentage
 * @param {string} params.rateType - Either 'with_tax' or 'without_tax'
 * @param {string} params.discountValueType - Either 'percentage' or 'rupees'
 * @param {number} params.discountValue - The discount value (percentage or rupees)
 * @returns {Object} Object containing subtotal, discount, taxAmount, total, and other calculated values
 */
export const calculateItemTaxAndTotal = ({
  rate,
  quantity,
  taxRate,
  discountRate = 0,
  rateType = 'without_tax',
  discountValueType = 'percentage',
  discountValue = 0
}) => {
  // Parse and validate inputs
  const validRate = parseFloat(rate) || 0;
  const validQuantity = parseFloat(quantity) || 0;
  const validTaxRate = parseFloat(taxRate) || 0;
  const validDiscountRate = parseFloat(discountRate) || 0;
  const validDiscountValue = parseFloat(discountValue) || 0;

  // Calculate subtotal
  const subtotal = validQuantity * validRate;

  // Calculate discount
  let discount = 0;
  if (discountValueType === 'percentage') {
    discount = (subtotal * validDiscountRate) / 100;
  } else if (discountValueType === 'rupees') {
    discount = validDiscountValue;
  }
  const afterDiscount = subtotal - discount;

  // Calculate tax based on rate type
  let taxAmount = 0;
  let total = 0;

  if (rateType === 'with_tax') {
    // For "With Tax" items, we want the total to be the rate input
    // So we calculate backwards: total = rate input, then calculate tax amount
    total = afterDiscount;
    // Calculate tax amount: if total = base + tax, then tax = total - base
    // base = total / (1 + taxRate/100)
    const baseAmount = total / (1 + (validTaxRate / 100));
    taxAmount = total - baseAmount;
  } else {
    // For "Without Tax" items, add tax to the rate
    taxAmount = (afterDiscount * validTaxRate) / 100;
    total = afterDiscount + taxAmount;
  }

  return {
    subtotal,
    discount,
    afterDiscount,
    taxAmount,
    total,
    rateWithoutTax: rateType === 'with_tax' ? total / (1 + (validTaxRate / 100)) : validRate,
    rateWithTax: rateType === 'with_tax' ? validRate : total
  };
};

/**
 * Calculate tax amount for display purposes (used in invoice totals)
 * @param {Object} item - The item object
 * @param {string} taxType - The selected tax type
 * @param {Array} TAX_TYPES - Array of available tax types
 * @returns {number} The calculated tax amount
 */
export const calculateItemTaxAmount = (item, taxType, TAX_TYPES) => {
  const quantity = item.isSerialized ? (item.serialNumbers || []).length : parseFloat(item.quantity || 0);
  const subtotal = quantity * parseFloat(item.rate || 0);
  
  // Calculate discount first based on discount type
  const discountRate = parseFloat(item.discountRate) || 0;
  let discount = 0;
  const itemDiscountType = item.discountType || 'percentage';
  if (itemDiscountType === 'percentage') {
    discount = (subtotal * discountRate) / 100;
  } else if (itemDiscountType === 'rupees') {
    discount = discountRate;
  }
  const afterDiscount = subtotal - discount;
  
  // Calculate tax only if the selected tax type has rate > 0
  let taxAmount = 0;
  const selectedTax = TAX_TYPES.find(tax => tax.value === taxType);
  if (selectedTax && selectedTax.rate > 0) {
    const taxRate = parseFloat(item.taxRate) || 0;
    if (item.rateType === 'with_tax') {
      // For "With Tax" items, we want the total to be the rate input
      // So we calculate backwards: total = rate input, then calculate tax amount
      const total = afterDiscount;
      // Calculate tax amount: if total = base + tax, then tax = total - base
      // base = total / (1 + taxRate/100)
      const baseAmount = total / (1 + (taxRate / 100));
      taxAmount = total - baseAmount;
    } else {
      // For "Without Tax" items, add tax to the rate
      taxAmount = (afterDiscount * taxRate) / 100;
    }
  }
  
  return taxAmount;
};

/**
 * Calculate item total for display purposes
 * @param {Object} item - The item object
 * @param {string} taxType - The selected tax type
 * @returns {number} The calculated total
 */
export const calculateItemTotalForDisplay = (item, taxType) => {
  const quantity = item.isSerialized ? (item.serialNumbers || []).length : parseFloat(item.quantity || 0);
  const subtotal = quantity * parseFloat(item.rate || 0);
  
  // Calculate discount first based on discount type
  const discountRate = parseFloat(item.discountRate) || 0;
  let discount = 0;
  const itemDiscountType = item.discountType || 'percentage';
  if (itemDiscountType === 'percentage') {
    discount = (subtotal * discountRate) / 100;
  } else if (itemDiscountType === 'rupees') {
    discount = discountRate;
  }
  const afterDiscount = subtotal - discount;
  
  // Calculate tax only if the selected tax type has rate > 0
  let taxAmount = 0;
  // Note: TAX_TYPES should be passed from the component or imported
  // For now, we'll assume tax should be calculated if taxRate > 0
  const taxRate = parseFloat(item.taxRate) || 0;
  if (taxRate > 0) {
    if (item.rateType === 'with_tax') {
      // For "With Tax" items, we want the total to be the rate input
      // So we calculate backwards: total = rate input, then calculate tax amount
      const total = afterDiscount;
      // Calculate tax amount: if total = base + tax, then tax = total - base
      // base = total / (1 + taxRate/100)
      const baseAmount = total / (1 + (taxRate / 100));
      taxAmount = total - baseAmount;
    } else {
      // For "Without Tax" items, add tax to the rate
      taxAmount = (afterDiscount * taxRate) / 100;
    }
  }
  
  const total = afterDiscount + taxAmount;
  return total;
}; 