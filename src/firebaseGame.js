import { initializeApp } from "firebase/app";
import { get, getDatabase, limitToLast, onValue, orderByChild, push, query, ref, set, update } from "firebase/database";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every(Boolean);

let database = null;

function getGameDatabase() {
  if (!isFirebaseConfigured) return null;
  if (!database) {
    database = getDatabase(initializeApp(firebaseConfig));
  }
  return database;
}

export function createRoom(roomCode, playerId, playerName) {
  const db = getGameDatabase();
  if (!db) return Promise.reject(new Error("Firebase is not configured."));

  return set(ref(db, `rooms/${roomCode}`), {
    status: "waiting",
    createdAt: Date.now(),
    startedAt: null,
    players: {
      [playerId]: {
        name: playerName,
        score: 0,
        ready: true,
        finished: false,
        joinedAt: Date.now()
      }
    }
  });
}

export async function joinRoom(roomCode, playerId, playerName) {
  const db = getGameDatabase();
  if (!db) return Promise.reject(new Error("Firebase is not configured."));

  const roomSnapshot = await get(ref(db, `rooms/${roomCode}`));
  if (!roomSnapshot.exists()) {
    throw new Error("Room not found.");
  }

  return set(ref(db, `rooms/${roomCode}/players/${playerId}`), {
    name: playerName,
    score: 0,
    ready: true,
    finished: false,
    joinedAt: Date.now()
  });
}

export function startRoom(roomCode) {
  const db = getGameDatabase();
  if (!db) return Promise.reject(new Error("Firebase is not configured."));

  return update(ref(db, `rooms/${roomCode}`), {
    status: "playing",
    startedAt: Date.now() + 2500
  });
}

export function updateRoomScore(roomCode, playerId, score, finished = false) {
  const db = getGameDatabase();
  if (!db) return Promise.resolve();

  return update(ref(db, `rooms/${roomCode}/players/${playerId}`), {
    score,
    finished,
    updatedAt: Date.now()
  });
}

export function submitLeaderboardScore(playerName, score, mode = "solo") {
  const db = getGameDatabase();
  if (!db || score <= 0) return Promise.resolve();

  return push(ref(db, "leaderboard"), {
    name: playerName,
    score,
    mode,
    createdAt: Date.now()
  });
}

export function subscribeToRoom(roomCode, callback) {
  const db = getGameDatabase();
  if (!db || !roomCode) return () => {};

  return onValue(ref(db, `rooms/${roomCode}`), (snapshot) => callback(snapshot.val()));
}

export function subscribeToLeaderboard(callback) {
  const db = getGameDatabase();
  if (!db) return () => {};

  const leaderboardQuery = query(ref(db, "leaderboard"), orderByChild("score"), limitToLast(10));

  return onValue(leaderboardQuery, (snapshot) => {
    const scores = [];
    snapshot.forEach((childSnapshot) => {
      scores.push({ id: childSnapshot.key, ...childSnapshot.val() });
    });
    callback(scores.sort((a, b) => b.score - a.score));
  });
}
