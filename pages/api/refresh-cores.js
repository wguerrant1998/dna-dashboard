import { put, head } from "@vercel/blob";

// Allows this job to run up to 300 seconds (Pro plan limit).
export const config = {
  maxDuration: 300,
};

const STATE_KEY = "refresh-state.json";
const CACHE_KEY = "cores-cache.json";

// How long to work per invocation before saving progress and stopping, leaving buffer
// for the final save + response so we never get killed mid-write.
const BUDGET_MS = 260000;
const SAFETY_MARGIN_MS = 20000;

// Once a full cycle completes, wait this long before starting the next one from scratch.
// Cron can run every few minutes cheaply (it'll just report "idle") without re-doing work.
const REFRESH_INTERVAL_MS = 30 * 60 * 1000;

const VAULT_ADDRESS = "0x1a1d4c5c255635a796ad6f64d16431acb2d37c90";
const RVMODES = ["bike", "car", "horse"];
const STATS_CHUNK_SIZE = 50;
const MAX_RACE_RESULT_PAGES = 2000;

const RACE_TYPE_MAP = {
  wta: "WTA",
  "1v1": "1v1",
  top2: "Top 2",
  top3: "Top 3",
  dblup: "Double Up",
  spin_n_go: "Spin & Go",
};

const CLASS_NAME_MAP = {
  genesis: "Genesis",
  freak: "Freak",
  morphed: "Morph",
  xclass: "X-Class",
};

