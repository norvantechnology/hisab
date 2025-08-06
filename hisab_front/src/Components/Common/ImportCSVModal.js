import PropTypes from "prop-types";
import React, { useState, useCallback } from "react";
import { Modal, ModalBody, ModalHeader, Button, Alert, Progress, Table } from "reactstrap";
import { CSVLink } from "react-csv";
import Papa from "papaparse";
import { RiFileExcel2Line, RiDownload2Line, RiUpload2Line, RiCloseLine } from "react-icons/ri";

const ImportCSVModal = ({ 
  show, 
  onCloseClick, 
  onImport, 
  sampleData, 
  requiredFields = [],
  optionalFields = [],
  maxFileSize = 5, // MB
  isLoading = false,
  title = "Import CSV",
  description = "Upload a CSV file to import data"
}) => {
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [errors, setErrors] = useState([]);
  const [isValidating, setIsValidating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const allFields = [...requiredFields, ...optionalFields];

  const handleFileChange = useCallback((event) => {
    const selectedFile = event.target.files[0];
    
    if (!selectedFile) {
      setFile(null);
      setParsedData([]);
      setErrors([]);
      return;
    }

    // Check file type
    if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
      setErrors(['Please select a valid CSV file']);
      return;
    }

    // Check file size
    if (selectedFile.size > maxFileSize * 1024 * 1024) {
      setErrors([`File size must be less than ${maxFileSize}MB`]);
      return;
    }

    setFile(selectedFile);
    setErrors([]);

    // Parse CSV file
    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          setErrors(results.errors.map(err => `Row ${err.row}: ${err.message}`));
          return;
        }

        setParsedData(results.data);
        validateData(results.data);
      },
      error: (error) => {
        setErrors([`Error parsing CSV: ${error.message}`]);
      }
    });
  }, [maxFileSize]);

  const validateData = useCallback((data) => {
    setIsValidating(true);
    const validationErrors = [];

    if (data.length === 0) {
      validationErrors.push('CSV file is empty or has no valid data');
    }

    // Check for required fields
    if (data.length > 0) {
      const firstRow = data[0];
      const missingFields = requiredFields.filter(field => 
        !Object.keys(firstRow).some(key => 
          key.toLowerCase() === field.toLowerCase()
        )
      );

      if (missingFields.length > 0) {
        validationErrors.push(`Missing required columns: ${missingFields.join(', ')}`);
      }
    }

    // Validate each row
    data.forEach((row, index) => {
      const rowNumber = index + 2; // +2 because of 0-based index and header row

      // Check required fields have values
      requiredFields.forEach(field => {
        const fieldKey = Object.keys(row).find(key => 
          key.toLowerCase() === field.toLowerCase()
        );
        
        if (!fieldKey || !row[fieldKey] || row[fieldKey].toString().trim() === '') {
          validationErrors.push(`Row ${rowNumber}: ${field} is required`);
        }
      });

      // Validate email format if email field exists
      const emailField = Object.keys(row).find(key => 
        key.toLowerCase() === 'email'
      );
      if (emailField && row[emailField] && row[emailField].trim() !== '') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(row[emailField])) {
          validationErrors.push(`Row ${rowNumber}: Invalid email format`);
        }
      }

      // Validate mobile format if mobile field exists
      const mobileField = Object.keys(row).find(key => 
        key.toLowerCase() === 'mobile'
      );
      if (mobileField && row[mobileField] && row[mobileField].trim() !== '') {
        const mobileRegex = /^[0-9]{10}$/;
        if (!mobileRegex.test(row[mobileField].toString().replace(/\D/g, ''))) {
          validationErrors.push(`Row ${rowNumber}: Mobile must be 10 digits`);
        }
      }

      // Validate GSTIN format if gstin field exists
      const gstinField = Object.keys(row).find(key => 
        key.toLowerCase() === 'gstin'
      );
      if (gstinField && row[gstinField] && row[gstinField].trim() !== '') {
        const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
        if (!gstinRegex.test(row[gstinField])) {
          validationErrors.push(`Row ${rowNumber}: Invalid GSTIN format`);
        }
      }
    });

    setErrors(validationErrors);
    setIsValidating(false);
  }, [requiredFields]);

  const handleImport = useCallback(() => {
    if (parsedData.length === 0 || errors.length > 0) {
      return;
    }

    // Simulate upload progress
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + 10;
      });
    }, 100);

    // Call the import function
    onImport(parsedData, () => {
      setUploadProgress(100);
      setTimeout(() => {
        setFile(null);
        setParsedData([]);
        setErrors([]);
        setUploadProgress(0);
        onCloseClick();
      }, 500);
    });
  }, [parsedData, errors, onImport, onCloseClick]);

  const handleRemoveFile = useCallback(() => {
    setFile(null);
    setParsedData([]);
    setErrors([]);
    setUploadProgress(0);
  }, []);

  const downloadSampleCSV = useCallback(() => {
    // Create sample data with all required and optional fields
    const sample = sampleData || [{
      ...Object.fromEntries(requiredFields.map(field => [field, `Sample ${field}`])),
      ...Object.fromEntries(optionalFields.map(field => [field, `Sample ${field}`]))
    }];
    return sample;
  }, [sampleData, requiredFields, optionalFields]);

  return (
    <Modal isOpen={show} toggle={onCloseClick} centered={true} size="lg">
      <ModalHeader toggle={onCloseClick}>
        <div className="d-flex align-items-center">
          <RiFileExcel2Line className="me-2" />
          {title}
        </div>
      </ModalHeader>
      <ModalBody className="py-3 px-4">
        <div className="mb-4">
          <p className="text-muted mb-3">{description}</p>
          
          {/* Download Sample CSV */}
          <div className="d-flex align-items-center justify-content-between p-3 bg-light rounded mb-3">
            <div>
              <h6 className="mb-1">Download Sample CSV</h6>
              <small className="text-muted">
                Required fields: {requiredFields.join(', ')}
                {optionalFields.length > 0 && ` | Optional fields: ${optionalFields.join(', ')}`}
              </small>
            </div>
            <CSVLink
              data={downloadSampleCSV()}
              filename="sample_import.csv"
              className="btn btn-sm btn-outline-primary"
            >
              <RiDownload2Line className="me-1" />
              Download Sample
            </CSVLink>
          </div>

          {/* File Upload */}
          {!file ? (
            <div className="border-2 border-dashed border-secondary rounded p-4 text-center">
              <RiUpload2Line className="fs-1 text-muted mb-3" />
              <h5>Choose CSV File</h5>
              <p className="text-muted mb-3">
                Drag and drop your CSV file here, or click to browse
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="d-none"
                id="csv-file-input"
              />
              <label htmlFor="csv-file-input" className="btn btn-primary">
                Browse Files
              </label>
              <p className="text-muted mt-2 mb-0">
                Maximum file size: {maxFileSize}MB
              </p>
            </div>
          ) : (
            <div className="border rounded p-3">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <div className="d-flex align-items-center">
                  <RiFileExcel2Line className="text-success me-2" />
                  <div>
                    <h6 className="mb-0">{file.name}</h6>
                    <small className="text-muted">
                      {(file.size / 1024 / 1024).toFixed(2)} MB • {parsedData.length} records
                    </small>
                  </div>
                </div>
                <Button
                  color="light"
                  size="sm"
                  onClick={handleRemoveFile}
                  disabled={isLoading}
                >
                  <RiCloseLine />
                </Button>
              </div>

              {/* Validation Progress */}
              {isValidating && (
                <div className="mb-3">
                  <small className="text-muted">Validating data...</small>
                  <Progress value={50} className="mt-1" />
                </div>
              )}

              {/* Upload Progress */}
              {uploadProgress > 0 && (
                <div className="mb-3">
                  <small className="text-muted">Uploading...</small>
                  <Progress value={uploadProgress} className="mt-1" />
                </div>
              )}

              {/* Errors */}
              {errors.length > 0 && (
                <Alert color="danger" className="mb-3">
                  <h6 className="alert-heading">Validation Errors</h6>
                  <ul className="mb-0">
                    {errors.slice(0, 5).map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                    {errors.length > 5 && (
                      <li>... and {errors.length - 5} more errors</li>
                    )}
                  </ul>
                </Alert>
              )}

              {/* Preview Table */}
              {parsedData.length > 0 && errors.length === 0 && (
                <div className="mb-3">
                  <h6>Preview (First 3 rows)</h6>
                  <div className="table-responsive" style={{ maxHeight: '200px' }}>
                    <Table size="sm" className="mb-0">
                      <thead>
                        <tr>
                          {Object.keys(parsedData[0]).map((header, index) => (
                            <th key={index}>{header}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {parsedData.slice(0, 3).map((row, rowIndex) => (
                          <tr key={rowIndex}>
                            {Object.values(row).map((value, colIndex) => (
                              <td key={colIndex}>{value}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                  {parsedData.length > 3 && (
                    <small className="text-muted">
                      Showing first 3 of {parsedData.length} rows
                    </small>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="d-flex gap-2 justify-content-end">
          <Button
            color="light"
            onClick={onCloseClick}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            color="primary"
            onClick={handleImport}
            disabled={!file || parsedData.length === 0 || errors.length > 0 || isLoading}
          >
            {isLoading ? 'Importing...' : `Import ${parsedData.length} Records`}
          </Button>
        </div>
      </ModalBody>
    </Modal>
  );
};

ImportCSVModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onCloseClick: PropTypes.func.isRequired,
  onImport: PropTypes.func.isRequired,
  sampleData: PropTypes.array,
  requiredFields: PropTypes.arrayOf(PropTypes.string),
  optionalFields: PropTypes.arrayOf(PropTypes.string),
  maxFileSize: PropTypes.number,
  isLoading: PropTypes.bool,
  title: PropTypes.string,
  description: PropTypes.string
};

export default ImportCSVModal; 