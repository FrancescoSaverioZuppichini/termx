import { spawn, type Subprocess } from "bun";

export interface Session {
  name: string;
  created: Date;
  attached: number;
}

export interface PtyHandle {
  proc: Subprocess;
  terminal: Bun.Terminal;
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: () => void;
  onData: (callback: (data: Uint8Array) => void) => void;
  onExit: (callback: (code: number) => void) => void;
}

type Command =
  | { action: "list" }
  | { action: "exists"; name: string }
  | { action: "create"; name: string; cwd?: string }
  | { action: "kill"; name: string }
  | { action: "rename"; oldName: string; newName: string }
  | { action: "keys"; session: string; keys: string }
  | { action: "attach"; session: string; cols?: number; rows?: number; cwd?: string }
  | { action: "ensureDefault"; cwd?: string };

type CommandResult<T extends Command> =
  T extends { action: "list" } ? Session[] :
  T extends { action: "exists" } ? boolean :
  T extends { action: "create" } ? boolean :
  T extends { action: "kill" } ? boolean :
  T extends { action: "rename" } ? boolean :
  T extends { action: "keys" } ? boolean :
  T extends { action: "attach" } ? PtyHandle | null :
  T extends { action: "ensureDefault" } ? void :
  never;

const env = { ...process.env, TERM: "xterm-256color" };

async function tmux(...args: string[]): Promise<{ ok: boolean; output: string }> {
  const proc = spawn(["tmux", ...args], { env });
  const output = await new Response(proc.stdout).text();
  const ok = (await proc.exited) === 0;
  return { ok, output };
}

async function sessionExists(name: string): Promise<boolean> {
  const { ok } = await tmux("has-session", "-t", name);
  return ok;
}

export async function sendCommand<T extends Command>(cmd: T): Promise<CommandResult<T>> {
  switch (cmd.action) {
    case "list": {
      const { ok, output } = await tmux("list-sessions", "-F", "#{session_name}:#{session_created}:#{session_attached}");
      if (!ok) return [] as unknown as CommandResult<T>;
      return output.trim().split("\n").filter(Boolean).map(line => {
        const [name, created, attached] = line.split(":");
        return { name, created: new Date(parseInt(created) * 1000), attached: parseInt(attached) || 0 };
      }) as unknown as CommandResult<T>;
    }

    case "exists": {
      return sessionExists(cmd.name) as Promise<CommandResult<T>>;
    }

    case "create": {
      if (await sessionExists(cmd.name)) return false as CommandResult<T>;
      const args = ["new-session", "-d", "-s", cmd.name, "-x", "120", "-y", "30"];
      if (cmd.cwd) args.push("-c", cmd.cwd);
      const { ok } = await tmux(...args);
      if (ok) await tmux("set-option", "-t", cmd.name, "mouse", "on");
      return ok as CommandResult<T>;
    }

    case "kill": {
      if (!(await sessionExists(cmd.name))) return false as CommandResult<T>;
      const { ok } = await tmux("kill-session", "-t", cmd.name);
      return ok as CommandResult<T>;
    }

    case "rename": {
      if (!(await sessionExists(cmd.oldName))) return false as CommandResult<T>;
      if (await sessionExists(cmd.newName)) return false as CommandResult<T>;
      const { ok } = await tmux("rename-session", "-t", cmd.oldName, cmd.newName);
      return ok as CommandResult<T>;
    }

    case "keys": {
      if (!(await sessionExists(cmd.session))) return false as CommandResult<T>;
      const { ok } = await tmux("send-keys", "-t", cmd.session, cmd.keys, "Enter");
      return ok as CommandResult<T>;
    }

    case "attach": {
      const { session, cols = 120, rows = 30, cwd } = cmd;
      if (!(await sessionExists(session))) {
        const created = await sendCommand({ action: "create", name: session, cwd });
        if (!created) {
          console.error(`[PTY] Failed to create session: ${session}`);
          return null as CommandResult<T>;
        }
      }

      let dataCallback: ((data: Uint8Array) => void) | null = null;
      let exitCallback: ((code: number) => void) | null = null;

      const terminal = new Bun.Terminal({
        cols,
        rows,
        name: "xterm-256color",
        data(_term, data) {
          if (dataCallback) dataCallback(data);
        },
        exit(_term, exitCode) {
          console.log(`[PTY] Terminal exit code=${exitCode}`);
          if (exitCallback) exitCallback(exitCode);
        },
      });

      const proc = spawn(["tmux", "attach", "-t", session], { terminal, env });
      console.log(`[PTY] Spawned pid=${proc.pid} for session=${session}`);

      return {
        proc,
        terminal,
        write: (data: string) => terminal.write(data),
        resize: (c: number, r: number) => terminal.resize(c, r),
        kill: () => { proc.kill(); terminal.close(); },
        onData: (cb: (data: Uint8Array) => void) => { dataCallback = cb; },
        onExit: (cb: (code: number) => void) => { exitCallback = cb; },
      } as unknown as CommandResult<T>;
    }

    case "ensureDefault": {
      if (!(await sessionExists("default"))) {
        await sendCommand({ action: "create", name: "default", cwd: cmd.cwd });
        console.log("[PTY] Created default session");
      }
      return undefined as CommandResult<T>;
    }
  }
}
