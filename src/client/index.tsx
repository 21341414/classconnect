import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { usePartySocket } from "partysocket/react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useParams,
} from "react-router";
import { nanoid } from "nanoid";

import { names, type ChatMessage, type Message } from "../shared";

/**
 * Minimal fullscreen chat (single-file)
 * - No channels / no logo (bare minimum)
 * - Center messages column
 * - Right participants column with presence (green dot)
 * - Bottom-centered input using the exact HTML structure + CSS you provided (Uiverse.io by Cobp)
 * - Image sending via file picker or paste (data URL / base64)
 * - Optimistic sends + reconciliation when server echoes messages
 * - Mentions trigger unread / optional browser notification
 *
 * Notes:
 * - No external CSS libraries used (styles injected via <style>).
 * - Server is expected to broadcast messages with shape: { type: "add", id, content, user, created_at?, kind? }
 */

/* ---------------- CSS injected from the user's snippet (Uiverse.io by Cobp) ---------------- */
const INPUT_HTML_CSS = `<!-- From Uiverse.io by Cobp -->
.container-ia-chat {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: end;
  width: 300px;
}

.container-upload-files {
  position: absolute;
  left: 0;
  display: flex;
  color: #aaaaaa;
  transition: all 0.5s;
}
.container-upload-files .upload-file {
  margin: 5px;
  padding: 2px;
  cursor: pointer;
  transition: all 0.5s;
}
.container-upload-files .upload-file:hover {
  color: #4c4c4c;
  transform: scale(1.1);
}

.input-text {
  max-width: 190px;
  width: 100%;
  margin-left: 72px;
  padding: 0.75rem 1rem;
  padding-right: 46px;
  border-radius: 50px;
  border: none;
  outline: none;
  background-color: #e9e9e9;
  color: #4c4c4c;
  font-size: 14px;
  line-height: 18px;
  font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
  font-weight: 500;
  transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.05);
  z-index: 999;
}
.input-text::placeholder { color: #959595; }

.input-text:focus,
.input-text:valid {
  max-width: 250px;
  margin-left: 42px;
}
.input-text:focus ~ .container-upload-files,
.input-text:valid ~ .container-upload-files {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  filter: blur(5px);
}

.input-text:focus ~ .label-files,
.input-text:valid ~ .label-files {
  transform: translateX(0) translateY(-50%) scale(1);
  opacity: 1;
  visibility: visible;
  pointer-events: all;
}

.input-text:valid ~ .label-text {
  transform: translateX(0) translateY(-50%) scale(1);
  opacity: 1;
  visibility: visible;
  pointer-events: all;
}

.input-text:valid ~ .label-voice {
  transform: translateX(0) translateY(-50%) scale(0.25);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}

.input-voice { display: none; }

.input-voice:checked ~ .container-upload-files {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  filter: blur(5px);
}
.input-voice:checked ~ .input-text {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  filter: blur(5px);
}

.label-files {
  position: absolute;
  top: 50%;
  left: 0;
  transform: translateX(-20px) translateY(-50%) scale(1);
  display: flex;
  padding: 0.5rem;
  color: #959595;
  background-color: #e9e9e9;
  border-radius: 50px;
  cursor: pointer;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.05);
}
.label-files:hover { color: #4c4c4c; }

.label-voice,
.label-text {
  position: absolute;
  top: 50%;
  right: 0.25rem;
  transform: translateX(0) translateY(-50%) scale(1);
  width: 36px;
  height: 36px;
  display: flex;
  padding: 6px;
  border: none;
  outline: none;
  cursor: pointer;
  transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.05);
  z-index: 999;
}

.input-voice:checked ~ .label-voice {
  background-color: #e9e9e9;
  right: 0;
  width: 300px;
  height: 300px;
  border-radius: 3rem;
  box-shadow:
    0 10px 40px rgba(0, 0, 60, 0.25),
    inset 0 0 10px rgba(255, 255, 255, 0.5);
}

.label-voice { color: #959595; }
.label-voice:hover { color: #4c4c4c; }

.label-text {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transform: translateY(-50%) scale(0.25);
  color: #e9e9e9;
  background: linear-gradient(to top right, #9147ff, #ff4141);
  box-shadow: inset 0 0 4px rgba(255, 255, 255, 0.5);
  border-radius: 50px;
}

/* small, minimal helper styles for the page layout (center + right) */
:root {
  --bg: #ffffff;
  --muted: #6b7280;
  --accent: #6c5ce7;
  --bubble-bg: #f7f7fb;
}
html,body,#root { height: 100%; margin: 0; background: #fafbfd; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }
.fullscreen-grid {
  display: grid;
  grid-template-columns: 1fr 320px;
  grid-template-rows: 1fr;
  height: 100%;
  width: 100%;
  box-sizing: border-box;
}
.center-column {
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: stretch;
  overflow: hidden;
}
.messages-list {
  flex: 1;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-right: 8px;
}
.message-row { display:flex; gap:12px; align-items:flex-start; }
.avatar { width:40px; height:40px; border-radius:8px; background:#f3f4f6; display:flex; align-items:center; justify-content:center; font-weight:700; color:#374151; }
.bubble { max-width:80%; padding:10px 14px; border-radius:14px; background:var(--bubble-bg); color: #111827; border:1px solid rgba(16,24,40,0.03); box-shadow: 0 6px 12px rgba(16,24,40,0.04); }
.bubble.me { background: var(--accent); color: white; box-shadow: 0 8px 20px rgba(108,92,231,0.08); border:none; align-self: flex-end; }
.composer-wrapper { display:flex; justify-content:center; padding:12px 0; }
.input-container { width: 560px; display:flex; justify-content:center; }
.right-column { border-left: 1px solid rgba(16,24,40,0.04); padding:20px; overflow:auto; }
.participant-row { display:flex; align-items:center; justify-content:space-between; gap:8px; }
.presence-dot { width:10px; height:10px; border-radius:999px; }
`;

