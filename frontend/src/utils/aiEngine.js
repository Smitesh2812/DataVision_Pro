// utils/aiEngine.js
// Pure AI/analysis engine — no React, no DOM.
// Powers all 7 intelligent features:
//   1. Action Buttons      — detect problems + generate fix plans
//   2. ELI5 Mode           — rewrite jargon into plain English
//   3. Auto Storytelling   — narrative paragraphs from data
//   4. Decision Feed       — Instagram-style scrollable insights
//   5. What Should I Do    — concrete next steps
//   6. Messy Data Fixer    — auto-detect ALL data quality issues
//   7. Style Learner       — track what user cares about

import { mean, stddev, safeMax, safeMin, pearson, formatN } from '../hooks/useDataset';

// ════════════════════════════════════════════════════════════
// FEATURE 1 — ACTION BUTTONS
// Detect problems in data and generate actionable fix plans.
// ════════════════════════════════════════════════════════════
export function detectActionableInsights(cleanData, numericCols, catCols) {
  const actions = [];

  numericCols.slice(0, 6).forEach(col => {
    const vals  = cleanData.map(r => r[col]).filter(v => v != null && !isNaN(v));
    if (vals.length < 4) return;
    const m  = mean(vals);
    const h1 = mean(vals.slice(0, Math.floor(vals.length / 2)));
    const h2 = mean(vals.slice(Math.floor(vals.length / 2)));
    const pct = h1 ? ((h2 - h1) / Math.abs(h1) * 100) : 0;
    const sd  = stddev(vals);
    const cv  = m ? (sd / Math.abs(m) * 100) : 0;

    // Significant drop
    if (pct < -15) {
      actions.push({
        type: 'drop',
        severity: pct < -30 ? 'critical' : 'warning',
        icon: '📉',
        title: `${col} dropped ${Math.abs(pct).toFixed(0)}%`,
        subtitle: `${formatN(h1)} → ${formatN(h2)} in second half of dataset`,
        color: '#ef4444',
        plan: generateDropPlan(col, pct, catCols),
      });
    }
    // Significant rise
    if (pct > 20) {
      actions.push({
        type: 'rise',
        severity: 'success',
        icon: '📈',
        title: `${col} grew ${pct.toFixed(0)}%`,
        subtitle: `${formatN(h1)} → ${formatN(h2)} — strong momentum`,
        color: '#34d399',
        plan: generateRisePlan(col, pct),
      });
    }
    // High volatility
    if (cv > 80) {
      actions.push({
        type: 'volatile',
        severity: 'warning',
        icon: '⚡',
        title: `${col} is highly volatile (CV=${cv.toFixed(0)}%)`,
        subtitle: 'Large swings detected — may need stabilization',
        color: '#fbbf24',
        plan: generateVolatilePlan(col, cv),
      });
    }
  });

  // Category concentration risk
  catCols.slice(0, 3).forEach(col => {
    const cnt = {};
    cleanData.forEach(r => { const v = String(r[col] ?? '—'); cnt[v] = (cnt[v] || 0) + 1; });
    const ents = Object.entries(cnt).sort((a, b) => b[1] - a[1]);
    const topPct = ents[0] ? (ents[0][1] / cleanData.length * 100) : 0;
    if (topPct > 70 && ents.length > 2) {
      actions.push({
        type: 'concentration',
        severity: 'warning',
        icon: '🎯',
        title: `Over-reliance on "${ents[0][0]}" in ${col}`,
        subtitle: `${topPct.toFixed(0)}% of data is one category — diversification risk`,
        color: '#f97316',
        plan: [
          { step: 1, action: `Analyze why "${ents[0][0]}" dominates ${col}` },
          { step: 2, action: `Target growth in: ${ents.slice(1, 4).map(e => e[0]).join(', ')}` },
          { step: 3, action: 'Set a diversification target: reduce top category to <50%' },
          { step: 4, action: 'Run A/B test in underperforming categories' },
        ],
      });
    }
  });

  return actions;
}

