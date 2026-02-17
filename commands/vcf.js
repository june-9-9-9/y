const { jidNormalizedUser } = require("@whiskeysockets/baileys");

// Store processed message IDs to prevent duplicates
const processedMessages = new Set();

function normalizeParticipantJid(p) {
  if (typeof p === "string") return p;
  return p?.id || p?.jid || p?.userJid || p?.participant || p?.user || "";
}

function extractNumberFromJid(jid) {
  if (!jid || jid.includes("@lid")) return null;
  const raw = jid.split("@")[0].replace(/\D/g, "");
  return raw.length >= 7 && raw.length <= 15 ? raw : null;
}

function resolveRealNumber(participant, sock) {
  if (participant?.phoneNumber) {
    const num = String(participant.phoneNumber).replace(/\D/g, "");
    if (num.length >= 7) return num;
  }

  const jid = normalizeParticipantJid(participant);
  const fromJid = extractNumberFromJid(jid);
  if (fromJid) return fromJid;

  if (participant?.lid || jid.includes("@lid")) {
    const lid = participant.lid || jid;
    try {
      const pn = sock?.signalRepository?.lidMapping?.getPNForLID?.(lid);
      if (pn) {
        const num = String(pn).split("@")[0].replace(/\D/g, "");
        if (num.length >= 7) return num;
      }
    } catch {}
  }

  return null;
}

function getDisplayName(participant, sock) {
  const directName =
    participant?.notify ||
    participant?.name ||
    participant?.verifiedName ||
    participant?.pushName;
  if (directName) return directName;

  const jid = normalizeParticipantJid(participant);
  const number = jid ? jid.split(":")[0].split("@")[0] : null;

  const contact =
    sock?.store?.contacts?.[jid] ||
    sock?.store?.contacts?.[`${number}@s.whatsapp.net`];
  return (
    contact?.notify ||
    contact?.name ||
    contact?.pushName ||
    contact?.verifiedName ||
    null
  );
}

function escapeVcf(str) {
  return str ? str.replace(/[\\;,]/g, (c) => "\\" + c) : "";
}

async function vcfCommand(sock, chatId, message, args, extra) {
    try {
        // Prevent duplicate processing
        if (processedMessages.has(message.key.id)) return;
        processedMessages.add(message.key.id);
        setTimeout(() => processedMessages.delete(message.key.id), 5 * 60 * 1000);

        // React to command
        await sock.sendMessage(chatId, { 
            react: { text: "📇", key: message.key } 
        });

        // Check if in group
        if (!chatId.endsWith("@g.us")) {
            return await sock.sendMessage(
                chatId,
                { text: "❌ This command can only be used in groups!" },
                { quoted: message }
            );
        }

        try {
            const metadata = await sock.groupMetadata(chatId);
            const senderJid = message.key.participant || message.key.remoteJid;
            const normalizedSender = jidNormalizedUser(senderJid);
            const senderEntry = metadata.participants.find((p) => {
                try {
                    return (
                        jidNormalizedUser(normalizeParticipantJid(p)) === normalizedSender
                    );
                } catch {
                    return false;
                }
            });
            
            const isAdmin = ["admin", "superadmin"].includes(senderEntry?.admin);

            if (!isAdmin && !extra?.jidManager?.isOwner(message)) {
                return await sock.sendMessage(
                    chatId,
                    { text: "❌ *Admin Only Command*\nYou need to be a group admin to use this command." },
                    { quoted: message }
                );
            }

            const identity = args.join(" ").trim();
            
            await sock.sendMessage(
                chatId,
                { text: `⏳ Generating VCF file for *${metadata.subject || "Group"}*...\n📊 Total participants: ${metadata.participants?.length || 0}` },
                { quoted: message }
            );

            let vcfContent = "";
            let count = 0,
                skipped = 0;

            for (const p of metadata.participants || []) {
                const number = resolveRealNumber(p, sock);
                if (!number) {
                    skipped++;
                    continue;
                }

                const waName = getDisplayName(p, sock) || "";
                const displayName = waName || `+${number}`;
                const contactLabel = identity
                    ? `${displayName} ${identity}`
                    : displayName;

                vcfContent += `BEGIN:VCARD\r\nVERSION:3.0\r\n`;
                vcfContent += `FN:${escapeVcf(contactLabel)}\r\n`;
                vcfContent += waName
                    ? `N:;${escapeVcf(waName)};;;\r\nNICKNAME:${escapeVcf(waName)}\r\n`
                    : `N:;+${number};;;\r\n`;
                vcfContent += `TEL;type=CELL;type=pref:+${number}\r\nEND:VCARD\r\n`;
                count++;
            }

            if (count === 0) {
                return await sock.sendMessage(
                    chatId,
                    { text: "❌ No valid WhatsApp numbers could be extracted from this group." },
                    { quoted: message }
                );
            }

            const safeGroupName = (metadata.subject || "Group")
                .replace(/[^a-zA-Z0-9 ]/g, "_")
                .trim();
            const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
            
            let caption = `📇 *${count}* contacts extracted from *${metadata.subject || "Group"}*`;
            if (identity) caption += `\n🏷️ Tag: ${identity}`;
            if (skipped) caption += `\n⚠️ ${skipped} members had unavailable numbers`;
            caption += `\n📅 Generated: ${new Date().toLocaleString()}`;

            // Send only as document
            await sock.sendMessage(
                chatId,
                {
                    document: Buffer.from(vcfContent),
                    fileName: `${safeGroupName}_Contacts_${timestamp}.vcf`,
                    mimetype: "text/vcard",
                    caption,
                },
                { quoted: message }
            );

        } catch (error) {
            console.error("VCF API error:", error);
            let errorMessage = "❌ Failed to generate VCF file. Please try again later.";
            
            if (error.response?.status === 404 || /404|not found/i.test(error.message))
                errorMessage = "❌ Group not found or bot is not in the group.";
            else if (error.response?.status === 403 || /403/.test(error.message))
                errorMessage = "⛔ Bot lacks permissions to access group information.";
            else if (["ENOTFOUND", "ETIMEDOUT"].includes(error.code))
                errorMessage = "🌐 Network error. Check your connection.";
            
            return await sock.sendMessage(
                chatId, 
                { text: errorMessage }, 
                { quoted: message }
            );
        }

    } catch (error) {
        console.error("VCF command error:", error);
        let errorMessage = `🚫 Error: ${error.message}`;
        
        if (["ENOTFOUND", "ETIMEDOUT"].includes(error.code))
            errorMessage = "🌐 Network error. Check your connection.";
        
        return await sock.sendMessage(
            chatId, 
            { text: errorMessage }, 
            { quoted: message }
        );
    }
}

module.exports = vcfCommand;
