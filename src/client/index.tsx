import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { usePartySocket } from "partysocket/react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useParams,
  useNavigate,
} from "react-router";
import { nanoid } from "nanoid";

import { names, type ChatMessage, type Message } from "../shared";

/* ---------------- Types ---------------- */
type Theme = "light" | "dark";

type ServerItem = {
  id: string;
  label?: string;
  type?: "server" | "dm";
};

type Participant = {
  user: string;
  status: "online" | "offline";
  lastSeen?: string;
  id?: string;
};

/* ---------------- persistent helper ---------------- */
function usePersistentState<T>(key: string, initial: T | (() => T)) {
  const initializer = typeof initial === "function" ? (initial as () => T) : () => initial;
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

/* ---------------- styles (sidebar like image + bottom nav) ---------------- */
const styles = (theme: Theme) => {
  const isDark = theme === "dark";
  const bg = isDark ? "#0b1220" : "#f5f6f8";
  const sidebarBg = isDark ? "#07101a" : "#ffffff";
  const muted = isDark ? "#9aa6b2" : "#9ca3af";
  const text = isDark ? "#e6eef8" : "#111827";
  const accent = "#6c5ce7";
  const selectedBg = isDark ? "rgba(108,92,231,0.08)" : "#f3f4f6";

  return {
    app: {
      width: "100vw",
      height: "100vh",
      display: "grid",
      gridTemplateColumns: "72px 300px 1fr 320px",
      gridTemplateRows: "72px 1fr",
      gap: 0,
      background: bg,
      color: text,
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
      boxSizing: "border-box" as const,
      overflow: "hidden",
    },
    /* very left server column */
    serversCol: {
      gridColumn: "1 / 2",
      gridRow: "1 / -1",
      padding: 12,
      display: "flex",
      flexDirection: "column" as const,
      alignItems: "center",
      gap: 12,
      background: "transparent",
    },
    serverIcon: {
      width: 48,
      height: 48,
      borderRadius: 12,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: 700,
      cursor: "pointer",
      border: "none",
    },

    /* left sidebar (channels list like image) */
    leftPanel: {
      gridColumn: "2 / 3",
      gridRow: "1 / -1",
      background: sidebarBg,
      borderRight: `1px solid ${isDark ? "#0b1722" : "#eef2f7"}`,
      padding: "18px",
      boxSizing: "border-box" as const,
      display: "flex",
      flexDirection: "column" as const,
      gap: 14,
      borderTopLeftRadius: 18,
      borderBottomLeftRadius: 18,
      position: "relative" as const,
      overflow: "auto",
    },
    brand: { display: "flex", alignItems: "center", gap: 12, paddingBottom: 6 },
    brandLogo: {
      width: 36,
      height: 36,
      borderRadius: 8,
      background: "#111827",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "white",
      fontWeight: 800,
      fontSize: 14,
    },
    brandTitle: { fontWeight: 800, fontSize: 18 },

    groupLabel: { fontSize: 13, color: muted, marginTop: 6, marginBottom: 6 },
    channelRow: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "8px 10px",
      borderRadius: 10,
      cursor: "pointer",
    },
    channelRowActive: {
      background: selectedBg,
    },
    channelIcon: {
      width: 28,
      height: 28,
      borderRadius: 8,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#f3f4f6",
      flexShrink: 0,
    },

    /* center header + content */
    header: {
      gridColumn: "3 / 4",
      gridRow: "1 / 2",
      display: "flex",
      alignItems: "center",
      padding: "18px",
      borderBottom: `1px solid ${isDark ? "#071622" : "#eef2f7"}`,
      background: "transparent",
      gap: 12,
    },
    headerTitle: { fontSize: 16, fontWeight: 700 },

    center: {
      gridColumn: "3 / 4",
      gridRow: "2 / -1",
      padding: "20px",
      display: "flex",
      flexDirection: "column" as const,
      gap: 12,
      minHeight: 0,
      overflow: "hidden",
    },
    messagesPanel: {
      flex: 1,
      display: "flex",
      flexDirection: "column" as const,
      gap: 12,
      overflow: "hidden",
    },
    messagesList: {
      flex: 1,
      overflow: "auto",
      display: "flex",
      flexDirection: "column" as const,
      gap: 12,
      paddingRight: 8,
      paddingLeft: 8,
    },

    composerWrap: {
      borderTop: `1px solid ${isDark ? "#071622" : "#eef2f7"}`,
      paddingTop: 12,
      paddingBottom: 12,
    },
    input: {
      width: "100%",
      padding: "12px 14px",
      borderRadius: 12,
      border: `1px solid rgba(17,24,39,0.06)`,
      background: "#fff",
      outline: "none",
      fontSize: 14,
    },

    /* right panel */
    rightPanel: {
      gridColumn: "4 / 5",
      gridRow: "1 / -1",
      padding: 20,
      background: "#ffffff",
      borderLeft: `1px solid ${isDark ? "#071622" : "#eef2f7"}`,
      overflow: "auto",
    },

    bubbleMe: {
      alignSelf: "flex-end",
      background: accent,
      color: "white",
      padding: "10px 14px",
      borderRadius: 14,
      maxWidth: "70%",
      wordBreak: "break-word" as const,
    },
    bubbleThem: {
      alignSelf: "flex-start",
      background: "#f7f7fb",
      color: text,
      padding: "10px 14px",
      borderRadius: 12,
      maxWidth: "70%",
      wordBreak: "break-word" as const,
      border: "1px solid #f1f3f5",
    },

    /* bottom nav that mimics the mobile bar in the image */
    bottomNavWrap: {
      position: "sticky" as const,
      bottom: 0,
      left: 0,
      right: 0,
      marginTop: 12,
      paddingTop: 12,
      paddingBottom: 12,
      background: "transparent",
      display: "flex",
      justifyContent: "space-between",
      gap: 10,
    },
    bottomNav: {
      display: "flex",
      gap: 8,
      alignItems: "center",
      width: "100%",
      justifyContent: "space-around",
      padding: "10px 8px",
      borderRadius: 12,
      background: "transparent",
    },
    navItem: {
      display: "flex",
      flexDirection: "column" as const,
      alignItems: "center",
      gap: 6,
      color: muted,
      cursor: "pointer",
      fontSize: 12,
    },

    muted,
    text,
    accent,
  };
};

