const dropZone = document.getElementById('dropZone');
const addRuleBtn = document.getElementById('addRuleBtn');
const rulesContainer = document.getElementById('rulesContainer');
const processBtn = document.getElementById('processBtn');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const resultList = document.getElementById('resultList');
const fileHint = document.getElementById('fileHint');
const ruleTemplate = document.getElementById('ruleTemplate');
const resultTemplate = document.getElementById('resultItemTemplate');
const copyrightLine = document.getElementById('copyrightLine');

let queuedFiles = [];
let processedFiles = [];
const fileVersions = new Map();

setFooterCopyright();
addRule();

addRuleBtn.addEventListener('click', () => addRule());

dropZone.addEventListener('dragover', (event) => {
  event.preventDefault();
  dropZone.classList.add('active');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('active');
});

dropZone.addEventListener('drop', async (event) => {
  event.preventDefault();
  dropZone.classList.remove('active');

  const droppedEntries = await collectDroppedFiles(event.dataTransfer);
  mergeQueuedFiles(droppedEntries);
});

processBtn.addEventListener('click', async () => {
  clearProcessedUrls();
  processedFiles = [];

  const rules = getValidRules();
  if (rules.length === 0) {
    alert('Add at least one valid rule with a search string.');
    return;
  }

  for (const entry of queuedFiles) {
    const decoded = await readTextWithEncoding(entry.file);
    let updatedContent = decoded.text;
    let totalReplacements = 0;

    for (const rule of rules) {
      const replacements = countOccurrences(updatedContent, rule.search, rule.isCaseSensitive);
      if (replacements > 0) {
        updatedContent = replaceAll(updatedContent, rule.search, rule.replacement, rule.isCaseSensitive);
        totalReplacements += replacements;
      }
    }

    if (totalReplacements === 0) {
      continue;
    }

    const nextVersion = (fileVersions.get(entry.sourcePath) || 0) + 1;
    fileVersions.set(entry.sourcePath, nextVersion);

    const renamed = buildVersionedName(entry.file.name, nextVersion);
    const encoded = encodeText(updatedContent, decoded.encoding, decoded.hasBom);
    const blob = new Blob([encoded], { type: entry.file.type || 'text/plain' });
    const url = URL.createObjectURL(blob);

    processedFiles.push({
      sourcePath: entry.sourcePath,
      renamed,
      version: nextVersion,
      replacements: totalReplacements,
      size: blob.size,
      url,
      encoding: decoded.encodingLabel,
    });
  }

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

function addRule() {
  const fragment = ruleTemplate.content.cloneNode(true);
  const ruleRow = fragment.querySelector('.rule-row');
  const removeBtn = fragment.querySelector('.remove-rule-btn');

  removeBtn.addEventListener('click', () => {
    if (rulesContainer.children.length === 1) {
      return;
    }
    ruleRow.remove();
  });

  rulesContainer.appendChild(fragment);
}

function getValidRules() {
  return [...rulesContainer.querySelectorAll('.rule-row')]
    .map((row) => ({
      search: row.querySelector('.find-input').value,
      replacement: row.querySelector('.replace-input').value,
      isCaseSensitive: row.querySelector('.case-sensitive-input').checked,
    }))
    .filter((rule) => rule.search.length > 0);
}

async function collectDroppedFiles(dataTransfer) {
  const entries = [];

  if (dataTransfer.items && dataTransfer.items.length > 0) {
    const tasks = [...dataTransfer.items]
      .filter((item) => item.kind === 'file')
      .map(async (item) => {
        const fsEntry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
        if (!fsEntry) {
          const file = item.getAsFile();
          if (!file) {
            return [];
          }
          return [{ file, sourcePath: file.name }];
        }
        return readEntryRecursive(fsEntry);
      });

    const nestedResults = await Promise.all(tasks);
    nestedResults.forEach((group) => entries.push(...group));
    return entries;
  }

  return [...dataTransfer.files].map((file) => ({ file, sourcePath: file.name }));
}

function readEntryRecursive(entry, parentPath = '') {
  if (entry.isFile) {
    return new Promise((resolve) => {
      entry.file((file) => {
        const sourcePath = parentPath ? `${parentPath}/${file.name}` : file.name;
        resolve([{ file, sourcePath }]);
      });
    });
  }

  if (!entry.isDirectory) {
    return Promise.resolve([]);
  }

  return new Promise((resolve) => {
    const reader = entry.createReader();
    const collected = [];
    const currentPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;

    const readBatch = () => {
      reader.readEntries(async (batch) => {
        if (!batch.length) {
          resolve(collected);
          return;
        }

        for (const child of batch) {
          const nested = await readEntryRecursive(child, currentPath);
          collected.push(...nested);
        }

        readBatch();
      });
    };

    readBatch();
  });
}

function mergeQueuedFiles(entries) {
  const valid = entries.filter((entry) => /\.(csv|tsv)$/i.test(entry.file.name));
  const unique = new Map(queuedFiles.map((entry) => [entry.sourcePath, entry]));

  valid.forEach((entry) => {
    unique.set(entry.sourcePath, entry);
  });

  queuedFiles = [...unique.values()];
  processBtn.disabled = queuedFiles.length === 0;
  downloadAllBtn.disabled = true;
  clearProcessedUrls();
  processedFiles = [];

  fileHint.textContent = queuedFiles.length
    ? `${queuedFiles.length} CSV/TSV files queued.`
    : 'No valid CSV/TSV files found in your drop.';

  renderResults();
}

function buildVersionedName(filename, version) {
  const dot = filename.lastIndexOf('.');
  const base = dot >= 0 ? filename.slice(0, dot) : filename;
  const ext = dot >= 0 ? filename.slice(dot) : '';
  return `${base}-v${version}${ext}`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSearchRule(searchValue, isCaseSensitive) {
  const hasLeadingStar = searchValue.startsWith('*');
  const hasTrailingStar = searchValue.endsWith('*');
  const normalized = searchValue.replace(/^\*/, '').replace(/\*$/, '');

  if (!normalized) {
    return null;
  }

  const escaped = escapeRegExp(normalized);
  const wordChars = '[\\p{L}\\p{N}_]*';

  let pattern = `\\b${escaped}\\b`;
  let type = 'whole';

  if (hasLeadingStar && hasTrailingStar) {
    pattern = `\\b(${wordChars})${escaped}(${wordChars})\\b`;
    type = 'contains';
  } else if (hasLeadingStar) {
    pattern = `\\b(${wordChars})${escaped}\\b`;
    type = 'endsWith';
  } else if (hasTrailingStar) {
    pattern = `\\b${escaped}(${wordChars})\\b`;
    type = 'startsWith';
  }

  const flags = `gu${isCaseSensitive ? '' : 'i'}`;
  return {
    regex: new RegExp(pattern, flags),
    type,
  };
}

function getReplacementValue(ruleType, replacement) {
  if (ruleType === 'startsWith') {
    return `${replacement}$1`;
  }

  if (ruleType === 'endsWith') {
    return `$1${replacement}`;
  }

  if (ruleType === 'contains') {
    return `$1${replacement}$2`;
  }

  return replacement;
}

function replaceAll(content, search, replacement, isCaseSensitive) {
  const rule = buildSearchRule(search, isCaseSensitive);
  if (!rule) {
    return content;
  }

  return content.replace(rule.regex, getReplacementValue(rule.type, replacement));
}

function countOccurrences(content, search, isCaseSensitive) {
  const rule = buildSearchRule(search, isCaseSensitive);
  if (!rule) {
    return 0;
  }

  return [...content.matchAll(rule.regex)].length;
}

async function readTextWithEncoding(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const probe = detectEncoding(bytes);
  const text = new TextDecoder(probe.decoderLabel).decode(bytes.subarray(probe.offset));

  return {
    text,
    encoding: probe.encoding,
    encodingLabel: probe.encodingLabel,
    hasBom: probe.hasBom,
  };
}

function detectEncoding(bytes) {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return {
      encoding: 'utf-16le',
      encodingLabel: 'UTF-16 LE',
      decoderLabel: 'utf-16le',
      hasBom: true,
      offset: 2,
    };
  }

  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return {
      encoding: 'utf-16be',
      encodingLabel: 'UTF-16 BE',
      decoderLabel: 'utf-16be',
      hasBom: true,
      offset: 2,
    };
  }

  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return {
      encoding: 'utf-8',
      encodingLabel: 'UTF-8 (BOM)',
      decoderLabel: 'utf-8',
      hasBom: true,
      offset: 3,
    };
  }

  return {
    encoding: 'utf-8',
    encodingLabel: 'UTF-8',
    decoderLabel: 'utf-8',
    hasBom: false,
    offset: 0,
  };
}

