import { createRoot } from "react-dom/client";
import { usePartySocket } from "partysocket/react";
import React, { useEffect, useState, useRef } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useParams,
} from "react-router";
import { nanoid } from "nanoid";

import { names, type ChatMessage, type Message } from "../shared";

function App() {
  const [name, setName] = useState<string>(() => {
    const stored = localStorage.getItem("cc:name");
    if (stored) return stored;
    return names[Math.floor(Math.random() * names.length)];
  });

  const [editingName, setEditingName] = useState<string>(name);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const { room } = useParams();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    localStorage.setItem("cc:name", name);
  }, [name]);

  const socket = usePartySocket({
    party: "chat",
    room,
    onMessage: (evt) => {
      const message = JSON.parse(evt.data as string) as Message;
      if (message.type === "add") {
        const foundIndex = messages.findIndex((m) => m.id === message.id);
        if (foundIndex === -1) {
          setMessages((messages) => [
            ...messages,
            {
              id: message.id,
              content: message.content,
              user: message.user,
              role: message.role,
            },
          ]);
        } else {
          setMessages((messages) =>
            messages
              .slice(0, foundIndex)
              .concat({
                id: message.id,
                content: message.content,
                user: message.user,
                role: message.role,
              })
              .concat(messages.slice(foundIndex + 1)),
          );
        }
      } else if (message.type === "update") {
        setMessages((messages) =>
          messages.map((m) =>
            m.id === message.id
              ? {
                  id: message.id,
                  content: message.content,
                  user: message.user,
                  role: message.role,
                }
              : m,
          ),
        );
      } else {
        setMessages(message.messages);
      }
    },
  });

  useEffect(() => {
    inputRef.current?.focus();
  }, [room]);

  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: 18 }}>
      <style>{`
/* From Uiverse.io by Yaya12085 (kept minimal, flattened) */
.card {
  max-width: 320px;
  border-width: 1px;
  border-color: rgba(219, 234, 254, 1);
  border-radius: 1rem;
  background-color: rgba(255, 255, 255, 1);
  padding: 1rem;
  border-style: solid;
}

.header {
  display: flex;
  align-items: center;
  grid-gap: 1rem;
  gap: 1rem;
}

.icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background-color: rgba(96, 165, 250, 1);
  padding: 0.5rem;
  color: rgba(255, 255, 255, 1);
}

.icon svg {
  height: 1rem;
  width: 1rem;
}

.alert {
  font-weight: 600;
  color: rgba(107, 114, 128, 1);
}

.message {
  margin-top: 0.75rem;
  color: rgba(107, 114, 128, 1);
  font-size: 0.95rem;
}

/* simple message list */
.messages {
  margin-top: 0.75rem;
  max-height: 36vh;
  overflow: auto;
  display:flex;
  flex-direction:column;
  gap: 8px;
  padding-right: 4px;
}

.msg-row {
  display:flex;
  gap: 8px;
  align-items:flex-start;
}

.msg-user {
  font-weight:600;
  color: rgba(55,65,81,1);
  width: 68px;
  font-size: 0.85rem;
}

.msg-bubble {
  background: rgba(245,247,250,1);
  padding: 8px 10px;
  border-radius: 8px;
  color: rgba(55,65,81,1);
  font-size: 0.92rem;
  max-width: 100%;
  word-break: break-word;
}

.msg-row.mine {
  justify-content: flex-end;
}

.msg-row.mine .msg-user { display:none; }
.msg-row.mine .msg-bubble {
  background: rgba(59,130,246,1);
  color: white;
}

/* actions area (input + button) */
.actions {
  margin-top: 1rem;
  display: flex;
  gap: 8px;
  align-items: center;
}

.input {
  flex: 1;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid rgba(226,232,240,1);
  font-size: 0.95rem;
}

.send {
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(59,130,246,1);
  color: white;
  border: none;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.9rem;
}

.read {
  background-color: rgba(59, 130, 246, 1);
  color: rgba(255, 255, 255, 1);
}

.mark-as-read {
  margin-top: 0.5rem;
  background-color: rgba(249, 250, 251, 1);
  color: rgba(107, 114, 128, 1);
  transition: all .15s ease;
  border: none;
  padding: 8px 10px;
  border-radius: 8px;
}

.mark-as-read:hover {
  background-color: rgb(230, 231, 233);
}
      `}</style>

      <div className="card" role="region" aria-label={`Chat room ${room}`}>
        <div className="header">
          <div className="icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M2 12a10 10 0 1118 6l3 3-3 0a10 10 0 01-18-9z" fill="currentColor" />
            </svg>
          </div>
          <div>
            <div className="alert">Room: {room}</div>
            <div style={{ fontSize: 12, color: "rgba(107,114,128,1)" }}>{messages.length} message{messages.length !== 1 ? "s" : ""}</div>
          </div>
        </div>

        <div className="message">Simple, minimal chat — no extra background or heavy decorations.</div>

        <div className="messages" ref={messagesRef} aria-live="polite">
          {messages.length === 0 ? (
            <div style={{ color: "rgba(107,114,128,1)", textAlign: "center", padding: 8 }}>No messages yet — be the first 👋</div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`msg-row ${m.user === name ? "mine" : ""}`}>
                {m.user !== name && <div className="msg-user">{m.user}</div>}
                <div className="msg-bubble">{m.content}</div>
              </div>
            ))
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const el = e.currentTarget.elements.namedItem("content") as HTMLInputElement;
            const val = (el?.value || "").trim();
            if (!val) {
              el.value = "";
              inputRef.current?.focus();
              return;
            }

            const chatMessage: ChatMessage = {
              id: nanoid(8),
              content: val,
              user: name,
              role: "user",
            };

            setMessages((prev) => [...prev, chatMessage]);
            socket.send(JSON.stringify({ type: "add", ...chatMessage } satisfies Message));
            el.value = "";
            inputRef.current?.focus();
          }}
          className="actions"
        >
          <input
            ref={inputRef}
            name="content"
            className="input"
            placeholder={`Hello ${name}`}
            autoComplete="off"
            aria-label="Message"
          />
          <button type="submit" className="send" aria-label="Send">Send</button>
        </form>

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button
            type="button"
            className="mark-as-read"
            onClick={() => {
              // small convenience: clear messages locally
              setMessages([]);
            }}
          >
            Clear
          </button>
          <button
            type="button"
            className="read"
            onClick={() => {
              alert("There are no unread items in this minimal UI.");
            }}
          >
            Info
          </button>
        </div>

        {/* name setter kept minimal */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const newName = editingName.trim() || name;
            if (newName === name) {
              return;
            }
            setName(newName);
          }}
          style={{ marginTop: 12, display: "flex", gap: 8 }}
        >
          <input
            name="name"
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            className="input"
            placeholder="Display name"
            aria-label="Display name"
          />
          <button type="submit" className="mark-as-read">Set</button>
        </form>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Navigate to={`/${nanoid()}`} />} />
      <Route path="/:room" element={<App />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  </BrowserRouter>,
);