/* ---------------- helpers ---------------- */
function initialsFromName(name: string) {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/* ---------------- AppInner ---------------- */
function AppInner() {
  const { room } = useParams<{ room: string }>();
  const navigate = useNavigate();
  const roomId = room ?? "main";

  const [clientId] = usePersistentState<string>("cc:clientId", () => nanoid(8));

  const [name, setName] = usePersistentState<string>("cc:name", () => {
    const stored = localStorage.getItem("cc:name");
    if (stored) return stored;
    return names[Math.floor(Math.random() * names.length)];
  });
  const [editingName, setEditingName] = useState(name);

  const theme: Theme = "light";

  const messagesKey = `cc:messages:${roomId}`;
  const [messages, setMessages] = usePersistentState<ChatMessage[]>(messagesKey, []);

  const participantsKey = `cc:participants:${roomId}`;
  const [participants, setParticipants] = usePersistentState<Participant[]>(participantsKey, []);

  // servers persisted (no DM system anymore)
  const [servers, setServers] = usePersistentState<ServerItem[]>("cc:servers", () => {
    try {
      const raw = localStorage.getItem("cc:servers");
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      const arr = Array.isArray(parsed) ? parsed : [];
      const normalized = arr
        .map((item: any) => {
          if (!item) return null;
          if (typeof item === "string") {
            const id = item.trim();
            if (!id) return null;
            return { id, label: id.slice(0, 6), type: "server" } as ServerItem;
          }
          if (typeof item === "object") {
            const id = item.id ?? (typeof item.label === "string" ? item.label : null);
            if (!id) return null;
            const sid = String(id);
            return { id: sid, label: item.label ?? sid.slice(0, 6), type: "server" } as ServerItem;
          }
          return null;
        })
        .filter(Boolean) as ServerItem[];
      try {
        localStorage.setItem("cc:servers", JSON.stringify(normalized));
      } catch {}
      return normalized;
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (!roomId) return;
    const found = servers.find((s) => s && s.id === roomId);
    if (!found) {
      const item: ServerItem = {
        id: roomId,
        label: String(roomId).slice(0, 6),
        type: "server",
      };
      setServers((prev) => {
        if (prev.some((p) => p && p.id === item.id)) return prev;
        return [...prev, item];
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const socketRef = useRef<any>(null);
  const heartbeatRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const S = useMemo(() => styles(theme), [theme]);

  const addMessage = useCallback((m: ChatMessage) => {
    if (!m || !m.id) return;
    setMessages((prev) => {
      if (prev.some((x) => x.id === m.id)) return prev;
      return [...prev, m];
    });
  }, [setMessages]);

  const updateMessage = useCallback((m: ChatMessage) => {
    setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x)));
  }, [setMessages]);

  const visibleMessages = useMemo(() => messages.filter((m) => m.role !== "system"), [messages]);

  const handleIncoming = useCallback(
    (evt: MessageEvent) => {
      try {
        const msg = JSON.parse(evt.data as string) as Message;
        if (!msg || typeof msg !== "object") return;

        if (msg.type === "add") {
          const newMsg: ChatMessage = {
            id: msg.id,
            content: msg.content,
            user: msg.user,
            role: msg.role,
          };
          addMessage(newMsg);
        } else if (msg.type === "update") {
          const updated: ChatMessage = {
            id: msg.id,
            content: msg.content,
            user: msg.user,
            role: msg.role,
          };
          updateMessage(updated);
        } else if (msg.type === "presence") {
          const p: Participant = { user: msg.user, status: msg.status || "online", lastSeen: msg.lastSeen, id: msg.id };
          setParticipants((prev) => {
            const found = prev.findIndex((x) => x.user === p.user);
            if (found === -1) return [...prev, p];
            const copy = prev.slice();
            copy[found] = { ...copy[found], ...p };
            return copy;
          });
        } else if (msg.type === "participants") {
          const list = Array.isArray((msg as any).participants) ? (msg as any).participants : [];
          const normalized = list.map((p: any) => ({
            user: p.user,
            status: p.status || "online",
            lastSeen: p.lastSeen,
            id: p.id,
          })) as Participant[];
          setParticipants(normalized);
        } else {
          // ignore unknown/system messages
        }
      } catch (err) {
        console.warn("Failed to parse incoming message", err);
      }
    },
    [addMessage, updateMessage, setParticipants],
  );

  const partySocket = usePartySocket({
    party: "chat",
    room: roomId,
    onMessage: handleIncoming,
  });

  useEffect(() => {
    socketRef.current = partySocket;
  }, [partySocket]);

  useEffect(() => {
    const sendPresence = (status: "online" | "offline") => {
      const payload = {
        type: "presence",
        user: name,
        status,
        id: clientId,
        lastSeen: new Date().toISOString(),
      } as any;
      try {
        socketRef.current?.send(JSON.stringify(payload));
      } catch {}
      setParticipants((prev) => {
        const found = prev.findIndex((p) => p.user === name);
        const p: Participant = { user: name, status, lastSeen: payload.lastSeen, id: payload.id };
        if (found === -1) return [...prev, p];
        const copy = prev.slice();
        copy[found] = { ...copy[found], ...p };
        return copy;
      });
    };

    sendPresence("online");
    heartbeatRef.current = window.setInterval(() => sendPresence("online"), 30000);

    const onUnload = () => sendPresence("offline");
    window.addEventListener("beforeunload", onUnload);
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      sendPresence("offline");
      window.removeEventListener("beforeunload", onUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, roomId, clientId]);

  useEffect(() => {
    const el = document.getElementById("messages-list");
    if (el) requestAnimationFrame(() => (el.scrollTop = el.scrollHeight));
  }, [visibleMessages]);

  const sendChat = (content: string) => {
    if (!content.trim()) return;
    const chatMessage: ChatMessage = {
      id: nanoid(12),
      content,
      user: name,
      role: "user",
    };
    addMessage(chatMessage); // optimistic (deduped)
    try {
      socketRef.current?.send(
        JSON.stringify({
          type: "add",
          ...chatMessage,
        } satisfies Message),
      );
    } catch (err) {
      console.warn("send failed", err);
    }
  };

  const applyName = (newName?: string) => {
    const target = (newName ?? editingName).trim() || name;
    if (target === name) {
      setEditingName(target);
      return;
    }
    setName(target);
    setEditingName(target);
    try {
      socketRef.current?.send(
        JSON.stringify({ type: "presence", user: target, status: "online", id: clientId, lastSeen: new Date().toISOString() }),
      );
    } catch {}
  };

  const addServer = (id: string, label?: string) => {
    if (!id) return;
    const sid = String(id);
    setServers((prev) => {
      if (prev.some((s) => s && s.id === sid)) return prev;
      const item: ServerItem = { id: sid, label: label ?? sid.slice(0, 6), type: "server" };
      return [...prev, item];
    });
  };

  const navigateToServer = (id: string) => {
    if (!id) return;
    addServer(id, id.slice(0, 6));
    window.location.pathname = `/${id}`;
  };

  const serverIcons = useMemo(() => servers, [servers]);

  /* ---------------- render ---------------- */
  return (
    <div style={S.app} data-theme={theme} className="chat-fullscreen">
      {/* servers (left-most) */}
      <div style={S.serversCol}>
        <button
          title="ClassConnect"
          onClick={() => navigateToServer("home")}
          style={{ ...S.serverIcon, background: "#6c5ce7", color: "white" }}
        >
          CC
        </button>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {serverIcons.map((s) => {
            const label = s?.label ?? s?.id ?? "S";
            const isActive = s.id === roomId;
            return (
              <button
                key={s.id}
                title={label}
                onClick={() => navigateToServer(s.id)}
                style={{
                  ...S.serverIcon,
                  background: isActive ? "#6c5ce7" : "#eef2ff",
                  color: isActive ? "white" : "#111827",
                }}
              >
                {String(label).slice(0, 2).toUpperCase()}
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 8, width: "100%", alignItems: "center" }}>
          <button
            title="New room"
            onClick={() => {
              const r = nanoid(8);
              addServer(r, r.slice(0, 6));
              navigateToServer(r);
            }}
            style={{ ...S.serverIcon, width: 40, height: 40, borderRadius: 10, background: "#111827", color: "white" }}
          >
            +
          </button>
        </div>
      </div>

      {/* left sidebar: channels grouped like the mobile image */}
      <aside style={S.leftPanel}>
        <div style={S.brand}>
          <div style={S.brandLogo}>B</div>
          <div style={S.brandTitle}>Design Buddies</div>
        </div>

        <div>
          <div style={S.groupLabel}>Job Search</div>
          <div
            onClick={() => navigateToServer("paid-opportunities")}
            style={{ ...S.channelRow }}
          >
            <div style={S.channelIcon}>💼</div>
            <div style={{ fontWeight: 700 }}>paid-opportunities</div>
          </div>
          <div
            onClick={() => navigateToServer("for-hire")}
            style={{ ...S.channelRow }}
          >
            <div style={S.channelIcon}>🚀</div>
            <div style={{ fontWeight: 700 }}>for-hire</div>
          </div>
        </div>

        <div>
          <div style={S.groupLabel}>General Discussion</div>
          <div
            onClick={() => navigateToServer("introductions")}
            style={{ ...S.channelRow }}
          >
            <div style={S.channelIcon}>🌱</div>
            <div>introductions</div>
          </div>

          <div
            onClick={() => navigateToServer("general")}
            style={{ ...S.channelRow, ...(roomId === "general" ? S.channelRowActive : {}) }}
          >
            <div style={S.channelIcon}>#</div>
            <div style={{ fontWeight: 700 }}>general</div>
          </div>

          <div
            onClick={() => navigateToServer("design-discussions")}
            style={{ ...S.channelRow }}
          >
            <div style={S.channelIcon}>🎨</div>
            <div style={{ fontWeight: 700 }}>design-discussions</div>
            <div style={{ marginLeft: "auto", color: S.muted, fontSize: 12 }}>3 New</div>
          </div>

          <div
            onClick={() => navigateToServer("professionals-hangout")}
            style={{ ...S.channelRow }}
          >
            <div style={S.channelIcon}>💎</div>
            <div>professionals-hangout</div>
          </div>

          <div
            onClick={() => navigateToServer("support-group")}
            style={{ ...S.channelRow }}
          >
            <div style={S.channelIcon}>💖</div>
            <div>support-group</div>
          </div>
        </div>

        <div>
          <div style={S.groupLabel}>Design Buddies Events</div>
          <div
            onClick={() => navigateToServer("design-challenges")}
            style={{ ...S.channelRow }}
          >
            <div style={S.channelIcon}>🐰</div>
            <div>design-challenges</div>
          </div>
        </div>

        <div>
          <div style={S.groupLabel}>Ask For Help</div>
          <div
            onClick={() => navigateToServer("ask-professionals")}
            style={{ ...S.channelRow }}
          >
            <div style={S.channelIcon}>👋</div>
            <div style={{ fontWeight: 700 }}>ask-professionals</div>
          </div>

          <div
            onClick={() => navigateToServer("career-questions")}
            style={{ ...S.channelRow }}
          >
            <div style={S.channelIcon}>🏢</div>
            <div>career-questions</div>
          </div>
        </div>

        {/* sticky bottom nav inside leftPanel to emulate the mobile image */}
        <div style={{ marginTop: 12, marginBottom: 6 }} />

        <div style={S.bottomNavWrap}>
          <div style={S.bottomNav}>
            <div style={S.navItem} onClick={() => navigateToServer("servers")}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "#111827", color: "white", display: "flex", alignItems: "center", justifyContent: "center" }}>🏠</div>
              <div>Servers</div>
            </div>

            <div style={S.navItem} onClick={() => navigateToServer("messages")}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>💬</div>
              <div>Messages</div>
            </div>

            <div style={S.navItem} onClick={() => navigateToServer("notifications")}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>🔔</div>
              <div>Notifications</div>
            </div>

            <div style={S.navItem} onClick={() => navigateToServer("you")}>
              <div style={{ width: 32, height: 32, borderRadius: 999, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center" }}>{initialsFromName(name)}</div>
              <div>You</div>
            </div>
          </div>
        </div>
      </aside>

      {/* header */}
      <header style={S.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>CC</div>
          <div>
            <div style={S.headerTitle}>#{roomId}</div>
            <div style={{ color: S.muted, fontSize: 13 }}>Channel</div>
          </div>
        </div>
      </header>

      {/* center messages */}
      <main style={S.center}>
        <div style={S.messagesPanel}>
          <div id="messages-list" style={S.messagesList} role="log" aria-live="polite">
            {visibleMessages.length === 0 ? (
              <div style={{ color: S.muted, textAlign: "center", padding: 20 }}>No messages yet — say hello 👋</div>
            ) : (
              visibleMessages.map((m) => {
                const isMe = m.user === name;
                return (
                  <div
                    key={m.id}
                    style={{
                      display: "flex",
                      flexDirection: isMe ? "row-reverse" : "row",
                      alignItems: "flex-start",
                      gap: 12,
                    }}
                  >
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center" }} aria-hidden>
                      {initialsFromName(m.user)}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start", minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <div style={{ fontWeight: 700 }}>{m.user}</div>
                        <div style={{ fontSize: 11, color: S.muted }}>
                          {m.role}&nbsp;•&nbsp;{typeof (m as any).created_at === "string" ? new Date((m as any).created_at).toLocaleTimeString() : ""}
                        </div>
                      </div>
                      <div style={isMe ? S.bubbleMe : S.bubbleThem}>
                        <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div style={S.composerWrap}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget as HTMLFormElement;
                const input = form.elements.namedItem("content") as HTMLInputElement | null;
                if (!input) return;
                const text = input.value.trim();
                if (!text) return;
                sendChat(text);
                input.value = "";
                input.focus();
              }}
            >
              <input name="content" ref={inputRef} style={S.input} placeholder={`Message #${roomId}`} autoComplete="off" />
            </form>
          </div>
        </div>
      </main>

      {/* right profile */}
      <aside style={S.rightPanel}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
          <div style={{ width: 56, height: 56, borderRadius: 12, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{initialsFromName(name)}</div>
          <div>
            <div style={{ fontWeight: 800 }}>{name}</div>
            <div style={{ color: S.muted, fontSize: 13 }}>{participants.filter((p) => p.status === "online").length} online</div>
          </div>
        </div>

        <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Details</div>
          <div style={{ color: S.muted, fontSize: 13 }}>A clean area to show profile, notes, or channel metadata.</div>
        </div>
      </aside>
    </div>
  );
}

/* ---------------- mount ---------------- */
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Navigate to={`/${nanoid()}`} />} />
      <Route path="/:room" element={<AppInner />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  </BrowserRouter>,
);
