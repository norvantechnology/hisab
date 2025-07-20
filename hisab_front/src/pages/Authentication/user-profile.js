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
} from "reactstrap";
import * as Yup from "yup";
import { useFormik } from "formik";
import { useSelector, useDispatch } from "react-redux";
import avatar from "../../assets/images/users/avatar-1.jpg";
import { editProfile, resetProfileFlag } from "../../slices/thunks";
import { createSelector } from "reselect";

const UserProfile = () => {
  const dispatch = useDispatch();

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

  document.title = "Profile | Velzon - React Admin & Dashboard Template";
  
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
                      <img
                        src={avatar}
                        alt="User Avatar"
                        className="avatar-md rounded-circle img-thumbnail"
                      />
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

          <h4 className="card-title mb-4">Change User Name</h4>

          <Card>
            <CardBody>
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
            </CardBody>
          </Card>
        </Container>
      </div>
    </React.Fragment>
  );
};

export default UserProfile;