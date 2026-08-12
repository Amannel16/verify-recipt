import { NormalizedTransaction, PaymentProviderAdapter } from "./types.js";
import { logger } from "../../utils/logger/logger.js";
import { CbeProviderAdapter } from "./adapters/cbe.adapter.js";
import { CbebirrProviderAdapter } from "./adapters/cbebirr.adapter.js";
import { TelebirrProviderAdapter } from "./adapters/telebirr.adapter.js";
import { DashenProviderAdapter } from "./adapters/dashen.adapter.js";
import { AbyssiniaProviderAdapter } from "./adapters/abyssinia.adapter.js";
import { AwashProviderAdapter } from "./adapters/awash.adapter.js";
import { ZemenProviderAdapter } from "./adapters/zemen.adapter.js";
import { MpesaProviderAdapter } from "./adapters/mpesa.adapter.js";

export interface ProviderRegistryEntry {
  id: string;
  name: string;
  aliases: string[];
  officialDomains: string[];
  verificationDomains: string[];
  identifierTypes: ("TRANSACTION_ID" | "REFERENCE" | "TOKEN" | "RECEIPT_ID" | "AUTHORIZATION_CODE")[];
  txIdPatterns: RegExp[];
  referencePatterns: RegExp[];
  accountPatterns: RegExp[];
  phonePatterns: RegExp[];
  smsPatterns: RegExp[];
  ussdPatterns: RegExp[];
  verificationMethods: ("QR" | "RECEIPT_URL" | "TRANSACTION_ID" | "REFERENCE" | "OFFICIAL_PORTAL" | "SMS" | "USSD")[];
  requiredFields: string[];
  optionalFields: string[];
  supportsQR: boolean;
  supportsSMS: boolean;
  supportsUSSD: boolean;
  supportsOfficialVerification: boolean;
  buildVerificationUrl?: (transaction: NormalizedTransaction) => string | null;
  adapter?: PaymentProviderAdapter;
}

export class ProviderRegistry {
  private static instance: ProviderRegistry;
  private providers: Map<string, ProviderRegistryEntry> = new Map();

  private constructor() {
    this.registerDefaultProviders();
  }

  public static getInstance(): ProviderRegistry {
    if (!ProviderRegistry.instance) {
      ProviderRegistry.instance = new ProviderRegistry();
    }
    return ProviderRegistry.instance;
  }

  public registerProvider(entry: ProviderRegistryEntry): void {
    this.providers.set(entry.id.toLowerCase(), entry);
    logger.info(`🏦 Registered payment provider adapter: ${entry.name} (${entry.id})`);
  }

  public getProvider(id: string): ProviderRegistryEntry | undefined {
    if (!id) return undefined;
    const cleanId = id.toLowerCase().trim();
    if (this.providers.has(cleanId)) {
      return this.providers.get(cleanId);
    }
    // Check aliases
    for (const provider of this.providers.values()) {
      if (provider.aliases.some((alias) => alias.toLowerCase() === cleanId)) {
        return provider;
      }
    }
    return undefined;
  }

  public getAllProviders(): ProviderRegistryEntry[] {
    return Array.from(this.providers.values());
  }

