import React, { useEffect, useState } from 'react';
import { Container, Row, Col, Card, CardBody } from 'reactstrap';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import Lottie from 'lottie-react';
import successAnimation from '../../assets/animations/success.json';
import errorAnimation from '../../assets/animations/error.json';
import loadingAnimation from '../../assets/animations/loading.json';
import ParticlesAuth from '../AuthenticationInner/ParticlesAuth';
import { verifyEmail } from '../../services/auth';
import logoLight from '../../assets/images/logo-light.png';

const VerifyEmail = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState('verifying');
    const [message, setMessage] = useState('Verifying your email...');

    useEffect(() => {
        const token = searchParams.get('token');

        if (!token) {
            setStatus('error');
            setMessage('Invalid verification link');
            return;
        }

        const verifyToken = async () => {
            try {
                const response = await verifyEmail(token);
                setStatus('success');
                setMessage(response.message || 'Email verified successfully!');

                if (response.user) {
                    sessionStorage.setItem('userData', JSON.stringify(response.user));
                }

                setTimeout(() => {
                    navigate('/bank-accounts');
                }, 3000);
            } catch (error) {
                setStatus('error');
                setMessage(error.message || 'Email verification failed');
            }
        };

        verifyToken();
    }, [searchParams, navigate]);

    const getAnimation = () => {
        switch (status) {
            case 'success':
                return successAnimation;
            case 'error':
                return errorAnimation;
            default:
                return loadingAnimation;
        }
    };

    return (
        <React.Fragment>
            <ParticlesAuth>
                <div className="auth-page-content">
                    <Container>
                        <Row className="justify-content-center">
                            <Col md={8} lg={6} xl={5}>
                                <div className="text-center mt-sm-5 mb-4 text-white-50">
                                    <div className="mb-3">
                                        <Link to="/" className="d-inline-block auth-logo">
                                            <img src={logoLight} alt="Vyavhar" height="30" />
                                        </Link>
                                    </div>
                                    <p className="mt-1 fs-14 fw-medium">Smart Trading Analytics Platform</p>
                                </div>
                            </Col>
                        </Row>

                        <Row className="justify-content-center">
                            <Col md={8} lg={6} xl={5}>
                                <Card className="mt-2">
                                    <CardBody className="p-4">
                                        <div className="text-center">
                                            {/* Animation Container - Smaller and better positioned */}
                                            <div style={{ 
                                                height: '200px', 
                                                width: '200px',
                                                margin: '0 auto 20px'
                                            }}>
                                                <Lottie
                                                    animationData={getAnimation()}
                                                    loop={status === 'verifying'}
                                                    autoplay
                                                />
                                            </div>

                                            <h4 className={`mb-3 text-${status === 'success' ? 'success' : status === 'error' ? 'danger' : 'primary'}`}>
                                                {message}
                                            </h4>

                                            {status === 'success' && (
                                                <p className="text-muted">
                                                    Redirecting to bank accounts...
                                                </p>
                                            )}

                                            {status === 'error' && (
                                                <button
                                                    className="btn btn-primary btn-sm mt-2"
                                                    onClick={() => navigate('/login')}
                                                >
                                                    Go to Login
                                                </button>
                                            )}
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

export default VerifyEmail;