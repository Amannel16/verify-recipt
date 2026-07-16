import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

interface PaymentRecord {
  id: string;
  plan: string;
  amount: string;
  date: string;
  reference: string;
  method: string;
  status: "APPROVED" | "PENDING" | "REJECTED";
}

export default function PaymentHistoryScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  // Generate dynamic mock records based on current user plan
  const paymentHistory: PaymentRecord[] = useMemo(() => {
    if (!user || user.plan === "free") return [];

    const now = new Date();
    const joinedDate = new Date(user.joinedAt);

    if (user.plan === "pro") {
      return [
        {
          id: "p1",
          plan: "Pro Merchant (Monthly)",
          amount: "1,500 Birr",
          date: now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          reference: "FT260912830",
          method: "CBE Bank Transfer",
          status: "APPROVED",
        },
        {
          id: "p2",
          plan: "Free Trial (Initial Setup)",
          amount: "0 Birr",
          date: joinedDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          reference: "SYS-INIT-FREE",
          method: "System Activation",
          status: "APPROVED",
        },
      ];
    }

    if (user.plan === "enterprise") {
      return [
        {
          id: "p1",
          plan: "Enterprise Suite (Yearly)",
          amount: "50,000 Birr",
          date: now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          reference: "FT260920038",
          method: "CBE Bank Transfer",
          status: "APPROVED",
        },
        {
          id: "p2",
          plan: "Pro Merchant (Monthly Upgrade)",
          amount: "1,500 Birr",
          date: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          reference: "FT260811902",
          method: "CBE Bank Transfer",
          status: "APPROVED",
        },
        {
          id: "p3",
          plan: "Free Trial (Initial Setup)",
          amount: "0 Birr",
          date: joinedDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          reference: "SYS-INIT-FREE",
          method: "System Activation",
          status: "APPROVED",
        },
      ];
    }

    return [];
  }, [user]);

  function getStatusStyle(status: string) {
    switch (status) {
      case "APPROVED": return { color: colors.success, bg: colors.success + "15" };
      case "PENDING": return { color: colors.warning, bg: colors.warning + "15" };
      default: return { color: colors.destructive, bg: colors.destructive + "15" };
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>Payment History</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* List */}
      <FlatList
        data={paymentHistory}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 32 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconBox, { backgroundColor: colors.primary + "12" }]}>
              <Ionicons name="card-outline" size={48} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Payment History</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              You are currently on the Free Trial plan. Upgrade to a premium plan to see transaction invoices here.
            </Text>
            <TouchableOpacity
              style={[styles.upgradeBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push("/subscription")}
            >
              <Text style={styles.upgradeBtnText}>Upgrade Now</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => {
          const status = getStatusStyle(item.status);
          return (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={[styles.planTitle, { color: colors.foreground }]}>{item.plan}</Text>
                  <Text style={[styles.invoiceDate, { color: colors.mutedForeground }]}>{item.date}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: status.bg }]}>
                  <Text style={[styles.badgeText, { color: status.color }]}>{item.status}</Text>
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              <View style={styles.detailsRow}>
                <View style={styles.detailCol}>
                  <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>AMOUNT</Text>
                  <Text style={[styles.detailVal, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{item.amount}</Text>
                </View>
                <View style={styles.detailCol}>
                  <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>PAYMENT METHOD</Text>
                  <Text style={[styles.detailVal, { color: colors.foreground }]} numberOfLines={1}>{item.method}</Text>
                </View>
              </View>

              <View style={styles.detailsRow}>
                <View style={styles.detailCol}>
                  <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>REFERENCE ID</Text>
                  <Text style={[styles.detailVal, { color: colors.foreground }]}>{item.reference}</Text>
                </View>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  title: { fontSize: 20, fontFamily: "Inter_700Bold" },
  list: { padding: 16, gap: 12 },
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  planTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  invoiceDate: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: { fontSize: 10, fontFamily: "Inter_700Bold", textTransform: "uppercase" },
  divider: { height: 1 },
  detailsRow: { flexDirection: "row", gap: 16 },
  detailCol: { flex: 1, gap: 4 },
  detailLabel: { fontSize: 9, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  detailVal: { fontSize: 13, fontFamily: "Inter_500Medium" },

  // Empty state
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    paddingHorizontal: 20,
    gap: 14,
  },
  emptyIconBox: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  upgradeBtn: { width: "100%", paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12, alignItems: "center", marginTop: 12 },
  upgradeBtnText: { color: "#FFFFFF", fontSize: 14, fontFamily: "Inter_700Bold" },
});
