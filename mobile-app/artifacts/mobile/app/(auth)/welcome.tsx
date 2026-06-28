import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const FEATURES = [
  { icon: "camera", label: "Scan receipts instantly", color: "#2563EB" },
  { icon: "shield-checkmark", label: "AI-powered fraud detection", color: "#10B981" },
  { icon: "bar-chart", label: "Business insights & reports", color: "#F59E0B" },
];

export default function WelcomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.primary + "20", colors.background]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
      />

      <View style={[styles.content, { paddingTop: topPad + 40, paddingBottom: bottomPad + 24 }]}>
        {/* Logo */}
        <View style={styles.logoSection}>
          <View style={[styles.logoBox, { backgroundColor: colors.primary }]}>
            <MaterialCommunityIcons name="shield-check" size={40} color="#FFFFFF" />
          </View>
          <Text style={[styles.appName, { color: colors.foreground }]}>PayVerify AI</Text>
          <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
            Intelligent payment verification{"\n"}for modern businesses
          </Text>
        </View>

        {/* Feature pills */}
        <View style={styles.features}>
          {FEATURES.map((f) => (
            <View key={f.label} style={[styles.featurePill, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.featureIconBox, { backgroundColor: f.color + "20" }]}>
                <Ionicons name={f.icon as never} size={20} color={f.color} />
              </View>
              <Text style={[styles.featureLabel, { color: colors.foreground }]}>{f.label}</Text>
            </View>
          ))}
        </View>

        {/* Trust badge */}
        <View style={[styles.trustBadge, { backgroundColor: colors.success + "15", borderColor: colors.success + "30" }]}>
          <Ionicons name="shield-checkmark" size={14} color={colors.success} />
          <Text style={[styles.trustText, { color: colors.success }]}>Trusted by 5,000+ businesses worldwide</Text>
        </View>

        {/* CTAs */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/(auth)/sign-up")}
            activeOpacity={0.85}
          >
            <Ionicons name="rocket-outline" size={18} color={colors.primaryForeground} />
            <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>Get Started Free</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryBtn, { borderColor: colors.border }]}
            onPress={() => router.push("/(auth)/sign-in")}
            activeOpacity={0.7}
          >
            <Ionicons name="log-in-outline" size={18} color={colors.foreground} />
            <Text style={[styles.secondaryBtnText, { color: colors.foreground }]}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 28, justifyContent: "space-between" },
  logoSection: { alignItems: "center", gap: 16 },
  logoBox: {
    width: 88,
    height: 88,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  appName: { fontSize: 32, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  tagline: { fontSize: 16, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 24 },
  features: { gap: 10 },
  featurePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  featureIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  featureLabel: { fontSize: 15, fontFamily: "Inter_500Medium", flex: 1 },
  trustBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  trustText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  actions: { gap: 12 },
  primaryBtn: {
    padding: 18,
    borderRadius: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  primaryBtnText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  secondaryBtn: {
    padding: 18,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1.5,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  secondaryBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
