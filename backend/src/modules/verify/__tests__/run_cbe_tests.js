import { detectBankFromText, parseReceiptWithBankRules } from "../bank-rules.ts";
import { parseSmsText } from "../sms-parser.ts";
import { validateDomain } from "../domain-validator.ts";
import { extractReceiptUrl } from "../url-extractor.ts";
import { crossValidate } from "../cross-validator.ts";

console.log("=========================================================");
console.log("🧪 Running Commercial Bank of Ethiopia (CBE) Unit Tests...");
console.log("=========================================================\n");

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ PASSED: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAILED: ${testName}`);
    failed++;
  }
}

// ---------------------------------------------------------
// Test Suite 1: Provider & Domain Detection for CBE
// ---------------------------------------------------------
console.log("📌 Test Suite 1: Provider & Domain Detection");

const smsTextCbe = `Dear Amanuel Andemo Angello You have successfully transferred ETB1000.00 from account 1********8096 to account 1********2413 (Eyerusalem Tadesse Sharew). Service charge of ETB 0.50 and VAT(15%) of ETB0.08 and Disaster Recovery(5%) of 0.03 with total of ETB1000.61 .Your current balance is ETB4,545.04. Thanks for Banking with CBE. https://mbreciept.cbe.com.et/v2-hfHCxzlAwgxjxvG2iOhP`;

const appTextCbe = `
  Transaction Summary
  You have sucessfully transferred 300 ETB from your account 1********8096 Amanuel Andemo Angello for KALEAB MEBRATU HAILESELASSIE with Dashen Bank account number 5********6011 . on Aug 11, 2026 03:46 PM with Transaction ID: FT26223JLSYC. Remark: friend .
  Total Amount Debited: 307.38 ETB with Service Charge of ETB6.20, VAT (15%) of ETB0.93 and Disaster Recovery (5%) of ETB0.25.
  Commercial Bank of Ethiopia
  The bank you can always rely on!
`;

assert(detectBankFromText(smsTextCbe) === "cbe", "Detect CBE from SMS Screenshot Text (Image 1)");
assert(detectBankFromText(appTextCbe) === "cbe", "Detect CBE from Mobile App Confirmation Screen (Image 2)");

const cbeUrl = "https://mbreciept.cbe.com.et/v2-hfHCxzlAwgxjxvG2iOhP";
const domainVal = validateDomain(cbeUrl, "cbe");
assert(domainVal.isTrusted === true, "mbreciept.cbe.com.et is recognized as trusted domain");
assert(domainVal.hasBankMismatch === false, "No bank mismatch for mbreciept.cbe.com.et");
assert(domainVal.riskPenalty === 0, "Zero risk penalty for official CBE URL");

const extractedUrlObj = extractReceiptUrl(smsTextCbe);
assert(extractedUrlObj !== null, "Extract receipt URL object from SMS text");
assert(extractedUrlObj?.url === "https://mbreciept.cbe.com.et/v2-hfHCxzlAwgxjxvG2iOhP", "Extracted full CBE receipt URL");
assert(extractedUrlObj?.provider === "cbe", "Extracted provider is 'cbe'");

// ---------------------------------------------------------
// Test Suite 2: CBE Mobile Banking SMS Screenshot Parsing (Image 1)
// ---------------------------------------------------------
console.log("\n📌 Test Suite 2: CBE Mobile Banking SMS Extraction (Image 1)");

const smsRulesParsed = parseReceiptWithBankRules(smsTextCbe, "cbe");

assert(smsRulesParsed.senderName === "Amanuel Andemo Angello", `Sender Name extracted: "${smsRulesParsed.senderName}" (Expected: Amanuel Andemo Angello)`);
assert(smsRulesParsed.senderAccount === "1********8096", `Sender Account extracted: "${smsRulesParsed.senderAccount}" (Expected: 1********8096)`);
assert(smsRulesParsed.receiverName === "Eyerusalem Tadesse Sharew", `Receiver Name extracted: "${smsRulesParsed.receiverName}" (Expected: Eyerusalem Tadesse Sharew)`);
assert(smsRulesParsed.receiverAccount === "1********2413", `Receiver Account extracted: "${smsRulesParsed.receiverAccount}" (Expected: 1********2413)`);
assert(smsRulesParsed.amount === 1000, `Base Amount extracted: ${smsRulesParsed.amount} (Expected: 1000)`);
assert(Math.abs((smsRulesParsed.fees ?? 0) - 0.61) < 0.01, `Total Fee Sum extracted: ${smsRulesParsed.fees} (Expected: 0.61)`);
assert(smsRulesParsed.totalAmount === 1000.61, `Total Amount Debited extracted: ${smsRulesParsed.totalAmount} (Expected: 1000.61)`);
assert(smsRulesParsed.transactionId === "v2-hfHCxzlAwgxjxvG2iOhP", `Receipt ID / Token extracted: "${smsRulesParsed.transactionId}" (Expected: v2-hfHCxzlAwgxjxvG2iOhP)`);

