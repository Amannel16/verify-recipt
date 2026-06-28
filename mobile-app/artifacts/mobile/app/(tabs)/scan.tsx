import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  withSequence,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { useVerifications } from "@/contexts/VerificationContext";
import { useColors } from "@/hooks/useColors";
import { analyzeReceipt } from "@/utils/verificationEngine";

type Phase = "idle" | "selected" | "analyzing" | "done";

export default function ScanScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addVerification } = useVerifications();
  const { user } = useAuth();

  const [phase, setPhase] = useState<Phase>("idle");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [resultId, setResultId] = useState<string | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const pulse = useSharedValue(1);
  const rotation = useSharedValue(0);

  function startAnalysisAnimations() {
    pulse.value = withRepeat(withSequence(withTiming(1.08, { duration: 600 }), withTiming(1, { duration: 600 })), -1);
    rotation.value = withRepeat(withTiming(360, { duration: 2000, easing: Easing.linear }), -1);
  }

  function stopAnalysisAnimations() {
    pulse.value = withTiming(1);
    rotation.value = withTiming(0);
  }

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  const rotStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  async function pickFromCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Camera access is needed to scan receipts.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.5,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setPhase("selected");
    }
  }

  async function pickFromGallery() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.5,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setPhase("selected");
    }
  }

  async function startAnalysis() {
    if (!imageUri) return;
    if (user?.plan === "free" && user.verificationsUsed >= user.verificationsLimit) {
      Alert.alert(
        "Limit Reached",
        "You've used all your free verifications this month. Upgrade to Pro for unlimited access.",
        [
          { text: "Upgrade", onPress: () => router.push("/subscription") },
          { text: "Cancel", style: "cancel" },
        ]
      );
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase("analyzing");
    startAnalysisAnimations();

    try {
      const result = await analyzeReceipt(imageUri);
      await addVerification({
        id: result.id,
        imageUri,
        ...result,
        createdAt: new Date().toISOString(),
      });
      stopAnalysisAnimations();
      Haptics.notificationAsync(
        result.status === "approved"
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning
      );
      setResultId(result.id);
      setPhase("done");
    } catch (e) {
      stopAnalysisAnimations();
      setPhase("selected");
      const message = e instanceof Error ? e.message : "Could not analyze the receipt. Please try again.";
      Alert.alert("Analysis Failed", message);
    }
  }

  function reset() {
    setPhase("idle");
    setImageUri(null);
    setResultId(null);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <LinearGradient
        colors={[colors.primary + "20", colors.background]}
        style={[styles.header, { paddingTop: topPad + 20 }]}
      >
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Scan Receipt</Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
          Verify payment authenticity with AI
        </Text>
      </LinearGradient>

      <View style={[styles.body, { paddingBottom: bottomPad + 100 }]}>
        {phase === "idle" && (
          <>
            {/* Pick options */}
            <View style={[styles.dropzone, { borderColor: colors.primary + "50", backgroundColor: colors.primary + "08" }]}>
              <View style={[styles.scanIcon, { backgroundColor: colors.primary + "20" }]}>
                <MaterialCommunityIcons name="file-search-outline" size={48} color={colors.primary} />
              </View>
              <Text style={[styles.dropTitle, { color: colors.foreground }]}>Upload a Receipt</Text>
              <Text style={[styles.dropSub, { color: colors.mutedForeground }]}>
                Take a photo, upload from gallery, or import an image
              </Text>
            </View>

            <View style={styles.optionGrid}>
              <TouchableOpacity
                style={[styles.optionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={pickFromCamera}
                activeOpacity={0.75}
              >
                <View style={[styles.optionIcon, { backgroundColor: colors.primary + "15" }]}>
                  <Ionicons name="camera-outline" size={28} color={colors.primary} />
                </View>
                <Text style={[styles.optionLabel, { color: colors.foreground }]}>Camera</Text>
                <Text style={[styles.optionSub, { color: colors.mutedForeground }]}>Take a photo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.optionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={pickFromGallery}
                activeOpacity={0.75}
              >
                <View style={[styles.optionIcon, { backgroundColor: colors.success + "15" }]}>
                  <Ionicons name="images-outline" size={28} color={colors.success} />
                </View>
                <Text style={[styles.optionLabel, { color: colors.foreground }]}>Gallery</Text>
                <Text style={[styles.optionSub, { color: colors.mutedForeground }]}>Choose image</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.optionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => Alert.alert("Coming Soon", "PDF import will be available in a future update.")}
                activeOpacity={0.75}
              >
                <View style={[styles.optionIcon, { backgroundColor: colors.warning + "15" }]}>
                  <Ionicons name="document-outline" size={28} color={colors.warning} />
                </View>
                <Text style={[styles.optionLabel, { color: colors.foreground }]}>PDF</Text>
                <Text style={[styles.optionSub, { color: colors.mutedForeground }]}>Import receipt</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {phase === "selected" && imageUri && (
          <View style={styles.selectedView}>
            <Image source={{ uri: imageUri }} style={[styles.preview, { borderColor: colors.border }]} resizeMode="cover" />
            <TouchableOpacity
              style={[styles.analyzeBtn, { backgroundColor: colors.primary }]}
              onPress={startAnalysis}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="shield-search" size={22} color="#FFFFFF" />
              <Text style={styles.analyzeBtnText}>Analyze Receipt</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={reset}>
              <Text style={[styles.retryLink, { color: colors.mutedForeground }]}>Choose different image</Text>
            </TouchableOpacity>
          </View>
        )}

        {phase === "analyzing" && (
          <View style={styles.analyzingView}>
            <Animated.View style={pulseStyle}>
              <View style={[styles.analyzeRing, { borderColor: colors.primary + "30" }]}>
                <View style={[styles.analyzeRingInner, { borderColor: colors.primary + "60" }]}>
                  <Animated.View style={rotStyle}>
                    <MaterialCommunityIcons name="shield-search" size={48} color={colors.primary} />
                  </Animated.View>
                </View>
              </View>
            </Animated.View>
            <Text style={[styles.analyzingTitle, { color: colors.foreground }]}>Analyzing Receipt...</Text>
            <Text style={[styles.analyzingSub, { color: colors.mutedForeground }]}>
              AI is examining the payment details,{"\n"}checking for fraud indicators
            </Text>
            <View style={styles.stepsList}>
              {["Extracting transaction data", "Checking authenticity", "Fraud pattern detection", "Generating report"].map((step, i) => (
                <View key={step} style={styles.stepRow}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[styles.stepText, { color: colors.mutedForeground }]}>{step}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {phase === "done" && resultId && (
          <View style={styles.doneView}>
            <View style={[styles.doneIcon, { backgroundColor: colors.success + "20" }]}>
              <Ionicons name="checkmark-circle" size={64} color={colors.success} />
            </View>
            <Text style={[styles.doneTitle, { color: colors.foreground }]}>Analysis Complete</Text>
            <Text style={[styles.doneSub, { color: colors.mutedForeground }]}>
              Your verification report is ready
            </Text>
            <TouchableOpacity
              style={[styles.viewResultBtn, { backgroundColor: colors.primary }]}
              onPress={() => {
                router.push(`/verify/${resultId}` as never);
                reset();
              }}
            >
              <Text style={styles.viewResultBtnText}>View Result</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={reset} style={[styles.scanAnotherBtn, { borderColor: colors.border }]}>
              <Text style={[styles.scanAnotherText, { color: colors.foreground }]}>Scan Another</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerTitle: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  headerSub: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 4 },
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  dropzone: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  scanIcon: { width: 80, height: 80, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  dropTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  dropSub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  optionGrid: { flexDirection: "row", gap: 12 },
  optionCard: {
    flex: 1, padding: 16, borderRadius: 16, borderWidth: 1,
    alignItems: "center", gap: 8,
  },
  optionIcon: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  optionLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  optionSub: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center" },
  selectedView: { alignItems: "center", gap: 20 },
  preview: {
    width: "100%", height: 280, borderRadius: 20, borderWidth: 1,
  },
  analyzeBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 18, paddingHorizontal: 40, borderRadius: 16,
  },
  analyzeBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#FFFFFF" },
  retryLink: { fontSize: 14, fontFamily: "Inter_400Regular" },
  analyzingView: { flex: 1, alignItems: "center", justifyContent: "center", gap: 20 },
  analyzeRing: { width: 160, height: 160, borderRadius: 80, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  analyzeRingInner: { width: 120, height: 120, borderRadius: 60, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  analyzingTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  analyzingSub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  stepsList: { gap: 10, width: "100%", paddingHorizontal: 20 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  doneView: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  doneIcon: { width: 120, height: 120, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  doneTitle: { fontSize: 24, fontFamily: "Inter_700Bold" },
  doneSub: { fontSize: 14, fontFamily: "Inter_400Regular" },
  viewResultBtn: { paddingVertical: 18, paddingHorizontal: 48, borderRadius: 16 },
  viewResultBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#FFFFFF" },
  scanAnotherBtn: { paddingVertical: 14, paddingHorizontal: 40, borderRadius: 14, borderWidth: 1.5 },
  scanAnotherText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
