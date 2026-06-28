import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

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

const DEMO_MEMBERS: TeamMember[] = [
  { id: "1", name: "Sarah Davis", email: "sarah@company.com", role: "manager", joinedAt: "Jan 2025", initials: "SD" },
  { id: "2", name: "Michael Chen", email: "michael@company.com", role: "cashier", joinedAt: "Feb 2025", initials: "MC" },
  { id: "3", name: "Jessica Martinez", email: "jessica@company.com", role: "cashier", joinedAt: "Mar 2025", initials: "JM" },
  { id: "4", name: "David Kim", email: "david@company.com", role: "viewer", joinedAt: "Apr 2025", initials: "DK" },
];

const ROLE_PERMS: Record<Role, string[]> = {
  owner: ["All permissions", "Billing access", "Team management"],
  manager: ["Verify receipts", "View reports", "Manage cashiers"],
  cashier: ["Verify receipts", "View own history"],
  viewer: ["View reports", "Read-only access"],
};

export default function TeamScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("cashier");
  const [members, setMembers] = useState<TeamMember[]>(DEMO_MEMBERS);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const ownerMember: TeamMember = {
    id: "owner",
    name: user?.fullName ?? "You",
    email: user?.email ?? "",
    role: "owner",
    joinedAt: user?.joinedAt ? new Date(user.joinedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "Now",
    initials: (user?.fullName ?? "U").split(" ").map((n) => n[0]).slice(0, 2).join(""),
  };

  const allMembers = [ownerMember, ...members];

  function handleInvite() {
    if (!inviteEmail.trim()) {
      Alert.alert("Required", "Please enter an email address.");
      return;
    }
    const name = inviteEmail.split("@")[0].replace(/[._]/g, " ");
    const initials = name.split(" ").map((n: string) => n[0]?.toUpperCase() ?? "").slice(0, 2).join("");
    const newMember: TeamMember = {
      id: Date.now().toString(),
      name: name.charAt(0).toUpperCase() + name.slice(1),
      email: inviteEmail.trim(),
      role: inviteRole,
      joinedAt: "Just now",
      initials,
    };
    setMembers((prev) => [...prev, newMember]);
    setInviteEmail("");
    setShowInvite(false);
    Alert.alert("Invite Sent", `An invitation has been sent to ${inviteEmail}`);
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
            onPress={() => setShowInvite(true)}
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
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.inviteActions}>
            <TouchableOpacity
              style={[styles.cancelBtn, { borderColor: colors.border }]}
              onPress={() => setShowInvite(false)}
            >
              <Text style={[styles.cancelBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sendBtn, { backgroundColor: colors.primary }]} onPress={handleInvite}>
              <Text style={styles.sendBtnText}>Send Invite</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <FlatList
        data={allMembers}
        keyExtractor={(i) => i.id}
        contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 100 }]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={[styles.memberCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.avatar, { backgroundColor: ROLE_COLORS[item.role] + "20" }]}>
              <Text style={[styles.avatarText, { color: ROLE_COLORS[item.role] }]}>{item.initials}</Text>
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
                <View style={[styles.roleBadge, { backgroundColor: ROLE_COLORS[item.role] + "15" }]}>
                  <Text style={[styles.roleText, { color: ROLE_COLORS[item.role] }]}>
                    {item.role.charAt(0).toUpperCase() + item.role.slice(1)}
                  </Text>
                </View>
                <Text style={[styles.joinedText, { color: colors.mutedForeground }]}>Joined {item.joinedAt}</Text>
              </View>
            </View>
            {item.id !== "owner" && (
              <TouchableOpacity
                onPress={() =>
                  Alert.alert("Member Options", `Manage ${item.name}`, [
                    { text: "Remove Member", style: "destructive", onPress: () => setMembers((p) => p.filter((m) => m.id !== item.id)) },
                    { text: "Cancel", style: "cancel" },
                  ])
                }
              >
                <Ionicons name="ellipsis-horizontal" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
        )}
      />
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
