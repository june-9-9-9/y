/**
 * WhatsApp Bot - AutoTyping Command
 * Shows fake typing status (15s duration)
 */

const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', 'data', 'autotyping.json');

// Ensure config exists
function getConfig() {
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify({ enabled: false }, null, 2));
  }
  return JSON.parse(fs.readFileSync(configPath));
}

// Save config
function saveConfig(config) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

// Toggle autotyping
async function autotypingCommand(sock, chatId, message) {
  if (!message.key.fromMe) {
    return sock.sendMessage(chatId, { text: '❌ Only the owner can use this!' });
  }

  const args = (
    message.message?.conversation ||
    message.message?.extendedTextMessage?.text ||
    ''
  ).trim().split(' ').slice(1);

  const config = getConfig();

  if (args[0]) {
    const action = args[0].toLowerCase();
    if (['on', 'enable'].includes(action)) config.enabled = true;
    else if (['off', 'disable'].includes(action)) config.enabled = false;
    else return sock.sendMessage(chatId, { text: '❌ Use: .autotyping on/off' });
  } else {
    config.enabled = !config.enabled; // toggle if no args
  }

  saveConfig(config);
  return sock.sendMessage(chatId, {
    text: `✅ Auto-typing ${config.enabled ? 'enabled' : 'disabled'}!`
  });
}

// Show typing presence for 15s
async function straightTypingPresence(sock, chatId) {
  if (!getConfig().enabled) return false;

  try {
    await sock.presenceSubscribe(chatId);
    await sock.sendPresenceUpdate('composing', chatId);
    await new Promise(res => setTimeout(res, 15000));
    await sock.sendPresenceUpdate('paused', chatId);
    return true;
  } catch (err) {
    console.error('❌ Typing error:', err);
    return false;
  }
}

module.exports = {
  autotypingCommand,
  straightTypingPresence
};
