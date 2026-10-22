const express = require("express");
const dotenv = require("dotenv");
const OpenAI = require("openai");
const { search } = require("duck-duck-scrape");

dotenv.config();

const app = express();

const PORT = 3000;

app.use(express.json());

app.use(
    express.static("public")
);

const client = new OpenAI({
    baseURL:
        "http://localhost:11434/v1",
    apiKey: "ollama"
});

const MODEL = "llama3.2";

const conversations =
    new Map();

const contexts =
    new Map();

const MAX_HISTORY = 16;

/* -------------------------------------------------------
   Conversation
------------------------------------------------------- */

function getConversation(sessionId) {
    if (
        !conversations.has(
            sessionId
        )
    ) {
        conversations.set(
            sessionId,
            []
        );
    }

    return conversations.get(
        sessionId
    );
}

function saveConversation(
    sessionId,
    userMessage,
    assistantMessage
) {
    const history =
        getConversation(
            sessionId
        );

    history.push({
        role: "user",
        content: userMessage
    });

    history.push({
        role: "assistant",
        content: assistantMessage
    });

    while (
        history.length >
        MAX_HISTORY
    ) {
        history.shift();
    }
}

function getContext(sessionId) {
    if (
        !contexts.has(
            sessionId
        )
    ) {
        contexts.set(
            sessionId,
            {
                location: null,
                country: null,
                latitude: null,
                longitude: null,
                timezone: null,
                topic: null
            }
        );
    }

    return contexts.get(
        sessionId
    );
}

function setLocationContext(
    sessionId,
    place
) {
    const context =
        getContext(
            sessionId
        );

    context.location =
        place.name || null;

    context.country =
        place.country || null;

    context.latitude =
        place.latitude ?? null;

    context.longitude =
        place.longitude ?? null;

    context.timezone =
        place.timezone || null;
}

/* -------------------------------------------------------
   Text helpers
------------------------------------------------------- */

function normalizeText(text) {
    return String(text || "")
        .toLowerCase()
        .trim()
        .replace(
            /[?!.,;:]+$/g,
            ""
        );
}

function cleanText(text) {
    return String(text || "")
        .replace(/\s+/g, " ")
        .trim();
}

/* -------------------------------------------------------
   Ollama
------------------------------------------------------- */

async function askOllama(
    messages,
    temperature = 0.2
) {
    try {
        const completion =
            await client.chat.completions.create(
                {
                    model: MODEL,
                    messages,
                    temperature
                }
            );

        return (
            completion
                .choices?.[0]
                ?.message?.content
                ?.trim() || ""
        );

    } catch (error) {
        console.error(
            "OLLAMA ERROR:",
            error.message
        );

        return "";
    }
}

/* -------------------------------------------------------
   Web search
------------------------------------------------------- */

async function searchWeb(
    query
) {
    try {
        const cleanQuery =
            cleanText(query);

        if (!cleanQuery) {
            return [];
        }

        console.log(
            "WEB SEARCH:",
            cleanQuery
        );

        const result =
            await search(
                cleanQuery
            );

        if (
            !result ||
            !Array.isArray(
                result.results
            )
        ) {
            return [];
        }

        return result.results
            .slice(0, 8)
            .map(item => ({
                title:
                    item.title || "",
                description:
                    item.description ||
                    "",
                url:
                    item.url || ""
            }))
            .filter(item =>
                item.title ||
                item.description ||
                item.url
            );

    } catch (error) {
        console.error(
            "WEB SEARCH ERROR:",
            error.message
        );

        return [];
    }
}

/* -------------------------------------------------------
   Geocoding
------------------------------------------------------- */

async function geocode(
    query,
    count = 10
) {
    try {
        const url =
            "https://geocoding-api.open-meteo.com/v1/search" +
            `?name=${encodeURIComponent(query)}` +
            `&count=${count}` +
            "&language=en" +
            "&format=json";

        const response =
            await fetch(url);

        if (!response.ok) {
            return [];
        }

        const data =
            await response.json();

        return Array.isArray(
            data.results
        )
            ? data.results
            : [];

    } catch (error) {
        console.error(
            "GEOCODING ERROR:",
            error.message
        );

        return [];
    }
}

function placeLabel(place) {
    return [
        place.name,
        place.admin1,
        place.country
    ]
        .filter(Boolean)
        .join(", ");
}

