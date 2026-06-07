import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@xterm/xterm/css/xterm.css";
import {
  AlertTriangle,
  ArrowUp,
  CheckCircle2,
  Download,
  File,
  Folder,
  FolderOpen,
  KeyRound,
  Lock,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Save,
  Server,
  Settings,
  Shield,
  Terminal,
  Trash2,
  Upload,
  Wifi,
  X
} from "lucide-react";
import { rocomTerminalTheme } from "./terminalTheme.js";

const emptyForm = {
  name: "",
  host: "",
  port: 22,
  username: "",
  authType: "password",
  password: "",
  privateKey: "",
  passphrase: ""
};

const tabs = [
  { id: "connections", label: "连接管理", icon: Server },
  { id: "terminal", label: "终端", icon: Terminal },
  { id: "files", label: "远程文件", icon: FolderOpen },
  { id: "settings", label: "设置", icon: Settings }
];

function tokenFromLocation() {
  if (typeof window === "undefined") {
    return "";
  }

  const urlToken = new URLSearchParams(window.location.search).get("token");
  if (urlToken) {
    window.localStorage.setItem("magic-ssh-token", urlToken);
    return urlToken;
  }

  return window.localStorage.getItem("magic-ssh-token") ?? "";
}

async function apiFetch(token, path, options = {}) {
  const headers = {
    ...(options.headers ?? {}),
    "x-magic-ssh-token": token
  };

  if (options.body && !(options.body instanceof FormData)) {
    headers["content-type"] = "application/json";
  }

  const response = await fetch(path, {
    ...options,
    headers
  });

  if (!response.ok) {
    let message = "请求失败";
    try {
      const payload = await response.json();
      message = payload.error ?? message;
    } catch {
      message = response.statusText || message;
    }

    throw new Error(message);
  }

  return response;
}

function StatusPill({ tone = "idle", children }) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

function IconButton({ icon: Icon, children, tone = "neutral", ...props }) {
  return (
    <button className={`button ${tone}`} type="button" {...props}>
      <Icon size={16} />
      <span>{children}</span>
    </button>
  );
}

