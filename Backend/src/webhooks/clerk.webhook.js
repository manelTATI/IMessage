import express from "express";
import User from "../models/user.model.js";
import { verifyWebhook } from "@clerk/backend/webhooks";

const router = express.Router();
router.get("/", (req, res) => {
    res.send("Clerk webhook route is working");
});

router.post("/", async (req, res) => {
    try {
        // Verify Clerk webhook
        const evt = await verifyWebhook(req, {
            signingSecret: process.env.CLERK_WEBHOOK_SIGNING_SECRET,
        });

        console.log("Clerk webhook received:", evt.type);

        // Only handle new users
        if (evt.type !== "user.created") {
            return res.status(200).json({
                message: "Event ignored",
            });
        }

        const user = evt.data;

        // Get user data from Clerk
        const clerkId = user.id;

        const email =
            user.email_addresses?.find(
                (email) => email.id === user.primary_email_address_id
            )?.email_address ||
            user.email_addresses?.[0]?.email_address;

        const fullName =
            [user.first_name, user.last_name]
                .filter(Boolean)
                .join(" ") ||
            user.username ||
            "Clerk User";

        const profilePic = user.image_url || "";

        // Make sure email exists
        if (!email) {
            console.error("No email found for Clerk user:", clerkId);

            return res.status(400).json({
                message: "No email found",
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ clerkId });

        if (existingUser) {
            console.log("User already exists:", clerkId);

            return res.status(200).json({
                message: "User already exists",
            });
        }

        // Create user in MongoDB
        const newUser = await User.create({
            clerkId,
            email,
            fullName,
            profilePic,
        });

        console.log("User created in MongoDB:", newUser._id);

        return res.status(200).json({
            message: "User created successfully",
        });

    } catch (error) {
        console.error("Clerk webhook error:", error);

        return res.status(400).json({
            message: "Webhook failed",
            error: error.message,
        });
    }
});

export default router;