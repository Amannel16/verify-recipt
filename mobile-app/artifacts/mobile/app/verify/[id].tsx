import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
  Alert,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ConfidenceBar } from "@/components/ConfidenceBar";
import { StatusBadge } from "@/components/StatusBadge";
import { useVerifications } from "@/contexts/VerificationContext";
import { useColors } from "@/hooks/useColors";

export default function VerifyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { verifications, deleteVerification } = useVerifications();

  const record = verifications.find((v) => v.id === id);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  if (!record) {
    return (
      <View style={[styles.notFound, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <Ionicons name="document-outline" size={48} color={colors.mutedForeground} />
        <Text style={[styles.notFoundText, { color: colors.mutedForeground }]}>Verification not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.backLink, { color: colors.primary }]}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusConfig = {
    approved: { icon: "shield-checkmark", color: colors.success, bg: colors.approved_bg, headline: "Payment Verified" },
    suspicious: { icon: "warning", color: colors.warning, bg: colors.suspicious_bg, headline: "Requires Review" },
    rejected: { icon: "shield-outline", color: colors.destructive, bg: colors.rejected_bg, headline: "Payment Rejected" },
  }[record.status];

  async function handleShare() {
    try {
      await Share.share({
        message: `PayVerify AI Report\n\nStatus: ${record.status.toUpperCase()}\nConfidence: ${record.confidence}%\nTransaction: ${record.transactionId}\nAmount: $${record.amount.toFixed(2)}\nSender: ${record.senderName}\nDate: ${record.date} ${record.time}`,
      });
    } catch (_) {}
  }

  function handleDelete() {
    Alert.alert("Delete Record", "Remove this verification from history?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteVerification(record.id);
          router.back();
        },
      },
    ]);
  }

  const detailRows: { label: string; value: string }[] = [
    { label: "Transaction ID", value: record.transactionId },
    { label: "Sender", value: record.senderName },
    { label: "Receiver", value: record.receiverName },
    { label: "Amount", value: `$${record.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} ${record.currency}` },
    { label: "Date", value: record.date },
    { label: "Time", value: record.time },
    { label: "Payment Method", value: record.paymentMethod },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: bottomPad + 32 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Toolbar */}
      <View style={[styles.toolbar, { paddingTop: topPad + 12 }]}>
        <TouchableOpacity style={[styles.toolBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.toolbarTitle, { color: colors.foreground }]}>Verification Report</Text>
        <TouchableOpacity style={[styles.toolBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={handleShare}>
          <Ionicons name="share-outline" size={20} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* Status Hero */}
      <View style={[styles.hero, { backgroundColor: statusConfig.bg }]}>
        <Ionicons name={statusConfig.icon as never} size={56} color={statusConfig.color} />
        <Text style={[styles.heroTitle, { color: statusConfig.color }]}>{statusConfig.headline}</Text>
        <StatusBadge status={record.status} size="lg" />
      </View>

      <View style={styles.body}>
        {/* Confidence */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionIconBox, { backgroundColor: statusConfig.color + "18" }]}>
              <Ionicons name="analytics-outline" size={16} color={statusConfig.color} />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>AI Confidence Score</Text>
          </View>
          <ConfidenceBar confidence={record.confidence} status={record.status} />
        </View>

        {/* Transaction Details */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionIconBox, { backgroundColor: colors.primary + "18" }]}>
              <Ionicons name="receipt-outline" size={16} color={colors.primary} />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Transaction Details</Text>
          </View>
          <View style={styles.detailList}>
            {detailRows.map((row) => (
              <View key={row.label} style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{row.label}</Text>
                <Text style={[styles.detailValue, { color: colors.foreground }]}>{row.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* AI Analysis */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionIconBox, { backgroundColor: colors.warning + "18" }]}>
              <Ionicons name="bulb-outline" size={16} color={colors.warning} />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>AI Analysis</Text>
          </View>
          <View style={styles.reasonsList}>
            {record.reasons.map((reason, i) => (
              <View key={i} style={styles.reasonRow}>
                <Ionicons
                  name={record.status === "approved" ? "checkmark-circle" : record.status === "suspicious" ? "alert-circle" : "close-circle"}
                  size={16}
                  color={statusConfig.color}
                />
                <Text style={[styles.reasonText, { color: colors.foreground }]}>{reason}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Warnings */}
        {record.warnings.length > 0 && (
          <View style={[styles.warningsBox, { backgroundColor: colors.warning + "15", borderColor: colors.warning + "40" }]}>
            <Ionicons name="warning" size={18} color={colors.warning} />
            <View style={styles.warningsList}>
              {record.warnings.map((w, i) => (
                <Text key={i} style={[styles.warningText, { color: colors.warning }]}>{w}</Text>
              ))}
            </View>
          </View>
        )}

        {/* Actions */}
        <TouchableOpacity
          style={[styles.deleteBtn, { borderColor: colors.destructive + "40" }]}
          onPress={handleDelete}
        >
          <Ionicons name="trash-outline" size={18} color={colors.destructive} />
          <Text style={[styles.deleteBtnText, { color: colors.destructive }]}>Delete Record</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  notFound: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  notFoundText: { fontSize: 16, fontFamily: "Inter_400Regular" },
  backLink: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  toolBtn: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  toolbarTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  hero: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 12,
    marginHorizontal: 16,
    borderRadius: 20,
    marginBottom: 4,
  },
  heroTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  body: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  section: { padding: 16, borderRadius: 16, borderWidth: 1, gap: 12 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionIconBox: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  detailList: { gap: 0 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1 },
  detailLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  detailValue: { fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "right", flex: 1, marginLeft: 16 },
  reasonsList: { gap: 10 },
  reasonRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  reasonText: { fontSize: 14, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 20 },
  warningsBox: { flexDirection: "row", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1, alignItems: "flex-start" },
  warningsList: { flex: 1, gap: 4 },
  warningText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  deleteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 12, borderWidth: 1 },
  deleteBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
