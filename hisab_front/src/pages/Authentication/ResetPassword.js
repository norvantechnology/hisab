import PropTypes from "prop-types";
import React, { useState, useEffect } from "react";
import { Row, Col, Alert, Card, CardBody, Container, FormFeedback, Input, Label, Form, Button } from "reactstrap";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import withRouter from "../../Components/Common/withRouter";

// Formik Validation
import * as Yup from "yup";
import { useFormik } from "formik";

// import images
import logoLight from "../../assets/images/logo-light.png";
import ParticlesAuth from "../AuthenticationInner/ParticlesAuth";

// API call
import { apiCall } from "../../utils/apiCall";

const ResetPasswordPage = props => {
  document.title = "Reset Password | Vyavhar - Financial Management Platform";

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [token, setToken] = useState(null);

  useEffect(() => {
    const tokenFromUrl = searchParams.get('token');
    if (tokenFromUrl) {
      setToken(tokenFromUrl);
    } else {
      setError("Invalid reset link. Please request a new password reset.");
    }
  }, [searchParams]);

  const validation = useFormik({
    enableReinitialize: true,
    initialValues: {
      newPassword: '',
      confirmPassword: '',
    },
    validationSchema: Yup.object({
      newPassword: Yup.string()
        .min(8, "Password must be at least 8 characters")
        .required("Please enter your new password"),
      confirmPassword: Yup.string()
        .oneOf([Yup.ref('newPassword'), null], 'Passwords must match')
        .required("Please confirm your password"),
    }),
    onSubmit: async (values) => {
      if (!token) {
        setError("Invalid reset token. Please request a new password reset.");
        return;
      }

      setLoading(true);
      setError(null);
      setMessage(null);

      try {
        const response = await apiCall({
          method: 'post',
          endpoint: '/auth/reset-password',
          data: {
            token: token,
            newPassword: values.newPassword
          }
        });

        if (response.success) {
          setMessage("Password reset successfully! You can now login with your new password.");
          setTimeout(() => {
            navigate('/login');
          }, 3000);
        } else {
          setError(response.message || "Failed to reset password. Please try again.");
        }
      } catch (err) {
        console.error("Reset password error:", err);
        setError("An error occurred while resetting your password. Please try again.");
      } finally {
        setLoading(false);
      }
    }
  });

  if (!token && !error) {
    return (
      <ParticlesAuth>
        <div className="auth-page-content">
          <Container>
            <Row>
              <Col lg={12}>
                <div className="text-center mt-sm-5 mb-4 text-white-50">
                  <div>
                    <Link to="/" className="d-inline-block auth-logo">
                      <img
                        src={logoLight}
                        alt="Vyavhar"
                        style={{
                          height: '60px',
                          width: 'auto',
                          filter: 'brightness(0) invert(1)',
                          maxWidth: '200px',
                          objectFit: 'contain'
                        }}
                      />
                    </Link>
                  </div>
                  <p className="mt-3 fs-15 fw-medium">Smart Financial Management Platform</p>
                </div>
              </Col>
            </Row>

            <Row className="justify-content-center">
              <Col md={8} lg={6} xl={5}>
                <Card className="mt-4">
                  <CardBody className="p-4">
                    <div className="text-center mt-2">
                      <h5 className="text-primary">Loading...</h5>
                      <p className="text-muted">Please wait while we validate your reset link.</p>
                    </div>
                  </CardBody>
                </Card>
              </Col>
            </Row>
          </Container>
        </div>
      </ParticlesAuth>
    );
  }

  return (
    <ParticlesAuth>
      <div className="auth-page-content">
        <Container>
          <Row>
            <Col lg={12}>
              <div className="text-center mt-sm-5 mb-4 text-white-50">
                <div>
                  <Link to="/" className="d-inline-block auth-logo">
                    <img
                      src={logoLight}
                      alt="Vyavhar"
                      style={{
                        height: '60px',
                        width: 'auto',
                        filter: 'brightness(0) invert(1)',
                        maxWidth: '200px',
                        objectFit: 'contain'
                      }}
                    />
                  </Link>
                </div>
                <p className="mt-3 fs-15 fw-medium">Smart Financial Management Platform</p>
              </div>
            </Col>
          </Row>

          <Row className="justify-content-center">
            <Col md={8} lg={6} xl={5}>
              <Card className="mt-4">
                <CardBody className="p-4">
                  <div className="text-center mt-2">
                    <h5 className="text-primary">Reset Password</h5>
                    <p className="text-muted">Enter your new password below</p>
                  </div>
                  <div className="p-2 mt-4">
                    {message && (
                      <Alert color="success" className="text-center mb-4">
                        {message}
                      </Alert>
                    )}
                    {error && (
                      <Alert color="danger" className="text-center mb-4">
                        {error}
                      </Alert>
                    )}
                    
                    {!error && (
                      <Form
                        onSubmit={(e) => {
                          e.preventDefault();
                          validation.handleSubmit();
                          return false;
                        }}
                      >
                        <div className="mb-3">
                          <Label htmlFor="newPassword" className="form-label">New Password</Label>
                          <Input
                            name="newPassword"
                            className="form-control"
                            placeholder="Enter new password"
                            type="password"
                            onChange={validation.handleChange}
                            onBlur={validation.handleBlur}
                            value={validation.values.newPassword || ""}
                            invalid={
                              validation.touched.newPassword && validation.errors.newPassword ? true : false
                            }
                          />
                          {validation.touched.newPassword && validation.errors.newPassword ? (
                            <FormFeedback type="invalid">{validation.errors.newPassword}</FormFeedback>
                          ) : null}
                        </div>

                        <div className="mb-3">
                          <Label htmlFor="confirmPassword" className="form-label">Confirm Password</Label>
                          <Input
                            name="confirmPassword"
                            className="form-control"
                            placeholder="Confirm new password"
                            type="password"
                            onChange={validation.handleChange}
                            onBlur={validation.handleBlur}
                            value={validation.values.confirmPassword || ""}
                            invalid={
                              validation.touched.confirmPassword && validation.errors.confirmPassword ? true : false
                            }
                          />
                          {validation.touched.confirmPassword && validation.errors.confirmPassword ? (
                            <FormFeedback type="invalid">{validation.errors.confirmPassword}</FormFeedback>
                          ) : null}
                        </div>

                        <div className="mt-4">
                          <Button 
                            color="primary" 
                            className="btn btn-primary w-100" 
                            type="submit"
                            disabled={loading}
                          >
                            {loading ? "Resetting Password..." : "Reset Password"}
                          </Button>
                        </div>
                      </Form>
                    )}

                    <div className="mt-4 text-center">
                      <p className="mb-0">
                        Remember your password? <Link to="/login" className="fw-medium text-primary text-decoration-underline">Login</Link>
                      </p>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </Col>
          </Row>
        </Container>
      </div>
    </ParticlesAuth>
  );
};

ResetPasswordPage.propTypes = {
  history: PropTypes.object,
};

export default withRouter(ResetPasswordPage); 