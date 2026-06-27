const BASE_URL = "https://gen.pollinations.ai";

const SEED_MODELS = new Set(["flux", "zimage", "seedream", "seedream5", "klein"]);
const QUALITY_MODELS = new Set(["gptimage", "gptimage-large", "gpt-image-2"]);
const FALLBACK_CHAIN = ["zimage", "klein", "flux", "gptimage"];

function clampNumber(value, min, max, fallback){
  const n = Number(value);
  if(!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function normalizeModel(model){
  const m = String(model || "zimage").trim().toLowerCase();
  const aliases = {
    "flux-schnell": "flux",
    "flux schnell": "flux",
    "flux.1 schnell": "flux",
    "flux.1 kontext": "kontext",
    "flux kontext": "kontext",
    "flux.2 klein 4b": "klein",
    "flux 2 klein 4b": "klein",
    "z-image": "zimage"
  };
  return aliases[m] || m || "zimage";
}

function squeezePrompt(prompt, model){
  let text = String(prompt || "")
    .replace(/\s+/g, " ")
    .replace(/Negative prompt:/gi, ". Avoid:")
    .trim();

  // Fireworks/FLUX can crash on overlong prompts. Keep the magic, cut the fog.
  const hardLimit = ["flux", "klein", "zimage", "kontext"].includes(model) ? 1450 : 2800;
  if(text.length <= hardLimit) return text;

  const pieces = text
    .split(/[,.;|]+/)
    .map(x => x.trim())
    .filter(Boolean);

  const seen = new Set();
  const keep = [];
  let total = 0;

  for(const p of pieces){
    const key = p.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if(!key || seen.has(key)) continue;
    seen.add(key);
    const next = (keep.length ? ", " : "") + p;
    if(total + next.length > hardLimit - 120) break;
    keep.push(p);
    total += next.length;
  }

  const ending = "masterpiece, sharp focus, professional composition, high detail";
  return `${keep.join(", ")}, ${ending}`.slice(0, hardLimit);
}

function safeDimensions(width, height, model){
  let w = clampNumber(width, 256, 2048, 1024);
  let h = clampNumber(height, 256, 2048, 1024);

  const ratio = w / h;
  const strict = ["flux", "klein", "zimage", "kontext"].includes(model);

  // Provider-safe canvas. 1080x1920 can randomly fail on some FLUX providers.
  const maxArea = strict ? 1048576 : 1572864; // ~1MP or ~1.5MP
  const maxSide = strict ? 1536 : 2048;

  if(w * h > maxArea || Math.max(w, h) > maxSide){
    const scale = Math.min(Math.sqrt(maxArea / (w * h)), maxSide / Math.max(w, h));
    w = Math.floor(w * scale);
    h = Math.floor(h * scale);
  }

  // Diffusion providers are happier with multiples of 64.
  w = Math.max(256, Math.round(w / 64) * 64);
  h = Math.max(256, Math.round(h / 64) * 64);

  // Preserve common social ratios after rounding.
  if(ratio < 0.6){ w = 768; h = 1344; }       // 9:16 portrait safe
  else if(ratio > 1.65){ w = 1344; h = 768; } // 16:9 landscape safe
  else if(Math.abs(ratio - 1) < 0.08){ w = 1024; h = 1024; }

  return { width: w, height: h };
}

function buildCandidates(selectedModel){
  const first = normalizeModel(selectedModel);
  const chain = [first, ...FALLBACK_CHAIN].filter(Boolean);
  return [...new Set(chain)];
}

async function requestGetImage({prompt, model, width, height, seed, safe, quality, apiKey}){
  const params = new URLSearchParams({
    model,
    width: String(width),
    height: String(height)
  });

  if(SEED_MODELS.has(model)) params.set("seed", String(seed));
  if(QUALITY_MODELS.has(model)) params.set("quality", quality);
  if(safe) params.set("safe", "privacy,secrets");

  const url = `${BASE_URL}/image/${encodeURIComponent(prompt)}?${params.toString()}`;
  return fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "image/png,image/jpeg,image/webp,*/*"
    },
    cache: "no-store"
  });
}