function generateDropPlan(col, pct, catCols) {
  const steps = [
    { step: 1, action: `Identify the time/period when ${col} started falling` },
    { step: 2, action: `Segment by ${catCols[0] || 'category'} to find which group drives the drop` },
    { step: 3, action: `Compare with external factors (seasonality, competition, pricing)` },
    { step: 4, action: `Set a recovery target: restore ${col} to previous level within 60 days` },
    { step: 5, action: `Create intervention: run promotion / adjust pricing / increase outreach` },
  ];
  if (pct < -30) steps.push({ step: 6, action: 'URGENT: Escalate to leadership — drop exceeds 30%' });
  return steps;
}
function generateRisePlan(col, pct) {
  return [
    { step: 1, action: `Document what changed to cause the ${col} increase` },
    { step: 2, action: 'Double down: allocate more resources to what\'s working' },
    { step: 3, action: `Set a stretch target: sustain this ${pct.toFixed(0)}% growth rate` },
    { step: 4, action: 'Share this win with the team — celebrate and replicate' },
  ];
}
function generateVolatilePlan(col, cv) {
  return [
    { step: 1, action: `Find the outliers causing ${col} to swing — check the table view` },
    { step: 2, action: 'Consider 7-day rolling average to smooth the volatility' },
    { step: 3, action: 'Identify if volatility is seasonal or random' },
    { step: 4, action: cv > 120 ? 'Consider data validation — some values may be errors' : 'Set control bands: flag values outside ±2 standard deviations' },
  ];
}

// ════════════════════════════════════════════════════════════
// FEATURE 2 — ELI5 (EXPLAIN LIKE I'M 5)
// Takes a technical insight string and rewrites it in plain English.
// ════════════════════════════════════════════════════════════
export function eli5Insight(insight, col, metrics = {}) {
  const { mean: m, stddev: sd, cv, min, max, correlation, corrWith } = metrics;

  // Pattern-match the insight type and return kid-friendly explanation
  if (correlation !== undefined) {
    const strength = Math.abs(correlation) > 0.7 ? 'very closely' : Math.abs(correlation) > 0.4 ? 'somewhat' : 'not much';
    const direction = correlation > 0 ? 'go up together' : 'when one goes up, the other goes down';
    return `🧒 Think of it like this: <b>${col}</b> and <b>${corrWith}</b> are connected ${strength}. When one changes, the other tends to ${direction}. It's like how when it rains more, umbrella sales go up!`;
  }
  if (cv !== undefined) {
    if (cv > 80) return `🧒 The numbers in <b>${col}</b> are all over the place! Imagine someone's mood that changes a LOT every day. That's what's happening here — it's hard to predict what comes next.`;
    if (cv < 20) return `🧒 The numbers in <b>${col}</b> are very steady and predictable — like your heartbeat. They don't change much, which is usually a good sign!`;
    return `🧒 The numbers in <b>${col}</b> change a medium amount — not super steady, but not crazy either. Like the weather — you can make a rough guess but it's not always exact.`;
  }
  if (m !== undefined && max !== undefined) {
    return `🧒 For <b>${col}</b>: most of the time you get about <b>${formatN(m)}</b>. The highest it ever got was <b>${formatN(max)}</b> and the lowest was <b>${formatN(min)}</b>. Imagine it like test scores — the average student scores ${formatN(m)}, but the best scored ${formatN(max)}!`;
  }
  // Fallback: simplify any HTML insight
  return '🧒 ' + insight
    .replace(/<b>/g, '').replace(/<\/b>/g, '')
    .replace(/CV=/g, 'variability = ')
    .replace(/\bstddev\b/gi, 'typical swing')
    .replace(/\bvariance\b/gi, 'how much it changes')
    .replace(/\bcorrelation\b/gi, 'connection')
    .replace(/\boutlier/gi, 'weird data point')
    .replace(/\bnull\b/gi, 'missing value')
    .replace(/\bcolumn\b/gi, 'field')
    .replace(/\bstandard deviation\b/gi, 'typical variation');
}

