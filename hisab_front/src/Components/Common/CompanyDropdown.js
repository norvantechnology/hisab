import React, { useState, useEffect, useCallback } from 'react';
import {
    Dropdown,
    DropdownMenu,
    DropdownToggle,
    Row,
    Col,
    Modal,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Form,
    FormGroup,
    Label,
    Input,
    Button
} from 'reactstrap';
import { Link } from 'react-router-dom';
import { createCompany, getAllCompanies, updateCompany } from '../../services/company';
import { layoutModeTypes } from '../../Components/constants/layout';

const initialFormState = {
    gstin: '',
    name: '',
    country: 'India',
    currency: 'INR',
    address1: '',
    address2: '',
    city: '',
    pincode: '',
    state: '',
    logo: null,
    logoPreview: ''
};

const CompanyDropdown = ({ layoutMode }) => {
    const [state, setState] = useState({
        isCompanyDropdown: false,
        modal: false,
        isLoading: false,
        error: null,
        success: null,
        companies: [],
        isFetching: false,
        isEditMode: false,
        currentCompanyId: null,
        formData: initialFormState,
        selectedCompany: null
    });

    const {
        isCompanyDropdown,
        modal,
        isLoading,
        error,
        success,
        companies,
        isFetching,
        isEditMode,
        currentCompanyId,
        formData,
        selectedCompany
    } = state;

    const isDarkTheme = layoutMode === layoutModeTypes['DARKMODE'];

    const updateState = useCallback((newState) => {
        setState(prev => ({ ...prev, ...newState }));
    }, []);

    const getSelectedCompanyFromStorage = useCallback(() => {
        try {
            const stored = localStorage.getItem('selectedCompanyId');
            return stored ? JSON.parse(stored) : null;
        } catch (error) {
            console.error('Error reading from localStorage:', error);
            return null;
        }
    }, []);

    const setSelectedCompanyToStorage = useCallback((companyId, companyData) => {
        try {
            const dataToStore = {
                id: companyId,
                name: companyData.name,
                logoUrl: companyData.logoUrl,
                selectedAt: new Date().toISOString()
            };
            localStorage.setItem('selectedCompanyId', JSON.stringify(dataToStore));
        } catch (error) {
            console.error('Error saving to localStorage:', error);
        }
    }, []);

    const handleCompanySelect = useCallback((company) => {
        updateState({ isCompanyDropdown: false });
        setSelectedCompanyToStorage(company.id, company);
        updateState({ selectedCompany: company });
        setTimeout(() => {
            window.location.reload();
        }, 100);
    }, [updateState, setSelectedCompanyToStorage]);

    const clearMessages = useCallback(() => {
        updateState({ error: null, success: null });
    }, [updateState]);

    const fetchCompanies = useCallback(async () => {
        updateState({ isFetching: true, error: null });
        try {
            const response = await getAllCompanies();
            if (response?.success) {
                updateState({ companies: response.companies, isFetching: false });
            } else {
                updateState({
                    error: response?.message || 'Failed to fetch companies',
                    isFetching: false
                });
            }
        } catch (err) {
            updateState({
                error: err.message || 'Failed to fetch companies',
                isFetching: false
            });
        }
    }, [updateState]);

    useEffect(() => {
        if (isCompanyDropdown && companies.length === 0) {
            fetchCompanies();
        }
    }, [isCompanyDropdown, fetchCompanies, companies.length]);

    useEffect(() => {
        const storedCompany = getSelectedCompanyFromStorage();
        if (storedCompany) {
            updateState({ selectedCompany: storedCompany });
        }
    }, [getSelectedCompanyFromStorage, updateState]);

    const toggleCompanyDropdown = useCallback(() => {
        updateState({ isCompanyDropdown: !isCompanyDropdown });
    }, [isCompanyDropdown, updateState]);

    const toggleModal = useCallback(() => {
        const newModalState = !modal;
        updateState({
            modal: newModalState,
            error: null,
            success: null,
            ...(newModalState && !isEditMode ? { formData: initialFormState } : {})
        });
    }, [modal, isEditMode, updateState]);

    const handleInputChange = useCallback((e) => {
        const { name, value } = e.target;
        updateState({
            formData: { ...formData, [name]: value }
        });
        if (error || success) {
            clearMessages();
        }
    }, [formData, error, success, updateState, clearMessages]);

    const handleLogoChange = useCallback((e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) { // 2MB limit
                updateState({
                    error: 'File size should be less than 2MB'
                });
                return;
            }

            const reader = new FileReader();
            reader.onloadend = () => {
                updateState({
                    formData: {
                        ...formData,
                        logo: file,
                        logoPreview: reader.result
                    }
                });
            };
            reader.readAsDataURL(file);
        }
    }, [formData, updateState]);

    const removeLogo = useCallback(() => {
        updateState({
            formData: {
                ...formData,
                logo: null,
                logoPreview: ''
            }
        });
    }, [formData, updateState]);

    const handleAddCompany = useCallback(() => {
        updateState({
            formData: initialFormState,
            isEditMode: false,
            currentCompanyId: null,
            modal: true,
            error: null,
            success: null
        });
    }, [updateState]);

    const handleEditCompany = useCallback((company) => {
        updateState({
            formData: {
                gstin: company.gstin || '',
                name: company.name || '',
                country: company.location?.country || 'India',
                currency: company.currency || 'INR',
                address1: company.location?.address1 || '',
                address2: company.location?.address2 || '',
                city: company.location?.city || '',
                pincode: company.location?.pincode || '',
                state: company.location?.state || '',
                logo: null,
                logoPreview: company.logoUrl || ''
            },
            isEditMode: true,
            currentCompanyId: company.id,
            modal: true,
            error: null,
            success: null
        });
    }, [updateState]);

    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        updateState({ isLoading: true, error: null, success: null });

        try {
            const formDataToSend = new FormData();

            // Append all form fields
            Object.keys(formData).forEach(key => {
                if (key !== 'logoPreview' && formData[key] !== null) {
                    formDataToSend.append(key, formData[key]);
                }
            });

            // If editing, append the ID
            if (isEditMode) {
                formDataToSend.append('id', currentCompanyId);
            }

            const response = isEditMode
                ? await updateCompany(formDataToSend)
                : await createCompany(formDataToSend);

            if (response?.success) {
                const successMessage = `Company ${isEditMode ? 'updated' : 'created'} successfully!`;
                updateState({
                    success: successMessage,
                    isLoading: false,
                    ...(!isEditMode ? { formData: initialFormState } : {})
                });

                await fetchCompanies();

                setTimeout(() => {
                    updateState({
                        modal: false,
                        isEditMode: false,
                        currentCompanyId: null,
                        success: null
                    });
                }, 1500);
            } else {
                updateState({
                    error: response?.message || `Failed to ${isEditMode ? 'update' : 'create'} company`,
                    isLoading: false
                });
            }
        } catch (err) {
            updateState({
                error: err.message || `Failed to ${isEditMode ? 'update' : 'create'} company`,
                isLoading: false
            });
        }
    }, [isEditMode, formData, currentCompanyId, updateState, fetchCompanies]);

    const getCompanyLogo = useCallback((company) => {
        if (company?.logoUrl) {
            return (
                <img
                    src={company.logoUrl}
                    alt={company.name}
                    className="rounded-circle"
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                    }}
                />
            );
        }

        const name = company?.name || '';
        const words = name.trim().split(' ').filter(word => word.length > 0);
        const initials = words.length >= 2
            ? `${words[0].charAt(0)}${words[1].charAt(0)}`.toUpperCase()
            : name.charAt(0).toUpperCase();

        return (
            <span className="fw-bold d-flex align-items-center justify-content-center">
                {initials}
            </span>
        );
    }, []);

    const renderCompanyItem = useCallback((company, index) => {
        const isSelected = selectedCompany?.id === company.id;

        return (
            <Col key={company.id} xs={12} className="mb-2">
                <div
                    className={`dropdown-item d-flex align-items-center justify-content-between ${isSelected ? 'active' : ''}`}
                >
                    <button
                        className="btn btn-link d-flex align-items-center w-100 text-start p-0 text-decoration-none"
                        onClick={() => handleCompanySelect(company)}
                        title={`Switch to ${company.name}`}
                    >
                        <div className="avatar-sm me-3">
                            <span
                                className={`avatar-title rounded-circle fw-bold d-flex align-items-center justify-content-center ${isSelected ? 'border border-2 border-success' : ''}`}
                                style={{
                                    fontSize: '14px',
                                    width: '40px',
                                    height: '40px',
                                }}
                            >
                                {getCompanyLogo(company)}
                            </span>
                        </div>
                        <div className="flex-grow-1">
                            <span className={`d-block ${isSelected ? 'fw-bold' : 'fw-semibold'}`}>
                                {company.name}
                            </span>
                            {isSelected && (
                                <small className="text-success">
                                    <i className="ri-check-line me-1"></i>Currently Selected
                                </small>
                            )}
                        </div>
                    </button>
                    <button
                        className="btn btn-link p-0 ms-2 text-muted"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleEditCompany(company);
                        }}
                        title="Edit Company"
                    >
                        <i className="ri-pencil-line"></i>
                    </button>
                </div>
            </Col>
        );
    }, [getCompanyLogo, handleCompanySelect, handleEditCompany, selectedCompany]);

    const renderLogoUploadSection = () => (
        <FormGroup>
            <Label className="fw-semibold mb-3">Company Logo</Label>
            <div className="d-flex align-items-center">
                {formData.logoPreview ? (
                    <div className="d-flex align-items-center gap-3 w-100">
                        <div className="position-relative">
                            <img
                                src={formData.logoPreview}
                                alt="Logo preview"
                                className="rounded-circle shadow-sm border"
                                style={{
                                    width: '100px',
                                    height: '100px',
                                    objectFit: 'cover',
                                    transition: 'all 0.3s ease'
                                }}
                            />
                            <button
                                className="btn btn-icon btn-danger rounded-circle p-0 position-absolute top-0 end-0 translate-middle"
                                onClick={removeLogo}
                                disabled={isLoading}
                                style={{
                                    width: '24px',
                                    height: '24px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                <i className="ri-close-line" style={{ fontSize: '12px' }}></i>
                            </button>
                        </div>
                        <div className="flex-grow-1">
                            <Button
                                outline
                                color="primary"
                                className="rounded-pill"
                                onClick={() => document.getElementById('logo-upload').click()}
                                disabled={isLoading}
                            >
                                <i className="ri-upload-line me-2"></i> Change Logo
                            </Button>
                            <Input
                                type="file"
                                id="logo-upload"
                                accept="image/*"
                                onChange={handleLogoChange}
                                disabled={isLoading}
                                className="d-none"
                            />
                            <div className="text-muted mt-2 small">
                                <i className="ri-information-line me-1"></i> JPG, PNG or GIF (Max 2MB)
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="w-100">
                        <div
                            className="border rounded-3 p-4 text-center cursor-pointer hover-shadow"
                            style={{
                                borderStyle: 'dashed',
                                transition: 'all 0.3s ease',
                                backgroundColor: isDarkTheme ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'
                            }}
                            onClick={() => document.getElementById('logo-upload').click()}
                        >
                            <div className="mb-3">
                                <div className="avatar-lg mx-auto">
                                    <div className={`avatar-title rounded-circle bg-${isDarkTheme ? 'dark' : 'light'}-subtle text-${isDarkTheme ? 'light' : 'muted'}`}>
                                        <i className="ri-image-line fs-24"></i>
                                    </div>
                                </div>
                            </div>
                            <h5 className="fs-15 mb-1">Upload Company Logo</h5>
                            <p className="text-muted mb-0">Recommended: 200x200 pixels</p>
                            <Input
                                type="file"
                                id="logo-upload"
                                accept="image/*"
                                onChange={handleLogoChange}
                                disabled={isLoading}
                                className="d-none"
                            />
                        </div>
                        {formData.logo && (
                            <div className="alert alert-success mt-3 py-2 small d-flex align-items-center">
                                <i className="ri-checkbox-circle-fill me-2"></i>
                                <span>Logo selected: {formData.logo.name}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </FormGroup>
    );

    return (
        <>
            <Dropdown
                isOpen={isCompanyDropdown}
                toggle={toggleCompanyDropdown}
                className="topbar-head-dropdown header-item"
            >
                <DropdownToggle
                    tag="button"
                    type="button"
                    className="btn d-flex align-items-center"
                >
                    {selectedCompany ? (
                        <>
                            <div className="me-2">
                                <span
                                    className="avatar-title text-white rounded fw-bold d-flex align-items-center justify-content-center"
                                    style={{
                                        fontSize: '12px',
                                        width: '28px',
                                        height: '28px',
                                        minWidth: '28px',
                                    }}
                                >
                                    {getCompanyLogo(selectedCompany)}
                                </span>
                            </div>
                            <div className="text-start me-2">
                                <span
                                    className="fw-medium d-block text-truncate"
                                    style={{
                                        maxWidth: '120px',
                                        fontSize: '13px',
                                        lineHeight: '1.2',
                                    }}
                                >
                                    {selectedCompany.name}
                                </span>
                            </div>
                            <i className="mdi mdi-chevron-down"></i>
                        </>
                    ) : (
                        <>
                            <i className='bx bx-building me-2'></i>
                            <span style={{ fontSize: '13px' }}>Select Company</span>
                            <i className="mdi mdi-chevron-down ms-2"></i>
                        </>
                    )}
                </DropdownToggle>
                <DropdownMenu className="dropdown-menu-lg p-0 dropdown-menu-end">
                    <div className="p-3 border-top-0 border-start-0 border-end-0 border-dashed border">
                        <Row className="align-items-center">
                            <Col>
                                <h6 className="m-0 fw-semibold fs-15">
                                    {selectedCompany ? 'Switch Company' : 'Select Company'}
                                </h6>
                                {selectedCompany && (
                                    <small className="text-muted">
                                        Current: {selectedCompany.name}
                                    </small>
                                )}
                            </Col>
                            <div className="col-auto">
                                <Link
                                    to="#"
                                    className="btn btn-sm btn-soft-primary"
                                    onClick={handleAddCompany}
                                >
                                    <i className="ri-add-line align-middle me-1"></i> Add New
                                </Link>
                            </div>
                        </Row>
                    </div>

                    {isFetching ? (
                        <div className="p-3 text-center">
                            <div className="spinner-border text-primary" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                        </div>
                    ) : error ? (
                        <div className="p-3 text-center text-danger">
                            <small>{error}</small>
                        </div>
                    ) : (
                        <>
                            <div className="p-2">
                                {companies.length === 0 ? (
                                    <div className="text-center py-3 text-muted">
                                        <i className="ri-building-line fs-24 mb-2 d-block"></i>
                                        No companies found
                                    </div>
                                ) : (
                                    <div className="row g-0">
                                        {companies.slice(0, 6).map(renderCompanyItem)}
                                    </div>
                                )}
                            </div>

                            {companies.length > 6 && (
                                <div className="p-2 border-top border-dashed">
                                    <Link
                                        className="dropdown-item text-center text-primary"
                                        to="#"
                                    >
                                        View all companies <i className="ri-arrow-right-s-line align-middle ms-1"></i>
                                    </Link>
                                </div>
                            )}
                        </>
                    )}
                </DropdownMenu>
            </Dropdown>

            <Modal isOpen={modal} toggle={toggleModal} centered className={isDarkTheme ? 'dark-modal' : ''}>
                <ModalHeader toggle={toggleModal}>
                    {isEditMode ? 'Edit Company' : 'Add New Company'}
                </ModalHeader>
                <Form onSubmit={handleSubmit}>
                    <ModalBody>
                        {error && (
                            <div className="alert alert-danger alert-dismissible" role="alert">
                                {error}
                                <button type="button" className="btn-close" onClick={clearMessages}></button>
                            </div>
                        )}
                        {success && (
                            <div className="alert alert-success alert-dismissible" role="alert">
                                {success}
                                <button type="button" className="btn-close" onClick={clearMessages}></button>
                            </div>
                        )}

                        {renderLogoUploadSection()}

                        <FormGroup>
                            <Label for="name">Company Name*</Label>
                            <Input
                                type="text"
                                name="name"
                                id="name"
                                value={formData.name}
                                onChange={handleInputChange}
                                required
                                disabled={isLoading}
                                className={isDarkTheme ? 'bg-dark text-light' : ''}
                            />
                        </FormGroup>

                        <FormGroup>
                            <Label for="gstin">GSTIN</Label>
                            <Input
                                type="text"
                                name="gstin"
                                id="gstin"
                                value={formData.gstin}
                                onChange={handleInputChange}
                                disabled={isLoading}
                                className={isDarkTheme ? 'bg-dark text-light' : ''}
                            />
                        </FormGroup>

                        <Row>
                            <Col md={6}>
                                <FormGroup>
                                    <Label for="country">Country*</Label>
                                    <Input
                                        type="text"
                                        name="country"
                                        id="country"
                                        value={formData.country}
                                        onChange={handleInputChange}
                                        required
                                        disabled={isLoading}
                                        className={isDarkTheme ? 'bg-dark text-light' : ''}
                                    />
                                </FormGroup>
                            </Col>
                            <Col md={6}>
                                <FormGroup>
                                    <Label for="currency">Currency*</Label>
                                    <Input
                                        type="text"
                                        name="currency"
                                        id="currency"
                                        value={formData.currency}
                                        onChange={handleInputChange}
                                        required
                                        disabled={isLoading}
                                        className={isDarkTheme ? 'bg-dark text-light' : ''}
                                    />
                                </FormGroup>
                            </Col>
                        </Row>

                        <FormGroup>
                            <Label for="address1">Address Line 1*</Label>
                            <Input
                                type="text"
                                name="address1"
                                id="address1"
                                value={formData.address1}
                                onChange={handleInputChange}
                                required
                                disabled={isLoading}
                                className={isDarkTheme ? 'bg-dark text-light' : ''}
                            />
                        </FormGroup>

                        <FormGroup>
                            <Label for="address2">Address Line 2</Label>
                            <Input
                                type="text"
                                name="address2"
                                id="address2"
                                value={formData.address2}
                                onChange={handleInputChange}
                                disabled={isLoading}
                                className={isDarkTheme ? 'bg-dark text-light' : ''}
                            />
                        </FormGroup>

                        <Row>
                            <Col md={6}>
                                <FormGroup>
                                    <Label for="city">City*</Label>
                                    <Input
                                        type="text"
                                        name="city"
                                        id="city"
                                        value={formData.city}
                                        onChange={handleInputChange}
                                        required
                                        disabled={isLoading}
                                        className={isDarkTheme ? 'bg-dark text-light' : ''}
                                    />
                                </FormGroup>
                            </Col>
                            <Col md={6}>
                                <FormGroup>
                                    <Label for="state">State*</Label>
                                    <Input
                                        type="text"
                                        name="state"
                                        id="state"
                                        value={formData.state}
                                        onChange={handleInputChange}
                                        required
                                        disabled={isLoading}
                                        className={isDarkTheme ? 'bg-dark text-light' : ''}
                                    />
                                </FormGroup>
                            </Col>
                        </Row>

                        <FormGroup>
                            <Label for="pincode">Pincode*</Label>
                            <Input
                                type="text"
                                name="pincode"
                                id="pincode"
                                value={formData.pincode}
                                onChange={handleInputChange}
                                required
                                disabled={isLoading}
                                className={isDarkTheme ? 'bg-dark text-light' : ''}
                            />
                        </FormGroup>
                    </ModalBody>
                    <ModalFooter>
                        <Button color="secondary" onClick={toggleModal} disabled={isLoading}>
                            Cancel
                        </Button>
                        <Button color="primary" type="submit" disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                    {isEditMode ? 'Updating...' : 'Creating...'}
                                </>
                            ) : (
                                isEditMode ? 'Update Company' : 'Create Company'
                            )}
                        </Button>
                    </ModalFooter>
                </Form>
            </Modal>
        </>
    );
};

export const getSelectedCompany = () => {
    try {
        const stored = localStorage.getItem('selectedCompanyId');
        return stored ? JSON.parse(stored) : null;
    } catch (error) {
        console.error('Error reading selected company from localStorage:', error);
        return null;
    }
};

export const getSelectedCompanyId = () => {
    const company = getSelectedCompany();
    return company ? company.id : null;
};

export default CompanyDropdown;