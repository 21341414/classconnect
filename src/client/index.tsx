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

/* ---------------- persistent state helper (defensive) ---------------- */
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

/* ---------------- styles (match image: clean left sidebar with groups) ---------------- */
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
      // servers | left menu (folders/dms) | center | right
      gridTemplateColumns: "72px 300px 1fr 340px",
      gridTemplateRows: "72px 1fr",
      gap: 0,
      background: bg,
      color: text,
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
      boxSizing: "border-box" as const,
      overflow: "hidden",
    },

    /* left-most servers column */
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

    /* second column: the clean white panel with rounded left corners (matching image) */
    leftPanel: {
      gridColumn: "2 / 3",
      gridRow: "1 / -1",
      background: sidebarBg,
      borderRight: `1px solid ${isDark ? "#0b1722" : "#eef2f7"}`,
      padding: "20px 18px",
      boxSizing: "border-box" as const,
      display: "flex",
      flexDirection: "column" as const,
      gap: 14,
      // big rounded left edge like the example
      borderTopLeftRadius: 18,
      borderBottomLeftRadius: 18,
    },

    brand: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      paddingBottom: 6,
    },
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

    /* grouped menu */
    groupLabel: { fontSize: 13, color: muted, marginTop: 6, marginBottom: 6 },
    pillItem: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "10px 12px",
      borderRadius: 12,
      cursor: "pointer",
      background: "transparent",
    },
    pillItemActive: {
      background: selectedBg,
      boxShadow: "inset 0 1px 0 rgba(0,0,0,0.02)",
    },
    pillIcon: {
      width: 36,
      height: 36,
      borderRadius: 8,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#eef2ff",
      fontWeight: 700,
      flexShrink: 0,
    },
    badge: {
      marginLeft: "auto",
      background: "#ffffff",
      border: `1px solid rgba(0,0,0,0.04)`,
      padding: "4px 8px",
      borderRadius: 10,
      fontSize: 13,
      color: muted,
    },

    /* conversation list style for the Scenes/DMs area */
    convList: {
      display: "flex",
      flexDirection: "column" as const,
      gap: 8,
      overflow: "auto",
    },
    convItem: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "10px 12px",
      borderRadius: 10,
      cursor: "pointer",
    },
    convItemActive: {
      background: selectedBg,
    },
    convItemIcon: {
      width: 36,
      height: 36,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 8,
      background: "#fff",
      boxShadow: "0 6px 18px rgba(16,24,40,0.04)",
      flexShrink: 0,
    },

    /* center message area */
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

    /* composer */
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

    /* right profile */
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
            return { id, label: id.slice(0, 6), type: id.startsWith("dm--") ? "dm" : "server" } as ServerItem;
          }
          if (typeof item === "object") {
            const id = item.id ?? (typeof item.label === "string" ? item.label : null);
            if (!id) return null;
            const sid = String(id);
            return { id: sid, label: item.label ?? sid.slice(0, 6), type: item.type === "dm" ? "dm" : "server" } as ServerItem;
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
        label: roomId.startsWith("dm--") ? `DM ${roomId.slice(4, 10)}` : String(roomId).slice(0, 6),
        type: roomId.startsWith("dm--") ? "dm" : "server",
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
          // ignore
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
    addMessage(chatMessage); // optimistic, deduped
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

  const addServer = (id: string, label?: string, type: ServerItem["type"] = "server") => {
    if (!id) return;
    const sid = String(id);
    setServers((prev) => {
      if (prev.some((s) => s && s.id === sid)) return prev;
      const item: ServerItem = { id: sid, label: label ?? sid.slice(0, 6), type };
      return [...prev, item];
    });
  };

  const navigateToServer = (id: string) => {
    if (!id) return;
    addServer(id, id.slice(0, 6), id.startsWith("dm--") ? "dm" : "server");
    window.location.pathname = `/${id}`;
  };

  const startDMWith = (p: Participant) => {
    if (!p) return;
    const otherId = p.id ?? `u:${p.user}`;
    const myId = clientId;
    const ids = [myId, otherId].sort();
    const dmId = `dm--${ids.join("--")}`;
    addServer(dmId, `DM ${p.user}`, "dm");
    navigateToServer(dmId);
  };

  const serverIcons = useMemo(() => servers.filter((s) => s.type !== "dm"), [servers]);
  const dmList = useMemo(() => servers.filter((s) => s.type === "dm"), [servers]);

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
              addServer(r, r.slice(0, 6), "server");
              navigateToServer(r);
            }}
            style={{ ...S.serverIcon, width: 40, height: 40, borderRadius: 10, background: "#111827", color: "white" }}
          >
            +
          </button>
        </div>
      </div>

      {/* left panel (brand, groups, scenes list) */}
      <aside style={S.leftPanel}>
        <div style={S.brand}>
          <div style={S.brandLogo}>B</div>
          <div style={S.brandTitle}>Brainwave</div>
        </div>

        <div>
          <div style={S.groupLabel}>Explore</div>
          <div
            style={{ ...S.pillItem, ...S.pillItemActive }}
            onClick={() => navigateToServer("explore")}
          >
            <div style={S.pillIcon}>🔍</div>
            <div style={{ fontWeight: 700 }}>Explore</div>
          </div>
        </div>

        <div>
          <div style={S.groupLabel}>Assets</div>
          <div
            style={{
              ...S.pillItem,
              borderRadius: 14,
              background: "transparent",
              alignItems: "center",
            }}
            onClick={() => navigateToServer("assets")}
          >
            <div style={S.pillIcon}>📦</div>
            <div style={{ fontWeight: 700 }}>Assets</div>
            <div style={S.badge}>{messages.length}</div>
          </div>
        </div>

        <div style={{ marginTop: 6 }}>
          <div style={S.groupLabel}>Scenes</div>
          <div style={S.convList}>
            {/* example "My Scenes" + a few folders */}
            {[
              { id: "sc-my", label: "My Scenes" },
              { id: "sc-new", label: "New Folder" },
              { id: "sc-unt", label: "Untitled Folder" },
              { id: "sc-3d", label: "3D Icons" },
            ].map((c) => {
              const active = c.id === roomId;
              return (
                <div
                  key={c.id}
                  onClick={() => navigateToServer(c.id)}
                  style={{ ...S.convItem, ...(active ? S.convItemActive : {}) }}
                >
                  <div style={S.convItemIcon}>📁</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{c.label}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: "auto", fontSize: 13, color: S.muted }}>
          Need help? Submit feedback
        </div>
      </aside>

      {/* header */}
      <header style={S.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>CC</div>
          <div>
            <div style={S.headerTitle}>My Scenes</div>
            <div style={{ color: S.muted, fontSize: 13 }}>Browse and manage your scenes</div>
          </div>
        </div>
      </header>

      {/* center messages / content area */}
      <main style={S.center}>
        <div style={S.messagesPanel}>
          {/* grid like cards — simplified list to resemble the image */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
            {visibleMessages.slice(-6).map((m) => (
              <div key={m.id} style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 6px 18px rgba(16,24,40,0.04)" }}>
                <div style={{ height: 160, borderRadius: 10, background: "#fafafa", marginBottom: 12 }} />
                <div style={{ fontWeight: 700 }}>{m.user}</div>
                <div style={{ color: S.muted, marginTop: 6 }}>{m.content.slice(0, 80)}</div>
              </div>
            ))}

            {/* fallback sample cards if empty */}
            {visibleMessages.length === 0 &&
              [1, 2, 3].map((n) => (
                <div key={n} style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 6px 18px rgba(16,24,40,0.04)" }}>
                  <div style={{ height: 160, borderRadius: 10, background: "#fafafa", marginBottom: 12 }} />
                  <div style={{ fontWeight: 700 }}>Delivery Robot on Wheels</div>
                  <div style={{ color: S.muted, marginTop: 6 }}>3D Icons</div>
                </div>
              ))}
          </div>

          {/* composer */}
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
              <input name="content" ref={inputRef} style={S.input} placeholder={`Send a message or create a scene...`} autoComplete="off" />
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
          <div style={{ color: S.muted, fontSize: 13 }}>A clean area to show profile, notes, or scene metadata.</div>
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