function encodeText(text, encoding, withBom) {
  if (encoding === 'utf-16le') {
    return encodeUtf16(text, false, withBom);
  }

  if (encoding === 'utf-16be') {
    return encodeUtf16(text, true, withBom);
  }

  const body = new TextEncoder().encode(text);
  if (!withBom) {
    return body;
  }

  const out = new Uint8Array(body.length + 3);
  out.set([0xef, 0xbb, 0xbf], 0);
  out.set(body, 3);
  return out;
}

function encodeUtf16(text, bigEndian, withBom) {
  const units = new Uint16Array(text.length);
  for (let index = 0; index < text.length; index += 1) {
    units[index] = text.charCodeAt(index);
  }

  const body = new Uint8Array(units.length * 2);
  for (let index = 0; index < units.length; index += 1) {
    const value = units[index];
    const byteIndex = index * 2;

    if (bigEndian) {
      body[byteIndex] = (value >> 8) & 0xff;
      body[byteIndex + 1] = value & 0xff;
    } else {
      body[byteIndex] = value & 0xff;
      body[byteIndex + 1] = (value >> 8) & 0xff;
    }
  }

  if (!withBom) {
    return body;
  }

  const bom = bigEndian ? [0xfe, 0xff] : [0xff, 0xfe];
  const out = new Uint8Array(body.length + 2);
  out.set(bom, 0);
  out.set(body, 2);
  return out;
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

function clearProcessedUrls() {
  processedFiles.forEach((entry) => {
    URL.revokeObjectURL(entry.url);
  });
}

function renderResults() {
  resultList.innerHTML = '';

  if (processedFiles.length === 0) {
    const empty = document.createElement('li');
    empty.textContent = 'No modified files yet.';
    resultList.appendChild(empty);
    return;
  }

  processedFiles.forEach((entry) => {
    const fragment = resultTemplate.content.cloneNode(true);
    const filenameNode = fragment.querySelector('.filename');
    const metaNode = fragment.querySelector('.meta');
    const linkNode = fragment.querySelector('.download-link');

    filenameNode.textContent = `${entry.sourcePath} → ${entry.renamed}`;
    metaNode.textContent = `Version: ${entry.version} • Replacements: ${entry.replacements} • Encoding: ${entry.encoding} • Size: ${formatBytes(entry.size)}`;
    linkNode.href = entry.url;
    linkNode.download = entry.renamed;

    resultList.appendChild(fragment);
  });
}

function setFooterCopyright() {
  const startYear = 2026;
  const currentYear = new Date().getFullYear();
  const yearLabel = currentYear > startYear ? `${startYear}–${currentYear}` : `${startYear}`;
  copyrightLine.innerHTML = `© Copyright ${yearLabel} <a href="https://github.com/neverminders" target="_blank" rel="noopener noreferrer">Lucian Mărgărit</a> | <a href="./LICENSE" target="_blank" rel="noopener noreferrer">MIT License</a>`;
}
