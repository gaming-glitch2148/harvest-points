import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const GAME_SECONDS = 45;
const GRID_SIZE = 20;
const CROP_RESPAWN_MS = 120;
const FIELD_GROWTH_MS = 650;
const MIN_WHEAT_TILES = 4;

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

function App() {
  const [status, setStatus] = useState("idle");
  const [score, setScore] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(GAME_SECONDS);
  const [tiles, setTiles] = useState(() => makeGrid());
  const [highScore, setHighScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const respawnTimers = useRef(new Map());

  function clearRespawnTimers() {
    respawnTimers.current.forEach((timerId) => window.clearTimeout(timerId));
    respawnTimers.current.clear();
  }

  useEffect(() => {
    setHighScore(getStoredHighScore());
  }, []);

  useEffect(() => clearRespawnTimers, []);

  useEffect(() => {
    if (status !== "playing") return;

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
  }, [status]);

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
  }, [status, score, highScore]);

  const accuracyLabel = useMemo(() => {
    if (score >= 250) return "Master Harvester";
    if (score >= 150) return "Sharp Cutter";
    if (score >= 75) return "Field Rookie";
    if (score > 0) return "Getting Warmed Up";
    return "Watch the corn!";
  }, [score]);

  function startGame() {
    clearRespawnTimers();
    setStatus("playing");
    setScore(0);
    setSecondsLeft(GAME_SECONDS);
    setCombo(0);
    setTiles(makeGrid());
  }

  function resetGame() {
    clearRespawnTimers();
    setStatus("idle");
    setScore(0);
    setSecondsLeft(GAME_SECONDS);
    setCombo(0);
    setTiles(makeGrid());
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
        </div>

        <div className="actions">
          <button className="primary-button" onClick={startGame}>
            {status === "playing" ? "Restart Game" : status === "gameOver" ? "Play Again" : "Start Game"}
          </button>
          <button className="secondary-button" onClick={resetGame}>
            Reset
          </button>
        </div>
      </section>

      <section className="game-shell">
        <div className="field-header">
          <div>
            <h2>Crop Field</h2>
            <p>{status === "playing" ? "Tap crops quickly." : "Press Start Game to begin."}</p>
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
            <button className="primary-button" onClick={startGame}>Play Again</button>
          </div>
        )}
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
