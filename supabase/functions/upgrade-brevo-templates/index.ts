// One-off admin function: rewrites Brevo templates 2-8 with SOTA, human-written
// running-coach content branded for GearUpToFit. Invoke once after deploy.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BREVO = 'https://api.brevo.com/v3';
const SENDER = { name: 'Alex · GearUpToFit', email: 'info@gearuptofit.com' };
const REPLY_TO = { name: 'Alex · GearUpToFit', email: 'info@gearuptofit.com' };

// ---------- shared design tokens ----------
const RED = '#E53935';
const RED_DARK = '#B71C1C';
const BG = '#0A0A0F';
const PANEL = '#13131C';
const PANEL_2 = '#1B1B26';
const BORDER = '#26263A';
const TEXT = '#EDEDF0';
const MUTED = '#9C9CAB';
const LINK = '#FF6B5E';
const ACCENT = '#22C55E';

const layout = (opts: {
  title: string;
  preheader: string;
  dayBadge: string;
  inner: string;
  footerCta: string;
}) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"><meta name="supported-color-schemes" content="dark light"><title>${opts.title}</title></head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Helvetica,Arial,sans-serif;color:${TEXT};-webkit-font-smoothing:antialiased;">
<div style="display:none;font-size:1px;color:${BG};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${opts.preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:32px 12px;"><tr><td align="center">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${PANEL};border:1px solid ${BORDER};border-radius:18px;overflow:hidden;box-shadow:0 24px 60px rgba(229,57,53,0.08);">
    <tr><td style="background:linear-gradient(135deg,${PANEL} 0%,#1A1424 100%);padding:24px 32px;border-bottom:1px solid ${BORDER};">
      <table width="100%"><tr>
        <td>
          <div style="font-family:'Oswald','Bebas Neue','Arial Narrow',Arial,sans-serif;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;font-size:18px;color:${TEXT};">GEAR<span style="color:${RED}">UP</span>TOFIT</div>
          <div style="font-size:10px;color:${MUTED};letter-spacing:2px;text-transform:uppercase;margin-top:4px;font-weight:600;">RunMatch AI · 7-Day Coaching Series</div>
        </td>
        <td align="right">
          <span style="display:inline-block;background:${RED};color:#fff;font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;padding:6px 12px;border-radius:999px;font-family:'Oswald',Arial,sans-serif;">${opts.dayBadge}</span>
        </td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:36px 32px 28px;">${opts.inner}</td></tr>
    <tr><td style="padding:24px 32px 32px;border-top:1px solid ${BORDER};background:#10101A;">${opts.footerCta}</td></tr>
  </table>
  <table role="presentation" width="600" style="max-width:600px;width:100%;margin-top:18px;"><tr><td style="text-align:center;font-size:11px;color:${MUTED};line-height:1.7;padding:8px 16px;">
    You're getting this because you took the RunMatch AI shoe quiz at gearuptofit.com.<br>
    Written personally by Alex, head coach @ GearUpToFit · Hit reply — a real human reads every email.<br>
    <a href="https://gearuptofit.com/?utm_source=runmatch&utm_medium=email" style="color:${MUTED};text-decoration:underline;">gearuptofit.com</a> ·
    <a href="{{ unsubscribe }}" style="color:${MUTED};text-decoration:underline;">Unsubscribe</a> ·
    <a href="{{ mirror }}" style="color:${MUTED};text-decoration:underline;">View in browser</a>
  </td></tr></table>