// ════════════════════════════════════════════════════════════
// FEATURE 3 — AUTO STORYTELLING
// Generates a human narrative paragraph about the dataset.
// ════════════════════════════════════════════════════════════
export function generateStory(cleanData, numericCols, catCols, fileName) {
  if (!cleanData.length || !numericCols.length) return null;

  const paragraphs = [];
  const dataName = fileName.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');

  // Opening
  paragraphs.push(`📖 Your dataset <b>"${dataName}"</b> contains <b>${cleanData.length.toLocaleString()} records</b> across <b>${numericCols.length + catCols.length} fields</b>. Here's what the data is telling you:`);

  // Main metric story
  const primary = numericCols[0];
  const vals = cleanData.map(r => r[primary]).filter(v => v != null && !isNaN(v));
  if (vals.length) {
    const m   = mean(vals);
    const mx  = safeMax(vals);
    const mn  = safeMin(vals);
    const h1m = mean(vals.slice(0, Math.floor(vals.length / 2)));
    const h2m = mean(vals.slice(Math.floor(vals.length / 2)));
    const pct = h1m ? ((h2m - h1m) / Math.abs(h1m) * 100) : 0;
    const trend = Math.abs(pct) < 5 ? 'remained stable' : pct > 0 ? `grew by ${pct.toFixed(0)}%` : `dropped by ${Math.abs(pct).toFixed(0)}%`;
    const emoji = Math.abs(pct) < 5 ? '➡️' : pct > 0 ? '📈' : '📉';

    paragraphs.push(`${emoji} <b>${primary}</b> ${trend} across the dataset, averaging <b>${formatN(m)}</b>. The peak was <b>${formatN(mx)}</b> and the lowest point was <b>${formatN(mn)}</b>.`);
  }

  // Category insight
  if (catCols.length) {
    const cat = catCols[0];
    const cnt = {};
    cleanData.forEach(r => { const v = String(r[cat] ?? '—'); cnt[v] = (cnt[v] || 0) + 1; });
    const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const topPct = (top[0][1] / cleanData.length * 100).toFixed(0);

    // Cross-metric by category
    if (numericCols.length && top.length >= 2) {
      const metric = numericCols[0];
      const catAvgs = top.map(([k]) => {
        const v = cleanData.filter(r => String(r[cat]) === k).map(r => r[metric]).filter(v => v != null && !isNaN(v));
        return { name: k, avg: v.length ? mean(v) : 0 };
      }).sort((a, b) => b.avg - a.avg);

      paragraphs.push(`🏆 Breaking down by <b>${cat}</b>: <b>"${catAvgs[0].name}"</b> leads with an average ${metric} of <b>${formatN(catAvgs[0].avg)}</b>, while <b>"${catAvgs[catAvgs.length-1].name}"</b> lags at <b>${formatN(catAvgs[catAvgs.length-1].avg)}</b>.`);
    }
    paragraphs.push(`📌 <b>"${top[0][0]}"</b> is the dominant ${cat} (${topPct}% of all records), followed by "${top[1]?.[0] || '—'}" and "${top[2]?.[0] || '—'}".`);
  }

  // Correlation story
  if (numericCols.length >= 2) {
    let bestR = 0, bestPair = null;
    for (let i = 0; i < Math.min(numericCols.length, 5); i++) {
      for (let j = i + 1; j < Math.min(numericCols.length, 5); j++) {
        const a = cleanData.map(r => r[numericCols[i]]).filter(v => v != null && !isNaN(v));
        const b = cleanData.map(r => r[numericCols[j]]).filter(v => v != null && !isNaN(v));
        const r = pearson(a.slice(0, Math.min(a.length, b.length)), b.slice(0, Math.min(a.length, b.length)));
        if (Math.abs(r) > Math.abs(bestR)) { bestR = r; bestPair = [numericCols[i], numericCols[j]]; }
      }
    }
    if (bestPair && Math.abs(bestR) > 0.3) {
      const dir = bestR > 0 ? 'move together' : 'move in opposite directions';
      const str = Math.abs(bestR) > 0.7 ? 'strongly' : Math.abs(bestR) > 0.4 ? 'moderately' : 'weakly';
      paragraphs.push(`🔗 <b>${bestPair[0]}</b> and <b>${bestPair[1]}</b> are ${str} linked — they tend to ${dir} (r=${bestR.toFixed(2)}). When ${bestPair[0]} increases, ${bestPair[1]} ${bestR > 0 ? 'also tends to increase' : 'tends to decrease'}.`);
    }
  }

  // Closing recommendation
  const nullCount = cleanData.reduce((a, r) => a + (numericCols.concat(catCols)).filter(c => r[c] == null || r[c] === '').length, 0);
  if (nullCount > 0) {
    paragraphs.push(`⚠️ <b>${nullCount} missing values</b> were found across the dataset. Consider using the Clean Studio to handle them before drawing conclusions.`);
  } else {
    paragraphs.push(`✅ The dataset appears <b>complete with no missing values</b> — your analysis is built on solid ground.`);
  }

  return paragraphs;
}

