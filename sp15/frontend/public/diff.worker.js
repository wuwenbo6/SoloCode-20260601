importScripts('https://unpkg.com/diff@5.2.0/dist/diff.min.js');

self.onmessage = function(e) {
  const { oldText, newText, oldTitle, newTitle, oldTags, newTags } = e.data;

  const startTime = performance.now();

  const titleDiff = Diff.diffChars(oldTitle || '', newTitle || '');

  const tagsDiff = {
    added: newTags.filter(t => !oldTags.includes(t)),
    removed: oldTags.filter(t => !newTags.includes(t)),
    unchanged: newTags.filter(t => oldTags.includes(t))
  };

  const oldLines = (oldText || '').split('\n');
  const newLines = (newText || '').split('\n');

  const contentDiff = Diff.diffLines(oldText || '', newText || '');

  const lineByLineDiff = [];
  let oldLineNum = 0;
  let newLineNum = 0;

  contentDiff.forEach(part => {
    const lines = part.value.split('\n');
    if (lines[lines.length - 1] === '') lines.pop();

    lines.forEach(line => {
      if (part.added) {
        newLineNum++;
        lineByLineDiff.push({
          type: 'added',
          content: line,
          oldLineNum: null,
          newLineNum: newLineNum
        });
      } else if (part.removed) {
        oldLineNum++;
        lineByLineDiff.push({
          type: 'removed',
          content: line,
          oldLineNum: oldLineNum,
          newLineNum: null
        });
      } else {
        oldLineNum++;
        newLineNum++;
        lineByLineDiff.push({
          type: 'unchanged',
          content: line,
          oldLineNum: oldLineNum,
          newLineNum: newLineNum
        });
      }
    });
  });

  const endTime = performance.now();

  self.postMessage({
    titleDiff,
    tagsDiff,
    lineByLineDiff,
    stats: {
      addedLines: lineByLineDiff.filter(l => l.type === 'added').length,
      removedLines: lineByLineDiff.filter(l => l.type === 'removed').length,
      unchangedLines: lineByLineDiff.filter(l => l.type === 'unchanged').length,
      timeMs: endTime - startTime
    }
  });
};