/* ---------------- Types ---------------- */
type Participant = {
  user: string;
  id?: string;
  status: "online" | "offline";
  lastSeen?: string;
};

/* ---------------- Helpers ---------------- */
function initials(name: string) {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/* ---------------- App ---------------- */
function AppInner() {
  const { room } = useParams<{ room: string }>();
  const navigate = useNavigate();
  const roomId = room ?? "general";

  const [name, setName] = useState(() => {
    try {
      const v = localStorage.getItem("cc:name");
      if (v) return v;
    } catch {}
    const n = names[Math.floor(Math.random() * names.length)];
    try {
      localStorage.setItem("cc:name", n);
    } catch {}
    return n;
  });

  const [clientId] = useState(() => {
    try {
      const v = localStorage.getItem("cc:clientId");
      if (v) return v;
    } catch {}
    const id = nanoid(8);
    try {
      localStorage.setItem("cc:clientId", id);
    } catch {}
    return id;
  });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [unread, setUnread] = useState(0);
  const [focused, setFocused] = useState(true);

  const socketRef = useRef<any>(null);
  const pendingRef = useRef<Map<string, any>>(new Map());

  // load persisted state for the room
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`cc:messages:${roomId}`);
      if (raw) setMessages(JSON.parse(raw));
      else setMessages([]);
    } catch {
      setMessages([]);
    }
    try {
      const rawP = localStorage.getItem(`cc:participants:${roomId}`);
      if (rawP) setParticipants(JSON.parse(rawP));
      else setParticipants([]);
    } catch {
      setParticipants([]);
    }
  }, [roomId]);

  useEffect(() => {
    try {
      localStorage.setItem(`cc:messages:${roomId}`, JSON.stringify(messages.slice(-500)));
    } catch {}
  }, [messages, roomId]);

  useEffect(() => {
    try {
      localStorage.setItem(`cc:participants:${roomId}`, JSON.stringify(participants));
    } catch {}
  }, [participants, roomId]);

  // reconcile server message with optimistic
  const reconcile = useCallback((msg: Message) => {
    setMessages((prev) => {
      // Match by id
      const byId = prev.findIndex((m) => m.id === msg.id);
      if (byId !== -1) {
        const copy = prev.slice();
        copy[byId] = { ...copy[byId], ...msg, pending: false } as any;
        pendingRef.current.delete(msg.id);
        return copy;
      }
      // Match recent optimistic message by user+content
      for (let i = prev.length - 1; i >= Math.max(0, prev.length - 40); i--) {
        const m = prev[i] as any;
        if (m.pending && m.user === msg.user && m.content === msg.content) {
          const copy = prev.slice();
          copy[i] = { ...m, ...msg, pending: false } as any;
          pendingRef.current.delete(m.id);
          return copy;
        }
      }
      // else append
      pendingRef.current.delete(msg.id);
      return [...prev, { ...(msg as any), pending: false }];
    });
  }, []);

  // incoming messages handler
  const onMessage = useCallback((evt: MessageEvent) => {
    try {
      const data = JSON.parse(evt.data as string) as Message;
      if (!data || typeof data !== "object") return;

      if (data.type === "presence") {
        const p: Participant = { user: data.user, id: data.id ?? data.user, status: data.status ?? "online", lastSeen: data.lastSeen };
        setParticipants((prev) => {
          const idx = prev.findIndex((x) => x.user === p.user);
          if (idx === -1) return [...prev, p];
          const copy = prev.slice();
          copy[idx] = { ...copy[idx], ...p };
          return copy;
        });
        return;
      }

      if (data.type === "participants") {
        const list = Array.isArray((data as any).participants) ? (data as any).participants : [];
        setParticipants(list.map((p: any) => ({ user: p.user, id: p.id, status: p.status ?? "online", lastSeen: p.lastSeen })));
        return;
      }

      if (data.type === "add") {
        // server message arrived
        reconcile(data);

        // mentions & unread
        const mention = typeof data.content === "string" && data.content.includes(`@${name}`);
        if (!focused || mention) {
          setUnread((u) => u + 1);
          if (mention && "Notification" in window && Notification.permission === "granted") {
            new Notification(`Mention — ${data.user}`, { body: (data.content || "").slice(0, 140) });
          }
        }
      }
    } catch (err) {
      console.warn("onMessage parse error", err);
    }
  }, [name, reconcile, focused]);

  // attach socket for the current room
  const partySocket = usePartySocket({
    party: "chat",
    room: roomId,
    onMessage: onMessage,
    onOpen() {
      // send presence and flush pending
      try {
        socketRef.current?.send(JSON.stringify({ type: "presence", user: name, status: "online", id: clientId, lastSeen: new Date().toISOString() }));
      } catch {}
      pendingRef.current.forEach((payload) => {
        try {
          socketRef.current?.send(JSON.stringify(payload));
        } catch {}
      });
    },
    onClose() {
      // no-op
    },
  });

  useEffect(() => {
    socketRef.current = partySocket;
  }, [partySocket]);

  // presence heartbeat
  useEffect(() => {
    const sendPresence = (status: "online" | "offline") => {
      try {
        socketRef.current?.send(JSON.stringify({ type: "presence", user: name, status, id: clientId, lastSeen: new Date().toISOString() }));
      } catch {}
      setParticipants((prev) => {
        const idx = prev.findIndex((p) => p.user === name);
        const p: Participant = { user: name, id: clientId, status, lastSeen: new Date().toISOString() };
        if (idx === -1) return [...prev, p];
        const copy = prev.slice();
        copy[idx] = { ...copy[idx], ...p };
        return copy;
      });
    };
    sendPresence("online");
    const hb = window.setInterval(() => sendPresence("online"), 30000);
    const onUnload = () => sendPresence("offline");
    window.addEventListener("beforeunload", onUnload);
    return () => {
      clearInterval(hb);
      try {
        socketRef.current?.send(JSON.stringify({ type: "presence", user: name, status: "offline", id: clientId, lastSeen: new Date().toISOString() }));
      } catch {}
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [name, clientId]);

  // focus/visibility -> unread reset
  useEffect(() => {
    const onFocus = () => { setFocused(true); setUnread(0); };
    const onBlur = () => setFocused(false);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    return () => { window.removeEventListener("focus", onFocus); window.removeEventListener("blur", onBlur); };
  }, []);

  // send helper (queue + optimistic)
  const send = useCallback((opts: { text?: string; file?: File }) => {
    if (!opts.text && !opts.file) return;
    if (opts.file) {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const payload: any = { type: "add", id: nanoid(12), content: dataUrl, user: name, role: "user", kind: "image", created_at: new Date().toISOString() };
        pendingRef.current.set(payload.id, payload);
        try { socketRef.current?.send(JSON.stringify(payload)); } catch {}
        setMessages((prev) => [...prev, { ...payload, pending: true } as any]);
      };
      reader.readAsDataURL(opts.file);
      return;
    }
    const payload: any = { type: "add", id: nanoid(12), content: opts.text, user: name, role: "user", created_at: new Date().toISOString() };
    pendingRef.current.set(payload.id, payload);
    try { socketRef.current?.send(JSON.stringify(payload)); } catch {}
    setMessages((prev) => [...prev, { ...payload, pending: true } as any]);
  }, [name]);

  // paste->file handler
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const items = Array.from(e.clipboardData.items || []);
      const imageItem = items.find((it) => it.type.startsWith("image/"));
      if (imageItem) {
        const file = imageItem.getAsFile();
        if (file) send({ file });
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [send]);

  // request notification permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // quick UI: no left channels; center messages + right participants
  return (
    <div>
      <style>{INPUT_HTML_CSS}</style>

      <div className="fullscreen-grid" role="application">
        {/* center */}
        <div className="center-column" aria-live="polite">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>#{roomId}</div>
            <div style={{ color: "var(--muted)" }}>{participants.filter(p => p.status === "online").length} online</div>
          </div>

          <div className="messages-list" id="messages-list">
            {messages.map((m: any) => {
              const isMe = m.user === name;
              const isImage = typeof m.content === "string" && m.content.startsWith("data:image/");
              const time = m.created_at ? new Date(m.created_at).toLocaleTimeString() : (m.createdAt ? new Date(m.createdAt).toLocaleTimeString() : "");
              const mention = typeof m.content === "string" && m.content.includes(`@${name}`);
              return (
                <div key={m.id} className="message-row" style={{ flexDirection: isMe ? "row-reverse" as const : "row" as const }}>
                  <div className="avatar" aria-hidden>{initials(m.user)}</div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start", minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                      <div style={{ fontWeight: 700 }}>{m.user}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>{time}</div>
                      {mention && <div style={{ background: "#fffbeb", color: "#b45309", padding: "2px 8px", borderRadius: 999, fontSize: 12 }}>mentioned you</div>}
                    </div>
                    <div className={`bubble ${isMe ? "me" : ""}`} style={{ marginTop: 6 }}>
                      {isImage ? <img src={m.content} alt="img" style={{ maxWidth: 420, borderRadius: 8 }} /> : <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>}
                      {m.pending ? <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>Sending…</div> : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* bottom-centered input (exact HTML structure) */}
          <div className="composer-wrapper" aria-hidden={false}>
            <div className="input-container">
              <div className="container-ia-chat">
                <input type="checkbox" name="input-voice" id="input-voice" className="input-voice" style={{ display: "none" }} />
                <input type="text" name="input-text" id="input-text" placeholder="Ask Anything..." className="input-text" required title="" 
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const v = (e.target as HTMLInputElement).value.trim();
                      if (v) { send({ text: v }); (e.target as HTMLInputElement).value = ""; }
                    }
                  }}
                />
                <input type="checkbox" name="input-files" id="input-files" className="input-files" style={{ display: "none" }} />
                <div className="container-upload-files" aria-hidden>
                  {/* icons (the same inline svgs as provided) */}
                  <svg className="upload-file" xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
                    <g fill="none" stroke="currentColor" strokeWidth={2}>
                      <circle cx={12} cy={13} r={3} />
                      <path d="M9.778 21h4.444c3.121 0 4.682 0 5.803-.735a4.4 4.4 0 0 0 1.226-1.204c.749-1.1.749-2.633.749-5.697s0-4.597-.749-5.697a4.4 4.4 0 0 0-1.226-1.204c-.72-.473-1.622-.642-3.003-.702c-.659 0-1.226-.49-1.355-1.125A2.064 2.064 0 0 0 13.634 3h-3.268c-.988 0-1.839.685-2.033 1.636c-.129.635-.696 1.125-1.355 1.125c-1.38.06-2.282.23-3.003.702A4.4 4.4 0 0 0 2.75 7.667C2 8.767 2 10.299 2 13.364s0 4.596.749 5.697c.324.476.74.885 1.226 1.204C5.096 21 6.657 21 9.778 21Z" />
                    </g>
                  </svg>

                  <svg className="upload-file" xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
                    <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}>
                      <rect width={18} height={18} x={3} y={3} rx={2} ry={2} />
                      <circle cx={9} cy={9} r={2} />
                      <path d="m21 15l-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                    </g>
                  </svg>

                  <svg className="upload-file" xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
                    <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m6 14l1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2" />
                  </svg>
                </div>

                <label htmlFor="input-files" className="label-files" onClick={() => {
                  // trigger a hidden file input to pick a file
                  const el = document.getElementById("hidden-file-input") as HTMLInputElement | null;
                  el?.click();
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
                    <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14m-7-7v14" />
                  </svg>
                </label>

                <label htmlFor="input-voice" className="label-voice">
                  <svg className="icon-voice" xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
                    <path fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth={2} d="M12 4v16m4-13v10M8 7v10m12-6v2M4 11v2" />
                  </svg>
                </label>

                <label htmlFor="input-text" className="label-text" aria-hidden>
                  <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
                    <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m5 12l7-7l7 7m-7 7V5" />
                  </svg>
                </label>
              </div>

              {/* hidden real file input */}
              <input id="hidden-file-input" type="file" accept="image/*" style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.currentTarget.value = "";
                  if (f) send({ file: f });
                }}
              />
            </div>
          </div>
        </div>

        {/* right column participants */}
        <div className="right-column" role="complementary" aria-label="Participants">
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Participants</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {participants.length === 0 ? <div style={{ color: "var(--muted)" }}>No participants yet</div> : participants.map((p) => (
              <div key={p.user} className="participant-row">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div className="avatar" aria-hidden>{initials(p.user)}</div>
                  <div>
                    <div style={{ fontWeight: 700 }}>{p.user}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{p.lastSeen ? new Date(p.lastSeen).toLocaleString() : p.status}</div>
                  </div>
                </div>
                <div className="presence-dot" style={{ background: p.status === "online" ? "#34d399" : "#cbd5e1" }} />
              </div>
            ))}
          </div>

          <div style={{ marginTop: "auto", marginTop: 12, fontSize: 12, color: "var(--muted)" }}>
            Your name: <strong>{name}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Router + mount ---------------- */
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Navigate to="/general" />} />
      <Route path="/:room" element={<AppInner />} />
      <Route path="*" element={<Navigate to="/general" />} />
    </Routes>
  </BrowserRouter>,
);