async function requestOpenAIImage({prompt, model, width, height, safe, quality, apiKey}){
  return fetch(`${BASE_URL}/v1/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      prompt,
      model,
      n: 1,
      size: `${width}x${height}`,
      quality: QUALITY_MODELS.has(model) ? quality : "medium",
      response_format: "b64_json",
      safe: safe ? "privacy,secrets" : false,
      user: "vaia-ai-studio"
    })
  });
}

async function imageFromOpenAIResponse(upstream){
  const data = await upstream.json();
  const item = data?.data?.[0] || {};
  const b64 = item.b64_json || item.b64 || data.b64_json || "";
  const imageUrl = item.url || data.url || "";

  if(b64){
    const clean = String(b64).replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, "");
    return { buffer: Buffer.from(clean, "base64"), contentType: "image/png" };
  }

  if(imageUrl){
    const img = await fetch(imageUrl, { cache: "no-store" });
    if(!img.ok) throw new Error("URL gambar dari Pollinations gagal diambil.");
    return {
      buffer: Buffer.from(await img.arrayBuffer()),
      contentType: img.headers.get("content-type") || "image/png"
    };
  }

  throw new Error("Pollinations tidak mengembalikan data gambar.");
}

function jsonError(res, status, message, debug){
  return res.status(status).json({
    error: message,
    debug: debug ? String(debug).slice(0, 900) : undefined
  });
}

export default async function handler(req, res){
  if(req.method !== "POST"){
    res.setHeader("Allow", "POST");
    return jsonError(res, 405, "Method not allowed. Use POST.");
  }

  const apiKey = process.env.POLLINATIONS_API_KEY;
  if(!apiKey){
    return jsonError(res, 500, "POLLINATIONS_API_KEY belum diatur di Vercel Environment Variables.");
  }

  try{
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const selectedModel = normalizeModel(body.model || "zimage");
    const safe = Boolean(body.safe);
    const quality = String(body.quality || "medium").trim();
    const seed = clampNumber(body.seed, -1, 2147483647, -1);

    if(!String(body.prompt || "").trim()){
      return jsonError(res, 400, "Prompt kosong.");
    }

    const attempts = [];
    const candidates = buildCandidates(selectedModel);

    for(const model of candidates){
      const prompt = squeezePrompt(body.prompt, model);
      const dims = safeDimensions(body.width, body.height, model);

      try{
        let upstream = await requestGetImage({
          prompt,
          model,
          width: dims.width,
          height: dims.height,
          seed,
          safe,
          quality,
          apiKey
        });

        let contentType = upstream.headers.get("content-type") || "";

        if(upstream.ok && contentType.startsWith("image/")){
          const buffer = Buffer.from(await upstream.arrayBuffer());
          res.setHeader("Content-Type", contentType);
          res.setHeader("Cache-Control", "no-store");
          res.setHeader("X-Content-Type-Options", "nosniff");
          res.setHeader("X-VAIA-Model-Used", model);
          res.setHeader("X-VAIA-Size-Used", `${dims.width}x${dims.height}`);
          return res.status(200).send(buffer);
        }

        const getError = await upstream.text().catch(() => "");
        attempts.push(`${model} GET ${upstream.status}: ${getError.slice(0, 260)}`);

        upstream = await requestOpenAIImage({
          prompt,
          model,
          width: dims.width,
          height: dims.height,
          safe,
          quality,
          apiKey
        });

        contentType = upstream.headers.get("content-type") || "";

        if(upstream.ok && contentType.includes("application/json")){
          const img = await imageFromOpenAIResponse(upstream);
          res.setHeader("Content-Type", img.contentType);
          res.setHeader("Cache-Control", "no-store");
          res.setHeader("X-Content-Type-Options", "nosniff");
          res.setHeader("X-VAIA-Model-Used", model);
          res.setHeader("X-VAIA-Size-Used", `${dims.width}x${dims.height}`);
          return res.status(200).send(img.buffer);
        }

        const postError = await upstream.text().catch(() => "");
        attempts.push(`${model} POST ${upstream.status}: ${postError.slice(0, 260)}`);
      }catch(err){
        attempts.push(`${model}: ${err.message || err}`);
      }
    }

    return jsonError(
      res,
      502,
      "Semua model fallback gagal. Coba prompt lebih pendek, ratio 1:1 atau 9:16 HD, dan pilih model zimage/klein.",
      attempts.join(" | ")
    );
  }catch(err){
    return jsonError(res, 500, err?.message || "Server error.");
  }
}