</td></tr></table></body></html>`;

const eyebrow = (t: string) => `<div style="font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:${RED};font-weight:800;margin:0 0 12px;font-family:'Oswald',Arial,sans-serif;">${t}</div>`;
const h1 = (t: string) => `<h1 style="font-family:'Oswald','Bebas Neue',Arial,sans-serif;font-weight:700;font-size:34px;line-height:1.1;margin:0 0 18px;color:${TEXT};letter-spacing:-0.5px;">${t}</h1>`;
const h2 = (t: string) => `<h2 style="font-family:'Oswald',Arial,sans-serif;font-size:20px;line-height:1.25;margin:32px 0 12px;color:${TEXT};font-weight:700;letter-spacing:0.2px;text-transform:uppercase;">${t}</h2>`;
const p = (t: string) => `<p style="font-size:16px;line-height:1.7;margin:0 0 16px;color:${TEXT};">${t}</p>`;
const small = (t: string) => `<p style="font-size:13px;line-height:1.6;margin:0 0 12px;color:${MUTED};">${t}</p>`;
const a = (href: string, t: string) => `<a href="${href}" style="color:${LINK};text-decoration:underline;font-weight:600;">${t}</a>`;
const btn = (href: string, t: string) => `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px auto 4px;"><tr><td style="background:linear-gradient(135deg,${RED} 0%,${RED_DARK} 100%);border-radius:12px;box-shadow:0 8px 20px rgba(229,57,53,0.35);"><a href="${href}" style="display:inline-block;padding:16px 28px;color:#fff;font-weight:800;text-decoration:none;font-size:14px;letter-spacing:1px;text-transform:uppercase;font-family:'Oswald',Arial,sans-serif;">${t} →</a></td></tr></table>`;
const callout = (t: string) => `<table width="100%" style="margin:18px 0;"><tr><td style="border-left:4px solid ${RED};background:${PANEL_2};padding:16px 20px;border-radius:10px;"><p style="margin:0;font-size:15px;line-height:1.65;color:${TEXT};">${t}</p></td></tr></table>`;
const stat = (val: string, label: string) => `<td style="background:${PANEL_2};border:1px solid ${BORDER};border-radius:12px;padding:18px 14px;text-align:center;width:33%;"><div style="font-family:'Oswald',Arial,sans-serif;font-size:30px;font-weight:700;color:${RED};line-height:1;">${val}</div><div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:${MUTED};margin-top:6px;font-weight:700;">${label}</div></td>`;
const statRow = (cells: string[]) => `<table width="100%" cellspacing="8" cellpadding="0" style="margin:18px 0;"><tr>${cells.join('<td style="width:8px;"></td>')}</tr></table>`;
const list = (items: string[]) => `<ul style="margin:0 0 18px;padding:0 0 0 22px;color:${TEXT};font-size:16px;line-height:1.75;">${items.map(i => `<li style="margin:0 0 10px;">${i}</li>`).join('')}</ul>`;
const checklist = (items: string[]) => `<table width="100%" style="margin:8px 0 18px;">${items.map(i => `<tr><td valign="top" style="width:28px;padding:6px 0;"><div style="width:20px;height:20px;border-radius:6px;background:${RED};color:#fff;font-weight:800;font-size:12px;text-align:center;line-height:20px;font-family:'Oswald',Arial,sans-serif;">✓</div></td><td style="padding:6px 0 6px 4px;font-size:15px;line-height:1.6;color:${TEXT};">${i}</td></tr>`).join('')}</table>`;
const divider = () => `<div style="height:1px;background:${BORDER};margin:28px 0;"></div>`;
const ps = (t: string) => `<p style="font-size:14px;line-height:1.6;margin:24px 0 0;color:${MUTED};font-style:italic;border-top:1px dashed ${BORDER};padding-top:16px;"><strong style="color:${RED};font-style:normal;">P.S.</strong> ${t}</p>`;
const sig = () => `<p style="font-size:16px;line-height:1.6;margin:28px 0 0;color:${TEXT};">Run strong,<br><strong style="font-family:'Oswald',Arial,sans-serif;font-size:20px;letter-spacing:0.3px;">Alex</strong><br><span style="color:${MUTED};font-size:13px;">Head Coach · GearUpToFit · 18 years coaching, 12 marathons, 1 stress fracture (lesson learned)</span></p>`;
const utm = (slug: string, c: string) => `https://gearuptofit.com/${slug}?utm_source=runmatch&utm_medium=email&utm_campaign=${c}`;

