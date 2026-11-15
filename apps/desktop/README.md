# Pyxis desktop

Pyxis / Mars Field Atlas desktop targets Windows x64 and Debian or Raspberry Pi OS ARM64.
The desktop viewer snapshot in `web/` includes the desktop bridge and offline adaptations. The hosted website lives in `../web`.

Download the platform installer and SHA-256 manifest from the repository Releases page. On Windows, run the setup executable. On Linux ARM64, install the downloaded package with `sudo apt install ./Mars-Field-Atlas-0.3.1-arm64.deb`.

The installer includes the offline starter globe, native scientific helper, local inference engine and English speech recognition. ARES neural weights are installed separately. Offline spoken replies can use the optional platform voice ZIP from the same release.

The [Point Inspector and crew API guide](docs/POINT_INSPECTOR.md), [local field input guide](docs/FIELD_INPUT_API.md), and [Map Manager API guide](docs/DEVELOPER_MAP_API.md) describe desktop-specific workflows.

From this directory, use Node 24 and run `npm ci`, then `npm ci --prefix web`. The root desktop workflow builds and verifies the platform packages with their native helpers.
See [architecture](ARCHITECTURE.md), [source history](UPSTREAM.md), and [third-party notices](THIRD_PARTY_NOTICES.md).
