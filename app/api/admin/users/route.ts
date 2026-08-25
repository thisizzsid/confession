import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { adminDb, adminMessaging } from "@/lib/firebase-admin";
import { adminCookieName, isAdminSessionValid } from "@/lib/admin-auth";

function authorized(request: Request) {
  const session = request.headers.get("cookie")?.match(new RegExp(`${adminCookieName}=([^;]+)`))?.[1];
  return isAdminSessionValid(session);
}

function getAdminEmail() {
  return process.env.MAIL_TO || process.env.MAIL_USER || "";
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const search = new URL(request.url).searchParams.get("q")?.trim().toLowerCase() || "";
  if (search.length < 2) return NextResponse.json({ users: [] });

  const snapshot = await adminDb.collection("users").limit(500).get();
  const users = snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((user: any) => (user.username || "").toLowerCase().includes(search))
    .slice(0, 20)
    .map((user: any) => ({
      uid: user.uid || user.id,
      username: user.username || "Anonymous",
      email: user.email || "",
      isBlocked: user.isBlocked === true,
    }));

  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { uid, action } = await request.json();
    if (typeof uid !== "string" || !uid || !["block", "unblock"].includes(action)) {
      return NextResponse.json({ error: "Invalid user action" }, { status: 400 });
    }

    const userRef = adminDb.collection("users").doc(uid);
    const userSnapshot = await userRef.get();
    if (!userSnapshot.exists) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const user = userSnapshot.data() || {};
    const isBlocked = action === "block";
    await userRef.update({ isBlocked, blockedAt: isBlocked ? new Date() : null });

    if (isBlocked) {
      const adminEmail = getAdminEmail();
      const blockMessage = `You are blocked by admin. Email ${adminEmail || "support"} to request an unblock.`;
      await userRef.collection("notifications").add({
        type: "system",
        fromName: "Confession Admin",
        message: blockMessage,
        createdAt: new Date(),
        read: false,
      });
      const tokens = Array.isArray(user.fcmTokens) ? [...new Set(user.fcmTokens.filter((token) => typeof token === "string"))] : [];
      if (tokens.length > 0) {
        await adminMessaging.sendEachForMulticast({
          tokens,
          notification: { title: "Account access update", body: blockMessage },
          data: { type: "system", url: "/notifications" },
        });
      }
    } else {
      const adminEmail = getAdminEmail();
      if (!adminEmail) {
        return NextResponse.json({ success: true, emailSent: false, warning: "MAIL_TO or MAIL_USER is not configured." });
      }

      const transporter = nodemailer.createTransport({
        host: process.env.MAIL_HOST,
        port: Number(process.env.MAIL_PORT || 465),
        secure: process.env.MAIL_SECURE !== "false",
        auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
      });
      await transporter.sendMail({
        from: process.env.MAIL_FROM || process.env.MAIL_USER,
        to: adminEmail,
        subject: `User unblock request: ${user.username || uid}`,
        text: `The user ${user.username || "Anonymous"} (${user.email || "no email"}, UID ${uid}) was unblocked by an admin.`,
      });
    }

    return NextResponse.json({ success: true, isBlocked, emailSent: !isBlocked });
  } catch (error) {
    console.error("Admin user action failed:", error);
    return NextResponse.json({ error: "Unable to update user" }, { status: 500 });
  }
}
