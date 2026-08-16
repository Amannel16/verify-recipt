import React, { useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "@/hooks/useColors";
import { useLanguage } from "@/contexts/LanguageContext";

interface PolicySection {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  titleEn: string;
  titleAm: string;
  badgeEn?: string;
  badgeAm?: string;
  contentEn: string;
  contentAm: string;
  bulletPointsEn?: string[];
  bulletPointsAm?: string[];
}

const POLICY_SECTIONS: PolicySection[] = [
  {
    id: "overview",
    icon: "shield-checkmark-outline",
    titleEn: "1. Overview & Commitment to Privacy",
    titleAm: "1. አጠቃላይ እይታ እና የግላዊነት ቃል ኪዳን",
    badgeEn: "Core Policy",
    badgeAm: "ዋና ፖሊሲ",
    contentEn:
      "At Geba AI, we believe financial data privacy is a fundamental right. This Privacy Policy outlines how our Ethiopian Bank Receipt Verification Platform collects, encrypts, and processes data when you use our mobile app, API services, and web dashboard. We never monetize or sell personal or business financial data to third-party advertisers.",
    contentAm:
      "በገባ ኤአይ የፋይናንስ መረጃ ግላዊነት መሰረታዊ መብት እንደሆነ እናምናለን። ይህ የግላዊነት ፖሊሲ የኢትዮጵያ ባንክ ደረሰኝ ማረጋገጫ መድረካችን የመተግበሪያውን፣ የኤፒአይ አገልግሎቶችን እና የድር ዳሽቦርድን ሲጠቀሙ መረጃን እንዴት እንደሚሰበስብ፣ እንደሚስጥር እና እንደሚሰራ ያብራራል። የግል ወይም የንግድ መረጃዎችን ለሶስተኛ ወገን ማስታወቂያ ሰሪዎች አንሸጥም።",
  },
  {
    id: "data-collection",
    icon: "document-text-outline",
    titleEn: "2. Data We Collect & Process",
    titleAm: "2. የምንሰበስበው እና የምንሰራው መረጃ",
    badgeEn: "Data Transparency",
    badgeAm: "የመረጃ ግልጽነት",
    contentEn:
      "To verify Ethiopian bank receipts and detect transaction fraud, we collect only the necessary technical and financial data:",
    contentAm:
      "የኢትዮጵያ ባንክ ደረሰኞችን ለማረጋገጥ እና የፋይናንስ ማጭበርበርን ለመከላከል አስፈላጊ የሆኑ ቴክኒካዊ እና ፋይናንሳዊ መረጃዎችን ብቻ እንሰበስባለን፡",
    bulletPointsEn: [
      "Receipt Images & Scans: Uploaded images of CBE, Dashen, Telebirr, BoA, Awash, Zemen, and M-Pesa transaction slips.",
      "Extracted Receipt Metadata: Transaction Reference Numbers, Payer/Payee Names, Amount (ETB), Date, and Branch codes.",
      "Account Credentials: Encrypted authentication tokens, email address, phone number, and organization details.",
      "Device & Diagnostic Metrics: App version, OS type, IP address, and encrypted audit logs for security detection.",
    ],
    bulletPointsAm: [
      "የደረሰኝ ምስሎች፡ የተሰቀሉ የCBE፣ Dashen፣ Telebirr፣ BoA፣ Awash፣ Zemen እና M-Pesa ደረሰኝ ምስሎች።",
      "የተወሰደ የደረሰኝ መረጃ፡ የግብይት ማጣቀሻ ቁጥር (Ref Number)፣ የላኪ/ተቀባይ ስም፣ የገንዘብ መጠን፣ ቀን እና ቅርንጫፍ።",
      "የመለያ ዝርዝሮች፡ የተመሰጠሩ የምዝገባ መረጃዎች፣ ኢሜይል፣ የስልክ ቁጥር እና የድርጅት መረጃ።",
      "የመሳሪያ መረጃ፡ የመተግበሪያ ስሪት፣ የስርዓት ዓይነት፣ አይፒ አድራሻ እና የደህንነት ኦዲት ምዝግብ ማስታወሻዎች።",
    ],
  },
  {
    id: "ai-verification",
    icon: "hardware-chip-outline",
    titleEn: "3. How AI & Bank Adapters Handle Data",
    titleAm: "3. ኤአይ እና የባንክ አዳፕተሮች መረጃን እንዴት እንደሚሰሩ",
    badgeEn: "Bank-Grade AI",
    badgeAm: "የባንክ ደረጃ ኤአይ",
    contentEn:
      "Geba AI utilizes Gemini Vision OCR models combined with direct API provider registries (e.g. Abyssinia, Telebirr, CBE APIs) to validate transaction authenticity.",
    contentAm:
      "ገባ ኤአይ የግብይት እውነተኛነትን ለማረጋገጥ Gemini Vision OCR ሞዴሎችን ከተመረጡ የባንክ ኤፒአይዎች ጋር አዋህዶ ይጠቀማል።",
    bulletPointsEn: [
      "Zero AI Model Training on User Data: Your uploaded receipt images are analyzed statelessly and are never used to train public generative AI models.",
      "Isolated Provider Verification: Receipt reference queries are executed through secure, rate-limited bank integration channels.",
      "Automated Fraud Detection: Algorithmic checks analyze font anomalies, pixel tampering, duplicate reference reuse, and transaction timestamp mismatches.",
    ],
    bulletPointsAm: [
      "በተጠቃሚ መረጃ ላይ የኤአይ ስልጠና አይደረግም፡ የተሰቀሉ የደረሰኝ ምስሎች ለሕዝብ ኤአይ ሞዴሎች ማሰልጠኛነት አይውሉም።",
      "የተለየ የባንክ ማረጋገጫ፡ የደረሰኝ ማጣቀሻ ጥያቄዎች በተጠበቁ የባንክ ማገናኛዎች በኩል ይፈጸማሉ።",
      "የተማከለ የደህንነት ትንተና፡ አልጎሪዝሞች የፊደል ለውጦችን፣ የምስል ማጭበርበርን እና የደረሰኝ ድግግሞሽን ይመረምራሉ።",
    ],
  },
  {
    id: "security-encryption",
    icon: "lock-closed-outline",
    titleEn: "4. Data Security & Storage Standards",
    titleAm: "4. የመረጃ ደህንነት እና የምስጠራ ደረጃዎች",
    badgeEn: "AES-256 & TLS 1.3",
    badgeAm: "ከፍተኛ ደህንነት",
    contentEn:
      "We implement industry-leading security controls to prevent unauthorized data access, leakage, or loss:",
    contentAm:
      "ያልተፈቀደ የመረጃ መዳረሻን፣ መፍሰስን ወይም መጥፋትን ለመከላከል ከፍተኛ የደህንነት ቁጥጥሮችን እንተገብራለን፡",
    bulletPointsEn: [
      "Encryption in Transit: All client-server and API communications are strictly encrypted using TLS 1.3 protocol.",
      "Encryption at Rest: Receipt metadata and database entries are encrypted at rest using AES-256 standard.",
      "Role-Based Access Control (RBAC): Enterprise organization data is strictly isolated by enterprise IDs, branch permissions, and JWT auth scopes.",
    ],
    bulletPointsAm: [
      "በተላላፊነት ላይ ያለ ምስጠራ፡ ሁሉም የደንበኛ እና የአገልጋይ ግንኙነቶች በ TLS 1.3 ፕሮቶኮል የተጠበቁ ናቸው።",
      "በማከማቻ ላይ ያለ ምስጠራ፡ የደረሰኝ መረጃዎች እና የመረጃ ቋቶች በ AES-256 ደረጃ የተመሰጠሩ ናቸው።",
      "የተደራጀ የመዳረሻ ቁጥጥር (RBAC)፡ የኢንተርፕራይዝ መረጃዎች በድርጅት መታወቂያ እና ቅርንጫፍ ፈቃዶች የተከለሉ ናቸው።",
    ],
  },
  {
    id: "rights-deletion",
    icon: "trash-outline",
    titleEn: "5. User Data Rights & Permanent Erasure",
    titleAm: "5. የተጠቃሚ መብቶች እና የመረጃ ስረዛ",
    badgeEn: "Google Play Compliant",
    badgeAm: "ጉግል ፕሌይ ተስማሚ",
    contentEn:
      "Under Google Play Developer Policies and global privacy regulations (GDPR), you hold full ownership of your data.",
    contentAm:
      "በጉግል ፕሌይ አልሚ ፖሊሲዎች እና ዓለም አቀፍ የግላዊነት ደንቦች (GDPR) መሠረት በመረጃዎ ላይ ሙሉ ባለቤትነት አለዎት።",
    bulletPointsEn: [
      "Right to Access & Export: You can view complete transaction history and audit logs within your Geba AI dashboard at any time.",
      "Right to Permanent Deletion: You can request immediate, permanent deletion of your account, receipt history, and profile data.",
      "Self-Service Deletion URL: Web data removal request tool is accessible anytime at /delete-account on our backend service.",
    ],
    bulletPointsAm: [
      "የማየት እና የመውሰድ መብት፡ ሙሉ የማረጋገጫ ታሪክዎን እና የኦዲት ምዝግብ ማስታወሻዎችን በዳሽቦርድዎ ውስጥ ማየት ይችላሉ።",
      "በቋሚነት የመሰረዝ መብት፡ መለያዎ፣ የደረሰኝ ታሪክዎ እና የመገለጫ መረጃዎ በቋሚነት እንዲሰረዝ መጠየቅ ይችላሉ።",
      "የራሷን ስረዛ መጠየቂያ፡ የመረጃ ማስወገጃ ጥያቄ ገጽ በማንኛውም ጊዜ በ/delete-account ይገኛል።",
    ],
  },
  {
    id: "contact-dpo",
    icon: "mail-unread-outline",
    titleEn: "6. Privacy Office & Contact Support",
    titleAm: "6. የግላዊነት ቢሮ እና የእርዳታ አድራሻ",
    badgeEn: "24/7 DPO Support",
    badgeAm: "የግላዊነት ድጋፍ",
    contentEn:
      "If you have questions, feedback, or compliance inquiries regarding this policy or Geba AI data practices, contact our Data Protection Officer:",
    contentAm:
      "ስለዚህ ፖሊሲ ወይም ገባ ኤአይ የመረጃ አሰራር ጥያቄ ወይም አስተያየት ካለዎት የግላዊነት መኮንናችንን ያግኙ፡",
    bulletPointsEn: [
      "Data Protection Officer Email: privacy@geba.ai",
      "Support Help Center: support@geba.ai",
      "Official Web Policy: https://geba.ai/privacy-policy",
    ],
    bulletPointsAm: [
      "የግላዊነት መኮንን ኢሜይል፡ privacy@geba.ai",
      "የእርዳታ ማዕከል ኢሜይል፡ support@geba.ai",
      "ኦፊሴላዊ የድር ፖሊሲ፡ https://geba.ai/privacy-policy",
    ],
  },
];

export default function PrivacyPolicyScreen() {
  const colors = useColors();
  const router = useRouter();
  const { language, t } = useLanguage();
  const insets = useSafeAreaInsets();

  const isAmharic = language === "am";
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    overview: true,
    "data-collection": true,
  });

  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const bottomPad = Platform.OS === "web" ? 24 : insets.bottom;

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const filteredSections = POLICY_SECTIONS.filter((sec) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const title = (isAmharic ? sec.titleAm : sec.titleEn).toLowerCase();
    const content = (isAmharic ? sec.contentAm : sec.contentEn).toLowerCase();
    const bullets = (isAmharic ? sec.bulletPointsAm : sec.bulletPointsEn)?.join(" ").toLowerCase() || "";
    return title.includes(query) || content.includes(query) || bullets.includes(query);
  });

  const handleOpenAccountDeletion = () => {
    Alert.alert(
      isAmharic ? "መለያ የመሰረዝ ጥያቄ" : "Account Deletion Request",
      isAmharic
        ? "ወደ መለያ እና መረጃ ማስወገጃ ገጽ መሄድ ይፈልጋሉ?"
        : "Would you like to open the web portal to permanently erase your Geba AI account and all associated receipt data?",
      [
        { text: isAmharic ? "ሰርዝ" : "Cancel", style: "cancel" },
        {
          text: isAmharic ? "ሂድ" : "Proceed",
          style: "destructive",
          onPress: () => {
            Linking.openURL("https://geba.ai/delete-account").catch(() => {
              Alert.alert(
                isAmharic ? "የማስወገጃ ገጽ" : "Account Deletion Web Page",
                isAmharic
                  ? "የመለያ ስረዛ ገጽ በቅርቡ በ/delete-account ላይ ይገኛል።"
                  : "Account deletion request form is hosted at /delete-account on your backend server."
              );
            });
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header Bar */}
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 12,
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: colors.muted }]}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color={colors.foreground} />
        </TouchableOpacity>

        <View style={styles.headerTextContainer}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            {t("privacy.title")}
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>
            {t("privacy.lastUpdated")}
          </Text>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: "rgba(34, 197, 94, 0.15)", borderColor: "#22C55E" }]}>
          <Ionicons name="checkmark-shield" size={14} color="#22C55E" />
          <Text style={styles.statusBadgeText}>Verified</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: bottomPad + 30,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner Gradient Card */}
        <LinearGradient
          colors={["#1E1B4B", "#312E81", "#4338CA"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.bannerCard}
        >
          <View style={styles.bannerHeader}>
            <View style={styles.bannerIconBox}>
              <Ionicons name="shield-checkmark" size={28} color="#A5B4FC" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>Geba AI Data Protection</Text>
              <Text style={styles.bannerDesc}>
                {t("privacy.subtitle")}
              </Text>
            </View>
          </View>

          <View style={styles.bannerPillsRow}>
            <View style={styles.bannerPill}>
              <Ionicons name="lock-closed" size={12} color="#818CF8" />
              <Text style={styles.bannerPillText}>AES-256 Encrypted</Text>
            </View>
            <View style={styles.bannerPill}>
              <Ionicons name="ban-outline" size={12} color="#818CF8" />
              <Text style={styles.bannerPillText}>No Data Sales</Text>
            </View>
            <View style={styles.bannerPill}>
              <Ionicons name="logo-google-playstore" size={12} color="#818CF8" />
              <Text style={styles.bannerPillText}>Google Play Compliant</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Quick Highlight Cards */}
        <View style={styles.highlightsGrid}>
          <View style={[styles.highlightCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="eye-off-outline" size={22} color={colors.primary} />
            <Text style={[styles.highlightTitle, { color: colors.foreground }]}>Private Verification</Text>
            <Text style={[styles.highlightSub, { color: colors.mutedForeground }]}>Receipt OCR is statelessly processed</Text>
          </View>

          <View style={[styles.highlightCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="trash-bin-outline" size={22} color={colors.destructive} />
            <Text style={[styles.highlightTitle, { color: colors.foreground }]}>Data Erase Rights</Text>
            <Text style={[styles.highlightSub, { color: colors.mutedForeground }]}>Instant full account wiping option</Text>
          </View>
        </View>

        {/* Search Bar Input */}
        <View
          style={[
            styles.searchBox,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <Ionicons name="search-outline" size={18} color={colors.mutedForeground} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder={t("privacy.searchPlaceholder")}
            placeholderTextColor={colors.mutedForeground}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>

        {/* Policy Sections Accordions */}
        {filteredSections.length === 0 ? (
          <View style={styles.emptySearch}>
            <Ionicons name="search" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptySearchText, { color: colors.mutedForeground }]}>
              {isAmharic ? "ምንም የሚዛመድ የግላዊነት ርዕስ አልተገኘም" : "No matching privacy policy topics found."}
            </Text>
          </View>
        ) : (
          filteredSections.map((sec) => {
            const isExpanded = !!expandedSections[sec.id];
            const title = isAmharic ? sec.titleAm : sec.titleEn;
            const badge = isAmharic ? sec.badgeAm : sec.badgeEn;
            const content = isAmharic ? sec.contentAm : sec.contentEn;
            const bullets = isAmharic ? sec.bulletPointsAm : sec.bulletPointsEn;

            return (
              <View
                key={sec.id}
                style={[
                  styles.sectionContainer,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                <TouchableOpacity
                  style={styles.sectionHeader}
                  onPress={() => toggleSection(sec.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.sectionIconBox, { backgroundColor: colors.muted }]}>
                    <Ionicons name={sec.icon} size={20} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
                    {badge && (
                      <View style={[styles.inlineBadge, { backgroundColor: colors.muted }]}>
                        <Text style={[styles.inlineBadgeText, { color: colors.primary }]}>{badge}</Text>
                      </View>
                    )}
                  </View>
                  <Ionicons
                    name={isExpanded ? "chevron-up" : "chevron-down"}
                    size={20}
                    color={colors.mutedForeground}
                  />
                </TouchableOpacity>

                {isExpanded && (
                  <View style={[styles.sectionBody, { borderTopColor: colors.border }]}>
                    <Text style={[styles.sectionText, { color: colors.foreground }]}>{content}</Text>
                    {bullets && bullets.length > 0 && (
                      <View style={styles.bulletsList}>
                        {bullets.map((point, idx) => (
                          <View key={idx} style={styles.bulletItem}>
                            <View style={[styles.bulletDot, { backgroundColor: colors.primary }]} />
                            <Text style={[styles.bulletText, { color: colors.mutedForeground }]}>
                              {point}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}

        {/* Account & Data Erasure Callout */}
        <View
          style={[
            styles.deletionCallout,
            {
              backgroundColor: "rgba(239, 68, 68, 0.08)",
              borderColor: "rgba(239, 68, 68, 0.3)",
            },
          ]}
        >
          <View style={styles.deletionHeader}>
            <View style={styles.deletionIconBox}>
              <Ionicons name="warning-outline" size={22} color="#EF4444" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.deletionTitle}>{t("privacy.requestDeletion")}</Text>
              <Text style={[styles.deletionDesc, { color: colors.mutedForeground }]}>
                {t("privacy.deletionDesc")}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.deletionButton}
            onPress={handleOpenAccountDeletion}
            activeOpacity={0.8}
          >
            <Ionicons name="trash-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.deletionButtonText}>
              {isAmharic ? "የስረዛ ጥያቄ አስገባ" : "Submit Data Deletion Request"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Footer notice */}
        <Text style={[styles.footerNotice, { color: colors.mutedForeground }]}>
          © 2026 Geba AI Technologies PLC. All rights reserved. Ethiopian Financial AI Security Compliance.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  headerSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#22C55E",
  },
  bannerCard: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    shadowColor: "#312E81",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  bannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  bannerIconBox: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  bannerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  bannerDesc: {
    fontSize: 12,
    color: "#C7D2FE",
    marginTop: 2,
    lineHeight: 16,
  },
  bannerPillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  bannerPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 6,
  },
  bannerPillText: {
    fontSize: 11,
    color: "#E0E7FF",
    fontWeight: "500",
  },
  highlightsGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  highlightCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  highlightTitle: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 6,
  },
  highlightSub: {
    fontSize: 11,
    marginTop: 2,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
  },
  emptySearch: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 36,
  },
  emptySearchText: {
    fontSize: 13,
    marginTop: 8,
  },
  sectionContainer: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
  },
  sectionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  inlineBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  inlineBadgeText: {
    fontSize: 10,
    fontWeight: "600",
  },
  sectionBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  sectionText: {
    fontSize: 13,
    lineHeight: 19,
  },
  bulletsList: {
    marginTop: 10,
    gap: 8,
  },
  bulletItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  bulletText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  deletionCallout: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginTop: 6,
    marginBottom: 20,
  },
  deletionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  deletionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  deletionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#EF4444",
  },
  deletionDesc: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  deletionButton: {
    backgroundColor: "#EF4444",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
  },
  deletionButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  footerNotice: {
    textAlign: "center",
    fontSize: 11,
    lineHeight: 15,
  },
});
