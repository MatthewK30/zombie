# Zombie

Live deployment: https://zombie-liart.vercel.app?server=wss://zombie-multiplayer-server-gtbt.onrender.com

Main game file: `zombie.html`

Multiplayer server prototype: `server/`

Run local co-op server:

```bash
cd server
npm install
npm start
```

When the game is opened locally, co-op connects to `ws://localhost:3001`. On Vercel, set the deployed WebSocket server URL in the browser with `localStorage.setItem('dzc_mp_server', 'wss://your-server-url')` or open the game with `?server=wss://your-server-url`.

## Update Workflow

For every future gameplay or code adjustment to this project, update all three targets together:

1. Repo source: `/home/matthew/opencode-projects/zombie/zombie.html`
2. Windows copy: `C:\Users\Matthew\Projects\zombie.html`
3. Live deployment: GitHub push + Vercel verification at `https://zombie-liart.vercel.app?server=wss://zombie-multiplayer-server-gtbt.onrender.com`
