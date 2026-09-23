import "dotenv/config";
import mongoose from "mongoose";
import { Webhook } from "standardwebhooks";

const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = `http://localhost:${PORT}/api/webhooks/clerk`;
const SIGNING_SECRET = process.env.CLERK_WEBHOOK_SIGNING_SECRET?.trim();
const MONGO_URI = process.env.MONGO_URI;

async function run() {
    console.log("==================================================");
    console.log("CLERK WEBHOOK & MONGODB DIAGNOSTIC SUITE");
    console.log("==================================================");

    // 1. Check Environment Variables
    if (!SIGNING_SECRET) {
        console.error("❌ CLERK_WEBHOOK_SIGNING_SECRET is missing from .env!");
        process.exit(1);
    }
    console.log("✅ CLERK_WEBHOOK_SIGNING_SECRET loaded:", SIGNING_SECRET.substring(0, 10) + "...");

    if (!MONGO_URI) {
        console.error("❌ MONGO_URI is missing from .env!");
        process.exit(1);
    }

    // 2. Test MongoDB Connection
    console.log("\n[1/4] Connecting to MongoDB...");
    try {
        await mongoose.connect(MONGO_URI);
        console.log(`✅ MongoDB connected successfully! (Database: "${mongoose.connection.name}")`);
    } catch (err) {
        console.error("❌ MongoDB connection failed:", err.message);
        process.exit(1);
    }

    // 3. Prepare Mock Svix Webhook Payload
    console.log("\n[2/4] Signing test user.created webhook event with Svix...");
    const testClerkId = `user_diag_${Date.now()}`;
    const testEmail = `diagnostic_${Date.now()}@example.com`;

    const payloadObj = {
        data: {
            id: testClerkId,
            first_name: "Diagnostic",
            last_name: "Tester",
            email_addresses: [
                {
                    id: "idn_diagnostic_primary",
                    email_address: testEmail,
                },
            ],
            primary_email_address_id: "idn_diagnostic_primary",
            image_url: "https://example.com/avatar.jpg",
        },
        object: "event",
        type: "user.created",
    };

    const payload = JSON.stringify(payloadObj);
    const msgId = `msg_diag_${Date.now()}`;
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const wh = new Webhook(SIGNING_SECRET);
    const signature = wh.sign(msgId, new Date(parseInt(timestamp) * 1000), payload);

    console.log("✅ Signature generated successfully using CLERK_WEBHOOK_SIGNING_SECRET.");

    // 4. Send Webhook Request to Local Server
    console.log(`\n[3/4] Sending POST request to ${WEBHOOK_URL}...`);
    let response;
    try {
        response = await fetch(WEBHOOK_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "svix-id": msgId,
                "svix-timestamp": timestamp,
                "svix-signature": signature,
            },
            body: payload,
        });
    } catch (err) {
        console.error(`❌ Failed to connect to local server at ${WEBHOOK_URL}:`, err.message);
        console.error("👉 Make sure your server is running (`npm run dev`) on port", PORT);
        await mongoose.disconnect();
        process.exit(1);
    }

    const resBody = await response.text();
    console.log(`HTTP Status: ${response.status} ${response.statusText}`);
    console.log("Server Response Body:", resBody);

    if (response.status !== 200) {
        console.error("❌ Server returned non-200 status code!");
        await mongoose.disconnect();
        process.exit(1);
    }
    console.log("✅ Server accepted and processed the webhook!");

    // 5. Verify User Was Created in MongoDB
    console.log("\n[4/4] Verifying user document in MongoDB collection...");
    const createdUser = await mongoose.connection.db
        .collection("users")
        .findOne({ clerkId: testClerkId });

    if (!createdUser) {
        console.error("❌ User not found in MongoDB!");
        await mongoose.disconnect();
        process.exit(1);
    }

    console.log("✅ User found in MongoDB:");
    console.log({
        _id: createdUser._id,
        clerkId: createdUser.clerkId,
        email: createdUser.email,
        fullName: createdUser.fullName,
        createdAt: createdUser.createdAt,
    });

    // Cleanup
    await mongoose.connection.db.collection("users").deleteOne({ clerkId: testClerkId });
    console.log("🧹 Test user cleaned up from MongoDB.");

    await mongoose.disconnect();
    console.log("\n🎉 ALL TESTS PASSED: Webhook verification and MongoDB user creation are 100% WORKING!");
}

run().catch((err) => {
    console.error("Unexpected error:", err);
    process.exit(1);
});
