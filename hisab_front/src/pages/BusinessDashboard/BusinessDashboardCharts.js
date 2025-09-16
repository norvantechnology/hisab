import React from "react";
import ReactApexChart from "react-apexcharts";
import getChartColorsArray from "../../Components/Common/ChartsDynamicColor";

// Revenue Trend Chart - Shows sales, purchases, and profit over time
const RevenueTrendChart = ({ dataColors, chartData }) => {
  const chartColors = getChartColorsArray(dataColors);

  const series = [
    {
      name: "Sales",
      type: "column",
      data: chartData?.salesData || []
    },
    {
      name: "Purchases",
      type: "column", 
      data: chartData?.purchasesData || []
    },
    {
      name: "Profit",
      type: "line",
      data: chartData?.profitData || []
    }
  ];

  const options = {
    chart: {
      height: 350,
      type: "line",
      toolbar: {
        show: true,
        tools: {
          download: true,
          selection: false,
          zoom: false,
          zoomin: false,
          zoomout: false,
          pan: false,
          reset: false
        }
      }
    },
    stroke: {
      width: [0, 0, 3],
      curve: "smooth"
    },
    plotOptions: {
      bar: {
        columnWidth: "50%"
      }
    },
    fill: {
      opacity: [0.85, 0.85, 1],
      type: "solid"
    },
    labels: chartData?.labels || chartData?.months || [],
    markers: {
      size: [0, 0, 5],
      strokeColors: "#fff",
      strokeWidth: 2,
      hover: {
        size: 7
      }
    },
    xaxis: {
      type: "category",
      title: {
        text: "Months"
      }
    },
    yaxis: [
      {
        title: {
          text: "Amount (₹)"
        },
        labels: {
          formatter: function (val) {
            return "₹" + (val / 1000).toFixed(0) + "K";
          }
        }
      }
    ],
    tooltip: {
      shared: true,
      intersect: false,
      y: [
        {
          formatter: function (y) {
            if (typeof y !== "undefined") {
              return "₹" + new Intl.NumberFormat('en-IN').format(y);
            }
            return y;
          }
        },
        {
          formatter: function (y) {
            if (typeof y !== "undefined") {
              return "₹" + new Intl.NumberFormat('en-IN').format(y);
            }
            return y;
          }
        },
        {
          formatter: function (y) {
            if (typeof y !== "undefined") {
              return "₹" + new Intl.NumberFormat('en-IN').format(y);
            }
            return y;
          }
        }
      ]
    },
    colors: chartColors,
    legend: {
      position: "top",
      horizontalAlign: "center"
    },
    grid: {
      borderColor: "#f1f1f1"
    }
  };

  return (
    <ReactApexChart
      dir="ltr"
      options={options}
      series={series}
      type="line"
      height="350"
      className="apex-charts"
    />
  );
};

// Cash Flow Chart - Shows income vs expenses
const CashFlowChart = ({ dataColors, chartData }) => {
  const chartColors = getChartColorsArray(dataColors);

  const series = [
    {
      name: "Income",
      data: chartData?.incomeData || []
    },
    {
      name: "Expenses", 
      data: chartData?.expenseData || []
    }
  ];

  const options = {
    chart: {
      height: 300,
      type: "area",
      toolbar: {
        show: false
      }
    },
    dataLabels: {
      enabled: false
    },
    stroke: {
      curve: "smooth",
      width: 2
    },
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.7,
        opacityTo: 0.3,
        stops: [0, 90, 100]
      }
    },
    xaxis: {
      categories: chartData?.months || [],
      title: {
        text: "Months"
      }
    },
    yaxis: {
      title: {
        text: "Amount (₹)"
      },
      labels: {
        formatter: function (val) {
          return "₹" + (val / 1000).toFixed(0) + "K";
        }
      }
    },
    tooltip: {
      y: {
        formatter: function (val) {
          return "₹" + new Intl.NumberFormat('en-IN').format(val);
        }
      }
    },
    colors: chartColors,
    legend: {
      position: "top"
    },
    grid: {
      borderColor: "#f1f1f1"
    }
  };

  return (
    <ReactApexChart
      dir="ltr"
      options={options}
      series={series}
      type="area"
      height="300"
      className="apex-charts"
    />
  );
};

