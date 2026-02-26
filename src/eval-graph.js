const MIN_ABS_CP = 500;
const MAX_ABS_CP = 2000;

export function sanitizeCpForGraph(score) {
  if (!score || typeof score !== 'object') {
    return 0;
  }

  if (score.type === 'cp') {
    const cp = Number(score.value);
    if (!Number.isFinite(cp)) {
      return 0;
    }
    return Math.max(-MAX_ABS_CP, Math.min(MAX_ABS_CP, Math.round(cp)));
  }

  if (score.type === 'mate') {
    const mate = Number(score.value);
    if (!Number.isFinite(mate) || mate === 0) {
      return 0;
    }
    return mate > 0 ? MAX_ABS_CP : -MAX_ABS_CP;
  }

  return 0;
}

export function computeSymmetricYRange(cpValues) {
  const values = Array.isArray(cpValues) ? cpValues : [];
  let absMax = 0;
  for (const value of values) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      continue;
    }
    absMax = Math.max(absMax, Math.abs(parsed));
  }

  const clampedAbsMax = Math.max(MIN_ABS_CP, Math.min(MAX_ABS_CP, Math.ceil(absMax)));
  return { minCp: -clampedAbsMax, maxCp: clampedAbsMax };
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

export function buildPolylinePoints(samples, viewport, yRange) {
  const source = Array.isArray(samples) ? samples : [];
  if (source.length === 0) {
    return '';
  }

  const width = Math.max(1, Number(viewport?.width) || 1);
  const height = Math.max(1, Number(viewport?.height) || 1);
  const minCp = Number.isFinite(yRange?.minCp) ? yRange.minCp : -MIN_ABS_CP;
  const maxCp = Number.isFinite(yRange?.maxCp) ? yRange.maxCp : MIN_ABS_CP;
  const totalPly = Math.max(0, Number(source[source.length - 1]?.ply) || 0);
  const span = Math.max(1, maxCp - minCp);

  return source
    .map((sample) => {
      const ply = Math.max(0, Number(sample?.ply) || 0);
      const cp = Math.max(minCp, Math.min(maxCp, Number(sample?.cp) || 0));
      const x = totalPly <= 0 ? 0 : (ply / totalPly) * width;
      const yRatio = clamp01((maxCp - cp) / span);
      const y = yRatio * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

export function buildAxisTicks(maxPly, yRange) {
  const ply = Math.max(0, Math.round(Number(maxPly) || 0));
  const yMaxCp = Number.isFinite(yRange?.maxCp) ? Math.abs(yRange.maxCp) : MIN_ABS_CP;
  return {
    xTicks: [
      { value: 0, label: '0' },
      { value: ply, label: String(ply) }
    ],
    yTicks: [
      { value: -yMaxCp, label: `-${(yMaxCp / 100).toFixed(2)}` },
      { value: 0, label: '0.00' },
      { value: yMaxCp, label: `+${(yMaxCp / 100).toFixed(2)}` }
    ]
  };
}
