'use client'

import { useState, useEffect, useMemo, useRef, useCallback, memo } from "react"
import { Area, CartesianGrid, XAxis, YAxis, ComposedChart, ReferenceArea, ResponsiveContainer } from "recharts"
import {
	ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@workspace/ui/components/chart"
import { TelemetryChartTooltip } from "@/components/telemetry-chart-tooltip"

type DataPoint = {
	date: string;
	events: number;
	delta_to_best?: number;
	delta_to_session_best?: number;
};

type ZoomableChartProps = {
	data?: DataPoint[];
	title?: string;
	syncId?: string;
};

const chartConfig = {
	events: {
		label: "Events",
		color: "var(--chart-3)",
	},
} satisfies ChartConfig

const seedRandom = (seed: number) => {
	const x = Math.sin(seed++) * 10000;
	return x - Math.floor(x);
};

export function simulateData(start = '2024-01-01T00:00:00Z', end = '2024-01-02T00:00:00Z'): DataPoint[] {
	const simulatedData = [];
	let baseValue = 50;
	for (let currentDate = new Date(start); currentDate <= new Date(end); currentDate.setTime(currentDate.getTime() + 600000)) {
		const seed = currentDate.getTime();
		baseValue = Math.max(
			(baseValue + 0.5 * (currentDate.getTime() - new Date(start).getTime()) / (new Date(end).getTime() - new Date(start).getTime()) * 100 +
				(seedRandom(seed) - 0.5) * 20 +
				(seedRandom(seed + 1) < 0.1 ? (seedRandom(seed + 2) - 0.5) * 50 : 0) +
				Math.sin(currentDate.getTime() / 3600000) * 10) *
			(1 + (seedRandom(seed + 3) - 0.5) * 0.2),
			1
		);
		simulatedData.push({
			date: currentDate.toISOString(),
			events: Math.max(Math.floor(baseValue), 1)
		});
	}
	return simulatedData;
}

function PureZoomableChart({ data: initialData, title, syncId }: ZoomableChartProps) {
	const [data, setData] = useState<DataPoint[]>(initialData || []);
	const [refAreaLeft, setRefAreaLeft] = useState<string | null>(null);
	const [refAreaRight, setRefAreaRight] = useState<string | null>(null);
	const [startTime, setStartTime] = useState<string | null>(null);
	const [endTime, setEndTime] = useState<string | null>(null);
	const [originalData, setOriginalData] = useState<DataPoint[]>(initialData || []);
	const [isSelecting, setIsSelecting] = useState(false);
	const chartRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (initialData?.length) {
			setData(initialData);
			setOriginalData(initialData);
			setStartTime(initialData[0]?.date || null);
			setEndTime(initialData[initialData.length - 1]?.date || null);
		}
	}, [initialData]);

	const zoomedData = useMemo(() => {
		if (!startTime || !endTime) {
			return data;
		}

		const dataPointsInRange = originalData.filter(
			(dataPoint) => dataPoint.date >= startTime && dataPoint.date <= endTime
		);

		// Ensure we have at least two data points for the chart to prevent rendering a single dot
		return dataPointsInRange.length > 1 ? dataPointsInRange : originalData.slice(0, 2);
	}, [startTime, endTime, originalData, data]);

	const total = useMemo(
		() => zoomedData.reduce((acc, curr) => acc + curr.events, 0),
		[zoomedData]
	)

	// Optimized hover handler with useCallback
	const handleMouseMove = useCallback((e: any) => {
		if (isSelecting && e.activeLabel) {
			setRefAreaRight(e.activeLabel);
		}
	}, [isSelecting]);

	const handleMouseDown = useCallback((e: any) => {
		if (e.activeLabel) {
			setRefAreaLeft(e.activeLabel);
			setIsSelecting(true);
		}
	}, []);

	const handleMouseUp = useCallback(() => {
		if (refAreaLeft && refAreaRight) {
			const [left, right] = [refAreaLeft, refAreaRight].sort();
			setStartTime(left || null);
			setEndTime(right || null);
		}
		setRefAreaLeft(null);
		setRefAreaRight(null);
		setIsSelecting(false);
	}, [refAreaLeft, refAreaRight]);

	const handleMouseLeave = useCallback(() => {
		if (isSelecting) {
			handleMouseUp();
		}
	}, [isSelecting, handleMouseUp]);

	const handleReset = useCallback(() => {
		setStartTime(originalData[0]?.date || null);
		setEndTime(originalData[originalData.length - 1]?.date || null);
	}, [originalData]);

	const handleZoom = useCallback((e: React.WheelEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
		e.preventDefault();
		if (!originalData.length || !chartRef.current) return;

		let zoomFactor = 0.1;
		let direction = 0;
		let clientX = 0;

		if ('deltaY' in e) {
			// Mouse wheel event
			direction = e.deltaY < 0 ? 1 : -1;
			clientX = e.clientX;
		} else if (e.touches.length === 2) {
			// Pinch zoom
			const touch1 = e.touches[0];
			const touch2 = e.touches[1];
			const currentDistance = Math.hypot((touch1?.clientX || 0) - (touch2?.clientX || 0), (touch1?.clientY || 0) - (touch2?.clientY || 0));

			if ((e as any).lastTouchDistance) {
				direction = currentDistance > (e as any).lastTouchDistance ? 1 : -1;
			}
			(e as any).lastTouchDistance = currentDistance;

			clientX = ((touch1?.clientX || 0) + (touch2?.clientX || 0)) / 2;
		} else {
			return;
		}

		const currentRange = new Date(endTime || originalData[originalData.length - 1]?.date || '').getTime() -
			new Date(startTime || originalData[0]?.date || '').getTime();
		const zoomAmount = currentRange * zoomFactor * direction;

		const chartRect = chartRef.current.getBoundingClientRect();
		const mouseX = clientX - chartRect.left;
		const chartWidth = chartRect.width;
		const mousePercentage = mouseX / chartWidth;

		const currentStartTime = new Date(startTime || originalData[0]?.date || '').getTime();
		const currentEndTime = new Date(endTime || originalData[originalData.length - 1]?.date || '').getTime();

		const newStartTime = new Date(currentStartTime + zoomAmount * mousePercentage);
		const newEndTime = new Date(currentEndTime - zoomAmount * (1 - mousePercentage));

		setStartTime(newStartTime.toISOString());
		setEndTime(newEndTime.toISOString());
	}, [originalData, startTime, endTime]);

	const formatXAxis = useCallback((tickItem: string) => {
		// If tickItem looks like a number (lap progress), show percentage; otherwise format as time
		const numeric = parseFloat(tickItem);
		if (!Number.isNaN(numeric)) {
			const pct = Math.round(numeric * 100);
			return `${pct}%`;
		}
		const date = new Date(tickItem);
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}, []);

	// Memoize the tooltip content component
	const tooltipContent = useMemo(() => (
		<TelemetryChartTooltip title={title} />
	), [title]);

	const dynamicConfig = useMemo(() => ({
		events: {
			label: title || 'Events',
			color: chartConfig.events.color,
		}
	}), [title]);

	return (
		<ChartContainer
			config={dynamicConfig}
			className="w-full h-full max-h-[150px]"
		>
			<div className="h-full relative" onWheel={handleZoom} onTouchMove={handleZoom} ref={chartRef} style={{ touchAction: 'none' }}>
				<ResponsiveContainer width="100%" height="100%">
					<ComposedChart
						syncId={syncId || "lapAnalysis"}
						data={zoomedData}
						margin={{
							top: 10,
							right: 10,
							left: 0,
							bottom: 0,
						}}
						onMouseDown={handleMouseDown}
						onMouseMove={handleMouseMove}
						onMouseUp={handleMouseUp}
						onMouseLeave={handleMouseLeave}
					>
						<defs>
							<linearGradient id={`colorEvents-${title}`} x1="0" y1="0" x2="0" y2="1">
								<stop offset="5%" stopColor={dynamicConfig.events.color} stopOpacity={0.8} />
								<stop offset="95%" stopColor={dynamicConfig.events.color} stopOpacity={0.1} />
							</linearGradient>
						</defs>
						<CartesianGrid vertical={false} />
						<XAxis
							dataKey="date"
							tickFormatter={formatXAxis}
							tickLine={false}
							axisLine={false}
							tickMargin={4}
							minTickGap={16}
							style={{ fontSize: '10px', userSelect: 'none' }}
						/>
						<YAxis
							tickLine={false}
							axisLine={false}
							style={{ fontSize: '10px', userSelect: 'none' }}
							width={30}
						/>
						<ChartTooltip
							cursor={false}
							content={tooltipContent}
						/>
						<Area
							type="monotone"
							dataKey="events"
							stroke={dynamicConfig.events.color}
							fillOpacity={0}
							fill={`url(#colorEvents-${title})`}
							isAnimationActive={false}
						/>
						{refAreaLeft && refAreaRight && (
							<ReferenceArea
								x1={refAreaLeft}
								x2={refAreaRight}
								strokeOpacity={0.3}
								fill="hsl(var(--foreground))"
								fillOpacity={0.05}
							/>
						)}
					</ComposedChart>
				</ResponsiveContainer>

				{title && (
					<div className="absolute bottom-1 right-1 px-2 py-0.5 rounded bg-background/70 text-foreground text-[10px] sm:text-xs pointer-events-none select-none">
						{title}
					</div>
				)}
			</div>
		</ChartContainer>
	)
}

export const ZoomableChart = memo(PureZoomableChart, (prevProps, nextProps) => {
	return (
		prevProps.title === nextProps.title &&
		prevProps.syncId === nextProps.syncId &&
		prevProps.data === nextProps.data
	);
})