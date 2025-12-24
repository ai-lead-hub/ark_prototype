const fs = require('fs');
const path = require('path');
const https = require('https');

// --- CONFIGURATION ---
const API_BASE_URL = "https://api.kie.ai";
const MODEL_ID = "nano-banana-pro"; // Per user request
const OUTPUT_DIR = path.join(__dirname, '../public/assets/studio/angles');
const CONCURRENCY_LIMIT = 3; // Be gentle with the API

// --- PROMPTS ---
const TASKS = [
    // Frontal
    { filename: 'front_overhead.jpg', prompt: "Photorealistic wide shot of a man in a park. Camera Angle: Frontal View, Overhead - Front view, looking down from above" },
    { filename: 'front_high.jpg', prompt: "Photorealistic wide shot of a man in a park. Camera Angle: Frontal View, High Angle - Front view, slightly elevated" },
    { filename: 'front_eye.jpg', prompt: "Photorealistic wide shot of a man in a park. Camera Angle: Frontal View, Eye Level - Front view, straight on" },
    { filename: 'front_low.jpg', prompt: "Photorealistic wide shot of a man in a park. Camera Angle: Frontal View, Low Angle - Front view, looking up" },
    { filename: 'front_worm.jpg', prompt: "Photorealistic wide shot of a man in a park. Camera Angle: Frontal View, Worm's Eye - Front view, extreme low looking up" },

    // Perspective (3/4 View)
    { filename: 'perspective_overhead.jpg', prompt: "Photorealistic wide shot of a man in a park. Camera Angle: 3/4 View, Overhead - 45° angle, looking down" },
    { filename: 'perspective_high.jpg', prompt: "Photorealistic wide shot of a man in a park. Camera Angle: 3/4 View, High Angle - 45° angle, slightly elevated" },
    { filename: 'perspective_eye.jpg', prompt: "Photorealistic wide shot of a man in a park. Camera Angle: 3/4 View, Eye Level - 45° angle, straight on" },
    { filename: 'perspective_low.jpg', prompt: "Photorealistic wide shot of a man in a park. Camera Angle: 3/4 View, Low Angle - 45° angle, looking up" },
    { filename: 'perspective_worm.jpg', prompt: "Photorealistic wide shot of a man in a park. Camera Angle: 3/4 View, Worm's Eye - 45° angle, extreme low" },

    // Profile
    { filename: 'profile_overhead.jpg', prompt: "Photorealistic wide shot of a man in a park. Camera Angle: Profile, Overhead - Side view, looking down" },
    { filename: 'profile_high.jpg', prompt: "Photorealistic wide shot of a man in a park. Camera Angle: Profile, High Angle - Side view, slightly elevated" },
    { filename: 'profile_eye.jpg', prompt: "Photorealistic wide shot of a man in a park. Camera Angle: Profile, Eye Level - Side view, straight on" },
    { filename: 'profile_low.jpg', prompt: "Photorealistic wide shot of a man in a park. Camera Angle: Profile, Low Angle - Side view, looking up" },
    { filename: 'profile_worm.jpg', prompt: "Photorealistic wide shot of a man in a park. Camera Angle: Profile, Worm's Eye - Side view, extreme low" },

    // OTS
    { filename: 'ots_overhead.jpg', prompt: "Photorealistic wide shot of a man in a park. Camera Angle: OTS, Overhead - Over-the-shoulder, looking down" },
    { filename: 'ots_high.jpg', prompt: "Photorealistic wide shot of a man in a park. Camera Angle: OTS, High Angle - Over-the-shoulder, elevated" },
    { filename: 'ots_eye.jpg', prompt: "Photorealistic wide shot of a man in a park. Camera Angle: OTS, Eye Level - Over-the-shoulder, straight on" },
    { filename: 'ots_low.jpg', prompt: "Photorealistic wide shot of a man in a park. Camera Angle: OTS, Low Angle - Over-the-shoulder, looking up" },
    { filename: 'ots_worm.jpg', prompt: "Photorealistic wide shot of a man in a park. Camera Angle: OTS, Worm's Eye - Over-the-shoulder, extreme low" },

    // Behind
    { filename: 'behind_overhead.jpg', prompt: "Photorealistic wide shot of a man in a park. Camera Angle: Behind, Overhead - Back view, looking down" },
    { filename: 'behind_high.jpg', prompt: "Photorealistic wide shot of a man in a park. Camera Angle: Behind, High Angle - Back view, slightly elevated" },
    { filename: 'behind_eye.jpg', prompt: "Photorealistic wide shot of a man in a park. Camera Angle: Behind, Eye Level - Back view, straight on" },
    { filename: 'behind_low.jpg', prompt: "Photorealistic wide shot of a man in a park. Camera Angle: Behind, Low Angle - Back view, looking up" },
    { filename: 'behind_worm.jpg', prompt: "Photorealistic wide shot of a man in a park. Camera Angle: Behind, Worm's Eye - Back view, extreme low looking up" },
];

// --- UTILS ---

