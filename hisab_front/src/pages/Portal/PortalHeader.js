import React from 'react';
import { Navbar, NavbarBrand, Nav, NavItem, Dropdown, DropdownToggle, DropdownMenu, DropdownItem, Button, Container } from 'reactstrap';
import { RiShieldLine, RiUserLine, RiMenuLine, RiCloseLine, RiLogoutBoxRLine, RiShieldCheckLine, RiFileTextLine } from 'react-icons/ri';
import { Link } from 'react-router-dom';

const PortalHeader = ({ contactData, mobileMenuToggle, mobileMenuOpen }) => {
  const handleLogout = () => {
    localStorage.removeItem('portalToken');
    localStorage.removeItem('portalContact');
    window.location.href = '/portal/login';
  };

  return (
    <Navbar className="navbar-custom" expand="md">
      <Container fluid>
        <div className="navbar-brand-box">
          <NavbarBrand className="logo">
            <div className="d-flex align-items-center">
              <i className="ri-shield-line fs-3 text-primary me-2"></i>
              <span className="fw-bold">Customer Portal</span>
            </div>
          </NavbarBrand>
        </div>

        <div className="navbar-custom-menu">
          <div className="d-flex align-items-center">
            <Dropdown isOpen={false} toggle={() => {}}>
              <DropdownToggle className="btn btn-light dropdown-toggle">
                <div className="d-flex align-items-center">
                  <div className="avatar-sm me-2">
                    <div className="avatar-title bg-primary text-white rounded-circle">
                      <RiUserLine size={16} />
                    </div>
                  </div>
                  <span className="d-none d-md-block">{contactData?.name || 'Customer'}</span>
                </div>
              </DropdownToggle>
              <DropdownMenu end>
                <DropdownItem header>
                  <div className="d-flex align-items-center">
                    <div className="avatar-sm me-2">
                      <div className="avatar-title bg-primary text-white rounded-circle">
                        <RiUserLine size={16} />
                      </div>
                    </div>
                    <div>
                      <h6 className="mb-0">{contactData?.name || 'Customer'}</h6>
                      <small className="text-muted">{contactData?.email || 'customer@example.com'}</small>
                    </div>
                  </div>
                </DropdownItem>
                <DropdownItem divider />
                <DropdownItem tag={Link} to="/pages-privacy-policy">
                  <RiShieldCheckLine className="me-2" />
                  Privacy Policy
                </DropdownItem>
                <DropdownItem tag={Link} to="/pages-terms-condition">
                  <RiFileTextLine className="me-2" />
                  Terms & Conditions
                </DropdownItem>
                <DropdownItem divider />
                <DropdownItem onClick={handleLogout}>
                  <RiLogoutBoxRLine className="me-2" />
                  Logout
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </div>
        </div>
      </Container>
    </Navbar>
  );
};

export default PortalHeader; 