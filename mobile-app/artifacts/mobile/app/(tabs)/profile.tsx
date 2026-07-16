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
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { useVerifications } from "@/contexts/VerificationContext";
import { useColors } from "@/hooks/useColors";

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
  const { user, signOut } = useAuth();
  const { getStats } = useVerifications();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const [darkMode, setDarkMode] = useState(colorScheme === "dark");
  const [notifications, setNotifications] = useState(true);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const stats = getStats();

  function handleSignOut() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: signOut },
    ]);
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
        <Text style={[styles.title, { color: colors.foreground }]}>Profile</Text>
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
          { label: "Total Scans", value: stats.total, icon: "scan-outline", color: colors.primary },
          { label: "Approved", value: stats.approved, icon: "checkmark-circle-outline", color: colors.success },
          { label: "Rejected", value: stats.rejected, icon: "close-circle-outline", color: colors.destructive },
        ].map((s) => (
          <View key={s.label} style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name={s.icon as never} size={18} color={s.color} />
            <Text style={[styles.statValue, { color: colors.foreground }]}>{s.value}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Account Section */}
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Account</Text>
      <View style={[styles.menuGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <MenuItem
          icon="person-outline"
          label="Edit Profile"
          onPress={() => router.push("/profile/edit")}
        />
        <MenuItem
          icon="business-outline"
          label="Business Type"
          value={user?.businessType}
        />
        <MenuItem
          icon="call-outline"
          label="Phone Number"
          value={user?.phoneNumber || "Not set"}
        />
      </View>

      {/* Subscription */}
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Subscription</Text>
      <View style={[styles.menuGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <MenuItem
          icon="star-outline"
          iconColor={planColor}
          label="Current Plan"
          value={planLabel}
          onPress={() => router.push("/subscription")}
        />
        {user?.plan === "free" && (
          <MenuItem
            icon="rocket-outline"
            iconColor={colors.primary}
            label="Upgrade to Pro"
            onPress={() => router.push("/subscription")}
          />
        )}
        <MenuItem
          icon="card-outline"
          label="Payment History"
          onPress={() => router.push("/payment/history")}
        />
      </View>

      {/* Developer Options */}
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Developer</Text>
      <View style={[styles.menuGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <MenuItem
          icon="code-working-outline"
          label="API Integration (Keys)"
          onPress={() => {
            if (user?.plan === "enterprise") {
              Alert.alert(
                "PayVerify Developer API",
                "Your Active API Key:\npv_live_67aefc88e99ab1d8213bc0d74f2b\n\nWebhook Status: Active",
                [
                  { text: "Copy Key", onPress: () => Alert.alert("Copied", "API key copied to clipboard.") },
                  { text: "Regenerate", style: "destructive", onPress: () => Alert.alert("Success", "New API key generated.") },
                  { text: "Close", style: "cancel" }
                ]
              );
            } else {
              Alert.alert(
                "Enterprise Feature",
                "Developer API access and real-time webhook routing are locked on your current plan. Upgrade to Enterprise to integrate PayVerify directly into your custom systems.",
                [
                  { text: "Upgrade Plan", onPress: () => router.push("/subscription") },
                  { text: "Cancel", style: "cancel" }
                ]
              );
            }
          }}
        />
      </View>

      {/* Enterprise Tools */}
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Enterprise Tools</Text>
      <View style={[styles.menuGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <MenuItem
          icon="business-outline"
          label="Branch Management"
          onPress={() => router.push("/enterprise/branches")}
        />
        <MenuItem
          icon="receipt-outline"
          label="Audit Logs"
          onPress={() => router.push("/enterprise/audit-logs")}
        />
      </View>

      {/* Preferences */}
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Preferences</Text>
      <View style={[styles.menuGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <MenuItem
          icon="moon-outline"
          label="Dark Mode"
          right={
            <Switch
              value={darkMode}
              onValueChange={setDarkMode}
              trackColor={{ true: colors.primary }}
            />
          }
        />
        <MenuItem
          icon="notifications-outline"
          label="Notifications"
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
          label="Language"
          value="English"
          onPress={() => Alert.alert("Language", "Multi-language support coming soon.")}
        />
      </View>

      {/* Support */}
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Support</Text>
      <View style={[styles.menuGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {user?.plan === "enterprise" && (
          <MenuItem
            icon="call-outline"
            iconColor={colors.warning}
            label="Dedicated Manager"
            value="Abebe K."
            onPress={() => Alert.alert(
              "Dedicated Account Manager",
              "Your Dedicated Account Manager:\n\nName: Abebe Kebede\nDirect Support: +251 911 234 567\nEmail: abebe@payverify.ai",
              [{ text: "OK" }]
            )}
          />
        )}
        <MenuItem
          icon="help-circle-outline"
          label="Help Center"
          onPress={() => {
            if (user?.plan === "free") {
              Alert.alert(
                "Help Center Support",
                "Standard Email Support:\nEmail: support@payverify.ai\nAverage response time: 48 hours",
                [{ text: "OK" }]
              );
            } else {
              Alert.alert(
                "Priority VIP Support Line",
                "Priority Fast-track Support:\nDirect Line: +251 911 000 111\nEmail: priority@payverify.ai\nAverage response time: < 1 hour",
                [{ text: "OK" }]
              );
            }
          }}
        />
        <MenuItem
          icon="chatbubble-outline"
          label="Send Feedback"
          onPress={() => Alert.alert("Feedback", "Thank you! Your feedback helps us improve PayVerify AI.")}
        />
        <MenuItem
          icon="shield-outline"
          label="Privacy Policy"
          onPress={() => Alert.alert("Privacy Policy", "Your data is encrypted and never shared without consent.")}
        />
      </View>

      {/* Sign out */}
      <View style={[styles.menuGroup, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 8 }]}>
        <MenuItem icon="log-out-outline" iconColor={colors.destructive} label="Sign Out" destructive onPress={handleSignOut} right={<View />} />
      </View>

      <Text style={[styles.version, { color: colors.mutedForeground }]}>PayVerify AI v1.0.0</Text>
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
