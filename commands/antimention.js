const fs = require('fs');
const path = require('path');
const isAdmin = require('../lib/isAdmin');

const DATA_FILE = path.join(__dirname, '../data/antimention.json');
let settings = [];

// Ensure file exists and load settings
(function init() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]');
  try { settings = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { settings = []; fs.writeFileSync(DATA_FILE, '[]'); }
})();

const save = () => fs.writeFileSync(DATA_FILE, JSON.stringify(settings, null, 2));
const cleanJid = jid => jid ? jid.split(':')[0].replace(/\D/g, '') + '@s.whatsapp.net' : jid;

// Enhanced: detect WhatsApp mentions OR raw text starting with '@'
const hasMentions = m => {
  const text = m?.conversation || m?.extendedTextMessage?.text || '';
  const rawMention = /@\w+/.test(text); // any @word
  const metaMention = ['extendedTextMessage','imageMessage','videoMessage','documentMessage','audioMessage']
    .some(k => m?.[k]?.contextInfo?.mentionedJid?.length);
  return rawMention || metaMention;
};

async function antimentionCommand(sock, chatId, msg) {
  try {
    if (!chatId.endsWith('@g.us')) return sock.sendMessage(chatId,{text:'❌ Group only'},{quoted:msg});
    const sender = cleanJid(msg.key.participant || sock.user.id);
    if (!await isAdmin(sock, chatId, sender)) return sock.sendMessage(chatId,{text:'❌ Admins only'},{quoted:msg});
    
    const [cmd,arg] = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').split(' ').slice(1);
    if (cmd==='on') return enable(sock, chatId, msg, arg);
    if (cmd==='off') return disable(sock, chatId, msg);
    if (cmd==='status') return status(sock, chatId, msg);
    return help(sock, chatId, msg);
  } catch(e){ sock.sendMessage(chatId,{text:'❌ Error: '+e.message},{quoted:msg}); }
}

async function enable(sock, chatId, msg, mode) {
  const modes = {warn:'Warning users',delete:'Deleting messages',kick:'Kicking users'};
  if (!modes[mode]) return sock.sendMessage(chatId,{text:`Usage: .antimention on [${Object.keys(modes).join('|')}]`},{quoted:msg});
  if ((mode!=='warn') && !await isAdmin(sock, chatId, cleanJid(sock.user.id)))
    return sock.sendMessage(chatId,{text:'⚠️ Bot needs admin rights'},{quoted:msg});
  
  const s = {chatId,enabled:true,mode,exemptAdmins:true,warnings:{}};
  settings[settings.findIndex(g=>g.chatId===chatId)] = s;
  if (!settings.some(g=>g.chatId===chatId)) settings.push(s);
  save();
  sock.sendMessage(chatId,{text:`✅ Anti-Mention Enabled\nMode: ${mode} (${modes[mode]})\nAdmins exempted.`},{quoted:msg});
}

function disable(sock, chatId, msg) {
  const i = settings.findIndex(g=>g.chatId===chatId);
  if (i>=0){ settings.splice(i,1); save(); sock.sendMessage(chatId,{text:'❌ Disabled'},{quoted:msg}); }
  else sock.sendMessage(chatId,{text:'ℹ️ Already off'},{quoted:msg});
}

function status(sock, chatId, msg) {
  const g = settings.find(x=>x.chatId===chatId);
  if (!g?.enabled) return sock.sendMessage(chatId,{text:'❌ Off\nUse: .antimention on [mode]'},{quoted:msg});
  let txt=`📊 Enabled\nMode: ${g.mode}\n\n`;
  txt+=Object.entries(g.warnings).slice(0,5).map(([j,c])=>`${j.split('@')[0]}: ${c} warning${c>1?'s':''}`).join('\n')||'No warnings yet.';
  sock.sendMessage(chatId,{text:txt},{quoted:msg});
}

const help = (sock,chatId,msg)=>sock.sendMessage(chatId,{text:`👥 Anti-Mention\n.on [warn|delete|kick]\n.off\n.status\nExample: .antimention on delete`},{quoted:msg});

function setupAntimentionListener(sock){
  sock.ev.on('messages.upsert',async({messages})=>{
    const m=messages[0],chatId=m?.key.remoteJid;
    if(!chatId?.endsWith('@g.us')||m.key.fromMe) return;
    const g=settings.find(x=>x.chatId===chatId);
    if(!g?.enabled||!hasMentions(m.message)) return;
    const sender=cleanJid(m.key.participant||chatId),num=sender.split('@')[0];
    try{
      const meta=await sock.groupMetadata(chatId);
      const p=meta.participants.find(x=>cleanJid(x.id)===sender);
      if(g.exemptAdmins&&(p?.admin==='admin'||p?.admin==='superadmin')) return;

      switch(g.mode){
        case 'warn':
          g.warnings[sender]=(g.warnings[sender]||0)+1; save();
          sock.sendMessage(chatId,{text:`⚠️ @${num} - No mentions allowed! (#${g.warnings[sender]})`,mentions:[sender]});
          break;
        case 'delete':
          sock.sendMessage(chatId,{text:`🚫 @${num} - Message deleted`,mentions:[sender]});
          setTimeout(()=>sock.sendMessage(chatId,{delete:m.key}),500);
          break;
        case 'kick':
          const bot=meta.participants.find(x=>cleanJid(x.id)===cleanJid(sock.user.id));
          if(bot?.admin==='superadmin'){
            sock.sendMessage(chatId,{text:`🚫 @${num} - Kicked for mentioning`,mentions:[sender]});
            setTimeout(()=>sock.groupParticipantsUpdate(chatId,[sender],'remove'),1000);
          }
          break;
      }
    }catch(e){ console.error('Listener error:',e); }
  });
}

module.exports={antimentionCommand,setupAntimentionListener};