// ---------------------------------------------------------
// Test Suite 3: CBE Mobile App Screen Parsing (Image 2)
// ---------------------------------------------------------
console.log("\n📌 Test Suite 3: CBE Mobile App Screen Extraction (Image 2)");

const appRulesParsed = parseReceiptWithBankRules(appTextCbe, "cbe");

assert(appRulesParsed.transactionId === "FT26223JLSYC", `Transaction ID extracted: "${appRulesParsed.transactionId}" (Expected: FT26223JLSYC)`);
assert(appRulesParsed.amount === 300, `Base Amount extracted: ${appRulesParsed.amount} (Expected: 300)`);
assert(appRulesParsed.senderName === "Amanuel Andemo Angello", `Sender Name extracted: "${appRulesParsed.senderName}" (Expected: Amanuel Andemo Angello)`);
assert(appRulesParsed.senderAccount === "1********8096", `Sender Account extracted: "${appRulesParsed.senderAccount}" (Expected: 1********8096)`);
assert(appRulesParsed.receiverName === "KALEAB MEBRATU HAILESELASSIE", `Receiver Name extracted: "${appRulesParsed.receiverName}" (Expected: KALEAB MEBRATU HAILESELASSIE)`);
assert(appRulesParsed.receiverAccount === "5********6011", `Receiver Account extracted: "${appRulesParsed.receiverAccount}" (Expected: 5********6011)`);
assert(Math.abs((appRulesParsed.fees ?? 0) - 7.38) < 0.01, `Total Fees (6.20 + 0.93 + 0.25) extracted: ${appRulesParsed.fees} (Expected: 7.38)`);
assert(appRulesParsed.totalAmount === 307.38, `Total Amount Debited extracted: ${appRulesParsed.totalAmount} (Expected: 307.38)`);
assert(appRulesParsed.date === "Aug 11, 2026", `Date extracted: "${appRulesParsed.date}" (Expected: Aug 11, 2026)`);
assert(appRulesParsed.time === "03:46 PM", `Time extracted: "${appRulesParsed.time}" (Expected: 03:46 PM)`);

// ---------------------------------------------------------
// Test Suite 4: SMS Parser Module Verification
// ---------------------------------------------------------
console.log("\n📌 Test Suite 4: SMS Parser Module Integration");

const smsAdapterParsed = parseSmsText(smsTextCbe);
assert(smsAdapterParsed !== null, "parseSmsText returned object");
assert(smsAdapterParsed?.provider === "cbe", "SMS provider is 'cbe'");
assert(smsAdapterParsed?.amount === 1000, "SMS parsed amount: 1000");
assert(smsAdapterParsed?.sender?.name === "Amanuel Andemo Angello", "SMS parsed sender: Amanuel Andemo Angello");
assert(smsAdapterParsed?.receiver?.name === "Eyerusalem Tadesse Sharew", "SMS parsed receiver: Eyerusalem Tadesse Sharew");
assert(smsAdapterParsed?.receiver?.account === "1********2413", "SMS parsed receiver account: 1********2413");

// ---------------------------------------------------------
// Test Suite 5: Cross-Validation
// ---------------------------------------------------------
console.log("\n📌 Test Suite 5: Cross-Validation Engine");

const crossVal = crossValidate(
  {
    status: "APPROVED",
    confidence: 98,
    transactionId: appRulesParsed.transactionId,
    senderName: appRulesParsed.senderName,
    receiverName: appRulesParsed.receiverName,
    amount: appRulesParsed.amount,
    currency: "ETB",
    date: appRulesParsed.date,
    time: appRulesParsed.time,
    paymentMethod: appRulesParsed.paymentMethod,
    reasons: [],
    warnings: [],
  },
  {
    isValid: true,
    providerId: "cbe",
    transactionId: "FT26223JLSYC",
    amount: 300,
    senderName: "Amanuel Andemo Angello",
    receiverName: "KALEAB MEBRATU HAILESELASSIE",
    date: "Aug 11, 2026",
    status: "SUCCESS",
  }
);

