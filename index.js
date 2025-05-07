// index.js
import makeWASocket, {
    useMultiFileAuthState,
    makeInMemoryStore,
    DisconnectReason,
    fetchLatestBaileysVersion
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import fs from "fs";

// مسار ملف الجلسة الذي استخرجته (creds.json)
const AUTH_FILE = './creds.json';

// دالة لتحميل الحالة من الملف
async function loadAuthState() {
    if (fs.existsSync(AUTH_FILE)) {
        const creds = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
        return {
            state: { 
                // Baileys stores .creds and .keys, لكن هنا نستخدم creds.json كاملاً
                creds,
                keys: {} // إذا أردت حفظ المفاتيح تلقائياً استخدم useMultiFileAuthState
            },
            saveState: () => {
                // لا حاجة لحفظ الحالة مرة أخرى لأنك تستخدم نفس الملف
            }
        };
    } else {
        throw new Error(`Auth file not found at ${AUTH_FILE}`);
    }
}

async function startBot() {
    const { state, saveState } = await loadAuthState();

    // جلب آخر إصدار من البروتوكول لدعم الإصدارات الجديدة
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`Using WA v${version.join('.')} - latest: ${isLatest}`);

    const sock = makeWASocket({
        version,
        printQRInTerminal: false,  // لأنك تملك الجلسة مسبقاً
        auth: state,
        browser: ["MyBot", "Safari", "1.0.0"]
    });

    // مستودع في الذاكرة لتخزين الدردشة إن احتجت
    const store = makeInMemoryStore({});

    // حدث عند استقبال أي رسالة
    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.key.fromMe && msg.message) {
            const sender = msg.key.remoteJid;
            const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
            console.log(`Message from ${sender}: ${text}`);

            // مثال: رد تلقائي
            await sock.sendMessage(sender, { text: `لقد استلمت: ${text}` });
        }
    });

    // التعامل مع حالات الانقطاع
    sock.ev.on('connection.update', update => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const reason = new Boom(lastDisconnect?.error)?.output.statusCode;
            console.log('Connection closed, reconnecting...', reason);
            if (reason !== DisconnectReason.loggedOut) {
                startBot(); // إعادة التشغيل إذا لم تكن قد تم تسجيل الخروج
            } else {
                console.error('Logged out permanently.');
            }
        } else if (connection === 'open') {
            console.log('📶 Connected successfully');
        }
    });

    // حفظ الحالة عند تغيّرها (اختياري)
    sock.ev.on('creds.update', saveState);
}

startBot().catch(err => {
    console.error('Unexpected error in startBot():', err);
    process.exit(1);
});￼Enter
