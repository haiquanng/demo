import { useState } from "react";
import { baseState, useScenario, type Base, type Step } from "../lib/scenario";
import { AgentLog, ScenarioBar, StatusPill, flashProps } from "../components/legacy";

interface Seg { t: number; text: string; sev?: "bad" | "warn"; fact?: string }
interface Video { id: string; koc: string; platform: string; views: string; date: string; brand: string; product: string; dur: number; segs: Seg[]; draft?: string }

const VIDEOS: Video[] = [
  {
    id: "V1", koc: "@meBimSaiGon", platform: "TikTok", views: "182 nghìn", date: "22/09", brand: "Bông Nhỏ", product: "Sữa tắm gội thảo dược 500ml", dur: 80,
    segs: [
      { t: 5, text: "Hôm nay mẹ review sữa tắm gội thảo dược của Bông Nhỏ nha." },
      { t: 18, text: "Mùi rất nhẹ, bé nhà mình tắm xong không bị khô da." },
      { t: 42, text: "Đặc biệt là sữa tắm này chữa khỏi chàm sữa cho bé luôn, dùng một tuần là hết.", sev: "bad", fact: "Sữa tắm gội thông thường. Không có công dụng điều trị chàm. Không được quảng cáo như thuốc." },
      { t: 65, text: "Giá chỉ 189k thôi các mẹ ơi.", sev: "warn", fact: "189.000đ là giá 10.10, áp dụng từ 10/10. Hiện tại giá bán là 229.000đ." },
    ],
    draft: "Chào chị, Bông Nhỏ cảm ơn chị đã review sữa tắm gội thảo dược ạ. Ở giây 0:42 video có câu “chữa khỏi chàm sữa cho bé”. Sản phẩm là sữa tắm gội thông thường, không có công dụng điều trị, nên câu này có thể khiến video và gian hàng bị xử lý. Chị giúp bên em cắt đoạn này hoặc thay bằng “bé tắm xong da mềm, không bị khô” được không ạ? Ngoài ra giá 189k chỉ áp dụng từ 10/10, chị ghi chú thêm giúp em nhé. Cảm ơn chị nhiều!",
  },
  {
    id: "V2", koc: "@nhaxinhmoingay", platform: "TikTok", views: "96 nghìn", date: "20/09", brand: "Gỗ Tâm An", product: "Thớt gỗ nghiến 35cm", dur: 95,
    segs: [
      { t: 8, text: "Thớt gỗ nghiến nguyên khối, dày tận 4 phân.", sev: "warn", fact: "Thông số gốc: dày 3cm." },
      { t: 40, text: "Cầm nặng tay, băm chặt thoải mái không lo mẻ." },
      { t: 75, text: "Thớt này kháng khuẩn 100%, không bao giờ bị mốc luôn.", sev: "bad", fact: "Gỗ nghiến tự nhiên, cần rửa và phơi khô sau khi dùng. Chưa có chứng nhận kháng khuẩn." },
    ],
    draft: "Chào bạn, Gỗ Tâm An cảm ơn bạn đã giới thiệu thớt gỗ nghiến ạ. Bên mình nhờ bạn chỉnh 2 chỗ: ở giây 1:15, câu “kháng khuẩn 100%, không bao giờ bị mốc” chưa đúng vì thớt chưa có chứng nhận kháng khuẩn và vẫn cần phơi khô sau khi dùng. Ở giây 0:08, thớt dày 3cm chứ không phải 4cm. Bạn cập nhật phụ đề hoặc ghim bình luận đính chính giúp bên mình được không ạ? Cảm ơn bạn!",
  },
  {
    id: "V3", koc: "@reviewthatlong", platform: "Shopee Video", views: "41 nghìn", date: "24/09", brand: "Bông Nhỏ", product: "Kem hăm tã 50g", dur: 60,
    segs: [
      { t: 6, text: "Kem hăm của Bông Nhỏ, tuýp 50 gam." },
      { t: 30, text: "Kem mềm, dễ thoa, không mùi, bôi mỏng là được." },
    ],
  },
  {
    id: "V4", koc: "@babanuoicon", platform: "TikTok", views: "12 nghìn", date: "25/09", brand: "Bông Nhỏ", product: "Tã quần size L", dur: 45,
    segs: [
      { t: 4, text: "Tã quần size L, bịch 52 miếng." },
      { t: 22, text: "Thấm hút ổn, bé ngủ cả đêm không bị tràn." },
    ],
  },
];

