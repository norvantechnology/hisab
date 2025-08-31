import React from 'react';
import { Card, CardBody, CardHeader, Badge } from 'reactstrap';

const TopProducts = ({ products, formatCurrency, formatNumber }) => {
    return (
        <Card>
            <CardHeader>
                <h5 className="card-title mb-0">
                    <i className="ri-trophy-line text-warning me-2"></i>
                    Top Selling Products
                </h5>
                <p className="text-muted mb-0">Best performing products by revenue</p>
            </CardHeader>
            <CardBody>
                {products && products.length > 0 ? (
                    <div className="table-responsive">
                        <table className="table table-sm table-nowrap mb-0">
                            <thead>
                                <tr>
                                    <th>Rank</th>
                                    <th>Product</th>
                                    <th>Revenue</th>
                                    <th>Qty</th>
                                </tr>
                            </thead>
                            <tbody>
                                {products.slice(0, 8).map((product, index) => (
                                    <tr key={product.id}>
                                        <td>
                                            <div className="d-flex align-items-center">
                                                <div className={`avatar-xs rounded-circle bg-${
                                                    index === 0 ? 'warning' : 
                                                    index === 1 ? 'info' : 
                                                    index === 2 ? 'success' : 'secondary'
                                                }-subtle d-flex align-items-center justify-content-center me-2`}>
                                                    <span className={`text-${
                                                        index === 0 ? 'warning' : 
                                                        index === 1 ? 'info' : 
                                                        index === 2 ? 'success' : 'secondary'
                                                    } fs-12 fw-bold`}>
                                                        #{index + 1}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div>
                                                <h6 className="mb-0 fs-13">{product.name}</h6>
                                                <small className="text-muted">{product.itemcode}</small>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="fw-semibold text-success">
                                                {formatCurrency(product.total_sales_amount)}
                                            </span>
                                        </td>
                                        <td>
                                            <Badge color="primary" className="badge-soft-primary">
                                                {formatNumber(product.total_quantity_sold)}
                                            </Badge>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-4">
                        <i className="ri-trophy-line text-muted mb-3" style={{ fontSize: '2rem' }}></i>
                        <h6 className="text-muted">No product data available</h6>
                        <p className="text-muted mb-0 fs-12">Start recording sales to see top products</p>
                    </div>
                )}
            </CardBody>
        </Card>
    );
};

export default TopProducts; 