// ===================================================================
// DAY 0 — Welcome + Report
// ===================================================================
const T2 = {
  subject: '🎯 {{ params.FIRSTNAME | default : "Runner" }}, your RunMatch AI report is ready',
  html: layout({
    title: 'Your RunMatch AI Report',
    preheader: 'Your 3-shoe rotation, week-1 plan & the 7-day coaching series starts now.',
    dayBadge: 'Day 0 · Start',
    inner:
      eyebrow('Welcome to RunMatch') +
      h1('Your shoe rotation is locked in, {{ params.FIRSTNAME | default : "runner" }}.') +
      p('I\'m Alex — head coach at GearUpToFit. I built RunMatch AI because I was tired of watching good runners get hurt in the wrong shoes. Today, that stops for you.') +
      p('In the next <strong>30 seconds</strong> I\'ll show you exactly what your match means. In the next <strong>21 days</strong>, this email series will quietly turn you into a smarter, more durable runner.') +
      callout('🎯 Your primary trainer: <strong>{{ params.PRIMARY_SHOE | default : "your matched daily trainer" }}</strong><br>📂 Category: <strong>{{ params.SHOE_CATEGORY | default : "Daily Trainer" }}</strong><br>📄 Full report (PDF + share link): inside the dashboard') +
      statRow([stat('39%', 'Lower Injury Risk'), stat('3', 'Shoe Rotation'), stat('21', 'Days of Coaching')]) +
      h2('Why a 3-shoe rotation?') +
      p('A landmark Scandinavian Journal of Medicine & Science in Sports study (Malisoux et al., 2014) tracked 264 runners for 22 weeks. Those who rotated multiple shoes had a <strong>39% lower running-related injury rate</strong>. Each shoe stresses your tendons differently — variety <em>is</em> recovery.') +
      h2('Your week-1 game plan') +
      checklist([
        '<strong>Run 1 — 30 min easy</strong> in your daily trainer. Nose-breathing pace. No watch-checking.',
        '<strong>Run 2 — 4×3 min strides</strong> (90s walk between) in your speed shoe. Form > effort.',
        '<strong>Run 3 — 45–60 min long run</strong>, conversational. Adaptation lives at this pace.',
      ]) +
      p('Tomorrow → the <strong>14-day break-in protocol</strong>. Skip it and you\'ll cook your calves in week one. (I\'ve made every mistake so you don\'t have to.)') +
      sig() +
      ps('Your match is based on 27 data points — foot strike, pronation, mileage, terrain, history, goals, and 22 more. If anything feels off when you run, hit reply. I\'ll personally help you re-tune.'),
    footerCta:
      p('<strong style="color:' + TEXT + ';">Open your full report any time</strong> — share with your coach, training partner, or that friend who keeps buying the wrong shoes:') +
      btn(utm('shoe-finder/', 'welcome'), 'Open My RunMatch Report') +
      small('Bonus reads: ' + a(utm('best-running-shoes/', 'welcome'), 'Best running shoes 2026') + ' · ' + a(utm('blog/', 'welcome'), 'Training library') + ' · ' + a(utm('best-running-shoes-for-flat-feet/', 'welcome'), 'Shoes by foot type')),
  }),
};

// ===================================================================
// DAY 2 — Break-In Protocol
// ===================================================================
const T3 = {
  subject: '🚧 Day 2 · Don\'t blow up your calves this week (the 14-day protocol)',
  html: layout({
    title: 'The 14-Day Break-In Protocol',
    preheader: 'The exact 4-stage routine I give every athlete. Saves Achilles, calves & PRs.',
    dayBadge: 'Day 2 · Break-In',
    inner:
      eyebrow('Coaching Series · Email 2 of 7') +
      h1('The #1 reason new shoes hurt isn\'t the shoe.') +
      p('{{ params.FIRSTNAME | default : "Hey" }} — quick story.') +
      p('In 2019 I gave a client a brand-new pair of carbon-plated racers. He was so excited he ran a 16k tempo in them on day one. Day three, he couldn\'t walk down stairs. Achilles tendinopathy. Six weeks off.') +
      p('It wasn\'t the shoe. It was the <strong>ramp</strong>. Especially with carbon-plated or max-cushion models, the geometry shifts how your Achilles, tibialis, and plantar fascia load. Your tissues need a graded introduction.') +
      h2('The 4-stage protocol') +
      checklist([
        '<strong>Days 1–3 · Acclimate.</strong> Wear them around the house. Walk the dog. One short easy run, 20–30 min.',
        '<strong>Days 4–7 · Light load.</strong> 3 easy runs, capped at 50% of your normal weekly mileage in the new shoe.',
        '<strong>Days 8–14 · Add intensity.</strong> One workout (tempo or strides). Keep your old shoe for the long run.',
        '<strong>Day 15+ · Free rotation.</strong> Daily trainer for easy, speed shoe for hard sessions, long-run shoe for the long stuff.',
      ]) +
      callout('🚩 <strong>Stop signs:</strong> sharp Achilles pain, top-of-foot tightness, or a knee pinch in the first 10 minutes. Back off one stage. Tissue is talking — listen.') +
      h2('Care = lifespan') +
      p('Loosen laces fully before slipping in (preserves the heel counter). Never machine-wash — the agitator destroys foam. Air-dry on their side, away from radiators. Done right, your match shoe should give you ' + a(utm('how-long-do-running-shoes-last/', 'breakin'), '500–800 km') + ' of bounce.') +
      sig() +
      ps('Tomorrow → cadence. The single form variable that quietly fixes 60% of recreational running niggles. Worth the 4-minute read.'),
    footerCta:
      btn(utm('blog/break-in-running-shoes/', 'breakin'), 'Read the Full Break-In Guide') +
      small('Reply with your shoe model — I\'ll tell you the exact mileage cap I\'d use for week one.'),
  }),
};

