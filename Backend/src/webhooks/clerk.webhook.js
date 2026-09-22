js
import express from "express";
import User from "../models/user.model.js";
import { verifyWebhook } from "@clerk/backend/webhooks";

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        console.log(" CLERK WEBHOOK RECEIVED");

        const signingSecret = process.env.CLERK_WEBHOOK_SINGING_SECRET;

        if (!signingSecret) {
            console.error(" Webhook secret is missing");
            return res.status(503).json({
                message: "Webhook secret is not provided",
            });
        }

        // Clerk needs the raw request body for signature verification
        const payload = Buffer.isBuffer(req.body)
            ? req.body.toString("utf8")
            : String(req.body);

        const request = new Request(
            "http://internal/webhooks/clerk",
            {
                method: "POST",
                headers: new Headers(req.headers),
                body: payload,
            }
        );

        // Verify Clerk webhook signature
        const evt = await verifyWebhook(request, {
            signingSecret,
        });

        console.log("✅ Clerk webhook verified:", evt.type);

        if (
            evt.type === "user.created" ||
            evt.type === "user.updated"
        ) {
            const u = evt.data;

            const email =
                u.email_addresses?.find(
                    (e) => e.id === u.primary_email_address_id
                )?.email_address ??
                u.email_addresses?.[0]?.email_address;

            const fullName =
                [u.first_name, u.last_name]
                    .filter(Boolean)
                    .join(" ") ||
                u.username ||
                email?.split("@")[0];

            console.log("Clerk ID:", u.id);
            console.log("Email:", email);
            console.log("Full name:", fullName);

            await User.findOneAndUpdate(
                { clerkId: u.id },
                {
                    clerkId: u.id,
                    email,
                    fullName,
                    profilePic: u.image_url,
                },
                {
                    new: true,
                    upsert: true,
                    setDefaultsOnInsert: true,
                }
            );

            console.log("User saved to MongoDB");
        }

        if (evt.type === "user.deleted") {
            if (evt.data.id) {
                await User.findOneAndDelete({
                    clerkId: evt.data.id,
                });

                console.log(" User deleted from MongoDB");
            }
        }

        return res.status(200).json({
            received: true,
        });

    } catch (error) {
        console.error(" Error in Clerk webhook:", error);

        return res.status(400).json({
            message: "Webhook verification failed",
        });
    }
});

export default router;

