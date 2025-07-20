import React, { useState } from 'react';
import { Dropdown, DropdownItem, DropdownMenu, DropdownToggle } from 'reactstrap';
import { Link } from 'react-router-dom';
import avatar1 from "../../assets/images/users/avatar-1.jpg";

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
                    <img 
                        className="rounded-circle header-profile-user" 
                        src={avatar1}
                        alt="User Avatar" 
                    />
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
                <div className="dropdown-divider"></div>
                <DropdownItem tag={Link} to="/pages-profile-settings">
                    <i className="mdi mdi-cog-outline text-muted fs-16 align-middle me-1"></i>
                    <span className="align-middle">Settings</span>
                </DropdownItem>
                <DropdownItem tag={Link} to="/auth-lockscreen-basic">
                    <i className="mdi mdi-lock text-muted fs-16 align-middle me-1"></i>
                    <span className="align-middle">Lock screen</span>
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