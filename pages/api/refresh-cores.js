import { put, head } from "@vercel/blob";

// Allows this job to run up to 300 seconds (Pro plan limit).
export const config = {
  maxDuration: 300,
};

const STATE_KEY = "refresh-state.json";
const CACHE_KEY = "cores-cache.json";

const BUDGET_MS = 260000;
const SAFETY_MARGIN_MS = 20000;
const REFRESH_INTERVAL_MS = 30 * 60 * 1000; // wait 30 min between full cycles once complete

const VAULT_ADDRESS = "0x1a1d4c5c255635a796ad6f64d16431acb2d37c90";
const STATS_CHUNK_SIZE = 50;
const MAX_RACE_RESULT_PAGES = 2000;

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function authHeaders(API_KEY) {
  return {
    "Content-Type": "application/json",
    ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
  };
}

async function loadState() {
  try {
    const meta = await head(STATE_KEY);
    const res = await fetch(meta.url, {
      headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
    });
    if (!res.ok) throw new Error(`state fetch failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    return { phase: "idle", lastFullRunCompletedAt: null };
  }
}

async function saveState(state) {
  await put(STATE_KEY, JSON.stringify(state), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

export default async function handler(req, res) {
  if (process.env.CRON_SECRET) {
    const authHeader = req.headers["authorization"];
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  const API_KEY = process.env.DNA_API_KEY;
  const START = Date.now();
  const timeLeft = () => BUDGET_MS - (Date.now() - START);

  let state = await loadState();

  if (state.phase === "idle") {
    const last = state.lastFullRunCompletedAt ? new Date(state.lastFullRunCompletedAt).getTime() : 0;
    if (Date.now() - last < REFRESH_INTERVAL_MS) {
      return res.status(200).json({
        status: "idle",
        message: "Cache is still fresh, no refresh needed yet.",
        lastFullRunCompletedAt: state.lastFullRunCompletedAt,
      });
    }
    state = { phase: "vault", lastFullRunCompletedAt: state.lastFullRunCompletedAt };
    await saveState(state);
  }

  try {
    // PHASE: vault - fetch the list of cores (names) in the vault
    if (state.phase === "vault") {
      const vaultRes = await fetch("https://api.dnaracing.run/fbike/vault/bikes_inf", {
        method: "POST",
        headers: authHeaders(API_KEY),
        body: JSON.stringify({ vault: VAULT_ADDRESS }),
      });

      if (!vaultRes.ok) {
        return res.status(502).json({ error: `Vault fetch failed with status ${vaultRes.status}` });
      }

      const vaultData = await vaultRes.json();
      if (!vaultData || vaultData.status !== "success" || !Array.isArray(vaultData.result)) {
        return res.status(200).json({ error: "Vault returned no cores" });
      }

      state.cores = vaultData.result.map((c) => ({ hid: Number(c.hid), name: c.name || `Core #${c.hid}` }));
      state.hids = state.cores.map((c) => c.hid).filter((n) => !isNaN(n));
      state.blueStarByHid = {};
      state.hstatsCursor = { batchIdx: 0 };
      state.phase = "hstats";
      await saveState(state);
    }

    // PHASE: hstats - bike-mode career blue star % only (no other modes, no race types/distances)
    if (state.phase === "hstats") {
      const batches = chunk(state.hids, STATS_CHUNK_SIZE);

      for (let batchIdx = state.hstatsCursor.batchIdx; batchIdx < batches.length; batchIdx++) {
        if (timeLeft() < SAFETY_MARGIN_MS) {
          state.hstatsCursor = { batchIdx };
          await saveState(state);
          return res.status(200).json({ status: "in_progress", phase: "hstats", batchIdx });
        }

        const batch = batches[batchIdx];
        let statsRes = await fetch("https://api.dnaracing.run/fbike/cores/hstats_doc_bulk", {
          method: "POST",
          headers: authHeaders(API_KEY),
          body: JSON.stringify({ hids: batch, rvmode: "bike" }),
        });

        if (statsRes.status === 429) {
          await sleep(800);
          statsRes = await fetch("https://api.dnaracing.run/fbike/cores/hstats_doc_bulk", {
            method: "POST",
            headers: authHeaders(API_KEY),
            body: JSON.stringify({ hids: batch, rvmode: "bike" }),
          });
        }

        if (statsRes.ok) {
          const statsData = await statsRes.json();
          if (statsData && statsData.status === "success" && Array.isArray(statsData.result)) {
            for (const doc of statsData.result) {
              const career = doc?.data?.career;
              if (!career) continue;
              state.blueStarByHid[doc.hid] =
                career.bluestar_p != null ? Number((career.bluestar_p * 100).toFixed(2)) : 0;
            }
          }
        }

        await sleep(120);
      }

      state.recordByHid = {}; // { [hid]: { wins, losses } } - bike mode, 2-gate races only
      state.raceresultsCursor = { page: 0 };
      state.raceResultsFetched = 0;
      state.pagesFetched = 0;
      state.phase = "raceresults";
      await saveState(state);
    }

    // PHASE: raceresults - paginate full history, keep only bike + exactly 2-core races
    if (state.phase === "raceresults") {
      const RACERESULTS_MAX_RETRIES = 3;
      const RACERESULTS_RETRY_BASE_DELAY_MS = 500;

      for (let page = state.raceresultsCursor.page; page < MAX_RACE_RESULT_PAGES; page++) {
        if (timeLeft() < SAFETY_MARGIN_MS) {
          state.raceresultsCursor = { page };
          await saveState(state);
          return res.status(200).json({ status: "in_progress", phase: "raceresults", page });
        }

        let races = null;
        let gaveUpOnPage = false;

        for (let attempt = 0; attempt <= RACERESULTS_MAX_RETRIES; attempt++) {
          const raceRes = await fetch("https://api.dnaracing.run/fbike/vault/raceresults", {
            method: "POST",
            headers: authHeaders(API_KEY),
            body: JSON.stringify({ vault: VAULT_ADDRESS, page }),
          });

          if (raceRes.ok) {
            const raceData = await raceRes.json();
            races = raceData?.result?.races;
            break;
          }

          if (attempt < RACERESULTS_MAX_RETRIES) {
            await sleep(RACERESULTS_RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
          } else {
            console.error(`raceresults page ${page} failed permanently: status ${raceRes.status}`);
            gaveUpOnPage = true;
          }
        }

        if (gaveUpOnPage) break;

        state.pagesFetched++;

        if (!Array.isArray(races) || races.length === 0) break; // natural end of history

        for (const rec of races) {
          state.raceResultsFetched++;
          // Only bike mode, only exactly 2 competitors in the race
          if (rec?.rvmode !== "bike" || Number(rec?.rgate) !== 2) continue;

          const hid = rec?.hid;
          if (hid == null) continue;

          if (!state.recordByHid[hid]) state.recordByHid[hid] = { wins: 0, losses: 0 };
          if (rec.pos === 1) state.recordByHid[hid].wins += 1;
          else state.recordByHid[hid].losses += 1; // pos 1 = win, anything else in a 2-core race = loss
        }

        await sleep(150);
      }

      console.log(`raceresults: fetched ${state.raceResultsFetched} records across ${state.pagesFetched} pages`);

      state.phase = "finalize";
      await saveState(state);
    }

    // PHASE: finalize - build the simple leaderboard and save it
    if (state.phase === "finalize") {
      const leaderboard = state.cores.map((c) => {
        const record = state.recordByHid[c.hid] || { wins: 0, losses: 0 };
        const races = record.wins + record.losses;
        const winPct = races > 0 ? Number(((record.wins / races) * 100).toFixed(2)) : 0;
        return {
          hid: c.hid,
          name: c.name,
          wins: record.wins,
          losses: record.losses,
          races,
          winPct,
          blueStarPct: state.blueStarByHid[c.hid] ?? 0,
        };
      });

      const updatedAt = new Date().toISOString();
      const payload = { updatedAt, cores: leaderboard };

      await put(CACHE_KEY, JSON.stringify(payload), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      });

      const finalState = { phase: "idle", lastFullRunCompletedAt: updatedAt };
      await saveState(finalState);

      console.log(`refresh-cores: cycle complete, saved ${leaderboard.length} cores at ${updatedAt}`);

      return res.status(200).json({ status: "complete", updatedAt, coreCount: leaderboard.length });
    }

    return res.status(200).json({ status: "in_progress", phase: state.phase });
  } catch (error) {
    console.error("refresh-cores.js error:", error);
    try {
      await saveState(state);
    } catch (saveErr) {
      console.error("Additionally failed to save state after error:", saveErr);
    }
    return res.status(500).json({ error: "Failed to refresh core data (partial progress saved, will resume next run)" });
  }
}
