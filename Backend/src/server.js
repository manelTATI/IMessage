import express from "express";
import "dotenv/config";
import { connectDB } from './lib/db.js';
import cors from "cors";
import fs from "fs";
import path from "path";
import User from './models/user.model.js'
import { clerkMiddleware } from '@clerk/express'
import job from "./lib/cron.js";
import clerkWebhook from "./webhooks/clerk.webhook.js";
console.log("MONGO_URI:", process.env.MONGO_URI);

const app = express();
const port = process.env.PORT;

const frontend_URL = process.env.FRONTEND_URL;
const publicDir = path.join(process.cwd(), "public");

//it's important that you don't parse the webhook event data, it should be in the raw format 

app.use("/api/webhooks/clerk",express.raw({type:"application/json"}),clerkWebhook)


app.use(express.json());
app.use(clerkMiddleware());
app.use(cors({ origin: frontend_URL, credentials: true }));


app.get("/health", (req, res) => {
    res.status(200).json({ ok: true });
});
// if the public directory exists, serve the static files 
// this is for the production build
if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));//build a middlware
    app.get("/{*any}", (req, res, next) => {
        res.sendFile(path.join(publicDir, "index.html"), (err) => next(err));
    });
    
}

app.listen(port, () => {
    connectDB();
    console.log(`Server is running on port ${port}`);

    if (process.env.NODE_ENV === "production") {
        job.start();   
    }
});
export default app; 