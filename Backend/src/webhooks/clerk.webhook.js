import express from "express";
import User from "../models/user.model.js";
import { verifyWebhook } from "@clerk/backend/webhooks";

const router = express.Router();

router.post("/", async (req, res) => {
    console.log("--------------------------------------------------");
    console.log("CLERK WEBHOOK RECEIVED: POST /api/webhooks/clerk");
    console.log("Content-Type:", req.headers["content-type"]);
    console.log("Svix Headers:", {
        "svix-id": req.headers["svix-id"] || "MISSING",
        "svix-timestamp": req.headers["svix-timestamp"] || "MISSING",
        "svix-signature": req.headers["svix-signature"] ? "PRESENT" : "MISSING",
    });

    const signingSecret =
        process.env.CLERK_WEBHOOK_SIGNING_SECRET ||
        process.env.CLERK_WEBHOOK_SINGING_SECRET;

    if (!signingSecret) {
        console.error("FATAL: Webhook signing secret is missing from environment: CLERK_WEBHOOK_SIGNING_SECRET");
        return res.status(500).json({
            message: "Webhook signing secret is not configured in .env",
        });
    }

    // Ensure Express req satisfies the Web Request interface expected by verifyWebhook
    if (typeof req.headers?.get !== "function") {
        req.headers.get = (name) => {
            const val = req.headers[name.toLowerCase()];
            return Array.isArray(val) ? val.join(", ") : (val ?? null);
        };
    }
    if (typeof req.text !== "function") {
        req.text = async () =>
            Buffer.isBuffer(req.body)
                ? req.body.toString("utf8")
                : (req.body || "");
    }

    let evt;
    try {
        // Step 1: Verify the webhook signature
        evt = await verifyWebhook(req, {
            signingSecret: signingSecret.trim(),
        });
        console.log("Clerk webhook signature VERIFIED successfully. Event type:", evt.type);
    } catch (verifyError) {
        console.error("Webhook signature verification FAILED:", verifyError.message || verifyError);
        return res.status(400).json({
            message: "Webhook verification failed",
            error: verifyError.message || "Invalid webhook signature or missing svix headers",
        });
    }

    // Step 2: Handle verified events
    try {
        if (evt.type === "user.created") {
            const u = evt.data;

            // Extract Clerk user data
            const clerkId = u.id;
            const firstName = u.first_name || "";
            const lastName = u.last_name || "";

            // Safely extract primary email address
            const email =
                u.email_addresses?.find(
                    (e) => e.id === u.primary_email_address_id
                )?.email_address ||
                u.email_addresses?.[0]?.email_address ||
                (u.username ? `${u.username}@clerk.user` : `${clerkId}@clerk.user`);

            // Derive fullName matching the schema
            const fullName =
                [firstName, lastName].filter(Boolean).join(" ").trim() ||
                u.username ||
                email.split("@")[0] ||
                "User";

            const profilePic = u.image_url || "";

            console.log(`Processing user.created for Clerk ID: ${clerkId}, Email: ${email}`);

            // Check whether a user with the same Clerk ID already exists
            const existingUser = await User.findOne({ clerkId });
            if (existingUser) {
                console.log(`User with clerkId ${clerkId} already exists in MongoDB.`);
                return res.status(200).json({
                    message: "User already exists",
                    received: true,
                });
            }

            // Check whether a user with the same email already exists in MongoDB
            const existingEmailUser = await User.findOne({ email });
            if (existingEmailUser) {
                console.log(`User with email ${email} already exists in MongoDB, linking clerkId.`);
                existingEmailUser.clerkId = clerkId;
                if (fullName) existingEmailUser.fullName = fullName;
                if (profilePic) existingEmailUser.profilePic = profilePic;
                await existingEmailUser.save();
                return res.status(200).json({
                    message: "User updated with clerkId",
                    received: true,
                });
            }

            // Create the corresponding user in MongoDB
            try {
                const newUser = await User.create({
                    clerkId,
                    email,
                    fullName,
                    profilePic,
                });

                console.log("User successfully created in MongoDB with ID:", newUser._id);
            } catch (createError) {
                // Handle duplicate key race conditions (code 11000) gracefully
                if (createError.code === 11000) {
                    console.log(`Duplicate key (11000) for clerkId ${clerkId} (handled idempotently)`);
                    return res.status(200).json({
                        message: "User already exists",
                        received: true,
                    });
                }
                throw createError;
            }

            return res.status(200).json({
                message: "User created successfully",
                received: true,
            });
        }

        if (evt.type === "user.updated") {
            const u = evt.data;

            const firstName = u.first_name || "";
            const lastName = u.last_name || "";

            const email =
                u.email_addresses?.find(
                    (e) => e.id === u.primary_email_address_id
                )?.email_address ||
                u.email_addresses?.[0]?.email_address;

            const fullName =
                [firstName, lastName].filter(Boolean).join(" ").trim() ||
                u.username ||
                email?.split("@")[0] ||
                "User";

            const profilePic = u.image_url || "";

            await User.findOneAndUpdate(
                { clerkId: u.id },
                {
                    ...(email && { email }),
                    fullName,
                    profilePic,
                },
                { returnDocument: "after" }
            );

            console.log(`User updated in MongoDB for clerkId: ${u.id}`);
            return res.status(200).json({
                message: "User updated",
                received: true,
            });
        }

        if (evt.type === "user.deleted") {
            if (evt.data?.id) {
                await User.findOneAndDelete({
                    clerkId: evt.data.id,
                });

                console.log(`User deleted from MongoDB for clerkId: ${evt.data.id}`);
            }

            return res.status(200).json({
                message: "User deleted",
                received: true,
            });
        }

        // Return HTTP 200 for any other event types sent by Clerk
        return res.status(200).json({
            message: `Event ${evt.type} received`,
            received: true,
        });
    } catch (processError) {
        console.error("Error processing Clerk webhook payload:", processError);
        return res.status(500).json({
            message: "Webhook payload processing failed",
            error: processError.message || "Internal database or server error",
        });
    }
});

export default router;
