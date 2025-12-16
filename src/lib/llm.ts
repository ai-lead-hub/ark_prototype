import { fal } from "@fal-ai/client";
import { SYSTEM_PROMPTS } from "./prompts";
import { getFalKey } from "./fal";
const MODEL_ID = "google/gemini-2.5-flash";

async function callFalLlm(
    prompt: string,
    systemPrompt: string,
    referenceImages: string[] = []
): Promise<string> {
    const key = getFalKey();
    if (!key) {
        throw new Error("Missing VITE_FAL_KEY. Add it to .env.local and restart the app.");
    }

    // Configure Fal client
    fal.config({ credentials: key });

    const hasImages = referenceImages.length > 0;
    // Choose endpoint based on whether we have images
    const endpoint = hasImages ? "openrouter/router/vision" : "openrouter/router";

    const input: Record<string, unknown> = {
        model: MODEL_ID,
        prompt: prompt,
        system_prompt: systemPrompt,
        temperature: 1,
    };

    if (hasImages) {
        input.image_urls = referenceImages;
    }

    // console.log(`Fal Request Payload (${endpoint}):`, JSON.stringify(input, null, 2));

    try {
        const result = await fal.subscribe(endpoint, {
            input,
            logs: true,
            onQueueUpdate: (update) => {
                if (update.status === "IN_PROGRESS") {
                    // update.logs.map((log) => log.message).forEach((msg) => console.log(`[Fal ${hasImages ? "VLM" : "LLM"}]`, msg));
                }
            },
        });

        // console.log(`Fal Response (${endpoint}):`, result);

        const content = result.data?.output;

        if (typeof content !== "string") {
            throw new Error(`Invalid or missing content received from Fal ${hasImages ? "VLM" : "LLM"}.`);
        }

        let cleanContent = content.trim();

        // Remove markdown code blocks if present
        cleanContent = cleanContent.replace(/^```(?:yaml|json)?\s*/i, "").replace(/\s*```$/, "");

        return cleanContent.trim();
    } catch (error) {
        console.error(`Error with Fal ${hasImages ? "VLM" : "LLM"}:`, error);
        throw error;
    }
}

export async function expandPrompt(
    prompt: string,
    type: "natural" | "yaml",
    mode: "image" | "video",
    referenceImages: string[] = []
): Promise<string> {
    const systemPrompt = SYSTEM_PROMPTS[mode][type];
    return callFalLlm(prompt, systemPrompt, referenceImages);
}

export async function alterPrompt(
    currentPrompt: string,
    instruction: string,
    mode: "image" | "video"
): Promise<string> {
    const systemPrompt = SYSTEM_PROMPTS.alteration[mode];
    const userMessage = `CURRENT PROMPT:\n${currentPrompt}\n\nINSTRUCTION:\n${instruction}`;
    return callFalLlm(userMessage, systemPrompt, []);
}