// ════════════════════════════════════════════════════════════
// FEATURE 4 — DECISION FEED
// Instagram-style scrollable feed of insights + actions.
// ════════════════════════════════════════════════════════════
export function buildDecisionFeed(cleanData, numericCols, catCols) {
  const feed = [];

  numericCols.slice(0, 5).forEach((col, idx) => {
    const vals = cleanData.map(r => r[col]).filter(v => v != null && !isNaN(v));
    if (!vals.length) return;
    const m  = mean(vals), sd = stddev(vals);
    const mx = safeMax(vals), mn = safeMin(vals);
    const cv = m ? (sd / Math.abs(m) * 100) : 0;
    const h1 = mean(vals.slice(0, Math.floor(vals.length / 2)));
    const h2 = mean(vals.slice(Math.floor(vals.length / 2)));
    const pct = h1 ? ((h2 - h1) / Math.abs(h1) * 100) : 0;

    feed.push({
      id: `stat-${idx}`,
      type: 'stat',
      icon: '📊',
      accentColor: ['#5b8ff9','#34d399','#fbbf24','#7c6bf5','#fb7185'][idx % 5],
      title: col,
      headline: `Average: ${formatN(m)}`,
      body: `Range ${formatN(mn)} – ${formatN(mx)} · CV: ${cv.toFixed(0)}%`,
      trend: pct,
      trendLabel: pct > 1 ? `+${pct.toFixed(1)}%` : pct < -1 ? `${pct.toFixed(1)}%` : 'Stable',
      trendColor: pct > 5 ? '#34d399' : pct < -5 ? '#ef4444' : '#8892b0',
      action: Math.abs(pct) > 15 ? {
        label: pct < 0 ? '🔧 Fix This Drop' : '🚀 Amplify Growth',
        type: pct < 0 ? 'fix' : 'amplify',
        col, pct,
      } : null,
    });
  });

  catCols.slice(0, 3).forEach((col, idx) => {
    const cnt = {};
    cleanData.forEach(r => { const v = String(r[col] ?? '—'); cnt[v] = (cnt[v] || 0) + 1; });
    const ents = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const total = ents.reduce((a, e) => a + e[1], 0);

    feed.push({
      id: `cat-${idx}`,
      type: 'category',
      icon: '🏷',
      accentColor: '#f97316',
      title: col,
      headline: `${ents.length} unique values`,
      body: `Top: "${ents[0]?.[0]}" (${(ents[0]?.[1]/total*100).toFixed(0)}%)`,
      bars: ents.map(([k, v]) => ({ label: k, value: v, pct: v / total * 100 })),
      action: null,
    });
  });

  // Correlation cards
  if (numericCols.length >= 2) {
    for (let i = 0; i < Math.min(numericCols.length, 4); i++) {
      for (let j = i + 1; j < Math.min(numericCols.length, 4); j++) {
        const a = cleanData.map(r => r[numericCols[i]]).filter(v => v != null && !isNaN(v));
        const b = cleanData.map(r => r[numericCols[j]]).filter(v => v != null && !isNaN(v));
        const r = pearson(a.slice(0, Math.min(a.length, b.length)), b.slice(0, Math.min(a.length, b.length)));
        if (Math.abs(r) > 0.5) {
          feed.push({
            id: `corr-${i}-${j}`,
            type: 'correlation',
            icon: r > 0 ? '🔗' : '↔️',
            accentColor: Math.abs(r) > 0.7 ? '#34d399' : '#fbbf24',
            title: `${numericCols[i]} ↔ ${numericCols[j]}`,
            headline: `${Math.abs(r) > 0.7 ? 'Strong' : 'Moderate'} ${r > 0 ? 'positive' : 'negative'} correlation`,
            body: `r = ${r.toFixed(3)} · These metrics are linked`,
            correlation: r,
            action: {
              label: '💡 See What This Means',
              type: 'explain_correlation',
              col1: numericCols[i], col2: numericCols[j], r,
            },
          });
          break; // only one correlation card
        }
      }
    }
  }

  return feed;
}

