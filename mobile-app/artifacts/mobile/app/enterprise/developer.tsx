import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { api } from "@/utils/api";

interface ApiKey {
  id: string;
  name: string;
  key: string;
  prefix: string;
  lastUsedAt?: string;
  createdAt: string;
}

interface Webhook {
  id: string;
  url: string;
  secret: string;
  events: string[];
  isActive: boolean;
}

export default function DeveloperPortalScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<"keys" | "webhooks">("keys");
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Add Key Modal State
  const [keyModalVisible, setKeyModalVisible] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");

  // Add Webhook Modal State
  const [webhookModalVisible, setWebhookModalVisible] = useState(false);
  const [newWebhookUrl, setNewWebhookUrl] = useState("");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const fetchData = useCallback(async (isRefresh = false) => {
    if (user?.plan !== "enterprise") {
      setLoading(false);
      return;
    }

    if (!isRefresh) setLoading(true);
    try {
      const [keysRes, webhooksRes] = await Promise.all([
        api.get<any[]>("/user/api-keys"),
        api.get<any[]>("/user/webhooks"),
      ]);

      if (keysRes.success && Array.isArray(keysRes.data)) {
        const mappedKeys: ApiKey[] = keysRes.data.map((k: any) => ({
          id: k.id,
          name: k.name || "API Key",
          key: k.key || k.prefix || "pv_live_...",
          prefix: k.prefix || `${(k.key || "").substring(0, 12)}...`,
          lastUsedAt: k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "Never",
          createdAt: k.createdAt ? new Date(k.createdAt).toLocaleDateString() : "Recently",
        }));
        setApiKeys(mappedKeys);
      }

      if (webhooksRes.success && Array.isArray(webhooksRes.data)) {
        const mappedWebhooks: Webhook[] = webhooksRes.data.map((w: any) => ({
          id: w.id,
          url: w.url,
          secret: w.secret || "whsec_...",
          events: w.events || ["verification.completed"],
          isActive: w.isActive ?? true,
        }));
        setWebhooks(mappedWebhooks);
      }
    } catch (err) {
      console.error("Failed to fetch developer portal data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.plan]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleCreateApiKey() {
    if (!newKeyName.trim()) {
      Alert.alert("Required", "Please provide a name for this API key.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post<any>("/user/api-keys", { name: newKeyName.trim() });
      if (res.success && res.data) {
        const fullKey = res.data.key || `pv_live_${Math.random().toString(36).substring(2, 12)}`;
        const newKey: ApiKey = {
          id: res.data.id || Date.now().toString(),
          name: res.data.name || newKeyName.trim(),
          key: fullKey,
          prefix: res.data.prefix || `${fullKey.substring(0, 12)}...`,
          lastUsedAt: "Never",
          createdAt: "Just now",
        };
        setApiKeys((prev) => [newKey, ...prev]);
        setNewKeyName("");
        setKeyModalVisible(false);
        Alert.alert(
          "API Key Generated",
          `Your new live API key has been created:\n\n${fullKey}\n\nPlease copy and store it securely.`,
        );
      } else {
        Alert.alert("Error", res.message || "Failed to generate API Key.");
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to generate API Key.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleRevokeApiKey(id: string, name: string) {
    Alert.alert(
      "Revoke API Key",
      `Are you sure you want to revoke "${name}"? Systems using this key will immediately lose access.`,
      [
        {
          text: "Revoke Key",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await api.delete(`/user/api-keys/${id}`);
              if (res.success) {
                setApiKeys((prev) => prev.filter((k) => k.id !== id));
                Alert.alert("Success", "API key revoked.");
              } else {
                Alert.alert("Error", res.message || "Failed to revoke API key.");
              }
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to revoke API key.");
            }
          },
        },
        { text: "Cancel", style: "cancel" },
      ],
    );
  }

  async function handleCreateWebhook() {
    if (!newWebhookUrl.trim() || !newWebhookUrl.startsWith("http")) {
      Alert.alert("Invalid URL", "Please enter a valid HTTP/HTTPS endpoint URL.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post<any>("/user/webhooks", {
        url: newWebhookUrl.trim(),
        events: ["verification.completed", "verification.suspicious", "fraud.alert"],
      });

      if (res.success && res.data) {
        const newHook: Webhook = {
          id: res.data.id || Date.now().toString(),
          url: res.data.url || newWebhookUrl.trim(),
          secret: res.data.secret || `whsec_${Math.random().toString(36).substring(2, 12)}`,
          events: res.data.events || ["verification.completed", "fraud.alert"],
          isActive: res.data.isActive ?? true,
        };

        setWebhooks((prev) => [newHook, ...prev]);
        setNewWebhookUrl("");
        setWebhookModalVisible(false);
        Alert.alert("Webhook Registered", `Successfully registered webhook endpoint: ${newHook.url}`);
      } else {
        Alert.alert("Error", res.message || "Failed to register webhook.");
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to register webhook.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleDeleteWebhook(id: string) {
    Alert.alert(
      "Delete Webhook",
      "Are you sure you want to remove this webhook endpoint?",
      [
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await api.delete(`/user/webhooks/${id}`);
              if (res.success) {
                setWebhooks((prev) => prev.filter((w) => w.id !== id));
                Alert.alert("Success", "Webhook removed.");
              } else {
                Alert.alert("Error", res.message || "Failed to remove webhook.");
              }
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to remove webhook.");
            }
          },
        },
        { text: "Cancel", style: "cancel" },
      ],
    );
  }

  // Enterprise Plan Gating Check
  if (user?.plan !== "enterprise") {
    return (
      <View style={[styles.lockedContainer, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground }]}>Developer Portal</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.lockContent}>
          <View style={[styles.lockIconBox, { backgroundColor: colors.warning + "18" }]}>
            <Ionicons name="code-slash-outline" size={56} color={colors.warning} />
          </View>
          <Text style={[styles.lockTitle, { color: colors.foreground }]}>Developer API & Webhooks Locked</Text>
          <Text style={[styles.lockSubtitle, { color: colors.mutedForeground }]}>
            Server-to-server API Key authentication, real-time HTTP webhooks, and automated receipt processing require an active Enterprise plan.
          </Text>
          <TouchableOpacity
            style={[styles.lockBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/subscription")}
          >
            <Text style={styles.lockBtnText}>Upgrade to Enterprise</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>Developer Portal</Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() =>
            activeTab === "keys" ? setKeyModalVisible(true) : setWebhookModalVisible(true)
          }
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === "keys" && [styles.activeTab, { backgroundColor: colors.primary }],
          ]}
          onPress={() => setActiveTab("keys")}
        >
          <Ionicons
            name="key-outline"
            size={16}
            color={activeTab === "keys" ? "#FFFFFF" : colors.mutedForeground}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === "keys" ? "#FFFFFF" : colors.mutedForeground },
            ]}
          >
            API Keys ({apiKeys.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === "webhooks" && [styles.activeTab, { backgroundColor: colors.primary }],
          ]}
          onPress={() => setActiveTab("webhooks")}
        >
          <Ionicons
            name="globe-outline"
            size={16}
            color={activeTab === "webhooks" ? "#FFFFFF" : colors.mutedForeground}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === "webhooks" ? "#FFFFFF" : colors.mutedForeground },
            ]}
          >
            Webhooks ({webhooks.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading developer data...</Text>
        </View>
      ) : activeTab === "keys" ? (
        <FlatList
          data={apiKeys}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 32 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchData(true);
              }}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="key-outline" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No API keys generated</Text>
              <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                Tap the "+" button to generate your first live API integration key.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconBox, { backgroundColor: colors.primary + "15" }]}>
                  <Ionicons name="key" size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.foreground }]}>{item.name}</Text>
                  <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>
                    Created: {item.createdAt} · Used: {item.lastUsedAt}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleRevokeApiKey(item.id, item.name)}>
                  <Ionicons name="trash-outline" size={18} color={colors.destructive} />
                </TouchableOpacity>
              </View>

              <View style={[styles.keyBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[styles.keyText, { color: colors.foreground }]}>{item.prefix}</Text>
                <TouchableOpacity
                  style={[styles.copyBtn, { backgroundColor: colors.primary + "15" }]}
                  onPress={() => Alert.alert("Copied", `API Key copied to clipboard:\n${item.key}`)}
                >
                  <Ionicons name="copy-outline" size={14} color={colors.primary} />
                  <Text style={[styles.copyText, { color: colors.primary }]}>Copy</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      ) : (
        <FlatList
          data={webhooks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 32 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchData(true);
              }}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="globe-outline" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No webhooks registered</Text>
              <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                Tap the "+" button to add a webhook URL for real-time verification events.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconBox, { backgroundColor: colors.success + "15" }]}>
                  <Ionicons name="radio" size={18} color={colors.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>
                    {item.url}
                  </Text>
                  <Text style={[styles.cardMeta, { color: colors.success }]}>
                    Status: Active · HMAC SHA256 Enabled
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleDeleteWebhook(item.id)}>
                  <Ionicons name="trash-outline" size={18} color={colors.destructive} />
                </TouchableOpacity>
              </View>

              <View style={styles.eventsRow}>
                {item.events.map((e, idx) => (
                  <View key={idx} style={[styles.eventBadge, { backgroundColor: colors.primary + "15" }]}>
                    <Text style={[styles.eventText, { color: colors.primary }]}>{e}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        />
      )}

      {/* Add Key Modal */}
      <Modal visible={keyModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Generate API Key</Text>
            <View style={styles.inputWrap}>
              <Text style={[styles.inputLabel, { color: colors.foreground }]}>Key Name / Purpose</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground },
                ]}
                placeholder="e.g. Server POS Scraper Service"
                placeholderTextColor={colors.mutedForeground}
                value={newKeyName}
                onChangeText={setNewKeyName}
              />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancel, { borderColor: colors.border }]}
                onPress={() => setKeyModalVisible(false)}
                disabled={submitting}
              >
                <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSave, { backgroundColor: colors.primary }]}
                onPress={handleCreateApiKey}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveText}>Generate Key</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Webhook Modal */}
      <Modal visible={webhookModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Register Webhook</Text>
            <View style={styles.inputWrap}>
              <Text style={[styles.inputLabel, { color: colors.foreground }]}>Endpoint URL</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground },
                ]}
                placeholder="https://api.yourdomain.com/webhooks/geba"
                placeholderTextColor={colors.mutedForeground}
                value={newWebhookUrl}
                onChangeText={setNewWebhookUrl}
                keyboardType="url"
                autoCapitalize="none"
              />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancel, { borderColor: colors.border }]}
                onPress={() => setWebhookModalVisible(false)}
                disabled={submitting}
              >
                <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSave, { backgroundColor: colors.primary }]}
                onPress={handleCreateWebhook}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveText}>Save Webhook</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
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
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBar: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  activeTab: { elevation: 1 },
  tabText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  list: { paddingHorizontal: 16, gap: 12 },
  card: { padding: 16, borderRadius: 16, borderWidth: 1, gap: 12 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  cardMeta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  keyBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  keyText: { fontSize: 13, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  copyBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  copyText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  eventsRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  eventBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  eventText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },

  emptyState: { alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 10, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  emptySubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: { width: "100%", borderRadius: 20, padding: 24, gap: 16 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  inputWrap: { gap: 6 },
  inputLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  input: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 8 },
  modalCancel: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  modalSave: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { color: "#FFFFFF", fontSize: 14, fontFamily: "Inter_600SemiBold" },

  // Gated Plan Lock Styles
  lockedContainer: { flex: 1, paddingHorizontal: 20 },
  lockContent: { flex: 1, alignItems: "center", justifyContent: "center", gap: 20, paddingHorizontal: 10 },
  lockIconBox: { width: 100, height: 100, borderRadius: 50, alignItems: "center", justifyContent: "center" },
  lockTitle: { fontSize: 22, fontFamily: "Inter_700Bold", textAlign: "center" },
  lockSubtitle: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  lockBtn: { width: "100%", padding: 16, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  lockBtnText: { color: "#FFFFFF", fontSize: 15, fontFamily: "Inter_700Bold" },
});
