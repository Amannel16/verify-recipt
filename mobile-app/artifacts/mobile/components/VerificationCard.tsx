import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { VerificationRecord } from "@/contexts/VerificationContext";
import { useColors } from "@/hooks/useColors";
import { StatusBadge } from "./StatusBadge";

interface Props {
  record: VerificationRecord;
}

export function VerificationCard({ record }: Props) {
  const colors = useColors();
  const router = useRouter();

  const iconColor =
    record.status === "approved" ? colors.success
    : record.status === "suspicious" ? colors.warning
    : colors.destructive;

  const iconName =
    record.status === "approved" ? "shield-checkmark"
    : record.status === "suspicious" ? "alert-circle"
    : "shield-outline";

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push(`/verify/${record.id}` as never)}
      activeOpacity={0.7}
    >
      <View style={[styles.iconBox, { backgroundColor: iconColor + "18" }]}>
        <Ionicons name={iconName as never} size={22} color={iconColor} />
      </View>
      <View style={styles.content}>
        <View style={styles.row}>
          <Text style={[styles.sender, { color: colors.foreground }]} numberOfLines={1}>
            {record.senderName}
          </Text>
          <Text style={[styles.amount, { color: colors.foreground }]}>
            ${record.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={[styles.txnId, { color: colors.mutedForeground }]}>{record.transactionId}</Text>
          <StatusBadge status={record.status} size="sm" />
        </View>
        <View style={styles.row}>
          <Text style={[styles.meta, { color: colors.mutedForeground }]}>
            {record.date} · {record.paymentMethod}
          </Text>
          <Text style={[styles.meta, { color: colors.mutedForeground }]}>{record.confidence}%</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
    marginBottom: 10,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  content: { flex: 1, gap: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sender: { fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1, marginRight: 8 },
  amount: { fontSize: 14, fontFamily: "Inter_700Bold" },
  txnId: { fontSize: 12, fontFamily: "Inter_400Regular" },
  meta: { fontSize: 11, fontFamily: "Inter_400Regular" },
});
