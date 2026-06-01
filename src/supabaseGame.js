import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

let supabase = null;

function getGameClient() {
  if (!isSupabaseConfigured) return null;
  if (!supabase) {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
  return supabase;
}

function toRoomRecord(room) {
  if (!room) return null;

  return {
    status: room.status,
    createdAt: room.created_at ? new Date(room.created_at).getTime() : null,
    startedAt: room.started_at,
    players: room.players || {}
  };
}

export async function createRoom(roomCode, playerId, playerName) {
  const client = getGameClient();
  if (!client) throw new Error("Supabase is not configured.");

  const { error } = await client.from("rooms").insert({
    code: roomCode,
    status: "waiting",
    started_at: null,
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

  if (error) throw error;
}

export async function joinRoom(roomCode, playerId, playerName) {
  const client = getGameClient();
  if (!client) throw new Error("Supabase is not configured.");

  const { data: room, error: roomError } = await client.from("rooms").select("players").eq("code", roomCode).single();
  if (roomError || !room) throw new Error("Room not found.");

  const { error } = await client
    .from("rooms")
    .update({
      players: {
        ...(room.players || {}),
        [playerId]: {
          name: playerName,
          score: 0,
          ready: true,
          finished: false,
          joinedAt: Date.now()
        }
      }
    })
    .eq("code", roomCode);

  if (error) throw error;
}

export async function startRoom(roomCode) {
  const client = getGameClient();
  if (!client) throw new Error("Supabase is not configured.");

  const { error } = await client
    .from("rooms")
    .update({
      status: "playing",
      started_at: Date.now() + 2500
    })
    .eq("code", roomCode);

  if (error) throw error;
}

export async function updateRoomScore(roomCode, playerId, score, finished = false) {
  const client = getGameClient();
  if (!client) return;

  const { data: room, error: roomError } = await client.from("rooms").select("players").eq("code", roomCode).single();
  if (roomError || !room) return;

  const existingPlayer = room.players?.[playerId] || {};
  const { error } = await client
    .from("rooms")
    .update({
      players: {
        ...(room.players || {}),
        [playerId]: {
          ...existingPlayer,
          score,
          finished,
          updatedAt: Date.now()
        }
      }
    })
    .eq("code", roomCode);

  if (error) throw error;
}

export async function submitLeaderboardScore(playerName, score, mode = "solo") {
  const client = getGameClient();
  if (!client || score <= 0) return;

  const { error } = await client.from("leaderboard").insert({
    name: playerName,
    score,
    mode
  });

  if (error) throw error;
}

export function subscribeToRoom(roomCode, callback) {
  const client = getGameClient();
  if (!client || !roomCode) return () => {};

  client
    .from("rooms")
    .select("status, created_at, started_at, players")
    .eq("code", roomCode)
    .single()
    .then(({ data }) => callback(toRoomRecord(data)));

  const channel = client
    .channel(`room-${roomCode}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "rooms",
        filter: `code=eq.${roomCode}`
      },
      (payload) => callback(toRoomRecord(payload.new))
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}

export function subscribeToLeaderboard(callback) {
  const client = getGameClient();
  if (!client) return () => {};

  const loadLeaderboard = () => {
    client
      .from("leaderboard")
      .select("id, name, score, mode, created_at")
      .order("score", { ascending: false })
      .limit(10)
      .then(({ data }) => callback(data || []));
  };

  loadLeaderboard();

  const channel = client
    .channel("leaderboard")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "leaderboard"
      },
      loadLeaderboard
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}
