const axios = require('axios');

async function gpt4Command(sock, chatId, message) {
  try {
    const text = message.message?.conversation || 
                 message.message?.extendedTextMessage?.text || 
                 message.text;

    if (!text) {
      return sendMsg(sock, chatId, message, "Please provide a question after !gpt\n\nExample: !gpt What is quantum computing?");
    }
    
    const [command, ...rest] = text.split(' ');
    const query = rest.join(' ').trim();

    if (!query) {
      return sendMsg(sock, chatId, message, "❌ Please provide a query.\nExample: !gpt What is quantum computing?");
    }
    
    await sock.sendMessage(chatId, { react: { text: '🤖', key: message.key } });
    await handleAI(sock, chatId, message, query);

  } catch (err) {
    console.error('AI Command Error:', err);
    await sendMsg(sock, chatId, message, "❌ An error occurred. Please try again later.");
  }
}

async function handleAI(sock, chatId, message, query) {
  try {
    const url = "https://api.openai.com/v1/chat/completions"; // ✅ Official endpoint
    const { data } = await axios.post(
      url,
      {
        model: "gpt-4", // or "gpt-4o-mini" for cheaper/faster
        messages: [{ role: "user", content: query }],
      },
      {
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`, // ✅ use env variable
          "Content-Type": "application/json",
        },
      }
    );

    const reply = data.choices?.[0]?.message?.content || "⚠️ No response from AI.";
    await sendMsg(sock, chatId, message, reply);

  } catch (err) {
    console.error('API Error:', err);
    const msg = err.response?.status === 429 
      ? "❌ Rate limit exceeded. Please try again later." 
      : "❌ Failed to reach AI API.";
    await sendMsg(sock, chatId, message, msg);
  }
}

async function sendMsg(sock, chatId, message, text) {
  return sock.sendMessage(chatId, { text }, { quoted: message });
}

module.exports = gpt4Command;
