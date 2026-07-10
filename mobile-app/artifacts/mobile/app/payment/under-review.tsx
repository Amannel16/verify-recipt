import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

export default function UnderReviewScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad, paddingBottom: bottomPad }]}>
      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: colors.warning + "20" }]}>
          <Ionicons name="time-outline" size={64} color={colors.warning} />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>Payment Under Review</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Your payment receipt has been submitted successfully. An administrator will review your payment and approve your subscription shortly.
        </Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          onPress={() => {
            router.dismissAll();
            router.replace("/(tabs)");
          }}
        >
          <Text style={styles.primaryBtnText}>Return to Dashboard</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  footer: {
    paddingBottom: 32,
  },
  primaryBtn: {
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    height: 56,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
});
