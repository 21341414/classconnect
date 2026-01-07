import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router";
import { nanoid } from "nanoid";

import {
  names,
  type ChatMessage,
  type ClientToServer,
  type ServerToClient,
} from "../shared";

import "./styles.css";

function Toasts({ toasts, remove }: { toasts: string[]; remove: (i: number) => void }) {
  return (
    <div className="toast-wrap">
      {toasts.map((t, i) => (
        <div
          key={i}
          className="toast"
          onClick={() => remove(i)}
          role="status"
          aria-live="polite"
        >
          {t}
        </div>
      ))}
    </div>
  );
}

function App() {
  const [name, setName] = useState<string>(() => {
    const stored = localStorage.getItem("cc:name");
    if (stored) return stored;
    return names[Math.floor(Math.random() * names.length)];
  });
  const [editingName, setEditingName] = useState(name);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [toUserId, setToUserId] = useState<string | null>(null); // for DM selection

  const [toasts, setToasts] = useState<string[]>([]);
  const toastTimer = useRef<number | null>(null);

  const { room } = useParams();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    localStorage.setItem("cc:name", name);
  }, [name]);

  useEffect(() => {
    if (!room) return;

    const wsUrl = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws/${room}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.addEventListener("open", () => {
      const joinMsg: ClientToServer = { type: "join", name };
      ws.send(JSON.stringify(joinMsg));
      addToast("Connected to room");
    });

    ws.addEventListener("message", (evt) => {
      try {
        const data = JSON.parse(evt.data) as ServerToClient;
        if (data.type === "init") {
          setMessages(data.messages || []);
          setUsers(data.users || []);
        } else if (data.type === "users") {
          setUsers(data.users);
        } else if (data.type === "add") {
          setMessages((m) => [...m, data.message]);
        } else if (data.type === "dm") {
          // if the DM is for us, show it
          setMessages((m) => [...m, data.message]);
          addToast(`DM from ${data.message.user}`);
        }
      } catch (err) {
        console.error("invalid message", err);
      }
    });

    ws.addEventListener("close", () => {
      addToast("Disconnected");
      wsRef.current = null;
    });

    return () => {
      try {
        ws.close();
      } catch {}
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);

  function addToast(text: string) {
    setToasts((t) => [...t, text]);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => {
      setToasts((t) => t.slice(1));
    }, 5000);
  }
  function removeToast(i: number) {
    setToasts((t) => t.filter((_, idx) => idx !== i));
  }

  function sendMessage(content: string) {
    if (!content.trim()) return;
    const msg: Omit<ChatMessage, "createdAt"> = {
      id: nanoid(8),
      content,
      user: name,
      role: "user",
      to: toUserId ? users.find((u) => u.id === toUserId)?.name ?? null : null,
    };

    if (toUserId) {
      const out: ClientToServer = { type: "dm", message: msg, toUserId };
      wsRef.current?.send(JSON.stringify(out));
      // show own DM in UI
      setMessages((m) => [...m, { ...msg, createdAt: Date.now() }]);
    } else {
      const out: ClientToServer = { type: "add", message: msg };
      wsRef.current?.send(JSON.stringify(out));
      setMessages((m) => [...m, { ...msg, createdAt: Date.now() }]);
    }
  }

  function setNewName(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const newName = editingName.trim() || name;
    if (newName === name) {
      addToast(`Name unchanged: ${name}`);
      return;
    }
    setName(newName);
    setEditingName(newName);
    const out: ClientToServer = { type: "setName", name: newName };
    wsRef.current?.send(JSON.stringify(out));
    addToast(`Name set to ${newName}`);
  }

  function copyRoomLink() {
    const url = `${location.origin}/${room}`;
    navigator.clipboard?.writeText(url).then(
      () => addToast("Room link copied"),
      () => addToast("Could not copy link"),
    );
  }

  function startDM(withUserId: string) {
    setToUserId(withUserId);
    const withUser = users.find((u) => u.id === withUserId);
    addToast(`Direct messages to ${withUser?.name}`);
  }

  function leaveRoom() {
    const out: ClientToServer = { type: "leave" };
    wsRef.current?.send(JSON.stringify(out));
    wsRef.current?.close();
    addToast("Left the room");
    // redirect to new room:
    location.href = "/";
  }

  return (
    <div className="chat container">
      <Toasts toasts={toasts} remove={removeToast} />

      <div className="topbar row">
        <div className="left two-thirds">
          <form className="name-form" onSubmit={setNewName}>
            <input
              className="name-input"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              aria-label="Display name"
            />
            <button type="submit" className="btn small">
              Set Name
            </button>
            <button
              type="button"
              className="btn small"
              onClick={() => {
                setEditingName(names[Math.floor(Math.random() * names.length)]);
                addToast("Random name chosen — click Set Name to confirm");
              }}
            >
              Random
            </button>
          </form>
        </div>

        <div className="right one-third">
          <div className="room-actions">
            <button className="btn" onClick={copyRoomLink}>
              Copy room link
            </button>
            <button className="btn" onClick={leaveRoom}>
              Leave
            </button>
          </div>
        </div>
      </div>

      <div className="main row">
        <div className="left-pane third columns">
          <h4>Participants</h4>
          <ul className="participants">
            {users.map((u) => (
              <li
                key={u.id}
                className={`participant ${toUserId === u.id ? "selected" : ""}`}
                onClick={() => startDM(u.id)}
              >
                <span className="p-name">{u.name}</span>
                <small className="p-id">{u.id}</small>
              </li>
            ))}
          </ul>
          <div className="dm-help">
            <small>Click a participant to DM them. Click again to cancel.</small>
          </div>
        </div>

        <div className="chat-pane two-thirds columns">
          <div className="messages">
            {messages.map((m) => (
              <div key={m.id} className={`message-row ${m.to ? "dm" : ""}`}>
                <div className="user-col">
                  <strong>{m.user}</strong>
                  {m.to ? <span className="dm-tag">→ {m.to}</span> : null}
                </div>
                <div className="content-col">{m.content}</div>
              </div>
            ))}
          </div>

          <form
            className="send-form"
            onSubmit={(e) => {
              e.preventDefault();
              const el = (e.currentTarget.elements.namedItem("content") as HTMLInputElement);
              sendMessage(el.value);
              el.value = "";
            }}
          >
            <input
              name="content"
              placeholder={toUserId ? `DM to ${users.find((u) => u.id === toUserId)?.name}` : `Hello ${name}! Type a message...`}
              className="message-input"
              autoComplete="off"
            />
            <button type="submit" className="btn send">
              Send
            </button>
            {toUserId ? (
              <button
                type="button"
                className="btn small cancel"
                onClick={() => {
                  setToUserId(null);
                  addToast("DM cancelled");
                }}
              >
                Cancel DM
              </button>
            ) : null}
          </form>
        </div>
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
