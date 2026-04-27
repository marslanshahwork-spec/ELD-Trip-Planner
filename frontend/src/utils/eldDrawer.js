/**
 * ELD Log Sheet Canvas Drawer — Official FMCSA Style
 * Replicates the U.S. DOT Driver's Daily Log form with:
 * - Government header with all official fields
 * - Blue grid with 15-minute tick marks
 * - Bold status lines with vertical transitions
 * - Red dots at transition points
 * - Hour labels top & bottom (Midnight–11, Noon–11)
 * - Total Hours column
 * - Diagonal remarks section
 */

const STATUS_ROWS = ['off_duty', 'sleeper', 'driving', 'on_duty'];
const ROW_LABELS = [
  '1: OFF DUTY',
  '2: SLEEPER\n   BERTH',
  '3: DRIVING',
  '4: ON DUTY\n   (NOT DRIVING)',
];

export function drawELDLog(canvas, dailyLog) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth || 920;
  const H = canvas.clientHeight || 580;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  // ── Layout ──
  const HEADER_H = 120;
  const GRID_LEFT = 120;
  const GRID_RIGHT = W - 55;
  const GRID_TOP = HEADER_H + 24;
  const ROW_H = 44;
  const GRID_BOTTOM = GRID_TOP + ROW_H * 4;
  const GRID_W = GRID_RIGHT - GRID_LEFT;
  const HOUR_W = GRID_W / 24;
  const TOTALS_X = GRID_RIGHT + 4;
  const REMARKS_TOP = GRID_BOTTOM + 30;

  // ── Background ──
  ctx.fillStyle = '#f0f4fa';
  ctx.fillRect(0, 0, W, H);

  // Outer border
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 2;
  ctx.strokeRect(4, 4, W - 8, H - 8);

  // ── Header ──
  _drawOfficialHeader(ctx, W, HEADER_H, dailyLog);

  // ── Grid Background ──
  ctx.fillStyle = '#e8eef8';
  ctx.fillRect(GRID_LEFT, GRID_TOP, GRID_W, ROW_H * 4);

  // ── Grid Lines ──
  _drawOfficialGrid(ctx, GRID_LEFT, GRID_TOP, GRID_RIGHT, GRID_BOTTOM, GRID_W, ROW_H, HOUR_W);

  // ── Hour Labels (top & bottom) ──
  _drawHourLabels(ctx, GRID_LEFT, GRID_TOP, GRID_BOTTOM, HOUR_W);

  // ── Row Labels ──
  _drawRowLabels(ctx, GRID_LEFT, GRID_TOP, ROW_H);

  // ── Total Hours Column ──
  _drawTotalsColumn(ctx, TOTALS_X, GRID_TOP, ROW_H, dailyLog.total_hours);

  // ── Draw Status Lines ──
  _drawStatusLines(ctx, dailyLog.entries, GRID_LEFT, GRID_TOP, HOUR_W, ROW_H);

  // ── Grid Outer Border ──
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 2;
  ctx.strokeRect(GRID_LEFT, GRID_TOP, GRID_W, ROW_H * 4);

  // ── Remarks Section ──
  _drawRemarksSection(ctx, dailyLog.entries, GRID_LEFT, GRID_TOP, GRID_BOTTOM, REMARKS_TOP, HOUR_W, W);
}

