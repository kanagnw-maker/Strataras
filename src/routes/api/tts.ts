import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const Schema = z.object({
  text: z.string().min(1).max(2000),
  lang: z.string().min(2).max(5).optional(),
});

const STRATARAS_VOICE_ID = "e3S6J33bcUViS87gEr8J";

// Defaults — used as fallback if DB row missing.
const DEFAULTS = {
  voice_id: STRATARAS_VOICE_ID,
  model_id: "eleven_turbo_v2_5",
  stability: 0.45,
  similarity_boost: 0.8,
  style: 0.35,
  use_speaker_boost: true,
  speed: 1.0,
};

async function loadVoiceConfig() {
  try {
    const { data } = await supabaseAdmin
      .from("restaurant_settings")
      .select("value")
      .eq("key", "voice")
      .maybeSingle();
    const v = (data?.value ?? {}) as Partial<typeof DEFAULTS>;
    return { ...DEFAULTS, ...v };
  } catch (e) {
    console.error("Failed to load voice config:", e);
    return DEFAULTS;
  }
}

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Streaming-friendly endpoint: <audio src="/api/tts?text=...&lang=el">
        // works on mobile because the browser streams MP3 bytes natively
        // instead of waiting for blob() to complete.
        const url = new URL(request.url);
        const text = url.searchParams.get("text") ?? "";
        const lang = url.searchParams.get("lang") ?? undefined;

        const apiKey = process.env.ELEVENLABS_API_KEY;
        if (!apiKey) return new Response("TTS not configured", { status: 503 });

        const parsed = Schema.safeParse({ text, lang });
        if (!parsed.success) return new Response("Invalid input", { status: 400 });

        const cfg = await loadVoiceConfig();
        const LANG_CODE: Record<string, string> = {
          el: "el", en: "en", de: "de", fr: "fr", es: "es", tr: "tr",
        };
        const langCode = parsed.data.lang ? LANG_CODE[parsed.data.lang.slice(0, 2)] : undefined;

        const res = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${cfg.voice_id}/stream?output_format=mp3_44100_128&optimize_streaming_latency=3`,
          {
            method: "POST",
            headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
            body: JSON.stringify({
              text: parsed.data.text,
              model_id: cfg.model_id,
              ...(langCode ? { language_code: langCode } : {}),
              voice_settings: {
                stability: cfg.stability,
                similarity_boost: cfg.similarity_boost,
                style: cfg.style,
                use_speaker_boost: cfg.use_speaker_boost,
                speed: cfg.speed,
              },
            }),
          },
        );

        if (!res.ok) {
          const errText = await res.text();
          console.error("ElevenLabs TTS error:", res.status, errText);
          return new Response(`TTS failed (${res.status})`, { status: 502 });
        }

        return new Response(res.body, {
          status: 200,
          headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "private, max-age=300",
            "Accept-Ranges": "bytes",
          },
        });
      },
      POST: async ({ request }) => {
        const apiKey = process.env.ELEVENLABS_API_KEY;
        if (!apiKey) {
          return new Response(JSON.stringify({ error: "TTS not configured" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          });
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const parsed = Schema.safeParse(body);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: "Invalid input" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Voice config is server-controlled only — no client overrides allowed,
        // so the configured voice (Stratáras) is always used.
        const cfg = await loadVoiceConfig();

        // Map app lang -> ElevenLabs ISO code. Locks pronunciation language so
        // the model doesn't auto-detect differently per chunk (which causes
        // mixed-language output across consecutive requests).
        const LANG_CODE: Record<string, string> = {
          el: "el", en: "en", de: "de", fr: "fr", es: "es", tr: "tr",
        };
        const langCode = parsed.data.lang ? LANG_CODE[parsed.data.lang.slice(0, 2)] : undefined;

        const res = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${cfg.voice_id}/stream?output_format=mp3_44100_128`,
          {
            method: "POST",
            headers: {
              "xi-api-key": apiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text: parsed.data.text,
              model_id: cfg.model_id,
              ...(langCode ? { language_code: langCode } : {}),
              voice_settings: {
                stability: cfg.stability,
                similarity_boost: cfg.similarity_boost,
                style: cfg.style,
                use_speaker_boost: cfg.use_speaker_boost,
                speed: cfg.speed,
              },
            }),
          },
        );

        if (!res.ok) {
          const errText = await res.text();
          console.error("ElevenLabs TTS error:", res.status, errText);
          return new Response(
            JSON.stringify({ error: `TTS failed (${res.status})` }),
            { status: 502, headers: { "Content-Type": "application/json" } },
          );
        }

        return new Response(res.body, {
          status: 200,
          headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "private, max-age=300",
          },
        });
      },
    },
  },
});