import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Spinner,
  Alert
} from 'reactstrap';
import { toast } from 'react-toastify';
import { generateSampleData, generatePreviewHTML } from '../../utils/templatePreviewUtils';
import { setUserDefaultTemplate } from '../../services/templates';

const TemplatePreview = ({ isOpen, toggle, template, onTemplateSet }) => {
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [error, setError] = useState(null);
  const [settingTemplate, setSettingTemplate] = useState(false);

  // Generate preview data when template changes
  useEffect(() => {
    if (template && isOpen) {
      if (template.previewData) {
        // Use existing preview data if available
        setPreviewData(template.previewData);
      } else {
        // Generate preview data using frontend utility
        generatePreviewData();
      }
    }
  }, [template, isOpen]);

  const generatePreviewData = () => {
    setLoading(true);
    setError(null);
    
    try {
      const sampleData = generateSampleData(template.moduleType);
      setPreviewData({ template, sampleData });
    } catch (error) {
      console.error('Error generating preview data:', error);
      setError(error.message);
      toast.error('Failed to generate template preview');
    } finally {
      setLoading(false);
    }
  };

  const getPreviewHTML = () => {
    if (!previewData || !previewData.template || !previewData.sampleData) return '';
    return generatePreviewHTML(previewData.template, previewData.sampleData);
  };

  const handleUseTemplate = async () => {
    if (!template) return;
    
    setSettingTemplate(true);
    try {
      await setUserDefaultTemplate({
        templateId: template.id,
        moduleType: template.moduleType
      });
      
      toast.success(`${template.name} set as your default template!`);
      
      // Call parent callback to refresh templates
      if (onTemplateSet) {
        onTemplateSet();
      }
      
      toggle();
    } catch (error) {
      console.error('Error setting default template:', error);
      toast.error('Failed to set default template. Please try again.');
    } finally {
      setSettingTemplate(false);
    }
  };

  return (
    <Modal isOpen={isOpen} toggle={toggle} size="xl" centered>
      <ModalHeader toggle={toggle} className="border-bottom">
        <div className="d-flex align-items-center">
          <i className="ri-eye-line text-primary me-2"></i>
          <span>Template Preview - {template?.name}</span>
        </div>
      </ModalHeader>
      
      <ModalBody className="p-0">
        {loading ? (
          <div className="d-flex flex-column align-items-center justify-content-center py-5">
            <Spinner color="primary" style={{ width: '2rem', height: '2rem' }} />
            <p className="mt-3 text-muted">Generating preview...</p>
          </div>
        ) : error ? (
          <Alert color="danger" className="m-4">
            <h6 className="alert-heading">
              <i className="ri-error-warning-line me-2"></i>
              Error Loading Preview
            </h6>
            <p className="mb-0">{error}</p>
          </Alert>
        ) : previewData ? (
          <div style={{ height: '75vh', position: 'relative' }}>
            {/* Preview Controls */}
            <div className="bg-light border-bottom px-3 py-2">
              <div className="d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center">
                  <span className="badge bg-primary-subtle text-primary me-2">
                    <i className="ri-file-text-line me-1"></i>
                    {template?.moduleType?.toUpperCase()} TEMPLATE
                  </span>
                  <small className="text-muted">
                    {template?.description}
                  </small>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <Button
                    color="outline-secondary"
                    size="sm"
                    onClick={() => {
                      const printWindow = window.open('', '_blank');
                      printWindow.document.write(getPreviewHTML());
                      printWindow.document.close();
                      printWindow.print();
                    }}
                  >
                    <i className="ri-printer-line me-1"></i>
                    Print Preview
                  </Button>
                </div>
              </div>
            </div>
            
            {/* Preview Content */}
            <div style={{ 
              height: 'calc(100% - 60px)', 
              overflow: 'hidden',
              background: '#f8f9fa',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px'
            }}>
              <div style={{
                background: '#fff',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                borderRadius: '8px',
                overflow: 'hidden',
                width: '100%',
                maxWidth: '800px',
                height: '100%'
              }}>
                <iframe
                  srcDoc={getPreviewHTML()}
                  style={{ 
                    width: '100%', 
                    height: '100%', 
                    border: 'none',
                    borderRadius: '8px'
                  }}
                  title="Template Preview"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="d-flex flex-column align-items-center justify-content-center py-5">
            <i className="ri-file-text-line text-muted" style={{ fontSize: '3rem' }}></i>
            <h6 className="mt-3 text-muted">No Preview Available</h6>
            <p className="text-muted mb-0">Unable to generate template preview</p>
          </div>
        )}
      </ModalBody>

      <ModalFooter className="border-top bg-light">
        <div className="d-flex justify-content-between w-100 align-items-center">
          <div>
            {previewData && (
              <small className="text-muted d-flex align-items-center">
                <i className="ri-information-line me-2"></i>
                Preview with sample data for {template?.moduleType} module
              </small>
            )}
          </div>
          <div className="d-flex gap-2">
            <Button color="secondary" onClick={toggle}>
              <i className="ri-close-line me-1"></i>
              Close
            </Button>
            {previewData && (
              <Button 
                color="primary"
                onClick={handleUseTemplate}
                disabled={settingTemplate}
              >
                {settingTemplate ? (
                  <>
                    <Spinner size="sm" className="me-1" />
                    Setting...
                  </>
                ) : (
                  <>
                <i className="ri-check-line me-1"></i>
                Use This Template
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </ModalFooter>
    </Modal>
  );
};

export default TemplatePreview; 