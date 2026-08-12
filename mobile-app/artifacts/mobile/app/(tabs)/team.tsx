import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
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

type Role = "owner" | "manager" | "cashier" | "viewer";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  joinedAt: string;
  initials: string;
}

const ROLE_COLORS: Record<Role, string> = {
  owner: "#2563EB",
  manager: "#7C3AED",
  cashier: "#059669",
  viewer: "#64748B",
};

export default function TeamScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [showInvite, setShowInvite] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("cashier");
  const [members, setMembers] = useState<TeamMember[]>([]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const fetchTeamMembers = useCallback(async (isRefresh = false) => {
    if (user?.plan === "free") {
      setLoading(false);
      return;
    }

    if (!isRefresh) setLoading(true);
    try {
      const res = await api.get<any>("/user/team");
      if (res.success && res.data?.members) {
        const fetched: TeamMember[] = res.data.members.map((m: any) => {
          const fullName = `${m.firstName || ""} ${m.lastName || ""}`.trim() || m.email;
          const initials = fullName
            .split(" ")
            .map((n: string) => n[0]?.toUpperCase() ?? "")
            .slice(0, 2)
            .join("");

          return {
            id: m.id,
            name: fullName,
            email: m.email,
            role: (m.role?.toLowerCase() as Role) || "cashier",
            joinedAt: m.createdAt ? new Date(m.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "Recently",
            initials: initials || "TM",
          };
        });
        setMembers(fetched);
      }
    } catch (err) {
      console.error("Failed to fetch team members:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.plan]);

  useEffect(() => {
    fetchTeamMembers();
  }, [fetchTeamMembers]);

  const ownerMember: TeamMember = {
    id: "owner",
    name: user?.fullName ?? "You",
    email: user?.email ?? "",
    role: "owner",
    joinedAt: user?.joinedAt ? new Date(user.joinedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "Now",
    initials: (user?.fullName ?? "U").split(" ").map((n) => n[0]).slice(0, 2).join(""),
  };

  const allMembers = [ownerMember, ...members];

  async function handleInvite() {
    if (!inviteEmail.trim()) {
      Alert.alert("Required", "Please enter an email address.");
      return;
    }

    setSubmitting(true);
    try {
      const rawName = inviteEmail.split("@")[0].replace(/[._]/g, " ");
      const firstName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

      const res = await api.post<any>("/user/team/invite", {
        email: inviteEmail.trim(),
        firstName,
        role: inviteRole.toUpperCase(),
      });

      if (res.success && res.data) {
        const initials = firstName.split(" ").map((n: string) => n[0]?.toUpperCase() ?? "").slice(0, 2).join("");
        const newMember: TeamMember = {
          id: res.data.id || Date.now().toString(),
          name: `${res.data.firstName || firstName} ${res.data.lastName || ""}`.trim(),
          email: res.data.email || inviteEmail.trim(),
          role: inviteRole,
          joinedAt: "Just now",
          initials,
        };
        setMembers((prev) => [...prev, newMember]);
        setInviteEmail("");
        setShowInvite(false);
        Alert.alert("Invite Sent", `An invitation has been sent to ${inviteEmail}`);
      } else {
        Alert.alert("Invite Failed", res.message || "Could not send invitation.");
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to send invitation.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleRemoveMember(memberId: string, name: string) {
    Alert.alert("Member Options", `Remove ${name} from your business team?`, [
      {
        text: "Remove Member",
        style: "destructive",
        onPress: async () => {
          try {
            const res = await api.delete(`/user/team/${memberId}`);
            if (res.success) {
              setMembers((prev) => prev.filter((m) => m.id !== memberId));
              Alert.alert("Success", `${name} has been removed.`);
            } else {
              Alert.alert("Error", res.message || "Failed to remove member.");
            }
          } catch (err: any) {
            Alert.alert("Error", err.message || "Failed to remove member.");
          }
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 20 }]}>
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>Team</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {allMembers.length} member{allMembers.length !== 1 ? "s" : ""}
          </Text>
        </View>
        {user?.plan !== "free" && (
          <TouchableOpacity
            style={[styles.inviteBtn, { backgroundColor: colors.primary }]}
            onPress={() => {
              if (user?.plan === "pro" && allMembers.length >= 10) {
                Alert.alert(
                  "Limit Reached",
                  "The Pro plan is limited to 10 team members (including the owner). Upgrade to Enterprise for unlimited team members.",
                  [
                    { text: "Upgrade", onPress: () => router.push("/subscription") },
                    { text: "Cancel", style: "cancel" },
                  ]
                );
                return;
              }
              setShowInvite(true);
            }}
          >
            <Ionicons name="person-add-outline" size={18} color="#FFFFFF" />
            <Text style={styles.inviteBtnText}>Invite</Text>
          </TouchableOpacity>
        )}
      </View>

      {user?.plan === "free" && (
        <View style={[styles.upgradeBanner, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "30" }]}>
          <Ionicons name="people" size={18} color={colors.primary} />
          <Text style={[styles.upgradeText, { color: colors.primary }]}>
            Upgrade to Pro to invite team members
          </Text>
        </View>
      )}

      {showInvite && (
        <View style={[styles.invitePanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.invitePanelTitle, { color: colors.foreground }]}>Invite Member</Text>
          <View style={[styles.inputRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Ionicons name="mail-outline" size={16} color={colors.mutedForeground} />
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              placeholder="Email address"
              placeholderTextColor={colors.mutedForeground}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
          <View style={styles.roleRow}>
            {(["manager", "cashier", "viewer"] as Role[]).map((r) => (
              <TouchableOpacity
                key={r}
                style={[
                  styles.roleChip,
                  {
                    backgroundColor: inviteRole === r ? ROLE_COLORS[r] + "20" : "transparent",
                    borderColor: inviteRole === r ? ROLE_COLORS[r] : colors.border,
                  },
                ]}
                onPress={() => setInviteRole(r)}
              >
                <Text style={[styles.roleChipText, { color: inviteRole === r ? ROLE_COLORS[r] : colors.mutedForeground }]}>
                  {r === "manager" ? "Branch Manager" : r.charAt(0).toUpperCase() + r.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.inviteActions}>
            <TouchableOpacity
              style={[styles.cancelBtn, { borderColor: colors.border }]}
              onPress={() => setShowInvite(false)}
              disabled={submitting}
            >
              <Text style={[styles.cancelBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: colors.primary }]}
              onPress={handleInvite}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.sendBtnText}>Send Invite</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading team members...</Text>
        </View>
      ) : (
        <FlatList
          data={allMembers}
          keyExtractor={(i) => i.id}
          contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 100 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchTeamMembers(true);
              }}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => (
            <View style={[styles.memberCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.avatar, { backgroundColor: (ROLE_COLORS[item.role] || colors.primary) + "20" }]}>
                <Text style={[styles.avatarText, { color: ROLE_COLORS[item.role] || colors.primary }]}>{item.initials}</Text>
              </View>
              <View style={styles.memberInfo}>
                <View style={styles.memberNameRow}>
                  <Text style={[styles.memberName, { color: colors.foreground }]}>{item.name}</Text>
                  {item.id === "owner" && (
                    <View style={[styles.youBadge, { backgroundColor: colors.primary + "20" }]}>
                      <Text style={[styles.youText, { color: colors.primary }]}>You</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.memberEmail, { color: colors.mutedForeground }]}>{item.email}</Text>
                <View style={styles.memberMeta}>
                  <View style={[styles.roleBadge, { backgroundColor: (ROLE_COLORS[item.role] || colors.primary) + "15" }]}>
                    <Text style={[styles.roleText, { color: ROLE_COLORS[item.role] || colors.primary }]}>
                      {item.role === "manager" ? "Branch Manager" : item.role.charAt(0).toUpperCase() + item.role.slice(1)}
                    </Text>
                  </View>
                  <Text style={[styles.joinedText, { color: colors.mutedForeground }]}>Joined {item.joinedAt}</Text>
                </View>
              </View>
              {item.id !== "owner" && (
                <TouchableOpacity onPress={() => handleRemoveMember(item.id, item.name)}>
                  <Ionicons name="ellipsis-horizontal" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingHorizontal: 20, paddingBottom: 16 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 4 },
  inviteBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  inviteBtnText: { color: "#FFFFFF", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  upgradeBanner: { marginHorizontal: 16, marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
  upgradeText: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  invitePanel: { marginHorizontal: 16, marginBottom: 12, padding: 16, borderRadius: 16, borderWidth: 1, gap: 12 },
  invitePanelTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, borderWidth: 1 },
  input: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  roleRow: { flexDirection: "row", gap: 8 },
  roleChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, borderWidth: 1 },
  roleChipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  inviteActions: { flexDirection: "row", gap: 10 },
  cancelBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, alignItems: "center" },
  cancelBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  sendBtn: { flex: 1, padding: 12, borderRadius: 10, alignItems: "center" },
  sendBtnText: { color: "#FFFFFF", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  list: { paddingHorizontal: 16, gap: 10 },
  memberCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  avatar: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  memberInfo: { flex: 1, gap: 4 },
  memberNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  memberName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  youBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100 },
  youText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  memberEmail: { fontSize: 12, fontFamily: "Inter_400Regular" },
  memberMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100 },
  roleText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  joinedText: { fontSize: 11, fontFamily: "Inter_400Regular" },
});
