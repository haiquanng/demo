/**
 * Gọi điện tự động bằng AI: Twilio gọi ra, âm thanh cuộc gọi được nối thẳng sang Gemini Live.
 *
 *   Trình duyệt ──POST /call──▶ server ──REST──▶ Twilio gọi vào số của bạn
 *   Điện thoại ⇄ Twilio Media Stream (μ-law 8kHz) ⇄ server ⇄ Gemini Live (PCM 16kHz vào, 24kHz ra)
 *
 * Chạy: npm start (đọc biến môi trường từ .env, xem .env.example).
 */
import http from "node:http";
import fs from "node:fs";
import { WebSocketServer } from "ws";

const env = process.env;
const PORT = Number(env.PORT || 8787);
const MODEL = env.GEMINI_LIVE_MODEL || "gemini-2.5-flash-native-audio-latest";
const PUBLIC_URL = (env.PUBLIC_URL || "").replace(/\/$/, "");
const LOG_FILE = new URL("./calls.json", import.meta.url);

/* ---------- lưu cuộc gọi ---------- */

const calls = new Map(); // callSid -> { to, purpose, status, transcript[], outcome }
function save() {
  fs.writeFileSync(LOG_FILE, JSON.stringify([...calls.entries()].map(([sid, c]) => ({ sid, ...c })), null, 2));
}
function note(sid, who, text) {
  const c = calls.get(sid);
  if (!c || !text?.trim()) return;
  const last = c.transcript.at(-1);
  if (last && last.who === who) last.text += text; // Gemini gửi lời chép theo từng mẩu nhỏ
  else c.transcript.push({ who, text, at: new Date().toISOString() });
  save();
}

/* ---------- μ-law và đổi tần số lấy mẫu ---------- */

function mulawDecode(u) {
  u = ~u & 0xff;
  const sign = u & 0x80, exp = (u >> 4) & 7, mant = u & 0x0f;
  const s = (((mant << 3) + 0x84) << exp) - 0x84;
  return sign ? -s : s;
}
function mulawEncode(s) {
  const BIAS = 0x84, CLIP = 32635;
  const sign = s < 0 ? 0x80 : 0;
  if (sign) s = -s;
  if (s > CLIP) s = CLIP;
  s += BIAS;
  let exp = 7;
  for (let mask = 0x4000; (s & mask) === 0 && exp > 0; exp--, mask >>= 1);
  const mant = (s >> (exp + 3)) & 0x0f;
  return ~(sign | (exp << 4) | mant) & 0xff;
}
/** Twilio → Gemini: μ-law 8kHz → PCM16 16kHz (nội suy tuyến tính). */
function twilioToGemini(b64) {
  const u = Buffer.from(b64, "base64");
  const out = Buffer.alloc(u.length * 4);
  for (let i = 0; i < u.length; i++) {
    const a = mulawDecode(u[i]);
    const b = i + 1 < u.length ? mulawDecode(u[i + 1]) : a;
    out.writeInt16LE(a, i * 4);
    out.writeInt16LE((a + b) >> 1, i * 4 + 2);
  }
  return out.toString("base64");
}
/** Gemini → Twilio: PCM16 24kHz → μ-law 8kHz (lấy trung bình mỗi 3 mẫu). */
function geminiToTwilio(b64) {
  const pcm = Buffer.from(b64, "base64");
  const n = Math.floor(pcm.length / 6);
  const out = Buffer.alloc(n);
  for (let i = 0; i < n; i++) {
    const s = (pcm.readInt16LE(i * 6) + pcm.readInt16LE(i * 6 + 2) + pcm.readInt16LE(i * 6 + 4)) / 3;
    out[i] = mulawEncode(Math.round(s));
  }
  return out.toString("base64");
}

/* ---------- Twilio REST ---------- */

const twilioAuth = () => "Basic " + Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64");
const xml = (s) => s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]);

