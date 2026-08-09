# Geba AI V2.0 — Provider Adapter & Registry Guide

This guide explains how to add support for a new Ethiopian payment provider or bank in Geba AI V2.0.

---

## Provider Implementation Workflow

Adding a new Ethiopian bank or digital wallet requires **11 simple steps** without modifying the core verification engine:

```text
1. Add Provider Registry Entry in provider-registry.ts
2. Create Provider Adapter Class implementing PaymentProviderAdapter
3. Add Receipt Text & Regex Patterns
4. Add Official Domain & QR Rules
5. Add SMS Parser Patterns
6. Add USSD Parser Patterns (if applicable)
7. Add URL Construction Strategy (if supported)
8. Implement verifyOfficialTransaction()
9. Add Test Fixtures
10. Add Unit Tests
11. Enable Provider
```

---

## 1. Provider Adapter Interface

```typescript
export interface PaymentProviderAdapter {
  providerId: string;

  detectEvidence(input: EvidenceInput): Promise<{ isSupported: boolean; confidence: number }>;

  extractTransaction(input: EvidenceInput): Promise<NormalizedTransaction>;

  decodeQR?(input: EvidenceInput): Promise<string | null>;

  validateDomain?(url: string): Promise<boolean>;

  buildReceiptVerificationUrl(transaction: NormalizedTransaction): Promise<string | null>;

  verifyOfficialTransaction(transaction: NormalizedTransaction): Promise<{
    verified: boolean;
    data?: Partial<NormalizedTransaction>;
    rawHtml?: string;
    error?: string;
  }>;

  parseSMS?(text: string): Promise<NormalizedTransaction | null>;

  parseUSSD?(text: string): Promise<NormalizedTransaction | null>;
}
```

---

## 2. Example: Registering a New Provider

To add a new bank (e.g. **Hibret Bank**):

### Step A: Create Adapter Class
`backend/src/modules/verify/adapters/hibret.adapter.ts`

```typescript
import { PaymentProviderAdapter, EvidenceInput, NormalizedTransaction } from "../types.js";
import { scrapeReceiptUrl } from "../receipt-scraper.js";

export class HibretProviderAdapter implements PaymentProviderAdapter {
  providerId = "hibret";

  async detectEvidence(input: EvidenceInput): Promise<{ isSupported: boolean; confidence: number }> {
    const text = (input.text || "").toLowerCase();
    if (text.includes("hibret bank")) return { isSupported: true, confidence: 0.85 };
    return { isSupported: false, confidence: 0 };
  }

  async extractTransaction(input: EvidenceInput): Promise<NormalizedTransaction> {
    return { provider: "hibret", sourceType: input.type || "UNKNOWN", extractionConfidence: 0.8 };
  }

  async buildReceiptVerificationUrl(transaction: NormalizedTransaction): Promise<string | null> {
    if (!transaction.transactionId) return null;
    return `https://receipts.hibretbank.com.et/verify/${transaction.transactionId}`;
  }

  async verifyOfficialTransaction(transaction: NormalizedTransaction): Promise<{
    verified: boolean;
    data?: Partial<NormalizedTransaction>;
    rawHtml?: string;
    error?: string;
  }> {
    const url = transaction.receiptUrl || (await this.buildReceiptVerificationUrl(transaction));
    if (!url) return { verified: false, error: "No receipt URL for Hibret" };

    const scraped = await scrapeReceiptUrl(url, "hibret", transaction.transactionId || "");
    if (!scraped || !scraped.isValid) return { verified: false, error: scraped?.error || "Hibret lookup failed" };

    return {
      verified: true,
      data: {
        provider: "hibret",
        transactionId: scraped.transactionId,
        amount: scraped.amount,
        sender: { name: scraped.senderName },
        receiver: { name: scraped.receiverName },
        date: scraped.date,
        status: scraped.status,
      },
      rawHtml: scraped.rawHtml,
    };
  }
}
```

### Step B: Register in `provider-registry.ts`

```typescript
this.registerProvider({
  id: "hibret",
  name: "Hibret Bank",
  adapter: new HibretProviderAdapter(),
  aliases: ["hibret", "hibret bank", "united bank"],
  officialDomains: ["hibretbank.com.et", "receipts.hibretbank.com.et"],
  verificationDomains: ["receipts.hibretbank.com.et"],
  identifierTypes: ["TRANSACTION_ID", "REFERENCE"],
  txIdPatterns: [/HBT[A-Z0-9]{8,14}/i],
  referencePatterns: [/REF[A-Z0-9]{8,14}/i],
  accountPatterns: [/1[0-9]{12}/],
  phonePatterns: [/^(?:\+251|251|0)?9[0-9]{8}$/],
  smsPatterns: [/hibret bank/i],
  ussdPatterns: [/\*995\#/i],
  verificationMethods: ["QR", "RECEIPT_URL", "TRANSACTION_ID", "OFFICIAL_PORTAL", "SMS"],
  requiredFields: ["amount", "transactionId"],
  optionalFields: ["senderName", "receiverName"],
  supportsQR: true,
  supportsSMS: true,
  supportsUSSD: true,
  supportsOfficialVerification: true,
});
```

---

## 3. Supported Ethiopian Banks (Out of the Box)
- Commercial Bank of Ethiopia (CBE / CBE Birr)
- Telebirr (Ethio Telecom)
- Dashen Bank (Amole / IPSS)
- Bank of Abyssinia (BoA / Apollo)
- Awash Bank (Awash Birr / AwashPay)
- Zemen Bank
- Safaricom M-Pesa
