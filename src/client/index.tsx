import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { usePartySocket } from "partysocket/react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useParams,
} from "react-router";
import { nanoid } from "nanoid";

import { names, type ChatMessage, type Message } from "../shared";

/* ---------- Persistent state ---------- */
function usePersistentState<T>(key: string, initial: T | (() => T)) {
  const initializer =
    typeof initial === "function" ? (initial as () => T) : () => initial;

  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initializer();
    } catch {
      return initializer();
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {}
  }, [key, state]);

  return [state, setState] as const;
}

/* ---------- Styles (LIGHT ONLY) ---------- */
const styles = {
  app: {
    width: "100vw",
    height: "100vh",
    display: "grid",
    gridTemplateRows: "56px 1fr",
    gridTemplateColumns: "72px 1fr 320px",
    background: "#f3f6fb",
    color: "#0b1726",
    overflow: "hidden",
  },

  leftNav: {
    background: "#ffffff",
    borderRight: "1px solid #eef3fb",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    padding: "12px 8px",
    gap: 12,
  },

  leftNavButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#5865f2",
    color: "#ffffff",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 6px 16px rgba(88,101,242,0.12)",
  },

  header: {
    display: "flex",
    alignItems: "center",
    padding: "12px 16px",
    borderBottom: "1px solid #eef3fb",
    background: "#fafbff",
    gap: 12,
    zIndex: 20,
  },

  headerTitle: { fontSize: 16, fontWeight: 700 as const },

  center: {
    padding: 12,
    display: "flex",
    flexDirection: "column" as const,
    minHeight: 0,
    gap: 12,
  },

  messagesPanel: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    background: "#ffffff",
    borderRadius: 8,
    minHeight: 0,
    overflow: "hidden",
  },

  messagesList: {
    flex: 1,
    overflow: "auto",
    padding: 16,
    display: "flex",
    flexDirection: "column" as const,
    gap: 16,
  },

  composer: {
    borderTop: "1px solid #eef3fb",
    padding: 12,
    display: "flex",
    gap: 8,
    alignItems: "center",
    background: "#fafbff",
  },

  input: {
    flex: 1,
    padding: "12px 14px",
    borderRadius: 10,
    border: "1px solid #e6eef8",
    background: "#fbfdff",
    color: "#0b1726",
    outline: "none",
  },

  sendBtn: {
    background: "#5865f2",
    color: "white",
    border: "none",
    padding: "12px 16px",
    borderRadius: 10,
    cursor: "pointer",
  },

  rightSidebar: {
    padding: 16,
    background: "#fafbff",
    borderLeft: "1px solid #eef3fb",
    overflow: "auto",
  },

  avatar: {
    width: 40,
    height: 40,
    borderRadius: 8,
    background: "#e6eef8",
    color: "#0b1726",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 14,
    flexShrink: 0,
  },

  bubbleMe: {
    alignSelf: "flex-end",
    background: "#5865f2",
    color: "white",
    padding: "10px 14px",
    borderRadius: "14px 14px 4px 14px",
    maxWidth: "78%",
    wordBreak: "break-word" as const,
  },

  bubbleThem: {
    alignSelf: "flex-start",
    background: "#f1f5fb",
    color: "#0b1726",
    padding: "10px 14px",
    borderRadius: "14px 14px 14px 4px",
    maxWidth: "78%",
    wordBreak: "break-word" as const,
  },

  authorLine: {
    fontSize: 13,
    fontWeight: 700 as const,
    marginBottom: 6,
  },

  timeSmall: {
    fontSize: 11,
    color: "#6d7790",
    marginLeft: 8,
  },

  participantsTitle: {
    fontWeight: 700 as const,
    marginBottom: 8,
  },
};

/* ---------- Types ---------- */
type Participant = {
  user: string;
  status: "online" | "offline";
  lastSeen?: string;
  id?: string;
};

