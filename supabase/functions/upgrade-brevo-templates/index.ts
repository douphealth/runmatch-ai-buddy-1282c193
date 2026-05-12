// One-off admin function: rewrites Brevo templates 2-8 with SOTA, human-written
// running-coach content branded for GearUpToFit. Invoke once after deploy.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BREVO = 'https://api.brevo.com/v3';
const SENDER = { name: 'Alex · GearUpToFit', email: 'info@gearuptofit.com' };
const REPLY_TO = { name: 'Alex · GearUpToFit', email: 'info@gearuptofit.com' };

// ---------- shared design tokens (inlined for max email-client compatibility) ----------
const RED = '#E53935';
const BG = '#0B0B0F';
const PANEL = '#14141B';
const BORDER = '#23232E';
const TEXT = '#E7E7EA';
const MUTED = '#9A9AA6';
const LINK = '#FF5A4E';

const layout = (title: string, preheader: string, inner: string, footerCta: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"><meta name="supported-color-schemes" content="dark light"><title>${title}</title></head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Helvetica,Arial,sans-serif;color:${TEXT};-webkit-font-smoothing:antialiased;">
<div style="display:none;font-size:1px;color:${BG};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:32px 12px;"><tr><td align="center">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${PANEL};border:1px solid ${BORDER};border-radius:16px;overflow:hidden;">
    <tr><td style="padding:28px 32px 8px 32px;border-bottom:1px solid ${BORDER};">
      <table width="100%"><tr>
        <td><div style="font-family:'Oswald','Bebas Neue','Arial Narrow',Arial,sans-serif;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;font-size:18px;color:${TEXT};">GEAR<span style="color:${RED}">UP</span>TOFIT</div><div style="font-size:11px;color:${MUTED};letter-spacing:2px;text-transform:uppercase;margin-top:4px;">RunMatch AI · Coaching Series</div></td>
        <td align="right"><a href="https://gearuptofit.com/?utm_source=runmatch&utm_medium=email&utm_campaign=drip" style="font-size:12px;color:${MUTED};text-decoration:none;">gearuptofit.com →</a></td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:32px;">${inner}</td></tr>
    <tr><td style="padding:24px 32px 32px;border-top:1px solid ${BORDER};">${footerCta}</td></tr>
  </table>
  <table role="presentation" width="600" style="max-width:600px;width:100%;margin-top:18px;"><tr><td style="text-align:center;font-size:11px;color:${MUTED};line-height:1.7;padding:8px 16px;">
    You're getting this because you took the RunMatch AI shoe quiz at gearuptofit.com.<br>
    Written by Alex, head coach @ GearUpToFit · Replies go to a real human.<br>
    <a href="https://gearuptofit.com/?utm_source=runmatch&utm_medium=email" style="color:${MUTED};text-decoration:underline;">gearuptofit.com</a> ·
    <a href="{{ unsubscribe }}" style="color:${MUTED};text-decoration:underline;">Unsubscribe</a> ·
    <a href="{{ mirror }}" style="color:${MUTED};text-decoration:underline;">View in browser</a>
  </td></tr></table>
</td></tr></table></body></html>`;

const h1 = (t: string) => `<h1 style="font-family:'Oswald','Bebas Neue',Arial,sans-serif;font-weight:700;font-size:30px;line-height:1.15;margin:0 0 14px;color:${TEXT};letter-spacing:-0.3px;">${t}</h1>`;
const h2 = (t: string) => `<h2 style="font-size:18px;line-height:1.3;margin:28px 0 10px;color:${TEXT};font-weight:700;">${t}</h2>`;
const p = (t: string) => `<p style="font-size:15px;line-height:1.65;margin:0 0 14px;color:${TEXT};">${t}</p>`;
const small = (t: string) => `<p style="font-size:13px;line-height:1.6;margin:0 0 12px;color:${MUTED};">${t}</p>`;
const a = (href: string, t: string) => `<a href="${href}" style="color:${LINK};text-decoration:underline;font-weight:600;">${t}</a>`;
const btn = (href: string, t: string) => `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;"><tr><td style="background:${RED};border-radius:10px;"><a href="${href}" style="display:inline-block;padding:14px 22px;color:#fff;font-weight:700;text-decoration:none;font-size:14px;letter-spacing:0.4px;text-transform:uppercase;font-family:'Oswald',Arial,sans-serif;">${t}</a></td></tr></table>`;
const callout = (t: string) => `<div style="border-left:3px solid ${RED};background:#1B1B24;padding:14px 16px;border-radius:8px;margin:16px 0;"><p style="margin:0;font-size:14px;line-height:1.6;color:${TEXT};">${t}</p></div>`;
const list = (items: string[]) => `<ul style="margin:0 0 16px;padding:0 0 0 20px;color:${TEXT};font-size:15px;line-height:1.7;">${items.map(i => `<li style="margin:0 0 8px;">${i}</li>`).join('')}</ul>`;
const sig = () => `<p style="font-size:15px;line-height:1.6;margin:24px 0 0;color:${TEXT};">Run strong,<br><strong>Alex</strong><br><span style="color:${MUTED};font-size:13px;">Head Coach · GearUpToFit</span></p>`;
const utm = (slug: string, c: string) => `https://gearuptofit.com/${slug}?utm_source=runmatch&utm_medium=email&utm_campaign=${c}`;

// ---------- content ----------
const T2 = {
  subject: '{{ params.FIRSTNAME | default : "Runner" }}, your RunMatch AI report is ready 🏃',
  html: layout(
    'Your RunMatch AI Report',
    'Your personalized 3-shoe rotation, training notes & a week-1 plan inside.',
    h1('Welcome — your shoe rotation is locked in.') +
    p('Hey {{ params.FIRSTNAME | default : "runner" }},') +
    p('I\'m Alex, head coach at GearUpToFit. I personally reviewed the answers you just gave RunMatch AI, and your matching profile is solid — here\'s what I want you to know in the next 90 seconds:') +
    callout('Your primary trainer match: <strong>{{ params.PRIMARY_SHOE | default : "your daily trainer" }}</strong> &nbsp;·&nbsp; Category: <strong>{{ params.SHOE_CATEGORY | default : "Daily" }}</strong>') +
    h2('Why a 3-shoe rotation, not just one pair') +
    p('A 2014 study in the Scandinavian Journal of Medicine & Science in Sports tracked 264 runners for 22 weeks. Those who rotated between multiple shoes had a <strong>39% lower injury rate</strong>. Each shoe loads tendons and joints differently — variety is recovery.') +
    h2('Your week-1 game plan') +
    list([
      '<strong>Run 1 — 30 min easy</strong> in your new daily trainer. Nose-breathing pace. Don\'t chase splits.',
      '<strong>Run 2 — 4×3 min strides</strong> (90s walk between) in your speed shoe. Form over effort.',
      '<strong>Run 3 — 45–60 min long run</strong>, conversational. This is where adaptation lives.',
    ]) +
    p('Tomorrow I\'ll send you the proven break-in protocol so you don\'t blow out your calves in week one (very common mistake).') +
    sig(),
    p('Open your full report any time — share it with your coach or training partner:') +
    btn(utm('shoe-match/', 'welcome'), 'Open my RunMatch report') +
    small('Or browse our latest reviews: ' + a(utm('best-running-shoes/', 'welcome'), 'Best running shoes 2026') + ' · ' + a(utm('blog/', 'welcome'), 'Training blog')),
  ),
};

const T3 = {
  subject: 'Day 2 · The 14-day break-in protocol (don\'t skip this)',
  html: layout(
    'The 14-Day Shoe Break-In Protocol',
    'The 4-step routine I give every athlete I coach. Saves calves, Achilles, and PRs.',
    h1('Don\'t blow up your calves in week one.') +
    p('{{ params.FIRSTNAME | default : "Hey" }} — quick one today, but <em>critical</em>.') +
    p('The #1 reason new shoes cause pain isn\'t the shoe. It\'s how fast you ramped into them. Especially if your match was a carbon-plated or max-cushion model — the geometry shifts how your Achilles, tibialis, and plantar fascia load.') +
    h2('The protocol I run with my own athletes') +
    list([
      '<strong>Days 1–3:</strong> Wear them around the house. Walk the dog. 1 short easy run, 20–30 min.',
      '<strong>Days 4–7:</strong> 3 easy runs, capped at 50% of your normal weekly mileage in the new shoe.',
      '<strong>Days 8–14:</strong> Add one workout (tempo or strides). Keep your old shoe for the long run.',
      '<strong>Day 15+:</strong> Rotate freely. Daily trainer for easy, speed shoe for hard sessions.',
    ]) +
    callout('🚩 <strong>Stop signs:</strong> sharp Achilles pain, top-of-foot tightness, or knee pinch in the first 10 minutes. Back off one stage. This is form/load talking, not a "tough it out" moment.') +
    h2('Care = lifespan') +
    p('Loosen laces fully before slipping in. Never machine-wash (kills the foam). Air-dry on their side. Done right, your match shoe should give you ' + a(utm('how-long-do-running-shoes-last/', 'breakin'), '500–800 km of life') + '.') +
    sig(),
    p('Tomorrow → cadence. The single form variable that fixes 60% of running niggles.') +
    btn(utm('blog/break-in-running-shoes/', 'breakin'), 'Read the full break-in guide'),
  ),
};

const T4 = {
  subject: 'Day 4 · The form fix that ends 60% of running pain',
  html: layout(
    'Cadence & Form',
    'Why 170–180 steps per minute is the magic number — and how to get there without thinking.',
    h1('The 170 rule.') +
    p('{{ params.FIRSTNAME | default : "Hey" }}, here\'s a number worth tattooing on your wrist: <strong>170–180</strong>. That\'s your target cadence — steps per minute — for easy running.') +
    p('Daniels, Hanson, and pretty much every elite coach since the 80s converged on this range because at sub-170 cadence, most runners overstride. Overstriding = braking force = knee pain, IT band issues, and shin splints.') +
    h2('Test yourself in 60 seconds') +
    list([
      'Run easy for 5 minutes to settle in.',
      'Count every time your <strong>right foot</strong> hits the ground for 30 seconds.',
      'Multiply by 4. That\'s your cadence.',
      'Under 165? You\'re overstriding. Welcome to the club — most runners are.',
    ]) +
    h2('How to fix it (without thinking about your form)') +
    list([
      '<strong>Metronome trick:</strong> queue a 175 BPM playlist (Spotify has them). Match your steps. Done.',
      '<strong>"Tiny steps" cue:</strong> imagine running on hot coals for the first 30 seconds of every run. Forces a quicker turnover.',
      '<strong>Strides 2x/week:</strong> 6×20 sec at fast-but-relaxed pace. Cadence climbs naturally.',
    ]) +
    callout('A 5–10% bump in cadence reduces vertical oscillation and impact force on the knee by up to 20% (Heiderscheit et al., MSSE 2011). Free injury prevention.') +
    p('Pair this with your matched shoe and you\'ve quietly removed the two biggest causes of recreational-runner injuries: wrong shoe + slow cadence.') +
    sig(),
    p('Want the deeper dive with drills + video?') +
    btn(utm('blog/running-cadence/', 'cadence'), 'Read: The cadence guide') +
    small('Reply with your current cadence — I read every email. Genuinely curious.'),
  ),
};

const T5 = {
  subject: 'Day 7 · Why slow running makes you fast (Zone 2 explained)',
  html: layout(
    'Zone 2 Training',
    'The 80/20 rule that built every Olympic marathoner of the last 40 years.',
    h1('Run slower. Race faster. Yes, really.') +
    p('{{ params.FIRSTNAME | default : "Hey" }} — one week in. How are the legs?') +
    p('Today I want to share the single biggest mindset shift between recreational runners and the ones who keep PR\'ing year after year: <strong>they run their easy runs embarrassingly slow.</strong>') +
    h2('The 80/20 rule') +
    p('Stephen Seiler analyzed elite endurance athletes across cycling, rowing, XC skiing, and running. The pattern was identical: ~80% of training volume at easy/Zone 2 pace, ~20% at hard/threshold pace. <strong>Almost nothing in the gray middle.</strong>') +
    p('Most amateurs flip it — too much "moderately hard" running, not enough truly easy or truly hard. The result: chronic fatigue, no improvement, eventual injury.') +
    h2('What is Zone 2, practically?') +
    list([
      '<strong>Talk test:</strong> you can hold a full conversation in complete sentences.',
      '<strong>Nose-breathing:</strong> you can breathe through your nose only without gasping.',
      '<strong>Heart rate:</strong> roughly 60–70% of max. For most: 130–145 bpm.',
      '<strong>Pace:</strong> usually 60–90 sec/km slower than your 5k race pace. <em>Yes, that slow.</em>',
    ]) +
    callout('Zone 2 builds mitochondrial density and capillary networks — the actual machinery of endurance. You can\'t shortcut this with hard intervals.') +
    h2('Your week 2–4 schedule') +
    list([
      '3–4 easy/Zone 2 runs (45–75 min)',
      '1 quality session (intervals, tempo, or hills) — 20% of weekly volume',
      '1 long run (Zone 2, gradually building)',
      '1–2 rest or cross-training days',
    ]) +
    sig(),
    btn(utm('blog/zone-2-training/', 'zone2'), 'Full Zone 2 protocol') +
    small('Bonus: ' + a(utm('blog/heart-rate-zones/', 'zone2'), 'How to find your true HR zones') + ' (no lab test needed).'),
  ),
};

const T6 = {
  subject: 'Day 10 · The 4 exercises that bulletproof a runner',
  html: layout(
    'Injury Prevention',
    'Calves, glutes, hips, feet. 12 minutes, 3x a week. That\'s the whole program.',
    h1('Become un-injurable.') +
    p('{{ params.FIRSTNAME | default : "Hey" }} — 70% of runners get injured each year. The ones who don\'t almost universally do two things: rotate shoes (✅ you\'re sorted) and do a tiny strength routine.') +
    p('Not CrossFit. Not the gym. Just these four moves, 3x a week, in your living room. 12 minutes total.') +
    h2('The 4 non-negotiables') +
    list([
      '<strong>1. Single-leg calf raises — 3×15 each side.</strong> Off a step, full range. Bulletproofs Achilles + plantar fascia.',
      '<strong>2. Side-lying clamshells — 3×15 each side.</strong> Glute medius. Fixes IT band and runner\'s knee.',
      '<strong>3. Single-leg glute bridges — 3×12 each side.</strong> Posterior chain. The runner\'s power source.',
      '<strong>4. Toe yoga + short-foot drill — 2 min/day.</strong> Sounds silly. Saved more arches than any insole I\'ve ever tested.',
    ]) +
    callout('A 2018 meta-analysis in BJSM found strength training reduced overuse running injuries by <strong>~50%</strong>. Plyometrics added another 15%. The juice is worth the squeeze.') +
    h2('Recovery non-negotiables') +
    list([
      'Sleep 7.5+ hours. The single highest-leverage recovery tool, free of charge.',
      'Hydrate to clear urine. Tendons hate dehydration.',
      '1 full rest day per week. Yes, even when you feel great. <em>Especially</em> then.',
      'Replace shoes at 500–800 km. Track in Strava or a notebook.',
    ]) +
    p('{{ params.FIRSTNAME | default : "" }}, the pattern of runners who never get hurt isn\'t talent — it\'s these unglamorous 12 minutes done consistently.') +
    sig(),
    btn(utm('blog/running-injury-prevention/', 'injury'), 'Get the full strength routine (with video)'),
  ),
};

const T7 = {
  subject: 'Day 14 · Race day: 9 things I wish someone had told me',
  html: layout(
    'Race Day Playbook',
    'Pacing, fueling, kit, taper, and the mental switch in the last 5k.',
    h1('Race day, demystified.') +
    p('{{ params.FIRSTNAME | default : "Hey" }} — two weeks in. Whether your next race is in 6 weeks or 6 months, lock these in <em>now</em>. They\'re the lessons I learned the painful way.') +
    h2('The week before') +
    list([
      '<strong>Taper hard.</strong> Cut volume 40% the final week, 60% the last 3 days. Keep some intensity (short strides) so you don\'t feel flat.',
      '<strong>Sleep bank.</strong> Two nights before is more important than the night before — pre-race nerves are normal.',
      '<strong>Carb load 2–3 days out:</strong> 7–10 g per kg of bodyweight per day. Rice, pasta, bread, fruit. Easy on fiber and fats race-eve.',
      '<strong>Nothing new on race day.</strong> Not the shoes (you broke yours in — perfect), not the gels, not the socks. Nothing.',
    ]) +
    h2('Pacing — the universal truth') +
    callout('<strong>Negative split or die.</strong> Run the first half 5–10 sec/km <em>slower</em> than goal pace. Almost every PR is set this way. Almost every blow-up starts with going out 10 sec too fast in km 1–3.') +
    h2('Fueling') +
    list([
      '<strong>5k–10k:</strong> nothing needed beyond hydration.',
      '<strong>Half marathon:</strong> 30–60 g carbs/hour. 1–2 gels.',
      '<strong>Marathon:</strong> 60–90 g carbs/hour. Practice this in long runs — your gut needs training too.',
    ]) +
    h2('The mental trick for the final 5k') +
    p('When it gets dark — and it will — break the remaining distance into <strong>tiny chunks</strong>: "to the next aid station," "to the next km marker," "10 more breaths." Never think about the finish line. Just the next chunk.') +
    sig(),
    btn(utm('blog/race-day-checklist/', 'raceday'), 'Print the race day checklist') +
    small('Got a race coming up? Hit reply and tell me which one. I\'ll send you a tailored pacing plan.'),
  ),
};

const T8 = {
  subject: 'You\'ve evolved. Time to re-match your shoes.',
  html: layout(
    'Your 3-Week RunMatch Check-In',
    'Mileage shifts. Goals shift. Your rotation should too. Free re-match inside.',
    h1('Three weeks in. Different runner.') +
    p('{{ params.FIRSTNAME | default : "Hey" }} — quick check-in.') +
    p('Three weeks of consistent running changes you. Cadence climbs. Easy pace gets easier. Maybe you\'ve added mileage, or signed up for a race, or discovered you actually love trails. Maybe a niggle showed up.') +
    p('That\'s not the same runner who took the quiz on day 0. Which means your shoe rotation might need a tune-up.') +
    h2('When to re-match') +
    list([
      '✅ Weekly mileage went up (or down) by 25%+',
      '✅ You\'ve set a new race goal or distance',
      '✅ You\'re feeling a recurring niggle (calf, knee, foot)',
      '✅ Your primary shoe is past 400 km',
      '✅ You want to add a trail or carbon-plated shoe to the rotation',
    ]) +
    callout('The re-match takes 90 seconds. We\'ll factor in everything you\'ve learned about your stride in the last 3 weeks.') +
    btn(utm('shoe-match/', 'rematch'), 'Re-take the RunMatch quiz') +
    h2('And one ask') +
    p('If RunMatch + this email series helped you, two things would mean the world:') +
    list([
      'Hit reply and tell me what changed for you. I read every single one.',
      'Forward this to the runner in your life who\'s wearing the wrong shoes (you know who).',
    ]) +
    p('Either way — I\'m glad we crossed paths. Keep showing up. The compounding is real.') +
    sig(),
    p('Keep exploring:') +
    small('• ' + a(utm('best-running-shoes/', 'rematch'), 'Latest shoe reviews') + '<br>• ' + a(utm('blog/', 'rematch'), 'Training & nutrition library') + '<br>• ' + a(utm('shoe-match/', 'rematch'), 'Re-take RunMatch AI')),
  ),
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
