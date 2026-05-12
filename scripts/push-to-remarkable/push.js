// ============================================================
//  Align → reMarkable: daily PDF push
//
//  Fetches today's tasks for one user from Supabase, generates a
//  clean PDF, and uploads it to reMarkable via the `rmapi` CLI.
//
//  ONE-TIME SETUP:
//    1. Install rmapi:    https://github.com/ddvk/rmapi
//    2. Run `rmapi` once and complete the device pairing.
//    3. Copy .env.example to .env and fill values.
//    4. npm install
//
//  RUN:
//    node push.js
//
//  AUTOMATE:
//    Add to your crontab (runs at 6:30am every day):
//      30 6 * * * cd /path/to/scripts/push-to-remarkable && /usr/bin/node push.js
// ============================================================

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import PDFDocument from 'pdfkit';
import { createWriteStream, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  ALIGN_USER_EMAIL,
  REMARKABLE_FOLDER = 'Align',
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ALIGN_USER_EMAIL) {
  console.error('Missing env vars. See .env.example.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const pad = (n) => String(n).padStart(2, '0');
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// ------------------------------------------------------------
//  1. Resolve user from email
// ------------------------------------------------------------
async function resolveUserId() {
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) throw error;
  const user = data.users.find((u) => u.email === ALIGN_USER_EMAIL);
  if (!user) throw new Error(`No Supabase user with email ${ALIGN_USER_EMAIL}`);
  return user.id;
}

// ------------------------------------------------------------
//  2. Fetch today's tasks + brain dump
// ------------------------------------------------------------
async function fetchData(userId) {
  const today = dateKey(new Date());
  const [tasksRes, brainRes] = await Promise.all([
    supabase.from('tasks').select('*').eq('user_id', userId).eq('date', today).order('position'),
    supabase.from('brain_dump').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
  ]);
  if (tasksRes.error) throw tasksRes.error;
  if (brainRes.error) throw brainRes.error;
  return { tasks: tasksRes.data, brain: brainRes.data, today };
}

// ------------------------------------------------------------
//  3. Build PDF
// ------------------------------------------------------------
function buildPdf({ tasks, brain, today }) {
  const dir = mkdtempSync(join(tmpdir(), 'align-'));
  const path = join(dir, `align-${today}.pdf`);

  // reMarkable canvas: ~1404 x 1872 px; using A5-ish size for cleaner text density
  const doc = new PDFDocument({
    size: [468, 624], // 6.5 x 8.7 inches, comfortable on reMarkable
    margin: 48,
    info: { Title: `Align — ${today}`, Author: 'Align' },
  });
  doc.pipe(createWriteStream(path));

  // Date header
  const date = new Date(today + 'T00:00:00');
  doc.font('Times-Roman').fontSize(28).fillColor('#1B1813')
    .text(date.toLocaleDateString('en-US', { weekday: 'long' }), { lineGap: 2 });
  doc.font('Helvetica').fontSize(10).fillColor('#9A917F')
    .text(date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase(), { characterSpacing: 1.2 });

  doc.moveDown(1.5);

  // Today's three (incomplete only)
  const incomplete = tasks.filter((t) => !t.completed);
  const inMotion = incomplete.filter((t) => t.started);
  const rest = incomplete.filter((t) => !t.started);
  const top3 = [...inMotion, ...rest].slice(0, 3);

  if (top3.length > 0) {
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#5C5448').text("TODAY'S THREE", { characterSpacing: 1.5 });
    doc.moveDown(0.4);
    doc.font('Times-Roman').fontSize(14).fillColor('#1B1813');
    top3.forEach((t, i) => {
      doc.text(`${String(i + 1).padStart(2, '0')}.  ${t.text}`, { lineGap: 4 });
    });
    doc.moveDown(1);
  }

  // All today's tasks with checkboxes
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#5C5448').text('ALL TODAY', { characterSpacing: 1.5 });
  doc.moveDown(0.4);

  if (tasks.length === 0) {
    doc.font('Times-Italic').fontSize(12).fillColor('#9A917F').text('Nothing planned. A free day.');
  } else {
    doc.font('Helvetica').fontSize(12).fillColor('#1B1813');
    tasks.forEach((t) => {
      const y = doc.y;
      // checkbox
      doc.rect(48, y + 4, 8, 8).lineWidth(0.7).stroke('#5C5448');
      if (t.completed) {
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#7CA481').text('✓', 50, y + 3, { width: 8, align: 'center' });
        doc.font('Helvetica').fontSize(12);
      }
      doc.fillColor(t.completed ? '#9A917F' : '#1B1813')
        .text(t.text, 64, y, { lineGap: 6, width: 360 });
    });
  }

  // Brain dump
  if (brain.length > 0) {
    doc.moveDown(1.5);
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#5C5448').text('BRAIN DUMP', { characterSpacing: 1.5 });
    doc.moveDown(0.4);
    doc.font('Times-Roman').fontSize(11).fillColor('#5C5448');
    brain.forEach((b) => doc.text(`·  ${b.text}`, { lineGap: 3 }));
  }

  // Footer
  doc.font('Times-Italic').fontSize(8).fillColor('#9A917F')
    .text('Momentum, not pressure.', 48, 580, { align: 'center', width: 372 });

  doc.end();
  return path;
}

// ------------------------------------------------------------
//  4. Push via rmapi
// ------------------------------------------------------------
function pushToRemarkable(pdfPath, today) {
  // Make sure target folder exists (mkdir -p)
  try {
    execSync(`rmapi mkdir "/${REMARKABLE_FOLDER}"`, { stdio: 'pipe' });
  } catch {
    // folder may already exist — ignore
  }
  // Upload (will replace if same name exists; otherwise append timestamp)
  execSync(`rmapi put "${pdfPath}" "/${REMARKABLE_FOLDER}/"`, { stdio: 'inherit' });
  console.log(`Pushed ${pdfPath} → reMarkable:/${REMARKABLE_FOLDER}/`);
}

// ------------------------------------------------------------
//  Run
// ------------------------------------------------------------
(async () => {
  try {
    const userId = await resolveUserId();
    const data = await fetchData(userId);
    const pdfPath = buildPdf(data);
    pushToRemarkable(pdfPath, data.today);
  } catch (err) {
    console.error('Failed:', err.message || err);
    process.exit(1);
  }
})();
