import { SYSTEM_PROMPTS } from "./prompts";

// OpenRouter API configuration
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL_ID = "google/gemini-3-flash-preview";

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
    type: "natural" | "yaml",
    mode: "image" | "video",
    referenceImages: string[] = [],
    promptMode: "general" | "photoreal" = "photoreal"
): Promise<string> {
    let systemPrompt: string;

    if (mode === "video") {
        const subMode = referenceImages.length > 0 ? "image_to_video" : "text_to_video";
        // @ts-ignore - Dynamic access to new structure
        systemPrompt = SYSTEM_PROMPTS.video[promptMode][subMode][type];
    } else {
        // @ts-ignore - Dynamic access
        systemPrompt = SYSTEM_PROMPTS.image[promptMode][type];
    }

    return callOpenRouter(prompt, systemPrompt, referenceImages);
}

export async function expandPromptWithPresets(
    userContext: string,
    technicalSpecs: string,
    referenceImages: string[] = []
): Promise<string> {
    // Import the dedicated studio prompt
    const { STUDIO_PROMPT } = await import('./prompts');

    // Parse the technical specs into structured fields
    const specLines = technicalSpecs.split('\n').filter(line => line.trim());

    // Extract specific values from the spec lines
    let angle = '';
    let framing = '';
    let lens = '';
    let dutchTilt = '';
    let aperture = '';
    let shutter = '';
    let camera = '';
    let stock = '';
    let iso = '';

    for (const line of specLines) {
        const lowerLine = line.toLowerCase();

        // Angle detection (horizontal + vertical)
        if (lowerLine.includes('angle') || lowerLine.includes('level') ||
            lowerLine.includes('overhead') || lowerLine.includes('worm') ||
            lowerLine.includes('front') || lowerLine.includes('side') ||
            lowerLine.includes('back') || lowerLine.includes('perspective')) {
            angle = angle ? `${angle}, ${line}` : line;
        }
        // Framing detection
        else if (lowerLine.includes('shot') || lowerLine.includes('close-up') ||
            lowerLine.includes('closeup') || lowerLine.includes('wide') ||
            lowerLine.includes('medium') || lowerLine.includes('full')) {
            framing = line;
        }
        // Dutch tilt
        else if (lowerLine.includes('dutch') || lowerLine.includes('tilt')) {
            dutchTilt = line;
        }
        // Lens
        else if (lowerLine.includes('lens') || lowerLine.includes('mm ')) {
            lens = line;
        }
        // Aperture
        else if (lowerLine.includes('f/') || lowerLine.includes('aperture')) {
            aperture = line;
        }
        // Shutter
        else if (lowerLine.includes('shutter') || lowerLine.match(/1\/\d+/)) {
            shutter = line;
        }
        // Camera
        else if (lowerLine.includes('shot on') || lowerLine.includes('arri') ||
            lowerLine.includes('red') || lowerLine.includes('sony') ||
            lowerLine.includes('panavision') || lowerLine.includes('film') ||
            lowerLine.includes('imax')) {
            camera = line;
        }
        // Film stock
        else if (lowerLine.includes('portra') || lowerLine.includes('cinestill') ||
            lowerLine.includes('velvia') || lowerLine.includes('gold') ||
            lowerLine.includes('tri-x') || lowerLine.includes('film look')) {
            stock = line;
        }
        // ISO
        else if (lowerLine.includes('iso')) {
            iso = line;
        }
    }

    // Build structured input format for the VLM
    const structuredInput = `
[SCENE]: ${userContext}
[ANGLE]: ${angle || 'Not specified'}
[FRAMING]: ${framing || 'Not specified'}
[LENS]: ${lens || 'Not specified'}
[DUTCH_TILT]: ${dutchTilt || '0'}
[APERTURE]: ${aperture || 'Not specified'}
[SHUTTER]: ${shutter || 'Not specified'}
[CAMERA]: ${camera || 'Not specified'}
[STOCK]: ${stock || 'Not specified'}
[ISO]: ${iso || 'Not specified'}
`.trim();

    // Use the dedicated STUDIO_PROMPT with the structured input
    return callOpenRouter(structuredInput, STUDIO_PROMPT, referenceImages);
}

export async function alterPrompt(
    currentPrompt: string,
    instruction: string,
    mode: "image" | "video",
    promptMode: "general" | "photoreal" = "photoreal"
): Promise<string> {
    const systemPrompt = SYSTEM_PROMPTS.alteration[promptMode][mode];
    const userMessage = `CURRENT PROMPT: \n${currentPrompt}\n\nINSTRUCTION: \n${instruction}`;
    return callOpenRouter(userMessage, systemPrompt, []);
}
