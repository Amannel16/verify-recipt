import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BusinessType, useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

const BUSINESS_TYPES: BusinessType[] = [
  "Retail", "Restaurant", "E-commerce", "Services", "Healthcare", "Education", "Other",
];

export default function SignUpScreen() {
  const colors = useColors();
  const router = useRouter();
  const { signUp } = useAuth();
  const insets = useSafeAreaInsets();

  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [businessType, setBusinessType] = useState<BusinessType>("Retail");
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  async function handleSignUp() {
    if (!fullName.trim() || !businessName.trim() || !email.trim() || !password.trim()) {
      Alert.alert("Required", "Please fill in all fields.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Weak Password", "Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    const result = await signUp({
      fullName: fullName.trim(),
      businessName: businessName.trim(),
      email: email.trim(),
      password,
      businessType,
    });
    setLoading(false);
    if (!result.success) {
      Alert.alert("Sign Up Failed", result.error || "Please try again.");
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPad + 16, paddingBottom: bottomPad + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>

        <View style={styles.logoRow}>
          <View style={[styles.logoBox, { backgroundColor: colors.primary }]}>
            <MaterialCommunityIcons name="shield-check" size={24} color="#FFFFFF" />
          </View>
          <Text style={[styles.logoText, { color: colors.foreground }]}>PayVerify AI</Text>
        </View>

        <Text style={[styles.title, { color: colors.foreground }]}>Create account</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Start verifying payments in minutes
        </Text>

        <View style={styles.form}>
          {[
            { label: "Full Name", value: fullName, setter: setFullName, placeholder: "John Smith", icon: "person-outline", keyboardType: "default" as const },
            { label: "Business Name", value: businessName, setter: setBusinessName, placeholder: "Acme Corp", icon: "business-outline", keyboardType: "default" as const },
            { label: "Email", value: email, setter: setEmail, placeholder: "you@company.com", icon: "mail-outline", keyboardType: "email-address" as const },
          ].map((field) => (
            <View key={field.label} style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>{field.label}</Text>
              <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name={field.icon as never} size={18} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder={field.placeholder}
                  placeholderTextColor={colors.mutedForeground}
                  value={field.value}
                  onChangeText={field.setter}
                  keyboardType={field.keyboardType}
                  autoCapitalize={field.keyboardType === "email-address" ? "none" : "words"}
                  autoCorrect={false}
                />
              </View>
            </View>
          ))}

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Password</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="Min. 6 characters"
                placeholderTextColor={colors.mutedForeground}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Business Type</Text>
            <TouchableOpacity
              style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => setShowTypePicker(!showTypePicker)}
            >
              <Ionicons name="briefcase-outline" size={18} color={colors.mutedForeground} />
              <Text style={[styles.input, { color: colors.foreground }]}>{businessType}</Text>
              <Ionicons
                name={showTypePicker ? "chevron-up" : "chevron-down"}
                size={18}
                color={colors.mutedForeground}
              />
            </TouchableOpacity>
            {showTypePicker && (
              <View style={[styles.picker, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {BUSINESS_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.pickerItem,
                      type === businessType && { backgroundColor: colors.primary + "15" },
                    ]}
                    onPress={() => { setBusinessType(type); setShowTypePicker(false); }}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        { color: type === businessType ? colors.primary : colors.foreground },
                      ]}
                    >
                      {type}
                    </Text>
                    {type === businessType && (
                      <Ionicons name="checkmark" size={16} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[styles.signUpBtn, { backgroundColor: loading ? colors.primary + "80" : colors.primary }]}
            onPress={handleSignUp}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={[styles.signUpBtnText, { color: colors.primaryForeground }]}>
              {loading ? "Creating Account..." : "Create Account"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.signInRow}>
          <Text style={[styles.signInText, { color: colors.mutedForeground }]}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.push("/(auth)/sign-in")}>
            <Text style={[styles.signInLink, { color: colors.primary }]}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 28, flexGrow: 1 },
  backBtn: { marginBottom: 24 },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 28 },
  logoBox: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  logoText: { fontSize: 18, fontFamily: "Inter_700Bold" },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  subtitle: { fontSize: 15, fontFamily: "Inter_400Regular", marginTop: 6, marginBottom: 28 },
  form: { gap: 16 },
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
  picker: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    marginTop: -4,
  },
  pickerItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  pickerItemText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  signUpBtn: { padding: 18, borderRadius: 14, alignItems: "center", marginTop: 8 },
  signUpBtnText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  signInRow: { flexDirection: "row", justifyContent: "center", marginTop: 28 },
  signInText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  signInLink: { fontSize: 14, fontFamily: "Inter_700Bold" },
});