function App() {
  const [token] = useState(tokenFromLocation);
  const [activeTab, setActiveTab] = useState("connections");
  const [connections, setConnections] = useState([]);
  const [activeConnection, setActiveConnection] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [health, setHealth] = useState(null);

  const loadConnections = useCallback(async () => {
    if (!token) {
      return;
    }

    const response = await apiFetch(token, "/api/connections");
    setConnections(await response.json());
  }, [token]);

  const loadHealth = useCallback(async () => {
    if (!token) {
      return;
    }

    const response = await apiFetch(token, "/api/health");
    setHealth(await response.json());
  }, [token]);

  useEffect(() => {
    loadConnections().catch((loadError) => setError(loadError.message));
    loadHealth().catch((loadError) => setError(loadError.message));
  }, [loadConnections, loadHealth]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId("");
  };

  const saveConnection = async () => {
    setError("");
    setMessage("");

    try {
      const payload = {
        ...form,
        port: Number(form.port || 22)
      };
      const path = editingId ? `/api/connections/${editingId}` : "/api/connections";
      const method = editingId ? "PUT" : "POST";

      const response = await apiFetch(token, path, {
        method,
        body: JSON.stringify(payload)
      });
      const saved = await response.json();

      await loadConnections();
      setMessage(editingId ? "连接已更新" : "连接已保存");
      resetForm();
      setActiveConnection(saved);
    } catch (saveError) {
      setError(saveError.message);
    }
  };

  const editConnection = (connection) => {
    setEditingId(connection.id);
    setForm({
      name: connection.name,
      host: connection.host,
      port: connection.port,
      username: connection.username,
      authType: connection.authType,
      password: "",
      privateKey: "",
      passphrase: ""
    });
  };

  const deleteConnection = async (connection) => {
    const confirmed = window.confirm(`删除连接「${connection.name}」？保存的凭据也会被清除。`);
    if (!confirmed) {
      return;
    }

    try {
      await apiFetch(token, `/api/connections/${connection.id}`, { method: "DELETE" });
      await loadConnections();
      if (activeConnection?.id === connection.id) {
        setActiveConnection(null);
      }
      setMessage("连接已删除");
    } catch (deleteError) {
      setError(deleteError.message);
    }
  };

  const connectTo = (connection) => {
    setActiveConnection(connection);
    setActiveTab("terminal");
    setMessage(`准备连接 ${connection.name}`);
  };

  return (
    <main className="app-shell">
      <section className="app-frame">
        <header className="topbar">
          <div>
            <p className="eyebrow">本地魔法书</p>
            <h1>Magic SSH</h1>
            <p className="subtitle">浏览器版 SSH 终端与远程文件管理。</p>
          </div>
          <div className="topbar-status">
            <StatusPill tone={token ? "success" : "danger"}>
              <Shield size={14} />
              {token ? "token 已加载" : "缺少 token"}
            </StatusPill>
            <StatusPill tone={activeConnection ? "success" : "idle"}>
              <Wifi size={14} />
              {activeConnection ? activeConnection.name : "未连接"}
            </StatusPill>
          </div>
        </header>

        <nav className="tabs" role="tablist" aria-label="主功能">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.id;

            return (
              <button
                aria-selected={selected}
                className={`tab-button ${selected ? "active" : ""}`}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                role="tab"
                type="button"
              >
                <Icon size={18} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {(message || error || !token) && (
          <div className={`notice ${error || !token ? "danger" : "success"}`}>
            {error || (!token ? "请使用启动时生成的链接访问本工具。" : message)}
          </div>
        )}

        <section className="tab-panel" role="tabpanel">
          {activeTab === "connections" && (
            <ConnectionPanel
              connections={connections}
              form={form}
              editingId={editingId}
              onCancel={resetForm}
              onConnect={connectTo}
              onDelete={deleteConnection}
              onEdit={editConnection}
              onFormChange={setForm}
              onRefresh={loadConnections}
              onSave={saveConnection}
            />
          )}
          {activeTab === "terminal" && (
            <TerminalPanel activeConnection={activeConnection} token={token} />
          )}
          {activeTab === "files" && (
            <FilesPanel activeConnection={activeConnection} token={token} />
          )}
          {activeTab === "settings" && (
            <SettingsPanel
              activeConnection={activeConnection}
              connectionCount={connections.length}
              dataDir={health?.dataDir}
              token={token}
            />
          )}
        </section>
      </section>
    </main>
  );
}

function ConnectionPanel({
  connections,
  form,
  editingId,
  onCancel,
  onConnect,
  onDelete,
  onEdit,
  onFormChange,
  onRefresh,
  onSave
}) {
  const update = (field, value) => {
    onFormChange({ ...form, [field]: value });
  };

  return (
    <div className="connection-layout">
      <section className="paper-card connection-list">
        <div className="section-heading">
          <div>
            <p className="eyebrow">保存的连接</p>
            <h2>一键进入远程主机</h2>
          </div>
          <IconButton icon={RefreshCw} onClick={onRefresh}>
            刷新
          </IconButton>
        </div>

        <div className="connection-cards">
          {connections.length === 0 && (
            <div className="empty-state">
              <Server size={34} />
              <p>还没有保存连接。</p>
            </div>
          )}

          {connections.map((connection) => (
            <article className="connection-card" key={connection.id}>
              <div>
                <h3>{connection.name}</h3>
                <p>{connection.username}@{connection.host}:{connection.port}</p>
                <StatusPill tone={connection.authType === "privateKey" ? "info" : "idle"}>
                  <KeyRound size={14} />
                  {connection.authType === "privateKey" ? "私钥登录" : "密码登录"}
                </StatusPill>
              </div>
              <div className="card-actions">
                <IconButton icon={Power} onClick={() => onConnect(connection)} tone="primary">
                  连接
                </IconButton>
                <IconButton icon={Pencil} onClick={() => onEdit(connection)}>
                  编辑
                </IconButton>
                <IconButton icon={Trash2} onClick={() => onDelete(connection)} tone="danger">
                  删除
                </IconButton>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="paper-card connection-form">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{editingId ? "编辑连接" : "新增连接"}</p>
            <h2>{editingId ? "更新这张通行卷" : "写入一张通行卷"}</h2>
          </div>
          {editingId && (
            <IconButton icon={X} onClick={onCancel}>
              取消
            </IconButton>
          )}
        </div>

        <div className="form-grid">
          <label>
            <span>连接名称</span>
            <input value={form.name} onChange={(event) => update("name", event.target.value)} />
          </label>
          <label>
            <span>主机</span>
            <input value={form.host} onChange={(event) => update("host", event.target.value)} />
          </label>
          <label>
            <span>端口</span>
            <input
              min="1"
              max="65535"
              type="number"
              value={form.port}
              onChange={(event) => update("port", event.target.value)}
            />
          </label>
          <label>
            <span>用户名</span>
            <input
              value={form.username}
              onChange={(event) => update("username", event.target.value)}
            />
          </label>
        </div>

        <div className="segmented" role="group" aria-label="认证方式">
          <button
            className={form.authType === "password" ? "active" : ""}
            onClick={() => update("authType", "password")}
            type="button"
          >
            密码登录
          </button>
          <button
            className={form.authType === "privateKey" ? "active" : ""}
            onClick={() => update("authType", "privateKey")}
            type="button"
          >
            私钥登录
          </button>
        </div>

        {form.authType === "password" ? (
          <label className="wide-label">
            <span>密码</span>
            <input
              placeholder={editingId ? "留空则保留原密码" : ""}
              type="password"
              value={form.password}
              onChange={(event) => update("password", event.target.value)}
            />
          </label>
        ) : (
          <>
            <label className="wide-label">
              <span>私钥内容</span>
              <textarea
                placeholder={editingId ? "留空则保留原私钥" : "粘贴 OpenSSH 私钥内容"}
                rows="7"
                value={form.privateKey}
                onChange={(event) => update("privateKey", event.target.value)}
              />
            </label>
            <label className="wide-label">
              <span>Passphrase</span>
              <input
                type="password"
                value={form.passphrase}
                onChange={(event) => update("passphrase", event.target.value)}
              />
            </label>
          </>
        )}

        <IconButton icon={editingId ? Save : Plus} onClick={onSave} tone="primary">
          {editingId ? "保存修改" : "保存连接"}
        </IconButton>
      </section>
    </div>
  );
}

function TerminalPanel({ activeConnection, token }) {
  const containerRef = useRef(null);
  const terminalRef = useRef(null);
  const fitAddonRef = useRef(null);
  const socketRef = useRef(null);
  const dataDisposableRef = useRef(null);
  const connectingRef = useRef(false);
  const [terminalReady, setTerminalReady] = useState(false);
  const [status, setStatus] = useState("等待连接");

  useEffect(() => {
    let disposed = false;

    async function mountTerminal() {
      if (!containerRef.current || terminalRef.current) {
        return;
      }

      const [{ Terminal: XTerm }, { FitAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit")
      ]);

      if (disposed) {
        return;
      }

      const fitAddon = new FitAddon();
      const terminal = new XTerm({
        cursorBlink: true,
        convertEol: true,
        fontFamily: "Consolas, Menlo, ui-monospace, monospace",
        fontSize: 14,
        lineHeight: 1.18,
        minimumContrastRatio: 1,
        scrollback: 5000,
        theme: rocomTerminalTheme
      });

      terminal.loadAddon(fitAddon);
      terminal.open(containerRef.current);
      fitAddon.fit();
      terminal.writeln("Magic SSH terminal ready.");

      terminalRef.current = terminal;
      fitAddonRef.current = fitAddon;
      setTerminalReady(true);
    }

    mountTerminal();

    return () => {
      disposed = true;
      dataDisposableRef.current?.dispose();
      socketRef.current?.close();
      terminalRef.current?.dispose();
      terminalRef.current = null;
      socketRef.current = null;
    };
  }, []);

  const connectTerminal = useCallback(() => {
    if (!token || !activeConnection || !terminalRef.current || socketRef.current || connectingRef.current) {
      return;
    }

    connectingRef.current = true;
    setStatus("连接中");

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws/terminal?token=${encodeURIComponent(token)}`);
    const terminal = terminalRef.current;

    socketRef.current = socket;
    dataDisposableRef.current?.dispose();
    dataDisposableRef.current = terminal.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "data", data }));
      }
    });

    socket.addEventListener("open", () => {
      fitAddonRef.current?.fit();
      socket.send(JSON.stringify({
        type: "connect",
        connectionId: activeConnection.id,
        cols: terminal.cols,
        rows: terminal.rows
      }));
    });

    socket.addEventListener("message", (event) => {
      const payload = JSON.parse(event.data);

      if (payload.type === "data") {
        terminal.write(payload.data);
      }
      if (payload.type === "status") {
        setStatus(payload.status === "connected" ? "已连接" : "已断开");
      }
      if (payload.type === "error") {
        setStatus(payload.message);
        terminal.writeln(`\r\n错误：${payload.message}`);
      }
    });

    socket.addEventListener("close", () => {
      connectingRef.current = false;
      socketRef.current = null;
      setStatus("已断开");
    });
  }, [activeConnection, token]);

  useEffect(() => {
    if (terminalReady && activeConnection) {
      connectTerminal();
    }
  }, [activeConnection, connectTerminal, terminalReady]);

  useEffect(() => {
    const resize = () => {
      fitAddonRef.current?.fit();
      if (socketRef.current?.readyState === WebSocket.OPEN && terminalRef.current) {
        socketRef.current.send(JSON.stringify({
          type: "resize",
          cols: terminalRef.current.cols,
          rows: terminalRef.current.rows
        }));
      }
    };

    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const disconnect = () => {
    socketRef.current?.send(JSON.stringify({ type: "disconnect" }));
    socketRef.current?.close();
    socketRef.current = null;
    setStatus("已断开");
  };

  return (
    <section className="paper-card terminal-card">
      <div className="terminal-toolbar">
        <div>
          <p className="eyebrow">羊皮纸终端</p>
          <h2>{activeConnection ? activeConnection.name : "选择一个连接后开始"}</h2>
          <p>{activeConnection ? `${activeConnection.username}@${activeConnection.host}:${activeConnection.port}` : "请先在连接管理中点击连接。"}</p>
        </div>
        <div className="toolbar-actions">
          <StatusPill tone={status === "已连接" ? "success" : "idle"}>{status}</StatusPill>
          <IconButton icon={Power} onClick={disconnect} tone="danger">
            断开
          </IconButton>
        </div>
      </div>
      <div className="terminal-shell">
        <div className="terminal-runes">
          <span />
          <span />
          <span />
        </div>
        <div className="terminal-mount" ref={containerRef} />
      </div>
      <div className="terminal-footer">
        <span>PTY 自适应</span>
        <span>切换 Tab 不会主动断开会话</span>
      </div>
    </section>
  );
}

function FilesPanel({ activeConnection, token }) {
  const [remotePath, setRemotePath] = useState(".");
  const [entries, setEntries] = useState([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const loadFiles = useCallback(async (nextPath = remotePath) => {
    if (!activeConnection) {
      return;
    }

    setBusy(true);
    setStatus("读取远程目录中");
    try {
      const params = new URLSearchParams({
        connectionId: activeConnection.id,
        path: nextPath
      });
      const response = await apiFetch(token, `/api/files?${params}`);
      const payload = await response.json();
      setRemotePath(payload.path);
      setEntries(payload.entries);
      setStatus("目录已更新");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy(false);
    }
  }, [activeConnection, remotePath, token]);

  useEffect(() => {
    if (activeConnection) {
      loadFiles(".");
    }
  }, [activeConnection]);

  const enterDirectory = (entry) => {
    if (entry.type !== "directory") {
      return;
    }

    loadFiles(remotePath === "." ? entry.name : `${remotePath.replace(/\/$/, "")}/${entry.name}`);
  };

  const goUp = () => {
    const normalized = remotePath.replace(/\/$/, "");
    const parent = normalized.includes("/")
      ? normalized.slice(0, normalized.lastIndexOf("/")) || "/"
      : ".";
    loadFiles(parent);
  };

  const uploadFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !activeConnection) {
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    setBusy(true);
    setStatus("上传中");

    try {
      const params = new URLSearchParams({
        connectionId: activeConnection.id,
        path: remotePath
      });
      await apiFetch(token, `/api/files/upload?${params}`, {
        method: "POST",
        body: formData
      });
      setStatus("上传完成");
      await loadFiles(remotePath);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  };

  const downloadFile = async (entry) => {
    if (!activeConnection || entry.type === "directory") {
      return;
    }

    setBusy(true);
    setStatus("下载中");
    try {
      const fullPath = remotePath === "." ? entry.name : `${remotePath.replace(/\/$/, "")}/${entry.name}`;
      const params = new URLSearchParams({
        connectionId: activeConnection.id,
        path: fullPath
      });
      const response = await apiFetch(token, `/api/files/download?${params}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = entry.name;
      link.click();
      URL.revokeObjectURL(url);
      setStatus("下载已开始");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy(false);
    }
  };

  if (!activeConnection) {
    return (
      <section className="paper-card empty-workspace">
        <FolderOpen size={42} />
        <h2>还没有选择连接</h2>
        <p>请先在连接管理中连接一台主机。</p>
      </section>
    );
  }

  return (
    <section className="paper-card files-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">远程文件</p>
          <h2>{activeConnection.name}</h2>
          <p className="path-line">{remotePath}</p>
        </div>
        <div className="toolbar-actions">
          <IconButton icon={ArrowUp} onClick={goUp}>
            上级
          </IconButton>
          <IconButton icon={RefreshCw} onClick={() => loadFiles(remotePath)}>
            刷新
          </IconButton>
          <label className="button primary upload-button">
            <Upload size={16} />
            <span>上传</span>
            <input type="file" onChange={uploadFile} />
          </label>
        </div>
      </div>

      {busy && <div className="progress-bar"><span /></div>}
      {status && <div className="file-status">{status}</div>}

      <div className="file-table" role="table" aria-label="远程文件列表">
        <div className="file-row head" role="row">
          <span>名称</span>
          <span>大小</span>
          <span>修改时间</span>
          <span>权限</span>
          <span>操作</span>
        </div>
        {entries.map((entry) => (
          <div className="file-row" key={`${entry.type}-${entry.name}`} role="row">
            <button className="file-name" onClick={() => enterDirectory(entry)} type="button">
              {entry.type === "directory" ? <Folder size={17} /> : <File size={17} />}
              <span>{entry.name}</span>
            </button>
            <span>{entry.type === "directory" ? "-" : formatBytes(entry.size)}</span>
            <span>{entry.modifiedAt ? new Date(entry.modifiedAt).toLocaleString("zh-CN") : "-"}</span>
            <span>{entry.permissions || "-"}</span>
            <span>
              {entry.type === "file" && (
                <IconButton icon={Download} onClick={() => downloadFile(entry)}>
                  下载
                </IconButton>
              )}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function SettingsPanel({ activeConnection, connectionCount, dataDir, token }) {
  const maskedToken = useMemo(() => {
    if (!token) {
      return "未提供";
    }

    return `${token.slice(0, 8)}...${token.slice(-6)}`;
  }, [token]);

  return (
    <section className="settings-grid">
      <article className="paper-card setting-card">
        <Lock size={26} />
        <h2>访问令牌</h2>
        <p>{maskedToken}</p>
      </article>
      <article className="paper-card setting-card">
        <Server size={26} />
        <h2>连接数量</h2>
        <p>{connectionCount} 个保存连接</p>
      </article>
      <article className="paper-card setting-card">
        <FolderOpen size={26} />
        <h2>数据目录</h2>
        <p>{dataDir || "启动后由后端提供"}</p>
      </article>
      <article className="paper-card setting-card">
        <CheckCircle2 size={26} />
        <h2>当前连接</h2>
        <p>{activeConnection ? activeConnection.name : "未连接"}</p>
      </article>
      <article className="paper-card warning-card">
        <AlertTriangle size={26} />
        <h2>局域网监听提醒</h2>
        <p>选择 0.0.0.0 时，请只在可信网络中使用，并保管好启动链接中的 token。</p>
      </article>
    </section>
  );
}

function formatBytes(size) {
  if (!Number.isFinite(size)) {
    return "-";
  }

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export default App;
