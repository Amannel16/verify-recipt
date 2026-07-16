import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  SafeAreaView,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth, BusinessType } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BUSINESS_TYPES: BusinessType[] = [
  "Retail",
  "Restaurant",
  "E-commerce",
  "Services",
  "Healthcare",
  "Education",
  "Other",
];

export default function EditProfileScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, updateProfile } = useAuth();

  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [businessName, setBusinessName] = useState(user?.businessName || "");
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || "");
  const [businessType, setBusinessType] = useState<BusinessType>(user?.businessType || "Other");
  
  const [saving, setSaving] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const topPad = Platform.OS === "web" ? 20 : insets.top;

  async function handleSave() {
    if (!firstName.trim()) {
      Alert.alert("Error", "First Name is required.");
      return;
    }
    
    setSaving(true);
    try {
      await updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        businessName: businessName.trim(),
        phoneNumber: phoneNumber.trim(),
        businessType,
      });
      Alert.alert("Success", "Profile updated successfully.", [
        { text: "OK", onPress: () => router.back() }
      ]);
    } catch (err) {
      Alert.alert("Error", "Failed to update profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: topPad }]}>
          <TouchableOpacity 
            style={[styles.backBtn, { borderColor: colors.border }]} 
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground }]}>Edit Profile</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView 
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar Area */}
          <View style={styles.avatarSection}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarText}>{firstName?.[0]?.toUpperCase() || "U"}</Text>
            </View>
            <Text style={[styles.avatarSub, { color: colors.mutedForeground }]}>
              {user?.email}
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* First Name */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>FIRST NAME</Text>
              <TextInput
                style={[
                  styles.input,
                  { 
                    backgroundColor: colors.card, 
                    color: colors.foreground,
                    borderColor: focusedField === "firstName" ? colors.primary : colors.border
                  }
                ]}
                value={firstName}
                onChangeText={setFirstName}
                onFocus={() => setFocusedField("firstName")}
                onBlur={() => setFocusedField(null)}
                placeholder="Enter first name"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            {/* Last Name */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>LAST NAME</Text>
              <TextInput
                style={[
                  styles.input,
                  { 
                    backgroundColor: colors.card, 
                    color: colors.foreground,
                    borderColor: focusedField === "lastName" ? colors.primary : colors.border
                  }
                ]}
                value={lastName}
                onChangeText={setLastName}
                onFocus={() => setFocusedField("lastName")}
                onBlur={() => setFocusedField(null)}
                placeholder="Enter last name"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            {/* Phone Number */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>PHONE NUMBER</Text>
              <TextInput
                style={[
                  styles.input,
                  { 
                    backgroundColor: colors.card, 
                    color: colors.foreground,
                    borderColor: focusedField === "phoneNumber" ? colors.primary : colors.border
                  }
                ]}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                onFocus={() => setFocusedField("phoneNumber")}
                onBlur={() => setFocusedField(null)}
                placeholder="e.g. +251 911 234 567"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="phone-pad"
              />
            </View>

            {/* Business Name */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>BUSINESS NAME</Text>
              <TextInput
                style={[
                  styles.input,
                  { 
                    backgroundColor: colors.card, 
                    color: colors.foreground,
                    borderColor: focusedField === "businessName" ? colors.primary : colors.border
                  }
                ]}
                value={businessName}
                onChangeText={setBusinessName}
                onFocus={() => setFocusedField("businessName")}
                onBlur={() => setFocusedField(null)}
                placeholder="Enter business name"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            {/* Business Type Selector */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>BUSINESS TYPE</Text>
              <TouchableOpacity
                style={[
                  styles.input,
                  styles.pickerTrigger,
                  { 
                    backgroundColor: colors.card, 
                    borderColor: colors.border
                  }
                ]}
                onPress={() => setPickerVisible(true)}
                activeOpacity={0.7}
              >
                <Text style={{ color: colors.foreground, fontSize: 15, fontFamily: "Inter_500Medium" }}>
                  {businessType}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: colors.primary }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color={colors.primaryForeground} size="small" />
            ) : (
              <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>
                Save Changes
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Business Type Modal Picker */}
      <Modal
        visible={pickerVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalDismiss} 
            activeOpacity={1} 
            onPress={() => setPickerVisible(false)} 
          />
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Select Business Type</Text>
              <TouchableOpacity onPress={() => setPickerVisible(false)} style={styles.modalClose}>
                <Ionicons name="close" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={BUSINESS_TYPES}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.pickerItem,
                    { 
                      borderBottomColor: colors.border,
                      backgroundColor: businessType === item ? colors.primary + "10" : "transparent"
                    }
                  ]}
                  onPress={() => {
                    setBusinessType(item);
                    setPickerVisible(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.pickerItemText, 
                    { 
                      color: businessType === item ? colors.primary : colors.foreground,
                      fontFamily: businessType === item ? "Inter_600SemiBold" : "Inter_500Medium"
                    }
                  ]}>
                    {item}
                  </Text>
                  {businessType === item && (
                    <Ionicons name="checkmark" size={18} color={colors.primary} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  avatarSection: {
    alignItems: "center",
    gap: 10,
    marginVertical: 20,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 32,
    fontFamily: "Inter_700Bold",
  },
  avatarSub: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  form: {
    gap: 16,
    marginBottom: 30,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    justifyContent: "center",
  },
  pickerTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  saveBtn: {
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  saveBtnText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalDismiss: {
    flex: 1,
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    maxHeight: "50%",
    paddingTop: 16,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  modalClose: {
    padding: 4,
  },
  pickerItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
  },
  pickerItemText: {
    fontSize: 15,
  },
});
