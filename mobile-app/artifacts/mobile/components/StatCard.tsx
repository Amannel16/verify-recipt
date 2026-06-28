import { Ionicons } from "@expo/vector-icons";
import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from "react-native-reanimated";
import { useColors } from "@/hooks/useColors";

interface Props {
  label: string;
  value: number;
  icon: string;
  color: string;
  delay?: number;
  prefix?: string;
}

export function StatCard({ label, value, icon, color, delay = 0, prefix = "" }: Props) {
  const colors = useColors();
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(delay, withSpring(1, { damping: 12 }));
    opacity.value = withDelay(delay, withSpring(1));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[animStyle, styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={[styles.iconBox, { backgroundColor: color + "20" }]}>
        <Ionicons name={icon as never} size={20} color={color} />
      </View>
      <Text style={[styles.value, { color: colors.foreground }]}>
        {prefix}{value.toLocaleString()}
      </Text>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    minWidth: 140,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  value: { fontSize: 24, fontFamily: "Inter_700Bold" },
  label: { fontSize: 12, fontFamily: "Inter_500Medium" },
});