// ===================================================================
// DAY 4 — Cadence
// ===================================================================
const T4 = {
  subject: '📐 Day 4 · The form fix that ends 60% of running pain',
  html: layout({
    title: 'Cadence & Form',
    preheader: 'Why 170–180 steps/min is the magic number — and how to get there without thinking.',
    dayBadge: 'Day 4 · Cadence',
    inner:
      eyebrow('Coaching Series · Email 3 of 7') +
      h1('The 170 rule.') +
      p('{{ params.FIRSTNAME | default : "Hey" }} — here\'s a number worth tattooing on your wrist:') +
      statRow([stat('170', 'Min Cadence'), stat('-20%', 'Knee Impact'), stat('60s', 'To Test It')]) +
      p('Every elite distance coach since the 1980s — Daniels, Hanson, Canova — converged on <strong>170–180 steps per minute</strong> for easy running. Below 170, most runners overstride. Overstriding = braking force on every step = knee pain, IT band issues, shin splints.') +
      h2('Test yourself — 60 seconds') +
      checklist([
        'Run easy for 5 min to settle in.',
        'Count every <strong>right-foot</strong> strike for 30 seconds.',
        'Multiply by 4. That\'s your cadence.',
        'Under 165? You\'re overstriding. Welcome — most runners are.',
      ]) +
      h2('How to fix it (without thinking)') +
      list([
        '🎵 <strong>Metronome trick:</strong> queue a 175 BPM playlist (Spotify has dozens). Match your steps. Brain switches off, legs adapt.',
        '🔥 <strong>"Hot coals" cue:</strong> imagine running on hot coals for the first 30 sec of every run. Forces a quicker, lighter turnover.',
        '⚡ <strong>Strides 2x/week:</strong> 6×20 sec at fast-but-relaxed pace. Cadence climbs naturally over 4–6 weeks.',
      ]) +
      callout('A 5–10% bump in cadence reduces vertical oscillation and impact force on the knee by up to <strong>20%</strong> (Heiderscheit et al., MSSE 2011). Free injury prevention. No equipment.') +
      p('Pair this with your matched shoe and you\'ve quietly removed the two biggest causes of recreational-runner injury: wrong shoe + slow cadence. You\'re ahead of 90% of runners already.') +
      sig() +
      ps('Day 7 (Sunday) → why your easy runs should feel <em>embarrassingly</em> slow. The 80/20 rule that built every Olympic marathoner of the last 40 years.'),
    footerCta:
      btn(utm('blog/running-cadence/', 'cadence'), 'Deep Dive · The Cadence Guide') +
      small('Hit reply with your current cadence — I read every email and genuinely love seeing the numbers.'),
  }),
};

