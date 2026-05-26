# TerriMap Project Handoff

This file captures the current project context so the work can be continued from another machine using the same GitHub repository.

## Repository

- Local path used during the latest work session: `C:\Users\IT-THIEN\terrimap`
- GitHub remote: `https://github.com/ZileanMaster/terrimap.git`
- Main branch: `main`
- Package manager: npm
- Local dev command: `npm run dev`
- Verification commands:
  - `npm run typecheck`
  - `npm run test`

## Current Product Direction

TerriMap is a web app for designing and operating sales territories on a map. The product workflow is:

1. Choose an operating region.
2. Review or draw polygon zones.
3. Validate polygon topology and geographic connectivity.
4. Manage sales staff.
5. Run a partition algorithm.
6. Review the cluster map.
7. Manually move polygons between clusters if needed.
8. Save snapshots or export data.

User-facing terminology has been changed from the technical word `district` to the Vietnamese term **"cụm"**. The code and database still use technical names such as `districtId` to avoid schema, API, service and test churn.

## Important Domain Rules

### Connectivity

A cluster is valid only when all polygons in that cluster are connected through adjacency relationships.

Manual polygon reassignment must not break connectivity. If a move would disconnect a cluster, the UI now reports the error inline in the polygon popup instead of using a browser alert.

### Polygon Topology

The project validates polygon topology to reject or guard against:

- Overlapping polygons.
- Duplicate/coincident polygons.
- Self-intersecting polygons.
- Invalid imported/API/database polygon data where topology checks are reached.

Shared boundaries are allowed. Overlap and crossing are not allowed.

### K-Means

K-Means has been removed from the project because centroid clustering does not guarantee connected polygon clusters.

## Algorithms

The project currently exposes these partition algorithms:

- Greedy Seed Expansion.
- Local Search Refinement.
- Simulated Annealing.

All partitioning logic should preserve or validate connected clusters. Avoid adding algorithms that assign by centroid alone unless they include strict connectivity repair and validation.

## Recent Completed Work

### TypeScript and Test Fixes

The project was verified with:

```powershell
npm install
npm run typecheck
npm run test
```

The latest verification before this handoff passed:

- Typecheck: pass.
- Tests: 15 files passed.
- Tests total: 379 passed.

### Connectivity Hardening

The project no longer uses artificial bridge edges such as "Tertiary Bridge". Partitioning uses strict adjacency from geometry rules. If the input graph is disconnected and the algorithm cannot guarantee connected output, it should fail instead of silently producing invalid clusters.

### UI/UX Updates

The dashboard was redesigned around a clearer workflow:

- Tổng quan.
- Khu vực & bản đồ.
- Nhân sự Sales.
- Phân chia lãnh thổ.
- So sánh thuật toán.
- Cài đặt.

The polygon popup has been improved:

- Shows polygon name and ID.
- Shows current cluster badge, for example `C0`.
- Shows customers and orders.
- Shows current cluster and sales owner.
- Supports editing customer/order metrics for admin.
- Supports moving a polygon to another cluster.
- Shows a move preview before confirmation.
- Shows connectivity errors inline.
- No longer supports moving polygon between regions from this popup.

A map legend component was added:

- `src/components/map/MapLegend.tsx`
- Shows cluster colors.
- Shows unassigned state.
- Warns when disconnected clusters exist.

### Documentation

The Vietnamese user guide was rewritten:

- `docs/USER_GUIDE.vi.md`

It now documents the current UI, cluster terminology, workflow, algorithms, connectivity, topology, snapshots, export and common errors.

## Files Most Recently Touched

UI and terminology:

- `src/components/map/ZoneInfoPanel.tsx`
- `src/components/map/MapLegend.tsx`
- `src/components/map/TerritoryMap.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/components/layout/RightPanel.tsx`
- `src/components/assignment/DistrictAgentAssigner.tsx`
- `src/components/algorithm/AlgorithmComparator.tsx`
- `src/components/snapshot/SnapshotCompare.tsx`
- `src/pages/AdminPage.tsx`
- `src/pages/CoordinatorPage.tsx`
- `src/i18n/vi.json`
- `src/i18n/en.json`

Documentation:

- `docs/USER_GUIDE.vi.md`
- `docs/project-handoff.md`

## How To Continue On Another Machine

Clone or update the repository:

```powershell
git clone https://github.com/ZileanMaster/terrimap.git
cd terrimap
npm install
```

Run verification:

```powershell
npm run typecheck
npm run test
```

Start the app:

```powershell
npm run dev
```

Open the Vite URL shown in the terminal, usually:

```text
http://127.0.0.1:5173
```

When continuing work on another machine, start by reading this file and then inspect the current codebase:

```text
Read docs/project-handoff.md first, then continue with the TerriMap codebase.
```

## Current Caveats

- The UI uses "cụm", but many internal code symbols still use `district`. This is intentional.
- Some older source comments may still mention district for technical clarity.
- Some legacy UI areas still use browser `alert()` for unrelated workflows such as member management or snapshot messages. Polygon cluster reassignment specifically was moved to inline errors.
- If Vercel is connected to GitHub `main`, a successful push to `main` should trigger deployment automatically.

## Commit Hygiene

Before committing future work:

```powershell
git status
npm run typecheck
npm run test
```

Avoid committing generated local artifacts such as Playwright reports, screenshots or temporary files unless explicitly needed.
