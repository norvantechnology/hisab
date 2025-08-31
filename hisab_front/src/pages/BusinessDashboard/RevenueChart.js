import React, { useEffect, useRef } from 'react';
import { Card, CardBody, CardHeader } from 'reactstrap';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

const RevenueChart = ({ data, title, subtitle }) => {
    const chartRef = useRef(null);
    const chartInstance = useRef(null);

    useEffect(() => {
        if (!data || data.length === 0) return;

        const ctx = chartRef.current?.getContext('2d');
        if (!ctx) return;

        // Destroy existing chart
        if (chartInstance.current) {
            chartInstance.current.destroy();
        }

        const labels = data.map(item => {
            const date = new Date(item.month);
            return date.toLocaleDateString('en-US', { 
                month: 'short', 
                year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric'
            });
        });

        const salesData = data.map(item => parseFloat(item.sales || 0));
        const purchasesData = data.map(item => parseFloat(item.purchases || 0));
        const expensesData = data.map(item => parseFloat(item.expenses || 0));
        const incomesData = data.map(item => parseFloat(item.incomes || 0));
        const profitData = data.map(item => parseFloat(item.profit || 0));

        chartInstance.current = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Sales',
                        data: salesData,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        borderWidth: 3,
                        fill: false,
                        tension: 0.4
                    },
                    {
                        label: 'Purchases',
                        data: purchasesData,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 3,
                        fill: false,
                        tension: 0.4
                    },
                    {
                        label: 'Expenses',
                        data: expensesData,
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        borderWidth: 3,
                        fill: false,
                        tension: 0.4
                    },
                    {
                        label: 'Other Income',
                        data: incomesData,
                        borderColor: '#06b6d4',
                        backgroundColor: 'rgba(6, 182, 212, 0.1)',
                        borderWidth: 3,
                        fill: false,
                        tension: 0.4
                    },
                    {
                        label: 'Net Profit',
                        data: profitData,
                        borderColor: '#8b5cf6',
                        backgroundColor: 'rgba(139, 92, 246, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    title: {
                        display: false
                    },
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            pointStyle: 'circle',
                            padding: 20
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.parsed.y;
                                return `${context.dataset.label}: ₹${new Intl.NumberFormat('en-IN').format(value)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0,0,0,0.05)'
                        },
                        ticks: {
                            callback: function(value) {
                                return '₹' + new Intl.NumberFormat('en-IN', {
                                    notation: 'compact',
                                    compactDisplay: 'short'
                                }).format(value);
                            }
                        }
                    }
                }
            }
        });

        return () => {
            if (chartInstance.current) {
                chartInstance.current.destroy();
            }
        };
    }, [data]);

    return (
        <Card>
            <CardHeader>
                <h5 className="card-title mb-0">
                    <i className="ri-bar-chart-line text-primary me-2"></i>
                    {title}
                </h5>
                {subtitle && <p className="text-muted mb-0">{subtitle}</p>}
            </CardHeader>
            <CardBody>
                <div style={{ position: 'relative', height: '350px' }}>
                    {data && data.length > 0 ? (
                        <canvas ref={chartRef}></canvas>
                    ) : (
                        <div className="d-flex align-items-center justify-content-center h-100">
                            <div className="text-center">
                                <i className="ri-bar-chart-line text-muted mb-3" style={{ fontSize: '3rem' }}></i>
                                <h6 className="text-muted">No data available</h6>
                                <p className="text-muted mb-0">Start recording transactions to see trends</p>
                            </div>
                        </div>
                    )}
                </div>
            </CardBody>
        </Card>
    );
};

export default RevenueChart; 