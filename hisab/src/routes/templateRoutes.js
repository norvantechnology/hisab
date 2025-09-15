import express from "express";
import { 
  getTemplates, 
  setUserDefaultTemplate
} from "../controllers/templateController.js";
import { authenticateUser } from "../middleware/index.js";

const router = express.Router();

// All template routes require authentication
router.use(authenticateUser);

// Template routes for user flow
router.get("/", getTemplates);                    // GET /api/templates?moduleType=sales (includes default info)
router.post("/preferences", setUserDefaultTemplate);     // POST /api/templates/preferences

export default router; 