// ════════════════════════════════════════
// HEADER — Official FMCSA form layout
// ════════════════════════════════════════
function _drawOfficialHeader(ctx, W, H, dailyLog) {
  const LM = 14; // left margin

  // Title block background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(6, 6, W - 12, H);
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 1;
  ctx.strokeRect(6, 6, W - 12, H);

  // "U.S. DEPARTMENT OF TRANSPORTATION"
  ctx.fillStyle = '#1a1a1a';
  ctx.font = 'bold 9px "Times New Roman", serif';
  ctx.textAlign = 'left';
  ctx.fillText('U.S. DEPARTMENT OF TRANSPORTATION', LM, 22);

  // Main title
  ctx.font = 'bold 14px "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.fillText("DRIVER'S DAILY LOG", W / 2 - 40, 22);

  ctx.font = '9px "Times New Roman", serif';
  ctx.fillText('(ONE CALENDAR DAY — 24 HOURS)', W / 2 - 40, 34);

  // Original/Duplicate notice
  ctx.textAlign = 'right';
  ctx.font = '7.5px "Times New Roman", serif';
  ctx.fillText('ORIGINAL — Submit to carrier within 13 days', W - LM, 18);
  ctx.fillText('DUPLICATE — Driver retains possession for eight days', W - LM, 28);

  // ── Row 1: Date + Miles + Vehicle ──
  const row1Y = 46;
  ctx.textAlign = 'left';
  ctx.font = '8px "Times New Roman", serif';
  ctx.fillStyle = '#1a1a1a';

  // Date
  const dateObj = dailyLog.date ? new Date(dailyLog.date + 'T00:00:00') : new Date();
  const month = dateObj.toLocaleString('en-US', { month: 'long' });
  const day = dateObj.getDate();
  const year = dateObj.getFullYear();

  ctx.font = 'bold 12px "Times New Roman", serif';
  ctx.fillText(`${month}`, LM + 10, row1Y);
  ctx.fillText(`${day}`, LM + 85, row1Y);
  ctx.fillText(`${year}`, LM + 115, row1Y);

  ctx.font = '7px "Times New Roman", serif';
  ctx.fillStyle = '#555';
  ctx.fillText('(MONTH)', LM + 20, row1Y + 10);
  ctx.fillText('(DAY)', LM + 82, row1Y + 10);
  ctx.fillText('(YEAR)', LM + 112, row1Y + 10);

  // Underlines for date
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 0.5;
  [LM + 5, LM + 75, LM + 105].forEach((x, i) => {
    ctx.beginPath();
    ctx.moveTo(x, row1Y + 2);
    ctx.lineTo(x + [65, 25, 40][i], row1Y + 2);
    ctx.stroke();
  });

  // Total miles
  ctx.fillStyle = '#1a1a1a';
  ctx.font = 'bold 12px "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${dailyLog.total_miles || 0}`, W / 2 - 30, row1Y);
  ctx.font = '7px "Times New Roman", serif';
  ctx.fillStyle = '#555';
  ctx.fillText('(TOTAL MILES DRIVING TODAY)', W / 2 - 30, row1Y + 10);
  ctx.beginPath();
  ctx.moveTo(W / 2 - 90, row1Y + 2);
  ctx.lineTo(W / 2 + 30, row1Y + 2);
  ctx.stroke();

  // Vehicle numbers
  ctx.textAlign = 'right';
  ctx.font = '7px "Times New Roman", serif';
  ctx.fillStyle = '#555';
  ctx.fillText('VEHICLE NUMBERS—(SHOW EACH UNIT)', W - LM, row1Y + 10);
  ctx.beginPath();
  ctx.moveTo(W - 220, row1Y + 2);
  ctx.lineTo(W - LM, row1Y + 2);
  ctx.stroke();

  // ── Row 2: Certification ──
  const row2Y = 66;
  ctx.textAlign = 'center';
  ctx.font = 'italic 8px "Times New Roman", serif';
  ctx.fillStyle = '#333';
  ctx.fillText('I certify that these entries are true and correct', W / 2, row2Y);

  // ── Row 3: Carrier + Signature ──
  const row3Y = 82;
  ctx.textAlign = 'left';
  ctx.font = '7px "Times New Roman", serif';
  ctx.fillStyle = '#555';

  ctx.beginPath();
  ctx.moveTo(LM, row3Y + 2);
  ctx.lineTo(W / 2 - 20, row3Y + 2);
  ctx.stroke();
  ctx.fillText('(NAME OF CARRIER OR CARRIERS)', LM + 40, row3Y + 12);

  ctx.beginPath();
  ctx.moveTo(W / 2, row3Y + 2);
  ctx.lineTo(W - LM, row3Y + 2);
  ctx.stroke();
  ctx.fillText("(DRIVER'S SIGNATURE IN FULL)", W / 2 + 60, row3Y + 12);

  // ── Row 4: Address + Co-Driver + Total Hours ──
  const row4Y = 100;
  ctx.beginPath();
  ctx.moveTo(LM, row4Y + 2);
  ctx.lineTo(W / 2 - 80, row4Y + 2);
  ctx.stroke();
  ctx.fillText('(MAIN OFFICE ADDRESS)', LM + 30, row4Y + 12);

  ctx.beginPath();
  ctx.moveTo(W / 2 - 60, row4Y + 2);
  ctx.lineTo(W - 100, row4Y + 2);
  ctx.stroke();
  ctx.fillText('(NAME OF CO. DRIVER)', W / 2 + 10, row4Y + 12);

  // Total Hours header
  ctx.font = 'bold 8px "Times New Roman", serif';
  ctx.fillStyle = '#1a1a1a';
  ctx.textAlign = 'center';
  ctx.fillText('TOTAL', W - 40, row4Y - 4);
  ctx.fillText('HOURS', W - 40, row4Y + 6);
}

