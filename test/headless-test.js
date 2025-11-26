const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

(async () => {
  const root = process.cwd();
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const daily = fs.readFileSync(path.join(root, 'daily-links.js'), 'utf8');
  const mapping = fs.readFileSync(path.join(root, 'window.DAILY_LINKS'), 'utf8');

  // Prepare a small script to enable masking before index scripts run
  const preMask = `<script>window.MASK_AS_GOOGLE_SLIDES = true; window.MASK_TITLE = 'Google Slides - Presentation'; window.MASK_PATH = '/presentation/d/1FAKEID/edit';</script>`;

  // Strip any outer <script> tags from the mapping file so we can eval it later
  const mappingContent = mapping.replace(/^\s*<script[^>]*>/i, '').replace(/<\/script>\s*$/i, '');

  // Insert the preMask into the HTML but don't inject mapping/daily as script tags.
  const htmlWithInject = html.replace(/<body([^>]*)>/i, match => match + '\n' + preMask);

  const dom = new JSDOM(htmlWithInject, {
    runScripts: 'dangerously',
    resources: 'usable',
    url: 'http://localhost:8000/index.html'
  });

  // Wait for load event or a short timeout
  await new Promise((resolve) => {
    dom.window.addEventListener('load', () => resolve(), { once: true });
    setTimeout(resolve, 1500);
  });

  const doc = dom.window.document;

  // Ensure the daily-links script has run (it should be in the HTML). If registerDailyLinks
  // isn't present, evaluate the daily-links file and then evaluate the mapping.
  try {
    if (typeof dom.window.registerDailyLinks !== 'function') {
      dom.window.eval(daily);
    }
  } catch (e) {
    // ignore
  }

  // Now eval the mapping content so the mapping is registered
  try { dom.window.eval(mappingContent); } catch (e) { /* ignore */ }

  // Compute expected provider URL according to the same algorithm
  const providers = [
    'https://providerA.example/watch',
    'https://providerB.example/watch',
    'https://providerC.example/watch'
  ];
  const days = Math.floor(Date.now() / 86400000);
  const expected = providers[days % providers.length];

  // Check anchors
  const anchors = Array.from(doc.querySelectorAll('a'));
  const mismatches = anchors.filter(a => a.href !== expected);

  console.log('Anchors found:', anchors.length);
  if (anchors.length) {
    console.log('First anchor href:', anchors[0].href);
  }
  console.log('Expected href for today:', expected);

  if (mismatches.length === 0) {
    console.log('All anchors match expected provider URL.');
  } else {
    console.log('Some anchors did not match expected URL. Mismatch count:', mismatches.length);
  }

  // Check masking
  const title = doc.title;
  const maskTitle = dom.window.MASK_TITLE || 'Google Slides - Presentation';
  const maskPath = dom.window.MASK_PATH || '/presentation/d/1FAKEID/edit';

  console.log('Document title:', title);
  console.log('Expected mask title:', maskTitle);
  console.log('Location pathname:', dom.window.location.pathname);
  console.log('Expected mask path included:', maskPath);

  const titleOk = title === maskTitle;
  const pathOk = dom.window.location.pathname.indexOf(maskPath) !== -1 || dom.window.location.href.indexOf(maskPath) !== -1;

  if (titleOk && pathOk) {
    console.log('Masking appears to be applied correctly.');
  } else {
    console.log('Masking not fully applied. titleOk=', titleOk, 'pathOk=', pathOk);
  }

  // Exit with non-zero code on failures
  if (mismatches.length === 0 && titleOk && pathOk) process.exit(0);
  else process.exit(2);
})();
