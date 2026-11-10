'use strict';

// Die Bibliotheken werden ausschliesslich zum Testen benutzt, nie in index.html.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium, firefox } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;

const root = path.resolve(__dirname, '..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'angebote_basel-landschaft.json'), 'utf8'));
const curation = JSON.parse(fs.readFileSync(path.join(root, 'src/highlights.json'), 'utf8'));
const url = pathToFileURL(path.join(root, 'index.html')).href;
const offer = nr => source.angebote.find(item => item.nr === nr);
const categories = [
  ['food', 'Essen & Trinken'], ['night', 'Ausgang & Nachtleben'],
  ['sport', 'Freizeit & Sport'], ['shopping', 'Einkaufen & Dienstleistungen'],
  ['wellness', 'Wellness & Beauty']
];
const artifacts = process.env.TEST_ARTIFACTS || path.join(root, 'test-results');
fs.mkdirSync(artifacts, { recursive: true });
const results = [];
const engines = process.env.TEST_BROWSER === 'chromium' ? { chromium } : process.env.TEST_BROWSER === 'firefox' ? { firefox } : { chromium, firefox };

async function check(name, fn) {
  await fn();
  console.log(`OK: ${name}`);
  results.push(name);
}

async function visibleCount(page) {
  return page.locator('.offer-card:not([hidden])').count();
}

async function waitForPicture(page) {
  await page.waitForFunction(() => document.querySelector('#image-stage').getAttribute('aria-busy') === 'false');
}

async function expectFocus(page, id) {
  // Das native dialog-close-Ereignis wird als eigener Browser-Task zugestellt.
  await page.waitForFunction(expected => document.activeElement.id === expected, id);
}

async function openCard(page, nr) {
  await page.locator(`#card-open-${offer(nr).id}`).click();
  await page.waitForSelector('#detail-dialog[open]');
  await waitForPicture(page);
  assert.equal(await page.locator('#detail-dialog').getAttribute('data-offer-id'), offer(nr).id);
}

async function closeDetail(page) {
  await page.locator('#detail-close').click();
  await page.waitForSelector('#detail-dialog[open]', { state: 'detached' });
}

async function assertSaved(page, nr, expected) {
  const states = await page.locator(`[data-save="${offer(nr).id}"]`).evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-pressed')));
  assert(states.length, 'Es muss mindestens einen Merk-Knopf geben.');
  assert(states.every(state => state === String(expected)), `${nr}: unsynchronisierte Merk-Knöpfe ${states}`);
}

async function axe(page, label) {
  const report = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const issues = report.violations.map(issue => ({ id: issue.id, impact: issue.impact, nodes: issue.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) }));
  fs.writeFileSync(path.join(artifacts, `axe-${label}.json`), JSON.stringify(issues, null, 2));
  assert.deepEqual(issues, [], `Barrierefreiheitsfehler: ${label}`);
}

