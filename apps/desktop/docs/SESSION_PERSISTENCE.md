# Desktop session persistence

The draft stores application preferences in `ui-state.json` in the Electron user-data folder. It restores them before the map interface initializes, independently of the random localhost port used by each launch. Existing settings, model and map registries, and dead-reckoning files keep their own storage.

The existing mission session retains camera position/orientation, 2D position/zoom, display mode, appearance, layers, relief, measurements, route endpoints/results and Marswalk state. Named saved missions and browser-based preferences are mirrored too. Map Manager separately retains its applied custom geometry, product/resolution, named-location choices, appearance and active section; an open manager reopens after restart. Restoring download choices does not start a transfer.

Normal window closure waits for a fresh session capture and the atomic state-file write. Network-mode changes and menu reload also flush state first. If closing cannot save, the app offers retry or closing without the latest changes. Corrupt state files are preserved as `.invalid-<timestamp>` before recovery. State remains bounded to app-owned preference keys and a 24 MiB file limit. Dead reckoning retains its existing paused-on-restart behavior.

Validation on 2026-11-08: the isolated Electron check launched twice with the production sandboxed preload and close handler, using different localhost ports (56233, then 58541). It restored camera/route session data, appearance and a Map Manager draft after normal closure. Regression tests cover a fresh process/origin, deleted preferences, corrupt-file recovery, input limits, waiting for writes and retry after a failed save. The full physical Pi application restart check and packaged release remain pending.

This extends the existing mission snapshot; it does not make every transient panel, ARES transcript, recording or unsaved equipment placement part of a mission snapshot. Forced termination can retain only the most recent completed autosave.