// ════════════════════════════════════════════════════════════
// FEATURE 5 — WHAT SHOULD I DO NEXT?
// Generates 5-7 concrete, prioritized action items.
// ════════════════════════════════════════════════════════════
export function generateNextSteps(cleanData, numericCols, catCols, fileName) {
  const steps = [];
  const priorities = { high: '🔴', medium: '🟡', low: '🟢' };

  // Data quality actions
  const nullCount = cleanData.reduce((a, r) =>
    a + [...numericCols, ...catCols].filter(c => r[c] == null || r[c] === '').length, 0);
  if (nullCount > 0) {
    steps.push({ priority: 'high', icon: '🕳', title: 'Fix missing data first', desc: `${nullCount} null values detected. Go to Clean Studio → Fill nulls with mean (for numbers) or remove null rows.`, view: 'clean' });
  }

  // Metric-specific steps
  numericCols.slice(0, 3).forEach(col => {
    const vals = cleanData.map(r => r[col]).filter(v => v != null && !isNaN(v));
    if (!vals.length) return;
    const m  = mean(vals), sd = stddev(vals), cv = m ? sd / Math.abs(m) * 100 : 0;
    const h1 = mean(vals.slice(0, Math.floor(vals.length / 2)));
    const h2 = mean(vals.slice(Math.floor(vals.length / 2)));
    const pct = h1 ? ((h2 - h1) / Math.abs(h1) * 100) : 0;

    if (pct < -20) {
      steps.push({ priority: 'high', icon: '📉', title: `Investigate ${col} decline`, desc: `${col} dropped ${Math.abs(pct).toFixed(0)}%. Filter the table by time period to find when it started. Look at the scatter chart to find a correlated column.`, view: 'charts' });
    }
    if (cv > 100) {
      steps.push({ priority: 'medium', icon: '⚡', title: `Stabilize ${col}`, desc: `High variability (CV=${cv.toFixed(0)}%) suggests inconsistency. Check for outliers in Clean Studio, or group data by ${catCols[0] || 'category'} to find the source.`, view: 'clean' });
    }
  });

  // Category-based steps
  if (catCols.length && numericCols.length) {
    const cat = catCols[0], metric = numericCols[0];
    const map = {};
    cleanData.forEach(r => {
      const v = String(r[cat] ?? '—');
      if (!map[v]) map[v] = [];
      const n = r[metric];
      if (n != null && !isNaN(n)) map[v].push(n);
    });
    const avgs = Object.entries(map).map(([k, v]) => ({ k, avg: mean(v) })).sort((a, b) => b.avg - a.avg);
    if (avgs.length >= 2) {
      const best  = avgs[0], worst = avgs[avgs.length - 1];
      const gap   = best.avg - worst.avg;
      if (gap > 0) {
        steps.push({ priority: 'medium', icon: '🎯', title: `Focus on "${best.k}" in ${cat}`, desc: `"${best.k}" has ${formatN(best.avg)} avg ${metric} vs "${worst.k}" at ${formatN(worst.avg)}. Replicate what works in "${best.k}" across other groups.`, view: 'charts' });
        steps.push({ priority: 'low', icon: '💡', title: `Investigate "${worst.k}" underperformance`, desc: `"${worst.k}" lags by ${formatN(gap)} in ${metric}. Consider targeted interventions or resource reallocation.`, view: 'insights' });
      }
    }
  }

  // Always suggest insights
  steps.push({ priority: 'low', icon: '🔍', title: 'Run full AI insights', desc: 'Get a complete statistical analysis including correlations, outlier detection, and distribution analysis.', view: 'insights' });
  steps.push({ priority: 'low', icon: '📤', title: 'Export clean dataset', desc: `After cleaning, export ${cleanData.length.toLocaleString()} rows as CSV for sharing with your team or importing into other tools.`, view: 'export' });

  // Sort by priority
  const order = { high: 0, medium: 1, low: 2 };
  return steps.sort((a, b) => order[a.priority] - order[b.priority]).slice(0, 7);
}

