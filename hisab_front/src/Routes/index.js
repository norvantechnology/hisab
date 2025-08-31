import React from 'react';
import { Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer } from 'react-toastify';
import NonAuthLayout from "../Layouts/NonAuthLayout";
import VerticalLayout from "../Layouts/index";
import CompanyProtected from "../Components/Common/CompanyProtected";
import { getAuthToken, getUserData } from "../utils/authUtils";

// Import routes first to avoid initialization issues
import * as routes from "./allRoutes";
const { authProtectedRoutes, publicRoutes } = routes;

const AuthProtected = ({ children }) => {
    // Use utility functions to check both localStorage and sessionStorage
    const token = getAuthToken();
    const userData = getUserData();

    console.log('AuthProtected check:', { hasToken: !!token, hasUserData: !!userData });

    if (!token || !userData) {
        return <Navigate to="/login" />;
    }

    return children;
};

const Index = () => {
    return (
        <React.Fragment>
            <ToastContainer closeButton={false} position="top-right" />
            <Routes>
                <Route>
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
                </Route>

                <Route>
                    {authProtectedRoutes.map((route, idx) => (
                        <Route
                            path={route.path}
                            element={
                                <AuthProtected>
                                    <CompanyProtected>
                                        <VerticalLayout>
                                            {route.component}
                                        </VerticalLayout>
                                    </CompanyProtected>
                                </AuthProtected>
                            }
                            key={idx}
                            exact={true}
                        />
                    ))}
                </Route>
            </Routes>
        </React.Fragment>
    );
};

export default Index;