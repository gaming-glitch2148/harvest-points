import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  createRoom,
  isSupabaseConfigured,
  joinRoom,
  startRoom,
  submitLeaderboardScore,
  subscribeToLeaderboard,
  subscribeToRoom,
  updateRoomScore
} from "./supabaseGame";
import "./styles.css";

const GAME_SECONDS = 45;
const GRID_SIZE = 20;
const CROP_RESPAWN_MS = 120;
const FIELD_GROWTH_MS = 650;
const MIN_WHEAT_TILES = 4;
const ONLINE_CHECK_MS = 10000;
const PLAYER_ID_KEY = "harvest-points-player-id";
const PLAYER_NAME_KEY = "harvest-points-player-name";

const CROP_TYPES = [
  { type: "wheat", label: "🌾", name: "Wheat", points: 10, weight: 55, className: "wheat" },
  { type: "corn", label: "🌽", name: "Corn", points: -10, weight: 25, className: "corn" },
  { type: "carrot", label: "🥕", name: "Carrot", points: -5, weight: 8, className: "other" },
  { type: "tomato", label: "🍅", name: "Tomato", points: -5, weight: 7, className: "other" },
  { type: "goldenWheat", label: "✨🌾", name: "Golden Wheat", points: 30, weight: 3, className: "golden" },
  { type: "empty", label: "🟫", name: "Empty Soil", points: 0, weight: 2, className: "empty" }
];
const HARVESTED_CROP = { type: "harvested", label: "", name: "Freshly Cut Soil", points: 0, weight: 0, className: "empty harvested" };

const TOTAL_WEIGHT = CROP_TYPES.reduce((sum, crop) => sum + crop.weight, 0);

function randomCrop() {
  let roll = Math.random() * TOTAL_WEIGHT;

  for (const crop of CROP_TYPES) {
    roll -= crop.weight;
    if (roll <= 0) {
      return crop;
    }
  }

  return CROP_TYPES[0];
}

function makeTile(id) {
  return {
    id,
    crop: randomCrop(),
    lastResult: null
  };
}

function makeGrid() {
  return keepWheatAvailable(Array.from({ length: GRID_SIZE }, (_, index) => makeTile(index + 1)));
}

function isWheatCrop(crop) {
  return crop.type === "wheat" || crop.type === "goldenWheat";
}

function makeWheatTile(id) {
  return {
    id,
    crop: CROP_TYPES[0],
    lastResult: null
  };
}

function keepWheatAvailable(tiles) {
  const wheatCount = tiles.filter((tile) => isWheatCrop(tile.crop)).length;
  const missingWheat = MIN_WHEAT_TILES - wheatCount;

  if (missingWheat <= 0) return tiles;

  let plantedWheat = 0;

  return tiles.map((tile) => {
    if (plantedWheat >= missingWheat || tile.crop.type === "harvested" || isWheatCrop(tile.crop)) {
      return tile;
    }

    plantedWheat += 1;
    return makeWheatTile(tile.id);
  });
}

function growField(tiles) {
  return keepWheatAvailable(
    tiles.map((tile) => {
      if (tile.crop.type === "harvested" || isWheatCrop(tile.crop) || Math.random() > 0.3) {
        return tile;
      }

      return makeTile(tile.id);
    })
  );
}

function getStoredHighScore() {
  const value = Number(window.localStorage.getItem("harvest-points-high-score") || 0);
  return Number.isFinite(value) ? value : 0;
}

