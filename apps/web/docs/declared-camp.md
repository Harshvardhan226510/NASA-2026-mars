# Declare camp from a base evaluation

After evaluating a **Base station** candidate, choose **Declare camp**. This explicitly assigns the evaluated coordinates to the existing Marswalk mission's `home` field. ARES's **Return to Declared Camp** action reads that same field before any ordinary route destination. No second camp store or inferred camp location is introduced.

Declaration saves a personal marker for the evaluated base if one is not already present, invalidates stale route calculations and saves the mission session. Existing evaluation limits and failed/unknown screening remain visible; declaration is a planning choice, not a certification of site safety. Landing evaluations do not offer camp declaration.

Once the candidate is the declared camp, **Deploy on site** navigates to it and opens **Plan Mission → Deploy Hardware**. It does not deploy equipment automatically or change its terrain/telemetry model. The user still chooses an instrument and places it on the surface.

The **Camp** shortcut next to the close control in Explore's header navigates to the declared camp. It is disabled until a mission home has been declared. The Places section also shows the current camp and a **Deploy on site** action, so the handoff remains available after reload even though evaluation comparison cards are session-only. Moving the view to camp does not itself calculate an EVA route; ARES Return performs that separate calculation.

Mission autosaves, mission files and shared mission links already include the canonical home coordinates. Restoring a mission or changing its return habitat refreshes these controls. Deleting a personal marker does not silently delete a declared mission home. A matching saved base marker supplies a display name where available; the return coordinates remain the mission home, independent of marker edits.

The Missions header now has **Return to camp**, connected to the same ARES return calculation. Routes provides **Use camp as destination**, which sets B without replacing A or calculating a route automatically. Both controls are disabled without a declared home. Clearing route endpoints preserves camp.

Camp has its own mint hexagonal tent-and-flag marker in 3D, 2D and the overview. A matching ordinary personal-site pin is suppressed to prevent overlapping duplicates; the personal record remains editable. Clicking the camp marker navigates to camp unless an active map-picking tool needs the point.

Validation covers base-only coordinate validation, shared mission-home persistence through file/link round-trips, and ARES return prioritizing the declared camp over another route destination. Browser verification exercises evaluation → declaration → hardware handoff, the Explore shortcut and persistence after reload.
