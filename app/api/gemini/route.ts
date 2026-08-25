import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const text = body.text;
    const mode = body.mode;

    if (!text || !mode) {
      return NextResponse.json(
        { error: "Missing text or mode" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing Gemini API key" },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    let prompt = "";

    switch (mode) {
      case "emotion":
        prompt = `
Act like an emotional therapist. 
Reply in 2–3 supportive sentences:
"${text}"`;
        break;

      case "moderate":
        prompt = `
Return SAFE or UNSAFE for this:
"${text}"`;
        break;

      case "tags":
        prompt = `
Return comma tags for:
"${text}"`;
        break;

      case "title":
        prompt = `
Return a 3–5 word title:
"${text}"`;
        break;

      case "chat":
        prompt = `
You are Confession AI, a helpful, empathetic, and witty companion built by SA Studios (USA).
You are chatting with a user in a safe confession space.
Be supportive, non-judgmental, and engaging.
Keep responses concise (under 3 sentences unless asked for more).
User says: "${text}"`;
        break;

      default:
        return NextResponse.json(
          { error: "Invalid mode" },
          { status: 400 }
        );
    }

    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    const output = result.text?.trim() || "";

    return NextResponse.json({ output });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Server processing error" },
      { status: 500 }
    );
  }
}