interface KS extends Base {
  found: number;
  transcribed: boolean;
  checked: boolean;
  drafted: boolean;
  queued: string[];
}
const kinit = (): KS => ({ ...baseState(8 * 3600 + 30 * 60), found: 0, transcribed: false, checked: false, drafted: false, queued: [] });

const STEPS: Step<KS>[] = [
  {
    name: "Tìm video mới",
    btn: "Quét video",
    desc: <>Agent tìm video mới gắn link affiliate hoặc nhắc tên sản phẩm của các brand đang vận hành.</>,
    async run(s, io) {
      await io.say("Quét video mới trong 72 giờ qua trên TikTok và Shopee Video.");
      for (let i = 0; i < VIDEOS.length; i++) {
        await io.say(`Tìm thấy ${VIDEOS[i].koc} · ${VIDEOS[i].product} · ${VIDEOS[i].views} lượt xem`, "sub", 300);
        s.found = i + 1;
      }
      await io.say("Bỏ qua 12 video chỉ gắn link, không nói về sản phẩm.", "sub", 300);
    },
  },
  {
    name: "Chép lời",
    btn: "Chép lời video",
    desc: <>Chuyển lời nói trong video thành văn bản có mốc thời gian (khi làm thật: GPT-Transcribe, có gợi ý tên sản phẩm để nhận đúng).</>,
    async run(s, io) {
      for (const v of VIDEOS) await io.say(`Chép lời ${v.koc}: ${v.segs.length} đoạn, ${Math.floor(v.dur / 60)}:${String(v.dur % 60).padStart(2, "0")}.`, "sub", 350);
      s.transcribed = true;
    },
  },
  {
    name: "So với sự thật gốc",
    btn: "Đối chiếu",
    desc: <>Mỗi câu nói về sản phẩm được so với <b>sự thật gốc</b>: công dụng được phép, thông số, giá hiện tại.</>,
    async run(s, io) {
      await io.say("Đối chiếu 11 câu với sự thật gốc của 4 sản phẩm.");
      s.checked = true;
      io.flash("V1");
      await io.say('@meBimSaiGon 0:42: "chữa khỏi chàm sữa" là tuyên bố điều trị.', "platform", 500);
      io.flash("V2");
      await io.say('@nhaxinhmoingay 1:15: "kháng khuẩn 100%" chưa có chứng nhận.', "platform", 400);
      await io.say("2 video khác không có vấn đề.", "ok", 300);
    },
  },
  {
    name: "Soạn đề nghị chỉnh sửa",
    btn: "Soạn tin nhắn",
    desc: <>Agent soạn tin nhắn lịch sự, chỉ rõ giây nào cần sửa và câu thay thế. <b>Chuyên viên duyệt trước khi gửi.</b></>,
    async run(s, io) {
      await io.say("Soạn 2 tin nhắn đề nghị chỉnh sửa, kèm mốc thời gian và câu thay thế.");
      s.drafted = true;
      await io.say("Chờ chuyên viên duyệt. Agent không tự gửi cho KOC.", "human", 300);
    },
  },
];

const mmss = (t: number) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;