function getApiKey() {
    try {
        const envPath = path.join(__dirname, '../.env.local');
        if (!fs.existsSync(envPath)) return null;
        const content = fs.readFileSync(envPath, 'utf8');
        const match = content.match(/VITE_KIE_KEY=(.+)/);
        return match ? match[1].trim() : null;
    } catch (e) {
        return null;
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function httpsRequest(url, options, body = null) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const json = JSON.parse(data);
                        resolve(json);
                    } catch (e) {
                        // Keep raw data if not JSON (e.g. image blob, though we usually download separately)
                        resolve(data);
                    }
                } else {
                    reject(new Error(`Request failed (${res.statusCode}): ${data}`));
                }
            });
        });
        req.on('error', reject);
        if (body) req.write(typeof body === 'object' ? JSON.stringify(body) : body);
        req.end();
    });
}

async function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destPath);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download file: ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(destPath, () => { });
            reject(err);
        });
    });
}

// --- API METHODS ---

async function createTask(apiKey, prompt) {
    const payload = {
        model: MODEL_ID,
        input: {
            prompt: prompt,
            aspect_ratio: "16:9",
            resolution: "1K",
            output_format: "jpg"
        }
    };

    const response = await httpsRequest(`${API_BASE_URL}/api/v1/jobs/createTask`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        }
    }, payload);

    // Debug log
    // console.log("Create Task Response:", JSON.stringify(response));

    // Handle string response (parse error or raw body)
    let data = response;
    if (typeof response === 'string') {
        try {
            data = JSON.parse(response);
        } catch (e) {
            throw new Error(`Failed to parse response: ${response}`);
        }
    }

    // Check for different response structures
    if (data.code === 200 && data.data && data.data.taskId) {
        return data.data.taskId;
    }
    if (data.data && data.data.taskId) return data.data.taskId;
    if (data.taskId) return data.taskId;

    throw new Error(`Failed to get taskId: ${JSON.stringify(data)}`);
}

async function getTaskStatus(apiKey, taskId) {
    const response = await httpsRequest(`${API_BASE_URL}/api/v1/jobs/recordInfo?taskId=${taskId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        }
    });
    return response;
}

async function pollTask(apiKey, taskId) {
    const maxAttempts = 60;
    const interval = 3000;

    for (let i = 0; i < maxAttempts; i++) {
        const status = await getTaskStatus(apiKey, taskId);
        const state = status?.data?.state || status?.state;

        console.log(`  Polling ${taskId}: ${state || 'unknown'}...`);

        if (state === 'success') {
            const result = status.data;
            // Try to find the image URL
            let imageUrl = null;

            // Check structured resultJson
            if (result.resultJson) {
                try {
                    const parsed = JSON.parse(result.resultJson);
                    if (parsed.resultUrls && parsed.resultUrls.length > 0) imageUrl = parsed.resultUrls[0];
                    else if (parsed.images && parsed.images.length > 0) imageUrl = parsed.images[0].url;
                    else if (parsed.image_urls && parsed.image_urls.length > 0) imageUrl = parsed.image_urls[0];
                    else if (parsed.url) imageUrl = parsed.url;
                } catch (e) { }
            }

            // Direct checks
            if (!imageUrl && result.url) imageUrl = result.url;
            if (!imageUrl && result.images && result.images.length > 0) imageUrl = result.images[0].url;

            if (imageUrl) return imageUrl;
            throw new Error(`Task success but no image URL found: ${JSON.stringify(result)}`);
        }

        if (state === 'fail' || state === 'failed') {
            throw new Error(`Task failed: ${JSON.stringify(status)}`);
        }

        await delay(interval);
    }
    throw new Error("Polling timed out");
}

// --- MAIN LOOP ---

async function processTask(apiKey, task) {
    const destPath = path.join(OUTPUT_DIR, task.filename);

    if (fs.existsSync(destPath)) {
        console.log(`[SKIP] ${task.filename} already exists.`);
        return;
    }

    console.log(`[START] Generating ${task.filename}...`);
    try {
        const taskId = await createTask(apiKey, task.prompt);
        console.log(`  Task ID for ${task.filename}: ${taskId}`);

        const imageUrl = await pollTask(apiKey, taskId);
        console.log(`  Downloading ${imageUrl}...`);

        await downloadFile(imageUrl, destPath);
        console.log(`[DONE] Saved ${task.filename}`);
    } catch (err) {
        console.error(`[ERROR] Failed ${task.filename}:`, err.message);
    }
}

async function main() {
    const apiKey = getApiKey();
    if (!apiKey) {
        console.error("Error: VITE_KIE_KEY not found in .env.local");
        process.exit(1);
    }

    // Ensure output dir exists
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Process with concurrency limit
    for (let i = 0; i < TASKS.length; i += CONCURRENCY_LIMIT) {
        const chunk = TASKS.slice(i, i + CONCURRENCY_LIMIT);
        await Promise.all(chunk.map(task => processTask(apiKey, task)));
    }
}

main();
