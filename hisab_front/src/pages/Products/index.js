import React, { useState, useEffect, useMemo } from 'react';
import { Container, Row, Col, Card, CardBody, Button } from 'reactstrap';
import { toast, ToastContainer } from 'react-toastify';
import { RiDownload2Line, RiAddLine } from 'react-icons/ri';
import BreadCrumb from '../../Components/Common/BreadCrumb';
import ProductForm from '../../Components/Products/ProductForm';
import ProductTable from '../../Components/Products/ProductTable';
import ProductViewModal from '../../Components/Products/ProductViewModal';
import DeleteModal from "../../Components/Common/DeleteModal";
import ProductsFilter from '../../Components/Products/ProductsFilter';
import ExportCSVModal from '../../Components/Common/ExportCSVModal';
import AddStockCategoryModal from '../../Components/Products/AddStockCategoryModal';
import Loader from '../../Components/Common/Loader';
import { createProduct, updateProduct, deleteProduct, listProducts, getProduct } from '../../services/products';
import { listStockCategories, createStockCategory } from '../../services/productSetup.js';
import { getTaxCategory } from '../../services/taxCategories.js';
import { getUnitOfMeasurements } from '../../services/unitOfMeasurements.js';
import useCompanySelectionState from '../../hooks/useCompanySelection';

