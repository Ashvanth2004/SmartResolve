import { NextResponse } from "next/server";
import { z } from "zod";

import { SYSTEM_PROMPT } from "@/lib/master-prompt";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(4000),
});

const BodySchema = z.object({
  messages: z.array(MessageSchema).min(1).max(40),
});

export async function POST(request: Request) {
  try {
    // Allow unauthenticated use from the public-facing support widget
    const body = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const { messages } = parsed.data;

    // Provider selection: Ollama (local) -> OpenAI (remote) -> Built-in fallback
    const ollamaBaseUrl = process.env.OLLAMA_BASE_URL?.trim() || "http://localhost:11434/v1";
    const ollamaModel = process.env.OLLAMA_MODEL?.trim() || "llama3";
    const openaiApiKey = process.env.OPENAI_API_KEY?.trim();
    const openaiBaseUrl = process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1";
    const openaiModel = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

    let content = "";
    let usedModel = "support-ai-built-in";

    // 1. Try Ollama first - runs locally, no API key required
    try {
      const res = await fetch(`${ollamaBaseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: ollamaModel,
          temperature: 0.4,
          max_tokens: 1024,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...messages,
          ],
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) {
        const data = await res.json();
        content = data?.choices?.[0]?.message?.content || "";
        usedModel = `ollama:${ollamaModel}`;
      } else {
        console.warn("[support-chat] Ollama returned non-200:", res.status, "— trying OpenAI.");
      }
    } catch (err) {
      console.warn("[support-chat] Ollama unavailable:", err, "— trying OpenAI.");
    }

    // 2. Try OpenAI-compatible API if Ollama did not produce a response
    if (!content && openaiApiKey) {
      try {
        const res = await fetch(`${openaiBaseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openaiApiKey}`,
          },
          body: JSON.stringify({
            model: openaiModel,
            temperature: 0.4,
            max_tokens: 1024,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              ...messages,
            ],
          }),
        });

        if (res.ok) {
          const data = await res.json();
          content = data?.choices?.[0]?.message?.content || "";
          usedModel = openaiModel;
        } else {
          const errText = await res.text().catch(() => "");
          console.warn("[support-chat] OpenAI call returned non-200:", res.status, errText, "— falling back to built-in engine.");
        }
      } catch (err) {
        console.warn("[support-chat] OpenAI request error:", err, "— falling back to built-in engine.");
      }
    }

    // 3. Built-in keyword-based fallback
    if (!content) {
      const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content || "";
      content = generateSupportFallbackResponse(lastUserMsg);
    }

    return NextResponse.json({ content, model: usedModel });
  } catch (e) {
    console.error("[support-chat]", e);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

function generateSupportFallbackResponse(userPrompt: string): string {
  const query = userPrompt.toLowerCase();

  const isDataRisk = /\b(password|account|recovery|payment|charge|refund|card|privacy|hack|file|format|wipe|delete|erase)\b/.test(query);
  const safetyWarning = isDataRisk
    ? "⚠️ **Safety Warning:** Protect your personal privacy. Never share your password, PIN, or credit card CVV with anyone. Make sure to back up important files before making system changes.\n\n"
    : "";

  // 1. Internet / Connectivity
  if (/\b(internet|wifi|wi-fi|connect|disconnect|disconnecting|network|modem|router|offline|drop|ping|dns)\b/.test(query)) {
    return `Topic: Internet & Network Connectivity

Answer:
${safetyWarning}I understand that your internet connection keeps disconnecting. Here are the steps you can follow to fix it:

1. **Restart Your Router & Modem**: Unplug the power cord from your modem and Wi-Fi router, wait 30 seconds, and plug them back in. Wait 2 minutes for all indicator lights to turn solid green.
2. **Forget and Reconnect to Wi-Fi**: Open Wi-Fi settings on your device, tap **Forget Network**, and re-enter your Wi-Fi password.
3. **Turn Off Network Adapter Power Saving**: If using Windows, open Device Manager -> expand Network Adapters -> right-click your Wi-Fi card -> Properties -> Power Management -> uncheck *"Allow the computer to turn off this device to save power"*.
4. **Reset Network Settings**: Open Command Prompt (or Terminal) and run:
   \`\`\`bash
   netsh winsock reset
   ipconfig /flushdns
   \`\`\`
   Then restart your device.

To help solve this, please share:
- Which device and operating system are you using? (e.g. Windows 11, Mac, iPhone, Android)
- Are all devices in your home disconnecting, or only one specific device?
- When did this disconnection issue start happening?

You may also ask:
- "Why does my Wi-Fi disconnect on only one device?"
- "What exact error message do you see when internet drops?"
- "Did this happen after a recent software update?"
- "Have you already tried restarting the device?"
- "How do I reset my router without losing settings?"`;
  }

  // 2. Account Access & Password Reset
  if (/\b(password|login|log in|sign in|account|locked|access|2fa|authenticator|username)\b/.test(query)) {
    return `Topic: Account Access & Password Recovery

Answer:
${safetyWarning}I understand you are having trouble signing into your account. Follow these steps to restore access:

1. **Use Password Reset**: Click the **Forgot Password?** link on the sign-in page and enter your registered email address.
2. **Check Inbox & Spam Folder**: Open the verification link sent to your email address within 15 minutes.
3. **Clear Browser Cookies & Cache**: Delete temporary browser cache in your browser privacy settings to prevent cached session loops.
4. **Check Caps Lock & Keyboard**: Verify Caps Lock is off and your password is entered with correct letter casing.

To help solve this, please share:
- What app or account name are you trying to log into?
- What exact error message appears on your screen when you try signing in?
- Have you received the password reset verification email?

You may also ask:
- "What exact error message do you see?"
- "When did this login issue start?"
- "Did this happen after changing your password or security settings?"
- "Have you already tried clearing your browser cache?"
- "How do I regain access if 2-Factor Authentication fails?"`;
  }

  // 3. Software Crash & Mobile Apps
  if (/\b(crash|freez|slow|lag|app|software|update|screen|blue screen|bsod|hang|performance|phone|mobile)\b/.test(query)) {
    return `Topic: Software & Mobile App Troubleshooting

Answer:
${safetyWarning}I understand that your software app or device is crashing, freezing, or running slowly. Here is how to resolve it:

1. **Force Close & Re-open**: Close the app completely from your task switcher or Task Manager (\`Ctrl + Shift + Esc\` on Windows) and open it again.
2. **Restart Your Device**: Turn off your phone or computer and power it back on to clear stuck memory.
3. **Update the App & System**: Open your device App Store or system settings and install any pending updates.
4. **Free Up Storage Space**: Make sure your phone or computer has at least 15% free storage space available.

To help solve this, please share:
- Which app or software is crashing or freezing?
- Which device and operating system are you using? (e.g. Android 14, iOS 17, Windows 11)
- Did this crash start happening after a recent app update?

You may also ask:
- "What exact error message do you see?"
- "Which device are you using?"
- "When did this issue start?"
- "Did this happen after an update?"
- "Have you already tried restarting the device?"`;
  }

  // 4. Payments & Billing
  if (/\b(payment|bill|charge|refund|card|deducted|invoice|money|subscription|pricing)\b/.test(query)) {
    return `Topic: Payments & Billing Support

Answer:
${safetyWarning}I understand you have a question or concern regarding a payment or subscription charge. Here is how to handle it:

1. **Check Transaction Receipt**: Review your bank statement or email confirmation receipt to verify charge details and transaction reference number.
2. **Verify Pending Status**: Some pending card authorizations clear automatically within 3–5 business days.
3. **Submit a Support Request**: If charged twice or improperly, submit a refund request with your transaction ID attached.

To help solve this, please share:
- What is the payment method used? (Credit Card, Debit Card, PayPal, UPI)
- Were you charged multiple times for the same transaction?
- What date did the payment deduction occur?

You may also ask:
- "What exact error message do you see on the payment page?"
- "Did you receive a payment confirmation email?"
- "When did this charge issue happen?"
- "Have you already contacted your bank?"
- "How long does a refund take to process?"`;
  }

  // 5. Default General Technical Support
  return `Topic: Technical Support & Troubleshooting

Answer:
${safetyWarning}I understand you are experiencing a technical issue with your software or device. Here are initial steps to troubleshoot:

1. **Restart Your Device**: Powering off and restarting resolves most temporary software glitches.
2. **Check for Available Updates**: Ensure your operating system and application have installed all recent updates.
3. **Verify Internet & Permissions**: Make sure your device has an active internet connection and necessary administrative permissions.

To help solve this, please share:
- Which device and operating system are you using?
- What exact app, software, or feature is causing the problem?
- What were you trying to do right before the issue occurred?

You may also ask:
- "What exact error message do you see?"
- "Which device are you using?"
- "When did this issue start?"
- "Did this happen after an update?"
- "Have you already tried restarting the device?"`;
}


