import express from "express";
import User from "../models/user.model.js";
import { verifyWebhook } from "@clerk/express/webhooks";

const router = express.Router();

router.get("/", (req, res) => {
    res.send("Clerk webhook route is working");
});

router.post("/", express.raw({ type: "application/json" }), async (req, res) => {
    let evt;

  // 1. Verification
    try {
        evt = await verifyWebhook(req, {
            signingSecret: process.env.CLERK_WEBHOOK_SIGNING_SECRET,
    });
} catch (error) {
    console.error("Webhook verification failed:", error.message);
    return res.status(400).json({ message: "Webhook verification failed" });
}


console.log("Clerk webhook received:", evt.type);

    if (evt.type !== "user.created") {
    return res.status(200).json({ message: "Event ignored" });
}

  // 2. Save user
    try {
    const user = evt.data;
    const clerkId = user.id;

        const email =
            user.email_addresses?.find((e) => e.id === user.primary_email_address_id)
        ?.email_address || user.email_addresses?.[0]?.email_address;


     const fullName =
      [user.first_name, user.last_name].filter(Boolean).join(" ") ||
      user.username ||
      "Clerk User";

    const profilePic = user.image_url || "";

    if (!email) {
      console.error("No email found for Clerk user:", clerkId);
      return res.status(200).json({ message: "No email, skipped" });
    }

      await User.findOneAndUpdate(

          { clerkId },
      { $setOnInsert: { clerkId, email, fullName, profilePic } },
      { upsert: true }
    );

    console.log("User saved in MongoDB:", clerkId);
    return res.status(200).json({ message: "User created successfully" });
  } catch (error) {
    console.error("Database error:", error);
    return res.status(500).json({ message: "Internal error" });
  }
});

export default router;