"""
cli.py
──────
Terminal interface for Personal AI Tutor.

Uses the SAME engine as the web UI (engine.generate_tutor_response), so
answers, language detection, quizzes and memory behave identically.

By default everything stays local: only your Ollama model is contacted.
Audio is OFF unless you ask for it with --audio, because audio generation
uses an online voice service (Murf, or gTTS as a fallback).

Usage (run from the backend/ folder):

    python cli.py                          # interactive chat
    python cli.py ask "What is gravity?"   # one-shot question
    python cli.py ask "..." --json         # machine-readable output
    python cli.py chat --audio             # also save spoken audio
    python cli.py chat --voice             # speak your question (optional dep)
"""

import argparse
import base64
import contextlib
import json
import os
import sys
import time

# Windows terminals often default to a legacy code page; force UTF-8 so
# Hindi / Marathi text prints correctly.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8")
    except Exception:
        pass

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from engine import generate_tutor_response, MODEL, OLLAMA_URL
from memory import add_message

SESSION_ID = "cli"

# ── Tiny colour helper (no dependency; disabled when not a TTY) ───────────────
_USE_COLOR = sys.stdout.isatty() and os.getenv("NO_COLOR") is None


def _c(text: str, code: str) -> str:
    return f"\033[{code}m{text}\033[0m" if _USE_COLOR else text


def bold(t):   return _c(t, "1")
def dim(t):    return _c(t, "2")
def cyan(t):   return _c(t, "36")
def green(t):  return _c(t, "32")
def yellow(t): return _c(t, "33")
def red(t):    return _c(t, "31")


HELP_TEXT = f"""\
{bold("Commands")}
  /help      show this help
  /quiz      show the quiz again for the last answer
  /clear     forget the conversation so far
  /audio     toggle saving audio on/off
  /exit      quit  (Ctrl+D or Ctrl+C also works)

Anything else you type is sent to the tutor as a question.
You can write in English, Hindi or Marathi."""


# ── Optional: audio ───────────────────────────────────────────────────────────
def save_audio(text: str, lang: str, out_dir: str = "cli_audio") -> str | None:
    """Generate speech and save it to a file. Returns the path, or None."""
    try:
        from murf_service import generate_voice
    except Exception as e:  # pragma: no cover
        print(yellow(f"Audio unavailable: {e}"))
        return None

    result = generate_voice(text=text, lang=lang)
    os.makedirs(out_dir, exist_ok=True)
    stamp = time.strftime("%Y%m%d-%H%M%S")
    path = os.path.join(out_dir, f"answer-{stamp}.mp3")

    if result.get("audio_b64"):
        with open(path, "wb") as f:
            f.write(base64.b64decode(result["audio_b64"]))
        return path

    if result.get("audio_url"):
        import requests
        r = requests.get(result["audio_url"], timeout=30)
        r.raise_for_status()
        with open(path, "wb") as f:
            f.write(r.content)
        return path

    print(yellow(f"Audio failed: {result.get('error', 'unknown error')}"))
    return None


# ── Optional: voice input ─────────────────────────────────────────────────────
def listen() -> str | None:
    """Capture one spoken question. Needs: pip install SpeechRecognition pyaudio"""
    try:
        import speech_recognition as sr
    except ImportError:
        print(yellow("Voice input needs an extra package:\n"
                     "  pip install SpeechRecognition pyaudio"))
        return None

    rec = sr.Recognizer()
    try:
        with sr.Microphone() as mic:
            print(dim("Listening… speak now."))
            rec.adjust_for_ambient_noise(mic, duration=0.5)
            audio = rec.listen(mic, timeout=8, phrase_time_limit=20)
    except Exception as e:
        print(yellow(f"Could not use the microphone: {e}"))
        return None

    # recognize_google sends audio to Google's service. Be upfront about it.
    for lang_code in ("en-IN", "hi-IN", "mr-IN"):
        try:
            text = rec.recognize_google(audio, language=lang_code)
            if text.strip():
                return text.strip()
        except sr.UnknownValueError:
            continue
        except Exception as e:
            print(yellow(f"Speech recognition failed: {e}"))
            return None
    print(yellow("Sorry, I could not understand that."))
    return None


# ── Rendering ─────────────────────────────────────────────────────────────────
def render(result: dict) -> None:
    print()
    print(bold(cyan("Explanation")) + dim(f"  [{result['lang']}]"))
    print(result["explanation"])

    if result.get("summary"):
        print()
        print(bold(green("Summary")))
        print(result["summary"])

    if result.get("quiz"):
        print()
        print(bold(yellow("Quiz")))
        for i, q in enumerate(result["quiz"], 1):
            print(f"  {i}. {q}")
    print()


