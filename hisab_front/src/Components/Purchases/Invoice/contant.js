export const TAX_TYPES = [
  { value: 'no_tax', label: 'No Tax', rate: 0 },
  { value: 'local_registered', label: 'Local - registered', rate: 18 },
  { value: 'outstate', label: 'Outstate', rate: 18 },
  { value: 'import_deemed', label: 'Import deemed', rate: 18 },
  { value: 'import_with_igst', label: 'Import with IGST', rate: 18 },
  { value: 'import_under_bond', label: 'Import under bond/LUT', rate: 0 },
  { value: 'merchant_export_local', label: 'Merchant export Local', rate: 0 },
  { value: 'merchant_export_outstate', label: 'Merchant export outstate', rate: 0 }
];

export const DISCOUNT_TYPES = [
  { value: 'none', label: 'None' },
  { value: 'per_item', label: 'Per Item' },
  { value: 'on_invoice', label: 'On Invoice' },
  { value: 'per_item_and_invoice', label: 'Per Item & On Invoice' }
];

export const DISCOUNT_VALUE_TYPES = [
  { value: 'percentage', label: 'Percentage (%)' },
  { value: 'rupees', label: 'Rupees (₹)' }
];

export const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
];