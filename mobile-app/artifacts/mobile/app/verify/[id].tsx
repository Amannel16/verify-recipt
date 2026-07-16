import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
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
import type { FieldMatch } from "@/contexts/VerificationContext";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function VerifyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { verifications, deleteVerification } = useVerifications();
  const [imageModalVisible, setImageModalVisible] = useState(false);

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

  const crossMatchColor = (match: string) => {
    switch (match) {
      case "MATCH": return colors.success;
      case "PARTIAL_MATCH": return colors.warning;
      case "MISMATCH": return colors.destructive;
      default: return colors.mutedForeground;
    }
  };

  const crossMatchIcon = (match: string): string => {
    switch (match) {
      case "MATCH": return "checkmark-circle";
      case "PARTIAL_MATCH": return "alert-circle";
      case "MISMATCH": return "close-circle";
      default: return "help-circle";
    }
  };

  async function handleShare() {
    if (user?.plan === "free") {
      Alert.alert(
        "Premium Feature",
        "Exporting and sharing detailed PDF reports is only available on Pro or Enterprise plans.",
        [
          { text: "Upgrade Plan", onPress: () => router.push("/subscription") },
          { text: "Cancel", style: "cancel" },
        ]
      );
      return;
    }

    try {
      await Share.share({
        message: `PayVerify AI Report\n\nStatus: ${record.status.toUpperCase()}\nConfidence: ${record.confidence}%\nTransaction: ${record.transactionId}\nAmount: ${record.amount.toLocaleString()} ${record.currency}\nSender: ${record.senderName}\nReceiver: ${record.receiverName}\nDate: ${record.date} ${record.time}${record.crossValidation ? `\n\nCross-Validation: ${record.crossValidation.overallMatch} (${record.crossValidation.crossValidationScore}%)` : ""}`,
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
    { label: "Amount", value: `${record.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} ${record.currency}` },
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
        {record.isDuplicate && (
          user?.plan === "free" ? (
            <TouchableOpacity
              style={[styles.duplicateBadge, { backgroundColor: colors.warning + "15", flexDirection: "row", alignItems: "center", gap: 4 }]}
              onPress={() => router.push("/subscription")}
              activeOpacity={0.7}
            >
              <Ionicons name="lock-closed-outline" size={12} color={colors.warning} />
              <Text style={[styles.duplicateText, { color: colors.warning }]}>Duplicate Check (Pro)</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.duplicateBadge, { backgroundColor: colors.destructive + "20" }]}>
              <Ionicons name="copy-outline" size={14} color={colors.destructive} />
              <Text style={[styles.duplicateText, { color: colors.destructive }]}>Duplicate Receipt Detected</Text>
            </View>
          )
        )}
      </View>

      <View style={styles.body}>
        {/* Receipt Screenshot */}
        {record.imageUri && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionIconBox, { backgroundColor: colors.primary + "18" }]}>
                <Ionicons name="image-outline" size={16} color={colors.primary} />
              </View>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Receipt Screenshot</Text>
            </View>
            <Pressable onPress={() => setImageModalVisible(true)}>
              <Image
                source={{ uri: record.imageUri }}
                style={[styles.receiptImage, { borderColor: colors.border }]}
                resizeMode="contain"
              />
              <View style={[styles.tapHint, { backgroundColor: colors.primary + "15" }]}>
                <Ionicons name="expand-outline" size={14} color={colors.primary} />
                <Text style={[styles.tapHintText, { color: colors.primary }]}>Tap to enlarge</Text>
              </View>
            </Pressable>
          </View>
        )}

        {/* Full-screen Image Modal */}
        <Modal visible={imageModalVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={styles.modalClose} onPress={() => setImageModalVisible(false)}>
              <Ionicons name="close-circle" size={36} color="#FFFFFF" />
            </TouchableOpacity>
            {record.imageUri && (
              <Image
                source={{ uri: record.imageUri }}
                style={styles.modalImage}
                resizeMode="contain"
              />
            )}
          </View>
        </Modal>

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

        {/* Cross-Validation Section */}
        {record.crossValidation && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, overflow: "hidden" }]}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionIconBox, { backgroundColor: crossMatchColor(record.crossValidation.overallMatch) + "18" }]}>
                <MaterialCommunityIcons name="compare-horizontal" size={16} color={crossMatchColor(record.crossValidation.overallMatch)} />
              </View>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Cross-Validation</Text>
              {user?.plan !== "free" && (
                <View style={[styles.matchBadge, { backgroundColor: crossMatchColor(record.crossValidation.overallMatch) + "20" }]}>
                  <Text style={[styles.matchBadgeText, { color: crossMatchColor(record.crossValidation.overallMatch) }]}>
                    {record.crossValidation.overallMatch.replace(/_/g, " ")}
                  </Text>
                </View>
              )}
            </View>

            {user?.plan === "free" ? (
              <View style={styles.lockOverlayContainer}>
                <View style={[styles.lockIconBox, { backgroundColor: colors.primary + "15" }]}>
                  <Ionicons name="lock-closed" size={22} color={colors.primary} />
                </View>
                <Text style={[styles.lockTitle, { color: colors.foreground }]}>Advanced AI Cross-Validation</Text>
                <Text style={[styles.lockSubtitle, { color: colors.mutedForeground }]}>
                  Real-time bank portal verification and OCR reconciliation is locked on the Free tier.
                </Text>
                <TouchableOpacity
                  style={[styles.lockBtn, { backgroundColor: colors.primary }]}
                  onPress={() => router.push("/subscription")}
                  activeOpacity={0.8}
                >
                  <Text style={styles.lockBtnText}>Unlock with Pro</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* Score bar */}
                <View style={styles.crossScoreRow}>
                  <Text style={[styles.crossScoreLabel, { color: colors.mutedForeground }]}>
                    Validation Score
                  </Text>
                  <Text style={[styles.crossScoreValue, { color: crossMatchColor(record.crossValidation.overallMatch) }]}>
                    {record.crossValidation.crossValidationScore}%
                  </Text>
                </View>
                <View style={[styles.crossScoreBarBg, { backgroundColor: colors.border }]}>
                  <View
                    style={[
                      styles.crossScoreBarFill,
                      {
                        width: `${record.crossValidation.crossValidationScore}%`,
                        backgroundColor: crossMatchColor(record.crossValidation.overallMatch),
                      },
                    ]}
                  />
                </View>

                {/* Field-by-field comparison */}
                <Text style={[styles.crossSubtitle, { color: colors.foreground }]}>
                  Field Comparison: AI vs URL
                </Text>
                {record.crossValidation.fieldMatches.map((fm: FieldMatch, i: number) => (
                  <View key={i} style={[styles.fieldMatchRow, { borderBottomColor: colors.border }]}>
                    <View style={styles.fieldMatchHeader}>
                      <Ionicons
                        name={fm.matches ? "checkmark-circle" : "close-circle"}
                        size={18}
                        color={fm.matches ? colors.success : colors.destructive}
                      />
                      <Text style={[styles.fieldMatchName, { color: colors.foreground }]}>{fm.field}</Text>
                      <Text style={[styles.fieldMatchConf, { color: fm.matches ? colors.success : colors.destructive }]}>
                        {fm.confidence}%
                      </Text>
                    </View>
                    <View style={styles.fieldMatchValues}>
                      <View style={styles.fieldMatchCol}>
                        <Text style={[styles.fieldMatchLabel, { color: colors.mutedForeground }]}>AI Extracted</Text>
                        <Text style={[styles.fieldMatchVal, { color: colors.foreground }]}>
                          {fm.aiValue != null ? String(fm.aiValue) : "—"}
                        </Text>
                      </View>
                      <Ionicons name="swap-horizontal" size={16} color={colors.mutedForeground} style={{ marginTop: 16 }} />
                      <View style={styles.fieldMatchCol}>
                        <Text style={[styles.fieldMatchLabel, { color: colors.mutedForeground }]}>URL Verified</Text>
                        <Text style={[styles.fieldMatchVal, { color: colors.foreground }]}>
                          {fm.scrapedValue != null ? String(fm.scrapedValue) : "—"}
                        </Text>
                      </View>
                    </View>
                    {fm.note && (
                      <Text style={[styles.fieldMatchNote, { color: colors.mutedForeground }]}>{fm.note}</Text>
                    )}
                  </View>
                ))}

                {/* Discrepancies */}
                {record.crossValidation.discrepancies.length > 0 && (
                  <View style={[styles.discrepancyBox, { backgroundColor: colors.destructive + "10", borderColor: colors.destructive + "30" }]}>
                    <Ionicons name="alert-circle" size={16} color={colors.destructive} />
                    <View style={styles.discrepancyList}>
                      {record.crossValidation.discrepancies.map((d, i) => (
                        <Text key={i} style={[styles.discrepancyText, { color: colors.destructive }]}>{d}</Text>
                      ))}
                    </View>
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {/* URL Verification Link */}
        {record.receiptUrl && (
          <TouchableOpacity
            style={[styles.urlBox, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "30" }]}
            onPress={() => Linking.openURL(record.receiptUrl!)}
          >
            <Ionicons name="link-outline" size={18} color={colors.primary} />
            <View style={styles.urlTextWrap}>
              <Text style={[styles.urlLabel, { color: colors.foreground }]}>Receipt Verification URL</Text>
              <Text style={[styles.urlValue, { color: colors.primary }]} numberOfLines={1}>{record.receiptUrl}</Text>
            </View>
            <Ionicons name="open-outline" size={16} color={colors.primary} />
          </TouchableOpacity>
        )}

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
  duplicateBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 4,
  },
  duplicateText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  body: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  section: { padding: 16, borderRadius: 16, borderWidth: 1, gap: 12 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionIconBox: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold", flex: 1 },

  // Receipt image
  receiptImage: {
    width: "100%",
    height: 260,
    borderRadius: 12,
    borderWidth: 1,
  },
  tapHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  tapHintText: { fontSize: 12, fontFamily: "Inter_500Medium" },

  // Image modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalClose: { position: "absolute", top: 50, right: 20, zIndex: 10 },
  modalImage: { width: "95%", height: "80%" },

  // Cross-validation
  matchBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  matchBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 0.5 },
  crossScoreRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  crossScoreLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  crossScoreValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  crossScoreBarBg: { height: 6, borderRadius: 3, overflow: "hidden" },
  crossScoreBarFill: { height: "100%", borderRadius: 3 },
  crossSubtitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  fieldMatchRow: { paddingVertical: 10, borderBottomWidth: 1, gap: 6 },
  fieldMatchHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  fieldMatchName: { fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1 },
  fieldMatchConf: { fontSize: 13, fontFamily: "Inter_700Bold" },
  fieldMatchValues: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingLeft: 26 },
  fieldMatchCol: { flex: 1 },
  fieldMatchLabel: { fontSize: 10, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  fieldMatchVal: { fontSize: 13, fontFamily: "Inter_500Medium" },
  fieldMatchNote: { fontSize: 11, fontFamily: "Inter_400Regular", paddingLeft: 26, fontStyle: "italic" },
  discrepancyBox: { flexDirection: "row", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, alignItems: "flex-start" },
  discrepancyList: { flex: 1, gap: 4 },
  discrepancyText: { fontSize: 12, fontFamily: "Inter_500Medium" },

  // URL box
  urlBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  urlTextWrap: { flex: 1 },
  urlLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  urlValue: { fontSize: 12, fontFamily: "Inter_400Regular" },

  // Existing styles
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
  lockOverlayContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    paddingHorizontal: 8,
    gap: 8,
  },
  lockIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  lockTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  lockSubtitle: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 16,
    paddingHorizontal: 12,
  },
  lockBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 4,
  },
  lockBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
});