def ask(question: str) -> dict:
    """Run one question through the shared engine and record it in memory."""
    add_message(SESSION_ID, "user", question)
    # engine.py prints debug lines; keep stdout clean (important for --json).
    with contextlib.redirect_stdout(sys.stderr):
        result = generate_tutor_response(question, SESSION_ID)
    if result.get("explanation", "").strip():
        add_message(SESSION_ID, "assistant", result["explanation"])
    return result


def is_error(result: dict) -> bool:
    """engine.py reports Ollama problems inside 'explanation'."""
    text = result.get("explanation", "")
    return (not text.strip()) or text.startswith(
        ("Could not reach Ollama", "Ollama is taking too long")
    )


# ── Commands ──────────────────────────────────────────────────────────────────
def cmd_ask(args) -> int:
    question = " ".join(args.question).strip()
    if not question:
        print(red("Please provide a question."), file=sys.stderr)
        return 2

    result = ask(question)
    audio_path = None
    if args.audio and not is_error(result):
        audio_path = save_audio(result.get("summary") or result["explanation"][:300],
                                result["lang"])

    if args.json:
        if audio_path:
            result["audio_file"] = audio_path
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        render(result)
        if audio_path:
            print(dim(f"Audio saved to {audio_path}"))

    return 1 if is_error(result) else 0


def cmd_chat(args) -> int:
    use_audio = args.audio
    last = None

    print(bold("🎓 Personal AI Tutor") + dim(f"  (terminal mode · model: {MODEL})"))
    print(dim("Type /help for commands. Ask in English, Hindi or Marathi.\n"))

    while True:
        try:
            if args.voice:
                input(dim("Press Enter, then speak (or Ctrl+C to quit)… "))
                question = listen()
                if not question:
                    continue
                print(f"{bold('You')}: {question}")
            else:
                question = input(bold("You › ")).strip()
        except (EOFError, KeyboardInterrupt):
            print("\nGoodbye!")
            return 0

        if not question:
            continue

        if question.startswith("/"):
            cmd = question.lower()
            if cmd in ("/exit", "/quit"):
                print("Goodbye!")
                return 0
            if cmd == "/help":
                print(HELP_TEXT)
            elif cmd == "/clear":
                from memory import _histories
                _histories.pop(SESSION_ID, None)
                last = None
                print(dim("Conversation cleared."))
            elif cmd == "/audio":
                use_audio = not use_audio
                state = "ON (uses an online voice service)" if use_audio else "OFF"
                print(dim(f"Audio saving is {state}."))
            elif cmd == "/quiz":
                if last and last.get("quiz"):
                    for i, q in enumerate(last["quiz"], 1):
                        print(f"  {i}. {q}")
                else:
                    print(dim("No quiz yet. Ask a question first."))
            else:
                print(yellow(f"Unknown command: {question}. Try /help."))
            continue

        print(dim("Thinking…"))
        try:
            result = ask(question)
        except KeyboardInterrupt:
            print(dim("\nCancelled."))
            continue

        render(result)
        if not is_error(result):
            last = result
            if use_audio:
                path = save_audio(result.get("summary") or result["explanation"][:300],
                                  result["lang"])
                if path:
                    print(dim(f"Audio saved to {path}\n"))
        else:
            print(dim(f"Tip: make sure Ollama is running at {OLLAMA_URL} "
                      f"and the model '{MODEL}' is pulled.\n"))


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="personal-ai",
        description="Personal AI Tutor in your terminal (same engine as the web UI).",
    )
    sub = p.add_subparsers(dest="command")

    chat = sub.add_parser("chat", help="interactive tutoring session (default)")
    chat.add_argument("--audio", action="store_true",
                      help="save spoken audio for answers (uses an online voice service)")
    chat.add_argument("--voice", action="store_true",
                      help="speak your questions (needs SpeechRecognition + pyaudio)")
    chat.set_defaults(func=cmd_chat)

    a = sub.add_parser("ask", help="ask one question and exit")
    a.add_argument("question", nargs="+", help="your question")
    a.add_argument("--json", action="store_true", help="print JSON instead of formatted text")
    a.add_argument("--audio", action="store_true",
                   help="save spoken audio (uses an online voice service)")
    a.set_defaults(func=cmd_ask)

    return p


def main(argv=None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if not getattr(args, "func", None):
        args = parser.parse_args(["chat"] + (argv or []))
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