// ===================================================================
// DAY 7 — Zone 2
// ===================================================================
const T5 = {
  subject: '🐢 Day 7 · Run slower. Race faster. (Yes, really)',
  html: layout({
    title: 'Zone 2 Training',
    preheader: 'The 80/20 rule that built every Olympic marathoner of the last 40 years.',
    dayBadge: 'Day 7 · Zone 2',
    inner:
      eyebrow('Coaching Series · Email 4 of 7') +
      h1('The biggest mindset shift in distance running.') +
      p('{{ params.FIRSTNAME | default : "Hey" }} — one week in. How are the legs feeling?') +
      p('Today\'s lesson is the single biggest gap between recreational runners and the ones who keep PR\'ing year after year:') +
      callout('<strong>The fast ones run their easy runs embarrassingly slow.</strong>') +
      h2('The 80/20 rule') +
      p('Sport scientist <strong>Stephen Seiler</strong> analyzed elite endurance athletes across cycling, rowing, XC skiing, and running. The pattern was identical across every sport, every nation, every decade:') +
      statRow([stat('80%', 'Easy / Zone 2'), stat('20%', 'Hard / Threshold'), stat('~0%', 'Gray Middle')]) +
      p('Most amateurs flip it: too much "moderately hard," not enough truly easy or truly hard. Result? Chronic fatigue, no improvement, eventual injury. The "gray zone" is where progress goes to die.') +
      h2('What is Zone 2, practically?') +
      checklist([
        '<strong>Talk test:</strong> you can hold a full conversation in complete sentences.',
        '<strong>Nose-breathing:</strong> you can breathe through your nose only without gasping.',
        '<strong>Heart rate:</strong> roughly 60–70% of max. For most adults: 130–145 bpm.',
        '<strong>Pace:</strong> usually 60–90 sec/km <em>slower</em> than your 5k race pace. Yes, that slow.',
      ]) +
      callout('Zone 2 builds <strong>mitochondrial density</strong> and <strong>capillary networks</strong> — the actual physiological machinery of endurance. You cannot shortcut this with hard intervals. Period.') +
      h2('Your week 2–4 schedule') +
      list([
        '3–4 easy / Zone 2 runs (45–75 min each)',
        '1 quality session (intervals, tempo, or hills) — 20% of weekly volume',
        '1 long run, also in Zone 2, gradually building 10% per week',
        '1–2 rest or cross-training days. <em>Non-negotiable.</em>',
      ]) +
      sig() +
      ps('I know running this slow feels wrong at first. Trust the protocol for 4 weeks. You\'ll come out the other side faster <em>without</em> running faster. It\'s the closest thing to magic in our sport.'),
    footerCta:
      btn(utm('blog/zone-2-training/', 'zone2'), 'The Full Zone 2 Protocol') +
      small('Bonus: ' + a(utm('blog/heart-rate-zones/', 'zone2'), 'Find your true HR zones') + ' (no lab test required) · ' + a(utm('blog/long-run-guide/', 'zone2'), 'The long run, demystified')),
  }),
};

// ===================================================================
// DAY 10 — Injury Prevention
// ===================================================================
const T6 = {
  subject: '🛡 Day 10 · The 12-minute routine that bulletproofs runners',
  html: layout({
    title: 'Injury Prevention',
    preheader: 'Calves, glutes, hips, feet. 4 moves, 3x a week. Living-room friendly.',
    dayBadge: 'Day 10 · Strength',
    inner:
      eyebrow('Coaching Series · Email 5 of 7') +
      h1('Become un-injurable.') +
      p('{{ params.FIRSTNAME | default : "Hey" }} — a sobering stat:') +
      statRow([stat('70%', 'Of Runners Hurt/Yr'), stat('-50%', 'With Strength'), stat('12', 'Minutes Needed')]) +
      p('A 2018 meta-analysis in the British Journal of Sports Medicine found strength training reduced overuse running injuries by <strong>~50%</strong> (Lauersen et al.). Plyometrics added another 15%.') +
      p('The runners who don\'t get hurt almost universally do two things: rotate shoes (✅ done — that was Day 0) and a <strong>tiny</strong> strength routine. Not CrossFit. Not the gym. Just these four moves, 3x a week, in your living room.') +
      h2('The 4 non-negotiables') +
      checklist([
        '<strong>Single-leg calf raises — 3×15 each side.</strong> Off a step, full range of motion. Bulletproofs Achilles + plantar fascia.',
        '<strong>Side-lying clamshells — 3×15 each side.</strong> Activates glute medius. Single best fix for IT band & runner\'s knee.',
        '<strong>Single-leg glute bridges — 3×12 each side.</strong> Posterior chain. Your true running power source.',
        '<strong>Toe yoga + short-foot drill — 2 min/day.</strong> Sounds silly. Has saved more arches than any insole I\'ve tested.',
      ]) +
      callout('Do this Mon / Wed / Fri after an easy run. Total time including warm-up: 12 minutes. The compounding over 6 months is genuinely absurd.') +
      h2('The recovery non-negotiables') +
      list([
        '😴 <strong>Sleep 7.5+ hours.</strong> The single highest-leverage recovery tool, free of charge.',
        '💧 <strong>Hydrate to clear urine.</strong> Tendons hate dehydration.',
        '🛌 <strong>One full rest day per week.</strong> Yes, even when you feel great. <em>Especially</em> then.',
        '👟 <strong>Replace shoes at 500–800 km.</strong> Track in Strava or a notebook. Foam dies silently.',
      ]) +
      p('{{ params.FIRSTNAME | default : "" }}, the pattern of runners who never get hurt isn\'t talent — it\'s these unglamorous 12 minutes done consistently. That\'s the whole secret.') +
      sig() +
      ps('Day 14 → race day. Pacing, fueling, kit, taper, and the mental switch in the final 5k. Even if your next race is months away, lock these in <em>now</em>.'),
    footerCta:
      btn(utm('blog/running-injury-prevention/', 'injury'), 'Get the Full Strength Routine + Video'),
  }),
};

