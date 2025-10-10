import * as React from 'react';

type IconSize = 'sm' | 'md' | 'lg';

type CacheEntry = { svg: string; ts: number };

const CACHE = new Map<string, CacheEntry>();
const MAX_CACHE = 120;
const TRIM_TARGET = 80;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function toKebab(name: string) {
	return name.replace(/\./g, '-');
}

function iconPath(name: string) {
	return `/dieter/icons/svg/${toKebab(name)}.svg`;
}

function trimCache() {
	if (CACHE.size <= MAX_CACHE) return;
	const oldest = Array.from(CACHE.entries()).sort((a, b) => a[1].ts - b[1].ts);
	const toRemove = Math.max(0, CACHE.size - TRIM_TARGET);
	for (const [key] of oldest.slice(0, toRemove)) CACHE.delete(key);
}

async function loadIcon(name: string): Promise<string> {
	const hit = CACHE.get(name);
	if (hit && Date.now() - hit.ts < CACHE_TTL) {
		return hit.svg;
	}

	try {
		const res = await fetch(iconPath(name));
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const svg = await res.text();
		CACHE.set(name, { svg, ts: Date.now() });
		trimCache();
		return svg;
	} catch (error) {
		console.warn(`[app] Failed to load icon: ${name}`, error);
		const fallback = '⚠️';
		CACHE.set(name, { svg: fallback, ts: Date.now() });
		trimCache();
		return fallback;
	}
}

export function SystemIcon({
	name,
	size = 'md',
	ariaLabel,
	className,
}: {
	name: string;
	size?: IconSize;
	ariaLabel?: string;
	className?: string;
}) {
	const [svg, setSvg] = React.useState<string | null>(null);

	React.useEffect(() => {
		let cancelled = false;
		setSvg(null);
		loadIcon(name).then((result) => {
			if (!cancelled) setSvg(result);
		});
		return () => {
			cancelled = true;
		};
	}, [name]);

	const baseClass = `studio-icon ${className ?? ''}`;
	const sizeAttr = { 'data-size': size } as const;

	if (svg === null) {
		return <span className={`${baseClass} studio-icon--loading`} {...sizeAttr} aria-hidden="true" />;
	}

	if (svg === '⚠️') {
		return (
			<span className={`${baseClass} studio-icon--missing`} {...sizeAttr} aria-hidden="true">
				⚠️
			</span>
		);
	}

	return (
		<span
			className={baseClass}
			{...sizeAttr}
			role={ariaLabel ? 'img' : undefined}
			aria-label={ariaLabel}
			aria-hidden={ariaLabel ? undefined : true}
			dangerouslySetInnerHTML={{ __html: svg }}
		/>
	);
}

