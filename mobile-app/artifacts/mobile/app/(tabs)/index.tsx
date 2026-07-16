import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatCard } from "@/components/StatCard";
import { VerificationCard } from "@/components/VerificationCard";
import { useAuth } from "@/contexts/AuthContext";
import { useVerifications } from "@/contexts/VerificationContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { useColors } from "@/hooks/useColors";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function DashboardScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const { verifications, getStats } = useVerifications();
  const { unreadCount } = useNotifications();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const stats = getStats();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const recent = verifications.slice(0, 4);
  const usagePercent = user
    ? user.plan === "free"
      ? Math.min((user.verificationsUsed / user.verificationsLimit) * 100, 100)
      : 0
    : 0;

  // Monthly chart data (last 6 months)
  const now = new Date();
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const monthIdx = (now.getMonth() - 5 + i + 12) % 12;
    const count = verifications.filter((v) => {
      const d = new Date(v.createdAt);
      return d.getMonth() === monthIdx;
    }).length;
    return { month: MONTHS[monthIdx], count };
  });
  const maxCount = Math.max(...monthlyData.map((d) => d.count), 1);

  const firstName = user?.fullName.split(" ")[0] ?? "User";

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: bottomPad + 100 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <LinearGradient
        colors={[colors.primary + "25", colors.background]}
        style={[styles.header, { paddingTop: topPad + 20 }]}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.greeting, { color: colors.mutedForeground }]}>Good day,</Text>
            <Text style={[styles.name, { color: colors.foreground }]}>{firstName}</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={[styles.notifBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push("/notifications")}
              activeOpacity={0.7}
            >
              <Ionicons name="notifications-outline" size={20} color={colors.foreground} />
              {unreadCount > 0 && (
                <View style={[styles.notifBadge, { backgroundColor: colors.destructive }]}>
                  <Text style={styles.notifBadgeText}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarText}>{user?.fullName?.[0]?.toUpperCase() ?? "U"}</Text>
            </View>
          </View>
        </View>

        {/* Business + plan pill */}
        <View style={styles.businessRow}>
          <Text style={[styles.businessName, { color: colors.mutedForeground }]}>
            {user?.businessName}
          </Text>
          <TouchableOpacity
            style={[styles.planPill, { backgroundColor: colors.primary + "20" }]}
            onPress={() => router.push("/subscription")}
          >
            <Ionicons name="star" size={12} color={colors.primary} />
            <Text style={[styles.planText, { color: colors.primary }]}>
              {user?.plan?.toUpperCase() ?? "FREE"}
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={styles.body}>
        {/* Renewal Reminder Card */}
        {user?.plan && user.plan !== "free" && (
          <View style={[styles.reminderCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.reminderHeader}>
              <Ionicons name="time-outline" size={18} color={colors.primary} />
              <Text style={[styles.reminderTitle, { color: colors.foreground }]}>Renewal Reminder</Text>
              <View style={[styles.activePill, { backgroundColor: colors.success + "15" }]}>
                <Text style={[styles.activePillText, { color: colors.success }]}>Active</Text>
              </View>
            </View>
            <Text style={[styles.reminderText, { color: colors.mutedForeground }]}>
              Your subscription is active and will renew on{" "}
              <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold" }}>Aug 11, 2026</Text>.
            </Text>
            <View style={styles.reminderDetails}>
              <Text style={[styles.reminderDetailLabel, { color: colors.mutedForeground }]}>ACTIVE PLAN</Text>
              <Text style={[styles.reminderDetailVal, { color: colors.foreground }]}>
                {user.plan === "pro" ? "Pro Merchant" : "Enterprise Suite"}
              </Text>
            </View>
            <View style={styles.reminderDetails}>
              <Text style={[styles.reminderDetailLabel, { color: colors.mutedForeground }]}>RENEWAL RATE</Text>
              <Text style={[styles.reminderDetailVal, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                {user.plan === "pro" ? "1,500 Birr / mo" : "50,000 Birr / yr"}
              </Text>
            </View>
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statsRow}>
            <StatCard label="Total Scans" value={stats.total} icon="scan-outline" color={colors.primary} delay={0} />
            <StatCard label="Approved" value={stats.approved} icon="checkmark-circle-outline" color={colors.success} delay={100} />
          </View>
          <View style={styles.statsRow}>
            <StatCard label="Rejected" value={stats.rejected} icon="close-circle-outline" color={colors.destructive} delay={200} />
            <StatCard label="Fraud Alerts" value={stats.fraudAttempts} icon="warning-outline" color={colors.warning} delay={300} />
          </View>
        </View>

        {/* Usage bar (free plan) */}
        {user?.plan === "free" && (
          <View style={[styles.usageCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.usageHeader}>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionIconBox, { backgroundColor: colors.primary + "18" }]}>
                  <Ionicons name="speedometer-outline" size={16} color={colors.primary} />
                </View>
                <Text style={[styles.usageTitle, { color: colors.foreground }]}>Monthly Usage</Text>
              </View>
              <TouchableOpacity onPress={() => router.push("/subscription")}>
                <Text style={[styles.upgradeLink, { color: colors.primary }]}>Upgrade</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.usageTrack, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.usageFill,
                  {
                    backgroundColor: usagePercent > 80 ? colors.destructive : colors.primary,
                    width: `${usagePercent}%` as unknown as number,
                  },
                ]}
              />
            </View>
            <Text style={[styles.usageMeta, { color: colors.mutedForeground }]}>
              {user.verificationsUsed} / {user.verificationsLimit} verifications used
            </Text>
          </View>
        )}

        {/* Monthly Activity Chart */}
        <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionIconBox, { backgroundColor: colors.primary + "18" }]}>
              <Ionicons name="bar-chart-outline" size={16} color={colors.primary} />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Monthly Activity</Text>
          </View>
          <View style={styles.chart}>
            {monthlyData.map((d, i) => (
              <View key={i} style={styles.chartBar}>
                <View style={[styles.barContainer]}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: d.count === 0 ? 4 : Math.max((d.count / maxCount) * 100, 8),
                        backgroundColor:
                          i === monthlyData.length - 1 ? colors.primary : colors.primary + "50",
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.barLabel, { color: colors.mutedForeground }]}>{d.month}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Recent Verifications */}
        <View style={styles.recentSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionIconBox, { backgroundColor: colors.success + "18" }]}>
                <Ionicons name="receipt-outline" size={16} color={colors.success} />
              </View>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent Verifications</Text>
            </View>
            <TouchableOpacity onPress={() => router.push("/(tabs)/history")}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
            </TouchableOpacity>
          </View>
          {recent.length === 0 ? (
            <View style={[styles.emptyState, { borderColor: colors.border }]}>
              <Ionicons name="document-outline" size={32} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No verifications yet. Scan a receipt to get started.
              </Text>
            </View>
          ) : (
            recent.map((v) => <VerificationCard key={v.id} record={v} />)
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 24 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  greeting: { fontSize: 13, fontFamily: "Inter_400Regular" },
  name: { fontSize: 24, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  notifBtn: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: "center", justifyContent: "center", borderWidth: 1,
    position: "relative",
  },
  notifBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  notifBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontFamily: "Inter_700Bold",
  },
  avatar: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 16 },
  businessRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  businessName: { fontSize: 14, fontFamily: "Inter_500Medium" },
  planPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100,
  },
  planText: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  body: { paddingHorizontal: 16, gap: 16 },
  statsGrid: { gap: 10 },
  statsRow: { flexDirection: "row", gap: 10 },
  usageCard: { padding: 16, borderRadius: 16, borderWidth: 1, gap: 10 },
  usageHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  usageTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  upgradeLink: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  usageTrack: { height: 8, borderRadius: 100, overflow: "hidden" },
  usageFill: { height: "100%", borderRadius: 100 },
  usageMeta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionIconBox: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  chartCard: { padding: 16, borderRadius: 16, borderWidth: 1, gap: 12 },
  chart: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: 100, marginTop: 16 },
  chartBar: { flex: 1, alignItems: "center", gap: 6 },
  barContainer: { flex: 1, width: "60%", justifyContent: "flex-end" },
  bar: { borderRadius: 4, width: "100%" },
  barLabel: { fontSize: 10, fontFamily: "Inter_500Medium" },
  recentSection: { gap: 12 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  seeAll: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  emptyState: {
    alignItems: "center", gap: 8, padding: 32,
    borderRadius: 16, borderWidth: 1, borderStyle: "dashed",
  },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  reminderCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  reminderHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  reminderTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  activePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: "auto",
  },
  activePillText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
  },
  reminderText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  reminderDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 8,
    marginTop: -2,
  },
  reminderDetailLabel: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },
  reminderDetailVal: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
});