// ===================================================================
// DAY 14 — Race Day
// ===================================================================
const T7 = {
  subject: '🏁 Day 14 · Race day: 9 things I wish someone had told me',
  html: layout({
    title: 'Race Day Playbook',
    preheader: 'Pacing, fueling, kit, taper & the mental switch in the final 5k.',
    dayBadge: 'Day 14 · Race Day',
    inner:
      eyebrow('Coaching Series · Email 6 of 7') +
      h1('Race day, demystified.') +
      p('{{ params.FIRSTNAME | default : "Hey" }} — two weeks in. Whether your next race is in 6 weeks or 6 months, lock these in <em>now</em>. They\'re the lessons I learned the painful way (12 marathons, 1 stress fracture, dozens of "what if I had just…" moments).') +
      h2('The week before') +
      checklist([
        '<strong>Taper hard.</strong> Cut volume 40% the final week, 60% the last 3 days. Keep some intensity (short strides) so legs don\'t feel flat.',
        '<strong>Sleep bank.</strong> Two nights before is more important than the night before — pre-race nerves <em>are</em> normal.',
        '<strong>Carb load 2–3 days out:</strong> 7–10 g per kg of bodyweight per day. Rice, pasta, bread, fruit. Easy on fiber and fats race-eve.',
        '<strong>Nothing new on race day.</strong> Not the shoes (you broke yours in — perfect). Not the gels. Not the socks. Nothing.',
      ]) +
      h2('Pacing — the universal truth') +
      callout('🎯 <strong>Negative split or die.</strong> Run the first half 5–10 sec/km <em>slower</em> than goal pace. Almost every PR is set this way. Almost every blow-up starts with going out 10 sec too fast in km 1–3. Discipline in the first 5k buys you a finish you\'re proud of.') +
      h2('Fueling') +
      statRow([stat('5–10k', 'Hydration only'), stat('Half', '30–60g/hr'), stat('Marathon', '60–90g/hr')]) +
      p('Critical: <strong>practice fueling in long runs.</strong> Your gut needs training too. Race day is <em>not</em> the day to find out a gel doesn\'t agree with you at km 28.') +
      h2('The mental trick for the final 5k') +
      p('When it gets dark — and it will — break the remaining distance into <strong>tiny chunks</strong>: "to the next aid station," "to the next km marker," "10 more breaths." Never think about the finish line. Just the next chunk. The brain can endure anything for 60 seconds.') +
      sig() +
      ps('Got a race coming up? Hit reply and tell me which one + your goal time. I\'ll send you a tailored pacing plan within 24 hrs. Genuine offer — I love this stuff.'),
    footerCta:
      btn(utm('blog/race-day-checklist/', 'raceday'), 'Print the Race Day Checklist'),
  }),
};

