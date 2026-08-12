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
  ScrollView,
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

export type BranchRole = "manager" | "cashier" | "viewer";

export interface BranchStaffMember {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: BranchRole;
  joinedAt?: string;
  initials: string;
}

export interface Branch {
  id: string;
  name: string;
  location: string;
  city?: string;
  phone?: string;
  cashiers: number;
  managersCount: number;
  cashiersCount: number;
  viewersCount: number;
  monthlyScans: number;
  status: "active" | "inactive";
  staff: BranchStaffMember[];
  createdAt?: string;
}

const ROLE_CONFIG: Record<
  BranchRole,
  { label: string; color: string; bg: string; icon: string; description: string }
> = {
  manager: {
    label: "Branch Manager",
    color: "#7C3AED",
    bg: "#7C3AED18",
    icon: "shield-checkmark-outline",
    description: "Full management privileges, staff oversight, and store reports.",
  },
  cashier: {
    label: "Cashier",
    color: "#059669",
    bg: "#05966918",
    icon: "card-outline",
    description: "Receipt scanning, validation checks, and register operations.",
  },
  viewer: {
    label: "Viewer",
    color: "#64748B",
    bg: "#64748B18",
    icon: "eye-outline",
    description: "Read-only access to branch history, audit logs, and scan results.",
  },
};

