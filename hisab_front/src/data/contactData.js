// Sample data for CSV import
export const sampleContactData = [
    {
        name: 'John Doe',
        gstin: '22AAAAA0000A1Z5',
        mobile: '9876543210',
        email: 'john.doe@example.com',
        dueDays: '30',
        contactType: 'customer',
        billingAddress1: '123 Main Street',
        billingAddress2: 'Apartment 4B',
        billingCity: 'Mumbai',
        billingPincode: '400001',
        billingState: 'Maharashtra',
        billingCountry: 'India',
        isShippingSame: 'true',
        openingBalance: '0.00',
        openingBalanceType: 'payable',
        enablePortal: 'false',
        notes: 'Sample contact for import'
    },
    {
        name: 'Jane Smith',
        gstin: '33BBBBB0000B1Z5',
        mobile: '9876543211',
        email: 'jane.smith@example.com',
        dueDays: '15',
        contactType: 'vendor',
        billingAddress1: '456 Business Avenue',
        billingAddress2: 'Suite 100',
        billingCity: 'Delhi',
        billingPincode: '110001',
        billingState: 'Delhi',
        billingCountry: 'India',
        isShippingSame: 'false',
        shippingAddress1: '789 Warehouse Road',
        shippingAddress2: 'Unit 5',
        shippingCity: 'Gurgaon',
        shippingPincode: '122001',
        shippingState: 'Haryana',
        shippingCountry: 'India',
        openingBalance: '5000.00',
        openingBalanceType: 'receivable',
        enablePortal: 'true',
        notes: 'Another sample contact'
    },
    {
        name: 'ABC Company Ltd',
        gstin: '44CCCCC0000C1Z5',
        mobile: '9876543212',
        email: 'info@abccompany.com',
        dueDays: '45',
        contactType: 'customer',
        billingAddress1: '789 Corporate Plaza',
        billingAddress2: 'Floor 10',
        billingCity: 'Bangalore',
        billingPincode: '560001',
        billingState: 'Karnataka',
        billingCountry: 'India',
        isShippingSame: 'true',
        openingBalance: '15000.00',
        openingBalanceType: 'receivable',
        enablePortal: 'true',
        notes: 'Corporate customer'
    },
    {
        name: 'XYZ Suppliers',
        gstin: '55DDDDD0000D1Z5',
        mobile: '9876543213',
        email: 'sales@xyzsuppliers.com',
        dueDays: '60',
        contactType: 'vendor',
        billingAddress1: '321 Industrial Area',
        billingAddress2: 'Block A',
        billingCity: 'Chennai',
        billingPincode: '600001',
        billingState: 'Tamil Nadu',
        billingCountry: 'India',
        isShippingSame: 'false',
        shippingAddress1: '654 Warehouse Complex',
        shippingAddress2: 'Unit 15',
        shippingCity: 'Coimbatore',
        shippingPincode: '641001',
        shippingState: 'Tamil Nadu',
        shippingCountry: 'India',
        openingBalance: '25000.00',
        openingBalanceType: 'payable',
        enablePortal: 'false',
        notes: 'Raw material supplier'
    }
];

// Contact field configurations
export const contactFields = {
    required: ['name'],
    optional: [
        'gstin', 'mobile', 'email', 'dueDays', 'contactType',
        'billingAddress1', 'billingAddress2', 'billingCity', 'billingPincode', 'billingState', 'billingCountry',
        'isShippingSame', 'shippingAddress1', 'shippingAddress2', 'shippingCity', 'shippingPincode', 'shippingState', 'shippingCountry',
        'openingBalance', 'openingBalanceType', 'enablePortal', 'notes'
    ]
};

// Contact type options
export const contactTypes = [
    { value: 'customer', label: 'Customer' },
    { value: 'vendor', label: 'Vendor' }
];

// Balance type options
export const balanceTypes = [
    { value: 'payable', label: 'Payable' },
    { value: 'receivable', label: 'Receivable' },
    { value: 'none', label: 'None' }
]; 