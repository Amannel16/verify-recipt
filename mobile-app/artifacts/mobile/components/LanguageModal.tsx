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

interface LanguageModalProps {
  visible: boolean;
  onClose: () => void;
  currentLanguage: string;
  onSelectLanguage: (lang: string) => void;
}

export function LanguageModal({
  visible,
  onClose,
  currentLanguage,
  onSelectLanguage,
}: LanguageModalProps) {
  const colors = useColors();
  const [activeTab, setActiveTab] = useState<"select" | "translator">("select");
  const [inputText, setInputText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [sourceLang, setSourceLang] = useState<"auto" | "en" | "am">("auto");
  const [targetLang, setTargetLang] = useState<"en" | "am">("am");
  const [detectedLang, setDetectedLang] = useState<string | null>(null);
  const [engine, setEngine] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleInputTextChange(text: string) {
    setInputText(text);
    if (sourceLang === "auto") {
      const hasEthiopic = /[\u1200-\u137F]/.test(text);
      if (text.trim().length > 0) {
        setDetectedLang(hasEthiopic ? "Amharic" : "English");
        setTargetLang(hasEthiopic ? "en" : "am");
      } else {
        setDetectedLang(null);
      }
    }
  }

  function swapLanguages() {
    const prevSrc = sourceLang;
    const prevTgt = targetLang;
    if (prevSrc !== "auto") {
      setSourceLang(prevTgt);
    }
    setTargetLang(prevSrc === "am" ? "en" : "am");

    const prevInput = inputText;
    const prevOutput = translatedText;
    setInputText(prevOutput);
    setTranslatedText(prevInput);
  }

  async function handleTranslate() {
    if (!inputText.trim()) return;

    setLoading(true);
    try {
      const res = await api.post<{
        translatedText: string;
        detectedLanguage: string;
        engine: string;
      }>("/translate", {
        inputText: inputText.trim(),
        sourceLanguage: sourceLang === "auto" ? undefined : sourceLang,
        targetLanguage: targetLang,
      });

      if (res.success && res.data) {
        setTranslatedText(res.data.translatedText);
        setEngine(res.data.engine);
        if (res.data.detectedLanguage) {
          setDetectedLang(res.data.detectedLanguage === "am" ? "Amharic" : "English");
        }
      } else {
        Alert.alert("Translation Failed", res.message || "Unable to translate text.");
      }
    } catch {
      Alert.alert("Error", "Network error translating text. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>Language & Translation</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {/* Sub Navigation */}
          <View style={[styles.tabBar, { backgroundColor: colors.background }]}>
            <TouchableOpacity
              style={[
                styles.tabItem,
                activeTab === "select" && { backgroundColor: colors.primary + "20" },
              ]}
              onPress={() => setActiveTab("select")}
            >
              <Ionicons
                name="globe-outline"
                size={16}
                color={activeTab === "select" ? colors.primary : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: activeTab === "select" ? colors.primary : colors.mutedForeground },
                ]}
              >
                App UI Language
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabItem,
                activeTab === "translator" && { backgroundColor: colors.primary + "20" },
              ]}
              onPress={() => setActiveTab("translator")}
            >
              <Ionicons
                name="language-outline"
                size={16}
                color={activeTab === "translator" ? colors.primary : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: activeTab === "translator" ? colors.primary : colors.mutedForeground },
                ]}
              >
                Translator Tool
              </Text>
            </TouchableOpacity>
          </View>

          {/* TAB 1: App UI Language Selection */}
          {activeTab === "select" ? (
            <View style={styles.content}>
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
                Select Display Language
              </Text>
              {[
                { code: "en", label: "English", sublabel: "Default System Language" },
                { code: "am", label: "አማርኛ (Amharic)", sublabel: "Ethiopian National Language" },
              ].map((item) => {
                const selected = currentLanguage === item.label || currentLanguage === item.code;
                return (
                  <TouchableOpacity
                    key={item.code}
                    style={[
                      styles.langOption,
                      { backgroundColor: colors.background, borderColor: selected ? colors.primary : colors.border },
                    ]}
                    onPress={() => {
                      onSelectLanguage(item.label);
                      Alert.alert("Language Updated", `App language set to ${item.label}`);
                    }}
                  >
                    <View style={styles.langTextCol}>
                      <Text style={[styles.langLabel, { color: colors.foreground }]}>{item.label}</Text>
                      <Text style={[styles.langSublabel, { color: colors.mutedForeground }]}>
                        {item.sublabel}
                      </Text>
                    </View>
                    {selected && (
                      <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            /* TAB 2: Translator Tool */
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              <View style={styles.translatorRow}>
                <TouchableOpacity
                  style={[styles.langBadge, { backgroundColor: colors.background, borderColor: colors.border }]}
                  onPress={() => setSourceLang(sourceLang === "auto" ? "en" : sourceLang === "en" ? "am" : "auto")}
                >
                  <Text style={[styles.langBadgeText, { color: colors.primary }]}>
                    {sourceLang === "auto" ? "Auto Detect" : sourceLang === "en" ? "English" : "Amharic"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.swapBtn} onPress={swapLanguages}>
                  <Ionicons name="swap-horizontal" size={20} color={colors.primary} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.langBadge, { backgroundColor: colors.background, borderColor: colors.border }]}
                  onPress={() => setTargetLang(targetLang === "am" ? "en" : "am")}
                >
                  <Text style={[styles.langBadgeText, { color: colors.primary }]}>
                    {targetLang === "am" ? "Amharic" : "English"}
                  </Text>
                </TouchableOpacity>
              </View>

              {detectedLang && (
                <Text style={[styles.detectedText, { color: colors.success }]}>
                  ✨ Detected: {detectedLang}
                </Text>
              )}

              {/* Input Box */}
              <TextInput
                style={[
                  styles.textArea,
                  { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground },
                ]}
                placeholder="Enter text to translate (English or Amharic)..."
                placeholderTextColor={colors.mutedForeground}
                multiline
                value={inputText}
                onChangeText={handleInputTextChange}
              />

              {/* Translate Action Button */}
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  { backgroundColor: colors.primary },
                  (!inputText.trim() || loading) && { opacity: 0.6 },
                ]}
                disabled={!inputText.trim() || loading}
                onPress={handleTranslate}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.actionBtnText}>Translate Now</Text>
                )}
              </TouchableOpacity>

              {/* Output Box */}
              {translatedText ? (
                <View style={[styles.outputBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[styles.outputText, { color: colors.foreground }]}>{translatedText}</Text>
                  {engine && (
                    <Text style={[styles.engineText, { color: colors.mutedForeground }]}>
                      Engine: {engine}
                    </Text>
                  )}
                </View>
              ) : null}
            </ScrollView>
          )}
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
  tabBar: {
    flexDirection: "row",
    padding: 6,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    gap: 6,
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  content: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  langOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  langTextCol: {
    gap: 2,
  },
  langLabel: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  langSublabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  translatorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  langBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  langBadgeText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  swapBtn: {
    padding: 8,
  },
  detectedText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginBottom: 8,
  },
  textArea: {
    height: 100,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlignVertical: "top",
    marginBottom: 12,
  },
  actionBtn: {
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  actionBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  outputBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginTop: 4,
  },
  outputText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    lineHeight: 22,
  },
  engineText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 8,
  },
});
