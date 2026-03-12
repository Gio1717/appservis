// ════════════════════════════════════════════════════════
//  PDF HELPER — generování PDF pomocí html2pdf.js
// ════════════════════════════════════════════════════════

/**
 * Generuje PDF z print-containeru nebo libovolného elementu.
 * @param {Object} opts
 * @param {HTMLElement} [opts.element] - element k exportu (default: #print-container)
 * @param {string} [opts.filename] - název souboru (default: 'servisni-list.pdf')
 * @param {HTMLElement} [opts.statusEl] - element pro zobrazení stavu
 * @param {string} [opts.statusDone] - text po dokončení (default: '✓ PDF staženo.')
 */
function generatePDF(opts) {
  opts = opts || {};
  var el = opts.element || document.getElementById('print-container');
  var filename = opts.filename || 'servisni-list.pdf';
  var statusEl = opts.statusEl || null;
  var statusDone = opts.statusDone || '✓ PDF staženo.';

  if (!el) {
    if (statusEl) statusEl.textContent = '⚠ Element pro PDF nenalezen.';
    console.error('generatePDF: element not found');
    return Promise.resolve();
  }

  if (statusEl) statusEl.textContent = '⏳ Generuji PDF...';

  // Ujistíme se, že print-container je viditelný pro html2pdf
  var wasHidden = el.style.display === 'none';
  if (wasHidden) {
    el.style.display = 'block';
    el.style.position = 'absolute';
    el.style.left = '-9999px';
    el.style.top = '0';
  }

  var pdfOpts = {
    margin:       [5, 5, 5, 5],
    filename:     filename,
    image:        { type: 'jpeg', quality: 0.95 },
    html2canvas:  { scale: 2, useCORS: true, letterRendering: true },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
  };

  return html2pdf().set(pdfOpts).from(el).save().then(function() {
    if (wasHidden) {
      el.style.display = 'none';
      el.style.position = '';
      el.style.left = '';
      el.style.top = '';
    }
    if (statusEl) statusEl.textContent = statusDone;
  }).catch(function(err) {
    if (wasHidden) {
      el.style.display = 'none';
      el.style.position = '';
      el.style.left = '';
      el.style.top = '';
    }
    console.error('PDF generation error:', err);
    if (statusEl) statusEl.textContent = '⚠ Chyba při generování PDF.';
    // Fallback na window.print()
    if (wasHidden) el.style.display = 'block';
    window.print();
    if (wasHidden) el.style.display = 'none';
  });
}

/**
 * Generuje PDF z HTML stringu (pro nová okna / protokoly).
 * Otevře stažení PDF přímo.
 */
function generatePDFFromHTML(htmlString, filename) {
  filename = filename || 'dokument.pdf';
  var wrapper = document.createElement('div');
  wrapper.innerHTML = htmlString;
  wrapper.style.width = '210mm';
  wrapper.style.fontFamily = "'IBM Plex Sans', Arial, sans-serif";
  document.body.appendChild(wrapper);

  var pdfOpts = {
    margin:       [5, 5, 5, 5],
    filename:     filename,
    image:        { type: 'jpeg', quality: 0.95 },
    html2canvas:  { scale: 2, useCORS: true, letterRendering: true },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
  };

  return html2pdf().set(pdfOpts).from(wrapper).save().then(function() {
    document.body.removeChild(wrapper);
  }).catch(function(err) {
    document.body.removeChild(wrapper);
    console.error('PDF generation error:', err);
  });
}
