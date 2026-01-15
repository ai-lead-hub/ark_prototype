#!/usr/bin/env node
/**
 * Test script for Freepik Magnific Image Upscaler API
 * 
 * Usage: node scripts/test-magnific.cjs
 * 
 * Requires VITE_FREEPIK_KEY in .env.local
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const FREEPIK_BASE_URL = 'https://api.freepik.com/v1/ai';

// Get API key from environment
const FREEPIK_KEY = process.env.VITE_FREEPIK_KEY;

if (!FREEPIK_KEY) {
    console.error('❌ Missing VITE_FREEPIK_KEY in .env.local');
    process.exit(1);
}

console.log('✅ Found VITE_FREEPIK_KEY');

// Convert image to base64
function imageToBase64(imagePath) {
    const absolutePath = path.isAbsolute(imagePath)
        ? imagePath
        : path.join(__dirname, '..', imagePath);

    if (!fs.existsSync(absolutePath)) {
        throw new Error(`Image not found: ${absolutePath}`);
    }

    const buffer = fs.readFileSync(absolutePath);
    return buffer.toString('base64');
}

// Start upscale task
async function startUpscaleTask(imageBase64, options = {}) {
    const endpoint = `${FREEPIK_BASE_URL}/image-upscaler-precision-v2`;

    const payload = {
        image: imageBase64,
        scale_factor: options.scaleFactor ?? 2,
        sharpen: options.sharpen ?? 7,
        smart_grain: options.smartGrain ?? 7,
        ultra_detail: options.ultraDetail ?? 30,
        flavor: options.flavor ?? 'photo',
    };

    console.log('📤 Sending upscale request...');
    console.log('   Scale factor:', payload.scale_factor);
    console.log('   Flavor:', payload.flavor);

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-freepik-api-key': FREEPIK_KEY,
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upscale request failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    console.log('📋 Response:', JSON.stringify(data, null, 2));

    const taskId = data.data?.task_id;
    if (!taskId) {
        throw new Error('No task_id in response');
    }

    return taskId;
}

// Poll for task completion
async function pollTaskStatus(taskId) {
    const endpoint = `${FREEPIK_BASE_URL}/image-upscaler-precision-v2/${taskId}`;
    const maxAttempts = 60;
    const pollIntervalMs = 5000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        console.log(`⏳ Polling status (attempt ${attempt + 1}/${maxAttempts})...`);

        const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'x-freepik-api-key': FREEPIK_KEY,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Status check failed (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        const status = data.data?.status;

        console.log(`   Status: ${status}`);

        if (status === 'COMPLETED') {
            const generated = data.data?.generated;
            if (!generated || generated.length === 0) {
                throw new Error('Task completed but no images were generated');
            }
            return generated;
        }

        if (status === 'FAILED') {
            throw new Error(`Task failed: ${taskId}`);
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(`Task timed out after ${maxAttempts} attempts`);
}

// Download image
async function downloadImage(url, outputPath) {
    console.log('📥 Downloading upscaled image...');

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Download failed (${response.status})`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    const absolutePath = path.isAbsolute(outputPath)
        ? outputPath
        : path.join(__dirname, '..', outputPath);

    // Ensure output directory exists
    const dir = path.dirname(absolutePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(absolutePath, buffer);
    console.log(`✅ Saved to: ${absolutePath}`);

    return absolutePath;
}

// Main test function
async function main() {
    const testImagePath = 'public/assets/studio/angles/front_eye.jpg';
    const outputPath = 'data/magnific_test_output.jpg';

    console.log('\n🔬 Testing Freepik Magnific Image Upscaler V2');
    console.log('='.repeat(50));
    console.log(`📁 Test image: ${testImagePath}`);

    try {
        // Step 1: Load and encode image
        console.log('\n📌 Step 1: Loading image...');
        const base64Image = imageToBase64(testImagePath);
        console.log(`   Loaded ${Math.round(base64Image.length / 1024)} KB of base64 data`);

        // Step 2: Start upscale task
        console.log('\n📌 Step 2: Starting upscale task...');
        const taskId = await startUpscaleTask(base64Image, {
            scaleFactor: 2,
            flavor: 'photo',
            sharpen: 10,
            ultraDetail: 40,
        });
        console.log(`   Task ID: ${taskId}`);

        // Step 3: Poll for completion
        console.log('\n📌 Step 3: Waiting for completion...');
        const urls = await pollTaskStatus(taskId);
        console.log(`   Generated ${urls.length} image(s)`);
        console.log(`   URL: ${urls[0]}`);

        // Step 4: Download result
        console.log('\n📌 Step 4: Downloading result...');
        const savedPath = await downloadImage(urls[0], outputPath);

        console.log('\n' + '='.repeat(50));
        console.log('✅ Test completed successfully!');
        console.log(`📁 Output: ${savedPath}`);

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        process.exit(1);
    }
}

main();
