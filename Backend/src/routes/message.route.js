import express from "express";
import { protectRoute } from "../middlewares/auth.middleware";
import { getUsersForSidebar } from "../controllers/message.controller";


const router = express.Router();

router.get("/users",protectRoute,getUsersForSidebar)

export default router;