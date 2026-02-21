const fileInput = document.getElementById('fileInput');
const findInput = document.getElementById('findInput');
const replaceInput = document.getElementById('replaceInput');
const caseSensitive = document.getElementById('caseSensitive');
const processBtn = document.getElementById('processBtn');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const resultList = document.getElementById('resultList');
const fileHint = document.getElementById('fileHint');
const template = document.getElementById('resultItemTemplate');

let queuedFiles = [];
let processedFiles = [];

fileInput.addEventListener('change', () => {
  queuedFiles = [...fileInput.files].filter((file) => /\.(csv|tsv)$/i.test(file.name));
  fileHint.textContent = queuedFiles.length
    ? `${queuedFiles.length} fișiere valide în coadă.`
    : 'Nu există fișiere csv/tsv valide în selecție.';

  processBtn.disabled = queuedFiles.length === 0;
  downloadAllBtn.disabled = true;
  processedFiles = [];
  renderResults();
});

processBtn.addEventListener('click', async () => {
  const searchValue = findInput.value;

  if (!searchValue) {
    alert('Introdu textul pe care dorești să-l cauți.');
    return;
  }

  processedFiles = await Promise.all(
    queuedFiles.map(async (file, index) => {
      const original = await file.text();
      const occurrences = countOccurrences(original, searchValue, caseSensitive.checked);
      const replacedContent = occurrences > 0
        ? replaceAll(original, searchValue, replaceInput.value, caseSensitive.checked)
        : original;

      const renamed = buildVersionedName(file.name, index + 1);
      const blob = new Blob([replacedContent], { type: file.type || 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      return {
        originalName: file.name,
        renamed,
        occurrences,
        size: blob.size,
        url,
      };
    })
  );

  downloadAllBtn.disabled = processedFiles.length === 0;
  renderResults();
});

downloadAllBtn.addEventListener('click', () => {
  processedFiles.forEach((entry) => {
    const link = document.createElement('a');
    link.href = entry.url;
    link.download = entry.renamed;
    link.click();
  });
});

function buildVersionedName(filename, index) {
  const dot = filename.lastIndexOf('.');
  const base = dot >= 0 ? filename.slice(0, dot) : filename;
  const ext = dot >= 0 ? filename.slice(dot) : '';
  const suffix = `_v${String(index).padStart(3, '0')}`;
  return `${base}${suffix}${ext}`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceAll(content, search, replacement, isCaseSensitive) {
  const flags = isCaseSensitive ? 'g' : 'gi';
  return content.replace(new RegExp(escapeRegExp(search), flags), replacement);
}

function countOccurrences(content, search, isCaseSensitive) {
  const flags = isCaseSensitive ? 'g' : 'gi';
  const matches = content.match(new RegExp(escapeRegExp(search), flags));
  return matches ? matches.length : 0;
}

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function renderResults() {
  resultList.innerHTML = '';

  if (processedFiles.length === 0) {
    const empty = document.createElement('li');
    empty.textContent = 'Niciun rezultat disponibil încă.';
    resultList.appendChild(empty);
    return;
  }

  processedFiles.forEach((entry) => {
    const fragment = template.content.cloneNode(true);
    const filenameNode = fragment.querySelector('.filename');
    const metaNode = fragment.querySelector('.meta');
    const linkNode = fragment.querySelector('.download-link');

    filenameNode.textContent = `${entry.originalName} → ${entry.renamed}`;
    metaNode.textContent = `Înlocuiri: ${entry.occurrences} • Mărime: ${formatBytes(entry.size)}`;
    linkNode.href = entry.url;
    linkNode.download = entry.renamed;

    resultList.appendChild(fragment);
  });
}
