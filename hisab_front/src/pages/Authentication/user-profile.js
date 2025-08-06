import React, { useState, useEffect } from "react";
import { isEmpty } from "lodash";
import {
  Container,
  Row,
  Col,
  Card,
  Alert,
  CardBody,
  Button,
  Label,
  Input,
  FormFeedback,
  Form,
  Nav,
  NavItem,
  NavLink,
  TabContent,
  TabPane,
} from "reactstrap";
import * as Yup from "yup";
import { useFormik } from "formik";
import { useSelector, useDispatch } from "react-redux";
import { editProfile, resetProfileFlag } from "../../slices/thunks";
import { createSelector } from "reselect";
import { changePassword } from "../../services/auth";
import { toast } from 'react-toastify';

const UserProfile = () => {
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState("1");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const [userData, setUserData] = useState({
    name: "",
    email: "",
    role: ""
  });

  const selectLayoutState = (state) => state.Profile;
  const userprofileData = createSelector(
    selectLayoutState,
    (state) => ({
      user: state.user,
      success: state.success,
      error: state.error
    })
  );

  const {
    user, success, error 
  } = useSelector(userprofileData);

  useEffect(() => {
    // Fetch user data from sessionStorage
    const sessionUserData = sessionStorage.getItem("userData");
    if (sessionUserData) {
      const parsedData = JSON.parse(sessionUserData);
      setUserData(parsedData);
      
      // Update session storage if redux user data is available
      if (!isEmpty(user)) {
        const updatedData = {
          ...parsedData,
          name: user.first_name || parsedData.name
        };
        sessionStorage.setItem("userData", JSON.stringify(updatedData));
        setUserData(updatedData);
      }
    }

    // Reset profile flag after 3 seconds
    const timer = setTimeout(() => {
      dispatch(resetProfileFlag());
    }, 3000);

    return () => clearTimeout(timer);
  }, [dispatch, user]);

  // Reset password messages after 3 seconds
  useEffect(() => {
    if (passwordSuccess || passwordError) {
      const timer = setTimeout(() => {
        setPasswordSuccess(false);
        setPasswordError("");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [passwordSuccess, passwordError]);

  const validation = useFormik({
    enableReinitialize: true,
    initialValues: {
      first_name: userData.name || '',
      idx: userData.email || '', // Using email as identifier if needed
    },
    validationSchema: Yup.object({
      first_name: Yup.string().required("Please Enter Your UserName"),
    }),
    onSubmit: (values) => {
      dispatch(editProfile(values));
      // Update local state and session storage immediately
      const updatedUserData = {
        ...userData,
        name: values.first_name
      };
      setUserData(updatedUserData);
      sessionStorage.setItem("userData", JSON.stringify(updatedUserData));
    }
  });

  const passwordValidation = useFormik({
    enableReinitialize: true,
    initialValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    validationSchema: Yup.object({
      currentPassword: Yup.string().required("Please Enter Current Password"),
      newPassword: Yup.string()
        .min(8, "Password must be at least 8 characters")
        .required("Please Enter New Password"),
      confirmPassword: Yup.string()
        .oneOf([Yup.ref('newPassword'), null], 'Passwords must match')
        .required("Please Confirm New Password"),
    }),
    onSubmit: async (values) => {
      setPasswordLoading(true);
      setPasswordError("");
      setPasswordSuccess(false);
      
      try {
        const response = await changePassword({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword
        });
        
        if (response.success) {
          setPasswordSuccess(true);
          toast.success(response.message || "Password changed successfully!");
          // Reset form
          passwordValidation.resetForm();
        } else {
          setPasswordError(response.message || "Failed to change password");
          toast.error(response.message || "Failed to change password");
        }
      } catch (error) {
        const errorMessage = error.message || "Failed to change password";
        setPasswordError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setPasswordLoading(false);
      }
    }
  });

  const toggleTab = (tab) => {
    if (activeTab !== tab) {
      setActiveTab(tab);
    }
  };

  document.title = "Profile | Vyavhar - Financial Management Platform";
  
  return (
    <React.Fragment>
      <div className="page-content">
        <Container fluid>
          <Row>
            <Col lg="12">
              {error && <Alert color="danger">{error}</Alert>}
              {success && <Alert color="success">Username Updated To {userData.name}</Alert>}

              <Card>
                <CardBody>
                  <div className="d-flex">
                    <div className="mx-3">
                      <div className="avatar-md rounded-circle img-thumbnail d-flex align-items-center justify-content-center bg-primary text-white">
                        <i className="ri-user-line fs-2"></i>
                      </div>
                    </div>
                    <div className="flex-grow-1 align-self-center">
                      <div className="text-muted">
                        <h5>{userData.name || "User"}</h5>
                        <p className="mb-1">Email: {userData.email}</p>
                        <p className="mb-0">Role: {userData.role}</p>
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </Col>
          </Row>

          <Row>
            <Col lg="12">
              <Card>
                <CardBody>
                  <Nav tabs className="nav-tabs-custom">
                    <NavItem>
                      <NavLink
                        className={activeTab === "1" ? "active" : ""}
                        onClick={() => toggleTab("1")}
                      >
                        <i className="ri-user-settings-line me-1"></i>
                        Change Username
                      </NavLink>
                    </NavItem>
                    <NavItem>
                      <NavLink
                        className={activeTab === "2" ? "active" : ""}
                        onClick={() => toggleTab("2")}
                      >
                        <i className="ri-lock-password-line me-1"></i>
                        Change Password
                      </NavLink>
                    </NavItem>
                  </Nav>

                  <TabContent activeTab={activeTab} className="mt-4">
                    <TabPane tabId="1">
                      <Form
                        className="form-horizontal"
                        onSubmit={(e) => {
                          e.preventDefault();
                          validation.handleSubmit();
                          return false;
                        }}
                      >
                        <div className="form-group">
                          <Label className="form-label">User Name</Label>
                          <Input
                            name="first_name"
                            className="form-control"
                            placeholder="Enter User Name"
                            type="text"
                            onChange={validation.handleChange}
                            onBlur={validation.handleBlur}
                            value={validation.values.first_name || ""}
                            invalid={
                              validation.touched.first_name && validation.errors.first_name ? true : false
                            }
                          />
                          {validation.touched.first_name && validation.errors.first_name ? (
                            <FormFeedback type="invalid">{validation.errors.first_name}</FormFeedback>
                          ) : null}
                          <Input name="idx" value={validation.values.idx} type="hidden" />
                        </div>
                        <div className="text-center mt-4">
                          <Button type="submit" color="primary">
                            Update User Name
                          </Button>
                        </div>
                      </Form>
                    </TabPane>

                    <TabPane tabId="2">
                      {passwordSuccess && <Alert color="success">Password changed successfully!</Alert>}
                      {passwordError && <Alert color="danger">{passwordError}</Alert>}
                      
                      <Form
                        className="form-horizontal"
                        onSubmit={(e) => {
                          e.preventDefault();
                          passwordValidation.handleSubmit();
                          return false;
                        }}
                      >
                        <div className="form-group mb-3">
                          <Label className="form-label">Current Password</Label>
                          <Input
                            name="currentPassword"
                            className="form-control"
                            placeholder="Enter Current Password"
                            type="password"
                            onChange={passwordValidation.handleChange}
                            onBlur={passwordValidation.handleBlur}
                            value={passwordValidation.values.currentPassword || ""}
                            invalid={
                              passwordValidation.touched.currentPassword && passwordValidation.errors.currentPassword ? true : false
                            }
                          />
                          {passwordValidation.touched.currentPassword && passwordValidation.errors.currentPassword ? (
                            <FormFeedback type="invalid">{passwordValidation.errors.currentPassword}</FormFeedback>
                          ) : null}
                        </div>

                        <div className="form-group mb-3">
                          <Label className="form-label">New Password</Label>
                          <Input
                            name="newPassword"
                            className="form-control"
                            placeholder="Enter New Password"
                            type="password"
                            onChange={passwordValidation.handleChange}
                            onBlur={passwordValidation.handleBlur}
                            value={passwordValidation.values.newPassword || ""}
                            invalid={
                              passwordValidation.touched.newPassword && passwordValidation.errors.newPassword ? true : false
                            }
                          />
                          {passwordValidation.touched.newPassword && passwordValidation.errors.newPassword ? (
                            <FormFeedback type="invalid">{passwordValidation.errors.newPassword}</FormFeedback>
                          ) : null}
                        </div>

                        <div className="form-group mb-3">
                          <Label className="form-label">Confirm New Password</Label>
                          <Input
                            name="confirmPassword"
                            className="form-control"
                            placeholder="Confirm New Password"
                            type="password"
                            onChange={passwordValidation.handleChange}
                            onBlur={passwordValidation.handleBlur}
                            value={passwordValidation.values.confirmPassword || ""}
                            invalid={
                              passwordValidation.touched.confirmPassword && passwordValidation.errors.confirmPassword ? true : false
                            }
                          />
                          {passwordValidation.touched.confirmPassword && passwordValidation.errors.confirmPassword ? (
                            <FormFeedback type="invalid">{passwordValidation.errors.confirmPassword}</FormFeedback>
                          ) : null}
                        </div>

                        <div className="text-center mt-4">
                          <Button 
                            type="submit" 
                            color="primary" 
                            disabled={passwordLoading}
                          >
                            {passwordLoading ? "Changing Password..." : "Change Password"}
                          </Button>
                        </div>
                      </Form>
                    </TabPane>
                  </TabContent>
                </CardBody>
              </Card>
            </Col>
          </Row>
        </Container>
      </div>
    </React.Fragment>
  );
};

export default UserProfile;