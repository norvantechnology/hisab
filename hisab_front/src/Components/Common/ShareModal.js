import React, { useState } from 'react';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Form,
  FormGroup,
  Label,
  Input,
  Button,
  Row,
  Col,
  FormFeedback,
  Alert
} from 'reactstrap';
import { RiMailLine, RiWhatsappLine, RiCloseLine, RiLoader4Line, RiShareLine } from 'react-icons/ri';
import * as Yup from "yup";
import { useFormik } from "formik";

const ShareModal = ({ 
  isOpen, 
  toggle, 
  invoiceType, // 'sales' or 'purchase'
  invoiceData, // invoice object with details
  onShare, // function to handle share
  isLoading = false 
}) => {
  const [shareType, setShareType] = useState('email');

  const validationSchema = Yup.object({
    shareType: Yup.string().oneOf(['email']).required('Share type is required'), // Only email for now
    recipient: Yup.string().email('Invalid email address').required('Email is required'),
    // WhatsApp validation commented out - coming soon
    // recipient: Yup.string().when('shareType', {
    //   is: 'email',
    //   then: () => Yup.string().email('Invalid email address').required('Email is required'),
    //   otherwise: () => Yup.string()
    //     .matches(/^[0-9]{10,15}$/, 'Mobile number must be 10-15 digits')
    //     .required('Mobile number is required')
    // }),
    description: Yup.string().max(500, 'Description cannot exceed 500 characters')
  });

  const formik = useFormik({
    initialValues: {
      shareType: 'email',
      recipient: '',
      description: ''
    },
    validationSchema,
    onSubmit: (values) => {
      if (values.shareType === 'whatsapp') {
        alert('WhatsApp integration coming soon! 🚀\n\nPlease use email for now.');
        return;
      }
      onShare(values);
    }
  });

  const generateDefaultDescription = () => {
    if (!invoiceData) return '';
    
    const type = invoiceType === 'sales' ? 'Sales' : 'Purchase';
    const amount = invoiceType === 'sales' 
      ? parseFloat(invoiceData.netReceivable || 0).toFixed(2)
      : parseFloat(invoiceData.netPayable || 0).toFixed(2);
    
    return `${type} Invoice #${invoiceData.invoiceNumber || 'N/A'} from ${invoiceData.companyName || 'Our Company'}. 
Amount: ₹${amount}. 
Date: ${new Date(invoiceData.invoiceDate || Date.now()).toLocaleDateString('en-IN')}.
Thank you for your business!`;
  };

  const handleShareTypeChange = (type) => {
    if (type === 'whatsapp') {
      // Show coming soon message for WhatsApp
      alert('WhatsApp integration coming soon! 🚀\n\nFor now, you can use email to share invoices.\nWhatsApp functionality will be available in the next update.');
      return;
    }
    
    setShareType(type);
    formik.setFieldValue('shareType', type);
    formik.setFieldValue('recipient', ''); // Clear recipient when changing type
  };

  const handleAutoFillDescription = () => {
    const defaultDesc = generateDefaultDescription();
    formik.setFieldValue('description', defaultDesc);
  };

  const resetForm = () => {
    formik.resetForm();
    setShareType('email');
  };

  const handleModalToggle = () => {
    resetForm();
    toggle();
  };

  return (
    <Modal isOpen={isOpen} toggle={handleModalToggle} centered size="md">
      <ModalHeader toggle={handleModalToggle}>
        <div className="d-flex align-items-center">
          <RiShareLine className="me-2" />
          Share {invoiceType === 'sales' ? 'Sales' : 'Purchase'} Invoice
        </div>
      </ModalHeader>
      
      <Form onSubmit={formik.handleSubmit}>
        <ModalBody>
          {invoiceData && (
            <Alert color="info" className="mb-3">
              <strong>Invoice:</strong> #{invoiceData.invoiceNumber || 'N/A'} | 
              <strong> Date:</strong> {new Date(invoiceData.invoiceDate || Date.now()).toLocaleDateString('en-IN')} | 
              <strong> Amount:</strong> ₹{invoiceType === 'sales' 
                ? parseFloat(invoiceData.netReceivable || 0).toFixed(2)
                : parseFloat(invoiceData.netPayable || 0).toFixed(2)}
            </Alert>
          )}

          {/* Share Type Selection */}
          <FormGroup>
            <Label className="form-label">Share Via</Label>
            <Row>
              <Col md={6}>
                <div 
                  className={`border rounded p-3 cursor-pointer text-center ${shareType === 'email' ? 'border-primary bg-light' : 'border-secondary'}`}
                  onClick={() => handleShareTypeChange('email')}
                  style={{ cursor: 'pointer' }}
                >
                  <RiMailLine size={24} className={`mb-2 ${shareType === 'email' ? 'text-primary' : 'text-secondary'}`} />
                  <div className={`fw-medium ${shareType === 'email' ? 'text-primary' : 'text-secondary'}`}>
                    Email
                  </div>
                </div>
              </Col>
              <Col md={6}>
                <div 
                  className={`border rounded p-3 cursor-pointer text-center position-relative ${shareType === 'whatsapp' ? 'border-success bg-light' : 'border-secondary'}`}
                  onClick={() => handleShareTypeChange('whatsapp')}
                  style={{ cursor: 'pointer', opacity: 0.6 }}
                >
                  <RiWhatsappLine size={24} className={`mb-2 text-secondary`} />
                  <div className={`fw-medium text-secondary`}>
                    WhatsApp
                  </div>
                  <div className="position-absolute top-0 end-0">
                    <small className="badge bg-warning text-dark">Soon</small>
                  </div>
                </div>
              </Col>
            </Row>
          </FormGroup>

          {/* Recipient Input */}
          <FormGroup>
            <Label className="form-label">
              Email Address
              {/* {shareType === 'email' ? 'Email Address' : 'Mobile Number'} */}
            </Label>
            <Input
              type="email"
              name="recipient"
              placeholder="Enter email address"
              value={formik.values.recipient}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              invalid={formik.touched.recipient && !!formik.errors.recipient}
              disabled={isLoading}
            />
            <FormFeedback>{formik.errors.recipient}</FormFeedback>
            {/* WhatsApp instructions commented out - coming soon */}
            {/* {shareType === 'whatsapp' && (
              <div className="form-text">
                Enter mobile number without country code (e.g., 9876543210)
              </div>
            )} */}
            {/* {shareType === 'whatsapp' && (
              <Alert color="info" className="mt-2">
                <small>
                  <strong>📱 WhatsApp Integration:</strong><br/>
                  • If WhatsApp Business API is configured: PDF will be sent directly<br/>
                  • If not configured: Will open web WhatsApp with pre-filled message
                </small>
              </Alert>
            )} */}
          </FormGroup>

          {/* Description */}
          <FormGroup>
            <div className="d-flex justify-content-between align-items-center">
              <Label className="form-label">Message Description</Label>
              <Button
                type="button"
                color="link"
                size="sm"
                className="p-0"
                onClick={handleAutoFillDescription}
                disabled={isLoading}
              >
                Auto-fill
              </Button>
            </div>
            <Input
              type="textarea"
              name="description"
              rows="4"
              placeholder="Enter a custom message or click 'Auto-fill' for a default message"
              value={formik.values.description}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              invalid={formik.touched.description && !!formik.errors.description}
              disabled={isLoading}
            />
            <FormFeedback>{formik.errors.description}</FormFeedback>
            <div className="form-text">
              {formik.values.description.length}/500 characters
            </div>
          </FormGroup>
        </ModalBody>

        <ModalFooter>
          <Button 
            type="button" 
            color="secondary" 
            onClick={handleModalToggle}
            disabled={isLoading}
          >
            <RiCloseLine className="me-1" />
            Cancel
          </Button>
          <Button 
            type="submit" 
            color="primary"
            disabled={isLoading || !formik.isValid}
          >
            {isLoading ? (
              <>
                <RiLoader4Line className="me-1 spin" />
                Sharing...
              </>
            ) : (
              <>
                <RiMailLine className="me-1" />
                Share via Email
              </>
            )}
          </Button>
        </ModalFooter>
      </Form>
    </Modal>
  );
};

export default ShareModal; 