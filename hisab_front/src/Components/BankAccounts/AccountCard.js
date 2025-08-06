import React from 'react';
import { Card, CardBody, Row, Col, Badge, UncontrolledDropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import { RiEyeLine, RiPencilLine, RiDeleteBinLine, RiMoreFill, RiCheckboxCircleLine, RiCloseLine, RiFileTextLine } from 'react-icons/ri';
import { ACCOUNT_TYPES } from './index';

const AccountCard = ({ account, onView, onEdit, onDelete, onStatement }) => {
    const accountTypeConfig = ACCOUNT_TYPES[account.accountType] || ACCOUNT_TYPES.bank;

    return (
        <Card className="bank-account-card shadow-sm border-0 h-100">
            <CardBody className="p-4">
                <Row className="align-items-center mb-3">
                    <Col className="flex-shrink-0">
                        <div className="avatar-sm">
                            <div className={`avatar-title bg-${accountTypeConfig.color}-subtle text-${accountTypeConfig.color} rounded-2 p-1`}>
                                {React.cloneElement(accountTypeConfig.icon, { size: 24 })}
                            </div>
                        </div>
                    </Col>
                    <Col>
                        <h5 className="mb-1 fw-semibold">{account.bankName}</h5>
                        <Badge className={`badge-soft-${accountTypeConfig.color} fs-11`}>
                            {accountTypeConfig.label}
                        </Badge>
                    </Col>
                    <Col className="col-auto">
                        <UncontrolledDropdown direction='start'>
                            <DropdownToggle tag="a" className="text-muted fs-18" style={{ cursor: 'pointer' }}>
                                <RiMoreFill />
                            </DropdownToggle>
                            <DropdownMenu>
                                <DropdownItem onClick={onView}>
                                    <RiEyeLine className="me-2 align-middle text-muted" />View
                                </DropdownItem>
                                <DropdownItem onClick={() => onStatement(account)}>
                                    <RiFileTextLine className="me-2 align-middle text-muted" />Statement
                                </DropdownItem>
                                <DropdownItem onClick={() => onEdit(account)}>
                                    <RiPencilLine className="me-2 align-middle text-muted" />Edit
                                </DropdownItem>
                                <DropdownItem divider />
                                <DropdownItem onClick={() => onDelete(account)}>
                                    <RiDeleteBinLine className="me-2 align-middle" />Delete
                                </DropdownItem>
                            </DropdownMenu>
                        </UncontrolledDropdown>
                    </Col>
                </Row>

                <div className="border-top pt-3">
                    <Row className="align-items-center">
                        <Col>
                            <div>
                                <h4 className="mb-1 fw-bold text-primary">₹{account.balance}</h4>
                                <small className="text-muted">Current Balance</small>
                            </div>
                        </Col>
                        <Col className="col-auto text-end">
                            <Badge color={account.status === 'Active' ? 'success' : 'danger'} className="fs-11">
                                {account.status === 'Active' ? <RiCheckboxCircleLine className="me-1" /> : <RiCloseLine className="me-1" />}
                                {account.status}
                            </Badge>
                            <div className="text-muted fs-12 mt-1">Created: {account.openingDate}</div>
                        </Col>
                    </Row>
                </div>

                <div className="mt-3 pt-2 border-top">
                    <Row className="text-center">
                        <Col>
                            <p className="text-muted mb-1 fs-13">Opening Balance</p>
                            <h6 className="mb-0">₹{account.openingBalance}</h6>
                        </Col>
                    </Row>
                </div>
            </CardBody>
        </Card>
    );
};

export default React.memo(AccountCard);