// ════════════════════════════════════════
// GRID — Blue lines with 15-min ticks
// ════════════════════════════════════════
function _drawOfficialGrid(ctx, left, top, right, bottom, gridW, rowH, hourW) {
  // Horizontal row dividers
  ctx.strokeStyle = '#8ba4cc';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = top + i * rowH;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
  }

  // Vertical hour lines (full height)
  for (let h = 0; h <= 24; h++) {
    const x = left + h * hourW;
    if (h === 0 || h === 12 || h === 24) {
      ctx.strokeStyle = '#4a6a9a';
      ctx.lineWidth = 2;
    } else {
      ctx.strokeStyle = '#8ba4cc';
      ctx.lineWidth = 1;
    }
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();
  }

  // 15-minute tick marks
  ctx.strokeStyle = '#8ba4cc';
  ctx.lineWidth = 0.5;
  for (let h = 0; h < 24; h++) {
    for (let q = 1; q < 4; q++) {
      const x = left + (h + q * 0.25) * hourW;
      const tickLen = q === 2 ? 8 : 5; // half-hour tick is longer
      // Ticks from each row boundary
      for (let r = 0; r <= 4; r++) {
        const rowY = top + r * rowH;
        ctx.beginPath();
        ctx.moveTo(x, rowY);
        ctx.lineTo(x, rowY + tickLen);
        ctx.stroke();
        if (r > 0) {
          ctx.beginPath();
          ctx.moveTo(x, rowY - tickLen);
          ctx.lineTo(x, rowY);
          ctx.stroke();
        }
      }
    }
  }
}

// ════════════════════════════════════════
// HOUR LABELS — Top and Bottom
// ════════════════════════════════════════
function _drawHourLabels(ctx, left, top, bottom, hourW) {
  const labels = [
    'Mid-\nnight', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11',
    'Noon', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', ''
  ];

  ctx.textAlign = 'center';
  ctx.font = 'bold 8px "Times New Roman", serif';
  ctx.fillStyle = '#1a1a1a';

  labels.forEach((label, h) => {
    const x = left + h * hourW;
    if (label.includes('\n')) {
      const parts = label.split('\n');
      ctx.fillText(parts[0], x, top - 12);
      ctx.fillText(parts[1], x, top - 4);
      // Bottom
      ctx.fillText(parts[0], x, bottom + 10);
      ctx.fillText(parts[1], x, bottom + 18);
    } else if (label) {
      ctx.fillText(label, x, top - 5);
      ctx.fillText(label, x, bottom + 12);
    }
  });
}

// ════════════════════════════════════════
// ROW LABELS — Left side
// ════════════════════════════════════════
function _drawRowLabels(ctx, left, top, rowH) {
  ctx.textAlign = 'right';
  ctx.fillStyle = '#1a1a1a';

  ROW_LABELS.forEach((label, i) => {
    const y = top + i * rowH + rowH / 2;
    const lines = label.split('\n');
    if (lines.length === 1) {
      ctx.font = 'bold 9px "Times New Roman", serif';
      ctx.fillText(lines[0], left - 6, y + 3);
    } else {
      ctx.font = 'bold 9px "Times New Roman", serif';
      ctx.fillText(lines[0], left - 6, y - 2);
      ctx.font = '8px "Times New Roman", serif';
      ctx.fillText(lines[1].trim(), left - 6, y + 9);
    }
  });
}

// ════════════════════════════════════════
// TOTAL HOURS — Right column
// ════════════════════════════════════════
function _drawTotalsColumn(ctx, x, top, rowH, totalHours) {
  if (!totalHours) return;

  // Column border
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, top, 42, rowH * 4);

  const values = [
    totalHours.off_duty || 0,
    totalHours.sleeper || 0,
    totalHours.driving || 0,
    totalHours.on_duty || 0,
  ];

  ctx.textAlign = 'center';
  ctx.font = 'bold 12px "Times New Roman", serif';
  ctx.fillStyle = '#1a1a1a';

  values.forEach((val, i) => {
    const cy = top + i * rowH + rowH / 2 + 4;
    // Row dividers
    if (i > 0) {
      ctx.beginPath();
      ctx.moveTo(x, top + i * rowH);
      ctx.lineTo(x + 42, top + i * rowH);
      ctx.stroke();
    }
    ctx.fillText(_fmtH(val), x + 21, cy);
  });

  // Total sum line
  const total = values.reduce((a, b) => a + b, 0);
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, top + 4 * rowH);
  ctx.lineTo(x + 42, top + 4 * rowH);
  ctx.stroke();
  ctx.font = 'bold 13px "Times New Roman", serif';
  ctx.fillText(_fmtH(total), x + 21, top + 4 * rowH + 16);
}

