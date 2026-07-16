import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
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
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

interface AuditLog {
  id: string;
  user: string;
  role: string;
  action: string;
  target: string;
  status: "success" | "warning" | "error" | "info";
  time: string;
}

const AUDIT_LOGS: AuditLog[] = [
  { id: "1", user: "Yonas K.", role: "Manager", action: "Verified CBE receipt", target: "#CBE-893021 (15,000 Birr)", status: "success", time: "2 mins ago" },
  { id: "2", user: "Selam W.", role: "Cashier", action: "Verified Telebirr receipt", target: "#TB-992110 (2,400 Birr)", status: "success", time: "12 mins ago" },
  { id: "3", user: "Michael Chen", role: "Cashier", action: "Flagged duplicate receipt", target: "#CBE-893021 (15,000 Birr)", status: "warning", time: "30 mins ago" },
  { id: "4", user: "You", role: "Owner", action: "Regenerated API Key", target: "POS Integration Key", status: "info", time: "1 hour ago" },
  { id: "5", user: "Jessica M.", role: "Cashier", action: "Failed verification (Edited)", target: "#BOA-120938 (3,500 Birr)", status: "error", time: "2 hours ago" },
  { id: "6", user: "Sarah Davis", role: "Manager", action: "Created Bole Branch location", target: "Medhanialem Branch", status: "info", time: "1 day ago" },
  { id: "7", user: "Michael Chen", role: "Cashier", action: "Logged in via Mobile app", target: "Device: iPhone 15 Pro", status: "info", time: "1 day ago" },
  { id: "8", user: "David Kim", role: "Viewer", action: "Exported monthly CSV report", target: "June 2026 Logs", status: "success", time: "2 days ago" },
];

export default function AuditLogsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const filteredLogs = useMemo(() => {
    if (!search.trim()) return AUDIT_LOGS;
    const q = search.toLowerCase();
    return AUDIT_LOGS.filter(
      (log) =>
        log.user.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        log.target.toLowerCase().includes(q) ||
        log.role.toLowerCase().includes(q)
    );
  }, [search]);

  function getStatusColor(status: string) {
    switch (status) {
      case "success": return colors.success;
      case "warning": return colors.warning;
      case "error": return colors.destructive;
      default: return colors.primary;
    }
  }

  function getStatusIcon(status: string): string {
    switch (status) {
      case "success": return "checkmark-circle-outline";
      case "warning": return "warning-outline";
      case "error": return "close-circle-outline";
      default: return "information-circle-outline";
    }
  }

  // Enforce Enterprise plan block overlay
  if (user?.plan !== "enterprise") {
    return (
      <View style={[styles.lockedContainer, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground }]}>Audit Logs</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.lockContent}>
          <View style={[styles.lockIconBox, { backgroundColor: colors.warning + "18" }]}>
            <Ionicons name="lock-closed" size={56} color={colors.warning} />
          </View>
          <Text style={[styles.lockTitle, { color: colors.foreground }]}>Cashier Audit Logs Locked</Text>
          <Text style={[styles.lockSubtitle, { color: colors.mutedForeground }]}>
            Consolidated cashier activity trails, system setting audits, security warnings, and data export tracking require the Enterprise plan subscription.
          </Text>
          <TouchableOpacity
            style={[styles.lockBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/subscription")}
          >
            <Text style={styles.lockBtnText}>Upgrade to Enterprise</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
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
        <Text style={[styles.title, { color: colors.foreground }]}>Audit Logs</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search */}
      <View style={[styles.searchRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Ionicons name="search-outline" size={18} color={colors.mutedForeground} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder="Search by cashier name, role or action..."
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

      {/* Timeline List */}
      <FlatList
        data={filteredLogs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 32 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No audit logs match your search.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const color = getStatusColor(item.status);
          const icon = getStatusIcon(item.status);
          return (
            <View style={[styles.logCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.logHeader}>
                <View style={[styles.dot, { backgroundColor: color }]} />
                <Text style={[styles.logUser, { color: colors.foreground }]}>{item.user}</Text>
                <View style={[styles.roleBadge, { backgroundColor: colors.muted }]}>
                  <Text style={[styles.roleText, { color: colors.mutedForeground }]}>{item.role}</Text>
                </View>
                <Text style={[styles.logTime, { color: colors.mutedForeground }]}>{item.time}</Text>
              </View>

              <View style={styles.logBody}>
                <View style={styles.actionIconWrap}>
                  <Ionicons name={icon as never} size={16} color={color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.actionText, { color: colors.foreground }]}>
                    {item.action}{" "}
                    <Text style={{ fontFamily: "Inter_700Bold" }}>{item.target}</Text>
                  </Text>
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
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  list: { paddingHorizontal: 16, gap: 10 },
  logCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  logHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  logUser: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  roleBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 100 },
  roleText: { fontSize: 9, fontFamily: "Inter_600SemiBold", textTransform: "uppercase" },
  logTime: { fontSize: 11, fontFamily: "Inter_400Regular", marginLeft: "auto" },
  logBody: { flexDirection: "row", gap: 8, alignItems: "flex-start", paddingLeft: 14 },
  actionIconWrap: { marginTop: 1 },
  actionText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  emptyState: { alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular" },

  // Gated Plan Lock Styles
  lockedContainer: { flex: 1, paddingHorizontal: 20 },
  lockContent: { flex: 1, alignItems: "center", justifyContent: "center", gap: 20, paddingHorizontal: 10 },
  lockIconBox: { width: 100, height: 100, borderRadius: 50, alignItems: "center", justifyContent: "center" },
  lockTitle: { fontSize: 22, fontFamily: "Inter_700Bold", textAlign: "center" },
  lockSubtitle: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  lockBtn: { width: "100%", padding: 16, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  lockBtnText: { color: "#FFFFFF", fontSize: 15, fontFamily: "Inter_700Bold" },
});
