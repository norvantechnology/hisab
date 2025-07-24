import React from 'react';
import { Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer } from 'react-toastify';
import NonAuthLayout from "../Layouts/NonAuthLayout";
import VerticalLayout from "../Layouts/index";
import CompanyProtected from "../Components/Common/CompanyProtected";

// Import routes first to avoid initialization issues
import * as routes from "./allRoutes";
const { authProtectedRoutes, publicRoutes } = routes;

const AuthProtected = ({ children }) => {
    const token = sessionStorage.getItem('authToken');
    const userData = sessionStorage.getItem('userData');

    if (!token || !userData) {
        return <Navigate to="/login" />;
    }

    return children;
};

const Index = () => {
    return (
        <React.Fragment>
            <Routes>
                {publicRoutes.map((route, idx) => (
                    <Route
                        path={route.path}
                        element={
                            <NonAuthLayout>
                                {route.component}
                            </NonAuthLayout>
                        }
                        key={idx}
                        exact={true}
                    />
                ))}

                {authProtectedRoutes.map((route, idx) => (
                    <Route
                        path={route.path}
                        element={
                            <AuthProtected>
                                <CompanyProtected>
                                    <VerticalLayout>{route.component}</VerticalLayout>
                                </CompanyProtected>
                            </AuthProtected>
                        }
                        key={idx}
                        exact={true}
                    />
                ))}
            </Routes>
        </React.Fragment>
    );
};

export default Index;