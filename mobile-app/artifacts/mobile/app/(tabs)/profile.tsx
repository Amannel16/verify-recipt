import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useVerifications } from "@/contexts/VerificationContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useColors } from "@/hooks/useColors";
import { LanguageModal } from "@/components/LanguageModal";
import { FeedbackModal } from "@/components/FeedbackModal";



interface MenuItemProps {
  icon: string;
  iconColor?: string;
  label: string;
  value?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  destructive?: boolean;
}

function MenuItem({ icon, iconColor, label, value, onPress, right, destructive }: MenuItemProps) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[styles.menuItem, { borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.menuIcon, { backgroundColor: (iconColor ?? colors.primary) + "18" }]}>
        <Ionicons name={icon as never} size={18} color={iconColor ?? colors.primary} />
      </View>
      <Text style={[styles.menuLabel, { color: destructive ? colors.destructive : colors.foreground }]}>
        {label}
      </Text>
      <View style={styles.menuRight}>
        {value && <Text style={[styles.menuValue, { color: colors.mutedForeground }]}>{value}</Text>}
        {right ?? <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />}
      </View>
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user, signOut, deleteAccount } = useAuth();
  const { getStats } = useVerifications();
  const { isDark, toggleTheme } = useTheme();
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState(true);
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
  const [selectedLang, setSelectedLang] = useState(language === "am" ? "አማርኛ" : "English");



  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const stats = getStats();


  function handleSignOut() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: signOut },
    ]);
  }

  function handleDeleteAccount() {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to permanently delete your account and all stored receipt verifications? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Permanently",
          style: "destructive",
          onPress: async () => {
            const res = await deleteAccount();
            if (!res.success) {
              Alert.alert("Error", res.error || "Failed to delete account");
            }
          },
        },
      ]
    );
  }

  const planLabel = user?.plan === "free" ? "Free Plan" : user?.plan === "pro" ? "Pro Plan" : "Enterprise";
  const planColor = user?.plan === "free" ? colors.mutedForeground : user?.plan === "pro" ? colors.primary : colors.warning;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: bottomPad + 100 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 20 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>{t("profile.title")}</Text>
      </View>

      {/* Profile card */}
      <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarText}>{user?.fullName?.[0]?.toUpperCase() ?? "U"}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={[styles.profileName, { color: colors.foreground }]}>{user?.fullName}</Text>
          <Text style={[styles.profileBiz, { color: colors.mutedForeground }]}>{user?.businessName}</Text>
          <Text style={[styles.profileEmail, { color: colors.mutedForeground }]}>{user?.email}</Text>
        </View>
        <View style={[styles.planBadge, { backgroundColor: planColor + "20" }]}>
          <MaterialCommunityIcons name="shield-check" size={14} color={planColor} />
          <Text style={[styles.planBadgeText, { color: planColor }]}>{planLabel}</Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        {[
          { label: t("dash.totalScans"), value: stats.total, icon: "scan-outline", color: colors.primary },
          { label: t("dash.approved"), value: stats.approved, icon: "checkmark-circle-outline", color: colors.success },
          { label: t("dash.rejected"), value: stats.rejected, icon: "close-circle-outline", color: colors.destructive },
        ].map((s) => (
          <View key={s.label} style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name={s.icon as never} size={18} color={s.color} />
            <Text style={[styles.statValue, { color: colors.foreground }]}>{s.value}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Account Section */}
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{t("profile.account")}</Text>
      <View style={[styles.menuGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <MenuItem
          icon="person-outline"
          label={t("profile.editProfile")}
          onPress={() => router.push("/profile/edit")}
        />
        <MenuItem
          icon="business-outline"
          label={t("profile.businessType")}
          value={user?.businessType}
        />
        <MenuItem
          icon="call-outline"
          label={t("profile.phone")}
          value={user?.phoneNumber || "Not set"}
        />
      </View>

      {/* Subscription */}
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{t("profile.subscription")}</Text>
      <View style={[styles.menuGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <MenuItem
          icon="star-outline"
          iconColor={planColor}
          label={t("profile.currentPlan")}
          value={planLabel}
          onPress={() => router.push("/subscription")}
        />
        {user?.plan === "free" && (
          <MenuItem
            icon="rocket-outline"
            iconColor={colors.primary}
            label={t("profile.upgradePro")}
            onPress={() => router.push("/subscription")}
          />
        )}
        <MenuItem
          icon="card-outline"
          label={t("profile.paymentHistory")}
          onPress={() => router.push("/payment/history")}
        />
      </View>

      {/* Developer Options */}
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{t("profile.developer")}</Text>
      <View style={[styles.menuGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <MenuItem
          icon="code-working-outline"
          label={t("profile.apiIntegration")}
          onPress={() => router.push("/enterprise/developer")}
        />
      </View>

      {/* Enterprise Tools */}
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{t("profile.enterpriseTools")}</Text>
      <View style={[styles.menuGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <MenuItem
          icon="business-outline"
          label={t("profile.branchManagement")}
          onPress={() => router.push("/enterprise/branches")}
        />
        <MenuItem
          icon="receipt-outline"
          label={t("profile.auditLogs")}
          onPress={() => router.push("/enterprise/audit-logs")}
        />
      </View>

      {/* Preferences */}
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{t("profile.preferences")}</Text>
      <View style={[styles.menuGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <MenuItem
          icon="moon-outline"
          label={t("profile.darkMode")}
          right={
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ true: colors.primary }}
            />
          }
        />
        <MenuItem
          icon="notifications-outline"
          label={t("profile.notifications")}
          right={
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ true: colors.primary }}
            />
          }
        />
        <MenuItem
          icon="language-outline"
          label={t("profile.language")}
          value={language === "am" ? "አማርኛ" : "English"}
          onPress={() => setLangModalVisible(true)}
        />
      </View>

      {/* Support */}
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{t("profile.support")}</Text>
      <View style={[styles.menuGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {user?.plan === "enterprise" && (
          <MenuItem
            icon="call-outline"
            iconColor={colors.warning}
            label={t("profile.dedicatedManager")}
            value="Abebe K."
            onPress={() => Alert.alert(
              "Dedicated Account Manager",
              "Your Dedicated Account Manager:\n\nName: Abebe Kebede\nDirect Support: +251 911 234 567\nEmail: abebe@geba.ai",
              [{ text: "OK" }]
            )}
          />
        )}
        <MenuItem
          icon="help-circle-outline"
          label={t("profile.helpCenter")}
          onPress={() => {
            if (user?.plan === "free") {
              Alert.alert(
                "Help Center Support",
                "Standard Email Support:\nEmail: support@geba.ai\nAverage response time: 48 hours",
                [{ text: "OK" }]
              );
            } else {
              Alert.alert(
                "Priority VIP Support Line",
                "Priority Fast-track Support:\nDirect Line: +251 911 000 111\nEmail: priority@geba.ai\nAverage response time: < 1 hour",
                [{ text: "OK" }]
              );
            }
          }}
        />
        <MenuItem
          icon="chatbubble-outline"
          label={t("profile.sendFeedback")}
          onPress={() => setFeedbackModalVisible(true)}
        />
        <MenuItem
          icon="shield-outline"
          label={t("profile.privacyPolicy")}
          onPress={() => Alert.alert("Privacy Policy", "Your data is encrypted and never shared without consent.")}
        />
      </View>

      {/* Account Actions */}
      <View style={[styles.menuGroup, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 8 }]}>
        <MenuItem icon="log-out-outline" iconColor={colors.destructive} label={t("profile.signOut")} destructive onPress={handleSignOut} right={<View />} />
        <MenuItem icon="trash-outline" iconColor={colors.destructive} label={t("profile.deleteAccount")} destructive onPress={handleDeleteAccount} right={<View />} />
      </View>


      <Text style={[styles.version, { color: colors.mutedForeground }]}>Geba AI v1.0.0</Text>

      {/* Interactive Modals */}
      <LanguageModal
        visible={langModalVisible}
        onClose={() => setLangModalVisible(false)}
        currentLanguage={selectedLang}
        onSelectLanguage={(lang) => {
          setSelectedLang(lang);
          setLangModalVisible(false);
        }}
      />

      <FeedbackModal
        visible={feedbackModalVisible}
        onClose={() => setFeedbackModalVisible(false)}
      />
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  avatar: { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 22 },
  profileInfo: { flex: 1, gap: 2 },
  profileName: { fontSize: 17, fontFamily: "Inter_700Bold" },
  profileBiz: { fontSize: 13, fontFamily: "Inter_500Medium" },
  profileEmail: { fontSize: 12, fontFamily: "Inter_400Regular" },
  planBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100 },
  planBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  statsRow: { flexDirection: "row", gap: 10, paddingHorizontal: 16, marginBottom: 20 },
  statCard: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, alignItems: "center", gap: 4 },
  statValue: { fontSize: 20, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 10, fontFamily: "Inter_400Regular", textAlign: "center" },
  sectionLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, paddingHorizontal: 16, marginBottom: 6, marginTop: 4 },
  menuGroup: { marginHorizontal: 16, borderRadius: 16, borderWidth: 1, overflow: "hidden", marginBottom: 8 },
  menuItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, gap: 12 },
  menuIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  menuLabel: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium" },
  menuRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  menuValue: { fontSize: 13, fontFamily: "Inter_400Regular" },
  version: { textAlign: "center", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 16 },
});
