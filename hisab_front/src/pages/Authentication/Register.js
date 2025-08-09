import React, { useState } from "react";
import { Row, Col, CardBody, Card, Container, Input, Label, Form, FormFeedback, Spinner } from "reactstrap";
import * as Yup from "yup";
import { useFormik } from "formik";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Link, useNavigate } from "react-router-dom";
import logoLight from "../../assets/images/logo-light.png";
import ParticlesAuth from "../AuthenticationInner/ParticlesAuth";
import { signup } from "../../services/auth";

const Register = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    const validation = useFormik({
        enableReinitialize: true,
        initialValues: {
            email: '',
            name: '',
            password: '',
            confirm_password: ''
        },
        validationSchema: Yup.object({
            email: Yup.string().email("Invalid email").required("Email is required"),
            name: Yup.string().required("Name is required"),
            password: Yup.string()
                .min(8, "Password must be at least 8 characters")
                .required("Password is required"),
            confirm_password: Yup.string()
                .oneOf([Yup.ref("password")], "Passwords must match")
                .required("Please confirm your password"),
        }),
        onSubmit: async (values) => {
            setLoading(true);
            try {
                const { token, user, message } = await signup({
                    email: values.email,
                    name: values.name,
                    password: values.password
                });

                // Store token and user data in session storage
                sessionStorage.setItem('authToken', token);
                sessionStorage.setItem('userData', JSON.stringify(user));

                toast.success(message || "Registration successful!");

                // Redirect to dashboard after 2 seconds
                setTimeout(() => {
                    navigate("/login");
                }, 2000);

            } catch (error) {
                toast.error(error.message || "Registration failed");
                console.error("Registration error:", error);
            } finally {
                setLoading(false);
            }
        }
    });

    document.title = "Sign Up | Vyavhar";

    return (
        <React.Fragment>
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
                                            <h5 className="text-primary">Create Vyavhar Account</h5>
                                            <p className="text-muted">Start managing your finances with ease</p>
                                        </div>
                                        <div className="p-2 mt-4">
                                            <Form
                                                onSubmit={(e) => {
                                                    e.preventDefault();
                                                    validation.handleSubmit();
                                                    return false;
                                                }}
                                                className="needs-validation">

                                                <ToastContainer autoClose={3000} />

                                                <div className="mb-3">
                                                    <Label htmlFor="email" className="form-label">Email <span className="text-danger">*</span></Label>
                                                    <Input
                                                        id="email"
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
                                                    <Label htmlFor="name" className="form-label">Full Name <span className="text-danger">*</span></Label>
                                                    <Input
                                                        name="name"
                                                        type="text"
                                                        placeholder="Enter your full name"
                                                        onChange={validation.handleChange}
                                                        onBlur={validation.handleBlur}
                                                        value={validation.values.name}
                                                        invalid={validation.touched.name && !!validation.errors.name}
                                                    />
                                                    <FormFeedback type="invalid">{validation.errors.name}</FormFeedback>
                                                </div>

                                                <div className="mb-3">
                                                    <Label htmlFor="password" className="form-label">Password <span className="text-danger">*</span></Label>
                                                    <Input
                                                        name="password"
                                                        type="password"
                                                        placeholder="Enter password (min 8 characters)"
                                                        onChange={validation.handleChange}
                                                        onBlur={validation.handleBlur}
                                                        value={validation.values.password}
                                                        invalid={validation.touched.password && !!validation.errors.password}
                                                    />
                                                    <FormFeedback type="invalid">{validation.errors.password}</FormFeedback>
                                                </div>

                                                <div className="mb-3">
                                                    <Label htmlFor="confirm_password" className="form-label">Confirm Password <span className="text-danger">*</span></Label>
                                                    <Input
                                                        name="confirm_password"
                                                        type="password"
                                                        placeholder="Confirm password"
                                                        onChange={validation.handleChange}
                                                        onBlur={validation.handleBlur}
                                                        value={validation.values.confirm_password}
                                                        invalid={validation.touched.confirm_password && !!validation.errors.confirm_password}
                                                    />
                                                    <FormFeedback type="invalid">{validation.errors.confirm_password}</FormFeedback>
                                                </div>

                                                <div className="mb-4">
                                                    <p className="mb-0 fs-12 text-muted fst-italic">By registering you agree to Vyavhar's
                                                        <Link to="/pages-terms-condition" className="text-primary text-decoration-underline fst-normal fw-medium"> Terms & Conditions</Link>
                                                    </p>
                                                </div>

                                                <div className="mt-4">
                                                    <button className="btn btn-primary w-100" type="submit" disabled={loading}>
                                                        {loading ? (
                                                            <>
                                                                <Spinner size="sm" className="me-2">Loading...</Spinner>
                                                                Creating Account...
                                                            </>
                                                        ) : (
                                                            "Create Account"
                                                        )}
                                                    </button>
                                                </div>

                                                <div className="mt-4 text-center">
                                                    <p className="mb-0">Already have an account?
                                                        <Link to="/login" className="fw-semibold text-primary text-decoration-underline"> Sign In</Link>
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

export default Register;