const FIELD_SIZE_BUCKETS = ["2", "3", "4", "5", "6", "7+"];

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function titleCase(str) {
  if (!str) return null;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function fieldSizeBucket(rgate) {
  const n = Number(rgate);
  if (isNaN(n) || n < 2) return null;
  return n >= 7 ? "7+" : String(n);
}

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
    // No state yet - first ever run.
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

  // If idle, decide whether it's time to start a new full cycle yet.
  if (state.phase === "idle") {
    const last = state.lastFullRunCompletedAt ? new Date(state.lastFullRunCompletedAt).getTime() : 0;
    if (Date.now() - last < REFRESH_INTERVAL_MS) {
      return res.status(200).json({
        status: "idle",
        message: "Cache is still fresh, no refresh needed yet.",
        lastFullRunCompletedAt: state.lastFullRunCompletedAt,
      });
    }
    // Start a fresh cycle.
    state = {
      phase: "vault",
      lastFullRunCompletedAt: state.lastFullRunCompletedAt,
    };
    await saveState(state);
  }

  try {
    // PHASE: vault - fetch the list of cores in the vault (fast, single request)
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

      state.cores = vaultData.result;
      state.hids = state.cores.map((c) => Number(c.hid)).filter((n) => !isNaN(n));
      state.statsByMode = { bike: {}, car: {}, horse: {} };
      state.hstatsCursor = { modeIdx: 0, batchIdx: 0 };
      state.phase = "hstats";
      await saveState(state);
    }

    // PHASE: hstats - career/race-type/distance stats, batched per mode
    if (state.phase === "hstats") {
      const batchesByMode = RVMODES.map((mode) => chunk(state.hids, STATS_CHUNK_SIZE));

      outerHstats:
      for (let modeIdx = state.hstatsCursor.modeIdx; modeIdx < RVMODES.length; modeIdx++) {
        const mode = RVMODES[modeIdx];
        const batches = batchesByMode[modeIdx];
        const startBatchIdx = modeIdx === state.hstatsCursor.modeIdx ? state.hstatsCursor.batchIdx : 0;

        for (let batchIdx = startBatchIdx; batchIdx < batches.length; batchIdx++) {
          if (timeLeft() < SAFETY_MARGIN_MS) {
            state.hstatsCursor = { modeIdx, batchIdx };
            await saveState(state);
            return res.status(200).json({ status: "in_progress", phase: "hstats", modeIdx, batchIdx });
          }

          const batch = batches[batchIdx];
          let statsRes = await fetch("https://api.dnaracing.run/fbike/cores/hstats_doc_bulk", {
            method: "POST",
            headers: authHeaders(API_KEY),
            body: JSON.stringify({ hids: batch, rvmode: mode }),
          });

          if (statsRes.status === 429) {
            await sleep(800);
            statsRes = await fetch("https://api.dnaracing.run/fbike/cores/hstats_doc_bulk", {
              method: "POST",
              headers: authHeaders(API_KEY),
              body: JSON.stringify({ hids: batch, rvmode: mode }),
            });
          }

          if (statsRes.ok) {
            const statsData = await statsRes.json();
            if (statsData && statsData.status === "success" && Array.isArray(statsData.result)) {
              for (const doc of statsData.result) {
                const career = doc?.data?.career;
                if (!career) continue;

                const raceTypes = {};
                const payoutsData = doc?.payouts_data || {};
                for (const rtKey of Object.keys(RACE_TYPE_MAP)) {
                  const rtCareer = payoutsData?.[rtKey]?.career;
                  if (!rtCareer) continue;
                  raceTypes[rtKey] = {
                    label: RACE_TYPE_MAP[rtKey],
                    r: rtCareer.races_n ?? 0,
                    w: rtCareer.win_p != null ? Number((rtCareer.win_p * 100).toFixed(2)) : 0,
                    b: rtCareer.bluestar_p != null ? Number((rtCareer.bluestar_p * 100).toFixed(2)) : 0,
                    y: rtCareer.yellowstar_p != null ? Number((rtCareer.yellowstar_p * 100).toFixed(2)) : 0,
                  };
                }

                const distances = {};
                for (const [key, bucket] of Object.entries(doc?.data || {})) {
                  if (key === "career") continue;
                  const distanceMeters = Number(key) * 100;
                  if (isNaN(distanceMeters) || !bucket) continue;
                  distances[distanceMeters] = {
                    r: bucket.races_n ?? 0,
                    w: bucket.win_p != null ? Number((bucket.win_p * 100).toFixed(2)) : 0,
                    b: bucket.bluestar_p != null ? Number((bucket.bluestar_p * 100).toFixed(2)) : 0,
                    y: bucket.yellowstar_p != null ? Number((bucket.yellowstar_p * 100).toFixed(2)) : 0,
                  };
                }

                state.statsByMode[mode][doc.hid] = {
                  r: career.races_n ?? 0,
                  w: career.win_p != null ? Number((career.win_p * 100).toFixed(2)) : 0,
                  b: career.bluestar_p != null ? Number((career.bluestar_p * 100).toFixed(2)) : 0,
                  y: career.yellowstar_p != null ? Number((career.yellowstar_p * 100).toFixed(2)) : 0,
                  raceTypes,
                  distances,
                };
              }
            }
          }

          await sleep(120);
        }
      }

      state.rawRacesByMode = { bike: {}, car: {}, horse: {} };
      state.raceresultsCursor = { page: 0 };
      state.raceResultsFetched = 0;
      state.pagesFetched = 0;
      state.phase = "raceresults";
      await saveState(state);
    }

    // PHASE: raceresults - paginated full race history
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

        if (gaveUpOnPage) break; // move on to powcard phase with what we have

        state.pagesFetched++;

        if (!Array.isArray(races) || races.length === 0) break; // natural end of history

        for (const rec of races) {
          state.raceResultsFetched++;
          const mode = rec?.rvmode;
          const hid = rec?.hid;
          const bucket = fieldSizeBucket(rec?.rgate);
          const distance = rec?.cb != null && !isNaN(Number(rec.cb)) ? Number(rec.cb) * 100 : null;
          if (!mode || !state.rawRacesByMode[mode] || hid == null) continue;

          if (!state.rawRacesByMode[mode][hid]) state.rawRacesByMode[mode][hid] = [];
          state.rawRacesByMode[mode][hid].push({
            distance,
            fieldSizeBucket: bucket,
            format: rec?.format ?? null,
            payout: rec?.payout ?? null,
            win: rec.pos === 1,
          });
        }

        await sleep(150);
      }

      console.log(`raceresults: fetched ${state.raceResultsFetched} records across ${state.pagesFetched} pages`);

      state.powCardByHid = {};
      state.powcardCursor = { index: 0 };
      state.powcardSucceeded = 0;
      state.powcardFailed = 0;
      state.powcardFailureStatusCounts = {};
      state.phase = "powcard";
      await saveState(state);
    }

    // PHASE: powcard - one core at a time (sequential, so progress is resumable)
    if (state.phase === "powcard") {
      const POWCARD_MAX_RETRIES = 3;
      const POWCARD_RETRY_BASE_DELAY_MS = 400;

      for (let i = state.powcardCursor.index; i < state.hids.length; i++) {
        if (timeLeft() < SAFETY_MARGIN_MS) {
          state.powcardCursor = { index: i };
          await saveState(state);
          return res.status(200).json({ status: "in_progress", phase: "powcard", index: i, total: state.hids.length });
        }

        const hid = state.hids[i];

        for (let attempt = 0; attempt <= POWCARD_MAX_RETRIES; attempt++) {
          try {
            const powRes = await fetch("https://api.dnaracing.run/fbike/i/powcard", {
              method: "POST",
              headers: authHeaders(API_KEY),
              body: JSON.stringify({ hid }),
            });

            if (!powRes.ok) {
              const statusKey = String(powRes.status);
              state.powcardFailureStatusCounts[statusKey] = (state.powcardFailureStatusCounts[statusKey] || 0) + 1;
              if (attempt < POWCARD_MAX_RETRIES) {
                await sleep(POWCARD_RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
                continue;
              }
              state.powcardFailed++;
              break;
            }

            const powData = await powRes.json();
            const powerByMode = powData?.result?.power;
            if (!powerByMode) {
              state.powcardFailed++;
              break;
            }

            state.powCardByHid[hid] = {};
            for (const mode of RVMODES) {
              const m = powerByMode[mode];
              if (!m) continue;
              state.powCardByHid[hid][mode] = {
                power: m?.power?.fill?.per ?? null,
                variance: m?.variance?.fill?.per ?? null,
                adjodds: m?.adjodds?.fill?.per ?? null,
              };
            }
            state.powcardSucceeded++;
            break;
          } catch (err) {
            if (attempt < POWCARD_MAX_RETRIES) {
              await sleep(POWCARD_RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
              continue;
            }
            state.powcardFailed++;
          }
        }

        await sleep(150);
      }

      console.log(`powcard: ${state.powcardSucceeded} succeeded, ${state.powcardFailed} failed`);

      state.phase = "finalize";
      await saveState(state);
    }

    // PHASE: finalize - join everything and write the real cache the dashboard reads
    if (state.phase === "finalize") {
      const className = (type) => CLASS_NAME_MAP[type] || type || null;

      const structuredCores = state.cores.map((c) => {
        const hid = Number(c.hid);
        const cls = className(c.type);
        const element = titleCase(c.element);

        const modes = {};
        for (const mode of RVMODES) {
          const real = state.statsByMode[mode][hid];
          modes[mode] = {
            class: cls,
            element,
            r: real?.r ?? 0,
            w: real?.w ?? 0,
            b: real?.b ?? 0,
            y: real?.y ?? 0,
            raceTypes: real?.raceTypes ?? {},
            distances: real?.distances ?? {},
            races: state.rawRacesByMode[mode][hid] ?? [],
            power: state.powCardByHid[hid]?.[mode]?.power ?? null,
            variance: state.powCardByHid[hid]?.[mode]?.variance ?? null,
            adjodds: state.powCardByHid[hid]?.[mode]?.adjodds ?? null,
          };
        }

        return { hid, name: c.name || `Core #${hid}`, modes };
      });

      const updatedAt = new Date().toISOString();
      const payload = { updatedAt, cores: structuredCores };

      await put(CACHE_KEY, JSON.stringify(payload), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      });

      const finalState = { phase: "idle", lastFullRunCompletedAt: updatedAt };
      await saveState(finalState);

      console.log(`refresh-cores: cycle complete, saved ${structuredCores.length} cores at ${updatedAt}`);

      return res.status(200).json({ status: "complete", updatedAt, coreCount: structuredCores.length });
    }

    // Shouldn't normally reach here, but just in case.
    return res.status(200).json({ status: "in_progress", phase: state.phase });
  } catch (error) {
    console.error("refresh-cores.js error:", error);
    // Save whatever progress we made before the error, so the next run can resume
    // from here instead of starting the whole cycle over.
    try {
      await saveState(state);
    } catch (saveErr) {
      console.error("Additionally failed to save state after error:", saveErr);
    }
    return res.status(500).json({ error: "Failed to refresh core data (partial progress saved, will resume next run)" });
  }
}
