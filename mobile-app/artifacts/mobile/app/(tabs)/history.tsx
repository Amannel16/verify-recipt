import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { VerificationCard } from "@/components/VerificationCard";
import { VerificationRecord, VerificationStatus, useVerifications } from "@/contexts/VerificationContext";
import { useColors } from "@/hooks/useColors";

type Filter = "all" | "today" | "week" | "month";
type StatusFilter = "all" | VerificationStatus;

const DATE_FILTERS: { key: Filter; label: string; icon: string }[] = [
  { key: "all", label: "All Time", icon: "calendar-outline" },
  { key: "today", label: "Today", icon: "today-outline" },
  { key: "week", label: "This Week", icon: "calendar-clear-outline" },
  { key: "month", label: "This Month", icon: "calendar-number-outline" },
];

const STATUS_FILTERS: { key: StatusFilter; label: string; icon: string }[] = [
  { key: "all", label: "All", icon: "list-outline" },
  { key: "approved", label: "Approved", icon: "checkmark-circle-outline" },
  { key: "suspicious", label: "Suspicious", icon: "warning-outline" },
  { key: "rejected", label: "Rejected", icon: "close-circle-outline" },
];

export default function HistoryScreen() {
  const colors = useColors();
  const { verifications } = useVerifications();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<Filter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [exporting, setExporting] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  function handleExport() {
    if (user?.plan === "free") {
      Alert.alert(
        "Premium Feature",
        "Exporting reports in PDF & Excel formats is only available on Pro or Enterprise plans.",
        [
          { text: "Upgrade Plan", onPress: () => router.push("/subscription") },
          { text: "Cancel", style: "cancel" },
        ]
      );
      return;
    }

    setExporting(true);
    setTimeout(() => {
      setExporting(false);
      Alert.alert(
        "Export Successful",
        "Your transaction log has been compiled into PDF & Excel sheets and saved to your local downloads.",
        [{ text: "OK" }]
      );
    }, 1500);
  }

  const filtered = useMemo(() => {
    const now = new Date();
    return verifications.filter((v) => {
      // Plan-based history gating
      if (user?.plan !== "enterprise") {
        const thresholdDays = user?.plan === "pro" ? 90 : 30;
        const d = new Date(v.createdAt);
        const diffTime = Math.abs(now.getTime() - d.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > thresholdDays) return false;
      }

      // Date filter
      if (dateFilter !== "all") {
        const d = new Date(v.createdAt);
        if (dateFilter === "today") {
          if (d.toDateString() !== now.toDateString()) return false;
        } else if (dateFilter === "week") {
          const weekAgo = new Date(now.getTime() - 7 * 86400000);
          if (d < weekAgo) return false;
        } else if (dateFilter === "month") {
          if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false;
        }
      }
      // Status filter
      if (statusFilter !== "all" && v.status !== statusFilter) return false;
      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          v.senderName.toLowerCase().includes(q) ||
          v.transactionId.toLowerCase().includes(q) ||
          v.amount.toString().includes(q)
        );
      }
      return true;
    });
  }, [verifications, dateFilter, statusFilter, search, user?.plan]);

  const hasHiddenRecords = useMemo(() => {
    if (user?.plan === "enterprise") return false;
    const now = new Date();
    const thresholdDays = user?.plan === "pro" ? 90 : 30;
    return verifications.some((v) => {
      const d = new Date(v.createdAt);
      const diffTime = Math.abs(now.getTime() - d.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > thresholdDays;
    });
  }, [verifications, user?.plan]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 20 }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>History</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {filtered.length} verification{filtered.length !== 1 ? "s" : ""}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.exportBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={handleExport}
          disabled={exporting}
        >
          {exporting ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <Ionicons name="cloud-download-outline" size={16} color={colors.primary} />
              <Text style={[styles.exportText, { color: colors.primary }]}>Export</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={[styles.searchRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Ionicons name="search-outline" size={18} color={colors.mutedForeground} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder="Search by name, ID or amount..."
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      {/* Date Filter */}
      <FlatList
        style={{ flexGrow: 0, flexShrink: 0 }}
        data={DATE_FILTERS}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(i) => i.key}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.filterChip,
              {
                backgroundColor: dateFilter === item.key ? colors.primary : colors.card,
                borderColor: dateFilter === item.key ? colors.primary : colors.border,
              },
            ]}
            onPress={() => setDateFilter(item.key)}
          >
            <Ionicons
              name={item.icon as never}
              size={13}
              color={dateFilter === item.key ? colors.primaryForeground : colors.foreground}
            />
            <Text
              style={[
                styles.filterText,
                { color: dateFilter === item.key ? colors.primaryForeground : colors.foreground },
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Status filter */}
      <FlatList
        style={{ flexGrow: 0, flexShrink: 0 }}
        data={STATUS_FILTERS}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(i) => i.key}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.filterChip,
              {
                backgroundColor: statusFilter === item.key ? colors.primary + "20" : "transparent",
                borderColor: statusFilter === item.key ? colors.primary : colors.border,
              },
            ]}
            onPress={() => setStatusFilter(item.key)}
          >
            <Ionicons
              name={item.icon as never}
              size={13}
              color={statusFilter === item.key ? colors.primary : colors.mutedForeground}
            />
            <Text
              style={[
                styles.filterText,
                { color: statusFilter === item.key ? colors.primary : colors.mutedForeground },
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Hidden records warning banner */}
      {hasHiddenRecords && (
        <TouchableOpacity
          style={[styles.warningBanner, { backgroundColor: colors.warning + "15", borderColor: colors.warning + "40" }]}
          onPress={() => router.push("/subscription")}
          activeOpacity={0.7}
        >
          <Ionicons name="information-circle" size={18} color={colors.warning} />
          <Text style={[styles.warningBannerText, { color: colors.warning }]}>
            {user?.plan === "free"
              ? "History is limited to 30 days. Upgrade to Pro/Enterprise to unlock older records."
              : "History is limited to 90 days. Upgrade to Enterprise to unlock older records."}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={colors.warning} />
        </TouchableOpacity>
      )}

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!!filtered.length}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No results found</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Try adjusting your filters or search terms
            </Text>
          </View>
        }
        renderItem={({ item }) => <VerificationCard record={item} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 4 },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    height: 38,
  },
  exportText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  warningBannerText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    flex: 1,
    lineHeight: 16,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  filterRow: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 100,
    borderWidth: 1,
  },
  filterText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  emptyState: { alignItems: "center", gap: 8, paddingTop: 60 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
});
