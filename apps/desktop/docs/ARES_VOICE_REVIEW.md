# ARES voice input — editable draft, 3 November 2026

No runtime build, microphone/inference/functional tests, packaging, release replacement or Pi update was performed. The user retains the final testing/packaging gate. Existing v0.1.1 binaries are unchanged.

## Input flow

- Desktop English push-to-talk: click Record, click Stop recording, review the editable transcript, then Send. Speech recognition never directly sends a command or runs map actions.
- Thirty-second cap; cancel while opening the microphone or transcribing. Close/hide/reload or losing window focus stops capture and discards pending results. Text submission also cancels pending voice input.
- No always-listening/wake word and no cloud recognizer. Recognition runs in a private, bounded CPU subprocess on the device, independent of the ARES GGUF.
- A short main-frame-only microphone permission lease is opened by the push-to-talk request. Only audio is permitted; camera, screen capture, other origins and frames remain denied. System-level microphone access can still be denied by the OS.
- Audio is captured with a local AudioWorklet, bounded and converted to 16 kHz mono PCM. The privileged service validates the exact WAV header/length and performs a simple energy check. This is not a full voice-activity/noise detector, and recognition can still invent words; transcript review is required.
- One job at a time, up to four CPU threads, 120-second transcription timeout. Audio/transcript content is not logged. Private temporary files are removed after use/cancellation; a crash can leave them until next launch cleanup.

## Dependencies and future builds

`npm run runtime:speech` is an explicit preparation recipe, not an app-startup or dependency-install hook. It compiles static CPU whisper-cli from whisper.cpp v1.9.5, commit d1be6fde11ac6e0407606b4e42fe72d34add8037 on native Windows x64/Linux ARM64. No recognizer server or separate user Python installation is needed. Source and model licences are retained with a SHA-256 file manifest.

English tiny.en GGML: 77,704,715 bytes (about 78 MB), publisher ggerganov/whisper.cpp, revision 5359861c739e955e79d9a303bcbc70fb988958b1, SHA-256 921e4cf8686fdd993dcd081a5da5b6c365bfde1162e72b08d75ac75289920b1f. This speech model is distinct from the 1.65 GB Mars ARES GGUF. The future app package includes the small recognition model and native recognizer; the large ARES model remains separately installed. Runtime files stay ignored until packaged. No speech assets have yet been downloaded/compiled or bundled in a released app.

Sources: https://github.com/ggml-org/whisper.cpp/tree/v1.9.5 ; https://huggingface.co/ggerganov/whisper.cpp ; https://github.com/openai/whisper/blob/v20250625/LICENSE ; https://www.electronjs.org/docs/latest/api/session

## Spoken replies when the OS has no voices

The app now waits briefly for asynchronous system-voice enumeration, uses local voices only, and displays missing-voice/playback failure messages. It does not silently use a remote voice. An OS-independent text-to-speech engine plus a licensed English voice pack is the proposed fallback: offer it alongside ARES components during installation and in settings, then use it when no suitable system voice exists. The separate optional output pack is now implemented as an installation/playback source draft in docs/ARES_OPTIONAL_VOICE.md; no output pack has been built, tested or published yet. No voice quality, footprint or Pi performance is claimed without choosing and measuring that engine/voice.

## Verification still required after the user's final call

Compile both native runtimes; verify packaged files, checksums and licences; record real speech on Windows and Pi; deny permission/unplug mic/cancel during every phase/close/reload/timeout; verify microphone indicator stops; exercise silence/background noise/accents/Mars names/numbers/coordinates; confirm transcript review before Send and no network audio; measure memory/latency alongside map/LLM; verify temporary-file cleanup and installed upgrades. Static parsing and diff review do not establish any of these results.
