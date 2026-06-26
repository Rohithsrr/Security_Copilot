// Replace your old localhost links with your production Render server links:
const API_URL = "https://security-copilot-backend.onrender.com/ask";
const STATUS_URL = "https://security-copilot-backend.onrender.com/";
const STORAGE_KEY = "securityAgentConversations";
const THEME_KEY = "securityAgentTheme";
const chatForm = document.getElementById("chatForm");
const questionInput = document.getElementById("question");
const askBtn = document.getElementById("askBtn");
const chatHistory = document.getElementById("chatHistory");
const newChatBtn = document.querySelector(".new-chat-btn");
const mobileMenuBtn = document.querySelector(".mobile-menu-btn");
const appContainer = document.querySelector(".app");
const conversationList = document.querySelector(".sidebar-section");
const sidebarSearch = document.querySelector(".sidebar-search");
const welcomeTemplate = chatHistory ? chatHistory.querySelector(".welcome-container")?.outerHTML : "";
const statusBanner = document.getElementById("backendStatusBanner");

let conversations = loadConversations();
let currentConversationId = null;
let isPlaceholderActive = false; // Tracks if we are on a clean, unsaved new chat slot
let userScrolledUp = false;
let currentController = null; 
let streamTimer = null;        

// Event Listeners
chatForm.addEventListener("submit", function (event) {
    event.preventDefault();
    askQuestion();
});

questionInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        askQuestion();
    }
});

questionInput.addEventListener("input", () => {
    questionInput.style.height = "auto";
    questionInput.style.height = `${questionInput.scrollHeight}px`;
});

newChatBtn.addEventListener("click", prepareNewChatPlaceholder);
mobileMenuBtn?.addEventListener("click", toggleSidebar);
window.addEventListener("resize", handleResize);
chatHistory?.addEventListener("scroll", handleChatScroll);
sidebarSearch?.addEventListener("input", handleSidebarSearch);

// Dynamic Stop button generator
let stopBtn = document.getElementById("stopBtn");
if (!stopBtn) {
    stopBtn = document.createElement("button");
    stopBtn.id = "stopBtn";
    stopBtn.type = "button";
    stopBtn.textContent = "🛑 Stop";
    stopBtn.style.display = "none";
    askBtn.parentNode.insertBefore(stopBtn, askBtn);
    stopBtn.addEventListener("click", stopAgentExecution);
}

const themeToggleBtn = document.getElementById("themeToggleBtn");
themeToggleBtn?.addEventListener("click", toggleAppTheme);

function handleChatScroll() {
    if (!chatHistory) return;
    const bottomThreshold = 120;
    const distanceFromBottom = chatHistory.scrollHeight - (chatHistory.scrollTop + chatHistory.clientHeight);
    userScrolledUp = distanceFromBottom > bottomThreshold;
}

function handleSidebarSearch() {
    renderSidebar(sidebarSearch.value.trim().toLowerCase());
}

function fillPrompt(prompt) {
    questionInput.value = prompt;
    questionInput.style.height = "auto";
    questionInput.style.height = `${questionInput.scrollHeight}px`;
    questionInput.focus();
}

function loadConversations() {
    try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        return parsed.filter(c => c.messages && c.messages.length > 0);
    } catch {
        return [];
    }
}

function saveConversations() {
    try {
        const validConversations = conversations.filter(c => c.messages && c.messages.length > 0);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(validConversations));
    } catch {
        // ignore storage errors
    }
}

function initTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY) || "dark";
    if (savedTheme === "light") {
        document.documentElement.classList.add("light-theme");
    } else {
        document.documentElement.classList.remove("light-theme");
    }
}

function toggleAppTheme() {
    const isLight = document.documentElement.classList.toggle("light-theme");
    localStorage.setItem(THEME_KEY, isLight ? "light" : "dark");
}

