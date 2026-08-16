import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { api } from "@/utils/api";

interface FeedbackModalProps {
  visible: boolean;
  onClose: () => void;
  translationId?: string;
}

export function FeedbackModal({ visible, onClose, translationId }: FeedbackModalProps) {
  const colors = useColors();
  const [rating, setRating] = useState<number>(5);
  const [isHelpful, setIsHelpful] = useState<boolean>(true);
  const [flagReason, setFlagReason] = useState<string | null>(null);
  const [comment, setComment] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  const flagOptions = [
    { key: "inaccurate", label: "Inaccurate" },
    { key: "wrong_tone", label: "Wrong Tone" },
    { key: "grammar_issue", label: "Grammar Issue" },
    { key: "offensive", label: "Offensive" },
    { key: "other", label: "Other" },
  ];

  async function handleSubmit() {
    if (rating === 0) {
      Alert.alert("Rating Required", "Please tap a star (1 to 5) to rate your experience.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post("/feedback", {
        translationId: translationId || `app_fb_${Date.now()}`,
        rating,
        isHelpful,
        comment: comment.trim() || undefined,
        flagReason: flagReason || undefined,
      });

      if (res.success) {
        Alert.alert(
          "Feedback Received! 🙌",
          "Thank you for sharing your experience. Your feedback directly helps us train and improve Geba AI.",
          [
            {
              text: "OK",
              onPress: () => {
                resetForm();
                onClose();
              },
            },
          ]
        );
      } else {
        Alert.alert("Submission Failed", res.message || "Could not record feedback.");
      }
    } catch {
      Alert.alert("Error", "Network issue submitting feedback. Please check your connection.");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setRating(5);
    setIsHelpful(true);
    setFlagReason(null);
    setComment("");
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>Send Feedback</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Rating Stars */}
            <Text style={[styles.label, { color: colors.foreground }]}>
              How would you rate Geba AI?
            </Text>
            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setRating(star)} activeOpacity={0.7}>
                  <Ionicons
                    name={star <= rating ? "star" : "star-outline"}
                    size={32}
                    color={star <= rating ? "#F59E0B" : colors.mutedForeground}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* Helpful Toggle */}
            <Text style={[styles.label, { color: colors.foreground, marginTop: 16 }]}>
              Was the feature helpful?
            </Text>
            <View style={styles.helpfulRow}>
              <TouchableOpacity
                style={[
                  styles.helpfulBtn,
                  { backgroundColor: colors.background, borderColor: isHelpful ? colors.success : colors.border },
                ]}
                onPress={() => setIsHelpful(true)}
              >
                <Ionicons
                  name="thumbs-up"
                  size={18}
                  color={isHelpful ? colors.success : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.helpfulText,
                    { color: isHelpful ? colors.success : colors.mutedForeground },
                  ]}
                >
                  Helpful
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.helpfulBtn,
                  { backgroundColor: colors.background, borderColor: !isHelpful ? colors.destructive : colors.border },
                ]}
                onPress={() => setIsHelpful(false)}
              >
                <Ionicons
                  name="thumbs-down"
                  size={18}
                  color={!isHelpful ? colors.destructive : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.helpfulText,
                    { color: !isHelpful ? colors.destructive : colors.mutedForeground },
                  ]}
                >
                  Unhelpful
                </Text>
              </TouchableOpacity>
            </View>

            {/* Flag Issue Options */}
            <Text style={[styles.label, { color: colors.foreground, marginTop: 16 }]}>
              Category / Flag Issue (Optional)
            </Text>
            <View style={styles.tagWrap}>
              {flagOptions.map((opt) => {
                const active = flagReason === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      styles.tagPill,
                      {
                        backgroundColor: active ? colors.primary + "20" : colors.background,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setFlagReason(active ? null : opt.key)}
                  >
                    <Text
                      style={[
                        styles.tagLabel,
                        { color: active ? colors.primary : colors.mutedForeground },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Comments Area */}
            <Text style={[styles.label, { color: colors.foreground, marginTop: 16 }]}>
              Comments & Suggestions
            </Text>
            <TextInput
              style={[
                styles.textArea,
                { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground },
              ]}
              placeholder="Tell us what worked well or what needs improvement..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              value={comment}
              onChangeText={setComment}
            />

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: colors.primary }, submitting && { opacity: 0.6 }]}
              disabled={submitting}
              onPress={handleSubmit}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>Submit Feedback</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    maxHeight: "85%",
    paddingBottom: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  closeBtn: {
    padding: 4,
  },
  content: {
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 8,
  },
  starRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginVertical: 4,
  },
  helpfulRow: {
    flexDirection: "row",
    gap: 12,
  },
  helpfulBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  helpfulText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  tagWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tagPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  tagLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  textArea: {
    height: 90,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlignVertical: "top",
    marginBottom: 16,
  },
  submitBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
