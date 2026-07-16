import React from "react";
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Platform,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useNotifications, Notification } from "@/contexts/NotificationContext";
import { useColors } from "@/hooks/useColors";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function NotificationsScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  const topPad = Platform.OS === "web" ? 20 : insets.top;

  // Render helper for notification icons & background colors
  const getStyleForType = (type: Notification["type"], read: boolean) => {
    switch (type) {
      case "SUCCESS":
        return {
          icon: "checkmark-circle" as const,
          color: colors.success,
          bg: read ? colors.card : colors.approved_bg || colors.success + "0A",
        };
      case "WARNING":
        return {
          icon: "warning" as const,
          color: colors.warning,
          bg: read ? colors.card : colors.suspicious_bg || colors.warning + "0A",
        };
      case "ALERT":
        return {
          icon: "alert-circle" as const,
          color: colors.destructive,
          bg: read ? colors.card : colors.rejected_bg || colors.destructive + "0A",
        };
      case "INFO":
      default:
        return {
          icon: "information-circle" as const,
          color: colors.primary,
          bg: read ? colors.card : colors.primary + "0A",
        };
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      
      // If today, show time
      if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      
      // If yesterday
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      if (date.toDateString() === yesterday.toDateString()) {
        return "Yesterday";
      }
      
      // Otherwise show date
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return "";
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.text === "#F8FAFC" ? "light-content" : "dark-content"} />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad }]}>
        <TouchableOpacity 
          style={[styles.backBtn, { borderColor: colors.border }]} 
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={20} color={colors.foreground} />
        </TouchableOpacity>
        
        <View style={styles.titleContainer}>
          <Text style={[styles.title, { color: colors.foreground }]}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.destructive }]}>
              <Text style={styles.badgeText}>{unreadCount} New</Text>
            </View>
          )}
        </View>

        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllAsRead} activeOpacity={0.7}>
            <Text style={[styles.markAll, { color: colors.primary }]}>Read All</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* List */}
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 40 }]}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconBox, { backgroundColor: colors.primary + "10" }]}>
              <Ionicons name="notifications-off-outline" size={40} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>All caught up!</Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
              You have no notifications. Important updates and receipt logs will appear here.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const config = getStyleForType(item.type, item.read);
          return (
            <TouchableOpacity
              style={[
                styles.notifCard,
                { 
                  backgroundColor: config.bg,
                  borderColor: item.read ? colors.border : config.color + "33",
                  borderWidth: 1
                }
              ]}
              onPress={() => {
                if (!item.read) {
                  markAsRead(item.id);
                }
              }}
              activeOpacity={0.9}
            >
              {/* Type Icon */}
              <View style={[styles.iconContainer, { backgroundColor: config.color + "1A" }]}>
                <Ionicons name={config.icon} size={20} color={config.color} />
              </View>

              {/* Text content */}
              <View style={styles.cardBody}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: item.read ? "Inter_600SemiBold" : "Inter_700Bold" }]}>
                    {item.title}
                  </Text>
                  <Text style={[styles.timeText, { color: colors.mutedForeground }]}>
                    {formatTime(item.createdAt)}
                  </Text>
                </View>
                
                <Text style={[styles.cardMessage, { color: colors.mutedForeground }]}>
                  {item.message}
                </Text>
              </View>

              {/* Actions container (Read Indicator + Delete) */}
              <View style={styles.cardRight}>
                {!item.read && (
                  <View style={[styles.unreadDot, { backgroundColor: config.color }]} />
                )}
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => deleteNotification(item.id)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        }}
      />
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
    borderBottomWidth: 1,
    borderBottomColor: "transparent",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },
  markAll: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  notifCard: {
    flexDirection: "row",
    padding: 14,
    borderRadius: 14,
    gap: 12,
    alignItems: "flex-start",
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: {
    fontSize: 14,
    flex: 1,
  },
  timeText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  cardMessage: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    lineHeight: 18,
  },
  cardRight: {
    alignItems: "center",
    justifyContent: "space-between",
    alignSelf: "stretch",
    paddingLeft: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  deleteBtn: {
    padding: 6,
    marginTop: "auto",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 100,
    paddingHorizontal: 30,
    gap: 12,
  },
  emptyIconBox: {
    width: 76,
    height: 76,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
});
