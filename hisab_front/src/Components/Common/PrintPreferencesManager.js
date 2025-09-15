import React, { useState, useEffect } from 'react';
import {
  UncontrolledDropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem,
  Button,
  Spinner,
  Badge,
  Row,
  Col
} from 'reactstrap';
import { toast } from 'react-toastify';
import TemplatePreview from './TemplatePreview';
import { getTemplates, setUserDefaultTemplate } from '../../services/templates';
import { getDefaultCopies, setCopyPreference } from '../../services/copyPreferences';
import { generateSampleData } from '../../utils/templatePreviewUtils';

const PrintPreferencesManager = ({ moduleType, onPreferencesChange, size = "normal" }) => {
  // Template states
  const [templates, setTemplates] = useState([]);
  const [currentDefaultTemplate, setCurrentDefaultTemplate] = useState(null);
  const [selectedPreviewTemplate, setSelectedPreviewTemplate] = useState(null);
  
  // Copy preferences states
  const [currentCopies, setCurrentCopies] = useState(2);
  
  // Loading states
  const [loading, setLoading] = useState(false);
  const [updatingCopies, setUpdatingCopies] = useState(null); // Track which copy button is updating
  const [updatingTemplate, setUpdatingTemplate] = useState(null); // Track which template is updating

  // Fetch both templates and copy preferences when component mounts
  useEffect(() => {
    if (moduleType) {
      fetchPreferences();
    }
  }, [moduleType]);

  const fetchPreferences = async () => {
    setLoading(true);
    try {
      // Fetch templates and copy preferences in parallel
      const [templatesResponse, copyResponse] = await Promise.all([
        getTemplates(moduleType),
        getDefaultCopies(moduleType)
      ]);
      
      // Set templates
      const templateList = templatesResponse.templates || [];
      setTemplates(templateList);
      const defaultTemplate = templateList.find(template => template.default === true);
      setCurrentDefaultTemplate(defaultTemplate || null);
      
      // Set copy preferences
      setCurrentCopies(copyResponse.defaultCopies || 2);
      
    } catch (error) {
      console.error('Error fetching preferences:', error);
      toast.error('Failed to load preferences');
    } finally {
      setLoading(false);
    }
  };

  // Set template as default
  const setDefaultTemplate = async (templateId) => {
    setUpdatingTemplate(templateId);
    try {
      await setUserDefaultTemplate({
        templateId,
        moduleType
      });

      toast.success('Default template updated successfully');
      fetchPreferences();
      if (onPreferencesChange) {
        onPreferencesChange();
      }
    } catch (error) {
      console.error('Error setting default template:', error);
      toast.error('Failed to update default template');
    } finally {
      setUpdatingTemplate(null);
    }
  };

  // Update copy preference
  const updateCopyPreference = async (defaultCopies) => {
    setUpdatingCopies(defaultCopies);
    try {
      await setCopyPreference({
        moduleType,
        defaultCopies
      });
      
      setCurrentCopies(defaultCopies);
      toast.success(`Default copies updated to ${defaultCopies}`);
      
      if (onPreferencesChange) {
        onPreferencesChange();
      }
    } catch (error) {
      console.error('Error updating copy preference:', error);
      toast.error('Failed to update copy preference');
    } finally {
      setUpdatingCopies(null);
    }
  };

  // Preview template
  const handlePreview = (template) => {
    const sampleData = generateSampleData(template.moduleType);
    setSelectedPreviewTemplate({ 
      ...template, 
      previewData: { template, sampleData } 
    });
  };

  const getCopyLabel = (copies) => {
    switch (copies) {
      case 1: return '1 Copy';
      case 2: return '2 Copies';
      case 4: return '4 Copies';
      default: return `${copies} Copies`;
    }
  };

  const getCopyColor = (copies) => {
    switch (copies) {
      case 1: return 'info';
      case 2: return 'success';
      case 4: return 'warning';
      default: return 'secondary';
    }
  };

  const getModuleInfo = (type) => {
    const moduleMap = {
      sales: { label: 'Sales', icon: '🧾' },
      purchase: { label: 'Purchase', icon: '📄' },
      payment: { label: 'Payment', icon: '🧾' }
    };
    return moduleMap[type] || moduleMap.sales;
  };

  const moduleInfo = getModuleInfo(moduleType);

  if (loading) {
    return (
      <Button color="secondary" disabled size={size === "small" ? "sm" : undefined}>
        <Spinner size="sm" />
        <span className="ms-1">Print Settings</span>
      </Button>
    );
  }

  if (!templates.length) {
    return null;
  }

  return (
    <>
      <UncontrolledDropdown>
        <DropdownToggle 
          color="secondary" 
          size={size === "small" ? "sm" : undefined}
          className="d-flex align-items-center justify-content-center gap-1"
          style={{ 
            height: '38px',
            minHeight: '38px',
            maxHeight: '38px',
            padding: '0.375rem 0.75rem',
            fontSize: '1rem',
            lineHeight: '1.5',
            borderRadius: '0.375rem',
            border: '1px solid #dee2e6',
            boxSizing: 'border-box'
          }}
          caret
        >
          <i className="ri-printer-line align-bottom"></i>
          <span className="d-none d-sm-inline">Print Settings</span>
          <span className="d-sm-none">Print</span>
        </DropdownToggle>
        
        <DropdownMenu 
          end 
          className="shadow-lg border-0"
          style={{ 
            minWidth: '320px',
            maxHeight: 'none',
            borderRadius: '12px'
          }}
        >
          {/* Header */}
          <div className="px-4 py-3 bg-gradient" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
            <div className="d-flex align-items-center justify-content-between text-white">
              <div className="d-flex align-items-center">
                <i className="ri-printer-line me-2" style={{ fontSize: '16px' }}></i>
                <span className="fw-semibold">Print Settings</span>
              </div>
              {currentDefaultTemplate && (
                <Badge color="light" className="text-dark">
                  <i className="ri-check-line me-1"></i>Configured
                </Badge>
              )}
            </div>
          </div>
          


          {/* Copy Preferences Section */}
          <div className="p-2 border-bottom">
            <div className="d-flex align-items-center mb-2">
              <i className="ri-file-copy-line text-success me-2"></i>
              <span className="fw-semibold text-dark">Copies per Page</span>
            </div>
            
            <div className="d-grid gap-2">
              <Row className="g-2">
                <Col xs={4}>
                  <Button 
                    color={currentCopies === 1 ? "success" : "outline-secondary"}
                    className="w-100 d-flex flex-column align-items-center py-2"
                    onClick={() => updateCopyPreference(1)}
                    disabled={updatingCopies !== null}
                    style={{ minHeight: '60px' }}
                  >
                    {updatingCopies === 1 ? 
                      <Spinner size="sm" /> : 
                      <>
                        <span className="fw-bold" style={{ fontSize: '18px' }}>1</span>
                        <small style={{ fontSize: '10px' }}>Large</small>
                      </>
                    }
                  </Button>
                </Col>
                <Col xs={4}>
                  <Button 
                    color={currentCopies === 2 ? "success" : "outline-secondary"}
                    className="w-100 d-flex flex-column align-items-center py-2"
                    onClick={() => updateCopyPreference(2)}
                    disabled={updatingCopies !== null}
                    style={{ minHeight: '60px' }}
                  >
                    {updatingCopies === 2 ? 
                      <Spinner size="sm" /> : 
                      <>
                        <span className="fw-bold" style={{ fontSize: '18px' }}>2</span>
                        <small style={{ fontSize: '10px' }}>Standard</small>
                      </>
                    }
                  </Button>
                </Col>
                <Col xs={4}>
                  <Button 
                    color={currentCopies === 4 ? "success" : "outline-secondary"}
                    className="w-100 d-flex flex-column align-items-center py-2"
                    onClick={() => updateCopyPreference(4)}
                    disabled={updatingCopies !== null}
                    style={{ minHeight: '60px' }}
                  >
                    {updatingCopies === 4 ? 
                      <Spinner size="sm" /> : 
                      <>
                        <span className="fw-bold" style={{ fontSize: '18px' }}>4</span>
                        <small style={{ fontSize: '10px' }}>Compact</small>
                      </>
                    }
                  </Button>
                </Col>
              </Row>
            </div>
          </div>

          {/* Templates Section */}
          <div className="p-2">
            <div className="d-flex align-items-center mb-2">
              <i className="ri-file-text-line text-primary me-2"></i>
              <span className="fw-semibold text-dark">Select Template</span>
            </div>
            
            <div className="d-grid gap-2" style={{ maxHeight: '240px', overflowY: 'auto' }}>
              {templates.map((template) => (
                <div key={template.id}>
                  <div className={`p-2 rounded-3 border ${template.default ? 'border-success bg-success-subtle' : 'border-light bg-light'} hover-shadow`} 
                       style={{ cursor: 'pointer', transition: 'all 0.2s' }}>
                    <div className="d-flex align-items-center justify-content-between">
                      <div className="flex-grow-1">
                        <div className="d-flex align-items-center mb-1">
                          <span className="fw-semibold text-dark" style={{ fontSize: '13px' }}>
                            {template.name}
                          </span>
                          {template.default && (
                            <Badge color="success" className="ms-2 px-2">
                              <i className="ri-check-line me-1"></i>Active
                            </Badge>
                          )}
                        </div>
                        <p className="text-muted mb-0" style={{ fontSize: '11px', lineHeight: '1.3' }}>
                          {template.description}
                        </p>
                      </div>
                      
                      <div className="d-flex gap-1 ms-3">
                        <button
                          className="btn btn-outline-primary btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePreview(template);
                          }}
                          title="Preview"
                          style={{ width: '32px', height: '32px' }}
                        >
                          <i className="ri-eye-line"></i>
                        </button>
                        
                        {!template.default && (
                          <button
                            className="btn btn-success btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDefaultTemplate(template.id);
                            }}
                            title="Set as Default"
                            disabled={updatingTemplate !== null}
                            style={{ width: '32px', height: '32px' }}
                          >
                            {updatingTemplate === template.id ? 
                              <Spinner size="sm" style={{ width: '12px', height: '12px' }} /> :
                              <i className="ri-check-line"></i>
                            }
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DropdownMenu>
      </UncontrolledDropdown>

      {/* Preview Modal */}
      {selectedPreviewTemplate && (
        <TemplatePreview
          isOpen={!!selectedPreviewTemplate}
          toggle={() => setSelectedPreviewTemplate(null)}
          template={selectedPreviewTemplate}
          onTemplateSet={() => {
            // Refresh preferences when template is set
            fetchPreferences();
            setSelectedPreviewTemplate(null);
          }}
        />
      )}
      
      {/* Custom CSS for professional styling */}
      <style jsx>{`
        .hover-shadow:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1) !important;
          transform: translateY(-1px);
        }
        .dropdown-menu {
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15) !important;
          border: none !important;
        }
        .bg-success-subtle {
          background-color: rgba(25, 135, 84, 0.1) !important;
        }
        .card {
          transition: all 0.2s ease;
        }
        .btn {
          transition: all 0.2s ease;
        }
        .btn:hover {
          transform: translateY(-1px);
        }
        /* Clean scrollbar for template section */
        .d-grid::-webkit-scrollbar {
          width: 4px;
        }
        .d-grid::-webkit-scrollbar-track {
          background: #f8f9fa;
          border-radius: 2px;
        }
        .d-grid::-webkit-scrollbar-thumb {
          background: #dee2e6;
          border-radius: 2px;
        }
        .d-grid::-webkit-scrollbar-thumb:hover {
          background: #adb5bd;
        }
      `}</style>
    </>
  );
};

export default PrintPreferencesManager; 