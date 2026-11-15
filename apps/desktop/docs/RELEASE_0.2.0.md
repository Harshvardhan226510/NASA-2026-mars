Mars Field Atlas **0.2.0** is an unsigned engineering build for Windows x64 and Raspberry Pi OS / Debian Linux ARM64. It opens in Offline Mode with the bundled starter globe.

- Imports the current desktop-ready website updates, including separate site evaluation and improved imagery and lighting behavior.
- Adds Map Manager quality, colour/grayscale, storage and progressive loading choices, with named places, rectangle, circle, lasso and coordinate selection. The production download catalogue is empty; bring compatible map packages for finer coverage.
- Adds a dead-reckoning prototype: set a start, engage, feed calibrated motion or device-computed Mars coordinates, and view a separate estimated trail. Live device transport and raw IMU fusion await the hardware prototype.
- Includes local English microphone recognition with an editable transcript. Spoken replies can use the optional offline Piper pack if no system voice is available.
- Runs ARES locally with separately imported GGUF weights. The supplied Q8 was exercised on Windows; its weights are not attached to this release.

**Windows:** run `Mars-Field-Atlas-0.2.0-x64-setup.exe`. Select optional ARES voice in setup if you want the component screen on first launch.

**Raspberry Pi / Linux ARM64:** install `Mars-Field-Atlas-0.2.0-arm64.deb` with `sudo apt install ./Mars-Field-Atlas-0.2.0-arm64.deb`, then open Mars Field Atlas from the desktop menu. This build was produced on native Debian Bookworm ARM64.

**Optional spoken replies:** download `ares-voice-win32-x64.zip` or `ares-voice-linux-arm64.zip` for your platform while signed into GitHub, then open **ARES Voice → Install downloaded voice ZIP**. Keep the ZIP intact. Import and playback work offline. The base app includes microphone recognition independently of this ZIP.

See the attached verification record, exact native voice reports and `SHA256SUMS.txt`. Synthetic speech checks do not establish real microphone/speaker quality or Pi performance. This is research and engineering software; the app does not provide EVA operational clearance.
