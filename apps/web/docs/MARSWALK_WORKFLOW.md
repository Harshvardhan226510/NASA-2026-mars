# Marswalk mission workflow

The **Marswalk** panel complements **Routes** and the **Missions** library.
It combines mission budgets, source audits, dated conditions, science station
tasks, geometric communications and a locally saved field record.

## Plan outward travel and return

Choose A, B and the research stops in Routes, then calculate. Round trips are
enabled by default. The original partner engine computes a separate direct
return from B to the declared habitat; return costs are not obtained by doubling
outward costs or reversing its line. A moved explorer can retain the original
habitat while replanning from a recorded position.

The Mission tab reports time, equivalent metabolic oxygen and metabolic energy
for outward travel, science work, breaks and return separately. Walking energy
uses the original engine. Work/break metabolic power, speed, suit oxygen loss,
allocation and reserve percentages are editable scenario inputs. Allocations
start blank. **Use illustrative demo allocations** provides an explicitly named
example, not a suit specification or recommended EVA limits. Energy is not a
battery budget. Oxygen uses the partner's 20.9 kJ per equivalent litre basis;
actual supply comparisons require compatible reference conditions and a suit
model. CO₂ removal, thermal control, rescue and equipment validation are not
covered. [NASA spacesuit requirements](https://www.nasa.gov/reference/11-0-spacesuits-vol-2/)
explain the broader system context.

Each resource has its own reserve. Reported prior consumption is subtracted
from usable allocations for a remaining mission. Missing return travel,
unreached planned stations and unknown prior consumption leave the complete
budget unknown; they never count as zero use. “Within configured allocations”
is a mathematical comparison, not mission clearance.

## Inspect route coverage

Coverage groups the outward and return profiles into inspectable geographic
segments. Every segment retains its terrain source, source sampling, analysis
cell spacing, largest profile interval and missing-height count. Native DEM
missions share the same source across their segments; the interface does not
invent variation in confidence. Regional source sampling is a conservative
window-level description. Grid-wide missing cells are shown separately from
missing values on the actual route.

Map colours distinguish measured samples, sparse/legacy profile intervals and
missing profile heights. These are coverage states, not statistical confidence
or safety classifications. Rocks, soil strength, unresolved cliffs, radiation,
suit constraints and radio performance remain explicit unsupported hazards.
Physical heights are used independently of the globe's relief exaggeration.

## Departure time, lighting and conditions

Departure is entered in UTC. The schedule includes station work and breaks;
arrival times determine solar geometry at sampled route locations. Solar
elevation follows the existing [NASA Mars24 algorithm](https://www.giss.nasa.gov/tools/mars24/help/algorithm.html).
Local slope and shadow checks use physical DEM heights and a sunward horizon
to eight analysis cells. Distant terrain shadows and atmospheric attenuation
are unresolved. Missing terrain lighting stays unknown.

Night-speed, travel-speed and travel-energy multipliers are explicitly user
scenarios. They affect the schedule and budgets; terrain search is not a new
time-dependent weather optimiser. Temperature and pressure can be loaded from
the existing NASA GSFC / EMARS endpoint for the departure hour. This is dated
modeled climatology, not live surface weather. Snapshot time, retrieval time,
source, model label, cached fallback state and locations are retained. The
snapshot is not silently advanced during the walk or converted into risk or
walking penalties. Missing values are not replaced with zero.

## Turn research markers into stations

Included catalogue markers and manual checkpoints generate editable tasks:
scientific question, supporting evidence/source, proposed equipment, work
duration, expected record, equipment confirmation and task status. Category
templates propose activities; they do not claim to be published mission
procedures. Approximate catalogue anchors are not surveyed outcrop positions.
Proximity to the sampled route is shown separately from actual arrival.

Completed/skipped work is removed from remaining routing targets and work
budgets. Completion is recorded as a dated user entry. A mission in progress
requires entry of prior use before its remaining allocations can be compared.

## Field log and replanning

Record observations, obstacle circles or a current position, with UTC time,
coordinates, station association and notes. Coordinates can come from the
view centre or an inspected route sample. These are declared user records,
not verified sensor telemetry. Active obstacle circles conservatively exclude
intersecting walking cells at calculation resolution. They do not alter the
measured DEM or invent obstacle heights for shadow/radio calculations.

Changing active reports invalidates the remaining-budget comparison until
recalculation. Obstacles can be resolved/reactivated without erasing their
history. Replanning from a position retains the original return habitat and
marks prior consumption unknown until entered. Completed station tasks are
not repeated automatically.

The mission session autosaves in this browser; the panel displays pending,
success or failure. **Save session now** flushes it immediately. Refresh restores
the active Marswalk section, tasks, logs, settings, route/return geometry and
matching analysis snapshots. A changed geometry/time/antenna configuration
without the analysis grid requires recalculation. The named Missions library,
mission downloads, route JSON and GeoJSON preserve the relevant inputs and
field records. Browser storage is not shared across devices or accounts.

## Geometric communications

Declare a ground habitat or ground relay, an explorer antenna height and a
receiver height. Custom receivers are included in the terrain window. Rays
are sampled between Cartesian endpoints on the Mars reference sphere, using
physical DEM heights and planetary curvature. The map marks sampled clear,
blocked and unknown locations. Unknown ray/endpoint terrain remains unknown;
clear intervals separate distinct gap groups.

This is geometric line of sight. It does not calculate Fresnel clearance,
diffraction, refraction, antenna patterns, frequency, power, link margin,
hardware availability or an orbital relay schedule. See NASA's
[Radio Wave Propagation Handbook for Communication on and Around Mars](https://ntrs.nasa.gov/citations/20020039526).

## Implementation boundaries

`routing/upstream/` stays byte-for-byte unchanged. `routing/mission.py` applies
reported walking exclusions, and the existing route service optionally plans
a directed return on the same measured grid. The browser loads a bounded
analysis window, not the entire planetary archive. No new Vercel function,
ingestion scheduler, external message or additional account is required.

Station and log records are bounded (64 station records, 100 field entries,
64 active obstacles). Terrain/condition analysis is sampled and bounded;
long schedules aggregate numerous breaks. Mission files retain the existing
2 MB limit. Unknown/unresolved support is disclosed rather than extrapolated.
