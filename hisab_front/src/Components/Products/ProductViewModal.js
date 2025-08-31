import React from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Badge, Card, CardBody, Row, Col } from 'reactstrap';
import { RiProductHuntLine, RiPriceTag3Line, RiBarcodeLine, RiFileTextLine, RiStackLine, RiCalendarLine } from 'react-icons/ri';

const ProductViewModal = ({ isOpen, toggle, product }) => {
    return (
        <Modal isOpen={isOpen} toggle={toggle} size="lg">
            <ModalHeader toggle={toggle} className="bg-light">
                <div className="d-flex align-items-center">
                    <RiProductHuntLine className="text-primary me-2" size={20} />
                    Product Details
                </div>
            </ModalHeader>
            <ModalBody className="p-3">
                {product && (
                    <div>
                        {/* Header Card with Key Information */}
                        <Card className="border-0 shadow-sm mb-3">
                            <CardBody className="bg-light">
                                <Row className="align-items-center">
                                    <Col md={6}>
                                        <div>
                                            <h6 className="text-muted mb-1">Product Name</h6>
                                            <h4 className="mb-2 text-dark">{product.name || 'N/A'}</h4>
                                            <div className="d-flex gap-2 flex-wrap">
                                                <Badge color="info" className="badge-soft-info">
                                                    {product.itemType ? product.itemType.charAt(0).toUpperCase() + product.itemType.slice(1) : 'N/A'}
                                                </Badge>
                                                <Badge color={product.isInventoryTracked ? "success" : "secondary"} 
                                                       className={`badge-soft-${product.isInventoryTracked ? "success" : "secondary"}`}>
                                                    {product.isInventoryTracked ? "Inventory Tracked" : "No Inventory"}
                                                </Badge>
                                            </div>
                                        </div>
                                    </Col>
                                    <Col md={6}>
                                        <div className="text-center">
                                            <h6 className="text-muted mb-1">Rate</h6>
                                            <div className="fw-bold text-success fs-3">
                                                ₹{parseFloat(product.rate || 0).toFixed(2)}
                                            </div>
                                            {product.unitOfMeasurementName && (
                                                <small className="text-muted">per {product.unitOfMeasurementName}</small>
                                            )}
                                        </div>
                                    </Col>
                                </Row>
                            </CardBody>
                        </Card>

                        {/* Product Codes and Categories */}
                        <Row className="g-3 mb-3">
                            <Col md={6}>
                                <Card className="border-0 shadow-sm h-100">
                                    <CardBody>
                                        <h6 className="card-title text-muted mb-3">
                                            <RiBarcodeLine className="me-2" />
                                            Codes & Categories
                                        </h6>
                                        
                                        <Row>
                                            <Col md={6}>
                                                <div className="mb-3">
                                                    <label className="form-label text-muted small">Item Code</label>
                                                    <div className="fw-medium">{product.itemCode || 'N/A'}</div>
                                                </div>
                                            </Col>
                                            <Col md={6}>
                                                <div className="mb-3">
                                                    <label className="form-label text-muted small">HSN Code</label>
                                                    <div className="fw-medium">{product.hsnCode || 'N/A'}</div>
                                                </div>
                                            </Col>
                                        </Row>

                                        <div className="mb-3">
                                            <label className="form-label text-muted small">Stock Category</label>
                                            <div>
                                                {product.stockCategoryName ? (
                                                    <Badge color="warning" className="badge-soft-warning px-2 py-1">
                                                        {product.stockCategoryName}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-muted small">N/A</span>
                                                )}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="form-label text-muted small">Tax Category</label>
                                            <div>
                                                {product.taxCategoryName ? (
                                                    <Badge color="primary" className="badge-soft-primary px-2 py-1">
                                                        {product.taxCategoryName} ({product.taxRate}%)
                                                    </Badge>
                                                ) : (
                                                    <span className="text-muted small">N/A</span>
                                                )}
                                            </div>
                                        </div>
                                    </CardBody>
                                </Card>
                            </Col>

                            <Col md={6}>
                                <Card className="border-0 shadow-sm h-100">
                                    <CardBody>
                                        <h6 className="card-title text-muted mb-3">
                                            <RiFileTextLine className="me-2" />
                                            Description
                                        </h6>
                                        <div className="bg-light rounded p-3" style={{ minHeight: '120px' }}>
                                            <p className="mb-0 text-muted">
                                                {product.description || 'No description provided'}
                                            </p>
                                        </div>
                                    </CardBody>
                                </Card>
                            </Col>
                        </Row>

                        {/* Inventory Section - Only show if inventory is tracked */}
                        {product.isInventoryTracked && (
                            <Card className="border-0 shadow-sm mb-3">
                                <CardBody>
                                    <h6 className="card-title text-muted mb-3">
                                        <RiStackLine className="me-2" />
                                        Inventory Information
                                    </h6>
                                    
                                    <Row>
                                        <Col md={4}>
                                            <div className="text-center">
                                                <label className="form-label text-muted small">Current Stock</label>
                                                <div className="fw-bold text-info fs-5">
                                                    {product.currentStock || 0} {product.unitOfMeasurementName || 'units'}
                                                </div>
                                            </div>
                                        </Col>
                                        <Col md={4}>
                                            <div className="text-center">
                                                <label className="form-label text-muted small">Unit of Measurement</label>
                                                <div className="fw-medium">{product.unitOfMeasurementName || 'N/A'}</div>
                                            </div>
                                        </Col>
                                        <Col md={4}>
                                            <div className="text-center">
                                                <label className="form-label text-muted small">Serialized</label>
                                                <div>
                                                    <Badge color={product.isSerialized ? "info" : "secondary"} 
                                                           className={`badge-soft-${product.isSerialized ? "info" : "secondary"}`}>
                                                        {product.isSerialized ? "Yes" : "No"}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </Col>
                                    </Row>

                                    {/* Serial Numbers Section */}
                                    {product.isSerialized && product.serialNumbers?.length > 0 && (
                                        <div className="mt-3 pt-3 border-top">
                                            <label className="form-label text-muted small mb-2">
                                                Serial Numbers ({product.serialCount || product.serialNumbers.length})
                                            </label>
                                            <div className="bg-light rounded p-2" style={{ maxHeight: '120px', overflowY: 'auto' }}>
                                                <div className="d-flex flex-wrap gap-1">
                                                    {product.serialNumbers.map((serial, index) => (
                                                        <Badge 
                                                            key={index}
                                                            color="light" 
                                                            className="text-dark border"
                                                            style={{
                                                                backgroundColor: '#f8f9fa',
                                                                fontSize: '0.7rem',
                                                                fontWeight: 500
                                                            }}
                                                        >
                                                            {serial.serialNumber || serial}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </CardBody>
                            </Card>
                        )}

                        {/* Metadata Card */}
                        <Card className="border-0 shadow-sm">
                            <CardBody className="bg-light">
                                <h6 className="card-title text-muted mb-2">
                                    <RiCalendarLine className="me-2" />
                                    Record Information
                                </h6>
                                <div className="text-center">
                                    <label className="form-label text-muted small">Created At</label>
                                    <div className="fw-medium">
                                        {product.createdAt ? 
                                            new Date(product.createdAt).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            }) : 'N/A'
                                        }
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                    </div>
                )}
            </ModalBody>
            <ModalFooter className="bg-light">
                <Button color="secondary" onClick={toggle}>Close</Button>
            </ModalFooter>
        </Modal>
    );
};

export default ProductViewModal;