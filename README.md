# stemit

> Separate any song into its stems — vocals, drums, bass, guitar, piano, and more.
> Analyze BPM & musical key. Mute or solo any instrument. Works with YouTube URLs or local files.

```
      _                 _ _
  ___| |_ ___ _ __ ___ (_) |_
 / __| __/ _ \ '_ ` _ \| | __|
 \__ \ ||  __/ | | | | | | |_
 |___/\__\___|_| |_| |_|_|\__|
  stem separator · BPM · key · mix
```

---

## Table of Contents

- [stemit](#stemit)
  - [Table of Contents](#table-of-contents)
  - [What it does](#what-it-does)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
    - [Using npx (no install required)](#using-npx-no-install-required)
    - [Global install](#global-install)
    - [Local install (in a project)](#local-install-in-a-project)
  - [Quick Start](#quick-start)
  - [Usage](#usage)
    - [Basic split](#basic-split)
    - [6-stem split (guitar + piano)](#6-stem-split-guitar--piano)
    - [Mute a stem](#mute-a-stem)
    - [Solo a stem](#solo-a-stem)
    - [Export as MP3](#export-as-mp3)
    - [Skip BPM/key analysis](#skip-bpmkey-analysis)
    - [All options](#all-options)
  - [Available Models](#available-models)
  - [Separation Accuracy](#separation-accuracy)
  - [Output Structure](#output-structure)
  - [How It Works](#how-it-works)
  - [First-Run Setup](#first-run-setup)
  - [Troubleshooting](#troubleshooting)
    - [`demucs exited with code 1`](#demucs-exited-with-code-1)
    - [`ImportError: TorchCodec is required`](#importerror-torchcodec-is-required)
    - [`ffmpeg not found`](#ffmpeg-not-found)
    - [`python3 not found` / `python not found`](#python3-not-found--python-not-found)
    - [Progress bar cycles multiple times](#progress-bar-cycles-multiple-times)
    - [Slow processing](#slow-processing)
    - [Resetting the venv](#resetting-the-venv)
  - [License](#license)

---

## What it does

`stemit` takes a song (from a YouTube URL or a local audio file) and:

1. **Downloads** it via `yt-dlp` if you pass a URL
2. **Separates** it into individual instrument stems using [Demucs](https://github.com/facebookresearch/demucs) (Facebook Research's state-of-the-art source separation model)
3. **Analyzes** the BPM and musical key of the result
4. **Mixes** stems back together with specific instruments muted or soloed
5. **Exports** everything as WAV or MP3

You get back clean, studio-quality isolated tracks you can drop straight into your DAW.

---

## Prerequisites

stemit requires two system-level dependencies. Everything else (including Demucs itself) is installed automatically on first run.

| Dependency | Minimum Version | Install |
|---|---|---|
| **Node.js** | 18+ | https://nodejs.org |
| **Python** | 3.9+ | https://www.python.org/downloads/ |
| **ffmpeg** | any | `brew install ffmpeg` / `sudo apt install ffmpeg` / `winget install ffmpeg` |

> **Note:** Demucs (the AI model) and all Python dependencies are installed automatically into a private virtualenv at `~/.stemit/venv` the first time you run any `stemit` command. You do not need to `pip install` anything yourself.

> **System requirements disclaimer:** stemit depends on local CPU performance, OS audio tooling, network reliability (for URL downloads), and third-party binaries (`ffmpeg`, Python packages, model downloads). Performance and output quality can vary across machines and environments.
>
> If you run into setup issues, command failures, or unexpected output, please open an issue with your OS, Node/Python versions, command used, and error logs so i can help quickly.

---

## Installation

### Using npx (no install required)

```bash
npx stemit-cli split "https://www.youtube.com/watch?v=..."
```

### Global install

```bash
npm install -g stemit-cli
stemit split "https://www.youtube.com/watch?v=..."
```

### Local install (in a project)

```bash
npm install stemit-cli
npx stemit split ./my-song.wav
```

---

## Quick Start

```bash
# Split a YouTube video into stems
stemit split "https://www.youtube.com/watch?v=oTS0LLXaLF0"

