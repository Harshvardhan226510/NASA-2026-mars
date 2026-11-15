# Desktop build verification

The desktop release workflow runs JavaScript and Python regressions on Windows x64 and native Linux ARM64. The native voice check verifies synthesis, recognition and cancellation on both systems. Packaging verifies the Electron archive, selected native runtimes, and exclusion of model weights. Promotion checks the exact source commit, both build jobs, Debian architecture, hashes and optional voice archives.

See the release's BUILD_VERIFICATION.json for the source identity and verified asset inventory. The Windows installer is unsigned. The current version has not been accepted on physical Raspberry Pi hardware.
