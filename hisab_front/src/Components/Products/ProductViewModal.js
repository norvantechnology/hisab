import React from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Badge } from 'reactstrap';

const ProductViewModal = ({ isOpen, toggle, product }) => {
    return (
        <Modal isOpen={isOpen} toggle={toggle} size="md">
            <ModalHeader toggle={toggle}>Product Details</ModalHeader>
            <ModalBody>
                {product && (
                    <div>
                        <div className="mb-3">
                            <h6 className="text-muted">Product Name</h6>
                            <p className="fw-semibold">{product.name || 'N/A'}</p>
                        </div>
                        
                        <div className="mb-3">
                            <h6 className="text-muted">Item Type</h6>
                            <p>
                                <Badge color="info" className="badge-soft-info">
                                    {product.itemType ? product.itemType.charAt(0).toUpperCase() + product.itemType.slice(1) : 'N/A'}
                                </Badge>
                            </p>
                        </div>
                        
                        <div className="mb-3">
                            <h6 className="text-muted">Item Code</h6>
                            <p>{product.itemCode || 'N/A'}</p>
                        </div>
                        
                        <div className="mb-3">
                            <h6 className="text-muted">HSN Code</h6>
                            <p>{product.hsnCode || 'N/A'}</p>
                        </div>
                        
                        <div className="mb-3">
                            <h6 className="text-muted">Description</h6>
                            <p>{product.description || 'No description provided'}</p>
                        </div>
                        
                        <div className="mb-3">
                            <h6 className="text-muted">Stock Category</h6>
                            <p>
                                {product.stockCategoryName ? (
                                    <Badge color="warning" className="badge-soft-warning">
                                        {product.stockCategoryName}
                                    </Badge>
                                ) : 'N/A'}
                            </p>
                        </div>
                        
                        <div className="mb-3">
                            <h6 className="text-muted">Unit of Measurement</h6>
                            <p>{product.unitOfMeasurementName || 'N/A'}</p>
                        </div>
                        
                        <div className="mb-3">
                            <h6 className="text-muted">Tax Category</h6>
                            <p>
                                {product.taxCategoryName ? (
                                    <Badge color="primary" className="badge-soft-primary">
                                        {product.taxCategoryName} ({product.taxRate}%)
                                    </Badge>
                                ) : 'N/A'}
                            </p>
                        </div>
                        
                        <div className="mb-3">
                            <h6 className="text-muted">Rate</h6>
                            <p className="fw-semibold text-primary">
                                ₹{parseFloat(product.rate || 0).toFixed(2)}
                            </p>
                        </div>
                        
                        <div className="mb-3">
                            <h6 className="text-muted">Inventory Tracking</h6>
                            <p>
                                <Badge color={product.isInventoryTracked ? "success" : "secondary"} className={`badge-soft-${product.isInventoryTracked ? "success" : "secondary"}`}>
                                    {product.isInventoryTracked ? "Enabled" : "Disabled"}
                                </Badge>
                            </p>
                        </div>
                        
                        {product.isInventoryTracked && (
                            <>
                                <div className="mb-3">
                                    <h6 className="text-muted">Current Stock</h6>
                                    <p>{product.currentStock || 0} {product.unitOfMeasurementName ? product.unitOfMeasurementName : ''}</p>
                                </div>
                                
                                {product.isSerialized && (
                                    <div className="mb-3">
                                        <h6 className="text-muted">Serial Numbers ({product.serialCount || 0})</h6>
                                        <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                                            {product.serialNumbers?.length > 0 ? (
                                                <ul className="list-unstyled">
                                                    {product.serialNumbers.map((serial, index) => (
                                                        <li key={index} className="mb-1">
                                                            <Badge 
                                                                color="light" 
                                                                className="text-dark border border-secondary"
                                                                style={{
                                                                    backgroundColor: '#f8f9fa',
                                                                    padding: '0.35em 0.65em',
                                                                    fontSize: '0.75em',
                                                                    fontWeight: 600
                                                                }}
                                                            >
                                                                {serial.serialNumber}
                                                            </Badge>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <p>No serial numbers</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                        <div className="mb-3">
                            <h6 className="text-muted">Created At</h6>
                            <p>{product.createdAt ? new Date(product.createdAt).toLocaleString() : 'N/A'}</p>
                        </div>
                    </div>
                )}
            </ModalBody>
            <ModalFooter>
                <Button color="secondary" onClick={toggle}>Close</Button>
            </ModalFooter>
        </Modal>
    );
};

export default ProductViewModal;