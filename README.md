# Nemonic - OpenRouter LLM Chat Interface

A modern, feature-rich frontend application for interacting with OpenRouter's LLM API, featuring memory management, RAG (Retrieval-Augmented Generation), and model switching.

## Features

- **OpenRouter Integration**: Chat with various LLM models through OpenRouter API
- **Model Switching**: Easily switch between different models (GPT-4, Claude, Gemini, etc.)
- **Memory System**: Create and selectively include memories in conversations
- **RAG Support**: Upload documents and use them for context-aware responses
- **Persistent Storage**: All data (messages, memories, documents) stored locally
- **Modern UI**: Clean, dark-themed interface with responsive design

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser to the URL shown in the terminal (usually `http://localhost:5173`)

### Configuration

1. Click the Settings icon in the top right
2. Enter your OpenRouter API key (get one from [openrouter.ai/keys](https://openrouter.ai/keys))
3. Select your preferred model
4. Save settings

## Usage

### Chatting

- Type messages in the input field and press Enter or click Send
- The last 10 messages are included as conversation context

### Memories

- Click "Memories" to open the memory panel
- Click the "+" button to add a new memory
- Click on memories to select/deselect them for inclusion in conversations
- Selected memories are automatically included as system context

### Documents (RAG)

- Click "Documents" to open the documents panel
- Click "Upload Document" to add a file
- Supported formats: .txt, .md, .pdf, .doc, .docx
- Documents are automatically chunked and indexed
- Select documents to include them in RAG retrieval
- When you ask a question, relevant chunks from selected documents are retrieved and included in the context

### Model Switching

- Open Settings
- Select a different model from the dropdown
- Popular models are pre-loaded, or click "Load All Models" to see all available options

## Technical Details

- **Frontend**: React 18 + TypeScript + Vite
- **Storage**: LocalStorage for persistence
- **RAG**: Simple hash-based embeddings (for production, consider using OpenAI embeddings or similar)
- **Chunking**: Text is split into 1000-character chunks with 200-character overlap

## Notes

- The current RAG implementation uses a simple hash-based embedding system. For production use, consider integrating with a proper embedding API (OpenAI, Cohere, etc.)
- All data is stored locally in your browser's localStorage
- API keys are stored locally and never sent anywhere except OpenRouter

## License

MIT
