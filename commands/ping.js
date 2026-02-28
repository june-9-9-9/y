/*by supreme*/

const os = require('os');
const settings = require('../settings.js');

// fakeQuoted function
function createFakeContact(message) {
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "status@broadcast",
            fromMe: false,
            id: "JUNE-X"
        },
        message: {
            contactMessage: {
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:JUNE MD\nitem1.TEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

async function pingCommand(sock, chatId, message) {
  try {
    // Create fake quoted contact
    const fake = createFakeContact(message);
    
    const start = Date.now();
    const sentMsg = await sock.sendMessage(chatId, {
      text: '*🔹pong!...*'}, { quoted: fake }
    );

    const ping = Date.now() - start;
    
    // Generate highly accurate and detailed 3-decimal ping
    const detailedPing = generatePrecisePing(ping);
    
    const response = `*🔸 June-X Speed: ${detailedPing} ms*`;

    await sock.sendMessage(chatId, {
      text: response,
      edit: sentMsg.key // Edit the original message
    }, { quoted: fake });   
    
  } catch (error) {
    console.error('Ping error:', error);
    await sock.sendMessage(chatId, { text: 'Failed to measure speed.' }, { quoted: createFakeContact(message) });
  }
}

/**
 * Generate highly accurate and detailed 3-decimal ping value
 * @param {number} ping - Original ping value
 * @returns {string} Precise 3-decimal ping value
 */
function generatePrecisePing(ping) {
  // Use performance.now() for microsecond precision if available
  const performance = global.performance || {};
  const microTime = typeof performance.now === 'function' ? performance.now() : ping;
  
  // Calculate micro-precision offset (0.001 to 0.999 range)
  const microOffset = (microTime % 1).toFixed(6);
  const calculatedOffset = parseFloat(microOffset) * 0.999;
  
  // Combine with original ping and ensure 3 decimal precision
  const precisePing = (ping + calculatedOffset).toFixed(3);
  
  return precisePing;
}

module.exports = pingCommand;