# Split a local file
stemit split ./my-song.wav

# Get 6 stems (adds guitar + piano)
stemit split ./my-song.wav --model htdemucs_6s

# Produce an instrumental (no vocals)
stemit split ./my-song.wav --mute vocals

# Isolate just the drums
stemit split ./my-song.wav --solo drums

# Export everything as MP3
stemit split ./my-song.wav --format mp3
```

---

## Usage

### Basic split

```bash
stemit split <input> [options]
```

`<input>` can be:
- A **YouTube URL** — `stemit split "https://www.youtube.com/watch?v=..."`
- A **local file path** — `stemit split ./song.wav` or `stemit split ./song.mp3`

The command will:
1. Check dependencies (and auto-install Demucs if needed)
2. Download the audio if a URL was provided
3. Run Demucs stem separation with a live progress bar
4. Analyze BPM and key of the result
5. Print a summary box with all output file paths

---

### 6-stem split (guitar + piano)

The `htdemucs_6s` model separates 6 instruments instead of the default 4, adding `guitar` and `piano` tracks:

```bash
stemit split ./my-song.wav --model htdemucs_6s
```

Output stems: `vocals`, `drums`, `bass`, `guitar`, `piano`, `other`

> **Caveat:** This model works best on Western pop/rock. For songs without guitar or piano those tracks will be mostly silent, and their content stays in `other`.

---

### Mute a stem

Muting removes one instrument and mixes the rest back together. Useful for creating instrumentals or karaoke tracks.

```bash
# Remove vocals → instrumental
stemit split ./my-song.wav --mute vocals

# Remove drums → no-drums mix
stemit split ./my-song.wav --mute drums
```

Valid values: `vocals`, `drums`, `bass`, `guitar`, `piano`, `other`

The mixed output is saved as `mute-<stem>.wav` inside the song's stem folder, alongside the individual stem files.

---

### Solo a stem

Soloing keeps only one instrument and discards the rest. No mixing needed — the file is simply copied.

```bash
# Isolate only vocals
stemit split ./my-song.wav --solo vocals

# Isolate only drums
stemit split ./my-song.wav --solo drums
```

Valid values: `vocals`, `drums`, `bass`, `guitar`, `piano`, `other`

The output is saved as `solo-<stem>.wav` inside the song's stem folder.

---

### Export as MP3

By default all output files are WAV. Pass `--format mp3` to convert everything to MP3 after splitting:

```bash
stemit split ./my-song.wav --format mp3
```

This converts all stem files (and the mixed output, if `--mute` or `--solo` was used) to MP3 using `ffmpeg` at variable bitrate (`-q:a 0`, highest quality).

---

### Skip BPM/key analysis

BPM and key detection uses [essentia.js](https://mtg.github.io/essentia.js/) (WASM) and adds a few seconds. Skip it with `--no-analyze`:

```bash
stemit split ./my-song.wav --no-analyze
```

---

### All options

```
stemit split <input> [options]

Options:
  --model <name>   Demucs model to use (default: "htdemucs_ft")
                   htdemucs | htdemucs_ft | htdemucs_6s | mdx | mdx_extra | mdx_extra_q
  --out <dir>      Output directory (default: "./stemit-output")
  --mute <stem>    Mute one stem and mix the rest (vocals|drums|bass|guitar|piano|other)
  --solo <stem>    Keep only one stem (vocals|drums|bass|guitar|piano|other)
  --format <fmt>   Output format: wav or mp3 (default: "wav")
  --no-analyze     Skip BPM and key detection
  -h, --help       Show help
  -V, --version    Show version