/* ---------- Helpers ---------- */
function initialsFromName(name: string) {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  return parts.length === 1
    ? parts[0].slice(0, 2).toUpperCase()
    : (parts[0][0] + parts[1][0]).toUpperCase();
}

/* ---------- App ---------- */
function AppInner() {
  const { room } = useParams<{ room: string }>();
  const roomId = room ?? "main";

  const [name, setName] = usePersistentState<string>("cc:name", () => {
    const stored = localStorage.getItem("cc:name");
    if (stored) return stored;
    return names[Math.floor(Math.random() * names.length)];
  });

  const [editingName, setEditingName] = useState(name);

  const [messages, setMessages] = usePersistentState<ChatMessage[]>(
    `cc:messages:${roomId}`,
    [],
  );

  const [participants, setParticipants] = usePersistentState<Participant[]>(
    `cc:participants:${roomId}`,
    [],
  );

  const socketRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleIncoming = useCallback(
    (evt: MessageEvent) => {
      const msg = JSON.parse(evt.data) as Message;

      if (msg.type === "add") {
        setMessages((prev) =>
          prev.some((m) => m.id === msg.id)
            ? prev
            : [...prev, msg as ChatMessage],
        );
      }

      if (msg.type === "update") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msg.id ? { ...m, content: msg.content } : m,
          ),
        );
      }

      if (msg.type === "presence") {
        setParticipants((prev) => {
          const map = new Map(prev.map((p) => [p.user, p]));
          map.set(msg.user, {
            user: msg.user,
            status: msg.status ?? "online",
            lastSeen: msg.lastSeen,
            id: msg.id,
          });
          return [...map.values()];
        });
      }
    },
    [setMessages, setParticipants],
  );

  const socket = usePartySocket({
    party: "chat",
    room: roomId,
    onMessage: handleIncoming,
  });

  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  const sendChat = (content: string) => {
    if (!content.trim()) return;
    const chatMessage: ChatMessage = {
      id: nanoid(8),
      content,
      user: name,
      role: "user",
    };
    setMessages((prev) => [...prev, chatMessage]);
    socketRef.current?.send(
      JSON.stringify({ type: "add", ...chatMessage }),
    );
  };

  return (
    <div style={styles.app}>
      <nav style={styles.leftNav}>
        <div style={styles.leftNavButton}>CC</div>
      </nav>

      <header style={styles.header}>
        <div style={styles.headerTitle}>ClassConnect</div>
        <div style={{ marginLeft: "auto", fontSize: 13 }}>
          Room <b>{roomId}</b>
        </div>
      </header>

      <main style={styles.center}>
        <div style={styles.messagesPanel}>
          <div style={styles.messagesList}>
            {messages.map((m) => {
              const isMe = m.user === name;
              return (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    flexDirection: isMe ? "row-reverse" : "row",
                    gap: 12,
                  }}
                >
                  <div style={styles.avatar}>
                    {initialsFromName(m.user)}
                  </div>
                  <div style={isMe ? styles.bubbleMe : styles.bubbleThem}>
                    <div style={styles.authorLine}>{m.user}</div>
                    {m.content}
                  </div>
                </div>
              );
            })}
          </div>

          <form
            style={styles.composer}
            onSubmit={(e) => {
              e.preventDefault();
              if (!inputRef.current) return;
              sendChat(inputRef.current.value);
              inputRef.current.value = "";
            }}
          >
            <input
              ref={inputRef}
              style={styles.input}
              placeholder="Message…"
            />
            <button style={styles.sendBtn}>Send</button>
          </form>
        </div>
      </main>

      <aside style={styles.rightSidebar}>
        <div style={styles.participantsTitle}>Participants</div>
        {participants.map((p) => (
          <div key={p.user}>{p.user}</div>
        ))}
      </aside>
    </div>
  );
}

/* ---------- Mount ---------- */
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Navigate to={`/${nanoid()}`} />} />
      <Route path="/:room" element={<AppInner />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  </BrowserRouter>,
);
