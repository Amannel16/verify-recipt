import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
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

interface Branch {
  id: string;
  name: string;
  location: string;
  cashiers: number;
  monthlyScans: number;
  status: "active" | "inactive";
}

const INITIAL_BRANCHES: Branch[] = [
  { id: "1", name: "Bole Medhanialem Branch", location: "Bole, Ring Road (Near Mall)", cashiers: 4, monthlyScans: 852, status: "active" },
  { id: "2", name: "Mercato Wholesale Hub", location: "Addis Ketema, Raguel District", cashiers: 8, monthlyScans: 3412, status: "active" },
  { id: "3", name: "Piassa Retail Outlet", location: "Arada, De Gaulle Square", cashiers: 3, monthlyScans: 410, status: "active" },
];

export default function BranchesScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [branches, setBranches] = useState<Branch[]>(INITIAL_BRANCHES);
  
  // Modal states
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [newBranchLoc, setNewBranchLoc] = useState("");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  function handleAddBranch() {
    if (!newBranchName.trim() || !newBranchLoc.trim()) {
      Alert.alert("Required Fields", "Please specify both the branch name and address.");
      return;
    }

    const newB: Branch = {
      id: Date.now().toString(),
      name: newBranchName.trim(),
      location: newBranchLoc.trim(),
      cashiers: 0,
      monthlyScans: 0,
      status: "active",
    };

    setBranches((prev) => [...prev, newB]);
    setNewBranchName("");
    setNewBranchLoc("");
    setAddModalVisible(false);
    Alert.alert("Branch Added", `Successfully registered branch "${newB.name}".`);
  }

  // Enforce Enterprise plan block overlay
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
          <Text style={[styles.title, { color: colors.foreground }]}>Branches</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.lockContent}>
          <View style={[styles.lockIconBox, { backgroundColor: colors.warning + "18" }]}>
            <Ionicons name="lock-closed" size={56} color={colors.warning} />
          </View>
          <Text style={[styles.lockTitle, { color: colors.foreground }]}>Multi-Branch Support Locked</Text>
          <Text style={[styles.lockSubtitle, { color: colors.mutedForeground }]}>
            Multi-branch location syncing, consolidated scans reports, and centralized manager auditing require an Enterprise plan subscription.
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
        <Text style={[styles.title, { color: colors.foreground }]}>Branches</Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => setAddModalVisible(true)}
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* List */}
      <FlatList
        data={branches}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 32 }]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconBox, { backgroundColor: colors.primary + "12" }]}>
                <Ionicons name="business" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.branchName, { color: colors.foreground }]}>{item.name}</Text>
                <Text style={[styles.branchLoc, { color: colors.mutedForeground }]} numberOfLines={1}>{item.location}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: colors.success + "15" }]}>
                <Text style={[styles.badgeText, { color: colors.success }]}>Active</Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <View style={styles.statsRow}>
              <View style={styles.statCol}>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>ACTIVE CASHIERS</Text>
                <Text style={[styles.statVal, { color: colors.foreground }]}>{item.cashiers} Cashiers</Text>
              </View>
              <View style={styles.statCol}>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>MONTHLY VERIFICATIONS</Text>
                <Text style={[styles.statVal, { color: colors.foreground }]}>{item.monthlyScans.toLocaleString()} Scans</Text>
              </View>
            </View>
          </View>
        )}
      />

      {/* Add Branch Modal */}
      <Modal visible={addModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Register Branch</Text>
            <View style={styles.inputWrap}>
              <Text style={[styles.inputLabel, { color: colors.foreground }]}>Branch Name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                placeholder="e.g. Bole Medhanialem Branch"
                placeholderTextColor={colors.mutedForeground}
                value={newBranchName}
                onChangeText={setNewBranchName}
              />
            </View>
            <View style={styles.inputWrap}>
              <Text style={[styles.inputLabel, { color: colors.foreground }]}>Address / Location</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                placeholder="e.g. Addis Ababa, Bole District"
                placeholderTextColor={colors.mutedForeground}
                value={newBranchLoc}
                onChangeText={setNewBranchLoc}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancel, { borderColor: colors.border }]}
                onPress={() => setAddModalVisible(false)}
              >
                <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSave, { backgroundColor: colors.primary }]}
                onPress={handleAddBranch}
              >
                <Text style={styles.saveText}>Save Branch</Text>
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
  list: { padding: 16, gap: 12 },
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  branchName: { fontSize: 15, fontFamily: "Inter_700Bold" },
  branchLoc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: { fontSize: 10, fontFamily: "Inter_700Bold", textTransform: "uppercase" },
  divider: { height: 1 },
  statsRow: { flexDirection: "row", gap: 16 },
  statCol: { flex: 1, gap: 4 },
  statLabel: { fontSize: 9, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  statVal: { fontSize: 13, fontFamily: "Inter_500Medium" },

  // Add modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    borderRadius: 20,
    padding: 24,
    gap: 16,
  },
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