// ===================================================================
// DAY 21 — Re-Match
// ===================================================================
const T8 = {
  subject: '🔄 You\'ve evolved. Time to re-match your shoes.',
  html: layout({
    title: 'Your 3-Week RunMatch Check-In',
    preheader: 'Mileage shifts. Goals shift. Your rotation should too. Free re-match inside.',
    dayBadge: 'Day 21 · Re-Match',
    inner:
      eyebrow('Coaching Series · Email 7 of 7 · The Finale') +
      h1('Three weeks in. Different runner.') +
      p('{{ params.FIRSTNAME | default : "Hey" }} — final email of the series. Quick check-in.') +
      p('Three weeks of consistent running changes you. Cadence climbs. Easy pace gets easier. Maybe you\'ve added mileage, signed up for a race, discovered you actually love trails. Maybe a niggle showed up. Maybe you\'re now obsessed with negative splits.') +
      p('That\'s not the same runner who took the quiz on Day 0. Which means your rotation might need a tune-up.') +
      h2('When to re-match') +
      checklist([
        'Weekly mileage went up (or down) by 25%+',
        'You\'ve set a new race goal or distance',
        'A recurring niggle showed up (calf, knee, foot)',
        'Your primary shoe is past 400 km',
        'You want to add a trail or carbon-plated shoe to the rotation',
      ]) +
      callout('The re-match takes <strong>90 seconds</strong>. We\'ll factor in everything you\'ve learned about your stride in the last 3 weeks. Your old report is preserved — this gives you a fresh one to compare.') +
      btn(utm('shoe-finder/', 'rematch'), 'Re-Take the RunMatch Quiz') +
      divider() +
      h2('And one ask') +
      p('If RunMatch and this email series helped you, two small things would mean the world:') +
      list([
        '💬 <strong>Hit reply</strong> and tell me what changed for you in 21 days. I read every single one.',
        '🔁 <strong>Forward this</strong> to the runner in your life who\'s wearing the wrong shoes. (You know who.)',
      ]) +
      p('Either way — I\'m glad we crossed paths. You showed up for 21 days. Most don\'t. The compounding from here is real.') +
      sig() +
      ps('This is the last "scheduled" email. But I\'m not going anywhere. Stay subscribed for occasional drops — new shoe reviews the week they release, training cycles for upcoming majors, and the rare deep-dive that\'s actually worth your inbox.'),
    footerCta:
      p('<strong style="color:' + TEXT + ';">Keep exploring:</strong>') +
      small('🏃 ' + a(utm('best-running-shoes/', 'rematch'), 'Latest shoe reviews (2026)') + '<br>📚 ' + a(utm('blog/', 'rematch'), 'Training & nutrition library') + '<br>🎯 ' + a(utm('shoe-finder/', 'rematch'), 'Re-take RunMatch AI') + '<br>📩 ' + a('mailto:info@gearuptofit.com', 'Email Alex directly')),
  }),
};

const TEMPLATES: Record<number, { subject: string; html: string; name: string; tag: string }> = {
  2: { ...T2, name: 'RunMatch · Day 0 · Welcome + Report', tag: 'drip-day-0' },
  3: { ...T3, name: 'RunMatch · Day 2 · Break-In Protocol', tag: 'drip-day-2' },
  4: { ...T4, name: 'RunMatch · Day 4 · Cadence & Form', tag: 'drip-day-4' },
  5: { ...T5, name: 'RunMatch · Day 7 · Zone 2 Training', tag: 'drip-day-7' },
  6: { ...T6, name: 'RunMatch · Day 10 · Injury Prevention', tag: 'drip-day-10' },
  7: { ...T7, name: 'RunMatch · Day 14 · Race Day Playbook', tag: 'drip-day-14' },
  8: { ...T8, name: 'RunMatch · Day 21 · Re-Match Invitation', tag: 'drip-day-21' },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const apiKey = Deno.env.get('BREVO_API_KEY');
  if (!apiKey) return new Response(JSON.stringify({ error: 'no key' }), { status: 500, headers: corsHeaders });

  const results: any[] = [];
  for (const [idStr, tpl] of Object.entries(TEMPLATES)) {
    const id = Number(idStr);
    const body = {
      sender: SENDER,
      replyTo: REPLY_TO.email,
      templateName: tpl.name,
      subject: tpl.subject,
      htmlContent: tpl.html,
      isActive: true,
      tag: tpl.tag,
    };
    const r = await fetch(`${BREVO}/smtp/templates/${id}`, {
      method: 'PUT',
      headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await r.text();
    results.push({ id, ok: r.ok, status: r.status, name: tpl.name, body: text.slice(0, 200) });
  }
  return new Response(JSON.stringify({ updated: results }, null, 2), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
