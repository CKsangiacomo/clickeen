#!/usr/bin/env python3
import argparse
import json
import os
import sys
from pathlib import Path

from faster_whisper import WhisperModel


def parse_args() -> argparse.Namespace:
  parser = argparse.ArgumentParser(description="Transcribe audio/video file with faster-whisper")
  parser.add_argument("--input", required=True, help="Path to input media file")
  parser.add_argument(
    "--model",
    default="small",
    help="Whisper model name (tiny, base, small, medium, large-v3, distil-large-v3)",
  )
  parser.add_argument("--language", default=None, help="Language code (e.g. en, es, ja). Auto-detect if omitted.")
  parser.add_argument("--task", default="transcribe", choices=["transcribe", "translate"])
  parser.add_argument("--device", default="cpu", help="cpu or cuda")
  parser.add_argument("--compute-type", default="int8", help="int8, float16, float32")
  parser.add_argument("--beam-size", type=int, default=5)
  parser.add_argument(
    "--out-dir",
    default=None,
    help="Output directory (defaults to the input file directory)",
  )
  parser.add_argument("--name", default=None, help="Output basename (defaults to input filename stem)")
  return parser.parse_args()


def main() -> int:
  args = parse_args()
  input_path = Path(args.input).expanduser().resolve()
  if not input_path.exists():
    print(f"[whisper] input not found: {input_path}", file=sys.stderr)
    return 1

  out_dir = Path(args.out_dir).resolve() if args.out_dir else input_path.parent
  out_dir.mkdir(parents=True, exist_ok=True)
  base_name = args.name or input_path.stem

  model = WhisperModel(args.model, device=args.device, compute_type=args.compute_type)
  segments, info = model.transcribe(
    str(input_path),
    language=args.language,
    task=args.task,
    beam_size=args.beam_size,
    vad_filter=True,
  )

  rows = []
  text_parts = []
  for seg in segments:
    segment_text = seg.text.strip()
    rows.append(
      {
        "start": seg.start,
        "end": seg.end,
        "text": segment_text,
      }
    )
    if segment_text:
      text_parts.append(segment_text)

  transcript_text = "\n".join(text_parts).strip()
  txt_path = out_dir / f"{base_name}.txt"
  json_path = out_dir / f"{base_name}.json"

  with txt_path.open("w", encoding="utf-8") as f:
    f.write(transcript_text)
    f.write("\n")

  payload = {
    "input": str(input_path),
    "model": args.model,
    "task": args.task,
    "language": info.language,
    "language_probability": info.language_probability,
    "segments": rows,
    "text": transcript_text,
  }
  with json_path.open("w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)
    f.write("\n")

  print(f"[whisper] text: {txt_path}")
  print(f"[whisper] json: {json_path}")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
