// updateCommand.js
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const settings = require('../settings');
const isOwnerOrSudo = require('../lib/isOwner');

/* -------------------- Helpers -------------------- */
function run(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, { windowsHide: true }, (err, stdout, stderr) => {
            if (err) return reject(new Error(stderr || stdout || err.message));
            resolve(stdout.toString().trim());
        });
    });
}

async function hasGitRepo() {
    const gitDir = path.join(process.cwd(), '.git');
    if (!fs.existsSync(gitDir)) return false;
    try {
        await run('git --version');
        return true;
    } catch {
        return false;
    }
}

/* -------------------- Git Update -------------------- */
async function updateViaGit(sock, chatId, statusMessage) {
    await sock.sendMessage(chatId, { text: '🔍 Checking revision…', edit: statusMessage.key });
    const oldRev = await run('git rev-parse HEAD').catch(() => 'unknown');

    await sock.sendMessage(chatId, { text: '📡 Fetching changes…', edit: statusMessage.key });
    await run('git fetch --all --prune');

    const newRev = await run('git rev-parse origin/main').catch(() => 'unknown');
    const alreadyUpToDate = oldRev === newRev;

    let commits = '', files = '';
    if (!alreadyUpToDate) {
        await sock.sendMessage(chatId, { text: '📝 Summarizing commits…', edit: statusMessage.key });
        commits = await run(`git log --pretty=format:"%h %s (%an)" ${oldRev}..${newRev}`).catch(() => '');
        files = await run(`git diff --name-status ${oldRev} ${newRev}`).catch(() => '');
    }

    await sock.sendMessage(chatId, { text: '🧹 Resetting repo…', edit: statusMessage.key });
    await run(`git reset --hard ${newRev}`);
    await run('git clean -fd');

    return { oldRev, newRev, alreadyUpToDate, commits, files };
}

/* -------------------- ZIP Update -------------------- */
function downloadFile(url, dest, visited = new Set()) {
    return new Promise((resolve, reject) => {
        if (typeof url !== 'string' || !/^https?:\/\//.test(url)) {
            return reject(new Error(`Invalid URL: ${url}`));
        }
        if (visited.has(url) || visited.size > 5) return reject(new Error('Too many redirects'));
        visited.add(url);

        const client = url.startsWith('https://') ? https : require('http');
        const req = client.get(url, { headers: { 'User-Agent': 'KnightBot-Updater/1.0' } }, res => {
            if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
                const nextUrl = new URL(res.headers.location, url).toString();
                res.resume();
                return downloadFile(nextUrl, dest, visited).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));

            const file = fs.createWriteStream(dest);
            res.pipe(file);
            file.on('finish', () => file.close(resolve));
            file.on('error', err => fs.unlink(dest, () => reject(err)));
        });
        req.on('error', err => fs.unlink(dest, () => reject(err)));
    });
}

async function extractZip(zipPath, outDir) {
    if (process.platform === 'win32') {
        await run(`powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${outDir}' -Force"`);
        return;
    }
    for (const tool of ['unzip', '7z', 'busybox unzip']) {
        try {
            await run(`command -v ${tool.split(' ')[0]}`);
            await run(`${tool} -o '${zipPath}' -d '${outDir}'`);
            return;
        } catch {}
    }
    throw new Error("No unzip tool found.");
}

function copyRecursive(src, dest, ignore = [], relative = '', outList = []) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
        if (ignore.includes(entry)) continue;
        const s = path.join(src, entry);
        const d = path.join(dest, entry);
        const stat = fs.lstatSync(s);

        if (stat.isDirectory()) {
            copyRecursive(s, d, ignore, path.join(relative, entry), outList);
        } else {
            fs.mkdirSync(path.dirname(d), { recursive: true });
            fs.copyFileSync(s, d);
            outList.push(path.join(relative, entry).replace(/\\/g, '/'));
        }
    }
}

async function updateViaZip(sock, chatId, statusMessage, zipUrl) {
    if (!zipUrl) throw new Error('No ZIP URL configured.');

    await sock.sendMessage(chatId, { text: '📥 Downloading package…', edit: statusMessage.key });
    const tmpDir = path.join(process.cwd(), 'tmp');
    fs.mkdirSync(tmpDir, { recursive: true });

    const zipPath = path.join(tmpDir, 'update.zip');
    await downloadFile(zipUrl, zipPath);

    await sock.sendMessage(chatId, { text: '📦 Extracting files…', edit: statusMessage.key });
    const extractTo = path.join(tmpDir, 'update_extract');
    fs.rmSync(extractTo, { recursive: true, force: true });
    await extractZip(zipPath, extractTo);

    const entries = fs.readdirSync(extractTo);
    const root = entries.length === 1 && fs.lstatSync(path.join(extractTo, entries[0])).isDirectory()
        ? path.join(extractTo, entries[0])
        : extractTo;

    const ignore = ['node_modules', '.git', 'session', 'tmp', 'temp', 'data', 'baileys_store.json'];
    const copied = [];
    copyRecursive(root, process.cwd(), ignore, '', copied);

    fs.rmSync(extractTo, { recursive: true, force: true });
    fs.rmSync(zipPath, { force: true });

    return { copiedFiles: copied };
}

/* -------------------- Restart -------------------- */
async function restartProcess(sock, chatId, message) {
    await sock.sendMessage(chatId, { text: '♻️ Restarting bot…' }, { quoted: message }).catch(() => {});
    try {
        await run('pm2 restart all');
    } catch {
        setTimeout(() => process.exit(0), 500);
    }
}

/* -------------------- Main Command -------------------- */
async function updateCommand(sock, chatId, message, zipOverride) {
    const senderId = message.key.participant || message.key.remoteJid;
    const isOwner = await isOwnerOrSudo(senderId, sock, chatId);

    if (!message.key.fromMe && !isOwner) {
        return sock.sendMessage(chatId, { text: '⚠️ Only owner/sudo can use .update' }, { quoted: message });
    }

    let statusMessage;
    try {
        statusMessage = await sock.sendMessage(chatId, { text: '🔄 Starting update…' }, { quoted: message });

        if (await hasGitRepo()) {
            const { oldRev, newRev, alreadyUpToDate } = await updateViaGit(sock, chatId, statusMessage);
            const summary = alreadyUpToDate
                ? `✅ Already up to date: ${newRev}`
                : `✅ Updated from ${oldRev.slice(0, 7)} to ${newRev.slice(0, 7)}`;
            await sock.sendMessage(chatId, { text: `${summary}\n📦 Installing deps…`, edit: statusMessage.key });
        } else {
            const { copiedFiles } = await updateViaZip(sock, chatId, statusMessage, zipOverride || settings.updateZipUrl || process.env.UPDATE_ZIP_URL);
            await sock.sendMessage(chatId, { text: `✅ Extracted ${copiedFiles.length} files\n📦 Installing deps…`, edit: statusMessage.key });
        }

        await sock.sendMessage(chatId, { text: '📦 Running npm install…', edit: statusMessage.key });
        await run('npm install --no-audit --no-fund');

        await sock.sendMessage(chatId, { text: '✅ Update done! Restarting…', edit: statusMessage.key });
        await restartProcess(sock, chatId, message);
    } catch (err) {
        console.error('Update failed:', err);
        const errorMsg = `❌ Update failed:\n${String(err.message || err).slice(0, 1000)}`;
        if (statusMessage?.key) {
            await sock.sendMessage(chatId, { text: errorMsg, edit: statusMessage.key });
        } else {
            await sock.sendMessage(chatId, { text: errorMsg }, { quoted: message });
        }
    }
}

module.exports = updateCommand;
