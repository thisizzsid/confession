import { NextResponse } from "next/server";
import { adminDb, adminMessaging } from "@/lib/firebase-admin";
import { adminCookieName, isAdminSessionValid } from "@/lib/admin-auth";

const MAX_TITLE_LENGTH = 80;
const MAX_BODY_LENGTH = 500;

function validUrl(value: unknown) {
  if (!value) return true;
  if (typeof value !== "string" || value.length > 500) return false;
  try {
    const url = new URL(value, "https://confession.local");
    return url.protocol === "https:" || (url.protocol === "https:" && url.hostname === "confession.local");
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const session = req.headers.get("cookie")?.match(new RegExp(`${adminCookieName}=([^;]+)`))?.[1];
    if (!isAdminSessionValid(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { title, body, image, link } = await req.json();

    if (typeof title !== "string" || typeof body !== "string" || !title.trim() || !body.trim()) {
      return NextResponse.json({ error: "Missing title or body" }, { status: 400 });
    }
    if (title.length > MAX_TITLE_LENGTH || body.length > MAX_BODY_LENGTH || !validUrl(image) || !validUrl(link)) {
      return NextResponse.json({ error: "Campaign content is too long or contains an invalid URL" }, { status: 400 });
    }

    // Fetch all users with notifications enabled
    const usersSnapshot = await adminDb.collection("users").get();
    
    let tokens: string[] = [];
    
    usersSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.notificationsEnabled !== false && Array.isArray(data.fcmTokens) && data.fcmTokens.length > 0) {
        tokens.push(...data.fcmTokens);
      }
    });

    // Deduplicate tokens
    tokens = [...new Set(tokens)];

    if (tokens.length === 0) {
      return NextResponse.json({ message: "No users to send to" });
    }

    // Send messages in batches of 500
    const batchSize = 500;
    const batches = [];
    
    for (let i = 0; i < tokens.length; i += batchSize) {
      const batchTokens = tokens.slice(i, i + batchSize);
      
      const message: any = {
        notification: {
          title,
          body,
        },
        data: {
          click_action: link || "/feed",
          url: link || "/feed",
          type: "campaign",
        },
        tokens: batchTokens,
      };

      if (image) {
        message.notification.imageUrl = image;
      }

      batches.push(adminMessaging.sendEachForMulticast(message));
    }

    const results = await Promise.all(batches);
    
    let successCount = 0;
    let failureCount = 0;

    results.forEach((result) => {
      successCount += result.successCount;
      failureCount += result.failureCount;
    });

    return NextResponse.json({ 
      success: true, 
      sent: successCount, 
      failed: failureCount,
      total: tokens.length 
    });

  } catch (error: any) {
    console.error("Push notification error:", error);
    const errorMessage = error?.message || "Internal Server Error";
    if (errorMessage.includes("Could not load the default credentials") || errorMessage.includes("Firebase Admin")) {
      return NextResponse.json(
        { error: "Firebase Admin is not configured. Add FIREBASE_SERVICE_ACCOUNT_KEY in Vercel Environment Variables and redeploy." },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
