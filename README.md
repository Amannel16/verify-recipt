# 🛡️ PayVerify AI — Ethiopian Bank Receipt Verification System

PayVerify AI is a production-ready, full-stack monorepo system designed to verify the authenticity of digital transaction receipts and screenshots from all major Ethiopian banks and wallets. It protects merchants from "photoshopped receipt" fraud by combining AI-powered extraction, local OCR fallbacks, QR code scanning, and automated public verification portal scraping.

---

## 🚀 Key Features

* **Multi-Layer Extraction Pipeline**:
  1. **Primary AI**: Gemini 2.0 Flash Vision (with JSON Schema Output).
  2. **Secondary AI**: Gemini 2.0 Flash-Lite (separate free-tier quota fallback).
  3. **Offline Fallback**: Local **Tesseract.js** OCR with regex parsers calibrated for Ethiopian receipt templates.
* **Auto QR Code Scanning**: Detects and decodes verification QR codes directly from uploaded screenshots using pure JavaScript libraries (**Jimp** + **jsQR**).
* **Automated Web Scraping**: Connects to official receipt verification portals for:
  * **CBE** (Commercial Bank of Ethiopia)
  * **Telebirr** (Ethio Telecom)
  * **Dashen Bank** (Amole/IPSS)
  * **Zemen Bank**
  * **Awash Bank**
  * **Bank of Abyssinia** (BoA / Apollo)
  * **M-Pesa** (Safaricom)
* **Cross-Validation Engine**:
  * Fuzzy string matching (Levenshtein Distance) for **Sender & Receiver Names** to ignore minor typos, abbreviations, or missing middle names.
  * Precise amount check with rounding tolerance (±0.01 ETB).
  * Direct field-by-field verification tables displayed in the app.
* **Supportive Anti-Fraud Checks**:
  * **Duplicate Detection**: Flags reused transaction IDs and alerts if multiple receipts are sent with the same amount and sender within a 24-hour window.
  * **Freshness Check**: Warns if the transaction date is older than 30/90 days or set in the future.
  * **Amount Validation**: Detects suspiciously round numbers (e.g. exactly 10,000 ETB) or values exceeding safety thresholds.
* **Premium Mobile UX**: Built with Expo (React Native), featuring interactive screenshot overlays, verification dashboards, and visual green/yellow/red status indicators.

---

## 📐 System Architecture

```
[Receipt Image Upload]
         │
         ├──► [QR Decoder] ──► (Decodes URL from QR Code) ──┐
         │                                                  │
         └──► [AI / Local OCR Engine]                       │
                   │                                        │
                   ├──► 1. Gemini 2.0 Flash                 │
                   ├──► 2. Gemini 2.0 Flash-Lite            │
                   └──► 3. Tesseract.js (Offline Fallback)  │
                            │                               │
                   (Extracted URL/Text)                     │
                            │                               ▼
                            └──────────────────────► [Verification URL]
                                                            │
                                                            ▼
                                                    [Web Scraper]
                                              (Scrapes Public Portal)
                                                            │
                                                            ▼
                                               [Cross-Validation Engine]
                                              Compare: Sender, Receiver,
                                                   Amount, Reference
                                                            │
                                                            ▼
                                                  [Duplicate Check]
                                                            │
                                                            ▼
                                                [Final Confidence Score]
                                                            │
                                                            ▼
                                                      [Database]
```

---

## 🛠️ Folder Structure

```
├── backend/                  # Node.js Express Backend
│   ├── prisma/               # Database Schema (PostgreSQL/Prisma ORM)
│   ├── src/
│   │   ├── config/           # Database, App, & Upload Configs
│   │   ├── middlewares/      # JWT Authentication Middleware
│   │   ├── modules/
│   │   │   ├── user/         # User auth, registration, plans
│   │   │   └── verify/       # Extraction, Scrapers, Cross-validation
│   │   └── app.ts            # Express Entrypoint
│   └── package.json
│
└── mobile-app/               # Expo React Native App Workspace
    ├── artifacts/
    │   └── mobile/           # Expo App source code (screens, context, styles)
    ├── lib/                  # Shared Zod schemas and database helpers
    └── package.json          # Workspace monorepo package setup (pnpm)
```

---

## ⚙️ Setup and Running Guide

### 📋 Prerequisites
* **Node.js** (v18+)
* **PostgreSQL** database running locally or remotely.
* **pnpm** (for the mobile app workspace).

---

### 1️⃣ Backend Setup
1. Navigate into the backend folder:
   ```bash
   cd backend
   ```
2. Create a `.env` file based on the environment keys:
   ```env
   PORT=6000
   DATABASE_URL="postgresql://<user>:<password>@localhost:5432/<db_name>?schema=public"
   ACCESS_TOKEN_SECRET="your-jwt-access-secret"
   GEMINI_API_KEY="your-google-ai-studio-key"
   ```
3. Install the dependencies:
   ```bash
   npm install
   ```
4. Push database tables and generate client:
   ```bash
   npx prisma db push
   npx prisma generate
   ```
5. Start the development server:
   ```bash
   npm run dev
   ```

---

### 2️⃣ Mobile App Setup
1. Navigate into the mobile-app folder:
   ```bash
   cd mobile-app
   ```
2. Install all monorepo dependencies using `pnpm`:
   ```bash
   pnpm install
   ```
3. Navigate into the actual Expo project directory:
   ```bash
   cd artifacts/mobile
   ```
4. Create a `.env` file containing your local computer's IP address (needed for physical device testing on Wi-Fi):
   ```env
   EXPO_PUBLIC_API_URL=http://<YOUR_COMPUTER_IP>:6000
   ```
5. Start the Metro bundler:
   ```bash
   npx expo start -c
   ```
6. Open your camera and scan the QR code using the **Expo Go** app (Android/iOS).

---

## 🛡️ Cross-Validation Algorithm Details

When a receipt verification URL is scraped, the backend runs the fields through the **Cross-Validator**:

1. **Amount Match (40% Weight)**:
   * Compares the AI-extracted number with the bank-scraped number.
   * Allows a rounding discrepancy of ±0.50 ETB for currency adjustments or processing fees.
2. **Sender Name (25% Weight)**:
   * Normalizes strings by converting to lowercase, removing title prefixes (Ato, W/ro, Dr, Mr, etc.), and shrinking spaces.
   * Compares strings using **Levenshtein Distance**. Returns a match if similarity score is $\ge 70\%$.
3. **Receiver Name (25% Weight)**:
   * Matches the payee/merchant using the same normalized fuzzy string metric.
4. **Transaction ID (10% Weight)**:
   * Performs a strict case-insensitive match on reference strings.
