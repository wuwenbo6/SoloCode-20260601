import express from 'express'
import { CID } from 'multiformats/cid'
import { getIPFS, retryOperation, readChunkedContent } from '../ipfs-node.js'

const router = express.Router()

const HLJS_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css'
const HLJS_JS = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js'

function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

router.get('/:cid', async (req, res) => {
  try {
    const { cid } = req.params
    const { theme = 'github-dark', lineNumbers = 'true' } = req.query

    const { dag } = getIPFS()
    const parsedCid = CID.parse(cid)

    let snippet
    try {
      snippet = await retryOperation(async () => {
        return await dag.get(parsedCid)
      }, 3, 1000)
    } catch (e) {
      snippet = null
    }

    if (!snippet || snippet.type !== 'snippet') {
      const errorJs = `
        (function() {
          var container = document.currentScript.parentElement;
          container.innerHTML = '<div style="background:#161b22;border:1px solid #30363d;border-radius:6px;padding:20px;color:#f85149;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;">Error: Snippet not found or invalid</div>';
        })();
      `
      res.setHeader('Content-Type', 'application/javascript')
      res.send(errorJs)
      return
    }

    if (snippet.contentRef && !snippet.content) {
      const fullContent = await readChunkedContent(snippet.contentRef)
      if (fullContent !== null) {
        snippet.content = fullContent
      }
    }

    const title = snippet.title ? snippet.title.replace(/'/g, "\\'") : 'Untitled'
    const language = snippet.language || 'text'
    const content = snippet.content || ''
    const createdDate = snippet.createdAt ? new Date(snippet.createdAt).toLocaleDateString() : ''
    const contentEscaped = content
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t')

    const embedScript = `
(function() {
  var container = document.currentScript.parentElement;
  var cid = '${cid}';
  var title = '${title}';
  var language = '${language}';
  var content = '${contentEscaped}';
  var createdDate = '${createdDate}';
  var origin = window.location.origin || '${req.protocol}://${req.get('host')}';

  var stylesLoaded = false;
  function loadStyles() {
    if (stylesLoaded) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '${HLJS_CSS}';
    document.head.appendChild(link);
    stylesLoaded = true;
  }

  var hljsLoaded = false;
  function loadHighlightJS(callback) {
    if (window.hljs) {
      hljsLoaded = true;
      callback();
      return;
    }
    var script = document.createElement('script');
    script.src = '${HLJS_JS}';
    script.onload = function() {
      hljsLoaded = true;
      callback();
    };
    document.head.appendChild(script);
  }

  function render() {
    loadStyles();
    
    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'background:#161b22;border:1px solid #30363d;border-radius:8px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;max-width:100%;';

    var header = document.createElement('div');
    header.style.cssText = 'padding:12px 16px;border-bottom:1px solid #30363d;display:flex;justify-content:space-between;align-items:center;';
    
    var titleSpan = document.createElement('span');
    titleSpan.style.cssText = 'color:#c9d1d9;font-weight:500;font-size:14px;';
    titleSpan.textContent = title;
    
    var meta = document.createElement('span');
    meta.style.cssText = 'color:#8b949e;font-size:12px;display:flex;gap:12px;align-items:center;';
    
    var langTag = document.createElement('span');
    langTag.style.cssText = 'background:rgba(88,166,255,0.1);color:#58a6ff;padding:2px 8px;border-radius:12px;font-size:11px;';
    langTag.textContent = language;
    
    var dateSpan = document.createElement('span');
    dateSpan.textContent = createdDate;
    
    meta.appendChild(langTag);
    if (createdDate) meta.appendChild(dateSpan);
    
    header.appendChild(titleSpan);
    header.appendChild(meta);
    wrapper.appendChild(header);

    var codeContainer = document.createElement('div');
    codeContainer.style.cssText = 'overflow-x:auto;';
    
    var pre = document.createElement('pre');
    pre.style.cssText = 'margin:0;padding:16px;background:#0d1117;';
    
    var code = document.createElement('code');
    code.className = 'language-' + language;
    code.style.cssText = 'font-family:Monaco,Menlo,Ubuntu Mono,monospace;font-size:13px;line-height:1.5;';
    code.textContent = content;
    
    pre.appendChild(code);
    codeContainer.appendChild(pre);
    wrapper.appendChild(codeContainer);

    var footer = document.createElement('div');
    footer.style.cssText = 'padding:8px 16px;border-top:1px solid #30363d;display:flex;justify-content:space-between;align-items:center;font-size:12px;';
    
    var viewLink = document.createElement('a');
    viewLink.href = origin + '/' + cid;
    viewLink.target = '_blank';
    viewLink.rel = 'noopener noreferrer';
    viewLink.style.cssText = 'color:#58a6ff;text-decoration:none;';
    viewLink.textContent = 'View on IPFS Snippets';
    
    var cidSpan = document.createElement('span');
    cidSpan.style.cssText = 'color:#6e7681;font-family:monospace;font-size:11px;';
    cidSpan.textContent = 'CID: ' + cid.slice(0, 16) + '...';
    
    footer.appendChild(viewLink);
    footer.appendChild(cidSpan);
    wrapper.appendChild(footer);

    container.innerHTML = '';
    container.appendChild(wrapper);

    loadHighlightJS(function() {
      if (window.hljs) {
        window.hljs.highlightElement(code);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();
`

    res.setHeader('Content-Type', 'application/javascript')
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.send(embedScript)
  } catch (error) {
    console.error('Error generating embed:', error)
    const errorJs = `
      (function() {
        var container = document.currentScript.parentElement;
        container.innerHTML = '<div style="background:#161b22;border:1px solid #30363d;border-radius:6px;padding:20px;color:#f85149;">Error loading snippet</div>';
      })();
    `
    res.setHeader('Content-Type', 'application/javascript')
    res.send(errorJs)
  }
})

router.get('/:cid/html', async (req, res) => {
  try {
    const { cid } = req.params

    const { dag } = getIPFS()
    const parsedCid = CID.parse(cid)
    const snippet = await retryOperation(async () => {
      return await dag.get(parsedCid)
    }, 3, 1000)

    if (!snippet || snippet.type !== 'snippet') {
      return res.status(404).send('Snippet not found')
    }

    if (snippet.contentRef && !snippet.content) {
      const fullContent = await readChunkedContent(snippet.contentRef)
      if (fullContent !== null) {
        snippet.content = fullContent
      }
    }

    const embedCode = `<script src="${req.protocol}://${req.get('host')}/api/embed/${cid}"></script>`

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Embed Preview - ${snippet.title || 'Untitled'}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0d1117;
      color: #c9d1d9;
      padding: 40px 20px;
      max-width: 900px;
      margin: 0 auto;
    }
    h1 { font-size: 20px; margin-bottom: 20px; }
    .embed-preview { margin-bottom: 30px; }
    .embed-code {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 6px;
      padding: 16px;
      margin-top: 20px;
    }
    .embed-code code {
      font-family: Monaco, Menlo, monospace;
      font-size: 13px;
      color: #58a6ff;
      word-break: break-all;
    }
    label {
      display: block;
      margin-bottom: 8px;
      color: #8b949e;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <h1>Embed Preview</h1>
  <div class="embed-preview">
    ${embedCode}
  </div>
  <label>Use this code to embed:</label>
  <div class="embed-code">
    <code>${embedCode.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code>
  </div>
</body>
</html>
    `

    res.setHeader('Content-Type', 'text/html')
    res.send(html)
  } catch (error) {
    console.error('Error generating embed HTML:', error)
    res.status(500).send('Error generating embed')
  }
})

export default router
