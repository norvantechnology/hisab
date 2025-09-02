import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, ModalHeader, ModalBody, ModalFooter, Form, FormGroup, Label, Input, Button, Row, Col, Alert } from 'reactstrap';
import { createCompany } from "../../services/company";

const WelcomePage = () => {
    const navigate = useNavigate();
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
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
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (error || success) {
            setError(null);
            setSuccess(null);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await createCompany(formData);
            if (response?.success) {
                setSuccess('Company created successfully!');
                // Close modal
                setShowModal(false);
                
                // Reset form
                setFormData({
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
                });
                
                // Wait a bit then redirect to business dashboard
                setTimeout(() => {
                    navigate('/business-dashboard');
                }, 2000);
            } else {
                setError(response?.message || 'Failed to create company');
            }
        } catch (err) {
            setError(err.message || 'Failed to create company');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <div className="d-flex justify-content-center align-items-center" style={{ 
                height: '100vh', 
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
            }}>
                <div className="text-center bg-white p-5 rounded-lg shadow-lg" style={{ maxWidth: '500px' }}>
                    {success ? (
                        <div>
                            <div className="mb-4">
                                <div className="bg-success rounded-circle d-inline-flex align-items-center justify-content-center" 
                                     style={{ width: '80px', height: '80px' }}>
                                    <i className="ri-check-line text-white" style={{ fontSize: '2.5rem' }}></i>
                                </div>
                            </div>
                            <h3 className="mb-3 text-success">Company Created Successfully!</h3>
                            <p className="text-muted mb-4">Redirecting to your dashboard...</p>
                            <div className="spinner-border text-primary" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="mb-4">
                                <div className="bg-primary rounded-circle d-inline-flex align-items-center justify-content-center" 
                                     style={{ width: '80px', height: '80px' }}>
                                    <i className="ri-building-line text-white" style={{ fontSize: '2.5rem' }}></i>
                                </div>
                            </div>
                            <h3 className="mb-3 text-dark">Welcome to Your Business Management System</h3>
                            <p className="text-muted mb-4 fs-5">Please create your first company to get started.</p>
                            <div className="alert alert-info mb-4">
                                <i className="ri-information-line me-2"></i>
                                Click the button below to create your first company.
                            </div>
                            <button 
                                className="btn btn-primary btn-lg px-4 py-3"
                                onClick={() => setShowModal(true)}
                            >
                                <i className="ri-add-line me-2"></i>
                                Create Your First Company
                            </button>
                            <div className="mt-4">
                                <small className="text-muted">
                                    <i className="ri-shield-check-line me-1"></i>
                                    Your data is secure and private
                                </small>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Company Creation Modal */}
            <Modal isOpen={showModal} toggle={() => setShowModal(false)} centered size="lg">
                <ModalHeader toggle={() => setShowModal(false)}>
                    Create Your First Company
                </ModalHeader>
                <Form onSubmit={handleSubmit}>
                    <ModalBody>
                        {error && (
                            <Alert color="danger" className="mb-3">
                                {error}
                            </Alert>
                        )}

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
                            />
                        </FormGroup>
                    </ModalBody>
                    <ModalFooter>
                        <Button color="secondary" onClick={() => setShowModal(false)} disabled={isLoading}>
                            Cancel
                        </Button>
                        <Button color="primary" type="submit" disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                    Creating...
                                </>
                            ) : (
                                'Create Company'
                            )}
                        </Button>
                    </ModalFooter>
                </Form>
            </Modal>
        </>
    );
};

export default WelcomePage; 