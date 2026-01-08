import React, { useRef, useState } from "react";
import { createRoot } from "react-dom/client";

/**
 * Updated layout-only index.tsx — no other files changed.
 * This file renders a clean, responsive messaging layout with inline styles
 * so you don't need to modify external CSS. It mounts into <div id="root"></div>.
 */

/* Inline styles to keep changes confined to this file */
const styles: Record<string, React.CSSProperties> = {
  app: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    boxSizing: "border-box",
    background: "linear-gradient(180deg,#f5f7fb,#eef4ff)",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    color: "#0b1726",
  },
  card: {
    width: "100%",
    maxWidth: 1100,
    borderRadius: 14,
    boxShadow: "0 10px 40px rgba(11,25,60,0.08)",
    overflow: "hidden",
    background: "white",
    display: "grid",
    gridTemplateColumns: "1fr 320px",
    minHeight: 520,
  },
  header: {
    gridColumn: "1 / -1",
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "18px 22px",
    borderBottom: "1px solid #f1f4f8",
    background:
      "linear-gradient(90deg, rgba(255,255,255,0.75), rgba(250,250,252,0.8))",
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 10,
    background: "linear-gradient(135deg,#2b7cff,#5aa0ff)",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    boxShadow: "0 6px 24px rgba(43,124,255,0.16)",
  },
  mainLeft: {
    padding: 18,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  chatCard: {
    background: "#ffffff",
    borderRadius: 12,
    padding: 12,
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 360,
    boxShadow: "inset 0 1px 0 rgba(16,24,39,0.02)",
  },
  messages: {
    flex: 1,
    overflow: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: 6,
  },
  messageMe: {
    alignSelf: "flex-end",
    background: "linear-gradient(90deg,#2b7cff,#5aa0ff)",
    color: "white",
    padding: "10px 14px",
    borderRadius: 12,
    maxWidth: "74%",
    wordBreak: "break-word",
  },
  messageThem: {
    alignSelf: "flex-start",
    background: "#f1f5fb",
    color: "#0b1726",
    padding: "10px 14px",
    borderRadius: 12,
    maxWidth: "74%",
    wordBreak: "break-word",
  },
  composer: {
    marginTop: 8,
    display: "flex",
    gap: 8,
    alignItems: "center",
  },
  input: {
    flex: 1,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #e6eef8",
    background: "#f6f9ff",
    outline: "none",
  },
  sendBtn: {
    background: "#2b7cff",
    color: "white",
    border: "none",
    padding: "10px 14px",
    borderRadius: 10,
    cursor: "pointer",
  },
  sidebar: {
    borderLeft: "1px solid #f1f4f8",
    padding: 18,
    background: "linear-gradient(180deg, #ffffff, #fafbff)",
  },
  smallMuted: { fontSize: 13, color: "#6d7790" },
  participants: { marginTop: 10, paddingLeft: 16 },
  mobileStack: {
    gridTemplateColumns: "1fr",
  },
};

type Message = { id: number; text: string; from: "me" | "them" };

function AppLayout(): JSX.Element {
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, text: "Welcome to ClassConnect — say hi 👋", from: "them" },
    { id: 2, text: "This is a cleaner layout rendered from index.tsx", from: "me" },
  ]);
  const [value, setValue] = useState("");
  const idRef = useRef(3);
  const containerRef = useRef<HTMLDivElement | null>(null);

  function send(e?: React.FormEvent) {
    e?.preventDefault();
    const txt = value.trim();
    if (!txt) return;
    const next: Message = { id: idRef.current++, text: txt, from: "me" };
    setMessages((m) => [...m, next]);
    setValue("");
    // scroll to bottom
    requestAnimationFrame(() => {
      if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
    });
  }

  // responsive: apply single-column on narrow screens
  const [isNarrow, setIsNarrow] = useState<boolean>(false);
  React.useEffect(() => {
    function onResize() {
      setIsNarrow(window.innerWidth < 900);
    }
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div style={styles.app}>
      <div
        style={{
          ...styles.card,
          ...(isNarrow ? styles.mobileStack : undefined),
        }}
      >
        <header style={styles.header}>
          <div style={styles.logo} aria-hidden>
            CC
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>ClassConnect</div>
            <div style={styles.smallMuted}>Messaging • Classroom chat</div>
          </div>
        </header>

        <main style={styles.mainLeft}>
          <section style={styles.chatCard} aria-label="Messages">
            <div style={styles.messages} ref={containerRef} aria-live="polite" tabIndex={0}>
              {messages.map((m) => (
                <div
                  key={m.id}
                  style={m.from === "me" ? styles.messageMe : styles.messageThem}
                >
                  {m.text}
                </div>
              ))}
            </div>

            <form style={styles.composer} onSubmit={send} aria-label="Send message">
              <input
                style={styles.input}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Write a message…"
                aria-label="Message input"
              />
              <button type="submit" style={styles.sendBtn} aria-label="Send">
                Send
              </button>
            </form>
          </section>
        </main>

        <aside style={styles.sidebar} aria-label="Conversation info">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 600 }}>Conversation</div>
            <div style={{ fontSize: 12, color: "#7b8794" }}>Active</div>
          </div>

          <div style={{ marginTop: 8, ...styles.smallMuted }}>General • Public</div>

          <div style={{ marginTop: 14, fontSize: 14, color: "#12263a" }}>Participants</div>
          <ul style={styles.participants}>
            <li>Alice</li>
            <li>Bob</li>
            <li>Carol</li>
          </ul>

          <div style={{ marginTop: 18, ...styles.smallMuted }}>
            Tip: Press Enter to send. This layout is intentionally lightweight so you can
            drop your existing messaging component into the left column.
          </div>
        </aside>
      </div>
    </div>
  );
}

/* Mount into existing #root element in public/index.html */
const container = document.getElementById("root");
if (!container) throw new Error('No element with id="root" found — add <div id="root"></div> to public/index.html');

const root = createRoot(container);
root.render(<AppLayout />);
