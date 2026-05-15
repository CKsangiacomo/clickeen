import http from 'node:http';

const port = Number(process.env.CK_VENICE_MOCK_TOKYO_PORT || 3927);
const instanceId = 'INST000001';
const overlayId = 'ACCT0001FAQINST000001IT00A010000026';
const metaFp = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

const baseState = {
  title: 'Bed and Breakfast FAQs',
  cta: { label: 'Book Now' },
  sections: [
    {
      title: 'Questions',
      faqs: [
        {
          question: 'What rooms do you offer?',
          answer: 'We offer standard and deluxe rooms.',
        },
      ],
    },
  ],
};

const overlayValues = {
  title: 'Domande frequenti B&B',
  'cta.label': 'Prenota ora',
  'sections.0.title': 'Domande',
  'sections.0.faqs.0.question': 'Quali camere offrite?',
  'sections.0.faqs.0.answer': 'Offriamo camere standard e deluxe.',
};

function json(res, status, body, headers = {}) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...headers,
  });
  res.end(JSON.stringify(body));
}

function html(res, body) {
  res.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'public, max-age=300',
  });
  res.end(body);
}

function widgetHtml() {
  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /></head>
  <body>
    <section data-ck-widget="faq">
      <h1 data-ck-field="title"></h1>
      <a data-ck-field="cta"></a>
      <h2 data-ck-field="section"></h2>
      <h3 data-ck-field="question"></h3>
      <p data-ck-field="answer"></p>
    </section>
    <script>
      const state = window.CK_WIDGET && window.CK_WIDGET.state ? window.CK_WIDGET.state : {};
      const firstSection = Array.isArray(state.sections) ? state.sections[0] || {} : {};
      const firstFaq = Array.isArray(firstSection.faqs) ? firstSection.faqs[0] || {} : {};
      document.querySelector('[data-ck-field="title"]').textContent = state.title || '';
      document.querySelector('[data-ck-field="cta"]').textContent = state.cta && state.cta.label || '';
      document.querySelector('[data-ck-field="section"]').textContent = firstSection.title || '';
      document.querySelector('[data-ck-field="question"]').textContent = firstFaq.question || '';
      document.querySelector('[data-ck-field="answer"]').textContent = firstFaq.answer || '';
    </script>
  </body>
</html>`;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
  const pathname = url.pathname;

  if (pathname === '/__ready') {
    json(res, 200, { ok: true });
    return;
  }

  if (pathname === `/renders/widgets/${instanceId}/live/r.json`) {
    json(
      res,
      200,
      {
        v: 1,
        id: instanceId,
        widgetCode: 'FAQ',
        widgetType: 'faq',
        configFp: 'cfg',
        localePolicy: {
          baseLocale: 'en',
          ip: { enabled: false, countryToLocale: {} },
          switcher: { enabled: true },
        },
        overlays: { languages: { IT00: overlayId } },
        localeLabels: { en: 'English', it: 'Italiano' },
        seoGeo: {
          metaLiveBase: 'seo/meta/live',
          metaPacksBase: 'seo/meta',
        },
      },
      { 'x-ck-geo-country': 'US' },
    );
    return;
  }

  if (pathname === `/renders/widgets/${instanceId}/config.json`) {
    json(res, 200, { v: 1, config: baseState });
    return;
  }

  if (pathname === `/renders/widgets/${instanceId}/overlays/${overlayId}.json`) {
    json(res, 200, { v: 1, overlayId, values: overlayValues });
    return;
  }

  if (pathname === `/renders/widgets/${instanceId}/meta/live/en.json`) {
    json(res, 200, { v: 1, id: instanceId, locale: 'en', metaFp });
    return;
  }

  if (pathname === `/renders/widgets/${instanceId}/meta/en/${metaFp}.json`) {
    json(res, 200, {
      schemaJsonLd: JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', name: baseState.title }),
      excerptHtml: '<p>Bed and Breakfast FAQs</p>',
    });
    return;
  }

  if (pathname === '/widgets/faq/widget.html') {
    html(res, widgetHtml());
    return;
  }

  json(res, 404, { error: 'not_found', path: pathname });
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`[mock-tokyo] listening on ${port}\n`);
});

function close() {
  server.close(() => process.exit(0));
}

process.on('SIGTERM', close);
process.on('SIGINT', close);
