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
  price: string;
  period: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  color: string;
  icon: string;
}

export default function SubscriptionScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user, upgradePlan } = useAuth();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState<Plan | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const plans: PlanConfig[] = [
    {
      key: "free",
      name: "Free",
      price: "$0",
      period: "/month",
      description: "Perfect for getting started",
      features: [
        "20 verifications / month",
        "Basic AI detection",
        "Email support",
        "Verification history (30 days)",
      ],
      color: colors.mutedForeground,
      icon: "gift-outline",
    },
    {
      key: "pro",
      name: "Pro",
      price: "$29",
      period: "/month",
      description: "For growing businesses",
      features: [
        "Unlimited verifications",
        "Advanced AI fraud detection",
        "Team members (up to 10)",
        "PDF & Excel reports",
        "Priority support",
        "90-day history",
      ],
      highlighted: true,
      color: colors.primary,
      icon: "star-outline",
    },
    {
      key: "enterprise",
      name: "Enterprise",
      price: "$99",
      period: "/month",
      description: "For large organizations",
      features: [
        "Everything in Pro",
        "Multi-branch support",
        "API access",
        "Unlimited team members",
        "Custom integrations",
        "Dedicated account manager",
        "Unlimited history",
        "SLA guarantee",
      ],
      color: colors.warning,
      icon: "diamond-outline",
    },
  ];

  function handleUpgrade(planKey: Plan, price: string) {
    if (planKey === user?.plan) return;
    if (planKey === "free") return;

    router.push({
      pathname: "/payment/bank-details",
      params: { plan: planKey, price }
    } as any);
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: bottomPad + 32 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <TouchableOpacity style={[styles.closeBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.back()}>
          <Ionicons name="close" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <LinearGradient
          colors={[colors.primary + "20", colors.background]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.headerContent}>
          <Text style={[styles.headerBadge, { color: colors.primary, backgroundColor: colors.primary + "15" }]}>
            UPGRADE YOUR PLAN
          </Text>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Choose your plan
          </Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            Verify more payments, prevent more fraud
          </Text>
        </View>
      </View>

      {/* Plans */}
      <View style={styles.plansContainer}>
        {plans.map((plan) => {
          const isCurrent = user?.plan === plan.key;
          const isLoading = loading === plan.key;

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
                  <Text style={styles.popularText}>MOST POPULAR</Text>
                </View>
              )}

              <View style={styles.planHeader}>
                <View style={styles.planNameRow}>
                  <View style={[styles.planIconBox, { backgroundColor: plan.color + "20" }]}>
                    <Ionicons name={plan.icon as never} size={22} color={plan.color} />
                  </View>
                  <View>
                    <Text style={[styles.planName, { color: plan.color }]}>{plan.name}</Text>
                    <Text style={[styles.planDesc, { color: colors.mutedForeground }]}>{plan.description}</Text>
                  </View>
                </View>
                <View style={styles.priceRow}>
                  <Text style={[styles.price, { color: colors.foreground }]}>{plan.price}</Text>
                  <Text style={[styles.period, { color: colors.mutedForeground }]}>{plan.period}</Text>
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
                  <Text style={[styles.currentBadgeText, { color: plan.color }]}>Current Plan</Text>
                </View>
              ) : plan.key !== "free" ? (
                <TouchableOpacity
                  style={[
                    styles.upgradeBtn,
                    { backgroundColor: isLoading ? plan.color + "80" : plan.color },
                  ]}
                  onPress={() => handleUpgrade(plan.key, plan.price)}
                  disabled={!!loading}
                >
                  <Text style={styles.upgradeBtnText}>
                    {isLoading ? "Processing..." : `Upgrade to ${plan.name}`}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })}
      </View>

      <View style={[styles.footer, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Ionicons name="shield-checkmark-outline" size={18} color={colors.success} />
        <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
          Secure payment · Cancel anytime · No hidden fees
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
    fontSize: 11, fontFamily: "Inter_700Bold",
    letterSpacing: 1, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 100,
  },
  headerTitle: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5, textAlign: "center" },
  headerSub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  plansContainer: { paddingHorizontal: 16, gap: 14 },
  planCard: { borderRadius: 20, padding: 20, overflow: "hidden", gap: 16 },
  popularBadge: {
    position: "absolute", top: 16, right: 16,
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100,
  },
  popularText: { color: "#FFFFFF", fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  planHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  planNameRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  planIconBox: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  planName: { fontSize: 20, fontFamily: "Inter_700Bold" },
  planDesc: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  priceRow: { alignItems: "flex-end" },
  price: { fontSize: 28, fontFamily: "Inter_700Bold" },
  period: { fontSize: 13, fontFamily: "Inter_400Regular" },
  featuresList: { gap: 10 },
  featureRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  featureText: { fontSize: 14, fontFamily: "Inter_400Regular", flex: 1 },
  currentBadge: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, padding: 12, borderRadius: 12, borderWidth: 1,
  },
  currentBadgeText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  upgradeBtn: { padding: 16, borderRadius: 14, alignItems: "center" },
  upgradeBtnText: { color: "#FFFFFF", fontSize: 15, fontFamily: "Inter_700Bold" },
  footer: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, marginHorizontal: 16, marginTop: 16, padding: 14,
    borderRadius: 12, borderWidth: 1,
  },
  footerText: { fontSize: 13, fontFamily: "Inter_400Regular" },
});