function getStoredPlayerId() {
  const existingId = window.localStorage.getItem(PLAYER_ID_KEY);
  if (existingId) return existingId;

  const newId = window.crypto?.randomUUID?.() || `player-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(PLAYER_ID_KEY, newId);
  return newId;
}

function getStoredPlayerName() {
  return window.localStorage.getItem(PLAYER_NAME_KEY) || "Player";
}

function makeRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function App() {
  const [status, setStatus] = useState("idle");
  const [score, setScore] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(GAME_SECONDS);
  const [tiles, setTiles] = useState(() => makeGrid());
  const [highScore, setHighScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [playerId] = useState(() => getStoredPlayerId());
  const [playerName, setPlayerName] = useState(() => getStoredPlayerName());
  const [gameMode, setGameMode] = useState("solo");
  const [roomCode, setRoomCode] = useState("");
  const [roomInput, setRoomInput] = useState("");
  const [roomData, setRoomData] = useState(null);
  const [onlineMessage, setOnlineMessage] = useState("");
  const [leaderboard, setLeaderboard] = useState([]);
  const [localLeaderboard, setLocalLeaderboard] = useState([]);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const respawnTimers = useRef(new Map());
  const submittedGameRef = useRef(null);
  const activeRoomStartRef = useRef(null);
  const currentGameRef = useRef(null);
  const scoreRef = useRef(0);

  function clearRespawnTimers() {
    respawnTimers.current.forEach((timerId) => window.clearTimeout(timerId));
    respawnTimers.current.clear();
  }

  useEffect(() => {
    setHighScore(getStoredHighScore());
    setLocalLeaderboard([
      {
        id: "local-best",
        name: getStoredPlayerName(),
        score: getStoredHighScore(),
        mode: "solo"
      }
    ]);
  }, []);

  useEffect(() => clearRespawnTimers, []);

  useEffect(() => {
    function updateOnlineStatus() {
      setIsOnline(navigator.onLine);
    }

    const interval = window.setInterval(updateOnlineStatus, ONLINE_CHECK_MS);

    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    window.localStorage.setItem(PLAYER_NAME_KEY, playerName.trim() || "Player");
  }, [playerName]);

  useEffect(() => {
    return subscribeToLeaderboard(setLeaderboard);
  }, []);

  useEffect(() => {
    if (!roomCode) {
      setRoomData(null);
      return undefined;
    }

    return subscribeToRoom(roomCode, setRoomData);
  }, [roomCode]);

  useEffect(() => {
    if (status !== "playing" || gameMode === "online") return;

    const interval = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(interval);
          setStatus("gameOver");
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [status, gameMode]);

  useEffect(() => {
    if (gameMode !== "online" || roomData?.status !== "playing" || !roomData.startedAt) return;
    if (activeRoomStartRef.current === roomData.startedAt) return;

    activeRoomStartRef.current = roomData.startedAt;
    clearRespawnTimers();
    setStatus("countdown");
    setScore(0);
    setSecondsLeft(GAME_SECONDS);
    setCombo(0);
    setTiles(makeGrid());
    submittedGameRef.current = null;
    currentGameRef.current = `${roomCode}-${roomData.startedAt}`;
    updateRoomScore(roomCode, playerId, 0, false);
  }, [gameMode, playerId, roomCode, roomData?.startedAt, roomData?.status]);

  useEffect(() => {
    if (gameMode !== "online" || !roomData?.startedAt || (status !== "countdown" && status !== "playing")) return;

    const interval = window.setInterval(() => {
      const now = Date.now();
      const startTime = roomData.startedAt;
      const endTime = startTime + GAME_SECONDS * 1000;

      if (now < startTime) {
        setStatus("countdown");
        setSecondsLeft(GAME_SECONDS);
        return;
      }

      const nextSeconds = Math.max(0, Math.ceil((endTime - now) / 1000));
      setStatus(nextSeconds > 0 ? "playing" : "gameOver");
      setSecondsLeft(nextSeconds);

      if (nextSeconds <= 0) {
        window.clearInterval(interval);
        updateRoomScore(roomCode, playerId, scoreRef.current, true);
      }
    }, 250);

    return () => window.clearInterval(interval);
  }, [gameMode, playerId, roomCode, roomData?.startedAt, status]);

  useEffect(() => {
    if (status !== "playing") return;

    const interval = window.setInterval(() => {
      setTiles((currentTiles) => growField(currentTiles));
    }, FIELD_GROWTH_MS);

    return () => window.clearInterval(interval);
  }, [status]);

  useEffect(() => {
    if (status !== "gameOver") return;

    if (score > highScore) {
      setHighScore(score);
      window.localStorage.setItem("harvest-points-high-score", String(score));
    }

    const gameKey = currentGameRef.current || `${gameMode}-${roomCode || "local"}`;
    if (submittedGameRef.current === gameKey) return;

    submittedGameRef.current = gameKey;
    submitLeaderboardScore(playerName.trim() || "Player", score, gameMode);
    setLocalLeaderboard((currentScores) =>
      [{ id: gameKey, name: playerName.trim() || "Player", score, mode: gameMode }, ...currentScores]
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
    );
  }, [gameMode, highScore, playerName, roomCode, roomData?.startedAt, score, status]);

  useEffect(() => {
    if (gameMode !== "online" || !roomCode || status !== "playing") return;
    updateRoomScore(roomCode, playerId, score, false);
  }, [gameMode, playerId, roomCode, score, status]);

  const accuracyLabel = useMemo(() => {
    if (score >= 250) return "Master Harvester";
    if (score >= 150) return "Sharp Cutter";
    if (score >= 75) return "Field Rookie";
    if (score > 0) return "Getting Warmed Up";
    return "Watch the corn!";
  }, [score]);

  const roomPlayers = useMemo(() => Object.entries(roomData?.players || {}), [roomData]);
  const opponent = useMemo(
    () => roomPlayers.find(([roomPlayerId]) => roomPlayerId !== playerId)?.[1] || null,
    [playerId, roomPlayers]
  );
  const displayedLeaderboard = leaderboard.length > 0 ? leaderboard : localLeaderboard.filter((entry) => entry.score > 0);
  const onlineReady = isSupabaseConfigured && isOnline;
  const onlineStatusText = !isOnline
    ? "Offline. Solo play is available, but online matches need internet."
    : isSupabaseConfigured
      ? "Create a room or join with a code."
      : "Supabase setup is needed for live online play.";

  function startGame() {
    clearRespawnTimers();
    setGameMode("solo");
    setStatus("playing");
    setScore(0);
    setSecondsLeft(GAME_SECONDS);
    setCombo(0);
    setTiles(makeGrid());
    submittedGameRef.current = null;
    currentGameRef.current = `solo-${Date.now()}`;
  }

  function resetGame() {
    clearRespawnTimers();
    setStatus("idle");
    setScore(0);
    setSecondsLeft(GAME_SECONDS);
    setCombo(0);
    setTiles(makeGrid());
    submittedGameRef.current = null;
    currentGameRef.current = null;
  }

  async function createOnlineRoom() {
    if (!onlineReady) {
      setOnlineMessage(isOnline ? "Add Supabase environment variables to enable online play." : "Online matches need internet.");
      return;
    }

    const nextRoomCode = makeRoomCode();
    const name = playerName.trim() || "Player";

    try {
      await createRoom(nextRoomCode, playerId, name);
      setGameMode("online");
      setRoomCode(nextRoomCode);
      setRoomInput(nextRoomCode);
      setStatus("idle");
      setOnlineMessage(`Room ${nextRoomCode} created. Share this code with your opponent.`);
    } catch (error) {
      setOnlineMessage(error.message || "Could not create room.");
    }
  }

  async function joinOnlineRoom() {
    if (!onlineReady) {
      setOnlineMessage(isOnline ? "Add Supabase environment variables to enable online play." : "Online matches need internet.");
      return;
    }

    const nextRoomCode = roomInput.trim().toUpperCase();
    if (!nextRoomCode) {
      setOnlineMessage("Enter a room code first.");
      return;
    }

    try {
      await joinRoom(nextRoomCode, playerId, playerName.trim() || "Player");
      setGameMode("online");
      setRoomCode(nextRoomCode);
      setStatus("idle");
      setOnlineMessage(`Joined room ${nextRoomCode}.`);
    } catch (error) {
      setOnlineMessage(error.message || "Could not join room.");
    }
  }

  async function startOnlineMatch() {
    if (!onlineReady) {
      setOnlineMessage(isOnline ? "Add Supabase environment variables to enable online play." : "Online matches need internet.");
      return;
    }

    if (!roomCode) {
      setOnlineMessage("Create or join a room first.");
      return;
    }

    try {
      await startRoom(roomCode);
      setOnlineMessage("Match starting.");
    } catch (error) {
      setOnlineMessage(error.message || "Could not start match.");
    }
  }

  function leaveOnlineRoom() {
    setGameMode("solo");
    setRoomCode("");
    setRoomInput("");
    setRoomData(null);
    setOnlineMessage("");
    resetGame();
  }

  function cutCrop(tileId) {
    if (status !== "playing") return;

    const tile = tiles.find((currentTile) => currentTile.id === tileId);
    if (!tile || tile.crop.type === "harvested") return;

    const points = tile.crop.points;
    setScore((currentScore) => Math.max(0, currentScore + points));

    if (tile.crop.type === "wheat" || tile.crop.type === "goldenWheat") {
      setCombo((currentCombo) => currentCombo + 1);
    } else if (tile.crop.type !== "empty") {
      setCombo(0);
    }

    setTiles((currentTiles) =>
      currentTiles.map((currentTile) =>
        currentTile.id === tileId
          ? {
              ...currentTile,
              crop: HARVESTED_CROP,
              lastResult: points > 0 ? `+${points}` : points < 0 ? `${points}` : "0"
            }
          : currentTile
      )
    );

    const timerId = window.setTimeout(() => {
      respawnTimers.current.delete(tileId);
      setTiles((tilesToRespawn) =>
        keepWheatAvailable(
          tilesToRespawn.map((respawnTile) => (respawnTile.id === tileId ? makeTile(respawnTile.id) : respawnTile))
        )
      );
    }, CROP_RESPAWN_MS);

    respawnTimers.current.set(tileId, timerId);
  }

  return (
    <main className="game-page">
      <section className="hero-card">
        <div className="eyebrow">Casual Web Game</div>
        <h1>Harvest Points</h1>
        <p className="subtitle">
          Cut wheat to gain points. Avoid corn and other crops. You have {GAME_SECONDS} seconds to beat your high score.
        </p>

        <div className="stats-row" aria-label="Game stats">
          <div className="stat-card">
            <span>Score</span>
            <strong>{score}</strong>
          </div>
          <div className="stat-card">
            <span>Time</span>
            <strong>{secondsLeft}s</strong>
          </div>
          <div className="stat-card">
            <span>High Score</span>
            <strong>{highScore}</strong>
          </div>
          <div className="stat-card">
            <span>Combo</span>
            <strong>{combo}x</strong>
          </div>
          <div className="stat-card">
            <span>Opponent</span>
            <strong>{gameMode === "online" ? opponent?.score ?? 0 : "--"}</strong>
          </div>
        </div>

        <div className="actions">
          <button className="primary-button" onClick={startGame}>
            {gameMode === "solo" && status === "playing" ? "Restart Solo" : status === "gameOver" ? "Play Solo Again" : "Start Solo"}
          </button>
          <button className="secondary-button" onClick={resetGame}>
            Reset
          </button>
        </div>
      </section>

      <section className="online-card">
        <div className="field-header">
          <div>
            <h2>Online Match</h2>
            <p>{onlineStatusText}</p>
          </div>
          <div className={`status-pill ${isOnline ? gameMode : "offline"}`}>{isOnline ? gameMode : "offline"}</div>
        </div>

        <div className="online-grid">
          <label className="input-field">
            <span>Your Name</span>
            <input value={playerName} maxLength="18" onChange={(event) => setPlayerName(event.target.value)} />
          </label>
          <label className="input-field">
            <span>Room Code</span>
            <input
              value={roomInput}
              maxLength="8"
              onChange={(event) => setRoomInput(event.target.value.toUpperCase())}
              placeholder="ABC123"
            />
          </label>
          <button className="secondary-button" onClick={createOnlineRoom} disabled={!onlineReady}>Create Room</button>
          <button className="secondary-button" onClick={joinOnlineRoom} disabled={!onlineReady}>Join Room</button>
        </div>

        {roomCode && (
          <div className="room-panel">
            <div>
              <span>Room</span>
              <strong>{roomCode}</strong>
            </div>
            <div>
              <span>Players</span>
              <strong>{roomPlayers.length}/2</strong>
            </div>
            <div>
              <span>Opponent</span>
              <strong>{opponent?.name || "Waiting"}</strong>
            </div>
            <div className="room-actions">
              <button className="primary-button" onClick={startOnlineMatch} disabled={!onlineReady || roomPlayers.length < 2}>
                Start Match
              </button>
              <button className="secondary-button" onClick={leaveOnlineRoom}>Leave</button>
            </div>
          </div>
        )}

        {onlineMessage && <p className="online-message">{onlineMessage}</p>}
      </section>

      <section className="game-shell">
        <div className="field-header">
          <div>
            <h2>Crop Field</h2>
            <p>
              {status === "countdown"
                ? "Get ready."
                : status === "playing"
                  ? "Tap crops quickly."
                  : "Press Start Solo or start an online match."}
            </p>
          </div>
          <div className={`status-pill ${status}`}>{status === "gameOver" ? "Game Over" : status}</div>
        </div>

        <div className="field-grid" aria-label="Crop field">
          {tiles.map((tile) => (
            <button
              key={tile.id}
              className={`crop-tile ${tile.crop.className}`}
              onClick={() => cutCrop(tile.id)}
              disabled={status !== "playing"}
              aria-label={`${tile.crop.name}, ${tile.crop.points} points`}
            >
              <span className="crop-emoji">{tile.crop.label}</span>
              {tile.lastResult && <span className={`points-pop ${tile.lastResult.startsWith("+") ? "good" : "bad"}`}>{tile.lastResult}</span>}
            </button>
          ))}
        </div>

        {status === "gameOver" && (
          <div className="game-over-panel">
            <h2>{accuracyLabel}</h2>
            <p>Your final score is <strong>{score}</strong>.</p>
            {gameMode === "online" && opponent && (
              <p>
                {score === opponent.score
                  ? "It is a tie."
                  : score > opponent.score
                    ? `You beat ${opponent.name}.`
                    : `${opponent.name} won this round.`}
              </p>
            )}
            <button
              className="primary-button"
              onClick={gameMode === "online" ? startOnlineMatch : startGame}
              disabled={gameMode === "online" && !onlineReady}
            >
              {gameMode === "online" ? "Rematch" : "Play Again"}
            </button>
          </div>
        )}
      </section>

      <section className="leaderboard-card">
        <h2>Leaderboard</h2>
        <div className="leaderboard-list">
          {displayedLeaderboard.length > 0 ? (
            displayedLeaderboard.map((entry, index) => (
              <div className="leaderboard-row" key={entry.id || `${entry.name}-${entry.score}-${index}`}>
                <span>{index + 1}</span>
                <strong>{entry.name || "Player"}</strong>
                <em>{entry.mode || "solo"}</em>
                <b>{entry.score}</b>
              </div>
            ))
          ) : (
            <p className="empty-state">
              {isOnline
                ? "Scores will appear after the first game."
                : "Online leaderboard updates when you are back online."}
            </p>
          )}
        </div>
      </section>

      <section className="rules-card">
        <h2>Rules</h2>
        <div className="rules-grid">
          <div><strong>🌾 Wheat</strong><span>+10 points</span></div>
          <div><strong>✨🌾 Golden Wheat</strong><span>+30 points</span></div>
          <div><strong>🌽 Corn</strong><span>-10 points</span></div>
          <div><strong>🥕 / 🍅 Other Crops</strong><span>-5 points</span></div>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js");
  });
}
