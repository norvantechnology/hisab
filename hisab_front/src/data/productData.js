// Sample data for Product CSV import
export const sampleProductData = [
    {
        name: 'iPhone 14 Pro',
        itemType: 'product',
        itemCode: 'IPH14PRO',
        hsnCode: '85171200',
        description: 'Apple iPhone 14 Pro 128GB Space Black',
        defaultInvoiceDescription: 'iPhone 14 Pro - Latest Apple smartphone',
        isInventoryTracked: 'true',
        isSerialized: 'false',
        unitOfMeasurement: 'Pieces',
        stockCategory: 'Electronics',
        rate: '99999.00',
        isTaxInclusive: 'false',
        discount: '0.00',
        taxCategory: 'GST 18%',
        openingStockQty: '50',
        openingStockCostPerQty: '85000.00'
    },
    {
        name: 'MacBook Air M2',
        itemType: 'product',
        itemCode: 'MBA-M2',
        hsnCode: '84713000',
        description: 'Apple MacBook Air with M2 chip 256GB SSD',
        defaultInvoiceDescription: 'MacBook Air M2 - Ultra-portable laptop',
        isInventoryTracked: 'true',
        isSerialized: 'true',
        unitOfMeasurement: 'Pieces',
        stockCategory: 'Computers',
        rate: '119900.00',
        isTaxInclusive: 'false',
        discount: '2.00',
        taxCategory: 'GST 18%',
        openingStockQty: '25',
        openingStockCostPerQty: '105000.00'
    },
    {
        name: 'Web Development Service',
        itemType: 'service',
        itemCode: 'WEB-DEV',
        hsnCode: '998314',
        description: 'Professional web development services',
        defaultInvoiceDescription: 'Custom website development and design',
        isInventoryTracked: 'false',
        isSerialized: 'false',
        unitOfMeasurement: 'Hour',
        stockCategory: '',
        rate: '5000.00',
        isTaxInclusive: 'true',
        discount: '0.00',
        taxCategory: 'GST 18%',
        openingStockQty: '0',
        openingStockCostPerQty: '0.00'
    },
    {
        name: 'Samsung Galaxy S23',
        itemType: 'product',
        itemCode: 'SGS23',
        hsnCode: '85171200',
        description: 'Samsung Galaxy S23 128GB Phantom Black',
        defaultInvoiceDescription: 'Samsung Galaxy S23 - Premium Android phone',
        isInventoryTracked: 'true',
        isSerialized: 'false',
        unitOfMeasurement: 'Pieces',
        stockCategory: 'Electronics',
        rate: '74999.00',
        isTaxInclusive: 'false',
        discount: '5.00',
        taxCategory: 'GST 18%',
        openingStockQty: '30',
        openingStockCostPerQty: '65000.00'
    },
    {
        name: 'Dell XPS 13',
        itemType: 'product',
        itemCode: 'DELL-XPS13',
        hsnCode: '84713000',
        description: 'Dell XPS 13 Laptop Intel i7 16GB RAM 512GB SSD',
        defaultInvoiceDescription: 'Dell XPS 13 - Premium ultrabook',
        isInventoryTracked: 'true',
        isSerialized: 'true',
        unitOfMeasurement: 'Pieces',
        stockCategory: 'Computers',
        rate: '89999.00',
        isTaxInclusive: 'false',
        discount: '3.00',
        taxCategory: 'GST 18%',
        openingStockQty: '15',
        openingStockCostPerQty: '78000.00'
    }
];

// Product field configurations
export const productFields = {
    required: ['name', 'itemType', 'rate'],
    optional: [
        'itemCode', 'hsnCode', 'description', 'defaultInvoiceDescription',
        'isInventoryTracked', 'isSerialized', 'unitOfMeasurement', 'stockCategory',
        'isTaxInclusive', 'discount', 'taxCategory', 'openingStockQty', 'openingStockCostPerQty'
    ]
};

// Product item type options
export const itemTypes = [
    { value: 'product', label: 'Product' },
    { value: 'service', label: 'Service' },
    { value: 'bundle', label: 'Bundle' }
];

// CSV Field descriptions for help
export const productFieldDescriptions = {
    name: 'Product name (required)',
    itemType: 'Type of item: product, service, or bundle (required)',
    itemCode: 'Unique product code/SKU',
    hsnCode: 'HSN/SAC code for tax purposes',
    description: 'Detailed product description',
    defaultInvoiceDescription: 'Description to show on invoices',
    isInventoryTracked: 'Track inventory: true/false (default: false)',
    isSerialized: 'Track serial numbers: true/false (default: false)',
    unitOfMeasurement: 'Unit name - must exist in database (Pieces, Hour, Kilogram, etc.)',
    stockCategory: 'Stock category name - will be created if not exists (leave empty for services)',
    rate: 'Selling price per unit (required)',
    isTaxInclusive: 'Price includes tax: true/false (default: false)',
    discount: 'Default discount percentage (0-100)',
    taxCategory: 'Tax category name - must exist in database (GST 18%, GST 12%, GST 5%, etc.)',
    openingStockQty: 'Initial stock quantity (default: 0)',
    openingStockCostPerQty: 'Cost per unit for opening stock (default: 0)'
}; 