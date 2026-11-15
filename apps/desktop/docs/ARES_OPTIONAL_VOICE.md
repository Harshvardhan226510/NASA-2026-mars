# Optional offline spoken replies

## What is implemented in source

Windows NSIS setup now has an unchecked optional choice: “Set up optional offline spoken replies after installation”. This requests the component screen when the app opens; it does not download as administrator or embed the speech-output engine/voice in the setup executable. Unchecked means skip that automatic screen. Silent installation does not opt in. Pi DEB installation uses the app's first-launch optional setup screen; no package-manager or root-time network download is added. Both platforms allow skipping and opening **ARES Voice** later from desktop controls or the assistant.

The component screen shows an optional combined engine + English voice selection, download size, installed size and temporary space based on a real approved platform manifest. It supports pause/retry with a retained partial download and a clear download-consent button. A dedicated HTTPS transfer is restricted to the catalogue source; it does not change the app's map Offline Mode. No speech content goes to that source. Closing setup does not remove an installed pack or cancel an explicitly started transfer; Pause is available in Voice settings. Installation is per user, with no separate user Python/Ollama requirement.

Spoken reply mode can be Automatic, System voice, or Offline ARES pack. Automatic prefers an available local English system voice and uses the optional pack if none is available or system synthesis fails. The pack generates WAV locally in a bounded private subprocess, then the app plays it without an OS voice dependency. Mute, recording, closing/hiding the assistant, losing window focus, navigation and quit cancel output. Text replies remain available on errors.

## Current availability

Native Windows x64 and Linux ARM64 packs have passed verified installation, WAV synthesis, speech recognition, cleanup and cancellation checks. The Windows app passed controlled microphone transcription with the optional pack installed. In a separate check, with system voices simulated as absent and audio output muted, Automatic mode selected the offline pack and completed playback. Physical speaker/microphone and Pi latency acceptance remain pending; these are synthetic software-path checks.

The repository is private. Download the matching `ares-voice-win32-x64.zip` or `ares-voice-linux-arm64.zip` from the same app release while signed into GitHub, then choose **ARES Voice → Install downloaded voice ZIP**. The app verifies the exact approved platform ZIP's size, SHA-256 and per-file inventory. No account token is embedded. This import works offline once the ZIP is downloaded; anonymous in-app downloads are disabled for private assets. System voices and text replies remain available without the optional pack.

Builds generate the platform-specific catalogue after the native check. The source catalogue is empty until that step; this does not describe the catalogue embedded in a verified native package. Exact download/installed sizes appear in the component screen and matching descriptor. Existing 0.1.1 installers do not gain this feature automatically.

The initial English model itself is 63,531,379 bytes. The complete pack also contains the private runtime, dependencies, source and licence notices. Its actual download/installed sizes are calculated from the final archive, and must not be presented as 64 MB total.

## Sources and licences

- Maintained Piper engine 1.8.0, source revision 639388b6317fc4731e91d53da42aea68fd4166ff, GPL-3.0. Native wheels are pinned by SHA-256 separately for Windows x64 and Linux ARM64. No optional training or HTTP server extras are installed.
- English US LJ Speech medium model/config/card at rhasspy/piper-voices revision e7229f7d33a10e145e109b886d661984201ac3c4. The repository declares MIT; this voice's model card identifies the LJ Speech training dataset as public domain. Both source metadata and the per-voice card are retained; this is not a claim that all Piper voices have identical terms.
- ONNX Runtime 1.23.2, NumPy 2.3.5, pathvalidate 3.3.1 and PyInstaller 6.17.0 are specified by the build recipe. Full resolved dependency versions/licences are recorded at build time; this is not a claim that every transitive build input has already been resolved/tested.
- The separate ZIP includes the Piper source distribution, wrapper source, PyInstaller source distribution, Python/dependency notices, voice model card and pinned source configuration. Final redistribution review and matching binary/source inventory belong to the release gate.

Official references: https://github.com/OHF-Voice/piper1-gpl/tree/v1.8.0 ; https://github.com/OHF-Voice/piper1-gpl/blob/v1.8.0/docs/API_PYTHON.md ; https://huggingface.co/rhasspy/piper-voices/blob/e7229f7d33a10e145e109b886d661984201ac3c4/en/en_US/ljspeech/medium/MODEL_CARD

## Build and remaining acceptance

1. On each native target, run `npm run runtime:voice-pack` after preparing science and speech runtimes. The ZIP and descriptor are written under release/optional-voice.
2. Run `node scripts/verify-native-voice.mjs`, then `node scripts/local-voice-catalog.mjs` before packaging. The latter approves only the exact locally tested archive for offline import; it adds no private download URL.
3. Publish the matching ZIP/descriptor with the app package under the existing release authorization. Preserve bundled engine source, notices and model card.
4. Remaining acceptance includes human speaker/microphone tests, missing OS voice and failed system-synthesis paths across machines, no-speaker/autoplay behavior, every async cancellation stage, full storage/recovery campaign and actual Pi latency/RAM. A native build or WAV header alone does not establish these results.

Extraction writes only regular, listed, individually hashed files into a fresh app-owned stage; absolute/traversal/device/link/duplicate/case-colliding paths, encryption, unexpected entries and excess expansion are rejected. The full ZIP is SHA-256 verified before extraction. Temporary reply WAVs are removed after generation; app-owned crash remnants/stages are removed at next startup. An installed pack is verified on first use each launch. Damaged-pack repair/removal and storage relocation are not yet exposed as UI controls.
