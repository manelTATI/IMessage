import express from "express";
import { checkAuth } from "../controllers/auth.controllers.js";
import { protectRoute } from "../middlewares/auth.middleware.js";

const router = express.Router();
// /api/auth/check
router.get("/check", protectRoute, checkAuth);

export default router;