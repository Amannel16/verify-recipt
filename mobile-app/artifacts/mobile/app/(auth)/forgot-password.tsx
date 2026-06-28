import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

export default function ForgotPasswordScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  async function handleReset() {
    if (!email.trim()) {
      Alert.alert("Required", "Please enter your email address.");
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1500));
    setLoading(false);
    setSent(true);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad + 16 }]}>
      <View style={styles.inner}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>

        <View style={[styles.iconBox, { backgroundColor: colors.primary + "15" }]}>
          <MaterialCommunityIcons name="shield-lock-outline" size={40} color={colors.primary} />
        </View>

        {sent ? (
          <>
            <Text style={[styles.title, { color: colors.foreground }]}>Check your inbox</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              We've sent a password reset link to{"\n"}<Text style={{ color: colors.primary }}>{email}</Text>
            </Text>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.primary }]}
              onPress={() => router.push("/(auth)/sign-in")}
            >
              <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Back to Sign In</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={[styles.title, { color: colors.foreground }]}>Forgot password?</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Enter your email and we'll send you a reset link
            </Text>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Email Address</Text>
              <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="mail-outline" size={18} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder="you@company.com"
                  placeholderTextColor={colors.mutedForeground}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.btn, { backgroundColor: loading ? colors.primary + "80" : colors.primary }]}
              onPress={handleReset}
              disabled={loading}
            >
              <Text style={[styles.btnText, { color: colors.primaryForeground }]}>
                {loading ? "Sending..." : "Send Reset Link"}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { paddingHorizontal: 28, gap: 20 },
  backBtn: { marginBottom: 12 },
  iconBox: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5, marginTop: 8 },
  subtitle: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },
  fieldGroup: { gap: 8 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium" },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  btn: { padding: 18, borderRadius: 14, alignItems: "center" },
  btnText: { fontSize: 16, fontFamily: "Inter_700Bold" },
});
