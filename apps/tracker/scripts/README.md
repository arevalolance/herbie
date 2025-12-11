# Telemetry Importer Script

This script imports telemetry CSV logs from the tracker into your Convex database.

## Setup

Make sure you have `uv` installed and dependencies synced:

```bash
cd tracker
uv sync
```

## Usage

### Option 1: Using `uv run` (Recommended)

```bash
uv run import-telemetry \
  --user-id "YOUR_USER_ID" \
  --logs-dir tracker/telemetry_logs \
  --convex-url "https://your-deployment.convex.cloud"
```

### Option 2: Using the installed script

After installing the package:

```bash
uv pip install -e .
import-telemetry \
  --user-id "YOUR_USER_ID" \
  --logs-dir tracker/telemetry_logs \
  --convex-url "https://your-deployment.convex.cloud"
```

### Option 3: Direct Python execution

```bash
uv run python scripts/import_telemetry.py \
  --user-id "YOUR_USER_ID" \
  --logs-dir tracker/telemetry_logs \
  --convex-url "https://your-deployment.convex.cloud"
```

## Arguments

- `--user-id` (required): Convex user ID to associate the session with
- `--logs-dir` (required): Directory containing `lap_*_*.csv` files
- `--convex-url` (required): Your Convex deployment URL (e.g., `https://happy-animal-123.convex.cloud`)
- `--admin-key` (optional): Convex admin key for authentication (or set `CONVEX_ADMIN_KEY` env var)
- `--chunk-size` (optional): Batch size for uploads (default: 200)

## Example

```bash
export CONVEX_ADMIN_KEY="your-admin-key-here"

uv run import-telemetry \
  --user-id "k123abc456def" \
  --logs-dir tracker/telemetry_logs \
  --convex-url "https://happy-animal-123.convex.cloud" \
  --chunk-size 200
```

## Getting Your Convex URL

Your Convex deployment URL can be found in:
- `dashboard/.env.local` as `NEXT_PUBLIC_CONVEX_URL`
- Convex Dashboard: https://dashboard.convex.dev
- Running `npx convex dashboard` in the `dashboard` directory

## Getting a User ID

You can get a user ID by:
1. Querying your Convex database through the dashboard
2. Using `npx convex run` to query the `users` table
3. Creating a user through your auth system and noting the ID
