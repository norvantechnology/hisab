import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import {
  authRoutes,
  companyRoutes,
  expenseRoutes,
  bankAccountRoutes,
  incomesRoutes,
  accessRoutes,
  userRolesRoutes,
  moduleRoutes,
  rolePermissionsRoutes,
  contactRoutes,
  paymentRoutes,
  bankTransferRoutes,
  productRoute,
  purchaseRoute,
  salesRoute,
  stockCategoryRoute,
  taxCategoryRoutes,
  unitOfMeasurementsRoutes
} from "./src/routes/index.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());

// Use express built-in JSON and urlencoded parsers instead of body-parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/auth", authRoutes);
app.use("/api/company", companyRoutes);
app.use("/api/expense", expenseRoutes);
app.use("/api/bankAccount", bankAccountRoutes);
app.use("/api/incomes", incomesRoutes);
app.use("/api/access", accessRoutes);
app.use("/api/userRoles", userRolesRoutes);
app.use("/api/module", moduleRoutes);
app.use("/api/rolePermissions", rolePermissionsRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/bankTransfer", bankTransferRoutes);
app.use("/api/product", productRoute);
app.use("/api/purchase", purchaseRoute);
app.use("/api/sales", salesRoute);
app.use("/api/stockCategory", stockCategoryRoute);
app.use("/api/taxCategory", taxCategoryRoutes);
app.use("/api/unitOfMeasurements", unitOfMeasurementsRoutes);




// Global error handler to return JSON errors instead of HTML
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || "Internal Server Error" });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
