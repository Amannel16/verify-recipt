import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<Filter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const filtered = useMemo(() => {
    const now = new Date();
    return verifications.filter((v) => {
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
  }, [verifications, dateFilter, statusFilter, search]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 20 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>History</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          {filtered.length} verification{filtered.length !== 1 ? "s" : ""}
        </Text>
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
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 4 },
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