// Payment Status Distribution Chart
const PaymentStatusChart = ({ dataColors, chartData }) => {
  const chartColors = getChartColorsArray(dataColors);

  const series = chartData?.values || [0, 0, 0];
  const options = {
    chart: {
      height: 280,
      type: "donut"
    },
    labels: chartData?.labels || ["Paid", "Pending", "Overdue"],
    colors: chartColors,
    legend: {
      position: "bottom"
    },
    plotOptions: {
      pie: {
        donut: {
          size: "65%"
        }
      }
    },
    dataLabels: {
      enabled: true,
      formatter: function (val, opts) {
        return opts.w.config.series[opts.seriesIndex];
      }
    },
    tooltip: {
      y: {
        formatter: function (val) {
          return val + " invoices";
        }
      }
    },
    responsive: [
      {
        breakpoint: 480,
        options: {
          chart: {
            width: 200
          },
          legend: {
            position: "bottom"
          }
        }
      }
    ]
  };

  return (
    <ReactApexChart
      dir="ltr"
      options={options}
      series={series}
      type="donut"
      height="280"
      className="apex-charts"
    />
  );
};

// Top Products Performance Chart - Fixed for ApexCharts compatibility
const TopProductsChart = ({ dataColors, chartData }) => {
  const chartColors = getChartColorsArray(dataColors);

  // Normalize data for better comparison - scale quantity to be comparable to revenue
  const maxRevenue = Math.max(...(chartData?.revenue || [0]));
  const maxQuantity = Math.max(...(chartData?.quantity || [0]));
  const scaleFactor = maxQuantity > 0 ? maxRevenue / maxQuantity : 1;

  const series = [
    {
      name: "Revenue",
      data: chartData?.revenue || []
    },
    {
      name: "Quantity (Scaled)",
      data: (chartData?.quantity || []).map(q => Math.round(q * scaleFactor))
    }
  ];

  const options = {
    chart: {
      height: 350,
      type: "bar",
      toolbar: {
        show: false
      }
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "60%",
        dataLabels: {
          position: "top"
        }
      }
    },
    dataLabels: {
      enabled: true,
      formatter: function (val, opts) {
        if (opts.seriesIndex === 0) {
          // Revenue formatting
          return "₹" + new Intl.NumberFormat('en-IN', {
            notation: "compact",
            maximumFractionDigits: 1
          }).format(val);
        } else {
          // Quantity formatting - convert back to original scale
          const originalQty = Math.round(val / scaleFactor);
          return originalQty + " units";
        }
      },
      style: {
        fontSize: "11px",
        fontWeight: "600",
        colors: ["#333"]
      },
      offsetY: -20
    },
    stroke: {
      show: true,
      width: 2,
      colors: ["transparent"]
    },
    tooltip: {
      shared: true,
      intersect: false,
      y: [
        {
          formatter: function (y) {
            return "₹" + new Intl.NumberFormat('en-IN').format(y);
          }
        },
        {
          formatter: function (y) {
            const originalQty = Math.round(y / scaleFactor);
            return originalQty + " units sold";
          }
        }
      ]
    },
    xaxis: {
      categories: chartData?.productNames || [],
      labels: {
        style: {
          fontSize: "12px",
          fontWeight: 500
        },
        rotate: -45
      }
    },
    yaxis: {
      title: {
        text: "Revenue (₹) / Quantity (Scaled)"
      },
      labels: {
        formatter: function (val) {
          return "₹" + new Intl.NumberFormat('en-IN', {
            notation: "compact",
            maximumFractionDigits: 1
          }).format(val);
        }
      }
    },
    colors: chartColors,
    legend: {
      position: "top",
      horizontalAlign: "center",
      fontSize: "13px",
      fontWeight: 500
    },
    grid: {
      borderColor: "#f1f1f1",
      strokeDashArray: 3,
      yaxis: {
        lines: {
          show: true
        }
      }
    },
    responsive: [
      {
        breakpoint: 768,
        options: {
          plotOptions: {
            bar: {
              columnWidth: "80%"
            }
          },
          dataLabels: {
            style: {
              fontSize: "10px"
            }
          },
          xaxis: {
            labels: {
              rotate: -90
            }
          }
        }
      }
    ]
  };

  return (
    <ReactApexChart
      dir="ltr"
      options={options}
      series={series}
      type="bar"
      height="350"
      className="apex-charts"
    />
  );
};

