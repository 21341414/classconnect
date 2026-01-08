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
  // pick a default name (from localStorage if set, otherwise random)
  const [name, setName] = useState<string>(() => {
    const stored = localStorage.getItem("cc:name");
    if (stored) return stored;
    return names[Math.floor(Math.random() * names.length)];
  });

  // editingName is the controlled input value for the name field
  const [editingName, setEditingName] = useState<string>(name);

  // persist name to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("cc:name", name);
  }, [name]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const { room } = useParams();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);

  const socket = usePartySocket({
    party: "chat",
    room,
    onMessage: (evt) => {
      const message = JSON.parse(evt.data as string) as Message;
      if (message.type === "add") {
        const foundIndex = messages.findIndex((m) => m.id === message.id);
        if (foundIndex === -1) {
          // probably someone else who added a message
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
          // replace local placeholder with the broadcasted message
          setMessages((messages) => {
            return messages
              .slice(0, foundIndex)
              .concat({
                id: message.id,
                content: message.content,
                user: message.user,
                role: message.role,
              })
              .concat(messages.slice(foundIndex + 1));
          });
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
    // focus input on mount / room change
    inputRef.current?.focus();
  }, [room]);

  useEffect(() => {
    // scroll messages to bottom on new messages
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <div className="cc-root">
      <style>{`
        /* Minimal Uiverse-ish input + compact chat layout (plain CSS, no nesting) */
        :root {
          --accent: #9147ff;
          --accent-2: #ff4141;
          --input-bg: #e9e9e9;
          --muted: #959595;
          --text: #2b2b2b;
        }

        .cc-root {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(180deg, #f6f7fb 0%, #ffffff 100%);
          font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
          padding: 24px;
        }

        .chat-card {
          width: 340px;
          max-width: 92vw;
          background: white;
          border-radius: 14px;
          box-shadow: 0 12px 30px rgba(20,20,30,0.06);
          padding: 12px;
        }

        .room {
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:10px;
          margin-bottom:8px;
        }

        .room .title { font-weight:600; color:var(--text); font-size:14px; }
        .room .meta { color:var(--muted); font-size:12px; }

        .messages {
          max-height: 48vh;
          overflow: auto;
          display:flex;
          flex-direction:column;
          gap:8px;
          padding:6px;
          margin-bottom:10px;
        }

        .msg {
          display:flex;
          gap:8px;
          align-items:flex-end;
        }

        .msg .who {
          width:64px;
          font-size:12px;
          font-weight:600;
          color:var(--text);
        }

        .bubble {
          padding:10px 12px;
          border-radius:14px;
          max-width:75%;
          background: #fbfbfb;
          color:var(--text);
          box-shadow: 0 2px 6px rgba(20,20,30,0.04);
          word-break:break-word;
          font-size:14px;
        }

        .msg.mine {
          justify-content:flex-end;
        }

        .msg.mine .who { display:none; }
        .msg.mine .bubble {
          background: linear-gradient(135deg, #2d8cf0 0%, #5b9ffd 100%);
          color:white;
          border-bottom-right-radius:6px;
        }

        .empty {
          text-align:center;
          color:var(--muted);
          font-size:13px;
          padding:8px 6px;
        }

        /* --- input area inspired by Uiverse snippet (flattened selectors) --- */
        .input-row {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          width: 100%;
          height: 44px;
        }

        .container-upload-files {
          position: absolute;
          left: 6px;
          display: flex;
          color: #aaaaaa;
          gap:6px;
          transition: all 0.35s ease;
          align-items:center;
        }

        .container-upload-files .upload-file {
          margin: 0 2px;
          padding: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
          border-radius:8px;
        }

        .container-upload-files .upload-file:hover {
          color: #4c4c4c;
          transform: scale(1.08);
        }

        .container-ia-chat {
          position: relative;
          width: 100%;
          display:flex;
          align-items:center;
          justify-content:flex-end;
        }

        .input-text {
          max-width: 190px;
          width: 100%;
          margin-left: 72px;
          padding: 0.6rem 1rem;
          padding-right: 46px;
          border-radius: 50px;
          border: none;
          outline: none;
          background-color: var(--input-bg);
          color: #4c4c4c;
          font-size: 14px;
          line-height: 18px;
          font-weight: 500;
          transition: all 0.36s cubic-bezier(0.175, 0.885, 0.32, 1.05);
          z-index: 2;
        }

        .input-text::placeholder { color: var(--muted); }

        /* when parent gains focus-within expand input and hide upload icons */
        .container-ia-chat:focus-within .input-text {
          max-width: 250px;
          margin-left: 42px;
        }

        .container-ia-chat:focus-within .container-upload-files {
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
          filter: blur(4px);
          transform: translateX(-6px);
        }

        .label-files {
          position: absolute;
          top: 50%;
          left: 6px;
          transform: translateX(-20px) translateY(-50%) scale(1);
          display: flex;
          padding: 6px;
          color: var(--muted);
          background-color: var(--input-bg);
          border-radius: 50px;
          cursor: pointer;
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
          transition: all 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.05);
        }

        .container-ia-chat:focus-within .label-files {
          transform: translateX(0) translateY(-50%) scale(1);
          opacity: 1;
          visibility: visible;
          pointer-events: all;
        }

        .label-text {
          position: absolute;
          top: 50%;
          right: 6px;
          transform: translateY(-50%) scale(1);
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content:center;
          padding: 6px;
          border: none;
          outline: none;
          cursor: pointer;
          transition: all 0.28s ease;
          z-index: 3;
          background: linear-gradient(to top right, var(--accent), var(--accent-2));
          color: white;
          border-radius: 50%;
          box-shadow: 0 6px 18px rgba(145,71,255,0.12);
        }

        .label-text:active { transform: scale(0.96); }

        /* small icon styles */
        .icon {
          width: 18px;
          height: 18px;
          display:inline-block;
        }

        /* responsive tiny tweak */
        @media (max-width: 380px) {
          .input-text { max-width: 160px; }
          .container-ia-chat:focus-within .input-text { max-width: 220px; }
        }
      `}</style>

      <div className="chat-card">
        <div className="room">
          <div className="title">Room: {room}</div>
          <div className="meta">{messages.length} message{messages.length !== 1 ? "s" : ""}</div>
        </div>

        <div className="messages" ref={messagesRef}>
          {messages.length === 0 ? (
            <div className="empty">No messages yet — say hi 👋</div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`msg ${m.user === name ? "mine" : ""}`}>
                {m.user !== name && <div className="who">{m.user}</div>}
                <div className="bubble">{m.content}</div>
              </div>
            ))
          )}
        </div>

        {/* name row */}
        <form
          className="name-row"
          onSubmit={(e) => {
            e.preventDefault();
            const newName = editingName.trim() || name;
            if (newName === name) {
              alert(`Name unchanged: ${name}`);
              return;
            }
            setName(newName);
            alert(`Name set to ${newName}`);
          }}
          style={{ marginBottom: 8, display: "flex", gap: 8 }}
        >
          <input
            type="text"
            name="name"
            className="my-input-text"
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            placeholder="Display name"
            style={{
              flex: 1,
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #eee",
            }}
          />
          <button type="submit" className="set-btn" style={{ padding: "8px 10px", borderRadius: 8, background: "#2d8cf0", color: "white", border: "none" }}>
            Set
          </button>
        </form>

        {/* input area */}
        <form
          className="input-row"
          onSubmit={(e) => {
            e.preventDefault();
            const content = e.currentTarget.elements.namedItem(
              "content",
            ) as HTMLInputElement;
            const trimmed = (content.value || "").trim();
            if (!trimmed) {
              content.value = "";
              inputRef.current?.focus();
              return;
            }
            const chatMessage: ChatMessage = {
              id: nanoid(8),
              content: trimmed,
              user: name,
              role: "user",
            };
            setMessages((messages) => [...messages, chatMessage]);

            socket.send(
              JSON.stringify({
                type: "add",
                ...chatMessage,
              } satisfies Message),
            );

            content.value = "";
            inputRef.current?.focus();
          }}
        >
          <div className="container-ia-chat" title="Chat input area">
            <div className="container-upload-files" aria-hidden="true">
              <div className="upload-file" title="Attach image">📎</div>
              <div className="upload-file" title="Attach file">🖼️</div>
            </div>

            <label className="label-files" htmlFor="file-input" title="Upload files">
              + files
            </label>

            <input
              ref={inputRef}
              name="content"
              className="input-text"
              type="text"
              placeholder={`Hello ${name}!`}
              autoComplete="off"
            />

            <button aria-label="Send" className="label-text" type="submit" title="Send message">
              <svg className="icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 21L23 12L2 3L8 12L2 21Z" fill="currentColor"/>
              </svg>
            </button>
          </div>
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
