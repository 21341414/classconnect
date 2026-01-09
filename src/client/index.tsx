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

/* -------------------- Styles -------------------- */
const S: Record<string, React.CSSProperties> = {
  app: {
    width: "100vw",
    height: "100vh",
    display: "grid",
    gridTemplateColumns: "72px 1fr 300px",
    background: "#0f172a",
    color: "#e5e7eb",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
  },

  /* Left servers */
  servers: {
    background: "#020617",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "8px 0",
    gap: 8,
  },
  serverBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    background: "#1e293b",
    color: "white",
    border: "none",
    cursor: "pointer",
    fontWeight: 700,
  },
  serverActive: {
    background: "#2563eb",
  },

  /* Center */
  center: {
    display: "flex",
    flexDirection: "column",
    background: "#020617",
  },
  header: {
    height: 56,
    borderBottom: "1px solid #1e293b",
    padding: "0 16px",
    display: "flex",
    alignItems: "center",
    fontWeight: 600,
  },
  messagesWrap: {
    flex: 1,
    overflow: "auto",
    padding: 16,
    display: "flex",
    justifyContent: "center",
  },
  messages: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    width: "100%",
    maxWidth: 860,
  },
  bubble: {
    background: "#1e293b",
    padding: "10px 12px",
    borderRadius: 8,
    maxWidth: "70%",
  },
  bubbleMe: {
    background: "#2563eb",
    alignSelf: "flex-end",
  },
  composer: {
    padding: 12,
    borderTop: "1px solid #1e293b",
    display: "flex",
    gap: 8,
  },
  input: {
    flex: 1,
    padding: "10px 12px",
    borderRadius: 6,
    border: "none",
    outline: "none",
    background: "#020617",
    color: "white",
  },
  send: {
    padding: "10px 14px",
    borderRadius: 6,
    border: "none",
    background: "#2563eb",
    color: "white",
    cursor: "pointer",
  },

  /* Right */
  right: {
    background: "#020617",
    borderLeft: "1px solid #1e293b",
    padding: 16,
  },
  participant: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 0",
  },
  dot: (online: boolean): React.CSSProperties => ({
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: online ? "#34d399" : "#6b7280",
  }),
};

/* -------------------- Helpers -------------------- */
function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

