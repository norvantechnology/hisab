import React from 'react';
import { Offcanvas, OffcanvasBody, Button, Badge, Table, Row, Col } from 'reactstrap';
import { 
    RiCheckboxCircleLine, 
    RiCloseLine, 
    RiInformationLine, 
    RiMoneyDollarCircleLine, 
    RiCalendarLine, 
    RiFundsLine, 
    RiShieldCheckLine, 
    RiExchangeLine, 
    RiFileList3Line,
    RiPencilLine,
    RiDownload2Line
} from 'react-icons/ri';
import { ACCOUNT_TYPES } from './index';

const AccountDetailsOffcanvas = ({ isOpen, toggle, account }) => {
    const accountTypeConfig = account ? ACCOUNT_TYPES[account.accountType] || ACCOUNT_TYPES.bank : null;

    return (
        <Offcanvas isOpen={isOpen} direction="end" toggle={toggle} className="offcanvas-end border-0" style={{ width: '400px' }}>
            <OffcanvasBody className="p-0">
                {account && (
                    <>
                        <div className="bg-primary-subtle p-4 text-center">
                            <Button type="button" className="btn-close position-absolute top-0 end-0 m-3" onClick={toggle} />
                            <div className="avatar-lg mx-auto mb-3">
                                <div className={`avatar-title bg-${accountTypeConfig.color} text-white rounded-3 fs-1`}>
                                    {accountTypeConfig.icon}
                                </div>
                            </div>
                            <h5 className="mb-1 text-primary">{account.bankName}</h5>
                            <p className="text-muted mb-2">{accountTypeConfig.label} Account</p>
                            <Badge color={account.status === 'Active' ? 'success' : 'danger'} className="fs-12">
                                {account.status === 'Active' ? <RiCheckboxCircleLine className="me-1" /> : <RiCloseLine className="me-1" />}
                                {account.status}
                            </Badge>
                        </div>

                        <div className="p-4">
                            <h6 className="fs-15 mb-3">
                                <RiInformationLine className="me-2 text-primary" />
                                Account Information
                            </h6>

                            <div className="table-responsive">
                                <Table className="table table-borderless table-sm mb-0">
                                    <tbody>
                                        <tr>
                                            <td className="ps-0">
                                                <RiMoneyDollarCircleLine className="text-primary me-2" />
                                                Current Balance
                                            </td>
                                            <td className="text-end pe-0">
                                                <span className={`fw-semibold ${parseFloat(account.balance) >= 0 ? 'text-success' : 'text-danger'}`}>
                                                    ₹{account.balance}
                                                </span>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="ps-0">
                                                {accountTypeConfig.icon}
                                                <span className="ms-2">Account Type</span>
                                            </td>
                                            <td className="text-end pe-0">
                                                <Badge className={`badge-soft-${accountTypeConfig.color}`}>
                                                    {accountTypeConfig.label}
                                                </Badge>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="ps-0">
                                                <RiCalendarLine className="text-primary me-2" />
                                                Created Date
                                            </td>
                                            <td className="text-end pe-0">
                                                <span className="text-muted">{account.openingDate}</span>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="ps-0">
                                                <RiFundsLine className="text-primary me-2" />
                                                Opening Balance
                                            </td>
                                            <td className="text-end pe-0">
                                                <span className="text-muted">₹{account.openingBalance}</span>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="ps-0">
                                                <RiShieldCheckLine className="text-primary me-2" />
                                                Status
                                            </td>
                                            <td className="text-end pe-0">
                                                <Badge color={account.status === 'Active' ? 'success' : 'danger'}>
                                                    {account.status}
                                                </Badge>
                                            </td>
                                        </tr>
                                    </tbody>
                                </Table>
                            </div>

                            <div className="mt-4 pt-3 border-top">
                                <h6 className="fs-15 mb-3">
                                    <RiExchangeLine className="me-2 text-primary" />
                                    Recent Activity
                                </h6>
                                <div className="text-center py-3">
                                    <div className="avatar-md mx-auto mb-3">
                                        <div className="avatar-title bg-light text-muted rounded-3">
                                            <RiFileList3Line size={24} />
                                        </div>
                                    </div>
                                    <h6 className="text-muted">No recent transactions</h6>
                                    <p className="text-muted fs-13 mb-0">Transaction history will appear here once available</p>
                                </div>
                            </div>

                            <div className="mt-4 pt-3 border-top">
                                <Row className="g-2">
                                    <Col>
                                        <Button color="primary" size="sm" className="w-100">
                                            <RiPencilLine className="me-1" />Edit Account
                                        </Button>
                                    </Col>
                                    <Col>
                                        <Button color="info" size="sm" className="w-100">
                                            <RiDownload2Line className="me-1" />Export
                                        </Button>
                                    </Col>
                                </Row>
                            </div>
                        </div>
                    </>
                )}
            </OffcanvasBody>
        </Offcanvas>
    );
};

export default AccountDetailsOffcanvas;