async function placeCall(to, purpose) {
  const wss = PUBLIC_URL.replace(/^http/, "ws") + "/media";
  const twiml = `<Response><Connect><Stream url="${xml(wss)}"><Parameter name="purpose" value="${xml(purpose)}"/></Stream></Connect></Response>`;
  const body = new URLSearchParams({ To: to, From: env.TWILIO_NUMBER, Twiml: twiml, StatusCallback: `${PUBLIC_URL}/status`, Timeout: "40" });
  for (const ev of ["initiated", "ringing", "answered", "completed"]) body.append("StatusCallbackEvent", ev);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Calls.json`, {
    method: "POST",
    headers: { Authorization: twilioAuth(), "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Twilio trả về ${res.status}`);
  return data.sid;
}
async function placeCallWithRetry(to, purpose, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      return await placeCall(to, purpose);
    } catch (e) {
      if (i >= tries || !/compliance profile/i.test(e.message)) throw e;
      await new Promise((r) => setTimeout(r, 4000));
    }
  }
}
async function hangUp(sid) {
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Calls/${sid}.json`, {
    method: "POST",
    headers: { Authorization: twilioAuth(), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ Status: "completed" }),
  }).catch(() => {});
}

/* ---------- Gemini Live ---------- */

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: "ghi_nhan_ket_qua",
        description: "Ghi lại khách xác nhận, xin dời lịch hay hủy. Gọi ngay khi khách đã trả lời rõ.",
        parameters: {
          type: "OBJECT",
          properties: {
            trang_thai: { type: "STRING", enum: ["xac_nhan", "doi_lich", "huy", "chua_ro"] },
            thoi_gian_moi: { type: "STRING", description: "Thời gian mới nếu khách xin dời lịch" },
            ghi_chu: { type: "STRING" },
          },
          required: ["trang_thai"],
        },
      },
      { name: "ket_thuc_cuoc_goi", description: "Kết thúc cuộc gọi sau khi đã chào tạm biệt.", parameters: { type: "OBJECT", properties: {} } },
    ],
  },
];

function systemPrompt(purpose) {
  return `Bạn là trợ lý gọi điện tự động, nói tiếng Việt tự nhiên, lịch sự, câu ngắn.
Ngay khi bắt đầu, hãy chào, nói rõ mình là trợ lý AI và lý do cuộc gọi.
Nội dung cần trao đổi: ${purpose}
Nếu người nghe muốn dời lịch, hỏi thời gian mới rồi nhắc lại để xác nhận.
Khi đã có câu trả lời rõ, gọi hàm ghi_nhan_ket_qua. Sau đó chào tạm biệt ngắn gọn và gọi hàm ket_thuc_cuoc_goi.
Không hứa điều gì ngoài nội dung trên. Không hỏi thông tin cá nhân khác.`;
}

/**
 * Một phiên Gemini cho mỗi cuộc gọi. Mở ngay khi Twilio bắt đầu đổ chuông,
 * để lúc người nghe bắt máy thì AI đã sẵn sàng và mở lời gần như ngay.
 */
const sessions = new Map(); // callSid -> Session

function openSession(callSid, purpose) {
  const sess = { callSid, purpose, ws: null, ready: false, twilio: null, streamSid: null, pending: [], started: false };
  sessions.set(callSid, sess);
  const ws = new WebSocket(`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${env.GEMINI_API_KEY}`);
  sess.ws = ws;
  ws.onopen = () =>
    ws.send(JSON.stringify({
      setup: {
        model: `models/${MODEL}`,
        generationConfig: { responseModalities: ["AUDIO"] },
        systemInstruction: { parts: [{ text: systemPrompt(purpose) }] },
        tools: TOOLS,
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      },
    }));
  ws.onmessage = async (ev) => {
    const m = JSON.parse(typeof ev.data === "string" ? ev.data : await ev.data.text());
    if (m.setupComplete) {
      sess.ready = true;
      maybeStart(sess);
      return;
    }
    const sc = m.serverContent;
    const send = (x) => sess.twilio?.readyState === 1 && sess.twilio.send(JSON.stringify(x));
    if (sc?.interrupted && sess.streamSid) send({ event: "clear", streamSid: sess.streamSid }); // người nghe chen ngang
    for (const p of sc?.modelTurn?.parts ?? []) {
      if (p.inlineData?.data && sess.streamSid) send({ event: "media", streamSid: sess.streamSid, media: { payload: geminiToTwilio(p.inlineData.data) } });
    }
    if (sc?.inputTranscription?.text) note(callSid, "Người nghe", sc.inputTranscription.text);
    if (sc?.outputTranscription?.text) note(callSid, "AI", sc.outputTranscription.text);
    for (const fc of m.toolCall?.functionCalls ?? []) {
      if (fc.name === "ghi_nhan_ket_qua") {
        const c = calls.get(callSid);
        if (c) { c.outcome = fc.args; save(); }
        console.log("📋 Kết quả:", fc.args);
      }
      ws.send(JSON.stringify({ toolResponse: { functionResponses: [{ id: fc.id, name: fc.name, response: { ok: true } }] } }));
      if (fc.name === "ket_thuc_cuoc_goi") setTimeout(() => hangUp(callSid), 4000); // chờ AI nói xong lời chào
    }
    if (m.error) console.error("Gemini:", m.error);
  };
  ws.onclose = (e) => {
    console.log("Gemini đóng kết nối", e.code, e.reason);
    sessions.delete(callSid);
  };
  // Không ai bắt máy sau 60 giây thì đóng phiên.
  setTimeout(() => { if (!sess.twilio) ws.close(); }, 60000);
  return sess;
}

/** AI mở lời khi cả hai phía đã sẵn sàng: Gemini đã setup xong và người nghe đã bắt máy. */
function maybeStart(sess) {
  if (sess.started || !sess.ready || !sess.twilio) return;
  sess.started = true;
  sess.pending.splice(0).forEach((x) => sess.ws.send(x));
  sess.ws.send(JSON.stringify({ clientContent: { turns: [{ role: "user", parts: [{ text: "(Người nghe vừa bắt máy. Hãy bắt đầu.)" }] }], turnComplete: true } }));
}

function bridge(twilio) {
  let sess = null;
  twilio.on("message", (raw) => {
    const m = JSON.parse(raw.toString());
    if (m.event === "start") {
      const callSid = m.start.callSid;
      const purpose = m.start.customParameters?.purpose || "Nhắc lịch hẹn.";
      if (!calls.has(callSid)) calls.set(callSid, { to: "?", purpose, status: "in-progress", transcript: [], outcome: null });
      calls.get(callSid).status = "in-progress";
      sess = sessions.get(callSid) ?? openSession(callSid, purpose);
      sess.twilio = twilio;
      sess.streamSid = m.start.streamSid;
      console.log("📞 Bắt máy:", callSid, sess.ready ? "(Gemini đã sẵn sàng)" : "(đang chờ Gemini)");
      maybeStart(sess);
    } else if (m.event === "media" && sess) {
      const msg = JSON.stringify({ realtimeInput: { audio: { data: twilioToGemini(m.media.payload), mimeType: "audio/pcm;rate=16000" } } });
      if (sess.started) sess.ws.send(msg);
      else if (sess.pending.length < 50) sess.pending.push(msg);
    } else if (m.event === "stop") {
      sess?.ws?.close();
    }
  });
  twilio.on("close", () => sess?.ws?.close());
}

/* ---------- trang web + HTTP ---------- */

const PAGE = fs.readFileSync(new URL("./index.html", import.meta.url), "utf8");
const readBody = (req) => new Promise((r) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => r(b)); });
const json = (res, code, data) => { res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" }); res.end(JSON.stringify(data)); };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(PAGE);
  }
  if (req.method === "POST" && url.pathname === "/call") {
    const { to, purpose } = JSON.parse((await readBody(req)) || "{}");
    const phone = String(to || "").replace(/[^\d+]/g, "").replace(/^0/, "+84");
    if (!/^\+\d{9,15}$/.test(phone)) return json(res, 400, { error: "Số điện thoại chưa đúng. Ví dụ: 0901234567 hoặc +84901234567." });
    const missing = ["GEMINI_API_KEY", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_NUMBER", "PUBLIC_URL"].filter((k) => !env[k]);
    if (missing.length) return json(res, 500, { error: `Thiếu biến môi trường: ${missing.join(", ")}` });
    try {
      const sid = await placeCallWithRetry(phone, purpose || "Nhắc lịch hẹn.");
      calls.set(sid, { to: phone, purpose, status: "queued", transcript: [], outcome: null, startedAt: new Date().toISOString(), duration: null });
      openSession(sid, purpose || "Nhắc lịch hẹn.");
      save();
      return json(res, 200, { sid });
    } catch (e) {
      return json(res, 502, { error: e.message });
    }
  }
  if (req.method === "POST" && url.pathname === "/status") {
    const p = new URLSearchParams(await readBody(req));
    const c = calls.get(p.get("CallSid"));
    if (c) {
      c.status = p.get("CallStatus");
      if (p.get("CallDuration")) c.duration = Number(p.get("CallDuration"));
      save();
    }
    res.writeHead(204);
    return res.end();
  }
  if (req.method === "GET" && url.pathname === "/calls") {
    const list = [...calls.entries()].map(([sid, c]) => ({ sid, to: c.to, status: c.status, duration: c.duration, outcome: c.outcome, startedAt: c.startedAt, lines: c.transcript.length }));
    return json(res, 200, list.reverse().slice(0, 20));
  }
  if (req.method === "POST" && url.pathname.startsWith("/hangup/")) {
    await hangUp(url.pathname.slice(8));
    return json(res, 200, { ok: true });
  }
  if (req.method === "GET" && url.pathname.startsWith("/calls/")) {
    const c = calls.get(url.pathname.slice(7));
    return c ? json(res, 200, c) : json(res, 404, { error: "Không thấy cuộc gọi" });
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server, path: "/media" });
wss.on("connection", bridge);
server.listen(PORT, () => console.log(`Mở http://localhost:${PORT} · model ${MODEL} · public ${PUBLIC_URL || "(chưa đặt PUBLIC_URL)"}`));
