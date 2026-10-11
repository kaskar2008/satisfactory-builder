Saved factory format (version 1)
===============================

IndexedDB database `factory-builder`, object store `projects`, key `current`.
The same object is used for JSON exports. The schema version is independent of
the IndexedDB database version.

The root contains `version`, `savedAt`, the original production `config`, an
array of completed `modules`, and optional `proposal` metadata (kind,
description, and inter-module item/rate links).

Each module contains production groups, machine instances (position, dimensions,
heading, clock), floor elevations, bounds, and a logistics graph. Junctions have
IDs and explicit ports. Edges have IDs, item, rate, endpoint positions/directions,
and their complete 3D polyline. Group membership is stored as machine IDs.

There is one canonical copy of each route: `logistics.edges[].points`.
`logistics.routes` and group-to-machine object references are rebuilt on load.
Flow checks and capacity are recomputed from the saved graph without calling the
layout or route planner. Render meshes, GPU buffers, cached diagnostics and DOM
content are not saved. Models are reconstructed from building types and graph
geometry. Display preferences remain in their separate existing storage keys.

Writes use one atomic IndexedDB transaction. A confirmed new generation deletes
the prior snapshot. Successful multi-module calculations save all modules in one
record. A storage failure keeps the finished factory visible and asks the user
to export it. Unsupported or damaged snapshots produce a recovery error rather
than silently starting an expensive calculation.