// Monthly Sales Comparison Chart
const MonthlySalesChart = ({ dataColors, chartData }) => {
  const chartColors = getChartColorsArray(dataColors);

  const series = [
    {
      name: "This Year",
      data: chartData?.currentYear || []
    },
    {
      name: "Last Year",
      data: chartData?.lastYear || []
    }
  ];

  const options = {
    chart: {
      height: 300,
      type: "line",
      toolbar: {
        show: false
      }
    },
    stroke: {
      width: [3, 3],
      curve: "smooth",
      dashArray: [0, 5]
    },
    markers: {
      size: [5, 5],
      hover: {
        size: 7
      }
    },
    xaxis: {
      categories: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    },
    yaxis: {
      title: {
        text: "Sales (₹)"
      },
      labels: {
        formatter: function (val) {
          return "₹" + (val / 1000).toFixed(0) + "K";
        }
      }
    },
    tooltip: {
      y: {
        formatter: function (val) {
          return "₹" + new Intl.NumberFormat('en-IN').format(val);
        }
      }
    },
    colors: chartColors,
    legend: {
      position: "top"
    },
    grid: {
      borderColor: "#f1f1f1"
    }
  };

  return (
    <ReactApexChart
      dir="ltr"
      options={options}
      series={series}
      type="line"
      height="300"
      className="apex-charts"
    />
  );
};

// Business Growth Metrics Chart
const BusinessGrowthChart = ({ dataColors, chartData }) => {
  const chartColors = getChartColorsArray(dataColors);

  const series = [
    {
      name: "Revenue Growth",
      data: chartData?.revenueGrowth || []
    },
    {
      name: "Customer Growth",
      data: chartData?.customerGrowth || []
    },
    {
      name: "Product Sales",
      data: chartData?.productSales || []
    }
  ];

  const options = {
    chart: {
      height: 300,
      type: "radar",
      toolbar: {
        show: false
      }
    },
    plotOptions: {
      radar: {
        size: 140,
        polygons: {
          strokeColors: "#e9e9e9",
          fill: {
            colors: ["#f8f9fa", "#fff"]
          }
        }
      }
    },
    colors: chartColors,
    markers: {
      size: 4,
      colors: ["#fff"],
      strokeColor: chartColors,
      strokeWidth: 2
    },
    tooltip: {
      y: {
        formatter: function (val) {
          return val + "%";
        }
      }
    },
    xaxis: {
      categories: chartData?.categories || ["Q1", "Q2", "Q3", "Q4"]
    },
    yaxis: {
      tickAmount: 7,
      labels: {
        formatter: function (val, i) {
          return val + "%";
        }
      }
    }
  };

  return (
    <ReactApexChart
      dir="ltr"
      options={options}
      series={series}
      type="radar"
      height="300"
      className="apex-charts"
    />
  );
};

export {
  RevenueTrendChart,
  CashFlowChart,
  PaymentStatusChart,
  TopProductsChart,
  MonthlySalesChart,
  BusinessGrowthChart
}; 