# SPDX-License-Identifier: GPL-3.0-only
# Reverie (dsh-reverie) — Copyright (C) 2026 Ag (https://github.com/Gniy7Ga)
"""
Speech-to-text worker for dsh-reverie.

Usage: python asr_worker.py '<json options>'
  options: {"engine": "mlx" | "faster-whisper", "audio": path, "model": path-or-name,
            "language": optional ISO code, "chunk_seconds": 300, "output": path}

Prints progress lines to stdout:  PROGRESS {"done": i, "total": n}
Writes {"language": ..., "segments": [{"start", "end", "text"}]} to options.output.
"""
import json
import os
import sys
import time


ZH_PROMPT = "以下是普通话的对话，使用简体中文，并带有标点符号。"


def emit(kind, payload):
    print(f"{kind} {json.dumps(payload, ensure_ascii=False)}", flush=True)


def run_mlx(opts):
    import mlx.core as mx
    import mlx_whisper
    from mlx_whisper.audio import load_audio

    if mx.metal.is_available():
        mx.set_default_device(mx.gpu)
    audio = load_audio(opts["audio"])
    rate = 16000
    span = int(opts.get("chunk_seconds", 300)) * rate
    total = max(1, (len(audio) + span - 1) // span)
    language = opts.get("language")
    segments = []
    emit("PROGRESS", {"done": 0, "total": total, "seconds": len(audio) / rate})
    for index in range(total):
        piece = audio[index * span:min((index + 1) * span, len(audio))]
        if len(piece) < rate // 2:
            emit("PROGRESS", {"done": index + 1, "total": total})
            continue
        def transcribe(lang):
            return mlx_whisper.transcribe(
                piece,
                path_or_hf_repo=opts["model"],
                language=lang,
                verbose=None,
                condition_on_previous_text=False,
                temperature=(0.0, 0.2, 0.4),
                compression_ratio_threshold=2.3,
                no_speech_threshold=0.7,
                # Chinese speech: bias towards simplified characters with punctuation.
                initial_prompt=ZH_PROMPT if lang == "zh" else None,
            )
        result = transcribe(language)
        if not language:
            language = result.get("language")
            if language == "zh":
                result = transcribe("zh")
        offset = index * span / rate
        for seg in result.get("segments", []):
            text = (seg.get("text") or "").strip()
            if text:
                segments.append({"start": round(seg["start"] + offset, 2), "end": round(seg["end"] + offset, 2), "text": text})
        emit("PROGRESS", {"done": index + 1, "total": total})
    return {"language": language, "segments": segments}


def run_faster_whisper(opts):
    from faster_whisper import WhisperModel

    model = WhisperModel(opts.get("model") or "large-v3", device="cpu", compute_type="int8")
    segments_iter, info = model.transcribe(
        opts["audio"], language=opts.get("language"), beam_size=5, vad_filter=True,
        condition_on_previous_text=False, initial_prompt=ZH_PROMPT if opts.get("language") == "zh" else None,
    )
    duration = float(getattr(info, "duration", 0) or 0)
    total = 100
    emit("PROGRESS", {"done": 0, "total": total, "seconds": duration})
    segments = []
    last = 0
    for seg in segments_iter:
        text = (seg.text or "").strip()
        if text:
            segments.append({"start": round(seg.start, 2), "end": round(seg.end, 2), "text": text})
        if duration:
            done = min(total - 1, int(seg.end / duration * total))
            if done > last:
                last = done
                emit("PROGRESS", {"done": done, "total": total})
    emit("PROGRESS", {"done": total, "total": total})
    return {"language": info.language, "segments": segments}


def main():
    opts = json.loads(sys.argv[1])
    started = time.monotonic()
    engine = opts.get("engine", "mlx")
    result = run_mlx(opts) if engine == "mlx" else run_faster_whisper(opts)
    result["engine"] = engine
    result["elapsed"] = round(time.monotonic() - started, 1)
    tmp = opts["output"] + ".tmp"
    with open(tmp, "w", encoding="utf-8") as handle:
        json.dump(result, handle, ensure_ascii=False)
    os.replace(tmp, opts["output"])
    emit("DONE", {"segments": len(result["segments"]), "language": result["language"], "elapsed": result["elapsed"]})


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # report a readable error to the host
        emit("ERROR", {"message": f"{type(error).__name__}: {error}"})
        sys.exit(1)
