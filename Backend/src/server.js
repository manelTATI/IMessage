import express, { json } from "express";
import "dotenv/config";
import { connectDB } from './lib/db.js';
import cors from "cors";
import User from './models/user.model.js'
import { clerkMiddleware } from '@clerk/express'
console.log("MONGO_URI:", process.env.MONGO_URI);
const app = express();
const port = process.env.PORT;
const frontend_URL = process.env.FRONTEND_URL;
app.use(json());
app.use(clerkMiddleware());
app.use(cors({origin:frontend_URL , credentials:true}));
app.get("/health", (req, res) => {
    res.status(200).json({ ok: true });
});
app.listen(port, () => {
    connectDB();
    console.log(`Server is running on port ${port}`);
});
export default app; 