function tokenize(text) {
    return normalizeText(
        text
    )
        .replace(
            /[^a-z0-9\u00C0-\u024F\u1E00-\u1EFF\s-]/gi,
            " "
        )
        .split(/\s+/)
        .filter(Boolean);
}

function locationScore(
    query,
    place
) {
    const q =
        normalizeText(query);

    const name =
        normalizeText(
            place.name
        );

    const admin =
        normalizeText(
            place.admin1 || ""
        );

    const country =
        normalizeText(
            place.country || ""
        );

    const full =
        `${name} ${admin} ${country}`;

    let score = 0;

    if (q === name) {
        score += 100;
    }

    if (q === full) {
        score += 95;
    }

    if (
        name.startsWith(q) ||
        q.startsWith(name)
    ) {
        score += 60;
    }

    if (
        name.includes(q) ||
        q.includes(name)
    ) {
        score += 45;
    }

    const queryTokens =
        tokenize(query);

    const fullTokens =
        tokenize(full);

    if (queryTokens.length) {
        let matched = 0;

        for (
            const token of queryTokens
        ) {
            if (
                fullTokens.includes(
                    token
                )
            ) {
                matched++;
            }
        }

        score +=
            (matched /
                queryTokens.length) *
            60;
    }

    if (
        q.includes(
            country
        ) &&
        country
    ) {
        score += 30;
    }

    if (
        q.includes(
            admin
        ) &&
        admin
    ) {
        score += 20;
    }

    return score;
}

async function findLocations(
    query,
    preferredCountry = null
) {
    const original =
        cleanText(query);

    if (!original) {
        return [];
    }

    const queries = [
        original
    ];

    const words =
        original
            .split(/\s+/)
            .filter(
                word =>
                    word.length >= 3
            );

    if (
        words.length > 1
    ) {
        queries.push(
            words.join(" ")
        );
    }

    const all =
        [];

    for (
        const item of queries
    ) {
        const found =
            await geocode(
                item,
                10
            );

        all.push(
            ...found
        );
    }

    const unique =
        [];

    for (
        const place of all
    ) {
        const duplicate =
            unique.some(
                item =>
                    item.latitude ===
                    place.latitude &&
                    item.longitude ===
                    place.longitude &&
                    item.name ===
                    place.name
            );

        if (!duplicate) {
            unique.push(
                place
            );
        }
    }

    return unique
        .map(place => {
            let score =
                locationScore(
                    original,
                    place
                );

            if (
                preferredCountry &&
                normalizeText(
                    place.country
                ) ===
                normalizeText(
                    preferredCountry
                )
            ) {
                score += 35;
            }

            return {
                ...place,
                _score: score
            };
        })
        .sort(
            (a, b) =>
                b._score -
                a._score
        );
}

/* -------------------------------------------------------
   Location extraction
------------------------------------------------------- */

