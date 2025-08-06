import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, CardBody, Form, FormGroup, Label, Input, Button, Alert, InputGroup, InputGroupText } from 'reactstrap';
import { RiUserLine, RiLockLine, RiEyeLine, RiEyeOffLine, RiShieldCheckLine, RiMailLine } from 'react-icons/ri';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { portalLogin } from '../../services/portal';

const PortalLogin = () => {
  const [formData, setFormData] = useState({
    token: ''
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if token is in URL params
    const token = searchParams.get('token');
    if (token) {
      setFormData(prev => ({ ...prev, token }));
    }
  }, [searchParams]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.token.trim()) {
      toast.error('Please enter your access token');
      return;
    }

    setLoading(true);

    try {
      const response = await portalLogin({ token: formData.token });

      if (response.success) {
        // Store portal token and contact data
        localStorage.setItem('portalToken', response.token);
        localStorage.setItem('portalContact', JSON.stringify(response.contact));
        
        toast.success('Login successful! Welcome to your portal.');
        navigate('/portal');
      } else {
        // Handle API error response
        const errorMessage = response.message || response.error || 'Login failed';
        toast.error(errorMessage);
        console.error('Portal login failed:', response);
      }
    } catch (error) {
      console.error('Portal login error:', error);
      
      // Handle different types of errors
      let errorMessage = 'Network error. Please try again.';
      
      if (error.data && error.data.message) {
        // API returned error with message
        errorMessage = error.data.message;
      } else if (error.message) {
        // Network or other error
        errorMessage = error.message;
      } else if (error.status === 401) {
        errorMessage = 'Invalid access token. Please check your token and try again.';
      } else if (error.status === 404) {
        errorMessage = 'Portal access not found. Please contact your account manager.';
      } else if (error.status === 500) {
        errorMessage = 'Server error. Please try again later.';
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* Toast Container for notifications */}
      <ToastContainer 
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />

      <div className="auth-page-content">
        <Container>
          <Row className="justify-content-center">
            <Col md={8} lg={6} xl={5}>
              <div className="text-center mb-4">
                <div className="auth-logo">
                  <div className="avatar-lg mx-auto mb-3">
                    <div className="avatar-title bg-primary text-white rounded-circle">
                      <RiShieldCheckLine size={32} />
                    </div>
                  </div>
                  <h2 className="text-white mb-1">Customer Portal</h2>
                  <p className="text-white-50">Access your account information and transactions</p>
                </div>
              </div>

              <Card className="border-0 shadow-lg">
                <CardBody className="p-4">
                  <div className="text-center mb-4">
                    <h4 className="text-dark mb-1">Welcome Back!</h4>
                    <p className="text-muted">Enter your access token to continue</p>
                  </div>

                  <Form onSubmit={handleSubmit}>
                    <FormGroup className="mb-3">
                      <Label for="token" className="form-label">
                        Access Token
                      </Label>
                      <InputGroup>
                        <InputGroupText>
                          <RiLockLine />
                        </InputGroupText>
                        <Input
                          id="token"
                          name="token"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Enter your access token"
                          value={formData.token}
                          onChange={handleInputChange}
                          className="form-control"
                          required
                        />
                        <Button
                          type="button"
                          color="light"
                          outline
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <RiEyeOffLine /> : <RiEyeLine />}
                        </Button>
                      </InputGroup>
                      <div className="form-text">
                        <small className="text-muted">
                          Your access token was provided by your account manager
                        </small>
                      </div>
                    </FormGroup>

                    <div className="d-grid">
                      <Button
                        type="submit"
                        color="primary"
                        size="lg"
                        disabled={loading}
                        className="btn-block"
                      >
                        {loading ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                            Signing In...
                          </>
                        ) : (
                          <>
                            <RiShieldCheckLine className="me-2" />
                            Sign In
                          </>
                        )}
                      </Button>
                    </div>
                  </Form>

                  <div className="mt-4 text-center">
                    <div className="alert alert-info" role="alert">
                      <div className="d-flex align-items-center">
                        <RiMailLine className="me-2" />
                        <div>
                          <strong>Need Access?</strong>
                          <br />
                          <small>Contact your account manager to get your access token</small>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>

              <div className="text-center mt-4">
                <p className="text-white-50 mb-0">
                  © 2024 Vyavhar. All rights reserved.
                </p>
              </div>
            </Col>
          </Row>
        </Container>
      </div>
    </div>
  );
};

export default PortalLogin; 