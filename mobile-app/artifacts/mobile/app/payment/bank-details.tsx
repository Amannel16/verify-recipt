import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

export default function BankDetailsScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ plan: string; price: string }>();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: bottomPad + 32, paddingTop: topPad + 16 }}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>Bank Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Please transfer the required amount to the following bank account to upgrade to the{" "}
          <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold" }}>
            {params.plan?.toUpperCase()}
          </Text>{" "}
          plan.
        </Text>

        <View style={[styles.amountCard, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "40" }]}>
          <Text style={[styles.amountLabel, { color: colors.primary }]}>Amount to Pay</Text>
          <Text style={[styles.amountValue, { color: colors.primary }]}>{params.price}</Text>
        </View>

        <View style={styles.bankCards}>
          <View style={[styles.bankCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.bankName, { color: colors.foreground }]}>Commercial Bank of Ethiopia</Text>
            <View style={styles.row}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Account Name:</Text>
              <Text style={[styles.value, { color: colors.foreground }]}>CB Project Tech LLC</Text>
            </View>
            <View style={styles.row}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Account Number:</Text>
              <Text style={[styles.value, { color: colors.foreground }]}>1000123456789</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          onPress={() => {
            router.push({
              pathname: "/payment/upload-receipt",
              params: { plan: params.plan }
            } as any);
          }}
        >
          <Text style={styles.primaryBtnText}>I Have Paid</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 24,
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
  content: { paddingHorizontal: 20, gap: 24 },
  subtitle: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },
  amountCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    gap: 8,
  },
  amountLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  amountValue: { fontSize: 36, fontFamily: "Inter_700Bold" },
  bankCards: { gap: 16 },
  bankCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  bankName: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { fontSize: 14, fontFamily: "Inter_400Regular" },
  value: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  footer: { paddingHorizontal: 20, marginTop: 40 },
  primaryBtn: {
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  primaryBtnText: { color: "#FFFFFF", fontSize: 16, fontFamily: "Inter_700Bold" },
});
