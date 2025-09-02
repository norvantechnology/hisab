import React, { useState } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Form, FormGroup, Label, Input, FormFeedback, Button, Row, Col } from 'reactstrap';
import { RiLoader4Line } from 'react-icons/ri';
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
    <Modal isOpen={isOpen} toggle={toggle} size="lg">
      <ModalHeader toggle={toggle}>
        {isEditMode ? 'Edit Contact' : 'Create Contact'}
      </ModalHeader>
      <ModalBody>
        <Form onSubmit={handleFormSubmit}>
          <Row>
            <Col md={6}>
              <FormGroup>
                <Label>GSTIN</Label>
                <Input
                  type="text"
                  name="gstin"
                  placeholder="27AAHCS1234F1Z1"
                  value={validation.values.gstin}
                  onChange={validation.handleChange}
                  onBlur={validation.handleBlur}
                  invalid={validation.touched.gstin && !!validation.errors.gstin}
                  disabled={isProcessing}
                />
                <FormFeedback>{validation.errors.gstin}</FormFeedback>
              </FormGroup>
            </Col>
            <Col md={6}>
              <FormGroup>
                <Label>Name <span className="text-danger">*</span></Label>
                <Input
                  type="text"
                  name="name"
                  value={validation.values.name}
                  onChange={validation.handleChange}
                  onBlur={validation.handleBlur}
                  invalid={validation.touched.name && !!validation.errors.name}
                  disabled={isProcessing}
                />
                <FormFeedback>{validation.errors.name}</FormFeedback>
              </FormGroup>
            </Col>
          </Row>

          <Row>
            <Col md={6}>
              <FormGroup>
                <Label>Mobile <span className="text-danger">*</span></Label>
                <Input
                  type="text"
                  name="mobile"
                  value={validation.values.mobile}
                  onChange={validation.handleChange}
                  onBlur={validation.handleBlur}
                  invalid={validation.touched.mobile && !!validation.errors.mobile}
                  disabled={isProcessing}
                />
                <FormFeedback>{validation.errors.mobile}</FormFeedback>
              </FormGroup>
            </Col>
            <Col md={6}>
              <FormGroup>
                <Label>
                  Email
                  {validation.values.enablePortal && <span className="text-danger">*</span>}
                </Label>
                <Input
                  type="email"
                  name="email"
                  value={validation.values.email}
                  onChange={validation.handleChange}
                  onBlur={validation.handleBlur}
                  invalid={validation.touched.email && !!validation.errors.email}
                  disabled={isProcessing}
                />
                <FormFeedback>{validation.errors.email}</FormFeedback>
              </FormGroup>
            </Col>
          </Row>

          <Row>
            <Col md={4}>
              <FormGroup>
                <Label>Due Days</Label>
                <Input
                  type="number"
                  name="dueDays"
                  min="0"
                  value={validation.values.dueDays}
                  onChange={handleNumericChange('dueDays')}
                  onBlur={handleNumericBlur('dueDays')}
                  invalid={validation.touched.dueDays && !!validation.errors.dueDays}
                  disabled={isProcessing}
                />
                <FormFeedback>{validation.errors.dueDays}</FormFeedback>
              </FormGroup>
            </Col>
            <Col md={4}>
              <FormGroup>
                <Label>Contact Type <span className="text-danger">*</span></Label>
                <Input
                  type="select"
                  name="contactType"
                  value={validation.values.contactType}
                  onChange={validation.handleChange}
                  onBlur={validation.handleBlur}
                  invalid={validation.touched.contactType && !!validation.errors.contactType}
                  disabled={isProcessing}
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

          <h5 className="mt-4">Billing Address</h5>
          <Row>
            <Col md={12}>
              <FormGroup>
                <Label>Address Line 1 <span className="text-danger">*</span></Label>
                <Input
                  type="text"
                  name="billingAddress1"
                  value={validation.values.billingAddress1}
                  onChange={validation.handleChange}
                  onBlur={validation.handleBlur}
                  invalid={validation.touched.billingAddress1 && !!validation.errors.billingAddress1}
                  disabled={isProcessing}
                />
                <FormFeedback>{validation.errors.billingAddress1}</FormFeedback>
              </FormGroup>
            </Col>
          </Row>

          <Row>
            <Col md={12}>
              <FormGroup>
                <Label>Address Line 2</Label>
                <Input
                  type="text"
                  name="billingAddress2"
                  value={validation.values.billingAddress2}
                  onChange={validation.handleChange}
                  onBlur={validation.handleBlur}
                  invalid={validation.touched.billingAddress2 && !!validation.errors.billingAddress2}
                  disabled={isProcessing}
                />
                <FormFeedback>{validation.errors.billingAddress2}</FormFeedback>
              </FormGroup>
            </Col>
          </Row>

          <Row>
            <Col md={4}>
              <FormGroup>
                <Label>City <span className="text-danger">*</span></Label>
                <Input
                  type="text"
                  name="billingCity"
                  value={validation.values.billingCity}
                  onChange={validation.handleChange}
                  onBlur={validation.handleBlur}
                  invalid={validation.touched.billingCity && !!validation.errors.billingCity}
                  disabled={isProcessing}
                />
                <FormFeedback>{validation.errors.billingCity}</FormFeedback>
              </FormGroup>
            </Col>
            <Col md={4}>
              <FormGroup>
                <Label>Pincode <span className="text-danger">*</span></Label>
                <Input
                  type="text"
                  name="billingPincode"
                  value={validation.values.billingPincode}
                  onChange={validation.handleChange}
                  onBlur={validation.handleBlur}
                  invalid={validation.touched.billingPincode && !!validation.errors.billingPincode}
                  disabled={isProcessing}
                />
                <FormFeedback>{validation.errors.billingPincode}</FormFeedback>
              </FormGroup>
            </Col>
            <Col md={4}>
              <FormGroup>
                <Label>State <span className="text-danger">*</span></Label>
                <Input
                  type="text"
                  name="billingState"
                  value={validation.values.billingState}
                  onChange={validation.handleChange}
                  onBlur={validation.handleBlur}
                  invalid={validation.touched.billingState && !!validation.errors.billingState}
                  disabled={isProcessing}
                />
                <FormFeedback>{validation.errors.billingState}</FormFeedback>
              </FormGroup>
            </Col>
          </Row>

          <Row>
            <Col md={12}>
              <FormGroup>
                <Label>Country <span className="text-danger">*</span></Label>
                <Input
                  type="text"
                  name="billingCountry"
                  value={validation.values.billingCountry}
                  onChange={validation.handleChange}
                  onBlur={validation.handleBlur}
                  invalid={validation.touched.billingCountry && !!validation.errors.billingCountry}
                  disabled={isProcessing}
                />
                <FormFeedback>{validation.errors.billingCountry}</FormFeedback>
              </FormGroup>
            </Col>
          </Row>

          <FormGroup check className="mt-3">
            <Input
              type="checkbox"
              id="isShippingSame"
              name="isShippingSame"
              checked={validation.values.isShippingSame}
              onChange={handleShippingSameChange}
              disabled={isProcessing}
            />
            <Label check for="isShippingSame">
              Shipping address same as billing address
            </Label>
          </FormGroup>

          {!validation.values.isShippingSame && (
            <>
              <h5 className="mt-4">Shipping Address</h5>
              <Row>
                <Col md={12}>
                  <FormGroup>
                    <Label>Address Line 1 <span className="text-danger">*</span></Label>
                    <Input
                      type="text"
                      name="shippingAddress1"
                      value={validation.values.shippingAddress1}
                      onChange={validation.handleChange}
                      onBlur={validation.handleBlur}
                      invalid={validation.touched.shippingAddress1 && !!validation.errors.shippingAddress1}
                      disabled={isProcessing}
                    />
                    <FormFeedback>{validation.errors.shippingAddress1}</FormFeedback>
                  </FormGroup>
                </Col>
              </Row>

              <Row>
                <Col md={12}>
                  <FormGroup>
                    <Label>Address Line 2</Label>
                    <Input
                      type="text"
                      name="shippingAddress2"
                      value={validation.values.shippingAddress2}
                      onChange={validation.handleChange}
                      onBlur={validation.handleBlur}
                      invalid={validation.touched.shippingAddress2 && !!validation.errors.shippingAddress2}
                      disabled={isProcessing}
                    />
                    <FormFeedback>{validation.errors.shippingAddress2}</FormFeedback>
                  </FormGroup>
                </Col>
              </Row>

              <Row>
                <Col md={4}>
                  <FormGroup>
                    <Label>City <span className="text-danger">*</span></Label>
                    <Input
                      type="text"
                      name="shippingCity"
                      value={validation.values.shippingCity}
                      onChange={validation.handleChange}
                      onBlur={validation.handleBlur}
                      invalid={validation.touched.shippingCity && !!validation.errors.shippingCity}
                      disabled={isProcessing}
                    />
                    <FormFeedback>{validation.errors.shippingCity}</FormFeedback>
                  </FormGroup>
                </Col>
                <Col md={4}>
                  <FormGroup>
                    <Label>Pincode <span className="text-danger">*</span></Label>
                    <Input
                      type="text"
                      name="shippingPincode"
                      value={validation.values.shippingPincode}
                      onChange={validation.handleChange}
                      onBlur={validation.handleBlur}
                      invalid={validation.touched.shippingPincode && !!validation.errors.shippingPincode}
                      disabled={isProcessing}
                    />
                    <FormFeedback>{validation.errors.shippingPincode}</FormFeedback>
                  </FormGroup>
                </Col>
                <Col md={4}>
                  <FormGroup>
                    <Label>State <span className="text-danger">*</span></Label>
                    <Input
                      type="text"
                      name="shippingState"
                      value={validation.values.shippingState}
                      onChange={validation.handleChange}
                      onBlur={validation.handleBlur}
                      invalid={validation.touched.shippingState && !!validation.errors.shippingState}
                      disabled={isProcessing}
                    />
                    <FormFeedback>{validation.errors.shippingState}</FormFeedback>
                  </FormGroup>
                </Col>
              </Row>

              <Row>
                <Col md={12}>
                  <FormGroup>
                    <Label>Country <span className="text-danger">*</span></Label>
                    <Input
                      type="text"
                      name="shippingCountry"
                      value={validation.values.shippingCountry}
                      onChange={validation.handleChange}
                      onBlur={validation.handleBlur}
                      invalid={validation.touched.shippingCountry && !!validation.errors.shippingCountry}
                      disabled={isProcessing}
                    />
                    <FormFeedback>{validation.errors.shippingCountry}</FormFeedback>
                  </FormGroup>
                </Col>
              </Row>
            </>
          )}

          <h5 className="mt-4">Financial Details</h5>
          <Row>
            <Col md={6}>
              <FormGroup>
                <Label>Opening Balance</Label>
                <Input
                  type="number"
                  name="openingBalance"
                  min="0"
                  step="0.01"
                  value={validation.values.openingBalance}
                  onChange={handleNumericChange('openingBalance')}
                  onBlur={handleNumericBlur('openingBalance')}
                  invalid={validation.touched.openingBalance && !!validation.errors.openingBalance}
                  disabled={isProcessing}
                />
                <FormFeedback>{validation.errors.openingBalance}</FormFeedback>
              </FormGroup>
            </Col>
            <Col md={6}>
              <FormGroup>
                <Label>
                  Balance Type 
                  {validation.values.openingBalance > 0 && <span className="text-danger">*</span>}
                  {validation.values.openingBalance === 0 && <small className="text-success"> (Auto: Receivable)</small>}
                </Label>
                <Input
                  type="select"
                  name="openingBalanceType"
                  value={validation.values.openingBalanceType}
                  onChange={validation.handleChange}
                  onBlur={validation.handleBlur}
                  invalid={validation.touched.openingBalanceType && !!validation.errors.openingBalanceType}
                  disabled={isProcessing}
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
                  <small className="text-danger">
                    Please select Receivable or Payable when amount is greater than 0
                  </small>
                )}
                {validation.values.openingBalance === 0 && (
                  <small className="text-success">
                    Automatically set to Receivable when amount is 0
                  </small>
                )}
              </FormGroup>
            </Col>
          </Row>

          <FormGroup check className="mt-3">
            <Input
              type="checkbox"
              id="enablePortal"
              name="enablePortal"
              checked={validation.values.enablePortal}
              onChange={validation.handleChange}
              disabled={isProcessing}
            />
            <Label check for="enablePortal">
              Enable customer portal access
            </Label>
            {validation.values.enablePortal && (
              <small className="text-info d-block mt-1">
                <i className="mdi mdi-information-outline me-1"></i>
                Email address is required when portal access is enabled
              </small>
            )}
          </FormGroup>

          {isEditMode && selectedContact?.enablePortal && (
            <div className="mt-3 p-3 bg-light rounded">
              <h6 className="mb-2">Portal Access</h6>
              <p className="text-muted small mb-2">
                Generate a portal access token to send to the customer via email.
              </p>
              
              <Row>
                <Col md={6}>
                  <FormGroup>
                    <Label>Token Expiry Time</Label>
                    <Input
                      type="select"
                      id="tokenExpiry"
                      defaultValue="24"
                      disabled={isProcessing}
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
                  <FormGroup>
                    <Label>&nbsp;</Label>
                    <div>
                      <Button
                        color="outline-primary"
                        size="sm"
                        onClick={() => {
                          const expirySelect = document.getElementById('tokenExpiry');
                          const expiryHours = parseInt(expirySelect.value);
                          handleGeneratePortalAccess(expiryHours);
                        }}
                        disabled={isProcessing || isGeneratingToken}
                        style={{ width: '100%' }}
                      >
                        {isGeneratingToken ? (
                          <>
                            <RiLoader4Line className="spin me-1" />
                            Generating...
                          </>
                        ) : (
                          'Generate Portal Access Token'
                        )}
                      </Button>
                    </div>
                  </FormGroup>
                </Col>
              </Row>
            </div>
          )}

          <FormGroup>
            <Label>Notes</Label>
            <Input
              type="textarea"
              name="notes"
              rows="3"
              value={validation.values.notes}
              onChange={validation.handleChange}
              onBlur={validation.handleBlur}
              placeholder="Additional notes about this contact"
              disabled={isProcessing}
            />
          </FormGroup>

          <ModalFooter>
            <Button
              color="light"
              onClick={toggle}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              type="submit"
              disabled={isProcessing}
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
        </Form>
      </ModalBody>
    </Modal>
  );
};

export default ContactForm;