assert(crossVal.overallMatch === "MATCH", `Cross-validation result: ${crossVal.overallMatch}`);
assert(crossVal.crossValidationScore >= 95, `Cross-validation score >= 95% (Actual: ${crossVal.crossValidationScore}%)`);

// ---------------------------------------------------------
// Test Suite 6: CBE Official PDF Document Structure Parsing (Image 1 PDF)
// ---------------------------------------------------------
console.log("\n📌 Test Suite 6: CBE Official PDF Receipt Document Structure");

const pdfReceiptText = `
Commercial Bank of Ethiopia
Customer Receipt
Status: COMPLETED
Company Address & Other Information
Country: Ethiopia
City: Addis Ababa
Address: Ras Desta Damtew St, 01, Kirkos
Postal code: 255
SWIFT Code: CBETETAA
Email: info@cbe.com.et
Tel: +251-551-50-04
Fax: +251-551-45-22
Tfn: 0000006966
VAT Receipt No: FT262281DKN0
VAT Registration No: 011140
VAT Registration Date: 01/01/2003
Customer Information
Customer Name: Amanuel Andemo Angello
Region: -
City: -
Sub City: -
Wereda/Kebele: -
VAT Registration No: -
VAT Registration Date: -
TIN (TAX ID): -
Branch: -
Amount in Word:
Two Hundred Fifty ETB and Sixty One cents
Payment / Transaction Information
Payer: Amanuel Andemo Angello
Account: 1****8096
Receiver: Revel Trading Plc
Account: 1****3588
Payment Type: A2A
Payment Date & Time: Aug 16, 2026, 6:35 PM
Reference No. (VAT Invoice No): FT262281DKN0
Reason / Type of service: MB Transfer
Transferred Amount: 250.00 ETB
Service Charge: 0.50 ETB
VAT (15%): 0.08 ETB
Disaster Recovery (5%): 0.03 ETB
Total amount debited from customer's account: 250.61 ETB
`;

const pdfRulesParsed = parseReceiptWithBankRules(pdfReceiptText, "cbe");

assert(pdfRulesParsed.transactionId === "FT262281DKN0", `PDF TxId extracted: "${pdfRulesParsed.transactionId}" (Expected: FT262281DKN0)`);
assert(pdfRulesParsed.amount === 250, `PDF Transferred Amount: ${pdfRulesParsed.amount} (Expected: 250)`);
assert(Math.abs((pdfRulesParsed.fees ?? 0) - 0.61) < 0.01, `PDF Total Fees: ${pdfRulesParsed.fees} (Expected: 0.61)`);
assert(pdfRulesParsed.totalAmount === 250.61, `PDF Total Amount Debited: ${pdfRulesParsed.totalAmount} (Expected: 250.61)`);
assert(pdfRulesParsed.senderName === "Amanuel Andemo Angello", `PDF Payer Name: "${pdfRulesParsed.senderName}" (Expected: Amanuel Andemo Angello)`);
assert(pdfRulesParsed.senderAccount === "1****8096", `PDF Sender Account: "${pdfRulesParsed.senderAccount}" (Expected: 1****8096)`);
assert(pdfRulesParsed.receiverName === "Revel Trading Plc", `PDF Receiver Name: "${pdfRulesParsed.receiverName}" (Expected: Revel Trading Plc)`);
assert(pdfRulesParsed.receiverAccount === "1****3588", `PDF Receiver Account: "${pdfRulesParsed.receiverAccount}" (Expected: 1****3588)`);

const pdfCrossVal = crossValidate(
  {
    status: "APPROVED",
    confidence: 99,
    transactionId: pdfRulesParsed.transactionId,
    senderName: pdfRulesParsed.senderName,
    receiverName: pdfRulesParsed.receiverName,
    amount: pdfRulesParsed.amount,
    currency: "ETB",
    date: pdfRulesParsed.date,
    time: pdfRulesParsed.time,
    paymentMethod: pdfRulesParsed.paymentMethod,
    reasons: [],
    warnings: [],
  },
  {
    isValid: true,
    providerId: "cbe",
    transactionId: "FT262281DKN0",
    amount: 250,
    totalAmount: 250.61,
    fees: 0.61,
    senderName: "Amanuel Andemo Angello",
    senderAccount: "1****8096",
    receiverName: "Revel Trading Plc",
    receiverAccount: "1****3588",
    date: "2026-08-16T18:35:00.000Z",
    status: "COMPLETED",
  }
);

