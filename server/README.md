# Zombie Multiplayer Server

Local development:

```bash
npm install
npm start
```

The game connects to `ws://localhost:3001` when opened locally. For production, deploy this folder to a persistent Node host such as Render and set the client server URL with:

```js
localStorage.setItem('dzc_mp_server', 'wss://your-server.example.com')
```

Room behavior:

- 4 digit PIN room creation
- 2 players per room
- player state broadcast for remote player rendering
