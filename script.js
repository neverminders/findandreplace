const fileInput = document.getElementById('fileInput');
const folderInput = document.getElementById('folderInput');
const dropZone = document.getElementById('dropZone');
const addRuleBtn = document.getElementById('addRuleBtn');
const rulesContainer = document.getElementById('rulesContainer');
const processBtn = document.getElementById('processBtn');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const resultList = document.getElementById('resultList');
const fileHint = document.getElementById('fileHint');
const ruleTemplate = document.getElementById('ruleTemplate');
const resultTemplate = document.getElementById('resultItemTemplate');

let queuedFiles = [];
let processedFiles = [];
const fileVersions = new Map();

addRule();

fileInput.addEventListener('change', () => {
  mergeQueuedFiles([...fileInput.files]);
});

folderInput.addEventListener('change', () => {
  mergeQueuedFiles([...folderInput.files]);
});

addRuleBtn.addEventListener('click', () => {
  addRule();
});

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

  const droppedFiles = await collectDroppedFiles(event.dataTransfer);
  mergeQueuedFiles(droppedFiles);
});

processBtn.addEventListener('click', async () => {
  clearProcessedUrls();
  processedFiles = [];

  const rules = getValidRules();
  if (rules.length === 0) {
    alert('Adaugă cel puțin o regulă validă cu text căutat.');
    return;
  }

  for (const file of queuedFiles) {
    const sourcePath = file.webkitRelativePath || file.name;
    const original = await file.text();
    let updatedContent = original;
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

    const nextVersion = (fileVersions.get(sourcePath) || 0) + 1;
    fileVersions.set(sourcePath, nextVersion);

    const renamed = buildVersionedName(file.name, nextVersion);
    const blob = new Blob([updatedContent], { type: file.type || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    processedFiles.push({
      originalName: file.name,
      sourcePath,
      renamed,
      version: nextVersion,
      replacements: totalReplacements,
      size: blob.size,
      url,
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
  const rows = [...rulesContainer.querySelectorAll('.rule-row')];

  return rows
    .map((row) => ({
      search: row.querySelector('.find-input').value,
      replacement: row.querySelector('.replace-input').value,
      isCaseSensitive: row.querySelector('.case-sensitive-input').checked,
    }))
    .filter((rule) => rule.search.length > 0);
}

async function collectDroppedFiles(dataTransfer) {
  const files = [];

  if (dataTransfer.items && dataTransfer.items.length > 0) {
    const readTasks = [...dataTransfer.items].map((item) => {
      const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
      if (!entry) {
        const file = item.getAsFile();
        return file ? Promise.resolve([file]) : Promise.resolve([]);
      }
      return readEntryRecursive(entry);
    });

    const nested = await Promise.all(readTasks);
    nested.forEach((group) => files.push(...group));
    return files;
  }

  return [...dataTransfer.files];
}

function readEntryRecursive(entry, parentPath = '') {
  if (entry.isFile) {
    return new Promise((resolve) => {
      entry.file((file) => {
        const relativePath = parentPath ? `${parentPath}/${file.name}` : file.name;
        if (!file.webkitRelativePath) {
          Object.defineProperty(file, 'webkitRelativePath', {
            value: relativePath,
            configurable: true,
          });
        }
        resolve([file]);
      });
    });
  }

  if (!entry.isDirectory) {
    return Promise.resolve([]);
  }

  return new Promise((resolve) => {
    const reader = entry.createReader();
    const collected = [];

    const readBatch = () => {
      reader.readEntries(async (entries) => {
        if (!entries.length) {
          resolve(collected);
          return;
        }

        for (const child of entries) {
          const childPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;
          const nested = await readEntryRecursive(child, childPath);
          collected.push(...nested);
        }

        readBatch();
      });
    };

    readBatch();
  });
}

function mergeQueuedFiles(inputFiles) {
  const valid = inputFiles.filter((file) => /\.(csv|tsv)$/i.test(file.name));
  const unique = new Map(queuedFiles.map((file) => [file.webkitRelativePath || file.name, file]));

  valid.forEach((file) => {
    unique.set(file.webkitRelativePath || file.name, file);
  });

  queuedFiles = [...unique.values()];
  processBtn.disabled = queuedFiles.length === 0;
  downloadAllBtn.disabled = true;
  clearProcessedUrls();
  processedFiles = [];

  fileHint.textContent = queuedFiles.length
    ? `${queuedFiles.length} fișiere csv/tsv în coadă.`
    : 'Nu există fișiere csv/tsv valide în selecție.';

  renderResults();
}

function buildVersionedName(filename, version) {
  const dot = filename.lastIndexOf('.');
  const base = dot >= 0 ? filename.slice(0, dot) : filename;
  const ext = dot >= 0 ? filename.slice(dot) : '';
  return `${base}_v${version}${ext}`;
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

function clearProcessedUrls() {
  processedFiles.forEach((entry) => {
    URL.revokeObjectURL(entry.url);
  });
}

function renderResults() {
  resultList.innerHTML = '';

  if (processedFiles.length === 0) {
    const empty = document.createElement('li');
    empty.textContent = 'Nu există fișiere modificate încă.';
    resultList.appendChild(empty);
    return;
  }

  processedFiles.forEach((entry) => {
    const fragment = resultTemplate.content.cloneNode(true);
    const filenameNode = fragment.querySelector('.filename');
    const metaNode = fragment.querySelector('.meta');
    const linkNode = fragment.querySelector('.download-link');

    filenameNode.textContent = `${entry.sourcePath} → ${entry.renamed}`;
    metaNode.textContent = `Versiune: ${entry.version} • Înlocuiri: ${entry.replacements} • Mărime: ${formatBytes(entry.size)}`;
    linkNode.href = entry.url;
    linkNode.download = entry.renamed;

    resultList.appendChild(fragment);
  });
}
