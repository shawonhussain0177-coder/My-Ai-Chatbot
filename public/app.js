const messages = document.getElementById("messages");
const messageInput = document.getElementById("message-input");
const chatForm = document.getElementById("chat-form");
const newChatButton = document.getElementById("new-chat");
const chatHistory = document.getElementById("chat-history");
const chatTitle = document.getElementById("chat-title");

let currentChatId = null;


/* =========================
   Persistent ORA Session
========================= */

function getSessionId() {
    let sessionId = localStorage.getItem("ora_session_id");

    if (!sessionId) {
        sessionId =
            "ora-" +
            Date.now() +
            "-" +
            Math.random()
                .toString(36)
                .substring(2, 10);

        localStorage.setItem(
            "ora_session_id",
            sessionId
        );
    }

    return sessionId;
}


/* =========================
   Chat Storage
========================= */

function getChats() {
    try {
        return JSON.parse(
            localStorage.getItem("ora_chats") || "[]"
        );
    } catch {
        return [];
    }
}


function saveChats(chats) {
    localStorage.setItem(
        "ora_chats",
        JSON.stringify(chats)
    );
}


function createChatId() {
    return (
        "chat-" +
        Date.now() +
        "-" +
        Math.random()
            .toString(36)
            .substring(2, 9)
    );
}


/* =========================
   New Chat
========================= */

function createNewChat() {
    currentChatId = createChatId();

    const chats = getChats();

    chats.unshift({
        id: currentChatId,
        title: "New Chat",
        messages: []
    });

    saveChats(chats);

    showWelcome();

    chatTitle.textContent = "New Chat";

    renderChatHistory();

    messageInput.focus();
}


/* =========================
   Welcome Screen
========================= */

function showWelcome() {
    messages.innerHTML = `
        <div class="welcome">

            <div class="welcome-icon">O</div>

            <h1>How can I help?</h1>

            <p>
                Ask anything. ORA is here to help.
            </p>

        </div>
    `;
}


/* =========================
   Add Message
========================= */

function addMessage(text, sender) {

    const welcome =
        messages.querySelector(".welcome");

    if (welcome) {
        welcome.remove();
    }

    const message = document.createElement("div");

    message.className =
        sender === "user"
            ? "message user"
            : "message bot";

    message.textContent = text;

    messages.appendChild(message);

    messages.scrollTop =
        messages.scrollHeight;

    return message;
}


/* =========================
   Add Sources
========================= */

function addSources(webResults) {

    if (
        !Array.isArray(webResults) ||
        webResults.length === 0
    ) {
        return;
    }

    const sourceBox =
        document.createElement("div");

    sourceBox.className = "message bot";

    const title =
        document.createElement("div");

    title.textContent = "Sources";

    title.style.fontSize = "12px";
    title.style.color = "#777";
    title.style.marginBottom = "7px";

    sourceBox.appendChild(title);


    webResults
        .slice(0, 5)
        .forEach((result) => {

            if (!result) return;

            const url =
                result.url ||
                result.link;

            if (!url) return;

            const link =
                document.createElement("a");

            link.href = url;
            link.target = "_blank";
            link.rel = "noopener noreferrer";

            link.textContent =
                result.title ||
                result.name ||
                url;

            link.style.display = "block";
            link.style.color = "#888";
            link.style.fontSize = "12px";
            link.style.marginBottom = "4px";
            link.style.textDecoration = "none";

            link.addEventListener(
                "mouseenter",
                () => {
                    link.style.color = "#ddd";
                }
            );

            link.addEventListener(
                "mouseleave",
                () => {
                    link.style.color = "#888";
                }
            );

            sourceBox.appendChild(link);
        });

    messages.appendChild(sourceBox);

    messages.scrollTop =
        messages.scrollHeight;
}


/* =========================
   Save Message
========================= */

