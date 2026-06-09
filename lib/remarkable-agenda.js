// lib/remarkable-agenda.js
// Builds a clean daily-agenda PDF (to-dos + schedule) sized to fit the
// reMarkable nicely. Pure pdf-lib, no native deps — safe on Vercel serverless.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// reMarkable physical page is ~157 x 210 mm. Matching that ratio means no
// awkward scaling on the device. In points (1mm ≈ 2.83465pt): ~445 x 595.
const PAGE_W = 445;
const PAGE_H = 595;
const M = 34; // margin

const INK = rgb(0.21, 0.13, 0.36);   // #36215C
const INK2 = rgb(0.43, 0.33, 0.60);  // #6E5499
const FAINT = rgb(0.62, 0.53, 0.79); // #9F88C9
const RULE = rgb(0.79, 0.72, 0.90);  // #C9B8E6

export async function buildAgendaPdf({ dateLabel, bigThree = [], tasks = [], events = [] }) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE_W, PAGE_H]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let y = PAGE_H - M;

  // Wordmark + date
  page.drawText('align', { x: M, y: y - 14, size: 20, font: bold, color: INK });
  if (dateLabel) {
    const w = font.widthOfTextAtSize(dateLabel, 11);
    page.drawText(dateLabel, { x: PAGE_W - M - w, y: y - 8, size: 11, font, color: INK2 });
  }
  y -= 30;
  page.drawLine({ start: { x: M, y }, end: { x: PAGE_W - M, y }, thickness: 1.5, color: RULE });
  y -= 26;

  const sectionHeader = (label) => {
    page.drawText(label.toUpperCase(), { x: M, y, size: 10, font: bold, color: FAINT });
    y -= 18;
  };

  const ensureRoom = (needed) => {
    if (y - needed < M) {
      y = PAGE_H - M; // simple overflow: start a fresh page
      const p = doc.addPage([PAGE_W, PAGE_H]);
      return p;
    }
    return page;
  };

  // ---- BIG THREE (from the OS) ----
  if (bigThree.length) {
    sectionHeader("Today's Big Three");
    for (const b of bigThree) {
      ensureRoom(24);
      const box = 12;
      const boxY = y - 1;
      page.drawRectangle({ x: M, y: boxY - box + 3, width: box, height: box, borderColor: b.completed ? INK2 : INK, borderWidth: 1.4, color: b.completed ? INK2 : undefined });
      if (b.completed) {
        page.drawLine({ start: { x: M + 2.4, y: boxY - 2.6 }, end: { x: M + 5, y: boxY - 5.6 }, thickness: 1.5, color: rgb(1, 1, 1) });
        page.drawLine({ start: { x: M + 5, y: boxY - 5.6 }, end: { x: M + 9.8, y: boxY + 2 }, thickness: 1.5, color: rgb(1, 1, 1) });
      }
      const lx = M + box + 8;
      const labelStr = (b.label || '') + '  ';
      page.drawText(labelStr, { x: lx, y: boxY - box + 4, size: 9, font: bold, color: INK2 });
      const labelW = bold.widthOfTextAtSize(labelStr, 9);
      const hasText = !!(b.text && b.text.trim());
      page.drawText(hasText ? b.text : '. . . . . . . . . . . . . . . .', {
        x: lx + labelW, y: boxY - box + 4, size: 11.5, font,
        color: hasText ? (b.completed ? FAINT : INK) : RULE,
      });
      y -= 22;
    }
    y -= 8;
    page.drawLine({ start: { x: M, y }, end: { x: PAGE_W - M, y }, thickness: 1, color: RULE });
    y -= 22;
  }

  // ---- TO-DO ----
  sectionHeader('To-do');
  if (tasks.length === 0) {
    page.drawText('Nothing planned — a rest day.', { x: M + 2, y, size: 11, font, color: FAINT });
    y -= 20;
  } else {
    for (const t of tasks) {
      ensureRoom(22);
      const box = 11;
      const boxY = y - 1;
      // checkbox
      page.drawRectangle({ x: M, y: boxY - box + 3, width: box, height: box, borderColor: t.completed ? INK2 : INK, borderWidth: 1.3, color: t.completed ? INK2 : undefined });
      if (t.completed) {
        // simple check mark
        page.drawLine({ start: { x: M + 2.2, y: boxY - 2.5 }, end: { x: M + 4.6, y: boxY - 5.2 }, thickness: 1.4, color: rgb(1, 1, 1) });
        page.drawLine({ start: { x: M + 4.6, y: boxY - 5.2 }, end: { x: M + 9, y: boxY + 1.5 }, thickness: 1.4, color: rgb(1, 1, 1) });
      }
      const label = (t.leftover && !t.completed ? '\u00BB ' : '') + (t.text || '');
      page.drawText(label, { x: M + box + 8, y: boxY - box + 4, size: 11.5, font, color: t.completed ? FAINT : INK });
      y -= 21;
    }
  }

  y -= 12;

  // ---- SCHEDULE ----
  sectionHeader('Schedule');
  if (events.length === 0) {
    page.drawText('Nothing on the calendar.', { x: M + 2, y, size: 11, font, color: FAINT });
    y -= 20;
  } else {
    for (const ev of events) {
      ensureRoom(20);
      const time = (ev.time || '').toString();
      page.drawText(time, { x: M, y, size: 10.5, font: bold, color: INK2 });
      page.drawText(ev.title || '', { x: M + 64, y, size: 11.5, font, color: INK });
      y -= 19;
    }
  }

  // Footer
  page.drawText('momentum, not pressure', { x: M, y: M - 6, size: 9, font, color: FAINT });

  const bytes = await doc.save();
  return bytes; // Uint8Array
}