export default function KocWatch() {
  const { s, steps, runNext, reset, human } = useScenario(kinit, STEPS, 3);
  const [sel, setSel] = useState("V1");
  const visible = VIDEOS.slice(0, s.found);
  const v = visible.find((x) => x.id === sel) ?? visible[0];
  const sevOf = (x: Video) => (!s.checked ? null : x.segs.some((g) => g.sev === "bad") ? "bad" : x.segs.some((g) => g.sev === "warn") ? "warn" : "ok");

  return (
    <div className="module">
      <ScenarioBar steps={steps} s={s} onRun={runNext} onReset={() => void reset(0)} />
      <div className="cols-3">
        <section className="panel" aria-label="Video KOC">
          <h2 className="h2">Video mới <small>{s.found ? `${s.found} video nhắc sản phẩm` : ""}</small></h2>
          {visible.length ? (
            <ul className="vlist">
              {visible.map((x) => {
                const sev = sevOf(x);
                const fp = flashProps(s, x.id);
                return (
                  <li key={fp.key}>
                    <button type="button" className={`vcard${x.id === v?.id ? " sel" : ""}${sev ? ` s-${sev}` : ""}${fp.className}`} onClick={() => setSel(x.id)}>
                      <span className="thumb" aria-hidden="true"><span>▶</span><em>{mmss(x.dur)}</em></span>
                      <span className="vmeta">
                        <b>{x.koc}</b>
                        <small>{x.platform} · {x.date} · {x.views} lượt xem</small>
                        <small>{x.brand} · {x.product}</small>
                        {sev && <span className="cell-top"><i className="dot" />{sev === "bad" ? "Nói sai sự thật" : sev === "warn" ? "Cần xem" : "Không vấn đề"}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="empty">Chạy bước 1 để agent quét video.</p>
          )}
        </section>

        <section className="panel" aria-label="Lời KOC nói">
          {v ? (
            <>
              <div className="toolbar">
                <h2 className="h2">{v.koc} <small>{v.product}</small></h2>
                {s.queued.includes(v.id) && <StatusPill cls="live">Đã đưa vào hàng chờ gửi</StatusPill>}
              </div>
              <div className="vtimeline" role="img" aria-label="Mốc thời gian các câu nói trong video">
                <div className="track" />
                {v.segs.map((g) => (
                  <span key={g.t} className={`tmark${s.checked && g.sev ? ` s-${g.sev}` : ""}`} style={{ left: `${(g.t / v.dur) * 100}%` }} title={`${mmss(g.t)} · ${g.text}`} />
                ))}
                <span className="tend">{mmss(v.dur)}</span>
              </div>
              {s.transcribed ? (
                <ol className="transcript">
                  {v.segs.map((g) => (
                    <li key={g.t} className={s.checked && g.sev ? `flagged ${g.sev}` : ""}>
                      <time className="mono">{mmss(g.t)}</time>
                      <div>
                        <p>“{g.text}”</p>
                        {s.checked && g.fact && (
                          <div className="fact"><span className="eyebrow">Sự thật gốc</span><p>{g.fact}</p></div>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="empty">Chưa chép lời. Chạy bước 2.</p>
              )}
            </>
          ) : (
            <p className="empty">Chưa có video.</p>
          )}
        </section>

        <div className="panel stack">
          <section className="sec" aria-label="Tin nhắn đề nghị chỉnh sửa">
            <h2 className="h2">Tin nhắn cho KOC</h2>
            {v && s.drafted && v.draft ? (
              <>
                <p className="draft">{v.draft}</p>
                {s.queued.includes(v.id) ? (
                  <p className="okmsg">Đã duyệt. Gửi qua kênh liên hệ trong chương trình affiliate (mô phỏng).</p>
                ) : (
                  <button className="btn pri" type="button" disabled={s.busy} onClick={() => { s.queued.push(v.id); human(`Chuyên viên duyệt tin nhắn gửi ${v.koc}.`); }}>Duyệt và đưa vào hàng chờ gửi</button>
                )}
              </>
            ) : (
              <p className="empty">{v && s.drafted ? "Video này không cần chỉnh sửa." : "Agent soạn tin nhắn ở bước 4."}</p>
            )}
          </section>
          <AgentLog log={s.log} />
        </div>
      </div>
      <p className="note-line">Pain point: báo ngày 23/9/2026 viết rằng khi KOC quảng cáo sai, doanh nghiệp bán hàng cũng phải chịu trách nhiệm. KOC, video và lời nói ở đây là mô phỏng.</p>
    </div>
  );
}
