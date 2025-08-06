import React from "react";
import { Link } from "react-router-dom";
import { Card, CardBody, Col, Container, Row } from "reactstrap";
import BreadCrumb from "../../../Components/Common/BreadCrumb";
import FeatherIcon from 'feather-icons-react';

const PrivacyPolicy = () => {
  document.title = "Privacy Policy | Vyavhar - Financial Management Platform";
  return (
    <React.Fragment>
      <div className="page-content">
        <Container fluid>
          <BreadCrumb title="Privacy Policy" pageTitle="Pages" />
          <Row className="justify-content-center">
            <Col className="col-lg-10">
              <Card>
                <div className="bg-warning-subtle position-relative">
                  <CardBody className="card-body p-5">
                    <div className="text-center">
                      <h3>Privacy Policy</h3>
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
                      <FeatherIcon icon="shield" className={"text-success icon-dual-success icon-xs"} />
                    </div>
                    <div className="flex-grow-1">
                      <h5>Privacy Policy for Vyavhar</h5>
                      <p className="text-muted">
                        At Vyavhar, accessible at our platform, one of our main priorities is the privacy and security of our users' financial data. This Privacy Policy document contains types of information that is collected and recorded by Vyavhar and how we use it to provide our financial management services.
                      </p>
                      <p className="text-muted">
                        If you have additional questions or require more information about our Privacy Policy, do not hesitate to contact us through email at privacy@vyavhar.com
                      </p>
                      <p className="text-muted">
                        This privacy policy applies only to our online activities and is valid for visitors to our platform with regards to the information that they shared and/or collect in Vyavhar. This policy is not applicable to any information collected offline or via channels other than this platform.
                      </p>
                    </div>
                  </div>

                  <div className="d-flex">
                    <div className="flex-shrink-0 me-3">
                      <FeatherIcon icon="database" className={"text-info icon-dual-info icon-xs"} />
                    </div>
                    <div className="flex-grow-1">
                      <h5>Information We Collect</h5>
                      <p className="text-muted">
                        As a financial management platform, we collect various types of information to provide our services effectively:
                      </p>
                      <ul className="text-muted vstack gap-2">
                        <li><strong>Account Information:</strong> Name, email address, phone number, company details, and account credentials</li>
                        <li><strong>Financial Data:</strong> Bank account details, transaction records, income and expense data, sales and purchase information</li>
                        <li><strong>Business Information:</strong> Company details, GST numbers, billing addresses, contact information</li>
                        <li><strong>Usage Data:</strong> How you interact with our platform, features used, and performance metrics</li>
                        <li><strong>Technical Information:</strong> IP address, browser type, device information, and cookies</li>
                      </ul>
                    </div>
                  </div>

                  <div className="d-flex">
                    <div className="flex-shrink-0 me-3">
                      <FeatherIcon icon="settings" className={"text-warning icon-dual-warning icon-xs"} />
                    </div>
                    <div className="flex-grow-1">
                      <h5>How We Use Your Information</h5>
                      <p className="text-muted">
                        We use the information we collect in various ways, including to:
                      </p>
                      <ul className="text-muted vstack gap-2">
                        <li>Provide, operate, and maintain our financial management platform</li>
                        <li>Process and manage your financial transactions and records</li>
                        <li>Generate reports, invoices, and financial statements</li>
                        <li>Improve, personalize, and expand our platform features</li>
                        <li>Understand and analyze how you use our platform</li>
                        <li>Develop new products, services, features, and functionality</li>
                        <li>Send you important updates, security alerts, and support messages</li>
                        <li>Find and prevent fraud, abuse, and security threats</li>
                        <li>Comply with legal and regulatory requirements</li>
                      </ul>
                    </div>
                  </div>

                  <div className="d-flex">
                    <div className="flex-shrink-0 me-3">
                      <FeatherIcon icon="lock" className={"text-danger icon-dual-danger icon-xs"} />
                    </div>
                    <div className="flex-grow-1">
                      <h5>Data Security and Protection</h5>
                      <p className="text-muted">
                        We implement industry-standard security measures to protect your financial data:
                      </p>
                      <ul className="text-muted vstack gap-2">
                        <li><strong>Encryption:</strong> All data is encrypted in transit and at rest using AES-256 encryption</li>
                        <li><strong>Access Controls:</strong> Multi-factor authentication and role-based access controls</li>
                        <li><strong>Regular Audits:</strong> Security assessments and penetration testing</li>
                        <li><strong>Data Backup:</strong> Regular backups with disaster recovery procedures</li>
                        <li><strong>Employee Training:</strong> Regular security awareness training for our team</li>
                      </ul>
                    </div>
                  </div>

                  <div className="d-flex">
                    <div className="flex-shrink-0 me-3">
                      <FeatherIcon icon="share-2" className={"text-primary icon-dual-primary icon-xs"} />
                    </div>
                    <div className="flex-grow-1">
                      <h5>Data Sharing and Third Parties</h5>
                      <p className="text-muted">
                        We do not sell, trade, or rent your personal information to third parties. We may share your information only in the following circumstances:
                      </p>
                      <ul className="text-muted vstack gap-2">
                        <li><strong>Service Providers:</strong> With trusted third-party service providers who assist in operating our platform (payment processors, cloud hosting, etc.)</li>
                        <li><strong>Legal Requirements:</strong> When required by law, court order, or government request</li>
                        <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
                        <li><strong>Consent:</strong> With your explicit consent for specific purposes</li>
                      </ul>
                    </div>
                  </div>

                  <div className="d-flex">
                    <div className="flex-shrink-0 me-3">
                      <FeatherIcon icon="globe" className={"text-success icon-dual-success icon-xs"} />
                    </div>
                    <div className="flex-grow-1">
                      <h5>Cookies and Tracking Technologies</h5>
                      <p className="text-muted">
                        Vyavhar uses cookies and similar tracking technologies to enhance your experience:
                      </p>
                      <ul className="text-muted vstack gap-2">
                        <li><strong>Essential Cookies:</strong> Required for platform functionality and security</li>
                        <li><strong>Analytics Cookies:</strong> Help us understand how you use our platform</li>
                        <li><strong>Preference Cookies:</strong> Remember your settings and preferences</li>
                        <li><strong>Session Management:</strong> Maintain your login session and security</li>
                      </ul>
                      <p className="text-muted">
                        You can control cookie settings through your browser preferences, though disabling certain cookies may affect platform functionality.
                      </p>
                    </div>
                  </div>

                  <div className="d-flex">
                    <div className="flex-shrink-0 me-3">
                      <FeatherIcon icon="calendar" className={"text-info icon-dual-info icon-xs"} />
                    </div>
                    <div className="flex-grow-1">
                      <h5>Data Retention</h5>
                      <p className="text-muted">
                        We retain your data for as long as necessary to provide our services and comply with legal obligations:
                      </p>
                      <ul className="text-muted vstack gap-2">
                        <li><strong>Active Accounts:</strong> Data is retained while your account is active</li>
                        <li><strong>Inactive Accounts:</strong> Data may be archived after 2 years of inactivity</li>
                        <li><strong>Legal Requirements:</strong> Financial records may be retained for up to 7 years as required by law</li>
                        <li><strong>Deletion Requests:</strong> You can request data deletion, subject to legal requirements</li>
                      </ul>
                    </div>
                  </div>

                  <div className="d-flex">
                    <div className="flex-shrink-0 me-3">
                      <FeatherIcon icon="user-check" className={"text-warning icon-dual-warning icon-xs"} />
                    </div>
                    <div className="flex-grow-1">
                      <h5>Your Rights and Choices</h5>
                      <p className="text-muted">
                        You have the following rights regarding your personal information:
                      </p>
                      <ul className="text-muted vstack gap-2">
                        <li><strong>Access:</strong> Request a copy of your personal data</li>
                        <li><strong>Correction:</strong> Update or correct inaccurate information</li>
                        <li><strong>Deletion:</strong> Request deletion of your data (subject to legal requirements)</li>
                        <li><strong>Portability:</strong> Request your data in a machine-readable format</li>
                        <li><strong>Objection:</strong> Object to certain processing activities</li>
                        <li><strong>Withdrawal:</strong> Withdraw consent where processing is based on consent</li>
                      </ul>
                    </div>
                  </div>

                  <div className="d-flex">
                    <div className="flex-shrink-0 me-3">
                      <FeatherIcon icon="users" className={"text-primary icon-dual-primary icon-xs"} />
                    </div>
                    <div className="flex-grow-1">
                      <h5>Children's Privacy</h5>
                      <p className="text-muted">
                        Vyavhar does not knowingly collect personal information from children under 13 years of age. Our platform is designed for business use and is not intended for children. If we become aware that we have collected personal information from a child under 13, we will take steps to delete such information promptly.
                      </p>
                    </div>
                  </div>

                  <div className="d-flex">
                    <div className="flex-shrink-0 me-3">
                      <FeatherIcon icon="mail" className={"text-success icon-dual-success icon-xs"} />
                    </div>
                    <div className="flex-grow-1">
                      <h5>Contact Information</h5>
                      <p className="text-muted">
                        If you have any questions about this Privacy Policy or our data practices, please contact us:
                      </p>
                      <ul className="text-muted vstack gap-2">
                        <li><strong>Email:</strong> privacy@vyavhar.com</li>
                        <li><strong>Support:</strong> support@vyavhar.com</li>
                        <li><strong>Address:</strong> [Your Company Address]</li>
                        <li><strong>Phone:</strong> [Your Contact Number]</li>
                      </ul>
                    </div>
                  </div>

                  <div className="d-flex">
                    <div className="flex-shrink-0 me-3">
                      <FeatherIcon icon="refresh-cw" className={"text-info icon-dual-info icon-xs"} />
                    </div>
                    <div className="flex-grow-1">
                      <h5>Changes to This Privacy Policy</h5>
                      <p className="text-muted">
                        We may update this Privacy Policy from time to time to reflect changes in our practices or for other operational, legal, or regulatory reasons. We will notify you of any material changes by:
                      </p>
                      <ul className="text-muted vstack gap-2">
                        <li>Posting the updated policy on our platform</li>
                        <li>Sending you an email notification</li>
                        <li>Displaying a notice on our platform</li>
                      </ul>
                      <p className="text-muted">
                        Your continued use of our platform after any changes indicates your acceptance of the updated Privacy Policy.
                      </p>
                    </div>
                  </div>

                  <div className="text-end">
                    <Link to="/dashboard" className="btn btn-primary me-2">
                      <i className="ri-home-line me-1"></i>
                      Back to Dashboard
                    </Link>
                    <Link to="/pages-terms-condition" className="btn btn-outline-secondary">
                      <i className="ri-file-text-line me-1"></i>
                      Terms & Conditions
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

export default PrivacyPolicy;
