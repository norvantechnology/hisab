import React, { useState } from 'react';
import { Dropdown, DropdownItem, DropdownMenu, DropdownToggle } from 'reactstrap';
import { Link } from 'react-router-dom';

const ProfileDropdown = () => {
    // Get user data from session storage
    const userData = JSON.parse(sessionStorage.getItem("userData")) || {
        name: "User",
        email: "",
        role: "user"
    };

    // Dropdown Toggle State
    const [isProfileDropdown, setIsProfileDropdown] = useState(false);
    const toggleProfileDropdown = () => {
        setIsProfileDropdown(!isProfileDropdown);
    };

    return (
        <Dropdown 
            isOpen={isProfileDropdown} 
            toggle={toggleProfileDropdown} 
            className="ms-sm-3 header-item topbar-user"
        >
            <DropdownToggle tag="button" type="button" className="btn">
                <span className="d-flex align-items-center">
                    <div className="rounded-circle header-profile-user d-flex align-items-center justify-content-center bg-primary text-white">
                        <i className="ri-user-line"></i>
                    </div>
                    <span className="text-start ms-xl-2">
                        <span className="d-none d-xl-inline-block ms-1 fw-medium user-name-text">
                            {userData.name}
                        </span>
                        <span className="d-none d-xl-block ms-1 fs-13 text-muted user-name-sub-text">
                            {userData.role.charAt(0).toUpperCase() + userData.role.slice(1)}
                        </span>
                    </span>
                </span>
            </DropdownToggle>
            <DropdownMenu className="dropdown-menu-end">
                <h6 className="dropdown-header">Welcome {userData.name}!</h6>
                <DropdownItem tag={Link} to="/profile">
                    <i className="mdi mdi-account-circle text-muted fs-16 align-middle me-1"></i>
                    <span className="align-middle">Profile</span>
                </DropdownItem>
                <DropdownItem tag={Link} to="/logout">
                    <i className="mdi mdi-logout text-muted fs-16 align-middle me-1"></i>
                    <span className="align-middle">Logout</span>
                </DropdownItem>
            </DropdownMenu>
        </Dropdown>
    );
};

export default ProfileDropdown;