/* -------------------- App -------------------- */
function App() {
  const { room } = useParams();
  const navigate = useNavigate();

  /* ---------- identity ---------- */
  const [name] = useState(() => {
    const stored = localStorage.getItem("cc:name");
    if (stored) return stored;
    const n = names[Math.floor(Math.random() * names.length)];
    localStorage.setItem("cc:name", n);
    return n;
  });

  /* ---------- servers ---------- */
  const [servers, setServers] = useState<string[]>(() => {
    const stored = localStorage.getItem("cc:servers");
    return stored ? JSON.parse(stored) : [];
  });

  useEffect(() => {
    if (!room) return;
    setServers((prev) => {
      if (prev.includes(room)) return prev;
      const updated = [...prev, room];
      localStorage.setItem("cc:servers", JSON.stringify(updated));
      return updated;
    });
    // remember last server
    localStorage.setItem("cc:lastServer", room);
  }, [room]);

  /* ---------- state ---------- */
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [participants, setParticipants] = useState<Record<string, { lastSeen: number }>>({});

  /* ---------- socket ---------- */
  const socketRef = useRef<WebSocket | null>(null);

  const socket = usePartySocket({
    party: "chat",
    room,
    onOpen() {
      // store reference if available
      // send a join presence
      try {
        socketRef.current = (socketRef.current ?? (socket as any)) as WebSocket;
        // prefer send on the returned socket if available
        const s = (socketRef.current as any) || (socket as any);
        s?.send(
          JSON.stringify({
            type: "presence",
            action: "join",
            user: name,
            ts: Date.now(),
          }),
        );
      } catch (e) {
        // ignore
      }
    },
    onMessage(evt) {
      const msg = JSON.parse(evt.data);

      if (msg.type === "presence") {
        setParticipants((prev) => {
          const next = { ...prev };
          if (msg.action === "join") {
            next[msg.user] = { lastSeen: Date.now() };
          } else if (msg.action === "leave") {
            delete next[msg.user];
          } else if (msg.action === "update") {
            next[msg.user] = { lastSeen: Date.now() };
          }
          return next;
        });
        return;
      }

      if (msg.type === "add") {
        setMessages((m) => [...m, msg]);
      } else if (Array.isArray(msg.messages)) {
        setMessages(msg.messages);
      }
    },
  });

  // keep a ref to the returned socket if available
  useEffect(() => {
    if (!socket) return;
    socketRef.current = socket as unknown as WebSocket;
  }, [socket]);

  // send periodic presence updates (heartbeat)
  useEffect(() => {
    if (!socketRef.current) return;
    const iv = setInterval(() => {
      try {
        socketRef.current?.send(
          JSON.stringify({ type: "presence", action: "update", user: name, ts: Date.now() }),
        );
      } catch (e) {
        // ignore
      }
    }, 15000);
    return () => clearInterval(iv);
  }, [name]);

  // send leave on unload/unmount
  useEffect(() => {
    const handler = () => {
      try {
        socketRef.current?.send(JSON.stringify({ type: "presence", action: "leave", user: name }));
      } catch (e) {
        // ignore
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => {
      handler();
      window.removeEventListener("beforeunload", handler);
    };
  }, [name]);

  /* ---------- send ---------- */
  const send = useCallback(
    (text: string) => {
      const message: ChatMessage = {
        id: nanoid(),
        content: text,
        user: name,
        role: "user",
      };
      setMessages((m) => [...m, message]);
      try {
        (socketRef.current ?? (socket as any))?.send(JSON.stringify({ type: "add", ...message } satisfies Message));
      } catch (e) {
        // ignore
      }
    },
    [name, socket],
  );

  const handleAddServer = useCallback(() => {
    const id = nanoid();
    setServers((prev) => {
      const updated = [...prev, id];
      localStorage.setItem("cc:servers", JSON.stringify(updated));
      return updated;
    });
    localStorage.setItem("cc:lastServer", id);
    navigate(`/${id}`);
  }, [navigate]);

  const handleSelectServer = useCallback(
    (s: string) => {
      localStorage.setItem("cc:lastServer", s);
      navigate(`/${s}`);
    },
    [navigate],
  );

  const participantsList = useMemo(() => Object.keys(participants), [participants]);

  return (
    <div style={S.app}>
      {/* Servers */}
      <aside style={S.servers}>
        {servers.map((s) => (
          <button
            key={s}
            style={{
              ...S.serverBtn,
              ...(s === room ? S.serverActive : {}),
            }}
            onClick={() => handleSelectServer(s)}
          >
            {s.slice(0, 2)}
          </button>
        ))}
        <button style={S.serverBtn} onClick={handleAddServer}>
          +
        </button>
      </aside>

      {/* Center */}
      <main style={S.center}>
        <div style={S.header}>#{room}</div>

        <div style={S.messagesWrap}>
          <div style={S.messages}>
            {messages.map((m) => (
              <div
                key={m.id}
                style={{
                  ...S.bubble,
                  ...(m.user === name ? S.bubbleMe : {}),
                }}
              >
                <strong>{m.user}</strong>
                <div>{m.content}</div>
              </div>
            ))}
          </div>
        </div>

        <form
          style={S.composer}
          onSubmit={(e) => {
            e.preventDefault();
            const input = e.currentTarget.elements.namedItem("msg") as HTMLInputElement;
            if (!input.value.trim()) return;
            send(input.value);
            input.value = "";
          }}
        >
          <input name="msg" style={S.input} placeholder="Message…" />
          <button style={S.send}>Send</button>
        </form>
      </main>

      {/* Right */}
      <aside style={S.right}>
        <h4>Participants</h4>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {participantsList.map((p) => {
            const last = participants[p]?.lastSeen ?? 0;
            const online = Date.now() - last < 30000; // online if seen in last 30s
            return (
              <li key={p} style={S.participant}>
                <div style={S.dot(online)} />
                <div>
                  <div style={{ fontWeight: 600 }}>{p}</div>
                  <div style={{ fontSize: 12, color: "#9ca3af" }}>
                    {online ? "online" : "away"}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </aside>
    </div>
  );
}

/* -------------------- RedirectToLast -------------------- */
function RedirectToLast() {
  const [to, setTo] = useState<string | null>(null);
  useEffect(() => {
    const last = localStorage.getItem("cc:lastServer");
    setTo(last || nanoid());
  }, []);
  if (!to) return null;
  return <Navigate to={`/${to}`} replace />;
}

/* -------------------- Router -------------------- */
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<RedirectToLast />} />
      <Route path="/:room" element={<App />} />
    </Routes>
  </BrowserRouter>,
);
