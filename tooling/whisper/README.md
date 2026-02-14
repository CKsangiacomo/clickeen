# Whisper Tooling (Local)

Environment: local

## 1) Setup

```bash
bash tooling/whisper/setup.sh
```

## 2) Put audio in isolated folder

Place your media file in:

`tooling/whisper/inbox/`

## 3) Transcribe file (output stays in same folder)

```bash
tooling/whisper/.venv/bin/python tooling/whisper/transcribe.py \
  --input "tooling/whisper/inbox/your-audio-file.mp3" \
  --model small \
  --language en
```

Outputs:
- `tooling/whisper/inbox/<name>.txt` (plain transcript)
- `tooling/whisper/inbox/<name>.json` (segments + timestamps)

Optional override:

```bash
tooling/whisper/.venv/bin/python tooling/whisper/transcribe.py \
  --input "tooling/whisper/inbox/your-audio-file.mp3" \
  --out-dir "tooling/whisper/out"
```

## Notes
- First run downloads the model.
- `small` is a good quality/speed default.
- For better quality, use `--model medium` or `--model large-v3`.