  private registerDefaultProviders(): void {
    // 1. CBE (Commercial Bank of Ethiopia)
    this.registerProvider({
      id: "cbe",
      name: "Commercial Bank of Ethiopia",
      adapter: new CbeProviderAdapter(),
      aliases: ["cbe", "commercial bank of ethiopia", "combanketh"],

      officialDomains: [
        "cbe.com.et",
        "apps.cbe.com.et",
        "mreciept.cbe.com.et",
        "mreceipt.cbe.com.et",
        "combanketh.et",
        "www.cbe.com.et",
      ],
      verificationDomains: [
        "mreciept.cbe.com.et",
        "mreceipt.cbe.com.et",
        "apps.cbe.com.et",
      ],
      identifierTypes: ["TRANSACTION_ID", "REFERENCE"],
      txIdPatterns: [/FT[A-Z0-9]{8,14}/i, /CBE[A-Z0-9]{8,14}/i, /[A-Z0-9]{10,16}/i],
      referencePatterns: [/FT[A-Z0-9]{8,14}/i, /REF[0-9]{6,12}/i],
      accountPatterns: [/1000[0-9]{9}/, /[0-9]{13}/],
      phonePatterns: [/^(?:\+251|251|0)?9[0-9]{8}$/, /^(?:\+251|251|0)?7[0-9]{8}$/],
      smsPatterns: [
        /credited to your account/i,
        /debited from your account/i,
        /cbe birr/i,
        /cbe account/i,
      ],
      ussdPatterns: [/\*847\#/i, /cbe birr transaction/i],
      verificationMethods: ["QR", "RECEIPT_URL", "TRANSACTION_ID", "OFFICIAL_PORTAL", "SMS"],
      requiredFields: ["amount", "receiverName"],
      optionalFields: ["senderName", "transactionId", "date"],
      supportsQR: true,
      supportsSMS: true,
      supportsUSSD: true,
      supportsOfficialVerification: true,
      buildVerificationUrl: (tx) => {
        if (!tx.transactionId) return null;
        return `https://mreciept.cbe.com.et/receipt/${tx.transactionId}`;
      },
    });

    // 1.5 CBEBirr
    this.registerProvider({
      id: "cbebirr",
      name: "CBEBirr",
      adapter: new CbebirrProviderAdapter(),
      aliases: ["cbebirr", "cbe birr"],

      officialDomains: [
        "cbebirr.cbe.com.et",
        "cbepay1.cbe.com.et",
        "shorturl.at"
      ],
      verificationDomains: [
        "cbepay1.cbe.com.et"
      ],
      identifierTypes: ["TRANSACTION_ID", "REFERENCE"],
      txIdPatterns: [/DH[A-Z0-9]{8,14}/i, /FT[A-Z0-9]{8,14}/i],
      referencePatterns: [/DH[A-Z0-9]{8,14}/i],
      accountPatterns: [/[0-9]{13}/],
      phonePatterns: [/^(?:\+251|251|0)?9[0-9]{8}$/, /^(?:\+251|251|0)?7[0-9]{8}$/],
      smsPatterns: [
        /cbebirr/i,
        /cbe birr/i,
      ],
      ussdPatterns: [/\*847\#/i, /cbe birr transaction/i],
      verificationMethods: ["QR", "RECEIPT_URL", "TRANSACTION_ID", "OFFICIAL_PORTAL", "SMS"],
      requiredFields: ["amount", "transactionId"],
      optionalFields: ["senderName", "receiverName", "date"],
      supportsQR: true,
      supportsSMS: true,
      supportsUSSD: true,
      supportsOfficialVerification: true,
      buildVerificationUrl: (tx) => {
        if (!tx.transactionId) return null;
        return `https://cbepay1.cbe.com.et/aureceipt?TID=${tx.transactionId}`;
      },
    });

    // 2. Telebirr (Ethio Telecom)
    this.registerProvider({
      id: "telebirr",
      name: "Telebirr",
      adapter: new TelebirrProviderAdapter(),
      aliases: ["telebirr", "ethio telecom", "ethiotelecom", "tele birr"],
      officialDomains: [
        "ethiotelecom.et",
        "transactioninfo.ethiotelecom.et",
        "telebirr.et",
        "www.ethiotelecom.et",
      ],
      verificationDomains: ["transactioninfo.ethiotelecom.et"],
      identifierTypes: ["TRANSACTION_ID", "TOKEN"],
      txIdPatterns: [/[A-Z0-9]{10,16}/i, /TLB[A-Z0-9]{8,12}/i],
      referencePatterns: [/[A-Z0-9]{10,16}/i],
      accountPatterns: [/^(?:\+251|251|0)?9[0-9]{8}$/, /^(?:\+251|251|0)?7[0-9]{8}$/],
      phonePatterns: [/^(?:\+251|251|0)?9[0-9]{8}$/, /^(?:\+251|251|0)?7[0-9]{8}$/],
      smsPatterns: [
        /you have paid ETB/i,
        /you have received ETB/i,
        /telebirr transfer/i,
        /transaction id:?\s*([a-z0-9]+)/i,
      ],
      ussdPatterns: [/\*127\#/i, /telebirr/i],
      verificationMethods: ["QR", "RECEIPT_URL", "TRANSACTION_ID", "OFFICIAL_PORTAL", "SMS", "USSD"],
      requiredFields: ["amount", "receiverName", "transactionId"],
      optionalFields: ["senderName", "senderPhone", "date"],
      supportsQR: true,
      supportsSMS: true,
      supportsUSSD: true,
      supportsOfficialVerification: true,
      buildVerificationUrl: (tx) => {
        if (!tx.transactionId) return null;
        return `https://transactioninfo.ethiotelecom.et/receipt/${tx.transactionId}`;
      },
    });

    // 3. Dashen Bank (Amole / IPSS)
    this.registerProvider({
      id: "dashen",
      name: "Dashen Bank",
      adapter: new DashenProviderAdapter(),
      aliases: ["dashen", "dashen bank", "amole", "ipss", "dashenbank"],
      officialDomains: [
        "dashenbanksc.com",
        "receipts.dashenbanksc.com",
        "dashenbank.com.et",
        "ibank.dashenbank.com.et",
        "www.dashenbanksc.com",
        "www.dashenbank.com.et",
      ],
      verificationDomains: ["receipts.dashenbanksc.com", "ibank.dashenbank.com.et"],
      identifierTypes: ["TRANSACTION_ID", "REFERENCE"],
      txIdPatterns: [/DSH[A-Z0-9]{8,14}/i, /[0-9]{10,16}/],
      referencePatterns: [/REF[A-Z0-9]{8,14}/i],
      accountPatterns: [/50[0-9]{11}/, /[0-9]{13}/],
      phonePatterns: [/^(?:\+251|251|0)?9[0-9]{8}$/],
      smsPatterns: [/dashen bank/i, /amole/i, /transfer of etb/i],
      ussdPatterns: [/\*996\#/i, /amole/i],
      verificationMethods: ["QR", "RECEIPT_URL", "TRANSACTION_ID", "OFFICIAL_PORTAL", "SMS"],
      requiredFields: ["amount", "transactionId"],
      optionalFields: ["senderName", "receiverName"],
      supportsQR: true,
      supportsSMS: true,
      supportsUSSD: true,
      supportsOfficialVerification: true,
      buildVerificationUrl: (tx) => {
        if (!tx.transactionId) return null;
        return `https://receipts.dashenbanksc.com/verify/${tx.transactionId}`;
      },
    });

    // 4. Bank of Abyssinia (BoA / Apollo)
    this.registerProvider({
      id: "abyssinia",
      name: "Bank of Abyssinia",
      adapter: new AbyssiniaProviderAdapter(),
      aliases: ["abyssinia", "bank of abyssinia", "boa", "apollo", "boabank"],
      officialDomains: [
        "bankofabyssinia.com",
        "boabank.com.et",
        "apollo.bankofabyssinia.com",
        "www.bankofabyssinia.com",
        "www.boabank.com.et",
      ],
      verificationDomains: ["apollo.bankofabyssinia.com"],
      identifierTypes: ["TRANSACTION_ID", "REFERENCE"],
      txIdPatterns: [/BOA[A-Z0-9]{8,14}/i, /[0-9]{10,16}/],
      referencePatterns: [/REF[A-Z0-9]{8,14}/i],
      accountPatterns: [/1[0-9]{12}/],
      phonePatterns: [/^(?:\+251|251|0)?9[0-9]{8}$/],
      smsPatterns: [/bank of abyssinia/i, /boa alert/i, /apollo/i],
      ussdPatterns: [/\*815\#/i, /abyssinia/i],
      verificationMethods: ["QR", "RECEIPT_URL", "TRANSACTION_ID", "OFFICIAL_PORTAL", "SMS"],
      requiredFields: ["amount", "transactionId"],
      optionalFields: ["senderName", "receiverName"],
      supportsQR: true,
      supportsSMS: true,
      supportsUSSD: true,
      supportsOfficialVerification: true,
      buildVerificationUrl: (tx) => {
        if (!tx.transactionId) return null;
        return `https://apollo.bankofabyssinia.com/receipt/${tx.transactionId}`;
      },
    });

    // 5. Awash Bank (Awash Birr / AwashPay)
    this.registerProvider({
      id: "awash",
      name: "Awash Bank",
      adapter: new AwashProviderAdapter(),
      aliases: ["awash", "awash bank", "awash birr", "awashpay", "awashbank"],
      officialDomains: [
        "awashbank.com",
        "awashbank.com.et",
        "awashpay.awashbank.com",
        "ib.awashbank.com",
        "www.awashbank.com",
        "www.awashbank.com.et",
      ],
      verificationDomains: ["awashpay.awashbank.com", "ib.awashbank.com"],
      identifierTypes: ["TRANSACTION_ID", "REFERENCE"],
      txIdPatterns: [/AWS[A-Z0-9]{8,14}/i, /[0-9]{10,16}/],
      referencePatterns: [/REF[A-Z0-9]{8,14}/i],
      accountPatterns: [/013[0-9]{10}/, /[0-9]{13}/],
      phonePatterns: [/^(?:\+251|251|0)?9[0-9]{8}$/],
      smsPatterns: [/awash bank/i, /awash birr/i, /awashpay/i],
      ussdPatterns: [/\*901\#/i, /awash birr/i],
      verificationMethods: ["QR", "RECEIPT_URL", "TRANSACTION_ID", "OFFICIAL_PORTAL", "SMS"],
      requiredFields: ["amount", "transactionId"],
      optionalFields: ["senderName", "receiverName"],
      supportsQR: true,
      supportsSMS: true,
      supportsUSSD: true,
      supportsOfficialVerification: true,
      buildVerificationUrl: (tx) => {
        if (!tx.transactionId) return null;
        return `https://awashpay.awashbank.com/verify/${tx.transactionId}`;
      },
    });

    // 6. Zemen Bank
    this.registerProvider({
      id: "zemen",
      name: "Zemen Bank",
      adapter: new ZemenProviderAdapter(),
      aliases: ["zemen", "zemen bank", "zemenbank"],
      officialDomains: [
        "zemenbank.com",
        "zemenbank.com.et",
        "www.zemenbank.com",
        "www.zemenbank.com.et",
      ],
      verificationDomains: ["zemenbank.com.et"],
      identifierTypes: ["TRANSACTION_ID", "REFERENCE"],
      txIdPatterns: [/ZMN[A-Z0-9]{8,14}/i, /[0-9]{10,16}/],
      referencePatterns: [/REF[A-Z0-9]{8,14}/i],
      accountPatterns: [/[0-9]{12,14}/],
      phonePatterns: [/^(?:\+251|251|0)?9[0-9]{8}$/],
      smsPatterns: [/zemen bank/i],
      ussdPatterns: [/\*896\#/i],
      verificationMethods: ["QR", "RECEIPT_URL", "TRANSACTION_ID", "OFFICIAL_PORTAL", "SMS"],
      requiredFields: ["amount", "transactionId"],
      optionalFields: ["senderName", "receiverName"],
      supportsQR: true,
      supportsSMS: true,
      supportsUSSD: true,
      supportsOfficialVerification: true,
    });

    // 7. Safaricom M-Pesa
    this.registerProvider({
      id: "m-pesa",
      name: "Safaricom M-Pesa",
      adapter: new MpesaProviderAdapter(),
      aliases: ["m-pesa", "mpesa", "safaricom m-pesa", "safaricom ethiopia"],
      officialDomains: [
        "mpesa.safaricom.et",
        "m-pesabusiness.safaricom.et",
        "safaricom.et",
        "www.safaricom.et",
      ],
      verificationDomains: ["mpesa.safaricom.et"],
      identifierTypes: ["TRANSACTION_ID", "REFERENCE"],
      txIdPatterns: [/[A-Z0-9]{10}/i],
      referencePatterns: [/[A-Z0-9]{10}/i],
      accountPatterns: [/^(?:\+251|251|0)?7[0-9]{8}$/],
      phonePatterns: [/^(?:\+251|251|0)?7[0-9]{8}$/],
      smsPatterns: [/m-pesa/i, /confirmed\. etb/i, /received etb/i],
      ussdPatterns: [/\*733\#/i, /m-pesa/i],
      verificationMethods: ["QR", "RECEIPT_URL", "TRANSACTION_ID", "OFFICIAL_PORTAL", "SMS"],
      requiredFields: ["amount", "transactionId", "receiverName"],
      optionalFields: ["senderName", "senderPhone"],
      supportsQR: true,
      supportsSMS: true,
      supportsUSSD: true,
      supportsOfficialVerification: true,
    });
  }
}

export const providerRegistry = ProviderRegistry.getInstance();
