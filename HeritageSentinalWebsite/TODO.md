# TODO (Pathfinding update)

- [x] Replace A* in `src/utils/pathfinding.js` with RRT* planning.

- [ ] Keep `findPath(startPos, targetPos, { includeRaw=true })` signature + return shape unchanged.
- [ ] Produce compatible `path` as ordered `{id,x,y}` waypoints.
- [x] Sanity check build/runtime (run `npm test`/`npm run build` if available) and ensure Map route renders.


