#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { spawn, execSync } = require('node:child_process');
const os = require('node:os');

const REPO_URL = "https://github.com/ai-scape/freepikv5.git";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function main() {
    console.log("🚀 Starting Freepik Clone Team Installer...");

    // 1. Get Install Directory
    const defaultDir = path.join(process.cwd(), "freepik-clone");
    const dirInput = await question(`\n📂 Where would you like to install the project?\n   (Press Enter for default: ${defaultDir}): `);
    const installDir = dirInput.trim() || defaultDir;

    console.log(`\nTarget directory: ${installDir}`);

    // 2. Clone Repo
    if (fs.existsSync(installDir)) {
        console.log(`\n⚠️  Directory already exists. Skipping clone.`);
    } else {
        console.log(`\n⬇️  Cloning repository...`);
        try {
            execSync(`git clone ${REPO_URL} "${installDir}"`, { stdio: 'inherit' });
        } catch (error) {
            console.error("❌ Failed to clone repository. Please check your git installation and internet connection.");
            process.exit(1);
        }
    }

    // 3. Ask for API Keys
    console.log(`\n🔑 Configuration Setup`);
    console.log("   Please enter your API keys. Press Enter to skip if you want to add them manually later.");

    const falKey = await question("   Enter VITE_FAL_KEY (optional): ");
    const kieKey = await question("   Enter VITE_KIE_KEY (optional): ");
    const fileApiTokenInput = await question("   Enter FILE_API_TOKEN (Press Enter for default: devtoken): ");
    const fileApiToken = (fileApiTokenInput.trim() || "devtoken").trim();

    // 4. Create env files
    const envLocalContent = [
        `VITE_FAL_KEY=${falKey.trim()}`,
        `VITE_KIE_KEY=${kieKey.trim()}`,
        `VITE_FILE_API_BASE=http://localhost:8787`,
        `VITE_FILE_API_TOKEN=${fileApiToken}`,
    ].join("\n");

    const envServerContent = [
        `FILE_API_PORT=8787`,
        `FILE_STORAGE_ROOT=./data`,
        `FILE_API_TOKEN=${fileApiToken}`,
        `FILE_API_CORS_ORIGIN=http://localhost:5173`,
        `FILE_MAX_SIZE_MB=1024`,
    ].join("\n");

    const envLocalPath = path.join(installDir, ".env.local");
    const envServerPath = path.join(installDir, ".env.server");
    fs.writeFileSync(envLocalPath, envLocalContent);
    fs.writeFileSync(envServerPath, envServerContent);
    console.log(`\n✅ Created frontend env at ${envLocalPath}`);
    console.log(`✅ Created server env at ${envServerPath}`);

    // 5. Install Dependencies
    console.log(`\n📦 Installing dependencies (this may take a few minutes)...`);
    try {
        execSync(`npm install`, { cwd: installDir, stdio: 'inherit' });
        console.log(`✅ Dependencies installed.`);
    } catch (error) {
        console.error("❌ Failed to install dependencies. You may need to run 'npm install' manually.");
    }

    // 6. Create Launch Shortcut
    const desktopDir = path.join(os.homedir(), "Desktop");
    const platform = os.platform();
    try {
        if (platform === "win32") {
            const batPath = path.join(desktopDir, "Launch AI Asset Studio.bat");
            const batContent = `@echo off
echo Starting AI Asset Studio...
cd /d "${installDir}"
call npm run dev:all
pause
`;
            fs.writeFileSync(batPath, batContent);
            console.log(`\n🚀 Created launch shortcut on Desktop: ${batPath}`);
        } else {
            const scriptName = platform === "darwin"
                ? "Launch AI Asset Studio.command"
                : "Launch AI Asset Studio.sh";
            const scriptPath = path.join(desktopDir, scriptName);
            const scriptContent = `#!/bin/bash
set -e
echo "Starting AI Asset Studio..."
cd "${installDir}"
npm run dev:all
`;
            fs.writeFileSync(scriptPath, scriptContent);
            try {
                fs.chmodSync(scriptPath, 0o755);
            } catch {
                // Best-effort; some environments may block chmod.
            }
            console.log(`\n🚀 Created launch script on Desktop: ${scriptPath}`);
        }
    } catch (error) {
        console.error(`\n⚠️  Could not create desktop launcher: ${error.message}`);
        console.log(`   You can manually run 'npm run dev:all' in ${installDir} to start the app.`);
    }

    console.log(`\n✨ Installation Complete! ✨`);
    console.log(`   You can now double-click the Desktop launcher to start.`);
    console.log(`   If you skipped provider keys, add them later in ${envLocalPath}.`);

    rl.close();
}

main().catch(err => {
    console.error("An unexpected error occurred:", err);
    rl.close();
});
