import React, { useState } from 'react';
import { Card, CardBody, Col, Container, Input, Label, Row, Button, Form, FormFeedback, Spinner } from 'reactstrap';
import { Link, useNavigate } from "react-router-dom";
import * as Yup from "yup";
import { useFormik } from "formik";
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import ParticlesAuth from "../AuthenticationInner/ParticlesAuth";
import { login } from "../../services/auth";
import logoLight from "../../assets/images/logo-light.png";

const Login = () => {
    const navigate = useNavigate();
    const [passwordShow, setPasswordShow] = useState(false);
    const [loading, setLoading] = useState(false);

    const validation = useFormik({
        initialValues: {
            email: '',
            password: ''
        },
        validationSchema: Yup.object({
            email: Yup.string().email("Invalid email").required("Email is required"),
            password: Yup.string().required("Password is required"),
        }),
        onSubmit: async (values) => {
            setLoading(true);
            try {
                const { token, user, message } = await login(values);
                // Store token and user data in session storage
                sessionStorage.setItem('authToken', token);
                sessionStorage.setItem('userData', JSON.stringify(user));

                // Show success message from API
                toast.success(message || "Login successful!");

                // Redirect to bank accounts
                navigate('/bank-accounts');

            } catch (error) {
                console.log("error>>", error)
                // Show error message from API response or default message
                const errorMessage = error.message || "Login failed";
                toast.error(errorMessage);
            } finally {
                setLoading(false);
            }
        }
    });

    document.title = "Login | ProfitPe";

    return (
        <React.Fragment>
            <ToastContainer closeButton={false} position="top-right" />
            <ParticlesAuth>
                <div className="auth-page-content">
                    <Container>
                        <Row>
                            <Col lg={12}>
                                <div className="text-center mt-sm-5 mb-4 text-white-50">
                                    <div>
                                        <Link to="/" className="d-inline-block auth-logo">
                                            <img src={logoLight} alt="ProfitPe" height="30" />
                                        </Link>
                                    </div>
                                    <p className="mt-3 fs-15 fw-medium">Smart Trading Analytics Platform</p>
                                </div>
                            </Col>
                        </Row>

                        <Row className="justify-content-center">
                            <Col md={8} lg={6} xl={5}>
                                <Card className="mt-4">
                                    <CardBody className="p-4">
                                        <div className="text-center mt-2">
                                            <h5 className="text-primary">Welcome to ProfitPe</h5>
                                            <p className="text-muted">Sign in to access your dashboard</p>
                                        </div>
                                        <div className="p-2 mt-4">
                                            <Form onSubmit={validation.handleSubmit}>
                                                <div className="mb-3">
                                                    <Label htmlFor="email" className="form-label">Email</Label>
                                                    <Input
                                                        name="email"
                                                        className="form-control"
                                                        placeholder="Enter email"
                                                        type="email"
                                                        onChange={validation.handleChange}
                                                        onBlur={validation.handleBlur}
                                                        value={validation.values.email}
                                                        invalid={validation.touched.email && !!validation.errors.email}
                                                    />
                                                    <FormFeedback type="invalid">{validation.errors.email}</FormFeedback>
                                                </div>

                                                <div className="mb-3">
                                                    <div className="float-end">
                                                        <Link to="/forgot-password" className="text-muted">Forgot password?</Link>
                                                    </div>
                                                    <Label className="form-label" htmlFor="password-input">Password</Label>
                                                    <div className="position-relative auth-pass-inputgroup mb-3">
                                                        <Input
                                                            name="password"
                                                            value={validation.values.password}
                                                            type={passwordShow ? "text" : "password"}
                                                            className="form-control pe-5"
                                                            placeholder="Enter Password"
                                                            onChange={validation.handleChange}
                                                            onBlur={validation.handleBlur}
                                                            invalid={validation.touched.password && !!validation.errors.password}
                                                        />
                                                        <FormFeedback type="invalid">{validation.errors.password}</FormFeedback>
                                                        <button
                                                            className="btn btn-link position-absolute end-0 top-0 text-decoration-none text-muted"
                                                            type="button"
                                                            onClick={() => setPasswordShow(!passwordShow)}
                                                        >
                                                            <i className="ri-eye-fill align-middle"></i>
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="form-check">
                                                    <Input className="form-check-input" type="checkbox" id="auth-remember-check" />
                                                    <Label className="form-check-label" htmlFor="auth-remember-check">Remember me</Label>
                                                </div>

                                                <div className="mt-4">
                                                    <Button color="primary" disabled={loading} className="w-100" type="submit">
                                                        {loading ? (
                                                            <Spinner size="sm" className="me-2">Loading...</Spinner>
                                                        ) : null}
                                                        Sign In
                                                    </Button>
                                                </div>

                                                <div className="mt-4 text-center">
                                                    <p className="mb-0">Don't have an account?
                                                        <Link to="/register" className="fw-semibold text-primary text-decoration-underline"> Sign Up</Link>
                                                    </p>
                                                </div>
                                            </Form>
                                        </div>
                                    </CardBody>
                                </Card>
                            </Col>
                        </Row>
                    </Container>
                </div>
            </ParticlesAuth>
        </React.Fragment>
    );
};

export default Login;