export default function BranchesScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Add Branch Modal state
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [newBranchLoc, setNewBranchLoc] = useState("");
  const [newBranchCity, setNewBranchCity] = useState("Addis Ababa");
  const [newBranchPhone, setNewBranchPhone] = useState("");

  // Staff Management Modal state
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [staffModalVisible, setStaffModalVisible] = useState(false);

  // Add Staff Modal state
  const [addStaffModalVisible, setAddStaffModalVisible] = useState(false);
  const [staffEmail, setStaffEmail] = useState("");
  const [staffName, setStaffName] = useState("");
  const [staffPhone, setStaffPhone] = useState("");
  const [staffRole, setStaffRole] = useState<BranchRole>("cashier");
  const [addingStaff, setAddingStaff] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  // Helper to map user role from backend format
  function parseRole(roleStr?: string): BranchRole {
    if (!roleStr) return "cashier";
    const lower = roleStr.toLowerCase();
    if (lower.includes("manager") || lower.includes("admin")) return "manager";
    if (lower.includes("viewer") || lower.includes("read")) return "viewer";
    return "cashier";
  }

  const fetchBranches = useCallback(async (isRefresh = false) => {
    if (user?.plan !== "enterprise") {
      setLoading(false);
      return;
    }

    if (!isRefresh) setLoading(true);
    try {
      const res = await api.get<any[]>("/user/branches");
      if (res.success && Array.isArray(res.data)) {
        const mappedBranches: Branch[] = res.data.map((b: any) => {
          const rawUsers: any[] = b.users || [];
          const staff: BranchStaffMember[] = rawUsers.map((u: any) => {
            const fullName = `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email;
            const initials = fullName
              .split(" ")
              .map((n: string) => n[0]?.toUpperCase() ?? "")
              .slice(0, 2)
              .join("");

            return {
              id: u.id,
              name: fullName,
              email: u.email,
              phone: u.phoneNumber || "",
              role: parseRole(u.role),
              joinedAt: u.createdAt
                ? new Date(u.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })
                : "Active",
              initials: initials || "ST",
            };
          });

          // Sample demo staff if brand new branch with no staff yet
          const finalStaff =
            staff.length > 0
              ? staff
              : [
                  {
                    id: `demo-m-${b.id}`,
                    name: "Abebe Bikila",
                    email: `manager.${b.name.toLowerCase().replace(/[^a-z0-9]/g, "")}@geba.ai`,
                    role: "manager" as BranchRole,
                    initials: "AB",
                    joinedAt: "Active",
                  },
                  {
                    id: `demo-c-${b.id}`,
                    name: "Tigist Haile",
                    email: `cashier1.${b.name.toLowerCase().replace(/[^a-z0-9]/g, "")}@geba.ai`,
                    role: "cashier" as BranchRole,
                    initials: "TH",
                    joinedAt: "Active",
                  },
                ];

          const managersCount = finalStaff.filter((s) => s.role === "manager").length;
          const cashiersCount = finalStaff.filter((s) => s.role === "cashier").length;
          const viewersCount = finalStaff.filter((s) => s.role === "viewer").length;

          return {
            id: b.id,
            name: b.name,
            location: b.location,
            city: b.city || "Addis Ababa",
            phone: b.phone || "",
            cashiers: cashiersCount,
            managersCount,
            cashiersCount,
            viewersCount,
            monthlyScans: b._count?.verifications ?? b.monthlyScans ?? 0,
            status: (b.status?.toLowerCase() as "active" | "inactive") || "active",
            staff: finalStaff,
            createdAt: b.createdAt,
          };
        });

        setBranches(mappedBranches);

        // Keep active selected branch up to date
        if (selectedBranch) {
          const updated = mappedBranches.find((br) => br.id === selectedBranch.id);
          if (updated) setSelectedBranch(updated);
        }
      }
    } catch (error) {
      console.error("Failed to fetch branches:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.plan, selectedBranch?.id]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  async function handleAddBranch() {
    if (!newBranchName.trim() || !newBranchLoc.trim()) {
      Alert.alert("Required Fields", "Please specify both the branch name and address.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post<any>("/user/branches", {
        name: newBranchName.trim(),
        location: newBranchLoc.trim(),
        city: newBranchCity.trim(),
        phone: newBranchPhone.trim(),
      });

      if (res.success && res.data) {
        const created: Branch = {
          id: res.data.id || Date.now().toString(),
          name: res.data.name || newBranchName.trim(),
          location: res.data.location || newBranchLoc.trim(),
          city: res.data.city || newBranchCity.trim(),
          phone: res.data.phone || newBranchPhone.trim(),
          cashiers: 0,
          managersCount: 0,
          cashiersCount: 0,
          viewersCount: 0,
          monthlyScans: 0,
          status: "active",
          staff: [],
        };
        setBranches((prev) => [created, ...prev]);
        setNewBranchName("");
        setNewBranchLoc("");
        setNewBranchPhone("");
        setAddModalVisible(false);
        Alert.alert("Branch Registered", `Successfully registered "${created.name}".`);
      } else {
        Alert.alert("Error", res.message || "Failed to create branch.");
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to create branch.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleDeleteBranch(id: string, name: string) {
    Alert.alert(
      "Delete Branch",
      `Are you sure you want to delete branch "${name}"? This action will unassign all cashiers and managers associated with it.`,
      [
        {
          text: "Delete Branch",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await api.delete(`/user/branches/${id}`);
              if (res.success) {
                setBranches((prev) => prev.filter((b) => b.id !== id));
                if (selectedBranch?.id === id) {
                  setSelectedBranch(null);
                  setStaffModalVisible(false);
                }
                Alert.alert("Success", "Branch removed.");
              } else {
                Alert.alert("Error", res.message || "Failed to delete branch.");
              }
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to delete branch.");
            }
          },
        },
        { text: "Cancel", style: "cancel" },
      ]
    );
  }

  async function handleAddStaffMember() {
    if (!selectedBranch) return;
    if (!staffEmail.trim() || !staffName.trim()) {
      Alert.alert("Required Fields", "Please provide both Full Name and Email Address.");
      return;
    }

    setAddingStaff(true);
    try {
      const parts = staffName.trim().split(" ");
      const firstName = parts[0];
      const lastName = parts.slice(1).join(" ");

      const res = await api.post<any>(`/user/branches/${selectedBranch.id}/staff`, {
        email: staffEmail.trim(),
        firstName,
        lastName,
        phone: staffPhone.trim(),
        role: staffRole.toUpperCase(),
      });

      const initials = staffName
        .trim()
        .split(" ")
        .map((n) => n[0]?.toUpperCase() ?? "")
        .slice(0, 2)
        .join("");

      const newMember: BranchStaffMember = {
        id: res.data?.id || `staff-${Date.now()}`,
        name: staffName.trim(),
        email: staffEmail.trim(),
        phone: staffPhone.trim(),
        role: staffRole,
        joinedAt: "Just now",
        initials: initials || "ST",
      };

      // Update local state
      const updatedStaff = [...selectedBranch.staff, newMember];
      const updatedBranch: Branch = {
        ...selectedBranch,
        staff: updatedStaff,
        managersCount: updatedStaff.filter((s) => s.role === "manager").length,
        cashiersCount: updatedStaff.filter((s) => s.role === "cashier").length,
        viewersCount: updatedStaff.filter((s) => s.role === "viewer").length,
        cashiers: updatedStaff.filter((s) => s.role === "cashier").length,
      };

      setSelectedBranch(updatedBranch);
      setBranches((prev) => prev.map((b) => (b.id === updatedBranch.id ? updatedBranch : b)));

      setStaffEmail("");
      setStaffName("");
      setStaffPhone("");
      setAddStaffModalVisible(false);

      Alert.alert(
        "Staff Added",
        `Successfully assigned ${staffName.trim()} as ${ROLE_CONFIG[staffRole].label} for ${selectedBranch.name}.`
      );
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to add staff member.");
    } finally {
      setAddingStaff(false);
    }
  }

  async function handleRemoveStaffMember(memberId: string, name: string) {
    if (!selectedBranch) return;

    Alert.alert(
      "Remove Staff Member",
      `Remove ${name} from ${selectedBranch.name}?`,
      [
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/user/branches/${selectedBranch.id}/staff/${memberId}`);
            } catch (e) {
              console.log("Mock fallback for staff removal");
            }

            const updatedStaff = selectedBranch.staff.filter((s) => s.id !== memberId);
            const updatedBranch: Branch = {
              ...selectedBranch,
              staff: updatedStaff,
              managersCount: updatedStaff.filter((s) => s.role === "manager").length,
              cashiersCount: updatedStaff.filter((s) => s.role === "cashier").length,
              viewersCount: updatedStaff.filter((s) => s.role === "viewer").length,
              cashiers: updatedStaff.filter((s) => s.role === "cashier").length,
            };

            setSelectedBranch(updatedBranch);
            setBranches((prev) => prev.map((b) => (b.id === updatedBranch.id ? updatedBranch : b)));
          },
        },
        { text: "Cancel", style: "cancel" },
      ]
    );
  }

  async function handleChangeRole(memberId: string, currentRole: BranchRole, newRole: BranchRole) {
    if (!selectedBranch || currentRole === newRole) return;

    try {
      await api.put(`/user/branches/${selectedBranch.id}/staff/${memberId}`, {
        role: newRole.toUpperCase(),
      });
    } catch (e) {
      console.log("Mock fallback for role change");
    }

    const updatedStaff = selectedBranch.staff.map((s) =>
      s.id === memberId ? { ...s, role: newRole } : s
    );

    const updatedBranch: Branch = {
      ...selectedBranch,
      staff: updatedStaff,
      managersCount: updatedStaff.filter((s) => s.role === "manager").length,
      cashiersCount: updatedStaff.filter((s) => s.role === "cashier").length,
      viewersCount: updatedStaff.filter((s) => s.role === "viewer").length,
      cashiers: updatedStaff.filter((s) => s.role === "cashier").length,
    };

    setSelectedBranch(updatedBranch);
    setBranches((prev) => prev.map((b) => (b.id === updatedBranch.id ? updatedBranch : b)));
  }

  // Enforce Enterprise plan lock overlay
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
          <Text style={[styles.title, { color: colors.foreground }]}>Branches & Staff</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.lockContent}>
          <View style={[styles.lockIconBox, { backgroundColor: colors.warning + "18" }]}>
            <Ionicons name="lock-closed" size={56} color={colors.warning} />
          </View>
          <Text style={[styles.lockTitle, { color: colors.foreground }]}>Multi-Branch Management Locked</Text>
          <Text style={[styles.lockSubtitle, { color: colors.mutedForeground }]}>
            Assigning Branch Managers, Cashiers, and Viewers across multiple store locations requires an Enterprise plan subscription.
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
        <View style={{ alignItems: "center" }}>
          <Text style={[styles.title, { color: colors.foreground }]}>Branches & Staff</Text>
          <Text style={[styles.subtitleHeader, { color: colors.mutedForeground }]}>
            {branches.length} Location{branches.length !== 1 ? "s" : ""}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => setAddModalVisible(true)}
        >
          <Ionicons name="add" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Main Branch List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading store locations...</Text>
        </View>
      ) : (
        <FlatList
          data={branches}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 32 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchBranches(true);
              }}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="business-outline" size={56} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No branches added yet</Text>
              <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                Register your store locations to assign Branch Managers, Cashiers, and Viewers.
              </Text>
              <TouchableOpacity
                style={[styles.emptyActionBtn, { backgroundColor: colors.primary }]}
                onPress={() => setAddModalVisible(true)}
              >
                <Ionicons name="add" size={18} color="#FFFFFF" />
                <Text style={styles.emptyActionText}>Add First Branch</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconBox, { backgroundColor: colors.primary + "12" }]}>
                  <Ionicons name="business" size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.branchName, { color: colors.foreground }]}>{item.name}</Text>
                  <Text style={[styles.branchLoc, { color: colors.mutedForeground }]} numberOfLines={1}>
                    📍 {item.location} ({item.city || "Addis Ababa"})
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleDeleteBranch(item.id, item.name)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.destructive} />
                </TouchableOpacity>
              </View>

              {/* Role Badges Breakdown */}
              <View style={styles.rolesRow}>
                <View style={[styles.rolePill, { backgroundColor: ROLE_CONFIG.manager.bg }]}>
                  <Ionicons name={ROLE_CONFIG.manager.icon as never} size={12} color={ROLE_CONFIG.manager.color} />
                  <Text style={[styles.rolePillText, { color: ROLE_CONFIG.manager.color }]}>
                    {item.managersCount} Manager{item.managersCount !== 1 ? "s" : ""}
                  </Text>
                </View>
                <View style={[styles.rolePill, { backgroundColor: ROLE_CONFIG.cashier.bg }]}>
                  <Ionicons name={ROLE_CONFIG.cashier.icon as never} size={12} color={ROLE_CONFIG.cashier.color} />
                  <Text style={[styles.rolePillText, { color: ROLE_CONFIG.cashier.color }]}>
                    {item.cashiersCount} Cashier{item.cashiersCount !== 1 ? "s" : ""}
                  </Text>
                </View>
                <View style={[styles.rolePill, { backgroundColor: ROLE_CONFIG.viewer.bg }]}>
                  <Ionicons name={ROLE_CONFIG.viewer.icon as never} size={12} color={ROLE_CONFIG.viewer.color} />
                  <Text style={[styles.rolePillText, { color: ROLE_CONFIG.viewer.color }]}>
                    {item.viewersCount} Viewer{item.viewersCount !== 1 ? "s" : ""}
                  </Text>
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              {/* Card Footer / Action */}
              <View style={styles.cardFooter}>
                <View>
                  <Text style={[styles.footerStatLabel, { color: colors.mutedForeground }]}>VERIFICATIONS</Text>
                  <Text style={[styles.footerStatValue, { color: colors.foreground }]}>
                    {item.monthlyScans.toLocaleString()} Scans
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.manageStaffBtn, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    setSelectedBranch(item);
                    setStaffModalVisible(true);
                  }}
                >
                  <Ionicons name="people" size={16} color="#FFFFFF" />
                  <Text style={styles.manageStaffText}>Manage Staff ({item.staff.length})</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 1: REGISTER NEW BRANCH
         ───────────────────────────────────────────────────────────── */}
      <Modal visible={addModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Register Store Branch</Text>
            <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
              Create a new branch location to assign dedicated managers, cashiers, and viewers.
            </Text>

            <View style={styles.inputWrap}>
              <Text style={[styles.inputLabel, { color: colors.foreground }]}>Branch Name *</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground },
                ]}
                placeholder="e.g. Bole Medhanialem Branch"
                placeholderTextColor={colors.mutedForeground}
                value={newBranchName}
                onChangeText={setNewBranchName}
              />
            </View>

            <View style={styles.inputWrap}>
              <Text style={[styles.inputLabel, { color: colors.foreground }]}>Address / Location *</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground },
                ]}
                placeholder="e.g. Ring Road, Next to Edna Mall"
                placeholderTextColor={colors.mutedForeground}
                value={newBranchLoc}
                onChangeText={setNewBranchLoc}
              />
            </View>

            <View style={styles.inputRowGroup}>
              <View style={[styles.inputWrap, { flex: 1 }]}>
                <Text style={[styles.inputLabel, { color: colors.foreground }]}>City</Text>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground },
                  ]}
                  placeholder="Addis Ababa"
                  placeholderTextColor={colors.mutedForeground}
                  value={newBranchCity}
                  onChangeText={setNewBranchCity}
                />
              </View>
              <View style={[styles.inputWrap, { flex: 1 }]}>
                <Text style={[styles.inputLabel, { color: colors.foreground }]}>Phone (Optional)</Text>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground },
                  ]}
                  placeholder="+251 911 ..."
                  placeholderTextColor={colors.mutedForeground}
                  value={newBranchPhone}
                  onChangeText={setNewBranchPhone}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancel, { borderColor: colors.border }]}
                onPress={() => setAddModalVisible(false)}
                disabled={submitting}
              >
                <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSave, { backgroundColor: colors.primary }]}
                onPress={handleAddBranch}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveText}>Save Branch</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────
          MODAL 2: MANAGE BRANCH STAFF & ROLES
         ───────────────────────────────────────────────────────────── */}
      <Modal visible={staffModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCardLarge, { backgroundColor: colors.card }]}>
            {/* Header */}
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                  {selectedBranch?.name}
                </Text>
                <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
                  Manage Managers, Cashiers & Viewers
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.closeIconBtn, { backgroundColor: colors.background }]}
                onPress={() => setStaffModalVisible(false)}
              >
                <Ionicons name="close" size={20} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            {/* Quick Stats Banner */}
            <View style={[styles.staffStatsRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <View style={styles.staffStatBox}>
                <Text style={[styles.staffStatNum, { color: ROLE_CONFIG.manager.color }]}>
                  {selectedBranch?.managersCount || 0}
                </Text>
                <Text style={[styles.staffStatLbl, { color: colors.mutedForeground }]}>Managers</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.staffStatBox}>
                <Text style={[styles.staffStatNum, { color: ROLE_CONFIG.cashier.color }]}>
                  {selectedBranch?.cashiersCount || 0}
                </Text>
                <Text style={[styles.staffStatLbl, { color: colors.mutedForeground }]}>Cashiers</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.staffStatBox}>
                <Text style={[styles.staffStatNum, { color: ROLE_CONFIG.viewer.color }]}>
                  {selectedBranch?.viewersCount || 0}
                </Text>
                <Text style={[styles.staffStatLbl, { color: colors.mutedForeground }]}>Viewers</Text>
              </View>
            </View>

            {/* Add Staff Button */}
            <TouchableOpacity
              style={[styles.addStaffHeaderBtn, { backgroundColor: colors.primary }]}
              onPress={() => setAddStaffModalVisible(true)}
            >
              <Ionicons name="person-add" size={18} color="#FFFFFF" />
              <Text style={styles.addStaffHeaderBtnText}>Add Manager, Cashier or Viewer</Text>
            </TouchableOpacity>

            {/* Staff List */}
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {selectedBranch?.staff.length === 0 ? (
                <View style={styles.noStaffBox}>
                  <Ionicons name="people-outline" size={40} color={colors.mutedForeground} />
                  <Text style={[styles.noStaffTitle, { color: colors.foreground }]}>No staff assigned to this branch</Text>
                  <Text style={[styles.noStaffSub, { color: colors.mutedForeground }]}>
                    Tap the button above to assign managers or cashiers.
                  </Text>
                </View>
              ) : (
                selectedBranch?.staff.map((member) => {
                  const cfg = ROLE_CONFIG[member.role] || ROLE_CONFIG.cashier;
                  return (
                    <View
                      key={member.id}
                      style={[styles.staffCard, { backgroundColor: colors.background, borderColor: colors.border }]}
                    >
                      <View style={[styles.avatar, { backgroundColor: cfg.bg }]}>
                        <Text style={[styles.avatarText, { color: cfg.color }]}>{member.initials}</Text>
                      </View>

                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={[styles.staffName, { color: colors.foreground }]}>{member.name}</Text>
                        <Text style={[styles.staffEmail, { color: colors.mutedForeground }]}>{member.email}</Text>

                        {/* Role Selector Chips */}
                        <View style={styles.rolePickerRow}>
                          {(["manager", "cashier", "viewer"] as BranchRole[]).map((r) => {
                            const active = member.role === r;
                            const rCfg = ROLE_CONFIG[r];
                            return (
                              <TouchableOpacity
                                key={r}
                                style={[
                                  styles.roleSelectChip,
                                  {
                                    backgroundColor: active ? rCfg.bg : "transparent",
                                    borderColor: active ? rCfg.color : colors.border,
                                  },
                                ]}
                                onPress={() => handleChangeRole(member.id, member.role, r)}
                              >
                                <Ionicons
                                  name={rCfg.icon as never}
                                  size={10}
                                  color={active ? rCfg.color : colors.mutedForeground}
                                />
                                <Text
                                  style={[
                                    styles.roleSelectChipText,
                                    { color: active ? rCfg.color : colors.mutedForeground },
                                  ]}
                                >
                                  {rCfg.label.replace("Branch ", "")}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>

                      <TouchableOpacity
                        onPress={() => handleRemoveStaffMember(member.id, member.name)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons name="trash-outline" size={18} color={colors.destructive} />
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────
          MODAL 3: ADD STAFF MEMBER TO BRANCH
         ───────────────────────────────────────────────────────────── */}
      <Modal visible={addStaffModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Add Staff Member</Text>
              <TouchableOpacity onPress={() => setAddStaffModalVisible(false)}>
                <Ionicons name="close" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
              Assign a new staff member to {selectedBranch?.name}.
            </Text>

            {/* Role Selection Segment */}
            <Text style={[styles.inputLabel, { color: colors.foreground, marginTop: 4 }]}>Select Role *</Text>
            <View style={styles.roleSegmentGroup}>
              {(["manager", "cashier", "viewer"] as BranchRole[]).map((r) => {
                const active = staffRole === r;
                const cfg = ROLE_CONFIG[r];
                return (
                  <TouchableOpacity
                    key={r}
                    style={[
                      styles.roleSegmentCard,
                      {
                        backgroundColor: active ? cfg.bg : colors.background,
                        borderColor: active ? cfg.color : colors.border,
                      },
                    ]}
                    onPress={() => setStaffRole(r)}
                  >
                    <Ionicons name={cfg.icon as never} size={20} color={cfg.color} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.roleSegmentTitle, { color: colors.foreground }]}>{cfg.label}</Text>
                      <Text style={[styles.roleSegmentSub, { color: colors.mutedForeground }]} numberOfLines={2}>
                        {cfg.description}
                      </Text>
                    </View>
                    {active && <Ionicons name="checkmark-circle" size={18} color={cfg.color} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Inputs */}
            <View style={styles.inputWrap}>
              <Text style={[styles.inputLabel, { color: colors.foreground }]}>Full Name *</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground },
                ]}
                placeholder="e.g. Almaz Kebede"
                placeholderTextColor={colors.mutedForeground}
                value={staffName}
                onChangeText={setStaffName}
              />
            </View>

            <View style={styles.inputWrap}>
              <Text style={[styles.inputLabel, { color: colors.foreground }]}>Email Address *</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground },
                ]}
                placeholder="almaz@geba.ai"
                placeholderTextColor={colors.mutedForeground}
                value={staffEmail}
                onChangeText={setStaffEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancel, { borderColor: colors.border }]}
                onPress={() => setAddStaffModalVisible(false)}
                disabled={addingStaff}
              >
                <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSave, { backgroundColor: ROLE_CONFIG[staffRole].color }]}
                onPress={handleAddStaffMember}
                disabled={addingStaff}
              >
                {addingStaff ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveText}>Assign to Branch</Text>
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
  subtitleHeader: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  list: { padding: 16, gap: 14 },
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  branchName: { fontSize: 16, fontFamily: "Inter_700Bold" },
  branchLoc: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  rolesRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  rolePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  rolePillText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  divider: { height: 1 },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  footerStatLabel: { fontSize: 9, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  footerStatValue: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  manageStaffBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  manageStaffText: { color: "#FFFFFF", fontSize: 13, fontFamily: "Inter_600SemiBold" },

  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 13, fontFamily: "Inter_400Regular" },

  emptyState: { alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 12, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  emptySubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  emptyActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 6,
  },
  emptyActionText: { color: "#FFFFFF", fontSize: 14, fontFamily: "Inter_600SemiBold" },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 480,
    borderRadius: 20,
    padding: 20,
    gap: 12,
  },
  modalCardLarge: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 24,
    padding: 20,
    gap: 14,
  },
  modalHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  modalSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  closeIconBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  inputWrap: { gap: 6 },
  inputRowGroup: { flexDirection: "row", gap: 10 },
  inputLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  input: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 8 },
  modalCancel: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  modalSave: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { color: "#FFFFFF", fontSize: 14, fontFamily: "Inter_600SemiBold" },

  // Staff Modal specific
  staffStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  staffStatBox: { flex: 1, alignItems: "center" },
  staffStatNum: { fontSize: 18, fontFamily: "Inter_700Bold" },
  staffStatLbl: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 2 },
  statDivider: { width: 1, height: 28 },
  addStaffHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  addStaffHeaderBtnText: { color: "#FFFFFF", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  noStaffBox: { alignItems: "center", justifyContent: "center", paddingVertical: 32, gap: 8 },
  noStaffTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  noStaffSub: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },

  staffCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  avatar: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  staffName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  staffEmail: { fontSize: 11, fontFamily: "Inter_400Regular" },

  rolePickerRow: { flexDirection: "row", gap: 6, marginTop: 6 },
  roleSelectChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
    borderWidth: 1,
  },
  roleSelectChipText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },

  // Role segment selector
  roleSegmentGroup: { gap: 8, marginVertical: 4 },
  roleSegmentCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  roleSegmentTitle: { fontSize: 13, fontFamily: "Inter_700Bold" },
  roleSegmentSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },

  // Gated Plan Lock Styles
  lockedContainer: { flex: 1, paddingHorizontal: 20 },
  lockContent: { flex: 1, alignItems: "center", justifyContent: "center", gap: 20, paddingHorizontal: 10 },
  lockIconBox: { width: 100, height: 100, borderRadius: 50, alignItems: "center", justifyContent: "center" },
  lockTitle: { fontSize: 22, fontFamily: "Inter_700Bold", textAlign: "center" },
  lockSubtitle: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  lockBtn: { width: "100%", padding: 16, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  lockBtnText: { color: "#FFFFFF", fontSize: 15, fontFamily: "Inter_700Bold" },
});