function saveMessage(chatId, sender, text) {

    const chats = getChats();

    const chat =
        chats.find(
            item => item.id === chatId
        );

    if (!chat) return;

    if (!Array.isArray(chat.messages)) {
        chat.messages = [];
    }

    chat.messages.push({
        sender: sender,
        text: text
    });

    saveChats(chats);
}


/* =========================
   Update Chat Title
========================= */

function updateChatTitle(
    chatId,
    title
) {

    const chats = getChats();

    const chat =
        chats.find(
            item => item.id === chatId
        );

    if (!chat) return;

    chat.title = title;

    saveChats(chats);
}


/* =========================
   Chat History
========================= */

function renderChatHistory() {

    chatHistory.innerHTML = "";

    const chats = getChats();

    chats.forEach(chat => {

        const item =
            document.createElement("div");

        item.className = "chat-item";

        if (chat.id === currentChatId) {
            item.classList.add("active");
        }


        const name =
            document.createElement("div");

        name.className = "chat-name";

        name.textContent =
            chat.title || "New Chat";


        const menu =
            document.createElement("div");

        menu.className = "chat-menu";


        const menuButton =
            document.createElement("button");

        menuButton.className =
            "menu-button";

        menuButton.type = "button";

        menuButton.textContent = "•••";


        const dropdown =
            document.createElement("div");

        dropdown.className =
            "chat-menu-dropdown";


        const renameButton =
            document.createElement("button");

        renameButton.className =
            "rename-option";

        renameButton.type = "button";

        renameButton.textContent =
            "Rename";


        const deleteButton =
            document.createElement("button");

        deleteButton.className =
            "delete-option";

        deleteButton.type = "button";

        deleteButton.textContent =
            "Delete";


        dropdown.appendChild(
            renameButton
        );

        dropdown.appendChild(
            deleteButton
        );

        menu.appendChild(
            menuButton
        );

        menu.appendChild(
            dropdown
        );


        item.appendChild(name);
        item.appendChild(menu);


        /* Open chat */

        name.addEventListener(
            "click",
            () => {
                openChat(chat.id);
            }
        );


        /* Menu */

        menuButton.addEventListener(
            "click",
            (event) => {

                event.stopPropagation();

                document
                    .querySelectorAll(
                        ".chat-menu-dropdown.show"
                    )
                    .forEach(
                        menuItem => {

                            if (
                                menuItem !==
                                dropdown
                            ) {
                                menuItem.classList.remove(
                                    "show"
                                );
                            }

                        }
                    );

                dropdown.classList.toggle(
                    "show"
                );
            }
        );


        /* Rename */

        renameButton.addEventListener(
            "click",
            (event) => {

                event.stopPropagation();

                const newTitle =
                    prompt(
                        "Rename chat",
                        chat.title ||
                        "New Chat"
                    );

                if (
                    newTitle === null
                ) {
                    return;
                }

                const cleanTitle =
                    newTitle.trim();

                if (!cleanTitle) {
                    return;
                }

                updateChatTitle(
                    chat.id,
                    cleanTitle
                );

                if (
                    currentChatId ===
                    chat.id
                ) {
                    chatTitle.textContent =
                        cleanTitle;
                }

                renderChatHistory();
            }
        );


        /* Delete */

        deleteButton.addEventListener(
            "click",
            (event) => {

                event.stopPropagation();

                const confirmed =
                    confirm(
                        "Delete this chat?"
                    );

                if (!confirmed) {
                    return;
                }

                let chats =
                    getChats();

                chats =
                    chats.filter(
                        item =>
                            item.id !==
                            chat.id
                    );

                saveChats(chats);


                if (
                    currentChatId ===
                    chat.id
                ) {

                    currentChatId = null;

                    chatTitle.textContent =
                        "New Chat";

                    showWelcome();
                }

                renderChatHistory();
            }
        );


        chatHistory.appendChild(item);

    });
}


/* =========================
   Open Chat
========================= */