// ════════════════════════════════════════════════════════════
// FEATURE 6 — MESSY DATA FIXER (AUTO-DETECT ALL ISSUES)
// Returns a comprehensive data quality report with specific fixes.
// ════════════════════════════════════════════════════════════
export function analyzeDataQuality(cleanData, columns, numericCols, catCols) {
  const issues = [];
  let totalScore = 100;

  // 1. Missing values per column
  columns.forEach(col => {
    const nulls  = cleanData.filter(r => r[col] == null || r[col] === '').length;
    const pct    = (nulls / cleanData.length * 100);
    if (pct > 0) {
      const severity = pct > 30 ? 'critical' : pct > 10 ? 'warning' : 'info';
      totalScore -= pct > 30 ? 15 : pct > 10 ? 7 : 2;
      issues.push({
        type: 'missing', severity, icon: '🕳', col,
        title: `${nulls} missing values in "${col}"`,
        detail: `${pct.toFixed(1)}% of rows are empty`,
        fix: numericCols.includes(col)
          ? 'fill_nulls_mean'
          : pct > 30 ? 'consider dropping this column' : 'fill_nulls_0',
        fixLabel: numericCols.includes(col) ? 'Fill with column mean' : 'Fill with 0',
        autoFix: numericCols.includes(col) ? 'fill_nulls_mean' : 'fill_nulls_0',
      });
    }
  });

  // 2. Duplicates
  const seen = new Set();
  let dupeCount = 0;
  cleanData.forEach(r => {
    const k = JSON.stringify(r);
    if (seen.has(k)) dupeCount++;
    else seen.add(k);
  });
  if (dupeCount > 0) {
    totalScore -= Math.min(dupeCount / cleanData.length * 50, 20);
    issues.push({
      type: 'duplicates', severity: dupeCount > 10 ? 'warning' : 'info', icon: '🔁', col: null,
      title: `${dupeCount} duplicate rows detected`,
      detail: `${(dupeCount / cleanData.length * 100).toFixed(1)}% of data is repeated`,
      fix: 'remove_dupes', fixLabel: 'Remove duplicates', autoFix: 'remove_dupes',
    });
  }

  // 3. Outliers per numeric column
  numericCols.forEach(col => {
    const vals    = cleanData.map(r => r[col]).filter(v => v != null && !isNaN(v));
    if (vals.length < 4) return;
    const m       = mean(vals), sd = stddev(vals);
    const outliers = vals.filter(v => Math.abs(v - m) > 3 * sd);
    if (outliers.length > 0) {
      totalScore -= Math.min(outliers.length * 3, 10);
      issues.push({
        type: 'outliers', severity: outliers.length > 5 ? 'warning' : 'info', icon: '📉', col,
        title: `${outliers.length} outlier${outliers.length > 1 ? 's' : ''} in "${col}"`,
        detail: `Values beyond ±3σ: ${outliers.map(v => formatN(v)).slice(0, 3).join(', ')}${outliers.length > 3 ? '...' : ''}`,
        fix: 'remove_outliers', fixLabel: 'Remove outliers', autoFix: 'remove_outliers',
      });
    }
  });

  // 4. Mixed case text
  let mixedCaseCount = 0;
  catCols.forEach(col => {
    const samples = cleanData.slice(0, 100).map(r => r[col]).filter(v => typeof v === 'string');
    const mixed = samples.filter(v => v !== v.toLowerCase() && v !== v.toUpperCase() && v !== v.replace(/\b\w/g, l => l.toUpperCase()));
    mixedCaseCount += mixed.length;
  });
  if (mixedCaseCount > 5) {
    totalScore -= 3;
    issues.push({
      type: 'case', severity: 'info', icon: '🔡', col: null,
      title: 'Inconsistent text casing',
      detail: `${mixedCaseCount} values with mixed case found`,
      fix: 'standardize_case', fixLabel: 'Standardize to Title Case', autoFix: 'standardize_case',
    });
  }

  // 5. Leading/trailing whitespace
  let wsCount = 0;
  cleanData.slice(0, 200).forEach(r => {
    catCols.forEach(col => {
      if (typeof r[col] === 'string' && r[col] !== r[col].trim()) wsCount++;
    });
  });
  if (wsCount > 0) {
    totalScore -= 2;
    issues.push({
      type: 'whitespace', severity: 'info', icon: '✂️', col: null,
      title: `${wsCount} values with extra spaces`,
      detail: 'Leading or trailing whitespace can cause grouping errors',
      fix: 'trim_strings', fixLabel: 'Trim whitespace', autoFix: 'trim_strings',
    });
  }

  return {
    score:      Math.max(0, Math.round(totalScore)),
    grade:      totalScore >= 90 ? 'A' : totalScore >= 75 ? 'B' : totalScore >= 60 ? 'C' : 'D',
    gradeColor: totalScore >= 90 ? '#34d399' : totalScore >= 75 ? '#fbbf24' : totalScore >= 60 ? '#f97316' : '#ef4444',
    issues:     issues.sort((a, b) => { const o = {critical:0,warning:1,info:2}; return o[a.severity]-o[b.severity]; }),
    autoFixable: issues.filter(i => i.autoFix).map(i => i.autoFix),
  };
}

