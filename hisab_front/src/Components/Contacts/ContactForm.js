import React, { useState } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Form, FormGroup, Label, Input, FormFeedback, Button, Row, Col, Card, CardBody, Badge } from 'reactstrap';
import { RiLoader4Line, RiUserLine, RiMapPinLine, RiWalletLine, RiGlobalLine } from 'react-icons/ri';
import * as Yup from "yup";
import { useFormik } from "formik";
import { toast } from 'react-toastify';
import { contactTypes, balanceTypes } from '../../data/contactData';
import { generatePortalAccess } from '../../services/portal';

const BALANCE_TYPES = {
  receivable: { label: 'Receivable', color: 'success' },
  payable: { label: 'Payable', color: 'danger' },
  none: { label: 'None', color: 'secondary' }
};

// Portal access expiry options
const PORTAL_EXPIRY_OPTIONS = [
  { value: 1, label: '1 Hour' },
  { value: 6, label: '6 Hours' },
  { value: 12, label: '12 Hours' },
  { value: 24, label: '1 Day' },
  { value: 72, label: '3 Days' },
  { value: 168, label: '1 Week' },
  { value: 720, label: '1 Month' }
];

const ContactForm = ({
  isOpen,
  toggle,
  isEditMode,
  selectedContact,
  onSubmit,
  isLoading = false
}) => {
  // Helper function to safely get numeric value
  const getNumericValue = (value, defaultValue = 0) => {
    if (value === null || value === undefined || value === '') {
      return defaultValue;
    }
    const numValue = Number(value);
    return isNaN(numValue) ? defaultValue : numValue;
  };

  // State for portal token generation loading
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);

  const validation = useFormik({
    enableReinitialize: true,
    initialValues: {
      id: selectedContact?.id || '',
      gstin: selectedContact?.gstin || '',
      name: selectedContact?.name || '',
      mobile: selectedContact?.mobile || '',
      email: selectedContact?.email || '',
      dueDays: getNumericValue(selectedContact?.dueDays, 0),
      contactType: selectedContact?.contactType || 'customer',
      billingAddress1: selectedContact?.billingAddress1 || '',
      billingAddress2: selectedContact?.billingAddress2 || '',
      billingCity: selectedContact?.billingCity || '',
      billingPincode: selectedContact?.billingPincode || '',
      billingState: selectedContact?.billingState || '',
      billingCountry: selectedContact?.billingCountry || 'India',
      isShippingSame: selectedContact?.isShippingSame || false,
      shippingAddress1: selectedContact?.shippingAddress1 || '',
      shippingAddress2: selectedContact?.shippingAddress2 || '',
      shippingCity: selectedContact?.shippingCity || '',
      shippingPincode: selectedContact?.shippingPincode || '',
      shippingState: selectedContact?.shippingState || '',
      shippingCountry: selectedContact?.shippingCountry || 'India',
      openingBalance: getNumericValue(selectedContact?.openingBalance, 0),
      openingBalanceType: selectedContact?.openingBalanceType || 'receivable', // Default to receivable for new contacts
      enablePortal: selectedContact?.enablePortal || false,
      notes: selectedContact?.notes || ''
    },
    validationSchema: Yup.object({
      gstin: Yup.string()
        .matches(/^$|^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GSTIN format'),
      name: Yup.string().required('Name is required'),
      mobile: Yup.string()
        .matches(/^[0-9]{10}$/, 'Mobile must be 10 digits')
        .required('Mobile is required'),
      email: Yup.string()
        .email('Invalid email format')
        .when('enablePortal', {
          is: true,
          then: (schema) => schema.required('Email is required when customer portal access is enabled')
        }),
      dueDays: Yup.number().min(0, 'Due days must be 0 or more'),
      contactType: Yup.string().required('Contact type is required'),
      billingAddress1: Yup.string().required('Billing Address Line 1 is required'),
      billingCity: Yup.string().required('Billing City is required'),
      billingPincode: Yup.string().required('Billing Pincode is required'),
      billingState: Yup.string().required('Billing State is required'),
      billingCountry: Yup.string().required('Billing Country is required'),
      shippingAddress1: Yup.string().when('isShippingSame', {
        is: false,
        then: (schema) => schema.required('Shipping Address Line 1 is required')
      }),
      shippingCity: Yup.string().when('isShippingSame', {
        is: false,
        then: (schema) => schema.required('Shipping City is required')
      }),
      shippingPincode: Yup.string().when('isShippingSame', {
        is: false,
        then: (schema) => schema.required('Shipping Pincode is required')
      }),
      shippingState: Yup.string().when('isShippingSame', {
        is: false,
        then: (schema) => schema.required('Shipping State is required')
      }),
      shippingCountry: Yup.string().when('isShippingSame', {
        is: false,
        then: (schema) => schema.required('Shipping Country is required')
      }),
      openingBalance: Yup.number().min(0, 'Opening balance must be 0 or more'),
      openingBalanceType: Yup.string().when('openingBalance', {
        is: (balance) => balance > 0,
        then: (schema) => schema.required('Please select balance type when amount is greater than 0').notOneOf(['none'], 'Please select Receivable or Payable when amount is greater than 0'),
        otherwise: (schema) => schema.notRequired()
      })
    }),
    onSubmit: async (values) => {
      await onSubmit(values);
    }
  });

  const isProcessing = validation.isSubmitting || isLoading;

  // Custom handler for numeric fields to ensure they stay as numbers
  const handleNumericChange = (fieldName) => (e) => {
    const value = e.target.value;
    const numericValue = value === '' ? '' : Number(value);
    validation.setFieldValue(fieldName, numericValue);
    
    // Special handling for opening balance
    if (fieldName === 'openingBalance') {
      const balance = value === '' ? 0 : Number(value);
      // If balance becomes 0, automatically set to 'receivable'
      // If balance > 0, reset to 'none' so user must select
      if (balance === 0) {
        validation.setFieldValue('openingBalanceType', 'receivable');
      } else if (balance > 0 && validation.values.openingBalanceType === 'receivable') {
        // Only reset if it was previously auto-set to receivable
        validation.setFieldValue('openingBalanceType', 'none');
      }
    }
  };

  // Custom blur handler for numeric fields
  const handleNumericBlur = (fieldName) => (e) => {
    const value = e.target.value;
    const numericValue = value === '' ? 0 : Number(value);
    validation.setFieldValue(fieldName, numericValue);
    
    // Special handling for opening balance
    if (fieldName === 'openingBalance') {
      // If balance is 0, automatically set to 'receivable'
      // If balance > 0, reset to 'none' so user must select
      if (numericValue === 0) {
        validation.setFieldValue('openingBalanceType', 'receivable');
      } else if (numericValue > 0 && validation.values.openingBalanceType === 'receivable') {
        // Only reset if it was previously auto-set to receivable
        validation.setFieldValue('openingBalanceType', 'none');
      }
    }
    
    validation.handleBlur(e);
  };

  const handleShippingSameChange = (e) => {
    const isChecked = e.target.checked;
    validation.setFieldValue('isShippingSame', isChecked);

    if (isChecked) {
      // Copy billing address to shipping address
      validation.setValues({
        ...validation.values,
        isShippingSame: true,
        shippingAddress1: validation.values.billingAddress1,
        shippingAddress2: validation.values.billingAddress2,
        shippingCity: validation.values.billingCity,
        shippingPincode: validation.values.billingPincode,
        shippingState: validation.values.billingState,
        shippingCountry: validation.values.billingCountry
      });
    }
  };

  // Custom form submit handler to show validation errors
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    
    // Touch all fields to show validation errors
    const touchedFields = {};
    Object.keys(validation.values).forEach(field => {
      touchedFields[field] = true;
    });
    validation.setTouched(touchedFields);
    
    // Validate the form
    const errors = await validation.validateForm();
    
    if (Object.keys(errors).length === 0) {
      // No errors, submit the form
      validation.handleSubmit();
    } else {
      // Show error toast for missing fields
      const errorFields = Object.keys(errors);
      toast.error(`Please fill in all required fields: ${errorFields.join(', ')}`);
    }
  };

  const handleGeneratePortalAccess = async (expiryHours = 24) => {
    if (!selectedContact?.id) {
      toast.error('Contact ID not found');
      return;
    }

    setIsGeneratingToken(true);

    try {
      const response = await generatePortalAccess(selectedContact.id, expiryHours);
      
      if (response.success) {
        // Format expiry time for better display
        const formatExpiryTime = (hours) => {
          if (hours === 1) return '1 hour';
          if (hours < 24) return `${hours} hours`;
          if (hours === 24) return '1 day';
          if (hours === 72) return '3 days';
          if (hours === 168) return '1 week';
          if (hours === 720) return '1 month';
          return `${hours} hours`;
        };

        const expiryText = formatExpiryTime(expiryHours);
        
        toast.success(
          `✅ Portal access token generated successfully! 
          
Token will expire in ${expiryText}. 
An email has been sent to ${selectedContact.email}.`, 
          {
            position: "top-right",
            autoClose: 5000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            style: {
              fontSize: '14px',
              lineHeight: '1.4'
            }
          }
        );
      } else {
        toast.error(response.message || 'Failed to generate portal access token');
      }
    } catch (error) {
      console.error('Error generating portal access:', error);
      toast.error(error.message || 'Failed to generate portal access token');
    } finally {
      setIsGeneratingToken(false);
    }
  };

  return (
    <Modal isOpen={isOpen} toggle={toggle} size="lg" className="contact-form-modal">
      <ModalHeader toggle={toggle} className="pb-2">
        <div className="d-flex align-items-center">
          <div className="avatar-xs rounded bg-primary-subtle d-flex align-items-center justify-content-center me-2">
            <RiUserLine className="text-primary" size={16} />
          </div>
          <div>
            <h5 className="modal-title mb-0">
              {isEditMode ? 'Edit Contact' : 'Add New Contact'}
            </h5>
            <p className="text-muted mb-0 small">
              {isEditMode ? 'Update contact information' : 'Create a new contact'}
            </p>
          </div>
        </div>
      </ModalHeader>
      <ModalBody className="py-3">
        <Form onSubmit={handleFormSubmit}>
          {/* Basic Information Section */}
          <div className="form-section mb-3">
            <h6 className="section-title mb-3">Basic Information</h6>
            
            <Row className="g-2">
              <Col md={8}>
                <FormGroup className="mb-2">
                  <Label className="form-label-sm">Contact Name <span className="text-danger">*</span></Label>
                  <Input
                    type="text"
                    name="name"
                    placeholder="Enter contact name"
                    value={validation.values.name}
                    onChange={validation.handleChange}
                    onBlur={validation.handleBlur}
                    invalid={validation.touched.name && !!validation.errors.name}
                    disabled={isProcessing}
                    className="form-control-sm"
                  />
                  <FormFeedback>{validation.errors.name}</FormFeedback>
                </FormGroup>
              </Col>
              <Col md={4}>
                <FormGroup className="mb-2">
                  <Label className="form-label-sm">Contact Type <span className="text-danger">*</span></Label>
                  <Input
                    type="select"
                    name="contactType"
                    value={validation.values.contactType}
                    onChange={validation.handleChange}
                    onBlur={validation.handleBlur}
                    invalid={validation.touched.contactType && !!validation.errors.contactType}
                    disabled={isProcessing}
                    className="form-control-sm"
                  >
                    {contactTypes.map(contactType => (
                      <option key={contactType.value} value={contactType.value}>
                        {contactType.label}
                      </option>
                    ))}
                  </Input>
                  <FormFeedback>{validation.errors.contactType}</FormFeedback>
                </FormGroup>
              </Col>
            </Row>

            <Row className="g-2">
              <Col md={4}>
                <FormGroup className="mb-2">
                  <Label className="form-label-sm">Mobile <span className="text-danger">*</span></Label>
                  <Input
                    type="text"
                    name="mobile"
                    placeholder="10-digit mobile number"
                    value={validation.values.mobile}
                    onChange={validation.handleChange}
                    onBlur={validation.handleBlur}
                    invalid={validation.touched.mobile && !!validation.errors.mobile}
                    disabled={isProcessing}
                    className="form-control-sm"
                  />
                  <FormFeedback>{validation.errors.mobile}</FormFeedback>
                </FormGroup>
              </Col>
              <Col md={4}>
                <FormGroup className="mb-2">
                  <Label className="form-label-sm">
                    Email
                    {validation.values.enablePortal && <span className="text-danger"> *</span>}
                  </Label>
                  <Input
                    type="email"
                    name="email"
                    placeholder="contact@example.com"
                    value={validation.values.email}
                    onChange={validation.handleChange}
                    onBlur={validation.handleBlur}
                    invalid={validation.touched.email && !!validation.errors.email}
                    disabled={isProcessing}
                    className="form-control-sm"
                  />
                  <FormFeedback>{validation.errors.email}</FormFeedback>
                </FormGroup>
              </Col>
              <Col md={4}>
                <FormGroup className="mb-2">
                  <Label className="form-label-sm">GSTIN</Label>
                  <Input
                    type="text"
                    name="gstin"
                    placeholder="27AAHCS1234F1Z1"
                    value={validation.values.gstin}
                    onChange={validation.handleChange}
                    onBlur={validation.handleBlur}
                    invalid={validation.touched.gstin && !!validation.errors.gstin}
                    disabled={isProcessing}
                    className="form-control-sm"
                  />
                  <FormFeedback>{validation.errors.gstin}</FormFeedback>
                </FormGroup>
              </Col>
            </Row>

            <Row className="g-2">
              <Col md={4}>
                <FormGroup className="mb-2">
                  <Label className="form-label-sm">Due Days</Label>
                  <Input
                    type="number"
                    name="dueDays"
                    min="0"
                    placeholder="0"
                    value={validation.values.dueDays}
                    onChange={handleNumericChange('dueDays')}
                    onBlur={handleNumericBlur('dueDays')}
                    invalid={validation.touched.dueDays && !!validation.errors.dueDays}
                    disabled={isProcessing}
                    className="form-control-sm"
                  />
                  <FormFeedback>{validation.errors.dueDays}</FormFeedback>
                </FormGroup>
              </Col>
              <Col md={8}>
                <FormGroup check className="mt-4">
                  <Input
                    type="checkbox"
                    id="enablePortal"
                    name="enablePortal"
                    checked={validation.values.enablePortal}
                    onChange={validation.handleChange}
                    disabled={isProcessing}
                    className="form-check-input-sm"
                  />
                  <Label check for="enablePortal" className="form-check-label-sm">
                    Enable customer portal access
                  </Label>
                  {validation.values.enablePortal && (
                    <small className="text-info d-block mt-1">
                      Email address is required when portal access is enabled
                    </small>
                  )}
                </FormGroup>
              </Col>
            </Row>
          </div>

          {/* Billing Address Section */}
          <div className="form-section mb-3">
            <h6 className="section-title mb-3">
              <RiMapPinLine className="me-1" size={14} />
              Billing Address
            </h6>
            
            <Row className="g-2">
              <Col md={8}>
                <FormGroup className="mb-2">
                  <Label className="form-label-sm">Address Line 1 <span className="text-danger">*</span></Label>
                  <Input
                    type="text"
                    name="billingAddress1"
                    placeholder="Enter address line 1"
                    value={validation.values.billingAddress1}
                    onChange={validation.handleChange}
                    onBlur={validation.handleBlur}
                    invalid={validation.touched.billingAddress1 && !!validation.errors.billingAddress1}
                    disabled={isProcessing}
                    className="form-control-sm"
                  />
                  <FormFeedback>{validation.errors.billingAddress1}</FormFeedback>
                </FormGroup>
              </Col>
              <Col md={4}>
                <FormGroup className="mb-2">
                  <Label className="form-label-sm">Address Line 2</Label>
                  <Input
                    type="text"
                    name="billingAddress2"
                    placeholder="Optional"
                    value={validation.values.billingAddress2}
                    onChange={validation.handleChange}
                    onBlur={validation.handleBlur}
                    invalid={validation.touched.billingAddress2 && !!validation.errors.billingAddress2}
                    disabled={isProcessing}
                    className="form-control-sm"
                  />
                  <FormFeedback>{validation.errors.billingAddress2}</FormFeedback>
                </FormGroup>
              </Col>
            </Row>

            <Row className="g-2">
              <Col md={4}>
                <FormGroup className="mb-2">
                  <Label className="form-label-sm">City <span className="text-danger">*</span></Label>
                  <Input
                    type="text"
                    name="billingCity"
                    placeholder="Enter city"
                    value={validation.values.billingCity}
                    onChange={validation.handleChange}
                    onBlur={validation.handleBlur}
                    invalid={validation.touched.billingCity && !!validation.errors.billingCity}
                    disabled={isProcessing}
                    className="form-control-sm"
                  />
                  <FormFeedback>{validation.errors.billingCity}</FormFeedback>
                </FormGroup>
              </Col>
              <Col md={3}>
                <FormGroup className="mb-2">
                  <Label className="form-label-sm">Pincode <span className="text-danger">*</span></Label>
                  <Input
                    type="text"
                    name="billingPincode"
                    placeholder="000000"
                    value={validation.values.billingPincode}
                    onChange={validation.handleChange}
                    onBlur={validation.handleBlur}
                    invalid={validation.touched.billingPincode && !!validation.errors.billingPincode}
                    disabled={isProcessing}
                    className="form-control-sm"
                  />
                  <FormFeedback>{validation.errors.billingPincode}</FormFeedback>
                </FormGroup>
              </Col>
              <Col md={3}>
                <FormGroup className="mb-2">
                  <Label className="form-label-sm">State <span className="text-danger">*</span></Label>
                  <Input
                    type="text"
                    name="billingState"
                    placeholder="Enter state"
                    value={validation.values.billingState}
                    onChange={validation.handleChange}
                    onBlur={validation.handleBlur}
                    invalid={validation.touched.billingState && !!validation.errors.billingState}
                    disabled={isProcessing}
                    className="form-control-sm"
                  />
                  <FormFeedback>{validation.errors.billingState}</FormFeedback>
                </FormGroup>
              </Col>
              <Col md={2}>
                <FormGroup className="mb-2">
                  <Label className="form-label-sm">Country <span className="text-danger">*</span></Label>
                  <Input
                    type="text"
                    name="billingCountry"
                    value={validation.values.billingCountry}
                    onChange={validation.handleChange}
                    onBlur={validation.handleBlur}
                    invalid={validation.touched.billingCountry && !!validation.errors.billingCountry}
                    disabled={isProcessing}
                    className="form-control-sm"
                  />
                  <FormFeedback>{validation.errors.billingCountry}</FormFeedback>
                </FormGroup>
              </Col>
            </Row>

            <FormGroup check className="mt-2">
              <Input
                type="checkbox"
                id="isShippingSame"
                name="isShippingSame"
                checked={validation.values.isShippingSame}
                onChange={handleShippingSameChange}
                disabled={isProcessing}
                className="form-check-input-sm"
              />
              <Label check for="isShippingSame" className="form-check-label-sm">
                Shipping address same as billing address
              </Label>
            </FormGroup>
          </div>

          {/* Shipping Address Section */}
          {!validation.values.isShippingSame && (
            <div className="form-section mb-3">
              <h6 className="section-title mb-3">
                <RiGlobalLine className="me-1" size={14} />
                Shipping Address
              </h6>
              
              <Row className="g-2">
                <Col md={8}>
                  <FormGroup className="mb-2">
                    <Label className="form-label-sm">Address Line 1 <span className="text-danger">*</span></Label>
                    <Input
                      type="text"
                      name="shippingAddress1"
                      placeholder="Enter shipping address line 1"
                      value={validation.values.shippingAddress1}
                      onChange={validation.handleChange}
                      onBlur={validation.handleBlur}
                      invalid={validation.touched.shippingAddress1 && !!validation.errors.shippingAddress1}
                      disabled={isProcessing}
                      className="form-control-sm"
                    />
                    <FormFeedback>{validation.errors.shippingAddress1}</FormFeedback>
                  </FormGroup>
                </Col>
                <Col md={4}>
                  <FormGroup className="mb-2">
                    <Label className="form-label-sm">Address Line 2</Label>
                    <Input
                      type="text"
                      name="shippingAddress2"
                      placeholder="Optional"
                      value={validation.values.shippingAddress2}
                      onChange={validation.handleChange}
                      onBlur={validation.handleBlur}
                      invalid={validation.touched.shippingAddress2 && !!validation.errors.shippingAddress2}
                      disabled={isProcessing}
                      className="form-control-sm"
                    />
                    <FormFeedback>{validation.errors.shippingAddress2}</FormFeedback>
                  </FormGroup>
                </Col>
              </Row>

              <Row className="g-2">
                <Col md={4}>
                  <FormGroup className="mb-2">
                    <Label className="form-label-sm">City <span className="text-danger">*</span></Label>
                    <Input
                      type="text"
                      name="shippingCity"
                      placeholder="Enter city"
                      value={validation.values.shippingCity}
                      onChange={validation.handleChange}
                      onBlur={validation.handleBlur}
                      invalid={validation.touched.shippingCity && !!validation.errors.shippingCity}
                      disabled={isProcessing}
                      className="form-control-sm"
                    />
                    <FormFeedback>{validation.errors.shippingCity}</FormFeedback>
                  </FormGroup>
                </Col>
                <Col md={3}>
                  <FormGroup className="mb-2">
                    <Label className="form-label-sm">Pincode <span className="text-danger">*</span></Label>
                    <Input
                      type="text"
                      name="shippingPincode"
                      placeholder="000000"
                      value={validation.values.shippingPincode}
                      onChange={validation.handleChange}
                      onBlur={validation.handleBlur}
                      invalid={validation.touched.shippingPincode && !!validation.errors.shippingPincode}
                      disabled={isProcessing}
                      className="form-control-sm"
                    />
                    <FormFeedback>{validation.errors.shippingPincode}</FormFeedback>
                  </FormGroup>
                </Col>
                <Col md={3}>
                  <FormGroup className="mb-2">
                    <Label className="form-label-sm">State <span className="text-danger">*</span></Label>
                    <Input
                      type="text"
                      name="shippingState"
                      placeholder="Enter state"
                      value={validation.values.shippingState}
                      onChange={validation.handleChange}
                      onBlur={validation.handleBlur}
                      invalid={validation.touched.shippingState && !!validation.errors.shippingState}
                      disabled={isProcessing}
                      className="form-control-sm"
                    />
                    <FormFeedback>{validation.errors.shippingState}</FormFeedback>
                  </FormGroup>
                </Col>
                <Col md={2}>
                  <FormGroup className="mb-2">
                    <Label className="form-label-sm">Country <span className="text-danger">*</span></Label>
                    <Input
                      type="text"
                      name="shippingCountry"
                      value={validation.values.shippingCountry}
                      onChange={validation.handleChange}
                      onBlur={validation.handleBlur}
                      invalid={validation.touched.shippingCountry && !!validation.errors.shippingCountry}
                      disabled={isProcessing}
                      className="form-control-sm"
                    />
                    <FormFeedback>{validation.errors.shippingCountry}</FormFeedback>
                  </FormGroup>
                </Col>
              </Row>
            </div>
          )}

          {/* Financial Details Section */}
          <div className="form-section mb-3">
            <h6 className="section-title mb-3">
              <RiWalletLine className="me-1" size={14} />
              Financial Details
            </h6>
            
            <Row className="g-2">
              <Col md={6}>
                <FormGroup className="mb-2">
                  <Label className="form-label-sm">Opening Balance</Label>
                  <Input
                    type="number"
                    name="openingBalance"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={validation.values.openingBalance}
                    onChange={handleNumericChange('openingBalance')}
                    onBlur={handleNumericBlur('openingBalance')}
                    invalid={validation.touched.openingBalance && !!validation.errors.openingBalance}
                    disabled={isProcessing}
                    className="form-control-sm"
                  />
                  <FormFeedback>{validation.errors.openingBalance}</FormFeedback>
                </FormGroup>
              </Col>
              <Col md={6}>
                <FormGroup className="mb-2">
                  <Label className="form-label-sm">
                    Balance Type 
                    {validation.values.openingBalance > 0 && <span className="text-danger"> *</span>}
                  </Label>
                  <Input
                    type="select"
                    name="openingBalanceType"
                    value={validation.values.openingBalanceType}
                    onChange={validation.handleChange}
                    onBlur={validation.handleBlur}
                    invalid={validation.touched.openingBalanceType && !!validation.errors.openingBalanceType}
                    disabled={isProcessing}
                    className="form-control-sm"
                  >
                    {validation.values.openingBalance > 0 && (
                      <option value="none" disabled>Please Select Balance Type</option>
                    )}
                    {balanceTypes
                      .filter(balanceType => 
                        validation.values.openingBalance === 0 || balanceType.value !== 'none'
                      )
                      .map(balanceType => (
                      <option key={balanceType.value} value={balanceType.value}>
                        {balanceType.label}
                      </option>
                    ))}
                  </Input>
                  <FormFeedback>{validation.errors.openingBalanceType}</FormFeedback>
                  {validation.values.openingBalance > 0 && (
                    <small className="text-warning">
                      Please select Receivable or Payable when amount is greater than 0
                    </small>
                  )}
                  {validation.values.openingBalance === 0 && (
                    <small className="text-muted">
                      Automatically set to Receivable when amount is 0
                    </small>
                  )}
                </FormGroup>
              </Col>
            </Row>
          </div>

          {/* Portal Access Section */}
          {isEditMode && selectedContact?.enablePortal && (
            <div className="form-section mb-3">
              <h6 className="section-title mb-3">Portal Access</h6>
              <p className="text-muted small mb-3">
                Generate a portal access token to send to the customer via email.
              </p>
              
              <Row className="g-2">
                <Col md={6}>
                  <FormGroup className="mb-2">
                    <Label className="form-label-sm">Token Expiry Time</Label>
                    <Input
                      type="select"
                      id="tokenExpiry"
                      defaultValue="24"
                      disabled={isProcessing}
                      className="form-control-sm"
                    >
                      {PORTAL_EXPIRY_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Input>
                  </FormGroup>
                </Col>
                <Col md={6}>
                  <FormGroup className="mb-2">
                    <Label className="form-label-sm">&nbsp;</Label>
                    <div>
                      <Button
                        color="primary"
                        size="sm"
                        onClick={() => {
                          const expirySelect = document.getElementById('tokenExpiry');
                          const expiryHours = parseInt(expirySelect.value);
                          handleGeneratePortalAccess(expiryHours);
                        }}
                        disabled={isProcessing || isGeneratingToken}
                        className="w-100 btn-sm-compact"
                      >
                        {isGeneratingToken ? (
                          <>
                            <RiLoader4Line className="spin me-1" />
                            Generating...
                          </>
                        ) : (
                          'Generate Token'
                        )}
                      </Button>
                    </div>
                  </FormGroup>
                </Col>
              </Row>
            </div>
          )}

          {/* Notes Section */}
          <div className="form-section">
            <h6 className="section-title mb-3">Additional Information</h6>
            <FormGroup className="mb-0">
              <Label className="form-label-sm">Notes</Label>
              <Input
                type="textarea"
                name="notes"
                rows="2"
                value={validation.values.notes}
                onChange={validation.handleChange}
                onBlur={validation.handleBlur}
                placeholder="Additional notes about this contact"
                disabled={isProcessing}
                className="form-control-sm"
              />
            </FormGroup>
          </div>
        </Form>
      </ModalBody>
      
      <ModalFooter className="py-2">
        <Button
          color="light"
          onClick={toggle}
          disabled={isProcessing}
          className="px-3"
        >
          Cancel
        </Button>
        <Button
          color="primary"
          type="submit"
          disabled={isProcessing}
          className="px-3"
        >
          {isProcessing ? (
            <>
              <RiLoader4Line className="spin me-1" />
              {isEditMode ? 'Updating...' : 'Creating...'}
            </>
          ) : (
            isEditMode ? 'Update Contact' : 'Create Contact'
          )}
        </Button>
      </ModalFooter>

      <style jsx>{`
        .contact-form-modal .modal-content {
          border-radius: 8px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
        }

        .avatar-xs {
          width: 1.75rem;
          height: 1.75rem;
        }

        .bg-primary-subtle {
          background-color: rgba(13, 110, 253, 0.1) !important;
        }

        .form-section {
          background: var(--vz-body-bg);
          border: 1px solid var(--vz-border-color);
          border-radius: 6px;
          padding: 0.75rem;
        }

        .section-title {
          color: var(--vz-secondary-color);
          font-size: 0.8rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin: 0;
        }

        .form-control-sm {
          font-size: 0.875rem;
          padding: 0.375rem 0.75rem;
          height: 32px;
        }

        .form-label-sm {
          font-size: 0.8rem;
          font-weight: 500;
          color: var(--vz-secondary-color);
          margin-bottom: 0.25rem;
        }

        .form-check-input-sm {
          transform: scale(0.9);
        }

        .form-check-label-sm {
          font-size: 0.875rem;
          font-weight: 500;
        }

        .btn-sm-compact {
          font-size: 0.75rem;
          padding: 0.25rem 0.5rem;
          line-height: 1.2;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Modal>
  );
};

export default ContactForm;

/* Add styles for the redesigned form */
const styles = `
  .contact-form-modal .modal-content {
    border-radius: 8px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  }

  .avatar-xs {
    width: 1.75rem;
    height: 1.75rem;
  }

  .bg-primary-subtle {
    background-color: rgba(13, 110, 253, 0.1) !important;
  }

  .form-section {
    background: var(--vz-body-bg);
    border: 1px solid var(--vz-border-color);
    border-radius: 6px;
    padding: 0.75rem;
  }

  .section-title {
    color: var(--vz-secondary-color);
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 0;
  }

  .form-control-sm {
    font-size: 0.875rem;
    padding: 0.375rem 0.75rem;
    height: 32px;
  }

  .form-label-sm {
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--vz-secondary-color);
    margin-bottom: 0.25rem;
  }

  .form-check-input-sm {
    transform: scale(0.9);
  }

  .form-check-label-sm {
    font-size: 0.875rem;
    font-weight: 500;
  }

  .btn-sm-compact {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    line-height: 1.2;
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
}