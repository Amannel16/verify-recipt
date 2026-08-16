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

console.log("\n=========================================================");
console.log(`📊 Test Execution Completed: ${passed} Passed, ${failed} Failed`);
console.log("=========================================================");

if (failed > 0) {
  process.exit(1);
}
