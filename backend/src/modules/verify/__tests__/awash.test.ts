import { detectBankFromText, parseReceiptWithBankRules } from "../bank-rules.js";
import { parseSmsText } from "../sms-parser.js";
import { crossValidate } from "../cross-validator.js";
import { AwashProviderAdapter } from "../adapters/awash.adapter.js";

// =========================================================
// Awash Bank Verification Test Suite
// =========================================================

function runTests() {
  console.log("=========================================================");
  console.log("🧪 Running Awash Bank Receipt Verification Unit Tests...");
  console.log("=========================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASSED: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAILED: ${testName}`);
      failed++;
    }
  }

  // ---------------------------------------------------------
  // Test 1: Provider Detection for Awash Bank
  // ---------------------------------------------------------
  console.log("📌 Test Suite 1: Provider Detection");
  
  const smsText1 = `Dear Customer , You have transferred to other bank ETB 3,500 To 1000134688096 (MR AMANUEL ANDEMO ANGELLO) In Commercial Bank of Ethiopia with charge of 21.00 VAT: 3.15 EDRRF 1.05 ETB. Your available Balance is ETB 3,035.51. Receipt Link: https://awashpay.awashbank.com:8225/-2KG5LIZ3WK-5HXA7R. Contact Center 8980.`;
  assert(detectBankFromText(smsText1) === "awash", "Detect Awash Bank from SMS text view");

  const appViewText1 = `
    AwashBank
    Transaction Successful
    Transaction Time 2026-08-08 12:36:07 PM
    Transaction Type IPS Bank Transfer
    Amount 3500 ETB
    Charge 21.00 ETB
    VAT 3.15 ETB
    EDRRF 1.05 ETB
    Sender Name AMANUEL ANDEMO ANGELO
    Sender Account 01320*******500
    Beneficiary name MR AMANUEL ANDEMO ANGELLO
    Beneficiary Account 1000134688096
    Beneficiary Bank Commercial Bank of Ethiopia
    Reason Me
    Transaction ID 260808123683972
    Thank you for banking with us
  `;
  assert(detectBankFromText(appViewText1) === "awash", "Detect Awash Bank from App Confirmation View");

  // ---------------------------------------------------------
  // Test 2: Message / SMS View Parsing Accuracy
  // ---------------------------------------------------------
  console.log("\n📌 Test Suite 2: Message / SMS View Extraction");

  const smsParsed = parseSmsText(smsText1);
  assert(smsParsed !== null, "SMS parser returns normalized transaction");
  assert(smsParsed?.provider === "awash", "SMS provider is 'awash'");
  assert(smsParsed?.transactionId === "-2KG5LIZ3WK-5HXA7R", "Extracted transaction token from receipt link: -2KG5LIZ3WK-5HXA7R");
  assert(smsParsed?.amount === 3500, "Extracted amount: 3500 ETB");
  assert(smsParsed?.receiver?.account === "1000134688096", "Extracted receiver account: 1000134688096");
  assert(smsParsed?.receiver?.name === "MR AMANUEL ANDEMO ANGELLO", "Extracted receiver name: MR AMANUEL ANDEMO ANGELLO");
  assert(smsParsed?.receiptUrl === "https://awashpay.awashbank.com:8225/-2KG5LIZ3WK-5HXA7R", "Extracted receipt URL");

  // ---------------------------------------------------------
  // Test 3: App Confirmation View Parsing Accuracy
  // ---------------------------------------------------------
  console.log("\n📌 Test Suite 3: App Confirmation View Extraction");

  const appParsed = parseReceiptWithBankRules(appViewText1, "awash");
  assert(appParsed.transactionId === "260808123683972", "Extracted 15-digit Transaction ID: 260808123683972");
  assert(appParsed.amount === 3500, "Extracted base amount: 3500 ETB");
  assert(appParsed.fees === 25.20, "Calculated total fee sum (21.00 + 3.15 + 1.05): 25.20 ETB");
  assert(appParsed.totalAmount === 3525.20, "Calculated total amount debited (3500 + 25.20): 3525.20 ETB");
  assert(appParsed.senderName === "AMANUEL ANDEMO ANGELO", "Extracted sender name: AMANUEL ANDEMO ANGELO");
  assert(appParsed.senderAccount === "01320*******500", "Extracted sender account: 01320*******500");
  assert(appParsed.receiverName === "MR AMANUEL ANDEMO ANGELLO", "Extracted beneficiary name: MR AMANUEL ANDEMO ANGELLO");
  assert(appParsed.receiverAccount === "1000134688096", "Extracted beneficiary account: 1000134688096");
  assert(appParsed.date === "2026-08-08", "Extracted date: 2026-08-08");
  assert(appParsed.time === "12:36:07 PM", "Extracted time: 12:36:07 PM");

  // ---------------------------------------------------------
  // Test 4: Cross-Validation Between App View & Portal/SMS Data
  // ---------------------------------------------------------
  console.log("\n📌 Test Suite 4: Cross-Validation & Fuzzy Name Matching");

  const crossVal = crossValidate(
    {
      status: "APPROVED",
      confidence: 95,
      transactionId: appParsed.transactionId,
      senderName: appParsed.senderName,
      receiverName: appParsed.receiverName,
      amount: appParsed.amount,
      currency: "ETB",
      date: appParsed.date,
      time: appParsed.time,
      paymentMethod: appParsed.paymentMethod,
      reasons: [],
      warnings: [],
    },
    {
      isValid: true,
      providerId: "awash",
      transactionId: "260808123683972",
      amount: 3500,
      senderName: "AMANUEL ANDEMO ANGELO",
      receiverName: "MR AMANUEL ANDEMO ANGELLO",
      date: "2026-08-08",
      status: "SUCCESS",
    }
  );

  assert(crossVal.overallMatch === "MATCH", "Cross-validation result: MATCH");
  assert(crossVal.crossValidationScore >= 95, `Cross-validation score >= 95% (Actual: ${crossVal.crossValidationScore}%)`);

  // ---------------------------------------------------------
  // Test 5: Awash Provider Adapter Evidence Detection
  // ---------------------------------------------------------
  console.log("\n📌 Test Suite 5: Adapter Evidence Detection");

  const adapter = new AwashProviderAdapter();
  adapter.detectEvidence({ text: smsText1 }).then((ev) => {
    assert(ev.isSupported && ev.confidence >= 0.85, "Adapter supports SMS view evidence");
  });

  adapter.detectEvidence({ text: appViewText1 }).then((ev) => {
    assert(ev.isSupported && ev.confidence >= 0.85, "Adapter supports App view evidence");
  });

  // ---------------------------------------------------------
  // Test 6: Regression Verification (CBE, Telebirr, Dashen)
  // ---------------------------------------------------------
  console.log("\n📌 Test Suite 6: Provider Regression Checks");

  assert(detectBankFromText("Commercial Bank of Ethiopia FT2408089901") === "cbe", "CBE detection intact");
  assert(detectBankFromText("telebirr transfer ETB 100 to 0911000000") === "telebirr", "Telebirr detection intact");
  assert(detectBankFromText("Dashen Bank transfer of ETB 500") === "dashen", "Dashen detection intact");

  setTimeout(() => {
    console.log("\n=========================================================");
    console.log(`📊 Test Execution Completed: ${passed} Passed, ${failed} Failed`);
    console.log("=========================================================");
    if (failed > 0) {
      process.exit(1);
    }
  }, 500);
}

runTests();
