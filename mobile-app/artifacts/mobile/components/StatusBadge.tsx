import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { VerificationStatus } from "@/contexts/VerificationContext";
import { useColors } from "@/hooks/useColors";

interface Props {
  status: VerificationStatus;
  size?: "sm" | "md" | "lg";
}

export function StatusBadge({ status, size = "md" }: Props) {
  const colors = useColors();

  const config = {
    approved: {
      label: "Approved",
      icon: "checkmark-circle" as const,
      color: colors.success,
      bg: colors.approved_bg,
    },
    suspicious: {
      label: "Suspicious",
      icon: "warning" as const,
      color: colors.warning,
      bg: colors.suspicious_bg,
    },
    rejected: {
      label: "Rejected",
      icon: "close-circle" as const,
      color: colors.destructive,
      bg: colors.rejected_bg,
    },
  }[status];

  const iconSize = size === "sm" ? 12 : size === "lg" ? 20 : 14;
  const fontSize = size === "sm" ? 11 : size === "lg" ? 15 : 12;
  const paddingH = size === "sm" ? 8 : size === "lg" ? 14 : 10;
  const paddingV = size === "sm" ? 3 : size === "lg" ? 7 : 4;

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: config.bg,
          paddingHorizontal: paddingH,
          paddingVertical: paddingV,
          borderRadius: 100,
          borderColor: config.color + "40",
        },
      ]}
    >
      <Ionicons name={config.icon} size={iconSize} color={config.color} />
      <Text style={[styles.label, { color: config.color, fontSize }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  label: {
    fontFamily: "Inter_600SemiBold",
  },
});
