---
publishDate: 2026-10-25T00:00:00Z
title: 'Porting BrowserQuest to Cloudflare Workers and Durable Objects'
excerpt: "How I moved Mozilla's 2012 HTML5 MMO from a Node server to one Durable Object, with WebSockets, an Alarms game loop and SQLite."
image: 'media:projects/browserquest.png'
imageAlt: 'BrowserQuest start screen: a parchment scroll with a character name field and a Play button on a wooden background'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'infraestructura'
lang: 'en'
---

## Why BrowserQuest

[BrowserQuest](https://github.com/mozilla/BrowserQuest) came out in 2012. Mozilla and Little Workshop built it to show what the web could do: a pixel-art multiplayer RPG drawn on `<canvas>`, with real-time play over WebSockets. It still holds up, and because the code is open it's a good way to learn how a small MMO works.

The catch is the server. The original is a Node.js process that holds every world in memory, runs a `setInterval` game loop and accepts sockets through the `websocket-server` module. To keep it online you need a machine running around the clock, whether anyone is playing or not.

I wanted to see how much of that I could swap for Cloudflare primitives without rewriting the game. The result runs at [browserquest.carluve.workers.dev](https://browserquest.carluve.workers.dev), and the code is in [Carluve/BrowserQuest](https://github.com/Carluve/BrowserQuest), a fork of the Mozilla repo. Everything for the port lives in `worker/`. The original `client/`, `server/` and `shared/` directories are still there for reference.

## The shape of the port

There are three moving parts:

- **An entry Worker** (`src/index.ts`) that routes requests.
- **One Durable Object class**, `WorldDO` (`src/world-do.ts`), that holds the authoritative game world.
- **The original game logic** (`game/`), copied from `server/js/` and adapted so the Workers bundler can load it.

The built client sits in `worker/assets/` and is served through the `ASSETS` binding. `wrangler.jsonc` is short: that assets binding, a `WORLD` Durable Object binding for `WorldDO`, and a `v1` migration with `new_sqlite_classes: ["WorldDO"]`. That migration makes `WorldDO` a SQLite-backed Durable Object, which gives it `ctx.storage.sql`. The `nodejs_compat` flag is also on, because the ported game code still uses CommonJS-style `require()`.

## One world, one Durable Object

The original server started five worlds of 200 players each (`nb_worlds: 5` in `server/config.json`) and put each new player in the least populated one. My port is simpler: one world, one Durable Object, always addressed by the same name:

```ts
const WORLD_NAME = 'world1';

if (url.pathname === '/ws') {
  if (request.headers.get('Upgrade') !== 'websocket') {
    return new Response('Expected a WebSocket upgrade', { status: 426 });
  }
  const stub = env.WORLD.get(env.WORLD.idFromName(WORLD_NAME));
  return stub.fetch(request);
}
```

The Worker handles three routes. `/ws` forwards the WebSocket upgrade to the world. `/status` calls an RPC method on the Durable Object, `stub.getStatus()`, which returns connections, players and entity count as JSON. Every other path is a static asset. A comment in the code calls this a single-world MVP and leaves sharding by zone for later. Since `idFromName` is deterministic, more worlds would mostly mean deriving the name from something other than a constant.

The model fits well. A Durable Object is a single-threaded instance with its own storage, which is exactly the "one authoritative process per world" assumption the 2012 server made. The game code doesn't need to know it's running somewhere else.

## WebSockets through the Hibernation API

In `WorldDO.fetch()` the object creates a `WebSocketPair` and accepts the server side with the Hibernation API instead of calling `ws.accept()`:

```ts
this.ctx.acceptWebSocket(server);

const id = '5' + this.counter++;
server.serializeAttachment({ id });

const conn = new game.Connection(id, server, game.server);
this.connections.set(server, conn);
game.server.handleConnect(conn);

await this.ensureAlarm();
```

Incoming frames reach the `webSocketMessage(ws, message)` handler. It looks up the matching connection and passes the raw string to `conn.receive()`. `webSocketClose` and `webSocketError` both go to one teardown path, which saves the player to SQLite, fires the game's close callback and removes the connection.

The adapter is `game/transport.js`, which replaces the original `server/js/ws.js`. It implements only what `worldserver.js` and `player.js` call: `listen`, `onClose`, `send`, `sendUTF8`, `close` on the connection, plus `broadcast`, `forEachConnection` and friends on the server. Messages go over the wire as JSON, which matches the client running with `useBison = false`. As a result, the world code keeps calling `connection.send(...)` the way it always did.

One detail matters here. The game's state lives in ordinary JavaScript objects in memory, and Cloudflare's docs say plainly that in-memory state is reset when an object hibernates. I don't try to rebuild the world from SQLite. The constructor checks for sockets left over from a previous instance (`ctx.getWebSockets()`) and closes them with code 1012, "server restarted, please reconnect", so clients reconnect and handshake again.

So I use the Hibernation API mostly for its handler model and for what it does once the world is idle. Live sessions are not carried across a hibernation. The id stored with `serializeAttachment` is never read back with `deserializeAttachment`. It's there for the day the world state itself can be restored.

## The game loop runs on Alarms

The original loop was a `setInterval` at `1000 / ups`, with `ups = 50`. The port removes the interval from `worldserver.js`, moves its body into a `tick()` method, and drives that from the Durable Object's alarm:

```ts
const TICK_MS = 50;

async alarm(): Promise<void> {
  const world = this.game?.world;
  if (world) {
    world.tick();
    this.snapshotCounter += 1;
    if (this.snapshotCounter >= SNAPSHOT_EVERY_TICKS) {
      this.snapshotCounter = 0;
      this.snapshotPlayers();
    }
  }
  if (this.connections.size > 0) {
    await this.ctx.storage.setAlarm(Date.now() + TICK_MS);
  }
}
```

Each alarm runs one tick and schedules the next one only while someone is connected. `ensureAlarm()` starts the chain again when a player joins. When the last player leaves, nothing schedules another alarm and the object has no more events to handle.

That's where the cost argument applies. The Durable Objects docs say alarms prevent hibernation, and a 50 ms alarm means the object never sits idle while people are playing. During play it's an active, billed object, much like a small server. The gain comes once everyone has left: no alarms, no sockets, nothing to wake it, and according to the docs duration charges don't accrue during hibernation. The world costs nothing to keep around while it's empty, which is the case the Node server handled worst.

I also slowed the loop down. The original ran 50 updates per second, while the port uses 50 ms, or 20 ticks per second. The comment in the code calls this a deliberate trade of some granularity for a native loop.

## What SQLite stores

The original game had no real player persistence. The port adds one table, created in the constructor:

```sql
CREATE TABLE IF NOT EXISTS players (
  name TEXT PRIMARY KEY,
  x INTEGER, y INTEGER, hp INTEGER,
  armor INTEGER, weapon INTEGER,
  updated_at INTEGER
)
```

`savePlayer()` does an `INSERT ... ON CONFLICT(name) DO UPDATE` upsert. It runs when a socket closes, and also for every connected player about every five seconds (`SNAPSHOT_EVERY_TICKS = 5000 / TICK_MS`), so a crash or eviction loses at most a few seconds of movement. Because SQLite runs inside the Durable Object, these calls are synchronous `this.sql.exec(...)` calls with no network round trip.

Reading the data back goes through a hook. `createGame()` accepts a `loadPlayer(name)` function and wraps the player's `onRequestPosition`. If a saved position exists and `world.isValidPosition()` accepts it, the player spawns there. Otherwise the original logic applies: last checkpoint, then a random starting position. Come back with the same name and you appear where you left off.

## Getting 2012 Node code to load in a Worker

Most of the work wasn't the Cloudflare side. It was the module system. The original server relied on non-strict CommonJS letting assignments leak into globals: `Types = {...}` and `module.exports = Player = ...` with no `var`, and other files then used `Types` or `Player` as bare globals. Under the Workers bundler that doesn't happen, so `game/index.js` has a `setupGlobals()` step. It puts `log`, `_`, `Class`, `Types`, `Utils`, `Formulas`, `Properties` and `Messages` on `globalThis` explicitly, then requires the class files in dependency order, `entity` through `player`, with each one registering itself.

After that, `worldserver.js`, `player.js`, `mob.js`, `map.js` and the rest run with very few changes. In `worldserver.js`, `run()` takes already-parsed map JSON instead of a file path (the map is imported as JSON in the Worker), and the interval became `tick()`. On the client, two files changed: `config.js` reads host and port from `window.location`, and `gameclient.js` builds a `wss://<host>/ws` URL. There's also a small Playwright script, `repro.mjs`, that opens the game, types a name, clicks play and checks that the body gets the `started` class.

## Limits, and what I'd do differently

The code is an MVP, and it has gaps:

- **No session survives a restart.** If the object is evicted while players are online, their sockets are closed with 1012 and the world (mobs, items, chests) starts over from the map. To fix that I'd serialize enough world state to rebuild it, or at least read each player back from SQLite plus the socket attachment instead of dropping the connection.
- **Persistence is only half done.** `hp`, `armor` and `weapon` are written but never read. `loadPlayer` returns only `x` and `y`, so a returning player gets their position back but not their gear.
- **Regen timing changed.** `World` still sets `ups = 50` and computes `regenCount = ups * 2`, which was a two-second regen interval at 50 ticks per second. At 20 ticks per second the same 100 ticks take about five seconds. The fix is to derive `ups` from `TICK_MS`.
- **One world.** Every player goes to `world1`, against five worlds in the original. Sharding by name is easy to add, but I haven't.
- **Alarms as a fast tick.** Alarms work, but they're durable scheduled events, and I'm calling one every 50 ms. For a busy world I'd measure whether a loop that runs only while sockets are open fits better, keeping alarms for waking the world up and running periodic jobs.

## Credits

The game, art and almost all of the server logic are the work of Mozilla and Little Workshop (Franck and Guillaume Lecollinet), in [mozilla/BrowserQuest](https://github.com/mozilla/BrowserQuest). Code is MPL 2.0 and content is CC-BY-SA 3.0. My part is the `worker/` directory: the transport adapter, the bootstrap, the Durable Object and the SQLite persistence. You can play it at [browserquest.carluve.workers.dev](https://browserquest.carluve.workers.dev) and read the full write-up in [`worker/SETUP.md`](https://github.com/Carluve/BrowserQuest/blob/master/worker/SETUP.md).
