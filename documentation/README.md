# NyayaSutra - Indian Court Simulator

## Overview

NyayaSutra is an AI-powered Indian legal courtroom simulator that enables users to simulate court hearings with AI-driven arguments from both Petitioner and Respondent perspectives. The application uses Google's Gemini AI to analyze legal documents, generate case perspectives, and conduct realistic courtroom simulations.

## Key Features

### 1. Project Management
- Create case projects with title, description, and party selection
- Upload legal documents (PDF, TXT, DOCX, images)
- Automatic document categorization and metadata extraction
- AI-powered document renaming based on content analysis

### 2. Dual Perspective Analysis
- **Petitioner Perspective**: AI analyzes case from petitioner's viewpoint
- **Respondent Perspective**: AI analyzes case from respondent's viewpoint
- Each perspective includes:
  - Chronology of events
  - Key facts
  - Evidence compilation
  - Legal theory
  - Strengths and weaknesses

### 3. Document Processing
- PDF text extraction with PDF.js
- Image-based PDF handling via OCR (Gemini Vision API)
- Direct image upload support (PNG, JPG, etc.)
- Deep document analysis with legal section identification
- Auto-fill metadata (category, date, filed by, court name)

### 4. Courtroom Simulation
- Turn-based hearing simulation
- AI generates arguments for both parties
- User strategy integration for their side
- Message editing with branching
- Judgment delivery by AI judge

### 5. Session Management
- Multiple hearing types (Bail, Evidence, Arguments, etc.)
- Continuation sessions from previous judgments
- Session-specific document uploads
- Parent session argument display in continuations

## Technology Stack

| Component | Technology |
|-----------|------------|
| Frontend | React 19.2 + TypeScript |
| Build Tool | Vite 6.2 |
| AI Service | Google Gemini API (@google/genai) |
| PDF Processing | pdfjs-dist 3.11.174 |
| Icons | lucide-react |
| Styling | Tailwind CSS |
| Storage | localStorage |

## Project Structure

```
nyayasutra---indian-court-simulator/
├── App.tsx                 # Main application component
├── index.tsx               # React entry point
├── types.ts                # TypeScript interfaces
├── components/
│   ├── Dashboard.tsx       # Project list and creation
│   ├── ProjectView.tsx     # Case analysis and perspectives
│   ├── HearingsPage.tsx    # Session management
│   ├── Simulation.tsx      # Courtroom simulation
│   └── DocumentPanel.tsx   # Document management sidebar
├── services/
│   └── geminiService.ts    # AI service layer
├── utils/
│   └── fileProcessor.ts    # File upload and OCR
└── documentation/          # Project documentation
```

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Set API Key**
   - Enter your Gemini API key in the sidebar
   - Supports multiple comma-separated keys for fallback

3. **Run Development Server**
   ```bash
   npm run dev
   ```

4. **Create a Project**
   - Click "New Case" on Dashboard
   - Enter case details and select your side
   - Upload legal documents

5. **Analyze Case**
   - View dual perspectives (Petitioner & Respondent)
   - Edit chronology if needed
   - Chat with perspective agents for refinements

6. **Start Hearing**
   - Go to Hearings page
   - Create new hearing with strategy
   - Upload recent developments
   - Run simulation

## Documentation Index

- [Architecture Overview](./ARCHITECTURE.md)
- [Components Reference](./COMPONENTS.md)
- [Services & Utilities](./SERVICES.md)
- [Types & Interfaces](./TYPES.md)
- [User Flows](./USER_FLOWS.md)
- [API Integration](./API_INTEGRATION.md)

## Indian Legal Focus

NyayaSutra is specifically designed for Indian law:
- References IPC (Indian Penal Code)
- References CrPC (Code of Criminal Procedure)
- References Indian Evidence Act
- Supports Indian court hierarchy (District, High Court, Supreme Court)
- Uses Indian legal terminology and address formats

## License

Private project - All rights reserved.