function extractLocation(
    message
) {
    const patterns = [
        /where\s+is\s+(.+)/i,

        /where's\s+(.+)/i,

        /where\s+are\s+(.+)/i,

        /location\s+of\s+(.+)/i,

        /located\s+(?:in|at)\s+(.+)/i,

        /weather\s+(?:in|at|for)\s+(.+)/i,

        /temperature\s+(?:in|at|for)\s+(.+)/i,

        /forecast\s+(?:in|at|for)\s+(.+)/i,

        /time\s+(?:in|at|for)\s+(.+)/i,

        /date\s+(?:in|at|for)\s+(.+)/i,

        /what\s+time\s+is\s+it\s+in\s+(.+)/i,

        /what(?:'s| is)\s+the\s+time\s+in\s+(.+)/i,

        /what(?:'s| is)\s+the\s+weather\s+in\s+(.+)/i,

        /what(?:'s| is)\s+the\s+temperature\s+in\s+(.+)/i
    ];

    for (
        const pattern of patterns
    ) {
        const match =
            message.match(
                pattern
            );

        if (
            match &&
            match[1]
        ) {
            return cleanText(
                match[1]
                    .replace(
                        /[?.!,]+$/,
                        ""
                    )
            );
        }
    }

    return null;
}

/* -------------------------------------------------------
   Question detection
------------------------------------------------------- */

function isWeatherQuestion(
    text
) {
    const q =
        normalizeText(text);

    return /\b(weather|temperature|temp|forecast|rain|raining|snow|snowing|wind|humidity|hot|cold)\b/i.test(
        q
    );
}

function isTimeQuestion(
    text
) {
    const q =
        normalizeText(text);

    return /\b(current time|time now|what time|local time|clock time|time in|time at)\b/i.test(
        q
    );
}

function isDateQuestion(
    text
) {
    const q =
        normalizeText(text);

    return /\b(today'?s date|current date|date today|what date|date in)\b/i.test(
        q
    );
}

function isLocationQuestion(
    text
) {
    const q =
        normalizeText(text);

    return (
        /^where\s+is\b/i.test(
            q
        ) ||
        /^where's\b/i.test(
            q
        ) ||
        /^where\s+are\b/i.test(
            q
        ) ||
        /\blocation\s+of\b/i.test(
            q
        ) ||
        /\bwhere\s+is\s+located\b/i.test(
            q
        )
    );
}

function isNewsQuestion(
    text
) {
    const q =
        normalizeText(text);

    return /\b(news|headlines|breaking news|latest news|recent news|what happened|updates|update)\b/i.test(
        q
    );
}

function isCurrentQuestion(
    text
) {
    const q =
        normalizeText(text);

    return (
        /\b(latest|currently|current|right now|recent|recently|today|tonight|this week|this month|this year)\b/i.test(
            q
        ) ||
        /\b(price|cost|availability|available|schedule|timetable|stock|in stock|released|release date)\b/i.test(
            q
        )
    );
}

/* -------------------------------------------------------
   Context helpers
------------------------------------------------------- */

function getHistoryText(
    sessionId
) {
    return getConversation(
        sessionId
    )
        .slice(-10)
        .map(
            item =>
                `${item.role}: ${item.content}`
        )
        .join("\n");
}

async function resolveContextLocation(
    sessionId,
    message
) {
    const context =
        getContext(
            sessionId
        );

    const explicit =
        extractLocation(
            message
        );

    if (explicit) {
        const results =
            await findLocations(
                explicit,
                context.country
            );

        if (
            results.length
        ) {
            const best =
                results[0];

            if (
                best._score >=
                45
            ) {
                return best;
            }
        }
    }

    if (
        context.location &&
        (
            /\bthere\b/i.test(
                message
            ) ||
            /\bhere\b/i.test(
                message
            ) ||
            /\bthat\s+(city|place|country)\b/i.test(
                message
            ) ||
            /\bthe\s+(city|place|country)\b/i.test(
                message
            ) ||
            isTimeQuestion(
                message
            ) ||
            isWeatherQuestion(
                message
            ) ||
            isDateQuestion(
                message
            )
        )
    ) {
        const results =
            await findLocations(
                context.location,
                context.country
            );

        if (
            results.length
        ) {
            return results[0];
        }
    }

    const history =
        getHistoryText(
            sessionId
        );

    if (!history) {
        return null;
    }

    const extracted =
        await askOllama(
            [
                {
                    role:
                        "system",
                    content:
                        "Identify the most relevant location from the conversation for the user's latest question. Return only the location name. If there is no relevant location, return NONE."
                },
                {
                    role:
                        "user",
                    content:
                        `${history}\nuser: ${message}`
                }
            ],
            0
        );

    if (
        !extracted ||
        /^none$/i.test(
            extracted.trim()
        )
    ) {
        return null;
    }

    const results =
        await findLocations(
            extracted
                .replace(
                    /[?.!,]+$/,
                    ""
                )
                .trim(),
            context.country
        );

    if (
        results.length &&
        results[0]._score >= 45
    ) {
        return results[0];
    }

    return null;
}

/* -------------------------------------------------------
   Weather
------------------------------------------------------- */

async function getWeatherForPlace(
    place
) {
    try {
        const url =
            "https://api.open-meteo.com/v1/forecast" +
            `?latitude=${place.latitude}` +
            `&longitude=${place.longitude}` +
            "&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m" +
            "&timezone=auto";

        const response =
            await fetch(url);

        if (!response.ok) {
            return null;
        }

        const data =
            await response.json();

        return {
            place,
            timezone:
                data.timezone,
            current:
                data.current
        };

    } catch (error) {
        console.error(
            "WEATHER ERROR:",
            error.message
        );

        return null;
    }
}

/* -------------------------------------------------------
   Local time
------------------------------------------------------- */

async function getTimeForPlace(place) {
    try {
        if (!place?.timezone) {
            return null;
        }

        const url =
            `https://timeapi.io/api/Time/current/zone?timeZone=${encodeURIComponent(place.timezone)}`;

        const response =
            await fetch(url);

        if (!response.ok) {
            console.error(
                "TIME API ERROR:",
                response.status
            );

            return null;
        }

        const data =
            await response.json();

        if (
            !data.dateTime &&
            !data.date &&
            !data.time
        ) {
            return null;
        }

        let localTime = null;

        if (data.dateTime) {
            localTime =
                data.dateTime;
        } else if (
            data.date &&
            data.time
        ) {
            localTime =
                `${data.date}T${data.time}`;
        }

        return {
            place,
            timezone:
                data.timeZone ||
                data.timezone ||
                place.timezone,
            localTime
        };

    } catch (error) {
        console.error(
            "TIME ERROR:",
            error.message
        );

        return null;
    }
}

/* -------------------------------------------------------
   Web search query
------------------------------------------------------- */

async function buildSearchQuery(
    sessionId,
    message
) {
    const context =
        getContext(
            sessionId
        );

    const history =
        getHistoryText(
            sessionId
        );

    const contextLocation =
        context.location
            ? `Current location context: ${context.location}, ${context.country || ""}`
            : "No saved location.";

    if (!history) {
        return cleanText(
            message
        );
    }

    const prompt = `
Create one precise web search query for the user's latest question.

Conversation:
${history}

${contextLocation}

Latest user question:
${message}

Rules:
- Resolve "there", "here", "it", "that city", "that place", "the food", "the hotel", "the price", "the train", etc.
- Keep the previous topic when the question is a follow-up.
- If the user introduces a new topic, use the new topic.
- Preserve explicit locations exactly.
- Do not answer.
- Return only one search query.
`;

    const query =
        await askOllama(
            [
                {
                    role:
                        "system",
                    content:
                        "Generate accurate search queries."
                },
                {
                    role:
                        "user",
                    content:
                        prompt
                }
            ],
            0
        );

    return cleanText(
        query || message
    );
}

/* -------------------------------------------------------
   Web answer
------------------------------------------------------- */

async function answerWithWeb(
    sessionId,
    message
) {
    const query =
        await buildSearchQuery(
            sessionId,
            message
        );

    const results =
        await searchWeb(
            query
        );

    if (!results.length) {
        return {
            reply: "",
            webResults: []
        };
    }

    const sourceText =
        results
            .map(
                (item, index) =>
                    `SOURCE ${index + 1}
Title: ${item.title}
Description: ${item.description}
URL: ${item.url}`
            )
            .join("\n\n");

    const history =
        getHistoryText(
            sessionId
        );

    const context =
        getContext(
            sessionId
        );

    const prompt = `
You are ORA, a general-purpose AI assistant.

Answer the user's question using the supplied web results and conversation context.

Conversation:
${history || "No previous conversation."}

Saved location:
${context.location || "None"}

Current question:
${message}

Search query:
${query}

Web results:
${sourceText}

Rules:

1. Use the web results as evidence.
2. Do not invent facts.
3. Current information should come from current search evidence.
4. Historical questions may use historical sources.
5. Resolve follow-up references using conversation context.
6. If the user introduces a new topic, switch topics.
7. Answer directly first.
8. Do not dump search results.
9. For prices, preserve the source's actual currency.
10. Never automatically convert prices to USD.
11. Never assume "$" means USD without evidence.
12. Do not convert currencies unless the user asks.
13. Support any country's currency naturally.
14. For travel schedules, train times, bus times, flight times, hotel prices, restaurant prices and availability, do not invent data.
15. If sources disagree, explain the difference.
16. If the evidence is insufficient, say what is uncertain.
17. Keep the answer natural and useful.
18. Do not say that web search is unavailable when sources are supplied.

Return only the answer.
`;

    const reply =
        await askOllama(
            [
                {
                    role:
                        "system",
                    content:
                        "You are ORA. Be accurate, contextual and evidence-based."
                },
                {
                    role:
                        "user",
                    content:
                        prompt
                }
            ],
            0.2
        );

    return {
        reply:
            reply ||
            results[0].description ||
            "I found information, but I could not summarize it.",
        webResults:
            results
    };
}

/* -------------------------------------------------------
   General Ollama answer
------------------------------------------------------- */

async function answerGeneral(
    sessionId,
    message
) {
    const history =
        getHistoryText(
            sessionId
        );

    const context =
        getContext(
            sessionId
        );

    return await askOllama(
        [
            {
                role:
                    "system",
                content: `
You are ORA, a helpful general-purpose AI assistant.

Your job is to answer the user's question directly and naturally.

Conversation context:
${history || "None"}

Saved location:
${context.location || "None"}

Rules:
- Answer general knowledge questions directly from your knowledge.
- Do not ask for clarification when the question is clear.
- For simple questions, give a simple answer.
- If the user asks "what is a wave", explain what a wave is.
- If the user asks for a short answer, keep it short.
- Understand follow-up questions using conversation context.
- "there", "here", "it", "they", "that place", and "that city" may refer to previous context.
- Keep the current topic unless the user clearly changes it.
- If the user changes topic, follow the new topic.
- If a question is genuinely ambiguous, ask a brief clarification.
- Do not invent facts.
- Do not claim live information without live evidence.
- Do not invent prices, schedules, news, weather, or availability.
- Be clear, natural, and useful.
`
            },
            {
                role:
                    "user",
                content:
                    message
            }
        ],
        0.3
    );
}

/* -------------------------------------------------------
   Main chat route
------------------------------------------------------- */

app.post(
    "/chat",
    async (req, res) => {
        try {
            const message =
                cleanText(
                    req.body?.message
                );

            const sessionId =
                cleanText(
                    req.body?.sessionId ||
                    "default"
                );

            if (!message) {
                return res
                    .status(400)
                    .json({
                        error:
                            "Message is required."
                    });
            }

            console.log(
                "USER:",
                message
            );

            /* ------------------------------------------------
               Resolve explicit or contextual location
            ------------------------------------------------ */

            let place = null;

            if (
                isLocationQuestion(
                    message
                ) ||
                isWeatherQuestion(
                    message
                ) ||
                isTimeQuestion(
                    message
                ) ||
                isDateQuestion(
                    message
                )
            ) {
                place =
                    await resolveContextLocation(
                        sessionId,
                        message
                    );
            }

            /* ------------------------------------------------
               Location
            ------------------------------------------------ */

            if (
                isLocationQuestion(
                    message
                )
            ) {
                const explicit =
                    extractLocation(
                        message
                    );

                if (
                    explicit
                ) {
                    const results =
                        await findLocations(
                            explicit,
                            getContext(
                                sessionId
                            ).country
                        );

                    if (
                        results.length
                    ) {
                        const best =
                            results[0];

                        if (
                            best._score >=
                            45
                        ) {
                            place = best;
                        }
                    }

                    if (!place) {
                        const reply =
                            "I found multiple possible locations for that name. Please include the country or region so I can identify the correct one.";

                        saveConversation(
                            sessionId,
                            message,
                            reply
                        );

                        return res.json({
                            reply,
                            webResults: []
                        });
                    }
                }

                if (place) {
                    setLocationContext(
                        sessionId,
                        place
                    );

                    const reply =
                        [
                            `${place.name}, ${place.admin1 || ""}, ${place.country || ""}`
                                .replace(
                                    /,\s*,/g,
                                    ","
                                )
                                .replace(
                                    /,\s*$/,
                                    ""
                                ) +
                            ".",

                            place.latitude != null &&
                                place.longitude != null
                                ? `Coordinates: ${place.latitude}, ${place.longitude}.`
                                : ""
                        ]
                            .filter(Boolean)
                            .join(" ");

                    saveConversation(
                        sessionId,
                        message,
                        reply
                    );

                    return res.json({
                        reply,
                        webResults: []
                    });
                }
            }

            /* ------------------------------------------------
               Weather
            ------------------------------------------------ */

            if (
                isWeatherQuestion(
                    message
                )
            ) {
                if (place) {
                    setLocationContext(
                        sessionId,
                        place
                    );

                    const weather =
                        await getWeatherForPlace(
                            place
                        );

                    if (
                        weather?.current
                    ) {
                        const current =
                            weather.current;

                        const reply =
                            await askOllama(
                                [
                                    {
                                        role:
                                            "system",
                                        content:
                                            "Answer weather questions using only supplied weather data."
                                    },
                                    {
                                        role:
                                            "user",
                                        content: `
Location: ${placeLabel(place)}
Timezone: ${weather.timezone}
Local time: ${current.time}
Temperature: ${current.temperature_2m} °C
Feels like: ${current.apparent_temperature} °C
Humidity: ${current.relative_humidity_2m}%
Wind: ${current.wind_speed_10m} km/h
Weather code: ${current.weather_code}

Question:
${message}

Give a direct natural answer.
`
                                    }
                                ],
                                0.1
                            );

                        const finalReply =
                            reply ||
                            `${placeLabel(place)}: ${current.temperature_2m} °C.`;

                        saveConversation(
                            sessionId,
                            message,
                            finalReply
                        );

                        return res.json({
                            reply:
                                finalReply,
                            webResults: []
                        });
                    }
                }
            }

            /* ------------------------------------------------
               Time / date
            ------------------------------------------------ */

            /* ------------------------------------------------
   Time / date
------------------------------------------------ */

            if (
                isTimeQuestion(message) ||
                isDateQuestion(message)
            ) {
                if (place) {
                    setLocationContext(
                        sessionId,
                        place
                    );

                    const timeData =
                        await getTimeForPlace(place);

                    if (timeData?.localTime) {
                        const localTime =
                            timeData.localTime;

                        const datePart =
                            localTime.slice(0, 10);

                        const timePart =
                            localTime.slice(11, 16);

                        const [hourString, minute] =
                            timePart.split(":");

                        let hour =
                            parseInt(hourString, 10);

                        const period =
                            hour >= 12 ? "PM" : "AM";

                        hour =
                            hour % 12 || 12;

                        const formattedTime =
                            `${hour}:${minute} ${period}`;

                        const [year, month, day] =
                            datePart.split("-");

                        const monthNames = [
                            "January",
                            "February",
                            "March",
                            "April",
                            "May",
                            "June",
                            "July",
                            "August",
                            "September",
                            "October",
                            "November",
                            "December"
                        ];

                        const formattedDate =
                            `${monthNames[Number(month) - 1]} ${Number(day)}, ${year}`;

                        let reply;

                        if (
                            isDateQuestion(message) &&
                            !isTimeQuestion(message)
                        ) {
                            reply =
                                `The current date in ${placeLabel(place)} is ${formattedDate}.`;
                        } else if (
                            isTimeQuestion(message)
                        ) {
                            reply =
                                `The current local time in ${placeLabel(place)} is ${formattedTime} (${timeData.timezone}).`;

                            if (
                                isDateQuestion(message)
                            ) {
                                reply +=
                                    ` The date is ${formattedDate}.`;
                            }
                        }

                        saveConversation(
                            sessionId,
                            message,
                            reply
                        );

                        return res.json({
                            reply,
                            webResults: []
                        });
                    }
                }
            }

            /* ------------------------------------------------
               Web for current / news / travel / food /
               prices / places / general research
            ------------------------------------------------ */

            const shouldSearch =
                isCurrentQuestion(
                    message
                ) ||
                isNewsQuestion(
                    message
                ) ||
                isLocationQuestion(
                    message
                ) ||
                /\b(travel|trip|hotel|restaurant|food|eat|visit|tour|train|bus|flight|airport|ticket|route|how to get|things to do|places to see|price|cost)\b/i.test(
                    message
                );

            if (
                shouldSearch
            ) {
                const webAnswer =
                    await answerWithWeb(
                        sessionId,
                        message
                    );

                if (
                    webAnswer.reply
                ) {
                    saveConversation(
                        sessionId,
                        message,
                        webAnswer.reply
                    );

                    return res.json(
                        webAnswer
                    );
                }
            }

            /* ------------------------------------------------
               General web search first
               for questions where web can improve accuracy
            ------------------------------------------------ */

            if (
                message.length > 3
            ) {
                const webAnswer =
                    await answerWithWeb(
                        sessionId,
                        message
                    );

                if (
                    webAnswer.reply
                ) {
                    saveConversation(
                        sessionId,
                        message,
                        webAnswer.reply
                    );

                    return res.json(
                        webAnswer
                    );
                }
            }

            /* ------------------------------------------------
               Ollama fallback
            ------------------------------------------------ */

            const reply =
                await answerGeneral(
                    sessionId,
                    message
                );

            const finalReply =
                reply ||
                "I could not generate a response.";

            saveConversation(
                sessionId,
                message,
                finalReply
            );

            return res.json({
                reply:
                    finalReply,
                webResults: []
            });

        } catch (error) {
            console.error(
                "CHAT ERROR:",
                error
            );

            return res
                .status(500)
                .json({
                    error:
                        "Something went wrong on the server."
                });
        }
    }
);

/* -------------------------------------------------------
   Server
------------------------------------------------------- */

app.listen(
    PORT,
    () => {
        console.log(
            `ORA is running at http://localhost:${PORT}`
        );
    }
);