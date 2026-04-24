import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT || 3001);
const MAX_PLAYERS = 2;
const rooms = new Map();

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function roomSnapshot(room) {
  return [...room.players.values()].map((p) => ({ id: p.id, state: p.state || null }));
}

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function makeRoomCode() {
  for (let i = 0; i < 80; i++) {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    if (!rooms.has(code)) return code;
  }
  throw new Error('Unable to allocate room code');
}

function joinRoom(ws, roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return send(ws, { type: 'error', message: 'Room not found' });
  if (room.players.size >= MAX_PLAYERS) return send(ws, { type: 'error', message: 'Room is full' });

  const player = { id: makeId(), ws, state: null };
  room.players.set(player.id, player);
  ws.playerId = player.id;
  ws.roomCode = roomCode;

  send(ws, { type: 'joinedRoom', roomCode, playerId: player.id, players: roomSnapshot(room) });
  for (const other of room.players.values()) {
    if (other.id !== player.id) send(other.ws, { type: 'playerJoined', playerId: player.id });
  }
}

function leaveRoom(ws) {
  const { roomCode, playerId } = ws;
  if (!roomCode || !playerId) return;
  const room = rooms.get(roomCode);
  if (!room) return;
  room.players.delete(playerId);
  for (const other of room.players.values()) send(other.ws, { type: 'playerLeft', playerId });
  if (room.players.size === 0) rooms.delete(roomCode);
  ws.roomCode = null;
  ws.playerId = null;
}

const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return send(ws, { type: 'error', message: 'Bad JSON' }); }

    if (msg.type === 'createRoom') {
      const roomCode = makeRoomCode();
      rooms.set(roomCode, { players: new Map(), createdAt: Date.now() });
      joinRoom(ws, roomCode);
      return send(ws, { type: 'roomCreated', roomCode, playerId: ws.playerId });
    }

    if (msg.type === 'joinRoom') {
      const code = String(msg.roomCode || '').trim();
      if (!/^\d{4}$/.test(code)) return send(ws, { type: 'error', message: 'Enter a valid 4 digit room PIN' });
      return joinRoom(ws, code);
    }

    if (msg.type === 'playerState') {
      const room = rooms.get(ws.roomCode);
      if (!room || !ws.playerId) return;
      const player = room.players.get(ws.playerId);
      if (!player) return;
      player.state = msg.state || null;
      for (const other of room.players.values()) {
        if (other.id !== ws.playerId) send(other.ws, { type: 'playerUpdate', playerId: ws.playerId, state: player.state });
      }
    }
  });

  ws.on('close', () => leaveRoom(ws));
  ws.on('error', () => leaveRoom(ws));
});

console.log(`Zombie multiplayer server listening on :${PORT}`);
