# ORA — AI Chatbot 🤖

ORA is an AI-powered chatbot built with Node.js, Express, and Ollama using the Llama 3.2 model.

## Features

- AI-powered conversations
- General knowledge and explanations
- Coding assistance
- Location-related queries
- Weather information integration
- World time and date queries
- Web search and current information
- Conversation history and follow-up questions

*Feature availability depends on the current implementation and configured APIs.*

## Tech Stack

- HTML
- CSS
- JavaScript
- Node.js
- Express.js
- Ollama
- Llama 3.2
- OpenAI SDK
- External APIs

## Getting Started

### Prerequisites

- Node.js
- Ollama
- Git

### Installation

1. Clone this repository:

   ```bash
   git clone https://github.com/shawonhussain0177-coder/My-Ai-Chatbot
   ```

2. Enter the project directory:

   ```bash
   cd My-Ai-Chatbot
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Download the AI model:

   ```bash
   ollama pull llama3.2
   ```

5. Start the application:

   ```bash
   node server.js
   ```

6. Open the local URL shown or configured by your server in your browser.

## Project Structure

```text
My-Ai-Chatbot/
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── server.js
├── package.json
├── package-lock.json
└── .gitignore
```

## Environment Variables

Create a local `.env` file if required by your configuration.

Never upload API keys, passwords, or other secrets to GitHub.

## Project Goal

ORA aims to provide a helpful AI assistant for answering questions, coding assistance, conversation context, and external information integration.

## Future Improvements

- Persistent database storage
- Improved conversation memory
- More reliable real-time information
- Better source citations
- Additional APIs and assistant features

## Author

Created as a personal AI chatbot project.
