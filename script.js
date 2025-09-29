// ---------- constants ----------
const GITHUB_TOKEN_KEY = 'github_pat';
const REPO_CACHE_PREFIX = 'repo_cache_';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24h

const ICONS = {
    folder: `<svg class="w-5 h-5" style="color: var(--icon-color);" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>`,
    folderOpen: `<svg class="w-5 h-5" style="color: var(--icon-color);" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"></path></svg>`,
    file: `<svg class="w-5 h-5" style="color: var(--icon-color);" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>`,
    copy: `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>`
};

const FILE_ICON_MAP = {'js':'devicon-javascript-plain','jsx':'devicon-react-original','ts':'devicon-typescript-plain','tsx':'devicon-react-original','html':'devicon-html5-plain','css':'devicon-css3-plain','scss':'devicon-sass-original','md':'devicon-markdown-original','py':'devicon-python-plain','java':'devicon-java-plain','c':'devicon-c-plain','cpp':'devicon-cplusplus-plain','cs':'devicon-csharp-plain','go':'devicon-go-original-wordmark','php':'devicon-php-plain','rb':'devicon-ruby-plain','swift':'devicon-swift-plain','dockerfile':'devicon-docker-plain','yml':'devicon-yaml-plain','yaml':'devicon-yaml-plain','sql':'devicon-sqlite-plain','gitignore':'devicon-git-plain','npmrc':'devicon-npm-original-wordmark','lock':'devicon-npm-original-wordmark','png':'devicon-gimp-plain','jpg':'devicon-gimp-plain','jpeg':'devicon-gimp-plain','gif':'devicon-gimp-plain','svg':'devicon-svg-plain','ico':'devicon-gimp-plain','txt':'devicon-file-plain','json':'devicon-json-plain'};

// ---------- elements ----------
const views = {
    welcome: document.getElementById('welcome-view'),
    loading: document.getElementById('loading-view'),
    error: document.getElementById('error-view'),
    tree: document.getElementById('tree-view'),
    rateLimit: document.getElementById('rate-limit-view'),
};
const patInput = document.getElementById('pat-input');
const saveTokenBtn = document.getElementById('save-token-btn');
const clearTokenBtn = document.getElementById('clear-token-btn');
const repoTitleEl = document.getElementById('repo-title');
const repoSubtitleEl = document.getElementById('repo-subtitle');
const repoLinkEl = document.getElementById('repo-link');
const treeContainer = document.getElementById('tree-container');
const errorMessageEl = document.getElementById('error-message');
const appContainer = document.getElementById('app-container');
const refreshBtn = document.getElementById('refresh-btn');
const searchInput = document.getElementById('search-input');
const toggleAllBtn = document.getElementById('toggle-all-btn');
const searchBtn = document.getElementById('search-btn');
const searchWrapper = document.getElementById('search-wrapper');
const repoInfoWrapper = document.getElementById('repo-link');

let isAllExpanded = false;

// ---------- helpers ----------
function showView(name) {
    Object.values(views).forEach(v => { v.classList.add('hidden'); v.classList.remove('flex'); v.classList.remove('block'); });
    const view = views[name];
    if (!view) return;
    // loading & other center views should be flex; tree should be block (fills container)
    if (name === 'tree') {
        view.classList.remove('hidden');
        view.classList.add('flex');
    } else {
        view.classList.remove('hidden');
        view.classList.add('flex');
    }
}

function parseGitHubUrl(url) {
    try {
        if (!url) return null;
        const urlObj = new URL(url);
        if (!/github\.com$/.test(urlObj.hostname)) return null;
        const parts = urlObj.pathname.split('/').filter(Boolean);
        // some URLs may include "tree/<branch>" - we only need owner & repo
        if (parts.length >= 2) {
            return { owner: parts[0], repo: parts[1].replace(/\.git$/, '') };
        }
        return null;
    } catch (e) { return null; }
}

function getIconForFile(filename) {
    const lower = filename.toLowerCase();
    // special case Dockerfile
    if (lower === 'dockerfile') return FILE_ICON_MAP['dockerfile'];
    const ext = lower.split('.').pop();
    return FILE_ICON_MAP[lower] || FILE_ICON_MAP[ext] || null;
}

function buildFileTree(fileList) {
    const root = {};
    for (const item of fileList) {
        const parts = item.path.split('/');
        let current = root;
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (!current[part]) {
                const last = i === parts.length - 1;
                const type = last ? item.type : 'tree';
                current[part] = { name: part, type, children: type === 'tree' ? {} : null };
            }
            if (current[part] && current[part].children) current = current[part].children;
        }
    }
    return root;
}