```

---

## Available Models

| Model | Stems | Notes |
|---|---|---|
| `htdemucs_ft` | vocals, drums, bass, other | **Default.** Fine-tuned hybrid transformer — best quality for 4 stems |
| `htdemucs` | vocals, drums, bass, other | Slightly faster than `_ft`, marginally lower quality |
| `htdemucs_6s` | vocals, drums, bass, **guitar, piano**, other | 6-stem model — adds guitar and piano separation |
| `mdx_extra` | vocals, drums, bass, other | Alternative architecture, good for vocals |
| `mdx` | vocals, drums, bass, other | Faster MDX variant |
| `mdx_extra_q` | vocals, drums, bass, other | Quantized MDX — smallest model, fastest inference |

**Which model should I use?**

- Default (`htdemucs_ft`) — best all-round quality, use this unless you have a reason not to
- `htdemucs_6s` — when you specifically need guitar or piano isolated
- `mdx_extra` — when vocals quality is the priority
- `mdx_extra_q` — when speed matters more than quality (e.g. batch processing)

**Speed note:** Demucs runs on CPU by default. Processing time is roughly **2–5× the song length** on modern hardware (e.g. a 4-minute song takes 8–20 minutes). The `mdx_extra_q` model is significantly faster.

---

## Separation Accuracy

stemit uses [Demucs](https://github.com/facebookresearch/demucs) — one of the highest-rated open-source source separation models, consistently ranking at the top of the [Music Demixing Challenge](https://mdx-workshop.github.io/) leaderboards.

**What to expect:**

| Genre / Instrument | Typical Quality |
|---|---|
| Vocals (pop/rock) | Excellent — clean isolation with minimal bleed |
| Drums | Very good — kick, snare, and cymbals well preserved |
| Bass | Good — works best when bass is prominent in the mix |
| Guitar / Piano (`htdemucs_6s`) | Moderate — depends heavily on how prominent the instrument is |
| Electronic / heavily layered music | Lower — harder to separate tightly mixed synths |
| Vocals (rap/spoken word) | Good — works well when vocals are dry or lightly processed |

**Factors that affect quality:**

- **Production style** — heavily compressed or layered mixes are harder to separate
- **Frequency overlap** — instruments sharing the same frequency range (e.g. bass guitar and kick drum) bleed into each other
- **Reverb / effects** — wet, heavily reverbed sources are harder to isolate cleanly
- **Model choice** — `htdemucs_ft` gives the best overall quality; `mdx_extra` is specifically tuned for vocals

**Benchmark scores (SDR — Signal-to-Distortion Ratio, higher is better):**

The `htdemucs_ft` model achieves approximately:

| Stem | SDR |
|---|---|
| Vocals | ~8.4 dB |
| Drums | ~8.6 dB |
| Bass | ~8.8 dB |
| Other | ~5.8 dB |

> SDR is a standard metric for source separation. Scores above 6 dB are considered good; above 8 dB is excellent. For reference, an SDR of 0 means the output is no better than silence.

These scores are competitive with commercial stem separation tools and are state-of-the-art for open-source models. Results on real-world music may vary.

---

## Output Structure

```
stemit-output/
└── htdemucs_ft/
    └── My Song Title/
        ├── vocals.wav
        ├── drums.wav
        ├── bass.wav
        ├── other.wav
        ├── mute-vocals.wav     ← produced when --mute vocals is used
        └── solo-drums.wav      ← produced when --solo drums is used
```

All files are grouped under `--out/<model>/<song-name>/` (default: `./stemit-output`).

---

## How It Works

```
┌─────────────┐    yt-dlp      ┌────────────┐
│  YouTube URL │ ─────────────▶ │  audio.wav │
└─────────────┘                └─────┬──────┘
                                     │
                 local file ─────────┘
                                     │
                                     ▼
                          ┌─────────────────────┐
                          │   Demucs (Python)    │
                          │   htdemucs_ft model  │
                          │   ~/.stemit/venv     │
                          └──────────┬──────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              ▼          ▼           ▼           ▼           ▼
         vocals.wav  drums.wav   bass.wav   guitar.wav  other.wav
              │
              ▼
   ┌─────────────────────┐
   │   essentia.js WASM  │
   │   BPM + Key detect  │
   └─────────────────────┘

  optional:
   stems ──▶ ffmpeg amix ──▶ mute-vocals.wav
   stems ──▶ ffmpeg copy ──▶ solo-drums.wav
   *.wav  ──▶ ffmpeg      ──▶ *.mp3
