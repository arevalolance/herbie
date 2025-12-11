"""
Example usage of the SnapshotTelemetryCollector.

Demonstrates how to use the tick-aligned snapshot collector
for rFactor 2 telemetry data collection.
"""

import asyncio
import logging
import structlog

from herbie_agent.snapshot_collector import SnapshotTelemetryCollector


class MockConvexClient:
    """
    Mock Convex client for testing.
    Replace with actual Convex HTTP client in production.
    """

    async def mutation(self, function_name: str, args: dict):
        """Call a Convex mutation"""
        print(f"[Mock] Calling {function_name} with {len(args.get('rows', []))} rows")
        # In production, make actual HTTP request to Convex
        # response = await httpx.post(
        #     f"{convex_url}/{function_name}",
        #     json={"args": args},
        #     headers={"Authorization": f"Bearer {admin_key}"}
        # )
        # return response.json()
        return {"inserted": len(args.get('rows', []))}


async def main():
    """Main function demonstrating snapshot collector usage"""

    # Configure logging
    structlog.configure(
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO)
    )

    # Create Convex client (use actual client in production)
    convex_client = MockConvexClient()

    # Create snapshot collector
    collector = SnapshotTelemetryCollector(convex_client)

    try:
        # Initialize RF2 connection
        await collector.initialize()

        # Start collection
        await collector.start()

        print("Collecting telemetry... Press Ctrl+C to stop")

        # Run for demonstration (or until interrupted)
        await asyncio.sleep(3600)  # Collect for 1 hour

    except KeyboardInterrupt:
        print("\nStopping collection...")
    finally:
        # Stop collection and flush remaining data
        await collector.stop()
        print("Collection stopped")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())