assert(pdfCrossVal.overallMatch === "MATCH", `PDF Cross-Validation: ${pdfCrossVal.overallMatch}`);
assert(pdfCrossVal.crossValidationScore >= 99, `PDF Verification Accuracy: ${pdfCrossVal.crossValidationScore}% (Target: >=99%)`);

// Verify all field matches carry non-null AI and URL verified values
for (const match of pdfCrossVal.fieldMatches) {
  assert(match.aiValue !== null && match.aiValue !== undefined && match.aiValue !== "", `Field ${match.field} AI value populated: ${match.aiValue}`);
  assert(match.scrapedValue !== null && match.scrapedValue !== undefined && match.scrapedValue !== "", `Field ${match.field} URL value populated: ${match.scrapedValue}`);
  assert(match.matches === true, `Field ${match.field} matches: ${match.matches}`);
}

// ---------------------------------------------------------
// Test Suite 7: CBE Inter Bank Transfer Format (Image 2 Web Portal)
// ---------------------------------------------------------
console.log("\n📌 Test Suite 7: CBE Inter-Bank Account Transfer Parsing");

const interBankReceiptText = `
Commercial Bank of Ethiopia
Customer Receipt
Status: SUCCESS
Company Address & Other Information
Country: Ethiopia
City: Addis Ababa
Address: Ras Desta Damtew St, 01, Kirkos
Postal code: 255
SWIFT Code: CBETETAA
Email: info@cbe.com.et
Tel: +251-551-50-04
Fax: +251-551-45-22
Tin: 0000006966
VAT Receipt No: FT26228MBXTY
VAT Registration No: 011140
VAT Registration Date: 01/01/2003
Payment / Transaction Informations
Payer: Amanuel Andemo Angello
Account: 1****8096
Receiver: Inter Bank Account To Account Paya
Account: E****0162
Payment Type: BANK_TRANSFER
Payment Date & Time: Aug 16, 2026, 11:34 AM
Reference No. (VAT Invoice No): FT26228MBXTY
Reason / Type of service: 5795666726011
Transferred Amount: 400.00 ETB
Service Charge: 6.52 ETB
VAT (15%): 0.99 ETB
Disaster Recovery (5%): 0.33 ETB
Total amount debited from customer's account: 407.84 ETB
Amount in Word: Four Hundred Seven ETB and Eighty Four cents
`;

const ibParsed = parseReceiptWithBankRules(interBankReceiptText, "cbe");

assert(ibParsed.transactionId === "FT26228MBXTY", `InterBank TxId extracted: "${ibParsed.transactionId}" (Expected: FT26228MBXTY)`);
assert(ibParsed.amount === 400, `InterBank Transferred Amount: ${ibParsed.amount} (Expected: 400)`);
assert(Math.abs((ibParsed.fees ?? 0) - 7.84) < 0.01, `InterBank Total Fees: ${ibParsed.fees} (Expected: 7.84)`);
assert(ibParsed.totalAmount === 407.84, `InterBank Total Amount Debited: ${ibParsed.totalAmount} (Expected: 407.84)`);
assert(ibParsed.senderName === "Amanuel Andemo Angello", `InterBank Payer Name: "${ibParsed.senderName}" (Expected: Amanuel Andemo Angello)`);
assert(ibParsed.senderAccount === "1****8096", `InterBank Sender Account: "${ibParsed.senderAccount}" (Expected: 1****8096)`);
assert(ibParsed.receiverName === "Inter Bank Account To Account Paya", `InterBank Receiver Name: "${ibParsed.receiverName}" (Expected: Inter Bank Account To Account Paya)`);
assert(ibParsed.receiverAccount === "E****0162", `InterBank Receiver Account: "${ibParsed.receiverAccount}" (Expected: E****0162)`);

console.log("\n=========================================================");
console.log(`📊 Test Execution Completed: ${passed} Passed, ${failed} Failed`);
console.log("=========================================================");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}