// render tree recursively into given container element
function renderTree(treeNode, container, { expandFolders = false, currentPath = '' } = {}) {
    const keys = Object.keys(treeNode).sort((a,b) => {
        const A = treeNode[a], B = treeNode[b];
        if (A.type === 'tree' && B.type !== 'tree') return -1;
        if (A.type !== 'tree' && B.type === 'tree') return 1;
        return a.localeCompare(b);
    });

    if (keys.length === 0) return;

    const ul = document.createElement('ul');
    ul.className = 'space-y-1';
    ul.setAttribute('role', 'group');

    for (const key of keys) {
        const node = treeNode[key];
        const newPath = currentPath ? `${currentPath}/${node.name}` : node.name;
        const safeId = `tree-group-${newPath.replace(/[^a-zA-Z0-9-_]/g, '-')}`;

        const li = document.createElement('li');
        li.setAttribute('role', 'treeitem');
        li.dataset.path = newPath;
        li.dataset.name = node.name;
        li.className = 'group';

        const itemEl = document.createElement(node.type === 'tree' ? 'button' : 'div');
        itemEl.className = 'flex items-center space-x-2 p-1 rounded-md w-full';
        if (node.type === 'tree') {
            itemEl.classList.add('tree-item-button');
            itemEl.setAttribute('type', 'button');
        }
        itemEl.style.transition = 'background-color .12s ease';

        // hover background (keyboard accessible via focus-within)
        itemEl.addEventListener('mouseover', () => itemEl.style.backgroundColor = 'var(--hover-bg)');
        itemEl.addEventListener('mouseout',  () => itemEl.style.backgroundColor = 'transparent');

        // icon
        const iconContainer = document.createElement('div');
        iconContainer.className = 'icon-container';
        if (node.type === 'tree') {
            iconContainer.innerHTML = expandFolders ? ICONS.folderOpen : ICONS.folder;
        } else {
            const iconClass = getIconForFile(node.name);
            iconContainer.innerHTML = iconClass ? `<i class="${iconClass} text-xl" style="color: var(--icon-color);"></i>` : ICONS.file;
        }

        const nameSpan = document.createElement('span');
        nameSpan.textContent = node.name;
        nameSpan.className = 'text-sm truncate-ellipsis';

        itemEl.append(iconContainer, nameSpan);

        // files: spacer + copy button
        if (node.type !== 'tree') {
            const spacer = document.createElement('div');
            spacer.className = 'flex-1';
            spacer.setAttribute('aria-hidden', 'true');

            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-btn p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700';
            copyBtn.innerHTML = ICONS.copy;
            copyBtn.setAttribute('title', `Copy path: ${newPath}`);
            copyBtn.setAttribute('aria-label', `Copy path ${newPath}`);

            copyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(newPath).then(() => {
                        copyBtn.title = 'Copied!';
                        setTimeout(() => copyBtn.title = `Copy path: ${newPath}`, 1500);
                    }).catch(() => fallbackCopy(newPath, copyBtn));
                } else {
                    fallbackCopy(newPath, copyBtn);
                }
            });

            itemEl.append(spacer, copyBtn);
        }

        li.appendChild(itemEl);

        if (node.type === 'tree') {
            const childrenUl = document.createElement('ul');
            childrenUl.id = safeId;
            childrenUl.className = 'pl-6 space-y-1';
            const expanded = !!expandFolders;
            itemEl.setAttribute('aria-expanded', expanded);
            itemEl.setAttribute('aria-controls', safeId);
            if (!expanded) childrenUl.classList.add('hidden');

            // attach toggle behavior
            itemEl.addEventListener('click', (e) => {
                e.stopPropagation();
                const isHidden = childrenUl.classList.toggle('hidden');
                itemEl.setAttribute('aria-expanded', String(!isHidden));
                iconContainer.innerHTML = isHidden ? ICONS.folder : ICONS.folderOpen;
            });

            // recursively render children
            renderTree(node.children, childrenUl, { expandFolders, currentPath: newPath });
            li.appendChild(childrenUl);
        }

        ul.appendChild(li);
    }

    container.appendChild(ul);
}

// fallback copy
function fallbackCopy(text, btnEl) {
    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        btnEl.title = 'Copied!';
        setTimeout(() => btnEl.title = `Copy path: ${text}`, 1500);
    } catch (err) {
        console.error('Unable to copy', err);
    }
}

