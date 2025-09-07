import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardBody, CardTitle, Row, Col, Badge } from 'reactstrap';
import { RiUserLine, RiMapPinLine, RiFileTextLine } from 'react-icons/ri';
import { toast } from 'react-toastify';
import { getContactProfile } from '../../services/portal';

const PortalProfile = ({ contactData }) => {
  const [contact, setContact] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfileData = useCallback(async () => {
    if (!contactData?.id) return;

    setLoading(true);
    try {
      const response = await getContactProfile(contactData.id);
      
      if (response.success) {
        setContact(response.profile);
      } else {
        console.error('Failed to fetch profile:', response.message);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error('Failed to load profile information. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [contactData?.id]);

  // Fetch fresh data on mount
  useEffect(() => {
    if (contactData?.id) {
      fetchProfileData();
    }
  }, [contactData?.id, fetchProfileData]);

  const formatCurrency = useCallback((amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount || 0);
  }, []);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '300px'
      }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <p className="text-muted">Profile information not available</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
          Profile Information
        </h2>
        <p style={{ color: 'var(--vz-secondary-color)', fontSize: '0.875rem' }}>
          Your account details and contact information
        </p>
      </div>

      {/* Basic Information */}
      <Card style={{
        border: 'none',
        borderRadius: '10px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        marginBottom: '1.5rem'
      }}>
        <CardBody style={{ padding: '1.25rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '1.25rem'
          }}>
            <RiUserLine size={20} style={{ marginRight: '0.5rem', color: '#0d6efd' }} />
            <CardTitle tag="h5" style={{ margin: 0, fontWeight: 'bold' }}>
              Basic Information
            </CardTitle>
          </div>

          <Row>
            <Col md={6}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.5rem',
                background: 'var(--vz-light-bg-subtle)',
                borderRadius: '6px',
                marginBottom: '0.5rem'
              }}>
                <span style={{ color: 'var(--vz-secondary-color)' }}>Name:</span>
                <span style={{ fontWeight: 'bold' }}>{contact.name || 'N/A'}</span>
              </div>
            </Col>
            <Col md={6}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.5rem',
                background: 'var(--vz-light-bg-subtle)',
                borderRadius: '6px',
                marginBottom: '0.5rem'
              }}>
                <span style={{ color: 'var(--vz-secondary-color)' }}>Email:</span>
                <span style={{ fontWeight: 'bold' }}>{contact.email || 'N/A'}</span>
              </div>
            </Col>
            <Col md={6}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.5rem',
                background: 'var(--vz-light-bg-subtle)',
                borderRadius: '6px',
                marginBottom: '0.5rem'
              }}>
                <span style={{ color: 'var(--vz-secondary-color)' }}>Phone:</span>
                <span style={{ fontWeight: 'bold' }}>{contact.phone || 'N/A'}</span>
              </div>
            </Col>
            <Col md={6}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.5rem',
                background: 'var(--vz-light-bg-subtle)',
                borderRadius: '6px',
                marginBottom: '0.5rem'
              }}>
                <span style={{ color: 'var(--vz-secondary-color)' }}>Contact Type:</span>
                <Badge color={contact.type === 'customer' ? 'success' : 'primary'}>
                  {contact.type || 'N/A'}
                </Badge>
              </div>
            </Col>
          </Row>
        </CardBody>
      </Card>

      {/* Address Information */}
      <Card style={{
        border: 'none',
        borderRadius: '10px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        marginBottom: '1.5rem'
      }}>
        <CardBody style={{ padding: '1.25rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '1.25rem'
          }}>
            <RiMapPinLine size={20} style={{ marginRight: '0.5rem', color: '#0d6efd' }} />
            <CardTitle tag="h5" style={{ margin: 0, fontWeight: 'bold' }}>
              Address Information
            </CardTitle>
          </div>

          <Row>
            <Col md={6}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.5rem',
                background: 'var(--vz-light-bg-subtle)',
                borderRadius: '6px',
                marginBottom: '0.5rem'
              }}>
                <span style={{ color: 'var(--vz-secondary-color)' }}>Address:</span>
                <span style={{ fontWeight: 'bold', textAlign: 'right' }}>
                  {contact.address || 'N/A'}
                </span>
              </div>
            </Col>
            <Col md={6}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.5rem',
                background: 'var(--vz-light-bg-subtle)',
                borderRadius: '6px',
                marginBottom: '0.5rem'
              }}>
                <span style={{ color: 'var(--vz-secondary-color)' }}>City:</span>
                <span style={{ fontWeight: 'bold' }}>{contact.city || 'N/A'}</span>
              </div>
            </Col>
            <Col md={6}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.5rem',
                background: 'var(--vz-light-bg-subtle)',
                borderRadius: '6px',
                marginBottom: '0.5rem'
              }}>
                <span style={{ color: 'var(--vz-secondary-color)' }}>State:</span>
                <span style={{ fontWeight: 'bold' }}>{contact.state || 'N/A'}</span>
              </div>
            </Col>
            <Col md={6}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.5rem',
                background: 'var(--vz-light-bg-subtle)',
                borderRadius: '6px',
                marginBottom: '0.5rem'
              }}>
                <span style={{ color: 'var(--vz-secondary-color)' }}>Pincode:</span>
                <span style={{ fontWeight: 'bold' }}>{contact.pincode || 'N/A'}</span>
              </div>
            </Col>
          </Row>
        </CardBody>
      </Card>

      {/* Financial Information */}
      <Card style={{
        border: 'none',
        borderRadius: '10px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <CardBody style={{ padding: '1.25rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '1.25rem'
          }}>
            <RiFileTextLine size={20} style={{ marginRight: '0.5rem', color: '#0d6efd' }} />
            <CardTitle tag="h5" style={{ margin: 0, fontWeight: 'bold' }}>
              Financial Information
            </CardTitle>
          </div>

          <Row>
            <Col md={6}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.5rem',
                background: 'var(--vz-light-bg-subtle)',
                borderRadius: '6px',
                marginBottom: '0.5rem'
              }}>
                <span style={{ color: 'var(--vz-secondary-color)' }}>Opening Balance:</span>
                <span style={{ fontWeight: 'bold' }}>
                  {formatCurrency(contact.openingBalance || 0)}
                </span>
              </div>
            </Col>
            <Col md={6}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.5rem',
                background: 'var(--vz-light-bg-subtle)',
                borderRadius: '6px',
                marginBottom: '0.5rem'
              }}>
                <span style={{ color: 'var(--vz-secondary-color)' }}>Opening Balance Type:</span>
                <Badge color={contact.openingBalanceType === 'receivable' ? 'success' : 'danger'}>
                  {contact.openingBalanceType === 'receivable' ? 'Credit' : 
                   contact.openingBalanceType === 'payable' ? 'Debit' : 
                   contact.openingBalanceType || 'N/A'}
                </Badge>
              </div>
            </Col>
            <Col md={6}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.5rem',
                background: 'var(--vz-light-bg-subtle)',
                borderRadius: '6px',
                marginBottom: '0.5rem'
              }}>
                <span style={{ color: 'var(--vz-secondary-color)' }}>Current Balance:</span>
                <span style={{ 
                  fontWeight: 'bold',
                  color: contact.currentBalanceType === 'receivable' ? '#28a745' : '#dc3545'
                }}>
                  {formatCurrency(contact.currentBalance || 0)}
                </span>
              </div>
            </Col>
            <Col md={6}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.5rem',
                background: 'var(--vz-light-bg-subtle)',
                borderRadius: '6px',
                marginBottom: '0.5rem'
              }}>
                <span style={{ color: 'var(--vz-secondary-color)' }}>Balance Type:</span>
                <Badge color={contact.currentBalanceType === 'receivable' ? 'success' : 'danger'}>
                  {contact.currentBalanceType === 'receivable' ? 'Credit' : 
                   contact.currentBalanceType === 'payable' ? 'Debit' : 
                   contact.currentBalanceType || 'N/A'}
                </Badge>
              </div>
            </Col>
          </Row>
        </CardBody>
      </Card>
    </div>
  );
};

export default PortalProfile; 