function generateId() {
    if (window.crypto && window.crypto.randomUUID) {
        return window.crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function prepareNewChatPlaceholder() {
    currentConversationId = null;
    isPlaceholderActive = true;
    
    renderWelcomeScreen();
    renderSidebar();
    closeSidebar();
    questionInput.value = "";
    questionInput.focus();
}

function commitPlaceholderToConversation(firstQuestion) {
    const trimmed = firstQuestion.replace(/\s+/g, " ").trim();
    const generatedTitle = trimmed.length > 40 ? `${trimmed.slice(0, 37)}...` : trimmed;

    const conversation = {
        id: generateId(),
        title: generatedTitle || "Untitled conversation",
        messages: [],
        updatedAt: Date.now(),
        pinned: false,
    };
    
    conversations.unshift(conversation);
    currentConversationId = conversation.id;
    isPlaceholderActive = false;
    
    saveConversations();
    renderSidebar();
    return conversation;
}

function renderWelcomeScreen() {
    if (!chatHistory) return;
    if (welcomeTemplate) {
        chatHistory.innerHTML = welcomeTemplate;
    } else {
        chatHistory.innerHTML = "<div class=\"welcome-container\"><div class=\"welcome-icon\">🛡️</div><h1>Security Copilot</h1><p>Analyze your Entra ID, Okta, RBAC, authentication and authorization flows.</p><div class=\"suggestions\"><button onclick=\"fillPrompt('Review Project')\">Review Project</button><button onclick=\"fillPrompt('Compare Entra and Okta')\">Compare Apps</button><button onclick=\"fillPrompt('Show top security risks')\">Show Risks</button><button onclick=\"fillPrompt('Review RBAC implementation')\">Review RBAC</button></div></div>";
    }
}

function getCurrentConversation() {
    return conversations.find((conversation) => conversation.id === currentConversationId);
}

function toggleSidebar() {
    appContainer?.classList.toggle("sidebar-open");
}

function closeSidebar() {
    appContainer?.classList.remove("sidebar-open");
}

function handleResize() {
    if (window.innerWidth <= 900) {
        closeSidebar();
    }
}

function renderSidebar(filter = "") {
    if (!conversationList) return;
    conversationList.innerHTML = "";

    const heading = document.createElement("div");
    heading.className = "sidebar-heading";
    heading.textContent = "Conversations";
    conversationList.appendChild(heading);

    if (isPlaceholderActive) {
        const placeholderItem = document.createElement("div");
        placeholderItem.className = "chat-item active";
        placeholderItem.innerHTML = `
            <div class="chat-item-header">
                <div class="sidebar-item-title" style="font-style: italic; color: var(--muted);">New conversation...</div>
            </div>
            <div class="sidebar-item-meta">Drafting</div>
        `;
        conversationList.appendChild(placeholderItem);
    }

    const sorted = [...conversations].sort((a, b) => {
        if (a.pinned === b.pinned) return b.updatedAt - a.updatedAt;
        return a.pinned ? -1 : 1;
    });

    const filteredConversations = sorted.filter((conversation) => {
        if (!filter) return true;
        return (
            conversation.title.toLowerCase().includes(filter) ||
            conversation.messages.some((message) => message.content.toLowerCase().includes(filter))
        );
    });

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;

    let createdTodayHeader = false;
    let createdYesterdayHeader = false;
    let createdOlderHeader = false;

    filteredConversations.forEach((conversation) => {
        if (conversation.pinned) {
            // Keep pinned items at top
        } else if (conversation.updatedAt >= startOfToday && !createdTodayHeader) {
            createTimeGroupHeader("Today");
            createdTodayHeader = true;
        } else if (conversation.updatedAt >= startOfYesterday && conversation.updatedAt < startOfToday && !createdYesterdayHeader) {
            createTimeGroupHeader("Yesterday");
            createdYesterdayHeader = true;
        } else if (conversation.updatedAt < startOfYesterday && !createdOlderHeader) {
            createTimeGroupHeader("Previous Conversations");
            createdOlderHeader = true;
        }

        const item = document.createElement("div");
        item.className = "chat-item";
        if (conversation.id === currentConversationId && !isPlaceholderActive) {
            item.classList.add("active");
        }
        item.dataset.id = conversation.id;

        const itemHeader = document.createElement("div");
        itemHeader.className = "chat-item-header";

        const title = document.createElement("div");
        title.className = "sidebar-item-title";
        title.textContent = conversation.title || "Untitled conversation";

        const actions = document.createElement("div");
        actions.className = "chat-item-actions";

        const pin = document.createElement("button");
        pin.type = "button";
        pin.className = "chat-action-btn";
        pin.title = conversation.pinned ? "Unpin this conversation" : "Pin this conversation";
        pin.textContent = conversation.pinned ? "📌" : "📍";
        pin.addEventListener("click", (event) => {
            event.stopPropagation();
            toggleConversationPin(conversation.id);
        });

        const rename = document.createElement("button");
        rename.type = "button";
        rename.className = "chat-action-btn";
        rename.title = "Rename conversation";
        rename.textContent = "✏️";
        rename.addEventListener("click", (event) => {
            event.stopPropagation();
            renameConversation(conversation.id);
        });

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "chat-action-btn chat-action-delete";
        remove.title = "Delete conversation";
        remove.textContent = "🗑️";
        remove.addEventListener("click", (event) => {
            event.stopPropagation();
            deleteConversation(conversation.id);
        });

        actions.appendChild(pin);
        actions.appendChild(rename);
        actions.appendChild(remove);

        itemHeader.appendChild(title);
        itemHeader.appendChild(actions);

        const meta = document.createElement("div");
        meta.className = "sidebar-item-meta";
        const date = new Date(conversation.updatedAt);
        meta.textContent = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

        item.appendChild(itemHeader);
        item.appendChild(meta);

        item.addEventListener("click", () => {
            isPlaceholderActive = false; 
            loadConversation(conversation.id);
        });
        conversationList.appendChild(item);
    });
}

function createTimeGroupHeader(text) {
    const subheader = document.createElement("div");
    subheader.className = "sidebar-time-header";
    subheader.textContent = text;
    conversationList.appendChild(subheader);
}

function loadConversation(conversationId) {
    const conversation = conversations.find((item) => item.id === conversationId);
    if (!conversation) return;
    currentConversationId = conversation.id;
    renderSidebar();
    renderConversation(conversation);
    closeSidebar();
}

function renameConversation(conversationId) {
    const conversation = conversations.find((item) => item.id === conversationId);
    if (!conversation) return;
    const newTitle = window.prompt("Enter a new chat title:", conversation.title);
    if (!newTitle) return;
    conversation.title = newTitle.trim();
    conversation.updatedAt = Date.now();
    saveConversations();
    renderSidebar(sidebarSearch?.value.trim().toLowerCase());
    if (conversation.id === currentConversationId) {
        renderConversation(conversation);
    }
}

function toggleConversationPin(conversationId) {
    const conversation = conversations.find((item) => item.id === conversationId);
    if (!conversation) return;
    conversation.pinned = !conversation.pinned;
    conversation.updatedAt = Date.now();
    saveConversations();
    renderSidebar(sidebarSearch?.value.trim().toLowerCase());
}

function deleteConversation(conversationId) {
    const index = conversations.findIndex((item) => item.id === conversationId);
    if (index === -1) return;
    if (!window.confirm("Delete this conversation? This cannot be undone.")) return;
    conversations.splice(index, 1);
    saveConversations();

    if (currentConversationId === conversationId) {
        prepareNewChatPlaceholder();
    } else {
        renderSidebar(sidebarSearch?.value.trim().toLowerCase());
    }
}

function renderConversation(conversation) {
    if (!chatHistory) return;

    if (!conversation || conversation.messages.length === 0) {
        renderWelcomeScreen();
        return;
    }

    chatHistory.innerHTML = "";
    const actions = document.createElement("div");
    actions.className = "conversation-actions";

    const exportMd = document.createElement("button");
    exportMd.type = "button";
    exportMd.className = "conversation-action-btn";
    exportMd.textContent = "Export MD";
    exportMd.addEventListener("click", () => exportConversation("markdown"));

    const exportPdf = document.createElement("button");
    exportPdf.type = "button";
    exportPdf.className = "conversation-action-btn";
    exportPdf.textContent = "Export PDF";
    exportPdf.addEventListener("click", () => exportConversation("pdf"));

    actions.appendChild(exportMd);
    actions.appendChild(exportPdf);
    chatHistory.appendChild(actions);

    conversation.messages.forEach((message, idx) => {
        const bubble = createMessageBubble(message.content, message.role, {
            html: message.html,
            timestamp: message.timestamp,
            metrics: message.metrics
        });
        if (message.role === "assistant") {
            appendActionToolbarToBubble(bubble, idx);
        }
    });
    
    injectCodeBlockCopyButtons();

    if (!userScrolledUp) {
        scrollToBottom();
    }
}

function createMessageBubble(text, role, options = {}) {
    const messageContainer = document.createElement("div");
    messageContainer.className = `${role}-message message`;

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";

    if (options.html) {
        bubble.innerHTML = text;
    } else {
        bubble.textContent = text;
    }

    if (options.timestamp) {
        bubble.classList.add("message-with-timestamp");
        const time = document.createElement("span");
        time.className = "message-timestamp";
        time.textContent = new Date(options.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        bubble.appendChild(time);
    }

    if (role === "assistant" && options.metrics) {
        const metricsContainer = document.createElement("div");
        metricsContainer.className = "message-metrics-badge";
        metricsContainer.textContent = `⏱️ ${options.metrics.wordCount} words | ${options.metrics.speed} words/sec (RTT: ${options.metrics.rtt}s)`;
        bubble.appendChild(metricsContainer);
    }

    messageContainer.appendChild(bubble);
    chatHistory.appendChild(messageContainer);
    if (!userScrolledUp) {
        scrollToBottom();
    }
    return bubble;
}

function appendActionToolbarToBubble(bubble, messageIndex) {
    if (!bubble || bubble.querySelector(".message-toolbar")) return;
    
    bubble.style.paddingBottom = "45px";

    const toolbar = document.createElement("div");
    toolbar.className = "message-toolbar";

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "message-toolbar-btn";
    copyButton.title = "Copy response";
    copyButton.setAttribute("aria-label", "Copy response");
    copyButton.textContent = "📋";
    copyButton.addEventListener("click", () => {
        const textToCopy = bubble.innerText.replace(/[📋🔄⏱️]/g, "").replace(/\d+ words.*/g, "").replace(/\d{2}:\d{2}\s*(AM|PM)?$/i, "").trim();
        navigator.clipboard.writeText(textToCopy).catch(() => {
            window.alert("Unable to copy response.");
        });
    });

    const regenerateButton = document.createElement("button");
    regenerateButton.type = "button";
    regenerateButton.className = "message-toolbar-btn";
    regenerateButton.title = "Regenerate response";
    regenerateButton.setAttribute("aria-label", "Regenerate response");
    regenerateButton.textContent = "🔄";
    regenerateButton.addEventListener("click", () => {
        const conversation = getCurrentConversation();
        if (!conversation) return;
        
        if (messageIndex > 0 && conversation.messages[messageIndex - 1]?.role === "user") {
            const previousPrompt = conversation.messages[messageIndex - 1].content;
            conversation.messages.splice(messageIndex - 1, conversation.messages.length - (messageIndex - 1));
            saveConversations();
            
            questionInput.value = previousPrompt;
            askQuestion();
        }
    });

    toolbar.appendChild(copyButton);
    toolbar.appendChild(regenerateButton);
    bubble.appendChild(toolbar);
}

function injectCodeBlockCopyButtons() {
    const codeBlocks = chatHistory.querySelectorAll(".assistant-answer pre");
    codeBlocks.forEach((block) => {
        if (block.querySelector(".code-block-copy-btn")) return;
        
        block.style.position = "relative";
        
        const copyCodeBtn = document.createElement("button");
        copyCodeBtn.type = "button";
        copyCodeBtn.className = "code-block-copy-btn";
        copyCodeBtn.title = "Copy Code Only";
        copyCodeBtn.textContent = "📋";
        
        copyCodeBtn.addEventListener("click", () => {
            const rawCode = block.querySelector("code")?.innerText || block.innerText.replace("📋", "");
            navigator.clipboard.writeText(rawCode).then(() => {
                copyCodeBtn.textContent = "✅";
                setTimeout(() => { copyCodeBtn.textContent = "📋"; }, 2000);
            }).catch(() => {
                window.alert("Failed to copy code segment.");
            });
        });
        
        block.appendChild(copyCodeBtn);
    });
}

function appendMessageToConversation(role, content, html = false, metrics = null) {
    const conversation = getCurrentConversation();
    if (!conversation) return;

    const message = {
        role,
        content,
        html,
        timestamp: Date.now(),
        metrics: metrics
    };
    conversation.messages.push(message);
    conversation.updatedAt = Date.now();
    saveConversations();
    renderSidebar(sidebarSearch?.value.trim().toLowerCase());
    return message;
}

function updateLastAssistantMessage(content, html = false, answerText = "", metrics = null) {
    const conversation = getCurrentConversation();
    if (!conversation || conversation.messages.length === 0) return;
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    lastMessage.content = content;
    lastMessage.html = html;
    lastMessage.timestamp = Date.now();
    if (metrics) {
        lastMessage.metrics = metrics;
    }
    saveConversations();
}

function calculateTokenMetrics(text, durationMs) {
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    const segmentsSec = durationMs / 1000 || 0.1;
    const speedRate = Math.round(wordCount / segmentsSec);
    return {
        wordCount: wordCount,
        speed: speedRate > 0 ? speedRate : 12,
        rtt: segmentsSec.toFixed(2)
    };
}

function buildAssistantHtml(plan, answer) {
    const safePlan = escapeHtml(plan || "");
    const planSection = shouldIncludePlan(plan)
        ? `<div class="assistant-plan"><span class="assistant-plan-label">Agent plan:</span> ${renderMarkdown(safePlan)}</div>`
        : "";
    const answerSection = `<div class="assistant-answer">${renderMarkdown(escapeHtml(answer || ""))}</div>`;
    return `${planSection}${answerSection}`;
}

function highlightSyntaxCode(code) {
    return code
        .replace(/(💬|#.+)/g, '<span class="code-comment">$1</span>')
        .replace(/\b(const|let|var|function|return|def|import|from|if|else|for|while|async|await|class)\b/g, '<span class="code-keyword">$1</span>')
        .replace(/(['"`])(.*?)\1/g, '<span class="code-string">$1$2$1</span>')
        .replace(/\b(\d+)\b/g, '<span class="code-number">$1</span>');
}

function renderMarkdown(text) {
    if (!text) return "";

    const lines = text.split(/\r?\n/);
    const htmlLines = [];
    let inCodeBlock = false;
    let codeLines = [];
    let listType = null;
    let listLines = [];
    let paragraphLines = [];
    let tableLines = [];

    function flushParagraph() {
        if (!paragraphLines.length) return;
        const content = paragraphLines.join(" ");
        htmlLines.push(`<p>${processInlineFormats(content)}</p>`);
        paragraphLines = [];
    }

    function flushList() {
        if (!listLines.length) { listType = null; return; }
        const tag = listType === "ol" ? "ol" : "ul";
        const items = listLines
            .map((item) => item.replace(/^\s*([-*+]\s+|\d+\.\s+)/, ""))
            .map((item) => `<li>${processInlineFormats(item.trim())}</li>`)
            .join("");
        htmlLines.push(`<${tag}>${items}</${tag}>`);
        listLines = [];
        listType = null;
    }

    function flushTable() {
        if (!tableLines.length) return;
        const rows = tableLines
            .filter((row) => !/^\s*\|?\s*[:-]+\s*(\|\s*[:-]+\s*)*\|?\s*$/.test(row))
            .map((line) => line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => processInlineFormats(cell.trim())));

        if (!rows.length) { tableLines = []; return; }

        const headerRow = rows[0] || [];
        const bodyRows = rows.slice(1).filter((row) => row.some((cell) => cell.length > 0));
        const headerHtml = `<thead><tr>${headerRow.map((cell) => `<th>${cell}</th>`).join("")}</tr></thead>`;
        const bodyHtml = bodyRows.length
            ? `<tbody>${bodyRows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody>`
            : "";

        htmlLines.push(`<div class="assistant-table-wrapper"><table>${headerHtml}${bodyHtml}</table></div>`);
        tableLines = [];
    }

    function processInlineFormats(line) {
        return line
            .replace(/`([^`]+)`/g, "<code>$1</code>")
            .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
            .replace(/__(.+?)__/g, "<strong>$1</strong>")
            .replace(/\*([^*]+)\*/g, "<em>$1</em>")
            .replace(/_([^_]+)_/g, "<em>$1</em>");
    }

    for (let rawLine of lines) {
        const line = rawLine.replace(/\r$/, "");

        if (inCodeBlock) {
            if (line.trim().startsWith("```")) {
                inCodeBlock = false;
                const innerHighlighted = highlightSyntaxCode(codeLines.join("\n"));
                htmlLines.push(`<pre><code>${innerHighlighted}</code></pre>`);
                codeLines = [];
            } else {
                codeLines.push(line);
            }
            continue;
        }

        if (line.trim().startsWith("```")) {
            flushList(); flushParagraph(); flushTable();
            inCodeBlock = true;
            codeLines = [];
            continue;
        }

        if (/^\s* #{1,3}\s+/.test(line)) {
            flushList(); flushParagraph(); flushTable();
            const level = line.match(/^\s*(#{1,3})\s+/)[1].length;
            const content = processInlineFormats(line.replace(/^\s*#{1,3}\s+/, "").trim());
            htmlLines.push(`<h${level}>${content}</h${level}>`);
            continue;
        }

        if (/^\s*>\s+/.test(line)) {
            flushList(); flushParagraph(); flushTable();
            const content = processInlineFormats(line.replace(/^\s*>\s+/, "").trim());
            htmlLines.push(`<blockquote>${content}</blockquote>`);
            continue;
        }

        if (/^\s*\d+\.\s+/.test(line)) {
            flushParagraph();
            if (listType !== "ol") { flushList(); listType = "ol"; }
            listLines.push(line);
            continue;
        }

        if (/^\s*[-*+]\s+/.test(line)) {
            flushParagraph();
            if (listType !== "ul") { flushList(); listType = "ul"; }
            listLines.push(line);
            continue;
        }

        if (/^\s*\|.*\|\s*$/.test(line)) {
            flushList(); flushParagraph();
            tableLines.push(line);
            continue;
        }

        if (line.trim() === "") {
            flushList(); flushParagraph(); flushTable();
            continue;
        }

        if (tableLines.length) flushTable();
        paragraphLines.push(line);
    }

    flushList(); flushParagraph(); flushTable();
    if (inCodeBlock) {
        htmlLines.push(`<pre><code>${highlightSyntaxCode(codeLines.join("\n"))}</code></pre>`);
    }

    return htmlLines.filter((line) => line.trim().length > 0).join("");
}

function shouldIncludePlan(plan) {
    if (!plan || plan.trim().length < 15) return false;
    const normalized = plan.toLowerCase();
    const genericPatterns = ["i will", "i'll", "i can", "i can provide", "here's a plan", "here is a plan", "plan:", "general overview", "if you want"];
    return !genericPatterns.some((pattern) => normalized.includes(pattern));
}

function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function stopAgentExecution() {
    if (currentController) currentController.abort();
    if (streamTimer) clearInterval(streamTimer);
    
    const conversation = getCurrentConversation();
    if (conversation && conversation.messages.length > 0) {
        const lastMessage = conversation.messages[conversation.messages.length - 1];
        if (lastMessage.role === "assistant" && lastMessage.content === "Agent is thinking...") {
            conversation.messages.pop(); 
        }
        
        const userMsgs = conversation.messages.filter(m => m.role === "user");
        if (userMsgs.length > 0) {
            questionInput.value = userMsgs[userMsgs.length - 1].content;
            questionInput.style.height = "auto";
            questionInput.style.height = `${questionInput.scrollHeight}px`;
        }
    }
    
    setLoadingState(false);
    renderSidebar();
    if (conversation) {
        renderConversation(conversation);
    } else {
        prepareNewChatPlaceholder();
    }
}

async function askQuestion() {
    const question = questionInput.value.trim();
    if (!question) return;

    if (!currentConversationId || isPlaceholderActive) {
        commitPlaceholderToConversation(question);
    }

    questionInput.value = "";
    questionInput.style.height = "auto";
    setLoadingState(true);

    currentController = new AbortController();
    const userMessage = appendMessageToConversation("user", question, false);
    
    if (chatHistory.querySelector(".welcome-container")) {
        chatHistory.innerHTML = "";
    }
    
    createMessageBubble(question, "user", { timestamp: userMessage.timestamp });
    const assistantMessage = appendMessageToConversation("assistant", "Agent is thinking...", false);
    const pendingReply = createMessageBubble("Agent is thinking...", "assistant", {
        timestamp: assistantMessage.timestamp,
        pending: true,
    });

    const roundTripStartTime = Date.now();

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question }),
            signal: currentController.signal
        });

        if (!response.ok) throw new Error(`Backend error ${response.status}`);

        const data = await response.json();
        const totalLatencyMs = Date.now() - roundTripStartTime;
        
        const planText = data.plan || "";
        const answerText = data.answer || "I couldn't generate a response. Please try again.";
        const replyHtml = buildAssistantHtml(planText, answerText);

        handleUpdatingBanner(data.is_updating);

        if (document.hidden) {
            pendingReply.innerHTML = replyHtml;
        } else {
            await streamAssistantResponse(pendingReply, planText, answerText, replyHtml);
        }
        
        const generatedMetrics = calculateTokenMetrics(answerText, totalLatencyMs);
        const conversation = getCurrentConversation();
        const currentIdx = conversation ? conversation.messages.length - 1 : 0;
        
        appendActionToolbarToBubble(pendingReply, currentIdx);
        injectCodeBlockCopyButtons();
        
        const metricsContainer = document.createElement("div");
        metricsContainer.className = "message-metrics-badge";
        metricsContainer.textContent = `⏱️ ${generatedMetrics.wordCount} words | ${generatedMetrics.speed} words/sec (RTT: ${generatedMetrics.rtt}s)`;
        pendingReply.appendChild(metricsContainer);

        updateLastAssistantMessage(replyHtml, true, answerText, generatedMetrics);
        if (!userScrolledUp) scrollToBottom();
    } catch (error) {
        if (error.name === "AbortError") return;
        console.error(error);
        const errorText = "Unable to reach the backend. Please make sure the server is running and try again.";
        pendingReply.textContent = errorText;
        updateLastAssistantMessage(errorText, false);
        if (!userScrolledUp) scrollToBottom();
    } finally {
        setLoadingState(false);
    }
}

function setLoadingState(isLoading) {
    askBtn.disabled = isLoading;
    askBtn.textContent = isLoading ? "Thinking..." : "Send";
    if (stopBtn) stopBtn.style.display = isLoading ? "inline-block" : "none";
}

async function streamAssistantResponse(element, planText, answerText, finalHtml) {
    if (!element) return;
    element.textContent = "";
    let position = 0;
    
    return new Promise((resolve) => {
        streamTimer = setInterval(() => {
            if (document.hidden) {
                clearInterval(streamTimer);
                element.innerHTML = finalHtml;
                resolve();
                return;
            }
            
            position += 45; 
            element.textContent = answerText.slice(0, position);
            
            if (position >= answerText.length) {
                clearInterval(streamTimer);
                element.innerHTML = finalHtml;
                resolve();
            }
        }, 10);
    });
}
function scrollToBottom() {
    if (chatHistory) chatHistory.scrollTop = chatHistory.scrollHeight;
}

function exportConversation(format) {
    const conversation = getCurrentConversation();
    if (!conversation) return;
    const safeTitle = (conversation.title || "conversation").replace(/[^a-z0-9-_ ]/gi, "_").trim();

    if (format === "markdown") {
        const md = conversation.messages.map(m => `**${m.role === "user" ? "User" : "Assistant"}:** ${m.content.replace(/\n/g, "\n\n")}`).join("\n\n---\n\n");
        const blob = new Blob([`# ${conversation.title}\n\n${md}`], { type: "text/markdown;charset=utf-8" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${safeTitle}.md`;
        link.click();
        URL.revokeObjectURL(link.href);
        return;
    }

    if (format === "pdf") {
        const modal = document.getElementById("pdfEditModal");
        const titleInput = document.getElementById("pdfReportTitle");
        const contentArea = document.getElementById("pdfReportContent");

        if (modal && titleInput && contentArea) {
            titleInput.value = conversation.title || "Security Audit Report";
            
            let aggregatedText = "";
            conversation.messages.forEach(m => {
                const identityLabel = m.role === "user" ? "USER QUESTION" : "AGENT ASSESSMENT";
                const cleanText = m.content.replace(/<\/?[^>]+(>|$)/g, "");
                aggregatedText += `=========================================\n[${identityLabel}]\n=========================================\n\n${cleanText}\n\n\n`;
            });
            
            contentArea.value = aggregatedText;
            modal.style.display = "flex";
        }
    }
}

function closePdfModal() {
    const modal = document.getElementById("pdfEditModal");
    if (modal) modal.style.display = "none";
}

function generateFinalPdfFromModal() {
    const editedTitle = document.getElementById("pdfReportTitle").value || "Security Copilot Report";
    const editedContent = document.getElementById("pdfReportContent").value || "";
    
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const formattedBodyContent = editedContent
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>");

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${editedTitle}</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #0f172a; line-height: 1.6; }
                h1 { font-size: 28px; color: #1e3a8a; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 24px; }
                .pdf-text-workspace { font-family: "Courier New", Courier, monospace; font-size: 14px; white-space: pre-wrap; background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; }
            </style>
        </head>
        <body>
            <h1>${editedTitle}</h1>
            <div class="pdf-text-workspace">${formattedBodyContent}</div>
        </body>
        </html>
    `);
    printWindow.document.close();
    
    closePdfModal();
    
    setTimeout(() => { 
        printWindow.focus(); 
        printWindow.print(); 
    }, 400);
}

function handleUpdatingBanner(isUpdating) {
    if (!statusBanner) return;
    if (isUpdating == true) {
        statusBanner.className = "status-banner status-updating";
        statusBanner.innerHTML = "⚠️ The Copilot is dynamically rebuilding its security knowledge base. You can continue querying safely via existing models.";
    } else {
        statusBanner.className = "status-banner";
        statusBanner.innerHTML = "";
    }
}

async function checkBackendStatus() {
    if (!statusBanner) return;
    try {
        const response = await fetch(STATUS_URL);
        if (!response.ok) throw new Error("Offline");
        const data = await response.json();
        handleUpdatingBanner(data.is_updating);
    } catch (err) {
        statusBanner.className = "status-banner status-offline";
        statusBanner.innerHTML = "❌ Connection Error: The AI Security Agent backend is currently offline.";
    }
}

setInterval(checkBackendStatus, 4000);

function initialize() {
    initTheme();
    prepareNewChatPlaceholder();
    checkBackendStatus();
}

initialize();