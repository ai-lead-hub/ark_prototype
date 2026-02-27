import { SYSTEM_PROMPTS } from "./prompts";

// OpenRouter API configuration
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL_ID = "google/gemini-3-flash-preview:nitro";

function getOpenRouterKey(): string {
    const key = import.meta.env.VITE_OPENROUTER_KEY;
    if (!key) {
        throw new Error("Missing VITE_OPENROUTER_KEY. Add it to .env.local and restart the app.");
    }
    return key;
}

interface OpenRouterMessage {
    role: "system" | "user" | "assistant";
    content: string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
}

interface OpenRouterResponse {
    choices?: Array<{
        message?: {
            content?: string;
        };
    }>;
    error?: {
        message?: string;
    };
}

async function callOpenRouter(
    prompt: string,
    systemPrompt: string,
    referenceImages: string[] = []
): Promise<string> {
    const key = getOpenRouterKey();

    // Build messages array
    const messages: OpenRouterMessage[] = [
        { role: "system", content: systemPrompt },
    ];

    // Build user content - text + optional images
    if (referenceImages.length > 0) {
        const userContent: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [
            { type: "text", text: prompt },
        ];
        for (const imageUrl of referenceImages) {
            userContent.push({
                type: "image_url",
                image_url: { url: imageUrl },
            });
        }
        messages.push({ role: "user", content: userContent });
    } else {
        messages.push({ role: "user", content: prompt });
    }

    try {
        const response = await fetch(OPENROUTER_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${key}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://ai-scape.app",
                "X-Title": "AI-Scape Studio",
            },
            body: JSON.stringify({
                model: MODEL_ID,
                messages,
                temperature: 1,
                reasoning: {
                    effort: "medium",
                },
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
        }

        const data: OpenRouterResponse = await response.json();

        if (data.error) {
            throw new Error(`OpenRouter error: ${data.error.message || "Unknown error"}`);
        }

        const content = data.choices?.[0]?.message?.content;
        if (typeof content !== "string") {
            throw new Error("Invalid or missing content received from OpenRouter.");
        }

        // Clean up response - remove markdown code blocks and bolding
        let cleanContent = content.trim();
        cleanContent = cleanContent.replace(/^```(?:yaml|json)?\s*/i, "").replace(/\s*```$/, "").replace(/\*\*/g, "");

        return cleanContent.trim();
    } catch (error) {
        console.error("Error with OpenRouter:", error);
        throw error;
    }
}

export async function expandPrompt(
    prompt: string,
    _type: "natural", // kept for API compatibility, always natural
    mode: "image" | "video",
    referenceImages: string[] = [],
    promptMode: "photoreal" | "audiogen" | "editing" | "timestep" | "gridgen" = "photoreal"
): Promise<string> {
    let systemPrompt: string;

    if (mode === "video") {
        const subMode = referenceImages.length > 0 ? "image_to_video" : "text_to_video";
        // audiogen is for video with audio; timestep is for beat-by-beat; all others use photoreal
        const videoMode = promptMode === "audiogen" ? "audiogen" : promptMode === "timestep" ? "timestep" : "photoreal";
        systemPrompt = SYSTEM_PROMPTS.video[videoMode][subMode];
    } else {
        // audiogen and timestep are video-only modes; fall back to photoreal for image context
        const imageMode = (promptMode === "audiogen" || promptMode === "timestep") ? "photoreal" : promptMode;
        systemPrompt = SYSTEM_PROMPTS.image[imageMode].natural;
    }

    return callOpenRouter(prompt, systemPrompt, referenceImages);
}

export async function alterPrompt(
    currentPrompt: string,
    instruction: string,
    mode: "image" | "video",
    promptMode: "photoreal" | "audiogen" | "editing" | "timestep" | "gridgen" = "photoreal"
): Promise<string> {
    // only photoreal has a dedicated alteration prompt; all others fall back to photoreal
    const actualMode = promptMode === "photoreal" ? "photoreal" : "general";
    const systemPrompt = SYSTEM_PROMPTS.alteration[actualMode][mode];
    const userMessage = `CURRENT PROMPT: \n${currentPrompt}\n\nINSTRUCTION: \n${instruction}`;
    return callOpenRouter(userMessage, systemPrompt, []);
}

export async function expandKlingO1ReferencePrompt(
    userPrompt: string,
    imageCount: number,
    elementCount: number
): Promise<string> {
    const systemPrompt = SYSTEM_PROMPTS.klingO1Reference;

    // Build context about available references
    const availableRefs: string[] = [];
    for (let i = 1; i <= imageCount; i++) {
        availableRefs.push(`@Image${i}${i === 1 ? ' (start frame)' : ' (style reference)'}`);
    }
    for (let i = 1; i <= elementCount; i++) {
        availableRefs.push(`@Element${i}`);
    }

    const userMessage = availableRefs.length > 0
        ? `User prompt: "${userPrompt}"\n\nAvailable references: ${availableRefs.join(', ')}`
        : `User prompt: "${userPrompt}"`;

    return callOpenRouter(userMessage, systemPrompt, []);
}