async function testHighlightAutoplay(name, browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, reducedMotion: 'no-preference', hasTouch: true });
  await context.setOffline(true);
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install({ time: new Date('2026-11-10T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-11-10T12:00:01Z'));

  async function load(reducedMotion = 'no-preference') {
    await page.mouse.move(0, 0);
    await page.emulateMedia({ reducedMotion });
    await page.goto(url);
    await page.waitForSelector('.highlight-card');
    if (reducedMotion === 'no-preference') await waitForAutoplay();
  }

  async function waitForAutoplay() {
    await page.waitForFunction(() => document.querySelector('#highlight-position').getAttribute('aria-live') === 'off');
  }

  async function expectSlide(number) {
    await page.waitForFunction(expected => {
      const track = document.querySelector('#highlight-track').getBoundingClientRect();
      const card = document.querySelectorAll('.highlight-card')[expected - 1].getBoundingClientRect();
      return document.querySelector('#highlight-position').textContent === `${expected} / 7` && card.left >= track.left - 1 && card.right <= track.right + 1;
    }, number);
  }

  async function advance(number) {
    await page.clock.runFor(5000);
    await expectSlide(number);
  }

  await check(`${name}: automatische Highlights im Fünf-Sekunden-Takt, Umlauf und Stopp bei Maus, Touch und Tastatur`, async () => {
    await load();
    await page.clock.runFor(4999);
    assert.equal(await page.locator('#highlight-position').innerText(), '1 / 7');
    await page.clock.runFor(1);
    await expectSlide(2);
    for (const number of [3, 4, 5, 6, 7, 1]) await advance(number);

    await page.locator('#highlight-track').hover();
    assert.equal(await page.locator('#highlight-position').getAttribute('aria-live'), 'polite');
    await page.mouse.move(0, 0);
    await page.clock.runFor(10000);
    await expectSlide(1);
    await page.locator('#next-highlight').click();
    await expectSlide(2);
    await page.clock.runFor(10000);
    await expectSlide(2);

    await load();
    await page.locator('#highlight-track').focus();
    await page.keyboard.press('ArrowRight');
    await expectSlide(2);
    await page.locator('.edition-link').focus();
    await page.clock.runFor(10000);
    await expectSlide(2);

    await load();
    const card = await page.locator('.highlight-card').first().boundingBox();
    await page.touchscreen.tap(card.x + 25, card.y + 25);
    await page.waitForSelector('#detail-dialog[open]');
    await page.keyboard.press('Escape');
    await page.clock.runFor(10000);
    await expectSlide(1);
    assert.equal(await page.locator('#highlight-position').getAttribute('aria-live'), 'polite');
  });

  await check(`${name}: automatische Highlights pausieren ausser Sicht, bei reduzierter Bewegung und geöffneten Fenstern`, async () => {
    await load('reduce');
    await page.clock.runFor(24000);
    await expectSlide(1);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await waitForAutoplay();
    await advance(2);

    await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
    await page.waitForFunction(() => document.querySelector('#highlight-position').getAttribute('aria-live') === 'polite');
    await page.clock.runFor(10000);
    assert.equal(await page.locator('#highlight-position').innerText(), '2 / 7');
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await waitForAutoplay();
    await advance(3);

    await page.locator('#open-favorites').click();
    await page.clock.runFor(10000);
    assert.equal(await page.locator('#highlight-position').innerText(), '3 / 7');
    await page.keyboard.press('Escape');
    await advance(4);
    assert.deepEqual(errors, []);
  });
  await context.close();
}

async function testTheme(name, browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, colorScheme: 'light', reducedMotion: 'reduce' });
  await context.setOffline(true);
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  const state = () => page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    pressed: document.querySelector('#theme-toggle').getAttribute('aria-pressed'),
    background: getComputedStyle(document.body).backgroundColor,
    meta: document.querySelector('meta[name="theme-color"]').content,
    title: document.querySelector('#theme-toggle').title,
    sun: !document.querySelector('#theme-icon-light').hasAttribute('hidden'),
    moon: !document.querySelector('#theme-icon-dark').hasAttribute('hidden'),
    stored: localStorage.getItem('gutscheinbuch:design:v1')
  }));
  const expectState = async expected => {
    await page.waitForFunction(expected => {
      const node = document.documentElement;
      return node.dataset.theme === expected.theme;
    }, expected);
    const actual = await state();
    for (const [key, value] of Object.entries(expected)) assert.equal(actual[key], value, key);
  };

  await check(`${name}: Design-Umschalter wechselt Hell/Dunkel, speichert die Wahl und folgt sonst dem Gerät`, async () => {
    await page.goto(url);
    await page.waitForSelector('.offer-card');
    await expectState({ theme: 'light', pressed: 'false', background: 'rgb(247, 246, 240)', meta: '#f7f6f0', title: 'Zu dunklem Design wechseln', sun: true, moon: false, stored: null });

    await page.locator('#theme-toggle').click();
    await expectState({ theme: 'dark', pressed: 'true', background: 'rgb(19, 27, 22)', meta: '#131b16', title: 'Zu hellem Design wechseln', sun: false, moon: true, stored: 'dark' });
    await page.waitForFunction(() => [...document.querySelectorAll('[data-announcer]')].some(node => node.textContent.includes('Dunkles Design')));

    await page.reload();
    await page.waitForSelector('.offer-card');
    await expectState({ theme: 'dark', pressed: 'true', stored: 'dark' });
    await page.emulateMedia({ colorScheme: 'light' });
    await page.waitForTimeout(100);
    await expectState({ theme: 'dark', stored: 'dark' });

    await page.locator('#theme-toggle').click();
    await expectState({ theme: 'light', pressed: 'false', background: 'rgb(247, 246, 240)', meta: '#f7f6f0', stored: 'light' });
    await page.reload();
    await page.waitForSelector('.offer-card');
    await expectState({ theme: 'light', pressed: 'false', stored: 'light' });

    await page.evaluate(() => localStorage.removeItem('gutscheinbuch:design:v1'));
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.reload();
    await page.waitForSelector('.offer-card');
    await expectState({ theme: 'dark', pressed: 'true', background: 'rgb(19, 27, 22)', stored: null });
    await page.emulateMedia({ colorScheme: 'light' });
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
    await expectState({ theme: 'light', pressed: 'false', stored: null });

    await page.locator('#theme-toggle').focus();
    await page.keyboard.press('Space');
    await expectState({ theme: 'dark', pressed: 'true', stored: 'dark' });
    assert.deepEqual(errors, []);
  });
  await context.close();
}

