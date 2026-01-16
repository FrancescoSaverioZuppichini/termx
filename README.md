# @zuppif/termx

Web-based terminal server using Bun + Hono + tmux. Run it anywhere, get a browser terminal.

## Install

```bash
bun install -g @zuppif/termx
```

## Usage

```bash
cd /your/project
termx
```

Opens on `http://localhost:7681`. Sessions start in the directory you ran the command from.

## Options

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--port` | `-p` | Server port | `7681` |
| `--theme` | `-t` | Default theme | `Dark` |

```bash
termx --port 3000 --theme Dracula
termx -p 3000 -t "Tokyo Night"
```

## Themes

- Dark
- Dracula
- Monokai
- Nord
- Gruvbox
- Tokyo Night
- Atom One Dark
- Catppuccin
- Light

## Requirements

- [Bun](https://bun.sh) runtime
- `tmux` installed on the system

## Stack

- **Runtime**: Bun
- **HTTP**: Hono
- **Terminal**: tmux + Bun.Terminal
- **Frontend**: xterm.js

## API

### REST

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Terminal UI |
| GET | `/sessions` | List sessions |
| POST | `/sessions` | Create session. Body: `{ name?: string }` |
| DELETE | `/sessions/:name` | Kill session (except "default") |
| PATCH | `/sessions/:name` | Rename session. Body: `{ name: string }` |
| POST | `/exec/:session` | Send command. Body: `{ cmd: string }` |

### WebSocket

Connect to `/ws/:session?resize=cols,rows`

**Client -> Server:**
- Raw text/binary: PTY stdin
- JSON `{ type: "resize", cols: number, rows: number }`: resize

**Server -> Client:**
- Raw binary: PTY stdout

## File Structure

```
src/
├── index.ts   # HTTP routes, WebSocket handler
└── pty.ts     # tmux session management via sendCommand()
public/
└── index.html # xterm.js frontend
```

## Architecture

```
┌─────────────┐     HTTP/WS      ┌─────────────┐     Bun.Terminal    ┌─────────┐
│   Browser   │ <--------------> │  Bun Server │ <-----------------> │  tmux   │
│  (xterm.js) │                  │   (Hono)    │                     │ session │
└─────────────┘                  └─────────────┘                     └─────────┘
```

## Development

```bash
bun install
bun run dev     # hot reload
bun run start   # production
```

## Config

```bash
termx --port 3000              # CLI flag
PORT=3000 termx                # env var
```

Sessions start in `process.cwd()` - wherever you run the command.

## Docker

```dockerfile
FROM oven/bun
RUN apt-get update && apt-get install -y tmux
WORKDIR /app
COPY . .
RUN bun install
CMD ["bun", "run", "start"]
```
