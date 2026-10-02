
import express from "express";
import User from "../models/User.js";
import { verifyWebhook } from "@clerk/express/webhooks";

const router = express.Router();

router.post("/", async (req, res) => {
  // 1. Make sure the signing secret is in .env
  const signingSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!signingSecret) {
    console.error("CLERK_WEBHOOK_SIGNING_SECRET is missing in .env");
    return res.status(500).json({ error: "Signing secret not configured" });
  }

  // 2. Check the request really comes from Clerk
  //    (@clerk/express takes Express's req directly, no need to build a Request)
  let evt;
  try {
    evt = await verifyWebhook(req, { signingSecret });
  } catch (error) {
    console.error("Webhook verification failed:", error);
    return res.status(400).json({ error: "Webhook verification failed" });
  }

  console.log("Webhook received:", evt.type, evt.data.id);

  // 3. Save to MongoDB
  try {
    if (evt.type === "user.created" || evt.type === "user.updated") {
      const u = evt.data;

      const email =
        u.email_addresses?.find((e) => e.id === u.primary_email_address_id)?.email_address ??
        u.email_addresses?.[0]?.email_address;

      const fullName =
        [u.first_name, u.last_name].filter(Boolean).join(" ") ||
        u.username ||
        email?.split("@")[0];

      await User.findOneAndUpdate(
        { clerkId: u.id },
        { clerkId: u.id, email, fullName, profilePic: u.image_url },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      console.log("User saved to MongoDB:", email);
    }

    if (evt.type === "user.deleted" && evt.data.id) {
      await User.findOneAndDelete({ clerkId: evt.data.id });
      console.log("User deleted from MongoDB:", evt.data.id);
    }

    // 4. Always answer Clerk, or it thinks the webhook failed
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Error saving user to MongoDB:", error);
    return res.status(500).json({ error: "Database error" });
  }
});

export default router;