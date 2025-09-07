import React from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Badge, Row, Col } from 'reactstrap';
import { RiProductHuntLine, RiBarcodeLine, RiFileTextLine, RiStackLine, RiCalendarLine, RiCheckboxCircleLine, RiCloseCircleLine } from 'react-icons/ri';

const ProductViewModal = ({ isOpen, toggle, product }) => {
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }).format(amount || 0);
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    return (
        <Modal isOpen={isOpen} toggle={toggle} size="lg" className="product-view-modal">
            <ModalHeader toggle={toggle} className="pb-2">
                <div className="d-flex align-items-center">
                    <div className="rounded bg-primary-subtle d-flex align-items-center justify-content-center me-2" style={{width: '1.75rem', height: '1.75rem'}}>
                        <RiProductHuntLine className="text-primary" size={16} />
                    </div>
                    <div>
                        <h5 className="modal-title mb-0">Product Details</h5>
                    </div>
                </div>
            </ModalHeader>
            <ModalBody className="py-3">
                {product && (
                    <div>
                        {/* Compact Product Header */}
                        <div className="bg-light rounded p-3 mb-3">
                            <Row className="align-items-center">
                                <Col md={7}>
                                    <h4 className="mb-2 fw-semibold">{product.name || 'N/A'}</h4>
                                    <div className="d-flex flex-wrap gap-1 mb-1">
                                        <Badge color="light" className="badge-simple px-2 py-1 small">
                                            {product.itemType ? product.itemType.charAt(0).toUpperCase() + product.itemType.slice(1) : 'Product'}
                                        </Badge>
                                        {product.isInventoryTracked && (
                                            <Badge color="light" className="badge-simple px-2 py-1 small">
                                                Tracked
                                            </Badge>
                                        )}
                                        {product.isSerialized && (
                                            <Badge color="light" className="badge-simple px-2 py-1 small">
                                                Serialized
                                            </Badge>
                                        )}
                                    </div>
                                    <small className="text-muted">Code: <span className="fw-medium">{product.itemCode || 'Not set'}</span></small>
                                </Col>
                                <Col md={5}>
                                    <div className="text-end">
                                        <div className="h3 text-success fw-bold mb-0">
                                            {formatCurrency(product.rate)}
                                        </div>
                                        {product.unitOfMeasurementName && (
                                            <small className="text-muted">per {product.unitOfMeasurementName}</small>
                                        )}
                                    </div>
                                </Col>
                            </Row>
                        </div>

                        {/* Compact Information Grid */}
                        <Row className="g-3 mb-3">
                            {/* Left Column - Basic Info */}
                            <Col md={6}>
                                <div style={{background: 'var(--vz-body-bg)', border: '1px solid var(--vz-border-color)', borderRadius: '6px', padding: '0.75rem'}}>
                                    <h6 style={{color: 'var(--vz-secondary-color)', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px'}}>
                                        <RiFileTextLine className="me-1" size={14} />
                                        Basic Information
                                    </h6>
                                    <div style={{display: 'flex', flexDirection: 'column', gap: '0.4rem'}}>
                                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', lineHeight: '1.3'}}>
                                            <span style={{color: 'var(--vz-secondary-color)', fontWeight: '500', flex: '0 0 auto', marginRight: '0.5rem'}}>HSN Code:</span>
                                            <span style={{color: 'var(--vz-body-color)', fontWeight: '500', textAlign: 'right', flex: '1', wordBreak: 'break-word'}}>{product.hsnCode || 'Not set'}</span>
                                        </div>
                                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', lineHeight: '1.3'}}>
                                            <span style={{color: 'var(--vz-secondary-color)', fontWeight: '500', flex: '0 0 auto', marginRight: '0.5rem'}}>Stock Category:</span>
                                            <span style={{color: 'var(--vz-body-color)', fontWeight: '500', textAlign: 'right', flex: '1', wordBreak: 'break-word'}}>{product.stockCategoryName || 'Not assigned'}</span>
                                        </div>
                                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', lineHeight: '1.3'}}>
                                            <span style={{color: 'var(--vz-secondary-color)', fontWeight: '500', flex: '0 0 auto', marginRight: '0.5rem'}}>Tax Category:</span>
                                            <span style={{color: 'var(--vz-body-color)', fontWeight: '500', textAlign: 'right', flex: '1', wordBreak: 'break-word'}}>
                                                {product.taxCategoryName ? 
                                                    `${product.taxCategoryName} (${product.taxRate}%)` : 
                                                    'Not assigned'
                                                }
                                            </span>
                                        </div>
                                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', lineHeight: '1.3'}}>
                                            <span style={{color: 'var(--vz-secondary-color)', fontWeight: '500', flex: '0 0 auto', marginRight: '0.5rem'}}>Unit:</span>
                                            <span style={{color: 'var(--vz-body-color)', fontWeight: '500', textAlign: 'right', flex: '1', wordBreak: 'break-word'}}>{product.unitOfMeasurementName || 'Not specified'}</span>
                                        </div>
                                    </div>
                                </div>
                            </Col>

                            {/* Right Column - Inventory & System */}
                            <Col md={6}>
                                {/* Inventory Section */}
                                {product.isInventoryTracked && (
                                    <div className="mb-3" style={{background: 'var(--vz-body-bg)', border: '1px solid var(--vz-border-color)', borderRadius: '6px', padding: '0.75rem'}}>
                                        <h6 style={{color: 'var(--vz-secondary-color)', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px'}}>
                                            <RiStackLine className="me-1" size={14} />
                                            Inventory
                                        </h6>
                                        <div className="inventory-display mb-2">
                                            <div className="text-center bg-primary-subtle rounded p-2">
                                                <div className="h5 text-primary fw-bold mb-0">
                                                    {product.currentStock || 0}
                                                </div>
                                                <small className="text-muted">
                                                    Current Stock {product.unitOfMeasurementName ? `(${product.unitOfMeasurementName})` : ''}
                                                </small>
                                            </div>
                                        </div>
                                        <div style={{display: 'flex', flexDirection: 'column', gap: '0.4rem'}}>
                                            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', lineHeight: '1.3'}}>
                                                <span style={{color: 'var(--vz-secondary-color)', fontWeight: '500', flex: '0 0 auto', marginRight: '0.5rem'}}>Tracking:</span>
                                                <span style={{color: 'var(--vz-body-color)', fontWeight: '500', textAlign: 'right', flex: '1', wordBreak: 'break-word'}}>
                                                    <RiCheckboxCircleLine className="text-success me-1" size={12} />
                                                    Enabled
                                                </span>
                                            </div>
                                            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', lineHeight: '1.3'}}>
                                                <span style={{color: 'var(--vz-secondary-color)', fontWeight: '500', flex: '0 0 auto', marginRight: '0.5rem'}}>Serialization:</span>
                                                <span style={{color: 'var(--vz-body-color)', fontWeight: '500', textAlign: 'right', flex: '1', wordBreak: 'break-word'}}>
                                                    {product.isSerialized ? (
                                                        <>
                                                            <RiCheckboxCircleLine className="text-success me-1" size={12} />
                                                            Enabled
                                                        </>
                                                    ) : (
                                                        <>
                                                            <RiCloseCircleLine className="text-muted me-1" size={12} />
                                                            Disabled
                                                        </>
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* System Info */}
                                <div style={{background: 'var(--vz-body-bg)', border: '1px solid var(--vz-border-color)', borderRadius: '6px', padding: '0.75rem'}}>
                                    <h6 style={{color: 'var(--vz-secondary-color)', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px'}}>
                                        <RiCalendarLine className="me-1" size={14} />
                                        System Info
                                    </h6>
                                    <div style={{display: 'flex', flexDirection: 'column', gap: '0.4rem'}}>
                                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', lineHeight: '1.3'}}>
                                            <span style={{color: 'var(--vz-secondary-color)', fontWeight: '500', flex: '0 0 auto', marginRight: '0.5rem'}}>Created:</span>
                                            <span style={{color: 'var(--vz-body-color)', fontWeight: '500', textAlign: 'right', flex: '1', wordBreak: 'break-word'}}>{formatDate(product.createdAt)}</span>
                                        </div>
                                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', lineHeight: '1.3'}}>
                                            <span style={{color: 'var(--vz-secondary-color)', fontWeight: '500', flex: '0 0 auto', marginRight: '0.5rem'}}>Updated:</span>
                                            <span style={{color: 'var(--vz-body-color)', fontWeight: '500', textAlign: 'right', flex: '1', wordBreak: 'break-word'}}>{formatDate(product.updatedAt)}</span>
                                        </div>
                                    </div>
                                </div>
                            </Col>
                        </Row>

                        {/* Description - Compact */}
                        {product.description && (
                            <div style={{background: 'var(--vz-body-bg)', border: '1px solid var(--vz-border-color)', borderRadius: '6px', padding: '0.75rem'}}>
                                <h6 style={{color: 'var(--vz-secondary-color)', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px'}}>
                                    <RiFileTextLine className="me-1" size={14} />
                                    Description
                                </h6>
                                <div className="description-compact">
                                    <p className="mb-0 small text-dark">{product.description}</p>
                                </div>
                            </div>
                        )}

                        {/* Serial Numbers - Compact Table */}
                        {product.isSerialized && product.serialNumbers?.length > 0 && (
                            <div style={{background: 'var(--vz-body-bg)', border: '1px solid var(--vz-border-color)', borderRadius: '6px', padding: '0.75rem'}}>
                                <h6 style={{color: 'var(--vz-secondary-color)', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px'}}>
                                    <RiBarcodeLine className="me-1" size={14} />
                                    Serial Numbers ({product.serialNumbers.length})
                                </h6>
                                <div className="serial-numbers-compact">
                                    <div className="serial-grid">
                                        {product.serialNumbers.slice(0, 12).map((serial, index) => (
                                            <div key={index} className="serial-item">
                                                <code className="serial-code">
                                                    {serial.serialNumber || serial}
                                                </code>
                                            </div>
                                        ))}
                                    </div>
                                    {product.serialNumbers.length > 12 && (
                                        <div className="text-center mt-2">
                                            <small className="text-muted">
                                                +{product.serialNumbers.length - 12} more serial numbers
                                            </small>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </ModalBody>
            <ModalFooter className="py-2">
                <Button color="light" onClick={toggle} className="px-3">Close</Button>
            </ModalFooter>
        </Modal>
    );
};

export default ProductViewModal;