// ════════════════════════════════════════════════════════════
// FEATURE 7 — STYLE LEARNER
// Tracks which metrics/categories user clicks most and
// boosts those to the top of insights / feed.
// Stored in localStorage so it persists across sessions.
// ════════════════════════════════════════════════════════════
const STYLE_KEY = 'dv_user_style';

export function recordInteraction(col, interactionType) {
  // interactionType: 'view' | 'click' | 'expand' | 'export' | 'action'
  try {
    const raw   = localStorage.getItem(STYLE_KEY);
    const style = raw ? JSON.parse(raw) : { cols: {}, types: {}, totalSessions: 0 };
    if (!style.cols[col]) style.cols[col] = 0;
    style.cols[col] += interactionType === 'action' ? 3 : interactionType === 'click' ? 2 : 1;
    if (!style.types[interactionType]) style.types[interactionType] = 0;
    style.types[interactionType]++;
    localStorage.setItem(STYLE_KEY, JSON.stringify(style));
  } catch {}
}

export function getPersonalizedOrder(cols) {
  try {
    const raw   = localStorage.getItem(STYLE_KEY);
    if (!raw) return cols;
    const style = JSON.parse(raw);
    return [...cols].sort((a, b) => (style.cols[b] || 0) - (style.cols[a] || 0));
  } catch { return cols; }
}

export function getUserStyleProfile() {
  try {
    const raw = localStorage.getItem(STYLE_KEY);
    if (!raw) return null;
    const style = JSON.parse(raw);
    const topCols = Object.entries(style.cols || {})
      .sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]);
    return { topCols, interactions: style.types || {}, hasHistory: topCols.length > 0 };
  } catch { return null; }
}