function openChat(chatId) {

    const chats = getChats();

    const chat =
        chats.find(
            item => item.id === chatId
        );

    if (!chat) return;

    currentChatId = chatId;

    chatTitle.textContent =
        chat.title || "New Chat";

    messages.innerHTML = "";


    if (
        !Array.isArray(chat.messages) ||
        chat.messages.length === 0
    ) {

        showWelcome();

    } else {

        chat.messages.forEach(
            message => {

                addMessage(
                    message.text,
                    message.sender
                );

            }
        );
    }

    renderChatHistory();

    messageInput.focus();
}


/* =========================
   Send Message
========================= */

async function sendMessage() {

    const message =
        messageInput.value.trim();

    if (!message) {
        return;
    }


    /* Create chat automatically */

    if (!currentChatId) {

        currentChatId =
            createChatId();

        const chats =
            getChats();

        chats.unshift({
            id: currentChatId,
            title: message.substring(
                0,
                40
            ),
            messages: []
        });

        saveChats(chats);

        chatTitle.textContent =
            message.substring(
                0,
                40
            );

        renderChatHistory();
    }


    /* Show user message */

    addMessage(
        message,
        "user"
    );

    saveMessage(
        currentChatId,
        "user",
        message
    );


    /* First message becomes title */

    const chats =
        getChats();

    const currentChat =
        chats.find(
            item =>
                item.id ===
                currentChatId
        );

    if (
        currentChat &&
        (
            currentChat.title ===
            "New Chat" ||
            !currentChat.title
        )
    ) {

        currentChat.title =
            message.substring(
                0,
                40
            );

        saveChats(chats);

        chatTitle.textContent =
            currentChat.title;

        renderChatHistory();
    }


    /* Clear input */

    messageInput.value = "";


    /* Loading message */

    const loading =
        addMessage(
            "Thinking...",
            "bot"
        );

    loading.id =
        "ora-loading";


    try {

        const response =
            await fetch(
                "/chat",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            message:
                                message,

                            sessionId:
                                getSessionId()
                        })
                }
            );


        if (!response.ok) {

            throw new Error(
                "Server returned " +
                response.status
            );
        }


        const data =
            await response.json();


        /* Remove loading */

        const loadingMessage =
            document.getElementById(
                "ora-loading"
            );

        if (loadingMessage) {
            loadingMessage.remove();
        }


        /* ORA reply */

        const reply =
            data.reply ||
            data.message ||
            "I could not generate a response.";


        addMessage(
            reply,
            "bot"
        );


        saveMessage(
            currentChatId,
            "bot",
            reply
        );


        /* Sources */

        if (
            data.webResults &&
            Array.isArray(
                data.webResults
            )
        ) {

            addSources(
                data.webResults
            );
        }

    } catch (error) {

        console.error(
            "ORA request error:",
            error
        );


        const loadingMessage =
            document.getElementById(
                "ora-loading"
            );

        if (loadingMessage) {
            loadingMessage.remove();
        }


        const errorText =
            "Sorry, I could not connect to ORA. Make sure the server and Ollama are running.";


        addMessage(
            errorText,
            "bot"
        );


        saveMessage(
            currentChatId,
            "bot",
            errorText
        );
    }
}


/* =========================
   Form Submit
========================= */

chatForm.addEventListener(
    "submit",
    event => {

        event.preventDefault();

        sendMessage();
    }
);


/* =========================
   New Chat Button
========================= */

newChatButton.addEventListener(
    "click",
    () => {
        createNewChat();
    }
);


/* =========================
   Close Menus
========================= */

document.addEventListener(
    "click",
    () => {

        document
            .querySelectorAll(
                ".chat-menu-dropdown.show"
            )
            .forEach(
                dropdown => {
                    dropdown.classList.remove(
                        "show"
                    );
                }
            );

    }
);


/* =========================
   Initial Load
========================= */

function initializeORA() {

    const chats =
        getChats();

    if (chats.length > 0) {

        openChat(
            chats[0].id
        );

    } else {

        currentChatId = null;

        chatTitle.textContent =
            "New Chat";

        showWelcome();
    }

    renderChatHistory();

    messageInput.focus();
}


initializeORA();