// render UI after fetching
function renderUI(repoDetails, treeData, timestamp, expandFolders) {
    repoTitleEl.textContent = repoDetails.full_name;
    repoSubtitleEl.textContent = repoDetails.description || `${repoDetails.owner?.login || ''} · ${repoDetails.default_branch || ''}`;
    repoLinkEl.href = repoDetails.html_url;
    const fileTree = buildFileTree(treeData.tree || []);
    treeContainer.innerHTML = '';
    renderTree(fileTree, treeContainer, { expandFolders });
    refreshBtn.title = `Last updated: ${new Date(timestamp).toLocaleString()}`;
    showView('tree');
}

// fetch repo and tree (with caching)
async function fetchAndRenderRepo(forceRefresh = false) {
    refreshBtn.innerHTML = `<span class="material-symbols-outlined spin" style="color: var(--icon-color);">progress_activity</span>`;
    refreshBtn.disabled = true;

    try {
        const params = new URLSearchParams(window.location.search);
        const repoUrl = params.get('repo');
        const expandFolders = params.get('expand') === 'true';
        const repoInfo = parseGitHubUrl(repoUrl);

        if (!repoInfo) {
            errorMessageEl.textContent = 'Invalid GitHub repository URL provided.';
            showView('error');
            return;
        }

        const cacheKey = `${REPO_CACHE_PREFIX}${repoInfo.owner}/${repoInfo.repo}`;

        if (!forceRefresh) {
            try {
                const cached = localStorage.getItem(cacheKey);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (Date.now() - parsed.timestamp < CACHE_DURATION_MS) {
                        renderUI(parsed.repoDetails, parsed.treeData, parsed.timestamp, expandFolders);
                        return;
                    }
                }
            } catch (err) { console.warn('Cache read error', err); }
        }

        showView('loading');

        const headers = { Accept: 'application/vnd.github.v3+json' };
        const storedToken = localStorage.getItem(GITHUB_TOKEN_KEY);
        if (storedToken) headers['Authorization'] = `Bearer ${storedToken}`;

        // repo details
        const repoDetailsRes = await fetch(`https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}`, { headers });
        if (repoDetailsRes.status === 403 && repoDetailsRes.headers.get('X-RateLimit-Remaining') === '0') {
            showView('rateLimit');
            return;
        }
        if (!repoDetailsRes.ok) throw new Error((await repoDetailsRes.json()).message || 'Could not fetch repository details.');
        const repoDetails = await repoDetailsRes.json();

        // tree (recursive)
        const treeRes = await fetch(`https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/git/trees/${repoDetails.default_branch}?recursive=1`, { headers });
        if (!treeRes.ok) throw new Error((await treeRes.json()).message || 'Could not fetch repository tree.');
        const treeData = await treeRes.json();
        if (treeData.truncated) console.warn('Repository tree truncated by GitHub API.');

        const timestamp = Date.now();
        try { localStorage.setItem(cacheKey, JSON.stringify({ repoDetails, treeData, timestamp })); } catch (e) { console.warn('Cache write failed', e); }

        renderUI(repoDetails, treeData, timestamp, expandFolders);
    } catch (err) {
        console.error('Fetch error', err);
        errorMessageEl.textContent = err.message || String(err);
        showView('error');
    } finally {
        refreshBtn.innerHTML = `<span class="material-symbols-outlined" style="color: var(--icon-color);">refresh</span>`;
        refreshBtn.disabled = false;
    }
}

