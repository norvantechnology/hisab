import React from "react";
import { Link } from "react-router-dom";
import { Card, CardBody, Col, Container, Row } from "reactstrap";
import BreadCrumb from "../../../Components/Common/BreadCrumb";
import FeatherIcon from 'feather-icons-react';

const TermsCondition = () => {
  document.title = "Terms & Conditions | Vyavhar - Financial Management Platform";
  return (
    <React.Fragment>
      <div className="page-content">
        <Container fluid>
          <BreadCrumb title="Terms & Conditions" pageTitle="Pages" />
          <Row className="justify-content-center">
            <Col className="col-lg-10">
              <Card>
                <div className="bg-warning-subtle position-relative">
                  <CardBody className="card-body p-5">
                    <div className="text-center">
                      <h3>Terms & Conditions</h3>
                      <p className="mb-0 text-muted">
                        Last update: {new Date().toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </p>
                    </div>
                  </CardBody>
                  <div className="shape">
                    <svg xmlns="http://www.w3.org/2000/svg" version="1.1" xmlnsXlink="http://www.w3.org/1999/xlink" width="1440" height="60" preserveAspectRatio="none" viewBox="0 0 1440 60">
                      <g mask="url(&quot;#SvgjsMask1001&quot;)" fill="none">
                        <path d="M 0,4 C 144,13 432,48 720,49 C 1008,50 1296,17 1440,9L1440 60L0 60z" style={{ fill: "var(--vz-secondary-bg)" }}></path>
                      </g>
                      <defs>
                        <mask id="SvgjsMask1001">
                          <rect width="1440" height="60" fill="#ffffff"></rect>
                        </mask>
                      </defs>
                    </svg>
                  </div>
                </div>
                <CardBody className="card-body p-4">
                  
                  <div className="d-flex">
                    <div className="flex-shrink-0 me-3">
                      <FeatherIcon icon="file-text" className={"text-success icon-dual-success icon-xs"} />
                    </div>
                    <div className="flex-grow-1">
                      <h5>Terms & Conditions for Vyavhar</h5>
                      <p className="text-muted">
                        These Terms and Conditions govern your use of Vyavhar, a comprehensive financial management platform designed for businesses to track income, expenses, sales, purchases, and bank transactions in one unified system.
                      </p>
                      <p className="text-muted">
                        By accessing and using Vyavhar, you accept and agree to be bound by the terms and provision of this agreement.
                      </p>
                    </div>
                  </div>

                  <div className="d-flex">
                    <div className="flex-shrink-0 me-3">
                      <FeatherIcon icon="user-check" className={"text-info icon-dual-info icon-xs"} />
                    </div>
                    <div className="flex-grow-1">
                      <h5>1. Acceptance of Terms</h5>
                      <p className="text-muted">
                        By accessing and using Vyavhar, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
                      </p>
                    </div>
                  </div>

                  <div className="d-flex">
                    <div className="flex-shrink-0 me-3">
                      <FeatherIcon icon="shield" className={"text-warning icon-dual-warning icon-xs"} />
                    </div>
                    <div className="flex-grow-1">
                      <h5>2. Use License</h5>
                      <p className="text-muted">
                        Permission is granted to temporarily download one copy of Vyavhar for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
                      </p>
                      <ul className="text-muted vstack gap-2">
                        <li>Modify or copy the materials</li>
                        <li>Use the materials for any commercial purpose or for any public display</li>
                        <li>Attempt to reverse engineer any software contained in Vyavhar</li>
                        <li>Remove any copyright or other proprietary notations from the materials</li>
                        <li>Transfer the materials to another person or "mirror" the materials on any other server</li>
                      </ul>
                    </div>
                  </div>

                  <div className="d-flex">
                    <div className="flex-shrink-0 me-3">
                      <FeatherIcon icon="alert-triangle" className={"text-danger icon-dual-danger icon-xs"} />
                    </div>
                    <div className="flex-grow-1">
                      <h5>3. Disclaimer</h5>
                      <p className="text-muted">
                        The materials within Vyavhar are provided on an 'as is' basis. Vyavhar makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.
                      </p>
                    </div>
                  </div>

                  <div className="d-flex">
                    <div className="flex-shrink-0 me-3">
                      <FeatherIcon icon="gavel" className={"text-primary icon-dual-primary icon-xs"} />
                    </div>
                    <div className="flex-grow-1">
                      <h5>4. Limitations</h5>
                      <p className="text-muted">
                        In no event shall Vyavhar or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use Vyavhar, even if Vyavhar or a Vyavhar authorized representative has been notified orally or in writing of the possibility of such damage.
                      </p>
                    </div>
                  </div>

                  <div className="d-flex">
                    <div className="flex-shrink-0 me-3">
                      <FeatherIcon icon="refresh-cw" className={"text-success icon-dual-success icon-xs"} />
                    </div>
                    <div className="flex-grow-1">
                      <h5>5. Revisions and Errata</h5>
                      <p className="text-muted">
                        The materials appearing in Vyavhar could include technical, typographical, or photographic errors. Vyavhar does not warrant that any of the materials on its platform are accurate, complete or current. Vyavhar may make changes to the materials contained on its platform at any time without notice.
                      </p>
                    </div>
                  </div>

                  <div className="d-flex">
                    <div className="flex-shrink-0 me-3">
                      <FeatherIcon icon="link" className={"text-info icon-dual-info icon-xs"} />
                    </div>
                    <div className="flex-grow-1">
                      <h5>6. Links</h5>
                      <p className="text-muted">
                        Vyavhar has not reviewed all of the sites linked to its platform and is not responsible for the contents of any such linked site. The inclusion of any link does not imply endorsement by Vyavhar of the site. Use of any such linked website is at the user's own risk.
                      </p>
                    </div>
                  </div>

                  <div className="d-flex">
                    <div className="flex-shrink-0 me-3">
                      <FeatherIcon icon="edit" className={"text-warning icon-dual-warning icon-xs"} />
                    </div>
                    <div className="flex-grow-1">
                      <h5>7. Modifications</h5>
                      <p className="text-muted">
                        Vyavhar may revise these terms of service for its platform at any time without notice. By using this platform, you are agreeing to be bound by the then current version of these Terms and Conditions of Service.
                      </p>
                    </div>
                  </div>

                  <div className="d-flex">
                    <div className="flex-shrink-0 me-3">
                      <FeatherIcon icon="map-pin" className={"text-danger icon-dual-danger icon-xs"} />
                    </div>
                    <div className="flex-grow-1">
                      <h5>8. Governing Law</h5>
                      <p className="text-muted">
                        These terms and conditions are governed by and construed in accordance with the laws and you irrevocably submit to the exclusive jurisdiction of the courts in that location.
                      </p>
                    </div>
                  </div>

                  <div className="d-flex">
                    <div className="flex-shrink-0 me-3">
                      <FeatherIcon icon="mail" className={"text-primary icon-dual-primary icon-xs"} />
                    </div>
                    <div className="flex-grow-1">
                      <h5>9. Contact Information</h5>
                      <p className="text-muted">
                        If you have any questions about these Terms & Conditions, please contact us:
                      </p>
                      <ul className="text-muted vstack gap-2">
                        <li><strong>Email:</strong> legal@vyavhar.com</li>
                        <li><strong>Support:</strong> support@vyavhar.com</li>
                        <li><strong>Address:</strong> [Your Company Address]</li>
                        <li><strong>Phone:</strong> [Your Contact Number]</li>
                      </ul>
                    </div>
                  </div>

                  <div className="text-end">
                    <Link to="/dashboard" className="btn btn-primary me-2">
                      <i className="ri-home-line me-1"></i>
                      Back to Dashboard
                    </Link>
                    <Link to="/pages-privacy-policy" className="btn btn-outline-secondary">
                      <i className="ri-shield-check-line me-1"></i>
                      Privacy Policy
                    </Link>
                  </div>
                </CardBody>
              </Card>
            </Col>
          </Row>
        </Container>
      </div>
    </React.Fragment>
  );
};

export default TermsCondition;
