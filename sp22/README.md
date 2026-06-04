# IPFS Code Snippet Sharing Platform

A decentralized code snippet sharing platform built with React, Node.js, and IPFS (Helia).

## Features

- **No Login Required**: Create and share code snippets without authentication
- **IPFS Storage**: All content stored on IPFS, fully decentralized
- **Syntax Highlighting**: Powered by highlight.js with GitHub Dark theme
- **Comment System**: Comments stored on IPFS, linked via Merkle DAG
- **Search Functionality**: Search snippets via IPFS DHT indexing
- **Shareable Links**: Access snippets via `/cid` URL format

## Project Structure

```
sp22/
├── server/          # Node.js backend with IPFS node
│   ├── routes/
│   │   ├── snippets.js     # Code snippet CRUD operations
│   │   ├── comments.js     # Comment management API
│   │   └── search.js       # DHT-based search API
│   ├── ipfs-node.js        # Helia IPFS node initialization
│   ├── server.js           # Express server entry point
│   └── package.json
└── client/          # React frontend
    ├── src/
    │   ├── pages/
    │   │   ├── Home.jsx           # Landing page
    │   │   ├── CreateSnippet.jsx  # Create new snippet
    │   │   ├── SnippetView.jsx    # View snippet with comments
    │   │   └── Search.jsx         # Search interface
    │   ├── App.jsx         # Main app with routing
    │   ├── main.jsx        # React entry point
    │   └── index.css       # Global styles
    ├── vite.config.js
    └── package.json
```

## Installation & Setup

### Backend Setup

```bash
cd server
npm install
cp .env.example .env
npm start
```

The backend server will start on port 5000 and initialize an IPFS node.

### Frontend Setup

```bash
cd client
npm install
npm run dev
```

The frontend development server will start on port 3000.

## API Endpoints

### Snippets
- `POST /api/snippets` - Create new code snippet
- `GET /api/snippets/:cid` - Get snippet by CID

### Comments
- `POST /api/comments` - Add comment to a snippet
- `GET /api/comments/snippet/:snippetCid` - Get all comments for a snippet
- `GET /api/comments/:cid` - Get specific comment by CID

### Search
- `GET /api/search?q=<query>&language=<lang>` - Search snippets via DHT

## Usage

1. Start both backend and frontend servers
2. Navigate to `http://localhost:3000`
3. Click "New Snippet" to create a code snippet
4. Fill in title, language, and code content
5. Submit to upload to IPFS and receive a CID
6. Share the URL `/cid` with others
7. View snippets, add comments, and search using the navigation

## Technologies

- **Backend**: Node.js, Express, Helia (IPFS), libp2p DHT
- **Frontend**: React 18, React Router, Vite, Axios
- **Syntax Highlighting**: highlight.js
- **Data Format**: DAG-CBOR for structured data