// ---------- UI behavior ----------
function setupEventListeners() {
    // PAT save/clear
    saveTokenBtn.addEventListener('click', () => {
        const token = patInput.value.trim();
        if (token) {
            try {
                localStorage.setItem(GITHUB_TOKEN_KEY, token);
            } catch (e) { console.warn('Could not save token', e); }
            patInput.value = '';
            fetchAndRenderRepo();
        }
    });
    clearTokenBtn.addEventListener('click', () => {
        localStorage.removeItem(GITHUB_TOKEN_KEY);
        patInput.value = '';
    });

    // refresh
    refreshBtn.addEventListener('click', () => fetchAndRenderRepo(true));

    // expand/collapse all
    toggleAllBtn.addEventListener('click', () => {
        isAllExpanded = !isAllExpanded;
        toggleAllFolders(isAllExpanded);
        const span = toggleAllBtn.querySelector('span');
        span.textContent = isAllExpanded ? 'unfold_less' : 'unfold_more';
        toggleAllBtn.title = isAllExpanded ? 'Collapse All' : 'Expand All';
    });

    // search toggle: on small screens we toggle visibility
    searchBtn.addEventListener('click', () => {
        const currentlyHidden = searchWrapper.classList.contains('hidden');
        // reveal/hide search wrapper
        if (currentlyHidden) {
            searchWrapper.classList.remove('hidden');
            // hide repo info to avoid overflow on very small screens (but keep link)
            // repoInfoWrapper.classList.add('hidden'); // we keep repo visible for clarity
            setTimeout(() => searchInput.focus(), 50);
        } else {
            // keep search shown on >= sm by default, but allow hide
            if (window.matchMedia('(min-width: 640px)').matches) {
                searchWrapper.classList.add('hidden'); // clicking hides on larger screens too (keeps behavior consistent)
            } else {
                searchWrapper.classList.add('hidden');
            }
        }
    });

    // search input filtering
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();
        const allItems = treeContainer.querySelectorAll('li[role="treeitem"]');
        if (!query) {
            allItems.forEach(it => it.classList.remove('hidden'));
            return;
        }

        const visiblePaths = new Set();
        allItems.forEach(item => {
            const name = (item.dataset.name || '').toLowerCase();
            if (name.includes(query)) {
                visiblePaths.add(item.dataset.path);
                // add parents
                let parent = item.dataset.path.substring(0, item.dataset.path.lastIndexOf('/'));
                while (parent) {
                    visiblePaths.add(parent);
                    parent = parent.substring(0, parent.lastIndexOf('/'));
                }
            }
        });

        allItems.forEach(item => {
            const shouldShow = visiblePaths.has(item.dataset.path);
            item.classList.toggle('hidden', !shouldShow);
            if (shouldShow) {
                // ensure parents are expanded
                const btn = item.querySelector('button[aria-expanded]');
                if (btn) {
                    const listId = btn.getAttribute('aria-controls');
                    const listEl = document.getElementById(listId);
                    if (listEl && listEl.classList.contains('hidden')) {
                        listEl.classList.remove('hidden');
                        btn.setAttribute('aria-expanded', 'true');
                        const icon = btn.querySelector('.icon-container');
                        if (icon) icon.innerHTML = ICONS.folderOpen;
                    }
                }
            }
        });
    });
}

function toggleAllFolders(expand) {
    const folderButtons = treeContainer.querySelectorAll('button[aria-expanded]');
    folderButtons.forEach(button => {
        const list = document.getElementById(button.getAttribute('aria-controls'));
        if (!list) return;
        button.setAttribute('aria-expanded', expand ? 'true' : 'false');
        list.classList.toggle('hidden', !expand);
        const icon = button.querySelector('.icon-container');
        if (icon) icon.innerHTML = expand ? ICONS.folderOpen : ICONS.folder;
    });
}

// ---------- app bootstrap ----------
function main() {
    const params = new URLSearchParams(window.location.search);
    const repoUrl = params.get('repo');
    const theme = params.get('theme'); // 'dark'|'light'|null
    const isTransparent = params.get('transparent') === 'true';
    const expandFolders = params.get('expand') === 'true';

    isAllExpanded = expandFolders;
    const toggleIconSpan = toggleAllBtn.querySelector('span');
    toggleIconSpan.textContent = isAllExpanded ? 'unfold_less' : 'unfold_more';
    toggleAllBtn.title = isAllExpanded ? 'Collapse All' : 'Expand All';

    // theme selection: explicit param > prefers-color-scheme (when not transparent)
    let useDark = false;
    if (theme === 'dark') useDark = true;
    else if (theme === 'light') useDark = false;
    else if (!isTransparent && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) useDark = true;
    document.documentElement.classList.toggle('dark', useDark);

    if (isTransparent) {
        const rootStyle = document.documentElement.style;
        rootStyle.setProperty('--bg-color', 'transparent');
        rootStyle.setProperty('--card-bg', 'transparent');
        // reduce padding for embedded contexts
        appContainer.classList.remove('p-4','md:p-6');
    }

    // initial icons etc
    refreshBtn.innerHTML = `<span class="material-symbols-outlined" style="color: var(--icon-color);">refresh</span>`;

    setupEventListeners();

    if (!repoUrl) {
        showView('welcome');
    } else {
        fetchAndRenderRepo();
    }
}

document.addEventListener('DOMContentLoaded', main);