const ProductsPage = () => {
    // State management
    const [state, setState] = useState({
        products: [],
        categories: [],
        taxCategories: [],
        unitsOfMeasurement: [],
        loading: false,
        searchTerm: '',
        pagination: {
            page: 1,
            limit: 10,
            total: 0,
            totalPages: 1,
            currentPage: 1
        },
        filters: {
            search: '',
            stockCategoryId: '',
            itemType: '',
            taxCategoryId: '',
            unitOfMeasurement: '',
            itemCode: '',
            hsnCode: ''
        },
        modals: {
            delete: false,
            main: false,
            view: false,
            export: false,
            stockCategory: false
        },
        selectedProduct: null,
        isEditMode: false,
        apiLoading: false,
        viewLoading: false,
        categoriesLoading: false,
        taxCategoriesLoading: false,
        newStockCategoryName: ''
    });

    const {
        products,
        categories,
        taxCategories,
        unitsOfMeasurement,
        loading,
        searchTerm,
        pagination,
        filters,
        modals,
        selectedProduct,
        isEditMode,
        apiLoading,
        viewLoading,
        categoriesLoading,
        taxCategoriesLoading,
        newStockCategoryName
    } = state;

    // Use the modern company selection hook
    const { selectedCompanyId } = useCompanySelectionState();

    // Fetch categories and tax categories
    const fetchCategories = async () => {
        try {
            setState(prev => ({ ...prev, categoriesLoading: true }));
            const response = await listStockCategories();
            if (response.success) {
                setState(prev => ({
                    ...prev,
                    categories: response.categories || [],
                    categoriesLoading: false
                }));
            }
        } catch (error) {
            setState(prev => ({ ...prev, categoriesLoading: false }));
            console.error("Failed to fetch stock categories", error);
        }
    };

    const fetchUnitOfMeasurements = async () => {
        try {
            const response = await getUnitOfMeasurements();
            if (response.success) {
                setState(prev => ({
                    ...prev,
                    unitsOfMeasurement: response.data || []
                }));
            }
        } catch (error) {
            console.error("Failed to fetch units of measurement", error);
        }
    };

    const fetchTaxCategories = async () => {
        try {
            setState(prev => ({ ...prev, taxCategoriesLoading: true }));
            const response = await getTaxCategory();
            if (response.success) {
                setState(prev => ({
                    ...prev,
                    taxCategories: response.data || [],
                    taxCategoriesLoading: false
                }));
            }
        } catch (error) {
            setState(prev => ({ ...prev, taxCategoriesLoading: false }));
            console.error("Failed to fetch tax categories", error);
        }
    };

    const fetchData = async () => {
        // Don't proceed if no company is selected
        if (!selectedCompanyId) {
            console.log('No company selected, skipping products fetch');
            return;
        }

        try {
            setState(prev => ({ ...prev, loading: true, apiLoading: true }));

            const response = await listProducts({
                page: pagination.page,
                limit: pagination.limit,
                search: filters.search,
                stockCategoryId: filters.stockCategoryId,
                itemType: filters.itemType,
                taxCategoryId: filters.taxCategoryId,
                unitOfMeasurementId: filters.unitOfMeasurement,
                itemCode: filters.itemCode,
                hsnCode: filters.hsnCode
            });

            setState(prev => ({
                ...prev,
                products: response?.success ? response.products || [] : [],
                pagination: {
                    ...prev.pagination,  // Keep the current page and limit
                    total: response?.pagination?.total || 0,
                    totalPages: response?.pagination?.totalPages || 1
                },
                loading: false,
                apiLoading: false
            }));
        } catch (error) {
            setState(prev => ({
                ...prev,
                loading: false,
                apiLoading: false,
                products: []
            }));
            toast.error("Failed to load data");
        }
    };

    useEffect(() => {
        if (selectedCompanyId) {
        fetchData();
        fetchCategories();
        fetchTaxCategories();
        fetchUnitOfMeasurements();
        }
    }, [
        pagination.page,
        filters.search,
        filters.stockCategoryId,
        filters.itemType,
        filters.taxCategoryId,
        filters.unitOfMeasurement,
        filters.itemCode,
        filters.hsnCode,
        selectedCompanyId
    ]);

    // Modal handlers
    const toggleModal = (modalName, value) => {
        setState(prev => ({
            ...prev,
            modals: { ...prev.modals, [modalName]: value !== undefined ? value : !prev.modals[modalName] }
        }));
    };

    const handleAddClick = () => {
        setState(prev => ({
            ...prev,
            isEditMode: false,
            selectedProduct: null,
            modals: { ...prev.modals, main: true }
        }));
    };

    const handleEditClick = async (product) => {
        try {
            setState(prev => ({ ...prev, apiLoading: true }));
            const response = await getProduct({ id: product.id });

            if (response.success) {
                setState(prev => ({
                    ...prev,
                    selectedProduct: response.product,
                    isEditMode: true,
                    modals: { ...prev.modals, main: true },
                    apiLoading: false
                }));
            } else {
                toast.error("Failed to load product details");
                setState(prev => ({ ...prev, apiLoading: false }));
            }
        } catch (error) {
            setState(prev => ({ ...prev, apiLoading: false }));
            toast.error("Failed to load product details");
        }
    };

    const handleViewClick = async (product) => {
        try {
            setState(prev => ({ ...prev, viewLoading: true }));
            const response = await getProduct({ id: product.id });

            if (response.success) {
                setState(prev => ({
                    ...prev,
                    selectedProduct: response.product,
                    modals: { ...prev.modals, view: true },
                    viewLoading: false
                }));
            } else {
                toast.error("Failed to load product details");
                setState(prev => ({ ...prev, viewLoading: false }));
            }
        } catch (error) {
            setState(prev => ({ ...prev, viewLoading: false }));
            toast.error("Failed to load product details");
        }
    };

    const handleDeleteClick = (product) => {
        setState(prev => ({
            ...prev,
            selectedProduct: product,
            modals: { ...prev.modals, delete: true }
        }));
    };

    // CRUD operations
    const handleDeleteProduct = async () => {
        try {
            setState(prev => ({ ...prev, apiLoading: true }));
            const response = await deleteProduct({ id: selectedProduct.id });

            if (response.success) {
                setState(prev => ({
                    ...prev,
                    products: prev.products.filter(p => p.id !== selectedProduct.id),
                    modals: { ...prev.modals, delete: false },
                    apiLoading: false,
                    pagination: {
                        ...prev.pagination,
                        total: prev.pagination.total - 1
                    }
                }));
                toast.success("Product deleted successfully");
            } else {
                throw new Error(response.message || "Failed to delete product");
            }
        } catch (error) {
            setState(prev => ({ ...prev, apiLoading: false }));
            toast.error(error.message);
        }
    };

    const handleSubmitProduct = async (values) => {
        try {
            setState(prev => ({ ...prev, apiLoading: true }));

            // Ensure we have the ID when in edit mode
            if (isEditMode && !values.id && selectedProduct) {
                values.id = selectedProduct.id;
            }

            // Create payload with only the necessary fields
            const payload = {
                name: values.name,
                productType: values.productType,
                itemCode: values.itemCode,
                hsnCode: values.hsnCode,
                description: values.description,
                defaultInvoiceDescription: values.defaultInvoiceDescription,
                isInventoryTracked: values.isInventoryTracked,
                isSerialized: values.isSerialized,
                unitOfMeasurementId: values.unitOfMeasurementId,
                stockCategoryId: values.stockCategoryId,
                rate: values.rate.toString(),
                isTaxInclusive: values.isTaxInclusive,
                discount: values.discount,
                taxCategoryId: values.taxCategoryId,
                openingStockQty: values.openingStockQty,
                openingStockCostPerQty: values.openingStockCostPerQty,
                serialNumbers: values.serialNumbers,
                ...(isEditMode && values.isInventoryTracked && {
                    currentStock: values.currentStock
                }),
                id: isEditMode ? (values.id || selectedProduct?.id) : undefined
            };

            const response = isEditMode
                ? await updateProduct(payload)
                : await createProduct(payload);

            if (response.success) {
                toast.success(`Product ${isEditMode ? 'updated' : 'created'} successfully`);
                setState(prev => ({
                    ...prev,
                    modals: { ...prev.modals, main: false },
                    apiLoading: false
                }));
                fetchData();
            } else {
                throw new Error(response.message || `Failed to ${isEditMode ? 'update' : 'create'} product`);
            }
        } catch (error) {
            setState(prev => ({ ...prev, apiLoading: false }));
            toast.error(error.message);
        }
    };

    // Stock Category Modal Handlers
    const handleAddStockCategory = () => {
        setState(prev => ({
            ...prev,
            modals: { ...prev.modals, stockCategory: true }
        }));
    };

    const handleStockCategoryNameChange = (e) => {
        setState(prev => ({
            ...prev,
            newStockCategoryName: e.target.value
        }));
    };

    const handleCreateStockCategory = async () => {
        if (!newStockCategoryName.trim()) {
            toast.error("Stock category name cannot be empty");
            return;
        }

        try {
            setState(prev => ({ ...prev, apiLoading: true }));
            const response = await createStockCategory(newStockCategoryName.trim());
            if (response.success) {
                toast.success("Stock category added successfully");
                setState(prev => ({
                    ...prev,
                    modals: { ...prev.modals, stockCategory: false },
                    newStockCategoryName: '',
                    apiLoading: false
                }));
                fetchCategories(); // Refresh the categories list
            }
        } catch (error) {
            setState(prev => ({ ...prev, apiLoading: false }));
            toast.error(error.response?.data?.message || "Failed to add stock category");
        }
    };

    const handlePageChange = (page) => {
        setState(prev => ({
            ...prev,
            pagination: {
                ...prev.pagination,
                page: page,
                currentPage: page
            }
        }));
    };

    const handleFilterChange = (newFilters) => {
        setState(prev => ({
            ...prev,
            filters: newFilters,
            pagination: { ...prev.pagination, page: 1 }
        }));
    };

    const prepareExportData = () => {
        return products.map(product => ({
            'Name': product.name || 'N/A',
            'Item Code': product.itemCode || 'N/A',
            'HSN Code': product.hsnCode || '',
            'Rate': parseFloat(product.rate || 0).toFixed(2),
            'Type': product.itemType ? product.itemType.charAt(0).toUpperCase() + product.itemType.slice(1) : '',
            'Unit': product.unitOfMeasurementName || '',
            'Category': product.categoryName || product.stockCategoryName || '',
            'Tax Category': product.taxCategoryName || '',
            'Tax Rate': parseFloat(product.taxRate || 0).toFixed(2) + '%',
            'Inventory Tracked': product.isInventoryTracked ? 'Yes' : 'No',
            'Serialized': product.isSerialized ? 'Yes' : 'No',
            'Current Stock': parseFloat(product.currentStock || 0).toFixed(2),
            'Created At': new Date(product.createdAt).toLocaleString()
        }));
    };

    const filteredProducts = useMemo(() => {
        if (!searchTerm) return products;
        const term = searchTerm.toLowerCase();
        return products.filter(product =>
            product.name?.toLowerCase().includes(term) ||
            product.itemCode?.toLowerCase().includes(term) ||
            product.hsnCode?.toLowerCase().includes(term) ||
            product.description?.toLowerCase().includes(term)
        );
    }, [products, searchTerm]);

    return (
        <div className="page-content">
            <ToastContainer closeButton={false} position="top-right" />
            <Container fluid>
                <BreadCrumb title="Products" pageTitle="Inventory" />

                <ProductsFilter
                    categories={categories}
                    taxCategories={taxCategories}
                    unitsOfMeasurement={unitsOfMeasurement}
                    filters={filters}
                    onFilterChange={handleFilterChange}
                />

                <Row className="mb-3">
                    <Col sm={12} className="text-end">
                        <div className="d-flex justify-content-end gap-2">
                            <Button color="primary" onClick={() => toggleModal('export', true)}>
                                <RiDownload2Line className="align-middle me-1" /> Export
                            </Button>
                            <Button color="success" onClick={handleAddClick}>
                                <RiAddLine className="align-middle me-1" /> Add Product
                            </Button>
                        </div>
                    </Col>
                </Row>

                {loading ? (
                    <Loader />
                ) : (
                    <ProductTable
                        products={filteredProducts || []}
                        loading={loading}
                        pagination={pagination}
                        onPageChange={handlePageChange}
                        onView={handleViewClick}
                        onEdit={handleEditClick}
                        onDelete={handleDeleteClick}
                    />
                )}

                <ProductForm
                    isOpen={modals.main}
                    toggle={() => toggleModal('main')}
                    isEditMode={isEditMode}
                    selectedProduct={selectedProduct}
                    onSubmit={handleSubmitProduct}
                    isLoading={apiLoading}
                    stockCategories={categories}
                    taxCategories={taxCategories}
                    categoriesLoading={categoriesLoading}
                    taxCategoriesLoading={taxCategoriesLoading}
                    unitsOfMeasurement={unitsOfMeasurement}
                    onAddStockCategory={handleAddStockCategory}
                />

                <AddStockCategoryModal
                    isOpen={modals.stockCategory}
                    toggle={() => toggleModal('stockCategory')}
                    categoryName={newStockCategoryName}
                    onCategoryNameChange={handleStockCategoryNameChange}
                    onAddCategory={handleCreateStockCategory}
                    isLoading={apiLoading}
                />

                <ProductViewModal
                    isOpen={modals.view}
                    toggle={() => toggleModal('view')}
                    product={selectedProduct}
                    loading={viewLoading}
                />

                <DeleteModal
                    show={modals.delete}
                    onDeleteClick={handleDeleteProduct}
                    onCloseClick={() => toggleModal('delete', false)}
                    isLoading={apiLoading}
                />

                <ExportCSVModal
                    show={modals.export}
                    onCloseClick={() => toggleModal('export', false)}
                    data={prepareExportData()}
                    filename="products"
                />
            </Container>
        </div>
    );
};

export default ProductsPage;