// ════════════════════════════════════════
// STATUS LINES — Bold lines + red dots
// ════════════════════════════════════════
function _drawStatusLines(ctx, entries, left, top, hourW, rowH) {
  if (!entries || entries.length === 0) return;

  const statusToRow = { off_duty: 0, sleeper: 1, driving: 2, on_duty: 3 };
  const transitions = []; // for red dots

  // First pass: draw thick horizontal + vertical lines
  ctx.strokeStyle = '#0a0a0a';
  ctx.lineWidth = 3;
  ctx.lineCap = 'butt';

  let prevEndX = null;
  let prevY = null;

  entries.forEach((entry) => {
    const row = statusToRow[entry.status];
    if (row === undefined) return;

    const startX = left + entry.start_hour * hourW;
    const endX = left + entry.end_hour * hourW;
    const y = top + row * rowH + rowH / 2;

    // Vertical transition from previous
    if (prevEndX !== null && prevY !== null && Math.abs(prevY - y) > 1) {
      ctx.beginPath();
      ctx.moveTo(startX, prevY);
      ctx.lineTo(startX, y);
      ctx.stroke();
      transitions.push({ x: startX, y1: prevY, y2: y });
    }

    // Horizontal status line
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
    ctx.stroke();

    prevEndX = endX;
    prevY = y;
  });

  // Second pass: red dots at all transition points
  transitions.forEach(({ x, y1, y2 }) => {
    _drawDot(ctx, x, y1);
    _drawDot(ctx, x, y2);
  });
}

function _drawDot(ctx, x, y) {
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#7f1d1d';
  ctx.lineWidth = 1;
  ctx.stroke();
}

// ════════════════════════════════════════
// REMARKS — Diagonal text with lines
// ════════════════════════════════════════
function _drawRemarksSection(ctx, entries, gridLeft, gridTop, gridBottom, remarksTop, hourW, W) {
  // "REMARKS" label
  ctx.fillStyle = '#1a1a1a';
  ctx.font = 'bold 10px "Times New Roman", serif';
  ctx.textAlign = 'left';
  ctx.fillText('REMARKS', 14, remarksTop + 4);

  // Remarks box
  const boxTop = remarksTop - 6;
  const boxH = 110;
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 1;
  ctx.strokeRect(gridLeft, boxTop, W - gridLeft - 14, boxH);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(gridLeft + 1, boxTop + 1, W - gridLeft - 16, boxH - 2);

  // Collect remarks from entries that have meaningful location/notes
  const remarks = [];
  const seen = new Set();
  entries.forEach(entry => {
    if (!entry.location || !entry.notes || entry.notes === 'Off duty') return;
    const key = entry.notes + '|' + entry.start_hour;
    if (seen.has(key)) return;
    seen.add(key);
    remarks.push({
      hour: entry.start_hour,
      location: entry.location,
      notes: entry.notes,
    });
  });

  // Draw diagonal remarks with connecting lines
  remarks.slice(0, 8).forEach((remark, idx) => {
    const lineX = gridLeft + remark.hour * hourW;
    const remarkX = gridLeft + 20 + idx * ((W - gridLeft - 60) / Math.min(remarks.length, 8));

    // Vertical line from grid down to remarks area
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(lineX, gridBottom);
    ctx.lineTo(lineX, boxTop + 14);
    ctx.stroke();
    ctx.setLineDash([]);

    // Diagonal text
    ctx.save();
    ctx.translate(remarkX, boxTop + boxH - 8);
    ctx.rotate(-Math.PI / 4);
    ctx.font = '8px "Times New Roman", serif';
    ctx.fillStyle = '#1a1a1a';
    ctx.textAlign = 'left';

    const loc = _truncate(remark.location, 25);
    const note = _truncate(remark.notes, 25);
    ctx.fillText(loc, 0, 0);
    ctx.font = 'italic 7px "Times New Roman", serif';
    ctx.fillStyle = '#555';
    ctx.fillText(note, 0, 10);
    ctx.restore();
  });
}

// ── Helpers ──
function _fmtH(h) {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  if (mins === 0) return `${hrs}`;
  return `${hrs}:${mins.toString().padStart(2, '0')}`;
}

function _truncate(str, max) {
  if (!str) return '';
  return str.length > max ? str.substring(0, max) + '…' : str;
}