async function testEngine(name, engine) {
  const browser = await engine.launch({ headless: true });
  console.log(`\n${name} ${browser.version()} – offline über file://`);
  await testTheme(name, browser);
  await testHighlightAutoplay(name, browser);
  const context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, colorScheme: 'light', reducedMotion: 'reduce', timezoneId: 'Europe/Zurich', acceptDownloads: true });
  // Direkter file://-Aufruf bei abgeschaltetem Netzwerk ist der tatsächliche Auslieferungsfall.
  await context.setOffline(true);
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const errors = [];
  const requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => requests.push(request.url()));
  await page.goto(url);
  await page.waitForSelector('.offer-card');

  await check(`${name}: 128 Angebote, fünf Kategorien und berechnete Filterzahlen`, async () => {
    assert.equal(await visibleCount(page), 128);
    assert.equal(await page.locator('.offer-group').count(), 5);
    const ids = await page.locator('.offer-card').evaluateAll(nodes => nodes.map(node => node.dataset.offerId));
    assert.deepEqual(ids, source.angebote.map(item => item.id));
    assert.equal(await page.locator('#edition-region').innerText(), 'Basel-Landschaft');
    assert.equal(await page.locator('#edition-year').innerText(), 'Ausgabe 2027');
    for (const [selector, expected] of [['[data-total-count]', 128], ['[data-deal="two"] .chip-count', 86], ['[data-deal="half"] .chip-count', 37]]) {
      assert.equal(Number(await page.locator(selector).innerText()), expected);
    }
    const initialImages = await page.locator('img[src]').count();
    assert(initialImages < 20, `Start dekodiert zu viele Bilder: ${initialImages}`);
    assert.equal(await page.locator('#detail-image').count(), 0);
    for (const [nr, text] of [[1, 'FALAFELSANDWICH'], [82, 'AUF EIN BLUMENBOUQUET BIS 50 CHF'], [20, 'MITTAGSMENÜ']]) {
      assert.equal(await page.locator(`#offer-${offer(nr).id} .offer-copy`).innerText(), text);
    }
    for (const nr of [65, 71, 87, 92, 95, 103, 104]) {
      assert.equal(await page.locator(`#offer-${offer(nr).id} .offer-copy`).innerText(), offer(nr).angebot);
    }
    await page.screenshot({ path: path.join(artifacts, `${name}-desktop-light.png`) });
  });

  await check(`${name}: alle Kategorie-/Deal-Kombinationen und Suche`, async () => {
    const typeMatches = {
      all: () => true, two: item => item.typ === '2für1', half: item => item.typ === '50% Rabatt',
      other: item => !['2für1', '50% Rabatt'].includes(item.typ)
    };
    for (const [key, categoryName] of [['all', null], ...categories]) {
      await page.locator(`[data-category="${key}"]`).click();
      for (const [type, match] of Object.entries(typeMatches)) {
        await page.locator(`[data-deal="${type}"]`).click();
        const expected = source.angebote.filter(item => (!categoryName || item.kategorie === categoryName) && match(item)).length;
        assert.equal(await visibleCount(page), expected, `${key}/${type}`);
        assert.equal(await page.locator('#results-count strong').innerText(), String(expected));
        assert.equal(await page.locator(`[data-category="${key}"]`).getAttribute('aria-pressed'), 'true');
        assert.equal(await page.locator(`[data-deal="${type}"]`).getAttribute('aria-pressed'), 'true');
      }
    }
    await page.locator('#reset-filters').click();
    await page.locator('#search').fill('rÖsSli');
    assert.equal(await visibleCount(page), 1);
    await page.locator('#search').fill('Rossli');
    assert.equal(await visibleCount(page), 1);
    await page.locator('#search').fill('CAFE');
    assert.equal(await visibleCount(page), 2);
    await page.locator('#search').fill('basel ticket');
    assert.equal(await visibleCount(page), 3);
    await page.locator('[data-deal="half"]').focus();
    await page.keyboard.press('Space');
    assert.equal(await visibleCount(page), 0);
    assert(await page.locator('#no-results').isVisible());
    await page.locator('#no-results [data-reset]').click();
    assert.equal(await visibleCount(page), 128);
    assert.equal(await page.locator('#search').inputValue(), '');
    assert.equal(await page.locator('#remembered-only').isChecked(), false);
  });

  await check(`${name}: sieben Highlights, Scrollen, Pfeil-/Direktnavigation, Tastatur und Detailverweise`, async () => {
    const track = page.locator('#highlight-track');
    assert.equal(await page.locator('.highlight-card').count(), 7);
    const ids = await page.locator('.highlight-card').evaluateAll(nodes => nodes.map(node => node.dataset.highlightId));
    assert.deepEqual(ids, curation.map(pick => offer(pick.nr).id));
    assert(await page.locator('#previous-highlight').isDisabled());
    for (const [index, pick] of curation.entries()) {
      if (index) await page.locator('#next-highlight').click();
      await page.waitForFunction(position => {
        const track = document.querySelector('#highlight-track').getBoundingClientRect();
        const card = document.querySelectorAll('.highlight-card')[position].getBoundingClientRect();
        return card.left >= track.left - 1 && card.right <= track.right + 1;
      }, index);
      assert.equal(await page.locator('#highlight-position').innerText(), `${index + 1} / 7`);
      const item = offer(pick.nr);
      assert.equal(await page.locator(`[data-highlight-id="${item.id}"] .highlight-copy`).innerText(), pick.beschreibung);
      await page.locator(`#highlight-open-${item.id}`).click();
      await waitForPicture(page);
      assert.equal(await page.locator('#detail-title').innerText(), item.firma);
      assert((await page.locator('#detail-position').innerText()).includes('von 128'));
      await closeDetail(page);
      await expectFocus(page, `highlight-open-${item.id}`);
    }
    assert(await page.locator('#next-highlight').isDisabled());
    await page.locator('#previous-highlight').click();
    assert.equal(await page.locator('#highlight-position').innerText(), '6 / 7');
    await page.locator('[data-highlight-target="2"]').click();
    assert.equal(await page.locator('#highlight-position').innerText(), '3 / 7');
    await track.focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#highlight-position').innerText(), '4 / 7');
    await page.keyboard.press('End');
    assert.equal(await page.locator('#highlight-position').innerText(), '7 / 7');
    await page.keyboard.press('Home');
    assert.equal(await page.locator('#highlight-position').innerText(), '1 / 7');
    await track.hover();
    await page.mouse.wheel((await track.boundingBox()).width, 0);
    await page.waitForFunction(() => document.querySelector('#highlight-track').scrollLeft > 100 && document.querySelector('#highlight-position').textContent !== '1 / 7');
    await track.focus();
    await page.keyboard.press('Home');
    await page.keyboard.press('Tab');
    await expectFocus(page, `highlight-open-${offer(curation[0].nr).id}`);
    await page.keyboard.press('Tab');
    await expectFocus(page, `highlight-save-${offer(curation[0].nr).id}`);
    await page.keyboard.press('Tab');
    await expectFocus(page, `highlight-open-${offer(curation[1].nr).id}`);
    assert.equal(await page.locator('#highlight-position').innerText(), '2 / 7');
    await track.focus();
    await page.keyboard.press('Home');
  });

  await check(`${name}: Detailfenster, ganze Bilder, stabile Ansichten, Zoom, Ringnavigation und Fokus`, async () => {
    const firstButton = page.locator(`#card-open-${offer(1).id}`);
    await firstButton.focus();
    await page.keyboard.press('Enter');
    await waitForPicture(page);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'detail-close');
    const before = await page.locator('#image-stage').boundingBox();
    const imageBox = await page.locator('#detail-image').boundingBox();
    assert(imageBox.height <= before.height && imageBox.width <= before.width, 'Das eingepasste Bild darf nicht beschnitten sein.');
    const front = await page.locator('#detail-image').getAttribute('src');
    await page.locator('[data-side="rueckseite"]').click();
    await waitForPicture(page);
    const after = await page.locator('#image-stage').boundingBox();
    assert(Math.abs(before.height - after.height) < 1 && Math.abs(before.width - after.width) < 1);
    assert.notEqual(await page.locator('#detail-image').getAttribute('src'), front);
    assert.equal(await page.locator('#detail-image').getAttribute('alt'), `${offer(1).firma} – Rückseite`);
    await page.locator('#zoom-image').click();
    assert.equal(await page.locator('#zoom-image').getAttribute('aria-pressed'), 'true');
    await page.keyboard.press('ArrowDown');
    await page.waitForFunction(() => document.querySelector('#image-stage').scrollTop > 0);
    assert.equal(await page.locator('#detail-dialog').getAttribute('data-offer-id'), offer(1).id);
    await page.locator('#zoom-image').click();
    await page.locator('#previous-offer').click();
    assert.equal(await page.locator('#detail-dialog').getAttribute('data-offer-id'), offer(128).id);
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#detail-dialog').getAttribute('data-offer-id'), offer(1).id);
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#detail-dialog').getAttribute('data-offer-id'), offer(2).id);
    await waitForPicture(page);
    await page.locator('#next-offer').focus();
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'detail-save');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'next-offer');
    await page.screenshot({ path: path.join(artifacts, `${name}-detail-back.png`) });
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#detail-dialog').getAttribute('open'), null);
    await expectFocus(page, `card-open-${offer(1).id}`);
    await openCard(page, 2);
    await page.mouse.click(2, 2);
    assert.equal(await page.locator('#detail-dialog').getAttribute('open'), null);
    // Ganze Karte per Maus: auch ein Klick auf das Angebotsbild öffnet den Gutschein.
    await page.locator(`#offer-${offer(1).id}`).scrollIntoViewIfNeeded();
    const visual = await page.locator(`#offer-${offer(1).id} .ticket-visual`).boundingBox();
    await page.mouse.click(visual.x + visual.width / 2, visual.y + visual.height / 2);
    assert.equal(await page.locator('#detail-dialog').getAttribute('data-offer-id'), offer(1).id);
    await closeDetail(page);
    await page.locator('[data-category="night"]').click();
    await openCard(page, 28);
    await page.locator('#previous-offer').click();
    assert.equal(await page.locator('#detail-dialog').getAttribute('data-offer-id'), offer(32).id);
    assert((await page.locator('#detail-position').innerText()).includes('5 von 5'));
    await closeDetail(page);
    await page.locator('#reset-filters').click();
  });

  await check(`${name}: alle drei bestätigten Ersatz-Rückseiten`, async () => {
    for (const nr of [70, 71, 121]) {
      await openCard(page, nr);
      const before = await page.locator('#image-stage').boundingBox();
      await page.locator('[data-side="rueckseite"]').click();
      await waitForPicture(page);
      assert.equal(await page.locator('#detail-image').count(), 0);
      assert.equal(await page.locator('.image-fallback h3').innerText(), offer(nr).firma);
      assert.equal(await page.locator('.fallback-offer').innerText(), offer(nr).angebot);
      assert(await page.locator('#zoom-image').isDisabled());
      const after = await page.locator('#image-stage').boundingBox();
      assert(Math.abs(before.height - after.height) < 1 && Math.abs(before.width - after.width) < 1);
      await closeDetail(page);
    }
  });

  await check(`${name}: Merken/Entfernen synchron in Highlights, Karte und Detail`, async () => {
    const nr = 126;
    const id = offer(nr).id;
    await page.locator(`#highlight-save-${id}`).click();
    assert.equal(await page.locator('#detail-dialog').getAttribute('open'), null);
    await assertSaved(page, nr, true);
    await page.locator(`#highlight-open-${id}`).click();
    await assertSaved(page, nr, true);
    await page.locator('#detail-save').click();
    await assertSaved(page, nr, false);
    await page.locator('#next-offer').click();
    assert.equal(await page.locator('#detail-save').getAttribute('data-save'), offer(127).id);
    await assertSaved(page, 127, false);
    await page.locator('#detail-save').click();
    await assertSaved(page, 127, true);
    await page.locator('#previous-offer').click();
    await assertSaved(page, nr, false);
    await closeDetail(page);
    await page.locator(`#card-save-${offer(127).id}`).click();
    await assertSaved(page, 127, false);
    await page.locator(`#card-save-${id}`).click();
    await assertSaved(page, nr, true);
    await page.locator('#remembered-only').check();
    assert.equal(await visibleCount(page), 1);
    await page.locator('#search').fill('nicht-vorhanden');
    assert.equal(await visibleCount(page), 0);
    assert.equal(await page.locator('#open-favorites [data-favorites-count]').innerText(), '1');
    await page.locator('#search').fill('sole uno');
    await page.locator('[data-category="wellness"]').click();
    await page.locator('[data-deal="two"]').click();
    assert.equal(await visibleCount(page), 1);
    await page.locator('#reset-filters').click();
  });

  await check(`${name}: sessionStorage erhält Auswahl beim Neuladen; neuer Tab ist leer`, async () => {
    await page.reload();
    await page.waitForSelector('.offer-card');
    assert.equal(await visibleCount(page), 128);
    await assertSaved(page, 126, true);
    assert.equal(await page.locator('#open-favorites [data-favorites-count]').innerText(), '1');
    const otherTab = await context.newPage();
    await otherTab.goto(url);
    await otherTab.waitForSelector('.offer-card');
    assert.equal(await otherTab.locator('#open-favorites [data-favorites-count]').innerText(), '0');
    await otherTab.close();
    await page.locator(`#card-save-${offer(126).id}`).click();
    await assertSaved(page, 126, false);
  });

  const exportNrs = [119, 112, 2, 6, 16, 80, 121, 95, 93, 65, 127];
  await check(`${name}: gruppierte Merkliste und echter TXT-Download mit BOM, CRLF und Originaldaten`, async () => {
    for (const nr of exportNrs) await page.locator(`#card-save-${offer(nr).id}`).click();
    await page.locator('#open-favorites').click();
    assert.equal(await page.locator('.saved-item').count(), exportNrs.length);
    await expectFocus(page, 'favorites-title');
    const collator = new Intl.Collator('de-CH', { sensitivity: 'base', numeric: true });
    const expected = categories.flatMap(([, category]) => exportNrs.map(offer).filter(item => item.kategorie === category).sort((a, b) => collator.compare(a.firma, b.firma) || a.nr - b.nr));
    const renderedIds = await page.locator('.saved-item').evaluateAll(nodes => nodes.map(node => node.dataset.savedId));
    assert.deepEqual(renderedIds, expected.map(item => item.id));
    const dateStamp = await page.evaluate(() => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; });
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#export-favorites').click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), `merkliste-${dateStamp}.txt`);
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const bytes = Buffer.concat(chunks);
    assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
    const text = bytes.subarray(3).toString('utf8');
    assert(!/(?<!\r)\n|\r(?!\n)/u.test(text), 'Export enthält andere Umbrüche als CRLF.');
    assert(text.includes(`Merkliste - Gutscheinbuch ${source.region}`));
    assert(text.includes(`Gemerkte Angebote: ${exportNrs.length}`));
    assert(text.includes('Exportdatum: '));
    assert(text.includes('«HUUS»') && text.includes('Café Bäckerei') && text.includes('Rössli') && text.includes('«VOLKSSTIMME»'));
    const exportedCompanies = text.split('\r\n').filter(line => line.startsWith('[ ] ')).map(line => line.slice(4));
    assert.deepEqual(exportedCompanies, expected.map(item => item.firma));
    for (const item of expected) assert(text.includes(`[ ] ${item.firma}\r\nDeal: ${item.typ}\r\nAngebot: ${item.angebot}\r\n`));
    assert(!text.includes('http') && !text.includes('Öffnungszeiten:') && !text.includes('Gültig:'));
    fs.writeFileSync(path.join(artifacts, `${name}-merkliste.txt`), bytes);
    await page.screenshot({ path: path.join(artifacts, `${name}-merkliste-light.png`) });
  });

  await check(`${name}: Fokus nach verschachteltem Detail und Entfernen; Leeren mit Rückfrage`, async () => {
    await page.locator(`#saved-open-${offer(119).id}`).click();
    await waitForPicture(page);
    await page.locator('#detail-save').click();
    await page.keyboard.press('Escape');
    assert(await page.locator('#favorites-dialog').isVisible());
    assert.equal(await page.locator('.saved-item').count(), exportNrs.length - 1);
    await expectFocus(page, 'favorites-title');
    await page.locator(`#saved-remove-${offer(112).id}`).click();
    assert.equal(await page.locator('.saved-item').count(), exportNrs.length - 2);
    assert.equal(await page.locator('#detail-dialog').getAttribute('open'), null);
    await page.locator('#clear-favorites').click();
    assert(await page.locator('#clear-dialog').isVisible());
    assert.equal(await page.evaluate(() => document.activeElement.id), 'cancel-clear');
    await page.locator('#cancel-clear').click();
    assert.equal(await page.locator('.saved-item').count(), exportNrs.length - 2);
    await page.locator('#clear-favorites').click();
    await page.locator('#confirm-clear').click();
    assert.equal(await page.locator('.saved-item').count(), 0);
    assert(await page.locator('#export-favorites').isDisabled());
    assert(await page.locator('#clear-favorites').isDisabled());
    await page.waitForFunction(() => [...document.querySelectorAll('[data-announcer]')].some(node => node.textContent.includes('geleert')));
    await expectFocus(page, 'favorites-title');
    await page.locator('[data-close="favorites-dialog"]').first().click();
    await expectFocus(page, 'open-favorites');
    await page.reload();
    await page.waitForSelector('.offer-card');
    assert.equal(await page.locator('#open-favorites [data-favorites-count]').innerText(), '0');
  });

  await check(`${name}: responsive Layouts, Hell-/Dunkelmodus und reduzierte Bewegung`, async () => {
    for (const colorScheme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      for (const width of [320, 390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        const fits = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
        assert(fits.document <= fits.viewport && fits.body <= fits.viewport, `${colorScheme}/${width}: ${JSON.stringify(fits)}`);
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: path.join(artifacts, `${name}-mobile-${colorScheme}.png`) });
      await openCard(page, 65);
      assert(await page.evaluate(() => document.querySelector('#detail-dialog').scrollWidth <= document.querySelector('#detail-dialog').clientWidth));
      await page.locator('[data-side="rueckseite"]').click();
      await waitForPicture(page);
      await page.screenshot({ path: path.join(artifacts, `${name}-mobile-detail-${colorScheme}.png`) });
      await closeDetail(page);
      await page.locator(`#card-save-${offer(65).id}`).click();
      await page.locator('#open-favorites').click();
      assert(await page.evaluate(() => document.querySelector('#favorites-dialog').scrollWidth <= document.querySelector('#favorites-dialog').clientWidth));
      await page.screenshot({ path: path.join(artifacts, `${name}-mobile-merkliste-${colorScheme}.png`) });
      await page.locator(`#saved-remove-${offer(65).id}`).click();
      await page.locator('[data-close="favorites-dialog"]').first().click();
    }
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior), 'auto');
    await page.setViewportSize({ width: 1440, height: 1080 });
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: path.join(artifacts, `${name}-desktop-dark.png`) });
  });

  await check(`${name}: automatisierte Barrierefreiheit in Hell-/Dunkelmodus und beiden Fenstern`, async () => {
    for (const colorScheme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme });
      await axe(page, `${name}-${colorScheme}-seite`);
      await openCard(page, 2);
      await axe(page, `${name}-${colorScheme}-detail`);
      await closeDetail(page);
      await page.locator(`#card-save-${offer(2).id}`).click();
      await page.locator('#open-favorites').click();
      await axe(page, `${name}-${colorScheme}-merkliste`);
      await page.locator(`#saved-remove-${offer(2).id}`).click();
      await page.locator('[data-close="favorites-dialog"]').first().click();
    }
  });

  await check(`${name}: blockierter Sitzungsspeicher fällt auf Arbeitsspeicher zurück`, async () => {
    const blockedContext = await browser.newContext({ reducedMotion: 'reduce' });
    await blockedContext.setOffline(true);
    await blockedContext.addInitScript(() => {
      Object.defineProperty(window, 'sessionStorage', { configurable: true, get() { throw new DOMException('Storage disabled', 'SecurityError'); } });
    });
    const blocked = await blockedContext.newPage();
    const blockedErrors = [];
    blocked.on('pageerror', error => blockedErrors.push(error.message));
    await blocked.goto(url);
    await blocked.waitForSelector('.offer-card');
    await blocked.locator(`#card-save-${offer(1).id}`).click();
    await assertSaved(blocked, 1, true);
    await blocked.locator('#open-favorites').click();
    assert.equal(await blocked.locator('.saved-item').count(), 1);
    assert((await blocked.locator('#session-info').innerText()).includes('nicht verfügbar'));
    await blocked.locator('[data-close="favorites-dialog"]').first().click();
    await blocked.locator(`#card-save-${offer(1).id}`).click();
    await assertSaved(blocked, 1, false);
    assert.deepEqual(blockedErrors, []);
    await blockedContext.close();
  });

  await check(`${name}: keine externen Requests oder Laufzeitfehler`, async () => {
    assert.deepEqual(requests.filter(request => /^https?:/u.test(request)), []);
    assert.deepEqual(errors, []);
    assert.equal(await visibleCount(page), 128);
  });
  await browser.close();
}

(async () => {
  for (const [name, engine] of Object.entries(engines)) await testEngine(name, engine);
  fs.writeFileSync(path.join(artifacts, 'browser-results.json'), JSON.stringify({ passed: results.length, checks: results }, null, 2));
  console.log(`\n${results.length} Browser-Prüfgruppen erfolgreich. Artefakte: ${artifacts}`);
})().catch(error => { console.error(error); process.exitCode = 1; process.exit(1); });
