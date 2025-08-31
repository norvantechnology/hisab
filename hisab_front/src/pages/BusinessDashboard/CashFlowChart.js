import React, { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

const CashFlowChart = ({ data, formatCurrency }) => {
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

        const inflowData = data.map(item => parseFloat(item.total_inflow || 0));
        const outflowData = data.map(item => parseFloat(item.total_outflow || 0));
        const netFlowData = data.map(item => parseFloat(item.net_flow || 0));

        chartInstance.current = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Cash Inflow',
                        data: inflowData,
                        backgroundColor: 'rgba(16, 185, 129, 0.8)',
                        borderColor: '#10b981',
                        borderWidth: 1
                    },
                    {
                        label: 'Cash Outflow',
                        data: outflowData,
                        backgroundColor: 'rgba(239, 68, 68, 0.8)',
                        borderColor: '#ef4444',
                        borderWidth: 1
                    },
                    {
                        label: 'Net Cash Flow',
                        data: netFlowData,
                        type: 'line',
                        borderColor: '#8b5cf6',
                        backgroundColor: 'rgba(139, 92, 246, 0.1)',
                        borderWidth: 3,
                        fill: false,
                        tension: 0.4,
                        yAxisID: 'y1'
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
                        type: 'linear',
                        display: true,
                        position: 'left',
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
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        grid: {
                            drawOnChartArea: false,
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
    }, [data, formatCurrency]);

    return (
        <div style={{ position: 'relative', height: '400px' }}>
            {data && data.length > 0 ? (
                <canvas ref={chartRef}></canvas>
            ) : (
                <div className="d-flex align-items-center justify-content-center h-100">
                    <div className="text-center">
                        <i className="ri-funds-line text-muted mb-3" style={{ fontSize: '3rem' }}></i>
                        <h6 className="text-muted">No cash flow data available</h6>
                        <p className="text-muted mb-0">Complete some transactions to see cash flow analysis</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CashFlowChart; 