```

**Tech stack:**

| Component | Library | Notes |
|---|---|---|
| CLI framework | [commander](https://github.com/tj/commander.js) | Parses flags and subcommands |
| YouTube download | [youtube-dl-exec](https://github.com/microlinkhq/youtube-dl-exec) | Wraps yt-dlp, auto-downloads binary |
| Stem separation | [Demucs](https://github.com/facebookresearch/demucs) via `child_process.spawn` | Runs in managed Python venv |
| Stem mixing | ffmpeg `amix` filter | `normalize=0` to preserve volume |
| BPM + Key | [essentia.js](https://mtg.github.io/essentia.js/) | WASM, runs in Node |
| Audio decode | [audio-decode](https://github.com/audiojs/audio-decode) | Decodes WAV/MP3 to float32 for essentia |
| WAV→MP3 | ffmpeg | `-q:a 0` (VBR highest quality) |
| Progress bars | [cli-progress](https://github.com/npkgjs/cli-progress) | Live chunk-by-chunk demucs progress |
| Spinners | [ora](https://github.com/sindresorhus/ora) | Per-step feedback |
| Summary panel | [boxen](https://github.com/sindresorhus/boxen) + [chalk](https://github.com/chalk/chalk) | Formatted terminal output |
| ASCII banner | [figlet](https://github.com/patorjk/figlet.js) | Startup art |

---

## First-Run Setup

The first time you run `stemit split`, it will:

1. Verify Python 3.9+ and ffmpeg are installed
2. Create a Python virtualenv at `~/.stemit/venv`
3. Install Demucs and its dependencies into that venv (`pip install demucs soundfile torchcodec`)

This one-time setup takes **2–5 minutes** depending on your internet connection (Demucs pulls in PyTorch, which is a large download). After that, the venv is reused on every run.

The AI model weights (~300 MB per model) are downloaded by Demucs on first use of each model and cached in `~/.cache/torch/hub/`.

---

## Troubleshooting

### `demucs exited with code 1`

Run with a local file first to rule out download issues. The full Demucs error is printed below the message. Common causes:

- **Out of memory** — Demucs needs ~4 GB RAM for `htdemucs_ft`. Try `--model mdx_extra_q` which is lighter.
- **Corrupt audio file** — ensure the file plays correctly before passing it to stemit.
- **Python version conflict** — stemit uses its own venv at `~/.stemit/venv`, but if you see import errors, try deleting the venv and re-running: `rm -rf ~/.stemit/venv`

### `ImportError: TorchCodec is required`

This happens with `torchaudio >= 2.5` on a fresh install if `torchcodec` wasn't installed. stemit handles this automatically during setup, but if you hit it manually:

```bash
~/.stemit/venv/bin/pip install torchcodec
```

### `ffmpeg not found`

Install ffmpeg for your platform:

- **macOS:** `brew install ffmpeg`
- **Linux:** `sudo apt install ffmpeg`
- **Windows:** `winget install ffmpeg`

### `python3 not found` / `python not found`

Install Python 3.9+ from https://www.python.org/downloads/ and ensure it's on your PATH.

On Windows, the installer adds `python` (not `python3`) to PATH — stemit checks both.

### Progress bar cycles multiple times

This is normal. Demucs splits audio into overlapping chunks and processes them sequentially. Each chunk shows its own 0→100% progress. The label shows `chunk N/M` so you can track overall progress.

### Slow processing

Demucs runs on CPU by default — this is expected. A 4-minute song takes 8–20 minutes on modern hardware. There is no GPU acceleration option in stemit currently (Demucs supports CUDA if you have an NVIDIA GPU and install the CUDA version of PyTorch manually into `~/.stemit/venv`).

### Resetting the venv

If something goes wrong with the Python environment, delete the venv and re-run:

```bash
rm -rf ~/.stemit/venv
stemit split ./any-file.wav
```

This re-creates the venv and re-installs Demucs from scratch.

---

## License

MIT © saravanaraja25
