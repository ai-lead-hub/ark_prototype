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

        // Remove markdown code blocks and bolding
        cleanContent = cleanContent.replace(/^```(?:yaml|json)?\s*/i, "").replace(/\s*```$/, "").replace(/\*\*/g, "");

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
    referenceImages: string[] = [],
    promptMode: "general" | "photoreal" = "photoreal"
): Promise<string> {
    const systemPrompt = SYSTEM_PROMPTS[mode][promptMode][type];
    return callFalLlm(prompt, systemPrompt, referenceImages);
}

export async function expandPromptWithPresets(
    userContext: string,
    technicalSpecs: string,
    referenceImages: string[] = []
): Promise<string> {
    // Import the dedicated studio prompt
    const { STUDIO_PROMPT } = await import('./prompts');

    // Split specs into lines for categorization
    const specLines = technicalSpecs.split('\n').filter(line => line.trim());

    // Categorize: Camera angle, framing, and dutch tilt are HIGH PRIORITY
    // These should be woven into the first sentence naturally
    const highPriority: string[] = [];
    const technical: string[] = [];

    for (const line of specLines) {
        const lowerLine = line.toLowerCase();
        // High priority: angle/position keywords, framing/shot types, dutch tilt
        if (
            lowerLine.includes('angle') ||
            lowerLine.includes('level') ||
            lowerLine.includes('overhead') ||
            lowerLine.includes('worm') ||
            lowerLine.includes('front') ||
            lowerLine.includes('side') ||
            lowerLine.includes('back') ||
            lowerLine.includes('perspective') ||
            lowerLine.includes('shot') ||
            lowerLine.includes('close-up') ||
            lowerLine.includes('closeup') ||
            lowerLine.includes('wide') ||
            lowerLine.includes('medium') ||
            lowerLine.includes('full') ||
            lowerLine.includes('dutch') ||
            lowerLine.includes('tilt')
        ) {
            highPriority.push(line);
        } else {
            technical.push(line);
        }
    }

    const fullPrompt = `
=== CAMERA ANGLE & FRAMING (weave into FIRST SENTENCE) ===
${highPriority.join('\n') || 'Not specified'}

=== SCENE DESCRIPTION ===
${userContext}

=== TECHNICAL SPECS (place at END) ===
${technical.join('\n') || 'Not specified'}
`.trim();

    // Use the dedicated STUDIO_PROMPT with deep photography knowledge
    return callFalLlm(fullPrompt, STUDIO_PROMPT, referenceImages);
}

export async function alterPrompt(
    currentPrompt: string,
    instruction: string,
    mode: "image" | "video",
    promptMode: "general" | "photoreal" = "photoreal"
): Promise<string> {
    const systemPrompt = SYSTEM_PROMPTS.alteration[promptMode][mode];
    const userMessage = `CURRENT PROMPT: \n${currentPrompt}\n\nINSTRUCTION: \n${instruction}`;
    return callFalLlm(userMessage, systemPrompt, []);
}
