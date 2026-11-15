# Partner main integration

The Orbit interface includes the 2D/Compare camera handoff, ARES assistant, and three-profile pathfinding from partner commit `814c8a44d8df4a89fd4674d74265052105f368d4`. The copied grid and search modules remain byte-identical to that commit. Atlas adapters retain georeferencing, corridor checks, terrain provenance, field obstacles, independent return routing and large mission windows.

## ARES

Open **ARES AI** in the tool rail. Navigation, view changes, mineral scans, route comparisons, candidate tours and mission-budget commands work without a language model. Scans use the loaded catalogue; a view centre is not rover telemetry. Mission budgets use the configured Missions scenario, not invented allocations. Return commands require a declared habitat or destination.

Free-form local-model answers are optional. Install Ollama separately, obtain/train the model described by the partner's root `Modelfile`, then register it as `ares-mars`. The model weights are not included in this repository. The optional checkbox sends free-form requests to `http://127.0.0.1:11434/api/chat`; the development server also proxies `/api/ares` to that address. A hosted Vercel function cannot access a user's localhost. Browser loopback permissions and Ollama origin configuration must permit the chosen site. No hosted inference service is provisioned by this PR. Browser speech recognition may use an online service.

## Route integration

Nearby sites share category, exclusion and priority controls. Regional APF attraction uses the projected analysis window. Deep-science automatic stops are included in exported results and station accounting. The partner's least-slope fallback is exposed as **Allow experimental slope-limit fallback**, off by default. Enabling it may exceed the selected slope cap; it cannot relax missing elevations or reported field obstacles. Physical calculations exclude display exaggeration.

The 2D overview retains fractional zoom and supports global Compare without a selected observation. Mission framing also fits the overview, including journeys across the date line. Current Orbit scientific overlays, spacecraft/moons, saved missions, graphics recovery and surface readouts remain available.

## Validation

Run `npm ci`, `npm test`, `python -m pip install -r requirements.txt`, `python -m unittest discover -s tests -p test_routing.py`, and `npm run build` from `web/`. Python uses the pinned requirements. Local startup: `npm run dev`. Remote archive APIs require their existing deployment configuration; the repository's display catalogue can be used for local inspection.
