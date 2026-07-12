import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Plan, useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

interface PlanConfig {
  key: Plan;
  name: string;
  priceMonthly: string;
  priceYearly: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  color: string;
  icon: string;
}

export default function SubscriptionScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  
  // Expandable FAQ states
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const plans: PlanConfig[] = [
    {
      key: "free",
      name: "Free Trial",
      priceMonthly: "0 Birr",
      priceYearly: "0 Birr",
      description: "Perfect for testing receipt authenticity",
      features: [
        "20 verifications / month",
        "Basic AI OCR detection",
        "Email support response in 48h",
        "Verification history (30 days limit)",
      ],
      color: colors.mutedForeground,
      icon: "gift-outline",
    },
    {
      key: "pro",
      name: "Pro Merchant",
      priceMonthly: "1,500 Birr",
      priceYearly: "15,000 Birr",
      description: "Best for growing retail stores & cafes",
      features: [
        "Unlimited verifications",
        "Advanced AI fraud cross-validation",
        "Multi-user team access (up to 10)",
        "PDF & Excel monthly reports",
        "Priority support within 4 hours",
        "Extended verification history (90 days)",
      ],
      highlighted: true,
      color: colors.primary,
      icon: "star-outline",
    },
    {
      key: "enterprise",
      name: "Enterprise",
      priceMonthly: "5,000 Birr",
      priceYearly: "50,000 Birr",
      description: "For large retail chains & supermarkets",
      features: [
        "Everything in Pro Merchant",
        "Multi-branch location syncing",
        "API Integration & Webhooks",
        "Unlimited team members",
        "Custom banking portal scrapers",
        "Dedicated Account Manager",
        "Unlimited logs history",
        "99.9% Server SLA guarantee",
      ],
      color: colors.warning,
      icon: "diamond-outline",
    },
  ];

  const faqs = [
    {
      q: "How does the manual bank transfer upgrade work?",
      a: "Simply choose a plan and make a transfer of the exact Birr amount to our Commercial Bank of Ethiopia (CBE) account. Take a screenshot of the receipt, upload it through the app, and our system will verify your payment instantly.",
    },
    {
      q: "Can I upgrade or downgrade my plan at any time?",
      a: "Yes! You can choose to upgrade your plan whenever your business needs change. The new features and limits will apply immediately to your account.",
    },
    {
      q: "Is there a discount for selecting a Yearly plan?",
      a: "Yes! Selecting the Yearly billing cycle saves you 20% on your subscription. You get 2 full months completely free of charge.",
    },
    {
      q: "What bank portals are supported for cross-validation?",
      a: "We currently support CBE, Telebirr, Dashen Bank, Awash Bank, Bank of Abyssinia (Apolo), Zemen Bank, and Safaricom M-Pesa portals.",
    },
  ];

  const comparisonFeatures = [
    { name: "Monthly Scans", free: "20 limit", pro: "Unlimited", enterprise: "Unlimited" },
    { name: "Team Members", free: "Owner only", pro: "Up to 10", enterprise: "Unlimited" },
    { name: "AI Fraud Engine", free: "Basic", pro: "Advanced", enterprise: "Custom Models" },
    { name: "Scraper Verification", free: "Basic", pro: "Real-time Portals", enterprise: "Real-time + API" },
    { name: "Export Reports", free: "❌", pro: "✅ PDF/Excel", enterprise: "✅ Advanced / API" },
    { name: "History View", free: "30 Days", pro: "90 Days", enterprise: "Unlimited" },
    { name: "Support Level", free: "Email (48h)", pro: "Priority Support", enterprise: "Dedicated Manager" },
  ];

  const testimonials = [
    {
      quote: "PayVerify saved us over 80,000 Birr in fraudulent CBE transaction receipts in our first month alone!",
      author: "Yonas K. — Bole Electronics",
    },
    {
      quote: "The team member feature is perfect. Our cashiers scan receipts on their own phones, and I manage everything from the dashboard.",
      author: "Selam W. — Caramel Coffee",
    },
  ];

  function handleUpgrade(planKey: Plan, price: string) {
    if (planKey === user?.plan) return;
    if (planKey === "free") return;

    router.push({
      pathname: "/payment/bank-details",
      params: { plan: planKey, price },
    } as any);
  }

  function toggleFaq(index: number) {
    setExpandedFaq(expandedFaq === index ? null : index);
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: bottomPad + 32 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <TouchableOpacity
          style={[styles.closeBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.back()}
        >
          <Ionicons name="close" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <LinearGradient
          colors={[colors.primary + "20", colors.background]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.headerContent}>
          <Text style={[styles.headerBadge, { color: colors.primary, backgroundColor: colors.primary + "15" }]}>
            PAYVERIFY AI PRICING
          </Text>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Upgrade Your Business
          </Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            Select the plan that matches your transaction volume and team size
          </Text>
        </View>
      </View>

      {/* Yearly Billing Switcher */}
      <View style={styles.billingToggleContainer}>
        <TouchableOpacity
          style={[
            styles.billingToggleTab,
            billingCycle === "monthly" && [styles.billingToggleActiveTab, { backgroundColor: colors.primary }],
          ]}
          onPress={() => setBillingCycle("monthly")}
        >
          <Text
            style={[
              styles.billingToggleText,
              { color: billingCycle === "monthly" ? "#FFFFFF" : colors.mutedForeground },
            ]}
          >
            Monthly
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.billingToggleTab,
            billingCycle === "yearly" && [styles.billingToggleActiveTab, { backgroundColor: colors.primary }],
          ]}
          onPress={() => setBillingCycle("yearly")}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text
              style={[
                styles.billingToggleText,
                { color: billingCycle === "yearly" ? "#FFFFFF" : colors.mutedForeground },
              ]}
            >
              Yearly
            </Text>
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>Save 20%</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {/* Plans List */}
      <View style={styles.plansContainer}>
        {plans.map((plan) => {
          const isCurrent = user?.plan === plan.key;
          const currentPrice = billingCycle === "monthly" ? plan.priceMonthly : plan.priceYearly;
          const currentPeriod = billingCycle === "monthly" ? "/mo" : "/yr";
          const savingsText =
            billingCycle === "yearly" && plan.key === "pro"
              ? "Save 3,000 Birr/year"
              : billingCycle === "yearly" && plan.key === "enterprise"
              ? "Save 10,000 Birr/year"
              : "";

          return (
            <View
              key={plan.key}
              style={[
                styles.planCard,
                {
                  backgroundColor: colors.card,
                  borderColor: plan.highlighted ? plan.color : colors.border,
                  borderWidth: plan.highlighted ? 2 : 1,
                },
              ]}
            >
              {plan.highlighted && (
                <View style={[styles.popularBadge, { backgroundColor: colors.primary }]}>
                  <Ionicons name="star" size={12} color="#FFFFFF" />
                  <Text style={styles.popularText}>RECOMMENDED</Text>
                </View>
              )}

              <View style={styles.planHeader}>
                <View style={styles.planNameRow}>
                  <View style={[styles.planIconBox, { backgroundColor: plan.color + "20" }]}>
                    <Ionicons name={plan.icon as never} size={22} color={plan.color} />
                  </View>
                  <View style={{ flex: 1, paddingRight: 40 }}>
                    <Text style={[styles.planName, { color: plan.color }]}>{plan.name}</Text>
                    <Text style={[styles.planDesc, { color: colors.mutedForeground }]}>{plan.description}</Text>
                  </View>
                </View>
                <View style={styles.priceRow}>
                  <Text style={[styles.price, { color: colors.foreground }]}>{currentPrice}</Text>
                  <Text style={[styles.period, { color: colors.mutedForeground }]}>{currentPeriod}</Text>
                  {savingsText.length > 0 && (
                    <Text style={[styles.savingsText, { color: colors.success }]}>{savingsText}</Text>
                  )}
                </View>
              </View>

              <View style={styles.featuresList}>
                {plan.features.map((feature, i) => (
                  <View key={i} style={styles.featureRow}>
                    <Ionicons name="checkmark-circle" size={16} color={plan.color} />
                    <Text style={[styles.featureText, { color: colors.foreground }]}>{feature}</Text>
                  </View>
                ))}
              </View>

              {isCurrent ? (
                <View style={[styles.currentBadge, { borderColor: plan.color + "40", backgroundColor: plan.color + "10" }]}>
                  <Ionicons name="checkmark" size={14} color={plan.color} />
                  <Text style={[styles.currentBadgeText, { color: plan.color }]}>Your Active Plan</Text>
                </View>
              ) : plan.key !== "free" ? (
                <TouchableOpacity
                  style={[
                    styles.upgradeBtn,
                    { backgroundColor: plan.color },
                  ]}
                  onPress={() => handleUpgrade(plan.key, currentPrice)}
                >
                  <Text style={styles.upgradeBtnText}>
                    Choose {plan.name}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={[styles.currentBadge, { borderColor: colors.border, backgroundColor: colors.background }]}>
                  <Text style={[styles.currentBadgeText, { color: colors.mutedForeground }]}>Included by Default</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* Plan Feature Comparison Table */}
      <View style={styles.comparisonSection}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Compare Plans</Text>
        <View style={[styles.comparisonTable, { borderColor: colors.border, backgroundColor: colors.card }]}>
          {comparisonFeatures.map((feat, idx) => (
            <View
              key={feat.name}
              style={[
                styles.comparisonRow,
                { borderBottomColor: colors.border },
                idx === comparisonFeatures.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <Text style={[styles.comparisonFeatureName, { color: colors.foreground }]}>{feat.name}</Text>
              <View style={styles.comparisonValues}>
                <View style={styles.valCol}>
                  <Text style={styles.valHeader}>Free</Text>
                  <Text style={[styles.valText, { color: colors.mutedForeground }]}>{feat.free}</Text>
                </View>
                <View style={styles.valCol}>
                  <Text style={[styles.valHeader, { color: colors.primary }]}>Pro</Text>
                  <Text style={[styles.valText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{feat.pro}</Text>
                </View>
                <View style={styles.valCol}>
                  <Text style={[styles.valHeader, { color: colors.warning }]}>Ent</Text>
                  <Text style={[styles.valText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{feat.enterprise}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Customer Testimonials */}
      <View style={styles.testimonialsSection}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>What Stores Say</Text>
        <View style={styles.testimonialsContainer}>
          {testimonials.map((t, idx) => (
            <View key={idx} style={[styles.testimonialCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.starsRow}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Ionicons key={i} name="star" size={14} color={colors.warning} />
                ))}
              </View>
              <Text style={[styles.testimonialQuote, { color: colors.foreground }]}>"{t.quote}"</Text>
              <Text style={[styles.testimonialAuthor, { color: colors.mutedForeground }]}>{t.author}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* FAQ Accordion */}
      <View style={styles.faqSection}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Frequently Asked Questions</Text>
        <View style={styles.faqList}>
          {faqs.map((faq, idx) => {
            const isExpanded = expandedFaq === idx;
            return (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.faqItem,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
                onPress={() => toggleFaq(idx)}
                activeOpacity={0.7}
              >
                <View style={styles.faqHeader}>
                  <Text style={[styles.faqQuestion, { color: colors.foreground }]}>{faq.q}</Text>
                  <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
                </View>
                {isExpanded && (
                  <Text style={[styles.faqAnswer, { color: colors.mutedForeground }]}>{faq.a}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={[styles.footer, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Ionicons name="shield-checkmark-outline" size={18} color={colors.success} />
        <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
          Manual Bank Transfer · Review in &lt; 30 mins · Cancel anytime
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 24, overflow: "hidden" },
  closeBtn: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, marginBottom: 20, zIndex: 1,
  },
  headerContent: { alignItems: "center", gap: 10 },
  headerBadge: {
    fontSize: 10, fontFamily: "Inter_700Bold",
    letterSpacing: 1.5, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 100,
  },
  headerTitle: { fontSize: 26, fontFamily: "Inter_700Bold", letterSpacing: -0.5, textAlign: "center" },
  headerSub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18, paddingHorizontal: 20 },
  
  // Billing cycle switcher
  billingToggleContainer: {
    flexDirection: "row",
    alignSelf: "center",
    backgroundColor: "#EFF2F6",
    borderRadius: 100,
    padding: 4,
    marginVertical: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  billingToggleTab: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 100,
    justifyContent: "center",
    alignItems: "center",
  },
  billingToggleActiveTab: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  billingToggleText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  discountBadge: {
    backgroundColor: "#F59E0B",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 100,
  },
  discountText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontFamily: "Inter_700Bold",
  },

  plansContainer: { paddingHorizontal: 16, gap: 16 },
  planCard: { borderRadius: 20, padding: 20, overflow: "hidden", gap: 16, borderWidth: 1 },
  popularBadge: {
    position: "absolute", top: 16, right: 16,
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100,
  },
  popularText: { color: "#FFFFFF", fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  planHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  planNameRow: { flex: 1, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  planIconBox: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  planName: { fontSize: 18, fontFamily: "Inter_700Bold" },
  planDesc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 4, lineHeight: 16 },
  priceRow: { alignItems: "flex-end" },
  price: { fontSize: 24, fontFamily: "Inter_700Bold" },
  period: { fontSize: 12, fontFamily: "Inter_400Regular" },
  savingsText: { fontSize: 10, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  featuresList: { gap: 10, marginTop: 4 },
  featureRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  featureText: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  currentBadge: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, padding: 12, borderRadius: 12, borderWidth: 1,
  },
  currentBadgeText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  upgradeBtn: { padding: 14, borderRadius: 12, alignItems: "center" },
  upgradeBtnText: { color: "#FFFFFF", fontSize: 14, fontFamily: "Inter_700Bold" },

  // Sections Common
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold", marginHorizontal: 20, marginTop: 32, marginBottom: 12 },

  // Plan Comparison
  comparisonSection: {},
  comparisonTable: { marginHorizontal: 16, borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  comparisonRow: { padding: 14, borderBottomWidth: 1, gap: 10 },
  comparisonFeatureName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  comparisonValues: { flexDirection: "row", justifyContent: "space-between", gap: 8, marginTop: 4 },
  valCol: { flex: 1, gap: 2 },
  valHeader: { fontSize: 10, fontFamily: "Inter_700Bold", textTransform: "uppercase", color: "#94A3B8" },
  valText: { fontSize: 12, fontFamily: "Inter_400Regular" },

  // Testimonials
  testimonialsSection: {},
  testimonialsContainer: { paddingHorizontal: 16, gap: 10 },
  testimonialCard: { padding: 16, borderRadius: 16, borderWidth: 1, gap: 8 },
  starsRow: { flexDirection: "row", gap: 2 },
  testimonialQuote: { fontSize: 13, fontFamily: "Inter_400Regular", fontStyle: "italic", lineHeight: 18 },
  testimonialAuthor: { fontSize: 11, fontFamily: "Inter_600SemiBold", textAlign: "right" },

  // FAQ Section
  faqSection: {},
  faqList: { paddingHorizontal: 16, gap: 8 },
  faqItem: { padding: 16, borderRadius: 14, borderWidth: 1, gap: 10 },
  faqHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  faqQuestion: { fontSize: 13, fontFamily: "Inter_600SemiBold", flex: 1 },
  faqAnswer: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18, marginTop: 4 },

  footer: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, marginHorizontal: 16, marginTop: 32, padding: 14,
    borderRadius: 12, borderWidth: 1,
  },
  footerText: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
