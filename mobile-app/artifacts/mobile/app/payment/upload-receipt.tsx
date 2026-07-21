import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { api } from "@/utils/api";
import { useAuth } from "@/contexts/AuthContext";

export default function UploadReceiptScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { plan } = useLocalSearchParams<{ plan: string }>();
  const { refreshUser } = useAuth();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!imageUri && !receiptUrl) {
      Alert.alert("Error", "Please provide a receipt image or a URL.");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("plan", plan || "PRO");
      if (receiptUrl) {
        formData.append("receiptUrl", receiptUrl);
      }

      if (imageUri) {
        let cleanUri = decodeURIComponent(imageUri);
        if (Platform.OS === "android" && !cleanUri.startsWith("file://") && cleanUri.startsWith("file:")) {
          cleanUri = cleanUri.replace("file:", "file://");
        }
        const uriParts = cleanUri.split("/");
        const fileName = uriParts[uriParts.length - 1] || "receipt.jpg";
        const ext = fileName.split(".").pop()?.toLowerCase() || "jpg";
        const mimeTypes: Record<string, string> = {
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          png: "image/png",
          webp: "image/webp",
        };
        formData.append("recieptImage", {
          uri: cleanUri,
          name: fileName,
          type: mimeTypes[ext] || "image/jpeg",
        } as unknown as Blob);
      }

      const response = await api.request("POST", "/subscription/upgrade", {
        body: formData,
        isFormData: true,
        requireAuth: true,
      });

      if (response.success) {
        await refreshUser();
        router.replace("/payment/under-review" as any);
      } else {
        Alert.alert("Error", response.message || "Failed to submit receipt");
      }
    } catch (e) {
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const isSubmitDisabled = (!imageUri && !receiptUrl.trim()) || loading;

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
        <Text style={[styles.title, { color: colors.foreground }]}>Upload Receipt</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Please upload a screenshot of your transaction receipt or provide a valid receipt URL.
        </Text>

        <TouchableOpacity
          style={[
            styles.imagePicker,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onPress={handlePickImage}
        >
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.imagePreview} />
          ) : (
            <View style={styles.placeholderContainer}>
              <Ionicons name="cloud-upload-outline" size={32} color={colors.primary} />
              <Text style={[styles.placeholderText, { color: colors.foreground }]}>
                Tap to upload receipt image
              </Text>
            </View>
          )}
        </TouchableOpacity>
        {imageUri && (
          <TouchableOpacity onPress={() => setImageUri(null)} style={styles.removeImage}>
            <Text style={{ color: colors.destructive, fontFamily: "Inter_600SemiBold" }}>
              Remove Image
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.dividerContainer}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.mutedForeground, backgroundColor: colors.background }]}>
            OR
          </Text>
        </View>

        <View style={styles.inputContainer}>
          <Text style={[styles.inputLabel, { color: colors.foreground }]}>Receipt URL</Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground },
            ]}
            placeholder="https://..."
            placeholderTextColor={colors.mutedForeground}
            value={receiptUrl}
            onChangeText={setReceiptUrl}
            autoCapitalize="none"
          />
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.primaryBtn,
            { backgroundColor: isSubmitDisabled ? colors.primary + "80" : colors.primary },
          ]}
          onPress={handleSubmit}
          disabled={isSubmitDisabled}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryBtnText}>Submit Payment</Text>
          )}
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
  imagePicker: {
    height: 200,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: "dashed",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderContainer: {
    alignItems: "center",
    gap: 12,
  },
  placeholderText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  imagePreview: {
    width: "100%",
    height: "100%",
  },
  removeImage: {
    alignItems: "flex-end",
    marginTop: -16,
  },
  dividerContainer: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    marginVertical: 8,
  },
  dividerLine: {
    position: "absolute",
    width: "100%",
    height: 1,
  },
  dividerText: {
    paddingHorizontal: 12,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  inputContainer: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  input: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  footer: { paddingHorizontal: 20, marginTop: 40 },
  primaryBtn: {
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    height: 56,
  },
  primaryBtnText: { color: "#FFFFFF", fontSize: 16, fontFamily: "Inter_700Bold" },
});
